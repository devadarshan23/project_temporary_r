/**
 * THE STAFF CONSOLE, THE APEX AND E1 PER HOST — the green fixes for
 * `docs/build/ui-audit/red-partner-staff-apex.md`'s RS-xx, RA-xx and RP-04.
 * G3581–G3592, 3 Oct 2026. (The 390 overflow and the console host's E1 are
 * also witnessed in a real browser at `tests/e2e/staff-console.test.ts` §5–§6.)
 *
 *   §1 G3588 — ONE `initialsOf` (§5.3), and it gives two letters everywhere.
 *   §2 G3581 — E1 sends each host to ITS OWN home, worded for that surface,
 *      and never to a route the host does not serve (RP-04, RS-02).
 *   §3 RS-04/05/07/08/10 — the staff console's quiet sections and its address.
 *   §4 RS-01 — the staff stylesheet lets the scroller, not the page, scroll.
 *   §5 RA-01/02/03/04 — the apex lookup and demo.
 *
 * Source scans read the file with comments blanked, so a sentence ABOUT a
 * removed string cannot satisfy or fail an assertion about the code. The E1
 * records and the initials are `.ts` modules and are driven directly.
 *
 * WITNESSED RED against `origin/main` (4adf2d24) with this file applied and
 * `frontend/` reverted — `error-copy.ts` stubbed from the old `ErrorPage.tsx`
 * records (every host's home the register) and `SITE_HOME` appended to
 * `routes/apex.ts`, so the file loads and each section is judged: §1a (two
 * declarations), §2a–§2d, §3a–§3f, §4a–§4c and §5a–§5d failed — twenty. §1b
 * passed because the helper it drives already gave two letters (the red for
 * `Mei` is `close-round2.test.ts`'s, which drove the OTHER helper), and §2e
 * and §5e are pins on what already stood.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { initialsOf } from '../../frontend/src/initials.ts'
import { ERRORS, HOME_WAY, errorCopyFor, type ErrorCode } from '../../frontend/src/error-copy.ts'
import { SURFACES, type Surface } from '../../frontend/src/routes/surface.ts'
import { SITE_HOME } from '../../frontend/src/routes/apex.ts'

const ROOT = path.resolve(import.meta.dirname, '../..')
const read = (rel: string): string => readFileSync(path.join(ROOT, rel), 'utf8')

function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1'))
    .join('\n')
}

function filesUnder(rel: string): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const name of readdirSync(path.join(ROOT, dir))) {
      if (name === 'dist' || name === 'node_modules') continue
      const r = path.join(dir, name)
      if (statSync(path.join(ROOT, r)).isDirectory()) walk(r)
      else if (/\.(ts|tsx)$/.test(name)) out.push(r)
    }
  }
  walk(rel)
  return out
}

describe('§1 G3588 · one helper for the account square', () => {
  it('§1a exactly one `initialsOf` is declared in either bundle, in initials.ts', () => {
    const decls = [...filesUnder('frontend/src'), ...filesUnder('frontend/site/src')].filter((f) =>
      /\b(?:export\s+)?(?:function\s+initialsOf\b|const\s+initialsOf\s*=)/.test(code(read(f))),
    )
    assert.deepEqual(decls, ['frontend/src/initials.ts'], `two helpers answer one question (§5.3): ${decls.join(', ')}`)
  })

  it('§1b two initials everywhere — a one-word name gives two letters', () => {
    assert.equal(initialsOf('Mei'), 'ME')
    assert.equal(initialsOf('Parity FDE'), 'PF')
    assert.equal(initialsOf(null), '·')
  })
})

const CODES = Object.keys(ERRORS) as ErrorCode[]
/** What each host SERVES at the top level, for a way out of E1. */
const SERVES: { readonly [S in Surface]: readonly string[] } = {
  tenant: ['/close', '/signin'],
  partner: ['/', '/signin'],
  console: ['/', '/signin'],
}
const SURFACE_WORDS: { readonly [S in Surface]: RegExp } = {
  tenant: /register/,
  partner: /partner portal/,
  console: /staff console/,
}

describe('§2 G3581 (the owner\'s) · E1 on each host goes to that host\'s home', () => {
  it('§2a every way out is a route that host serves, or the public site', () => {
    const bad: string[] = []
    for (const s of SURFACES) {
      for (const c of CODES) {
        for (const w of errorCopyFor(c, s).ways) {
          if (w.to !== SITE_HOME && !SERVES[s].includes(w.to)) bad.push(`${s} ${c}: "${w.label}" → ${w.to}`)
        }
      }
    }
    assert.deepEqual(bad, [])
  })

  it('§2b the home way names its surface, and a console or partner host is never sent to the register', () => {
    for (const s of SURFACES) assert.match(`${HOME_WAY[s].label} ${HOME_WAY[s].note}`, SURFACE_WORDS[s])
    for (const s of ['partner', 'console'] as const) {
      for (const c of CODES) {
        const w = errorCopyFor(c, s).ways
        assert.ok(w.every((x) => x.to !== '/close' && !/register/.test(x.label)), `${s} ${c} still offers the register`)
      }
      for (const c of ['403', '404', '500', '503'] as const) {
        assert.ok(errorCopyFor(c, s).ways.some((x) => x.label === HOME_WAY[s].label), `${s} ${c} does not name its own home`)
      }
    }
  })

  it('§2c a console or partner 503 speaks of no tenant data and no run', () => {
    for (const s of ['partner', 'console'] as const) {
      for (const c of CODES.filter((x) => x !== '429')) {
        const e = errorCopyFor(c, s)
        const words = [e.head, e.said, e.means, e.refWhy, e.own ?? ''].join(' ')
        assert.doesNotMatch(words, /your data|If a run was due|tenant’s own audit trail|A run in flight/, `${s} ${c}: ${words}`)
      }
    }
  })

  it('§2d the page reads its surface from the host, through routes/surface.ts', () => {
    const page = code(read('frontend/src/components/ErrorPage.tsx'))
    assert.match(page, /surfaceOf\(window\.location\.hostname\)/)
    assert.match(page, /errorCopyFor\(code, surface\)/)
    assert.equal(SITE_HOME.startsWith('https://'), true, 'the site is not the apex')
  })

  it('§2e PIN — the tenant host keeps the pack\'s E1 copy and the register', () => {
    for (const c of CODES) {
      const e = errorCopyFor(c, 'tenant')
      assert.equal(e.head, ERRORS[c].head)
      assert.equal(e.said, ERRORS[c].said)
    }
    assert.deepEqual(errorCopyFor('404', 'tenant').ways[0], { label: 'Back to your register', note: 'where your work is', to: '/close' })
    assert.equal(errorCopyFor('503', 'tenant').ways[0].label, 'Try again in a few minutes')
  })
})

describe('§3 the staff console', () => {
  const src = code(read('frontend/src/components/StaffConsole.tsx'))

  it('§3a RS-04 · "Coming soon" is never printed as page copy, only the tooltip', () => {
    assert.doesNotMatch(src, /Coming soon/)
    assert.match(src, /<tr className="quiet">\{heads\.map\(\(h\) => <td key=\{h\}>—<\/td>\)\}<\/tr>/)
  })

  it('§3b RS-04 · H4\'s *New floor* is drawn, disabled', () => {
    assert.match(src, /New floor<\/span>\s*<input type="text" disabled/)
  })

  it('§3c RS-05 · the billing period is the pack\'s two parts', () => {
    assert.match(src, /<span className="mono">—<\/span>\s*<span className="q">billing period<\/span>/)
  })

  it('§3d RS-07 · the record is Mode · Residency · Retention · Support access · Plan', () => {
    const rec = src.slice(src.indexOf('the tenant record</span>'), src.indexOf('Mode and residency are frozen'))
    const keys = [...rec.matchAll(/className="k">([^<]+)</g)].map((m) => m[1])
    assert.deepEqual(keys, ['Mode', 'Residency', 'Retention', 'Support access', 'Plan'])
  })

  it('§3e RS-08 · an unmeasured figure is a quiet <Soon>, not a bare dash', () => {
    assert.match(src, /<QuietFig k="Stalled over 14 days" \/>/)
    assert.doesNotMatch(src, /aria-label="not measured yet"/)
  })

  it('§3f RS-10 · a tenant record is an address: `?tenant=` pushed and followed back', () => {
    assert.match(src, /const TENANT_PARAM = 'tenant'/)
    assert.match(src, /window\.history\.pushState\(null, '', addressFor\(tenantId\)\)/)
    assert.match(src, /addEventListener\('popstate'/)
  })
})

describe('§4 RS-01 · the staff pane does not widen the page', () => {
  const css = code(read('frontend/src/staff.css'))
  const rule = (sel: string): string => {
    const m = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find((r) => (r[1] ?? '').trim() === sel)
    assert.ok(m, `no rule for ${sel}`)
    return m[2] ?? ''
  }

  it('§4a the work column and the pane may shrink below their content', () => {
    assert.match(rule('.staff > .staff-work'), /min-width:0/)
    assert.match(rule('.staff .pane'), /min-width:0/)
    assert.match(rule('.staff .pane'), /grid-template-columns:minmax\(0,1fr\)/)
  })

  it('§4b the scroller is the containing block for the table\'s sr-only labels', () => {
    assert.match(rule('.staff .scroller'), /position:relative/)
  })

  it('§4c at the phone tier the quiet chrome buttons are dropped, as close.css drops a bare .abtn', () => {
    assert.match(css, /@media \(max-width:719px\)\{\s*\.staff \.chrome > \.tipwrap:has\(> \.abtn\)\{display:none\}/)
  })
})

describe('§5 the apex', () => {
  const lookup = code(read('frontend/site/src/Lookup.tsx'))
  const demo = code(read('frontend/site/src/Demo.tsx'))

  it('§5a RA-01 · the host suffix is not a `.field > span` micro-label, and does not wrap', () => {
    const start = lookup.indexOf('Your organisation&rsquo;s sign-in name')
    assert.ok(start > 0, 'the sign-in name field was not found')
    const field = lookup.slice(start, lookup.indexOf('</label>', start))
    assert.match(field, /<\/span>\s*<div style=\{\{ display: 'flex'/, 'the input and suffix are still wrapped in a <span> child of label.field')
    assert.match(field, /whiteSpace: 'nowrap' \}\} data-lookup-suffix/)
  })

  it('§5b RA-02 · no "door" in the routed panel', () => {
    assert.doesNotMatch(lookup, /names a door/)
  })

  /* ⚠️ THIS PINNED *"stored until you book"* (G3592) UNTIL 4 Oct 2026 AND IS
     AMENDED, NOT DELETED — G3715, NA-02, THE OWNER'S RULING: *"Switch to
     'send': copy says 'until you send it', amend V2's two notes; no calendar
     integration."* The page books nothing and the button sends, so the pack's
     two notes were amended with it (`V2 Book a Demo.dc.html`). */
  it('§5c RA-03 → NA-02 · the demo says "until you send it", as the amended V2 does', () => {
    /* Three: V2's two notes, and NA-03's "Still needed" line (G3716). */
    assert.equal((demo.match(/sent until you send it\./g) ?? []).length, 3)
    assert.doesNotMatch(demo, /until you book/)
  })

  it('§5d RA-04 · /lookup carries V3\'s right-hand panel, four audiences', () => {
    assert.match(lookup, /<aside className="auds-col" data-lookup-lands>/)
    assert.match(lookup, /You land in the right place/)
    const whos = [...lookup.matchAll(/who: '([^']+)'/g)].map((m) => m[1])
    assert.deepEqual(whos, ['Customer · user', 'Customer · approver', 'Partner', '1CloudHub'])
  })

  it('§5e RA-04 · G266 — no credential is said to carry the role', () => {
    assert.doesNotMatch(lookup, /passkey carries the role/i)
  })
})

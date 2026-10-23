/**
 * THE ENTRY SHELL, SETUP, THE TWO CONSOLES AND THE APEX — the green fixes for
 * the red re-audit's RC-26 · RC-27 · RC-28 · RV-14 · RV-17 · N-04 · N-05.
 * G3481–G3486, 3 Oct 2026. (N-07 is `css-raw-values.test.ts` §5–§6, G3487.)
 *
 * Source scans, because `tests/` compiles `.ts` only and the components are
 * `.tsx`: each section reads the file with comments blanked, so a sentence
 * ABOUT a removed string cannot satisfy or fail an assertion about the code.
 * `initialsOf()` is a `.ts` module and is driven directly.
 *
 *   §1 RC-28 — E1 never says "plane", never quotes an internal error code, and
 *      the 404 offers no sign-in to a reader who may already be signed in;
 *      "What to quote" is sentence case.
 *   §2 RC-26/RC-27 — Setup says no "data plane"; its two pack controls are two
 *      elements; the pending bind is plain words.
 *   §3 RV-17 — Setup is a `.page` drill-down typeset by kernel classes, with no
 *      utility class, and "Needs you" keeps its count on `/setup`.
 *   §4 N-04 — both console menus carry the theme toggle, and the account
 *      square carries two initials from the stored name.
 *   §5 RV-14 — "‹ Back to the site" is underlined; only the lockup is not.
 *   §6 N-05 — the apex declares its theme, so a dark OS does not darken the
 *      UA's own surfaces over a light page.
 *
 * WITNESSED RED against `origin/main` (a077216f) with this file applied and the
 * sources reverted: §1a, §1b, §1c, §1d, §2a, §2b, §2c, §3a, §3b, §3c, §4a, §4b,
 * §5a and §6a failed — sixteen, §4a and §4b once per console. §1e and §4c (anti-vacuity, and the pure
 * helper new in this commit) and the three PINS §5b, §6b, §6c passed, as they
 * must: they hold what already stood.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { initialsOf, NO_INITIALS } from '../../frontend/src/initials.ts'

const ROOT = path.resolve(import.meta.dirname, '../..')
const read = (rel: string): string => readFileSync(path.join(ROOT, rel), 'utf8')

/** Block comments and JSX `{/* … *\/}` comments and `//` line comments blanked. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1'))
    .join('\n')
}

/** Every string literal ('…', "…", `…`) in a stretch of code. */
function literals(src: string): string[] {
  return [...src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map(
    (m) => m[1] ?? m[2] ?? m[3] ?? '',
  )
}

const PLANE = /\bplane\b/i
/** The service's closed error vocabulary is snake_case; a reader never sees it. */
const INTERNAL_CODE = /\b(?:internal_error|upstream_unavailable|session_invalid|[a-z]+_[a-z]+_?[a-z]*)\b/

/* E1's records moved out of the component into a `.ts` module so they can be
   driven directly (G3581); the scan follows them. */
const ERROR_PAGE = 'frontend/src/error-copy.ts'
const CALLERS = [
  'frontend/src/main.tsx',
  'frontend/src/components/StaffConsole.tsx',
  'frontend/src/components/PartnerPortal.tsx',
  'frontend/src/routes/screens.ts',
] as const

function errorsBlock(): string {
  const src = code(read(ERROR_PAGE))
  const start = src.indexOf('export const ERRORS')
  const end = src.indexOf('export function errorCopyFor')
  assert.ok(start > 0 && end > start, 'error-copy.ts no longer declares ERRORS before errorCopyFor — §1 read nothing')
  return src.slice(start, end)
}

/** The `quote` each caller hands E1: JSX `quote=` and `createElement(ErrorPage, { quote })`. */
function quotesIn(src: string): string[] {
  return [...src.matchAll(/quote(?:=|:\s*)(\{[^}\n]*\}|"[^"\n]*"|'[^'\n]*'|[A-Za-z_.]+)/g)].map((m) => m[1] ?? '')
}

describe('§1 RC-28 · E1 speaks to the reader, not about the plane', () => {
  it('§1a no copy in the six records says "plane"', () => {
    const copy = literals(errorsBlock())
    assert.ok(copy.length > 40, `only ${copy.length} literal(s) in ERRORS — the scan went blind`)
    assert.deepEqual(copy.filter((s) => PLANE.test(s)), [], 'E1 copy still says "plane" — internal vocabulary')
  })

  it('§1b the 404 offers no sign-in — this page cannot know the reader is signed out', () => {
    const block = errorsBlock()
    const four = block.slice(block.indexOf("'404'"), block.indexOf("'429'"))
    assert.ok(four.length > 50, 'the 404 record was not found')
    assert.doesNotMatch(four, /\/signin/, 'the 404 still offers "Sign in" to a reader who may already be signed in')
  })

  it('§1c no caller quotes "plane" or an internal error code to the reader', () => {
    const found: string[] = []
    for (const rel of CALLERS) {
      const src = code(read(rel))
      for (const q of quotesIn(src)) {
        if (/\.code\b/.test(q)) found.push(`${rel}: quote=${q} (the service's own code)`)
        for (const lit of literals(q)) {
          if (PLANE.test(lit) || INTERNAL_CODE.test(lit)) found.push(`${rel}: quote ${JSON.stringify(lit)}`)
        }
      }
      for (const lit of literals(src)) {
        if (/the plane (?:answered|returned)|from the plane/i.test(lit)) found.push(`${rel}: ${JSON.stringify(lit)}`)
      }
    }
    assert.deepEqual(found, [], 'E1\'s "What to quote" line exposes infrastructure')
  })

  it('§1d "What to quote" is sentence case — entry.css does not upper-case `.e1 .lab`', () => {
    const css = code(read('frontend/src/entry.css'))
    const upper = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter((m) => /\.e1\s+\.lab\b/.test(m[1] ?? '') && /text-transform\s*:\s*uppercase/.test(m[2] ?? ''))
      .map((m) => (m[1] ?? '').trim())
    assert.deepEqual(upper, [], 'E1 draws "What to quote" in sentence case; the app upper-cases it')
  })

  it('§1e anti-vacuity: the matchers see what stood before', () => {
    assert.deepEqual(quotesIn("<ErrorPage code=\"401\" quote={roster.code} />\nquote: 'x'"), ['{roster.code}', "'x'"])
    assert.ok(literals("`the plane answered ${String(s)}`").some((s) => PLANE.test(s)))
    assert.ok(INTERNAL_CODE.test('500 · internal_error'))
    assert.ok(!INTERNAL_CODE.test('no session'))
  })
})

describe('§2 RC-26 / RC-27 · Setup and the pending bind in plain words', () => {
  const setup = code(read('frontend/src/components/Setup.tsx'))

  it('§2a Setup says no "data plane" and no "the plane" anywhere a reader sees', () => {
    assert.deepEqual(literals(setup).filter((s) => PLANE.test(s)), [])
    assert.doesNotMatch(setup.replace(/^[^<]*$/gm, ''), /\bdata plane\b|\bthe plane\b/i,
      'Setup\'s JSX text still says "plane"')
  })

  it('§2b "Packs installed" and "Install a blueprint" are two controls, as the pack draws them', () => {
    assert.doesNotMatch(setup, /Packs installed\s*·\s*Install a blueprint/, 'the two controls are still fused into one')
    assert.match(setup, /<span className="lab">Packs installed<\/span>/, 'the heading is not its own label')
    assert.match(setup, /<Soon className="abtn">Install a blueprint<\/Soon>/, 'the act is not its own control')
  })

  it('§2c the pending bind is plain words, not engineering narration', () => {
    const main = code(read('frontend/src/main.tsx'))
    assert.doesNotMatch(main, /Binding this session to the tenant served here/)
    assert.match(main, /data-binding="pending">Opening your workspace\.</)
  })
})

describe('§3 RV-17 · Setup is a drill-down page, typeset by the kernel', () => {
  const setup = code(read('frontend/src/components/Setup.tsx'))
  const classes = [...setup.matchAll(/className="([^"]*)"/g)].flatMap((m) => (m[1] ?? '').split(/\s+/))
  const UTILITY = /^(?:text-(?:title|body|label|micro|muted)|flex|flex-col|gap-\d+|measure|p[xytrbl]?-\d+|m[xytrbl]?-\d+)$/

  it('§3a no utility class anywhere in Setup', () => {
    assert.ok(classes.length > 20, `only ${classes.length} class token(s) read — the scan went blind`)
    assert.deepEqual([...new Set(classes.filter((c) => UTILITY.test(c)))], [],
      'Setup is still typeset by utility classes rather than the pack\'s kernel classes')
  })

  it('§3b its root is `.page`, the run account\'s and the finding\'s frame, so the left edge agrees', () => {
    assert.match(setup, /<div className="page setup" data-setup>/)
    assert.ok(classes.includes('lab') && classes.includes('q') && classes.includes('tbl'),
      'Setup does not use the kernel\'s .lab / .q / .tbl')
  })

  it('§3c "Needs you" keeps its count on /setup', () => {
    const main = code(read('frontend/src/main.tsx'))
    assert.match(main, /const readsNeedsYou = onCloseScreens \|\| \(route\.kind === 'route' && route\.path === '\/setup'\)/)
    assert.match(main, /needsYou=\{readsNeedsYou \? needsYouAll : null\}/)
  })
})

describe('§4 N-04 · the console menus carry the theme toggle and two initials', () => {
  for (const rel of ['frontend/src/components/StaffConsole.tsx', 'frontend/src/components/PartnerPortal.tsx']) {
    const src = code(read(rel))
    const name = path.basename(rel)

    it(`§4a ${name} mounts <ThemeToggle/> inside its account menu`, () => {
      assert.match(src, /import \{ ThemeToggle \} from '\.\/ThemeToggle\.tsx'/, `${name} does not import the shared toggle`)
      const menu = src.slice(src.indexOf('className="acctmenu"'), src.indexOf('</AccountMenu>'))
      assert.ok(menu.length > 0, `${name} has no account menu`)
      assert.match(menu, /<ThemeToggle (menu )?\/>/, `${name}'s account menu has no theme toggle (G3392)`)
    })

    it(`§4b ${name}'s account square reads the stored name`, () => {
      assert.match(src, /<span className="init" aria-hidden="true">\{initialsOf\(principal\?\.displayName\)\}<\/span>/,
        `${name}'s account square does not carry the person's initials`)
    })
  }

  it('§4c initialsOf: two initials, `·` only when there is no name', () => {
    assert.equal(initialsOf('Devi Krishnan'), 'DK')
    assert.equal(initialsOf('  rosalie   ann  tan '), 'RT')
    assert.equal(initialsOf('Madonna'), 'MA')
    assert.equal(initialsOf('Ólafur Arnalds'), 'ÓA')
    assert.equal(initialsOf('李 小龍'), '李小')
    assert.equal(initialsOf("O'Brien, Pat"), 'OP')
    assert.equal(initialsOf(''), NO_INITIALS)
    assert.equal(initialsOf('   '), NO_INITIALS)
    assert.equal(initialsOf('42 · —'), NO_INITIALS)
    assert.equal(initialsOf(null), NO_INITIALS)
    assert.equal(initialsOf(undefined), NO_INITIALS)
    assert.equal(NO_INITIALS, '·')
  })
})

describe('§5 RV-14 · "‹ Back to the site" is underlined', () => {
  const rules = [...code(read('frontend/src/entry.css')).matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({
    sel: (m[1] ?? '').trim(),
    body: m[2] ?? '',
  }))

  it('§5a only the lockup link loses its underline; the back link is underlined at rest', () => {
    const stripped = rules
      .filter((r) => /text-decoration\s*:\s*none/.test(r.body))
      .flatMap((r) => r.sel.split(',').map((s) => s.trim()))
      .filter((s) => /\.top\b[^,]*\ba\b/.test(s) && !/a:first-child$/.test(s))
    assert.deepEqual(stripped, [], 'a rule still strips the underline from every link in the top row')
    assert.ok(
      rules.some((r) => /\.top a\.small\b/.test(r.sel) && !/:hover/.test(r.sel) && /text-decoration\s*:\s*underline/.test(r.body)),
      'the back link is not underlined at rest (E1 Errors.dc.html, V3 Sign In.dc.html)',
    )
  })

  it('§5b the back link is still the `.small` the pack draws', () => {
    /* G3581: it goes to the SITE (the apex), no longer to this host's `/`. */
    assert.match(code(read('frontend/src/components/EntryTop.tsx')), /<a href=\{SITE_HOME\} className="small" data-back-to-site>/)
  })
})

describe('§6 N-05 · the apex declares its theme', () => {
  const PAGES = ['index.html', 'demo/index.html', 'lookup/index.html', 'story/index.html'] as const

  it('§6a every apex page is declared light, so `color-scheme` is `light` on a dark OS', () => {
    const undeclared = PAGES.filter((p) => !/<html lang="en" data-theme="light">/.test(read(`frontend/site/${p}`)))
    assert.deepEqual(undeclared, [],
      'an apex page sets no data-theme, so the kernel\'s `color-scheme: light dark` paints dark scrollbars over a white page')
  })

  it('§6b the kernel maps the declaration to color-scheme (the half §6a relies on)', () => {
    assert.match(read('docs/handoff-pack/tokens.css'), /\[data-theme="light"\]\{color-scheme:light\}/)
  })

  it('§6c the apex sets the theme in markup only — it ships no theme script that could follow the OS', () => {
    const entry = code(read('frontend/site/src/entry.tsx'))
    assert.doesNotMatch(entry, /theme-boot|startTheme|prefers-color-scheme/)
  })
})

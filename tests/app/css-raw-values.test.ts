/**
 * THE KERNEL IS THE ONLY PLACE A TYPE OR LAYER VALUE IS DECLARED — a source
 * scan of `frontend/src/**.css`. RV-05 · RV-10 · RV-11 · RV-12 · RM-05;
 * G3393–G3395, G3394. 3 Oct 2026.
 *
 * The red-team audit (`docs/build/ui-audit/red-visual-tokens.md`) counted, in
 * product CSS with comments stripped: 5 literal face stacks, 13 bare
 * font-weights, 6 literal trackings, 4 literal line-heights and 5 z-index
 * literals — every one a value the kernel already names (`--face-mono`,
 * `--w-*`, `--tr-*`, `--lh-*`, `--z-*`). None was wrong TODAY; each diverges
 * silently the first time the kernel moves. And `red-motion-mark.md` RM-05
 * found the one transition the app declared reading `var(--t-enter)`, a token
 * the kernel had retired — invalid at computed-value time, so the tooltip fade
 * resolved to `0s` and nothing anywhere said so.
 *
 *   §1 no raw font-weight / letter-spacing / line-height / z-index / face
 *      stack outside the allow-list, each allow-list entry carrying a reason;
 *   §2 the allow-list is not stale — every entry still matches a real line
 *      (an entry nothing needs is a hole waiting for a value to walk into);
 *   §3 every `var(--x)` resolves to a custom property DECLARED somewhere —
 *      the kernel or a frontend stylesheet (RM-05's class);
 *   §4 anti-vacuity: the scanner finds each planted defect in a fixture.
 *
 * WITNESSED RED against `origin/main` (549d3dd5): §1 reported 31 lines — the
 * audit's 33 less the two allow-listed entry.css trackings — and §3 reported
 * `--t-enter` in overlays.css.
 *
 * ✅ N-07 — G3487, 3 Oct 2026. THE SCAN COULD NOT SEE TWO PLACES A VALUE LIVES:
 * a TSX `style={{…}}` object (×46 in the staff console and partner portal, ×83
 * in the apex site), and the apex site (`frontend/site`) at all. §5 reads every
 * `.tsx` under both roots for the same five properties in camelCase plus a RAW
 * COLOUR (a hex or an `rgb()` in a colour-bearing property); §1 now scans
 * `frontend/site` stylesheets as well, and gains the raw-colour rule.
 * WITNESSED RED against `origin/main` (a077216f), with the sources reverted and
 * this file applied: §5 reported THREE lines — `lineHeight: 1` at
 * `Landing.tsx:108`, `Story.tsx:35` and `Story.tsx:58`. Those are bound to
 * `var(--lh-solid)` (the kernel's name for exactly 1, "a one-line control box";
 * a display figure is one line). The other three the audit named —
 * `PublicPlane.tsx` `.08em` and `#fff`, `Story.tsx` `.08em` — are pack-copied
 * and allow-listed below WITH THEIR REASONS, so §5 does not list them.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SRC = path.join(ROOT, 'frontend/src')
const SITE = path.join(ROOT, 'frontend/site')
const KERNEL = path.join(ROOT, 'docs/handoff-pack/tokens.css')

/** Comments blanked, NEWLINES KEPT, so a finding's line number is the file's. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
}

function filesUnder(dir: string, ext: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith(ext) && !f.split(path.sep).includes('node_modules') && !f.split(path.sep).includes('dist'))
    .map((f) => path.join(dir, f))
}
const cssFiles = (dir: string): string[] => filesUnder(dir, '.css')

interface Rule { readonly name: string; readonly re: RegExp; readonly token: string }

/** Each forbids a LITERAL where a kernel token exists. `0`/`normal`/`inherit`
 *  are not literals of a scale and are allowed. */
const RULES: readonly Rule[] = [
  { name: 'font-weight', re: /font-weight\s*:\s*\d/, token: 'var(--w-*)' },
  { name: 'letter-spacing', re: /letter-spacing\s*:\s*-?(?:\d*\.\d+|[1-9]\d*)(?:em|px|rem)?/, token: 'var(--tr-*)' },
  { name: 'line-height', re: /line-height\s*:\s*(?:\d*\.\d+|\d+)(?![\w(-])/, token: 'var(--lh-*)' },
  { name: 'z-index', re: /z-index\s*:\s*-?\d/, token: 'var(--z-*)' },
  { name: 'face stack', re: /(?:font-family|font)\s*:[^;}]*(?:'IBM Plex|"IBM Plex|ui-monospace|system-ui)/, token: 'var(--face-sans) / var(--face-mono)' },
  { name: 'raw colour', re: /:\s*[^;{}]*(?:#[0-9a-fA-F]{3,8}\b|rgba?\()/, token: 'a colour token (var(--ink), var(--paper) …)' },
]

/**
 * N-07 — THE SAME FIVE, AND A RAW COLOUR, AS A TSX INLINE STYLE WRITES THEM.
 * Keyed on the camelCase PROPERTY, not on `style={{`, because a style object
 * may be a `const` handed to `style={big}` (`Story.tsx` does exactly that).
 * `0`, `normal` and `var(--…)` are not literals of a scale and pass.
 */
const INLINE_RULES: readonly Rule[] = [
  { name: 'fontWeight', re: /\bfontWeight\s*:\s*['"]?\d/, token: "'var(--w-*)'" },
  { name: 'letterSpacing', re: /\bletterSpacing\s*:\s*['"]?-?(?:\d*\.\d+|[1-9]\d*)/, token: "'var(--tr-*)'" },
  { name: 'lineHeight', re: /\blineHeight\s*:\s*['"]?(?:\d*\.\d+|[1-9]\d*)(?![\w(-])/, token: "'var(--lh-*)'" },
  { name: 'zIndex', re: /\bzIndex\s*:\s*['"]?-?[1-9]/, token: "'var(--z-*)'" },
  { name: 'fontFamily', re: /\bfontFamily\s*:\s*['"](?!var\()/, token: "'var(--face-sans)' / 'var(--face-mono)'" },
  {
    name: 'raw colour',
    re: /\b(?:color|background|backgroundColor|borderColor|border|outline|outlineColor|boxShadow|fill|stroke|textDecorationColor)\s*:\s*['"`][^'"`]*(?:#[0-9a-fA-F]{3,8}\b|rgba?\()/,
    token: 'a colour token',
  },
]

interface Allowed { readonly file: string; readonly match: string; readonly reason: string }

/** EVERY ENTRY CARRIES ITS REASON. Adding one is a decision, written here. */
const ALLOW: readonly Allowed[] = [
  /* ✅ G3662 — THE OWNER'S RULING ON G3400 (3 Oct 2026): *"Snap to kernel
     scale."* The two apex `.08em` labels (`PublicPlane.tsx`, `Story.tsx`) WERE
     allowed here as pack-copied and left with the owner; both now read
     `var(--tr-micro)`, the kernel's nearest step, and their entries are
     deleted rather than left to excuse the next literal. The `#fff` plate
     below is a different question (a colour, not a tracking) and stays. */
  {
    file: 'PublicPlane.tsx',
    match: "backgroundColor: '#fff'",
    reason: 'the plate behind the 1CloudHub JPEG mark, which carries its own WHITE ground. It must stay white in any ' +
      'theme, so it is deliberately NOT var(--paper) (which is dark in the dark theme); the apex is light-only (N-05).',
  },
  /* ✅ `close.css` `z-index:2` (the status bar) WAS ALLOWED HERE, OWED TO THE
     CLOSE-SURFACE SLICE — and is paid there (G3434): it is now
     `calc(var(--z-popover) - 2)`, the kernel's lowest layer less two, so the
     entry is deleted rather than left to excuse the next literal. */
  /* ✅ G3662 — `entry.css`'s `.06em` (key hints) and `.12em` (the E1 code
     line) WERE ALLOWED HERE under G3400 / RV-11. The owner ruled *"Snap to
     kernel scale"*: both now read `var(--tr-micro)` (.1em is the nearest of
     the kernel's paired steps to each), so no tracking literal is allowed
     anywhere in `frontend/`. */
]

interface Finding { readonly file: string; readonly line: number; readonly rule: string; readonly text: string }

function scan(file: string, css: string): Finding[] {
  const out: Finding[] = []
  const lines = stripComments(css).split('\n')
  lines.forEach((text, i) => {
    for (const r of RULES) {
      if (r.re.test(text)) out.push({ file, line: i + 1, rule: r.name, text: text.trim() })
    }
  })
  return out
}

/** TSX: block comments blanked as for CSS, and `//` line comments too. */
function scanInline(file: string, src: string): Finding[] {
  const out: Finding[] = []
  stripComments(src).split('\n').forEach((raw, i) => {
    const text = raw.replace(/(^|[^:'"`])\/\/.*$/, '$1')
    for (const r of INLINE_RULES) {
      if (r.re.test(text)) out.push({ file, line: i + 1, rule: r.name, text: text.trim() })
    }
  })
  return out
}

const allowedBy = (f: Finding): Allowed | undefined =>
  ALLOW.find((a) => path.basename(f.file) === a.file && f.text.replace(/\s+/g, ' ').includes(a.match))

describe('frontend CSS carries no raw type or layer value the kernel names', () => {
  const files = [...cssFiles(SRC), ...cssFiles(SITE)]
  const tsx = [...filesUnder(SRC, '.tsx'), ...filesUnder(SITE, '.tsx')]

  it('§0 the scan has a subject', () => {
    assert.ok(files.length >= 5, `only ${files.length} stylesheet(s) under frontend/src — the scan read nothing`)
  })

  it('§1 every font-weight, tracking, leading, z-index and face is a kernel token', () => {
    const offenders = files
      .flatMap((f) => scan(f, readFileSync(f, 'utf8')))
      .filter((f) => allowedBy(f) === undefined)
    assert.deepEqual(
      offenders.map((o) => `${path.relative(ROOT, o.file)}:${o.line} [${o.rule}] ${o.text} → use ${RULES.find((r) => r.name === o.rule)?.token}`),
      [],
      'a literal where the kernel names the value — bind it to the token, or add an ALLOW entry WITH ITS REASON',
    )
  })

  it('§2 every allow-list entry still matches a real line', () => {
    const all = [
      ...files.flatMap((f) => scan(f, readFileSync(f, 'utf8'))),
      ...tsx.flatMap((f) => scanInline(f, readFileSync(f, 'utf8'))),
    ]
    for (const a of ALLOW) {
      assert.ok(a.reason.length > 40, `ALLOW ${a.file} \`${a.match}\` carries no real reason`)
      assert.ok(all.some((f) => allowedBy(f) === a),
        `ALLOW ${a.file} \`${a.match}\` matches nothing any more — delete it so it cannot excuse the next value`)
    }
  })

  it('§2b G3662 — no tracking literal is allow-listed: the owner ruled G3400 "Snap to kernel scale"', () => {
    const trackings = ALLOW.filter((a) => /letter-?spacing/i.test(a.match))
    assert.deepEqual(trackings.map((a) => `${a.file} ${a.match}`), [],
      'G3400 is ruled: a tracking binds to the kernel\'s nearest --tr-* step, and is never allow-listed')
  })

  it('§3 every var(--x) resolves to a declared custom property (RM-05)', () => {
    const declared = new Set<string>()
    for (const f of [KERNEL, ...files]) {
      for (const m of stripComments(readFileSync(f, 'utf8')).matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
        if (m[1] !== undefined) declared.add(m[1])
      }
    }
    const missing: string[] = []
    for (const f of files) {
      stripComments(readFileSync(f, 'utf8')).split('\n').forEach((text, i) => {
        for (const m of text.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*(,)?/g)) {
          const name = m[1]
          if (name !== undefined && m[2] === undefined && !declared.has(name)) {
            missing.push(`${path.relative(ROOT, f)}:${i + 1} ${name}`)
          }
        }
      })
    }
    assert.deepEqual(missing, [],
      'an undeclared var() makes its declaration INVALID AT COMPUTED-VALUE TIME — the property silently falls back')
  })

  it('§4 anti-vacuity: each rule fires on a planted literal and passes its token', () => {
    const planted = [
      '.a{font-weight:600}', '.b{letter-spacing:.1em}', '.c{line-height:1.5}',
      '.d{z-index:3}', ".e{font-family:'IBM Plex Mono', ui-monospace, monospace}",
    ].join('\n')
    assert.deepEqual(scan('fixture.css', planted).map((f) => f.rule),
      ['font-weight', 'letter-spacing', 'line-height', 'z-index', 'face stack'])
    const clean = [
      '.a{font-weight:var(--w-emph)}', '.b{letter-spacing:var(--tr-micro)}', '.c{line-height:var(--lh-note)}',
      '.d{z-index:var(--z-popover)}', '.e{font-family:var(--face-mono)}', '.f{letter-spacing:0}',
      '/* font-weight: 600 in a comment */',
    ].join('\n')
    assert.deepEqual(scan('fixture.css', clean), [])
  })

  it('§5 N-07 · every inline style in both bundles uses a kernel token for type, layer and colour', () => {
    assert.ok(tsx.some((f) => f.startsWith(SITE)), 'no .tsx under frontend/site — the apex was not scanned')
    assert.ok(tsx.length >= 30, `only ${tsx.length} .tsx file(s) scanned — the inline scan read nothing`)
    const offenders = tsx
      .flatMap((f) => scanInline(f, readFileSync(f, 'utf8')))
      .filter((f) => allowedBy(f) === undefined)
    assert.deepEqual(
      offenders.map((o) => `${path.relative(ROOT, o.file)}:${o.line} [${o.rule}] ${o.text} → use ${INLINE_RULES.find((r) => r.name === o.rule)?.token}`),
      [],
      'an inline style writes a literal the kernel names — bind it to the token, or add an ALLOW entry WITH ITS REASON',
    )
  })

  it('§6 N-07 · anti-vacuity: the inline scan fires on each planted literal and passes its token', () => {
    const planted = [
      "<b style={{ fontWeight: 600 }} />", "<b style={{ letterSpacing: '.08em' }} />", '<b style={{ lineHeight: 1 }} />',
      '<b style={{ zIndex: 3 }} />', "<b style={{ fontFamily: 'IBM Plex Mono' }} />", "<b style={{ backgroundColor: '#fff' }} />",
    ].join('\n')
    assert.deepEqual(scanInline('fixture.tsx', planted).map((f) => f.rule),
      ['fontWeight', 'letterSpacing', 'lineHeight', 'zIndex', 'fontFamily', 'raw colour'])
    const clean = [
      "<b style={{ fontWeight: 'var(--w-emph)' }} />", "<b style={{ letterSpacing: 'var(--tr-micro)' }} />",
      "<b style={{ lineHeight: 'var(--lh-solid)' }} />", "<b style={{ zIndex: 'var(--z-popover)' }} />",
      "<b style={{ fontFamily: 'var(--face-mono)' }} />", "<b style={{ color: 'var(--ink)', margin: 0 }} />",
      "/* style={{ background: '#fff' }} in a comment */", "// lineHeight: 1 in a line comment",
    ].join('\n')
    assert.deepEqual(scanInline('fixture.tsx', clean), [])
    assert.deepEqual(scan('fixture.css', '.p{background:#fff}\n.q{color:rgb(0,0,0)}\n#route-root{color:var(--ink)}').map((f) => f.rule),
      ['raw colour', 'raw colour'])
  })
})

/**
 * RV-13 — THE THEME FOLLOWS THE OS, OVERRIDABLE. THE OWNER'S RULING OF
 * 3 Oct 2026 (G3392): *"Dark theme follows the OS setting
 * (prefers-color-scheme) with a light/dark/system toggle in the account menu."*
 *
 * The pure half of `frontend/src/theme.ts`, plus the one coupling that can
 * drift silently: `frontend/public/theme-boot.js`, the first-paint script `index.html` loads, spells the storage
 * key and the media query a second time. The browser half — a dark-scheme
 * context lands on `data-theme="dark"` with no click, and the toggle overrides
 * and persists — is `tests/e2e/browser-login.test.ts` §31.
 *
 * WITNESSED RED against `origin/main` (549d3dd5): the module did not exist, and
 * `grep -rn "data-theme" frontend/src` returned nothing — no writer at all.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  DARK_QUERY,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  parsePreference,
  readPreference,
  resolveTheme,
  writePreference,
  type PreferenceStore,
} from '../../frontend/src/theme.ts'

const ROOT = path.resolve(import.meta.dirname, '../..')

function memory(): PreferenceStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v) } }
}
const throwing: PreferenceStore = {
  getItem: () => { throw new Error('SecurityError: storage is disabled') },
  setItem: () => { throw new Error('QuotaExceededError') },
}

describe('the theme — resolution', () => {
  it('§1 system follows the OS; an explicit choice overrides it either way', () => {
    assert.equal(resolveTheme('system', true), 'dark')
    assert.equal(resolveTheme('system', false), 'light')
    assert.equal(resolveTheme('light', true), 'light')
    assert.equal(resolveTheme('dark', false), 'dark')
  })

  it('§2 the default, and anything unrecognised, is system — never a guess', () => {
    for (const raw of [null, undefined, '', 'Dark', 'sepia', '{"x":1}']) {
      assert.equal(parsePreference(raw), 'system', `stored ${String(raw)} did not fall back to system`)
    }
    for (const p of THEME_PREFERENCES) assert.equal(parsePreference(p), p)
  })
})

describe('the theme — persistence never throws', () => {
  it('§3 a choice round-trips through storage under the one key', () => {
    const store = memory()
    assert.equal(writePreference(store, 'dark'), true)
    assert.equal(store.data.get(THEME_STORAGE_KEY), 'dark')
    assert.equal(readPreference(store), 'dark')
  })

  it('§4 blocked or absent storage degrades to system and reports, never throws', () => {
    assert.equal(readPreference(throwing), 'system')
    assert.equal(writePreference(throwing, 'light'), false)
    assert.equal(readPreference(null), 'system')
    assert.equal(writePreference(null, 'light'), false)
  })
})

describe('the theme — the first-paint copy (frontend/public/theme-boot.js)', () => {
  const html = readFileSync(path.join(ROOT, 'frontend/index.html'), 'utf8')
  const script = readFileSync(path.join(ROOT, 'frontend/public/theme-boot.js'), 'utf8')

  it('§5 index.html loads theme-boot.js before the bundle, with the SAME key and query', () => {
    assert.match(html, /<script src="\/theme-boot\.js"><\/script>/, 'index.html does not load the first-paint theme script — a dark reader sees a light flash')
    assert.doesNotMatch(html, /<script>[^<]/, 'an INLINE script in index.html — a CSP would have to allow it')
    assert.ok(script.includes(`'${THEME_STORAGE_KEY}'`), `the inline script does not read '${THEME_STORAGE_KEY}'`)
    assert.ok(script.includes(`'${DARK_QUERY}'`), `the inline script does not query '${DARK_QUERY}'`)
    assert.ok(/try\s*\{/.test(script), 'the inline script touches storage outside a try')
    assert.ok(html.indexOf('theme-boot.js') < html.indexOf('type="module"'), 'the theme is set AFTER the bundle loads')
  })

  it('§6 the inline script resolves exactly as the module does', () => {
    for (const stored of [null, 'light', 'dark', 'system', 'junk']) {
      for (const osDark of [true, false]) {
        let set: string | null = null
        const fn = new Function('localStorage', 'matchMedia', 'document', script)
        fn(
          { getItem: (k: string) => (k === THEME_STORAGE_KEY ? stored : null) },
          (q: string) => ({ matches: q === DARK_QUERY && osDark }),
          { documentElement: { setAttribute: (_: string, v: string) => { set = v } } },
        )
        assert.equal(set, resolveTheme(parsePreference(stored), osDark),
          `inline script and theme.ts disagree for stored=${String(stored)} osDark=${osDark}`)
      }
    }
  })
})

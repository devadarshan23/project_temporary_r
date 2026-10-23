/**
 * RV-01 / RV-02 — THE KERNEL'S FACES ARE SHIPPED, NOT MERELY NAMED. G3391.
 *
 * The red-team audit (`docs/build/ui-audit/red-visual-tokens.md`) measured the
 * portal declaring `'IBM Plex Sans'` on 176 elements while `document.fonts` was
 * EMPTY and the BUILT stylesheet carried **0** `@font-face`. A computed
 * `font-family` is the declaration, not the rendered face, so no assertion that
 * reads `getComputedStyle` could ever have caught it. This suite reads the
 * BUILD instead — the two bundles `npm run check` produces before `npm test`:
 *
 *   §1 every face the kernel's six weight jobs need is declared by an
 *      `@font-face` in the emitted CSS, `font-display:swap`, family spelled as
 *      `tokens.css` spells it;
 *   §2 every `url()` those rules name resolves to a woff2 that IS in `dist/`;
 *   §3 the two critical faces are preloaded from each HTML entry, at the SAME
 *      hashed URL the `@font-face` uses (a preload of a different URL is a
 *      second download, not a preload);
 *   §4 no page reaches a third-party font host;
 *   §5 the OFL licence is committed beside the files.
 *
 * The browser half — `document.fonts` reports Plex LOADED and a canvas measure
 * differs from the fallback — is `tests/e2e/browser-login.test.ts` §FONTS.
 *
 * WITNESSED RED against `origin/main` (549d3dd5): §1 fails with
 * "0 @font-face rules in frontend/dist/assets/index-*.css", and §4 fails on the
 * apex site's four `fonts.googleapis.com` links.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')

/** The kernel's family names, read from the kernel rather than restated. */
function kernelFamily(token: '--face-sans' | '--face-mono'): string {
  const kernel = readFileSync(path.join(ROOT, 'docs/handoff-pack/tokens.css'), 'utf8')
  const m = new RegExp(`${token}:'([^']+)'`).exec(kernel)
  assert.ok(m?.[1], `${token} is not declared with a quoted family in tokens.css`)
  return m[1]
}

/** Weight jobs (`tokens.css` §TYPE) mapped onto the face that performs them. */
const REQUIRED: ReadonlyArray<readonly ['--face-sans' | '--face-mono', number]> = [
  ['--face-sans', 200], ['--face-sans', 300], ['--face-sans', 400],
  ['--face-sans', 600], ['--face-sans', 700],
  ['--face-mono', 400], ['--face-mono', 500], ['--face-mono', 600],
]

interface FontFace { family: string; weight: number; display: string; url: string }

function faces(css: string): FontFace[] {
  const out: FontFace[] = []
  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = m[1] ?? ''
    const family = /font-family:\s*["']?([^;"']+)["']?/.exec(body)?.[1]?.trim() ?? ''
    const weight = Number(/font-weight:\s*(\d+)/.exec(body)?.[1] ?? NaN)
    const display = /font-display:\s*([a-z]+)/.exec(body)?.[1] ?? ''
    const url = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(body)?.[1] ?? ''
    out.push({ family, weight, display, url })
  }
  return out
}

const BUNDLES = [
  { name: 'the portal', dist: path.join(ROOT, 'frontend/dist'), html: ['index.html'] },
  {
    name: 'the apex site',
    dist: path.join(ROOT, 'frontend/site/dist'),
    html: ['index.html', 'demo/index.html', 'lookup/index.html', 'story/index.html'],
  },
] as const

for (const bundle of BUNDLES) {
  describe(`self-hosted Plex — ${bundle.name}`, () => {
    const assets = path.join(bundle.dist, 'assets')
    const cssFiles = (): string[] => {
      assert.ok(existsSync(assets), `${assets} is absent — npm run build:frontend runs before npm test`)
      return readdirSync(assets).filter((f) => f.endsWith('.css'))
    }
    const allFaces = (): FontFace[] =>
      cssFiles().flatMap((f) => faces(readFileSync(path.join(assets, f), 'utf8')))

    it('§1 declares every face the six weight jobs need, with font-display:swap', () => {
      const declared = allFaces()
      assert.ok(declared.length > 0,
        `0 @font-face rules in ${path.relative(ROOT, assets)}/*.css — the kernel names Plex and nothing ships it (RV-01)`)
      for (const [token, weight] of REQUIRED) {
        const family = kernelFamily(token)
        const hit = declared.find((f) => f.family === family && f.weight === weight)
        assert.ok(hit, `no @font-face for ${family} ${weight} (${token})`)
        assert.equal(hit.display, 'swap', `${family} ${weight} is not font-display:swap`)
      }
    })

    it('§2 every @font-face url() is a woff2 present in dist', () => {
      for (const f of allFaces()) {
        assert.match(f.url, /\.woff2$/, `${f.family} ${f.weight} does not name a woff2: ${f.url}`)
        assert.ok(f.url.startsWith('/assets/'), `${f.url} is not a hashed build asset`)
        assert.ok(existsSync(path.join(bundle.dist, f.url)), `${f.url} is named and not emitted`)
      }
    })

    it('§3 each HTML entry preloads the critical faces at the @font-face URL', () => {
      const urls = new Set(allFaces().map((f) => f.url))
      for (const page of bundle.html) {
        const html = readFileSync(path.join(bundle.dist, page), 'utf8')
        const preloads = [...html.matchAll(/<link\b[^>]*rel="preload"[^>]*as="font"[^>]*>/g)].map((m) => m[0])
        assert.ok(preloads.length >= 2, `${page} preloads ${preloads.length} font(s), expected the two critical faces`)
        for (const link of preloads) {
          const href = /href="([^"]+)"/.exec(link)?.[1] ?? ''
          assert.ok(urls.has(href), `${page} preloads ${href}, which no @font-face uses — a second download, not a preload`)
          assert.match(link, /\bcrossorigin\b/, `${page}: a font preload without crossorigin is fetched twice`)
        }
      }
    })

    it('§4 no page reaches a third-party font host', () => {
      for (const page of bundle.html) {
        const html = readFileSync(path.join(bundle.dist, page), 'utf8')
        assert.doesNotMatch(html, /<link[^>]+(fonts\.googleapis\.com|fonts\.gstatic\.com)/,
          `${page} still links Google Fonts`)
      }
      for (const f of cssFiles()) {
        const css = readFileSync(path.join(assets, f), 'utf8')
        assert.doesNotMatch(css, /fonts\.(googleapis|gstatic)\.com/, `${f} reaches Google Fonts`)
      }
    })
  })
}

describe('self-hosted Plex — the licence', () => {
  it('§5 the OFL text is committed beside the font files', () => {
    const ofl = readFileSync(path.join(ROOT, 'frontend/fonts/OFL.txt'), 'utf8')
    assert.match(ofl, /SIL Open Font License, Version 1\.1/)
    assert.match(ofl, /Reserved Font Name "Plex"/)
  })
})

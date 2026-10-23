/**
 * THE APEX MARKETING SITE — what it is built from, what it may claim, and where
 * it hands a visitor on. G3151–G3158, 2 Oct 2026, under the OWNER'S ruling of
 * the same day: *"Apex only: serve /demo and /lookup from the apex marketing
 * site (Amplify); tenant/console hosts redirect there. The marketing site needs
 * building."*
 *
 * No browser and no database: this reads the source tree, the pack and the
 * BUILT site (`frontend/site/dist`, which `npm run check` builds inside
 * `build:frontend` before `npm test`). The browser half is
 * `tests/e2e/browser-login.test.ts` §28.
 *
 *   §1 · the four pages are built, PRERENDERED, and are the site's;
 *   §2 · 🛑 the cleared figures are the pack's, exactly — V1 and V4 (G268);
 *   §3 · 🛑 nothing PRODUCT.md forbids is on any page or in any asset;
 *   §4 · the site's module graph holds no application surface and no `/v1` client;
 *   §5 · the two hand-offs — the app's redirect, and `/lookup`'s Continue.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { APEX_HOST, AWS_REGION, RESERVED_HOST_LABELS } from '../../infra/lib/config.ts'
import { apexUrlFor } from '../../frontend/src/routes/apex.ts'
import { signInUrlFor } from '../../frontend/site/src/api/lookup.ts'

const REPO = path.join(import.meta.dirname, '..', '..')
const SITE = path.join(REPO, 'frontend', 'site')
const DIST = path.join(SITE, 'dist')
const PACK = path.join(REPO, 'docs', 'handoff-pack')

const BUILT = {
  home: 'index.html',
  demo: path.join('demo', 'index.html'),
  lookup: path.join('lookup', 'index.html'),
  story: path.join('story', 'index.html'),
} as const

function built(rel: string): string {
  const file = path.join(DIST, rel)
  assert.ok(
    existsSync(file),
    `${file} is missing. \`npm run check\` runs \`build:frontend\` (which runs \`build:site\`) before ` +
      '`npm test`; run `npm run build:site` to run this file alone.',
  )
  return readFileSync(file, 'utf8')
}

/** Every `class="figure"` value, in document order — the pack's own markup and the prerender's. */
function figuresOf(html: string): string[] {
  return [...html.matchAll(/<b class="figure"[^>]*>([^<]+)<\/b>/g)].map((m) => (m[1] ?? '').trim())
}

describe('§1 · the four apex pages are built and PRERENDERED', () => {
  for (const [page, rel] of Object.entries(BUILT)) {
    it(`§1 · ${rel} carries its page's markup before any script runs`, () => {
      const html = built(rel)
      assert.match(
        html,
        new RegExp(`<div id="root" data-page="${page}">(?:<link [^>]*/>)*<div class="public-plane" data-public-plane="${page}">`),
        `${rel} was not prerendered: a crawler and a script-blocked visitor would read a blank page`,
      )
      assert.doesNotMatch(html, /class="bar"/, `${rel} carries the APPLICATION's chrome bar`)
      assert.doesNotMatch(html, /\/src\/main\.tsx/, `${rel} is the application's entry, not the site's`)
    })
  }
})

describe('§2 · 🛑 the cleared figures are the PACK`s, exactly (G268, tile 20→7 under G1301)', () => {
  for (const [page, record] of [
    ['home', 'V1 Landing.dc.html'],
    ['story', 'V4 Success Story.dc.html'],
  ] as const) {
    it(`§2 · ${BUILT[page]} carries ${record}'s figures — no more, no fewer, none edited`, () => {
      const pack = figuresOf(readFileSync(path.join(PACK, record), 'utf8'))
      assert.ok(pack.length >= 3, `only ${String(pack.length)} figure(s) read from ${record}; the join below would prove little`)
      const site = figuresOf(built(BUILT[page]))
      assert.deepEqual(
        [...site].sort(),
        [...pack].sort(),
        `the built ${page} page's figures disagree with ${record}. PRODUCT.md clears THIS engagement's ` +
          'figures on the public plane under G268; a figure added, dropped or reworded here is a claim ' +
          'nobody cleared.',
      )
    })
  }
  it('§2 · the demo and lookup pages carry no figure at all', () => {
    assert.deepEqual(figuresOf(built(BUILT.demo)), [])
    assert.deepEqual(figuresOf(built(BUILT.lookup)), [])
  })
})

/** Every text file the site ships. */
function shipped(): { rel: string; text: string }[] {
  const out: { rel: string; text: string }[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(html|js|css)$/.test(entry)) out.push({ rel: path.relative(DIST, full), text: readFileSync(full, 'utf8') })
    }
  }
  walk(DIST)
  return out
}

describe('§3 · 🛑 nothing PRODUCT.md forbids ships on the apex', () => {
  /**
   * PRODUCT.md, G268: still forbidden *"a named customer, a logo, a testimonial,
   * a price, an SLA, and a licensing or marketplace claim"* — and `V1 Landing`'s
   * *"is listed on AWS Marketplace"* is named there as a BREACH. And the three
   * market statistics the old landing page carried are *"Requires sourcing
   * before reuse"*. Each pattern below is one of those, keyed on the claim and
   * not on a word a disclaimer might use (the V1 disclaimer says "No … price,
   * SLA or benchmark is named", which is the opposite of a claim).
   */
  const FORBIDDEN: readonly (readonly [RegExp, string])[] = [
    [/marketplace/i, 'a marketplace / licensing claim (PRODUCT.md: a breach on V1, not covered by G268)'],
    [/committed spend/i, 'a billing claim through an AWS agreement'],
    [/awsstatic\.com|AWS-Partner|Powered-by-AWS/i, 'a third-party partner mark'],
    [/wp-content/i, 'a hotlinked image'],
    [/[$€£]\s?\d/, 'a price'],
    [/per 1,?000 invoices|lost to mismatch|finance leaders?/i, 'an uncleared market statistic'],
    [/testimonial["']?\s*:|<blockquote/i, 'a testimonial'],
  ]
  it('§3 · no page, script or sheet carries one', () => {
    const files = shipped()
    assert.ok(files.length >= 6, `only ${String(files.length)} shipped file(s) read — the scan proves little`)
    for (const { rel, text } of files) {
      for (const [pattern, what] of FORBIDDEN) {
        assert.doesNotMatch(text, pattern, `${rel} ships ${what}`)
      }
    }
  })
  it('§3 · the publisher mark is the trunk`s, bundled — not a hotlink', () => {
    const assets = readdirSync(path.join(DIST, 'assets'))
    assert.ok(assets.some((a) => /^1cloudhub-logo-horiz-.*\.jpg$/.test(a)), 'the 1CloudHub mark is not bundled')
  })
})

/** The relative-import graph from `entry.tsx`, as repository paths. */
function moduleGraph(): Set<string> {
  const seen = new Set<string>()
  const visit = (file: string): void => {
    const rel = path.relative(REPO, file)
    if (seen.has(rel)) return
    seen.add(rel)
    if (!/\.(tsx?|mjs)$/.test(file)) return
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/^\s*import\s+(?:type\s+)?(?:[\s\S]*?\sfrom\s+)?'([^']+)'/gm)) {
      const spec = m[1] ?? ''
      if (spec.startsWith('.')) visit(path.resolve(path.dirname(file), spec))
      else seen.add(`package:${spec}`)
    }
  }
  visit(path.join(SITE, 'src', 'entry.tsx'))
  return seen
}

describe('§4 · the site`s module graph holds no application surface', () => {
  it('§4 · from `entry.tsx`, nothing reaches the app shell, its chrome, a `/v1` client, Tailwind or the bridge', () => {
    const graph = moduleGraph()
    assert.ok(graph.size >= 10, `the walk reached ${String(graph.size)} module(s) — it is not following imports`)
    const app = [...graph].filter((m) => m.startsWith(path.join('frontend', 'src') + path.sep))
    /* The ONLY application modules the site may share: one pure function and
       one presentational grammar. Each is named, so a new one is a decision. */
    assert.deepEqual(
      app.sort(),
      [
        path.join('frontend', 'src', 'api', 'signin.ts'),
        path.join('frontend', 'src', 'components', 'Grammar.tsx'),
        path.join('frontend', 'src', 'components', 'indicators.ts'),
      ],
      'the apex site reaches an application module it did not before — read the list and argue it',
    )
    for (const m of graph) {
      assert.doesNotMatch(m, /bridge\.css|shell\.css|tailwind/, `the site reaches ${m}`)
    }
    for (const { rel, text } of shipped().filter((f) => f.rel.endsWith('.js'))) {
      assert.equal(text.includes('/v1'), false, `${rel} names a /v1 path`)
      assert.equal(text.includes('/session/signin'), false, `${rel} begins a sign-in itself`)
    }
  })
})

describe('§5 · the two hand-offs', () => {
  it('§5a · the application redirects each public path to the apex page, with a slash and nothing carried', () => {
    assert.equal(apexUrlFor('/demo'), `https://${APEX_HOST}/demo/`)
    assert.equal(apexUrlFor('/lookup'), `https://${APEX_HOST}/lookup/`)
  })

  it('§5b · `/lookup` Continue goes to the tenant host the PERSON names, and only to a tenant`s', () => {
    assert.equal(signInUrlFor('ten-acme'), `https://ten-acme.${AWS_REGION}.${APEX_HOST}/signin`)
    assert.equal(signInUrlFor('  Ten-Acme '), `https://ten-acme.${AWS_REGION}.${APEX_HOST}/signin`)
    for (const bad of ['', 'acme.example', 'a b', '-acme', 'acme-', 'ten_acme', 'x'.repeat(64), 'person@acme.example']) {
      assert.equal(signInUrlFor(bad), null, `${JSON.stringify(bad)} became a host`)
    }
    for (const reserved of RESERVED_HOST_LABELS) {
      assert.equal(signInUrlFor(reserved), null, `the reserved label ${reserved} became a tenant sign-in`)
    }
  })
})

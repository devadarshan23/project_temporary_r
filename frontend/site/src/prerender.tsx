/**
 * THE APEX SITE'S PRERENDER — runs after the client build, in Node, and writes
 * each page's markup into its built HTML. G3151, 2 Oct 2026.
 *
 * Why: a marketing page that is an empty `<div>` until a script runs is a page
 * a crawler, a link preview and a visitor with script blocked all read as
 * blank. The application's own prerender (`frontend/src/prerender.tsx`) exists
 * for a different reason (`file://`) and is not reused; this one keeps the
 * client script and HYDRATES over the markup it writes.
 *
 * 🛑 IT REFUSES RATHER THAN SHIPS A PAGE IT COULD NOT FILL: a built HTML file
 * without exactly one empty `<div id="root" data-page="…">` is a build failure,
 * because a silently unrendered page is the defect this file exists to prevent.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToString } from 'react-dom/server'

import { isSitePage, PAGES } from './pages.tsx'

/* Run from `frontend/site/dist-ssr/`, so the client build is one level over. */
/* G3271: NOT `import.meta.dirname`, which is Node >= 20.11 — the Build
 * stage's image ran Node 18 and this line threw `ERR_INVALID_ARG_TYPE`. */
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

/** The four built pages, by the directory each is served from. */
const BUILT_PAGES = ['index.html', 'demo/index.html', 'lookup/index.html', 'story/index.html'] as const

const EMPTY_ROOT = /<div id="root" data-page="([a-z]+)"><\/div>/g

async function prerender(): Promise<void> {
  for (const rel of BUILT_PAGES) {
    const file = join(DIST, rel)
    const html = await readFile(file, 'utf8')
    const roots = [...html.matchAll(EMPTY_ROOT)]
    const found = roots[0]
    if (roots.length !== 1 || found === undefined) {
      throw new Error(`${rel}: expected exactly one empty #root[data-page], found ${String(roots.length)}`)
    }
    const page = found[1]
    if (!isSitePage(page)) throw new Error(`${rel}: data-page="${String(page)}" names no site page`)
    const markup = renderToString(PAGES[page]())
    await writeFile(file, html.replace(found[0], `<div id="root" data-page="${page}">${markup}</div>`))
    console.log(`prerendered ${rel} (${page}, ${String(markup.length)} bytes of markup)`)
  }
}

/* Not top-level `await`: the SSR bundle targets the client's baseline, which has none. */
prerender().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})

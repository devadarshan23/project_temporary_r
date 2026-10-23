/**
 * THE OVERLAY BENCH — one self-contained page carrying the four primitives LIVE.
 *
 * 🛑 WHY THIS EXISTS RATHER THAN A LINE IN `prerender.tsx`. Every other page
 * `tests/design/` reads is PRE-RENDERED STATIC MARKUP, because Chromium blocks
 * `<script type="module">` on a `file://` origin. That is the right answer for
 * the hatch, the meter and the connection light: each can be seen at rest, so a
 * static page witnesses everything about them.
 *
 * NOT ONE OF THE FOUR OVERLAY PRIMITIVES HAS A MEANINGFUL REST STATE. A drawer
 * that never opens, a modal that never traps, a tooltip that never receives
 * Escape and a toast that is never dismissed are precisely the four behaviours
 * G247 calls *"easy to get subtly different and impossible to notice differing"*.
 * Asserting them against static markup would be §5.6 — a suite that passes while
 * witnessing nothing.
 *
 * ⚠️ THE `file://` CONSTRAINT IS REAL AND IS NOT WORKED AROUND — IT IS ANSWERED.
 * A CLASSIC script has no CORS problem on `file://`; only an ES MODULE does. So
 * the bench bundles `specimen-entry.tsx` to an **IIFE** and inlines it. Measured
 * before it was relied on: a module build of the identical entry renders an empty
 * `<div id="root">` from disk, and the IIFE mounts, takes a real Tab, reports
 * `:focus-visible` true and re-renders on a real Enter.
 *
 * 🛑 BOTH HALVES OF "WHAT IS ASSERTED IS WHAT SHIPS" HOLD, AND THAT IS WHY THE
 * STYLESHEET IS READ RATHER THAN COMPILED.
 *   · THE JAVASCRIPT is bundled from `frontend/src/overlays/*` — the very files
 *     `main.tsx` imports. There is no second implementation to drift.
 *   · THE CSS is the exact bytes Vite's Tailwind plugin emitted for the app,
 *     located through `dist/.vite/manifest.json` — the same route
 *     `prerender.tsx` takes, and for the reason its header gives: compiling the
 *     bridge here instead would produce an APPROXIMATION of the shipped build,
 *     and cascade order is what an approximated build is likeliest to get
 *     differently.
 *
 * ⚠️ SO THE BENCH DEPENDS ON `npm run build:frontend` HAVING RUN, exactly as the
 * specimen assertions do. `build:frontend` is inside `npm run check`, and the
 * caller reports the missing artefact as an UNWITNESSED property rather than
 * throwing an import error — see `overlayBench()`'s return type.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { REPO, scratch } from './render.ts'

const DIST = join(REPO, 'frontend', 'dist')
const ENTRY = join(REPO, 'frontend', 'src', 'overlays', 'specimen-entry.tsx')

interface ManifestEntry { css?: string[] }

/**
 * The stylesheet the CLIENT build emitted, located through Vite's own manifest
 * rather than by globbing a hashed filename.
 *
 * ⚠️ THE "EXACTLY ONE" CHECK IS `prerender.tsx`'s AND IS REPEATED RATHER THAN
 * SHARED, because the two files may not import each other: `prerender.tsx` is a
 * `.tsx` and node cannot load it. The reason is the same one it gives — more than
 * one chunk means the app grew a second stylesheet and this bench would carry an
 * arbitrary half of the bridge, silently.
 */
async function sheet(): Promise<string> {
  const manifestPath = join(DIST, '.vite', 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, ManifestEntry>
  const css = [...new Set(Object.values(manifest).flatMap((e) => e.css ?? []))]
  const only = css[0]
  if (css.length !== 1 || only === undefined) {
    throw new Error(
      `expected exactly one emitted stylesheet and found ${css.length}: ${JSON.stringify(css)}`,
    )
  }
  return readFile(join(DIST, only), 'utf8')
}

let benchPath: string | null = null
let benchFailed: string | null = null

/**
 * Build the bench once per run and return its path — or a SENTENCE naming what
 * could not be witnessed. Never throws, for the reason `browserSkip()` does not:
 * a suite that dies in a hook reports a failure nobody can act on, instead of the
 * one fact the reader needs.
 */
export async function overlayBench(): Promise<string | { missing: string }> {
  if (benchPath !== null) return benchPath
  if (benchFailed !== null) return { missing: benchFailed }

  if (!existsSync(join(DIST, '.vite', 'manifest.json'))) {
    benchFailed =
      'the four overlay primitives are UNWITNESSED: no built frontend at ' +
      'frontend/dist. The bench inlines the stylesheet the app build emitted, ' +
      'so that what is asserted is what ships. Run `npm run build:frontend`.'
    return { missing: benchFailed }
  }

  try {
    const dir = await scratch('overlays-')
    /* ⚠️ VITE IS IMPORTED DYNAMICALLY AND ONLY HERE. It is a devDependency the
       gate already runs (`build:frontend`), but importing it at module scope
       would make every suite in this directory pay for it — and would turn "vite
       is missing" into a load error for files that do not need it. */
    const { build } = await import('vite')
    const react = (await import('@vitejs/plugin-react')).default

    await build({
      root: dir,
      logLevel: 'error',
      plugins: [react()],
      /* 🛑 WITHOUT THIS THE BUNDLE THROWS `process is not defined` ON LOAD AND
         MOUNTS NOTHING. React's development build reads `process.env.NODE_ENV`,
         and Vite's library mode does not substitute it. Measured: the identical
         entry without this line renders `NO MOUNT` and reports one page error. */
      define: { 'process.env.NODE_ENV': '"production"' },
      build: {
        lib: { entry: ENTRY, formats: ['iife'], name: 'ReconcileOverlayBench', fileName: () => 'bench.js' },
        outDir: join(dir, 'out'),
        emptyOutDir: true,
        minify: false,
      },
    })

    const js = await readFile(join(dir, 'out', 'bench.js'), 'utf8')
    const css = await sheet()
    const page = join(dir, 'overlays.html')
    await writeFile(page, `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The four overlay primitives — live bench</title>
<!-- GENERATED by tests/design/bench.ts. The stylesheet is the one the app build
     emitted; the script is frontend/src/overlays/* bundled to a CLASSIC script,
     because Chromium blocks ES modules on file:// and a page that never mounts
     would fail every assertion for a reason that is not about the overlays. -->
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`)
    benchPath = page
    return page
  } catch (e) {
    benchFailed =
      'the four overlay primitives are UNWITNESSED: the bench did not build. ' +
      `(${e instanceof Error ? e.message.split('\n')[0] : String(e)})`
    return { missing: benchFailed }
  }
}

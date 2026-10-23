import react from '@vitejs/plugin-react'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

import { MARKETING_PROXIED_PLANE_PATHS } from '../../infra/lib/config.ts'

/* G3271: NOT `import.meta.dirname`, which is Node >= 20.11 — the Build
 * stage's image ran Node 18 and this line threw `ERR_INVALID_ARG_TYPE`. */
const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * THE APEX MARKETING SITE — a SECOND Vite build, separate from the application.
 * G3151, 2 Oct 2026, under the OWNER'S ruling of the same day: *"Apex only:
 * serve /demo and /lookup from the apex marketing site (Amplify); tenant/console
 * hosts redirect there. The marketing site needs building."*
 *
 * 🛑 A SEPARATE BUILD AND NOT A SECOND ENTRY IN `frontend/vite.config.ts`, AND
 * THE SEPARATION IS THE CONTROL. One build with two entries shares one chunk
 * graph, so a module both reach is emitted once and served from BOTH hosts —
 * which is how an application module would come to be fetched from the apex.
 * Here the root is `frontend/site/` and the module graph starts at
 * `src/entry.tsx`; `tests/app/apex-site.test.ts` walks that graph and refuses
 * `ShellApp`, the chrome bar, any `/v1` client and Tailwind.
 *
 * ⚠️ FOUR PAGES AS DIRECTORY INDEXES — `index.html`, `demo/index.html`,
 * `lookup/index.html`, `story/index.html` — because the Amplify app has NO SPA
 * FALLBACK AND NO 404 RULE, deliberately (`infra/lib/amplify-stack.ts`: *"a
 * `404-200` rewrite to `/index.html` is a decision about a site nobody has
 * drawn"*). A static host serves `<dir>/index.html` for `<dir>/` with no rule,
 * so this site needs NO edit to that stack's `customRules`, and the two
 * rewrites it already carries (`/demo/intake`, `/session/realm`) cannot be
 * shadowed by a page. `/demo/intake` is a POST to a Lambda; `/demo/` is a GET
 * of a file; neither is the other's path.
 *
 * ⚠️ NO TAILWIND. The pages use the pack's `public.css` over its `tokens.css`,
 * both unmodified (`src/entry.tsx`); Tailwind is the application's bridge to
 * the kernel and nothing here needs one.
 */
export default defineConfig({
  root: HERE,
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        home: `${HERE}/index.html`,
        demo: `${HERE}/demo/index.html`,
        lookup: `${HERE}/lookup/index.html`,
        story: `${HERE}/story/index.html`,
      },
    },
  },
  server: {
    port: 5174,
    /* The apex proxies exactly `MARKETING_PROXIED_PLANE_PATHS` to the console
       host, so the dev server proxies exactly those to a local plane. The
       intake is a Lambda with no local twin; under `npm run dev` it is
       unanswered, and `/demo` says so rather than claiming a success. */
    proxy: Object.fromEntries(
      MARKETING_PROXIED_PLANE_PATHS.map((path) => [path, { target: 'http://127.0.0.1:8080', changeOrigin: false }]),
    ),
  },
})

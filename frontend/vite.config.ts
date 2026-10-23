import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

import { EDGE_PLANE_PATH_PATTERNS } from '../infra/lib/config.ts'

/* G3271: NOT `import.meta.dirname`, which is Node >= 20.11 — the Build
 * stage's image ran Node 18 and this line threw `ERR_INVALID_ARG_TYPE`. */
const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * ┌─ 🛑 THE DEV PROXY IS DERIVED FROM THE EDGE'S OWN CONSTANT — G1093, ────────┐
 * │ 20 Sep 2026. IT WAS A FOURTH HAND-WRITTEN SPELLING OF ONE RULE AND IT     │
 * │ CARRIED THE DEFECT THE OTHER THREE WERE REPAIRED FOR.                     │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * `infra/lib/edge-stack.ts` records G1011 in its own voice: *"All three
 * mirrors — this stack, the Vite proxy and `tests/e2e/single-origin.ts` —
 * forwarded `/v1` and nothing else, so all three agreed and all three were
 * wrong in the same place, and the agreement is why nobody saw it. **Two of the
 * three are repaired here**; the Vite proxy is `frontend/`'s and is named in
 * the commit rather than edited."* **This is that edit, and it is an IMPORT
 * rather than a fourth correct copy** — `tests/e2e/single-origin.ts` already
 * imports the same constant, so after this there is ONE statement of which
 * paths reach a plane and no mirror to drift.
 *
 * ⚠️ **THE DEFECT WAS LATENT AND ITS FAILURE MODE WAS A 200, NOT AN ERROR.**
 * Vite's dev server falls back to `index.html` for anything unproxied, so
 * `POST /context/resolve` from the SPA under `npm run dev` was answered by the
 * BUNDLE with a 200 — which is the exact sentence `EDGE_PLANE_PATH_PATTERNS`
 * gives as its reason for routing `/session/*` though nothing mounts it: *"the
 * SPA-rewrite function turns `/session/federated` into `index.html`, so a
 * sign-in callback would be answered by the BUNDLE with a 200."* Nothing in
 * `frontend/src` calls D1 yet — `grep -rn "context/resolve\|'/session" frontend/src/`
 * returns nothing — so the first person to wire sign-in would have met it.
 *
 * 🛑 **THE IMPORT DRAGS NO CDK INTO THIS BUILD AND THAT IS A MEASURED
 * PROPERTY, NOT A HOPE:** `infra/lib/config.ts` declares **no imports at all**
 * — `grep -c '^import' infra/lib/config.ts` → 0 — so nothing of `aws-cdk-lib`
 * reaches `typecheck:frontend` or `build:frontend`, and G212's fence (*"the AWS
 * SDK must never enter the root manifest"*) is untouched.
 * `tests/app/dev-proxy-mirrors-the-edge.test.ts` holds BOTH halves: the derived
 * proxy against the constant, and the constant's own import-freedom, so the day
 * an infra slice adds `import * as cdk` to that file the red names this build
 * instead of arriving as an unexplained frontend failure.
 *
 * ⚠️ **A VITE PROXY KEY IS A PREFIX AND A CLOUDFRONT PATTERN IS A GLOB, SO THE
 * CONVERSION IS LOSSY IN ONE NAMED DIRECTION.** Vite matches a string key with
 * `startsWith`, so `/session` covers `/session`, `/session/realm` and — unlike
 * CloudFront — `/sessionfoo`. In dev that reaches the plane and gets the plane's
 * honest 404; in production it reaches the bundle. The difference is dev-only,
 * it is in the safe direction (the plane refuses rather than the bundle
 * pretending), and it is stated here rather than discovered.
 */
const PLANE_PROXY_PREFIXES = [
  ...new Set(EDGE_PLANE_PATH_PATTERNS.map((pattern) => pattern.replace(/\/\*$/, ''))),
]

/**
 * THE FRONTEND ROOT — G198: React + Vite + TypeScript, with Tailwind under the
 * kernel rather than beside it.
 *
 * ⚠️ THE TAILWIND VERSION IS PINNED TO THE ONE THE TESTS COMPILE WITH, AND THAT
 * CONSTRAINT CHOSE VITE'S MAJOR. `tests/design/render.ts` compiles real Tailwind
 * with `@tailwindcss/cli@4.1.6`; if this build used a different Tailwind, the
 * engine assertions and the shipped page would be two different Tailwinds and the
 * suite's whole argument — that what is asserted is what ships — would be void.
 * `@tailwindcss/vite@4.1.6` peers `vite@^5.2.0 || ^6`, so Vite is 6.4.3 rather
 * than 8. Parity with the measured engine beat currency, deliberately.
 *
 * Reproduce — all three must print the same version:
 *   node -e "const fs=require('fs'); for (const p of \
 *     ['tailwindcss','@tailwindcss/cli','@tailwindcss/vite']) \
 *     console.log(p, JSON.parse(fs.readFileSync('node_modules/'+p+'/package.json','utf8')).version)"
 *
 * ⚠️ THE FIRST VERSION OF THAT COMMAND USED `require(p+'/package.json')` AND
 * THREW — `@tailwindcss/vite` does not expose its package.json through its
 * `exports` map, so the command a reader would have run to check the parity claim
 * failed on the third package. Read the file rather than resolving the subpath.
 */
export default defineConfig({
  root: HERE,

  /**
   * ═════════════════════════════════════════════════════════════════════════
   * 🛑 G488, 19 Sep 2026 — **THIS WAS `base: './'` AND RELATIVE ASSET URLS ARE
   *    INCOMPATIBLE WITH CLIENT-SIDE ROUTING AT ANY DEPTH.** The line it
   *    replaces, and its reasoning, are quoted rather than deleted, because
   *    the reasoning was CORRECT WHEN WRITTEN and the thing that falsified it
   *    is somewhere else entirely:
   *
   *      "Relative asset URLs. The built app must open from disk as well as
   *       from a server; an absolute `/assets/…` resolves to the filesystem
   *       root on file://."
   * ═════════════════════════════════════════════════════════════════════════
   *
   * **MEASURED, NOT REASONED.** `tests/e2e/browser-login.test.ts` §16 — a deep
   * link to `/close/finding/<id>` — rendered a BLANK PAGE with an empty body.
   * The chain: `index.html` carried `src="./assets/index-<hash>.js"`; a browser
   * at `/close/finding/<id>` resolves that against the DIRECTORY, asking for
   * `/close/finding/assets/index-<hash>.js`; the front's unknown-path fallback
   * answered with `index.html` itself; and a `<script type="module">` served as
   * HTML fails to parse. **No error reaches the page, and nothing in the gate
   * could see it before a suite navigated below the root.**
   *
   * ⚠️ AND THE OLD REASONING IS NOT MERELY OUTWEIGHED — IT BUYS NOTHING TODAY,
   * WHICH IS THE PART WORTH CHECKING BEFORE BELIEVING THIS. The two pages that
   * open from `file://` are `specimen.html` and `shell.html`, and BOTH are
   * pre-rendered by `src/prerender.tsx` with the stylesheet INLINED and no
   * script at all — precisely because *"a module script cannot load over
   * `file://`"*. Neither references an asset, so neither is affected by `base`
   * in either direction. Reproduce it rather than taking it:
   *
   *     grep -c 'script\|<link' frontend/dist/specimen.html frontend/dist/shell.html   # 0 and 0
   *
   * **The only consumer of `base` is `index.html`, and it is only ever served
   * over HTTP** — by `tests/e2e/single-origin.ts` locally and by CloudFront in
   * the deployed shape, where the distribution's root is the origin's root.
   */
  base: '/',

  plugins: [react(), tailwindcss()],

  /**
   * G3003 — THE STAGING PROFILE SWITCHER IS A COMPILE-TIME CONSTANT, AND ONLY
   * EXACTLY `on` MAKES IT `true`. The owner's ruling G2771 put a public test
   * login on STAGING; this is what keeps its persona list out of every other
   * bundle. `false` makes `frontend/src/test-personas.ts`'s list DEAD CODE,
   * which the bundler drops — `tests/app/profile-switcher-fence.test.ts` reads
   * the gate's own build and requires no mock address in it. The Build stage
   * sets `RECONCILE_TEST_PERSONAS` from `testPersonasBuildFlag()`, which says
   * `on` for staging ALONE.
   *
   * ⚠️ `RECONCILE_TEST_PORTAL_ORIGINS` IS FOR THE E2E SUITE AND NOTHING ELSE:
   * a JSON map from a persona's portal host to the origin a local browser can
   * reach it at. Absent, every host is `https://<host>`.
   */
  define: {
    __RECONCILE_TEST_PERSONAS__: JSON.stringify(process.env['RECONCILE_TEST_PERSONAS'] === 'on'),
    __RECONCILE_TEST_PORTAL_ORIGINS__: JSON.stringify(
      process.env['RECONCILE_TEST_PERSONAS'] === 'on'
        ? (process.env['RECONCILE_TEST_PORTAL_ORIGINS'] ?? '{}')
        : '{}',
    ),
  },

  /**
   * G226 — THE DEV SERVER PROXIES TO THE PLANE. NO CORS, NO PREFLIGHT.
   *
   * ⚠️ RULED 22 Aug 2026 AND NOT APPLIED UNTIL 19 Sep 2026. The gap was
   * measured, not guessed: a real browser at `localhost:5173` against the plane
   * at `127.0.0.1:8080` logged
   *
   *     Access to fetch at 'http://127.0.0.1:8080/v1/runs' from origin
   *     'http://localhost:5173' has been blocked by CORS policy: Response to
   *     preflight request doesn't pass access control check.
   *
   * 🛑 A PROXY IS THE RIGHT ANSWER RATHER THAN THE EASY ONE, AND G226 SAYS WHY:
   * it DISSOLVES a G200 question instead of answering it. `mountTier()` takes
   * every route from the contract and THE CONTRACT DECLARES NO `OPTIONS`, so
   * answering a preflight is arguably mounting an operation the wire does not
   * declare. A proxy needs no server change, no new route and no ruling.
   *
   * It also keeps `compose.yaml`'s published-port property intact — the browser
   * never addresses the plane directly — and it is not a dev-only hack wearing
   * architecture's clothes: under G179 one host serves one tenant, so production
   * is same-origin anyway. The proxy makes dev match the shape production has.
   *
   * ⚠️ THE RULING SAYS `/api` AND THIS PROXIES `/v1`. THE DEVIATION IS
   * DELIBERATE AND IS RECORDED RATHER THAN TAKEN QUIETLY. `/api` requires the
   * frontend's plane origin to carry a PATH, and `endpoint()`
   * (`frontend/src/api/runs.ts`) deliberately RESOLVES against `URL.origin` and
   * DROPS any path on it — that dropping is not incidental, it is the fix for a
   * defect where a tenant was smuggled through `origin`. Honouring `/api`
   * literally would mean weakening the control that closed it. `/v1` is the
   * contract's own base, collides with no frontend route, and buys every
   * property the ruling argues for. Challenge it in writing if that is wrong.
   *
   * ⚠️ **AND `/v1` WAS NEVER THE SERVED SURFACE — G1011, G1093.** The paragraph
   * above is unchanged about `/api` and is corrected rather than deleted; what
   * it did not know is that `/v1` is ONE TIER's base path. `basePathOf()`
   * strips the authority from a tier's first `servers[].url`, so
   * `capability.openapi.yaml` serves under `/v1` while `foundation.openapi.yaml`
   * and `session.openapi.yaml` serve at the ROOT — so proxying `/v1` alone left
   * `POST /context/resolve` answered by the BUNDLE. The prefixes are DERIVED
   * from `EDGE_PLANE_PATH_PATTERNS` now; the block at the head of this file
   * argues it.
   */
  /* The proxy itself is folded into the existing `server` key below, so this
     config keeps ONE server block rather than two that a reader must merge. */

  build: {
    outDir: 'dist',
    /* The prerender locates the emitted stylesheet through this rather than by
       guessing a content hash. */
    manifest: true,
    /* Every byte of CSS must reach the specimen's single inline <style>. The
       default inlines small assets as data URIs and would split the sheet. */
    assetsInlineLimit: 0,
  },

  server: {
    port: 5173,
    proxy: Object.fromEntries(
      PLANE_PROXY_PREFIXES.map((prefix) => [
        prefix,
        { target: 'http://127.0.0.1:8080', changeOrigin: false },
      ]),
    ),
  },
})

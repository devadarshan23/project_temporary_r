/**
 * THE DEV PROXY AND THE EDGE ARE ONE STATEMENT — G1093, 20 Sep 2026.
 *
 * ┌─ 🛑 WHAT THIS SUITE EXISTS FOR, IN THE WORDS OF THE FILE THAT NAMED IT ────┐
 * │ `infra/lib/edge-stack.ts`, G1011: *"All three mirrors — this stack, the   │
 * │ Vite proxy and `tests/e2e/single-origin.ts` — forwarded `/v1` and nothing │
 * │ else, so all three agreed and all three were wrong in the same place, and │
 * │ the agreement is why nobody saw it. **Two of the three are repaired       │
 * │ here**; the Vite proxy is `frontend/`'s and is named in the commit rather │
 * │ than edited."*                                                            │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * The repair was **not** a fourth correct copy. `frontend/vite.config.ts` now
 * IMPORTS `EDGE_PLANE_PATH_PATTERNS`, so there is one statement of which paths
 * reach a plane and no mirror left to drift. **What this suite holds is
 * therefore not an equality between two lists — it is the two properties that
 * keep that import possible and honest:**
 *
 *   §1 the derived proxy COVERS every pattern the edge publishes, and covers
 *      nothing the edge does not — both directions, because a proxy that
 *      forwarded a path CloudFront leaves on the bundle is the same class of
 *      divergence pointing the other way;
 *   §2 `infra/lib/config.ts` IMPORTS NOTHING, which is the measured property
 *      that lets `frontend/` read it without `aws-cdk-lib` entering
 *      `typecheck:frontend` or `build:frontend` — G212's fence, reached from a
 *      direction G212 never contemplated.
 *
 * ⚠️ IT IS `.mjs` FOR `tests/infra/support.mjs`'s REASON: `tests/tsconfig.json`
 * is `include: ["**\/*.ts"]` and is compiled from the ROOT, so a `.ts` suite
 * here would put `frontend/vite.config.ts` — and `vite`, `@vitejs/plugin-react`
 * and `@tailwindcss/vite` with it — inside the root typecheck program. Nothing
 * below is type-level: every assertion is against a value read from a module
 * that really loaded.
 *
 * ⚠️ THE FOUR PATTERNS AND THE THREE PREFIXES ARE TYPED INTO THIS FILE AS A
 * FLOOR, never imported for the comparison. A suite that derives both sides
 * from the same constant proves a variable equals itself — the warning every
 * suite under `tests/infra/` carries at its head.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const viteConfig = (await import(join(REPO_ROOT, 'frontend', 'vite.config.ts'))).default
const { EDGE_PLANE_PATH_PATTERNS } = await import(join(REPO_ROOT, 'infra', 'lib', 'config.ts'))

const proxyPrefixes = Object.keys(viteConfig.server?.proxy ?? {})

// ------------------------------------------------------- 1. both directions

test('test_the_dev_proxy_forwards_every_path_the_edge_routes_to_the_plane', () => {
  /* 🛑 THE DIRECTION THE DEFECT WAS IN. `/context/*` reached the plane at the
   * edge and reached `index.html` under `npm run dev`, and Vite's fallback
   * answers an unproxied path with the BUNDLE and a 200 — so the failure mode
   * was not an error a developer would chase, it was HTML where JSON belonged.
   * `POST /context/resolve` is D1, the operation that binds a session to a
   * tenant, and nothing in `frontend/src` calls it yet. */
  for (const pattern of EDGE_PLANE_PATH_PATTERNS) {
    const path = pattern.replace(/\*$/, 'x')
    assert.ok(
      proxyPrefixes.some((prefix) => path.startsWith(prefix)),
      `the edge routes '${pattern}' to the data plane and the dev proxy does not forward ` +
        `'${path}'. Vite answers an unproxied path with index.html and a 200, so this ` +
        `divergence is invisible until somebody reads the body. Proxy prefixes: ` +
        `${JSON.stringify(proxyPrefixes)}.`,
    )
  }
})

test('test_the_dev_proxy_forwards_nothing_the_edge_leaves_on_the_bundle', () => {
  /* The other direction, and it is not symmetry for its own sake: a prefix with
   * no pattern behind it sends a path to the plane in dev that CloudFront sends
   * to the bundle in production, which is the same divergence wearing the
   * opposite sign — and it is the shape a well-meaning `'/api'` would have. */
  for (const prefix of proxyPrefixes) {
    assert.ok(
      EDGE_PLANE_PATH_PATTERNS.some(
        (pattern) => pattern === prefix || pattern === `${prefix}/*`,
      ),
      `the dev proxy forwards '${prefix}' and no CloudFront behaviour does. ` +
        `EDGE_PLANE_PATH_PATTERNS is ${JSON.stringify(EDGE_PLANE_PATH_PATTERNS)}; a fifth ` +
        'prefix is a decision about what dev serves differently from production.',
    )
  }
})

test('test_the_derived_prefixes_are_the_three_the_four_patterns_collapse_to', () => {
  /* The FLOOR. Both assertions above are properties and both would pass over an
   * EMPTY proxy against an EMPTY constant, which is `docs/HANDOFF.md` §5.6 —
   * a control whose only observable behaviour is agreement. These three strings
   * are typed, not derived. */
  assert.deepEqual(
    proxyPrefixes.slice().sort(),
    ['/context', '/session', '/v1'],
    'a Vite proxy key is a PREFIX and a CloudFront pattern is a GLOB, so ' +
      "['/v1/*','/context/*','/session','/session/*'] collapses to three keys: `/session` " +
      'and `/session/*` are two CloudFront patterns because `/session/*` does not match ' +
      '`/session`, and one Vite prefix because `startsWith` covers both.',
  )
})

test('test_every_proxy_entry_points_at_the_plane_and_never_rewrites_the_host', () => {
  /* `changeOrigin: false` is not a default worth losing: under G179 one host
   * serves one tenant and `resolveServingHost()` reads the `Host` header, so a
   * proxy that rewrote it would resolve nothing — the same property
   * `tests/infra/edge.test.mjs` §2 asserts of `AllViewer` at the edge. */
  for (const [prefix, entry] of Object.entries(viteConfig.server?.proxy ?? {})) {
    assert.equal(entry.target, 'http://127.0.0.1:8080', prefix)
    assert.equal(
      entry.changeOrigin,
      false,
      `${prefix} rewrites the Host header. G179 derives the tenant from it and G180 ` +
        'revokes a session whose host does not match the one it was bound to.',
    )
  }
})

// ---------------------------- 2. what keeps the import out of the frontend

test('test_the_infra_constants_module_imports_nothing_so_no_cdk_reaches_the_frontend_build', () => {
  /**
   * 🛑 THE ASSERTION THAT MAKES THE IMPORT SAFE RATHER THAN LUCKY.
   *
   * `frontend/vite.config.ts` reads `../infra/lib/config.ts`, and
   * `frontend/tsconfig.json` is `include: ["**\/*.ts"]` — so that file is
   * inside `typecheck:frontend`'s program and inside `build:frontend`'s bundle.
   * It is harmless today because it declares NO IMPORT AT ALL. The day an
   * infra slice adds `import * as cdk from 'aws-cdk-lib'` to it, both gate
   * stages would fail with an unexplained module resolution error in a
   * directory nobody was editing.
   *
   * **This is that failure arriving as a sentence instead.** G212 refused the
   * AWS SDK in the root manifest to protect exactly this property; the fence is
   * stated here in the one place that would otherwise discover it.
   */
  const source = readFileSync(join(REPO_ROOT, 'infra', 'lib', 'config.ts'), 'utf8')
  const imports = source.split('\n').filter((line) => /^\s*import\s/.test(line))
  assert.deepEqual(
    imports,
    [],
    'infra/lib/config.ts has grown an import and frontend/vite.config.ts reads it. ' +
      'That file is in typecheck:frontend and build:frontend; if the import reaches ' +
      'aws-cdk-lib, both gate stages fail in a directory nobody edited (G212, G259). ' +
      'Either keep this module import-free, or move EDGE_PLANE_PATH_PATTERNS somewhere ' +
      'both the edge and the frontend may read — and say which in the commit.',
  )
})

/**
 * WHICH PATHS REACH THE PLANE THROUGH THE SINGLE-ORIGIN FRONT — G1011.
 *
 * ┌─ 🛑 WHY THIS SUITE EXISTS, AND IT IS NOT "MORE COVERAGE" ──────────────────┐
 * │ The deployed tenant distribution routed `/v1/*` to the data plane and      │
 * │ nothing else, so `POST /context/resolve` — D1, the operation that binds a  │
 * │ session to a tenant — answered **403 from CloudFront** for the whole life  │
 * │ of the stack. Measured against AWS on 20 Sep 2026, not reasoned.           │
 * │                                                                            │
 * │ **`tests/e2e/single-origin.ts` forwarded `/v1` and nothing else too, so    │
 * │ the mirror agreed with the edge and neither was tested.** Nothing in       │
 * │ `frontend/` calls a root-served operation, so no browser assertion ever    │
 * │ went near one. The agreement is what hid it.                               │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ **IT NEEDS NEITHER A DATABASE NOR A BROWSER AND CALLS NEITHER GUARD.**
 * `tests/reachability.ts`'s guards are for suites that probe one; this asks a
 * question about a routing predicate and about two contract documents, so it is
 * deterministic and offline and `tests/ci/reachability-guards.test.ts` correctly
 * does not class it as dependent.
 *
 * 🛑 **AND THIS PARAGRAPH MAY NOT NAME THE TWO HELPERS THAT SUITE KEYS ON,
 * WHICH IS A FINDING RATHER THAN A STYLE NOTE.** §3 of that file decides which
 * suites are dependent with `f.source.includes(…)` — a SUBSTRING of the whole
 * file, comments included — so a sentence *about* the database helper arms the
 * rule as surely as a call to it would. The first draft of this header said so
 * by spelling both names and was **RED for exactly that reason**, naming this
 * file as a suite that probes a database and stands down without one. It is
 * `docs/HANDOFF.md` §5.1 — a rule keyed on a convenient landmark rather than on
 * the property — living inside the control written to catch §5.1, and it is
 * reported here rather than repaired: widening that walk to ignore comments is
 * a change to a CONTROL and belongs to whoever owns it, with its own red.
 *
 * ⚠️ **AND IT DOES NOT BIND PORT 8080.** `startFront()` is fixed on that port
 * because the client's `PERMITTED_ORIGINS` decides it, so a suite that started a
 * second front would collide with `browser-login.test.ts` under `node --test`'s
 * default file-level parallelism. `reachesThePlane()` IS the front's routing
 * decision — the server calls it — so asserting it is asserting the front, and
 * asserting it without a socket is why this suite is free.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { reachesThePlane } from './single-origin.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * The paths one contract tier declares, with its base path already on them.
 *
 * 🛑 IT IS A LINE SCANNER AND IT SAYS SO, WHICH IS G109's STANDING POSITION FOR
 * everything outside `server/contract/document.ts`: that module takes the real
 * parser, and `tools/` and `tests/` scan lines. The shape being read is
 * two-space-indented `/…:` keys under `paths:` and the FIRST `- url:` under
 * `servers:` — the same `servers[0]` that `basePathOf()` reads, which is the
 * whole of what makes this defect possible.
 */
function declaredPaths(tier: string): readonly string[] {
  const lines = readFileSync(join(REPO_ROOT, 'docs', 'contracts', `${tier}.openapi.yaml`), 'utf8')
    .split('\n')

  const serverLine = lines.find((l) => l.startsWith('  - url: '))
  assert.ok(serverLine, `${tier} declares no server url`)
  const url = serverLine.slice('  - url: '.length).trim()
  const basePath = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '').replace(/\/$/, '')

  const paths = lines
    .filter((l) => /^ {2}\/[^:]*:\s*$/.test(l))
    .map((l) => l.trim().replace(/:$/, ''))
  assert.ok(paths.length > 0, `${tier} declares no paths`)

  /* A templated segment becomes a plausible value: a router matches `{runId}`
   * and a CloudFront pattern does not know it is templated. */
  return paths.map((p) => `${basePath}${p}`.replace(/\{[^}]+\}/g, 'an-id'))
}

// ------------------------------------ 1. the operational surface stays inside

test('the local tier is NOT reachable through the front, on every path it declares', () => {
  /* 🛑 THE ASSERTION THIS SUITE EXISTS FOR. `data-plane-local.openapi.yaml`
   * declares `http://localhost:9090` — no base path — so its operations sit at
   * the ROOT of the same process the tenant surface sits in, and
   * `checkLocalHealth` is MOUNTED. They are served to a load balancer inside
   * the VPC: no session, no capability gate, no invariant 10 record.
   *
   * ⚠️ WITNESSED RED: with `/*` in `EDGE_PLANE_PATH_PATTERNS` this fails on
   * `/health`, and `tests/infra/edge.test.mjs` §2 fails on the template beside
   * it. The catch-all is the obvious one-character repair for the 403 above and
   * it is the one that must not be taken. */
  for (const path of declaredPaths('data-plane-local')) {
    assert.equal(
      reachesThePlane(path),
      false,
      `${path} is forwarded to the plane. It is a data-plane-local.openapi.yaml operation ` +
        '- the plane process own health, status and metrics - and publishing it is what a ' +
        'catch-all does. Route the tenant-facing prefixes explicitly instead.',
    )
  }
})

// --------------------------- 2. the tenant surface really does reach the plane

test('D1 reaches the plane, which is the defect this slice repairs', () => {
  /* `/context/resolve` is `resolveTenantContext`, the one foundation-tier
   * operation `server/data-plane/start.ts` mounts. Derived from the document
   * rather than typed, because the point is that the DOCUMENT puts it at the
   * root: `foundation.openapi.yaml` declares `local://in-process`, so
   * `basePathOf()` returns '' and every path of that tier is a root path. */
  const paths = declaredPaths('foundation')
  assert.ok(paths.includes('/context/resolve'), `foundation declares no /context/resolve: ${paths}`)
  assert.equal(
    reachesThePlane('/context/resolve'),
    true,
    'POST /context/resolve answered 403 from CloudFront in staging on 20 Sep 2026 because the ' +
      'distribution routed /v1/* alone. A session cannot be bound to a tenant over the ' +
      'internet while this is false.',
  )
})

test('the capability tier reaches the plane under its own base path', () => {
  const paths = declaredPaths('capability')
  assert.ok(
    paths.every((p) => p.startsWith('/v1/')),
    'capability.openapi.yaml declares https://{dataPlaneHost}/v1, so every path of it is /v1/…',
  )
  for (const path of paths) {
    assert.equal(reachesThePlane(path), true, `${path} does not reach the plane`)
  }
})

test('the session tier reaches the plane, which is routed ahead of its mount deliberately', () => {
  /* ⚠️ NOTHING MOUNTS THIS TIER TODAY. It is routed anyway and the argument is
   * on `EDGE_PLANE_PATH_PATTERNS`: an edge behaviour confers no read, the
   * plane's router answers an unmounted operation with G191's honest 404, and
   * NOT routing it is worse — the SPA-rewrite function turns
   * `/session/federated` into `index.html`, so a sign-in callback would be
   * answered by the BUNDLE with a 200. */
  for (const path of declaredPaths('session')) {
    assert.equal(reachesThePlane(path), true, `${path} does not reach the plane`)
  }
})

// ----------------------------------- 3. the bundle keeps everything else

test('the bundle keeps the frontend routes, the assets and the root', () => {
  for (const path of ['/', '/index.html', '/close', '/close/finding/abc', '/assets/app-a1b2.js']) {
    assert.equal(
      reachesThePlane(path),
      false,
      `${path} is forwarded to the plane; it belongs to the bundle origin`,
    )
  }
})

test('a path that merely begins like a plane prefix is not forwarded', () => {
  /* 🛑 THE MATCHER IS CLOUDFRONT'S, SO `/v1` ALONE IS NOT `/v1/*` — the
   * deployed behaviour, not an accident of this file. **`/session` is in the
   * list above and NOT here, and the difference is the finding this suite
   * produced on its first run**: `session.openapi.yaml` declares a bare
   * `/session` beside `/session/realm` and `/session/federated`, so a single
   * prefix pattern would have left one of that tier's three operations on the
   * BUNDLE — this slice's own defect, one path deep. It has a pattern of its
   * own. No operation sits at `/v1` or `/context`; a slice that puts one there
   * owes a pattern, and this assertion is where it will notice. */
  for (const path of ['/v1', '/context', '/v1x/runs', '/contextual', '/sessions']) {
    assert.equal(reachesThePlane(path), false, `${path} is forwarded to the plane`)
  }
})

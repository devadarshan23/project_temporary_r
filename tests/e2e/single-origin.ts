/**
 * THE SINGLE-ORIGIN FRONT — the local mirror of what CloudFront does.
 *
 * ┌─ WHY THIS EXISTS AT ALL, AND WHY IT IS NOT A CONVENIENCE ──────────────────┐
 * │ `grep -rn "cors\|Access-Control" server/` RETURNS NOTHING. There is no     │
 * │ CORS in either plane, deliberately as far as any file here says, and that  │
 * │ makes the browser's origin a LOAD-BEARING fact rather than a detail of the │
 * │ harness: a page served from one origin that fetches a plane on another     │
 * │ gets a preflight nobody answers, and every assertion after it would be     │
 * │ about a network error instead of about the product.                        │
 * │                                                                            │
 * │ `docs/build/deploy-handoff.md` §2a records the deployed shape: the data    │
 * │ plane is a SECOND ORIGIN on the tenant CloudFront distribution through a   │
 * │ VPC origin, so from a browser there is exactly ONE origin. This file is    │
 * │ that arrangement, locally, and it is written to be that rather than to be  │
 * │ easy — a harness that reached the plane on its own port would be green     │
 * │ against a topology production does not have.                               │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE `Host` HEADER IS THE POINT, NOT AN INCIDENTAL ────────────────────────┐
 * │ G180's `checkHostBinding()` compares `request.headers.host` against        │
 * │ `Session.issuedHost` ON EVERY REQUEST and REVOKES on a mismatch. So a      │
 * │ proxy that rewrote `Host` — which is what almost every proxy does by       │
 * │ default, and what `changeOrigin: true` means in Vite — would either        │
 * │ silently revoke the session under test or make every 200 a statement       │
 * │ about a binding the test did not choose.                                   │
 * │                                                                            │
 * │ **This forwards `Host` byte-for-byte.** `model/serving-host.ts` states     │
 * │ that `normaliseHost()` does NO PORT STRIPPING — *"a port configures one;   │
 * │ stripping it here would be the normaliser deciding"* — so                  │
 * │ `127.0.0.1:8080` is a whole serving host and the session must be bound to  │
 * │ exactly that string, port included.                                        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ✅ **THE PORT IS EPHEMERAL SINCE 4 Oct 2026 — G3911 — AND THE TWO PARAGRAPHS
 * BELOW ARE CORRECTED RATHER THAN DELETED, BECAUSE THEY ARE THE ARGUMENT THE
 * CHANGE HAD TO ANSWER.** Their premise went false at G991 and nobody followed
 * it through: `DEFAULT_ORIGIN` is the page's own origin in a browser, and
 * `PERMITTED_ORIGINS` lists `DEFAULT_ORIGIN` first — so a front on ANY port is
 * permitted with no `?plane=`, and the *"refused BY THE CLIENT"* sentence below
 * is true only of a `?plane=` naming a port the allow-list lacks. Measured
 * rather than argued: every browser suite runs green on a kernel-chosen port.
 * The allow-list is NOT widened and `LOCAL_PLANE_ORIGIN` does not move.
 *
 * ⚠️ PORT 8080 IS NOT ARBITRARY AND MUST NOT BE MADE EPHEMERAL. ⚠️ **THIS
 * PARAGRAPH READ *"The frontend hard-codes `DEFAULT_ORIGIN =
 * 'http://127.0.0.1:8080'` (`frontend/src/api/plane.ts`)"* UNTIL 20 Sep 2026
 * AND THAT CLAUSE IS NOW FALSE — G991.** It is corrected rather than deleted
 * because it is the sentence that explains the port. `DEFAULT_ORIGIN` is the
 * PAGE'S OWN ORIGIN in a browser and `LOCAL_PLANE_ORIGIN` —
 * `'http://127.0.0.1:8080'` — only where there is no page, which is every node
 * test and `npm run dev:plane`.
 *
 * 🛑 **THE PORT STILL MATTERS AND FOR A SHARPER REASON THAN BEFORE: THIS FRONT
 * SERVES THE PAGE AND PROXIES THE PLANE ON ONE ORIGIN, SO THE PAGE'S ORIGIN AND
 * THE LOCAL FALLBACK ARE THE SAME STRING HERE.** That is what makes a
 * browser-driven assertion unable to tell G991's behaviour from the behaviour
 * it replaced — stated so nobody reads a green run of `browser-login.test.ts`
 * as a witness for the page-origin rule. The rule is witnessed as a pure
 * function instead: `permittedPageOrigin()`, in
 * `tests/http/register-consumes-runs.test.ts` §8a.
 *
 * The port is still allowlisted in `PERMITTED_ORIGINS`, so a front on any other
 * port is refused BY THE CLIENT before a request is made, with `is not a
 * permitted plane — the session token is not sent there`. The allowlist is the
 * control working; do not widen it to suit a harness.
 *
 * 🛑 THIS SERVES AND PROXIES. IT AUTHENTICATES NOTHING AND DECIDES NOTHING.
 * It holds no credential, reads no database and knows no tenant. Every
 * authorisation in an assertion that runs through it is the PRODUCTION
 * authoriser's — `startDataPlane()` defaults `authorise` to
 * `sessionCapabilities` and `substrate` to `substrateFromSession` — which is
 * the property that makes a green browser assertion worth anything.
 */

import { createServer, request as httpRequest } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, normalize, extname } from 'node:path'

import {
  EDGE_PLANE_PATH_PATTERNS,
  edgePatternMatches,
} from '../../infra/lib/config.ts'

/**
 * 🛑 WHICH PATHS THIS FRONT FORWARDS, AND IT IS **THE EDGE'S OWN LIST** RATHER
 * THAN A SECOND ONE — G1011, 20 Sep 2026.
 *
 * ┌─ ⚠️ THIS FILE FORWARDED `/v1` AND NOTHING ELSE UNTIL 20 Sep 2026, WHICH IS ┐
 * │ EXACTLY WHAT THE DEPLOYED DISTRIBUTION DID — AND THE AGREEMENT IS WHY     │
 * │ NOBODY SAW THE HOLE. `POST /context/resolve` answered **403 from          │
 * │ CloudFront** in staging; here it fell through to `serveStatic()`, whose    │
 * │ deep-link fallback answered **200 index.html**. Two different wrong        │
 * │ answers, neither of them the plane, and no assertion on either — because   │
 * │ nothing in `frontend/` calls a root-served operation:                      │
 * │   grep -rn 'context/resolve' frontend/src   -> nothing                     │
 * │                                                                            │
 * │ **A mirror that reproduces the deployed shape but not the deployed         │
 * │ DEFECT is worse than no mirror**: it is the thing a reader points at when  │
 * │ asked whether the arrangement was tested.                                  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 IT IS IMPORTED, NOT COPIED, AND THAT IS THE WHOLE REPAIR. Three copies of
 * this list — the CloudFront behaviours, this front and `frontend/vite.config.ts`
 * — is `docs/HANDOFF.md` §5.3, *"two implementations of one rule, and the one
 * that drifts is always the copy"*, and the drift already happened once. The
 * edge's own constant is the single home; `tests/infra/edge.test.mjs` §2 pins
 * what that constant produces in the TEMPLATE, with every expected string typed
 * out, so the join is closed at both ends.
 *
 * ⚠️ `infra/lib/config.ts` HAS NO IMPORTS AND MUST KEEP NONE. That is what
 * makes this import free: the gate type-checks `tests/` FROM THE ROOT, where
 * `aws-cdk-lib` is deliberately absent under G259/G212, so the day that file
 * imports a construct library `npm run typecheck:tests` goes red — loud, and by
 * construction rather than by a rule somebody has to remember.
 */
export function reachesThePlane(pathname: string): boolean {
  return EDGE_PLANE_PATH_PATTERNS.some((pattern) => edgePatternMatches(pattern, pathname))
}

/**
 * 🛑 THERE IS NO FIXED FRONT PORT ANY MORE — G3911, 4 Oct 2026. ⚠️ **THIS FILE
 * EXPORTED `FRONT_PORT = 8080` AND `FRONT_HOST = '127.0.0.1:8080'` UNTIL THEN,
 * AND EVERY BROWSER SUITE BOUND ITS OWN LITERAL BESIDE IT** (8091, 8092, 8093,
 * 8097, 8098, 8099). Two gate runs on one machine therefore raced for the same
 * sockets and the loser died at `EADDRINUSE` — reported by several agents as a
 * cancelled suite and a forced rerun, which is a gate whose verdict depends on
 * what else the machine is doing.
 *
 * **WHAT REPLACES IT IS A RESERVATION, NOT A PRE-ALLOCATED NUMBER.**
 * `reserveFront()` binds port `0`, reads the kernel's answer back and HOLDS the
 * socket, so the host string a suite registers in `RECONCILE_SERVING_HOSTS` and
 * binds its sessions to is known BEFORE the plane starts — and nothing else can
 * take the port in between. ⚠️ **"ask for a free port, close it, bind it later"
 * IS THE REJECTED ALTERNATIVE**: it is the same race with a smaller window.
 *
 * ⚠️ **THE `Host` PROPERTY ABOVE IS UNTOUCHED.** The browser presents
 * `127.0.0.1:<the bound port>`, this front forwards it byte-for-byte, and the
 * session is bound to exactly that string — the port is now chosen by the
 * kernel instead of by a literal, which changes the value and not the rule.
 *
 * The socket is `unref()`'d, so a suite that skips (no PostgreSQL, no browser)
 * still exits rather than hanging on a reservation nobody served.
 */
export interface ReservedFront {
  /** The port the kernel bound. */
  readonly port: number
  /** `127.0.0.1:<port>` — the host string a session must be bound to for G180. */
  readonly host: string
  /** `http://127.0.0.1:<port>`. */
  readonly origin: string
  /** Begin serving `distDir` and forwarding the edge's plane paths to `planeUrl`. */
  readonly serve: (distDir: string, planeUrl: string) => Front
  /** Release the socket (also what `Front.close` does). */
  readonly close: () => Promise<void>
}

export async function reserveFront(): Promise<ReservedFront> {
  let distDir: string | null = null
  let plane: URL | null = null

  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (distDir === null || plane === null) {
      /* A request before `serve()` is a harness ordering defect, and it must
         not look like a page. */
      res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('the single-origin front is reserved and not yet serving')
      return
    }
    const url = new URL(req.url ?? '/', 'http://front.invalid')

    if (reachesThePlane(url.pathname)) {
      proxy(req, res, plane)
      return
    }

    void serveStatic(distDir, url.pathname, res)
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve()
    })
  })
  server.unref()
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('the single-origin front has no port')
  const port = address.port
  const host = `127.0.0.1:${String(port)}`
  const origin = `http://${host}`

  let closed: Promise<void> | null = null
  const close = (): Promise<void> => {
    closed ??= new Promise<void>((resolve) => {
      server.close(() => resolve())
      server.closeAllConnections()
    })
    return closed
  }

  return {
    port,
    host,
    origin,
    serve: (dir: string, planeUrl: string): Front => {
      distDir = dir
      plane = new URL(planeUrl)
      return { origin, close }
    },
    close,
  }
}

/**
 * ⚠️ AN ALLOW-LIST, NOT A LOOKUP WITH A DEFAULT. An unknown extension is
 * served as `application/octet-stream` and a browser will refuse to execute
 * it, which is the loud failure. A `text/html` default would render a
 * mistyped asset path as a blank page and cost somebody an afternoon.
 */
const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

export interface Front {
  readonly origin: string
  readonly close: () => Promise<void>
}

/**
 * ⛔ `startFront()` IS RETIRED — G3911, 4 Oct 2026. It took a `port` defaulting
 * to `FRONT_PORT`, and every caller either took 8080 or passed its own literal.
 * Its job is `reserveFront().serve()` above, split in two because the host a
 * session is bound to must be known before the plane starts. What it did is
 * kept here because the history below is the reason the forwarding list is the
 * edge's own:
 *
 * Serve `dist` and forward the edge's own plane path patterns to `planeUrl`, on
 * one origin.
 *
 * ⚠️ IT SAID *"forward `/v1`"* UNTIL 20 Sep 2026 AND THAT WAS THE DEFECT
 * SPELLED OUT IN THE ONE PLACE A READER LOOKS. See `reachesThePlane()` above.
 *
 * `distDir` is the built frontend — `frontend/dist`, which `npm run
 * build:frontend` produces and the gate already runs; `planeUrl` is the data
 * plane's ephemeral origin from `startDataPlane()`.
 */

/**
 * ⚠️ `req.headers` IS FORWARDED WHOLE, `Host` INCLUDED. See the header. The
 * one header removed is `connection`, because a hop-by-hop header copied onto
 * the next hop is a protocol error rather than a policy choice.
 */
function proxy(req: IncomingMessage, res: ServerResponse, plane: URL): void {
  const headers = { ...req.headers }
  delete headers['connection']

  const upstream = httpRequest(
    {
      host: plane.hostname,
      port: plane.port,
      path: req.url,
      method: req.method,
      headers,
    },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers)
      up.pipe(res)
    },
  )

  upstream.on('error', (err: Error) => {
    /* A plane that is not answering must not look like a 200 with no rows. */
    res.writeHead(502, { 'content-type': 'application/problem+json' })
    res.end(JSON.stringify({ title: 'the front could not reach the plane', detail: err.message }))
  })

  req.pipe(upstream)
}

/**
 * ⚠️ EVERY UNKNOWN PATH FALLS BACK TO `index.html`, WHICH IS WHAT A CLIENT-SIDE
 * ROUTE TABLE REQUIRES — `frontend/src/routes/table.ts` holds twelve paths and
 * a reload on `/close/finding/abc` must reach the app, not a 404 from this
 * file. 🛑 THAT IS A PROPERTY OF THE HARNESS AND NOT A CLAIM ABOUT THE PRODUCT:
 * whether the DEPLOYED distribution does the same is CloudFront's error-page
 * configuration and is asserted nowhere in this repository. Do not read a green
 * deep-link assertion here as evidence about staging.
 */
async function serveStatic(distDir: string, pathname: string, res: ServerResponse): Promise<void> {
  const rel = pathname === '/' ? 'index.html' : normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  const direct = join(distDir, rel)

  const sent = await sendFile(direct, res)
  if (sent) return

  const fallback = await sendFile(join(distDir, 'index.html'), res)
  if (fallback) return

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(`no ${rel} and no index.html under ${distDir} — run \`npm run build:frontend\``)
}

async function sendFile(abs: string, res: ServerResponse): Promise<boolean> {
  let body: Buffer
  try {
    body = await readFile(abs)
  } catch {
    return false
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(abs)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  })
  res.end(body)
  return true
}

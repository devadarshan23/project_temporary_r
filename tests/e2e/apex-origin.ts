/**
 * THE APEX, LOCALLY — what `reconcileai.app` does, served on a loopback port so
 * a real browser can drive the built marketing site. G3157, 2 Oct 2026.
 *
 * `tests/e2e/single-origin.ts` mirrors the `Edge` distributions in front of the
 * APPLICATION bundle. This mirrors the OTHER origin the owner's ruling of
 * 2 Oct 2026 put `/demo` and `/lookup` on — the Amplify app at the apex — and it
 * reproduces that app's three behaviours and nothing else:
 *
 *   · **STATIC FILES, DIRECTORY-INDEXED, AND NO FALLBACK.** `/demo/` serves
 *     `demo/index.html`; an unknown path is a 404. The Amplify app carries no
 *     SPA rewrite and no 404 rule (`infra/lib/amplify-stack.ts`), so a fallback
 *     here would test a host that does not exist. `/demo` without the slash is
 *     answered with `demo/index.html` too, which is the generous reading of what
 *     a static host does with a bare directory name — the runbook checks the
 *     real one (`docs/build/deploy-handoff.md` §25).
 *   · **`MARKETING_PROXIED_PLANE_PATHS`, PROXIED TO THE PLANE** — the stack's
 *     own constant, so this list cannot drift from the rewrite it mirrors. The
 *     real rewrite targets the CONSOLE host; locally there is one plane, and the
 *     forwarded `Host` is the caller's `planeHost` (the reserved front's host since G3911 — it was the constant `FRONT_HOST`), exactly as `single-origin.ts` forwards
 *     it, because `resolveHomeRealm` is a session-tier operation that reads no
 *     host-bound credential.
 *   · **`DEMO_INTAKE_PATH`, ANSWERED BY THE INTAKE'S OWN `handler()`** — the
 *     Lambda's real code (`infra/lambda/demo-intake/index.mjs`), handed a
 *     Function-URL-shaped event. With no queue URL configured (G3681) it answers what a
 *     stack whose queue wiring is broken answers — `502 intake_unavailable` — and it reaches
 *     that answer only AFTER `readIntake()` has accepted the body, so a page
 *     that sent a malformed lead meets a `400` here instead.
 */

import { createServer, request as httpRequest } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { extname, join, normalize } from 'node:path'

import { DEMO_INTAKE_PATH, MARKETING_PROXIED_PLANE_PATHS } from '../../infra/lib/config.ts'


const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
}

export interface Apex {
  readonly origin: string
  readonly close: () => Promise<void>
}

interface IntakeResult {
  readonly statusCode: number
  readonly headers: Readonly<Record<string, string>>
  readonly body: string
}

export async function startApex(siteDist: string, planeUrl: string, planeHost: string): Promise<Apex> {
  const plane = new URL(planeUrl)
  /* A computed specifier: the Lambda is plain `.mjs` with no declaration file. */
  const lambda = pathToFileURL(join(import.meta.dirname, '..', '..', 'infra', 'lambda', 'demo-intake', 'index.mjs')).href
  const intake = (await import(lambda)) as {
    handler(event: unknown): Promise<IntakeResult>
  }

  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://apex.invalid')
    if ((MARKETING_PROXIED_PLANE_PATHS as readonly string[]).includes(url.pathname)) {
      proxy(req, res, plane, planeHost)
      return
    }
    if (url.pathname === DEMO_INTAKE_PATH) {
      void answerIntake(req, res, intake.handler)
      return
    }
    void serveStatic(siteDist, url.pathname, res)
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve()
    })
  })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('the apex mirror has no port')

  return {
    origin: `http://127.0.0.1:${String(address.port)}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      }),
  }
}

function proxy(req: IncomingMessage, res: ServerResponse, plane: URL, planeHost: string): void {
  const headers = { ...req.headers, host: planeHost }
  delete headers['connection']
  const upstream = httpRequest(
    { host: plane.hostname, port: plane.port, path: req.url, method: req.method, headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers)
      up.pipe(res)
    },
  )
  upstream.on('error', (err: Error) => {
    res.writeHead(502, { 'content-type': 'application/problem+json' })
    res.end(JSON.stringify({ title: 'the apex could not reach the plane', detail: err.message }))
  })
  req.pipe(upstream)
}

async function answerIntake(
  req: IncomingMessage,
  res: ServerResponse,
  handler: (event: unknown) => Promise<IntakeResult>,
): Promise<void> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers[name] = value
  }
  const out = await handler({
    requestContext: { http: { method: req.method ?? '' } },
    headers,
    body: Buffer.concat(chunks).toString('utf8'),
    isBase64Encoded: false,
  })
  res.writeHead(out.statusCode, out.headers)
  res.end(out.body)
}

async function serveStatic(dist: string, pathname: string, res: ServerResponse): Promise<void> {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '')
  const candidates = safe.endsWith('/') ? [join(dist, safe, 'index.html')] : [join(dist, safe), join(dist, safe, 'index.html')]
  for (const file of candidates) {
    try {
      const body = await readFile(file)
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
      res.end(body)
      return
    } catch {
      /* the next candidate, or the 404 below */
    }
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(`no ${safe} under ${dist} — run \`npm run build:site\``)
}

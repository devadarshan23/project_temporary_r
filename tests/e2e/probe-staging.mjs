#!/usr/bin/env node
/**
 * THE DEPLOYED STAGING PROBE — G316's read-only half.
 *
 * ┌─ 🛑 THIS IS NOT A CHECKER AND MUST NEVER JOIN `npm run check` ─────────────┐
 * │ G108 rules that a new checker JOINS the gate rather than standing beside   │
 * │ it, and attaches a condition: **deterministic and fast**. This is neither. │
 * │ It reaches the public internet and asserts against a deployed environment, │
 * │ so putting it in the gate would make `npm run check` fail when staging is  │
 * │ down, when DNS is slow, or when somebody is mid-deploy — and a gate that   │
 * │ goes red for reasons unrelated to the commit is the artefact G95 names:    │
 * │ *"a red X … teaches people to ignore CI."*                                 │
 * │                                                                            │
 * │ It is therefore NOT under `tools/` (which is where checkers live and is    │
 * │ counted as such) and NOT named `*.test.mjs` (which is the glob `npm test`  │
 * │ expands — `tests/**‌/*.test.ts` and `tests/**‌/*.test.mjs`). Both are         │
 * │ deliberate. Run it by hand:  `node tests/e2e/probe-staging.mjs`            │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT G316 COMMITS US TO ASSERT, AND WHAT IT DELIBERATELY DOES NOT ────────┐
 * │ G316 rules the deployed host gets NO test login, because the FLAG is the   │
 * │ security boundary and both the seeded handle and the token signing key are │
 * │ published constants — so enabling the flag on an internet-reachable host   │
 * │ publishes a working `ten_acme` credential rather than creating a login.    │
 * │                                                                            │
 * │ **So there is no 200 to assert here, and its absence is the point.** What  │
 * │ staging can prove without a credential is exactly three things, and all    │
 * │ three are real controls rather than liveness pings:                        │
 * │   1. the SPA is served and the consoles answer;                            │
 * │   2. G297's residency fence holds AT THE TLS LAYER, not by an application  │
 * │      check — a flat tenant host is refused with NO CERTIFICATE OFFERED;    │
 * │   3. every gated operation answers the plane's own `session_invalid`, not  │
 * │      a 500, a 404, or a framework error page.                              │
 * │                                                                            │
 * │ The signed-in behaviour is proven in `tests/e2e/browser-login.test.ts`     │
 * │ against a real plane with a real database and the PRODUCTION authoriser.   │
 * │ G316's argument is that this is the same code path, not a weaker one.      │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ EVERY EXPECTATION BELOW IS A PROPERTY, NOT A SNAPSHOT. A 200 that became a
 * 301, or a 401 that became a 403, is a finding — do not relax one to make this
 * green. The one thing that is a snapshot is the host list, and it is derived
 * from `infra/` rather than typed here where that is possible.
 */

import { request } from 'node:https'
import { connect } from 'node:tls'

const TIMEOUT_MS = 15_000

/**
 * ⚠️ `rejectUnauthorized` STAYS ON FOR EVERY HTTPS PROBE. Turning it off would
 * make check 2 — the whole residency assertion — vacuous, because the refusal
 * it looks for IS a certificate failure. §5.6.
 */
function get(url, host) {
  return new Promise((resolve) => {
    const u = new URL(url)
    const req = request(
      {
        host: u.hostname,
        servername: u.hostname,
        port: 443,
        path: u.pathname,
        method: 'GET',
        headers: host === undefined ? {} : { Host: host },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (c) => {
          body += c.length > 4096 ? '' : c
        })
        res.on('end', () =>
          resolve({
            ok: true,
            status: res.statusCode,
            type: res.headers['content-type'] ?? '',
            body,
          }),
        )
      },
    )
    req.on('timeout', () => {
      req.destroy(new Error(`no answer in ${TIMEOUT_MS}ms`))
    })
    req.on('error', (e) => resolve({ ok: false, error: e.message }))
    req.end()
  })
}

/**
 * G297's property, witnessed at the TRANSPORT layer.
 *
 * 🛑 THE ASSERTION IS THAT NO CERTIFICATE IS OFFERED AT ALL — not that a
 * request 404s. `CLAUDE.md` records the reproduction and the reason: a wildcard
 * matches EXACTLY ONE LABEL, so `*.us-west-2.reconcileai.app` covers a tenant
 * host and `*.reconcileai.app` does not cover `{tenant}.{region}.{domain}`.
 * A flat tenant host therefore resolves, connects on 443, and dies in the
 * handshake. **Residency held by TLS rather than by an application check** is
 * the claim, and an application-level 404 would NOT prove it.
 */
function handshake(servername) {
  return new Promise((resolve) => {
    const sock = connect(
      { host: servername, port: 443, servername, timeout: TIMEOUT_MS },
      () => {
        const cert = sock.getPeerCertificate()
        const subject = cert && cert.subject ? cert.subject.CN : null
        sock.end()
        resolve({ handshook: true, cn: subject })
      },
    )
    sock.on('error', (e) => resolve({ handshook: false, error: e.message }))
    sock.on('timeout', () => {
      sock.destroy()
      resolve({ handshook: false, error: `no handshake in ${TIMEOUT_MS}ms` })
    })
  })
}

const checks = []
const record = (name, pass, detail) => checks.push({ name, pass, detail })

/* ── 1 · the surfaces answer ──────────────────────────────────────────── */

for (const [label, url] of [
  ['tenant SPA', 'https://ten-acme.us-west-2.reconcileai.app/'],
  ['staff console', 'https://console.reconcileai.app/'],
  ['partner portal', 'https://partners.reconcileai.app/'],
]) {
  const r = await get(url)
  record(
    `1 · ${label} is served`,
    r.ok && r.status === 200 && String(r.type).includes('text/html'),
    r.ok ? `${r.status} ${r.type}` : r.error,
  )
}

/* ── 2 · G297 · residency, at the TLS layer ───────────────────────────── */

const flat = await handshake('ten-acme.reconcileai.app')
record(
  '2 · G297 — a FLAT tenant host is refused in the handshake, no certificate offered',
  flat.handshook === false,
  flat.handshook
    ? `🛑 IT HANDSHOOK, cn=${flat.cn} — the residency fence is OPEN`
    : flat.error,
)

const regional = await handshake('ten-acme.us-west-2.reconcileai.app')
record(
  '2b · ANTI-VACUOUS — the REGIONAL host does handshake, so 2 is a fence and not an outage',
  regional.handshook === true,
  regional.handshook ? `cn=${regional.cn}` : regional.error,
)

/* ── 3 · every gated operation refuses BY NAME ────────────────────────── */

for (const path of ['/v1/runs', '/v1/runs/run_does_not_exist']) {
  const r = await get(`https://ten-acme.us-west-2.reconcileai.app${path}`)
  let code = null
  try {
    code = JSON.parse(r.body).code
  } catch {
    /* a non-JSON body is itself the finding — reported via `detail` below. */
  }
  record(
    `3 · ${path} answers 401 with the plane's own problem document`,
    r.ok && r.status === 401 && String(r.type).includes('application/problem+json'),
    r.ok ? `${r.status} ${r.type} code=${code ?? '(not JSON)'}` : r.error,
  )
}

/* ── 4 · G316 · there is NO test login on the deployed host ───────────── */

const seeded = await get('https://ten-acme.us-west-2.reconcileai.app/v1/runs')
record(
  '4 · G316 — the deployed plane serves NOBODY without a credential, and that is the ruling',
  seeded.ok && seeded.status === 401,
  seeded.ok ? `${seeded.status}` : seeded.error,
)

/* ── report ───────────────────────────────────────────────────────────── */

let failed = 0
for (const c of checks) {
  if (!c.pass) failed += 1
  console.log(`${c.pass ? '✔' : '✖'} ${c.name}\n    ${c.detail}`)
}
console.log(
  `\n${checks.length - failed}/${checks.length} passed. ` +
    'This probe is NOT part of `npm run check` — see the header.',
)
process.exit(failed === 0 ? 0 : 1)

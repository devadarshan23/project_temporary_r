/**
 * THE REGISTER CONSUMES `listRuns` — RED, and red about the CLIENT rather than
 * about a missing import.
 *
 * 🛑 WHY THIS FILE EXISTS. Twelve routes exist as static HTML in `design/routes/`
 * and NOTHING CONSUMES AN OPERATION. Four of the 72 declared operations are
 * served — derive both, do not read them here:
 *
 *     for f in docs/contracts/[a-z]*.openapi.yaml; do grep -c '^ *operationId:' $f; done
 *     grep -n 'handlers:' server/control-plane/start.ts server/data-plane/start.ts
 *
 * ⚠️ THE SECOND COMMAND IS SPELLED OUT RATHER THAN GLOBBED, AND NOT FOR TIDINESS.
 * It read `server/*` + `/start.ts`, and A STAR FOLLOWED BY A SLASH CLOSES A BLOCK
 * COMMENT — the header terminated mid-sentence, the rest of the prose was parsed
 * as TypeScript, and `tsc` reported twenty-five syntax errors pointing at lines
 * of English. `frontend/src/bridge.css` records the identical trap in CSS and
 * says a reproduce command inside a comment may not contain one. It is the same
 * rule here.
 *
 * G200 freezes MOUNTING. It does not forbid a client consuming what is already
 * served, so `listRuns` is the first honest view↔model connection this system can
 * have. This file asserts the READING half of it — real HTTP, real row-level
 * security, real tenant scope. The DRAWING half is
 * `tests/design/shell.test.ts`; the two meet at the `Run` wire shape and nowhere
 * else, and neither this file nor that one joins them end to end. That is stated
 * here rather than left to be assumed.
 *
 * ┌─ WHAT IS ASSERTED ─────────────────────────────────────────────────────────┐
 * │ 3  The client reads REAL runs over HTTP from a running data plane, and      │
 * │    sees its own tenant's runs and only its own.                            │
 * │ 4  THE REQUEST THE CLIENT ISSUES CARRIES NO TENANT VALUE — not in a header, │
 * │    not in the HOST, not in a query parameter, not in a body, not split      │
 * │    across two of them, and not base64url- or hex-smuggled inside any.       │
 * │    Invariant 1 as an executable test, on the CLIENT side.                   │
 * │ 5  `completeness: null` survives the client unchanged. `null` and `[]` mean │
 * │    different things and a client that collapses them destroys the           │
 * │    distinction before any view can draw it.                                │
 * │ 7  `getRun` IS CONSUMED, and its request holds all three of the above.      │
 * │ 8  A hostile `runId` cannot re-address that request.                       │
 * │ 9  The completeness VOCABULARY is one vocabulary — the module both the      │
 * │    register and the drill-down panel derive their words from.               │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ ASSERTIONS 7, 8 AND 9 ARE REPAIRS, AND TWO OF THEM REPAIR A CLAIM RATHER
 * THAN A DEFECT. The pull request published a two-request wire transcript — one
 * for `/v1/runs` and one for `/v1/runs/run_…` — while this file called `fetchRuns`
 * and nothing else, and the run ids in that transcript existed nowhere in the
 * repository. The code was correct when read by hand; the COVERAGE was not there,
 * and a claim that exceeds its coverage is indistinguishable from a false one
 * until somebody re-derives it. See `loadFetchRun`.
 *
 * ⚠️ INVARIANT 1 IS ALREADY WITNESSED ON THE SERVER, AND THAT IS NOT THIS.
 * `tests/http/data-plane-http.test.ts` and `get-run.test.ts` prove the SERVER
 * ignores anything a request says about a tenant. Neither can prove the CLIENT
 * does not say it — a client that appends `?tenantId=…` passes every server-side
 * assertion in this directory, because the plane's querystring schema is
 * `additionalProperties: false` and simply refuses it. The property here is that
 * the client never reaches for it, and it is measured on the wire the client
 * actually put on the socket.
 *
 * THE SEAM THIS PASS DECLARES AND DOES NOT BUILD:
 *
 *   frontend/src/api/runs.ts
 *       export function fetchRuns(o: { origin: string; session: string })
 *         : Promise<{ items: unknown[]; nextCursor: string | null }>
 *       export function fetchRun(o: { origin: string; session: string; runId: string })
 *         : Promise<Run>
 *
 * 🛑 THE SIGNATURE IS THE ASSERTION, AND THE ABSENT PARAMETER IS THE POINT.
 * There is no `tenantId` on it and there must never be one: invariant 1 says
 * scope is DERIVED FROM THE SESSION, so the only credential the client holds is
 * the session and the tenant is not the client's to name. `session` is the
 * `X-Session` value, exactly as `capability.openapi.yaml`'s `sessionContext`
 * declares it.
 *
 * ⚠️ AND IT RESOLVES TO THE PARSED BODY, NOT TO A VIEW MODEL. `{ items,
 * nextCursor }` is what `listRuns` publishes; reshaping belongs to whatever
 * draws, not to the thing that reads. A client that renamed or flattened the
 * fields would put a second vocabulary between the contract and the view with
 * nothing checking it — the same argument `db/migrations/0002_run.sql` makes for
 * declining a third copy of a closed enum.
 *
 * ⚠️ THE IMPORT IS DYNAMIC AND ITS SPECIFIER IS NOT A LITERAL, for the reason
 * `tests/http/harness.ts` gives: a static import of a module that does not exist
 * fails `tsc -p tests/tsconfig.json` with TS2307 and takes the WHOLE SUITE down
 * before a single test runs. The absence is RETURNED and never thrown, so each
 * assertion fails with its own sentence about its own property.
 *
 * ✅ WITNESSED IN BOTH DIRECTIONS AGAINST A THROWAWAY CLIENT, 16 Aug 2026,
 * AGAINST A REAL POSTGRESQL, AND THE CLIENT IS NOT COMMITTED. A deliberately
 * WRONG `frontend/src/api/runs.ts` was planted — it appended
 * `&tenantId=ten_acme` and defaulted `completeness` with `?? []` — and all three
 * seam assertions moved from "there is no client" to the behavioural messages,
 * with the 6 base controls staying green. A correct client then took all 9
 * green. Note what the wrong one demonstrated in passing: assertion 3 failed
 * too, because the plane's querystring schema is `additionalProperties: false`
 * and REFUSED the request outright — which is the argument in the paragraph
 * above, arriving as a measurement.
 *
 * 🛑 WHAT THIS FILE MUST NEVER GROW: a stub client. A local function that returns
 * a plausible page would turn every assertion below green while the property was
 * absent — the §5.6 shape, and the audit finding `tests/db/tenant-isolation.test.ts`
 * exists to answer, repeated one layer up.
 *
 * ⚠️ THIS FILE USES ITS OWN DATABASE, for the reason the other HTTP files give:
 * `node --test` runs files concurrently and two files rebuilding one schema
 * produce failures that have nothing to do with either property.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import {
  mintTestToken,
  setLocalTestAuth,
  allowEveryCapability,
  fixtureSubstrate,
  startDataPlane,
  type RunningServer,
} from './harness.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_REGISTER_DB_NAME'] ?? runScopedName('reconcile_register_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const ACME_DONE = 'run_acme_done'
const ACME_INCOMPLETE = 'run_acme_incomplete'
const GLOBEX_RUN = 'run_globex_one'

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/http/register-consumes-runs.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS FILE IS THE ONLY PLACE THE CLIENT MEETS A REAL PLANE. A run of the',
      '   suite in which it skipped is NOT evidence that the register reads real',
      '   runs, and it is NOT evidence that the request the client issues carries',
      '   no tenant value. Start a PostgreSQL and re-run before believing a green',
      '   suite. The BASE CONTROLS below are the only assertions here that hold',
      '   without one, and they are about the inspector, not about the client.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the register-consuming-listRuns assertions', probe)

/* ------------------------------------------------------------------ *
 * THE SEAM.
 * ------------------------------------------------------------------ */

const CLIENT = '../../frontend/src/api/runs.ts'

interface RunPage {
  readonly items: readonly unknown[]
  readonly nextCursor: string | null
}

type Attempt<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string }

function why(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code
    return code === undefined ? err.message : `${code}: ${err.message}`
  }
  return String(err)
}

/**
 * Load `fetchRuns`, or say why it could not be loaded.
 *
 * ⚠️ IT MUST BE IMPORTABLE WITHOUT A BUNDLER, and that is a real constraint on
 * where the client may live rather than an accident of this test. Node strips
 * TypeScript types and does not transform JSX, so a client that imported a
 * `.tsx`, a CSS file or anything Vite resolves would fail here — the reason
 * string says so, and it is the correct thing to be told. The API client is the
 * one part of a frontend that has no business knowing about the framework.
 */
async function loadFetchRuns(): Promise<Attempt<(o: { origin: string }) => Promise<RunPage>>> {
  const dynamic: (s: string) => Promise<unknown> = (s) => import(s)
  let mod: Record<string, unknown>
  try {
    mod = (await dynamic(CLIENT)) as Record<string, unknown>
  } catch (err) {
    return {
      ok: false,
      reason:
        '`frontend/src/api/runs.ts` did not load — ' + why(err) + '. Nothing in this ' +
        'repository consumes a served operation: 12 routes exist as static HTML in ' +
        '`design/routes/` and none of them fetches anything. The register is the first, ' +
        'and `listRuns` is already mounted on the data plane, so no G row and no new ' +
        'operation is needed to build it.',
    }
  }
  const value = mod['fetchRuns']
  if (typeof value !== 'function') {
    return {
      ok: false,
      reason:
        '`frontend/src/api/runs.ts` exists but exports no `fetchRuns` function. The seam ' +
        'is declared in this file\'s header: `fetchRuns({ origin, session })` resolving to ' +
        'the parsed `{ items, nextCursor }` body, with NO tenant parameter.',
    }
  }
  return { ok: true, value: value as (o: { origin: string }) => Promise<RunPage> }
}

/**
 * Load `fetchRun` — the SECOND served operation the register consumes.
 *
 * ┌─ 🛑 THIS LOADER IS A REPAIR, AND THE DEFECT IT REPAIRS WAS IN THE CLAIM ────┐
 * │ RATHER THAN IN THE CODE.                                                    │
 * │                                                                            │
 * │ ⚠️ THE PULL REQUEST DESCRIBED A `getRun` VERIFICATION THAT WAS NOT IN THIS  │
 * │ FILE. It printed a two-request wire transcript — `/v1/runs` AND             │
 * │ `/v1/runs/run_…` — and `grep -n 'fetchRun\b' ` on this file returned        │
 * │ nothing: `readAs()` called `fetchRuns` and nothing else, so assertion 4     │
 * │ inspected ONE request and the second half of the transcript was output from │
 * │ a version of this test that was never committed. `fetchRun` had zero        │
 * │ coverage anywhere and its only call site was `main.tsx`, which is JSX,      │
 * │ which nothing here can load.                                               │
 * │                                                                            │
 * │ The code was correct when read by hand. That is exactly the shape           │
 * │ docs/HANDOFF.md §5 is about — a claim that exceeds its coverage is          │
 * │ indistinguishable from a claim that is false until somebody re-derives it,  │
 * │ and "I read it and it looked right" is not a control. So the transcript is  │
 * │ BACKED rather than withdrawn: `getRun` is now called through `capture()`    │
 * │ against the live plane, and every property asserted of `listRuns`'s request │
 * │ is asserted of this one.                                                   │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
async function loadFetchRun(): Promise<Attempt<(o: { origin: string; runId: string }) => Promise<Record<string, unknown>>>> {
  const dynamic: (s: string) => Promise<unknown> = (s) => import(s)
  let mod: Record<string, unknown>
  try {
    mod = (await dynamic(CLIENT)) as Record<string, unknown>
  } catch (err) {
    return { ok: false, reason: '`frontend/src/api/runs.ts` did not load — ' + why(err) }
  }
  const value = mod['fetchRun']
  if (typeof value !== 'function') {
    return {
      ok: false,
      reason:
        '`frontend/src/api/runs.ts` exports no `fetchRun`. `getRun` is one of the four ' +
        'operations this plane serves and the register names a run it cannot open; a ' +
        'client that reads the list and not the row leaves the drill-down unwitnessed.',
    }
  }
  return {
    ok: true,
    value: value as (o: { origin: string; runId: string }) => Promise<Record<string, unknown>>,
  }
}

const PLANE = '../../frontend/src/api/plane.ts'

interface PlaneChoice {
  readonly origin: string
  readonly refused: string | null
}

/**
 * Load `planeFrom`, the `?plane=` allowlist.
 *
 * 🛑 IT IS A `.ts` MODULE AND NOT PART OF `main.tsx` PRECISELY SO THIS CAN LOAD
 * IT. `main.tsx` is JSX; node does not transform JSX; a guard living there is a
 * guard nothing in this repository can witness — which is how the unvalidated
 * version shipped.
 */
async function loadPlaneFrom(): Promise<Attempt<(search: string) => PlaneChoice>> {
  const dynamic: (s: string) => Promise<unknown> = (s) => import(s)
  let mod: Record<string, unknown>
  try {
    mod = (await dynamic(PLANE)) as Record<string, unknown>
  } catch (err) {
    return {
      ok: false,
      reason:
        '`frontend/src/api/plane.ts` did not load — ' + why(err) + '. `?plane=` decides ' +
        'where the SESSION TOKEN is sent, so it is allowlisted in a module a test can ' +
        'reach rather than inline in `main.tsx`, which no test can load.',
    }
  }
  const value = mod['planeFrom']
  if (typeof value !== 'function') {
    return { ok: false, reason: '`frontend/src/api/plane.ts` exports no `planeFrom`' }
  }
  return { ok: true, value: value as (search: string) => PlaneChoice }
}

/* ------------------------------------------------------------------ *
 * THE REQUEST INSPECTOR — invariant 1, made executable.
 * ------------------------------------------------------------------ */

interface Outgoing {
  readonly url: string
  readonly method: string
  readonly headers: Readonly<Record<string, string>>
  readonly body: string | null
}

/**
 * `capability.openapi.yaml` → `components.securitySchemes.sessionContext`. The
 * session credential is the ONE place a tenant may legitimately travel, because
 * the tenant is derived FROM it by the server and is never read out of the
 * request by a handler. Every other byte of the request is scanned.
 */
const SESSION_HEADER = 'x-session'

/**
 * 🛑 G386, 19 Sep 2026 — THE SECOND EXCLUSION, AND IT IS THE PRODUCTION ONE
 * NOW. The session handle travels as `Cookie: __Host-reconcile_session=…`, so
 * the same sentence above applies to it unchanged: the tenant is derived FROM
 * the credential by the server, and a scan that refused the credential would
 * refuse the design.
 *
 * ⚠️ EXCLUDING A WHOLE `Cookie` HEADER IS WIDER THAN EXCLUDING `X-Session` AND
 * THE WIDENING IS NAMED RATHER THAN SLIPPED IN: a second cookie carrying a
 * tenant would ride inside this exclusion and this inspector would not see it.
 * What makes that acceptable is that **nothing in this repository sets a second
 * cookie** — `server/data-plane/session-cookie.ts` is the only `Set-Cookie` in
 * `server/`, derive it — and that the client sets none at all, because page
 * script cannot write a `__Host-` cookie the plane would read and does not try.
 * If a second cookie is ever minted, this exclusion has to become per-cookie
 * and the assertion below has to say so.
 */
const SESSION_COOKIE_HEADER = 'cookie'

/**
 * Decode anything that might be hiding a slug. A tenant smuggled as base64url is
 * still a tenant read from a request, and `server/dev/test-token.ts` shows the
 * shape is not hypothetical: its own payload is exactly that.
 *
 * ⚠️ HEX IS DECODED TOO, AND THAT IS A REPAIR RATHER THAN THOROUGHNESS. The
 * review that prompted it measured the miss instead of asserting it:
 * `?scope=74656e5f61636d65` returned `[]` from this inspector — a literal
 * `ten_acme`, in the query, invisible. A scan that knows exactly one encoding is
 * a scan that is satisfied by the second one somebody reaches for.
 *
 * 🛑 AND IT STILL KNOWS ONLY THE ENCODINGS IT KNOWS. URL-encoding arrives already
 * decoded through `URLSearchParams`; base64url and hex are decoded here; anything
 * else — rot13, a hash, a per-tenant alias — passes. That is a bounded control,
 * not a closed one, and `tenantLeaks` says so where the assertion can read it.
 */
function decoded(value: string): string[] {
  const out: string[] = [value]
  for (const seg of value.split(/[^A-Za-z0-9_-]+/)) {
    if (seg.length < 8) continue
    try {
      const text = Buffer.from(seg, 'base64url').toString('utf8')
      if (/^[\x09\x0a\x0d\x20-\x7e]+$/.test(text)) out.push(text)
    } catch {
      /* not base64url; the raw value is already in `out` */
    }
    if (seg.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(seg)) {
      const text = Buffer.from(seg, 'hex').toString('utf8')
      if (/^[\x09\x0a\x0d\x20-\x7e]+$/.test(text)) out.push(text)
    }
  }
  return out
}

/**
 * Every place the request names or carries a tenant, EXCLUDING the session
 * credential itself. Returns one sentence per leak; an empty array is the
 * property holding.
 *
 * ┌─ 🛑 WHAT IS EXCLUDED, AND WHAT MERELY WAS NOT LOOKED AT ───────────────────┐
 * │ Those are different things and this file used to state them as one. The     │
 * │ assertion-4 message read "The session credential is excluded from this      │
 * │ scan; everything else is not" — and everything else was not scanned:        │
 * │ `url.host` was never read at all. Measured, not argued:                     │
 * │                                                                            │
 * │   tenantLeaks({url:'http://ten_acme.plane.example:1/v1/runs',…},'ten_acme') │
 * │     → []                                                                    │
 * │                                                                            │
 * │ A per-tenant hostname is the PLAUSIBLE hosted-plane shape — `plane.ts` says │
 * │ in as many words that a hosted origin joins `PERMITTED_ORIGINS` when one    │
 * │ exists — so this was the miss most likely to be reached rather than a       │
 * │ contrived one. The host is scanned now, and controls below witness it.      │
 * │                                                                            │
 * │ ⚠️ THE HOST IS SCANNED FOR THE TENANT VALUE AND NOT FOR THE NAME PATTERN,   │
 * │ deliberately. `names` would fire on a legitimate future host containing     │
 * │ "customer" or "org", and a detector that reports a correct deployment as a  │
 * │ leak is one somebody deletes.                                              │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 ONE MORE SHAPE, CLOSED THE SAME WAY: a tenant SPLIT ACROSS TWO INNOCENT
 * PARAMETERS. `?a=ten_&b=acme` was `[]` too — every value read on its own, so no
 * single one contains the slug. The concatenation of the query's values in order
 * is scanned as well.
 *
 * ⚠️ BOUNDED, NOT CLOSED, AND THE BOUND IS NAMED: this catches the tenant VALUE
 * under the encodings `decoded()` knows, plus a header, query key or body that
 * NAMES a tenant. It cannot catch a value the client never spells — an opaque
 * per-tenant alias minted elsewhere would pass every assertion here. What makes
 * that acceptable is that the client has no tenant to spell: `fetchRuns` and
 * `fetchRun` take `origin`, `session` and a `runId`, and nothing else.
 */
function tenantLeaks(req: Outgoing, tenantId: string): readonly string[] {
  const leaks: string[] = []
  const names = /tenant|\borg\b|organisation|organization|customer/i

  for (const [name, value] of Object.entries(req.headers)) {
    const lower = name.toLowerCase()
    if (lower === SESSION_HEADER || lower === SESSION_COOKIE_HEADER) continue
    if (names.test(name)) leaks.push(`header \`${name}\` names a tenant`)
    if (decoded(value).some((v) => v.includes(tenantId))) {
      leaks.push(`header \`${name}\` carries \`${tenantId}\``)
    }
  }

  const url = new URL(req.url)
  /* The DESTINATION carries the tenant — `ten_acme.plane.example`. Read before
     the path, because it is the half that was not read at all. */
  if (decoded(url.host).some((v) => v.includes(tenantId))) {
    leaks.push(`the host \`${url.host}\` carries \`${tenantId}\``)
  }
  const values: string[] = []
  for (const [key, value] of url.searchParams) {
    values.push(value)
    if (names.test(key)) leaks.push(`query parameter \`${key}\` names a tenant`)
    if (decoded(value).some((v) => v.includes(tenantId))) {
      leaks.push(`query parameter \`${key}\` carries \`${tenantId}\``)
    }
  }
  if (values.length > 1 && decoded(values.join('')).some((v) => v.includes(tenantId))) {
    leaks.push(`the query parameters together carry \`${tenantId}\``)
  }
  if (decoded(url.pathname).some((v) => v.includes(tenantId))) {
    leaks.push(`the path \`${url.pathname}\` carries \`${tenantId}\``)
  }

  const body = req.body ?? ''
  if (body !== '') {
    if (names.test(body)) leaks.push('the request body names a tenant')
    if (decoded(body).some((v) => v.includes(tenantId))) {
      leaks.push(`the request body carries \`${tenantId}\``)
    }
  }

  return leaks
}

/* ------------------------------------------------------------------ *
 * CAPTURING WHAT THE CLIENT PUT ON THE SOCKET.
 * ------------------------------------------------------------------ */

/**
 * Wrap `globalThis.fetch` and record every request that passes through it.
 *
 * 🛑 THE WRAPPER IS NOT AN INJECTION POINT AND MUST NOT BECOME ONE. A
 * `fetchImpl` prop on `fetchRuns` would let the client behave one way in a test
 * and another in a browser, and this assertion would then measure the test's
 * path. The wrapper is transparent — it forwards to the real `fetch` and returns
 * the real response — so what is recorded is the request that was actually sent
 * to the actually-running plane.
 *
 * ⚠️ `node --test` gives each FILE its own process, so patching a global here
 * cannot reach another suite. It is still restored in a `finally`.
 */
async function capture<T>(
  fn: () => Promise<T>,
  jar?: { readonly origin: string; readonly handle: string },
): Promise<{ result: T; sent: readonly Outgoing[] }> {
  const real = globalThis.fetch
  const sent: Outgoing[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input as RequestInfo, init)
    /**
     * 🛑 THE COOKIE JAR NODE DOES NOT HAVE — G386, 19 Sep 2026, AND IT IS THE
     * ONE THING THIS WRAPPER DOES BESIDES RECORD.
     *
     * The client used to be HANDED its credential (`fetchRuns({origin,
     * session})`) and attached it as a header. Under G386 it is handed
     * nothing: the handle is an `HttpOnly` cookie and the USER AGENT attaches
     * it. Node's `fetch` has no cookie store and ignores `credentials`
     * entirely, so without this the client sends no credential in this process
     * and every assertion below measures a 401.
     *
     * ⚠️ IT ATTACHES SAME-ORIGIN ONLY, WHICH IS NOT TIDINESS — IT IS THE
     * PROPERTY UNDER TEST. `credentials: 'same-origin'` means a browser sends
     * this cookie to the page's own origin and to nowhere else, so a jar that
     * attached it to every host would make the `?plane=`-to-a-stranger
     * assertion below pass while modelling a browser that does not exist. The
     * recorded request therefore shows the credential present on the plane and
     * ABSENT on a stranger — which is the browser's control, witnessed.
     *
     * ⚠️ AND IT IS STILL NOT AN INJECTION POINT. It sets a transport header the
     * way a user agent would; `fetchRuns` is called with no credential
     * argument and has none to attach. A `fetchImpl` prop remains refused for
     * the reason above.
     */
    const withJar =
      jar !== undefined && new URL(req.url).origin === new URL(jar.origin).origin
        ? new Request(req, { headers: appendCookie(req.headers, jar.handle) })
        : req
    const body = await withJar.clone().text()
    sent.push({
      url: withJar.url,
      method: withJar.method,
      headers: Object.fromEntries(withJar.headers.entries()),
      body: body === '' ? null : body,
    })
    return real(withJar)
  }) as typeof globalThis.fetch
  try {
    return { result: await fn(), sent }
  } finally {
    globalThis.fetch = real
  }
}

/** `server/data-plane/session-cookie.ts`'s name, spelled here for `harness.ts`'s reason. */
const SESSION_COOKIE = '__Host-reconcile_session'

function appendCookie(headers: Headers, handle: string): Headers {
  const next = new Headers(headers)
  next.set(SESSION_COOKIE_HEADER, `${SESSION_COOKIE}=${handle}`)
  return next
}

/* ------------------------------------------------------------------ *
 * The slice.
 * ------------------------------------------------------------------ */

interface Slice {
  readonly server: RunningServer
  readonly acmeToken: string
  readonly globexToken: string
}

let sliceOnce: Promise<Attempt<Slice>> | undefined

async function seed(): Promise<Attempt<true>> {
  const client = await migratorClient()
  try {
    await client.query('BEGIN')
    for (const [tenant, runId, status] of [
      [ACME, ACME_DONE, 'completed'],
      [ACME, ACME_INCOMPLETE, 'incomplete'],
      [GLOBEX, GLOBEX_RUN, 'completed'],
    ] as const) {
      await client.query(
        `INSERT INTO run
           (tenant_id, id, definition_id, definition_version, period_id,
            trigger_kind, status, started_at)
         VALUES ($1, $2, 'def_one', 1, NULL, 'manual', $3, now())`,
        [tenant, runId, status],
      )
    }
    await client.query('COMMIT')
    return { ok: true, value: true }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    return { ok: false, reason: `could not seed \`run\` — ${why(err)}` }
  } finally {
    await client.end()
  }
}

async function buildSlice(): Promise<Attempt<Slice>> {
  setLocalTestAuth(true)
  const seeded = await seed()
  if (!seeded.ok) return seeded

  // ⚠️ `authorise` SUPPLIED, 19 Sep 2026. G200's gate refuses every verb on the
  // served path by default (server/data-plane/authorise.ts: no subject is
  // resolvable here), and this suite is about what happens BEHIND the gate.
  // `tests/http/harness.ts` states what that costs; `capability-gate.test.ts`
  // is where the gate itself is witnessed.
  const started = await startDataPlane({
    poolMax: 1,
    authorise: allowEveryCapability,
    /* ⚠️ G301, 19 Sep 2026 — `authorise` ALONE NO LONGER GETS A SUITE BEHIND
     * THE GATE. A gated handler now MINTS invariant 10's record before it
     * reads, and a mint needs a principal; the local test token resolves none.
     * `tests/http/harness.ts` states at length why this fixture exists and what
     * it does NOT buy — the verdict still comes from `decide()`. */
    substrate: fixtureSubstrate(),
  })
  if (!started.ok) return started

  const acme = await mintTestToken({ tenantId: ACME })
  if (!acme.ok) {
    await started.value.close().catch(() => undefined)
    return acme
  }
  const globex = await mintTestToken({ tenantId: GLOBEX })
  if (!globex.ok) {
    await started.value.close().catch(() => undefined)
    return globex
  }
  return { ok: true, value: { server: started.value, acmeToken: acme.value, globexToken: globex.value } }
}

function slice(): Promise<Attempt<Slice>> {
  sliceOnce ??= buildSlice()
  return sliceOnce
}

/** One `fetchRuns` call against the live plane, with the request recorded. */
async function readAs(token: string): Promise<Attempt<{ page: RunPage; sent: readonly Outgoing[] }>> {
  const s = await slice()
  if (!s.ok) return s
  const client = await loadFetchRuns()
  if (!client.ok) return client
  try {
    const { result, sent } = await capture(
      () => client.value({ origin: s.value.server.url }),
      { origin: s.value.server.url, handle: token },
    )
    return { ok: true, value: { page: result, sent } }
  } catch (err) {
    return { ok: false, reason: `\`fetchRuns()\` threw — ${why(err)}` }
  }
}

/** One `fetchRun` call against the live plane, with the request recorded. */
async function readOneAs(
  token: string,
  runId: string,
): Promise<Attempt<{ run: Record<string, unknown>; sent: readonly Outgoing[] }>> {
  const s = await slice()
  if (!s.ok) return s
  const client = await loadFetchRun()
  if (!client.ok) return client
  try {
    const { result, sent } = await capture(
      () => client.value({ origin: s.value.server.url, runId }),
      { origin: s.value.server.url, handle: token },
    )
    return { ok: true, value: { run: result, sent } }
  } catch (err) {
    return { ok: false, reason: `\`fetchRun()\` threw — ${why(err)}` }
  }
}

function runIds(page: RunPage): string[] {
  if (!Array.isArray(page?.items)) return []
  return page.items.map((i) =>
    typeof i === 'object' && i !== null && 'runId' in i ? String((i as { runId: unknown }).runId) : '(no runId)')
}

// ──────────────────────────────────────────────────────────────────────────
/**
 * BASE CONTROLS. Green today, with no seam and no database — the inspector is a
 * pure function over a recorded request. Without these, assertion 4 could pass
 * on a client that leaks a tenant in a way the inspector cannot see, which is
 * docs/HANDOFF.md §5.6 inside the control written to prevent it.
 */
describe('BASE CONTROL — the request inspector', () => {
  const clean: Outgoing = {
    url: 'http://127.0.0.1:1/v1/runs?limit=50',
    method: 'GET',
    headers: { 'x-session': 'rtt1.eyJ0ZW5hbnRJZCI6InRlbl9hY21lIn0.sig', accept: 'application/json' },
    body: null,
  }

  it('a clean request leaks nothing — and the SESSION is not mistaken for a leak', () => {
    assert.deepEqual(tenantLeaks(clean, ACME), [],
      'the inspector flagged a request that carries the tenant ONLY inside the session ' +
      'credential. That is where the tenant is supposed to be: invariant 1 says scope is ' +
      'DERIVED FROM THE SESSION, so a scan that refuses the session refuses the design. ' +
      'Note the fixture header decodes to {"tenantId":"ten_acme"} — the inspector must see ' +
      'that and pass it, or assertion 4 is red against the design rather than against the ' +
      'client.')
  })

  it('CATCHES a tenant in a query parameter', () => {
    const leaked: Outgoing = { ...clean, url: `${clean.url}&tenantId=${ACME}` }
    assert.ok(tenantLeaks(leaked, ACME).length > 0, 'the inspector missed `?tenantId=`')
  })

  it('CATCHES a tenant in a header', () => {
    const leaked: Outgoing = { ...clean, headers: { ...clean.headers, 'x-tenant-id': ACME } }
    assert.ok(tenantLeaks(leaked, ACME).length > 0, 'the inspector missed `X-Tenant-Id:`')
  })

  it('CATCHES a tenant in a body', () => {
    const leaked: Outgoing = { ...clean, method: 'POST', body: JSON.stringify({ tenantId: ACME }) }
    assert.ok(tenantLeaks(leaked, ACME).length > 0, 'the inspector missed a body field')
  })

  it('CATCHES a tenant BASE64-SMUGGLED under an innocent key', () => {
    const smuggled = Buffer.from(ACME, 'utf8').toString('base64url')
    const leaked: Outgoing = { ...clean, url: `${clean.url}&scope=${smuggled}` }
    assert.ok(tenantLeaks(leaked, ACME).length > 0,
      'the inspector missed a base64url-encoded tenant. A scan that reads only literals ' +
      'is satisfied by any encoding, and `server/dev/test-token.ts` proves the shape is ' +
      'the obvious one to reach for rather than a contrived attack.')
  })

  it('CATCHES a tenant in the PATH', () => {
    const leaked: Outgoing = { ...clean, url: `http://127.0.0.1:1/v1/tenants/${ACME}/runs` }
    assert.ok(tenantLeaks(leaked, ACME).length > 0, 'the inspector missed a tenant in the path')
  })

  /* ── THE THREE MISSES THE REVIEW MEASURED ────────────────────────────────
     Each of these returned `[]` from the inspector as shipped, while the
     assertion resting on it said "everything else is not [excluded]". They are
     controls rather than notes for the reason the block above exists: an
     inspector nobody has watched catch a shape is an inspector that proves
     nothing about that shape. */

  it('CATCHES a tenant in the HOST — the per-tenant hostname a hosted plane would use', () => {
    const leaked: Outgoing = { ...clean, url: `http://${ACME}.plane.example:1/v1/runs` }
    assert.ok(tenantLeaks(leaked, ACME).length > 0,
      'the inspector missed a tenant in the HOST. `url.host` was never read at all, and a ' +
      'per-tenant hostname is the plausible hosted-plane shape rather than a contrived one — ' +
      '`frontend/src/api/plane.ts` says a hosted origin joins `PERMITTED_ORIGINS` when one ' +
      'exists. Invariant 1 does not stop at the path.')
  })

  it('CATCHES a HEX-encoded tenant — a scan that knows one encoding knows none', () => {
    const hex = Buffer.from(ACME, 'utf8').toString('hex')
    const leaked: Outgoing = { ...clean, url: `${clean.url}&scope=${hex}` }
    assert.ok(tenantLeaks(leaked, ACME).length > 0,
      `the inspector missed \`?scope=${hex}\`, which is a literal \`${ACME}\` one encoding ` +
      'away. base64url was decoded and hex was not, which is the shape of a control that ' +
      'was written against the example rather than against the property.')
  })

  it('CATCHES a tenant SPLIT across two innocent parameters', () => {
    const leaked: Outgoing = { ...clean, url: `${clean.url}&a=ten_&b=acme` }
    assert.ok(tenantLeaks(leaked, ACME).length > 0,
      'the inspector missed a tenant split across two parameters. Reading every value on ' +
      'its own means no single value contains the slug, and the request still names the ' +
      'tenant to anything that concatenates them — which is what a server does.')
  })

  it('NEGATIVE — the widened scan does NOT fire on the clean request or a cursor', () => {
    assert.deepEqual(tenantLeaks(clean, ACME), [],
      'the widened scan now fires on a clean request. A detector that reports a correct ' +
      'client as a leak is one the next person deletes.')
    const paged: Outgoing = { ...clean, url: `${clean.url}&cursor=cnVuXzE%3D` }
    assert.deepEqual(tenantLeaks(paged, ACME), [],
      'the widened scan fired on an opaque CURSOR. `components.parameters.Cursor` is base64 ' +
      'by nature and the client is required to send it back verbatim; a scan that refuses ' +
      'paging refuses the contract.')
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('the register consuming listRuns', { skip }, () => {
  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
  })

  after(async () => {
    setLocalTestAuth(false)
    const s = await slice()
    if (s.ok) await s.value.server.close().catch(() => undefined)
  })

  // ────────────────────────────────────────────────────────────────────────
  it('3 · the client reads REAL runs over HTTP, and only its own tenant\'s', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)
    const read = await readAs(s.value.acmeToken)
    if (!read.ok) {
      assert.fail(
        'THE REGISTER READS NOTHING. Nothing in this repository consumes a served ' +
        'operation, so the view↔model connection is unwitnessed at its first and ' +
        `simplest point. ${read.reason}`)
    }

    const ids = runIds(read.value.page).sort()
    assert.deepEqual(ids, [ACME_DONE, ACME_INCOMPLETE].sort(),
      'the client did not return this session\'s runs. It must return exactly the two ' +
      `seeded for \`${ACME}\` — and NOT \`${GLOBEX_RUN}\`, which is seeded and which the ` +
      'row-level security policy on `run` is what hides: `server/data-plane/runs.ts` ' +
      'carries no tenant predicate at all, by design, so a leak here is a leak in the ' +
      `database session and not a forgotten WHERE. Saw: ${JSON.stringify(ids)}`)

    assert.ok(Object.hasOwn(read.value.page, 'nextCursor'),
      '`nextCursor` is missing from what the client returned. `listRuns` publishes ' +
      '`{ items, nextCursor }` and the cursor is opaque on purpose — a client that drops ' +
      'it cannot page, and a register that cannot page shows an arbitrary prefix of a ' +
      'tenant\'s runs while looking complete.')
  })

  // ────────────────────────────────────────────────────────────────────────
  it('4 · INVARIANT 1 — the request the client issues carries NO tenant value', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)
    const read = await readAs(s.value.acmeToken)
    if (!read.ok) {
      assert.fail(
        'INVARIANT 1 IS UNWITNESSED ON THE CLIENT SIDE, because there is no client. ' +
        '"Tenant scope is derived from the session, never read from a request." The ' +
        'server half is already proven in data-plane-http.test.ts and get-run.test.ts; ' +
        'what is unproven is that the thing calling it never reaches for a tenant at ' +
        `all. ${read.reason}`)
    }

    const sent = read.value.sent
    assert.ok(sent.length > 0,
      'the client issued no request through `fetch`. Either it did not reach the plane at ' +
      'all — in which case assertion 3 is passing on something other than HTTP — or it ' +
      'reached the network by a route this test cannot inspect, and invariant 1 is ' +
      'unwitnessed on the wire the client actually wrote.')

    for (const req of sent) {
      const leaks = tenantLeaks(req, ACME)
      assert.deepEqual(leaks, [],
        'THE CLIENT PUT A TENANT ON THE WIRE. "Tenant scope is derived from the session, ' +
        'never read from a request" — invariant 1, and the client is the half of it no ' +
        'server-side assertion can reach: the plane\'s querystring schema is ' +
        '`additionalProperties: false`, so a client appending `?tenantId=` is REFUSED ' +
        'rather than obeyed and every existing test stays green while the client is ' +
        'wrong. THE SESSION CREDENTIAL IS THE ONE EXCLUSION — the tenant is derived from ' +
        'it, which is the design. What is scanned is the host, the path, every query key ' +
        'and value, the values concatenated, every other header and the body, each also ' +
        'decoded from base64url and hex; what is NOT reachable is a tenant under an ' +
        'encoding `decoded()` does not know. That bound is stated rather than implied — ' +
        'the earlier version of this sentence claimed "everything else" while `url.host` ' +
        `was never read at all. Leaks: ${JSON.stringify(leaks)}. Request: ${req.method} ${req.url} ` +
        `headers=${JSON.stringify(req.headers)} body=${JSON.stringify(req.body)}`)

      assert.equal(req.body, null,
        'the client sent a BODY on a read. Every operation this plane serves is a GET, ' +
        'and `server/contract/routes.ts` registers no body schema at all — "THERE IS NO ' +
        '`body` KEY, AND ITS ABSENCE IS NOT AN OVERSIGHT" — so a body reaches no validator ' +
        `on the way in. Saw: ${JSON.stringify(req.body)}`)
    }
  })

  // ────────────────────────────────────────────────────────────────────────
  it('5 · `completeness: null` survives the client — it is not turned into `[]` and not dropped', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)
    const read = await readAs(s.value.acmeToken)
    if (!read.ok) {
      assert.fail(
        'THE null/[] DISTINCTION IS UNWITNESSED IN THE CLIENT, because there is no ' +
        `client. ${read.reason}`)
    }

    const items = Array.isArray(read.value.page?.items) ? read.value.page.items : []
    assert.ok(items.length > 0, 'the client returned no items to inspect')

    for (const item of items) {
      assert.ok(typeof item === 'object' && item !== null, `a non-object item: ${JSON.stringify(item)}`)
      const run = item as Record<string, unknown>
      assert.ok('completeness' in run,
        'the client DROPPED `completeness`. It is `required` on `Run` and `Run` is ' +
        '`additionalProperties: false`, so a client that omits it has parsed the body into ' +
        'something the contract does not describe — and the register then has no way to ' +
        `tell an unaccounted run from an accounted one. Saw keys: ${JSON.stringify(Object.keys(run))}`)
      assert.equal(run['completeness'], null,
        'the client turned the UNKNOWN into the EMPTY. `server/data-plane/runs.ts` is ' +
        'explicit: "`[]` the ENGINE ran and observed no shortfall; `null` THIS PLANE HOLDS ' +
        'NO ENGINE ACCOUNT FOR THIS RUN AT ALL", and every row this plane can serve is ' +
        '`null` because nothing persists a `SetReconciliationResult`. A client that ' +
        'defaults it to `[]` — which is what `?? []` does, and what every convenience ' +
        'helper does — fabricates a clean close for a run the engine never touched, and ' +
        'on the `incomplete` row it fabricates a self-contradiction, because ' +
        '`terminalRunStatus()` derives `incomplete` FROM a non-empty completeness ' +
        `channel. Saw: ${JSON.stringify(run['completeness'])} on \`${String(run['runId'])}\``)
    }

    const incomplete = items.filter((i) =>
      typeof i === 'object' && i !== null && (i as { status?: unknown }).status === 'incomplete')
    assert.equal(incomplete.length, 1,
      'the client did not carry the `incomplete` status through. G153 requires an ' +
      '`incomplete` run to read differently from a `completed` one, and a status the ' +
      'client normalises away cannot be drawn differently by anything downstream. ' +
      `Saw: ${JSON.stringify(items.map((i) => (i as { status?: unknown }).status))}`)
  })

  // ────────────────────────────────────────────────────────────────────────
  /**
   * 7 · `getRun` IS CONSUMED, AND ITS REQUEST HOLDS THE SAME THREE PROPERTIES.
   *
   * 🛑 EVERY PROPERTY IS RE-ASSERTED RATHER THAN INFERRED FROM `fetchRuns`. The
   * two functions share `endpoint()` and `readJson()` today and a reader can see
   * that they do — which is precisely the reasoning that let a two-request wire
   * transcript be published against a one-request test. `fetchRun` is the one
   * that interpolates a value into the PATH, so it is the one where a leak has
   * somewhere new to go.
   */
  it('7 · the client reads ONE run over HTTP — no tenant on the wire, `completeness` intact', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)
    const read = await readOneAs(s.value.acmeToken, ACME_INCOMPLETE)
    if (!read.ok) {
      assert.fail(
        '`getRun` IS UNWITNESSED IN THE CLIENT. It is one of the four operations this plane ' +
        'serves, the register names a run it cannot open, and a drill-down nothing measures ' +
        `is a drill-down nothing knows the shape of. ${read.reason}`)
    }

    assert.equal(read.value.run['runId'], ACME_INCOMPLETE,
      `\`fetchRun\` returned a different run than the one asked for. Saw: ` +
      `${JSON.stringify(read.value.run['runId'])}`)
    assert.equal(read.value.run['status'], 'incomplete',
      'the client normalised the status on the single-run read. `getRun` and `listRuns` ' +
      'select ONE column list in `server/data-plane/runs.ts`, so the two reads cannot ' +
      'disagree at the server — a disagreement here is the client inventing one.')

    assert.ok('completeness' in read.value.run,
      '`fetchRun` DROPPED `completeness`. It is `required` on `Run`, and the drill-down ' +
      'panel is the surface whose whole job is to say what the engine accounted for.')
    assert.equal(read.value.run['completeness'], null,
      'the single-run read turned the UNKNOWN into the EMPTY. Same distinction as ' +
      'assertion 5, on the operation that draws it in the most detail. ' +
      `Saw: ${JSON.stringify(read.value.run['completeness'])}`)

    const sent = read.value.sent
    assert.equal(sent.length, 1,
      `\`fetchRun\` issued ${sent.length} requests. One read is one request; anything else ` +
      `is a route this assertion is not inspecting. Sent: ${JSON.stringify(sent.map((r) => r.url))}`)
    for (const req of sent) {
      assert.deepEqual(tenantLeaks(req, ACME), [],
        'THE SINGLE-RUN READ PUT A TENANT ON THE WIRE. This is the request with an ' +
        'interpolated PATH segment, so it is the one where a tenant has a new place to ' +
        `travel. Request: ${req.method} ${req.url} headers=${JSON.stringify(req.headers)}`)
      assert.equal(req.body, null, 'the single-run read sent a BODY')
    }
    assert.ok(sent[0]?.url.endsWith(`/v1/runs/${ACME_INCOMPLETE}`),
      'the single-run read did not address `/v1/runs/{runId}`. ' +
      `Saw: ${JSON.stringify(sent[0]?.url)}`)
  })

  // ────────────────────────────────────────────────────────────────────────
  /**
   * 8 · A RUN ID IS PATH-ENCODED — the register hands `fetchRun` a value it drew,
   *     and a value it drew came from the database.
   *
   * G97 puts NO format constraint on a branded id in the database — "the database
   * enforces no id format" — so an id carrying `/` or `?` is a row away, and an
   * unencoded interpolation would let it RE-ADDRESS the request.
   */
  it('8 · a hostile `runId` cannot re-address the request or add a query', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)
    const client = await loadFetchRun()
    if (!client.ok) assert.fail(client.reason)

    const hostile = `../../v1/runs?tenantId=${GLOBEX}&x=`
    const { sent } = await capture(async () => {
      await client.value({ origin: s.value.server.url, runId: hostile })
        .catch(() => undefined)
    })

    assert.equal(sent.length, 1, `expected one recorded request, saw ${sent.length}`)
    const url = new URL(sent[0]?.url ?? 'http://invalid.invalid')
    assert.equal(url.search, '',
      'a `runId` added a QUERY to the request. It is interpolated into the path, so an ' +
      'unencoded one re-addresses the read — and the value that reached it here names ' +
      `another tenant. Saw: ${JSON.stringify(sent[0]?.url)}`)
    assert.ok(url.pathname.startsWith('/v1/runs/'),
      'a `runId` walked OUT of `/v1/runs/`. `encodeURIComponent` is what keeps a path ' +
      `segment a path segment. Saw: ${JSON.stringify(url.pathname)}`)
    assert.equal(url.pathname.split('/').length, 4,
      'the encoded `runId` produced more than one path segment, so the value is still ' +
      `steering the address rather than naming a row. Saw: ${JSON.stringify(url.pathname)}`)

    /* 🛑 `tenantLeaks` IS DELIBERATELY NOT APPLIED HERE, AND THE REASON IS WORTH
       MORE THAN THE ASSERTION WOULD BE. The hostile value CONTAINS `ten_globex`,
       so the inspector would report a leak — correctly, by its own rule, and
       misleadingly: the slug is on the wire because the CALLER put it in the run
       id, not because the client reached for a tenant. The inspector cannot tell
       a tenant the client named from a tenant somebody spelled inside an id, and
       pretending otherwise here would make assertion 4's meaning depend on what
       a caller happens to pass. What is asserted instead is the property that is
       actually the client's: the value cannot re-address the request. */
  })
})

// ──────────────────────────────────────────────────────────────────────────
/**
 * 6 · A HOSTILE `origin` CANNOT PUT A TENANT ON THE WIRE, AND CANNOT REDIRECT
 *     THE SESSION TOKEN.
 *
 * 🛑 NEEDS NO DATABASE AND NO PLANE, SO IT IS NOT SKIPPED. Every assertion here
 * is a property of URL construction and of an allowlist. Assertion 4 above builds
 * its request from a WELL-FORMED origin and therefore cannot see either defect —
 * the client's own header claimed "a client cannot put on the wire a value it was
 * never given" while both were live, which is the divergence between a claim and
 * its coverage that this block closes.
 *
 * ⚠️ BOTH DEFECTS WERE REAL AND BOTH WERE MEASURED BEFORE THE REPAIR:
 *
 *   `origin = 'http://127.0.0.1:8080/v1/runs?tenantId=ten_globex&pad='`
 *     → GET http://127.0.0.1:8080/v1/runs?tenantId=ten_globex&pad=/v1/runs
 *   `origin = 'https://evil.example'` (reachable via `?plane=`)
 *     → GET https://evil.example/v1/runs   with `x-session: <live token>`
 *
 * The plane refused the first, which means tenant isolation was being held BY
 * THE SERVER — the inverse of what the client claimed. The second was never the
 * plane's to refuse at all.
 */
describe('6 · a hostile plane origin — no tenant on the wire, no token to a stranger', () => {
  /** The exact value that produced a correctly-addressed request with a tenant in it. */
  const SMUGGLING_ORIGIN = `http://127.0.0.1:1/v1/runs?tenantId=${GLOBEX}&pad=`

  it('an `origin` carrying a QUERY is refused — it is not obeyed and not silently stripped', async () => {
    const client = await loadFetchRuns()
    if (!client.ok) assert.fail(client.reason)

    const { sent } = await capture(async () => {
      await assert.rejects(
        () => client.value({ origin: SMUGGLING_ORIGIN }),
        /query or a fragment/,
        'the client accepted a plane origin carrying a query string. That value produces ' +
        '`GET http://127.0.0.1:1/v1/runs?tenantId=…&pad=/v1/runs` under string ' +
        'concatenation — the right endpoint with a TENANT IN THE QUERY — and `main.tsx` ' +
        'derives `origin` from `?plane=`, so it arrives in a link. Invariant 1: scope is ' +
        'derived from the session, NEVER read from a request.',
      )
    })

    assert.deepEqual(sent, [],
      'the client issued a request anyway. A refused origin must produce NO request at ' +
      `all — anything else sends the session token somewhere. Sent: ${JSON.stringify(sent)}`)
  })

  it('an `origin` carrying a FRAGMENT is refused, and a non-URL origin is refused', async () => {
    const client = await loadFetchRuns()
    if (!client.ok) assert.fail(client.reason)
    await assert.rejects(
      () => client.value({ origin: 'http://127.0.0.1:1#tenantId=ten_globex' }),
      /query or a fragment/,
      'a fragment on the origin was accepted. It is the same smuggling shape as a query ' +
      'and is refused for the same reason.')
    await assert.rejects(
      () => client.value({ origin: 'not a url' }),
      /not a URL/,
      'a non-URL origin was accepted. The origin is the DESTINATION OF THE SESSION ' +
      'TOKEN, so it is parsed rather than pasted.')
  })

  it('a PATH on the origin is dropped — the endpoint is resolved, never concatenated', async () => {
    const client = await loadFetchRuns()
    if (!client.ok) assert.fail(client.reason)

    /* Port 1 refuses the connection, which is fine: the request is RECORDED by
       `capture` before it fails, and the recorded URL is the property. */
    const { sent } = await capture(async () => {
      await client.value({ origin: 'http://127.0.0.1:1/some/prefix' })
        .catch(() => undefined)
    })

    assert.equal(sent.length, 1, `expected exactly one recorded request, saw ${sent.length}`)
    assert.equal(sent[0]?.url, 'http://127.0.0.1:1/v1/runs',
      'the endpoint was built by CONCATENATION rather than resolved against the origin. ' +
      '`capability.openapi.yaml` → `servers[0].url` is `https://{dataPlaneHost}/v1`: the ' +
      'host is configuration and the `/v1` prefix is not, so a path on the origin is not ' +
      `the client's to honour. Saw: ${JSON.stringify(sent[0]?.url)}`)
    assert.deepEqual(tenantLeaks(sent[0] as Outgoing, GLOBEX), [],
      'the recorded request names a tenant')
  })

  it('`?plane=` ALLOWLISTS the destination — a stranger never receives the session token', async () => {
    const plane = await loadPlaneFrom()
    if (!plane.ok) assert.fail(plane.reason)

    const evil = plane.value('?plane=https://evil.example')
    assert.equal(evil.origin, 'http://127.0.0.1:8080',
      'AN ARBITRARY ORIGIN WAS ACCEPTED AS THE PLANE. `fetchRuns` attaches ' +
      '`X-Session: <token>` to whatever host this resolves to, so one crafted link — ' +
      '`…/?plane=https://evil.example` — exfiltrates a live session from any tab that ' +
      'holds one, with no user interaction: the token sits in `sessionStorage` under a ' +
      `fixed key and the read fires on mount. Saw: ${JSON.stringify(evil.origin)}`)
    assert.notEqual(evil.refused, null,
      'the hostile plane was refused SILENTLY. A guard that substitutes a default without ' +
      'saying so reads, from the outside, as a parameter that does not work — and the next ' +
      'person "fixes" it by deleting the guard.')

    /* A near-miss a `startsWith` or a host comparison would accept. */
    for (const near of [
      '?plane=http://127.0.0.1:8080.evil.test',
      '?plane=https://127.0.0.1:8080',
      '?plane=http://127.0.0.1:9999',
      `?plane=http://127.0.0.1:8080/v1/runs?tenantId=${GLOBEX}`,
    ]) {
      const got = plane.value(near)
      assert.equal(got.origin, 'http://127.0.0.1:8080',
        `\`${near}\` was accepted as a plane origin. It is compared as a PARSED ORIGIN — ` +
        'scheme, host and port — precisely so a different host wearing a permitted prefix, ' +
        'a different scheme and a different port are each a different destination. ' +
        `Saw: ${JSON.stringify(got.origin)}`)
      assert.notEqual(got.refused, null, `\`${near}\` was refused silently`)
    }
  })

  /**
   * 🛑 A REDIRECT IS AN ORIGIN CHANGE THE ALLOWLIST NEVER SAW.
   *
   * ⚠️ MEASURED BEFORE THE REPAIR AND IT IS THE REASON THIS TEST EXISTS: two
   * loopback servers, A answering `302` to B, `fetchRuns({origin: A, session:
   * 'LIVE-SESSION-TOKEN'})` — and **B logged `x-session: LIVE-SESSION-TOKEN`**,
   * with the client returning B's body as if it were the plane's. Fetch strips
   * `Authorization`, `Cookie` and `Proxy-Authorization` across an origin change
   * and nothing else; `X-Session` is a custom header, in node and in a browser
   * alike.
   *
   * The precondition is stronger than the `?plane=` hole this PR closed — it
   * needs control of the RESPONSE from a permitted origin — which makes it a
   * smaller finding and not a smaller property. `frontend/src/api/plane.ts` is
   * titled "WHERE THE SESSION TOKEN MAY BE SENT" and the assertion above says "a
   * stranger never receives the session token"; neither was true of a hop.
   */
  describe('a redirect never carries the session token to a second origin', () => {
    const TOKEN = 'LIVE-SESSION-TOKEN'
    let a: Server | undefined
    let b: Server | undefined
    let bSaw: (string | undefined)[] = []
    let bUrl = ''

    const listen = async (s: Server): Promise<string> => {
      await new Promise<void>((res) => s.listen(0, '127.0.0.1', res))
      const addr = s.address() as AddressInfo
      return `http://127.0.0.1:${addr.port}`
    }

    before(async () => {
      b = createServer((req, res) => {
        /* BOTH channels. The header is the local-test one and the cookie is
           the production one (G386); a stranger receiving either is the
           finding, and recording only one would make this suite blind to the
           channel the product actually uses. */
        bSaw.push((req.headers['x-session'] ?? req.headers['cookie']) as string | undefined)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ items: [{ runId: 'run_from_the_stranger' }], nextCursor: null }))
      })
      bUrl = await listen(b)
      a = createServer((_req, res) => {
        res.writeHead(302, { location: `${bUrl}/v1/runs` })
        res.end()
      })
    })

    after(async () => {
      for (const s of [a, b]) if (s !== undefined) await new Promise<void>((r) => s.close(() => r()))
    })

    it('BASE CONTROL — the second server DOES record an `X-Session` it is sent directly', async () => {
      bSaw = []
      await fetch(`${bUrl}/v1/runs`, { headers: { 'X-Session': TOKEN } })
      assert.deepEqual(bSaw, [TOKEN],
        'the stranger server records nothing even when handed the token directly, so the ' +
        'assertion below would pass against a broken recorder rather than against a client ' +
        'that refuses to redirect. That is docs/HANDOFF.md §5.6 — a check that passes while ' +
        `asserting nothing. Saw: ${JSON.stringify(bSaw)}`)
    })

    it('the client REFUSES to follow a redirect, and the stranger receives nothing', async () => {
      const client = await loadFetchRuns()
      if (!client.ok) assert.fail(client.reason)
      const aUrl = await listen(a as Server)

      bSaw = []
      /* ⚠️ THE CALL IS MADE FIRST AND JUDGED AFTER, ON PURPOSE. An
         `assert.rejects` wrapped around it fails BEFORE the leak assertion runs,
         so a reverted repair reports "missing expected rejection" — true, and
         the weaker of the two facts. Measured this way the same revert reports
         THE TOKEN ARRIVING AT THE STRANGER, which is the finding.

         🛑 THE CREDENTIAL IS DELIVERED BY THE JAR, PINNED TO `aUrl` — G386. It
         is what a browser would do: attach the cookie to the permitted origin
         and to nothing else. So there are now TWO independent reasons the
         stranger must see nothing, and the assertion below cannot tell them
         apart, which is stated rather than hidden: the jar does not attach
         cross-origin, AND Fetch strips `Cookie` across an origin change even
         when a caller sets it by hand. The header-era leak this suite measured
         is therefore structurally closed; what `redirect: 'error'` still buys
         is the SECOND assertion. */
      let resolved: unknown
      let rejected = false
      try {
        resolved = await capture(
          () => client.value({ origin: aUrl }),
          { origin: aUrl, handle: TOKEN },
        ).then((r) => r.result)
      } catch {
        rejected = true
      }

      assert.deepEqual(bSaw, [],
        `THE SESSION TOKEN REACHED A SECOND ORIGIN. \`${bUrl}\` is not in ` +
        '`PERMITTED_ORIGINS` and was never asked for — it was named by a `Location:` header ' +
        'from a server the allowlist did permit. Fetch strips `Authorization`, `Cookie` and ' +
        '`Proxy-Authorization` across an origin change and NOT a custom header. ' +
        `Saw at the stranger: ${JSON.stringify(bSaw)}`)

      assert.ok(rejected,
        'the client FOLLOWED a redirect and RESOLVED. `redirect: \'error\'` is the whole ' +
        'repair: it rejects rather than chasing the `Location`. Resolving means the ' +
        'register would have drawn a stranger\'s rows as the plane\'s answer — the body ' +
        `above came from ${bUrl}. Saw: ${JSON.stringify(resolved)}`)
    })
  })

  it('NEGATIVE — the permitted local planes are accepted, and refuse nothing', async () => {
    const plane = await loadPlaneFrom()
    if (!plane.ok) assert.fail(plane.reason)

    for (const [search, expected] of [
      ['', 'http://127.0.0.1:8080'],
      ['?plane=http://localhost:8080', 'http://localhost:8080'],
      ['?plane=http://127.0.0.1:8080/', 'http://127.0.0.1:8080'],
    ] as const) {
      const got = plane.value(search)
      assert.equal(got.origin, expected,
        `\`${search}\` did not resolve to \`${expected}\`. A guard that refuses the ` +
        'permitted local plane is red against the design rather than against an attacker, ' +
        'and makes `npm run dev:frontend` unusable.')
      assert.equal(got.refused, null,
        `\`${search}\` was reported as refused when it is permitted. A false refusal in ` +
        'the plane word is as misleading as a missing one.')
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
/**
 * 8a · G991 — THE DEPLOYED BUNDLE'S PLANE IS THE PAGE'S OWN ORIGIN.
 *
 * 🛑 WHAT THIS IS DEFENDING, AND IT WAS LIVE UNTIL 20 Sep 2026.
 * `DEFAULT_ORIGIN` was the literal `'http://127.0.0.1:8080'`, so the bundle
 * CloudFront serves from `https://<tenant>.us-west-2.reconcileai.app` asked the
 * OPERATOR'S OWN LAPTOP for the register. `docs/build/deploy-handoff.md` §5.4
 * names it — *"`frontend/` does not know its own origin"* — and G293's whole
 * arrangement is that the data plane is a SECOND ORIGIN on the SAME
 * distribution behind `/v1/*`, so the page's own origin IS the plane.
 *
 * 🛑 AND THE OBVIOUS FIX IS REFUSED BY THE CODE ONE MODULE OVER, WHICH IS WHY
 * THE FIRST ASSERTION HERE IS ABOUT A THROW. §5.4 says *"make the default
 * relative"*; `planeEndpoint()` does `new URL(origin)` and refuses anything
 * that is not a URL, so `'/v1'`, `'/'` and `''` all throw. The page's origin,
 * spelled absolutely, is the relative answer that parses.
 *
 * ⚠️ IT IS DRIVEN THROUGH `permittedPageOrigin()` AND NOT THROUGH `location`,
 * for a reason the function's own header gives: node has no `location` to set,
 * and the one browser-driven suite serves the page on `127.0.0.1:8080`, which
 * is EXACTLY the node fallback — so a real browser cannot tell the new
 * behaviour from the old one, and `"null"` on a `file://` document cannot be
 * produced from either. The decision is a pure function; this asks it
 * everything.
 */
it('8a · the plane origin is the page`s own origin, and the relative spellings are refused', async () => {
  const dynamic: (s: string) => Promise<unknown> = (s) => import(s)
  const mod = (await dynamic(PLANE)) as Record<string, unknown>

  const decide = mod['permittedPageOrigin']
  assert.equal(
    typeof decide,
    'function',
    '`frontend/src/api/plane.ts` exports no `permittedPageOrigin`. The page-origin ' +
      'decision must be a pure function, or nothing here can witness it.',
  )
  const page = decide as (raw: unknown) => string | null

  /* §1 · THE DEPLOYED SHAPES ARE ACCEPTED, VERBATIM. */
  for (const [raw, expected] of [
    ['https://ten-acme.us-west-2.reconcileai.app', 'https://ten-acme.us-west-2.reconcileai.app'],
    ['https://console.reconcileai.app', 'https://console.reconcileai.app'],
    ['http://localhost:5173', 'http://localhost:5173'],
    ['http://127.0.0.1:8080', 'http://127.0.0.1:8080'],
  ] as const) {
    assert.equal(
      page(raw),
      expected,
      `${raw} was not accepted as the page's own origin. The deployed bundle would ` +
        'then fall back to the local plane and ask the operator`s own laptop for the ' +
        'register, which is the defect G991 closes.',
    )
  }

  /* §2 · THE OPAQUE AND NON-HTTP ORIGINS ARE REFUSED — and `"null"` is a real
     string a real browser produces, on any `file://` document, which
     `tests/design/` loads on every run. */
  for (const raw of ['null', '', 'file://', 'blob:https://x.example/abc', 'data:,x', undefined, null, 7]) {
    assert.equal(
      page(raw),
      null,
      `${JSON.stringify(raw)} was accepted as a plane origin. It reaches ` +
        '`planeEndpoint()`, which does `new URL(origin)` — an opaque or non-HTTP ' +
        'origin is a throw at the first read, not a fallback.',
    )
  }

  /* §3 · NO `location` AT ALL — the node case, which is every test in this
     repository and `npm run dev:plane`'s own world. The fallback must be the
     local plane, spelled absolutely. */
  const local = mod['LOCAL_PLANE_ORIGIN']
  assert.equal(local, 'http://127.0.0.1:8080', 'the local fallback moved; `npm run dev:plane` and the Vite proxy target this port (tests/e2e/single-origin.ts no longer does — G3911)')
  assert.equal(
    mod['DEFAULT_ORIGIN'],
    local,
    'under node, with no `location`, DEFAULT_ORIGIN must be the local plane. If ' +
      'this is anything else, either a browser global leaked into the gate or the ' +
      'fallback changed and `npm run dev:frontend` stopped working.',
  )

  /* §4 · AND THE RELATIVE SPELLINGS §5.4 ASKS FOR ARE REFUSED WHERE THE URL IS
     BUILT. This is the measurement that makes the divergence from the ruling`s
     literal words defensible rather than silent. */
  const runs = (await dynamic('../../frontend/src/api/runs.ts')) as Record<string, unknown>
  const endpoint = runs['planeEndpoint'] as (origin: string, path: string) => URL
  assert.equal(typeof endpoint, 'function', '`planeEndpoint` is not exported')
  for (const relative of ['/v1', '/', '']) {
    assert.throws(
      () => endpoint(relative, '/runs'),
      /not a URL/,
      `\`${relative}\` did not throw. If a bare relative origin now parses, the ` +
        'page-origin machinery above is unnecessary and should be deleted rather ' +
        'than kept for a reason that stopped being true.',
    )
  }
  assert.equal(
    endpoint('https://ten-acme.us-west-2.reconcileai.app', '/runs').toString(),
    'https://ten-acme.us-west-2.reconcileai.app/v1/runs',
    'the page`s own origin must resolve to the same-origin `/v1` path CloudFront routes',
  )
})

// ──────────────────────────────────────────────────────────────────────────
/**
 * 9 · THE COMPLETENESS VOCABULARY — one fact, one set of words, one module.
 *
 * ┌─ 🛑 WHY THIS IS HERE AND NOT IN tests/design/ ─────────────────────────────┐
 * │ Because the surface that got it wrong is one no rendered test can reach.    │
 * │                                                                            │
 * │ ⚠️ THE DRILL-DOWN PANEL DREW THE SAME FACT IN A SECOND VOCABULARY. It lived │
 * │ in `main.tsx`, rendered `completeness: []` as `${length} accounted` —       │
 * │ **"0 accounted"** — while the register rendered the identical value as      │
 * │ "engine observed no shortfall", and it carried no `data-completeness` at    │
 * │ all. So the addressable-cell repair that assertion 5 rests on STOPPED AT    │
 * │ THE TABLE, and nothing in this repository could see past it: `main.tsx` is  │
 * │ JSX, node does not transform JSX, and the built page carries no opened run. │
 * │                                                                            │
 * │ Two surfaces, one fact, two words, and "0 accounted" is the one that reads  │
 * │ like a clean close. The repair is structural — one module, imported by      │
 * │ both — and this block is what witnesses the module, which is the half a     │
 * │ node test CAN hold.                                                        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 NO DATABASE AND NO BROWSER, SO IT IS NEVER SKIPPED.
 */
describe('9 · the completeness vocabulary is one vocabulary', () => {
  const VOCAB = '../../frontend/src/completeness.ts'

  interface Vocab {
    readonly completenessKind: (c: readonly unknown[] | null) => string
    readonly completenessWord: (c: readonly unknown[] | null) => string
    readonly COMPLETENESS_KINDS: readonly string[]
  }

  async function loadVocab(): Promise<Attempt<Vocab>> {
    const dynamic: (s: string) => Promise<unknown> = (s) => import(s)
    let mod: Record<string, unknown>
    try {
      mod = (await dynamic(VOCAB)) as Record<string, unknown>
    } catch (err) {
      return {
        ok: false,
        reason:
          '`frontend/src/completeness.ts` did not load — ' + why(err) + '. The three ' +
          'readings of `completeness` have to live in a module a test can reach: a private ' +
          'helper inside a `.tsx` is one a second surface cannot import and therefore ' +
          'copies, which is exactly what happened.',
      }
    }
    for (const k of ['completenessKind', 'completenessWord']) {
      if (typeof mod[k] !== 'function') {
        return { ok: false, reason: `\`frontend/src/completeness.ts\` exports no \`${k}\`` }
      }
    }
    return { ok: true, value: mod as unknown as Vocab }
  }

  it('the three answers are three, and each is named', async () => {
    const v = await loadVocab()
    if (!v.ok) assert.fail(v.reason)
    assert.deepEqual([...v.value.COMPLETENESS_KINDS], ['absent', 'empty', 'accounted'],
      '`completeness` is `readonly CompletenessFinding[] | null` and has exactly three ' +
      'readings. A fourth means the register and the wire have drifted apart.')
    assert.equal(v.value.completenessKind(null), 'absent',
      '`null` is THIS PLANE HOLDS NO ENGINE ACCOUNT — `server/data-plane/runs.ts`')
    assert.equal(v.value.completenessKind([]), 'empty',
      '`[]` is the ENGINE RAN AND OBSERVED NO SHORTFALL, which is a different fact from ' +
      '`null` and not a tidier spelling of it')
    assert.equal(v.value.completenessKind([{ kind: 'missing_document' }]), 'accounted')
  })

  it('`[]` DOES NOT render as a count — "0 accounted" is the defect this module ended', async () => {
    const v = await loadVocab()
    if (!v.ok) assert.fail(v.reason)
    const empty = v.value.completenessWord([])
    assert.ok(!/^\s*0\b/.test(empty),
      'the empty channel renders as a NUMBER. The drill-down panel drew exactly this — ' +
      `"0 accounted" — where the register said "engine observed no shortfall". A tally that ` +
      'came out zero reads as a close that came out clean; "the engine ran and observed no ' +
      `shortfall" is the claim the value actually supports. Saw: ${JSON.stringify(empty)}`)
    assert.ok(/shortfall|observed/i.test(empty),
      `the empty channel does not say the engine LOOKED. Saw: ${JSON.stringify(empty)}`)

    const absent = v.value.completenessWord(null)
    assert.ok(/no engine account/i.test(absent),
      `the absent channel does not name an absent account. Saw: ${JSON.stringify(absent)}`)
    assert.notEqual(absent, empty,
      'the absent account and the empty one render the SAME WORDS. `null` and `[]` mean ' +
      'different things and a vocabulary that collapses them destroys the distinction ' +
      'before any surface can draw it — which is the whole of G153 in this column.')

    /* The clean-close vocabulary tests/design/shell.test.ts refuses, applied to the
       module rather than to the page. The two files must refuse the same phrases or
       the register and the panel are held to different standards. */
    const CLEAN_CLOSE =
      /\bno findings\b|\bnothing (missing|outstanding|to reconcile)\b|\bnone outstanding\b|\b0 findings\b|\bfully reconciled\b|\bclean close\b/i
    assert.ok(!CLEAN_CLOSE.test(absent),
      `the absent account reports a CLEAN CLOSE: ${JSON.stringify(absent)}`)
    assert.ok(!CLEAN_CLOSE.test(empty),
      `the empty channel reports a CLEAN CLOSE: ${JSON.stringify(empty)}`)
  })

  it('no other frontend module spells the vocabulary for itself', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const { join, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'src')

    const files: string[] = []
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.tsx?$/.test(e.name) && e.name !== 'completeness.ts') files.push(p)
      }
    }
    walk(root)

    /* Comments are stripped first, because this record ARGUES about these
       phrases at length and a scan that could not tell prose from code would be
       unable to say why it exists. */
    const strip = (s: string): string =>
      s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')

    /* ⚠️ THE THIRD PATTERN IS THE DEFECT'S OWN SHAPE, NOT THE WORD "accounted".
       `runs.ts` says "cannot tell an unaccounted run from an accounted one" in a
       REFUSAL MESSAGE, which is prose about the distinction rather than a second
       rendering of it — and a scan that could not tell those apart would have to
       be silenced, which is how a control stops being one. What is banned is a
       LENGTH INTERPOLATED BESIDE THE WORD: `${run.completeness.length} accounted`
       is the line that shipped. */
    const banned: readonly [RegExp, string][] = [
      [/no engine account/, 'the absent-account sentence'],
      [/observed no shortfall/, 'the empty-channel sentence'],
      [/\$\{[^}]*\}\s*accounted/, 'a count rendered beside "accounted" — the "0 accounted" line'],
    ]

    const offenders: string[] = []
    for (const f of files) {
      const code = strip(readFileSync(f, 'utf8'))
      for (const [pattern, what] of banned) {
        if (pattern.test(code)) offenders.push(`${f.slice(root.length + 1)} spells ${what}`)
      }
    }

    assert.deepEqual(offenders, [],
      'A SECOND SURFACE SPELLS THE COMPLETENESS VOCABULARY FOR ITSELF, which is how the ' +
      'drill-down panel came to render `[]` as "0 accounted" while the register rendered it ' +
      'as "engine observed no shortfall". `frontend/src/completeness.ts` is the one module ' +
      'that holds these words; every surface imports `completenessKind` and ' +
      '`completenessWord` from it. ⚠️ THIS IS A SCAN OF SOURCE TEXT AND IT IS THEREFORE ' +
      'BOUNDED: it catches a copy, not a paraphrase — a panel that invented "nothing to ' +
      'report" would pass it. What it does hold is the shape that actually shipped. ' +
      `Saw: ${JSON.stringify(offenders)}`)
  })
})

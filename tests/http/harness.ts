/**
 * THE HTTP SEAM — DECLARED HERE, BUILT NOWHERE YET.
 *
 * 🛑 READ THIS BEFORE THE TESTS. Every test under `tests/http/` is RED at the
 * commit that introduces it, and it is red on purpose. There is no HTTP entry
 * point in this repository: no framework, no route, no listener. `package.json`
 * has two devDependencies and the repository is deliberate about that
 * (`db/pg.ts` explains why `pg` itself is not one of them).
 *
 * This file is therefore **the specification the slice must satisfy**, written
 * as the thing the tests call rather than as prose that drifts. It declares
 * three module paths and the shape of what each must export. Nothing more is
 * assumed about the implementation — not the framework, not the file layout
 * below those three paths, not the shape of the handlers.
 *
 * ┌─ THE SEAM ────────────────────────────────────────────────────────────────┐
 * │                                                                           │
 * │  server/data-plane/start.ts                                               │
 * │      export function startDataPlane(o: { poolMax: number })               │
 * │        : Promise<{ url: string; close(): Promise<void> }>                 │
 * │                                                                           │
 * │      Binds an EPHEMERAL port and returns its origin, so two data planes    │
 * │      can run in one test process. `poolMax` is passed straight to          │
 * │      `createAppPool()` (db/tenant-scope.ts) — the tests pass 1, which is   │
 * │      adversarial on purpose for the same reason `max: 1` is adversarial    │
 * │      in tests/db/tenant-isolation.test.ts.                                │
 * │                                                                           │
 * │  server/dev/test-token.ts                                                 │
 * │      export function mintTestToken(o: { tenantId: string;                 │
 * │                                         ttlSeconds?: number }): string    │
 * │                                                                           │
 * │  server/control-plane/config.ts                                           │
 * │      export function controlPlaneConfig(): unknown                        │
 * │  server/data-plane/config.ts                                              │
 * │      export function dataPlaneConfig(): unknown                           │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ WHY EVERY IMPORT HERE IS DYNAMIC AND NON-LITERAL.
 *
 * `npm test` is `typecheck:tests && node --test`, so a static
 * `import { startDataPlane } from '../../server/data-plane/start.ts'` would fail
 * `tsc -p tests/tsconfig.json` with TS2307 and take the WHOLE SUITE down before
 * a single test ran. The suite would then be red for a reason that has nothing
 * to do with tenancy, and the five existing db assertions would stop being run
 * at all. A dynamic import whose specifier is not a literal is not resolved by
 * TypeScript, so this file type-checks today and binds to the real modules the
 * moment they exist.
 *
 * ⚠️ AND WHY THE ABSENCE IS RETURNED RATHER THAN THROWN.
 *
 * A test that dies on `ERR_MODULE_NOT_FOUND` is red against a typo — the stack
 * says a file is missing and says nothing about the property that is
 * unwitnessed. Every function here returns a discriminated result carrying a
 * REASON, so each test can fail with its own sentence about its own invariant
 * and quote the cause underneath. That is the difference between "the module is
 * missing" and "invariant 1 is unwitnessed over HTTP, because nothing serves
 * HTTP".
 *
 * 🛑 WHAT THIS FILE MUST NEVER GROW: a fake server. A stub that answers 401 and
 * 200 would turn every assertion in this directory green while the property was
 * absent, which is the audit finding tests/db/tenant-isolation.test.ts exists to
 * answer, repeated one layer up. If the slice is not built, these tests fail.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * ⚠️ A STATIC IMPORT IN A FILE WHOSE HEADER ARGUES FOR DYNAMIC ONES, AND THE
 * DISTINCTION IS THE ONE THAT HEADER DRAWS. The dynamic-import rule is about
 * the SEAM — `server/` modules that did not exist when these tests were written
 * — so that a missing one is a REASON rather than a `TS2307` taking the whole
 * directory down. `model/` is not a seam: it has existed throughout, every
 * other suite imports it statically, and copying `DENY_ALL` out by hand here
 * would be a second copy of a safety value that can silently widen.
 */
import { CAPABILITIES, DENY_ALL } from '../../model/access.ts'

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/* ------------------------------------------------------------------ *
 * The wire constants the contracts already fix. Not invented here.
 * ------------------------------------------------------------------ */

/**
 * `capability.openapi.yaml` → `components.securitySchemes.sessionContext`:
 * `type: apiKey`, `in: header`, `name: X-Session`. The session is a header on
 * every capability-tier operation, and the token IS the session.
 */
export const SESSION_HEADER = 'X-Session'

/**
 * `capability.openapi.yaml` → `servers[0].url` is `https://{dataPlaneHost}/v1`.
 * The host is configuration; the `/v1` prefix is not.
 */
export const CAPABILITY_BASE = '/v1'

/**
 * RULING 2, 16 Aug 2026 — "a script mints a short-lived token the server accepts
 * ONLY when an explicit local flag is set."
 *
 * The flag is an environment variable and not a start-up option on purpose: a
 * deployed process is configured by its environment, so the flag that must be
 * absent in production is a thing that is absent from a compose file and an IAM
 * task definition, where its absence can be read. An option passed by a caller
 * is invisible to everything except the caller.
 *
 * Exactly `'1'`. Not "truthy" — `RECONCILE_LOCAL_TEST_AUTH=false` and
 * `=0` and `=no` must all REFUSE, and a truthiness check accepts every one of
 * them.
 */
export const LOCAL_TEST_AUTH_ENV = 'RECONCILE_LOCAL_TEST_AUTH'
export const LOCAL_TEST_AUTH_ON = '1'

/* ------------------------------------------------------------------ *
 * The seam.
 * ------------------------------------------------------------------ */

const SEAM = {
  dataPlaneStart: '../../server/data-plane/start.ts',
  dataPlaneConfig: '../../server/data-plane/config.ts',
  controlPlaneConfig: '../../server/control-plane/config.ts',
  testToken: '../../server/dev/test-token.ts',
} as const

export interface RunningServer {
  readonly url: string
  close(): Promise<void>
}

/**
 * Which of the four seam modules cannot be loaded, with the reason for each.
 *
 * Side-effect free on purpose — it opens no port and touches no database — so a
 * failing test can report EVERY missing piece rather than the first one its
 * set-up happened to trip over. An implementer reading "there is no `run` table"
 * would otherwise build a table and discover the listener afterwards.
 */
export async function missingSeams(): Promise<readonly string[]> {
  const wanted: ReadonlyArray<readonly [string, string]> = [
    [SEAM.dataPlaneStart, 'startDataPlane'],
    [SEAM.dataPlaneConfig, 'dataPlaneConfig'],
    [SEAM.controlPlaneConfig, 'controlPlaneConfig'],
    [SEAM.testToken, 'mintTestToken'],
  ]
  const out: string[] = []
  for (const [spec, name] of wanted) {
    const found = await loadExport(spec, name)
    if (!found.ok) out.push(found.reason)
  }
  return out
}

export type Attempt<T> =
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
 * Load one seam module. The specifier is held in a variable so TypeScript does
 * not resolve it — see the header.
 */
async function loadSeam(spec: string): Promise<Attempt<Record<string, unknown>>> {
  const dynamic: (s: string) => Promise<unknown> = (s) => import(s)
  try {
    const mod = await dynamic(spec)
    return { ok: true, value: mod as Record<string, unknown> }
  } catch (err) {
    return {
      ok: false,
      reason: `\`${spec.replace('../../', '')}\` did not load — ${why(err)}`,
    }
  }
}

async function loadExport(spec: string, name: string): Promise<Attempt<unknown>> {
  const mod = await loadSeam(spec)
  if (!mod.ok) return mod
  const value = mod.value[name]
  if (value === undefined) {
    return {
      ok: false,
      reason: `\`${spec.replace('../../', '')}\` exists but exports no \`${name}\``,
    }
  }
  return { ok: true, value }
}

/**
 * AN AUTHORISER THAT HOLDS EVERY VERB — AND READ WHAT IT DOES AND DOES NOT
 * PROVE BEFORE USING IT.
 *
 * 🛑 ADDED 19 Sep 2026, WITH G200's GATE, AND IT IS A DELIBERATE WEAKENING OF
 * EVERY SUITE THAT PASSES IT. The production authoriser refuses everything
 * (`server/data-plane/authorise.ts`: this repository resolves no subject, so no
 * capability can honestly be held), which means `listRuns` and `getRun` — the
 * two operations every database-backed suite here drives — answer 403 to every
 * caller on the served path.
 *
 * Those suites are about TENANT ISOLATION and THE ENGINE, not about the gate.
 * Against the default they would assert `403` over and over and prove nothing
 * about row-level security, which is the one thing they exist for. So each one
 * supplies this, and each one is thereby asserting a property of the read path
 * BEHIND the gate rather than of the served surface.
 *
 * ⚠️ WHAT IS THEREFORE UNWITNESSED BY THEM, STATED SO THE SILENCE IS NOT READ AS
 * COVERAGE: that a real caller reaches those rows at all. Nobody can, today.
 * `tests/http/capability-gate.test.ts` is where the gate itself is witnessed,
 * including the refusal the production authoriser actually gives.
 */
export function allowEveryCapability(): 'held' {
  return 'held'
}

/* ------------------------------------------------------------------ *
 * THE FIXTURE PRINCIPAL — G301's COMPANION TO `allowEveryCapability`.
 * ------------------------------------------------------------------ */

/**
 * 🛑 WHY THIS HAD TO EXIST, AND IT IS A CONSEQUENCE OF G301 RATHER THAN A
 * CONVENIENCE.
 *
 * Until 19 Sep 2026 a handler needed no principal: the gate asked `decide()`
 * and the handler read rows. **G301 makes the handler MINT invariant 10's
 * record**, and a mint needs a principal — so `allowEveryCapability` alone is
 * no longer enough to get a database-backed suite behind the gate. Those suites
 * authenticate with the LOCAL TEST TOKEN, whose session resolves no subject at
 * all (`server/data-plane/session.ts`: the local-test arm has no row, so
 * `principal` is structurally `null`), and a minting handler handed that
 * session has nobody to mint for.
 *
 * ⚠️ THE HONEST ALTERNATIVE WAS CONSIDERED AND IS NAMED: make every one of those
 * suites seed a real `user`, `identity_connection`, `role`, `role_assignment`
 * and `session` row and drop the dev token, as
 * `tests/http/identity-substrate-served.test.ts` does. That is the RIGHT shape
 * and it is a rewrite of five suites that are about tenant isolation and the
 * engine, not about identity — so it is owed rather than done, and it is named
 * here so the debt is not invisible.
 *
 * 🛑 THIS CANNOT MAKE A PLANE PERMISSIVE, WHICH IS WHY IT IS SAFE TO HAVE. The
 * verdict still comes from `authorize()` → `decide()`, the single evaluator; a
 * fixture substrate is *"lying to the evaluator rather than replacing it"*. A
 * role carrying no capabilities still yields a 403 through this seam, and
 * `server/data-plane/start.ts` admits it on the EPHEMERAL-PORT entry point
 * only — `listenDataPlane()` has no such parameter and never will.
 *
 * ⚠️ THE CAST IS NAMED, because a cast of shape is not a check of content.
 * `Role` and `RoleAssignment` carry fields no fixture needs and `decide()` reads
 * only the ones set below; the cast asserts the SHAPE the evaluator reads and
 * nothing about the rest. `tests/http/capability-decide.test.ts` makes the same
 * cast for the same reason and says so at the same length.
 */
export function fixtureSubstrate(
  opts: { userId?: string; capabilities?: readonly string[] } = {},
): (session: { readonly tenantId: string | null }) => unknown {
  const userId = opts.userId ?? 'usr_fixture'
  /**
   * ⚠️ THE DEFAULT IS EVERY CAPABILITY IN THE CLOSED SET, WHICH IS THE
   * SUBSTRATE COUNTERPART OF `allowEveryCapability` AND IS AS BROAD AS THAT
   * FUNCTION ALREADY IS. It is DERIVED from `CAPABILITIES` rather than listed,
   * so a capability minted tomorrow is held by this fixture without anybody
   * editing it — the alternative is a list that goes one entry stale in the
   * wrong direction, which is the artefact `server/http/app.ts` refuses by name
   * for exempt routes.
   */
  const capabilities = opts.capabilities ?? (Object.values(CAPABILITIES) as readonly string[])
  return (session) => ({
    subject: { userId, status: 'active' },
    orgClass: 'customer',
    partnerId: null,
    partnerGrant: null,
    held: [
      {
        role: {
          tenantId: session.tenantId ?? '',
          id: 'rol_fixture',
          label: 'Fixture',
          key: 'fixture',
          version: 1,
          stakeholderClass: 'operator',
          origin: 'tenant',
          packId: null,
          capabilities: [...capabilities],
          defaultScope: DENY_ALL,
          status: 'active',
        },
        assignment: {
          tenantId: session.tenantId ?? '',
          id: 'ras_fixture',
          userId,
          roleId: 'rol_fixture',
          /** ⚠️ MATCHES `role.version`. `decide()` stops evaluating an
           * assignment whose pin has moved in EITHER direction, so a fixture
           * that got this wrong would refuse at `role_version_moved` and every
           * suite using it would be red for a reason it did not choose. */
          roleVersion: 1,
          scope: DENY_ALL,
          grantedBy: 'usr_fixture_admin',
          grantedAt: '2026-01-01T00:00:00.000Z',
          expiresAt: null,
          revokedAt: null,
        },
      },
    ],
    platformHeld: null,
  })
}


/**
 * Start a data plane on an ephemeral port.
 *
 * ⚠️ The returned server is NOT closed for you. Every caller closes it in an
 * `after` hook or a `finally`, because a leaked listener holds a pooled
 * PostgreSQL connection and the next test's `pg_stat_activity` assertion would
 * then see two backends and fail for the wrong reason.
 *
 * ⚠️ `authorise` IS FORWARDED, NOT DEFAULTED HERE. Leaving it out gives the
 * plane its production authoriser, which refuses every verb — so a suite that
 * omits it is asserting against a 403 whether it meant to or not. The seam
 * signature in this file's header gains one optional key and no other change.
 */
export async function startDataPlane(opts: {
  poolMax: number
  authorise?: () => 'held' | 'not_held'
  /**
   * ⚠️ FORWARDED, NOT DEFAULTED HERE, exactly like `authorise` — G301,
   * 19 Sep 2026. Omitting it gives the plane `substrateFromSession`, which
   * projects real rows; a suite driving the LOCAL TEST TOKEN resolves no
   * subject through that, so its gated handlers have nobody to mint invariant
   * 10's record for and answer 500. See `fixtureSubstrate()` above for why that
   * is the honest failure rather than a regression.
   */
  substrate?: (session: { readonly tenantId: string | null }) => unknown
}): Promise<Attempt<RunningServer>> {
  const found = await loadExport(SEAM.dataPlaneStart, 'startDataPlane')
  if (!found.ok) return found
  if (typeof found.value !== 'function') {
    return { ok: false, reason: '`server/data-plane/start.ts` exports `startDataPlane` but it is not a function' }
  }
  const start = found.value as (o: {
    poolMax: number
    authorise?: () => 'held' | 'not_held'
    substrate?: (session: { readonly tenantId: string | null }) => unknown
  }) => Promise<RunningServer>
  try {
    const server = await start(opts)
    if (typeof server?.url !== 'string' || typeof server?.close !== 'function') {
      return {
        ok: false,
        reason: '`startDataPlane()` resolved to something without a `url` string and a `close()`',
      }
    }
    return { ok: true, value: server }
  } catch (err) {
    return { ok: false, reason: `\`startDataPlane()\` threw — ${why(err)}` }
  }
}

/** RULING 2's minting half. Minting is always allowed; ACCEPTING is what the flag gates. */
export async function mintTestToken(opts: {
  tenantId: string
  ttlSeconds?: number
}): Promise<Attempt<string>> {
  const found = await loadExport(SEAM.testToken, 'mintTestToken')
  if (!found.ok) return found
  if (typeof found.value !== 'function') {
    return { ok: false, reason: '`server/dev/test-token.ts` exports `mintTestToken` but it is not a function' }
  }
  const mint = found.value as (o: { tenantId: string; ttlSeconds?: number }) => string
  try {
    const token = mint(opts)
    if (typeof token !== 'string' || token === '') {
      return { ok: false, reason: '`mintTestToken()` returned something that is not a non-empty string' }
    }
    return { ok: true, value: token }
  } catch (err) {
    return { ok: false, reason: `\`mintTestToken()\` threw — ${why(err)}` }
  }
}

/** Either plane's resolved configuration, for the structural assertions in plane-separation. */
export async function planeConfig(plane: 'control' | 'data'): Promise<Attempt<unknown>> {
  const spec = plane === 'control' ? SEAM.controlPlaneConfig : SEAM.dataPlaneConfig
  const name = plane === 'control' ? 'controlPlaneConfig' : 'dataPlaneConfig'
  const found = await loadExport(spec, name)
  if (!found.ok) return found
  if (typeof found.value !== 'function') {
    return { ok: false, reason: `\`${spec.replace('../../', '')}\` exports \`${name}\` but it is not a function` }
  }
  try {
    return { ok: true, value: (found.value as () => unknown)() }
  } catch (err) {
    return { ok: false, reason: `\`${name}()\` threw — ${why(err)}` }
  }
}

/* ------------------------------------------------------------------ *
 * The flag, set and unset around a start-up.
 * ------------------------------------------------------------------ */

export function setLocalTestAuth(on: boolean): void {
  if (on) process.env[LOCAL_TEST_AUTH_ENV] = LOCAL_TEST_AUTH_ON
  else delete process.env[LOCAL_TEST_AUTH_ENV]
}

/* ------------------------------------------------------------------ *
 * HTTP.
 * ------------------------------------------------------------------ */

export interface HttpResult {
  readonly status: number
  readonly contentType: string
  readonly text: string
  /** Parsed body, or `undefined` when the body is not JSON. */
  readonly body: Record<string, unknown> | undefined
}

/**
 * One GET. Deliberately thin: no retries, no default headers, no base-url
 * cleverness. A helper that quietly added an `X-Session` would make the
 * unauthenticated test pass while the property was absent.
 */
export async function get(
  origin: string,
  pathAndQuery: string,
  headers: Record<string, string> = {},
): Promise<HttpResult> {
  const res = await fetch(`${origin}${pathAndQuery}`, { method: 'GET', headers })
  const text = await res.text()
  let body: Record<string, unknown> | undefined
  try {
    const parsed: unknown = JSON.parse(text)
    body = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : undefined
  } catch {
    body = undefined
  }
  return { status: res.status, contentType: res.headers.get('content-type') ?? '', text, body }
}

/**
 * `X-Session: <token>`, and nothing else.
 *
 * 🛑 G386, 19 Sep 2026 — **THIS IS NOW THE LOCAL-TEST CHANNEL AND NOTHING
 * ELSE.** A plane started WITHOUT `RECONCILE_LOCAL_TEST_AUTH=1` holds no code
 * that reads this header — `server/dev/session-header.ts` is reached only by a
 * dynamic import the flag gates — so a suite that deletes the flag and calls
 * this is asserting against an unauthenticated request. Use
 * `sessionCookie()` there. Six suites made exactly that switch in the commit
 * that applied G386, and every one of them was RED first.
 */
export function session(token: string): Record<string, string> {
  return { [SESSION_HEADER]: token }
}

/**
 * `server/data-plane/session-cookie.ts` → the production channel, G386.
 *
 * ⚠️ IT IS SPELLED OUT HERE RATHER THAN IMPORTED FROM `server/`, AND THAT IS
 * THE SAME DECISION `SESSION_HEADER` ABOVE TAKES FOR THE SAME REASON. A test
 * that imported the server's own constant would pass if the server renamed the
 * cookie, because both sides would move together — and renaming this cookie
 * signs every live session out, which is precisely the change a suite should
 * notice. `tests/http/session-cookie-channel.test.ts` asserts the two spellings
 * agree, in one place, so the duplication is checked rather than merely
 * duplicated.
 */
export const SESSION_COOKIE = '__Host-reconcile_session'

/** `Cookie: __Host-reconcile_session=<handle>`, and nothing else. */
export function sessionCookie(handle: string): Record<string, string> {
  return { cookie: `${SESSION_COOKIE}=${handle}` }
}

/* ------------------------------------------------------------------ *
 * Reading a Problem — errors.yaml's RFC 9457 shape.
 * ------------------------------------------------------------------ */

export interface ProblemView {
  readonly code: unknown
  readonly status: unknown
  readonly hasRequiredKeys: boolean
  readonly keys: readonly string[]
}

/**
 * `errors.yaml` → `Problem` is `additionalProperties: false`,
 * `required: [type, title, status, code]`. A refusal that is not this shape is
 * undiagnosable under a restrictive SpanAttributePolicy, which is the argument
 * that file makes for the closed enum in the first place.
 */
export function readProblem(r: HttpResult): ProblemView {
  const b = r.body ?? {}
  const keys = Object.keys(b)
  return {
    code: b['code'],
    status: b['status'],
    hasRequiredKeys: ['type', 'title', 'status', 'code'].every((k) => k in b),
    keys,
  }
}

/** A compact one-line rendering for an assertion message. */
export function describeResponse(r: HttpResult): string {
  const head = `${r.status} ${r.contentType || '(no content-type)'}`
  const tail = r.text.length > 300 ? `${r.text.slice(0, 300)}…` : r.text
  return `${head} — ${tail === '' ? '(empty body)' : tail}`
}

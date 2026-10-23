/**
 * THE HTTP ANALOGUE OF THE TWO-TENANT LEAK TEST, PLUS THE FOUR REFUSALS THAT
 * HAVE TO HOLD BEFORE A BROWSER IS POINTED AT ANY OF IT.
 *
 * 🛑 THIS FILE IS RED AT THE COMMIT THAT INTRODUCES IT. Nothing in this
 * repository serves HTTP — no framework, no route, no listener, no `run` table.
 * The five assertions below are the specification of the first request-path
 * slice, written as executable claims rather than as a plan, and each one fails
 * today with a sentence naming the property it cannot witness. `tests/http/harness.ts`
 * declares the seam and explains why every import of it is dynamic.
 *
 * 🛑 CONSEQUENCE, STATED HERE RATHER THAN DISCOVERED IN CI: `npm run check`
 * EXITS NON-ZERO FROM THIS COMMIT UNTIL THE SLICE LANDS. That is what red-first
 * costs and it is not free — G95 put CI in on the condition that "the checks must
 * be real from day one", and a repository whose gate is red for a week teaches
 * people to ignore the gate, which is the same lesson from the other side. The
 * answer is to land the slice, not to soften these assertions: a test marked
 * `todo` or `skip` to keep a gate green is a test that proves nothing while
 * looking like it does.
 *
 * ┌─ WHAT IS ASSERTED, AND WHICH INVARIANT EACH ONE CARRIES ───────────────────┐
 * │ 1  A tenant-scoped read is served over HTTP, two sessions see only their    │
 * │    own rows, and both reads land on the SAME pooled backend.   INVARIANT 1  │
 * │    With RLS DISABLED the same two requests must LEAK — otherwise the        │
 * │    isolation is coming from a `WHERE` in a handler and not from the         │
 * │    database, and the property is one forgotten clause from being gone.      │
 * │ 2  A request with no valid session is REFUSED. Fail-closed: an empty page   │
 * │    of results is NOT an acceptable answer to an unauthenticated request.    │
 * │ 3  A request NAMING a tenant in a header or a query parameter does not      │
 * │    change scope.                                               INVARIANT 1  │
 * │ 5  The local-only test token is REFUSED when the flag is absent. RULING 2   │
 * │ 6  The contract is the validator — the server rejects what the OpenAPI      │
 * │    document rejects, including values no hand-written check would know.     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * (Assertion 4 — the control plane cannot reach tenant data — is structural and
 * needs neither a database nor a listener. It is in
 * `tests/http/plane-separation.test.ts`, which therefore never skips.)
 *
 * ⚠️ THE OPERATION UNDER TEST IS `GET /v1/runs`, AND IT WAS NOT CHOSEN FOR
 * CONVENIENCE. `docs/contracts/README.md` states that F1 Tenant Context is
 * IN-PROCESS and "must not become" an HTTP API, so `POST /context/resolve` is
 * not available as a first endpoint however well it fits. The capability tier is
 * "the only tier a customer's browser meets", `listRuns` is its plainest read,
 * and its two query parameters carry constraints that exist ONLY in the contract
 * — a five-member `status` enum and `limit: {minimum: 1, maximum: 200}` — which
 * is what makes assertion 6 an assertion rather than a hope.
 *
 * 🛑 WHAT THIS FILE PINS ABOUT THE SCHEMA, BECAUSE IT SEEDS ITS OWN FIXTURES.
 * There is no `run` table yet. The slice must add one in a migration, tenant
 * scoped exactly as `tenant_contact` is — `(tenant_id, id)` composite primary
 * key, `ENABLE` **and** `FORCE ROW LEVEL SECURITY`, and the same
 * `nullif(current_setting('app.tenant_id', true), '')` predicate on `USING` and
 * `WITH CHECK`. The INSERT below names the columns this file depends on; any
 * further column must be nullable or defaulted, or this seed and this test must
 * change in the same commit. That coupling is deliberate and visible rather than
 * implicit.
 *
 * ⚠️ THIS FILE USES ITS OWN DATABASE. `tests/db/tenant-isolation.test.ts` drops
 * and rebuilds schema `public` on every run, and `node --test` runs files
 * concurrently — two files rebuilding one database would produce failures that
 * have nothing to do with either property. `RECONCILE_DB_NAME` is set below,
 * before anything reads it (`db/env.ts` resolves it per call, never at import).
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import {
  CAPABILITY_BASE,
  REPO_ROOT,
  SESSION_HEADER,
  describeResponse,
  get,
  mintTestToken,
  missingSeams,
  readProblem,
  session,
  setLocalTestAuth,
  allowEveryCapability,
  fixtureSubstrate,
  startDataPlane,
  type HttpResult,
  type RunningServer,
} from './harness.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * Its own database. Set before the first call that reads it.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_HTTP_DB_NAME'] ?? runScopedName('reconcile_http_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const RUNS_PATH = `${CAPABILITY_BASE}/runs`

/** Seeded run ids, per tenant. Prefixed so a leak is legible in a failure message. */
const RUN_IDS: Record<string, readonly string[]> = {
  [ACME]: ['run_acme_1', 'run_acme_2'],
  [GLOBEX]: ['run_globex_1', 'run_globex_2', 'run_globex_3'],
}

/* ------------------------------------------------------------------ *
 * Reachability. Same loud skip as the leak test, for the same reason.
 * ------------------------------------------------------------------ */

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/http/data-plane-http.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS FILE CARRIES INVARIANT 1 ACROSS THE REQUEST PATH. A run of the',
      '   suite in which it skipped is NOT evidence that a tenant-scoped read',
      '   over HTTP is scoped, that an unauthenticated request is refused, or',
      '   that a tenant named in a header is ignored. Start a PostgreSQL and',
      '   re-run before believing a green suite.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the data plane’s request-path assertions', probe)

/* ------------------------------------------------------------------ *
 * The contract, read as text.
 *
 * ⚠️ A LINE SCANNER, NOT A YAML PARSER — the same posture as
 * `tools/check-wire-mirror.mjs` and `tests/contracts/run-status-wire.test.mjs`,
 * because G109's real parser is ruled and unbought and buying one is not this
 * file's decision. Every scan below asserts it FOUND its anchor before comparing
 * anything: a scanner that silently matched nothing would make assertion 6 pass
 * against a server that validates nothing, which is §5.6.
 * ------------------------------------------------------------------ */

const CAPABILITY_YAML = readFileSync(
  path.join(REPO_ROOT, 'docs', 'contracts', 'capability.openapi.yaml'),
  'utf8',
)
const capabilityLines = CAPABILITY_YAML.split('\n')

/** The `enum: [a, b, c]` flow form, the only form these contracts use. */
function enumOn(line: string): readonly string[] | null {
  const m = /enum:\s*\[([^\]]*)\]/.exec(line)
  if (m === null) return null
  return (m[1] ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x !== '')
}

/** Scan forward from the first line matching `anchor` for the first `enum: [...]`. */
function enumAfter(anchor: RegExp, within: number): readonly string[] | null {
  const at = capabilityLines.findIndex((l) => anchor.test(l))
  if (at === -1) return null
  for (let i = at; i < Math.min(at + within, capabilityLines.length); i++) {
    const found = enumOn(capabilityLines[i] ?? '')
    if (found !== null) return found
  }
  return null
}

function numberAfter(anchor: RegExp, key: string, within: number): number | null {
  const at = capabilityLines.findIndex((l) => anchor.test(l))
  if (at === -1) return null
  for (let i = at; i < Math.min(at + within, capabilityLines.length); i++) {
    const m = new RegExp(`${key}:\\s*(\\d+)`).exec(capabilityLines[i] ?? '')
    if (m !== null) return Number(m[1])
  }
  return null
}

/**
 * The `status` query parameter on `GET /runs` — NOT the `Run` schema's copy.
 *
 * These are two separate lists in one file and the request is validated against
 * this one. `tests/contracts/run-status-wire.test.mjs` records that
 * `tools/check-wire-mirror.mjs` "structurally cannot reach" this copy because it
 * is a parameter rather than a `components.schemas` entry.
 */
const STATUS_ENUM = enumAfter(/^\s*-\s*name:\s*status\s*$/, 10)
const LIMIT_MIN = numberAfter(/^\s*name:\s*limit\s*$/, 'minimum', 6)
const LIMIT_MAX = numberAfter(/^\s*name:\s*limit\s*$/, 'maximum', 6)

/* ------------------------------------------------------------------ *
 * Fixtures and the slice under test, both lazy.
 *
 * ⚠️ NEITHER IS BUILT IN `before()`, AND THAT IS THE WHOLE REASON THE FIVE
 * MESSAGES BELOW ARE DIFFERENT FROM EACH OTHER. A failing `before` hook aborts
 * the suite with ONE error, so every assertion in this file would today report
 * the same "no such module" line and none of them would say which invariant went
 * unwitnessed. Building lazily lets each test fail in its own words and quote
 * the cause underneath.
 * ------------------------------------------------------------------ */

type Slice = {
  readonly server: RunningServer
  readonly acmeToken: string
  readonly globexToken: string
}

let sliceOnce: Promise<{ ok: true; value: Slice } | { ok: false; reason: string }> | undefined

async function seedRuns(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const client = await migratorClient()
  try {
    await client.query('BEGIN')
    for (const tenantId of [ACME, GLOBEX]) {
      for (const runId of RUN_IDS[tenantId] ?? []) {
        await client.query(
          `INSERT INTO run
             (tenant_id, id, definition_id, definition_version, period_id,
              trigger_kind, status, started_at)
           VALUES ($1, $2, $3, 1, NULL, 'manual', 'completed', now())`,
          [tenantId, runId, `def_${tenantId}`],
        )
      }
    }
    await client.query('COMMIT')
    return { ok: true }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    return {
      ok: false,
      reason:
        'there is no tenant-scoped `run` table to serve `GET /v1/runs` from — ' +
        `${err instanceof Error ? err.message : String(err)}`,
    }
  } finally {
    await client.end()
  }
}

async function buildSlice(): Promise<{ ok: true; value: Slice } | { ok: false; reason: string }> {
  /**
   * EVERY missing piece, not the first one tripped over. Reported before any
   * side effect, so an implementer reading a failure learns that the listener,
   * the token minter and the table are all absent rather than fixing one and
   * rediscovering the next.
   */
  const absent = [...(await missingSeams())]
  const seeded = await seedRuns()
  if (!seeded.ok) absent.push(seeded.reason)
  if (absent.length > 0) {
    return { ok: false, reason: `${absent.length} piece(s) absent — ${absent.join(' | ')}` }
  }

  // The flag is set BEFORE start-up: `startDataPlane()` reads it once, so a
  // server started without it must stay refusing for its whole life. Assertion 5
  // depends on that and starts its own.
  setLocalTestAuth(true)

  /**
   * ⚠️ `poolMax: 1` IS ADVERSARIAL, NOT AN ECONOMY — the same argument
   * `tests/db/tenant-isolation.test.ts` makes for `max: 1`. With one connection
   * the second tenant's request is FORCED onto the connection the first
   * tenant's request just returned, which is the exact condition under which
   * RLS session state leaks. The test runs against the arrangement most likely
   * to fail rather than one that happens not to.
   */
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

  return {
    ok: true,
    value: { server: started.value, acmeToken: acme.value, globexToken: globex.value },
  }
}

function slice(): Promise<{ ok: true; value: Slice } | { ok: false; reason: string }> {
  sliceOnce ??= buildSlice()
  return sliceOnce
}

/** Read `items[].runId` out of a `listRuns` 200. */
function runIdsOf(r: HttpResult): readonly string[] {
  const items = r.body?.['items']
  assert.ok(
    Array.isArray(items),
    `the 200 from ${RUNS_PATH} carried no \`items\` array. ` +
      "`listRuns`'s response schema is `required: [items, nextCursor]`, " +
      `additionalProperties: false. Got: ${describeResponse(r)}`,
  )
  return (items as Array<Record<string, unknown>>).map((x) => String(x['runId']))
}

describe('the data plane over HTTP', { skip }, () => {
  before(async () => {
    // Rebuilt from the migrations every run, so a crashed earlier run that left
    // RLS disabled on `run` cannot make a later run report a false green.
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
  })

  after(async () => {
    setLocalTestAuth(false)
    const s = await slice()
    if (s.ok) await s.value.server.close().catch(() => undefined)
  })

  /* ================================================================ *
   * 1. A TENANT-SCOPED READ, OVER HTTP, ON ONE POOLED BACKEND.
   * ================================================================ */

  it('two sessions read only their own runs, over HTTP, on the SAME pooled backend', async () => {
    const s = await slice()
    if (!s.ok) {
      assert.fail(
        'INVARIANT 1 IS UNWITNESSED ACROSS THE REQUEST PATH. Nothing serves a ' +
          'tenant-scoped read over HTTP, so no request can be made and the ' +
          'property this asserts — two sessions, two answers, one pooled ' +
          'connection — is neither true nor false today. ' +
          `tests/db/tenant-isolation.test.ts proves it one layer below HTTP and ` +
          `that is where the proof still stops. Cause: ${s.reason}`,
      )
    }
    const { server, acmeToken, globexToken } = s.value

    /**
     * Warm the pool, then take the roll of application backends BEFORE the two
     * reads and again AFTER.
     *
     * ⚠️ THIS USED TO READ `backend_start` AND THAT COLUMN IS NULL HERE. The
     * first green run of this file is what found it: `pg_stat_activity` shows a
     * session's timestamps only to its own role or to `pg_read_all_stats`, and
     * `reconcile_migrator` is neither superuser nor a member — deliberately, per
     * G100. `pid` and `application_name` ARE visible to everyone, so the same
     * property is asserted out of columns the test can actually read: one
     * backend before, the SAME one after, and `poolMax: 1` means there was
     * nowhere else for either read to go.
     */
    await get(server.url, RUNS_PATH, session(acmeToken))
    const admin = await migratorClient()
    const appBackends = async (): Promise<readonly number[]> => {
      const r = await admin.query(
        `SELECT pid FROM pg_stat_activity
          WHERE datname = current_database() AND application_name = 'reconcile-app'
          ORDER BY pid`,
      )
      return (r.rows as Array<{ pid: number }>).map((x) => x.pid)
    }
    const before = await appBackends()

    const acme = await get(server.url, RUNS_PATH, session(acmeToken))
    const globex = await get(server.url, RUNS_PATH, session(globexToken))

    try {
      assert.equal(acme.status, 200, `the acme session was not served: ${describeResponse(acme)}`)
      assert.equal(globex.status, 200, `the globex session was not served: ${describeResponse(globex)}`)

      const acmeRuns = [...runIdsOf(acme)].sort()
      const globexRuns = [...runIdsOf(globex)].sort()

      // BOTH HALVES MATTER. A handler that returned nothing to everybody would
      // satisfy "saw no other tenant's rows" and prove nothing at all.
      assert.deepEqual(
        acmeRuns,
        [...(RUN_IDS[ACME] ?? [])].sort(),
        'the acme session did not receive exactly its own runs',
      )
      assert.deepEqual(
        globexRuns,
        [...(RUN_IDS[GLOBEX] ?? [])].sort(),
        'the globex session did not receive exactly its own runs',
      )

      /* THE SAME POOLED BACKEND — asserted, not assumed. */
      const after = await appBackends()

      assert.ok(
        before.length > 0,
        'no PostgreSQL backend on this database is named `reconcile-app`, so this ' +
          'test cannot see which connection served the two reads. The data plane ' +
          'must take its pool from `createAppPool()` (db/tenant-scope.ts), which ' +
          'sets that application_name and connects as the role holding neither ' +
          'BYPASSRLS nor ownership.',
      )
      assert.deepEqual(
        after,
        before,
        'the set of application backends CHANGED across the two tenant reads, so ' +
          'the pool churned and the reads may not have shared a connection — this ' +
          'run therefore proved nothing about a pooled connection carrying another ' +
          "tenant's session state, which is the exact condition B5 describes.",
      )
      assert.equal(
        after.length,
        1,
        'the data plane holds MORE THAN ONE application backend while `poolMax: 1` ' +
          'was requested, so the two tenant reads may have run on different ' +
          'connections and this run proved nothing about pooled session state — ' +
          'which is the exact condition RLS `SET LOCAL` leaks under.',
      )
    } finally {
      await admin.end()
    }
  })

  /* ---------------------------------------------------------------- *
   * The negative control. WITHOUT ROW-LEVEL SECURITY, THE HTTP READ LEAKS.
   *
   * Without this, the test above passes just as well against a handler that
   * writes `WHERE tenant_id = $1` itself — isolation by convention, one
   * forgotten clause from a cross-tenant read, and indistinguishable from the
   * real property by every assertion above. `tests/db/tenant-isolation.test.ts`
   * makes the same argument at the SQL layer by reading the statement text; over
   * HTTP the statement is not visible, so the control has to be the leak.
   * ---------------------------------------------------------------- */

  it('with RLS DISABLED on `run` the HTTP read LEAKS — isolation comes from the database', async () => {
    const s = await slice()
    if (!s.ok) {
      assert.fail(
        'THE PROVENANCE OF HTTP-LEVEL TENANT ISOLATION IS UNWITNESSED. This ' +
          'asserts that turning row-level security OFF changes what the endpoint ' +
          'returns — the only way to tell isolation produced by the database from ' +
          'isolation produced by a `WHERE` a handler happens to carry. No ' +
          `endpoint exists to turn it off underneath. Cause: ${s.reason}`,
      )
    }
    const { server, acmeToken } = s.value

    const admin = await migratorClient()
    try {
      await admin.query('ALTER TABLE run DISABLE ROW LEVEL SECURITY')

      const leaked = await get(server.url, RUNS_PATH, session(acmeToken))
      assert.equal(leaked.status, 200, `expected the read to still be served: ${describeResponse(leaked)}`)

      const seen = [...runIdsOf(leaked)].sort()
      assert.notDeepEqual(
        seen,
        [...(RUN_IDS[ACME] ?? [])].sort(),
        'turning RLS OFF did not change what the endpoint returned, which means ' +
          'the isolation asserted above is NOT coming from the database. Either a ' +
          'handler is filtering by tenant itself — a rule keyed on a convenient ' +
          'landmark, docs/HANDOFF.md §5.1 — or the two tenants do not both have ' +
          'fixture rows. In either case this file is proving nothing.',
      )
    } finally {
      await admin.query('ALTER TABLE run ENABLE ROW LEVEL SECURITY').catch(() => undefined)
      await admin.end()
    }
  })

  /* ================================================================ *
   * 2. NO SESSION, NO READ — AND THE REFUSAL IS A REFUSAL.
   * ================================================================ */

  it('a request with no valid session is REFUSED, not answered with an empty page', async () => {
    const s = await slice()
    if (!s.ok) {
      assert.fail(
        'THE UNAUTHENTICATED PATH IS UNWITNESSED. This asserts that a request ' +
          'carrying no session is refused with a Problem, and specifically that it ' +
          'is NOT answered with an empty result set — an empty page is what a ' +
          'correctly-denying RLS policy produces on its own (G100 deny-on-NULL), ' +
          'so a plane that leaned on it would look identical to one that checked ' +
          `nothing. Nothing serves HTTP. Cause: ${s.reason}`,
      )
    }
    const { server, acmeToken } = s.value

    /* The positive control FIRST. A server that refuses everything must not pass. */
    const good = await get(server.url, RUNS_PATH, session(acmeToken))
    assert.equal(
      good.status,
      200,
      'a VALID session was refused, so the refusals asserted below prove nothing — ' +
        `a plane that denies everyone denies unauthenticated callers too: ${describeResponse(good)}`,
    )
    assert.ok(runIdsOf(good).length > 0, 'the valid session received no runs, so there is nothing to withhold')

    for (const [label, headers] of [
      ['no session header at all', {}],
      ['an empty session header', { [SESSION_HEADER]: '' }],
      ['a forged session token', { [SESSION_HEADER]: 'not-a-real-token' }],
      ['a well-formed token with a broken signature', { [SESSION_HEADER]: `${acmeToken}x` }],
    ] as ReadonlyArray<readonly [string, Record<string, string>]>) {
      const res = await get(server.url, RUNS_PATH, headers)

      assert.equal(
        res.status,
        401,
        `${label}: expected 401. ` +
          '`capability.openapi.yaml` answers this with `Unauthenticated` — ' +
          `"No valid session." Got: ${describeResponse(res)}`,
      )

      const problem = readProblem(res)
      assert.ok(
        res.contentType.includes('application/problem+json'),
        `${label}: the refusal was not an RFC 9457 Problem — content-type was ` +
          `"${res.contentType}". errors.yaml defines exactly one refusal shape.`,
      )
      assert.ok(
        problem.hasRequiredKeys,
        `${label}: the Problem is missing required members. errors.yaml requires ` +
          `[type, title, status, code]; got [${problem.keys.join(', ')}]`,
      )
      assert.equal(
        problem.code,
        'session_invalid',
        `${label}: the refusal did not carry the shared error code. ` +
          '`session_invalid` is in errors.yaml\'s closed enum, and under a ' +
          'restrictive SpanAttributePolicy the code is the only diagnostic channel ' +
          'that survives redaction — a free-text message is undiagnosable.',
      )

      /* FAIL-CLOSED, STATED AS AN ABSENCE. */
      assert.ok(
        !('items' in (res.body ?? {})),
        `${label}: the refusal carried an \`items\` key. An unauthenticated request ` +
          'must be REFUSED, never served a page — empty or otherwise. An empty page ' +
          'is indistinguishable from a tenant with no runs, so a client, a log and a ' +
          'dashboard would all read a security failure as a quiet Tuesday.',
      )
    }
  })

  /* ================================================================ *
   * 3. A REQUEST MAY NOT NAME ITS TENANT. THE MOST IMPORTANT ONE HERE.
   * ================================================================ */

  it('the capability contract declares no way for a request to name a tenant', () => {
    // Green today, and it is the half that must STAY green: invariant 1
    // "expressed as an absence rather than a comment" (docs/contracts/README.md).
    // Scoped to the capability tier deliberately — the control plane carries two
    // known deviations, ruled as G113, and this assertion is not about them.
    assert.ok(
      /tenant/i.test(CAPABILITY_YAML),
      'the capability contract does not mention a tenant anywhere, so this scan is ' +
        'reading the wrong file and would pass against any document at all',
    )

    const offenders = capabilityLines
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => /^\s*-?\s*name:\s*['"]?(tenantId|[Xx]-[Tt]enant)/.test(line))

    assert.deepEqual(
      offenders,
      [],
      'the capability contract declares a parameter naming a tenant. ' +
        'INVARIANT 1: tenant scope is derived from the session, never read from a ' +
        'request. A request that could state its tenant could state the wrong one.',
    )
  })

  it('naming a tenant in a header or a query parameter does NOT change scope', async () => {
    const s = await slice()
    if (!s.ok) {
      assert.fail(
        'INVARIANT 1 HAS NO EXECUTABLE FORM ON THE REQUEST PATH. This is the test ' +
          'that would catch a handler reading a tenant out of a header or a query ' +
          'string, and it is the direct inversion of the invariant rather than a ' +
          'degradation of it. The contract declares no such parameter (asserted ' +
          'above) — but a contract is not a server, and nothing here is a server ' +
          `yet. Cause: ${s.reason}`,
      )
    }
    const { server, acmeToken } = s.value

    const clean = await get(server.url, RUNS_PATH, session(acmeToken))
    assert.equal(clean.status, 200, `the plain acme read was not served: ${describeResponse(clean)}`)
    const acmeRuns = [...runIdsOf(clean)].sort()
    const globexRuns = new Set(RUN_IDS[GLOBEX] ?? [])

    const attacks: ReadonlyArray<readonly [string, string, Record<string, string>]> = [
      ['?tenantId=', `${RUNS_PATH}?tenantId=${GLOBEX}`, session(acmeToken)],
      ['?tenant=', `${RUNS_PATH}?tenant=${GLOBEX}`, session(acmeToken)],
      ['X-Tenant-Id header', RUNS_PATH, { ...session(acmeToken), 'X-Tenant-Id': GLOBEX }],
      ['X-Tenant header', RUNS_PATH, { ...session(acmeToken), 'X-Tenant': GLOBEX }],
      [
        'both at once',
        `${RUNS_PATH}?tenantId=${GLOBEX}`,
        { ...session(acmeToken), 'X-Tenant-Id': GLOBEX },
      ],
    ]

    for (const [label, target, headers] of attacks) {
      const res = await get(server.url, target, headers)

      // NEVER, under any status code. This is the assertion; the rest is shape.
      if (res.status === 200) {
        for (const id of runIdsOf(res)) {
          assert.ok(
            !globexRuns.has(id),
            `${label}: the response carried \`${id}\`, which belongs to ${GLOBEX}, ` +
              `while the session is ${ACME}'s. INVARIANT 1 IS INVERTED — scope was ` +
              'taken from the request.',
          )
        }
      }

      // TWO behaviours satisfy the invariant and both are accepted: refuse the
      // request outright (a strict validator rejecting an undeclared parameter),
      // or ignore it entirely. What is NOT accepted is a 200 whose contents
      // differ from the clean read — that is scope moving, whichever way it moved.
      if (res.status >= 400 && res.status < 500) continue

      assert.equal(
        res.status,
        200,
        `${label}: expected either a 4xx refusal or an unchanged 200, got ` +
          describeResponse(res),
      )
      assert.deepEqual(
        [...runIdsOf(res)].sort(),
        acmeRuns,
        `${label}: the response DIFFERED from the same request without the tenant ` +
          'name. Whatever it changed, the request changed it — and a request that ' +
          'can move scope at all can move it to a tenant the session may not read.',
      )
    }
  })

  /* ================================================================ *
   * 5. THE LOCAL-ONLY TOKEN, WITHOUT THE LOCAL-ONLY FLAG.
   * ================================================================ */

  it('a test token is REFUSED by a plane started without the local-only flag', async () => {
    const minted = await mintTestToken({ tenantId: ACME })
    if (!minted.ok) {
      assert.fail(
        'RULING 2 HAS NO EXECUTABLE FORM. The test-token path does not exist, so ' +
          'the property that matters about it — that a plane started WITHOUT ' +
          '`RECONCILE_LOCAL_TEST_AUTH=1` refuses a perfectly valid, correctly ' +
          'signed test token — is unwitnessed. This asserts the REFUSAL, not the ' +
          'presence of a flag check: a check that is present and answers "allow" is ' +
          `the defect. Cause: ${minted.reason}`,
      )
    }
    const token = minted.value

    /* A — the flag is ABSENT. The token must be refused. */
    setLocalTestAuth(false)
    // ⚠️ THE SAME `authorise` ON BOTH ARMS, 19 Sep 2026. The property under test is
    // that ONLY THE FLAG differs between them; letting arm B take G200's default
    // denyAll would make it 403 and turn a flag assertion into a gate assertion,
    // which is a different claim in a file that is not about the gate.
    const withoutFlag = await startDataPlane({
    poolMax: 1,
    authorise: allowEveryCapability,
    /* ⚠️ G301, 19 Sep 2026 — `authorise` ALONE NO LONGER GETS A SUITE BEHIND
     * THE GATE. A gated handler now MINTS invariant 10's record before it
     * reads, and a mint needs a principal; the local test token resolves none.
     * `tests/http/harness.ts` states at length why this fixture exists and what
     * it does NOT buy — the verdict still comes from `decide()`. */
    substrate: fixtureSubstrate(),
  })
    if (!withoutFlag.ok) {
      setLocalTestAuth(true)
      assert.fail(
        'RULING 2 IS UNWITNESSED: no plane can be started to refuse the token. ' +
          `Cause: ${withoutFlag.reason}`,
      )
    }
    try {
      const refused = await get(withoutFlag.value.url, RUNS_PATH, session(token))

      assert.notEqual(
        refused.status,
        404,
        'the plane started without the flag does not serve this route at all, so ' +
          'the 4xx below would say nothing about the token. The flag must gate ' +
          'ACCEPTANCE of a test token, not the existence of the API.',
      )
      assert.equal(
        refused.status,
        401,
        'a locally-minted test token was ACCEPTED by a plane started without ' +
          `${'RECONCILE_LOCAL_TEST_AUTH'}=1, or refused with the wrong status. ` +
          'A signing key that is honoured unconditionally is a second front door ' +
          `to every tenant. Got: ${describeResponse(refused)}`,
      )
      assert.equal(
        readProblem(refused).code,
        'session_invalid',
        'the refusal did not carry `session_invalid` from errors.yaml\'s closed enum',
      )
      assert.ok(
        !('items' in (refused.body ?? {})),
        'the refusal carried an `items` key — it served a page rather than refusing',
      )
    } finally {
      await withoutFlag.value.close().catch(() => undefined)
    }

    /* B — the same token, the same plane, the flag PRESENT. It must be accepted.
     *
     * Without this half the test passes against a plane that refuses every test
     * token forever, which is not what ruling 2 asks for and would leave the
     * browser-testing path with nothing to sign in with. */
    setLocalTestAuth(true)
    const withFlag = await startDataPlane({
    poolMax: 1,
    authorise: allowEveryCapability,
    /* ⚠️ G301, 19 Sep 2026 — `authorise` ALONE NO LONGER GETS A SUITE BEHIND
     * THE GATE. A gated handler now MINTS invariant 10's record before it
     * reads, and a mint needs a principal; the local test token resolves none.
     * `tests/http/harness.ts` states at length why this fixture exists and what
     * it does NOT buy — the verdict still comes from `decide()`. */
    substrate: fixtureSubstrate(),
  })
    if (!withFlag.ok) assert.fail(`could not start a plane WITH the flag: ${withFlag.reason}`)
    try {
      const accepted = await get(withFlag.value.url, RUNS_PATH, session(token))
      assert.equal(
        accepted.status,
        200,
        'the same test token was refused even WITH the local-only flag set, so the ' +
          'refusal above is not evidence that the flag is what refused it — the ' +
          `token may simply never work. Got: ${describeResponse(accepted)}`,
      )
    } finally {
      await withFlag.value.close().catch(() => undefined)
    }
  })

  /* ================================================================ *
   * 6. THE CONTRACT IS THE VALIDATOR.
   * ================================================================ */

  /**
   * ⚠️ WHAT THIS ASSERTION CANNOT SEE, STATED BEFORE IT RATHER THAN DISCOVERED
   * AFTER IT. It compares BEHAVIOUR against the document, so it catches DRIFT —
   * a hand-written list that has fallen behind the contract, which is the defect
   * `tests/contracts/run-status-wire.test.mjs` exists for and which `incomplete`
   * demonstrated on 16 Aug 2026. It does NOT establish PROVENANCE: a hand-copied
   * enum that happens to agree with the document today passes every line below,
   * and was verified to do so. Ruling 1 — "the four OpenAPI files are the router
   * and the validator, not documentation that drifts" — is therefore only
   * PARTLY witnessed here. The half this cannot reach needs a checker that reads
   * the server's route table, which is G109's real YAML parser wearing a
   * different hat. Do not read a green run of this test as evidence that the
   * contract is wired in.
   */
  it('the OpenAPI document is the validator — the server rejects exactly what it rejects', async () => {
    /* Anti-vacuous first: a scanner that found nothing would pass every
     * assertion below against a server that validates nothing. */
    assert.ok(
      STATUS_ENUM !== null && STATUS_ENUM.length > 0,
      'the `status` query-parameter enum was not found in capability.openapi.yaml. ' +
        'This scan is the only thing binding the assertions below to the contract; ' +
        'without it they would assert nothing.',
    )
    assert.ok(
      LIMIT_MIN !== null && LIMIT_MAX !== null,
      'the `limit` parameter bounds were not found in capability.openapi.yaml',
    )
    assert.ok(
      STATUS_ENUM.includes('incomplete'),
      'the `status` enum does not contain `incomplete`. O-16 added it on 16 Aug 2026 ' +
        'and it is the member a hand-written copy is most likely to be missing — ' +
        'which is exactly what the assertions below are shaped to catch.',
    )

    const s = await slice()
    if (!s.ok) {
      assert.fail(
        'RULING 1 IS UNWITNESSED: nothing validates a request against the contract, ' +
          'because nothing serves a request. This asserts that the server accepts ' +
          `every one of the ${STATUS_ENUM.length} \`status\` values the contract ` +
          'lists and refuses one it does not, and that it enforces ' +
          `\`limit\` ∈ [${LIMIT_MIN}, ${LIMIT_MAX}] — constraints that exist ONLY in ` +
          'the OpenAPI document. A hand-written validator drifts from it silently; ' +
          `a router derived from it cannot. Cause: ${s.reason}`,
      )
    }
    const { server, acmeToken } = s.value
    const auth = session(acmeToken)

    /* EVERY member the contract lists must be accepted.
     *
     * This is the provenance assertion. A hand-written four-member list — the
     * pre-O-16 vocabulary — passes a "rejects garbage" test and fails this one,
     * because `incomplete` would come back 400. */
    for (const member of STATUS_ENUM) {
      const res = await get(server.url, `${RUNS_PATH}?status=${member}`, auth)
      assert.notEqual(
        res.status,
        400,
        `\`status=${member}\` was REJECTED, and the contract lists it. The server's ` +
          'accepted set is narrower than the document, so the document is not what ' +
          `is validating. Got: ${describeResponse(res)}`,
      )
    }

    /* And a value it does not list must be refused. */
    for (const bogus of ['definitely_not_a_status', 'COMPLETED', 'complete']) {
      assert.ok(!STATUS_ENUM.includes(bogus), `fixture error: ${bogus} is in the contract`)
      const res = await get(server.url, `${RUNS_PATH}?status=${bogus}`, auth)
      assert.equal(
        res.status,
        400,
        `\`status=${bogus}\` was ACCEPTED and the contract does not list it: ` +
          describeResponse(res),
      )
      assert.equal(
        readProblem(res).code,
        'validation_failed',
        `\`status=${bogus}\` was refused without \`validation_failed\` from ` +
          "errors.yaml's closed enum",
      )
    }

    /* The numeric bounds, which no hand-written check tends to carry. */
    const bounds: ReadonlyArray<readonly [string, number, boolean]> = [
      ['below minimum', LIMIT_MIN - 1, true],
      ['at minimum', LIMIT_MIN, false],
      ['at maximum', LIMIT_MAX, false],
      ['above maximum', LIMIT_MAX + 1, true],
    ]
    for (const [label, value, mustRefuse] of bounds) {
      const res = await get(server.url, `${RUNS_PATH}?limit=${value}`, auth)
      if (mustRefuse) {
        assert.equal(
          res.status,
          400,
          `limit=${value} (${label}) was accepted; the contract says ` +
            `minimum: ${LIMIT_MIN}, maximum: ${LIMIT_MAX}. ${describeResponse(res)}`,
        )
        assert.equal(readProblem(res).code, 'validation_failed', `limit=${value}: wrong error code`)
      } else {
        assert.notEqual(
          res.status,
          400,
          `limit=${value} (${label}) was rejected and the contract permits it: ` +
            describeResponse(res),
        )
      }
    }

    /* A path in no contract is not a route. The router is the documents. */
    const undeclared = await get(server.url, `${CAPABILITY_BASE}/not-in-any-contract`, auth)
    assert.equal(
      undeclared.status,
      404,
      'the plane answered a path that appears in no OpenAPI document. If the ' +
        'contracts are the router, a route they do not declare cannot exist: ' +
        describeResponse(undeclared),
    )
  })
})

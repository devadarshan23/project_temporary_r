/**
 * THE SHORTFALL CHANNEL, ON THE SERVED PATH — and the distinction a plausible
 * implementation collapses.
 *
 * `tests/contracts/engine-read-wire.test.mjs` asserts that `Run.completeness`
 * EXISTS on the wire, is `required`, and is `[array, 'null']`. That is the
 * schema half of G153's carve-out ⓐ. This file is the other half: what the
 * running plane actually puts there, over a real PostgreSQL, through
 * `withTenantScope()`.
 *
 * ┌─ 🛑 THE ONE ASSERTION THAT MATTERS, AND WHY IT IS AN ASSERTION ABOUT `null` ┐
 * │ `[]` and `null` are DIFFERENT FACTS and a handler that returns `[]` passes  │
 * │ every schema assertion in this repository:                                 │
 * │                                                                            │
 * │   `[]`    the ENGINE ran and observed no shortfall — a clean close.         │
 * │   `null`  this plane HOLDS NO ENGINE ACCOUNT for the run at all.            │
 * │                                                                            │
 * │ Nothing persists a `SetReconciliationResult` today — `ls db/migrations/` is │
 * │ 0001–0003 and `run` has no findings column — so `null` is the true answer   │
 * │ for every row, and `[]` would report a clean close for a run nobody         │
 * │ reconciled. ⚠️ THAT FIRST CLAUSE WENT FALSE ON 19 Sep 2026 UNDER G284 AND   │
 * │ IS CORRECTED RATHER THAN DELETED: `0007_run_engine_account.sql` persists a  │
 * │ result in typed columns. **The assertion below is unchanged and still       │
 * │ right**, because THIS suite seeds three bare runs and none of them has an   │
 * │ account row — so `null` is still the true answer for every row IT reads.    │
 * │ `server/data-plane/runs.ts` carries the wider statement: `getRun` publishes │
 * │ the constant for a run that HAS an account too, which is an understatement  │
 * │ and a named gap. On `run_acme_incomplete` `[]` would be worse than vague:   │
 * │ it would                                                                    │
 * │ be self-contradictory, because `terminalRunStatus()` derives `incomplete`   │
 * │ FROM a non-empty completeness channel. A run that says `incomplete` and     │
 * │ `completeness: []` in one body is a lie the wire tells about itself.        │
 * │                                                                            │
 * │ This is the `ResidueEntry.settlement` lesson one layer out: that field is   │
 * │ required-and-nullable because its first version carried a fabricated zero   │
 * │ in a fabricated currency on the one row a finance user reads.               │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 AND IT IS ASSERTED BY ATTACK AS WELL AS BY VALUE. A by-id read is strictly
 * more dangerous than a collection read: a collection read that forgets its
 * scope returns a suspicious number of rows, and a by-id read returns EXACTLY
 * the row the attacker asked for. So the account of another tenant's run is
 * requested BY ITS EXACT SEEDED ID and required to answer identically to an id
 * nobody seeded — same status, same code, same key set. Anything else is a
 * cross-tenant read or an existence oracle.
 *
 * ⚠️ ITS OWN DATABASE, for the reason `tests/http/data-plane-http.test.ts`
 * gives: `node --test` runs files concurrently and two files rebuilding one
 * schema produce failures that have nothing to do with either property.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import {
  CAPABILITY_BASE,
  describeResponse,
  get,
  mintTestToken,
  readProblem,
  session,
  setLocalTestAuth,
  allowEveryCapability,
  fixtureSubstrate,
  startDataPlane,
  type RunningServer,
} from './harness.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_COMPLETENESS_DB_NAME'] ?? runScopedName('reconcile_completeness_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const RUNS_PATH = `${CAPABILITY_BASE}/runs`

/** The acme run that says `incomplete` — the one a fabricated `[]` contradicts. */
const ACME_INCOMPLETE = 'run_acme_incomplete'
/** A globex run, addressed BY ITS EXACT ID from an acme session. */
const GLOBEX_ONLY = 'run_globex_secret'
/** An id nobody seeded. The control the cross-tenant answer must match exactly. */
const NEVER_SEEDED = 'run_no_such_run_anywhere'

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/http/run-completeness-served.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS FILE CARRIES G153 CARVE-OUT ⓐ ON THE SERVED PATH AND INVARIANT 1',
      '   ON A BY-ID READ. A run in which it skipped is NOT evidence that the',
      '   shortfall channel is served, and NOT evidence that another tenant`s run',
      '   is invisible when asked for by its exact id.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the served shortfall-channel assertions', probe)

interface Slice {
  readonly server: RunningServer
  readonly acmeToken: string
}

let sliceOnce: Promise<{ ok: true; value: Slice } | { ok: false; reason: string }> | undefined

async function seed(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const client = await migratorClient()
  try {
    await client.query('BEGIN')
    for (const [tenantId, runId, status] of [
      [ACME, ACME_INCOMPLETE, 'incomplete'],
      [ACME, 'run_acme_completed', 'completed'],
      [GLOBEX, GLOBEX_ONLY, 'completed'],
    ] as const) {
      await client.query(
        `INSERT INTO run
           (tenant_id, id, definition_id, definition_version, period_id,
            trigger_kind, status, started_at)
         VALUES ($1, $2, 'def_engine', 1, NULL, 'manual', $3, now())`,
        [tenantId, runId, status],
      )
    }
    await client.query('COMMIT')
    return { ok: true }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  } finally {
    await client.end()
  }
}

async function build(): Promise<{ ok: true; value: Slice } | { ok: false; reason: string }> {
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
  return { ok: true, value: { server: started.value, acmeToken: acme.value } }
}

function slice(): Promise<{ ok: true; value: Slice } | { ok: false; reason: string }> {
  sliceOnce ??= build()
  return sliceOnce
}

describe('the shortfall channel, served', { skip }, () => {
  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
  })

  after(async () => {
    setLocalTestAuth(false)
    const s = await slice()
    if (s.ok) await s.value.server.close().catch(() => undefined)
  })

  it('an `incomplete` run carries `completeness` — and it is `null`, NOT `[]`', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)

    const r = await get(s.value.server.url, `${RUNS_PATH}/${ACME_INCOMPLETE}`, session(s.value.acmeToken))
    assert.equal(r.status, 200, `expected 200 from getRun. Got: ${describeResponse(r)}`)

    const body = r.body ?? {}
    assert.ok(
      'completeness' in body,
      'G153\'S CARVE-OUT ⓐ IS UNDISCHARGED ON THE SERVED PATH. The schema declares ' +
        '`completeness` `required`, and `Run` is `additionalProperties: false`, so a body ' +
        `without the key is a server disagreeing with its own contract. Keys: [${Object.keys(body).sort().join(', ')}]`,
    )
    assert.equal(body['status'], 'incomplete', 'the fixture is not the incomplete run')

    // 🛑 THE BEHAVIOURAL ASSERTION. `[]` passes every schema check and is false.
    assert.equal(
      body['completeness'],
      null,
      'THE UNKNOWN WAS PUBLISHED AS THE EMPTY. `completeness: []` is the ENGINE saying it ' +
        'observed no shortfall; nothing in this repository persists a reconciliation result, ' +
        'so the true answer is `null` — this plane holds no engine account for this run. ' +
        'Worse, this run\'s `status` is `incomplete`, and `terminalRunStatus()` derives that ' +
        'FROM a non-empty completeness channel: `incomplete` beside `[]` is a body that ' +
        'contradicts itself. `CLAUDE.md` — never fabricate; leave a clearly marked stub. ' +
        `Got: ${JSON.stringify(body['completeness'])}`,
    )
  })

  it('the collection read carries the same channel, so the two operations cannot diverge', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)

    const r = await get(s.value.server.url, `${RUNS_PATH}?limit=50`, session(s.value.acmeToken))
    assert.equal(r.status, 200, describeResponse(r))
    const items = r.body?.['items'] as Array<Record<string, unknown>> | undefined
    assert.ok(Array.isArray(items) && items.length === 2, `expected acme's two runs; got ${items?.length}`)
    for (const item of items) {
      assert.ok(
        'completeness' in item,
        '`listRuns` and `getRun` publish the SAME `Run` schema and are built from one column ' +
          'list precisely so one of them cannot start omitting a field the other carries.',
      )
      assert.equal(item['completeness'], null)
    }
  })

  it('INVARIANT 1 — another tenant\'s run, asked for BY ITS EXACT ID, answers exactly like an id nobody seeded', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)

    const crossTenant = await get(
      s.value.server.url,
      `${RUNS_PATH}/${GLOBEX_ONLY}`,
      session(s.value.acmeToken),
    )
    const absent = await get(
      s.value.server.url,
      `${RUNS_PATH}/${NEVER_SEEDED}`,
      session(s.value.acmeToken),
    )

    assert.equal(
      crossTenant.status,
      404,
      'A CROSS-TENANT BY-ID READ SUCCEEDED. Tenant scope is derived from the session, never ' +
        'read from a request, and the row-level security policy — not a `WHERE` in the ' +
        `handler — is what answers. Got: ${describeResponse(crossTenant)}`,
    )
    assert.equal(absent.status, 404, describeResponse(absent))

    const a = readProblem(crossTenant)
    const b = readProblem(absent)
    assert.equal(a.code, b.code, 'the two 404s carry different error codes — that is an oracle')
    assert.deepEqual(
      a.keys.slice().sort(),
      b.keys.slice().sort(),
      'the two 404s carry different KEY SETS. `NotFound` must be returned "identically for a ' +
        'row that does not exist and for a row in another tenant — distinguishing them would ' +
        'make this endpoint an existence oracle across the tenant boundary."',
    )
    assert.equal(
      crossTenant.text,
      absent.text,
      'THE TWO 404 BODIES ARE NOT BYTE-IDENTICAL. A by-id read is strictly more dangerous ' +
        'than a collection read: a collection read that forgets its scope returns a ' +
        'suspicious number of rows, and this returns exactly the row the attacker asked for. ' +
        'Any difference at all between "does not exist" and "belongs to someone else" tells ' +
        'an attacker which run ids are real. ' +
        `cross-tenant: ${crossTenant.text} · absent: ${absent.text}`,
    )
  })

  it('the two engine reads are MOUNTED, and a run with no account is a 404 from the HANDLER', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)

    /**
     * ✅ **AMENDED 19 Sep 2026 IN THE COMMIT THAT MOUNTED THEM, WHICH IS WHAT
     * THE PREVIOUS VERSION OF THIS TEST ASKED FOR IN ITS OWN WORDS.** It read
     * *"If this test goes red because the detail changed, the handler landed;
     * that is welcome, and this assertion is amended in the commit that lands
     * it rather than deleted quietly."* The handler landed — G300 lifted
     * G296's freeze for any operation whose table, model and capability are
     * all real, and G301 made minting a precondition of mounting — so the
     * assertion is amended rather than deleted, and the paragraph it rested on
     * is quoted below rather than erased.
     *
     * 🛑 THE OLD ASSERTION AND ITS REASON, PRESERVED: *"`getRunAccount` and
     * `listRunResidue` are declared in `capability.openapi.yaml` and mounted
     * by nothing … A handler mounted today would 404 for every run id that
     * will ever be passed to it, which is a route that asserts nothing and
     * which a later reader would take for a real implementation."* It required
     * a 404 whose title was **"No such operation."** — the ROUTER's, with
     * detail *"The OpenAPI documents are the router. A path they do not
     * declare is not a route."*
     *
     * ⚠️ WHAT THIS SUITE CAN STILL SAY, AND IT IS NARROWER THAN WHAT IT SAID.
     * The three runs seeded here have NO engine account — this file writes
     * `run` rows and nothing else — so both operations answer 404 for all of
     * them. **The 404 is now the HANDLER's, and the title is the thing that
     * tells the two apart.** That distinction is the whole assertion: if this
     * goes back to *"No such operation."* the mount has been lost, and if it
     * becomes a 200 then something is fabricating an account for a run that
     * has none.
     *
     * **The served surface is proven in `tests/http/run-account-served.test.ts`**,
     * which seeds real accounts, drives both operations against the PRODUCTION
     * authoriser, and carries the RLS-disabled leak control. This assertion is
     * deliberately not a second copy of that.
     */
    for (const suffix of ['/account', '/residue']) {
      const r = await get(
        s.value.server.url,
        `${RUNS_PATH}/run_acme_completed${suffix}`,
        session(s.value.acmeToken),
      )
      assert.equal(
        r.status,
        404,
        `expected 404 for a run with no engine account. Got: ${describeResponse(r)}`,
      )
      const problem = readProblem(r)
      assert.equal(problem.code, 'resource_not_found', describeResponse(r))
      assert.equal(
        r.body?.['title'],
        'No such run account.',
        'THE OPERATION IS NOT MOUNTED — this is the ROUTER answering, not the handler. ' +
          'Both were mounted on 19 Sep 2026 under G300 and G301; if the title has gone back ' +
          'to "No such operation." the entry has been removed from ' +
          '`server/data-plane/start.ts` and the engine read surface is unreachable again. ' +
          `Got: ${describeResponse(r)}`,
      )
    }
  })

  it('a tenant named in a header, a cookie, a query or the path does not widen the by-id read', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)

    // The header form must be IGNORED — headers are not `additionalProperties:
    // false`, because a browser sends a dozen no contract declares.
    const headered = await get(s.value.server.url, `${RUNS_PATH}/${GLOBEX_ONLY}`, {
      ...session(s.value.acmeToken),
      'X-Tenant-Id': GLOBEX,
      'X-Session-Tenant': GLOBEX,
    })
    assert.equal(
      headered.status,
      404,
      `A HEADER NAMING ANOTHER TENANT WIDENED A BY-ID READ. Got: ${describeResponse(headered)}`,
    )

    // 🛑 THE COOKIE FORM, ASSERTED RATHER THAN ARGUED AWAY. Today it cannot
    // reach a handler: fastify parses no cookie without `@fastify/cookie`, which
    // is not a dependency, `principalOf()` reads only `x-session`, and nothing
    // in `server/` touches `request.cookies`. That is four facts about the tree
    // as it stands, and none of them is the property — the property is that a
    // cookie naming another tenant does not widen this read, and the day someone
    // adds the plugin for a session cookie all four go stale silently. An
    // absence this file relies on is an absence this file asserts.
    const cookied = await get(s.value.server.url, `${RUNS_PATH}/${GLOBEX_ONLY}`, {
      ...session(s.value.acmeToken),
      cookie: `tenantId=${GLOBEX}; tenant=${GLOBEX}; app.tenant_id=${GLOBEX}`,
    })
    assert.equal(
      cookied.status,
      404,
      `A COOKIE NAMING ANOTHER TENANT WIDENED A BY-ID READ. Got: ${describeResponse(cookied)}`,
    )
    assert.equal(
      readProblem(cookied).code,
      'resource_not_found',
      `the cookie changed the refusal, which is an existence oracle. Got: ${describeResponse(cookied)}`,
    )

    // The query form must be REFUSED rather than ignored: "ignored and read look
    // identical from outside and only one of them is the property."
    const queried = await get(
      s.value.server.url,
      `${RUNS_PATH}?limit=50&tenantId=${GLOBEX}`,
      session(s.value.acmeToken),
    )
    assert.equal(
      queried.status,
      400,
      'A QUERY PARAMETER NAMING A TENANT WAS NOT REFUSED. `additionalProperties: false` on ' +
        'the querystring with `removeAdditional: false` is invariant 1\'s second line of ' +
        `defence — the attempt must be visible in a status code. Got: ${describeResponse(queried)}`,
    )
  })

  /**
   * G3442 (reaudit RC-10) — A RUN THE ENGINE ACCOUNTED PUBLISHES THE ACCOUNT'S
   * OWN CHANNEL. `NO_ENGINE_ACCOUNT` was published for EVERY run, so a run with
   * a produced account understated what this plane holds and every strip cell
   * on C1 read "no engine account".
   *
   * 🛑 WITNESSED RED BEFORE THE REPAIR: against the pre-G3442 `runs.ts`,
   *    `run_acme_accounted` answered `completeness: null` from both reads.
   *
   * Seeded HERE rather than in `seed()`, after the two-run assertions above,
   * so those keep their exact count.
   */
  it('G3442 · a run with a produced account carries its channel; refused and absent stay `null`', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)

    const client = await migratorClient()
    try {
      for (const [runId, status] of [
        ['run_acme_accounted', 'completed'],
        ['run_acme_short', 'incomplete'],
        ['run_acme_refused', 'failed'],
      ] as const) {
        await client.query(
          `INSERT INTO run (tenant_id, id, definition_id, definition_version, period_id, trigger_kind, status, started_at)
           VALUES ($1, $2, 'def_engine', 1, NULL, 'manual', $3, now() - interval '1 hour')`,
          [ACME, runId, status],
        )
      }
      await client.query(
        `INSERT INTO tenant.run_engine_account (tenant_id, run_id, outcome, terminal_status)
         VALUES ($1, 'run_acme_accounted', 'produced', 'completed'),
                ($1, 'run_acme_short', 'produced', 'incomplete'),
                ($1, 'run_acme_refused', 'refused', NULL)`,
        [ACME],
      )
      await client.query(
        `INSERT INTO tenant.run_completeness (tenant_id, run_id, ordinal, kind, side, presented, admitted, refused)
         VALUES ($1, 'run_acme_short', 0, 'rows_presented_not_admitted', 'left', 10, 8, 2)`,
        [ACME],
      )
    } finally {
      await client.end()
    }

    const expected: Record<string, unknown> = {
      run_acme_accounted: [],
      run_acme_short: [{ kind: 'rows_presented_not_admitted', side: 'left', presented: 10, admitted: 8, refused: 2 }],
      run_acme_refused: null,
      [ACME_INCOMPLETE]: null,
    }
    for (const [runId, want] of Object.entries(expected)) {
      const r = await get(s.value.server.url, `${RUNS_PATH}/${runId}`, session(s.value.acmeToken))
      assert.equal(r.status, 200, describeResponse(r))
      assert.deepEqual(r.body?.['completeness'], want,
        `getRun \`${runId}\` published ${JSON.stringify(r.body?.['completeness'])}; the account holds ${JSON.stringify(want)}`)
    }

    const list = await get(s.value.server.url, `${RUNS_PATH}?limit=50`, session(s.value.acmeToken))
    assert.equal(list.status, 200, describeResponse(list))
    const items = list.body?.['items'] as Array<Record<string, unknown>>
    for (const [runId, want] of Object.entries(expected)) {
      const item = items.find((i) => i['runId'] === runId)
      assert.ok(item !== undefined, `listRuns omitted ${runId}`)
      assert.deepEqual(item['completeness'], want,
        `listRuns \`${runId}\` disagrees with getRun — the two operations must not diverge`)
    }
  })
})

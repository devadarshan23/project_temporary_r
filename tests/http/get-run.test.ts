/**
 * `GET /v1/runs/{runId}` — THE SECOND TENANT-DATA READ THIS SYSTEM SERVES, AND
 * THE ATTACK ON IT.
 *
 * 🛑 WHY THIS FILE EXISTS AT ALL. `tests/http/data-plane-http.test.ts` proves
 * invariant 1 over `listRuns`, and every one of its assertions is about a
 * COLLECTION: a page is filtered, a page leaks, a page is empty. `getRun`
 * addresses ONE ROW BY ID, which is a different attack and a strictly easier one
 * to get wrong — a collection read that forgets its scope returns a suspicious
 * number of rows, and a by-id read that forgets its scope returns exactly the
 * one row the attacker asked for. Mounting it without this file would be adding
 * the more dangerous shape and inheriting the easier shape's evidence.
 *
 * ┌─ WHAT IS ASSERTED ─────────────────────────────────────────────────────────┐
 * │ 1  A session may read its own run by id.                                   │
 * │ 2  A session asking for ANOTHER TENANT'S run by its exact id gets the SAME  │
 * │    404 as for an id that does not exist — not a 403, not a different        │
 * │    message, not a different latency class.                    INVARIANT 1  │
 * │ 3  With RLS DISABLED underneath it, the same request LEAKS. Without this,   │
 * │    assertion 2 is satisfied just as well by a `WHERE tenant_id = $1` in the │
 * │    handler, and the property would be one deleted clause from gone.        │
 * │ 4  A `status` the model does not define is REFUSED rather than published.  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ ASSERTION 2 IS THE ONE THAT NEEDS THE EXACT ID. Asking for a random
 * unknown id proves nothing: the answer is 404 whether scope works or not. The
 * attack is to ask for a run that DEMONSTRABLY EXISTS, by the id it was seeded
 * with, from a session belonging to the other tenant — the only request whose
 * two possible answers distinguish an isolated system from a broken one.
 *
 * ⚠️ THIS FILE USES ITS OWN DATABASE, for the reason the other two HTTP files
 * give: `node --test` runs files concurrently and two files rebuilding one
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

process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_GET_RUN_DB_NAME'] ?? runScopedName('reconcile_get_run_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const RUNS_PATH = `${CAPABILITY_BASE}/runs`

const ACME_RUN = 'run_acme_one'
const GLOBEX_RUN = 'run_globex_one'
/** Seeded for nobody. The control that makes the 404 in assertion 2 legible. */
const ABSENT_RUN = 'run_that_was_never_seeded'

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/http/get-run.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   `GET /v1/runs/{runId}` IS A BY-ID READ OF TENANT DATA. A run of the suite',
      '   in which this file skipped is NOT evidence that one tenant cannot fetch',
      "   another tenant's run by its exact id. Start a PostgreSQL and re-run",
      '   before believing a green suite.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the getRun request-path assertions', probe)

interface Slice {
  readonly server: RunningServer
  readonly acmeToken: string
  readonly globexToken: string
}

let sliceOnce: Promise<{ ok: true; value: Slice } | { ok: false; reason: string }> | undefined

async function seed(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const client = await migratorClient()
  try {
    await client.query('BEGIN')
    for (const [tenant, runId] of [
      [ACME, ACME_RUN],
      [GLOBEX, GLOBEX_RUN],
    ] as const) {
      await client.query(
        `INSERT INTO run
           (tenant_id, id, definition_id, definition_version, period_id,
            trigger_kind, status, started_at)
         VALUES ($1, $2, 'def_one', 1, NULL, 'manual', 'completed', now())`,
        [tenant, runId],
      )
    }
    await client.query('COMMIT')
    return { ok: true }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    return { ok: false, reason: `could not seed \`run\` — ${err instanceof Error ? err.message : String(err)}` }
  } finally {
    await client.end()
  }
}

async function buildSlice(): Promise<{ ok: true; value: Slice } | { ok: false; reason: string }> {
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
  return {
    ok: true,
    value: { server: started.value, acmeToken: acme.value, globexToken: globex.value },
  }
}

function slice(): Promise<{ ok: true; value: Slice } | { ok: false; reason: string }> {
  sliceOnce ??= buildSlice()
  return sliceOnce
}

describe('getRun over HTTP', { skip }, () => {
  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
  })

  after(async () => {
    setLocalTestAuth(false)
    const s = await slice()
    if (s.ok) await s.value.server.close().catch(() => undefined)
  })

  it('a session reads its own run by id', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)

    const r = await get(s.value.server.url, `${RUNS_PATH}/${ACME_RUN}`, session(s.value.acmeToken))
    assert.equal(r.status, 200, `expected 200 for a run this session owns. Got: ${describeResponse(r)}`)
    assert.equal(
      r.body?.['runId'],
      ACME_RUN,
      `the response is not the run that was asked for. Got: ${describeResponse(r)}`,
    )
  })

  it('INVARIANT 1 — another tenant\'s run by its exact id is the SAME 404 as an id that does not exist', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)
    const { server, acmeToken } = s.value

    // The control. Establishes what "not there" looks like from outside.
    const absent = await get(server.url, `${RUNS_PATH}/${ABSENT_RUN}`, session(acmeToken))
    assert.equal(absent.status, 404, `expected 404 for an id nobody seeded. Got: ${describeResponse(absent)}`)

    // The attack. This id EXISTS — it was seeded above for the other tenant.
    const crossed = await get(server.url, `${RUNS_PATH}/${GLOBEX_RUN}`, session(acmeToken))

    assert.equal(
      crossed.status,
      404,
      'INVARIANT 1 IS BROKEN ON A BY-ID READ. An acme session asked for globex\'s run by ' +
        `its exact id \`${GLOBEX_RUN}\` and did not get a 404. "Tenant scope is derived from ` +
        'the session, never read from a request." A 200 here is a cross-tenant read; a 403 ' +
        'is an existence oracle, which `capability.openapi.yaml` refuses in the same words ' +
        'it uses for this endpoint: distinguishing the two "would make this endpoint an ' +
        `existence oracle across the tenant boundary." Got: ${describeResponse(crossed)}`,
    )

    const a = readProblem(absent)
    const b = readProblem(crossed)
    assert.deepEqual(
      { code: b.code, keys: [...b.keys].sort() },
      { code: a.code, keys: [...a.keys].sort() },
      'THE TWO 404s ARE DISTINGUISHABLE, WHICH MAKES THEM AN EXISTENCE ORACLE. A run that ' +
        'does not exist and a run belonging to another tenant must be answered identically — ' +
        'a caller that can tell them apart can enumerate another tenant\'s run ids one ' +
        `request at a time. absent=[${[...a.keys].sort().join(', ')}] code=${String(a.code)} · ` +
        `crossed=[${[...b.keys].sort().join(', ')}] code=${String(b.code)}`,
    )
  })

  it('with RLS DISABLED on `run` the by-id read LEAKS — isolation comes from the database', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)
    const { server, acmeToken } = s.value

    const admin = await migratorClient()
    try {
      await admin.query('ALTER TABLE run DISABLE ROW LEVEL SECURITY')

      const leaked = await get(server.url, `${RUNS_PATH}/${GLOBEX_RUN}`, session(acmeToken))
      assert.equal(
        leaked.status,
        200,
        'TURNING RLS OFF DID NOT CHANGE WHAT THIS ENDPOINT RETURNS, which means the ' +
          'isolation asserted above is NOT coming from the database. Either the handler is ' +
          'filtering by tenant itself — a rule keyed on a convenient landmark, ' +
          'docs/HANDOFF.md §5.1 — or the fixture is not what this file thinks it is. In ' +
          `either case the assertion above is proving nothing. Got: ${describeResponse(leaked)}`,
      )
      assert.equal(leaked.body?.['runId'], GLOBEX_RUN, `expected globex's row to be the one that leaked: ${describeResponse(leaked)}`)
    } finally {
      await admin.query('ALTER TABLE run ENABLE ROW LEVEL SECURITY').catch(() => undefined)
      await admin.end()
    }
  })

  it('a `status` the model does not define is REFUSED rather than published', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)
    const { server, acmeToken } = s.value

    /**
     * `db/migrations/0002_run.sql` puts NO CHECK constraint on `status`, in
     * writing and on purpose — "a third copy here would be a third place to
     * drift". So this UPDATE succeeds, and that is exactly the hole
     * `server/data-plane/run-vocabulary.ts` exists to close: the model is the
     * authority on what a run status is, and it now says so at the read
     * boundary rather than after the value has reached a consumer.
     */
    const admin = await migratorClient()
    try {
      await admin.query('UPDATE run SET status = $1 WHERE id = $2', ['abandoned', ACME_RUN])

      const r = await get(server.url, `${RUNS_PATH}/${ACME_RUN}`, session(acmeToken))
      assert.equal(
        r.status,
        500,
        'AN UNMODELLED `status` REACHED THE WIRE. `fast-json-stringify` serialises a ' +
          'response against the declared schema; it does not VALIDATE one, so a value the ' +
          'contract\'s own enum forbids is published verbatim and the consumer meets a word ' +
          'its contract says cannot occur. `RunStatus` (model/domain.ts) is the authority ' +
          `and the read boundary is where it has to be asked. Got: ${describeResponse(r)}`,
      )
      assert.ok(
        !r.text.includes('abandoned'),
        `the refusal quoted the offending value back to the caller: ${describeResponse(r)}. ` +
          '`errors.yaml` forbids `detail` from carrying field values.',
      )
    } finally {
      await admin.query('UPDATE run SET status = $1 WHERE id = $2', ['completed', ACME_RUN]).catch(() => undefined)
      await admin.end()
    }
  })
})

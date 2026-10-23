/**
 * `admitRun` PUBLISHES `(tenantId, runId)` AFTER THE TRANSACTION COMMITS —
 * over a real socket, a real PostgreSQL, real RLS and the PRODUCTION
 * authoriser and substrate. **R-B, 20 Sep 2026, THE OWNER'S RULING.**
 *
 * ┌─ THE RED THIS SUITE DISCHARGES, MEASURED BEFORE A LINE WAS WRITTEN ────────┐
 * │                                                                            │
 * │   grep -rniE '\bsqs\b'  server/                     ->  0                   │
 * │   git ls-files server | grep -ci worker             ->  0                   │
 * │   grep -rnE 'UPDATE run|FOR UPDATE' server/         ->  0                   │
 * │   grep -c 'aws-sdk' package.json                    ->  0                   │
 * │                                                                            │
 * │ **A run was admitted and sat in `queued` for ever, with nothing anywhere    │
 * │ told about it.** Not a bug in anything — an absence, and the whole of what  │
 * │ R-B fills.                                                                  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS ASSERTED, AND WHICH CONTROL EACH ONE IS ──────────────────────────┐
 * │ 1  A 201 publishes EXACTLY ONE message, carrying the tenant the session is │
 * │    bound to and the run id the response carries.                  R-B      │
 * │ 2  🛑 THE MESSAGE CARRIES THE TENANT FROM THE **GRANT**, NOT FROM THE      │
 * │    REQUEST — asserted by there being no way to say one: the body schema    │
 * │    has no `tenantId` and ajv REJECTS one rather than stripping it.         │
 * │                                                                  INVARIANT 1│
 * │ 3  🛑 A REFUSED PRESS PUBLISHES NOTHING. Without this, assertion 1 passes  │
 * │    against a publisher wired to fire on every request.             §5.6     │
 * │ 4  A SECOND PRESS OF THE SAME BASIS answers `deduplicated`, creates NO     │
 * │    SECOND RUN — and PUBLISHES AGAIN, on the SAME run id. That is the       │
 * │    recovery story for a message lost between COMMIT and send, and if this  │
 * │    arm did not publish, the one repair the design offers would be the one  │
 * │    thing that did not work.                        run-queue.ts §2          │
 * │ 5  🛑 THE PUBLISH IS **AFTER THE COMMIT**: the run row is readable by an   │
 * │    independent connection at the moment the publisher runs. Witnessed by   │
 * │    the publisher itself reading `public.run` as the migrator.              │
 * │ 6  A PUBLISHER THAT THROWS DOES NOT CHANGE THE ANSWER — the act has        │
 * │    committed, so the 201 stands and the run row stands.                     │
 * │ 7  A plane with NO queue configured still admits, and the unconfigured     │
 * │    publisher is LOUD rather than silent.                                    │
 * │ 8  🛑 THE TWO HALVES JOIN: the message `admitRun` ACTUALLY PUBLISHED, fed  │
 * │    to `claimAdmittedRun()`, reaches that run. Neither half is asserted     │
 * │    against a message a test wrote.                                          │
 * │ 9  🛑 AND THE SAME MESSAGE WITH ITS TENANT SWAPPED REACHES NOTHING — the   │
 * │    cross-tenant negative control, on a REAL published message.  INVARIANT 1│
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 WHY THE PUBLISHER IS A PARAMETER AND NOT A QUEUE ──────────────────────┐
 * │ `tests/reachability.ts`: a green run must not depend on an unreachable     │
 * │ dependency. A suite that proved this by reaching SQS would SKIP on every   │
 * │ machine with no AWS account — forbidden here — and `npm run check` must    │
 * │ pass with no credentials at all. So `startDataPlane()` admits a            │
 * │ `publishRun`, on the EPHEMERAL-PORT path alone; `listenDataPlane()` takes  │
 * │ no such option and never will, which is assertion 4 of                     │
 * │ `tests/http/deployed-path-cannot-be-permissive.test.ts`'s shape applied to │
 * │ a third seam. **The transport itself is proven, command by command,        │
 * │ against a fake dispatch in `tests/http/run-queue-transport.test.ts`.**     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { createAppPool } from '../../db/tenant-scope.ts'
import { claimAdmittedRun } from '../../server/data-plane/run-worker.ts'
import type { RunAdmittedMessage } from '../../server/data-plane/run-queue.ts'
import type { TenantId } from '../../model/kernel.ts'
import { CAPABILITIES } from '../../model/access.ts'
import { sessionCookie } from './harness.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_RUN_QUEUE_DB_NAME'] ?? runScopedName('reconcile_run_queue_test')

/**
 * ⚠️ AN ASSERTION IN DISGUISE, AND THE SAME ONE `slot-fill-served` MAKES. With
 * `RECONCILE_LOCAL_TEST_AUTH` set, the plane gains an arm that authenticates a
 * signed token and resolves NO SUBJECT — so a minting handler would have
 * nobody to mint invariant 10's record for and would answer 500. Deleting it
 * means the 201 below cannot have come from anywhere but a row.
 */
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

/**
 * ⚠️ AND SO IS THIS. `startDataPlane()` falls back to
 * `resolveRunQueuePublisher()` when no `publishRun` is passed, and §7 relies on
 * that fallback choosing the UNCONFIGURED publisher rather than constructing an
 * `SQSClient` against whatever a developer's shell happens to export.
 */
delete process.env['RECONCILE_RUN_QUEUE_URL']
delete process.env['RECONCILE_RUN_QUEUE_ENDPOINT']

const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'
const GLOBEX_HOST = 'globex.ap-southeast-1.reconcile.invalid'

process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active,` +
  `${GLOBEX_HOST}|ten_globex|ap-southeast-1|pooled|active`

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const DOOR = 'idc_acme_entra'
const MEI = 'usr_ops_mei'
const ROLE_OPERATOR = 'rol_ap_operator'
const HANDLE = 'sx_queue_1a2b3c4d5e6f708192a3b4c5d6e7f809'

/** Active, no slots at all — so a bare press admits. */
const DEF_ACTIVE = 'def_acme_ap_close'
/** Draft — §3's refusal. */
const DEF_DRAFT = 'def_acme_draft'

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/http/run-queue-publish.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER `admitRun` PUBLISHING AT ALL. A run in',
      '   which it skipped is NOT evidence that an admitted run is announced,',
      '   NOT evidence that a refused press stays silent, and NOT evidence that',
      '   the `deduplicated` arm — which is the WHOLE of R-B`s recovery story —',
      '   publishes.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the run-queue publish assertions', probe)

/* ------------------------------------------------------------------ *
 * `node:http` RATHER THAN `fetch`, for `slot-fill-served`'s reason: undici
 * derives `Host` from the URL on some paths and G180 REVOKES the session on a
 * mismatch, so one wrong `Host` would make every later assertion a statement
 * about a revoked session.
 * ------------------------------------------------------------------ */

interface Response {
  readonly status: number
  readonly body: Record<string, unknown> | undefined
  readonly text: string
}

function send(
  origin: string,
  method: string,
  path: string,
  opts: { body?: unknown } = {},
): Promise<Response> {
  const url = new URL(origin)
  const payload = opts.body === undefined ? undefined : JSON.stringify(opts.body)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method,
        headers: {
          Host: ACME_HOST,
          ...sessionCookie(HANDLE),
          ...(payload === undefined
            ? {}
            : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }),
        },
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          text += chunk
        })
        res.on('end', () => {
          let body: Record<string, unknown> | undefined
          try {
            const parsed: unknown = JSON.parse(text)
            body =
              typeof parsed === 'object' && parsed !== null
                ? (parsed as Record<string, unknown>)
                : undefined
          } catch {
            body = undefined
          }
          resolve({ status: res.statusCode ?? 0, body, text })
        })
      },
    )
    req.on('error', reject)
    if (payload !== undefined) req.write(payload)
    req.end()
  })
}

const pressRun = (origin: string, body: unknown) => send(origin, 'POST', '/v1/runs', { body })

async function asMigrator<T>(
  fn: (q: (sql: string, p?: readonly unknown[]) => Promise<{ rows: unknown[] }>) => Promise<T>,
): Promise<T> {
  const mig = await migratorClient()
  try {
    return await fn((sql, p = []) => mig.query(sql, p as unknown[]) as Promise<{ rows: unknown[] }>)
  } finally {
    await mig.end()
  }
}

/**
 * ⚠️ `runId` AND NOT `id` — the wire's `Run` names its identity `runId` while
 * `public.run`'s column is `id`, and the first draft of `admittedRunOf()` in
 * `server/data-plane/run-admission.ts` read the column name. **Its guard
 * caught that on this suite's first run**, printing its own line instead of
 * publishing a message built out of `undefined`.
 */
const runIdOf = (res: Response): string =>
  ((res.body?.['run'] as Record<string, unknown> | undefined)?.['runId'] as string | undefined) ??
  ''

/* ------------------------------------------------------------------ *
 * THE RECORDING PUBLISHER.
 *
 * 🛑 IT READS `public.run` AS THE MIGRATOR, AND THAT READ IS ASSERTION 5.
 * A publisher that only recorded its argument could not tell a publish AFTER
 * the commit from one INSIDE the transaction — and which of the two this is
 * the whole of `server/data-plane/run-queue.ts` §2's argument. An independent
 * connection can only see the row if the transaction has already committed.
 * ------------------------------------------------------------------ */

interface Recorded {
  readonly message: RunAdmittedMessage
  /** How many rows an INDEPENDENT connection could see for that run, then. */
  readonly visibleRows: number
}

function recorder(): {
  publish: (m: RunAdmittedMessage) => Promise<void>
  readonly seen: Recorded[]
} {
  const seen: Recorded[] = []
  return {
    seen,
    publish: async (message) => {
      const visibleRows = await asMigrator(async (q) => {
        const r = await q('SELECT id FROM run WHERE tenant_id = $1 AND id = $2', [
          message.tenantId,
          message.runId,
        ])
        return r.rows.length
      })
      seen.push({ message, visibleRows })
    },
  }
}

/* ------------------------------------------------------------------ *
 * THE FIXTURE. Modelled on `tests/http/slot-fill-served.test.ts`'s, minus the
 * slots: this suite is about the PUBLISH and not about admission, so every
 * definition here has no slot at all and a bare press admits.
 * ------------------------------------------------------------------ */

async function seedSubstrate(): Promise<void> {
  const digest = digestOfHandle(HANDLE)
  assert.notEqual(digest, null, 'the fixture handle digested to nothing')

  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme',
               'https://login.microsoftonline.com/acme-queue/v2.0',
               'acme-entra-queue', 'active')`,
      [DOOR],
    )
    await mig.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES ($1, 'mei@acme.invalid', 'Mei Tan', 'active', $2)`,
      [MEI, DOOR],
    )
    await mig.query(
      `INSERT INTO tenant.role
         (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ($1, $2, 'AP Operator', 'operator', 1, 'operator', 'pack', 'pck_ap', 'active')`,
      [ACME, ROLE_OPERATOR],
    )
    await mig.query(
      `INSERT INTO tenant.role_capability (tenant_id, role_id, capability)
       VALUES ($1, $2, $3)`,
      [ACME, ROLE_OPERATOR, CAPABILITIES.triggerRun],
    )
    await mig.query(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version,
          granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'ras_mei', $2, $3, 1, 'usr_acme_admin', now(), NULL, NULL)`,
      [ACME, MEI, ROLE_OPERATOR],
    )
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_queue_mei', $1, $2, $3, $4, $5, now(), now(),
               now() + interval '12 hours', NULL)`,
      [digest, MEI, DOOR, ACME, ACME_HOST],
    )
    await mig.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'mem_queue_mei', $2, 'rol_member', 'bootstrap', now(), NULL, NULL)`,
      [ACME, MEI],
    )
    await mig.query(
      `INSERT INTO tenant.reconciliation_definition (tenant_id, id, version, status)
       VALUES ($1, $2, 3, 'active'), ($1, $3, 1, 'draft')`,
      [ACME, DEF_ACTIVE, DEF_DRAFT],
    )
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

describe('an admitted run is published to the run queue', { skip }, () => {
  let plane: { url: string; close(): Promise<void> }
  let queue: ReturnType<typeof recorder>

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedSubstrate()
    queue = recorder()
    /*
     * 🛑 NO `authorise` AND NO `substrate` — the PRODUCTION seams, which is
     * what makes a 201 evidence. `publishRun` is the only option, and it
     * observes a decided act rather than deciding one.
     */
    plane = await startDataPlane({ poolMax: 6, publishRun: queue.publish })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
  })

  /* ================================================================ *
   * §0 · THE ANTI-VACUOUS CONTROL. Without it every silence below is
   *      evidence that the router refuses everything.
   * ================================================================ */

  it('0 · a path the contract does not declare answers the ROUTER`s 404', async () => {
    const res = await send(plane.url, 'GET', '/v1/runs/not/a/declared/path')
    assert.equal(res.status, 404)
    assert.equal(res.body?.['title'], 'No such operation.')
    assert.equal(queue.seen.length, 0, 'a 404 from the router published a run-queue message')
  })

  /* ================================================================ *
   * §1 · THE ALLOW ARM. One press, one 201, one message.
   * ================================================================ */

  it('1 · a 201 publishes EXACTLY ONE message carrying the bound tenant and the admitted run', async () => {
    const before = queue.seen.length
    const res = await pressRun(plane.url, { definitionId: DEF_ACTIVE })

    assert.equal(res.status, 201, `admitRun did not admit: ${res.text}`)
    assert.equal(res.body?.['outcome'], 'admitted')

    const published = queue.seen.slice(before)
    assert.equal(published.length, 1, `one press published ${published.length} message(s)`)

    const only = published[0]
    assert.notEqual(only, undefined)
    assert.equal(only?.message.kind, 'run_admitted')
    assert.equal(
      only?.message.tenantId,
      ACME,
      'the message named a tenant other than the one the session is bound to',
    )
    assert.equal(
      only?.message.runId,
      runIdOf(res),
      'the message named a run other than the one the response published',
    )
  })

  /* ================================================================ *
   * §2 · INVARIANT 1. The tenant on the message comes from the GRANT,
   *      and a request CANNOT name one — ajv rejects rather than strips.
   * ================================================================ */

  it('2 · a body that STATES a tenant is refused outright, so no message can carry a request-supplied one', async () => {
    const before = queue.seen.length
    const res = await pressRun(plane.url, { definitionId: DEF_ACTIVE, tenantId: GLOBEX })

    assert.equal(
      res.status,
      400,
      'a request body carrying `tenantId` was SERVED. `admitRun`s requestBody is ' +
        '`additionalProperties: false` and `server/http/app.ts` sets ' +
        '`removeAdditional: false` precisely so the key is REJECTED rather than silently ' +
        'stripped — a stripped key satisfies invariant 1 and leaves no evidence that it did.',
    )
    assert.equal(
      queue.seen.length,
      before,
      'a request refused by the VALIDATOR published a run-queue message',
    )
  })

  /* ================================================================ *
   * §3 · THE REFUSAL ARM. Without this, §1 passes against a publisher
   *      wired to fire on every request. §5.6.
   * ================================================================ */

  it('3 · a REFUSED press publishes nothing at all', async () => {
    const before = queue.seen.length
    const res = await pressRun(plane.url, { definitionId: DEF_DRAFT })

    assert.equal(res.status, 422, `a draft definition was admitted: ${res.text}`)
    assert.equal(
      queue.seen.length,
      before,
      'a 422 from `admitRun` published a run-queue message. `afterCommit` must see the ' +
        'refusal arm`s return value — a `FastifyReply` — and publish nothing.',
    )
  })

  /* ================================================================ *
   * §4 · THE RECOVERY STORY. `deduplicated` PUBLISHES.
   * ================================================================ */

  it('4 · a second press of the same basis answers `deduplicated`, makes NO second run, and PUBLISHES AGAIN', async () => {
    const first = await pressRun(plane.url, { definitionId: DEF_ACTIVE })
    assert.ok(
      first.status === 201 || first.status === 200,
      `the first press of this basis was neither 201 nor 200: ${first.text}`,
    )

    const before = queue.seen.length
    const again = await pressRun(plane.url, { definitionId: DEF_ACTIVE })

    assert.equal(again.status, 200, `the second press was not 200: ${again.text}`)
    assert.equal(again.body?.['outcome'], 'deduplicated')
    assert.equal(runIdOf(again), runIdOf(first), 'the deduplicated arm named a different run')

    const published = queue.seen.slice(before)
    assert.equal(
      published.length,
      1,
      'the `deduplicated` arm published ' +
        `${published.length} message(s). It must publish EXACTLY ONE: ` +
        '`server/data-plane/run-queue.ts` §2 takes the publish AFTER the commit, which loses ' +
        'the message if the process dies in between, and the repair it names is the operator ' +
        'pressing Run again. If this arm did not publish, that repair would be the one thing ' +
        'that did not work.',
    )
    assert.equal(published[0]?.message.runId, runIdOf(first))

    const rows = await asMigrator(async (q) => {
      const r = await q(
        "SELECT id FROM run WHERE tenant_id = $1 AND definition_id = $2",
        [ACME, DEF_ACTIVE],
      )
      return r.rows.length
    })
    assert.equal(
      rows,
      1,
      `two presses of one basis made ${rows} runs. \`run_idempotency_key\` is a UNIQUE INDEX ` +
        'and `ON CONFLICT (tenant_id, idempotency_key) DO NOTHING` is how it is read.',
    )
  })

  /* ================================================================ *
   * §5 · THE ORDERING. The row is visible to an INDEPENDENT connection
   *      at the moment the publisher runs — so the publish is AFTER the
   *      COMMIT and not inside the transaction.
   * ================================================================ */

  it('5 · every message published so far named a run an INDEPENDENT connection could already see', () => {
    assert.ok(queue.seen.length > 0, 'nothing was published, so this assertion is vacuous')
    for (const record of queue.seen) {
      assert.equal(
        record.visibleRows,
        1,
        `a message for run \`${record.message.runId}\` was published while an independent ` +
          'connection could not see that row. The publish would then be INSIDE the admitting ' +
          'transaction — and a message for a run that may roll back hands the worker an id it ' +
          'cannot find, which `run_rls` cannot tell from another tenant`s run. See ' +
          '`server/data-plane/run-queue.ts` §2.',
      )
    }
  })

  /* ================================================================ *
   * §6 · A PUBLISHER THAT THROWS MUST NOT CHANGE THE ANSWER.
   * ================================================================ */

  it('6 · a publisher that throws leaves the 201 and the run row exactly as they were', async () => {
    const angry = await startDataPlane({
      poolMax: 2,
      publishRun: async () => {
        throw new Error('the queue is on fire')
      },
    })
    try {
      const res = await send(angry.url, 'POST', '/v1/runs', {
        body: { definitionId: DEF_ACTIVE, periodId: null },
      })
      /*
       * The same basis as §4, so this is the `deduplicated` arm — which is what
       * makes the assertion sharp: the act ran, the publisher threw, and the
       * caller still got the act's own answer.
       */
      assert.ok(
        res.status === 200 || res.status === 201,
        'a publisher that threw AFTER the commit turned the act`s answer into ' +
          `${res.status}. \`runAfterCommit()\` catches, because the act has committed and ` +
          `telling an operator that a run which exists does not is the worse answer: ${res.text}`,
      )
      const rows = await asMigrator(async (q) => {
        const r = await q('SELECT id FROM run WHERE tenant_id = $1 AND definition_id = $2', [
          ACME,
          DEF_ACTIVE,
        ])
        return r.rows.length
      })
      assert.equal(rows, 1, 'a throwing publisher changed what is in `public.run`')
    } finally {
      await angry.close()
    }
  })

  /* ================================================================ *
   * §7 · NO QUEUE CONFIGURED. The plane still admits, and the
   *      unconfigured publisher is LOUD.
   * ================================================================ */

  it('7 · a plane with NO queue configured still admits, and says so on stderr rather than silently', async () => {
    const said: string[] = []
    const realError = console.error
    console.error = (...args: unknown[]) => {
      said.push(args.map((a) => String(a)).join(' '))
    }
    const bare = await startDataPlane({ poolMax: 2 })
    try {
      const res = await send(bare.url, 'POST', '/v1/runs', {
        body: { definitionId: DEF_ACTIVE, periodId: null },
      })
      assert.ok(
        res.status === 200 || res.status === 201,
        `a plane with no run queue refused to admit a run: ${res.text}`,
      )
    } finally {
      await bare.close()
      console.error = realError
    }

    const loud = said.some((line) => line.includes('NO RUN QUEUE IS CONFIGURED'))
    assert.ok(
      loud,
      'a plane with no run queue admitted a run and said NOTHING. A silent no-op here is a ' +
        'run nobody collects and nobody knows about; `unconfiguredRunQueue()` names both ids ' +
        `and names the repair. What was said: ${JSON.stringify(said)}`,
    )
  })

  /* ================================================================ *
   * §8 · 🛑 THE TWO HALVES, JOINED. The message the HANDLER published,
   *      handed to the WORKER, with nothing in between written by a test.
   * ================================================================ */

  it('8 · the message `admitRun` actually published reaches that run in the worker', async () => {
    const published = queue.seen.at(-1)
    assert.notEqual(published, undefined, 'nothing has been published, so this is vacuous')
    if (published === undefined) return

    const pool = await createAppPool(1)
    try {
      const claim = await claimAdmittedRun(pool, published.message)
      assert.equal(
        claim.kind,
        'reached',
        'the worker could not reach a run the handler had just published. **This is the ' +
          'whole of R-B end to end**, and the two halves are asserted against each other ' +
          'here rather than each against a message a test wrote.',
      )
      if (claim.kind !== 'reached') return
      assert.equal(claim.run.runId, published.message.runId)
      assert.equal(claim.run.tenantId, ACME)
      assert.equal(
        claim.run.status,
        'queued',
        'the run the worker reached is not `queued`. Nothing moves a status: ' +
          '`server/data-plane/run-worker.ts` is the SEAM and not the executor.',
      )
    } finally {
      await pool.end()
    }
  })

  /* ================================================================ *
   * §9 · 🛑 THE NEGATIVE, ON THE SAME REAL MESSAGE. Swap the tenant and
   *      the worker reaches nothing — which is why R-B was taken over a
   *      scan, witnessed here on bytes the handler produced.
   * ================================================================ */

  it('9 · the same published message with its tenant swapped to globex reaches NOTHING', async () => {
    const published = queue.seen.at(-1)
    assert.notEqual(published, undefined)
    if (published === undefined) return

    const pool = await createAppPool(1)
    try {
      const forged: RunAdmittedMessage = {
        ...published.message,
        tenantId: GLOBEX as TenantId,
      }
      const claim = await claimAdmittedRun(pool, forged)
      assert.equal(
        claim.kind,
        'run_not_visible',
        'A MESSAGE NAMING GLOBEX REACHED AN ACME RUN. `claimAdmittedRun()` opens ' +
          '`withTenantScope(pool, message.tenantId)` and its SQL carries no tenant predicate, ' +
          'so `run_rls` is what refuses — this failing means the POLICY is not doing it, and ' +
          'whoever can write to the queue could read any tenant`s run by naming their own.',
      )
    } finally {
      await pool.end()
    }
  })
})

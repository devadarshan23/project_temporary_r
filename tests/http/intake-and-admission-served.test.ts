/**
 * C1 · THE CHANNELS AND C5 · PRESS RUN, SERVED — over a socket, against the
 * PRODUCTION authoriser and the PRODUCTION substrate reader. G691–G694,
 * 19 Sep 2026.
 *
 * ┌─ WHAT MAKES A GREEN RUN HERE WORTH ANYTHING ───────────────────────────────┐
 * │ `startDataPlane({ poolMax: 1 })` — NO `authorise` argument and NO          │
 * │ `substrate` argument. Both default to the production seams,                │
 * │ `sessionCapabilities` and `substrateFromSession`, so every 200 and every   │
 * │ 201 below went through `decide()` on rows. `RECONCILE_LOCAL_TEST_AUTH` is  │
 * │ DELETED, so `X-Session` resolves nothing and the cookie is a raw handle    │
 * │ digested by the one seam and read out of `tenant.session`.                 │
 * │                                                                            │
 * │ ⚠️ `poolMax: 1` IS ADVERSARIAL ON PURPOSE: the session scope and the       │
 * │ handler's own tenant scope are forced onto the connection the previous     │
 * │ one released.                                                              │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ §5 IS THE POINT OF THE FILE ──────────────────────────────────────────────┐
 * │ `tests/http/engine-on-served-path.test.ts` §4 has carried an unmet `todo`  │
 * │ since 16 Aug 2026 — *"a body carrying `tenantId` … reaches no validator at │
 * │ all. A 404 here means `admitRun` is not mounted; a 2xx would mean it is    │
 * │ mounted and the key was accepted, which is strictly worse."* That `todo`   │
 * │ is converted to a live assertion in this commit, and §5 here is its        │
 * │ companion: the SAME request minus the illegal key is a 201, so the 400 is  │
 * │ evidence about the KEY and not about the route.                            │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS ASSERTED ─────────────────────────────────────────────────────────┐
 * │ 0  🛑 THE ANTI-VACUOUS CONTROL, FIRST: a path the contract does NOT        │
 * │    declare 404s with the ROUTER's own title. Without it every "is not      │
 * │    200" below passes against a plane that mounts nothing.                  │
 * │ 1  `listIntakeChannels` returns FOUR entries in the model's declaration    │
 * │    order — including the kinds with no lane.                               │
 * │ 2  `wired` is `enabled AND legal`: a MALFORMED lane that is switched on    │
 * │    reports `false`.                          G691 · guardIntakeChannel()   │
 * │ 3  `lastArrivalAt` is derived from `tenant.arrival` and counts a REFUSED   │
 * │    arrival.                                                                │
 * │ 4  INVARIANT 1 — another tenant's lane does not reach this answer.         │
 * │ 5  🛑 THE BODY IS VALIDATED BY THE CONTRACT: `tenantId` → 400, and the     │
 * │    same body without it → 201.                                 G694        │
 * │ 6  A second identical press is 200 `deduplicated`, ONE run in the table.   │
 * │ 7  The refusals, by name: draft, absent, closed period, absent period,     │
 * │    unfilled required slot.                          G692 · G693            │
 * │ 8  INVARIANT 1 — another tenant's definition, by its EXACT id, answers as  │
 * │    an id nobody seeded.                                                    │
 * │ 9  THE GATE — a session holding `admit_source` and not `trigger_run` reads │
 * │    the channels and cannot press Run.                          G200        │
 * │ 10 INVARIANT 10 — the admission minted a record, in the act's own          │
 * │    transaction.                                                G301        │
 * │ 11 The four C1/C2/C5 operations that are NOT mounted answer the ROUTER's   │
 * │    404.                                                        G300        │
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
import { CAPABILITIES } from '../../model/access.ts'
import { INTAKE_CHANNEL_KINDS } from '../../model/ingestion.ts'
import { sessionCookie } from './harness.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_INTAKE_SERVED_DB_NAME'] ?? runScopedName('reconcile_intake_served_test')

/**
 * ⚠️ AN ASSERTION IN DISGUISE. With `RECONCILE_LOCAL_TEST_AUTH` set,
 * `resolveSessionReader()` adds an arm that authenticates a signed token and
 * resolves NO SUBJECT — and a minting handler handed that session has nobody
 * to mint invariant 10's record for. Deleting it means the 2xxs below cannot
 * have come from anywhere but a row.
 */
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'
const GLOBEX_HOST = 'globex.ap-southeast-1.reconcile.invalid'

process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active,` +
  `${GLOBEX_HOST}|ten_globex|ap-southeast-1|pooled|active`

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const DOOR = 'idc_acme_entra'

/** Holds `admit_source` AND `trigger_run`. */
const MEI = 'usr_ops_mei'
/** Holds `admit_source` ONLY — §9's differential. */
const VIK = 'usr_ops_vik'
const ROLE_OPERATOR = 'rol_ap_operator'
const ROLE_VIEWER = 'rol_ap_viewer'

const HANDLE = 'sx_mei_1a2b3c4d5e6f708192a3b4c5d6e7f809'
const HANDLE_VIEWER = 'sx_vik_9f8e7d6c5b4a30291817263544536271'

const DEF_ACTIVE = 'def_acme_ap_close'
const DEF_DRAFT = 'def_acme_draft'
const DEF_REQUIRED_SLOT = 'def_acme_needs_invoice'
const DEF_GLOBEX = 'def_globex_ap_close'
const NEVER_SEEDED = 'def_no_such_definition_anywhere'

const PERIOD_OPEN = 'per_acme_2026_03'
const PERIOD_CLOSED = 'per_acme_2026_02'
const PERIOD_NEVER_SEEDED = 'per_no_such_period'

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/http/intake-and-admission-served.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER THE TWO OPERATIONS G691 AND G694 MOUNTED.',
      '   A run in which it skipped is NOT evidence that a request body is',
      '   validated by the contract, NOT evidence that pressing Run twice makes',
      '   one run, and NOT evidence that another tenant`s definition is',
      '   invisible when asked for by its exact id.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the served intake and run-admission assertions', probe)

/* ------------------------------------------------------------------ *
 * A RAW HTTP CLIENT, AND `node:http` RATHER THAN `fetch`: undici derives the
 * `Host` header from the URL on some paths, and G180's binding check compares
 * it against `Session.issuedHost` on EVERY request — and REVOKES the session
 * on a mismatch, so one wrong Host would make every later assertion in this
 * file a statement about a revoked session.
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
  opts: { headers?: Record<string, string>; body?: unknown; session?: string } = {},
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
          ...sessionCookie(opts.session ?? HANDLE),
          ...(payload === undefined
            ? {}
            : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }),
          ...(opts.headers ?? {}),
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

const get = (origin: string, path: string, opts: Parameters<typeof send>[3] = {}) =>
  send(origin, 'GET', path, opts)
const post = (origin: string, path: string, body: unknown, session?: string) =>
  send(origin, 'POST', path, session === undefined ? { body } : { body, session })

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

const runCount = () =>
  asMigrator(async (q) => {
    const r = await q("SELECT count(*)::int AS n FROM run WHERE tenant_id = 'ten_acme'")
    return (r.rows[0] as { n: number } | undefined)?.n ?? 0
  })

const grantCount = () =>
  asMigrator(async (q) => {
    const r = await q('SELECT count(*)::int AS n FROM tenant.authorization_grant')
    return (r.rows[0] as { n: number } | undefined)?.n ?? 0
  })

/* ------------------------------------------------------------------ *
 * THE FIXTURE.
 *
 * ⚠️ IT SEEDS A `tenant.membership` ROW FOR EACH PERSON AND THAT IS NOT
 * DECORATION — G641. A bound session is a state only `selectTenantForSession()`
 * can produce, and it binds on a LIVE membership; since G641 the per-request
 * path re-asks that question on EVERY request. A fixture that forged a bound
 * session with no membership would forge a state the product cannot reach.
 * ------------------------------------------------------------------ */

async function seedSubstrate(): Promise<void> {
  const digest = digestOfHandle(HANDLE)
  const viewerDigest = digestOfHandle(HANDLE_VIEWER)
  assert.notEqual(digest, null, 'the fixture handle digested to nothing')
  assert.notEqual(viewerDigest, null, 'the viewer handle digested to nothing')

  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    /* G305: a handle is present EXACTLY WHEN the protocol is brokered. */
    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme',
               'https://login.microsoftonline.com/acme-intake/v2.0',
               'acme-entra-intake', 'active')`,
      [DOOR],
    )
    for (const [user, email, name] of [
      [MEI, 'mei@acme.invalid', 'Mei Tan'],
      [VIK, 'vik@acme.invalid', 'Vik Rao'],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
         VALUES ($1, $2, $3, 'active', $4)`,
        [user, email, name, DOOR],
      )
    }
    await mig.query(
      `INSERT INTO tenant.role
         (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ($1, $2, 'AP Operator', 'operator', 1, 'operator', 'pack', 'pck_ap', 'active'),
              ($1, $3, 'AP Viewer',   'viewer',   1, 'viewer',   'pack', 'pck_ap', 'active')`,
      [ACME, ROLE_OPERATOR, ROLE_VIEWER],
    )
    /* Mei holds both verbs; Vik holds `admit_source` only. §9's differential. */
    await mig.query(
      `INSERT INTO tenant.role_capability (tenant_id, role_id, capability)
       VALUES ($1, $2, $4), ($1, $2, $5), ($1, $3, $4)`,
      [ACME, ROLE_OPERATOR, ROLE_VIEWER, CAPABILITIES.admitSource, CAPABILITIES.triggerRun],
    )
    await mig.query(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version,
          granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'ras_mei', $2, $4, 1, 'usr_acme_admin', now(), NULL, NULL),
              ($1, 'ras_vik', $3, $5, 1, 'usr_acme_admin', now(), NULL, NULL)`,
      [ACME, MEI, VIK, ROLE_OPERATOR, ROLE_VIEWER],
    )
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_i_mei', $1, $3, $5, $6, $7, now(), now(), now() + interval '12 hours', NULL),
              ('ses_i_vik', $2, $4, $5, $6, $7, now(), now(), now() + interval '12 hours', NULL)`,
      [digest, viewerDigest, MEI, VIK, DOOR, ACME, ACME_HOST],
    )
    await mig.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'mem_i_mei', $2, 'rol_member', 'bootstrap', now(), NULL, NULL),
              ($1, 'mem_i_vik', $3, 'rol_member', 'bootstrap', now(), NULL, NULL)`,
      [ACME, MEI, VIK],
    )

    /* ---- C1 · FOUR LANES, THREE OF THE FOUR KINDS, ONE OF THEM BROKEN ---- */
    await mig.query(
      `INSERT INTO tenant.intake_channel (tenant_id, id, kind, endpoint_id, enabled)
       VALUES ($1, 'ich_upload',  'upload',         NULL,       true),
              ($1, 'ich_mailbox', 'mailbox',        'end_mail', true),
              -- MALFORMED AND SWITCHED ON: a drawing lane with no endpoint.
              -- guardIntakeChannel() returns a defect and section 2 requires
              -- this kind to report wired:false.
              ($1, 'ich_drop',    'watched_drop',   NULL,       true),
              -- Legal and switched OFF.
              ($1, 'ich_pull',    'connector_pull', 'end_pull', false),
              ($2, 'ich_globex_mailbox', 'mailbox', 'end_g',    true)`,
      [ACME, GLOBEX],
    )
    /* Two arrivals on the upload lane: one ADMITTED, one REFUSED and LATER.
       §3 requires the max over BOTH — G205's file 39,998. */
    await mig.query(
      `INSERT INTO tenant.arrival
         (tenant_id, id, channel_id, channel_kind, endpoint_id, authorization_id,
          arrived_at, verdict_kind, refusal_kind, source_document_id)
       VALUES ($1, 'arr_ok',      'ich_upload', 'upload', NULL, 'azg_standing',
               timestamptz '2026-09-18 08:00:00+00', 'admitted', NULL, 'doc_acme_1'),
              ($1, 'arr_refused', 'ich_upload', 'upload', NULL, 'azg_standing',
               timestamptz '2026-09-19 09:30:00+00', 'refused', 'arrival_is_empty', NULL),
              ($2, 'arr_globex',  'ich_globex_mailbox', 'mailbox', 'end_g', 'azg_standing',
               timestamptz '2026-09-19 23:00:00+00', 'admitted', NULL, NULL)`,
      [ACME, GLOBEX],
    )
    await mig.query(
      `INSERT INTO tenant.source_document (tenant_id, id, arrival_id, document_type_id, ingested_at)
       VALUES ($1, 'doc_acme_1', 'arr_ok', 'dt_invoice', now())`,
      [ACME],
    )

    /* ---- C5 · THE DEFINITIONS, THE SLOTS AND THE PERIODS ---- */
    await mig.query(
      `INSERT INTO tenant.reconciliation_definition (tenant_id, id, version, status)
       VALUES ($1, $3, 7, 'active'),
              ($1, $4, 1, 'draft'),
              ($1, $5, 3, 'active'),
              ($2, $6, 2, 'active')`,
      [ACME, GLOBEX, DEF_ACTIVE, DEF_DRAFT, DEF_REQUIRED_SLOT, DEF_GLOBEX],
    )
    await mig.query(
      `INSERT INTO tenant.definition_slot (tenant_id, definition_id, slot, cardinality)
       VALUES ($1, $2, 'invoice', 'optional'),
              ($1, $2, 'goods_receipt', 'optional'),
              ($1, $3, 'invoice', 'exactly_one')`,
      [ACME, DEF_ACTIVE, DEF_REQUIRED_SLOT],
    )
    await mig.query(
      `INSERT INTO tenant.reconciliation_period (tenant_id, id, status)
       VALUES ($1, $2, 'open'), ($1, $3, 'closed')`,
      [ACME, PERIOD_OPEN, PERIOD_CLOSED],
    )
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

describe('intake and run admission, served', { skip }, () => {
  let plane: { url: string; close(): Promise<void> }

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedSubstrate()
    /* 🛑 NO OPTIONS BUT THE POOL — the production authoriser and the
     * production substrate reader, which is the whole point of this file. */
    plane = await startDataPlane({ poolMax: 1 })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
  })

  /* ================================================================ *
   * §0 · THE ANTI-VACUOUS CONTROL.
   * ================================================================ */

  it('0 · a path the contract does not declare answers the ROUTER`s 404 — the control every refusal below rests on', async () => {
    const res = await get(plane.url, '/v1/intake/not/a/declared/path')
    assert.equal(res.status, 404)
    assert.equal(
      res.body?.['title'],
      'No such operation.',
      'THE ROUTER`s OWN 404 HAS A TITLE AND EVERY OTHER REFUSAL IN THIS FILE MUST NOT MATCH ' +
        'IT. Without this pin, §11`s "these four are not mounted" and §8`s "another tenant`s ' +
        'definition is invisible" both pass against a plane that mounts nothing at all.',
    )
  })

  /* ================================================================ *
   * §1 · THE CHANNEL ROSTER IS SERVED.
   * ================================================================ */

  it('1 · `listIntakeChannels` returns FOUR entries in the model`s declaration order', async () => {
    const res = await get(plane.url, '/v1/intake/channels')
    assert.equal(
      res.status,
      200,
      `expected 200 from a session holding \`admit_source\`. Got: ${res.status} ${res.text}`,
    )
    const channels = res.body?.['channels'] as Array<Record<string, unknown>> | undefined
    assert.notEqual(channels, undefined, 'the 200 carries no `channels` key')
    assert.deepEqual(
      channels?.map((c) => c['channel']),
      Object.values(INTAKE_CHANNEL_KINDS),
      'THE FOUR ENTRIES ARE NOT `INTAKE_CHANNEL_KINDS` IN DECLARATION ORDER. The response ' +
        'iterates the DECLARATIONS and never the rows — a kind with no configured lane must ' +
        'be PRESENT and unwired, because a missing entry and an unwired one are different ' +
        'sentences and an operator reading three cannot tell which of the four they are not ' +
        'being told about. `tools/check-wire-mirror.mjs` pins this order to the wire enum, so ' +
        'a transcription here would be a third copy.',
    )
  })

  /* ================================================================ *
   * §2 · `wired` IS `enabled AND legal`. THE MODEL DOING WORK.
   * ================================================================ */

  it('2 · a MALFORMED lane that is switched on reports `wired: false`', async () => {
    const res = await get(plane.url, '/v1/intake/channels')
    const channels = res.body?.['channels'] as Array<Record<string, unknown>>
    const byKind = new Map(channels.map((c) => [c['channel'] as string, c]))

    assert.equal(byKind.get('upload')?.['wired'], true, 'a legal, enabled upload lane is unwired')
    assert.equal(byKind.get('mailbox')?.['wired'], true, 'a legal, enabled mailbox lane is unwired')
    assert.equal(
      byKind.get('watched_drop')?.['wired'],
      false,
      'A MALFORMED LANE REPORTED `wired: true`. `ich_drop` is a `watched_drop` with no ' +
        '`endpoint_id`, so `guardIntakeChannel()` returns a defect and `guardChannelLive()` ' +
        'would refuse every arrival on it with `channel_is_not_a_legal_lane`. Publishing ' +
        '`wired: true` for a lane that admits nothing is the third thing that looks like the ' +
        'two the operation exists to tell apart — *"A silent connector and a connector with ' +
        'nothing to pull look identical from the queue."*',
    )
    assert.equal(
      byKind.get('connector_pull')?.['wired'],
      false,
      'a lane with `enabled = false` reported as wired',
    )
  })

  /* ================================================================ *
   * §3 · `lastArrivalAt` IS DERIVED, AND A REFUSED ARRIVAL COUNTS.
   * ================================================================ */

  it('3 · `lastArrivalAt` is the max over EVERY arrival on the lane, refusals included', async () => {
    const res = await get(plane.url, '/v1/intake/channels')
    const channels = res.body?.['channels'] as Array<Record<string, unknown>>
    const byKind = new Map(channels.map((c) => [c['channel'] as string, c]))

    assert.equal(
      byKind.get('upload')?.['lastArrivalAt'],
      '2026-09-19T09:30:00.000Z',
      'THE LATER ARRIVAL ON THIS LANE WAS REFUSED AND IT IS STILL THE LIVENESS SIGNAL. ' +
        '`IntakeChannel.lastArrivalAt` is *"Derived from the newest `Arrival` row"* and G205 ' +
        'exists so that *"file 39,998 was refused"* is recorded at all. A max over ADMITTED ' +
        'arrivals alone would report a lane delivering rubbish as SILENT, which is the ' +
        'opposite of what an operator needs. If this returned 2026-09-18T08:00:00.000Z the ' +
        'reader has started filtering on `verdict_kind`.',
    )
    assert.equal(
      byKind.get('mailbox')?.['lastArrivalAt'],
      null,
      'a lane with no arrival must answer null, not a fabricated timestamp',
    )
    assert.equal(byKind.get('watched_drop')?.['lastArrivalAt'], null)
  })

  /* ================================================================ *
   * §4 · INVARIANT 1 — GLOBEX's mailbox arrival is the LATEST row in the
   *      whole database and must not reach ACME's answer.
   * ================================================================ */

  it('4 · another tenant`s lane and its arrival do not reach this answer', async () => {
    const res = await get(plane.url, '/v1/intake/channels')
    const channels = res.body?.['channels'] as Array<Record<string, unknown>>
    const mailbox = channels.find((c) => c['channel'] === 'mailbox')
    assert.equal(
      mailbox?.['lastArrivalAt'],
      null,
      'GLOBEX`s mailbox arrival (2026-09-19T23:00:00Z, the latest row in the database) ' +
        'reached ACME`s channel roster. The handler carries NO tenant predicate and NO ' +
        '`a.tenant_id = c.tenant_id` join term — isolation is `intake_channel_rls` and ' +
        '`arrival_rls`, and if this leaks the policies are not what is producing it.',
    )
  })

  /* ================================================================ *
   * §5 · 🛑 THE BODY IS VALIDATED BY THE CONTRACT. G694.
   *
   *      THIS IS THE COMPANION TO `tests/http/engine-on-served-path.test.ts`
   *      §4, WHICH THIS COMMIT CONVERTS FROM A `todo` TO A LIVE ASSERTION.
   *      The pair is what makes either one evidence: a 400 alone could mean
   *      the route rejects everything, and a 201 alone could mean nothing is
   *      checked.
   * ================================================================ */

  it('5 · a body carrying `tenantId` is refused 400, and the SAME body without it is 201', async () => {
    const before = await runCount()

    const refused = await post(plane.url, '/v1/runs', {
      definitionId: DEF_ACTIVE,
      tenantId: GLOBEX,
    })
    assert.equal(
      refused.status,
      400,
      'A BODY CARRYING `tenantId` WAS NOT REFUSED. `docs/contracts/README.md`: *"`tenantId` ' +
        'appears in no request body, anywhere … A request that could STATE its tenant is a ' +
        'request that could state the wrong one — invariant 1, expressed as an absence rather ' +
        'than a comment."* Nothing but the SCHEMA knows this key is illegal — there is no ' +
        'hand-written check that could reject it — so a 400 here is evidence that the OpenAPI ' +
        'document is doing the validating. A 2xx would mean the key was ACCEPTED, and ' +
        '`removeAdditional: false` in `server/http/app.ts` is the line that makes it a ' +
        `rejection rather than a silent strip. Got: ${refused.status} ${refused.text}`,
    )
    assert.equal(
      await runCount(),
      before,
      'the refused request wrote a run. A 400 from the validator must reach no handler.',
    )

    const admitted = await post(plane.url, '/v1/runs', { definitionId: DEF_ACTIVE })
    assert.equal(
      admitted.status,
      201,
      'THE SAME BODY WITHOUT THE ILLEGAL KEY WAS NOT ADMITTED, so the 400 above is evidence ' +
        'about the ROUTE and not about the KEY. Without this half, §5 passes against a ' +
        `handler that refuses everything. Got: ${admitted.status} ${admitted.text}`,
    )
    assert.equal(admitted.body?.['outcome'], 'admitted')

    const run = admitted.body?.['run'] as Record<string, unknown> | undefined
    assert.equal(
      run?.['definitionVersion'],
      7,
      '`Run.definitionVersion` is not the definition`s stored version. It is the field the ' +
        'standing `todo` named as unproducible — *"no `definition` table, so ' +
        '`definitionVersion` would be a number with no source"* — and a wrong value here ' +
        'would ship silently, because `fast-json-stringify` serialises without validating.',
    )
    assert.equal(run?.['status'], 'queued')
    assert.deepEqual(
      run?.['trigger'],
      { kind: 'manual', byUserId: MEI },
      'THE TRIGGER LOST ITS ATTRIBUTION. The contract: *"This operation always records ' +
        '`{ kind: manual, byUserId }` taken from the session."* The wire`s `RunTrigger` is ' +
        '`additionalProperties: true, required: [kind]`, so `{ kind: manual }` VALIDATES — ' +
        'which is exactly why `db/migrations/0069` §4 adds `trigger_by_user_id` and why this ' +
        'is asserted rather than trusted.',
    )

    const basis = admitted.body?.['idempotencyBasis'] as Record<string, unknown> | undefined
    assert.equal(basis?.['definitionId'], DEF_ACTIVE)
    assert.equal(basis?.['periodId'], null)
    assert.equal(
      typeof basis?.['slotFillFingerprint'],
      'string',
      '`idempotencyBasis.slotFillFingerprint` is `required` on the wire and has no producer',
    )
  })

  /* ================================================================ *
   * §6 · A SECOND PRESS IS A SUCCESS AND MAKES NO SECOND RUN.
   * ================================================================ */

  it('6 · pressing Run again is 200 `deduplicated` and leaves ONE run', async () => {
    const before = await runCount()
    const again = await post(plane.url, '/v1/runs', { definitionId: DEF_ACTIVE })

    assert.equal(
      again.status,
      200,
      'A SECOND PRESS OF RUN WAS NOT DEDUPLICATED. The contract: *"A deduplicated request is a ' +
        'SUCCESS, not a conflict … Returning 409 would put a normal, expected, correct ' +
        'outcome into every dashboard that counts errors, and someone would then fix it."* ' +
        `Got: ${again.status} ${again.text}`,
    )
    assert.equal(again.body?.['outcome'], 'deduplicated')
    assert.equal(
      await runCount(),
      before,
      'THE SECOND PRESS CREATED A SECOND RUN. Two runs mean two sets of exceptions over the ' +
        'same break, two `exceptions_raised` meter events, and a queue that has doubled for ' +
        'no reason a user can see. The guarantee is `run_idempotency_key`, not the handler.',
    )

    const first = (again.body?.['run'] as Record<string, unknown>)['runId']
    assert.equal(
      typeof first,
      'string',
      'the `deduplicated` arm must carry THE EXISTING RUN, not an empty envelope',
    )
  })

  it('6b · a DIFFERENT period is a different basis and admits a second run', async () => {
    const before = await runCount()
    const res = await post(plane.url, '/v1/runs', {
      definitionId: DEF_ACTIVE,
      periodId: PERIOD_OPEN,
    })
    assert.equal(res.status, 201, `expected a new run for a new basis. Got: ${res.text}`)
    assert.equal((res.body?.['idempotencyBasis'] as Record<string, unknown>)['periodId'], PERIOD_OPEN)
    assert.equal(
      await runCount(),
      before + 1,
      'THE PERIOD IS NOT PART OF THE IDEMPOTENCY BASIS. Two closes of two different months ' +
        'would collapse into one run, which is the opposite failure from the one §6 guards.',
    )
  })

  /* ================================================================ *
   * §7 · THE REFUSALS, BY NAME.
   * ================================================================ */

  it('7 · a DRAFT definition is 422 `definition_not_active`', async () => {
    const res = await post(plane.url, '/v1/runs', { definitionId: DEF_DRAFT })
    assert.equal(res.status, 422, `Got: ${res.status} ${res.text}`)
    assert.equal(res.body?.['code'], 'definition_not_active')
  })

  it('7b · a CLOSED period is 409 `period_closed`', async () => {
    const res = await post(plane.url, '/v1/runs', {
      definitionId: DEF_ACTIVE,
      periodId: PERIOD_CLOSED,
    })
    assert.equal(res.status, 409, `Got: ${res.status} ${res.text}`)
    assert.equal(res.body?.['code'], 'period_closed')
  })

  it('7c · an UNKNOWN period is 409 `period_closed` too — G693, fail-closed', async () => {
    const res = await post(plane.url, '/v1/runs', {
      definitionId: DEF_ACTIVE,
      periodId: PERIOD_NEVER_SEEDED,
    })
    assert.equal(
      res.status,
      409,
      'AN UNKNOWN PERIOD WAS NOT REFUSED. G693: a period this plane has no record of cannot be ' +
        'shown to be OPEN, and admitting against it attributes a reconciliation to an ' +
        'accounting period nobody opened — the harm the 409 exists to prevent, arriving ' +
        `through the door marked "unknown". Got: ${res.status} ${res.text}`,
    )
    assert.equal(res.body?.['code'], 'period_closed')
  })

  it('7d · a definition with an UNFILLED required slot is 422 `slot_fill_incomplete`', async () => {
    const res = await post(plane.url, '/v1/runs', { definitionId: DEF_REQUIRED_SLOT })
    assert.equal(
      res.status,
      422,
      'A DEFINITION DECLARING AN `exactly_one` SLOT WAS ADMITTED WITH NOTHING IN IT. Nothing ' +
        'in this repository binds a `SourceDocument` to a slot, so the fill is empty — and ' +
        'the model must read that as *no document occupies any slot* and not as *all slots ' +
        `satisfied*. Got: ${res.status} ${res.text}`,
    )
    assert.equal(res.body?.['code'], 'slot_fill_incomplete')
    assert.ok(
      !JSON.stringify(res.body).includes('invoice'),
      'THE REFUSAL NAMED THE SLOT ON THE WIRE. `errors.yaml` forbids `detail` from carrying ' +
        '*"field values, record contents or customer-authored strings"*, and a slot name is ' +
        'tenant configuration. The names go to the process log.',
    )
  })

  it('7e · an absent definition answers EXACTLY as a draft one — not an existence oracle', async () => {
    const absent = await post(plane.url, '/v1/runs', { definitionId: NEVER_SEEDED })
    const draft = await post(plane.url, '/v1/runs', { definitionId: DEF_DRAFT })
    assert.equal(absent.status, draft.status)
    assert.deepEqual(
      absent.body,
      draft.body,
      'AN ABSENT DEFINITION AND A DRAFT ONE ANSWER DIFFERENTLY, which makes this operation an ' +
        'existence oracle over a customer`s definition register. `admitRun` declares no 404 ' +
        'and `errors.yaml` has no member meaning "no such definition"; the two are one answer ' +
        'by decision, argued in `server/http/problem.ts` at `definitionNotActive`.',
    )
  })

  /* ================================================================ *
   * §8 · INVARIANT 1 — GLOBEX's definition, by its EXACT id.
   * ================================================================ */

  it('8 · another tenant`s definition, by its exact id, answers as an id nobody seeded', async () => {
    const other = await post(plane.url, '/v1/runs', { definitionId: DEF_GLOBEX })
    const unseeded = await post(plane.url, '/v1/runs', { definitionId: NEVER_SEEDED })
    assert.equal(other.status, 422)
    assert.deepEqual(
      other.body,
      unseeded.body,
      'GLOBEX`s ACTIVE definition answered differently from an id nobody seeded, which makes ' +
        'this an existence oracle ACROSS THE TENANT BOUNDARY. There is no tenant predicate in ' +
        'the handler — `reconciliation_definition_rls` is what makes the row invisible.',
    )
    assert.equal(
      await asMigrator(async (q) => {
        const r = await q("SELECT count(*)::int AS n FROM run WHERE tenant_id = 'ten_globex'")
        return (r.rows[0] as { n: number }).n
      }),
      0,
      'a run was written into GLOBEX',
    )
  })

  /* ================================================================ *
   * §9 · THE GATE, ON TWO VERBS, IN ONE FIXTURE.
   * ================================================================ */

  it('9 · a session holding `admit_source` and not `trigger_run` READS the channels and cannot press Run', async () => {
    const reads = await get(plane.url, '/v1/intake/channels', { session: HANDLE_VIEWER })
    assert.equal(
      reads.status,
      200,
      `the viewer holds \`admit_source\` and must read the roster. Got: ${reads.text}`,
    )

    const before = await runCount()
    const writes = await post(plane.url, '/v1/runs', { definitionId: DEF_ACTIVE }, HANDLE_VIEWER)
    assert.equal(
      writes.status,
      403,
      'A SESSION WITHOUT `trigger_run` PRESSED RUN. The two operations are gated on DIFFERENT ' +
        'capabilities — `admit_source` and `trigger_run` — and this is the only assertion ' +
        `that can tell them apart. Got: ${writes.status} ${writes.text}`,
    )
    assert.equal(writes.body?.['code'], 'capability_not_held')
    assert.equal(await runCount(), before, 'the refused caller wrote a run')
  })

  it('9b · the 403 arrives BEFORE the validator — an unentitled caller gets no schema oracle', async () => {
    const res = await post(
      plane.url,
      '/v1/runs',
      { definitionId: DEF_ACTIVE, tenantId: GLOBEX },
      HANDLE_VIEWER,
    )
    assert.equal(
      res.status,
      403,
      'AN UNENTITLED CALLER LEARNED SOMETHING ABOUT THE SCHEMA. `server/http/app.ts` runs the ' +
        'capability gate in `preValidation`, before ajv: a 400 here would mean the same body ' +
        'that §5 proves is refused for its shape is refused for its shape even to somebody ' +
        `who may not call the operation at all. Got: ${res.status} ${res.text}`,
    )
  })

  /* ================================================================ *
   * §10 · INVARIANT 10 — the admission minted a record.
   * ================================================================ */

  it('10 · admitting a run mints an authorisation record, and a refused caller mints none', async () => {
    const before = await grantCount()
    const ok = await post(plane.url, '/v1/runs', {
      definitionId: DEF_ACTIVE,
      periodId: PERIOD_OPEN,
    })
    assert.equal(ok.status, 200, `expected the deduplicated arm here. Got: ${ok.text}`)
    const afterAdmit = await grantCount()
    assert.equal(
      afterAdmit,
      before + 1,
      'A SERVED ACT MINTED NO AUTHORISATION RECORD. Invariant 10: *"An act with no ' +
        'authorisation is unrecordable."* `mountTier()`s sixth fence refuses to boot a gated ' +
        'operation whose handler mints nothing, so a green boot plus a missing row means the ' +
        'record was rolled back — which would mean the act was too.',
    )

    const refused = await post(plane.url, '/v1/runs', { definitionId: DEF_ACTIVE }, HANDLE_VIEWER)
    assert.equal(refused.status, 403)
    assert.equal(
      await grantCount(),
      afterAdmit,
      'A DENIAL MINTED A GRANT. *"A denial is not an authorisation, so a denial mints ' +
        'nothing"* — a refusal that wrote a record would put permission for an act that never ' +
        'happened into an append-only table.',
    )
  })

  it('10b · the record names `trigger_run` and the run`s own tenant', async () => {
    const rows = await asMigrator(async (q) => {
      const r = await q(
        `SELECT capability, tenant_id, resource_type, resource_id, subject_user_id
           FROM tenant.authorization_grant
          WHERE capability = $1`,
        [CAPABILITIES.triggerRun],
      )
      return r.rows as Array<Record<string, unknown>>
    })
    assert.ok(rows.length > 0, 'no record names `trigger_run`')
    for (const row of rows) {
      assert.equal(row['tenant_id'], ACME)
      assert.equal(row['subject_user_id'], MEI)
      assert.equal(
        row['resource_type'],
        'Run',
        'the record names a resource type other than the entity the act is about',
      )
      assert.equal(
        row['resource_id'],
        null,
        'THE RECORD NAMED AN INSTANCE. There is no run yet when the record is minted — the ' +
          'act is *admit a run against this definition* — and naming a DEFINITION`s id under ' +
          'a resource type of `Run` would make the audit row say a thing that is not true.',
      )
    }
  })

  /* ================================================================ *
   * §11 · THE FOUR THAT ARE NOT MOUNTED. G300.
   * ================================================================ */

  it('11 · `createUpload`, `completeUpload`, `getDocument` and `rerunRun` answer the ROUTER`s 404', async () => {
    const unmounted: ReadonlyArray<readonly [string, string, unknown]> = [
      ['createUpload', '/v1/intake/uploads', { documentTypeId: 'dt_invoice' }],
      ['completeUpload', '/v1/intake/uploads/upl_1/complete', {}],
      ['getDocument', '/v1/documents/doc_acme_1', undefined],
      ['rerunRun', '/v1/runs/run_1/rerun', { reason: 'rule_changed' }],
    ]
    for (const [name, path, body] of unmounted) {
      const res =
        body === undefined ? await get(plane.url, path) : await post(plane.url, path, body)
      assert.equal(
        res.status,
        404,
        `\`${name}\` is reachable. G300 lifts the freeze per operation and on merit, and each ` +
          'of these four is refused in `server/data-plane/start.ts` by name and with its own ' +
          `reason. Got: ${res.status} ${res.text}`,
      )
      assert.equal(
        res.body?.['title'],
        'No such operation.',
        `\`${name}\` answered a 404 that is not the ROUTER's — which would mean it IS ` +
          'registered and its handler is refusing, and *"a 403 indistinguishable from an ' +
          'unbuilt feature is worse than an honest 404 from the router."*',
      )
    }
  })
})

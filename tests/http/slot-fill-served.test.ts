/**
 * C5 · PRESS RUN, WITH SOMETHING IN THE SLOT — over a socket, against the
 * PRODUCTION authoriser and the PRODUCTION substrate reader. G961–G964,
 * 20 Sep 2026.
 *
 * ┌─ THE RED, CAPTURED BEFORE THE SLICE AND QUOTED VERBATIM ───────────────────┐
 * │ At `56d9d053` — the commit before `db/migrations/0150_document_slot_binding │
 * │ .sql` and before `readSlotFill()` — this exact fixture was seeded: a real   │
 * │ `tenant.source_document` in ACME, reached through an admitted              │
 * │ `tenant.arrival` on a real lane, and a definition declaring ONE            │
 * │ `exactly_one` slot. The document was the one that ought to satisfy it.     │
 * │ Pressing Run answered:                                                     │
 * │                                                                            │
 * │   data-plane: `admitRun` refused `def_acme_needs_invoice` —                │
 * │                              slot(s) with no document: invoice             │
 * │   --- POST /v1/runs {"definitionId":"def_acme_needs_invoice"} ---          │
 * │   HTTP 422                                                                 │
 * │   {"type":"https://docs.reconcile.invalid/problems/slot_fill_incomplete",  │
 * │    "title":"A required slot has no document in it.","status":422,          │
 * │    "code":"slot_fill_incomplete","detail":"At least one slot the           │
 * │     definition requires a document for is empty."}                         │
 * │   runs in ten_acme: 0                                                      │
 * │                                                                            │
 * │ **There was no repair available at that commit.** The fill was hard-coded  │
 * │ `fill: []` in `server/data-plane/run-admission.ts`, and its docblock said  │
 * │ why in its own voice — *"Nothing in this repository binds a                │
 * │ `SourceDocument` to a slot … a definition declaring an `exactly_one` or    │
 * │ `at_least_one` slot is refused 422 FOREVER, and that is the correct        │
 * │ answer."* It was the correct answer to a question nothing could change.    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE MUTATION PASS, RUN BEFORE THIS FILE WAS COMMITTED ────────────────────┐
 * │ Each mutation is at the LAST WRITER of the property, and the counts are    │
 * │ this suite's own — ten assertions, ten run:                                │
 * │                                                                            │
 * │   `fill: await readSlotFill(…)` → `fill: []`  (the whole slice reverted)   │
 * │       → 4 pass, **6 fail**. §1 and §6 stay green, which is the point:      │
 * │         they are statements about a REFUSAL and they survive the repair    │
 * │         being deleted.                                                     │
 * │   `IS NOT DISTINCT FROM $2` → `= $2`                                       │
 * │       → 5 pass, **5 fail**. §5 stays green while every unperiodised press  │
 * │         silently returns the old 422 — one operator, and the slice is      │
 * │         inert.                                                             │
 * │   `WHERE definition_id = $1` dropped                                       │
 * │       → 2 pass, **8 fail**, and **§1 is one of the eight**: an unbound     │
 * │         definition is satisfied by a binding made for another one.         │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT MAKES A GREEN RUN HERE WORTH ANYTHING ───────────────────────────────┐
 * │ `startDataPlane({ poolMax: 6 })` — NO `authorise` argument and NO          │
 * │ `substrate` argument. Both default to the production seams, so every 201   │
 * │ below went through `decide()` on rows. `RECONCILE_LOCAL_TEST_AUTH` is      │
 * │ DELETED, so `X-Session` resolves nothing and the cookie is a raw handle    │
 * │ digested by the one seam and read out of `tenant.session`.                 │
 * │                                                                            │
 * │ ⚠️ `poolMax: 6` AND NOT 1, WHICH IS THE OPPOSITE CHOICE FROM ITS SIBLING   │
 * │ SUITE AND IS MADE FOR §7. `tests/http/intake-and-admission-served.test.ts` │
 * │ uses `poolMax: 1` adversarially, to force two scopes onto one connection.  │
 * │ **A pool of one would make §7 A SECOND COPY OF A SEQUENTIAL TEST**: the    │
 * │ two presses would queue on the pool, the first would COMMIT before the     │
 * │ second began, and the two transactions would never meet inside the         │
 * │ database — which is exactly the shape `tests/db/run-admission.test.ts` §4  │
 * │ already covers, and exactly the shape a `SELECT`-then-`INSERT` handler     │
 * │ SURVIVES. The race the contract names is two transactions open at once,    │
 * │ so it has to be a real one here or this section is witnessing the wrong    │
 * │ thing under the right name.                                                │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT THIS SUITE DOES NOT CLAIM, SAID BEFORE THE ASSERTIONS ───────────────┐
 * │ **Every binding here is written BY THE MIGRATOR.** `db/migrations/0150`    │
 * │ grants the app role `SELECT` and nothing else, and its GRANTS block argues │
 * │ that at length: a request path that could write this table could satisfy a │
 * │ required slot with a document IT chose. So a green run proves that a bound │
 * │ document ADMITS A RUN; it proves nothing about how a document comes to be  │
 * │ bound, **because nothing in this repository does that yet.** The writer is │
 * │ the ingestion cascade's and it is owed.                                    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS ASSERTED ─────────────────────────────────────────────────────────┐
 * │ 0  🛑 THE ANTI-VACUOUS CONTROL, FIRST: a path the contract does NOT        │
 * │    declare 404s with the ROUTER's own title.                               │
 * │ 1  THE RED, RE-WITNESSED FOREVER: a required slot with NO binding is 422,  │
 * │    while the document that would satisfy it sits in the tenant.            │
 * │ 1b THE BINDING IS PER DEFINITION: the same document, bound to ANOTHER      │
 * │    definition's slot of the same name, does not satisfy this one.          │
 * │ 2  THE GREEN: the bound definition admits, and `run.inputs` carries the    │
 * │    document id under the slot name.                            G961        │
 * │ 3  A second press is 200 `deduplicated` and leaves ONE run.                │
 * │ 4  🛑 THE FINGERPRINT IS LIVE, WHICH IT HAS NEVER BEEN: a document landing │
 * │    in a slot changes `slotFillFingerprint` and admits a NEW run.           │
 * │ 5  THE PERIOD IS PART OF THE FILL: a binding for a named period does not   │
 * │    satisfy the unperiodised run. The null is not a wildcard.   G962        │
 * │ 6  INVARIANT 1: another tenant's binding, on a definition with the SAME    │
 * │    ID and the SAME slot, does not reach this answer.                       │
 * │ 7  THE RACE, RUN RATHER THAN ASSUMED: two concurrent presses of one basis  │
 * │    make exactly one run.                                       G694        │
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
import { sessionCookie } from './harness.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_SLOT_FILL_SERVED_DB_NAME'] ?? runScopedName('reconcile_slot_fill_served_test')

/**
 * ⚠️ AN ASSERTION IN DISGUISE. With `RECONCILE_LOCAL_TEST_AUTH` set,
 * `resolveSessionReader()` adds an arm that authenticates a signed token and
 * resolves NO SUBJECT — and a minting handler handed that session has nobody to
 * mint invariant 10's record for. Deleting it means the 201s below cannot have
 * come from anywhere but a row.
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
const MEI = 'usr_ops_mei'
const ROLE_OPERATOR = 'rol_ap_operator'
const HANDLE = 'sx_mei_1a2b3c4d5e6f708192a3b4c5d6e7f809'

/** Declares `invoice` as `exactly_one`. NOTHING is bound to it, ever. */
const DEF_UNBOUND = 'def_acme_needs_invoice'
/** Declares `invoice` as `exactly_one`, and one document is bound, no period. */
const DEF_BOUND = 'def_acme_ap_close'
/** Declares `ledger` as `at_least_one`. §4 binds a SECOND document mid-suite. */
const DEF_MANY = 'def_acme_ledger_sweep'
/** Declares `invoice` as `exactly_one`, bound FOR ONE PERIOD only. §5. */
const DEF_PERIODISED = 'def_acme_march_close'
/** Declares `invoice` as `at_least_one`, bound, and pressed only by §7. */
const DEF_RACE = 'def_acme_race'

const PERIOD_OPEN = 'per_acme_2026_03'

const DOC_INVOICE = 'doc_acme_invoice'
const DOC_LEDGER = 'doc_acme_ledger'
const DOC_LEDGER_LATE = 'doc_acme_ledger_late'

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/http/slot-fill-served.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER THE SLOT FILL HAVING A PRODUCER AT ALL.',
      '   A run in which it skipped is NOT evidence that a bound document admits',
      '   a run, NOT evidence that an unbound required slot still refuses, and',
      '   NOT evidence that the idempotency basis moves when the fill does —',
      '   which is the third of the three parts the contract names and which was',
      '   a CONSTANT in this repository until 20 Sep 2026.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the served slot-fill assertions', probe)

/* ------------------------------------------------------------------ *
 * A RAW HTTP CLIENT, AND `node:http` RATHER THAN `fetch`: undici derives the
 * `Host` header from the URL on some paths, and G180's binding check compares
 * it against `Session.issuedHost` on EVERY request — and REVOKES the session on
 * a mismatch, so one wrong Host would make every later assertion in this file a
 * statement about a revoked session.
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
  opts: { body?: unknown; session?: string } = {},
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

const runCount = () =>
  asMigrator(async (q) => {
    const r = await q("SELECT count(*)::int AS n FROM run WHERE tenant_id = 'ten_acme'")
    return (r.rows[0] as { n: number } | undefined)?.n ?? 0
  })

function fingerprintOf(res: Response): string {
  const basis = res.body?.['idempotencyBasis'] as Record<string, unknown> | undefined
  const fingerprint = basis?.['slotFillFingerprint']
  assert.equal(
    typeof fingerprint,
    'string',
    '`idempotencyBasis.slotFillFingerprint` is `required` on the wire and is missing',
  )
  return fingerprint as string
}

function inputsOf(res: Response): Record<string, unknown> {
  const run = res.body?.['run'] as Record<string, unknown> | undefined
  return (run?.['inputs'] as Record<string, unknown>) ?? {}
}

/* ------------------------------------------------------------------ *
 * THE FIXTURE.
 *
 * ⚠️ IT SEEDS A `tenant.membership` ROW AND THAT IS NOT DECORATION — G641. A
 * bound session is a state only `selectTenantForSession()` can produce, and it
 * binds on a LIVE membership; since G641 the per-request path re-asks that
 * question on every request.
 *
 * ⚠️ AND IT SEEDS AN `arrival` FOR EVERY DOCUMENT, WHICH IS ALSO NOT
 * DECORATION: `0012`'s `source_document` has a composite foreign key to it, so
 * a fixture that wrote a document out of thin air would be writing a shape the
 * product cannot reach.
 * ------------------------------------------------------------------ */

async function seedSubstrate(): Promise<void> {
  const digest = digestOfHandle(HANDLE)
  assert.notEqual(digest, null, 'the fixture handle digested to nothing')

  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    /* G305: a handle is present EXACTLY WHEN the protocol is brokered. */
    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme',
               'https://login.microsoftonline.com/acme-slots/v2.0',
               'acme-entra-slots', 'active')`,
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
       VALUES ('ses_slots_mei', $1, $2, $3, $4, $5, now(), now(),
               now() + interval '12 hours', NULL)`,
      [digest, MEI, DOOR, ACME, ACME_HOST],
    )
    await mig.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'mem_slots_mei', $2, 'rol_member', 'bootstrap', now(), NULL, NULL)`,
      [ACME, MEI],
    )

    /* ---- THE LANE, THE ARRIVALS AND THE DOCUMENTS ---- */
    await mig.query(
      `INSERT INTO tenant.intake_channel (tenant_id, id, kind, endpoint_id, enabled)
       VALUES ($1, 'ich_upload', 'upload', NULL, true),
              ($2, 'ich_upload', 'upload', NULL, true)`,
      [ACME, GLOBEX],
    )
    for (const [tenant, arrival, doc] of [
      [ACME, 'arr_invoice', DOC_INVOICE],
      [ACME, 'arr_ledger', DOC_LEDGER],
      [ACME, 'arr_ledger_late', DOC_LEDGER_LATE],
      [GLOBEX, 'arr_globex', 'doc_globex_invoice'],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant.arrival
           (tenant_id, id, channel_id, channel_kind, endpoint_id, authorization_id,
            arrived_at, verdict_kind, refusal_kind, source_document_id)
         VALUES ($1, $2, 'ich_upload', 'upload', NULL, 'azg_standing',
                 now(), 'admitted', NULL, $3)`,
        [tenant, arrival, doc],
      )
      await mig.query(
        `INSERT INTO tenant.source_document
           (tenant_id, id, arrival_id, document_type_id, ingested_at)
         VALUES ($1, $3, $2, 'dt_invoice', now())`,
        [tenant, arrival, doc],
      )
    }

    /* ---- THE DEFINITIONS AND THEIR SLOTS ---- */
    await mig.query(
      `INSERT INTO tenant.reconciliation_definition (tenant_id, id, version, status)
       VALUES ($1, $2, 3, 'active'), ($1, $3, 7, 'active'), ($1, $4, 2, 'active'),
              ($1, $5, 4, 'active'), ($1, $6, 9, 'active'),
              -- 🛑 GLOBEX CARRIES A DEFINITION WITH **THE SAME ID** AS ACME's
              --    UNBOUND ONE. The primary key is (tenant_id, id), so this is
              --    a legal shape and it is the sharpest form of section 6: the
              --    ids are identical, the slot names are identical, and only
              --    the policy separates them.
              ($7, $2, 1, 'active')`,
      [ACME, DEF_UNBOUND, DEF_BOUND, DEF_MANY, DEF_PERIODISED, DEF_RACE, GLOBEX],
    )
    await mig.query(
      `INSERT INTO tenant.definition_slot (tenant_id, definition_id, slot, cardinality)
       VALUES ($1, $2, 'invoice', 'exactly_one'),
              ($1, $3, 'invoice', 'exactly_one'),
              ($1, $4, 'ledger',  'at_least_one'),
              ($1, $5, 'invoice', 'exactly_one'),
              ($1, $6, 'invoice', 'at_least_one'),
              ($7, $2, 'invoice', 'exactly_one')`,
      [ACME, DEF_UNBOUND, DEF_BOUND, DEF_MANY, DEF_PERIODISED, DEF_RACE, GLOBEX],
    )
    await mig.query(
      `INSERT INTO tenant.reconciliation_period (tenant_id, id, status)
       VALUES ($1, $2, 'open')`,
      [ACME, PERIOD_OPEN],
    )

    /* ---- THE BINDINGS. `DEF_UNBOUND` GETS NONE, IN EITHER TENANT BUT ONE. ---- */
    await mig.query(
      `INSERT INTO tenant.document_slot_binding
         (tenant_id, definition_id, slot, period_id, source_document_id)
       VALUES ($1, $2, 'invoice', NULL, $6),
              ($1, $3, 'ledger',  NULL, $7),
              ($1, $4, 'invoice', $9,   $6),
              ($1, $5, 'invoice', NULL, $6),
              ($8, $10, 'invoice', NULL, 'doc_globex_invoice')`,
      [
        ACME,
        DEF_BOUND,
        DEF_MANY,
        DEF_PERIODISED,
        DEF_RACE,
        DOC_INVOICE,
        DOC_LEDGER,
        GLOBEX,
        PERIOD_OPEN,
        DEF_UNBOUND,
      ],
    )
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

describe('the slot fill, served', { skip }, () => {
  let plane: { url: string; close(): Promise<void> }

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedSubstrate()
    /* 🛑 NO OPTIONS BUT THE POOL — the production authoriser and the
     * production substrate reader, which is what makes a 201 evidence. */
    plane = await startDataPlane({ poolMax: 6 })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
  })

  /* ================================================================ *
   * §0 · THE ANTI-VACUOUS CONTROL.
   * ================================================================ */

  it('0 · a path the contract does not declare answers the ROUTER`s 404 — the control every refusal below rests on', async () => {
    const res = await send(plane.url, 'GET', '/v1/runs/not/a/declared/path')
    assert.equal(res.status, 404)
    assert.equal(
      res.body?.['title'],
      'No such operation.',
      'THE ROUTER`s OWN 404 HAS A TITLE AND EVERY OTHER REFUSAL IN THIS FILE MUST NOT MATCH ' +
        'IT. Without this pin, §1`s "an unbound required slot refuses" passes against a plane ' +
        'that mounts nothing at all.',
    )
  })

  /* ================================================================ *
   * §1 · THE RED, RE-WITNESSED. The property this slice was built for is
   *      that this refusal has a WAY OUT — not that it stopped existing.
   * ================================================================ */

  it('1 · a required slot with NO binding is still 422 `slot_fill_incomplete` — while the document that would satisfy it sits in the tenant', async () => {
    const documents = await asMigrator(async (q) => {
      const r = await q(
        'SELECT id FROM tenant.source_document WHERE tenant_id = $1 ORDER BY id',
        [ACME],
      )
      return (r.rows as Array<{ id: string }>).map((row) => row.id)
    })
    assert.deepEqual(
      documents,
      [DOC_INVOICE, DOC_LEDGER, DOC_LEDGER_LATE],
      'THE PRECONDITION OF THIS ASSERTION IS GONE. The point of §1 is that the refusal is ' +
        'about the BINDING and not about the document — three documents are ingested in this ' +
        'tenant and one of them is the invoice `DEF_UNBOUND` declares a slot for.',
    )

    const before = await runCount()
    const res = await pressRun(plane.url, { definitionId: DEF_UNBOUND })
    assert.equal(
      res.status,
      422,
      'AN UNBOUND REQUIRED SLOT ADMITTED A RUN. `model/run-admission.ts` must read an empty ' +
        'fill as *no document occupies any slot* and never as *all slots satisfied* — and ' +
        '`db/migrations/0150` changes what CAN be in the fill, not how an empty one is read. ' +
        `Got: ${res.status} ${res.text}`,
    )
    assert.equal(res.body?.['code'], 'slot_fill_incomplete')
    assert.ok(
      !JSON.stringify(res.body).includes('invoice'),
      'THE REFUSAL NAMED THE SLOT ON THE WIRE. `errors.yaml` forbids `detail` from carrying ' +
        '*"field values, record contents or customer-authored strings"*, and a slot name is ' +
        'tenant configuration. The names go to the process log.',
    )
    assert.equal(await runCount(), before, 'the refused request wrote a run')
  })

  it('1b · the same document, bound to ANOTHER definition`s slot of the same name, does not satisfy this one', async () => {
    /*
     * 🛑 THE READER'S `definition_id = $1` IS THE ONLY THING STANDING HERE.
     * `DEF_BOUND` and `DEF_UNBOUND` both declare a slot called `invoice` and
     * `DOC_INVOICE` is bound to `DEF_BOUND`'s. The model keys the fill by
     * `SlotName` ALONE — `Record<SlotName, SourceDocumentId[]>` — so a reader
     * that dropped the definition predicate would hand `DEF_UNBOUND` a fill
     * containing `invoice`, and a definition would be satisfied by a binding
     * made for a different one. There is no arm in `RunAdmissionRefusal` that
     * could catch that, because from the model's side it looks like a slot
     * that is filled.
     */
    const bound = await pressRun(plane.url, { definitionId: DEF_BOUND })
    assert.equal(bound.status, 201, `the control definition must admit. Got: ${bound.text}`)
    const unbound = await pressRun(plane.url, { definitionId: DEF_UNBOUND })
    assert.equal(
      unbound.status,
      422,
      'A BINDING MADE FOR ONE DEFINITION SATISFIED ANOTHER. Both declare a slot named ' +
        '`invoice`; only one has a binding. If this is a 201 the fill is being read by slot ' +
        `NAME across the whole tenant. Got: ${unbound.status} ${unbound.text}`,
    )
  })

  /* ================================================================ *
   * §2 · THE GREEN.
   * ================================================================ */

  it('2 · a bound `exactly_one` slot ADMITS, and the run pins the document under the slot name', async () => {
    /* §1b already pressed this basis, so this is the deduplicated arm and the
     * 201 it asserts is §1b's. What §2 is for is the CONTENT of the run. */
    const res = await pressRun(plane.url, { definitionId: DEF_BOUND })
    assert.equal(
      res.status,
      200,
      `expected the deduplicated arm — §1b pressed this basis first. Got: ${res.text}`,
    )
    assert.deepEqual(
      inputsOf(res),
      { invoice: [DOC_INVOICE] },
      'THE RUN DID NOT PIN THE DOCUMENT. `Run.inputs` is *"Document ids per slot, pinned at ' +
        'admission"* and it was `{}` on every run this repository had ever admitted, because ' +
        'the fill had no producer. If this is `{}` the handler is still passing `fill: []` ' +
        'and the 201 above came from a definition whose slots are all optional.',
    )
    assert.equal((res.body?.['run'] as Record<string, unknown>)['definitionVersion'], 7)
  })

  /* ================================================================ *
   * §3 · A SECOND PRESS IS A SUCCESS AND MAKES NO SECOND RUN.
   * ================================================================ */

  it('3 · pressing Run again is 200 `deduplicated` and leaves ONE run', async () => {
    const before = await runCount()
    const again = await pressRun(plane.url, { definitionId: DEF_BOUND })
    assert.equal(again.status, 200, `Got: ${again.status} ${again.text}`)
    assert.equal(again.body?.['outcome'], 'deduplicated')
    assert.equal(
      await runCount(),
      before,
      'THE SECOND PRESS CREATED A SECOND RUN over an unchanged fill. The guarantee is ' +
        '`run_idempotency_key`, and the fill is now one of the three things the key is ' +
        'computed from — so a fill that is read differently on two identical requests breaks ' +
        'it just as surely as a missing index would.',
    )
  })

  /* ================================================================ *
   * §4 · 🛑 THE FINGERPRINT IS LIVE. THIS ASSERTION COULD NOT HAVE BEEN
   *      WRITTEN BEFORE THIS SLICE.
   *
   * The contract: the key is computed *"from the period, the definition and
   * the slot-fill state — the fingerprint of exactly which documents are
   * sitting in which slots right now."* THREE parts. Until
   * `db/migrations/0150` the third had no producer, so `slotFillBasis([])`
   * returned the canonical form of `{}` on every request ever served and
   * `slotFillFingerprint` was a CONSTANT — a basis of two parts wearing three.
   * ================================================================ */

  it('4 · a document landing in a slot changes the fingerprint and admits a NEW run', async () => {
    const first = await pressRun(plane.url, { definitionId: DEF_MANY })
    assert.equal(first.status, 201, `Got: ${first.status} ${first.text}`)
    const firstPrint = fingerprintOf(first)
    assert.deepEqual(inputsOf(first), { ledger: [DOC_LEDGER] })

    /* THE DOCUMENT LANDS. By the migrator, because `db/migrations/0150` grants
     * the app role `SELECT` and nothing else — see this file's header. */
    await asMigrator(async (q) => {
      await q(
        `INSERT INTO tenant.document_slot_binding
           (tenant_id, definition_id, slot, period_id, source_document_id)
         VALUES ($1, $2, 'ledger', NULL, $3)`,
        [ACME, DEF_MANY, DOC_LEDGER_LATE],
      )
    })

    const before = await runCount()
    const second = await pressRun(plane.url, { definitionId: DEF_MANY })
    assert.equal(
      second.status,
      201,
      'A CHANGED FILL DID NOT ADMIT A NEW RUN. This is the race the operation is named for, ' +
        'read the other way round: *"an operator presses Run at the same moment a document ' +
        'lands"* — and a run over two documents is NOT the same run as a run over one. If ' +
        `this deduplicates, the fingerprint is not being computed from the fill. Got: ${second.text}`,
    )
    assert.notEqual(
      fingerprintOf(second),
      firstPrint,
      'THE FINGERPRINT DID NOT MOVE WHEN THE FILL DID. That is exactly the state this ' +
        'repository was in until 20 Sep 2026: `slotFillBasis([])` is the canonical form of ' +
        '`{}` and never varied, so the contract`s third part was inert while the wire kept ' +
        'publishing it as though it meant something.',
    )
    assert.deepEqual(
      inputsOf(second),
      { ledger: [DOC_LEDGER, DOC_LEDGER_LATE] },
      'the second run did not pin BOTH documents — and the order is the model`s sort, not the ' +
        'database`s: `slotFillBasis()` sorts by UTF-16 code unit, deliberately, so two callers ' +
        'holding the same documents in a different order cannot press Run twice.',
    )
    assert.equal(await runCount(), before + 1)
  })

  /* ================================================================ *
   * §5 · THE PERIOD IS PART OF THE FILL, AND NULL IS NOT A WILDCARD. G962.
   * ================================================================ */

  it('5 · a binding made for a named period does NOT satisfy the unperiodised run', async () => {
    const withPeriod = await pressRun(plane.url, {
      definitionId: DEF_PERIODISED,
      periodId: PERIOD_OPEN,
    })
    assert.equal(
      withPeriod.status,
      201,
      `the binding is FOR this period and must satisfy it. Got: ${withPeriod.text}`,
    )
    assert.deepEqual(inputsOf(withPeriod), { invoice: [DOC_INVOICE] })

    const withNone = await pressRun(plane.url, { definitionId: DEF_PERIODISED })
    assert.equal(
      withNone.status,
      422,
      'A BINDING FOR ONE PERIOD SATISFIED A RUN FOR ANOTHER — which, since the other is `null`, ' +
        'means the reader is treating the period as optional rather than as part of the key. ' +
        '`db/migrations/0150` §2 refuses the wildcard reading BY NAME: if a binding satisfied ' +
        'every period, one document would satisfy a required slot for a period reopened six ' +
        'months later under a different calendar, and `slot_fill_incomplete` would stop being ' +
        `a statement about THIS period. Got: ${withNone.status} ${withNone.text}`,
    )
    assert.equal(withNone.body?.['code'], 'slot_fill_incomplete')
  })

  /* ================================================================ *
   * §6 · INVARIANT 1, IN ITS SHARPEST FORM: THE SAME DEFINITION ID.
   * ================================================================ */

  it('6 · another tenant`s binding, on a definition with the SAME id and the SAME slot, does not reach this answer', async () => {
    const globexHasOne = await asMigrator(async (q) => {
      const r = await q(
        `SELECT source_document_id FROM tenant.document_slot_binding
          WHERE tenant_id = $1 AND definition_id = $2`,
        [GLOBEX, DEF_UNBOUND],
      )
      return r.rows.length
    })
    assert.equal(
      globexHasOne,
      1,
      'THE PRECONDITION IS GONE. GLOBEX must hold a binding for a definition whose id is ' +
        'byte-identical to ACME`s unbound one, or §6 asserts nothing.',
    )

    const res = await pressRun(plane.url, { definitionId: DEF_UNBOUND })
    assert.equal(
      res.status,
      422,
      'GLOBEX`s BINDING SATISFIED ACME`s SLOT. The reader carries NO tenant predicate — ' +
        'isolation is `document_slot_binding_rls` — and the two definitions share an id ' +
        'because the primary key is `(tenant_id, id)`. If this is a 201 then one customer`s ' +
        'reconciliation is being run over another customer`s documents, which is invariant 1 ' +
        `and there is no worse failure in this product. Got: ${res.status} ${res.text}`,
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
   * §7 · THE RACE, RUN RATHER THAN ASSUMED.
   *
   * 🛑 `tests/db/run-admission.test.ts` §4 inserts the same key TWICE, in
   *    SEQUENCE, which proves the index refuses a duplicate. It does not prove
   *    that two requests arriving together produce one run, because the second
   *    insert there begins after the first has committed. This is the race the
   *    contract actually describes — *"an operator presses Run at the same
   *    moment a document lands"* — and it is the one a `SELECT`-then-`INSERT`
   *    handler would lose while passing that sequential assertion.
   * ================================================================ */

  it('7 · two concurrent presses of one basis make exactly ONE run, one 201 and one 200', async () => {
    const before = await runCount()
    const [a, b] = await Promise.all([
      pressRun(plane.url, { definitionId: DEF_RACE }),
      pressRun(plane.url, { definitionId: DEF_RACE }),
    ])

    const statuses = [a.status, b.status].sort()
    assert.deepEqual(
      statuses,
      [200, 201],
      'TWO CONCURRENT PRESSES DID NOT PRODUCE ONE ADMISSION AND ONE DEDUPLICATION. ' +
        `Got ${a.status} and ${b.status}: ${a.text} || ${b.text}. Two 201s mean the unique ` +
        'index is gone or the handler is reading before it writes; two 200s or a 500 mean the ' +
        'loser could not read the winner`s row, which `server/data-plane/run-admission.ts` ' +
        'answers 500 for deliberately rather than inventing a run.',
    )
    assert.equal(
      await runCount(),
      before + 1,
      'THE RACE CREATED TWO RUNS. `db/migrations/0069` §4: the unique index IS the guarantee ' +
        'and the handler`s `ON CONFLICT` is how it is read — *"A handler that SELECTed and ' +
        'then INSERTed would lose that race: both requests find nothing, both insert."*',
    )
    assert.equal(
      fingerprintOf(a),
      fingerprintOf(b),
      'the two presses computed different fingerprints for one unchanged fill, which would ' +
        'make the deduplication above an accident',
    )
    const runIds = [a, b].map((r) => (r.body?.['run'] as Record<string, unknown>)['runId'])
    assert.equal(
      runIds[0],
      runIds[1],
      'THE DEDUPLICATED ARM RETURNED A DIFFERENT RUN FROM THE ADMITTED ONE. The loser reads ' +
        'THE WINNER`s row — *"A client showing an error toast on `deduplicated` is telling the ' +
        'operator that the correct behaviour went wrong"*, and a client shown a different run ' +
        'id would have no way to find the one that exists.',
    )
  })
})

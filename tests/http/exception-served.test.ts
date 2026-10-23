/**
 * THE OPERATOR SURFACE, SERVED — C3 · Triage the register and C4 · Resolve an
 * exception, over a socket, against the PRODUCTION authoriser and the
 * PRODUCTION substrate reader. G357/G358/G359, 19 Sep 2026.
 *
 * ┌─ WHAT MAKES A GREEN RUN HERE WORTH ANYTHING ───────────────────────────────┐
 * │ `startDataPlane({ poolMax: 1 })` — NO `authorise` argument and NO          │
 * │ `substrate` argument. Both default to the production seams,                │
 * │ `sessionCapabilities` and `substrateFromSession`, so every 200 below went  │
 * │ through `decide()` on rows. `RECONCILE_LOCAL_TEST_AUTH` is DELETED, so     │
 * │ `X-Session` is a raw handle digested by the one seam and read out of       │
 * │ `tenant.session` — there is no fixture session object anywhere.            │
 * │                                                                            │
 * │ ⚠️ `poolMax: 1` IS ADVERSARIAL ON PURPOSE: the session scope and the       │
 * │ handler's own tenant scope are forced onto the connection the previous     │
 * │ one released, which is the condition `SET LOCAL` state would leak under if │
 * │ it leaked at all.                                                          │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS ASSERTED ─────────────────────────────────────────────────────────┐
 * │ 0  🛑 THE ANTI-VACUOUS CONTROL, FIRST AND DELIBERATELY: a path the         │
 * │    contract does NOT declare 404s with the ROUTER's own title. Without it, │
 * │    every "is not 200" assertion below passes against a plane that mounts   │
 * │    nothing — which is exactly what green-W2's mutation pass found in six   │
 * │    of its own.                                                             │
 * │ 1  `listExceptions` returns 200 and the tenant's rows — the first this     │
 * │    operation has ever returned.                              G300          │
 * │ 2  `getException` returns the explanation, and `getExceptionFacets` the    │
 * │    facet counts.                                                           │
 * │ 3  🛑 INVARIANT 1, FOUR VECTORS — header, cookie, query and path. A tenant │
 * │    named in any of them does not widen the answer.            INVARIANT 1  │
 * │ 4  Another tenant's exception, BY ITS EXACT ID, answers exactly as an id   │
 * │    nobody seeded.                                             INVARIANT 1  │
 * │ 5  A session holding `view_exception` and not `assign_exception` READS and │
 * │    cannot WRITE — the gate, on two verbs, in one session.     G200         │
 * │ 6  `assignException` changes the row AND mints invariant 10's record in    │
 * │    the same transaction — the first WRITE that property has covered. G301  │
 * │ 7  The two cross-field rules the schema cannot state are 422s.             │
 * │ 8  `reverseResolution` IS MOUNTED and is GATED: an operator holding       │
 * │    `view_exception` and `assign_exception` gets 403, not the router's     │
 * │    404 and not a 409.                                   G946–G950, 0140   │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 THE MUTATION PASS, AND THE ONE ASSERTION THAT DID NOT NOTICE ──────────┐
 * │ MUTATION A — all four mounts deleted from `server/data-plane/start.ts`,    │
 * │ so the plane 404s every exception path. Re-run:                            │
 * │                                                                            │
 * │   RED     §1 §2 §2b §3 §4 §5 §6 §6b §7 §7b  — ten of thirteen              │
 * │   GREEN   §0 and §8, CORRECTLY: both are ABOUT unmounted paths, and a      │
 * │           plane with nothing mounted is the state they describe.           │
 * │   🛑 GREEN AND WRONG — §6c. **It did not notice.** It asserted a 404 for   │
 * │           another tenant's row and that the row was unwritten, and an      │
 * │           UNMOUNTED PUT satisfies both: it 404s, and it writes nothing.    │
 * │           Both halves were satisfied by the ABSENCE OF THE FEATURE.        │
 * │                                                                            │
 * │ §6c now carries the two lines that fix it — the router-title pin and a     │
 * │ 200 on the same path for this tenant — which is the shape §4 already had   │
 * │ and is why §4 went red where §6c did not. **The fix is recorded here       │
 * │ rather than quietly applied**, because the interesting output of a         │
 * │ mutation pass is which control was hollow, not which ones worked.          │
 * │                                                                            │
 * │ MUTATION B — `assignExceptionOperation.capability` changed to              │
 * │ `CAPABILITIES.viewException`, which is the single most plausible           │
 * │ copy-paste error in `exceptions.ts`. §5 RED and nothing else: a viewer     │
 * │ took a row off the queue. That is the assertion §5 exists for.             │
 * │                                                                            │
 * │ The exact failure text of each red is in the pull request.                 │
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

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it — `db/env.ts`
 * resolves `RECONCILE_DB_NAME` per call and never at import, and `node --test`
 * runs files concurrently, so two suites sharing one database race inside
 * `applyMigrations()` and fail for a reason neither chose.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_EXCEPTION_SERVED_DB_NAME'] ?? runScopedName('reconcile_exception_served_test')

/**
 * ⚠️ AN ASSERTION IN DISGUISE. With `RECONCILE_LOCAL_TEST_AUTH` set,
 * `resolveSessionReader()` adds an arm that authenticates a signed token and
 * resolves NO SUBJECT — and a minting handler handed that session has nobody
 * to mint invariant 10's record for. Deleting it means the 200s below cannot
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

/** Mei holds BOTH verbs. Vik holds `view_exception` only — §5's differential. */
const MEI = 'usr_ops_mei'
const VIK = 'usr_ops_vik'
const ROLE_OPERATOR = 'rol_ap_operator'
const ROLE_VIEWER = 'rol_ap_viewer'

const HANDLE = 'sx_mei_9f23c1d80ba64e57a1c3d90f6b2e4817'
const HANDLE_VIEWER = 'sx_vik_47b0e3fa51d84c62b9de07a3c5f18260'

const ACME_EXC = 'exc_acme_served_0001'
const ACME_EXC_2 = 'exc_acme_served_0002'
const GLOBEX_EXC = 'exc_globex_served_0001'
/** An id nobody seeded. The control every cross-tenant answer must match. */
const NEVER_SEEDED = 'exc_no_such_exception_anywhere'

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/http/exception-served.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER THE FOUR OPERATIONS G357 MOUNTED. A run',
      '   in which it skipped is NOT evidence that the register is reachable,',
      '   NOT evidence that assigning a row mints invariant 10`s record, and',
      '   NOT evidence that another tenant`s exception is invisible when asked',
      '   for by its exact id.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the served exception-register assertions', probe)

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

/** Count invariant 10's records. Migrator, because the app role cannot report on them. */
async function grantCount(): Promise<number> {
  return asMigrator(async (q) => {
    const r = await q('SELECT count(*)::int AS n FROM tenant.authorization_grant')
    return (r.rows[0] as { n: number } | undefined)?.n ?? 0
  })
}

/* ------------------------------------------------------------------ *
 * THE FIXTURE. Two people, two roles, two tenants, three exceptions.
 *
 * ⚠️ IT IS SMALL ON PURPOSE AND THAT IS A DIVISION OF LABOUR RATHER THAN A
 * SHORTCUT. `tests/db/exception-register.test.ts` drives a fixture that reaches
 * every ordering, every cursor refusal, every column-level privilege and the
 * RLS negative control. What this file needs is: a register that is reachable
 * over a socket, a second tenant's row to fail to see, and a person who may
 * read and may not write.
 * ------------------------------------------------------------------ */

async function seedSubstrate(): Promise<void> {
  const digest = digestOfHandle(HANDLE)
  const viewerDigest = digestOfHandle(HANDLE_VIEWER)
  assert.notEqual(digest, null, 'the fixture handle digested to nothing')
  assert.notEqual(viewerDigest, null, 'the viewer handle digested to nothing')

  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    /* 🛑 G305: a handle is present EXACTLY WHEN the protocol is brokered, and
       `PROTOCOL_IS_BROKERED.oidc` is `true` — so an `oidc` door with no
       `(broker_issuer, broker_ref)` is `broker_unresolvable`, refused rather
       than defaulted. Two fixtures were green on their own branches and red on
       the merged tree for exactly this; the shape is copied from the corrected
       one in `tests/e2e/browser-login.test.ts`. */
    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme',
               'https://login.microsoftonline.com/acme-exceptions/v2.0',
               'acme-entra-exceptions', 'active')`,
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

    /* Two roles. The difference between them IS §5. */
    await mig.query(
      `INSERT INTO tenant.role
         (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ($1, $2, 'AP Operator', 'operator', 1, 'operator', 'pack', 'pck_ap', 'active'),
              ($1, $3, 'AP Viewer',   'viewer',   1, 'viewer',   'pack', 'pck_ap', 'active')`,
      [ACME, ROLE_OPERATOR, ROLE_VIEWER],
    )
    await mig.query(
      `INSERT INTO tenant.role_capability (tenant_id, role_id, capability)
       VALUES ($1, $2, $4), ($1, $2, $5), ($1, $3, $4)`,
      [ACME, ROLE_OPERATOR, ROLE_VIEWER, CAPABILITIES.viewException, CAPABILITIES.assignException],
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
       VALUES ('ses_x_mei', $1, $3, $5, $6, $7, now(), now(), now() + interval '12 hours', NULL),
              ('ses_x_vik', $2, $4, $5, $6, $7, now(), now(), now() + interval '12 hours', NULL)`,
      [digest, viewerDigest, MEI, VIK, DOOR, ACME, ACME_HOST],
    )
    /*
     * 🛑 THE MEMBERSHIP ROW IS NOT DECORATION — G641, 19 Sep 2026.
     *
     * The session above is BOUND to a tenant, and a bound session is a state
     * only `selectTenantForSession()` can produce — which binds on a LIVE
     * membership (G199) or on a staff grant nothing here supplies. Since G641
     * the per-request path re-asks that question on EVERY request, through the
     * same `holdsLiveMembership()` the binding uses, because a membership that
     * lapses by the clock writes no statement and fires no trigger.
     *
     * **So a fixture that forges a bound session with no membership row forges
     * a state the product cannot reach**, and the plane now refuses it 401.
     * Adding the row is not weakening a witness; it is the fixture stopping
     * being impossible.
     */
    await mig.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'mem_x_mei', $2, 'rol_member', 'bootstrap', now(), NULL, NULL),
              ($1, 'mem_x_vik', $3, 'rol_member', 'bootstrap', now(), NULL, NULL)
       ON CONFLICT DO NOTHING`,
      [ACME, MEI, VIK],
    )

    for (const [tenant, id, severity, rank, domain] of [
      [ACME, ACME_EXC, 'critical', 0, 'finance'],
      [ACME, ACME_EXC_2, 'high', 1, 'kyc'],
      [GLOBEX, GLOBEX_EXC, 'critical', 0, 'finance'],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant.exception
           (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
            carried_forward_from, domain, definition_id, rule_label, severity, severity_rank,
            value_at_risk_currency, value_at_risk_minor, value_at_risk_exponent,
            cost_centre, legal_entity, status, assigned_to, raised_at,
            explanation_summary, explanation_expected, explanation_confidence)
         VALUES ($1, $2, 'mg_1', 'rul_1', 1, 1,
                 NULL, $3, 'def_ap_close', 'Three-way match', $4, $5,
                 'SGD', 90000, 2,
                 'CC-1100', 'LE-SG', 'open', NULL, now(),
                 'the invoice disagrees with the purchase order', 'the purchase order', 0.91)`,
        [tenant, id, domain, severity, rank],
      )
    }

    /* One observed value, so §2's explanation is not an empty array — an
       assertion over `observed: []` cannot tell a reader that works from one
       that returns nothing. */
    await mig.query(
      `INSERT INTO tenant.exception_observed_value
         (tenant_id, exception_id, ordinal, slot, path, line_index, source_document_id,
          scalar_kind, scalar_money_currency, scalar_money_minor, scalar_money_exponent,
          provenance_page, provenance_confidence, data_class)
       VALUES ($1, $2, 0, 'invoice', $3::jsonb, NULL, 'doc_acme_inv',
               'money', 'SGD', 190000, 2, 3, 0.82, 'internal')`,
      [ACME, ACME_EXC, JSON.stringify(['invoice', 'total'])],
    )
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

describe('the exception register, served', { skip }, () => {
  let plane: { url: string; close(): Promise<void> }

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedSubstrate()
    /* 🛑 NO OPTIONS BUT THE POOL — the production authoriser and the production
     * substrate reader, which is the whole point of this file. */
    plane = await startDataPlane({ poolMax: 1 })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
  })

  /* ================================================================ *
   * §0 · THE ANTI-VACUOUS CONTROL. IT COMES FIRST BECAUSE EVERY REFUSAL
   *      ASSERTION BELOW IS MEANINGLESS WITHOUT IT.
   * ================================================================ */

  it('0 · a path the contract does not declare answers the ROUTER`s 404 — the control every refusal below rests on', async () => {
    const res = await get(plane.url, '/v1/exceptions/not/a/declared/path')
    assert.equal(res.status, 404)
    assert.equal(
      res.body?.['title'],
      'No such operation.',
      'THE ROUTER`s OWN 404 HAS A TITLE AND EVERY OTHER 404 IN THIS FILE MUST NOT MATCH IT. ' +
        'Without this pin, §4`s "another tenant`s row is invisible" passes against a plane ' +
        'that mounts nothing at all — which is precisely what a mutation pass found in six ' +
        'assertions of the previous wave. If this title has changed, every 404 assertion ' +
        'below is now checking the wrong thing.',
    )
  })

  /* ================================================================ *
   * §1 · THE QUEUE IS SERVED.
   * ================================================================ */

  it('1 · `listExceptions` returns 200 and only this tenant`s rows', async () => {
    const res = await get(plane.url, '/v1/exceptions')
    assert.equal(
      res.status,
      200,
      'THE OPERATION IS NOT SERVED. Before this commit the same request answered 404 with ' +
        'title "No such operation." — the ROUTER`s 404, because the contract declared the ' +
        'operation and nothing mounted it. A 403 instead means the gate refused a complete ' +
        `substrate. Body: ${res.text.slice(0, 300)}`,
    )
    const items = res.body?.['items'] as Record<string, unknown>[]
    assert.equal(items.length, 2, 'the register returned a row count this tenant does not have')
    assert.deepEqual(
      items.map((i) => i['exceptionId']).sort(),
      [ACME_EXC, ACME_EXC_2],
    )
    assert.equal(res.body?.['nextCursor'], null)
    /* `estimatedTotal` is `required` and is always null — see the store's §5.
       Asserted so that a later commit which starts estimating meets a red and
       has to argue for the number rather than shipping one. */
    assert.equal(
      res.body?.['estimatedTotal'],
      null,
      'a count appeared. The contract allows null *"when it cannot be estimated cheaply"*, ' +
        'and the cheap estimate counts rows THIS SESSION CANNOT SEE — a number larger than ' +
        'the truth by however many other tenants share the database.',
    )

    /* A queue row carries the summary and NOT the evidence: *"A list row ' +
       carries the summary and the denormalised columns, which is what a triage
       decision needs and no more."* */
    const row = items[0] as Record<string, unknown>
    assert.equal(typeof row['summary'], 'string')
    assert.equal('explanation' in row, false, 'the queue row carried the whole explanation')
    assert.equal('confidence' in row, false, 'the queue row carried a confidence — a sortable ' +
      'confidence column is a bulk-approval affordance, and this contract has no bulk operations')
  })

  /* ================================================================ *
   * §2 · THE DETAIL AND THE FACETS.
   * ================================================================ */

  it('2 · `getException` returns the explanation, and the confidence lives HERE and only here', async () => {
    const res = await get(plane.url, `/v1/exceptions/${ACME_EXC}`)
    assert.equal(res.status, 200, `Body: ${res.text.slice(0, 300)}`)
    const explanation = res.body?.['explanation'] as Record<string, unknown>
    assert.equal(
      explanation['summary'],
      'the invoice disagrees with the purchase order',
      'the explanation is non-optional — PRODUCT.md Principle 1, in the type system',
    )
    assert.equal(
      explanation['expected'],
      'the purchase order',
      'THE EXPLANATION IS DIRECTIONAL. `expected` is drawn from the reference slot, which is ' +
        'what makes the sentence mean something.',
    )
    assert.equal(explanation['confidence'], 0.91)
    const observed = explanation['observed'] as Record<string, unknown>[]
    assert.equal(observed.length, 1, 'the evidence did not come back')
    assert.deepEqual(
      observed[0]?.['path'],
      [
        { kind: 'key', key: 'invoice' },
        { kind: 'key', key: 'total' },
      ],
      'the path reached the wire as raw tokens rather than as the `FieldSegment` objects ' +
        '`capability.openapi.yaml` declares — which `fast-json-stringify` answers with a 500, ' +
        'not with a wrong body',
    )
    assert.equal(
      (observed[0]?.['scalar'] as Record<string, unknown>)['kind'],
      'money',
    )
    /* Money on the wire is a DECIMAL STRING — G286. A JSON number would be read
       back as an IEEE-754 double and lose exactness above 2^53. */
    const scalarValue = (observed[0]?.['scalar'] as Record<string, unknown>)['value'] as Record<
      string,
      unknown
    >
    assert.equal(typeof scalarValue['amountMinor'], 'string')
    assert.equal(scalarValue['amountMinor'], '190000')

    assert.deepEqual(res.body?.['reversals'], [], 'reversals is `required` and must be an array')
    assert.equal(res.body?.['resolution'], null, 'resolution is `required` and null while unresolved')
  })

  it('2b · `getExceptionFacets` returns the values the filters can legally take', async () => {
    const res = await get(plane.url, '/v1/exceptions/facets')
    assert.equal(res.status, 200, `Body: ${res.text.slice(0, 300)}`)
    const domains = res.body?.['domains'] as { value: string; count: number }[]
    assert.deepEqual(
      domains.map((d) => d.value).sort(),
      ['finance', 'kyc'],
      'the facets did not group over this tenant`s own rows',
    )
    assert.equal(
      domains.reduce((a, d) => a + d.count, 0),
      2,
      "GLOBEX's row reached ACME's facet counts",
    )
  })

  /* ================================================================ *
   * §3 · INVARIANT 1, FOUR VECTORS.
   *
   * "Tenant scope is derived from the session, never read from a request."
   * Copied, not paraphrased.
   *
   * 🛑 THE ASSERTION IS THAT **THE ANSWER DOES NOT MOVE**, NOT THAT A PARTICULAR
   *    STATUS COMES BACK, AND THAT IS DELIBERATE — AND THE LAST SENTENCE OF THE
   *    QUOTED NOTE BELOW CAME TRUE ON 20 Sep 2026, WHICH IS WHY THE SHAPE WAS
   *    WORTH CHOOSING.
   *
   * ✅ **G941: THE RULING LANDED AND BOTH QUERY VECTORS NOW ANSWER 400.** This
   *    block needed NO edit — `if (res.status !== 200) continue` absorbs it.
   *    **The note is corrected rather than deleted, because it is the sentence
   *    that argued for the shape.** IT READ:
   *
   * ⛔ *"An operation declaring no query parameter gets NO querystring schema,
   *    so `?tenantId=` is IGNORED rather than REFUSED — a limitation found
   *    19 Sep 2026 and NOT fixed here, because fixing it changes behaviour on
   *    every tier at once and is a ruling nobody has taken. Invariant 1 holds
   *    either way (nothing reads the value); what differs is whether the
   *    attempt is visible. **An assertion pinned to 400 would have to be
   *    rewritten when that ruling lands; this one stays true whichever way it
   *    goes.**"*
   *
   *    `tests/http/parameter-free-querystring.test.ts` is where the refusal
   *    itself is asserted; what THIS block still carries, and that file does
   *    not, is that the HEADER, COOKIE and PATH-TRAVERSAL vectors move nothing
   *    either — and none of those has a schema to be refused by.
   * ================================================================ */

  it('3 · a tenant named in a HEADER, a COOKIE, a QUERY or the PATH does not widen the answer', async () => {
    const baseline = await get(plane.url, '/v1/exceptions')
    assert.equal(baseline.status, 200)
    const mine = (baseline.body?.['items'] as Record<string, unknown>[])
      .map((i) => i['exceptionId'])
      .sort()

    const vectors: readonly [string, () => Promise<Response>][] = [
      [
        'header X-Tenant-Id',
        () => get(plane.url, '/v1/exceptions', { headers: { 'X-Tenant-Id': GLOBEX } }),
      ],
      [
        'header X-Tenant',
        () => get(plane.url, '/v1/exceptions', { headers: { 'X-Tenant': GLOBEX } }),
      ],
      [
        'cookie',
        () => get(plane.url, '/v1/exceptions', { headers: { cookie: `tenantId=${GLOBEX}` } }),
      ],
      ['query on a listing operation', () => get(plane.url, `/v1/exceptions?tenantId=${GLOBEX}`)],
      [
        'query on an instance operation',
        () => get(plane.url, `/v1/exceptions/${ACME_EXC}?tenantId=${GLOBEX}`),
      ],
      ['path traversal', () => get(plane.url, `/v1/exceptions/${GLOBEX_EXC}`)],
    ]

    for (const [name, call] of vectors) {
      const res = await call()
      assert.notEqual(
        res.status,
        500,
        `the ${name} vector produced a 500 — a crash is not a refusal. Body: ${res.text.slice(0, 200)}`,
      )
      if (res.status !== 200) continue
      /* A 200 is only acceptable if the ANSWER IS UNCHANGED. */
      const body = res.body ?? {}
      if (Array.isArray(body['items'])) {
        assert.deepEqual(
          (body['items'] as Record<string, unknown>[]).map((i) => i['exceptionId']).sort(),
          mine,
          `the ${name} vector MOVED the answer. Invariant 1: tenant scope is derived from the ` +
            'session, never read from a request.',
        )
      } else {
        assert.notEqual(
          body['exceptionId'],
          GLOBEX_EXC,
          `the ${name} vector returned another tenant's row`,
        )
      }
    }
  })

  /* ================================================================ *
   * §4 · THE CROSS-TENANT READ, AND ITS CONTROL.
   * ================================================================ */

  it("4 · another tenant's exception, by its exact id, answers EXACTLY as an id nobody seeded", async () => {
    const foreign = await get(plane.url, `/v1/exceptions/${GLOBEX_EXC}`)
    const absent = await get(plane.url, `/v1/exceptions/${NEVER_SEEDED}`)

    assert.equal(foreign.status, 404, "GLOBEX's exception was readable by an ACME session")
    assert.equal(absent.status, 404)
    assert.equal(
      foreign.body?.['code'],
      absent.body?.['code'],
      'the two answers differ, which makes this operation an EXISTENCE ORACLE across the ' +
        'tenant boundary — the contract requires them identical *"for a row that does not ' +
        'exist and for a row in another tenant"*.',
    )
    assert.equal(foreign.body?.['detail'], absent.body?.['detail'])

    /* 🛑 THE HALF THAT MAKES THE ABOVE MEAN SOMETHING. A plane that mounts
       nothing answers 404 to all three; §0 pins the router's title and this
       pins that the SAME path serves 200 for a row this session may see. */
    assert.notEqual(
      foreign.body?.['title'],
      'No such operation.',
      'the 404 came from the ROUTER, not from the handler — the operation is unmounted and ' +
        'this assertion is vacuous',
    )
    const mine = await get(plane.url, `/v1/exceptions/${ACME_EXC}`)
    assert.equal(mine.status, 200, 'the same path must serve this tenant, or §4 proves nothing')
  })

  /* ================================================================ *
   * §5 · TWO VERBS, ONE SESSION. The gate, differentially.
   * ================================================================ */

  it('5 · a session holding `view_exception` and NOT `assign_exception` reads and cannot write', async () => {
    const read = await get(plane.url, '/v1/exceptions', { session: HANDLE_VIEWER })
    assert.equal(
      read.status,
      200,
      `the viewer could not read the queue — the fixture role holds \`view_exception\`. ` +
        `Body: ${read.text.slice(0, 300)}`,
    )

    const write = await send(
      plane.url,
      'PUT',
      `/v1/exceptions/${ACME_EXC}/assignment`,
      { session: HANDLE_VIEWER, body: { assignedTo: VIK } },
    )
    assert.equal(
      write.status,
      403,
      'A VIEWER TOOK A ROW OFF THE QUEUE. `assign_exception` reaches `[operator]` alone and ' +
        '`view_exception` reaches four stakeholder classes; if this is 200 the two operations ' +
        'are annotated with the same capability, and if it is 404 the write is unmounted. ' +
        `Body: ${write.text.slice(0, 300)}`,
    )
    assert.equal(write.body?.['code'], 'capability_not_held')

    /* And the row did not move, which is the assertion a status code alone
       does not make: a 403 returned AFTER a write would still be a write. */
    const after = await asMigrator(async (q) => {
      const r = await q('SELECT assigned_to FROM tenant.exception WHERE id = $1', [ACME_EXC])
      return (r.rows[0] as { assigned_to: string | null } | undefined)?.assigned_to ?? null
    })
    assert.equal(after, null, 'the refused write changed the row anyway')
  })

  /* ================================================================ *
   * §6 · THE FIRST WRITE INVARIANT 10 HAS COVERED.
   * ================================================================ */

  it('6 · `assignException` changes the row AND mints invariant 10`s record', async () => {
    const before = await grantCount()

    const res = await send(plane.url, 'PUT', `/v1/exceptions/${ACME_EXC_2}/assignment`, {
      body: { assignedTo: MEI },
    })
    assert.equal(res.status, 200, `Body: ${res.text.slice(0, 300)}`)
    assert.equal(res.body?.['assignedTo'], MEI)
    assert.equal(
      res.body?.['exceptionId'],
      ACME_EXC_2,
      'the 200 body is the whole `Exception`, read back inside the same transaction',
    )

    const stored = await asMigrator(async (q) => {
      const r = await q('SELECT assigned_to FROM tenant.exception WHERE id = $1', [ACME_EXC_2])
      return (r.rows[0] as { assigned_to: string | null } | undefined)?.assigned_to ?? null
    })
    assert.equal(stored, MEI, 'the response said assigned and the row did not change')

    const after = await grantCount()
    assert.ok(
      after > before,
      'A WRITE WAS SERVED AND MINTED NO `tenant.authorization_grant` ROW. G301 makes minting ' +
        'a PRECONDITION of mounting, and on a WRITE the property is stronger than on a read: ' +
        'the act and the record commit together or neither does, so there must be no ' +
        `assignment in this database unaccompanied by its authorisation. before=${before} after=${after}`,
    )

    /* The record names the INSTANCE. A grant that recorded `null` here would
       say the caller was authorised to assign every exception in the tenant,
       which is a wider act than the one that happened. */
    const resource = await asMigrator(async (q) => {
      const r = await q(
        `SELECT resource_type, resource_id, capability FROM tenant.authorization_grant
          ORDER BY issued_at DESC LIMIT 1`,
      )
      return r.rows[0] as
        | { resource_type: string; resource_id: string | null; capability: string }
        | undefined
    })
    assert.equal(resource?.resource_type, 'Exception')
    assert.equal(resource?.resource_id, ACME_EXC_2, 'A RECORD NAMED NO INSTANCE')
    assert.equal(resource?.capability, CAPABILITIES.assignException)
  })

  it('6b · assigning to null unassigns — a PUT replaces, and null is a VALUE', async () => {
    const res = await send(plane.url, 'PUT', `/v1/exceptions/${ACME_EXC_2}/assignment`, {
      body: { assignedTo: null },
    })
    assert.equal(res.status, 200, `Body: ${res.text.slice(0, 300)}`)
    assert.equal(
      res.body?.['assignedTo'],
      null,
      '*"Assigning to null unassigns."* A handler that read the body with `?? null` would ' +
        'make a MISSING key and an explicit null the same request.',
    )
  })

  it('6c · assigning another tenant`s exception answers 404 and mints nothing that reached a row', async () => {
    const res = await send(plane.url, 'PUT', `/v1/exceptions/${GLOBEX_EXC}/assignment`, {
      body: { assignedTo: MEI },
    })
    assert.equal(res.status, 404, "GLOBEX's exception was assignable by an ACME session")

    /* 🛑 THE ANTI-VACUOUS HALF, ADDED BECAUSE THE MUTATION PASS FOUND THIS
       ASSERTION GREEN AGAINST A PLANE WITH NO ROUTE AT ALL. Deleting all four
       mounts from `server/data-plane/start.ts` reddened every other assertion
       in this file and left this one passing: an unmounted PUT also answers
       404, and an unmounted PUT also fails to write a row. **Both halves were
       satisfied by the absence of the feature.** The two lines below are what
       make it a statement about row-level security instead. */
    assert.notEqual(
      res.body?.['title'],
      'No such operation.',
      'the 404 came from the ROUTER, not from the handler — the operation is unmounted and ' +
        'this assertion proves nothing about tenant isolation',
    )
    const mine = await send(plane.url, 'PUT', `/v1/exceptions/${ACME_EXC}/assignment`, {
      body: { assignedTo: null },
    })
    assert.equal(
      mine.status,
      200,
      'the same path must serve this tenant, or the 404 above is about an unbuilt feature ' +
        'rather than about another tenant',
    )

    const stored = await asMigrator(async (q) => {
      const r = await q('SELECT assigned_to FROM tenant.exception WHERE id = $1', [GLOBEX_EXC])
      return (r.rows[0] as { assigned_to: string | null } | undefined)?.assigned_to ?? null
    })
    assert.equal(stored, null, "GLOBEX's row was written by an ACME session")
  })

  /* ================================================================ *
   * §6d–§6f · fix/ui-close-surface — G3424 and G3426.
   * ================================================================ */

  it('6d · 🛑 G3426 — an assignee that names no member is REFUSED, and the alias `me` is not stored', async () => {
    /* THE LIVE DEFECT (RC-14): the register sent the literal `'me'` and the
       plane stored it in `tenant.exception.assigned_to`. Witnessed RED before
       the check: this request answered 200 and the row read `me`. */
    for (const alias of ['me', 'usr_nobody_in_this_tenant']) {
      const res = await send(plane.url, 'PUT', `/v1/exceptions/${ACME_EXC}/assignment`, {
        body: { assignedTo: alias },
      })
      assert.equal(res.status, 422, `\`${alias}\` was accepted as an assignee. Body: ${res.text.slice(0, 300)}`)
      assert.equal(res.body?.['code'], 'validation_failed')
      const stored = await asMigrator(async (q) => {
        const r = await q('SELECT assigned_to FROM tenant.exception WHERE id = $1', [ACME_EXC])
        return (r.rows[0] as { assigned_to: string | null } | undefined)?.assigned_to ?? null
      })
      assert.equal(stored, null, `the refused assignee \`${alias}\` reached the row anyway`)
    }
    /* The differential: the acting person's own id, and another LIVE member's,
       are both accepted — assignment is still not access, and still not
       self-only. */
    for (const who of [MEI, VIK]) {
      const ok = await send(plane.url, 'PUT', `/v1/exceptions/${ACME_EXC}/assignment`, { body: { assignedTo: who } })
      assert.equal(ok.status, 200, `a live member (\`${who}\`) could not be assigned. Body: ${ok.text.slice(0, 300)}`)
    }
    const reset = await send(plane.url, 'PUT', `/v1/exceptions/${ACME_EXC}/assignment`, { body: { assignedTo: null } })
    assert.equal(reset.status, 200)
  })

  it('6e · 🛑 G3426 — a REVOKED membership is not a member', async () => {
    await asMigrator(async (q) => {
      await q(
        `INSERT INTO tenant.membership (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, 'mem_x_gone', 'usr_ops_gone', 'rol_member', 'bootstrap', now() - interval '2 days', NULL, now() - interval '1 day')
         ON CONFLICT DO NOTHING`,
        [ACME],
      )
    })
    const res = await send(plane.url, 'PUT', `/v1/exceptions/${ACME_EXC}/assignment`, {
      body: { assignedTo: 'usr_ops_gone' },
    })
    assert.equal(res.status, 422, `a revoked member was assignable. Body: ${res.text.slice(0, 300)}`)
  })

  it('6h · 🛑 G4021 — a LAPSED assignee is not named and is published as a FORMER member, not "a colleague"', async () => {
    /* The owner's C3-05 ruling names LIVE co-members only, so a lapsed
       assignee's `assignedToName` is null — and before G4021 that null was the
       SAME null a reader with no membership gets, so every client drew "a
       colleague" for somebody who no longer is one. `assignedToFormerMember` is
       derived from `tenant.membership` alone (tenant-scoped, G447's "who
       belongs"), and is never a name. */
    const LAPSED = 'usr_ops_lapsed_h'
    const OUTSIDER = 'usr_ops_never_member_h'
    await asMigrator(async (q) => {
      for (const [id, name] of [[LAPSED, 'Lapsed Lee'], [OUTSIDER, 'Outside Olu']]) {
        await q(
          `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
           VALUES ($1, $1 || '@acme.invalid', $2, 'active', $3) ON CONFLICT DO NOTHING`,
          [id, name, DOOR],
        )
      }
      await q(
        `INSERT INTO tenant.membership (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, 'mem_h_lapsed', $2, 'rol_member', 'bootstrap', now() - interval '3 days', now() - interval '1 day', NULL)
         ON CONFLICT DO NOTHING`,
        [ACME, LAPSED],
      )
    })
    try {
      for (const [who, name, former] of [
        [LAPSED, null, true],
        [OUTSIDER, null, false],
        [VIK, 'Vik Rao', false],
      ] as const) {
        await asMigrator(async (q) => {
          await q('UPDATE tenant.exception SET assigned_to = $2 WHERE id = $1', [ACME_EXC, who])
        })
        const one = await get(plane.url, `/v1/exceptions/${ACME_EXC}`)
        assert.equal(one.status, 200, one.text.slice(0, 300))
        assert.equal(one.body?.['assignedToName'], name, `${who}: the detail named the wrong person`)
        assert.equal(one.body?.['assignedToFormerMember'], former, `${who}: the detail's former-member fact is wrong`)
        const list = await get(plane.url, '/v1/exceptions')
        const row = ((list.body?.['items'] ?? []) as Record<string, unknown>[]).find((r) => r['exceptionId'] === ACME_EXC)
        assert.equal(row?.['assignedToName'], name, `${who}: the queue named the wrong person`)
        assert.equal(row?.['assignedToFormerMember'], former, `${who}: the queue's former-member fact is wrong`)
      }
      await asMigrator(async (q) => {
        await q('UPDATE tenant.exception SET assigned_to = NULL WHERE id = $1', [ACME_EXC])
      })
      const none = await get(plane.url, `/v1/exceptions/${ACME_EXC}`)
      assert.equal(none.body?.['assignedToFormerMember'], false, 'an unassigned line claimed a former member')
    } finally {
      await asMigrator(async (q) => {
        await q('UPDATE tenant.exception SET assigned_to = NULL WHERE id = $1', [ACME_EXC])
      })
    }
  })

  it('6f · 🛑 G3424 — "needs you" is unassigned OR the caller`s own, and the facets scope like the list', async () => {
    /* ACME_EXC with a colleague, ACME_EXC_2 unassigned: one line needs MEI. */
    await asMigrator(async (q) => {
      await q('UPDATE tenant.exception SET assigned_to = $2 WHERE id = $1', [ACME_EXC, VIK])
      await q('UPDATE tenant.exception SET assigned_to = NULL WHERE id = $1', [ACME_EXC_2])
    })
    try {
      const sum = (body: Record<string, unknown> | undefined): number =>
        ((body?.['severities'] ?? []) as { count: number }[]).reduce((a, b) => a + b.count, 0)

      const mineFacets = await get(plane.url, '/v1/exceptions/facets?mineOrUnassigned=true')
      assert.equal(mineFacets.status, 200, mineFacets.text.slice(0, 300))
      assert.equal(sum(mineFacets.body), 1, 'a colleague`s line was counted as needing the caller')
      const mineList = await get(plane.url, '/v1/exceptions?mineOrUnassigned=true')
      assert.deepEqual(
        ((mineList.body?.['items'] ?? []) as { exceptionId: string }[]).map((r) => r.exceptionId),
        [ACME_EXC_2],
        'the list and the facets disagree about which lines need the caller',
      )

      /* The caller's own line counts too — it is the OR of the two. */
      await asMigrator(async (q) => { await q('UPDATE tenant.exception SET assigned_to = $2 WHERE id = $1', [ACME_EXC, MEI]) })
      assert.equal(sum((await get(plane.url, '/v1/exceptions/facets?mineOrUnassigned=true')).body), 2)

      /* 🛑 THE CALLER IS THE SESSION'S SUBJECT, NOT A VALUE THE REQUEST NAMES:
         the viewer session (VIK) asking the same question gets ITS answer. */
      const asVik = await get(plane.url, '/v1/exceptions/facets?mineOrUnassigned=true', { session: HANDLE_VIEWER })
      assert.equal(asVik.status, 200, asVik.text.slice(0, 300))
      assert.equal(sum(asVik.body), 1, 'mineOrUnassigned answered for the wrong person')

      /* `definitionId` scopes the facets with the list's own term. */
      assert.equal(sum((await get(plane.url, '/v1/exceptions/facets?definitionId=def_ap_close')).body), 2)
      assert.equal(sum((await get(plane.url, '/v1/exceptions/facets?definitionId=def_nothing_here')).body), 0)

      /* Two assignee terms at once is a 422 on BOTH operations. */
      for (const path of [
        `/v1/exceptions/facets?mineOrUnassigned=true&unassignedOnly=true`,
        `/v1/exceptions?mineOrUnassigned=true&assignedTo=${MEI}`,
      ]) {
        const both = await get(plane.url, path)
        assert.equal(both.status, 422, `${path} was answered. Body: ${both.text.slice(0, 300)}`)
      }
    } finally {
      await asMigrator(async (q) => {
        await q('UPDATE tenant.exception SET assigned_to = NULL WHERE id = ANY($1::text[])', [[ACME_EXC, ACME_EXC_2]])
      })
    }
  })

  it('6g · 🛑 G3622 — `runId` and `periodId` scope the list AND the facets, over a socket, and rows carry `runId`', async () => {
    /**
     * The owner's G3621: *"the register, counts and 'Needs you' can scope to
     * the selected run."* Witnessed RED first: before the two parameters were
     * declared, `?runId=` was a 400 (`removeAdditional: false` — an undeclared
     * query key is REFUSED, §7b), so the screen could not have asked.
     *
     * ACME_EXC is raised by an ACME March run; ACME_EXC_2 records NO run and
     * is therefore outside every run-scoped answer (`0480` §1).
     */
    await asMigrator(async (q) => {
      await q(
        `INSERT INTO run (tenant_id, id, definition_id, definition_version, period_id,
                          trigger_kind, status, started_at, finished_at, exceptions_raised)
         VALUES ($1, 'run_acme_served', 'def_ap_close', 1, 'per_2026_03', 'manual', 'completed', now(), now(), 1)
         ON CONFLICT DO NOTHING`,
        [ACME],
      )
      await q(`UPDATE tenant.exception SET run_id = 'run_acme_served' WHERE id = $1`, [ACME_EXC])
    })
    try {
      const ids = (body: Record<string, unknown> | undefined): string[] =>
        ((body?.['items'] ?? []) as { exceptionId: string }[]).map((r) => r.exceptionId)
      const sum = (body: Record<string, unknown> | undefined): number =>
        ((body?.['severities'] ?? []) as { count: number }[]).reduce((a, b) => a + b.count, 0)

      const byRun = await get(plane.url, '/v1/exceptions?runId=run_acme_served')
      assert.equal(byRun.status, 200, byRun.text.slice(0, 300))
      assert.deepEqual(ids(byRun.body), [ACME_EXC], 'the run-scoped register showed a row the run did not raise')
      assert.equal((byRun.body?.['items'] as Record<string, unknown>[])[0]?.['runId'], 'run_acme_served')

      const byPeriod = await get(plane.url, '/v1/exceptions?periodId=per_2026_03')
      assert.equal(byPeriod.status, 200, byPeriod.text.slice(0, 300))
      assert.deepEqual(ids(byPeriod.body), [ACME_EXC])

      /* The unscoped register still carries the not-recorded row, as `null`. */
      const all = (await get(plane.url, '/v1/exceptions')).body
      const unrecorded = ((all?.['items'] ?? []) as Record<string, unknown>[]).find((r) => r['exceptionId'] === ACME_EXC_2)
      assert.ok(unrecorded !== undefined && 'runId' in unrecorded && unrecorded['runId'] === null)

      assert.equal(sum((await get(plane.url, '/v1/exceptions/facets?runId=run_acme_served')).body), 1)
      assert.equal(sum((await get(plane.url, '/v1/exceptions/facets?periodId=per_2026_04')).body), 0)

      const detail = await get(plane.url, `/v1/exceptions/${ACME_EXC}`)
      assert.equal(detail.status, 200, detail.text.slice(0, 300))
      assert.equal(detail.body?.['runId'], 'run_acme_served')
    } finally {
      await asMigrator(async (q) => {
        await q('UPDATE tenant.exception SET run_id = NULL WHERE id = $1', [ACME_EXC])
      })
    }
  })

  /* ================================================================ *
   * §7 · THE TWO CROSS-FIELD RULES THE SCHEMA CANNOT STATE.
   * ================================================================ */

  it('7 · a value threshold with no currency, and `assignedTo` with `unassignedOnly`, are 422s', async () => {
    const noCurrency = await get(plane.url, '/v1/exceptions?valueAtRiskAtLeastMinor=1000')
    assert.equal(
      noCurrency.status,
      422,
      'a bare amount threshold was accepted. *"A USD invoice compared against an SGD ' +
        'purchase order once reported a 35% critical variance on a correct invoice"*, and a ' +
        'bare number threshold reproduces that defect in the filter instead of the rule. ' +
        `Body: ${noCurrency.text.slice(0, 300)}`,
    )
    assert.equal(noCurrency.body?.['code'], 'validation_failed')

    const both = await get(
      plane.url,
      `/v1/exceptions?assignedTo=${MEI}&unassignedOnly=true`,
    )
    assert.equal(both.status, 422, `Body: ${both.text.slice(0, 300)}`)

    /* And the well-formed pair is served, so §7 is a differential rather than
       a claim that the operation refuses everything. */
    const ok = await get(
      plane.url,
      '/v1/exceptions?valueAtRiskAtLeastMinor=1000&currency=SGD',
    )
    assert.equal(ok.status, 200, `the well-formed filter was refused: ${ok.text.slice(0, 300)}`)
  })

  it('7b · an undeclared query parameter on a listing operation is REFUSED rather than stripped', async () => {
    /* `removeAdditional: false` — *"Under the default, `?tenantId=…` against a
       querystring marked `additionalProperties: false` is silently deleted and
       the request served … Rejecting makes the attempt visible in a status
       code."* This is the half of §3 that IS enforced today. */
    const res = await get(plane.url, '/v1/exceptions?tenantId=ten_globex')
    assert.equal(
      res.status,
      400,
      'an undeclared query parameter was accepted on an operation that declares a ' +
        'querystring schema. If this is 200, `removeAdditional` has been set back to its ' +
        `Fastify default and the attempt is now invisible. Body: ${res.text.slice(0, 300)}`,
    )
  })

  it('7c · 🛑 THE FIRST LIVE PROOF THAT A MOUNTED ROUTE REFUSES A BAD BODY', async () => {
    /* `server/contract/routes.ts` carried, until this commit: *"No POST is
       mounted by either plane today, so no LIVE request yet proves that a
       mounted route refuses a bad body."* `assignException` is a PUT with a
       `requestBody` and it is mounted, so that sentence is now false and this
       is the assertion that makes it so. The mechanism was already derived by
       `tests/contracts/request-body-schema.test.ts`; what was missing was a
       request. */
    const undeclaredKey = await send(plane.url, 'PUT', `/v1/exceptions/${ACME_EXC}/assignment`, {
      body: { assignedTo: MEI, tenantId: GLOBEX },
    })
    assert.equal(
      undeclaredKey.status,
      400,
      'AN UNDECLARED KEY IN A REQUEST BODY WAS ACCEPTED. The schema is ' +
        '`additionalProperties: false` and `removeAdditional` is `false`, so it must be ' +
        'REFUSED rather than stripped — *"ignored and read look identical from outside"*. ' +
        'And the key chosen is `tenantId` deliberately: `docs/contracts/README.md` says it ' +
        `appears in NO request body in ANY tier. Body: ${undeclaredKey.text.slice(0, 300)}`,
    )

    const missingRequired = await send(plane.url, 'PUT', `/v1/exceptions/${ACME_EXC}/assignment`, {
      body: {},
    })
    assert.equal(
      missingRequired.status,
      400,
      '`assignedTo` is `required` and an empty body was accepted. The distinction the ' +
        'contract draws is between an ABSENT key and an explicit `null` — *"Assigning to ' +
        `null unassigns"* — and a handler cannot draw it if ajv does not. Body: ${missingRequired.text.slice(0, 300)}`,
    )

    /* And the row did not move under either refusal. */
    const stored = await asMigrator(async (q) => {
      const r = await q('SELECT assigned_to FROM tenant.exception WHERE id = $1', [ACME_EXC])
      return (r.rows[0] as { assigned_to: string | null } | undefined)?.assigned_to ?? null
    })
    assert.equal(stored, null, 'a refused body changed the row anyway')
  })

  /* ================================================================ *
   * §8 · THE OPERATION THAT IS NOT MOUNTED, AND IT IS NOT MOUNTED ON
   *      PURPOSE. G359.
   * ================================================================ */

  it('8 · `reverseResolution` IS MOUNTED, and this operator is refused by the GATE and not by the router', async () => {
    /**
     * ⚠️ THIS SECTION ASSERTED THE ROUTER'S 404 UNTIL 20 Sep 2026 AND IS
     *    INVERTED RATHER THAN DELETED, because its old text is quoted in five
     *    files and is the reason the operation stayed unmounted for a day. It
     *    read:
     *
     *      *"THIS IS THE ROUTER's 404 AND IT IS THE RIGHT ANSWER. G359: the
     *       operation passes G300's three-part test — table, model and
     *       capability are all real — and is still not mounted, because
     *       nothing in this repository can produce a resolution, so its only
     *       reachable answer would be its own 409 … If this now returns 409,
     *       somebody mounted it … if it returns 201, a resolution now exists
     *       and G359's premise has stopped holding."*
     *
     *    **Both of the things it predicted happened, in that order.** G658's
     *    `executeProposal` made a resolution producible, and
     *    `db/migrations/0140` §1 granted the `INSERT` the act's own row needed.
     *
     * 🛑 AND THE ANSWER HERE IS NEITHER A 404 NOR A 409, WHICH IS THE POINT OF
     *    KEEPING THIS SECTION IN THIS FILE. `reverse_resolution` is its own
     *    verb; this suite's operator holds `view_exception` and
     *    `assign_exception` and nothing else, so `decide()` refuses at the
     *    gate — BEFORE the handler, before the 409 the register's own state
     *    would otherwise produce. The 201 and the 409 live in
     *    `tests/http/proposal-chain-served.test.ts` §10, which is the suite
     *    with a resolution in it.
     */
    const res = await send(plane.url, 'POST', `/v1/exceptions/${ACME_EXC}/reversals`, {
      body: { reason: 'wrong_disposition', newStatus: 'open' },
    })
    assert.equal(
      res.status,
      403,
      'A 404 WITH TITLE "No such operation." MEANS THE MOUNT WAS REMOVED from ' +
        '`server/data-plane/start.ts`; a 409 means the gate let this session through and it ' +
        'reached the register, which would mean `reverse_resolution` had been collapsed into ' +
        `a verb this role holds. Body: ${res.text.slice(0, 300)}`,
    )
    assert.notEqual(
      res.body?.['title'],
      'No such operation.',
      'the router answered, which means nothing is mounted at this path',
    )
  })
})

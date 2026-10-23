/**
 * A STORED `FieldPath` ON THE WIRE — G2375 DISCHARGED, G2471–G2474.
 *
 * `HeldRead.path`, `RefusedItem.path` and `AmbiguityFinding.on` are each
 * `$ref FieldPath` in `docs/contracts/capability.openapi.yaml`: a non-empty
 * array of `FieldSegment` OBJECTS, `{kind:'key',key}` / `{kind:'index',index}`.
 * Until this commit `server/data-plane/run-account-store.ts` published them as
 * BARE TOKENS — `['lines', 7, 'amount']` — and `fast-json-stringify` cannot
 * match a bare string or number against either `oneOf` arm, so the first served
 * row carrying one was a 500. Latent, because every served fixture carried
 * `heldReads: []`, `refusedAtAdmission: []` and `ambiguities: []`.
 *
 * 🛑 THE RED WAS WITNESSED FIRST, against this file, over a real socket, with
 *    the store unchanged (`b6be7ea6`):
 *
 *        §1 · getRunAccount   → 500 upstream_unavailable
 *        §2 · listRunResidue  → 500 upstream_unavailable
 *        §3 · both            → 500 upstream_unavailable
 *        {"level":50,…,"err":{"type":"TypeError",…,"frames":
 *          ["…/node_modules/fastify/lib/reply.js:1084:12", …]},
 *         "msg":"unhandled failure"}
 *
 *    — a TypeError thrown inside Fastify's reply SERIALISATION, after the
 *    handler had returned. The plane's log allow-list (G1391) drops the
 *    message text, so the line above does not carry it; G2375 measured the
 *    same serialiser directly and recorded it: *"The value of
 *    '#/$defs/FieldSegment' does not match schema definition"*.
 *
 * ⚠️ WHICH SIDE MOVED, AND WHY: THE SERVER (G2471). The contract's `FieldPath`
 *    is a structural mirror of `model/kernel.ts`'s `FieldPath`, which IS the
 *    segment union (G214) — so the model, the contract, `listRunAllocations`'s
 *    evidence (born right) and `getException`'s observed values
 *    (`exception-store.ts`) already agreed. The bare-token form is the STORAGE
 *    encoding (`model/field-path.ts`: *"a STRING member is a key segment; a
 *    NUMBER member is an array index"*) and it leaked past the store→wire
 *    boundary. Moving the contract to tokens would have made four published
 *    shapes disagree in order to make three agree with a storage detail.
 *
 * Every assertion below is an EXACT `deepEqual` of the wire shape, so a
 * flattening anywhere on the path is red rather than a 500 somebody notices.
 * `tests/contracts/served-fieldpath-census.test.mjs` is the census that makes
 * the NEXT path-bearing field on a served response name a witness like this.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { persistRunEngineAccount } from '../../server/data-plane/run-account-store.ts'
import { CAPABILITIES } from '../../model/access.ts'
import { parseFieldPath } from '../../model/field-path.ts'
import { terminalRunStatus } from '../../model/reconciliation.ts'
import type { ItemRef, SetReconciliationResult } from '../../model/reconciliation.ts'
import type { FieldPath, SourceDocumentId } from '../../model/kernel.ts'
import { sessionCookie } from './harness.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_RUN_PATH_WIRE_SERVED_DB_NAME'] ?? runScopedName('reconcile_run_path_wire_served_test')

/** Deleted so the 200s below cannot have come from anything but a row. */
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'
const GLOBEX_HOST = 'globex.ap-southeast-1.reconcile.invalid'
process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active,` +
  `${GLOBEX_HOST}|ten_globex|ap-southeast-1|pooled|active`

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const MEI = 'usr_ops_mei'
const DOOR = 'idc_acme_entra'
const ROLE = 'rol_ap_approver'
const HANDLE = 'sh_mei_8e1f2a3b4c5d6e7f8091a2b3c4d5e6f7'

const ACME_RUN = 'run_acme_pathwire'

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
if (!probe.ok) {
  console.error(
    `\n🛑 SKIPPED — tests/http/run-path-wire-served.test.ts DID NOT RUN (${describeTarget()}).\n` +
      '   A run in which it skipped is NOT evidence that a stored FieldPath reaches the\n' +
      '   wire as the contract`s segment objects (G2375).\n',
  )
}
databaseRequiredUnderCi('the served FieldPath wire-form assertions (G2375)', probe)

interface Response {
  readonly status: number
  readonly body: Record<string, unknown> | undefined
  readonly text: string
}

function get(origin: string, path: string): Promise<Response> {
  const url = new URL(origin)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method: 'GET',
        headers: { Host: ACME_HOST, ...sessionCookie(HANDLE) },
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
    req.end()
  })
}

function accountPath(runId: string): string {
  return `/v1/runs/${runId}/account`
}

function residuePath(runId: string): string {
  return `/v1/runs/${runId}/residue`
}

function ref(id: string, lineIndex: number | null): ItemRef {
  return { sourceDocumentId: id as SourceDocumentId, lineIndex }
}

/** Through the ONE seam. A cast to `FieldPath` anywhere else is a lint failure. */
function path(...tokens: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(tokens)
  if (!parsed.ok) throw new Error(`the fixture path is not a path: ${JSON.stringify(tokens)}`)
  return parsed.path
}

/** What each fixture path MUST look like on the wire — the contract's segment objects. */
const AMOUNT_7 = [
  { kind: 'key', key: 'lines' },
  { kind: 'index', index: 7 },
  { kind: 'key', key: 'amount' },
]
const PAYER_12 = [
  { kind: 'key', key: 'lines' },
  { kind: 'index', index: 12 },
  { kind: 'key', key: 'payer' },
]
/**
 * A key containing a dot, and a key that LOOKS like an index. Both must stay
 * keys — the two cases a dotted or a sniffing encoding gets wrong (G214).
 */
const DOTTED_KEY = [
  { kind: 'key', key: 'invoice.ref' },
  { kind: 'key', key: '0' },
]

function fixture(): SetReconciliationResult {
  return {
    state: { items: new Map(), allocations: [] },
    admissionRates: [
      { side: 'left', presented: 3, admitted: 2, refused: 1 },
      { side: 'right', presented: 1, admitted: 1, refused: 0 },
    ],
    documentAccounts: [],
    refusedAtAdmission: [
      {
        side: 'left',
        ref: ref('doc_statement', 7),
        path: path('lines', 7, 'amount'),
        refusal: { kind: 'amount_not_money', found: 'text' },
      },
    ],
    ambiguities: [
      {
        on: path('invoice.ref', '0'),
        strategyKind: 'exact_identifier',
        leftCandidates: 2,
        rightCandidates: 1,
        leftRefs: [ref('doc_statement', 3), ref('doc_statement', 4)],
        rightRefs: [ref('doc_ledger', null)],
      },
      {
        /* `on: null` — a strategy keyed on no path. It must stay null, not become []. */
        on: null,
        strategyKind: 'amount_and_date',
        leftCandidates: 2,
        rightCandidates: 2,
        leftRefs: [ref('doc_statement', 5), ref('doc_statement', 6)],
        rightRefs: [ref('doc_ledger', 1), ref('doc_ledger', 2)],
      },
    ],
    searchBoundary: { oversizedBuckets: [], exhaustedSearches: [], oversizedAmountBuckets: [] },
    readerRequests: [],
    toleranceRefusals: [],
    toleranceDeclines: [],
    meterFacts: [],
    postconditions: [],
    completeness: [],
    residue: [
      {
        side: 'left',
        ref: ref('doc_statement', 12),
        settlement: { kind: 'unallocated', residual: { currency: 'SGD', amountMinor: 250n, exponent: 2 } },
        disposition: 'unidentified',
        cause: { kind: 'read_held_below_floor' },
        heldReads: [
          { ref: ref('doc_statement', 12), path: path('lines', 12, 'payer'), readConfidence: 0.41, floor: 0.8 },
        ],
      },
    ],
  }
}

async function seedSubstrate(): Promise<void> {
  const digest = digestOfHandle(HANDLE)
  assert.notEqual(digest, null)
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme',
               'https://login.microsoftonline.com/acme-pathwire/v2.0',
               'acme-entra-run-path-wire', 'active')`,
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
       VALUES ($1, $2, 'AP Approver', 'approver', 3, 'operator', 'pack', 'pck_ap', 'active')`,
      [ACME, ROLE],
    )
    await mig.query(
      `INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ($1, $2, $3)`,
      [ACME, ROLE, CAPABILITIES.viewException /* G3801: run reads are view_exception */],
    )
    await mig.query(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version,
          granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'ras_mei_pathwire', $2, $3, 3, 'usr_acme_admin', now(), NULL, NULL)`,
      [ACME, MEI, ROLE],
    )
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_mei_pathwire', $1, $2, $3, $4, $5,
               now(), now(), now() + interval '12 hours', NULL)`,
      [digest, MEI, DOOR, ACME, ACME_HOST],
    )
    /* G641: a bound session is only reachable on a LIVE membership. */
    await mig.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'mem_pathwire_mei', $2, 'rol_member', 'bootstrap', now(), NULL, NULL)
       ON CONFLICT DO NOTHING`,
      [ACME, MEI],
    )
    await mig.query(
      `INSERT INTO run
         (tenant_id, id, definition_id, definition_version, period_id,
          trigger_kind, status, started_at)
       VALUES ($1, $2, 'def_engine', 1, NULL, 'manual', 'completed', now())`,
      [ACME, ACME_RUN],
    )
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

async function seedAccount(): Promise<void> {
  const pool: TenantPool = await createAppPool(1)
  try {
    const result = fixture()
    await withTenantScope(pool, ACME, (tx) =>
      persistRunEngineAccount(tx, { runId: ACME_RUN, terminalStatus: terminalRunStatus(result), result }),
    )
  } finally {
    await pool.end().catch(() => undefined)
  }
}

describe('a stored `FieldPath` is served as the contract`s segment objects (G2375)', { skip }, () => {
  let plane: { url: string; close(): Promise<void> }

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedSubstrate()
    await seedAccount()
    plane = await startDataPlane({ poolMax: 1 })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
  })

  it('1 · `getRunAccount` serves `RefusedItem.path` and `AmbiguityFinding.on` as segment objects', async () => {
    const res = await get(plane.url, accountPath(ACME_RUN))
    assert.equal(res.status, 200, res.text)
    const account = res.body as Record<string, unknown>
    assert.deepEqual(account['refusedAtAdmission'], [
      {
        side: 'left',
        ref: { sourceDocumentId: 'doc_statement', lineIndex: 7 },
        path: AMOUNT_7,
        refusal: { kind: 'amount_not_money', found: 'text' },
      },
    ])
    assert.deepEqual(account['ambiguities'], [
      {
        on: DOTTED_KEY,
        strategyKind: 'exact_identifier',
        leftCandidates: 2,
        rightCandidates: 1,
        leftRefs: [
          { sourceDocumentId: 'doc_statement', lineIndex: 3 },
          { sourceDocumentId: 'doc_statement', lineIndex: 4 },
        ],
        rightRefs: [{ sourceDocumentId: 'doc_ledger', lineIndex: null }],
      },
      {
        on: null,
        strategyKind: 'amount_and_date',
        leftCandidates: 2,
        rightCandidates: 2,
        leftRefs: [
          { sourceDocumentId: 'doc_statement', lineIndex: 5 },
          { sourceDocumentId: 'doc_statement', lineIndex: 6 },
        ],
        rightRefs: [
          { sourceDocumentId: 'doc_ledger', lineIndex: 1 },
          { sourceDocumentId: 'doc_ledger', lineIndex: 2 },
        ],
      },
    ])
  })

  it('2 · `listRunResidue` serves `HeldRead.path` as segment objects', async () => {
    const res = await get(plane.url, residuePath(ACME_RUN))
    assert.equal(res.status, 200, res.text)
    assert.deepEqual(res.body, {
      items: [
        {
          side: 'left',
          ref: { sourceDocumentId: 'doc_statement', lineIndex: 12 },
          settlement: { kind: 'unallocated', residual: { currency: 'SGD', amountMinor: '250', exponent: 2 } },
          disposition: 'unidentified',
          cause: { kind: 'read_held_below_floor' },
          heldReads: [
            {
              ref: { sourceDocumentId: 'doc_statement', lineIndex: 12 },
              path: PAYER_12,
              readConfidence: 0.41,
              floor: 0.8,
            },
          ],
        },
      ],
      nextCursor: null,
    })
  })

  it('3 · no bare token array survives in either body — the flattened form is ABSENT, not re-shaped', async () => {
    for (const p of [accountPath(ACME_RUN), residuePath(ACME_RUN)]) {
      const res = await get(plane.url, p)
      assert.equal(res.status, 200, res.text)
      for (const flattened of ['["lines",7,"amount"]', '["lines",12,"payer"]', '["invoice.ref","0"]']) {
        assert.ok(!res.text.includes(flattened), `${p} published the bare-token form ${flattened}`)
      }
    }
  })
})

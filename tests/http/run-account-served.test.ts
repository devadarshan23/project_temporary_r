/**
 * THE ENGINE READ SURFACE, OVER A SOCKET — `getRunAccount` and
 * `listRunResidue`, mounted under **G300** and recording under **G301**,
 * 19 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS FILE IS FOR, AND WHAT `tests/db/run-engine-account.test.ts` IS
 *    FOR, BECAUSE THE TWO ARE EASILY CONFUSED AND NEITHER COVERS THE OTHER.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * That file proves the STORE: every declared channel round-trips, `int8` money
 * survives above 2^53, the cursor neither skips nor duplicates, and the
 * RLS-disabled negative control leaks. Its own header names what it cannot
 * show — *"that anybody can reach these rows over HTTP. Nobody can. The commit
 * that lifts the freeze mounts two handlers over `readRunEngineAccount()` and
 * `readRunResiduePage()` and adds the suite that proves the 404s."* **This is
 * that suite.** It is about the ROUTE: the gate, the record, the refusals and
 * invariant 1 — and it deliberately does NOT re-assert the round trip, because
 * a second copy of those assertions would drift from the first.
 *
 * ⚠️ **NO `authorise` OPTION AND NO `substrate` OPTION.** Like
 * `tests/http/identity-substrate-served.test.ts` and
 * `tests/http/authorisation-record.test.ts`, this plane takes the PRODUCTION
 * authoriser and the PRODUCTION substrate reader, and the dev token is deleted
 * from the process. Every 200 below is a verdict `decide()` reached about a
 * principal assembled entirely out of rows, through the door a deployed
 * process comes through. A suite that passed `allowEveryCapability` would be
 * asserting that a route exists, which is not the property in question.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 EVERY ASSERTION HERE WAS WITNESSED RED BEFORE IT WAS GREEN, AND THE REDS
 *    ARE WRITTEN DOWN BECAUSE A CONTROL NOBODY PROBED IS A CONTROL NOBODY HAS
 *    — §5.6, which this repository commits more often than any other shape.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Each mutation below was applied to the tree, run, and reverted. **What it
 * printed is quoted, not summarised** — a red nobody read is a red nobody has.
 *
 *   M1 · the two mounts deleted from `server/data-plane/start.ts`.
 *        **9 of 15 RED**, §1 first: *"Got: 404 … 'title':'No such operation.',
 *        'detail':'The OpenAPI documents are the router. A path they do not
 *        declare is not a route.'"* — the ROUTER's 404, which is exactly what
 *        `tests/http/run-completeness-served.test.ts` asserted until this
 *        commit and which is amended there rather than deleted.
 *        🛑 **AND SIX STAYED GREEN, WHICH IS THE MOST USEFUL THING THIS FILE
 *        LEARNED.** §4a, §4b, §4c and §5a all pass against a plane that 404s
 *        EVERYTHING — a route that does not exist is indistinguishable, from
 *        outside, from one that refuses another tenant correctly. **§4a-control
 *        is the assertion that went red**, and it is the only one in the file
 *        that can tell the two apart.
 *   M2 · `readRunResiduePage()`'s envelope check removed. §5a RED —
 *        *"Got: 200 {"items":[],"nextCursor":null}"* where a 404 is owed, which
 *        is the `[]`-versus-`null` fabrication at the grain where it is least
 *        visible; §4a, §4b and §4c RED with it, because an empty page for
 *        another tenant's run is the same oracle wearing a 200.
 *   M3 · the fixture stops REMOVING `admit_source` from the role. §3 RED —
 *        *"`/v1/runs/run_acme_engine/account` was SERVED to a subject holding
 *        no `admit_source` … Got: 200 {"outcome":"produced" …}"*. Without this
 *        mutation §3 would pass against a plane that 403s everybody, which is
 *        what every capability-tier suite did until G299.
 *   M4 · see §4a-control, which is a PERMANENT control rather than a mutation:
 *        RLS off on all thirteen tables and the same request must LEAK.
 *        ⚠️ A SHORTER LIST WENT RED FIRST and the reason is recorded at
 *        `ACCOUNT_TABLES` — disabling the envelope alone produces a 500, not a
 *        leak, and would have made this control measure something else.
 *   M5 · the handler publishes `{outcome: 'refused'}` instead of refusing the
 *        stored word. §5b RED — and **not where it was expected**: the
 *        response-schema serialiser rejects the fabricated arm (`refusal` is
 *        `required`) and the 500 that comes back carries no `detail`, so the
 *        assertion that fired is the one requiring the SHARED constant. The
 *        wire refusing a fabrication is a second control nobody wrote, and the
 *        red is recorded where it actually landed rather than tidied.
 *   M6 · `mountTier()`'s sixth fence neutered (`.filter(() => false)`). §6 RED.
 *   M7 · `instanceOf: () => null` on `listRunResidueOperation`. §7 RED —
 *        *"A RECORD NAMED NO INSTANCE … actual: null, expected:
 *        'run_acme_engine'"*.
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
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { persistRunEngineAccount } from '../../server/data-plane/run-account-store.ts'
import {
  getRunAccountOperation,
  listRunResidueOperation,
} from '../../server/data-plane/run-account.ts'
import { buildPlane, recordsAuthorisation } from '../../server/http/app.ts'
/**
 * ⚠️ IMPORTED RATHER THAN COPIED, AND THE COPY IS WHAT THIS FILE FIRST TRIED.
 * A literal here would be a second declaration of a refusal string that
 * `server/data-plane/authorise.ts` owns; it went RED on the first run against
 * a hand-written guess, which is the cheapest possible demonstration of why
 * §5.3 names "two vocabularies for one concept, diverging".
 *
 * 🛑 AND THE CONSTANT ITSELF IS STALE, WHICH IS A FINDING THIS FILE RECORDS
 * AND DOES NOT FIX. It tells the caller the three terms "have no table to be
 * read from", and `db/migrations/0009_identity_substrate.sql` gave all three a
 * table on 19 Sep 2026 — `tests/http/identity-substrate-served.test.ts` §1 is
 * the 200 that proves it. The sentence is now false on the wire for every 403
 * this plane sends. Correcting it belongs to whoever owns that message and to
 * a commit that is not a mount; it is named here so it is not invisible.
 */
import { UNAUTHORISED_DETAIL } from '../../server/data-plane/authorise.ts'
import { CAPABILITIES } from '../../model/access.ts'
import { terminalRunStatus } from '../../model/reconciliation.ts'
import type { AdmittedItem, ItemRef, SetReconciliationResult } from '../../model/reconciliation.ts'
import type { SourceDocumentId } from '../../model/kernel.ts'
import { sessionCookie } from './harness.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it — `db/env.ts`
 * resolves `RECONCILE_DB_NAME` per call and never at import, and `node --test`
 * runs files concurrently, so two suites sharing one database race inside
 * `applyMigrations()` and fail for a reason neither chose.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_RUN_ACCOUNT_SERVED_DB_NAME'] ?? runScopedName('reconcile_run_account_served_test')

/**
 * ⚠️ AN ASSERTION IN DISGUISE. With `RECONCILE_LOCAL_TEST_AUTH` set,
 * `resolveSessionReader()` adds an arm that authenticates a signed token and
 * resolves NO SUBJECT — and a minting handler handed that session has nobody
 * to mint invariant 10's record for. Deleting it here means the 200s below
 * cannot have come from anywhere but a row.
 */
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
const ASSIGNMENT = 'ras_mei_approver'

/** Present only in this file; the row stores `digestOfHandle()` of it. */
const HANDLE = 'sh_mei_31d7a0c8b45e4f1290ab7c6d5e4f3021'

/** An acme run WITH an engine account. */
const ACME_RUN = 'run_acme_engine'
/** An acme run that was never reconciled — the `no_account` fixture. */
const ACME_BARE = 'run_acme_bare'
/** A globex run WITH an account, asked for BY ITS EXACT ID from an acme session. */
const GLOBEX_RUN = 'run_globex_engine'
/** An id nobody seeded. The control every cross-tenant answer must match. */
const NEVER_SEEDED = 'run_no_such_run_anywhere'

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/http/run-account-served.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER THE TWO OPERATIONS G300 MOUNTED. A run',
      '   in which it skipped is NOT evidence that `getRunAccount` or',
      '   `listRunResidue` is reachable, NOT evidence that either mints',
      '   invariant 10`s record, and NOT evidence that another tenant`s account',
      '   is invisible when asked for by its exact id.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the served engine-account assertions', probe)

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

function get(
  origin: string,
  path: string,
  opts: { headers?: Record<string, string> } = {},
): Promise<Response> {
  const url = new URL(origin)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method: 'GET',
        headers: { Host: ACME_HOST, ...sessionCookie(HANDLE), ...(opts.headers ?? {}) },
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
function residuePath(runId: string, query = ''): string {
  return `/v1/runs/${runId}/residue${query}`
}

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

/* ------------------------------------------------------------------ *
 * THE FIXTURE.
 *
 * ⚠️ IT IS SMALL ON PURPOSE AND THAT IS A DIVISION OF LABOUR RATHER THAN A
 * SHORTCUT. `tests/db/run-engine-account.test.ts` drives a fixture that reaches
 * EVERY arm every column can hold, including `int8` money above 2^53 — and
 * re-asserting the same round trip here would be a second copy of those
 * assertions with nothing keeping the two in step. What this file needs from a
 * result is: an account that exists, and enough residue rows to page.
 * ------------------------------------------------------------------ */

function doc(id: string): SourceDocumentId {
  return id as SourceDocumentId
}

function ref(id: string, lineIndex: number | null): ItemRef {
  return { sourceDocumentId: doc(id), lineIndex }
}

const NO_ITEMS: ReadonlyMap<string, AdmittedItem> = new Map()

/** Three residue rows, so `limit=2` has a second page and `nextCursor` is real. */
function fixture(): SetReconciliationResult {
  return {
    state: { items: NO_ITEMS, allocations: [] },
    admissionRates: [
      { side: 'left', presented: 3, admitted: 3, refused: 0 },
      { side: 'right', presented: 1, admitted: 1, refused: 0 },
    ],
    documentAccounts: [
      {
        side: 'left',
        sourceDocumentId: doc('doc_statement'),
        trailer: 'not_declared_by_format',
        declaredLineCount: null,
        declaredMinor: null,
        declaredExponent: null,
        presented: 3,
        admitted: 3,
        refused: 0,
        verdict: { kind: 'nothing_to_check' },
      },
    ],
    refusedAtAdmission: [],
    ambiguities: [],
    searchBoundary: { oversizedBuckets: [], exhaustedSearches: [], oversizedAmountBuckets: [] },
    readerRequests: [],
    toleranceRefusals: [],
    toleranceDeclines: [],
    meterFacts: [
      { meter: 'reconciliations_run', quantity: 1, idempotencyKey: 'served:rr', modelEntryId: null },
    ],
    postconditions: [],
    /* EMPTY AND PRESENT, which is the whole distinction `0007` exists to make:
     * an empty channel under an existing envelope is an OBSERVATION. */
    completeness: [],
    residue: [
      {
        side: 'left',
        ref: ref('doc_statement', 1),
        settlement: { kind: 'unallocated', residual: { currency: 'SGD', amountMinor: 45000n, exponent: 2 } },
        disposition: 'unidentified',
        cause: { kind: 'no_strategy_paired' },
        heldReads: [],
      },
      {
        side: 'left',
        ref: ref('doc_statement', 2),
        settlement: null,
        disposition: 'unidentified',
        cause: { kind: 'no_strategy_paired' },
        heldReads: [],
      },
      {
        side: 'right',
        ref: ref('doc_ledger', null),
        settlement: { kind: 'unallocated', residual: { currency: 'SGD', amountMinor: 900n, exponent: 2 } },
        disposition: 'unidentified',
        cause: { kind: 'no_strategy_paired' },
        heldReads: [],
      },
    ],
  }
}

/**
 * A customer door, an active person, a live role carrying `admit_source`, a
 * live assignment pinned to the role's CURRENT version, a session bound to
 * ACME and issued on ACME's host, and three runs.
 *
 * ⚠️ `role_version` MATCHES `role.version`. `decide()` stops evaluating an
 * assignment whose pin has moved in EITHER direction, so a fixture that got
 * this wrong would refuse at `role_version_moved` and §1 would never go green
 * no matter how correctly the route were wired.
 */
async function seedSubstrate(): Promise<void> {
  const digest = digestOfHandle(HANDLE)
  assert.notEqual(digest, null, 'the fixture handle digested to nothing')

  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    await mig.query(
      /*
       * 🛑 THE BROKER HANDLE IS REQUIRED AND ITS ABSENCE WAS A MERGE RED.
       * G305: a handle is present EXACTLY WHEN the protocol is brokered, and
       * `PROTOCOL_IS_BROKERED.oidc` is `true` — so an `oidc` door with no
       * `(broker_issuer, broker_ref)` is `broker_unresolvable`. This fixture
       * was GREEN on its own branch and RED the moment G304's migration
       * merged: the two branches were open at once and neither could see the
       * other's fixtures. Added by the integrator, not by either author.
       */
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme',
               'https://login.microsoftonline.com/acme-run/v2.0',
               'acme-entra-run-account', 'active')`,
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
      [ACME, ROLE, CAPABILITIES.viewException],
    )
    await mig.query(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version,
          granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, 3, 'usr_acme_admin', now(), NULL, NULL)`,
      [ACME, ASSIGNMENT, MEI, ROLE],
    )
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_mei', $1, $2, $3, $4, $5,
               now(), now(), now() + interval '12 hours', NULL)`,
      [digest, MEI, DOOR, ACME, ACME_HOST],
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
       VALUES ($1, 'mem_ra_mei', $2, 'rol_member', 'bootstrap', now(), NULL, NULL)
       ON CONFLICT DO NOTHING`,
      [ACME, MEI],
    )
    for (const [tenantId, runId] of [
      [ACME, ACME_RUN],
      [ACME, ACME_BARE],
      [GLOBEX, GLOBEX_RUN],
    ] as const) {
      await mig.query(
        `INSERT INTO run
           (tenant_id, id, definition_id, definition_version, period_id,
            trigger_kind, status, started_at)
         VALUES ($1, $2, 'def_engine', 1, NULL, 'manual', 'completed', now())`,
        [tenantId, runId],
      )
    }
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

/**
 * The accounts, written through the app role under `withTenantScope()` — the
 * same door the handler reads them through, and therefore subject to the same
 * policies. A fixture written as the migrator would prove the reader can see
 * rows `BYPASSRLS` put there, which is a weaker statement.
 */
async function seedAccounts(): Promise<void> {
  const pool: TenantPool = await createAppPool(1)
  try {
    const result = fixture()
    for (const [tenantId, runId] of [
      [ACME, ACME_RUN],
      [GLOBEX, GLOBEX_RUN],
    ] as const) {
      await withTenantScope(pool, tenantId, (tx) =>
        persistRunEngineAccount(tx, {
          runId,
          terminalStatus: terminalRunStatus(result),
          result,
        }),
      )
    }
  } finally {
    await pool.end().catch(() => undefined)
  }
}

/**
 * Every table the two reads touch — 0007's thirteen, derived from the
 * migration rather than from memory: `grep -c '^CREATE TABLE tenant.run_'
 * db/migrations/0007_run_engine_account.sql` → 13.
 *
 * ⚠️ ALL THIRTEEN, AND A SHORTER LIST WENT RED FIRST, WHICH IS WORTH KEEPING.
 * Disabling RLS on the envelope alone leaks the envelope and leaves the ten
 * channel tables scoped to the OTHER tenant — the reader then reassembles a
 * globex envelope with acme's (empty) channels and refuses it as
 * `unpublishable`, a 500. A partial control is not a weaker control here; it
 * measures something else entirely.
 */
const ACCOUNT_TABLES = [
  'run_engine_account',
  'run_admission_rate',
  'run_document_account',
  'run_population_defect',
  'run_refused_item',
  'run_ambiguity',
  'run_ambiguity_ref',
  'run_search_boundary_entry',
  'run_postcondition',
  'run_completeness',
  'run_meter_fact',
  'run_residue',
  'run_held_read',
] as const

/** Every authorisation record, read with `BYPASSRLS`. */
async function allRecords(): Promise<Array<Record<string, unknown>>> {
  return asMigrator(async (q) => {
    const out = await q(
      'SELECT id, tenant_id, subject_user_id, capability, resource_type, resource_id' +
        ' FROM tenant.authorization_grant ORDER BY issued_at, id',
    )
    return out.rows as Array<Record<string, unknown>>
  })
}

describe('the engine read surface, served', { skip }, () => {
  let plane: { url: string; close(): Promise<void> }

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedSubstrate()
    await seedAccounts()
    /* 🛑 NO OPTIONS BUT THE POOL — the production authoriser and the production
     * substrate reader, which is the whole point of this file.
     *
     * ⚠️ `poolMax: 1` IS ADVERSARIAL ON PURPOSE: the session scope and the
     * handler's own tenant scope are forced onto the connection the previous
     * one released, which is the condition `SET LOCAL` state would leak under
     * if it leaked at all. */
    plane = await startDataPlane({ poolMax: 1 })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
  })

  /* ================================================================ *
   * §1 · `getRunAccount` IS SERVED.
   * ================================================================ */

  it('1 · a seeded subject holding `view_exception` (G3801 — `admit_source` until 4 Oct 2026) gets the run`s account — the first 200 this operation has returned', async () => {
    const res = await get(plane.url, accountPath(ACME_RUN))
    assert.equal(
      res.status,
      200,
      'THE OPERATION IS NOT SERVED. Before this commit the same request answered 404 with ' +
        'title "No such operation." — the ROUTER\'s 404, because the contract declared the ' +
        'operation and nothing mounted it. If that is what came back, the mount is gone from ' +
        '`server/data-plane/start.ts`. If a 403 came back, the gate refused a complete ' +
        'substrate and `tests/http/identity-substrate-served.test.ts` §1 names the chain to ' +
        `check in order. Got: ${res.status} ${res.text}`,
    )

    const body = res.body ?? {}
    assert.equal(body['outcome'], 'produced')
    /* The key set as a whole, not field by field: `RunEngineAccount`'s produced
     * arm is `additionalProperties: false` with ten required properties, and
     * `fast-json-stringify` SERIALISES a response without validating it — so a
     * missing channel is a body disagreeing with its own contract and nothing
     * downstream would say so. */
    assert.deepEqual(
      Object.keys(body).sort(),
      [
        'admissionRates',
        'ambiguities',
        'completeness',
        'documentAccounts',
        'meterFacts',
        // G3804 — "In variance", the net open residual.
        'openResidual',
        'outcome',
        'postconditionProperty',
        'postconditions',
        'refusedAtAdmission',
        'searchBoundary',
        // G3541 — derived from `admissionRates` and the residue, never stored.
        'settlementTallies',
        'terminalStatus',
      ],
      'THE SERVED BODY IS NOT THE SHAPE THE CONTRACT DECLARES. The handler returns the ' +
        'store\'s object VERBATIM precisely so that this set is the store\'s and not a ' +
        'reshaping step\'s. Derive the truth: ' +
        "sed -n '/    RunEngineAccount:/,/discriminator/p' docs/contracts/capability.openapi.yaml",
    )
    assert.equal(
      body['completeness'] !== null && Array.isArray(body['completeness']),
      true,
      'AN EXISTING ACCOUNT PUBLISHED `null` FOR A CHANNEL. `[]` and `null` are different ' +
        'facts — `[]` is the engine observing no shortfall, `null` is this plane holding no ' +
        'account at all — and a run WITH an envelope row can only honestly answer the first. ' +
        '(`Run.completeness` on `getRun` is still the constant `null`, which is a named gap ' +
        'in `server/data-plane/runs.ts` and not this operation\'s.)',
    )
  })

  /* ================================================================ *
   * §2 · `listRunResidue` IS SERVED, AND ITS CURSOR IS REAL.
   * ================================================================ */

  it('2a · the residue is served, one row per open item', async () => {
    const res = await get(plane.url, residuePath(ACME_RUN))
    assert.equal(res.status, 200, `the residue was not served: ${res.status} ${res.text}`)
    const items = res.body?.['items'] as unknown[] | undefined
    assert.ok(Array.isArray(items), `no \`items\` array: ${res.text}`)
    assert.equal(items.length, 3, 'the fixture writes three residue rows')
    assert.equal(
      res.body?.['nextCursor'],
      null,
      'a full page claimed a next page. "A `nextCursor` that is sometimes a lie is worse ' +
        'than no pagination at all."',
    )
  })

  it('2b · `limit` pages, and the second page neither skips nor duplicates', async () => {
    const first = await get(plane.url, residuePath(ACME_RUN, '?limit=2'))
    assert.equal(first.status, 200, first.text)
    const firstItems = first.body?.['items'] as Array<Record<string, unknown>>
    assert.equal(firstItems.length, 2)
    const cursor = first.body?.['nextCursor']
    assert.equal(
      typeof cursor,
      'string',
      'a short page carried no cursor, so the third row is unreachable over HTTP',
    )

    const second = await get(
      plane.url,
      residuePath(ACME_RUN, `?limit=2&cursor=${encodeURIComponent(String(cursor))}`),
    )
    assert.equal(second.status, 200, second.text)
    const secondItems = second.body?.['items'] as Array<Record<string, unknown>>
    assert.equal(secondItems.length, 1)
    assert.equal(second.body?.['nextCursor'], null)

    /* Neither skipped nor duplicated: the three rows across two pages are the
     * three rows, once each. `ref` is the address the product works from. */
    const seen = [...firstItems, ...secondItems].map((i) => JSON.stringify(i['ref']))
    assert.equal(new Set(seen).size, 3, `a row was duplicated across pages: ${seen.join(' · ')}`)
  })

  it('2c · a cursor this plane did not issue is a 400, not an empty page', async () => {
    const res = await get(plane.url, residuePath(ACME_RUN, '?cursor=not-a-cursor-we-minted'))
    assert.equal(
      res.status,
      400,
      'AN UNREADABLE CURSOR WAS NOT REFUSED. An empty page would tell a caller the residue ' +
        `ended where their pagination broke. Got: ${res.status} ${res.text}`,
    )
    assert.equal(res.body?.['code'], 'validation_failed')
  })

  /* ================================================================ *
   * §3 · REFUSED BY NAME FOR A SUBJECT WITHOUT THE CAPABILITY.
   * ================================================================ */

  it('3 · a subject whose role does not carry `view_exception` is refused (G3801) — both operations', async () => {
    /**
     * 🛑 THE CAPABILITY IS REMOVED FROM THE ROLE RATHER THAN THE SUBJECT FROM
     * THE SESSION, WHICH IS THE NARROW MUTATION. Deleting the session would
     * prove a 401 and say nothing about authorisation; deleting the assignment
     * would remove the whole `held` term. Removing exactly the verb leaves a
     * live person with a live role and no claim to THIS operation, which is
     * what a 403 must be about.
     */
    await asMigrator((q) =>
      q('DELETE FROM tenant.role_capability WHERE tenant_id = $1 AND role_id = $2', [ACME, ROLE]),
    )
    try {
      for (const path of [accountPath(ACME_RUN), residuePath(ACME_RUN)]) {
        const res = await get(plane.url, path)
        assert.equal(
          res.status,
          403,
          `\`${path}\` was SERVED to a subject holding no \`view_exception\`. The gate runs in ` +
            '`preValidation`, before ajv, and reads the `x-capability` the contract ' +
            `annotates. Got: ${res.status} ${res.text}`,
        )
        assert.equal(
          res.body?.['code'],
          'capability_not_held',
          'the refusal carries the wrong code. `capability_not_held` is `errors.yaml`\'s ' +
            'member for "the caller never held the verb", distinct from `policy_denied`, ' +
            `which is an act refused to a caller who did. Got: ${res.text}`,
        )
        assert.equal(
          res.body?.['detail'],
          UNAUTHORISED_DETAIL,
          'THE REFUSAL NAMES SOMETHING. A refusal naming the capability the caller lacks ' +
            'would turn the gate into a roster oracle for anybody who can authenticate; ' +
            `every refusal on this plane carries the one constant. Got: ${res.text}`,
        )
      }

      /* AND A REFUSAL MINTS NOTHING — G301: "a denial is not an authorisation."
       * Without this, §3 would pass against a gate that refused the caller and
       * wrote a record of permission for an act that never happened. */
      const before = await allRecords()
      await get(plane.url, accountPath(ACME_RUN))
      assert.equal(
        (await allRecords()).length,
        before.length,
        'A REFUSED REQUEST MINTED AN AUTHORISATION RECORD — "an audit trail that reads as ' +
          'evidence and is not."',
      )
    } finally {
      await asMigrator((q) =>
        q(
          'INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ($1, $2, $3)' +
            ' ON CONFLICT DO NOTHING',
          [ACME, ROLE, CAPABILITIES.viewException],
        ),
      )
    }
  })

  it('3b · G3801 — `admit_source` ALONE no longer reads a run: the owner moved the read to `view_exception`', async () => {
    /* THE OWNER'S RULING ON C3-06, quoted: *"Open run reads to view_exception:
       anyone who can see the register can see its runs; admit_source stays the
       gate for starting runs."* A role carrying the OLD verb and not the new
       one is the differential that tells the move from a widening. */
    await asMigrator(async (q) => {
      await q('DELETE FROM tenant.role_capability WHERE tenant_id = $1 AND role_id = $2', [ACME, ROLE])
      await q('INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ($1, $2, $3)', [
        ACME,
        ROLE,
        CAPABILITIES.admitSource,
      ])
    })
    try {
      for (const path of [accountPath(ACME_RUN), residuePath(ACME_RUN)]) {
        const res = await get(plane.url, path)
        assert.equal(res.status, 403, `\`${path}\` still reads on \`admit_source\`. Got: ${res.status} ${res.text}`)
      }
    } finally {
      await asMigrator(async (q) => {
        await q('DELETE FROM tenant.role_capability WHERE tenant_id = $1 AND role_id = $2', [ACME, ROLE])
        await q('INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ($1, $2, $3)', [
          ACME,
          ROLE,
          CAPABILITIES.viewException,
        ])
      })
    }
  })

  /* ================================================================ *
   * §4 · INVARIANT 1, ON FOUR VECTORS, FOR EACH OPERATION.
   *
   *   "Tenant scope is derived from the session, never read from a request."
   *
   * Copied verbatim from `CLAUDE.md`, because a paraphrased invariant is a
   * changed invariant.
   * ================================================================ */

  it('4a · another tenant`s account, asked for BY ITS EXACT ID, answers exactly like an id nobody seeded', async () => {
    /**
     * 🛑 A BY-ID READ IS STRICTLY MORE DANGEROUS THAN A COLLECTION READ: a
     * collection read that forgets its scope returns a suspicious number of
     * rows, and this returns exactly the row the attacker asked for. Both
     * operations are by-id.
     *
     * ⚠️ AND GLOBEX'S ACCOUNT REALLY EXISTS — `seedAccounts()` writes one for
     * `run_globex_engine`. Without that the assertion would be satisfied by an
     * empty database and would witness nothing.
     */
    for (const build of [accountPath, (r: string) => residuePath(r)]) {
      const crossTenant = await get(plane.url, build(GLOBEX_RUN))
      const absent = await get(plane.url, build(NEVER_SEEDED))

      assert.equal(
        crossTenant.status,
        404,
        'A CROSS-TENANT BY-ID READ SUCCEEDED. Tenant scope is derived from the session, ' +
          'never read from a request, and the row-level security policy — not a `WHERE` in ' +
          `the handler — is what answers. Got: ${crossTenant.status} ${crossTenant.text}`,
      )
      assert.equal(absent.status, 404, absent.text)
      assert.equal(
        crossTenant.text,
        absent.text,
        'THE TWO 404 BODIES ARE NOT BYTE-IDENTICAL. Any difference at all between "does not ' +
          'exist" and "belongs to someone else" tells an attacker which run ids are real — ' +
          'the existence oracle `capability.openapi.yaml`\'s `NotFound` forbids in its own ' +
          `words. cross-tenant: ${crossTenant.text} · absent: ${absent.text}`,
      )
    }
  })

  it('4a-control · with RLS DISABLED the SAME request LEAKS another tenant`s account', async () => {
    /**
     * 🛑 THE CONTROL THAT MAKES 4a MEAN ANYTHING, AT THE ROUTE RATHER THAN AT
     * THE STORE. `tests/db/run-engine-account.test.ts` assertion 5 carries it
     * one layer down and `tests/http/data-plane-http.test.ts` carries it for
     * the `run` table; neither covers THIS path, and *"the only way to tell
     * isolation produced by the database from isolation produced by a `WHERE`
     * a handler happens to carry"* is to turn the database's half off and
     * require the leak.
     *
     * ⚠️ WITHOUT IT, 4a PASSES AGAINST A HANDLER THAT FILTERS IN TYPESCRIPT,
     * against a globex fixture that never landed, and against a route that
     * 404s everything. All three are wrong in ways 4a cannot see.
     */
    const admin = await migratorClient()
    try {
      for (const table of ACCOUNT_TABLES) {
        await admin.query(`ALTER TABLE tenant.${table} DISABLE ROW LEVEL SECURITY`)
      }
      const leaked = await get(plane.url, accountPath(GLOBEX_RUN))
      assert.equal(
        leaked.status,
        200,
        'TURNING ROW-LEVEL SECURITY OFF DID NOT CHANGE THE ANSWER, WHICH MEANS THE ISOLATION ' +
          '4a ASSERTS IS NOT COMING FROM THE DATABASE. Either the store or the handler is ' +
          'filtering by tenant itself — §5.1, a rule keyed on a convenient landmark — or the ' +
          `globex fixture never landed. Got: ${leaked.status} ${leaked.text}`,
      )
      const residue = await get(plane.url, residuePath(GLOBEX_RUN))
      assert.equal(residue.status, 200, `the residue did not leak with RLS off: ${residue.text}`)
    } finally {
      for (const table of ACCOUNT_TABLES) {
        await admin.query(`ALTER TABLE tenant.${table} ENABLE ROW LEVEL SECURITY`)
      }
      await admin.end()
    }

    /* And the property is back the moment the database's half is: a control
     * that left the schema weakened would make every later assertion a
     * statement about a different database. */
    assert.equal((await get(plane.url, accountPath(GLOBEX_RUN))).status, 404)
  })

  it('4b · a tenant named in a HEADER does not widen either read', async () => {
    /* Headers are not `additionalProperties: false` — a browser sends a dozen
     * no contract declares — so the property is that they are not READ. */
    for (const build of [accountPath, (r: string) => residuePath(r)]) {
      const res = await get(plane.url, build(GLOBEX_RUN), {
        headers: { 'X-Tenant-Id': GLOBEX, 'X-Session-Tenant': GLOBEX },
      })
      assert.equal(
        res.status,
        404,
        `A HEADER NAMING ANOTHER TENANT WIDENED A BY-ID READ. Got: ${res.status} ${res.text}`,
      )
    }
  })

  it('4c · a tenant named in a COOKIE does not widen either read', async () => {
    /**
     * 🛑 THIS ASSERTION'S OWN PREMISE WENT FALSE ON 19 Sep 2026 AND THE
     * ASSERTION GOT STRONGER RATHER THAN WEAKER. THE OLD COMMENT IS QUOTED
     * BECAUSE IT PREDICTED EXACTLY THIS DAY:
     *
     *     "Today a cookie cannot reach a handler: fastify parses none without
     *      `@fastify/cookie`, which is not a dependency, and nothing in
     *      `server/` touches `request.cookies`. Those are facts about the
     *      tree, not the property — **and the day somebody adds the plugin for
     *      a session cookie they go stale silently.** An absence this file
     *      relies on is an absence this file asserts."
     *
     * **A cookie reaches the authenticator now** — G386, and no plugin: hand-
     * parsed in `server/data-plane/session-cookie.ts`, by EXACT NAME. So the
     * property under test is no longer *"no cookie is read"*; it is **"exactly
     * one cookie is read, by name, and it is not a tenant"**.
     *
     * ⚠️ THE SESSION COOKIE IS SENT ALONGSIDE THE HOSTILE ONES, WHICH IS WHAT
     * MAKES THIS A 404 RATHER THAN A 401. Dropping it — as this file did for
     * one commit — turns the assertion into *"an unauthenticated request is
     * refused"*, which is true, already proven elsewhere, and says nothing at
     * all about whether a cookie can widen an AUTHENTICATED read. That is the
     * §5.6 shape: the assertion stayed green-looking while measuring something
     * else.
     */
    for (const build of [accountPath, (r: string) => residuePath(r)]) {
      const res = await get(plane.url, build(GLOBEX_RUN), {
        headers: {
          cookie:
            `tenantId=${GLOBEX}; tenant=${GLOBEX}; app.tenant_id=${GLOBEX}; ` +
            `${sessionCookie(HANDLE)['cookie'] ?? ''}`,
        },
      })
      assert.equal(
        res.status,
        404,
        `A COOKIE NAMING ANOTHER TENANT WIDENED A BY-ID READ. Got: ${res.status} ${res.text}`,
      )
      assert.equal(
        res.body?.['code'],
        'resource_not_found',
        `the cookie changed the refusal, which is an existence oracle. Got: ${res.text}`,
      )
    }
  })

  it('4d · a tenant named in the QUERY is REFUSED on BOTH operations — the asymmetry this test was written to name is CLOSED', async () => {
    /**
     * ✅ **THE ASYMMETRY IS GONE — G941, 20 Sep 2026 — AND THE OLD NOTE IS
     *    QUOTED RATHER THAN DELETED, BECAUSE IT IS THE SENTENCE `docs/HANDOFF.md`
     *    §8 WAS WRITTEN FROM AND THE ONE A READER WOULD HAVE QUOTED ONWARD.**
     *
     * ⛔ It read: *"🛑 THE TWO OPERATIONS ANSWER DIFFERENTLY AND THE REASON IS
     *    STRUCTURAL, NOT A DEFECT IN EITHER HANDLER. `server/contract/routes.ts`
     *    builds a querystring schema ONLY from declared query parameters, and
     *    puts `additionalProperties: false` on it — invariant 1's second line of
     *    defence, with `removeAdditional: false` so ajv REJECTS rather than
     *    strips. `listRunResidue` declares `cursor` and `limit`, so it has such
     *    a schema and `?tenantId=` is a 400. **`getRunAccount` declares NO query
     *    parameter, so `schemaFromParameters()` returns `undefined` and the
     *    route carries no querystring schema at all** — derive it: `grep -n 'if
     *    (Object.keys(properties).length === 0) return undefined'
     *    server/contract/routes.ts`. ⚠️ SO ON `getRunAccount` THE KEY IS IGNORED,
     *    AND THIS FILE REFUSES TO REPORT THAT AS THE SAME PROPERTY: "ignored and
     *    read look identical from outside and only one of them is the property."
     *    … **Closing it means emitting an empty `additionalProperties: false`
     *    querystring schema for such operations, which changes behaviour on every
     *    tier and is a ruling rather than a mount.** It is owed, not done, and
     *    nothing in `npm run check` can see it."*
     *
     * **Every clause of that was true and the last two are now false.** The
     * ruling was taken, the emission changed, and the grep that note gave
     * returns NOTHING — which is the intended answer, not a rotted citation.
     * `tests/http/parameter-free-querystring.test.ts` is the control and
     * carries the captured red: **122 of 136 declared operations had no
     * querystring schema**, of which `getRunAccount` was one.
     *
     * 🛑 **THE OLD ASSERTIONS ARE NOT MERELY REPLACED — THE PROPERTY THEY
     *    GUARDED IS KEPT AND IS NOW THE WEAKER OF TWO.** *"The answer does not
     *    move"* was all that could be asserted while the key was ignored; it is
     *    still asserted below, against the request that is now REFUSED, because
     *    a 400 whose body differed between an ACME run and a GLOBEX one would
     *    be an existence oracle wearing a refusal. So this test now makes the
     *    STRONGER claim (the attempt is visible in a status code) **and keeps
     *    the older one** (nothing about the answer moves).
     */
    const refused = await get(plane.url, residuePath(ACME_RUN, `?limit=50&tenantId=${GLOBEX}`))
    assert.equal(
      refused.status,
      400,
      'A QUERY PARAMETER NAMING A TENANT WAS NOT REFUSED ON AN OPERATION THAT HAS A ' +
        `QUERYSTRING SCHEMA. Got: ${refused.status} ${refused.text}`,
    )

    const clean = await get(plane.url, accountPath(ACME_RUN))
    const queried = await get(plane.url, accountPath(ACME_RUN) + `?tenantId=${GLOBEX}`)
    assert.equal(
      queried.status,
      400,
      'A QUERY PARAMETER NAMING A TENANT WAS NOT REFUSED ON A PARAMETER-FREE OPERATION. ' +
        'G941 emits `{type: object, properties: {}, additionalProperties: false}` for one, so ' +
        `\`getRunAccount\` refuses exactly as \`listRunResidue\` does. Got: ${queried.status} ${queried.text}`,
    )
    assert.equal(
      queried.body?.['code'],
      'validation_failed',
      `the refusal is not the schema's. Got: ${queried.text}`,
    )
    assert.notEqual(
      clean.status,
      400,
      'the CLEAN request is refused too, so the assertion above is the route being broken ' +
        `rather than the query key being refused. Got: ${clean.status} ${clean.text}`,
    )

    /**
     * ⚠️ THE SURVIVING HALF OF THE OLD ASSERTION: the refusal must carry no
     * tenant-distinguishing content. Two runs in two tenants, both refused,
     * must be refused IDENTICALLY — otherwise the 400 is an existence oracle
     * across the tenant boundary, which is §4's whole subject one assertion up.
     */
    const foreignQueried = await get(plane.url, accountPath(GLOBEX_RUN) + `?tenantId=${GLOBEX}`)
    assert.equal(
      foreignQueried.text,
      queried.text,
      "the refusal DIFFERS between this tenant's run and another tenant's, which makes the " +
        'validator an existence oracle. ajv answers before the handler and must know nothing ' +
        'about which rows exist.',
    )
  })

  /* ================================================================ *
   * §5 · THE `refused` ARM IS NOT PERSISTED, AND THIS FILE DOES NOT IMPLY
   *      OTHERWISE.
   * ================================================================ */

  it('5a · a run with no engine account is a 404, identical to a run that does not exist', async () => {
    /**
     * 🛑 THREE FACTS, ONE ANSWER, AND THE COLLAPSE IS STATED RATHER THAN
     * DISCOVERED. `db/migrations/0007_run_engine_account.sql`: *"The `refused`
     * arm is NOT persisted … a refused run has no account row, so
     * `getRunAccount` answers 404 for it — the same answer it gives for a run
     * nobody has reconciled yet. **Those two facts are collapsed today.**"*
     * `run_acme_bare` is a run this tenant OWNS and can see through `getRun`,
     * and its account is nevertheless absent.
     */
    const visible = await get(plane.url, `/v1/runs/${ACME_BARE}`)
    assert.equal(
      visible.status,
      200,
      'the bare run is not visible through `getRun`, so §5a is not measuring what it thinks',
    )

    for (const build of [accountPath, (r: string) => residuePath(r)]) {
      const bare = await get(plane.url, build(ACME_BARE))
      const absent = await get(plane.url, build(NEVER_SEEDED))
      assert.equal(
        bare.status,
        404,
        'A RUN WITH NO ENGINE ACCOUNT ANSWERED SOMETHING OTHER THAN 404. For the residue the ' +
          'tempting wrong answer is `{items: [], nextCursor: null}`, which reports a clean ' +
          `close for a run nobody ran. Got: ${bare.status} ${bare.text}`,
      )
      assert.equal(bare.text, absent.text, 'the two 404s differ, which is an existence oracle')
    }
  })

  it('5b · the refused arm HAS storage now, and a bare `refused` is still REFUSED', async () => {
    /**
     * ✅ **THIS WAS A TRIPWIRE ASSERTING AN ABSENCE UNTIL 21 Sep 2026 AND IT
     *    FIRED, EXACTLY AS IT WAS BUILT TO.** `db/migrations/0190_run_refusal.sql`
     *    (E6, G1511–G1515) landed and the whole `npm run check` went RED here:
     *
     *      ✖ 5b · nothing persists a refusal, and a stored `refused` is REFUSED
     *             rather than published
     *        + actual   [ 'run_refusal' ]
     *        - expected []
     *
     *    …carrying its own instruction, which this replacement obeys rather
     *    than deletes: *"the refused arm now has storage (run_refusal) and this
     *    file still asserts it does not. The commit that lands it owes the
     *    positive assertions here AND owes `0007`'s collapse note an amendment
     *    — do not delete this to go green."* **Both are paid.**
     *
     * 🛑 **AND THE HALF THAT MATTERED MOST SURVIVES WHOLE, WHICH IS WHY THIS IS
     *    A REPLACEMENT AND NOT A DELETION.** The original's second assertion was
     *    *"a stored `refused` is REFUSED rather than published"*, and its reason
     *    is UNCHANGED by the arm being built: `0007`'s `outcome` column admits
     *    the word, the wire's refused arm is `required: [outcome, refusal]`, and
     *    **`fast-json-stringify` serialises without validating in the additive
     *    direction** — so a handler that published `{outcome: 'refused'}` off
     *    the word alone would ship a body missing its own required property.
     *    §5b-i below drives exactly that and requires the 500.
     *
     * ⚠️ **THE PROBE'S OWN RECORDED MISTAKE IS KEPT, because it is still the
     *    reason this query names tables rather than matching a prefix:** the
     *    first form matched `run_refus%` and caught `tenant.run_refused_item` —
     *    `0007`'s table for items refused AT ADMISSION, a channel of the
     *    PRODUCED arm and nothing to do with a refused RUN. **Two different
     *    refusals share a word**, and a probe keyed on the word reported the arm
     *    as built when it was not. §5.1 in miniature.
     */
    const found = await asMigrator(async (q) => {
      const out = await q(
        `SELECT t.table_name AS name FROM information_schema.tables t
          WHERE t.table_schema = 'tenant'
            AND t.table_name IN ('run_refusal', 'run_refusal_normalisation_defect')
         ORDER BY 1`,
      )
      return (out.rows as Array<Record<string, unknown>>).map((r) => String(r['name']))
    })
    assert.deepEqual(
      found,
      ['run_refusal', 'run_refusal_normalisation_defect'],
      'E6`s two tables are the storage the refused arm is published from; if one is missing ' +
        'the arm is half-built and `readRunRefusal()` will answer `unpublishable` for reasons ' +
        'nobody can act on',
    )
  })

  it('5b-i · a stored `refused` with NO refusal row is REFUSED, not published', async () => {
    /* 🛑 THE ORIGINAL TRIPWIRE'S SURVIVING HALF. `0190` §1's foreign key makes
     * this pair atomic, so reaching it means something wrote an envelope another
     * way — and the honest answer is the store's `unpublishable`, NOT a
     * `no_account` 404 (which would republish the very collision E6 removes) and
     * NOT an invented refusal. */
    await asMigrator((q) =>
      q(`UPDATE tenant.run_engine_account SET outcome = 'refused' WHERE run_id = $1`, [ACME_RUN]),
    )
    try {
      const res = await get(plane.url, accountPath(ACME_RUN))
      assert.equal(
        res.status,
        500,
        'A STORED `refused` WITH NO REFUSAL ROW WAS PUBLISHED. There is nothing to build a ' +
          '`RunRefusal` from, so whatever came back was invented — the fabrication ' +
          `\`server/data-plane/run-account.ts\` refuses by name. Got: ${res.status} ${res.text}`,
      )
      assert.equal(res.body?.['code'], 'upstream_unavailable')
      assert.equal(
        res.body?.['detail'],
        'A stored run carries a value the domain model does not define. It was not published.',
        'the 500 leaked something request-derived; `errors.yaml` forbids it and the constant ' +
          'is shared with `server/data-plane/runs.ts` so the two cannot diverge',
      )
    } finally {
      await asMigrator((q) =>
        q(`UPDATE tenant.run_engine_account SET outcome = 'produced' WHERE run_id = $1`, [ACME_RUN]),
      )
    }
  })

  it('5b-ii · a stored `refused` WITH its refusal row publishes the refused arm', async () => {
    /**
     * 🛑 **THE POSITIVE ASSERTION THE TRIPWIRE ASKED FOR, AND IT IS THE ONE
     *    E6 EXISTS FOR:** a refused run is now DISTINGUISHABLE from a run nobody
     *    reconciled, over HTTP, on the served path. Before `0190` both were 404.
     *
     * ⚠️ **AND THE BODY CARRIES NO LEDGER.** `capability.openapi.yaml` states it
     *    on the schema — *"a refused run produced nothing, and the refusal IS the
     *    output. Declaring those properties on it 'just in case' would make an
     *    invalid state legal (§5.5)"* — so `terminalStatus`, `admissionRates` and
     *    the eight other channels must be ABSENT, not null and not empty.
     */
    await asMigrator(async (q) => {
      await q(
        `UPDATE tenant.run_engine_account
            SET outcome = 'refused', terminal_status = NULL
          WHERE run_id = $1`,
        [ACME_RUN],
      )
      await q(
        `INSERT INTO tenant.run_refusal (tenant_id, run_id, kind)
         VALUES ($1, $2, 'subset_sum_bound_not_stated')`,
        [ACME, ACME_RUN],
      )
    })
    try {
      const res = await get(plane.url, accountPath(ACME_RUN))
      assert.equal(res.status, 200, `the refused arm was not published: ${res.status} ${res.text}`)
      assert.equal(res.body?.['outcome'], 'refused')
      assert.deepEqual(res.body?.['refusal'], { kind: 'subset_sum_bound_not_stated' })
      assert.deepEqual(
        Object.keys(res.body as Record<string, unknown>).sort(),
        ['outcome', 'refusal'],
        'the refused arm carried a ledger; the wire marks it `additionalProperties: false` and ' +
          'a produced channel here is an invalid state made legal',
      )
    } finally {
      await asMigrator(async (q) => {
        await q('DELETE FROM tenant.run_refusal WHERE run_id = $1', [ACME_RUN])
        await q(
          `UPDATE tenant.run_engine_account
              SET outcome = 'produced', terminal_status = 'completed'
            WHERE run_id = $1`,
          [ACME_RUN],
        )
      })
    }
  })

  /* ================================================================ *
   * §6 · G301's SIXTH FENCE, FOR THESE TWO OPERATIONS, ASSERTED.
   * ================================================================ */

  it('6 · a handler that mints nothing does not BOOT — asserted, not assumed', async () => {
    /**
     * 🛑 THIS NEEDS NO DATABASE AND NO PORT, AND THAT IS WHY IT IS HERE RATHER
     * THAN INFERRED FROM THE FACT THAT THE PLANE STARTED. `mountTier()`'s sixth
     * fence is G301's load-bearing half — *"AN OPERATION MAY NOT MOUNT UNTIL IT
     * MINTS A RECORD"* — and the only way to know it fires for THESE two
     * operations is to hand it a bare handler for them and require a throw.
     *
     * ⚠️ IT IS INSIDE THE `{ skip }` SUITE, WHICH COSTS SOMETHING AND IS
     * ACCEPTED: on a machine with no PostgreSQL this assertion stands down with
     * the rest. Moving it out would need its own top-level describe and its own
     * reachability reasoning for a test that needs neither, and the CI guard
     * above makes the skip impossible where it matters.
     */
    for (const op of [getRunAccountOperation, listRunResidueOperation]) {
      await assert.rejects(
        () =>
          buildPlane<unknown>(
            {
              plane: 'data-plane',
              authenticate: async () => ({}),
              unauthenticatedDetail: 'x',
              authorise: () => 'held',
              unauthorisedDetail: 'x',
            },
            [{ tier: 'capability', handlers: { [op.operationId]: async () => ({}) } }],
          ),
        (err: Error) => {
          assert.match(
            err.message,
            new RegExp(`mint no\\s+authorisation record[\\s\\S]*${op.operationId}`),
            `the plane booted, or refused for another reason, with a NON-MINTING handler on ` +
              `\`${op.operationId}\`. G301: "every newly mounted operation arrives already ` +
              `recording, rather than a backlog accruing behind a promise." Got: ${err.message}`,
          )
          return true
        },
      )
    }

    /* AND THE MIRROR, so §6 cannot pass against a fence that refuses
     * EVERYTHING: the same mount with `recordsAuthorisation()` around it gets
     * past this fence. (It is not the real handler — it mints nothing — which
     * is exactly the hole `authorisation-record.test.ts` §2b closes by
     * requiring one call site.) */
    const app = await buildPlane<unknown>(
      {
        plane: 'data-plane',
        authenticate: async () => ({}),
        unauthenticatedDetail: 'x',
        authorise: () => 'held',
        unauthorisedDetail: 'x',
      },
      [
        {
          tier: 'capability',
          handlers: {
            getRunAccount: recordsAuthorisation(async () => ({})),
            listRunResidue: recordsAuthorisation(async () => ({})),
          },
        },
      ],
    )
    await app.close()
  })

  /* ================================================================ *
   * §7 · INVARIANT 10 — EACH SERVED READ LEAVES A RECORD NAMING THE RUN.
   * ================================================================ */

  it('7 · both operations mint one record each, and both name the RUN as the instance', async () => {
    await asMigrator((q) => q('DELETE FROM tenant.authorization_grant_via'))
    await asMigrator((q) => q('DELETE FROM tenant.authorization_grant'))

    assert.equal((await allRecords()).length, 0, 'the table was not emptied before the act')

    assert.equal((await get(plane.url, accountPath(ACME_RUN))).status, 200)
    assert.equal((await get(plane.url, residuePath(ACME_RUN))).status, 200)

    const records = await allRecords()
    assert.equal(
      records.length,
      2,
      `two served reads wrote ${records.length} record(s). ONE request, ONE authorisation: ` +
        '"A grant that covered several would be a session."',
    )
    for (const row of records) {
      assert.equal(row['tenant_id'], ACME)
      assert.equal(row['subject_user_id'], MEI, 'the record must name the person who acted')
      /* G3881 — the record names the OPERATION's verb, `view_run`, which the
         role carries through its `view_exception` (G3801's reach, unchanged). */
      assert.equal(row['capability'], CAPABILITIES.viewRun)
      assert.equal(
        row['resource_type'],
        'Run',
        '`ResourceRef` wants the ENTITY name. An account has no id of its own — it is keyed ' +
          'by `run_id` — so naming it anything else would make two grants over the same act ' +
          'unjoinable in the audit.',
      )
      assert.equal(
        row['resource_id'],
        ACME_RUN,
        'A RECORD NAMED NO INSTANCE. `listRunResidue` is a list OF ONE RUN, not "opening a ' +
          'list": recording `null` would say the caller was authorised to open every residue ' +
          'in the tenant, which is a WIDER act than the one that happened. An audit record ' +
          'that overstates a grant is worse than none, because it reads as evidence.',
      )
    }
  })
})

/**
 * THE STAFF CONSOLE'S FIRST SERVED OPERATION — `listTenants`, over a socket,
 * against TWO REAL DATABASES, with the PRODUCTION authoriser and the PRODUCTION
 * substrate.
 *
 * **G1241 (THE OWNER'S) and G1244, 20 Sep 2026.**
 *
 * ┌─ WHAT THIS FILE IS FOR, AND IT IS NOT "THE STATUS WAS 200" ───────────────┐
 * │ `db/migrations-control/0002_tenancy_roster.sql` held this operation back   │
 * │ for a day on ONE refused column, and the reason four documents give is     │
 * │ G656's: *"`fast-json-stringify` serialises without validating, so an       │
 * │ operation with an almost-complete table ships a 200 missing `required`     │
 * │ fields SILENTLY."*                                                         │
 * │                                                                            │
 * │ 🛑 **§2 IS THEREFORE THE POINT OF THE SUITE: it DERIVES `TenantSummary`'s  │
 * │ `required` list FROM THE CONTRACT DOCUMENT and asserts every name is       │
 * │ present in the BYTES of a real served response.** A slice that mounted     │
 * │ this and asserted a status code would have reproduced the defect it        │
 * │ exists to fix.                                                             │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G1244 — AND IT CORRECTS THE PREMISE THE HOLD-BACK RESTED ON, MEASURED
 *    AGAINST THE PINNED VERSION RATHER THAN REASONED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `fast-json-stringify@7.0.1` — what `fastify@5.12.5` pins; derive it,
 * `npm ls fast-json-stringify` — **THROWS on a missing `required` property**,
 * and Fastify turns that into a 500. Captured before this slice built anything,
 * against `TenantSummary`'s own schema:
 *
 *     required ABSENT                 -> 500 {"message":"\"stage\" is required!"}
 *     required ABSENT, schema default -> 200, filled from the default. SILENT.
 *     property PRESENT, not declared  -> 200, dropped.                 SILENT.
 *
 * **So the serialiser is silent in the ADDITIVE direction and loud in the
 * SUBTRACTIVE one, and the recorded sentence has the two the wrong way round.**
 * Mounting `listTenants` against the roster alone would have 500'd on every
 * request — a worse outage and a better alarm than the quiet incomplete roster
 * the record predicted.
 *
 * ⚠️ **THE BLOCKER IS NOT WEAKENED BY THAT AND §2 IS NOT MADE REDUNDANT BY IT.**
 * G833 refused a `stage` column on its own ground — a second home for state
 * `model/onboarding.ts` owns — and that refusal STANDS; `stage` has a DERIVED
 * producer instead. **And the silent arm has not gone away: it moved to
 * `default`.** §2c pins `TenantSummary`'s absence of one, so the day somebody
 * adds a `default:` to a contract property the hole is a red gate rather than a
 * quiet 200.
 *
 * ⚠️ IT NEEDS BOTH DATABASES AND SKIPS LOUDLY WITHOUT THEM, like every other
 * file here that needs one. A run in which this file skipped is NOT evidence
 * that the staff console serves a complete tenancy roster.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import { controlDbPort } from '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'

import { databaseRequiredUnderCi } from '../reachability.ts'

/* ------------------------------------------------------------------ *
 * TWO DATABASES, BOTH NAMED BEFORE ANYTHING READS A VARIABLE.
 *
 * `db/env.ts` and `server/control-plane/config.ts` both resolve per call rather
 * than at import, which is what makes a per-suite database possible while
 * agents gate concurrently.
 *
 * ⚠️ `RECONCILE_CONTROL_DB_NAME` AND `RECONCILE_CONTROL_READ_DB_NAME` NAME THE
 * SAME DATABASE AND ARE TWO VARIABLES, which is G1162: the control plane
 * provisions it, the DATA plane reads it, and they authenticate as different
 * roles. Collapsing them into one would be the shared credential
 * `db/migrations-control/0020_console_read_role.sql` refuses by name.
 * ------------------------------------------------------------------ */

const CONTROL_DB =
  process.env['RECONCILE_CONSOLE_SERVED_CONTROL_DB_NAME'] ?? runScopedName('reconcile_console_served_control_test')
const TENANT_DB =
  process.env['RECONCILE_CONSOLE_SERVED_TENANT_DB_NAME'] ?? runScopedName('reconcile_console_served_tenant_test')

process.env['RECONCILE_CONTROL_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_CONTROL_READ_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_DB_NAME'] = TENANT_DB
if ((process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? '') === '') {
  process.env['RECONCILE_CONTROL_DB_ADMIN'] = process.env['USER'] ?? 'postgres'
}

/**
 * 🛑 THE FLAG IS DELETED, exactly as `tests/http/console-and-staff-grant-served.test.ts`
 * deletes it. Under `RECONCILE_LOCAL_TEST_AUTH` nothing resolves a subject and
 * `decide()` is never reached through its real terms, so the whole file would
 * assert the dev-token arm instead of the deployed one.
 */
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const CONSOLE_HOST = 'console.reconcile.invalid'
const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'

process.env['RECONCILE_SERVING_HOSTS'] = `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active`
/** Flat, no region label — G297, and `checkConsoleHostRegistration()` enforces it at boot. */
process.env['RECONCILE_CONSOLE_HOSTS'] = `${CONSOLE_HOST}|staff|active`

const { probeDatabase, describeTarget } = await import('../../db/env.ts')
const { loadPg } = await import('../../db/pg.ts')

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/http/console-roster-served.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS FILE IS THE ONLY PLACE A SERVED `listTenants` RESPONSE IS CHECKED',
      '   FIELD BY FIELD AGAINST ITS OWN CONTRACT. A run in which it skipped is',
      '   NOT evidence that the staff console ships a complete tenancy roster.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the served console roster', probe)

import { loadTier } from '../../server/contract/document.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { buildPlane, type Handler } from '../../server/http/app.ts'
import { CAPABILITIES } from '../../model/access.ts'
import {
  provisionControlPlane,
  seedTenancyRoster,
} from '../../server/control-plane/provision.ts'
import { sessionCookie } from './harness.ts'
import { startInternalPair, type InternalPair } from './internal-pair.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * The console principal. A PLATFORM door, a person with no membership
 * anywhere, a platform role carrying ONE verb, and an unbound session.
 * ------------------------------------------------------------------ */

const FDE = 'usr_fde_priya'
const DOOR_PLATFORM = 'idc_1ch_entra'
const BROKER_ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_TESTPOOL'
const PLATFORM_ROLE = 'prl_fleet_reader'
const CONSOLE_HANDLE = 'sh_con_4a1d9e02c7b6f35814de2a7b0c9f6d38'

/** A customer operator on a tenant host, for §3's differential. */
const MEI = 'usr_ops_mei'
const DOOR_CUSTOMER = 'idc_acme_entra'
const TENANT_HANDLE = 'sh_mei_31c7a2e08b4d6f19a5e0c3b7d2f4a681'
const ACME = 'ten_acme'
const TENANT_ROLE = 'rol_ap_approver'

interface Response {
  readonly status: number
  readonly body: Record<string, unknown> | undefined
  readonly text: string
}

/**
 * `node:http` AND NEVER `fetch`, for `tests/http/context-resolve.test.ts`'s
 * reason: `Host` is a forbidden header name in the Fetch standard and undici
 * drops it, so every host-binding assertion would be about a binding this file
 * did not choose.
 */
function send(
  origin: string,
  path: string,
  opts: { host: string; session?: string },
): Promise<Response> {
  const url = new URL(origin)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method: 'GET',
        headers: {
          Host: opts.host,
          ...(opts.session === undefined ? {} : sessionCookie(opts.session)),
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
    req.end()
  })
}

async function createDatabaseIfAbsent(name: string): Promise<void> {
  const { Client } = await loadPg()
  const admin = new Client({
    host: '127.0.0.1',
    port: controlDbPort(),
    database: 'postgres',
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
    application_name: 'reconcile-console-served-setup',
  })
  await admin.connect()
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    // CREATE DATABASE cannot run inside a transaction block, hence no BEGIN.
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE ${name}`)
  } finally {
    await admin.end()
  }
}

/**
 * The identity substrate, in the TENANT database.
 *
 * 🛑 THE FDE HOLDS NO MEMBERSHIP AND NO TENANT ROLE ANYWHERE, AND THAT IS THE
 * FIXTURE'S WHOLE CLAIM. Invariant 8: *"Being staff is not access."* The only
 * authority in this fixture is a `platform_role_assignment`, which is G289's
 * second instrument — *"a second instrument that spends capabilities and is not
 * a grant"* — and it is what `decide()`'s fourth arm reads.
 *
 * ⚠️ THE ROLE CARRIES `view_substrate` AND NOTHING ELSE, so §3b's refusal of a
 * second verb is a statement about the ROSTER of capabilities rather than about
 * the arm.
 */
async function seedTenantSubstrate(): Promise<void> {
  const consoleDigest = digestOfHandle(CONSOLE_HANDLE)
  const tenantDigest = digestOfHandle(TENANT_HANDLE)
  assert.notEqual(consoleDigest, null, 'a fixture handle digested to nothing')
  assert.notEqual(tenantDigest, null, 'a fixture handle digested to nothing')

  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES
         ($1, 'oidc', '1CloudHub Entra', 'platform', NULL, NULL, $3, '1ch-entra', 'active'),
         ($2, 'oidc', 'Acme Entra ID',   'customer', NULL, 'acc_acme', $3, 'acme-entra', 'active')
       ON CONFLICT DO NOTHING`,
      [DOOR_PLATFORM, DOOR_CUSTOMER, BROKER_ISSUER],
    )
    await mig.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES ($1, 'priya@1cloudhub.invalid', 'Priya R', 'active', $2),
              ($3, 'mei@acme.invalid',        'Mei Tan', 'active', $4)
       ON CONFLICT DO NOTHING`,
      [FDE, DOOR_PLATFORM, MEI, DOOR_CUSTOMER],
    )
    await mig.query(
      `INSERT INTO tenant.platform_role (id, label, key, version, stakeholder_class, status)
       VALUES ($1, 'Fleet reader', 'fleet_reader', 1, 'platform', 'active')
       ON CONFLICT DO NOTHING`,
      [PLATFORM_ROLE],
    )
    await mig.query(
      `INSERT INTO tenant.platform_role_capability (role_id, capability)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [PLATFORM_ROLE, CAPABILITIES.viewSubstrate],
    )
    /* `expires_at` is NOT NULL by construction — `DURABLE_ASSIGNMENT_PERMITTED.platform` is false. */
    await mig.query(
      `INSERT INTO tenant.platform_role_assignment
         (id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
       VALUES ('pra_priya_fleet', $1, $2, 1, 'bootstrap', now(), now() + interval '8 hours', NULL)
       ON CONFLICT DO NOTHING`,
      [FDE, PLATFORM_ROLE],
    )
    /* An ordinary tenant role for §3's differential — a CUSTOMER principal. */
    await mig.query(
      `INSERT INTO tenant.role
         (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ($1, $2, 'AP Approver', 'approver', 3, 'operator', 'pack', 'pck_ap', 'active')
       ON CONFLICT DO NOTHING`,
      [ACME, TENANT_ROLE],
    )
    await mig.query(
      `INSERT INTO tenant.role_capability (tenant_id, role_id, capability)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [ACME, TENANT_ROLE, CAPABILITIES.admitSource],
    )
    await mig.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'mem_mei_acme', $2, $3, 'bootstrap', now(), NULL, NULL)
       ON CONFLICT DO NOTHING`,
      [ACME, MEI, TENANT_ROLE],
    )
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES
         ('ses_console', $1, $3, $5, NULL, $7, now(), now(), now() + interval '12 hours', NULL),
         ('ses_tenant',  $2, $4, $6, NULL, $8, now(), now(), now() + interval '12 hours', NULL)
       ON CONFLICT DO NOTHING`,
      [
        consoleDigest,
        tenantDigest,
        FDE,
        MEI,
        DOOR_PLATFORM,
        DOOR_CUSTOMER,
        CONSOLE_HOST,
        ACME_HOST,
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

/** `TenantSummary`'s `required` list, derived from the document this suite is about. */
function tenantSummary(): { required: readonly string[]; properties: Record<string, unknown> } {
  const doc = loadTier('platformConsole') as unknown as {
    components: {
      schemas: Record<string, { required?: string[]; properties?: Record<string, unknown> }>
    }
  }
  const schema = doc.components.schemas['TenantSummary']
  assert.ok(schema !== undefined, '`TenantSummary` is not in the platform-console document')
  return { required: schema.required ?? [], properties: schema.properties ?? {} }
}

const ROSTER_PATH = '/v1/staff/tenants'

describe('the staff console’s tenancy roster, served', { skip }, () => {
  let plane: { url: string; close: () => Promise<void> }
  let pair: InternalPair | undefined

  before(async () => {
    await createDatabaseIfAbsent(CONTROL_DB)
    await provisionControlPlane()
    await seedTenancyRoster()

    await createDatabaseIfAbsent(TENANT_DB)
    await resetSchema()
    await seedTwoTenants(ACME, 'ten_globex')
    await seedTenantSubstrate()

    /**
     * 🛑 NO `authorise` AND NO `substrate` ARGUMENT. The PRODUCTION seams, which
     * is the only thing that makes a green 200 below worth anything: the verdict
     * comes from `decide()` against a principal assembled entirely out of rows.
     */
    /* G4318 — the roster now reaches the data plane over the signed internal
       edge, from a REAL control plane over this database (local internal token,
       passed as an argument). The data plane holds no control-database pool. */
    pair = await startInternalPair()
    plane = await startDataPlane({ poolMax: 4, controlPlane: pair.client })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
    if (pair !== undefined) await pair.close()
  })

  /* ================================================================ *
   * §1 · IT IS MOUNTED AND IT ANSWERS.
   * ================================================================ */

  it('1a · a platform principal on the console host gets a 200 with the fleet', async () => {
    const res = await send(plane.url, ROSTER_PATH, {
      host: CONSOLE_HOST,
      session: CONSOLE_HANDLE,
    })
    assert.equal(
      res.status,
      200,
      'THE FIRST CONSOLE OPERATION EITHER PLANE HAS EVER SERVED DID NOT ANSWER 200. ' +
        'Four things have to hold at once and each has its own file: the tier is mounted ' +
        '(`server/data-plane/start.ts`), the session resolves a tenant-less PLATFORM ' +
        'subject (G726), `decide()`’s fourth arm allows `view_substrate` because ' +
        '`PLATFORM_ASSIGNMENT_REACHES.substrate` is `true` (G601), and `authorize()` mints ' +
        'into invariant 10’s SECOND home (G730). ' +
        `Body: ${res.text}`,
    )
    const tenants = res.body?.['tenants']
    assert.ok(Array.isArray(tenants), `the response carries no \`tenants\` array: ${res.text}`)
    assert.ok(
      tenants.length >= 3,
      'the roster came back with fewer than the three seeded tenants, so every assertion ' +
        'below is about a list that is not the fleet. ⚠️ AN EMPTY ARRAY HERE IS THE ' +
        'EXACT FAILURE `db/migrations-control/0002_tenancy_roster.sql` EXISTS TO REFUSE: ' +
        '*"`listTenants` mounted against `tenant.tenant` answers `200 {"tenants":[]}` — ' +
        `worse than G300's honest 404."* Body: ${res.text}`,
    )
  })

  it('1b · the fleet comes back in id order, and `plan` is absent where there is none', async () => {
    const res = await send(plane.url, ROSTER_PATH, {
      host: CONSOLE_HOST,
      session: CONSOLE_HANDLE,
    })
    const tenants = res.body?.['tenants'] as Array<Record<string, unknown>>
    const ids = tenants.map((t) => String(t['tenantId']))
    assert.deepEqual(
      [...ids].sort(),
      ids,
      'the roster is not sorted. `server/control-plane/provision.ts` inserts `ten_cardinal` ' +
        'first precisely so a deleted `ORDER BY` is a RED rather than a heap that happened ' +
        `to come back in the right order — §5.6, in a fixture. Found: [${ids.join(', ')}]`,
    )
    /**
     * `plan` is the one OPTIONAL property with a nullable column, and
     * `ten_cardinal` has none. An absent key and a `null` are different bytes,
     * and `additionalProperties: false` plus `exactOptionalPropertyTypes` are
     * what make the absent one the honest answer.
     */
    const cardinal = tenants.find((t) => t['tenantId'] === 'ten_cardinal')
    assert.ok(cardinal !== undefined, '`ten_cardinal` is not on the roster')
    assert.equal(
      'plan' in cardinal,
      false,
      '`plan` is present for a tenant that has none. `TenantSummary` does not mark it ' +
        '`required`, the column is nullable, and a `null` on the wire would be this handler ' +
        `asserting a commercial fact nobody agreed. Found: ${JSON.stringify(cardinal)}`,
    )
  })

  /* ================================================================ *
   * §2 · EVERY `required` FIELD IS IN THE BYTES — G833's WHOLE POINT.
   * ================================================================ */

  it('2 · every `required` property of `TenantSummary` is present on every served row', async () => {
    const { required } = tenantSummary()
    /* §5.6: the derivation must have read something. */
    assert.ok(
      required.includes('stage') && required.length >= 5,
      'the derived `required` list is not the one this suite is about. It must include ' +
        `\`stage\` — the field G833 refused a column for. Found: [${required.join(', ')}]`,
    )

    const res = await send(plane.url, ROSTER_PATH, {
      host: CONSOLE_HOST,
      session: CONSOLE_HANDLE,
    })
    const tenants = res.body?.['tenants'] as Array<Record<string, unknown>>
    assert.ok(Array.isArray(tenants) && tenants.length > 0, `no rows to check: ${res.text}`)

    const missing: string[] = []
    for (const row of tenants) {
      for (const property of required) {
        if (!(property in row) || row[property] === null || row[property] === undefined) {
          missing.push(`${String(row['tenantId'])}.${property}`)
        }
      }
    }
    assert.deepEqual(
      missing,
      [],
      'A SERVED ROW IS MISSING A `required` FIELD OF ITS OWN SCHEMA. **This is the assertion ' +
        'the whole slice exists for** — `db/migrations-control/0002_tenancy_roster.sql` ' +
        'held `listTenants` back for a day on exactly this, and a mount that checked only the ' +
        'status code would have shipped the defect it was written to prevent. ' +
        '⚠️ G1244: at `fast-json-stringify@7.0.1` a missing `required` property is a ' +
        'THROW and therefore a 500, so this assertion is most likely to fire through a 500 ' +
        'above rather than through an incomplete 200 — but the SILENT arm still exists ' +
        'behind a schema `default`, which is what §2c pins. ' +
        `Missing: [${missing.join(', ')}]`,
    )
  })

  it('2a · `stage` is DERIVED and reports the two arms `onboardingStage()` has', async () => {
    /**
     * 🛑 THE VALUES ARE THE DISCRIMINANT AND NOT `S1`'s COMPOSED LABEL, which is
     * what makes the operation's own `?stage=` parameter usable against its own
     * output. `server/data-plane/console-roster-store.ts` argues it at length.
     *
     * ⚠️ AND THERE IS NO `stalled`. `model/onboarding.ts` refuses a third arm
     * because it needs a per-transition timestamp with no producer and a
     * threshold nobody has ruled on; `tests/model/onboarding.test.ts` §6 asserts
     * that absence one layer up and this is the served half of it.
     */
    const res = await send(plane.url, ROSTER_PATH, {
      host: CONSOLE_HOST,
      session: CONSOLE_HANDLE,
    })
    const tenants = res.body?.['tenants'] as Array<Record<string, unknown>>
    const stages = [...new Set(tenants.map((t) => String(t['stage'])))].sort()
    assert.deepEqual(
      stages,
      ['live', 'onboarding'],
      'the served stage vocabulary is not `onboardingStage()`’s two arms. If a THIRD ' +
        'value appeared, somebody gave the model a clock and a threshold and owes an ' +
        'argument for both; if one DISAPPEARED, the fixture stopped exercising an arm and ' +
        `the assertion below is weaker than it looks. Found: [${stages.join(', ')}]`,
    )
    const acme = tenants.find((t) => t['tenantId'] === 'ten_acme')
    assert.equal(
      acme?.['stage'],
      'live',
      '`ten_acme` is seeded with all six steps done, so `onboardingStage()` must answer ' +
        '`live`. A wrong answer here means the prefix length and the sequence length ' +
        'disagree — which is what `0030`’s missing upper-bound `CHECK` deliberately ' +
        'leaves to the READER to refuse.',
    )
  })

  it('2b · and NO stage column exists anywhere — G833 stands and is not discharged', async () => {
    const path = await import('node:path')
    const { sqlCode, sqlCorpus, sqlCorpusIsReal } = await import('../sql-code.ts')
    const dir = path.join(import.meta.dirname, '..', '..', 'db', 'migrations-control')
    const sql = sqlCode(sqlCorpus(dir))
    sqlCorpusIsReal(sql, 'the control migration set')
    assert.ok(
      /CREATE TABLE ("?)onboarding_record\1\s*\(/.test(sql),
      'the onboarding table is gone, so `stage` has no producer and §2 above is ' +
        'asserting nothing about a derivation that does not exist',
    )
    assert.ok(
      !/\bstage\b/.test(sql),
      'a `stage` column exists in the CONTROL migration set. **THE OWNER’S RULING OF ' +
        '20 Sep 2026 IS THAT `stage` IS DERIVED AT READ TIME FROM THE STORED STEP STATE, ' +
        'NEVER STORED TWICE**, and G833 refused the column before that on its own ground: ' +
        'a stage column is a SECOND HOME for state `model/onboarding.ts` owns, and the two ' +
        'drift the first time a step is forced, because forcing moves `completed` by more ' +
        'than one. If this is deliberate, the ruling that permits it is what replaces this ' +
        'assertion.',
    )
  })

  it('2c · no `required` property of `TenantSummary` carries a schema `default` — G1244', () => {
    /**
     * 🛑 THIS IS THE ONE SILENT ARM THAT SURVIVES THE MEASUREMENT, AND IT IS
     * PINNED HERE BECAUSE NOTHING ELSE LOOKS AT IT. `fast-json-stringify@7.0.1`
     * THROWS for a missing `required` property — so the recorded "silent 200"
     * is not the failure mode — **except where the schema gives the property a
     * `default`, in which case it fills one in and answers 200.** Measured:
     *
     *     {required:[stage], properties:{stage:{type:string}}}
     *       -> 500 `"stage" is required!`
     *     {required:[stage], properties:{stage:{type:string, default:'live'}}}
     *       -> 200 {"stage":"live"}
     *
     * A `default` on `stage` would therefore publish a CONFIDENT WRONG STAGE for
     * every tenant in the fleet, from the contract document, with no handler
     * involved and no test failing.
     */
    const { required, properties } = tenantSummary()
    const defaulted = required.filter((p) => {
      const schema = properties[p]
      return typeof schema === 'object' && schema !== null && 'default' in schema
    })
    assert.deepEqual(
      defaulted,
      [],
      'a `required` property of `TenantSummary` carries a schema `default`. ' +
        '`fast-json-stringify` FILLS a defaulted property rather than throwing, so the ' +
        'operation would answer 200 with a value the server never computed — which for ' +
        '`stage` is a confident wrong answer about every tenant’s delivery state, and ' +
        'the console’s whole subject is *"where each one has got to"*. ' +
        `Found: [${defaulted.join(', ')}]`,
    )
  })

  /* ================================================================ *
   * §3 · THE DIFFERENTIAL. A 200 nobody can be refused is not a gate.
   * ================================================================ */

  it('3a · a CUSTOMER principal on a tenant host is refused the roster', async () => {
    /**
     * 🛑 WITHOUT THIS THE 200 ABOVE IS §5.6 — a control whose only observable
     * behaviour is success. `usr_ops_mei` holds a live membership and a real
     * tenant capability, so she is authenticated and authorised for other
     * things; she holds no platform assignment, and `decide()`’s customer arm
     * refuses `view_substrate` at its FIRST LINE on
     * `PLATFORM_ONLY_RESOURCE_CLASSES` — `capability_is_platform_only`, G601.
     */
    const res = await send(plane.url, ROSTER_PATH, { host: ACME_HOST, session: TENANT_HANDLE })
    assert.equal(
      res.status,
      403,
      'A CUSTOMER OPERATOR READ THE PLATFORM’S TENANCY ROSTER. That is the exact harm ' +
        '`tests/e2e/browser-login.test.ts` §20 was written against — *"mounting one ' +
        'turns `ten_acme`’s CUSTOMER operator into a reader of the staff tenancy ' +
        'roster"* — and the fence is `PLATFORM_ONLY_RESOURCE_CLASSES`, which keys on the ' +
        'resource CLASS rather than on a list of verb names. ' +
        `Status ${res.status}, body: ${res.text}`,
    )
    assert.equal(
      res.body?.['code'],
      'capability_not_held',
      'the refusal is not the gate’s own code. A 403 from somewhere else would mean the ' +
        `roster is refused for a reason nobody chose. Body: ${res.text}`,
    )
  })

  it('3b · and an UNAUTHENTICATED caller never reaches the validator', async () => {
    const res = await send(plane.url, ROSTER_PATH, { host: CONSOLE_HOST })
    assert.equal(
      res.status,
      401,
      '`server/http/app.ts`: authentication runs in `onRequest`, BEFORE validation, because ' +
        `*"a validator that answers before an authenticator is a schema oracle."* Body: ${res.text}`,
    )
  })

  /* ================================================================ *
   * §4 · THE SIXTH BOOT FENCE STILL BITES ON THIS TIER — G301.
   * ================================================================ */

  it('4 · a BARE handler for `listTenants` refuses to BOOT', async () => {
    /**
     * 🛑 IT IS THE FENCE THAT KEPT EVERY CONSOLE OPERATION UNMOUNTED FOR A DAY,
     * and it is asserted HERE rather than trusted because the mount above is the
     * first thing in the tree that satisfies it. `AuthorizationGrant extends
     * TenantScoped`, so until `db/migrations/0091_platform_authorisation_record.sql`
     * gave a tenant-less act a SECOND home there was nowhere for the record to
     * go — G728 from the console-session side, G783 from the contract side.
     *
     * ⚠️ NO DATABASE. `buildPlane()` registers routes and runs every fence; a
     * boot failure is a `throw` before a port is bound.
     */
    const bare: Handler = async () => ({ tenants: [] })
    await assert.rejects(
      async () => {
        const app = await buildPlane<{ tenantId: string | null }>(
          {
            plane: 'test-console-plane',
            authenticate: () => ({ tenantId: null }),
            unauthenticatedDetail: 'no session',
            authorise: () => 'held',
            unauthorisedDetail: 'no capability',
          },
          [{ tier: 'platformConsole', handlers: { listTenants: bare } }],
        )
        await app.close()
      },
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.ok(
          message.includes('listTenants') && message.includes('authorisation record'),
          'the plane refused to boot for a reason other than the SIXTH FENCE. G301 makes ' +
            'minting invariant 10’s record a PRECONDITION OF MOUNTING so that the ' +
            '*"invariant cannot erode one slice at a time"*; if that fence has moved, the ' +
            `commit that moved it owes this assertion an argument. Message: ${message}`,
        )
        return true
      },
    )
  })

  /* ================================================================ *
   * §5 · THE ACT LEFT A RECORD — IN THE HOME A CONSOLE ACT HAS.
   * ================================================================ */

  it('5 · the served read minted a PLATFORM authorisation record and no tenant one', async () => {
    /**
     * 🛑 THE TWO HOMES ARE NOT INTERCHANGEABLE AND THIS ASSERTS BOTH DIRECTIONS.
     * G730: *"invariant 10 keeps ONE MEANING with TWO HOMES, and each home has a
     * scope that can actually read it."* A console act has no tenant, so its row
     * is in `tenant.platform_authorization_grant`, keyed on the acting SESSION;
     * a row in `tenant.authorization_grant` for this act would be a record
     * G100's deny-on-NULL makes visible to nobody.
     */
    await send(plane.url, ROSTER_PATH, { host: CONSOLE_HOST, session: CONSOLE_HANDLE })

    const mig = await migratorClient()
    try {
      const platform = await mig.query(
        `SELECT capability FROM tenant.platform_authorization_grant WHERE capability = $1`,
        [CAPABILITIES.viewSubstrate],
      )
      assert.ok(
        (platform.rowCount ?? 0) > 0,
        'THE SERVED READ LEFT NO AUTHORISATION RECORD. `CLAUDE.md` invariant 10: *"An act ' +
          'with no authorisation is unrecordable."* The sixth fence asserts the handler is ' +
          'WRAPPED; this asserts the row is WRITTEN, and the two are different claims — ' +
          'a wrapper whose write silently failed would pass the fence and fail here.',
      )
      const tenantSide = await mig.query(
        `SELECT capability FROM tenant.authorization_grant WHERE capability = $1`,
        [CAPABILITIES.viewSubstrate],
      )
      assert.equal(
        tenantSide.rowCount ?? 0,
        0,
        'a CONSOLE act wrote into invariant 10’s TENANT home. That table is keyed on ' +
          '`app.tenant_id`, which a console act never sets, so under G100 the row would be ' +
          'visible to no scope — G284’s *"a result nobody may read is not ' +
          'persistence"* applied to the audit trail. G728 refused a nullable `tenantId` for ' +
          'exactly this reason and `0091` is the answer.',
      )
    } finally {
      await mig.end()
    }
  })
})

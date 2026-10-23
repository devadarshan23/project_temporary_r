/**
 * H2's ONBOARDING PANEL, SERVED — and the FIRST CONSOLE WRITES EITHER PLANE
 * HAS EVER ANSWERED.
 *
 * **R8 and R9, 21 Sep 2026, both THE OWNER'S.** This file is the served half of
 * `server/data-plane/onboarding.ts`; the row-level and privilege halves are
 * `tests/db/onboarding-write-pool.test.ts`.
 *
 * ┌─ WHAT A GREEN RUN HERE IS EVIDENCE OF ───────────────────────────────────┐
 * │ TWO databases, the PRODUCTION authoriser and the PRODUCTION substrate —   │
 * │ `startDataPlane({ poolMax })` takes no `authorise` and no `substrate`     │
 * │ argument, which is the only thing that makes a 200 below worth anything:  │
 * │ the verdict comes from `decide()` against a principal assembled entirely  │
 * │ out of rows.                                                              │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 `RECONCILE_LOCAL_TEST_AUTH` IS DELETED BELOW AND MUST STAY DELETED. With
 * the flag, nothing resolves a subject and `decide()` is never reached through
 * its real terms, so the whole file would assert the dev-token arm instead of
 * the deployed one.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import { controlDbPort } from '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import { databaseRequiredUnderCi } from '../reachability.ts'

const CONTROL_DB =
  process.env['RECONCILE_ONBOARDING_SERVED_CONTROL_DB'] ?? runScopedName('reconcile_onb_served_control')
const TENANT_DB = process.env['RECONCILE_ONBOARDING_SERVED_TENANT_DB'] ?? runScopedName('reconcile_onb_served_tenant')

process.env['RECONCILE_CONTROL_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_CONTROL_READ_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_CONTROL_WRITE_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_DB_NAME'] = TENANT_DB
if ((process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? '') === '') {
  process.env['RECONCILE_CONTROL_DB_ADMIN'] = process.env['USER'] ?? 'postgres'
}

delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const CONSOLE_HOST = 'console.reconcile.invalid'
const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'
process.env['RECONCILE_SERVING_HOSTS'] = `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active`
process.env['RECONCILE_CONSOLE_HOSTS'] = `${CONSOLE_HOST}|staff|active`

const { probeDatabase, describeTarget } = await import('../../db/env.ts')
const { loadPg } = await import('../../db/pg.ts')

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/http/onboarding-console-served.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS FILE IS THE ONLY PLACE A CONSOLE **WRITE** IS DRIVEN OVER A REAL',
      '   SOCKET AGAINST TWO REAL DATABASES. A run in which it skipped is NOT',
      '   evidence that the onboarding panel can advance a step, nor that the',
      '   act leaves an invariant 10 record behind it.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the served onboarding console', probe)

import { loadTier } from '../../server/contract/document.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { buildPlane, type Handler } from '../../server/http/app.ts'
import { CAPABILITIES } from '../../model/access.ts'
import { ONBOARDING_STEPS } from '../../model/onboarding.ts'
import { provisionControlPlane, seedTenancyRoster } from '../../server/control-plane/provision.ts'
import { sessionCookie } from './harness.ts'
import { startInternalPair, type InternalPair } from './internal-pair.ts'
import { runScopedName } from '../run-scoped-db.ts'

const FDE = 'usr_fde_priya'
const DOOR_PLATFORM = 'idc_1ch_entra'
const BROKER_ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_TESTPOOL'
const PLATFORM_ROLE = 'prl_fleet_reader'
const CONSOLE_HANDLE = 'sh_con_4a1d9e02c7b6f35814de2a7b0c9f6d38'

const MEI = 'usr_ops_mei'
const DOOR_CUSTOMER = 'idc_acme_entra'
const TENANT_HANDLE = 'sh_mei_31c7a2e08b4d6f19a5e0c3b7d2f4a681'
const ACME = 'ten_acme'
const TENANT_ROLE = 'rol_ap_approver'

/**
 * The seeded roster tenant this file advances.
 *
 * ⚠️ `ten_cardinal` AND NOT `ten_acme`, DELIBERATELY. `seedTenancyRoster()`
 * leaves `ten_acme` at six of six — every step done — so a completion against
 * it can only ever answer `step_already_done`, and a suite that used it would
 * assert the refusal arm while believing it asserted the happy one.
 * `ten_cardinal` is seeded at TWO, so `sources_bound` (index 2) is `next`.
 */
const SUBJECT = 'ten_cardinal'
const SUBJECT_NEXT = 'sources_bound'
const SUBJECT_BLOCKED = 'first_run'

interface Response {
  readonly status: number
  readonly body: Record<string, unknown> | undefined
  readonly text: string
}

/**
 * `node:http` AND NEVER `fetch`, for `tests/http/context-resolve.test.ts`'s
 * reason: `Host` is a forbidden header name in the Fetch standard and undici
 * silently drops it, so every request would arrive on the wrong host and this
 * file would assert nothing about a console.
 */
function send(
  base: string,
  path: string,
  opts: { host: string; session?: string; method?: string; body?: unknown },
): Promise<Response> {
  const url = new URL(path, base)
  const payload = opts.body === undefined ? undefined : JSON.stringify(opts.body)
  /**
   * ⚠️ `sessionCookie()` RETURNS A HEADER **RECORD** AND NOT A STRING, and it
   * is spread rather than assigned. Assigning it produced `cookie:
   * "[object Object]"` and every request in this file answered 401
   * `session_invalid` — a whole suite asserting the unauthenticated arm while
   * believing it asserted the authorised one, which is §5.6 in a fixture.
   */
  const headers: Record<string, string> = {
    Host: opts.host,
    accept: 'application/json',
    ...(opts.session === undefined ? {} : sessionCookie(opts.session)),
  }
  if (payload !== undefined) {
    headers['content-type'] = 'application/json'
    headers['content-length'] = String(Buffer.byteLength(payload))
  }
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: opts.method ?? 'GET',
        headers,
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (c: string) => {
          text += c
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

/**
 * 🛑 THE CONTROL DATABASE IS REBUILT AND NOT REUSED, AND THE REASON IS THAT
 * THIS SUITE IS THE FIRST IN THE TREE THAT MUTATES ITS OWN FIXTURE.
 *
 * §5 completes a step and forces a gate. **Neither is undoable by anybody**:
 * `0040`'s advance-only trigger refuses a decrement from every role including
 * the admin, and `0030`'s append-only trigger refuses `UPDATE`, `DELETE` and
 * `TRUNCATE` on a forced mark from every role including the admin. So a second
 * run against a reused database finds `ten_cardinal` already advanced, §5a
 * answers `step_already_done`, and **the suite passes exactly once and is red
 * for ever after** — which is `tests/db/onboarding-record.test.ts`'s finding,
 * arriving over HTTP.
 *
 * ⚠️ IT IS THE CONTROL DATABASE ONLY. The TENANT database is reset by
 * `resetSchema()` as every other served suite does, and nothing this file
 * writes there is irreversible.
 */
async function rebuildControlDatabase(): Promise<void> {
  const { Client } = await loadPg()
  const admin = new Client({
    host: '127.0.0.1',
    port: controlDbPort(),
    database: 'postgres',
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
    application_name: 'reconcile-onboarding-served-setup',
  })
  await admin.connect()
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [CONTROL_DB],
    )
    await admin.query(`DROP DATABASE IF EXISTS ${CONTROL_DB}`)
    await admin.query(`CREATE DATABASE ${CONTROL_DB}`)
  } finally {
    await admin.end()
  }
}

async function createDatabaseIfAbsent(name: string): Promise<void> {
  const { Client } = await loadPg()
  const admin = new Client({
    host: '127.0.0.1',
    port: controlDbPort(),
    database: 'postgres',
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
    application_name: 'reconcile-onboarding-served-setup',
  })
  await admin.connect()
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE ${name}`)
  } finally {
    await admin.end()
  }
}

/**
 * The identity substrate, in the TENANT database.
 *
 * 🛑 THE FDE HOLDS NO MEMBERSHIP AND NO TENANT ROLE ANYWHERE. Invariant 8:
 * *"Being staff is not access."* The only authority here is a
 * `platform_role_assignment` carrying `view_substrate`, and it is what
 * `decide()`'s fourth arm reads — so §3's refusal of the CUSTOMER principal is
 * a statement about the arm rather than about a missing row.
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
    await mig.query(
      `INSERT INTO tenant.platform_role_assignment
         (id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
       VALUES ('pra_priya_fleet', $1, $2, 1, 'bootstrap', now(), now() + interval '8 hours', NULL)
       ON CONFLICT DO NOTHING`,
      [FDE, PLATFORM_ROLE],
    )
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

/** `OnboardingStep`'s `required` list, derived from the document this suite is about. */
function onboardingStepSchema(): {
  required: readonly string[]
  properties: Record<string, unknown>
} {
  const doc = loadTier('administration') as unknown as {
    components: {
      schemas: Record<string, { required?: string[]; properties?: Record<string, unknown> }>
    }
  }
  const schema = doc.components.schemas['OnboardingStep']
  assert.ok(schema !== undefined, '`OnboardingStep` is not in the administration document')
  return { required: schema.required ?? [], properties: schema.properties ?? {} }
}

const panel = (t: string): string => `/v1/staff/tenants/${t}/onboarding`
const completion = (t: string, s: string): string => `${panel(t)}/${s}/completion`
const override = (t: string, s: string): string => `${panel(t)}/${s}/override`

describe('the staff console’s onboarding panel, served', { skip }, () => {
  let plane: { url: string; close: () => Promise<void> }
  let pair: InternalPair | undefined

  before(async () => {
    await rebuildControlDatabase()
    await provisionControlPlane()
    await seedTenancyRoster()

    await createDatabaseIfAbsent(TENANT_DB)
    await resetSchema()
    await seedTwoTenants(ACME, 'ten_globex')
    await seedTenantSubstrate()

    /** 🛑 NO `authorise` AND NO `substrate` ARGUMENT — the PRODUCTION seams.
     *  ⚠️ G4316 — the writes go to a REAL control plane over the signed internal
     *  edge (the local internal token, passed as an argument), which advances
     *  this database as `reconcile_control_app`. The data plane no longer holds
     *  a writing control-database credential. */
    pair = await startInternalPair()
    plane = await startDataPlane({ poolMax: 4, controlPlane: pair.client })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
    if (pair !== undefined) await pair.close()
  })

  /* ================================================================ *
   * §1 · THE READ.
   * ================================================================ */

  it('1a · a platform principal reads the six steps, in sequence order', async () => {
    const res = await send(plane.url, panel(SUBJECT), {
      host: CONSOLE_HOST,
      session: CONSOLE_HANDLE,
    })
    assert.equal(
      res.status,
      200,
      'THE FIRST ONBOARDING READ EITHER PLANE HAS SERVED DID NOT ANSWER 200. Four things ' +
        'have to hold: the administration tier is mounted (`server/data-plane/start.ts`), the ' +
        'session resolves a tenant-less PLATFORM subject (G726), `decide()`’s fourth arm ' +
        'allows `view_substrate` because `PLATFORM_ASSIGNMENT_REACHES.substrate` is `true` ' +
        '(G601), and R8 gave the operation a capability to be allowed ON. ' +
        `Body: ${res.text}`,
    )
    const steps = (res.body as { steps?: { stepKey?: string }[] } | undefined)?.steps
    assert.ok(Array.isArray(steps), `no \`steps\` array in the response: ${res.text}`)
    assert.deepEqual(
      steps.map((s) => s.stepKey),
      [...ONBOARDING_STEPS],
      'the served sequence is not `ONBOARDING_STEPS` in order. **THE ORDER IS THE RULE** — ' +
        '`model/onboarding.ts`: "each step is blocked by the one above it, and the blocking ' +
        'is the point" — so a response that reordered them would render a panel whose ' +
        'blocking meant nothing.',
    )
  })

  it('1b · exactly one step is `next`, and it is the one the fixture is waiting on', async () => {
    const res = await send(plane.url, panel(SUBJECT), {
      host: CONSOLE_HOST,
      session: CONSOLE_HANDLE,
    })
    const steps = (res.body as { steps: { stepKey: string; state: string }[] }).steps
    const next = steps.filter((s) => s.state === 'next')
    assert.equal(
      next.length,
      1,
      '**EXACTLY ONE STEP IS `next`** — `S1`: "the first step that is not done is the only ' +
        `one that can be done." Found ${next.length}: ${JSON.stringify(next)}`,
    )
    assert.equal(next[0]?.stepKey, SUBJECT_NEXT)
  })

  /* ================================================================ *
   * §2 · THE BYTES, AGAINST THE CONTRACT'S OWN `required` LIST.
   * ================================================================ */

  it('2 · every `required` property of `OnboardingStep` is present on every served row', async () => {
    /**
     * 🛑 DERIVED FROM THE DOCUMENT AND NOT TYPED OUT, for
     * `console-roster-served.test.ts` §2's reason: **a 200 is not evidence that
     * a response is complete — it is evidence that it did not throw.** G1244
     * measured both directions at the pinned `fast-json-stringify`: a missing
     * `required` property THROWS (so the failure is a 500 on every request),
     * and a property not in `properties` is DROPPED silently. **A type is a
     * claim about a module; this is a claim about the wire.**
     */
    const { required } = onboardingStepSchema()
    assert.ok(required.length >= 4, `\`OnboardingStep\` declares no required properties`)

    const res = await send(plane.url, panel(SUBJECT), {
      host: CONSOLE_HOST,
      session: CONSOLE_HANDLE,
    })
    const steps = (res.body as { steps: Record<string, unknown>[] }).steps
    assert.ok(steps.length > 0, 'the panel served no rows, so this assertion is vacuous')

    for (const row of steps) {
      for (const name of required) {
        assert.ok(
          name in row && row[name] !== null && row[name] !== undefined,
          `a served \`OnboardingStep\` is missing the required property \`${name}\`. ` +
            `Row: ${JSON.stringify(row)}`,
        )
      }
    }
  })

  it('2a · the wire spells the forced state `done_forced`, which is the MODEL’s spelling', async () => {
    /**
     * 🛑 THE CONTRACT'S `description` SAID `done-and-forced` UNTIL 21 Sep 2026
     * AND NOTHING EVER EMITTED A HYPHEN. `model/onboarding.ts` has carried
     * `doneForced: 'done_forced'` since G535 and asked, at that declaration,
     * for the pair to be pinned by the commit that mounts this operation.
     * **This is the served half of that pin**;
     * `tools/check-wire-mirror.mjs`'s `step_states` pair is the static half,
     * and it was witnessed RED against the hyphenated form before it was
     * registered.
     */
    const forced = await send(plane.url, panel('ten_borealis'), {
      host: CONSOLE_HOST,
      session: CONSOLE_HANDLE,
    })
    const steps = (forced.body as { steps: { state: string }[] }).steps
    const states = [...new Set(steps.map((s) => s.state))]
    assert.ok(
      states.includes('done_forced'),
      'the seeded forced tenant published no `done_forced` step, so the spelling this ' +
        `assertion is about was never exercised. States: ${JSON.stringify(states)}`,
    )
    assert.ok(
      !states.includes('done-and-forced'),
      'the wire published the HYPHENATED spelling, which no constant in `model/` declares',
    )
  })

  /* ================================================================ *
   * §3 · THE GATE, WHICH R8 IS THE WHOLE REASON EXISTS HERE.
   * ================================================================ */

  it('3a · a CUSTOMER principal on a tenant host is refused `capability_not_held`', async () => {
    /**
     * 🛑 **THIS IS THE ASSERTION R8 BOUGHT.** Until 21 Sep 2026 all three
     * operations carried `x-capability: 'exempt: …'`, and
     * `tests/http/administration-tier-unmounted.test.ts` §3b measures what that
     * means with a bare mount: **200, with the body, to a caller the authoriser
     * refuses every capability.** The `preValidation` gate returns at its FIRST
     * LINE when a route names no capability.
     */
    const res = await send(plane.url, panel(SUBJECT), {
      host: ACME_HOST,
      session: TENANT_HANDLE,
    })
    assert.equal(
      res.status,
      403,
      'A CUSTOMER OPERATOR READ THE STAFF CONSOLE’S ONBOARDING PANEL. `view_substrate` is ' +
        'of class `substrate`, which `PLATFORM_ONLY_RESOURCE_CLASSES` names, so `decide()` ' +
        'refuses it on the customer arm at its FIRST LINE. A 200 here means the gate was ' +
        `never asked. Body: ${res.text}`,
    )
    assert.equal((res.body as { code?: string } | undefined)?.code, 'capability_not_held')
  })

  it('3b · and so is the WRITE, which is the one that would leave a mark', async () => {
    const res = await send(plane.url, override(SUBJECT, SUBJECT_BLOCKED), {
      host: ACME_HOST,
      session: TENANT_HANDLE,
      method: 'POST',
      body: { reason: 'a customer operator should never reach this' },
    })
    assert.equal(
      res.status,
      403,
      'A CUSTOMER OPERATOR FORCED A GATE ON 1CLOUDHUB’S OWN DELIVERY RECORD. The row it ' +
        'would write can never be amended or removed by anybody — `0030`’s append-only ' +
        `trigger — so this refusal is the only thing between them and it. Body: ${res.text}`,
    )
  })

  it('3c · an unauthenticated caller is refused before validation', async () => {
    const res = await send(plane.url, panel(SUBJECT), { host: CONSOLE_HOST })
    assert.equal(res.status, 401, `expected 401, got ${res.status}: ${res.text}`)
  })

  /* ================================================================ *
   * §4 · THE SIXTH FENCE, ON A BARE HANDLER, FOR EACH OF THE THREE.
   * ================================================================ */

  it('4 · a BARE handler for any of the three refuses to BOOT', async () => {
    /**
     * 🛑 IT IS THE FENCE THAT MAKES R8 WORTH TAKING, AND IT IS ASSERTED HERE
     * RATHER THAN TRUSTED BECAUSE THE MOUNT ABOVE IS THE FIRST THING ON THIS
     * TIER THAT SATISFIES IT. G301: *"an operation may not mount until it mints
     * a record."*
     *
     * ⚠️ **THE SIXTH FENCE AND NOT THE FOURTH, AND THE DIFFERENCE IS THE
     * RULING.** Before R8 these three were `exempt:` and person-facing, so a
     * bare mount hit the FOURTH fence and could be talked past with one
     * `servedWithoutAGate()` call. Gated, they hit the SIXTH, which no mark
     * removes — the only way past it is to mint an invariant 10 record.
     * **Captured RED before the mount existed**, for all three operationIds:
     *
     *     administration: 1 handler(s) serve a GATED operation and mint no
     *     authorisation record — listOnboardingSteps. …
     *
     * ⚠️ NO DATABASE. `buildPlane()` registers routes and runs every fence; a
     * boot failure is a `throw` before a port is bound.
     */
    for (const operationId of [
      'listOnboardingSteps',
      'completeOnboardingStep',
      'forceOnboardingStep',
    ]) {
      const bare: Handler = async () => ({ steps: [] })
      await assert.rejects(
        async () => {
          const app = await buildPlane<{ tenantId: string | null }>(
            {
              plane: 'test-onboarding-plane',
              authenticate: () => ({ tenantId: null }),
              unauthenticatedDetail: 'no session',
              authorise: () => 'held',
              unauthorisedDetail: 'no capability',
            },
            [{ tier: 'administration', handlers: { [operationId]: bare } }],
          )
          await app.close()
        },
        (err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          assert.ok(
            message.includes(operationId) && message.includes('authorisation record'),
            `the plane refused to boot for a reason other than the SIXTH FENCE, on ` +
              `\`${operationId}\`. If the message names the FOURTH fence instead, this ` +
              'operation has lost its capability and is `exempt:` again — which is R8 ' +
              `reversed, not a test to update. Message: ${message}`,
          )
          return true
        },
      )
    }
  })

  /* ================================================================ *
   * §5 · THE WRITES, AND THE RECORD EACH ONE LEAVES.
   * ================================================================ */

  it('5a · completing the NEXT step answers 200 with that one step', async () => {
    const res = await send(plane.url, completion(SUBJECT, SUBJECT_NEXT), {
      host: CONSOLE_HOST,
      session: CONSOLE_HANDLE,
      method: 'POST',
    })
    assert.equal(
      res.status,
      200,
      'THE FIRST CONSOLE WRITE EITHER PLANE HAS SERVED DID NOT ANSWER 200. Beyond the four ' +
        'things §1a names, this one also needs a PRIVILEGE: R9’s ' +
        '`db/migrations-control/0040_onboarding_writer.sql` grants ' +
        '`UPDATE (completed_steps)` to a role `0030` had withheld every write from. A 500 ' +
        `here with \`upstream_unavailable\` is that grant missing. Body: ${res.text}`,
    )
    const body = res.body as { stepKey?: string; state?: string } | undefined
    assert.equal(
      body?.stepKey,
      SUBJECT_NEXT,
      '`completeOnboardingStep` declares `schema: { $ref: OnboardingStep }` — ONE step and ' +
        `not a list, which is where it differs from the other two. Body: ${res.text}`,
    )
    assert.equal(body?.state, 'done')
  })

  it('5b · completing it again is a 409 `step_not_current`', async () => {
    const res = await send(plane.url, completion(SUBJECT, SUBJECT_NEXT), {
      host: CONSOLE_HOST,
      session: CONSOLE_HANDLE,
      method: 'POST',
    })
    assert.equal(
      res.status,
      409,
      '**COMPLETING A STEP TWICE IS NOT IDEMPOTENT — IT IS A LIE** ' +
        `(model/onboarding.ts). Body: ${res.text}`,
    )
    assert.equal(
      (res.body as { code?: string } | undefined)?.code,
      'step_not_current',
      'the 409 did not carry the code the contract declares for it. ⚠️ The model ' +
        'distinguishes `step_already_done` from `step_not_current` and the wire cannot: ' +
        '`errors.yaml`’s enum is CLOSED and has no second member. That collapse is named ' +
        'in `server/http/problem.ts` and is a ruling to change, not a bug to fix here.',
    )
  })

  it('5c · an unrecognised step key is a 404 and never a 409', async () => {
    /**
     * 🛑 THE DISTINCTION IS REAL. `StepKey` is `{ type: string }` with no
     * `enum` — the closed set lives in `model/onboarding.ts` and a copy in YAML
     * would be the third home `0030` refuses — so ajv admits anything. Handed
     * to `completeStep()` an unknown key becomes `indexOf` → `-1`, which is
     * `stepNotCurrent`: **a 409 telling the caller their step is out of ORDER,
     * about a step that does not exist.**
     */
    const res = await send(plane.url, completion(SUBJECT, 'banana'), {
      host: CONSOLE_HOST,
      session: CONSOLE_HANDLE,
      method: 'POST',
    })
    assert.equal(res.status, 404, `expected 404 for an unknown step, got ${res.status}: ${res.text}`)
  })

  it('5d · forcing a BLOCKED gate answers 200 with the whole panel and a permanent reason', async () => {
    const reason = 'Customer signed the pack list off by email; their engineer is on leave.'
    const res = await send(plane.url, override(SUBJECT, SUBJECT_BLOCKED), {
      host: CONSOLE_HOST,
      session: CONSOLE_HANDLE,
      method: 'POST',
      body: { reason },
    })
    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.text}`)
    const steps = (res.body as { steps?: { stepKey: string; state: string; forcedReason?: string }[] })
      ?.steps
    assert.ok(Array.isArray(steps), `no \`steps\` array: ${res.text}`)
    const forced = steps.find((s) => s.stepKey === SUBJECT_BLOCKED)
    assert.equal(
      forced?.state,
      'done_forced',
      '`forceOnboardingStep` declares `{ steps }` and not one step, because forcing marks ' +
        '**that step and everything above it** — a console redrawing after a force needs the ' +
        `whole panel. Body: ${res.text}`,
    )
    assert.equal(
      forced?.forcedReason,
      reason,
      'the reason did not survive the round trip verbatim. It is *"PERMANENT, AND THE ONLY ' +
        'RECORD OF WHY THE SEQUENCE WAS BROKEN"*, and nothing may rewrite it.',
    )
    assert.ok(
      steps.every((s) => s.state === 'done' || s.state === 'done_forced'),
      'forcing the LAST step left something not done. `forceStep()` marks that step and ' +
        `everything above it. Steps: ${JSON.stringify(steps)}`,
    )
  })

  it('5e · a reason that is only whitespace is refused 422, past ajv’s `minLength`', async () => {
    /**
     * ⚠️ REACHABLE DESPITE `minLength: 7` ON THE WIRE, WHICH IS WHY IT IS
     * ASSERTED. ajv counts CHARACTERS and `forceStep()` counts them AFTER
     * `trim()`, so nine spaces and a letter pass the schema and fail the model.
     * **The model is the stricter of the two and is the one that decides.**
     */
    const res = await send(plane.url, override('ten_borealis', 'first_run'), {
      host: CONSOLE_HOST,
      session: CONSOLE_HANDLE,
      method: 'POST',
      body: { reason: '         x' },
    })
    assert.equal(
      res.status,
      422,
      'a reason that trims to one character was accepted. The floor exists *"to reject the ' +
        'thing a person types when they have not made the decision the field is asking ' +
        `for"*. Body: ${res.text}`,
    )
  })

  it('5f · a tenant that is not on the roster is a 404 and not a 500', async () => {
    const res = await send(plane.url, panel('ten_nowhere_at_all'), {
      host: CONSOLE_HOST,
      session: CONSOLE_HANDLE,
    })
    assert.equal(
      res.status,
      404,
      'a tenant this platform does not have answered something other than 404. The other ' +
        'three refusals in `onboarding-store.ts` are 500s about a row this plane did not ' +
        `write; this one is a fact about the REQUEST. Body: ${res.text}`,
    )
  })

  /* ================================================================ *
   * §6 · INVARIANT 10, IN THE OTHER DATABASE.
   * ================================================================ */

  it('6b · G4317 — the forced mark names the platform authorisation the act ran under', async () => {
    const { Client } = await loadPg()
    const control = new Client({
      host: '127.0.0.1',
      port: controlDbPort(),
      database: CONTROL_DB,
      user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
    })
    await control.connect()
    let marked: string
    try {
      const r = await control.query(
        'SELECT authorisation_id FROM onboarding_forced_step WHERE tenant_id = $1 AND step = $2',
        [SUBJECT, SUBJECT_BLOCKED],
      )
      marked = String((r.rows[0] as { authorisation_id: unknown } | undefined)?.authorisation_id)
      const receipt = await control.query(
        'SELECT authorisation_id FROM internal_request_receipt WHERE authorisation_id = $1',
        [marked],
      )
      assert.equal(receipt.rows.length, 1, 'the forced mark and its receipt name different acts')
    } finally {
      await control.end()
    }
    assert.match(marked, /^azg_[0-9a-f]{32}$/, `the forced mark carries no authorisation id: ${marked}`)
    const mig = await migratorClient()
    try {
      const r = await mig.query('SELECT 1 FROM tenant.platform_authorization_grant WHERE id = $1', [marked])
      assert.equal(r.rows.length, 1, 'the id on the forced mark is not a platform authorisation record the data plane wrote')
    } finally {
      await mig.end()
    }
  })

  it('6 · every served act left a PLATFORM authorisation record, and no tenant one', async () => {
    /**
     * 🛑 THE ACT'S RECORD AND THE ACT'S DATA ARE IN TWO DIFFERENT DATABASES,
     * AND THIS IS THE ASSERTION THAT SAYS SO. The onboarding state is in the
     * CONTROL database; the record is in the DATA one, in invariant 10's SECOND
     * home — `tenant.platform_authorization_grant`, G730 — because a console
     * act has no tenant and `AuthorizationGrant extends TenantScoped`.
     *
     * ⚠️ **AND `tenant.authorization_grant` MUST BE EMPTY OF THESE**, which is
     * the half that would catch a body reaching for `actingTenantOf()`: that
     * function THROWS for a platform grant by construction, and a row in the
     * tenant home would mean one of these acts had a tenant it should not have.
     */
    const mig = await migratorClient()
    try {
      const platform = await mig.query(
        `SELECT count(*)::int AS n FROM tenant.platform_authorization_grant
          WHERE capability = $1`,
        [CAPABILITIES.viewSubstrate],
      )
      const n = (platform.rows[0] as { n: number }).n
      assert.ok(
        n >= 5,
        'the served acts above left fewer authorisation records than acts. G301 makes ' +
          'minting a PRECONDITION OF MOUNTING so the invariant "cannot erode one slice at a ' +
          `time"; a mounted operation that records nothing is what the sixth fence refuses. Found ${n}`,
      )
      const tenantHome = await mig.query(
        `SELECT count(*)::int AS n FROM tenant.authorization_grant WHERE capability = $1`,
        [CAPABILITIES.viewSubstrate],
      )
      assert.equal(
        (tenantHome.rows[0] as { n: number }).n,
        0,
        'a console act wrote into invariant 10’s TENANT home. `PlatformAuthorizationGrant` ' +
          'has no `tenantId` field at all — G730 — so this would mean a tenant was invented ' +
          'for an act that has none.',
      )
    } finally {
      await mig.end()
    }
  })
})

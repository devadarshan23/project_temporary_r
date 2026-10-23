/**
 * CONFERRING A CAPABILITY, OVER A SOCKET, THROUGH THE PRODUCTION GATE —
 * G512, 19 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE ASSERTION THIS FILE EXISTS FOR IS §2, AND IT IS THE FIRST OF ITS KIND
 *    IN THIS REPOSITORY: A SUBJECT WHO COULD NOT REACH AN OPERATION REACHES IT
 *    AFTER A CONFERRAL, AND NOTHING IN BETWEEN WAS SEEDED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every other served suite here proves that a capability a MIGRATOR wrote is
 * honoured. `db/migrations/0009_identity_substrate.sql` grants the app role
 * `SELECT` and nothing else on the authority tables, so until this commit
 * *every* capability in every test — and in the shipping local seed — arrived
 * through `reconcile_migrator`, **a `LOGIN BYPASSRLS` role that exists in no
 * serving process and in no deployed environment.**
 * `tests/e2e/browser-login.test.ts` said so on its own face and named the cost:
 * *"these sections prove that NAVIGATION works … They do NOT prove that any
 * operator can reach C3 in any environment, because none can."*
 *
 * §2 below is that sentence becoming false. The target holds nothing, is
 * refused, is conferred a role THROUGH THE MOUNTED OPERATION by a real
 * administrator over HTTP, and is then served the same request.
 *
 * ⚠️ AND THE BOOTSTRAP IS NOT CLOSED AND IS NOT CLAIMED TO BE. The
 * ADMINISTRATOR's own authority is still migrator-seeded, and it has to be:
 * `canGrant()` refuses to confer a capability the granter does not already
 * hold, so **the first holder in a tenant cannot arrive through this operation
 * by construction.** What moved is the SECOND holder, which is the whole of
 * what an operator surface needs and is a long way from nothing.
 *
 * 🛑 NO `authorise` AND NO `substrate` OPTION IS PASSED TO `startDataPlane()`,
 * and `RECONCILE_LOCAL_TEST_AUTH` is deleted from the process. Both defaults
 * are the production seams — `sessionCapabilities` and `substrateFromSession`.
 * Passing either would make every assertion below decorative.
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
 * ITS OWN DATABASE. `db/env.ts` resolves `RECONCILE_DB_NAME` per call, and
 * `createDatabase()` does a `SELECT 1 FROM pg_database` and then a
 * `CREATE DATABASE` with no lock between them — two suites on one name lose
 * that race and the signature is `fail 0` with a non-zero exit.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_GRANT_SERVED_DB_NAME'] ?? runScopedName('reconcile_grant_served_test')

/**
 * ⚠️ DELETED, WHICH IS AN ASSERTION IN DISGUISE. With
 * `RECONCILE_LOCAL_TEST_AUTH` set, `resolveSessionReader()` adds an arm that
 * authenticates on a signed token and resolves NO SUBJECT — a plane running it
 * could not mint for anybody and could not confer anything.
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
const GLOBEX_DOOR = 'idc_globex_okta'

/** Holds `manage_roles` and `view_exception`. Seeded by the migrator — the bootstrap. */
const ADMIN = 'usr_acme_admin'
/** A live member of ACME holding NOTHING. Everything it ends up with came through the gate. */
const MEI = 'usr_ops_mei'
/** A live member of GLOBEX and of no other tenant. */
const RUTH = 'usr_globex_ruth'

const ROLE_ADMIN = 'rol_admin'
const ROLE_TRIAGE = 'rol_triage'
const ROLE_SUPER = 'rol_super'

const ADMIN_HANDLE = 'sx_admin_2b71e4c09fa8416d83e5c7204ad61f93'
const MEI_HANDLE = 'sx_mei_6e0d92af53c74b18a7f1cb3e05d82746'

const ACME_EXC = 'exc_acme_grant_0001'

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

/* Top level, OUTSIDE every `describe`. `tests/ci/reachability-guards.test.ts`
   asserts this by AST walk. */
databaseRequiredUnderCi('the served capability-granting assertions', probe)

interface Response {
  readonly status: number
  readonly body: Record<string, unknown> | undefined
  readonly text: string
}

function send(
  origin: string,
  method: string,
  path: string,
  opts: { body?: unknown; session?: string; host?: string } = {},
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
          Host: opts.host ?? ACME_HOST,
          ...sessionCookie(opts.session ?? ADMIN_HANDLE),
          ...(payload === undefined
            ? {}
            : {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload),
              }),
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

async function assignmentsFor(userId: string): Promise<number> {
  return asMigrator(async (q) => {
    const r = await q('SELECT count(*)::int AS n FROM tenant.role_assignment WHERE user_id = $1', [
      userId,
    ])
    return (r.rows[0] as { n: number } | undefined)?.n ?? -1
  })
}

async function clearConferrals(): Promise<void> {
  await asMigrator(async (q) => {
    await q("DELETE FROM tenant.role_assignment WHERE id NOT LIKE 'ras_seed_%'")
  })
}

/**
 * ⚠️ EVERY WRITE HERE IS THE MIGRATOR'S, AND THAT IS THE POINT RATHER THAN A
 * SHORTCUT. This function seeds the BOOTSTRAP — the one administrator whose
 * authority no conferral could have produced — plus two people holding nothing.
 * **`tenant.role_assignment` gains exactly ONE row from this function**, and it
 * belongs to the administrator; every other assignment this file observes was
 * written by the serving process, through the gate, over a socket.
 */
async function seedSubstrate(): Promise<void> {
  const adminDigest = digestOfHandle(ADMIN_HANDLE)
  const meiDigest = digestOfHandle(MEI_HANDLE)
  assert.notEqual(adminDigest, null, 'the admin handle digested to nothing')
  assert.notEqual(meiDigest, null, 'the target handle digested to nothing')

  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    /* G305: a handle is present EXACTLY WHEN the protocol is brokered, and
       `PROTOCOL_IS_BROKERED.oidc` is `true` — an `oidc` door with no
       `(broker_issuer, broker_ref)` is `broker_unresolvable`. */
    for (const [id, label, account, ref] of [
      [DOOR, 'Acme Entra ID', 'acc_acme', 'acme-entra-grant'],
      [GLOBEX_DOOR, 'Globex Okta', 'acc_globex', 'globex-okta-grant'],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant.identity_connection
           (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
            broker_issuer, broker_ref, status)
         VALUES ($1, 'oidc', $2, 'customer', NULL, $3,
                 'https://login.microsoftonline.com/grant-served/v2.0', $4, 'active')`,
        [id, label, account, ref],
      )
    }

    for (const [user, name, door] of [
      [ADMIN, 'Acme Administrator', DOOR],
      [MEI, 'Mei Tan', DOOR],
      [RUTH, 'Ruth Iyer', GLOBEX_DOOR],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
         VALUES ($1, $1 || '@invalid', $2, 'active', $3)`,
        [user, name, door],
      )
    }

    await mig.query(
      `INSERT INTO tenant.role
         (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ($1, $2, 'Administrator', 'administrator', 1, 'administrator', 'tenant', NULL, 'active'),
              ($1, $3, 'Triage',        'triage',        1, 'operator',      'pack',   'pck_ap', 'active'),
              ($1, $4, 'Supervisor',    'supervisor',    1, 'operator',      'pack',   'pck_ap', 'active')`,
      [ACME, ROLE_ADMIN, ROLE_TRIAGE, ROLE_SUPER],
    )
    await mig.query(
      `INSERT INTO tenant.role_capability (tenant_id, role_id, capability)
       VALUES ($1, $2, $5), ($1, $2, $6), ($1, $3, $6), ($1, $4, $7)`,
      [
        ACME,
        ROLE_ADMIN,
        ROLE_TRIAGE,
        ROLE_SUPER,
        CAPABILITIES.manageRoles,
        CAPABILITIES.viewException,
        CAPABILITIES.approveResolution,
      ],
    )

    /* 🛑 ONE ASSIGNMENT, AND IT IS THE BOOTSTRAP. Its id is prefixed
       `ras_seed_` so `clearConferrals()` can tell what the migrator wrote from
       what the PLANE wrote — which is the distinction this whole file is
       about, and a `DELETE` that could not draw it would quietly let a seeded
       row stand in for a conferred one. */
    await mig.query(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version,
          granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'ras_seed_admin', $2, $3, 1, 'bootstrap', now(), NULL, NULL)`,
      [ACME, ADMIN, ROLE_ADMIN],
    )

    for (const [tenant, id, user] of [
      [ACME, 'mem_admin', ADMIN],
      [ACME, 'mem_mei', MEI],
      [GLOBEX, 'mem_ruth', RUTH],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant.membership
           (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, 'bootstrap', now(), NULL, NULL)`,
        [tenant, id, user, tenant === ACME ? ROLE_ADMIN : ROLE_ADMIN],
      )
    }

    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_g_admin', $1, $3, $5, $6, $7, now(), now(), now() + interval '12 hours', NULL),
              ('ses_g_mei',   $2, $4, $5, $6, $7, now(), now(), now() + interval '12 hours', NULL)`,
      [adminDigest, meiDigest, ADMIN, MEI, DOOR, ACME, ACME_HOST],
    )

    /* One finding, so "reaches the register" is a read of something. */
    await mig.query(
      `INSERT INTO tenant.exception
         (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
          carried_forward_from, domain, definition_id, rule_label, severity, severity_rank,
          value_at_risk_currency, value_at_risk_minor, value_at_risk_exponent,
          cost_centre, legal_entity, status, assigned_to, raised_at,
          explanation_summary, explanation_expected, explanation_confidence)
       VALUES ($1, $2, 'mg_1', 'rul_1', 1, 1,
               NULL, 'finance', 'def_ap_close', 'Three-way match', 'critical', 0,
               'SGD', 90000, 2,
               'CC-1100', 'LE-SG', 'open', NULL, now(),
               'the invoice disagrees with the purchase order', 'the purchase order', 0.91)`,
      [ACME, ACME_EXC],
    )

    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

const GRANT_PATH = (userId: string) => `/v1/people/${userId}/role-assignments`

/**
 * ⚠️ THE SORT IS A REAL MEMBER OF THE CONTRACT'S ENUM, AND THE FIRST DRAFT'S
 * WAS NOT — WHICH PRODUCED THE MOST USEFUL ACCIDENT IN THIS FILE.
 *
 * With `sort=severity` (not a member) the BEFORE request answered **403** and
 * the AFTER request answered **400**. That is `server/http/app.ts`'s stated
 * order arriving as evidence rather than as a comment — *"Authentication runs
 * in `onRequest`, before validation … A validator that answers before an
 * authenticator is a schema oracle"*, and the gate runs in `preValidation` for
 * the same reason. **The 403 becoming a 400 was already proof that the
 * conferral had crossed the gate**; the fix below is so the assertion measures
 * the register rather than the enum.
 */
const REGISTER_PAGE = '/v1/exceptions?sort=severity_then_value&limit=10'

describe('conferring a capability over HTTP, through the production gate', { skip }, () => {
  let plane: Awaited<ReturnType<typeof startDataPlane>>
  let origin: string

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedSubstrate()
    /* 🛑 NO `authorise`, NO `substrate`. Both default to the production seams. */
    plane = await startDataPlane({ poolMax: 4 })
    origin = plane.url
  })

  after(async () => {
    await plane?.close()
  })

  /* ---------------------------------------------------------------- *
   * §1 · THE ROUTE EXISTS AND IS GATED.
   * ---------------------------------------------------------------- */

  it('§1 · a caller without `manage_roles` is refused, and mints nothing', async () => {
    await clearConferrals()
    const before = await asMigrator(async (q) => {
      const r = await q('SELECT count(*)::int AS n FROM tenant.authorization_grant')
      return (r.rows[0] as { n: number } | undefined)?.n ?? -1
    })

    const res = await send(origin, 'POST', GRANT_PATH(ADMIN), {
      session: MEI_HANDLE,
      body: { roleId: ROLE_TRIAGE, expiresAt: null },
    })
    assert.equal(
      res.status,
      403,
      `a subject holding NOTHING conferred a role. Got ${res.status}: ${res.text.slice(0, 300)}`,
    )

    const after = await asMigrator(async (q) => {
      const r = await q('SELECT count(*)::int AS n FROM tenant.authorization_grant')
      return (r.rows[0] as { n: number } | undefined)?.n ?? -1
    })
    assert.equal(
      after,
      before,
      'the gate refused and a record was minted anyway. `authorisedHandler()` asks ' +
        '`authorize()` FIRST and a refusal returns before any scope is entered — **a denial ' +
        'is not an authorisation, so a denial mints nothing** — and a refused caller leaving ' +
        'an audit row saying they were authorised is worse than no row at all.',
    )
    assert.equal(await assignmentsFor(ADMIN), 1, 'and the admin still holds only its bootstrap')
  })

  /* ---------------------------------------------------------------- *
   * §2 · 🛑 THE PRIZE. A CAPABILITY CROSSES THE GATE AND IS THEN SPENT.
   * ---------------------------------------------------------------- */

  it('§2 · a conferred subject reaches the exception register, with nothing seeded', async () => {
    await clearConferrals()

    /* ── BEFORE. The target holds nothing, so C3 is closed to them. ── */
    const closed = await send(origin, 'GET', REGISTER_PAGE, {
      session: MEI_HANDLE,
    })
    assert.equal(
      closed.status,
      403,
      'the target could already read the register, so the assertion below proves nothing. ' +
        `Got ${closed.status}: ${closed.text.slice(0, 300)}`,
    )
    assert.equal(await assignmentsFor(MEI), 0, 'and they hold no assignment at all')

    /* ── THE CONFERRAL, over HTTP, by a real administrator. ── */
    const conferred = await send(origin, 'POST', GRANT_PATH(MEI), {
      body: { roleId: ROLE_TRIAGE, expiresAt: null },
    })
    assert.equal(
      conferred.status,
      201,
      `the lawful conferral was refused. Got ${conferred.status}: ${conferred.text.slice(0, 500)}`,
    )
    assert.equal(conferred.body?.['userId'], MEI)
    assert.equal(conferred.body?.['roleId'], ROLE_TRIAGE)
    assert.equal(conferred.body?.['roleVersion'], 1, 'the response publishes the pin')
    assert.equal(
      conferred.body?.['grantedBy'],
      ADMIN,
      '`granted_by` is derived from the session and is not a request field; the database ' +
        'compares it against this act’s own invariant 10 record',
    )
    assert.equal(conferred.body?.['expiresAt'], null)

    /* 🛑 THE ROW WAS WRITTEN BY THE SERVING PROCESS, not by the migrator. Its
       id carries no `ras_seed_` prefix, which is the only way this file can
       tell the two apart. */
    const written = await asMigrator(async (q) => {
      const r = await q(
        `SELECT id, granted_by FROM tenant.role_assignment WHERE user_id = $1`,
        [MEI],
      )
      return r.rows as Array<{ id: string; granted_by: string }>
    })
    assert.equal(written.length, 1, 'exactly one assignment was conferred')
    assert.ok(
      !(written[0]?.id ?? '').startsWith('ras_seed_'),
      'the row the target holds was written by the SEED and not by the plane, so this suite ' +
        'is measuring the migrator again',
    )
    assert.equal(written[0]?.granted_by, ADMIN)

    /* ── AFTER. The same request, the same session, the production gate. ── */
    const open = await send(origin, 'GET', REGISTER_PAGE, {
      session: MEI_HANDLE,
    })
    assert.equal(
      open.status,
      200,
      '🛑 THE PRIZE IS NOT COLLECTED: a subject conferred `view_exception` through the ' +
        'mounted operation still cannot reach C3. The chain is `decide()` -> ' +
        '`tenant.role_assignment` -> `tenant.role_capability`, and one link is broken. ' +
        `Got ${open.status}: ${open.text.slice(0, 400)}`,
    )
    const items = open.body?.['items'] as Array<Record<string, unknown>> | undefined
    assert.ok(
      (items ?? []).some((row) => row['exceptionId'] === ACME_EXC),
      `the register was served and the seeded finding is not in it: ${open.text.slice(0, 400)}`,
    )
  })

  /* ---------------------------------------------------------------- *
   * §3 · THE REFUSALS THE MODEL OWNS.
   * ---------------------------------------------------------------- */

  it('§3 · ESCALATION is refused and writes nothing', async () => {
    await clearConferrals()
    const res = await send(origin, 'POST', GRANT_PATH(MEI), {
      body: { roleId: ROLE_SUPER, expiresAt: null },
    })
    assert.equal(
      res.status,
      403,
      'an administrator holding `manage_roles` and NOT `approve_resolution` conferred a role ' +
        `carrying it. Got ${res.status}: ${res.text.slice(0, 300)}`,
    )
    assert.equal(await assignmentsFor(MEI), 0, 'and nothing was written')
  })

  it('§3b · the refusal names no capability, so it is not a roster oracle', async () => {
    await clearConferrals()
    const res = await send(origin, 'POST', GRANT_PATH(MEI), {
      body: { roleId: ROLE_SUPER, expiresAt: null },
    })
    for (const leak of [
      CAPABILITIES.approveResolution,
      CAPABILITIES.manageRoles,
      'granter_lacks_capability',
      ROLE_SUPER,
    ]) {
      assert.ok(
        !res.text.includes(leak),
        `the refusal body names \`${leak}\`. Trying each role in turn would then enumerate ` +
          'exactly which verbs the administrator holds — `UNAUTHORISED_DETAIL`’s ' +
          '"roster oracle" argument, on a surface where the roster IS the subject. Body: ' +
          res.text.slice(0, 300),
      )
    }
  })

  it('§4 · SELF-GRANT is refused', async () => {
    await clearConferrals()
    const res = await send(origin, 'POST', GRANT_PATH(ADMIN), {
      body: { roleId: ROLE_TRIAGE, expiresAt: null },
    })
    assert.equal(
      res.status,
      403,
      `an administrator conferred a role on itself. Got ${res.status}: ${res.text.slice(0, 300)}`,
    )
    assert.equal(await assignmentsFor(ADMIN), 1, 'and it still holds only its bootstrap')
  })

  /* ---------------------------------------------------------------- *
   * §5 · WHAT THE DIRECTORY DOES NOT SHOW IS A 404, NOT A 403.
   * ---------------------------------------------------------------- */

  it('§5 · a person in another tenant, and a person who does not exist, are one answer', async () => {
    await clearConferrals()
    const other = await send(origin, 'POST', GRANT_PATH(RUTH), {
      body: { roleId: ROLE_TRIAGE, expiresAt: null },
    })
    const absent = await send(origin, 'POST', GRANT_PATH('usr_no_such_person'), {
      body: { roleId: ROLE_TRIAGE, expiresAt: null },
    })

    assert.equal(other.status, 404, `a GLOBEX member was visible to an ACME act: ${other.text.slice(0, 300)}`)
    assert.equal(absent.status, 404, `an absent person got a different answer: ${absent.text.slice(0, 300)}`)
    assert.equal(
      other.text,
      absent.text,
      'a person in another tenant and a person who does not exist produced DIFFERENT bodies, ' +
        'so this endpoint is an existence oracle across the tenant boundary. ' +
        '`errors.yaml`’s `NotFound` states the rule: they are returned identically.',
    )
    assert.equal(await assignmentsFor(RUTH), 0, 'and nothing was written for either')
  })

  it('§5b · an unknown role is a 404 and not a 500', async () => {
    await clearConferrals()
    const res = await send(origin, 'POST', GRANT_PATH(MEI), {
      body: { roleId: 'rol_no_such_role', expiresAt: null },
    })
    assert.equal(res.status, 404, `got ${res.status}: ${res.text.slice(0, 300)}`)
    assert.equal(await assignmentsFor(MEI), 0, 'and nothing was written')
  })

  /* ---------------------------------------------------------------- *
   * §6 · THE RECORD, AND THE FIELD THAT IS NOT ON THE WIRE.
   * ---------------------------------------------------------------- */

  it('§6 · the conferral minted invariant 10’s record, naming `manage_roles`', async () => {
    await clearConferrals()
    await asMigrator(async (q) => {
      await q('DELETE FROM tenant.authorization_grant_via')
      await q('DELETE FROM tenant.authorization_grant')
    })

    const res = await send(origin, 'POST', GRANT_PATH(MEI), {
      body: { roleId: ROLE_TRIAGE, expiresAt: null },
    })
    assert.equal(res.status, 201, res.text.slice(0, 300))

    const rows = await asMigrator(async (q) => {
      const r = await q(
        `SELECT capability, subject_user_id, resource_type, resource_id, resource_class
           FROM tenant.authorization_grant`,
      )
      return r.rows as Array<Record<string, unknown>>
    })
    assert.equal(rows.length, 1, 'exactly one record for one act')
    assert.equal(rows[0]?.['capability'], CAPABILITIES.manageRoles)
    assert.equal(rows[0]?.['subject_user_id'], ADMIN, 'the record names the GRANTER')
    assert.equal(rows[0]?.['resource_type'], 'User')
    assert.equal(
      rows[0]?.['resource_id'],
      MEI,
      'the act is bound to the person RECEIVING authority — the instance an auditor asks ' +
        'about is "who was given this"',
    )
    assert.equal(rows[0]?.['resource_class'], 'authority')
  })

  it('§6b · `grantedBy` cannot be supplied, because the schema refuses the key', async () => {
    await clearConferrals()
    const res = await send(origin, 'POST', GRANT_PATH(MEI), {
      body: { roleId: ROLE_TRIAGE, expiresAt: null, grantedBy: MEI },
    })
    assert.equal(
      res.status,
      400,
      'the request body admitted a `grantedBy` key. `additionalProperties: false` plus ' +
        '`removeAdditional: false` is what makes the attempt VISIBLE in a status code rather ' +
        `than silently deleted and served. Got ${res.status}: ${res.text.slice(0, 300)}`,
    )
    assert.equal(await assignmentsFor(MEI), 0, 'and nothing was written')
  })

  it('§6c · `expiresAt` is REQUIRED, so an indefinite grant is typed rather than omitted', async () => {
    await clearConferrals()
    const res = await send(origin, 'POST', GRANT_PATH(MEI), {
      body: { roleId: ROLE_TRIAGE },
    })
    assert.equal(
      res.status,
      400,
      'omitting `expiresAt` was accepted, so an indefinite assignment can be created by ' +
        `forgetting a field. Got ${res.status}: ${res.text.slice(0, 300)}`,
    )
  })
})

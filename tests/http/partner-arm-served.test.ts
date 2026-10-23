/**
 * THE PARTNER ARM, OVER A SOCKET, AGAINST THE PRODUCTION AUTHORISER — G576,
 * 19 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS FILE IS FOR, AND WHY IT IS NOT A COPY OF
 *    `tests/http/identity-substrate-served.test.ts`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * That file proved the CUSTOMER arm: a subject, a role, an assignment, and one
 * term removed at a time. It could not prove the partner arm, and said so —
 * its §4 asserts only that a partner is REFUSED, because `partnerGrant` had no
 * producer and `partner_grant_absent` was the only answer available. **Every
 * partner assertion in this repository, in every suite, was a refusal.** That
 * is `docs/HANDOFF.md` §5.6 with the most dangerous principal in the model as
 * its subject: a mask that has never been observed ADMITTING anything is
 * indistinguishable from a mask that admits nothing because the arm is broken.
 *
 * `db/migrations/0039_partner_access_grant.sql` gives the term a producer, and
 * this file is the differential that makes the refusals mean something.
 *
 * ┌─ THE MATRIX. ONE PERSON, ONE ROLE CARRYING THREE VERBS, FOUR GRANTS ───────┐
 * │                                                                            │
 * │                        /v1/runs      /v1/exceptions/    /v1/threads        │
 * │                        admit_source  facets             view_document      │
 * │                                      view_exception                        │
 * │   customer (no grant)      200            200               200            │
 * │   no grant                 403            403               403            │
 * │   commercial_only          403            403               403            │
 * │   exceptions_read          403          **200**             403            │
 * │   exceptions_operate       403          **200**           **200**          │
 * │                                                                            │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THE `/v1/runs` COLUMN IS GATED `view_run` SINCE 4 Oct 2026 (G3881), NOT
 * `admit_source`, AND ITS ANSWERS ARE UNCHANGED: G3801 moved it to
 * `view_exception` (partners 200), and the owner's G3802 ruling — *"partners
 * still see exceptions, not run residue"* — moved it to `view_run`, carried by
 * `view_exception` and in no partner scope, so the column reads as drawn. §7
 * covers all five run reads.
 *
 * 🛑 READ THE FIRST ROW AND THE FIRST COLUMN BEFORE ANYTHING ELSE.
 *
 * **The first ROW is what stops every 403 below being vacuous.** The same
 * person, the same role, the same three verbs, the same tenant — reached
 * through a CUSTOMER door — is served all three. So a 403 on the partner rows
 * is the MASK, and cannot be a broken fixture, an unmounted route or a missing
 * capability row.
 *
 * **The first COLUMN is invariant 5 and G173.** `admit_source` is `[]` in
 * `PARTNER_MASK_MEMBERSHIP` — *"the residue is source material at LINE
 * grain"* — and the role carries it. A partner under the STRONGEST scope, with
 * the verb in their own role, is refused. That is the mask INTERSECTING rather
 * than adding, witnessed rather than asserted.
 *
 * ⚠️ WHAT THIS FILE CANNOT SHOW, STATED SO THE COVERAGE IS NOT OVERCLAIMED.
 * `decide()`'s reasons do not reach the wire — every refusal below is
 * `capability_not_held` with a constant `detail`, because
 * `server/data-plane/authorise.ts` refuses to make the gate *"a roster oracle
 * for anybody who can authenticate"*. So this file proves WHICH requests are
 * refused; `tests/db/partner-access-grant.test.ts` proves the reader hands
 * `decide()` the terms it needs to refuse them SEPARATELY, and
 * `tests/model/access-decide.test.ts` proves the names. None of the three is
 * the whole control.
 *
 * ⚠️ AND `view_metering` IS NOT IN THIS MATRIX BECAUSE NO OPERATION DECLARES
 * IT. Invariant 5's *"a raw usage record is volume in the clear"* is asserted
 * at the mask instead — `tests/model/partner-mask-classes.test.ts`, which is a
 * derivation over `CAPABILITY_RESOURCE_CLASS` rather than a list of two verbs
 * somebody has to remember to extend.
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
import { CAPABILITIES, PARTNER_ACCESS_SCOPES } from '../../model/access.ts'
import type { PartnerAccessScopeKey } from '../../model/access.ts'
import { sessionCookie } from './harness.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_PARTNER_ARM_DB_NAME'] ?? runScopedName('reconcile_partner_arm_test')

/**
 * 🛑 DELETED, AND THE DELETION IS AN ASSERTION. With the flag set,
 * `resolveSessionReader()` adds an arm that authenticates on a signed token and
 * resolves NO SUBJECT — so every 403 below would also be produced by a plane
 * that had no substrate at all, and the two 200s would be impossible. Same
 * move, same reason, as `tests/http/identity-substrate-served.test.ts`.
 */
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'
const GLOBEX_HOST = 'globex.ap-southeast-1.reconcile.invalid'

process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active,` +
  `${GLOBEX_HOST}|ten_globex|ap-southeast-1|pooled|active`

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const NORTHWIND = 'prt_northwind'
const CONTOSO = 'prt_contoso'

const PAT = 'usr_partner_pat'
const DOOR_PARTNER = 'idc_partner_northwind'
const DOOR_CUSTOMER = 'idc_acme_entra'
const BROKER_ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_TESTPOOL'
const ROLE = 'rol_support'
const ASSIGNMENT = 'ras_pat_support'
const GRANT = 'pag_acme_northwind'

const HANDLE = 'sh_pat_4b71e0c2a95d4f6187ce23a0b5d6e7f8'

const probe = await probeDatabase()
const skip = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the served partner-arm test', probe)

/* ------------------------------------------------------------------ *
 * `node:http` rather than `fetch`, for `tests/http/context-resolve.test.ts`'s
 * reason: undici derives `Host` from the URL on some paths, and G180 compares
 * it against `Session.issuedHost` on EVERY request.
 * ------------------------------------------------------------------ */

interface Response {
  readonly status: number
  readonly body: Record<string, unknown> | undefined
  readonly text: string
}

function get(origin: string, path: string, host: string): Promise<Response> {
  const url = new URL(origin)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method: 'GET',
        headers: { Host: host, ...sessionCookie(HANDLE) },
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

async function asMigrator(sql: string, params: readonly unknown[] = []): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query(sql, params as unknown[])
  } finally {
    await mig.end()
  }
}

/**
 * ONE PERSON, TWO DOORS, ONE ROLE CARRYING THREE VERBS.
 *
 * 🛑 `expires_at` ON THE ASSIGNMENT IS **NOT NULL** AND THAT IS LOAD-BEARING.
 * `DURABLE_ASSIGNMENT_PERMITTED` is `{platform: false, partner: false,
 * customer: true}`, so a partner holding an assignment that never expires is
 * refused at `durable_assignment_forbidden_for_org` — *"authority that outlives
 * the grant it was derived from"*. A fixture that copied
 * `identity-substrate-served.test.ts`'s `expires_at: NULL` would make every
 * partner row below 403 and every one of those 403s would be measuring the
 * wrong control. §6 asserts that arm separately so the fixture cannot drift
 * back.
 *
 * ⚠️ ACME IS SOLD BY NORTHWIND AND GLOBEX BY NOBODY. 0039's composite foreign
 * key refuses a grant into a tenant with no partner, so the fixture has to say
 * who sold what before it can say who was granted what — which is invariant
 * 2's conjunction shaping the test data rather than being checked by it.
 */
async function seed(): Promise<void> {
  const digest = digestOfHandle(HANDLE)
  assert.notEqual(digest, null, 'the fixture handle digested to nothing')

  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    await mig.query(`UPDATE tenant.tenant SET partner_id = $2 WHERE id = $1`, [ACME, NORTHWIND])
    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES
         ($1, 'oidc', 'Northwind',     'partner',  $3,   NULL,       $4, 'northwind',  'active'),
         ($2, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme', $4, 'acme-entra', 'active')
       ON CONFLICT DO NOTHING`,
      [DOOR_PARTNER, DOOR_CUSTOMER, NORTHWIND, BROKER_ISSUER],
    )
    await mig.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES ($1, 'pat@northwind.invalid', 'Pat Okafor', 'active', $2)
       ON CONFLICT DO NOTHING`,
      [PAT, DOOR_PARTNER],
    )
    await mig.query(
      `INSERT INTO tenant.role
         (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ($1, $2, 'Support', 'support', 1, 'operator', 'pack', 'pck_ap', 'active')
       ON CONFLICT DO NOTHING`,
      [ACME, ROLE],
    )
    /* THREE VERBS, ONE IN EACH PARTNER POSTURE — in both scopes, in the
     * stronger one only, and in none. The differential needs all three on ONE
     * role, or a 403 could be a missing capability row. */
    for (const verb of [
      CAPABILITIES.viewException,
      CAPABILITIES.viewDocument,
      CAPABILITIES.admitSource,
    ]) {
      await mig.query(
        `INSERT INTO tenant.role_capability (tenant_id, role_id, capability)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [ACME, ROLE, verb],
      )
    }
    await mig.query(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version,
          granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, 1, 'usr_acme_admin', now(), now() + interval '30 days', NULL)
       ON CONFLICT DO NOTHING`,
      [ACME, ASSIGNMENT, PAT, ROLE],
    )
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_pat', $1, $2, $3, $4, $5,
               now(), now(), now() + interval '12 hours', NULL)
       ON CONFLICT DO NOTHING`,
      [digest, PAT, DOOR_PARTNER, ACME, ACME_HOST],
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
    /*
     * ⚠️ AND THE GLOBEX ROW IS §5's, FOR `identity-substrate-served.test.ts`
     * §5's RECORDED REASON: that test rebinds this session to GLOBEX and its
     * whole point is that the refusal comes from `partner_access_grant_rls`.
     * Without a GLOBEX membership the G641 check refuses first and §5 measures
     * THAT instead — the confound its own assertion text names, *"a 401 means
     * something refused earlier and this is measuring that"*.
     *
     * ⚠️ AND A PARTNER'S MEMBERSHIP IS THE CASE `Membership.expiresAt` WAS
     * WRITTEN ABOUT — *"Partner-scoped memberships must expire. Null only for
     * direct staff."* This fixture's expiry is far enough out to be live and
     * is NOT null, so the row is the shape the declaration describes rather
     * than a staff row wearing a partner's name.
     */
    await mig.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'mem_pat',        $3, 'rol_member', 'bootstrap', now(),
               now() + interval '30 days', NULL),
              ($2, 'mem_pat_globex', $3, 'rol_member', 'bootstrap', now(),
               now() + interval '30 days', NULL)
       ON CONFLICT DO NOTHING`,
      [ACME, GLOBEX, PAT],
    )
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

/** Put the fixture back: partner door, live assignment, ACME, no grant. */
async function restore(): Promise<void> {
  await asMigrator(`DELETE FROM tenant.partner_access_grant WHERE tenant_id = ANY($1)`, [
    [ACME, GLOBEX],
  ])
  await asMigrator(`UPDATE tenant.tenant SET partner_id = $2 WHERE id = $1`, [ACME, NORTHWIND])
  await asMigrator(`UPDATE tenant.tenant SET partner_id = NULL WHERE id = $1`, [GLOBEX])
  await asMigrator(
    `UPDATE tenant.role_assignment
        SET revoked_at = NULL, expires_at = now() + interval '30 days', role_version = 1
      WHERE id = $1`,
    [ASSIGNMENT],
  )
  await asMigrator(
    `UPDATE tenant.session SET connection_id = $1, tenant_id = $2, revoked_at = NULL
      WHERE id = 'ses_pat'`,
    [DOOR_PARTNER, ACME],
  )
  /* G641 — both memberships put back live, for the reason every other line in
   * this function exists. */
  await asMigrator(
    `UPDATE tenant.membership
        SET revoked_at = NULL, expires_at = now() + interval '30 days'
      WHERE id IN ('mem_pat', 'mem_pat_globex')`,
  )
}

async function grantScope(
  scope: PartnerAccessScopeKey,
  opts: { partner?: string; revoked?: boolean; expired?: boolean } = {},
): Promise<void> {
  const partner = opts.partner ?? NORTHWIND
  if (partner !== NORTHWIND) {
    /* 0039's FK: a grant may only name the partner who sold the tenant, so
     * pointing the grant at another partner means TRANSFERRING the tenant. That
     * is the real shape of `partner_grant_other_partner` — the directory still
     * says Northwind and the tenant now says somebody else. */
    await asMigrator(`UPDATE tenant.tenant SET partner_id = $2 WHERE id = $1`, [ACME, partner])
  }
  const expiresAt = new Date(Date.now() + (opts.expired === true ? -864e5 : 30 * 864e5))
  await asMigrator(
    `INSERT INTO tenant.partner_access_grant
       (tenant_id, id, partner_id, scope, expires_at, revoked_at)
     VALUES ($1, $2, $3, $4, $5, NULL)`,
    [ACME, GRANT, partner, scope, expiresAt],
  )
  if (opts.revoked === true) {
    await asMigrator(`UPDATE tenant.partner_access_grant SET revoked_at = now() WHERE id = $1`, [
      GRANT,
    ])
  }
}

describe('the partner arm — invariant 2 over a socket', { skip }, () => {
  let plane: { url: string; close(): Promise<void> }

  const RUNS = '/v1/runs'
  const FACETS = '/v1/exceptions/facets'
  const THREADS = '/v1/threads'

  async function statuses(host = ACME_HOST): Promise<{
    runs: number
    facets: number
    threads: number
  }> {
    return {
      runs: (await get(plane.url, RUNS, host)).status,
      facets: (await get(plane.url, FACETS, host)).status,
      threads: (await get(plane.url, THREADS, host)).status,
    }
  }

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    /** NO `authorise` OPTION — the production authoriser. See the header. */
    plane = await startDataPlane({ poolMax: 1 })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
  })

  /* ================================================================ *
   * §1 · THE CONTROL ROW. The same person through a CUSTOMER door is
   *      served all three, so every 403 below is the MASK.
   * ================================================================ */

  it('1 · CONTROL — through a CUSTOMER door the same role is served all three', async () => {
    await restore()
    await asMigrator(`UPDATE tenant.session SET connection_id = $1 WHERE id = 'ses_pat'`, [
      DOOR_CUSTOMER,
    ])
    const seen = await statuses()
    await restore()

    assert.deepEqual(
      seen,
      { runs: 200, facets: 200, threads: 200 },
      'THE CONTROL ROW IS RED, SO EVERY REFUSAL IN THIS FILE IS VACUOUS. The customer arm ' +
        'takes no grant, so the only things between this request and a 200 are the session, ' +
        'the subject, the role and the three capability rows. Fix the fixture before ' +
        `reading any other assertion here. Got ${JSON.stringify(seen)}`,
    )
  })

  /* ================================================================ *
   * §2 · NO GRANT. `partner_grant_absent` — and it is now a fact about
   *      the CUSTOMER's decision rather than about our schema.
   * ================================================================ */

  it('2 · a partner with NO grant reaches nothing, on the partner arm', async () => {
    await restore()
    const seen = await statuses()
    const res = await get(plane.url, FACETS, ACME_HOST)

    assert.deepEqual(
      seen,
      { runs: 403, facets: 403, threads: 403 },
      'A PARTNER WITH NO GRANT WAS SERVED. `PartnerAccessGrant`: *"Default is no access: ' +
        'absence of a grant means partners see commercial metadata only."* §1 proves the ' +
        `same person IS served through a customer door. Got ${JSON.stringify(seen)}`,
    )
    assert.equal(
      res.body?.['code'],
      'capability_not_held',
      'the refusal must be an AUTHORITY refusal — a `session_invalid` means the request ' +
        'never reached `decide()` and this assertion is measuring something else.',
    )
  })

  /* ================================================================ *
   * §3 · THE SCOPE DIFFERENTIAL. Three postures, three answers.
   * ================================================================ */

  it('3a · `commercial_only` — mask `[]`, so nothing at all', async () => {
    await restore()
    await grantScope(PARTNER_ACCESS_SCOPES.commercialOnly)
    const seen = await statuses()
    await restore()

    assert.deepEqual(
      seen,
      { runs: 403, facets: 403, threads: 403 },
      '`PARTNER_CAPABILITY_MASK.commercial_only` is `[]` — a partner under it holds ' +
        'NOTHING while passing every check that tests for the EXISTENCE of a grant. That ' +
        'is the exact principal §10.6 keeps `view_summary` out of the mask for. Got ' +
        JSON.stringify(seen),
    )
  })

  it('3b · `exceptions_read` — the QUEUE and not the PAPER', async () => {
    await restore()
    await grantScope(PARTNER_ACCESS_SCOPES.exceptionsRead)
    const seen = await statuses()
    await restore()

    assert.equal(
      seen.facets,
      200,
      'THE FIRST 200 THE PARTNER ARM HAS EVER RETURNED. This is the assertion G576 exists ' +
        'for: until `tenant.partner_access_grant` existed, `partnerGrant` was `null` ' +
        'unconditionally and `decide()` refused every partner at `partner_grant_absent`. ' +
        'If it is red, check in order — the `tenant.tenant.partner_id` is `prt_northwind` ' +
        '(0039\'s FK refuses the grant otherwise); the grant row is unrevoked and ' +
        'unexpired; the assignment `expires_at` is NOT NULL (a partner may hold no durable ' +
        `assignment); the role carries \`view_exception\`. Got ${JSON.stringify(seen)}`,
    )
    assert.equal(
      seen.threads,
      403,
      '`view_document` is `[\'exceptions_operate\']` — OPERATE ONLY. The declaration says ' +
        'why in one line: *"A document is the counterparty\'s paper, not a count of it."* ' +
        'A 200 here means the mask is not distinguishing the two operating scopes, which ' +
        'collapses §10.6\'s whole argument about correspondence.',
    )
    /* 🛑 200 SINCE 4 Oct 2026 — G3801/G3802, THE OWNER'S RULING ON C3-06:
       *"Open run reads to view_exception: anyone who can see the register can
       see its runs; admit_source stays the gate for starting runs."* `listRuns`
       is `view_exception` now, which `exceptions_read` carries, so a partner
       reading the queue reads its runs. This line asserted 403 until then. */
    /* 🛑 AND 403 AGAIN SINCE LATER ON 4 Oct 2026 — G3881, THE OWNER'S RULING ON
       G3802, QUOTED: *"Keep partners out: run reads open to customer roles
       holding view_exception, but are excluded from the partner capability
       mask; partners still see exceptions, not run residue."* The run reads
       name `view_run`, CARRIED by `view_exception` and in no partner scope, so
       the queue (facets) stays 200 and the run list goes back to 403. The 200
       assertion above was G3801's and is replaced, not loosened. */
    assert.equal(seen.runs, 403, `a partner reads exceptions, not runs (G3881). Got ${JSON.stringify(seen)}`)
  })

  it('3c · `exceptions_operate` — the paper too, and still not the residue', async () => {
    await restore()
    await grantScope(PARTNER_ACCESS_SCOPES.exceptionsOperate)
    const seen = await statuses()
    await restore()

    assert.equal(seen.facets, 200)
    assert.equal(
      seen.threads,
      200,
      'the STRONGER scope must reach `view_document`, or 3b\'s 403 is measuring a broken ' +
        'mask rather than a scope boundary.',
    )
    /* G3801 made this 200; G3881 (the owner's G3802 ruling) makes it 403 again —
       the STRONGEST scope still carries no run read. */
    assert.equal(seen.runs, 403, 'G3881 — partners see exceptions, not run residue, in the stronger scope too.')
  })

  it('3d · G173 — `admit_source` is out of EVERY scope, and the role carries it', async () => {
    /**
     * 🛑 THE SHARPEST ASSERTION IN THE FILE, AND IT IS WORTH STATING WHY.
     * `PARTNER_MASK_MEMBERSHIP.admit_source` is `[]` with a declaration that
     * says *"G173 requires this absence be asserted BY NAME and never by a
     * length, and this entry is that assertion in the type rather than in a
     * test. The residue is source material at LINE grain."* This is that
     * assertion at RUNTIME: the principal holds the verb in their own role,
     * holds the strongest grant the model has, and is refused — so the only
     * thing refusing is the intersection.
     */
    await restore()
    await grantScope(PARTNER_ACCESS_SCOPES.exceptionsOperate)
    /* ⚠️ MEASURED ON `listIntakeChannels` SINCE 4 Oct 2026, NOT `listRuns`:
       G3801 moved the run family to `view_exception` (and G3802 names that a
       partner now reads the residue through it). `admit_source` still gates
       INTAKE and is still out of every scope, which is what this asserts. */
    const res = await get(plane.url, '/v1/intake/channels', ACME_HOST)
    await restore()

    assert.equal(
      res.status,
      403,
      'A PARTNER UNDER THE STRONGEST SCOPE REACHED AN `admit_source` OPERATION. `admit_source` reaches SOURCE ' +
        'MATERIAL AT LINE GRAIN — the customer\'s counterparty documents — and it is `[]` ' +
        'in every partner scope. §1 proves the same role IS served this route through a ' +
        `customer door, so this 403 can only be the mask. Got ${res.status}: ${res.text}`,
    )
  })

  /* ================================================================ *
   * §4 · THE THREE LIVENESS TERMS, EACH ALONE.
   * ================================================================ */

  it('4a · a REVOKED grant reaches nothing', async () => {
    await restore()
    await grantScope(PARTNER_ACCESS_SCOPES.exceptionsOperate, { revoked: true })
    const seen = await statuses()
    await restore()
    assert.deepEqual(
      seen,
      { runs: 403, facets: 403, threads: 403 },
      `a revoked grant was honoured. Got ${JSON.stringify(seen)}`,
    )
  })

  it('4b · an EXPIRED grant reaches nothing — separately from revoked', async () => {
    await restore()
    await grantScope(PARTNER_ACCESS_SCOPES.exceptionsOperate, { expired: true })
    const seen = await statuses()
    await restore()
    assert.deepEqual(
      seen,
      { runs: 403, facets: 403, threads: 403 },
      'an expired grant was honoured. ⚠️ THE READER DOES NOT FILTER ON EITHER COLUMN — ' +
        '`readPartnerGrant()` returns revoked and expired rows alike and `decide()` refuses ' +
        'them as two DIFFERENT reasons. A liveness `WHERE` in the reader would make both ' +
        `refusals unreachable and 4a and 4b would pass for the wrong reason. Got ${JSON.stringify(seen)}`,
    )
  })

  it('4c · ANOTHER PARTNER\'s grant reaches nothing — §9.5', async () => {
    /**
     * The tenant is transferred to Contoso and Contoso is granted access; Pat
     * still authenticates through NORTHWIND's door, so `orgFor()` derives
     * `prt_northwind` and the grant names `prt_contoso`. `decide()` refuses at
     * `partner_grant_other_partner` — *"a partner engineer who moved to the
     * customer keeps grant-derived assignments evaluated under the wrong
     * organisation."*
     */
    await restore()
    await grantScope(PARTNER_ACCESS_SCOPES.exceptionsOperate, { partner: CONTOSO })
    const seen = await statuses()
    await restore()
    assert.deepEqual(
      seen,
      { runs: 403, facets: 403, threads: 403 },
      'A PARTNER WAS SERVED ON ANOTHER PARTNER\'S GRANT. The grant\'s `partnerId` is ' +
        'compared against the one DERIVED from `orgFor(connection.owner)`, never against a ' +
        `route or a membership. Got ${JSON.stringify(seen)}`,
    )
  })

  /* ================================================================ *
   * §5 · INVARIANT 2's CROSS-TENANT SENTENCE, OVER HTTP.
   * ================================================================ */

  it('5 · a grant into ACME reaches nothing in GLOBEX', async () => {
    /**
     * 🛑 THE HOST STAYS `ACME_HOST`, for `identity-substrate-served.test.ts`
     * §5's recorded reason: `Session.issuedHost` is ACME's and
     * `checkHostBinding()` runs on every request under G180, so sending
     * GLOBEX's host would refuse at the BINDING and the assertion would be
     * green while proving nothing about scope.
     *
     * With the host matching, the session's bound tenant is GLOBEX, the tenant
     * scope opens on GLOBEX, and `partner_access_grant_rls` — 0001's predicate
     * verbatim — is the only thing that can hide ACME's grant. This is
     * invariant 2's *"may read tenant `T` iff `T.partnerId = P`"* asserted from
     * the read side rather than from 0039's write-side FK.
     */
    await restore()
    await grantScope(PARTNER_ACCESS_SCOPES.exceptionsOperate)
    await asMigrator(`UPDATE tenant.session SET tenant_id = $1 WHERE id = 'ses_pat'`, [GLOBEX])
    const res = await get(plane.url, FACETS, ACME_HOST)
    await restore()

    assert.equal(
      res.status,
      403,
      'THE ONE CROSS-TENANT READ PATH CROSSED A SECOND TENANT. A grant into ACME must ' +
        'reach nothing in GLOBEX — a 200 means `readPartnerGrant()` escaped its scope, and ' +
        `a 401 means something refused earlier and this is measuring that. Got ${res.status}: ${res.text}`,
    )
    assert.equal(res.body?.['code'], 'capability_not_held')
  })

  /* ================================================================ *
   * §6 · THE ARM THE FIXTURE IS MOST LIKELY TO BREAK SILENTLY.
   * ================================================================ */

  it('6 · a DURABLE assignment is refused even under a live grant', async () => {
    /**
     * `DURABLE_ASSIGNMENT_PERMITTED[partner]` is `false`: *"A partner holding
     * one has authority that outlives the grant it was derived from, which is
     * the precise failure the grant's mandatory `expiresAt` exists to
     * prevent."* It is asserted here because it is also the shape a future
     * fixture will reintroduce by copying the customer suite, and it would turn
     * every 200 in §3 into a 403 that looked like a working mask.
     */
    await restore()
    await grantScope(PARTNER_ACCESS_SCOPES.exceptionsOperate)
    await asMigrator(`UPDATE tenant.role_assignment SET expires_at = NULL WHERE id = $1`, [
      ASSIGNMENT,
    ])
    const res = await get(plane.url, FACETS, ACME_HOST)
    await restore()

    assert.equal(
      res.status,
      403,
      'A PARTNER HELD AN ASSIGNMENT THAT NEVER EXPIRES AND WAS SERVED. ' +
        '`durable_assignment_forbidden_for_org` is the refusal, and the mask passing first ' +
        `does not excuse it. Got ${res.status}: ${res.text}`,
    )
  })

  /* ================================================================ *
   * §7 · G3881 — ALL FIVE RUN READS, UNDER THE STRONGEST LIVE GRANT.
   *
   * The owner's G3802 ruling, quoted: *"Keep partners out: run reads open to
   * customer roles holding view_exception, but are excluded from the partner
   * capability mask; partners still see exceptions, not run residue."*
   *
   * The CONTROL is the same person through a CUSTOMER door: never a 403 on any
   * of the five (the by-id reads answer 404 for a run that does not exist,
   * AFTER the gate), while the partner is refused all five AT the gate. The
   * role carries `view_exception` and no `view_run` row — so the customer's
   * non-403 is the carrying (`CAPABILITY_CARRIED_BY`), and the partner's 403 is
   * the mask. WITNESSED RED: with `view_run` added to
   * `PARTNER_MASK_MEMBERSHIP`'s two exception scopes, every partner status
   * below was 200 or 404.
   * ================================================================ */

  it('7 · a partner under exceptions_operate is refused each of the five run reads; the customer is not', async () => {
    const READS = [
      '/v1/runs',
      '/v1/runs/run_g3881',
      '/v1/runs/run_g3881/account',
      '/v1/runs/run_g3881/residue',
      '/v1/runs/run_g3881/allocations',
    ]
    await restore()
    await grantScope(PARTNER_ACCESS_SCOPES.exceptionsOperate)
    const partner: Record<string, number> = {}
    for (const path of READS) partner[path] = (await get(plane.url, path, ACME_HOST)).status
    const facets = (await get(plane.url, FACETS, ACME_HOST)).status
    await restore()
    await asMigrator(`UPDATE tenant.session SET connection_id = $1 WHERE id = 'ses_pat'`, [DOOR_CUSTOMER])
    const customer: Record<string, number> = {}
    for (const path of READS) customer[path] = (await get(plane.url, path, ACME_HOST)).status
    await restore()

    assert.equal(facets, 200, 'the partner must still read the register, or the 403s below are not the mask')
    assert.deepEqual(
      partner,
      Object.fromEntries(READS.map((p) => [p, 403])),
      `a partner under the strongest grant reached a run read (G3881). Got ${JSON.stringify(partner)}`,
    )
    for (const path of READS) {
      assert.notEqual(customer[path], 403, `the customer control was refused ${path} — the 403s are vacuous. Got ${JSON.stringify(customer)}`)
    }
    assert.equal(customer['/v1/runs'], 200)
  })
})

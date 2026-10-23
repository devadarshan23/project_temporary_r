/**
 * C4's OTHER HALF, SERVED — `proposeResolution` → `decideApproval` →
 * `executeProposal`, over a socket, against the PRODUCTION authoriser and the
 * PRODUCTION substrate reader. G656–G660, 19 Sep 2026.
 *
 * ┌─ WHAT MAKES A GREEN RUN HERE WORTH ANYTHING ───────────────────────────────┐
 * │ `startDataPlane({ poolMax: 1 })` — NO `authorise` argument and NO          │
 * │ `substrate` argument. Both default to the production seams,                │
 * │ `sessionCapabilities` and `substrateFromSession`, so every 200 below went  │
 * │ through `decide()` on rows. `RECONCILE_LOCAL_TEST_AUTH` is DELETED, so     │
 * │ the session is a raw handle digested by the one seam and read out of       │
 * │ `tenant.session` — there is no fixture session object anywhere.            │
 * │                                                                            │
 * │ ⚠️ `poolMax: 1` IS ADVERSARIAL ON PURPOSE: the session scope and the       │
 * │ handler's own tenant scope are forced onto the connection the previous     │
 * │ one released, which is the condition `SET LOCAL` state would leak under.   │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS ASSERTED ─────────────────────────────────────────────────────────┐
 * │ 0  🛑 THE ANTI-VACUOUS CONTROL, FIRST: a path the contract does NOT declare│
 * │    404s with the ROUTER's own title. Without it, every "is not 200"        │
 * │    assertion below passes against a plane that mounts nothing.             │
 * │ 1  `listAvailableDispositions` returns the closed set for the exception.   │
 * │ 2  `proposeResolution` returns 201 and the proposal carries its gate.      │
 * │ 3  `listProposals` and `getProposal` return it.                            │
 * │ 4  🛑 INVARIANT 1, FOUR VECTORS — header, cookie, query and path.          │
 * │ 5  Another tenant's exception, BY ITS EXACT ID, answers as an id nobody    │
 * │    seeded.                                                     INVARIANT 1 │
 * │ 6  A session holding `view_exception` and nothing else READS all three and │
 * │    cannot PROPOSE — the gate, on two verbs, in one session.        G200    │
 * │ 7  🛑 FOUR EYES OVER A SOCKET: the proposer's own approval is 403          │
 * │    `approval_segregation_violation`, and she HOLDS the capability — so the │
 * │    refusal is the MODEL's and not the gate's.                      G658    │
 * │ 8  Quorum: one approval is `approved_pending_second_approver`, executing   │
 * │    then is 409 `proposal_not_executable`, the second clears it, and the    │
 * │    execution returns the resolution with EVERY approver named.     G660    │
 * │ 9  The whole chain minted invariant 10's records — one per act.    G301    │
 * │ 10 `reverseResolution` returns 201, publishes EVERY `required` field of    │
 * │    `Exception`, and the resolution is GONE.               G946–G950, 0140  │
 * │ 10b Reversing again is the contract's 409 — now a refusal about a ROW.     │
 * │ 10c A corrected disposition outside the closed set is 422, and an OFFERED  │
 * │    one still does not re-resolve.                     `0140` §4's trigger  │
 * │ 11 Every reversal row carries the record that wrote it, pinned to its      │
 * │    actor, with all three of `0140` §2's pins set.           G301, 0140 §3  │
 * │ 12 `getDispositionMix` returns 200 with EVERY `required` row field, and    │
 * │    counts CHOICES across both populations — the live resolution and the    │
 * │    reversed one, which is readable only through `0140` §2.  G951–G953      │
 * │ 12b `definitionId` narrows; 12c `view_exception` alone is 403.            │
 * │ 13 `periodId` NARROWS through the raising run (G954 answered).    G3624   │
 * │ 14 `reverseResolution` on a resolution older than 24 hours is 409          │
 * │    `reversal_window_expired`, over a socket, and writes NO row.    G1831  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ §10 ASSERTED THE ROUTER'S 404 UNTIL 20 Sep 2026 and §10's own block
 *    quotes what it said and why. The mount's red was witnessed first, twice:
 *    the route 404'd before `start.ts` named it, and with `0140` §1's
 *    `GRANT INSERT` commented out the happy path answered 500.
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
  process.env['RECONCILE_PROPOSAL_CHAIN_DB_NAME'] ?? runScopedName('reconcile_proposal_chain_served_test')

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

/**
 * FOUR PEOPLE, AND THE SPREAD IS THE SUBJECT RATHER THAN SET DRESSING.
 *
 * 🛑 `MEI` HOLDS `approve_resolution` DELIBERATELY. §7 is about the MODEL
 *    refusing her own approval; if she did not hold the verb she would be
 *    refused by the GATE with `capability_not_held`, the assertion would be
 *    green, and four eyes would be proven by nothing at all.
 */
const MEI = 'usr_ops_mei' /* proposes, may approve in principle, executes */
const CHEN = 'usr_ops_chen' /* first approver */
const DANI = 'usr_ops_dani' /* second approver — quorum is 2 */
const VIK = 'usr_ops_vik' /* view_exception ALONE — §6's differential */

const ROLE_OPERATOR = 'rol_ap_operator'
const ROLE_APPROVER = 'rol_ap_approver'
const ROLE_VIEWER = 'rol_ap_viewer'

const H_MEI = 'sx_mei_9f23c1d80ba64e57a1c3d90f6b2e4817'
const H_CHEN = 'sx_chen_1b7d4e2a08c94f3d95a6e0b1c7d82f43'
const H_DANI = 'sx_dani_6c0a91f4e2b74d58a3c7d5e0f19b24a8'
const H_VIK = 'sx_vik_47b0e3fa51d84c62b9de07a3c5f18260'

const ACME_EXC = 'exc_acme_chain_served_0001'
/** §12's second event. Seeded ALREADY RESOLVED — see `seedSubstrate()`. */
const ACME_SETTLED = 'exc_acme_chain_served_0002'
const GLOBEX_EXC = 'exc_globex_chain_served_0001'
const NEVER_SEEDED = 'exc_no_such_exception_anywhere'
/**
 * §14's own fixture — G1831. Resolved 25 hours ago, by the migrator, so the
 * reversal window (`REVERSAL_WINDOW_HOURS`) has closed on it before any test
 * runs. Kept separate from `ACME_SETTLED`, which §12's disposition-mix
 * assertions read for CONTENT and which must stay untouched by a reversal
 * attempt run at an unpredictable point in this suite's order.
 */
const ACME_STALE_RESOLVED = 'exc_acme_chain_served_0003'

const PACK = 'pck_ap'
const DEFINITION = 'def_ap_close'

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/http/proposal-chain-served.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER THE SIX OPERATIONS G656 MOUNTED. A run in',
      '   which it skipped is NOT evidence that four eyes are enforced over HTTP,',
      '   NOT evidence that a proposal cannot be executed short of quorum, and',
      '   NOT evidence that another tenant`s exception is invisible.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the served resolution-chain assertions', probe)

/* ------------------------------------------------------------------ *
 * A RAW HTTP CLIENT, AND `node:http` RATHER THAN `fetch`: undici derives the
 * `Host` header from the URL on some paths, and G180's binding check compares
 * it against `Session.issuedHost` on EVERY request — and REVOKES the session
 * on a mismatch, so one wrong Host would make every later assertion here a
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
          ...sessionCookie(opts.session ?? H_MEI),
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

async function grantCount(): Promise<number> {
  const mig = await migratorClient()
  try {
    const r = await mig.query('SELECT count(*)::int AS n FROM tenant.authorization_grant')
    return (r.rows[0] as { n: number } | undefined)?.n ?? 0
  } finally {
    await mig.end()
  }
}

/* ------------------------------------------------------------------ *
 * THE FIXTURE.
 * ------------------------------------------------------------------ */

async function seedSubstrate(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')

    /* 🛑 G305: a handle is present EXACTLY WHEN the protocol is brokered, so an
       `oidc` door with no `(broker_issuer, broker_ref)` is
       `broker_unresolvable`, refused rather than defaulted. */
    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme',
               'https://login.microsoftonline.com/acme-chain/v2.0',
               'acme-entra-chain', 'active')`,
      [DOOR],
    )

    for (const [user, email, name] of [
      [MEI, 'mei@acme.invalid', 'Mei Tan'],
      [CHEN, 'chen@acme.invalid', 'Chen Liu'],
      [DANI, 'dani@acme.invalid', 'Dani Okafor'],
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
       VALUES ($1, $2, 'AP Operator', 'operator', 1, 'operator', 'pack', $5, 'active'),
              ($1, $3, 'AP Approver', 'approver', 1, 'approver', 'pack', $5, 'active'),
              ($1, $4, 'AP Viewer',   'viewer',   1, 'viewer',   'pack', $5, 'active')`,
      [ACME, ROLE_OPERATOR, ROLE_APPROVER, ROLE_VIEWER, PACK],
    )

    /* THE OPERATOR HOLDS FOUR VERBS INCLUDING `approve_resolution` — see the
       comment at `MEI`. THE VIEWER HOLDS ONE. */
    for (const capability of [
      CAPABILITIES.viewException,
      CAPABILITIES.proposeResolution,
      CAPABILITIES.approveResolution,
      CAPABILITIES.executeResolution,
      /* ⚠️ THE LAST TWO ARRIVED WITH G946–G954 ON 20 Sep 2026 and are what
         make §10–§13 statements about the GATE rather than about a fixture:
         `reverse_resolution` is `reverseResolution`'s own verb and
         `view_dashboard` is `getDispositionMix`'s, and §6's differential
         still holds because VIK holds neither. */
      CAPABILITIES.reverseResolution,
      CAPABILITIES.viewDashboard,
    ]) {
      await mig.query(
        'INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ($1, $2, $3)',
        [ACME, ROLE_OPERATOR, capability],
      )
    }
    for (const capability of [CAPABILITIES.viewException, CAPABILITIES.approveResolution]) {
      await mig.query(
        'INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ($1, $2, $3)',
        [ACME, ROLE_APPROVER, capability],
      )
    }
    await mig.query(
      'INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ($1, $2, $3)',
      [ACME, ROLE_VIEWER, CAPABILITIES.viewException],
    )

    for (const [user, role] of [
      [MEI, ROLE_OPERATOR],
      [CHEN, ROLE_APPROVER],
      [DANI, ROLE_APPROVER],
      [VIK, ROLE_VIEWER],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant.role_assignment
           (tenant_id, id, user_id, role_id, role_version, granted_by, granted_at,
            expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, 1, 'usr_acme_admin', now(), NULL, NULL)`,
        [ACME, `ras_${user}`, user, role],
      )
    }

    for (const [user, handle] of [
      [MEI, H_MEI],
      [CHEN, H_CHEN],
      [DANI, H_DANI],
      [VIK, H_VIK],
    ] as const) {
      const digest = digestOfHandle(handle)
      assert.notEqual(digest, null, 'a fixture handle digested to nothing')
      await mig.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
            authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now(), now() + interval '12 hours', NULL)`,
        [`ses_${user}`, digest, user, DOOR, ACME, ACME_HOST],
      )
      /**
       * 🛑 THE MEMBERSHIP ROW IS NOT DECORATION — G641. A bound session is a
       * state only `selectTenantForSession()` can produce, which binds on a
       * LIVE membership, and since G641 the per-request path re-asks that
       * question on EVERY request. **A fixture that forges a bound session
       * with no membership forges a state the product cannot reach**, and the
       * plane refuses it 401. Eight such fixtures were found across seven
       * suites on 19 Sep 2026; this is not a ninth.
       */
      await mig.query(
        `INSERT INTO tenant.membership
           (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, 'rol_member', 'bootstrap', now(), NULL, NULL)`,
        [ACME, `mem_${user}`, user],
      )
    }

    for (const [tenant, id] of [
      [ACME, ACME_EXC],
      [GLOBEX, GLOBEX_EXC],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant.exception
           (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
            domain, definition_id, rule_label, severity, severity_rank,
            value_at_risk_currency, value_at_risk_minor, value_at_risk_exponent,
            cost_centre, legal_entity, status, assigned_to, raised_at,
            explanation_summary, explanation_expected, explanation_confidence)
         VALUES ($1, $2, 'mg_1', 'rul_1', 1, 1,
                 'finance', $3, 'Three-way match', 'critical', 0,
                 'SGD', 90000, 2,
                 'CC-1100', 'LE-SG', 'open', NULL, now(),
                 'the invoice disagrees with the purchase order', 'the purchase order', 0.91)`,
        [tenant, id, DEFINITION],
      )
      await mig.query(
        `INSERT INTO tenant.definition_archetype (tenant_id, definition_id, archetype, pack_key)
         VALUES ($1, $2, 'n_way_document_match', $3)`,
        [tenant, DEFINITION, PACK],
      )
      await mig.query(
        `INSERT INTO tenant.approval_config
           (tenant_id, quorum, mandatory_at_or_above, segregation_of_duties)
         VALUES ($1, 2, 'critical', true)`,
        [tenant],
      )
    }

    /**
     * 🛑 A SECOND ACME EXCEPTION, ALREADY SETTLED BY THE MIGRATOR, AND IT
     *    EXISTS FOR §12 ALONE. `getDispositionMix` aggregates over TWO
     *    populations — the live `tenant.exception.resolution_*` columns and
     *    `0140`'s pins on `tenant.exception_reversal` — and a fixture with one
     *    event in one of them proves neither the union nor the split. With
     *    this row the report has to answer `count: 2`,
     *    `byMode { approved: 1, manual: 1 }` and `reversalRate: 0.5`, none of
     *    which a one-branch reader can produce.
     *
     * ⚠️ `manual` AND NOT `autonomous`: `WRITABLE_RESOLUTION_MODES` holds two
     *    members and `autonomous` is not one — *"nothing here is an agent and
     *    there is no policy evaluation, so a resolution claiming policy
     *    authority would name an authority that does not exist."* §12 asserts
     *    `byMode.autonomous` is 0, which is a TRUE count and not a stub.
     *
     * ⚠️ WRITTEN AS AN `INSERT` BY THE MIGRATOR, so `0059`'s `BEFORE UPDATE`
     *    trigger does not fire — it has no opinion about a row arriving
     *    settled, and `0015` records that this is how rows arrive in this
     *    schema at all: *"Rows arrive as the migrator."*
     */
    await mig.query(
      `INSERT INTO tenant.exception
         (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
          domain, definition_id, rule_label, severity, severity_rank,
          value_at_risk_currency, value_at_risk_minor, value_at_risk_exponent,
          cost_centre, legal_entity, status, assigned_to, raised_at,
          explanation_summary, explanation_expected, explanation_confidence,
          resolution_mode, resolution_disposition_key, resolution_proposal_id,
          resolution_executed_by, resolution_at)
       VALUES ($1, $2, 'mg_2', 'rul_1', 1, 1,
               'finance', $3, 'Three-way match', 'high', 1,
               'SGD', 12000, 2,
               'CC-1100', 'LE-SG', 'resolved', NULL, now(),
               'the invoice disagrees with the purchase order', 'the purchase order', 0.88,
               'manual', 'write_off', 'prp_seeded_manual', $4, now())`,
      [ACME, ACME_SETTLED, DEFINITION, MEI],
    )

    /**
     * 🛑 A THIRD ACME EXCEPTION, SEEDED OPEN — G1831, RESOLVED LATER, RIGHT
     *    BEFORE §14, AND DELIBERATELY NOT HERE.
     *
     *    Seeding it ALREADY RESOLVED (like `ACME_SETTLED`) would put a
     *    third `write_off` choice in front of §12's disposition-mix
     *    assertions, which count `write_off` EXACTLY — `ACME_SETTLED`
     *    already exists precisely so that surface has its own fixture and
     *    nothing else touches it. So this row stays OPEN, exactly like
     *    `ACME_EXC` before §8's chain, until §14 resolves it BY THE
     *    MIGRATOR the instant before it is needed — after every earlier
     *    section has already taken its snapshot of the disposition mix.
     */
    await mig.query(
      `INSERT INTO tenant.exception
         (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
          domain, definition_id, rule_label, severity, severity_rank,
          status, raised_at, explanation_summary, explanation_expected)
       VALUES ($1, $2, 'mg_3', 'rul_1', 1, 1,
               'finance', $3, 'Three-way match', 'high', 1,
               'open', now(),
               'the invoice disagrees with the purchase order', 'the purchase order')`,
      [ACME, ACME_STALE_RESOLVED, DEFINITION],
    )

    for (const [key, label, family, reversibility, terminal, adj] of [
      ['write_off', 'Write off', 'charge_variance', 'irreversible', true, false],
      ['price_correction', 'Correct the price', 'price_variance', 'reversible', true, true],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant.disposition
           (tenant_id, pack_key, key, label, family, reversibility, terminal, requires_adjustment)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [ACME, PACK, key, label, family, reversibility, terminal, adj],
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

describe('the resolution chain, served', { skip }, () => {
  let plane: { url: string; close(): Promise<void> }
  let proposalId = ''

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
   * §0 · THE ANTI-VACUOUS CONTROL.
   * ================================================================ */

  it('0 · a path the contract does not declare answers the ROUTER`s 404', async () => {
    const res = await get(plane.url, '/v1/proposals/not/a/declared/path')
    assert.equal(res.status, 404)
    assert.equal(
      res.body?.['title'],
      'No such operation.',
      'THE ROUTER`s OWN 404 HAS A TITLE AND EVERY OTHER 404 IN THIS FILE MUST NOT MATCH IT. ' +
        'Without this pin, §5`s "another tenant`s row is invisible" passes against a plane ' +
        'that mounts nothing at all.',
    )
  })

  /* ================================================================ *
   * §1 · THE CLOSED SET.
   * ================================================================ */

  it('1 · `listAvailableDispositions` returns the closed set with its archetype', async () => {
    const res = await get(plane.url, `/v1/exceptions/${ACME_EXC}/dispositions`)
    assert.equal(
      res.status,
      200,
      'THE OPERATION IS NOT SERVED. Before this commit the same request answered 404 with ' +
        'title "No such operation." A 403 instead means the gate refused a complete ' +
        `substrate. Body: ${res.text.slice(0, 300)}`,
    )
    assert.equal(res.body?.['archetype'], 'n_way_document_match')
    assert.equal(res.body?.['packKey'], PACK)
    const dispositions = res.body?.['dispositions'] as Record<string, unknown>[]
    assert.deepEqual(dispositions.map((d) => d['key']).sort(), ['price_correction', 'write_off'])

    /* Every one of `AvailableDisposition`'s `required` fields has a producer —
       `fast-json-stringify` SERIALISES without validating, so a missing one
       would ship silently. */
    for (const field of [
      'key',
      'label',
      'family',
      'reversibility',
      'terminal',
      'requiresAdjustment',
      'available',
    ]) {
      assert.ok(
        dispositions.every((d) => field in d),
        `\`${field}\` is \`required\` on \`AvailableDisposition\` and is missing from the ` +
          'served body. `fast-json-stringify` serialises without validating, so a 200 that ' +
          'omits a required field ships silently — which is G300’s "a table alone is the trap".',
      )
    }
  })

  /* ================================================================ *
   * §2 · PROPOSING.
   * ================================================================ */

  it('2 · `proposeResolution` returns 201 and publishes the gate it must clear', async () => {
    const res = await send(plane.url, 'POST', `/v1/exceptions/${ACME_EXC}/proposals`, {
      body: {
        dispositionKey: 'write_off',
        rationale: 'below the pursuit threshold; the vendor has been credited',
        evidence: [{ kind: 'system_record', ref: 'sys_ledger_4471', note: null }],
      },
    })
    assert.equal(res.status, 201, `Body: ${res.text.slice(0, 400)}`)
    proposalId = res.body?.['proposalId'] as string
    assert.match(proposalId, /^prp_[0-9a-f]{32}$/, 'the id is not the minted shape')

    const proposedBy = res.body?.['proposedBy'] as Record<string, unknown>
    assert.equal(
      proposedBy['userId'],
      MEI,
      'the proposal was attributed to somebody else. The handler passes `ctx.principal` and ' +
        '`resolution_proposal_insert_restrictive` compares it against the act’s own ' +
        'authorisation record, so this is two controls agreeing.',
    )
    assert.equal(proposedBy['kind'], 'user')

    const execution = res.body?.['execution'] as Record<string, unknown>
    assert.equal(execution['state'], 'not_approved')
    assert.deepEqual(execution['approvals'], [])
    const required = execution['requiredApprovals'] as Record<string, unknown>
    assert.equal(required['quorum'], 2)
    assert.equal(required['segregationOfDuties'], true)
    assert.equal(required['mandatoryAtOrAbove'], 'critical')
    assert.deepEqual(execution['blockedBy'], ['approval_quorum_unmet'])
  })

  it('2b · a disposition outside the closed set is 422, and there is no free-text fallback', async () => {
    const res = await send(plane.url, 'POST', `/v1/exceptions/${ACME_EXC}/proposals`, {
      body: { dispositionKey: 'just_close_it', rationale: 'because', evidence: [] },
    })
    assert.equal(res.status, 422, `Body: ${res.text.slice(0, 300)}`)
    assert.equal(res.body?.['code'], 'disposition_not_offered')
  })

  /* ================================================================ *
   * §3 · READING IT BACK.
   * ================================================================ */

  it('3 · `listProposals` and `getProposal` return it, newest first', async () => {
    const list = await get(plane.url, `/v1/exceptions/${ACME_EXC}/proposals`)
    assert.equal(list.status, 200, `Body: ${list.text.slice(0, 300)}`)
    const items = list.body?.['items'] as Record<string, unknown>[]
    assert.equal(items.length, 1)
    assert.equal(items[0]?.['proposalId'], proposalId)
    assert.equal(
      items[0]?.['dispositionLabel'],
      'Write off',
      'the label is looked up from the pack rather than stored on the proposal, so a renamed ' +
        'disposition renames everywhere.',
    )

    const one = await get(plane.url, `/v1/proposals/${proposalId}`)
    assert.equal(one.status, 200, `Body: ${one.text.slice(0, 300)}`)
    assert.equal(one.body?.['exceptionId'], ACME_EXC)
    const evidence = one.body?.['evidence'] as Record<string, unknown>[]
    assert.equal(evidence.length, 1)
    assert.equal(evidence[0]?.['ref'], 'sys_ledger_4471')
  })

  /* ================================================================ *
   * §4 · INVARIANT 1, FOUR VECTORS.
   * ================================================================ */

  it('4 · a tenant named in a header, a cookie, a query or a path does not widen the answer', async () => {
    /**
     * 🛑 THE ASSERTION IS THAT THE ANSWER DOES NOT MOVE, NOT THAT A PARTICULAR
     *    STATUS COMES BACK, and that is deliberate — **except on the query
     *    vector, where the ruling has since landed and a REFUSAL is the
     *    stronger claim.**
     *
     * ✅ **G941, 20 Sep 2026 — AND THE NOTE THAT STOOD HERE IS CORRECTED
     *    RATHER THAN DELETED, because it is the sentence that told a reader
     *    the limitation was unruled.** IT READ:
     *
     * ⛔ *"`server/data-plane/exceptions.ts` records a known and UNRULED
     *    limitation: an operation declaring no query parameter gets no
     *    querystring schema, so `?tenantId=` is IGNORED rather than REFUSED.
     *    **All six of these operations are in that class**, which is worse than
     *    the two-of-four the exceptions wave reported — every one declares only
     *    a PATH parameter. Asserting a status here would pin the current
     *    behaviour; asserting the answer does not move stays true whichever way
     *    the ruling goes."*
     *
     *    **Its measurement was right and its conclusion is spent.** All six
     *    still declare only a path parameter; what changed is that a
     *    parameter-free operation now carries a closed empty querystring
     *    schema, so the query vector is a **400** and no longer reaches the
     *    handler at all.
     *
     * 🛑 **THE QUERY VECTOR IS SPLIT OUT RATHER THAN DROPPED FROM THE LOOP,
     *    AND THE STRONGER ASSERTION IS MADE ON IT: the refusal must be
     *    IDENTICAL for this tenant's exception and another tenant's.** A 400
     *    that differed between the two would be an existence oracle wearing a
     *    refusal, which is §5's whole subject one test down. The other three
     *    vectors keep the weaker claim, because none of them has a schema that
     *    could refuse it.
     */
    const baseline = await get(plane.url, `/v1/exceptions/${ACME_EXC}/proposals`)
    assert.equal(baseline.status, 200)
    const count = (baseline.body?.['items'] as unknown[]).length

    const vectors: ReadonlyArray<readonly [string, Parameters<typeof send>[3]]> = [
      ['an X-Tenant header', { headers: { 'X-Tenant': GLOBEX } }],
      ['a tenant cookie', { headers: { cookie: `${'__Host-reconcile_session'}=${H_MEI}; tenant=${GLOBEX}` } }],
      ['an X-Session header carrying another tenant’s handle', { headers: { 'X-Session': H_VIK } }],
    ]
    for (const [why, opts] of vectors) {
      const res = await get(plane.url, `/v1/exceptions/${ACME_EXC}/proposals`, opts)
      assert.equal(
        res.status,
        baseline.status,
        `${why} MOVED THE ANSWER. Invariant 1: *"Tenant scope is derived from the session, ` +
          `never read from a request."* Body: ${res.text.slice(0, 200)}`,
      )
      if (res.status !== 200) continue
      assert.equal(
        (res.body?.['items'] as unknown[]).length,
        count,
        `${why} changed WHAT CAME BACK without changing the status, which is the worse of ` +
          'the two failures.',
      )
    }

    /* The query vector — REFUSED since G941, and refused telling nothing. */
    const queried = await get(plane.url, `/v1/exceptions/${ACME_EXC}/proposals?tenantId=${GLOBEX}`)
    assert.equal(
      queried.status,
      400,
      'a ?tenantId query was NOT REFUSED on a parameter-free operation. G941 gives one a ' +
        `closed empty querystring schema. Body: ${queried.text.slice(0, 200)}`,
    )
    assert.equal(queried.body?.['code'], 'validation_failed', `Body: ${queried.text.slice(0, 200)}`)
    const foreign = await get(plane.url, `/v1/exceptions/${GLOBEX_EXC}/proposals?tenantId=${GLOBEX}`)
    assert.equal(
      foreign.text,
      queried.text,
      "the refusal DIFFERS between this tenant's exception and another tenant's, which makes " +
        'the validator an existence oracle. ajv answers before the handler and must know ' +
        'nothing about which rows exist.',
    )
  })

  /* ================================================================ *
   * §5 · ANOTHER TENANT'S ROW.
   * ================================================================ */

  it('5 · another tenant’s exception, by its exact id, answers as an id nobody seeded', async () => {
    const other = await get(plane.url, `/v1/exceptions/${GLOBEX_EXC}/proposals`)
    const nowhere = await get(plane.url, `/v1/exceptions/${NEVER_SEEDED}/proposals`)
    assert.equal(other.status, 404)
    assert.equal(
      other.status,
      nowhere.status,
      'A ROW IN ANOTHER TENANT ANSWERS DIFFERENTLY FROM ONE THAT DOES NOT EXIST, which makes ' +
        'this an existence oracle across the tenant boundary.',
    )
    assert.equal(other.body?.['code'], nowhere.body?.['code'])
    assert.notEqual(
      other.body?.['title'],
      'No such operation.',
      'THE PATH IS NOT ROUTED AT ALL, so this assertion is about a 404 from the router and ' +
        'says nothing about tenancy — the §0 pin exists for exactly this.',
    )
  })

  /* ================================================================ *
   * §6 · THE GATE, ON TWO VERBS, IN ONE SESSION.
   * ================================================================ */

  it('6 · a session holding only `view_exception` READS all three and cannot PROPOSE', async () => {
    for (const path of [
      `/v1/exceptions/${ACME_EXC}/dispositions`,
      `/v1/exceptions/${ACME_EXC}/proposals`,
      `/v1/proposals/${proposalId}`,
    ]) {
      const res = await get(plane.url, path, { session: H_VIK })
      assert.equal(res.status, 200, `a viewer was refused \`${path}\`: ${res.text.slice(0, 200)}`)
    }

    const refused = await send(plane.url, 'POST', `/v1/exceptions/${ACME_EXC}/proposals`, {
      session: H_VIK,
      body: { dispositionKey: 'write_off', rationale: 'let me', evidence: [] },
    })
    assert.equal(
      refused.status,
      403,
      'A VIEWER PROPOSED A DISPOSITION. `view_exception` reaches four stakeholder classes and ' +
        '`propose_resolution` reaches `operator` alone; the difference is enforced by ' +
        `\`decide()\`. Body: ${refused.text.slice(0, 200)}`,
    )
    assert.equal(refused.body?.['code'], 'capability_not_held')
  })

  /* ================================================================ *
   * §7 · 🛑 FOUR EYES, OVER A SOCKET.
   * ================================================================ */

  it('7 · the proposer cannot approve her own proposal — and she HOLDS the capability', async () => {
    const res = await send(plane.url, 'POST', `/v1/proposals/${proposalId}/approvals`, {
      session: H_MEI,
      body: { decision: 'approved' },
    })
    assert.equal(res.status, 403, `Body: ${res.text.slice(0, 300)}`)
    assert.equal(
      res.body?.['code'],
      'approval_segregation_violation',
      'THE REFUSAL CAME FROM THE WRONG PLACE. `capability_not_held` here would mean the GATE ' +
        'refused her — and the fixture gives `rol_ap_operator` `approve_resolution` precisely ' +
        'so the refusal has to come from `model/approval.ts` instead. *"The same person ' +
        'approving their own proposal is not a policy nuance; it is the control being absent."*',
    )
  })

  it('7b · a rejection with no reason is 422', async () => {
    const res = await send(plane.url, 'POST', `/v1/proposals/${proposalId}/approvals`, {
      session: H_CHEN,
      body: { decision: 'rejected', reason: null },
    })
    assert.equal(res.status, 422, `Body: ${res.text.slice(0, 300)}`)
    assert.equal(res.body?.['code'], 'approval_rejection_reason_required')
  })

  /* ================================================================ *
   * §8 · QUORUM, AND THE CENTRAL 409.
   * ================================================================ */

  it('8 · one approval is APPROVED-AND-NOT-EXECUTABLE; two clear it; the execution names every approver', async () => {
    const first = await send(plane.url, 'POST', `/v1/proposals/${proposalId}/approvals`, {
      session: H_CHEN,
      body: { decision: 'approved' },
    })
    assert.equal(first.status, 200, `Body: ${first.text.slice(0, 300)}`)
    const afterOne = first.body?.['execution'] as Record<string, unknown>
    assert.equal(
      afterOne['state'],
      'approved_pending_second_approver',
      '*"A client that treats HTTP 200 on this operation as done will show a green tick over ' +
        'an exception nobody has authorised to move money."*',
    )

    /* 🛑 THE CENTRAL CASE. */
    const early = await send(plane.url, 'POST', `/v1/proposals/${proposalId}/execution`, {
      session: H_MEI,
    })
    assert.equal(early.status, 409, `Body: ${early.text.slice(0, 300)}`)
    assert.equal(
      early.body?.['code'],
      'proposal_not_executable',
      'ONE APPROVAL EXECUTED A PROPOSAL UNDER A QUORUM OF TWO. A 403 here would be wrong too: ' +
        'the caller IS permitted and the THING is not ready, which is why the two statuses ' +
        'are kept apart.',
    )

    const second = await send(plane.url, 'POST', `/v1/proposals/${proposalId}/approvals`, {
      session: H_DANI,
      body: { decision: 'approved' },
    })
    assert.equal(second.status, 200, `Body: ${second.text.slice(0, 300)}`)
    assert.equal((second.body?.['execution'] as Record<string, unknown>)['state'], 'executable')

    const done = await send(plane.url, 'POST', `/v1/proposals/${proposalId}/execution`, {
      session: H_MEI,
    })
    assert.equal(done.status, 200, `Body: ${done.text.slice(0, 400)}`)
    const resolution = done.body?.['resolution'] as Record<string, unknown>
    assert.equal(resolution['mode'], 'approved')
    assert.deepEqual(
      resolution['approvedBy'],
      [CHEN, DANI],
      '`approvedBy` reached the wire empty or short. It is G660’s field and it is DERIVED ' +
        'from `tenant.approval_decision`; a quorum of two publishing one name loses a ' +
        'signature, which is what the wire did before this commit.',
    )
    assert.equal(resolution['executedBy'], MEI, '`executedBy` is G660’s other field')
    assert.equal(resolution['decidedBy'], CHEN, '`decidedBy` is `approvedBy[0]`')
    assert.equal(done.body?.['closedException'], true)
    assert.equal(done.body?.['routedToProcedureId'], null)

    /* And a second execution is refused. */
    const again = await send(plane.url, 'POST', `/v1/proposals/${proposalId}/execution`, {
      session: H_MEI,
    })
    assert.equal(again.status, 409)
    assert.equal(again.body?.['code'], 'exception_already_resolved')
  })

  it('8b · proposing again on a resolved exception is 409', async () => {
    const res = await send(plane.url, 'POST', `/v1/exceptions/${ACME_EXC}/proposals`, {
      body: { dispositionKey: 'write_off', rationale: 'once more', evidence: [] },
    })
    assert.equal(res.status, 409, `Body: ${res.text.slice(0, 300)}`)
    assert.equal(res.body?.['code'], 'exception_already_resolved')
  })

  /* ================================================================ *
   * §9 · INVARIANT 10.
   * ================================================================ */

  it('9 · every act in the chain minted an authorisation record, in its own transaction', async () => {
    const before = await grantCount()
    const res = await get(plane.url, `/v1/proposals/${proposalId}`)
    assert.equal(res.status, 200)
    const after = await grantCount()
    assert.equal(
      after,
      before + 1,
      'A SERVED READ LEFT NO RECORD. G301: *"an operation may not mount until it mints a ' +
        'record"*, and `mountTier()`’s sixth fence is what makes that a boot failure rather ' +
        'than a review comment.',
    )

    /* 🛑 AND THE WRITES ARE THE STRONGER HALF: `tenant.resolution_proposal` and
       `tenant.approval_decision` have RESTRICTIVE policies that READ that
       record, so a write that reached the table did so with one. Counting the
       rows is how that is observable from outside. */
    const mig = await migratorClient()
    try {
      const counts = await mig.query(
        `SELECT
           (SELECT count(*)::int FROM tenant.resolution_proposal) AS proposals,
           (SELECT count(*)::int FROM tenant.approval_decision)   AS decisions,
           (SELECT count(*)::int FROM tenant.authorization_grant
             WHERE capability = 'execute_resolution')             AS executes`,
      )
      const row = counts.rows[0] as { proposals: number; decisions: number; executes: number }
      assert.equal(row.proposals, 1)
      assert.equal(
        row.decisions,
        2,
        'the two approvals are two rows. `quorum` counts DISTINCT approvers of ONE proposal, ' +
          'so several rows per proposal is the shape, and `(proposal_id, decided_by)` is not ' +
          'a key.',
      )
      assert.ok(row.executes >= 1, 'no `execute_resolution` record was minted')
    } finally {
      await mig.end()
    }
  })

  /* ================================================================ *
   * §10 · `reverseResolution`, MOUNTED — G946–G950, 20 Sep 2026.
   *
   * ⚠️ THIS SECTION ASSERTED THE ROUTER'S 404 UNTIL THIS COMMIT AND IT IS
   *    INVERTED RATHER THAN DELETED, because its old text is the reason the
   *    grant was not taken earlier and is quoted in four files. It read:
   *
   *      *"the row exists, the 409 is no longer its only reachable answer,
   *       and it is STILL not mounted — because `tenant.exception_reversal`
   *       takes `GRANT SELECT` alone and mounting it would answer 500, not
   *       409. `0004`'s rule and G511's sentence — the fence and the writer
   *       are one commit or neither — are why the grant is not taken here."*
   *
   *    `db/migrations/0140_reversal_write_and_mix_pins.sql` §1 takes the
   *    grant and `server/data-plane/reversal-store.ts` is the writer it owes,
   *    in one commit. **The red this replaced was witnessed first**: with the
   *    `GRANT INSERT` line commented out and everything else in place, this
   *    section returned 500 `upstream_unavailable` with
   *    `permission denied for table exception_reversal` in the plane's log.
   * ================================================================ */

  it('10 · `reverseResolution` returns 201 and publishes the whole Exception, resolution cleared', async () => {
    const res = await send(plane.url, 'POST', `/v1/exceptions/${ACME_EXC}/reversals`, {
      body: {
        reason: 'wrong_disposition',
        newStatus: 'open',
        note: 'the credit note was applied to the wrong line',
        correctedDispositionKey: null,
      },
    })
    assert.equal(
      res.status,
      201,
      'THE OPERATION IS NOT SERVED, OR IT REFUSED. Before this commit the same request ' +
        'answered 404 with title "No such operation."; a 500 means `0140` §1’s `GRANT ' +
        'INSERT` is missing or `0140` §4’s trigger refused the clearing UPDATE; a 403 means ' +
        `the fixture stopped holding \`reverse_resolution\`. Body: ${res.text.slice(0, 400)}`,
    )

    /**
     * 🛑 EVERY `required` FIELD OF THE 201 BODY, READ BACK. `fast-json-stringify`
     *    SERIALISES a response and does not VALIDATE one (G284, G656), so an
     *    operation that omits one of its own required fields ships a 201 that
     *    is silently short — which is G300's *"a table alone is the trap"*
     *    with the trap sprung on the way OUT.
     */
    for (const field of [
      'exceptionId',
      'matchGroupId',
      'ruleId',
      'ruleVersion',
      'definitionVersion',
      'explanation',
      'domain',
      'definitionId',
      'ruleLabel',
      'severity',
      'severityRank',
      'valueAtRisk',
      'costCentre',
      'legalEntity',
      'status',
      'assignedTo',
      'raisedAt',
      'resolution',
      'reversals',
    ]) {
      assert.ok(
        res.body !== undefined && field in res.body,
        `\`${field}\` is \`required\` on \`Exception\` and is missing from the served 201.`,
      )
    }

    /* 🛑 THE RESOLUTION IS GONE. *"The current resolution. Null while
       unresolved, and cleared on reversal."* A 201 that still carried it would
       mean the clearing UPDATE did not run and the exception is resolved and
       reversed at once. */
    assert.equal(res.body?.['resolution'], null)
    assert.equal(res.body?.['status'], 'open')

    const reversals = res.body?.['reversals'] as Record<string, unknown>[]
    assert.equal(reversals.length, 1, 'the reversal was not written, or was written twice')
    const entry = reversals[0] as Record<string, unknown>
    assert.equal(entry['reason'], 'wrong_disposition')
    assert.equal(entry['reversedBy'], MEI, '*"A reversal is a correction, and corrections are signed."*')
    assert.equal(entry['newStatus'], 'open')
    assert.equal(entry['correctedDispositionKey'], null)
    assert.equal(
      entry['indictsAutonomy'],
      true,
      '`reversalIndictsAutonomy(\'wrong_disposition\')` is TRUE and the field is DERIVED by ' +
        'calling the model’s function — `0015`: *"`indicts_autonomy` IS NOT A COLUMN, ' +
        'DELIBERATELY … A stored copy is a second call site that cannot be recompiled."*',
    )

    /**
     * 🛑 AND THE THREE PINS ARE **NOT** ON THE WIRE. `0140` §2 stores
     *    `reversed_disposition_key`, `reversed_mode` and `reversed_at` so that
     *    §12 can count a choice whose own row has been nulled — and
     *    `ExceptionReversal` is six fields and stays six. Publishing them here
     *    would put the undone resolution back beside the reversal, which is
     *    the state *"cleared on reversal"* exists to make unrepresentable.
     */
    for (const absent of ['reversedDispositionKey', 'reversedMode', 'reversedAt']) {
      assert.ok(
        !(absent in entry),
        `\`${absent}\` reached the wire. It is a STORAGE pin for \`getDispositionMix\` and is ` +
          'not a field of `ExceptionReversal`; `additionalProperties: false` would not have ' +
          'caught it, because `fast-json-stringify` drops rather than refuses.',
      )
    }
  })

  it('10b · reversing again is the contract’s 409, and it is now a real refusal about a real row', async () => {
    /**
     * 🛑 THIS IS THE ANSWER G359 REFUSED TO MOUNT THE OPERATION FOR, AND IT IS
     *    THE SAME ANSWER FOR A DIFFERENT REASON. It declined because the 409
     *    was the ONLY reachable answer — *"a 409 indistinguishable from an
     *    unbuilt feature"*. §10 has just returned a 201, so this 409 is a
     *    statement about THIS exception rather than about the repository.
     */
    const res = await send(plane.url, 'POST', `/v1/exceptions/${ACME_EXC}/reversals`, {
      body: { reason: 'data_corrected', newStatus: 'open' },
    })
    assert.equal(res.status, 409, `Body: ${res.text.slice(0, 300)}`)
    assert.equal(res.body?.['code'], 'validation_failed')
  })

  it('10c · a corrected disposition outside the offered set is 422, and does NOT re-resolve', async () => {
    /* First put a resolution back, so the 409 above is not what refuses this. */
    const proposal = await send(plane.url, 'POST', `/v1/exceptions/${ACME_EXC}/proposals`, {
      body: {
        dispositionKey: 'price_correction',
        rationale: 'the unit price was keyed from the wrong contract',
        evidence: [],
        adjustment: { currency: 'SGD', amountMinor: '90000', exponent: 2 },
      },
    })
    assert.equal(proposal.status, 201, `Body: ${proposal.text.slice(0, 400)}`)
    const second = proposal.body?.['proposalId'] as string

    for (const session of [H_CHEN, H_DANI]) {
      const approval = await send(plane.url, 'POST', `/v1/proposals/${second}/approvals`, {
        session,
        body: { decision: 'approved' },
      })
      assert.equal(approval.status, 200, `Body: ${approval.text.slice(0, 300)}`)
    }
    const executed = await send(plane.url, 'POST', `/v1/proposals/${second}/execution`, {})
    assert.equal(executed.status, 200, `Body: ${executed.text.slice(0, 400)}`)

    /* 🛑 THE 422. *"Validated against the same closed list as a proposal — a
       correction is not an escape from the vocabulary."* `dispute` is not in
       this pack's two dispositions. */
    const refused = await send(plane.url, 'POST', `/v1/exceptions/${ACME_EXC}/reversals`, {
      body: { reason: 'rule_wrong', newStatus: 'open', correctedDispositionKey: 'dispute' },
    })
    assert.equal(refused.status, 422, `Body: ${refused.text.slice(0, 300)}`)
    assert.equal(refused.body?.['code'], 'disposition_not_offered')

    /* And the row did not move under the refusal. */
    const still = await get(plane.url, `/v1/exceptions/${ACME_EXC}`)
    assert.equal(still.status, 200)
    assert.equal(
      (still.body?.['resolution'] as Record<string, unknown>)['dispositionKey'],
      'price_correction',
      'a refused reversal cleared the resolution anyway',
    )

    /**
     * 🛑 AND A CORRECTION THAT IS OFFERED STILL DOES NOT RE-RESOLVE. `0140`
     *    §4's trigger admits a `reverse_resolution` record ONLY for a write
     *    that nulls all six resolution columns, so undo-then-redo in one act
     *    is unrepresentable — *"an agent that can undo its own resolutions can
     *    launder a bad one"*, in SQL.
     */
    const corrected = await send(plane.url, 'POST', `/v1/exceptions/${ACME_EXC}/reversals`, {
      body: { reason: 'rule_wrong', newStatus: 'open', correctedDispositionKey: 'write_off' },
    })
    assert.equal(corrected.status, 201, `Body: ${corrected.text.slice(0, 400)}`)
    assert.equal(
      corrected.body?.['resolution'],
      null,
      'A CORRECTED DISPOSITION BECAME A RESOLUTION. It is recorded on the reversal and ' +
        'nowhere else: a resolution nobody proposed, nobody approved and nobody executed, ' +
        'carrying a reversal’s signature, is the laundered decision `0059`’s grants block ' +
        'refuses one table over.',
    )
    const latest = (corrected.body?.['reversals'] as Record<string, unknown>[]).at(-1)
    assert.equal(latest?.['correctedDispositionKey'], 'write_off')
    assert.equal(
      (corrected.body?.['reversals'] as unknown[]).length,
      2,
      '*"Reversals accumulate as an array … a flag would have erased it."*',
    )
  })

  /* ================================================================ *
   * §11 · THE RECORD BEHIND THE REVERSAL. G301, and `0140` §3.
   * ================================================================ */

  it('11 · every reversal row carries the authorisation record that wrote it, pinned to its actor', async () => {
    const mig = await migratorClient()
    try {
      const counts = await mig.query(
        `SELECT
           (SELECT count(*)::int FROM tenant.exception_reversal)        AS reversals,
           (SELECT count(*)::int FROM tenant.authorization_grant
             WHERE capability = 'reverse_resolution')                   AS reverses,
           (SELECT count(*)::int FROM tenant.exception_reversal
             WHERE reversed_by <> $1)                                   AS misattributed,
           (SELECT count(*)::int FROM tenant.exception_reversal
             WHERE reversed_disposition_key IS NULL
                OR reversed_mode IS NULL
                OR reversed_at IS NULL)                                 AS unpinned`,
        [MEI],
      )
      const row = counts.rows[0] as {
        reversals: number
        reverses: number
        misattributed: number
        unpinned: number
      }
      assert.equal(row.reversals, 2, '§10 and §10c each wrote one')
      assert.ok(
        row.reverses >= 3,
        'a `reverse_resolution` record per act, including the two refused ones — the record ' +
          'is minted BEFORE the act and a refused act keeps its record only if it committed. ' +
          `Found ${row.reverses}.`,
      )
      assert.equal(
        row.misattributed,
        0,
        '`0140` §3 pins `reversed_by` against `authorization_grant.subject_user_id`; a row ' +
          'naming anybody else means that policy is gone.',
      )
      assert.equal(
        row.unpinned,
        0,
        '`0140` §2 makes all three pins `NOT NULL`. A null one means the column was widened, ' +
          'and `getDispositionMix` would then have to decide what an unattributable reversal ' +
          'counts as — every available answer being a wrong number rather than a refusal.',
      )
    } finally {
      await mig.end()
    }
  })

  /* ================================================================ *
   * §12 · `getDispositionMix`, MOUNTED — G951–G954, 20 Sep 2026.
   * ================================================================ */

  it('12 · `getDispositionMix` returns 200 with every required field, counting choices across both populations', async () => {
    const res = await get(plane.url, '/v1/reports/disposition-mix')
    assert.equal(
      res.status,
      200,
      'THE OPERATION IS NOT SERVED. Before this commit the same request answered 404 with ' +
        'title "No such operation."; a 500 means a settled exception names a disposition the ' +
        `catalogue cannot describe. Body: ${res.text.slice(0, 400)}`,
    )

    const rows = res.body?.['rows'] as Record<string, unknown>[]
    assert.ok(Array.isArray(rows), '`rows` is `required` on the 200')

    /**
     * 🛑 EVERY `required` FIELD OF EVERY ROW, AND THIS IS THE ASSERTION THE
     *    WHOLE SECTION EXISTS FOR. `tests/contracts/customer-surface-reach
     *    .test.mjs` §4 held this operation back for exactly two of them:
     *    *"WHAT IT DOES NOT HAVE IS `label` AND `family`, WHICH ARE BOTH
     *    `required` ON THE 200 … A mounted `getDispositionMix` would have
     *    shipped a 200 missing two."* G657's catalogue produces both, and this
     *    is where that is witnessed over a socket rather than derived from a
     *    migration.
     */
    for (const field of ['dispositionKey', 'label', 'family', 'count', 'byMode', 'reversalRate']) {
      assert.ok(
        rows.every((row) => field in row),
        `\`${field}\` is \`required\` on the disposition-mix row and is missing from the ` +
          'served 200. `fast-json-stringify` serialises without validating, so this ships ' +
          `silently. Body: ${res.text.slice(0, 400)}`,
      )
    }
    for (const row of rows) {
      const byMode = row['byMode'] as Record<string, unknown>
      for (const field of ['autonomous', 'approved', 'manual']) {
        assert.ok(field in byMode, `\`byMode.${field}\` is \`required\` and is missing`)
      }
    }

    /**
     * 🛑 THE NUMBERS, AND THEY ARE THE POINT RATHER THAN THE SHAPE.
     *
     * `write_off` was chosen TWICE in this database: once on the seeded
     * `ACME_SETTLED` row, in `manual` mode, still live in
     * `tenant.exception.resolution_*`; and once by §8's execution, in
     * `approved` mode, **reversed by §10 and therefore readable only from
     * `0140` §2's pins**. A reader that looked at the live columns alone would
     * publish `count: 1` and `reversalRate: 0` and look entirely plausible.
     */
    const writeOff = rows.find((row) => row['dispositionKey'] === 'write_off')
    assert.ok(writeOff, `\`write_off\` is absent from the mix entirely. Rows: ${res.text.slice(0, 400)}`)
    assert.equal(
      writeOff['count'],
      2,
      'THE REVERSED CHOICE WAS LOST. `count` counts CHOICES — *"a disposition chosen four ' +
        'hundred times and reversed a third of the time was not the success its volume ' +
        'suggests"* — and a reversal CLEARS `tenant.exception.resolution_*`, so the second ' +
        'event is readable only through `0140` §2’s pins. A `count` of 1 means the ' +
        '`UNION ALL` in `disposition-mix-store.ts` lost its second branch.',
    )
    assert.deepEqual(writeOff['byMode'], { autonomous: 0, approved: 1, manual: 1 })
    const modes = writeOff['byMode'] as { autonomous: number; approved: number; manual: number }
    assert.equal(
      modes.autonomous + modes.approved + modes.manual,
      writeOff['count'],
      '`byMode` must sum to `count` or one of the two is describing a different population',
    )
    assert.equal(
      writeOff['reversalRate'],
      0.5,
      'ONE of the two `write_off` choices was reversed with `wrong_disposition`, which ' +
        '`reversalIndictsAutonomy()` counts. A 0 means the reversal branch is missing; a 1 ' +
        'means the live choice is.',
    )
    assert.equal(writeOff['label'], 'Write off', '`label` comes from `tenant.disposition`')
    assert.equal(writeOff['family'], 'charge_variance')

    /* §10c reversed `price_correction` with `rule_wrong`, which does NOT
       indict — *"A disposition reversed because the rule should not have fired
       was the right judgement on what was known at the time."* */
    const priceCorrection = rows.find((row) => row['dispositionKey'] === 'price_correction')
    assert.ok(priceCorrection, '`price_correction` is absent from the mix')
    assert.equal(priceCorrection['count'], 1)
    assert.equal(
      priceCorrection['reversalRate'],
      0,
      'A REVERSAL THAT DOES NOT INDICT WAS COUNTED. `rule_wrong` is one of the three reasons ' +
        '`reversalIndictsAutonomy()` returns false for, and counting it *"would have C13’s ' +
        'loop strangle itself on the tenant’s own data corrections"*.',
    )

    /* 🛑 `valueAtRisk` IS OPTIONAL AND IS DELIBERATELY NOT PUBLISHED. See
       `disposition-mix-store.ts`: the fixture holds SGD and the register holds
       JPY elsewhere, and a bare addition of minor units across currencies is a
       number that looks like money and is not. */
    assert.ok(
      rows.every((row) => !('valueAtRisk' in row)),
      '`valueAtRisk` appeared. It is the one property NOT in the row’s `required` list, and ' +
        'summing `tenant.exception.value_at_risk_*` across currencies needs an FX rate no ' +
        'producer on this path has. G111: one codec, and nothing else converts.',
    )
  })

  it('12b · the mix is scoped to the session’s tenant, and `definitionId` narrows it', async () => {
    /* GLOBEX's exception is unresolved, so it contributes nothing either way —
       the assertion that carries weight is the `definitionId` filter, whose
       producer is a real column. */
    const narrowed = await get(
      plane.url,
      `/v1/reports/disposition-mix?definitionId=${encodeURIComponent('def_no_such_definition')}`,
    )
    assert.equal(narrowed.status, 200, `Body: ${narrowed.text.slice(0, 300)}`)
    assert.deepEqual(
      narrowed.body?.['rows'],
      [],
      'a definition nothing was settled under must answer an EMPTY mix, not the whole one. ' +
        'An ignored filter is a superset presented as the answer to a narrower question.',
    )

    const mine = await get(
      plane.url,
      `/v1/reports/disposition-mix?definitionId=${encodeURIComponent(DEFINITION)}`,
    )
    assert.equal(mine.status, 200)
    assert.equal((mine.body?.['rows'] as unknown[]).length, 2)
  })

  it('12c · a session holding `view_exception` alone is refused the report', async () => {
    /* 🛑 THE GATE, ON THE VERB THIS OPERATION DECLARES. `view_dashboard` is
       not `view_exception`, and VIK holds only the second — so this is
       `decide()` refusing rather than this file arranging a 403. */
    const res = await get(plane.url, '/v1/reports/disposition-mix', { session: H_VIK })
    assert.equal(res.status, 403, `Body: ${res.text.slice(0, 300)}`)
  })

  /* ================================================================ *
   * §13 · THE FILTER G954 REFUSED, NOW APPLIED THROUGH THE RAISING RUN. G3624.
   * ================================================================ */

  it('13 · `periodId` NARROWS the mix to the period of the run that RAISED each exception', async () => {
    /**
     * ✅ G3624, 3 Oct 2026 — G954's REFUSAL IS REPLACED BY THE NARROWING, AS
     *    ITS OWN TEXT DEMANDED: *"If you implement the filter, this section must
     *    be replaced by one asserting the NARROWING, not removed."* Witnessed
     *    RED first: with `0480` applied and the refusal deleted, the old §13
     *    got a 200 where it required 422.
     *
     *    The owner's G3621 gives an exception the run that raised it
     *    (`db/migrations/0480`). ONE settled exception (`ACME_SETTLED`,
     *    `write_off`, manual) is attributed to a March run; the chain's
     *    exception carries no run. So March answers exactly one choice, April
     *    answers NOTHING, and the unattributed exception's events are in
     *    neither — *"outside the question"*, `0480` §1.
     */
    const mig = await migratorClient()
    try {
      await mig.query(
        `INSERT INTO run (tenant_id, id, definition_id, definition_version, period_id,
                          trigger_kind, status, started_at, finished_at, exceptions_raised)
         VALUES ($1, 'run_mix_march', $2, 1, 'per_2026_03', 'manual', 'completed', now(), now(), 1)`,
        [ACME, DEFINITION],
      )
      await mig.query(`UPDATE tenant.exception SET run_id = 'run_mix_march' WHERE tenant_id = $1 AND id = $2`, [
        ACME,
        ACME_SETTLED,
      ])
    } finally {
      await mig.end()
    }

    const march = await get(plane.url, '/v1/reports/disposition-mix?periodId=per_2026_03')
    assert.equal(
      march.status,
      200,
      `A 422 here means G954's refusal was not deleted. Body: ${march.text.slice(0, 300)}`,
    )
    const rows = march.body?.['rows'] as Record<string, unknown>[]
    assert.deepEqual(
      rows.map((row) => [row['dispositionKey'], row['count'], row['byMode']]),
      [['write_off', 1, { autonomous: 0, approved: 0, manual: 1 }]],
      'THE PERIOD WAS IGNORED OR MISAPPLIED. Only `ACME_SETTLED` was raised by a March run; ' +
        'the chain\'s exception records no run and must be outside a period-filtered mix.',
    )

    const april = await get(plane.url, '/v1/reports/disposition-mix?periodId=per_2026_04')
    assert.equal(april.status, 200)
    assert.deepEqual(
      april.body?.['rows'],
      [],
      'A period no run of this tenant belongs to must answer an EMPTY mix — a superset here is ' +
        'every period presented as the one asked for, which is what G954 refused to ship.',
    )
  })

  it('13b · G3811 — `undone_by_actor` is ACCEPTED, recorded, and does NOT count against the disposition rate', async () => {
    /* THE OWNER'S RULING ON C3-12, quoted: *"New 'undone' reason: add an
       'undone_by_actor' reversal reason that does not count against the
       disposition's reversal rate."* A real resolution is put back on the
       chain's exception and UNDONE over the socket, then the mix is read. */
    const proposal = await send(plane.url, 'POST', `/v1/exceptions/${ACME_EXC}/proposals`, {
      body: {
        dispositionKey: 'price_correction',
        rationale: 'posted by mistake, retracted inside the window',
        evidence: [],
        adjustment: { currency: 'SGD', amountMinor: '90000', exponent: 2 },
      },
    })
    assert.equal(proposal.status, 201, `Body: ${proposal.text.slice(0, 400)}`)
    const id = proposal.body?.['proposalId'] as string
    for (const session of [H_CHEN, H_DANI]) {
      const approval = await send(plane.url, 'POST', `/v1/proposals/${id}/approvals`, {
        session,
        body: { decision: 'approved' },
      })
      assert.equal(approval.status, 200, `Body: ${approval.text.slice(0, 300)}`)
    }
    const executed = await send(plane.url, 'POST', `/v1/proposals/${id}/execution`, {})
    assert.equal(executed.status, 200, `Body: ${executed.text.slice(0, 400)}`)

    const undone = await send(plane.url, 'POST', `/v1/exceptions/${ACME_EXC}/reversals`, {
      body: { reason: 'undone_by_actor', newStatus: 'open' },
    })
    assert.equal(undone.status, 201, `the plane refused the owner's new reason. Body: ${undone.text.slice(0, 400)}`)
    const latest = (undone.body?.['reversals'] as Record<string, unknown>[]).at(-1)
    assert.equal(latest?.['reason'], 'undone_by_actor')

    const mix = await get(plane.url, '/v1/reports/disposition-mix')
    assert.equal(mix.status, 200, `Body: ${mix.text.slice(0, 300)}`)
    const row = (mix.body?.['rows'] as Record<string, unknown>[]).find((r) => r['dispositionKey'] === 'price_correction')
    assert.ok(row, '`price_correction` is absent from the mix')
    assert.equal(row['count'], 2, 'the undone choice is still a CHOICE — `count` counts choices')
    assert.equal(
      row['reversalRate'],
      0,
      'A SELF-UNDO WAS COUNTED AGAINST THE DISPOSITION. Both `price_correction` reversals are ' +
        'non-indicting (`rule_wrong` in §10c, `undone_by_actor` here), so the rate is 0; a 0.5 ' +
        'means `undone_by_actor` indicts — the C3-12 defect the owner ruled against.',
    )
  })

  /* ================================================================ *
   * §14 · THE REVERSAL WINDOW, OVER A SOCKET. G1831, THE OWNER'S RULING.
   * ================================================================ */

  it('14 · `reverseResolution` on a 25-hour-old resolution is REFUSED `reversal_window_expired`', async () => {
    /**
     * 🛑 RESOLVED HERE, BY THE MIGRATOR, IMMEDIATELY BEFORE THE REQUEST —
     *    see `seedSubstrate()`'s comment on `ACME_STALE_RESOLVED` for why
     *    it was not seeded resolved: every section above this one has
     *    already taken its snapshot of the disposition mix (§12), so
     *    resolving it now cannot move a count this file already asserted.
     *    `resolution_at = now() - interval '25 hours'`, evaluated by
     *    POSTGRES at UPDATE time, never by this process's clock — the
     *    ordinary and safe half of the pattern `tools/check-clock-fixtures.mjs`
     *    (G1351) exists to police.
     */
    const mig = await migratorClient()
    try {
      await mig.query(
        `UPDATE tenant.exception
            SET status = 'resolved',
                resolution_mode = 'manual',
                resolution_disposition_key = 'write_off',
                resolution_proposal_id = 'prp_seeded_manual_stale',
                resolution_executed_by = $2,
                resolution_at = now() - interval '25 hours'
          WHERE id = $1`,
        [ACME_STALE_RESOLVED, MEI],
      )
    } finally {
      await mig.end()
    }

    /**
     * END TO END, THROUGH THE REAL ROUTE: `ACME_STALE_RESOLVED` is now
     * resolved 25 hours in the past, so `REVERSAL_WINDOW_HOURS` (24) has
     * closed on it before this request is made. This proves the WIRE, not
     * only the store — `tests/db/reversal-window.test.ts` proves the store
     * and the database policy directly.
     */
    const res = await send(plane.url, 'POST', `/v1/exceptions/${ACME_STALE_RESOLVED}/reversals`, {
      body: { reason: 'data_corrected', newStatus: 'open' },
    })
    assert.equal(
      res.status,
      409,
      `expected 409 \`reversal_window_expired\` for a 25-hour-old resolution. Body: ` +
        res.text.slice(0, 400),
    )
    assert.equal(
      res.body?.['code'],
      'reversal_window_expired',
      `expected the DISTINCT window code, not \`validation_failed\` (both are 409s on this ` +
        `operation and only \`code\` tells them apart). Body: ${res.text.slice(0, 400)}`,
    )
  })

  it('14b · the same exception, and NOTHING WAS WRITTEN — a refused reversal leaves no row', async () => {
    const mig = await migratorClient()
    try {
      const r = await mig.query(
        `SELECT count(*)::int AS n FROM tenant.exception_reversal WHERE exception_id = $1`,
        [ACME_STALE_RESOLVED],
      )
      assert.equal(
        (r.rows[0] as { n: number } | undefined)?.n,
        0,
        'a reversal refused for `reversal_window_expired` wrote a row anyway — the store must ' +
          'return before the `INSERT`, not after it fails.',
      )
    } finally {
      await mig.end()
    }
  })

  /* ================================================================ *
   * §15 · NOT CONFIGURED IS A CALM 409, NEVER A 500 — G3441 (reaudit NC-01).
   *
   * 🛑 WITNESSED RED BEFORE THE REPAIR: with `tenant.approval_config` emptied
   *    for this tenant, `listProposals` answered **500 `upstream_unavailable`**
   *    ("No approval policy is configured for this tenant."), and on an
   *    exception whose definition has no `definition_archetype` row
   *    `listAvailableDispositions` answered **500 `upstream_unavailable`**
   *    ("A stored row carries a value the domain model does not define."). The
   *    finding page drew both as *"Something failed on our side … try again in
   *    a moment"* — a retry that can never help. Both are now the declared
   *    409 `resolution_not_configured`.
   * ================================================================ */

  it('15 · no approval policy is a 409 `resolution_not_configured`, and stays fail-closed', async () => {
    const mig = await migratorClient()
    let saved: Record<string, unknown>[] = []
    try {
      saved = (await mig.query('SELECT * FROM tenant.approval_config WHERE tenant_id = $1', [ACME]))
        .rows as Record<string, unknown>[]
      await mig.query('DELETE FROM tenant.approval_config WHERE tenant_id = $1', [ACME])
      await mig.query(
        `INSERT INTO tenant.exception
           (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
            domain, definition_id, rule_label, severity, severity_rank,
            status, raised_at, explanation_summary, explanation_expected)
         VALUES ($1, 'exc_acme_chain_served_nogate', 'mg_8', 'rul_1', 1, 1,
                 'finance', $2, 'Three-way match', 'high', 1,
                 'open', now(),
                 'the invoice disagrees with the purchase order', 'the purchase order')`,
        [ACME, DEFINITION],
      )

      for (const path of [`/v1/exceptions/${ACME_EXC}/proposals`, `/v1/proposals/${proposalId}`]) {
        const res = await get(plane.url, path)
        assert.equal(res.status, 409,
          `expected 409 \`resolution_not_configured\` at ${path}; a 500 is the pre-G3441 answer a ` +
            `client renders as "try again". Body: ${res.text.slice(0, 300)}`)
        assert.equal(res.body?.['code'], 'resolution_not_configured')
      }
      /* FAIL-CLOSED: proposing is refused too — no default (weakest) gate. */
      const propose = await send(plane.url, 'POST', `/v1/exceptions/exc_acme_chain_served_nogate/proposals`, {
        body: { dispositionKey: 'write_off', rationale: 'no policy is configured', evidence: [{ kind: 'system_record', ref: 'sys_ledger_4471', note: null }] },
      })
      assert.equal(propose.status, 409, `Body: ${propose.text.slice(0, 300)}`)
      assert.equal(propose.body?.['code'], 'resolution_not_configured')
    } finally {
      for (const row of saved) {
        const cols = Object.keys(row)
        await mig.query(
          `INSERT INTO tenant.approval_config (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
          cols.map((c) => row[c]),
        )
      }
      await mig.end()
    }
  })

  it('15b · a definition with no archetype projection is a 409 too, not an unpublishable 500', async () => {
    const mig = await migratorClient()
    const orphan = 'exc_acme_chain_served_noarch'
    try {
      await mig.query(
        `INSERT INTO tenant.exception
           (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
            domain, definition_id, rule_label, severity, severity_rank,
            status, raised_at, explanation_summary, explanation_expected)
         VALUES ($1, $2, 'mg_9', 'rul_1', 1, 1,
                 'finance', 'def_never_configured', 'Three-way match', 'high', 1,
                 'open', now(),
                 'the invoice disagrees with the purchase order', 'the purchase order')`,
        [ACME, orphan],
      )
    } finally {
      await mig.end()
    }
    const res = await get(plane.url, `/v1/exceptions/${orphan}/dispositions`)
    assert.equal(res.status, 409, `Body: ${res.text.slice(0, 300)}`)
    assert.equal(res.body?.['code'], 'resolution_not_configured')
  })

  it('16 · 🛑 G4021 — a LAPSED approver is not named and is published as a FORMER member, not "a colleague"', async () => {
    /* A third approver whose membership EXPIRED after they decided. Seeded as
       rows rather than by revoking DANI: an UPDATE that ends a membership fires
       `0035`'s trigger, which demands a `manage_roles` record (G507) — the
       product's own fence, and not this assertion's subject. */
    const LEE = 'usr_ops_lee_lapsed'
    const mig = await migratorClient()
    try {
      await mig.query(
        `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
         VALUES ($1, 'lee@acme.invalid', 'Lee Lapsed', 'active', $2)`,
        [LEE, DOOR],
      )
      await mig.query(
        `INSERT INTO tenant.membership
           (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, 'mem_lee_lapsed', $2, 'rol_member', 'bootstrap',
                 now() - interval '30 days', now() - interval '1 day', NULL)`,
        [ACME, LEE],
      )
      await mig.query(
        `INSERT INTO tenant.approval_decision
           (tenant_id, id, proposal_id, exception_id, decided_by, decision, reason, requested_at, decided_at)
         SELECT p.tenant_id, 'apd_lee_lapsed', p.id, p.exception_id, $2, 'approved', NULL,
                p.proposed_at, now() - interval '2 days'
           FROM tenant.resolution_proposal p WHERE p.tenant_id = $1 AND p.id = $3`,
        [ACME, LEE, proposalId],
      )
    } finally {
      await mig.end()
    }
    const one = await get(plane.url, `/v1/proposals/${proposalId}`)
    assert.equal(one.status, 200, `Body: ${one.text.slice(0, 300)}`)
    const approvals = ((one.body?.['execution'] as Record<string, unknown>)['approvals'] ?? []) as Record<string, unknown>[]
    const byWho = new Map(approvals.map((a) => [a['decidedBy'], a]))
    const lee = byWho.get(LEE)
    const chen = byWho.get(CHEN)
    assert.ok(lee !== undefined && chen !== undefined, `both approvers should be on the record: ${JSON.stringify(approvals)}`)
    assert.equal(lee['decidedByName'], null, 'a lapsed approver was NAMED — the ruling names live co-members only')
    assert.equal(lee['decidedByFormerMember'], true, 'a lapsed approver was not published as a former member')
    assert.equal(chen['decidedByFormerMember'], false, 'a live approver was published as a former member')
    assert.equal(typeof chen['decidedByName'], 'string', 'a live approver lost their name')
    const proposer = one.body?.['proposedBy'] as Record<string, unknown>
    assert.equal(proposer['formerMember'], false, 'a live proposer was published as a former member')
  })
})

/**
 * THE SIGN-IN READ, AND THE DEADLOCK IT EXISTS TO REMOVE — G340 applied, G343
 * and G344 taken, 19 Sep 2026, over `db/migrations/0013_federated_signin.sql`,
 * `db/signin-scope.ts` and `server/data-plane/signin.ts`.
 *
 * `tests/db/identity-substrate.test.ts` is the shape this file copies and its
 * header is the one to read first: the `max: 1` adversarial pool, the migrator
 * for every write, and §1 as a preserved red. What is NOT copied is the
 * SUBJECT. That file is about the three rows a SESSION resolves into. This one
 * is about the two rows a caller with NO SESSION AT ALL may reach, and about
 * the exact reason it could reach neither until this migration.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 §1 IS THE PRESERVED DEADLOCK AND IT IS THE REASON THIS FILE EXISTS. READ
 *    IT BEFORE THE REST.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G340's premise is a MEASURED deadlock rather than a design preference.
 * `0009`'s policy reads the directory THROUGH the session, so at the sign-in
 * callback `app.session_ref` names no row, the scalar subquery is NULL, `id =
 * NULL` is NULL, and G100's deny-on-NULL refuses everything: **you need a
 * connection to mint a session and a session to read a connection.**
 *
 * §1 runs that arrangement — `withSessionScope()` with a digest no session row
 * carries — and REQUIRES the connection read to return zero rows. It stays in
 * the suite after the repair, because `docs/HANDOFF.md` §5.6's mirror holds: a
 * deletion whose effect is never observed is not a fix, and a deadlock nobody
 * can re-run is a story rather than a premise. If somebody "simplifies"
 * `identity_connection_rls` into something session-independent, §1 goes green
 * in the wrong direction and this file says so.
 *
 * ⚠️ IT IS THE SAME SHAPE AS `identity-substrate.test.ts`'s
 * `deletedPredicate()` HELPER AND NOT THE SAME KIND OF THING. That one
 * preserves a predicate that was DELETED from the serving path. This one
 * preserves a policy that is STILL LIVE and still correct — what changed is
 * that a second, fully-specified way in now sits beside it.
 *
 * ⚠️ EVERY WRITE IS THE MIGRATOR'S — `LOGIN BYPASSRLS` — because 0009 grants
 * the app role `SELECT` on `identity_connection` and 0013 grants it `SELECT`
 * plus `UPDATE (consumed_at)` on `sign_in_attempt` and nothing else. **There
 * is no `INSERT` on the attempt table by design** (0013: *"a write privilege
 * ahead of a writer"*), so a test that seeded an attempt as the app role would
 * be asserting against a grant the product does not have.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, type TenantPool } from '../../db/tenant-scope.ts'
import { withSessionScope } from '../../db/session-scope.ts'
import { withSignInScope } from '../../db/signin-scope.ts'

import { SIGN_IN_ATTEMPT_REFUSALS } from '../../model/domain.ts'
import type { FederatedCallback, IdentityConnectionId, SessionHandleDigest } from '../../model/domain.ts'
import { SUBSTRATE_REFUSALS, readConnectionByBrokerHandle } from '../../server/data-plane/identity.ts'
import { SIGN_IN_REFUSALS, assembleSignIn } from '../../server/data-plane/signin.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it — the named flake
 * `tests/db/tenant-projection.test.ts` documents at length. `db/env.ts`
 * resolves `RECONCILE_DB_NAME` per call and never at import, so this placement
 * is sufficient and is the only one that is.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_SIGNIN_DB_NAME'] ?? runScopedName('reconcile_signin_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

/**
 * TWO POOLS, AND THE SECOND ONE IS THE WHOLE OF §3.
 *
 * ⚠️ THE TWO DOORS BELOW SHARE A `broker_ref` AND DIFFER ONLY IN THEIR ISSUER,
 * WHICH IS G304's COLLISION STATE MADE REAL. A fixture whose references were
 * incidentally distinct would pass §3 whether the policy matched on the pair
 * or on the reference alone — §5.6, a control whose failing case cannot occur.
 */
const POOL_A = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_POOLAAA'
const POOL_B = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_POOLBBB'

/** Acme's customer door in pool A. `owner_kind = 'customer'`. */
const DOOR_ACME = 'idc_acme_entra' as IdentityConnectionId
/**
 * A PARTNER door in pool B carrying THE SAME `broker_ref`. This is the row a
 * `broker_ref`-only policy would hand to a caller who named only
 * `acme-entra`, and `orgFor()` would then answer `partner` about it — G289's
 * five deleted controls, reached with nobody writing a default.
 */
const DOOR_OTHER_POOL = 'idc_northwind_entra' as IdentityConnectionId
/** `cognito_pool` — `PROTOCOL_IS_BROKERED` false, both handle columns NULL. */
const DOOR_POOL = 'idc_acme_pool' as IdentityConnectionId

const SHARED_REF = 'acme-entra'

/**
 * ⚠️ EVERY DIGEST IS A PLACEHOLDER OF THE RIGHT SHAPE — 64 hex characters, an
 * HMAC-SHA256 output — and is not a real one, for
 * `tests/db/session-membership-selection.test.ts`'s stated rule: a fixture
 * carrying a readable handle would be the first place a preimage got written
 * down. `state` is a credential exactly as a session handle is.
 */
const STATE = '70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f' as SessionHandleDigest
const STATE_USED = '81920b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70' as SessionHandleDigest
const STATE_CROSS = '92a31c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f7081' as SessionHandleDigest
const CHALLENGE = 'a3b42d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f708192' as SessionHandleDigest
/** A digest no row carries. §1 and §2c both need one. */
const ORPHAN = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

const probe = await probeDatabase()
const skip = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the federated sign-in test', probe)

function callback(over: Partial<FederatedCallback> = {}): FederatedCallback {
  return {
    handleDigest: STATE,
    connectionId: DOOR_ACME,
    challengeDigest: CHALLENGE,
    ...over,
  }
}

async function seed(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')

    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES
         ($1, 'oidc', 'Acme Entra ID', 'customer', NULL,            'acc_acme', $4, $6, 'active'),
         -- SAME broker_ref, DIFFERENT pool, DIFFERENT organisation. §3.
         ($2, 'oidc', 'Northwind',     'partner',  'prt_northwind', NULL,       $5, $6, 'active'),
         -- Unbrokered: both handle columns NULL, so no sign-in scope can name
         -- it. §2d asserts that rather than asserting a check in a handler.
         ($3, 'cognito_pool', 'Acme fallback pool', 'customer', NULL, 'acc_acme', NULL, NULL, 'active')
       ON CONFLICT DO NOTHING`,
      [DOOR_ACME, DOOR_OTHER_POOL, DOOR_POOL, POOL_A, POOL_B, SHARED_REF],
    )

    await mig.query(
      `INSERT INTO tenant.sign_in_attempt
         (id, handle_digest, connection_id, challenge_digest,
          started_at, expires_at, consumed_at)
       VALUES
         ('sia_live',  $1, $4, $5, now(), now() + interval '5 minutes', NULL),
         -- Already consumed. The replay fixture, and it must be a ROW rather
         -- than a second call in one test: a replay is a fact about a row that
         -- OUTLIVES the request that consumed it.
         ('sia_used',  $2, $4, $5, now(), now() + interval '5 minutes', now()),
         -- Pinned to Acme's door. Section 4b presents it under POOL B's handle,
         -- which resolves to the PARTNER door: G344's arm, and the one
         -- consumeSignInAttempt() structurally cannot have.
         ('sia_cross', $3, $4, $5, now(), now() + interval '5 minutes', NULL)
       ON CONFLICT DO NOTHING`,
      [STATE, STATE_USED, STATE_CROSS, DOOR_ACME, CHALLENGE],
    )

    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

/** Re-arm `sia_live` so sections that consume it do not depend on their order. */
async function unconsume(id: string): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('UPDATE tenant.sign_in_attempt SET consumed_at = NULL WHERE id = $1', [id])
  } finally {
    await mig.end()
  }
}

async function consumedAt(id: string): Promise<Date | null> {
  const mig = await migratorClient()
  try {
    const r = await mig.query('SELECT consumed_at FROM tenant.sign_in_attempt WHERE id = $1', [id])
    const row = r.rows[0] as { consumed_at: Date | null } | undefined
    return row === undefined ? null : row.consumed_at
  } finally {
    await mig.end()
  }
}

describe('the federated sign-in read — the deadlock, the pair, and the two doors', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    /**
     * ⚠️ `max: 1` IS ADVERSARIAL ON PURPOSE, as in
     * `tests/db/tenant-isolation.test.ts`: every scoped transaction is FORCED
     * onto the connection the previous one released, which is the condition
     * under which a session-level `SET` — or a `set_config` whose third
     * argument was `false` — would leak between scopes.
     */
    pool = await createAppPool(1)
  })

  after(async () => {
    await pool.end()
  })

  /* ================================================================ *
   * §1 — THE DEADLOCK, PRESERVED. See the header.
   * ================================================================ */

  it('1. a connection is UNREADABLE inside a session scope that names no session — G340', async () => {
    const rows = await withSessionScope(pool, ORPHAN, async (tx) =>
      (await tx.query('SELECT id FROM tenant.identity_connection')).rows,
    )
    assert.deepEqual(
      rows,
      [],
      'G340\'s premise has stopped holding: `identity_connection_rls` resolves the ' +
        'directory THROUGH `tenant.session`, so a scope naming no session row must see ' +
        'NOTHING. A non-empty result here means that policy was widened, and the second ' +
        'policy this migration adds is then a second way in to a table that no longer ' +
        'needs one.',
    )
  })

  /* ================================================================ *
   * §2 — THE SECOND POLICY. One row, named by the caller, and nothing else.
   * ================================================================ */

  it('2a. the pair admits exactly the row it names, assembled whole', async () => {
    const out = await withSignInScope(
      pool,
      { brokerIssuer: POOL_A, brokerRef: SHARED_REF, stateDigest: STATE },
      (tx) => readConnectionByBrokerHandle(tx),
    )
    assert.equal(out.ok, true, 'the sign-in scope did not reach the door it named')
    if (!out.ok) return
    assert.equal(out.connection.id, DOOR_ACME)
    assert.deepEqual(out.connection.owner, { kind: 'customer', accountId: 'acc_acme' })
    /* G305's coherence rule runs on this path too — see
     * `readConnectionByBrokerHandle()`'s header. A resolver that returned an
     * id would have skipped it on the one path where the handle is the key. */
    assert.deepEqual(out.connection.federation, {
      brokerIssuer: POOL_A,
      brokerRef: SHARED_REF,
    })
  })

  it('2b. the table does not become enumerable — one row, not three', async () => {
    const rows = await withSignInScope(
      pool,
      { brokerIssuer: POOL_A, brokerRef: SHARED_REF, stateDigest: STATE },
      async (tx) => (await tx.query('SELECT id FROM tenant.identity_connection')).rows,
    )
    assert.equal(
      rows.length,
      1,
      'G340\'s bar is "the read is one row, named by the caller; the table does not ' +
        'become enumerable". Three rows exist; a scope that sees more than the one it ' +
        'named has a predicate with a wildcard in it.',
    )
  })

  it('2c. a scope naming NEITHER key sees nothing — G100 is unchanged', async () => {
    const rows = await withSessionScope(pool, ORPHAN, async (tx) =>
      (await tx.query('SELECT id FROM tenant.identity_connection')).rows,
    )
    assert.deepEqual(
      rows,
      [],
      'Both policies are permissive and both compare against an unset GUC, which is ' +
        'NULL. `NULL OR NULL` is NULL and NULL is not TRUE. A row here would mean one ' +
        'of the two disjuncts admits on absence, which is deny-on-NULL inverted.',
    )
  })

  it('2d. an UNBROKERED door cannot be named by any handle — G305, held by the policy', async () => {
    const out = await withSignInScope(
      pool,
      { brokerIssuer: '', brokerRef: '', stateDigest: STATE },
      (tx) => readConnectionByBrokerHandle(tx),
    )
    assert.equal(out.ok, false)
    if (out.ok) return
    assert.equal(
      out.refusal,
      SUBSTRATE_REFUSALS.connectionAbsent,
      'A `cognito_pool` row has NULL in both handle columns, and `nullif(…, \'\')` makes ' +
        'an empty GUC NULL too — so the comparison is NULL, not TRUE. If this ever ' +
        'resolves, the policy is matching NULL against NULL as equal.',
    )
  })

  /* ================================================================ *
   * §3 — G343. THE PAIR, AND WHY THE REFERENCE ALONE IS NOT A HANDLE.
   * ================================================================ */

  it('3. the SAME reference under a DIFFERENT issuer reaches a DIFFERENT organisation', async () => {
    const a = await withSignInScope(
      pool,
      { brokerIssuer: POOL_A, brokerRef: SHARED_REF, stateDigest: STATE },
      (tx) => readConnectionByBrokerHandle(tx),
    )
    const b = await withSignInScope(
      pool,
      { brokerIssuer: POOL_B, brokerRef: SHARED_REF, stateDigest: STATE },
      (tx) => readConnectionByBrokerHandle(tx),
    )

    assert.equal(a.ok, true)
    assert.equal(b.ok, true)
    if (!a.ok || !b.ok) return

    assert.notEqual(
      a.connection.id,
      b.connection.id,
      'Two rows share `broker_ref` and differ only in `broker_issuer`. If one issuer ' +
        'reaches the other issuer\'s row, the policy is keyed on the reference alone — ' +
        'G304\'s collided key in executable form.',
    )
    assert.equal(a.connection.owner.kind, 'customer')
    assert.equal(
      b.connection.owner.kind,
      'partner',
      'This is the price G289 named: the wrong connection is the wrong `owner` is the ' +
        'wrong `orgClass`, and five controls are then evaluated about the wrong ' +
        'organisation with nobody having written a default.',
    )
  })

  /* ================================================================ *
   * §4 — THE CALLBACK. Single use, and the two doors.
   * ================================================================ */

  it('4a. a live attempt is consumed, and the consuming write lands on the row', async () => {
    await unconsume('sia_live')
    assert.equal(await consumedAt('sia_live'), null, 'the fixture was not re-armed')

    const out = await withSignInScope(
      pool,
      { brokerIssuer: POOL_A, brokerRef: SHARED_REF, stateDigest: STATE },
      (tx) => assembleSignIn(tx, callback()),
    )
    assert.equal(out.ok, true, `the callback was refused: ${JSON.stringify(out)}`)
    if (!out.ok) return
    assert.equal(out.connection.id, DOOR_ACME)
    assert.equal(out.attemptId, 'sia_live')
    /* D6-5, G2233 — the issuer a token must carry is READ OFF THE PINNED ROW
     * by the assembly, and it is the row's `broker_issuer` verbatim. Asserted
     * against the row the database returned rather than against the scope's
     * GUC, so a reader that echoed the scope back would still be caught by the
     * `connection.federation` comparison. */
    assert.equal(out.brokerIssuer, POOL_A, 'the assembly did not carry the pinned row`s issuer')
    assert.equal(out.brokerIssuer, out.connection.federation?.brokerIssuer)

    /* 🛑 THE WRITE IS READ BACK OUT OF BAND, AS THE MIGRATOR, AFTER THE
     * TRANSACTION COMMITTED. Asserting it inside the same transaction would
     * assert that the statement ran, not that it COMMITTED — and a consume
     * that rolls back with the request is a replayable attempt. */
    assert.notEqual(
      await consumedAt('sia_live'),
      null,
      'the attempt was reported consumed and `consumed_at` is still NULL — the column ' +
        'grant, the policy `WITH CHECK`, or the COMMIT is not doing what it is read as ' +
        'doing.',
    )
  })

  it('4a-ii. the SAME attempt presented twice is refused as a replay', async () => {
    const out = await withSignInScope(
      pool,
      { brokerIssuer: POOL_A, brokerRef: SHARED_REF, stateDigest: STATE },
      (tx) => assembleSignIn(tx, callback()),
    )
    assert.equal(out.ok, false)
    if (out.ok) return
    assert.equal(out.kind, 'attempt')
    assert.equal(
      out.kind === 'attempt' ? out.refusal : null,
      SIGN_IN_ATTEMPT_REFUSALS.signInAttemptReplayed,
      'G315 names this as where the shape is got wrong: "a replayable `state` … would ' +
        'hand the whole flow away". The row is the enforcement and 4a just set it.',
    )
  })

  it('4b. G344 — the door the handle names must be the door the redirect pinned', async () => {
    const out = await withSignInScope(
      pool,
      /* POOL B's handle resolves to the PARTNER door; the attempt pinned
         Acme's. Every arm of `consumeSignInAttempt()` passes — the callback
         body names the pinned door, the challenge matches, the row is
         unconsumed — which is exactly why this arm has to exist. */
      { brokerIssuer: POOL_B, brokerRef: SHARED_REF, stateDigest: STATE_CROSS },
      (tx) => assembleSignIn(tx, callback({ handleDigest: STATE_CROSS })),
    )
    assert.equal(out.ok, false)
    if (out.ok) return
    assert.equal(
      out.kind === 'signin' ? out.refusal : null,
      SIGN_IN_REFUSALS.signInDoorDisagrees,
      'The broker says the token came through Northwind and the pin says Acme. ' +
        'Resolving either way picks an `orgClass` for the caller, which is the reach ' +
        'invariant 2 exists to close.',
    )
  })

  it('4c. a callback naming a door other than the pinned one is the MODEL\'s refusal', async () => {
    await unconsume('sia_live')
    const out = await withSignInScope(
      pool,
      { brokerIssuer: POOL_A, brokerRef: SHARED_REF, stateDigest: STATE },
      (tx) => assembleSignIn(tx, callback({ connectionId: DOOR_POOL })),
    )
    assert.equal(out.ok, false)
    if (out.ok) return
    assert.equal(
      out.kind === 'attempt' ? out.refusal : null,
      SIGN_IN_ATTEMPT_REFUSALS.signInAttemptConnectionMismatch,
      'This one belongs to `consumeSignInAttempt()` and must NOT be answered by G344\'s ' +
        'arm. Two arms reporting one fact would make the pair indistinguishable in a log.',
    )
    assert.equal(
      await consumedAt('sia_live'),
      null,
      'A callback refused by the model must not burn the attempt — the order in ' +
        '`assembleSignIn()` is decide, then consume, and this asserts the order rather ' +
        'than reading it.',
    )
  })

  it('4d. a wrong challenge is refused and the attempt survives', async () => {
    const out = await withSignInScope(
      pool,
      { brokerIssuer: POOL_A, brokerRef: SHARED_REF, stateDigest: STATE },
      (tx) => assembleSignIn(tx, callback({ challengeDigest: ORPHAN as SessionHandleDigest })),
    )
    assert.equal(out.ok, false)
    if (out.ok) return
    assert.equal(
      out.kind === 'attempt' ? out.refusal : null,
      SIGN_IN_ATTEMPT_REFUSALS.signInAttemptChallengeMismatch,
    )
    assert.equal(await consumedAt('sia_live'), null)
  })

  it('4e. a state digest no row carries is `sign_in_attempt_absent`, not a crash', async () => {
    const out = await withSignInScope(
      pool,
      { brokerIssuer: POOL_A, brokerRef: SHARED_REF, stateDigest: ORPHAN },
      (tx) => assembleSignIn(tx, callback({ handleDigest: ORPHAN as SessionHandleDigest })),
    )
    assert.equal(out.ok, false)
    if (out.ok) return
    assert.equal(out.kind === 'signin' ? out.refusal : null, SIGN_IN_REFUSALS.signInAttemptAbsent)
  })

  /* ================================================================ *
   * §5 — THE NEGATIVE CONTROLS. Two, and neither is optional.
   * ================================================================ */

  it('5a. WITH THE NEW POLICY DROPPED the sign-in read FAILS CLOSED', async () => {
    const mig = await migratorClient()
    try {
      await mig.query('DROP POLICY identity_connection_signin_rls ON tenant.identity_connection')
      const out = await withSignInScope(
        pool,
        { brokerIssuer: POOL_A, brokerRef: SHARED_REF, stateDigest: STATE },
        (tx) => readConnectionByBrokerHandle(tx),
      )
      assert.equal(
        out.ok,
        false,
        'Without the second policy the sign-in scope must reach NOTHING — which is the ' +
          'deadlock §1 preserves, arriving from the other side. A row here would mean ' +
          'the read was never protected by the policy this file credits.',
      )
      if (out.ok) return
      assert.equal(out.refusal, SUBSTRATE_REFUSALS.connectionAbsent)
    } finally {
      await mig.query(
        `CREATE POLICY identity_connection_signin_rls ON tenant.identity_connection
           USING (
             broker_issuer = nullif(current_setting('app.broker_issuer', true), '')
             AND broker_ref = nullif(current_setting('app.broker_ref', true), '')
           )`,
      )
      await mig.end()
    }
  })

  it('5b. the app role may NOT write anything on an attempt but `consumed_at`', async () => {
    /**
     * 🛑 THE COLUMN-LEVEL GRANT IS THE FENCE AGAINST RE-POINTING A PINNED
     * DOOR FROM INSIDE THE CALLBACK, and a grant nobody witnesses refusing is
     * a grant somebody widens. This is `GRANT UPDATE (consumed_at)` observed
     * rather than read off the migration.
     */
    await assert.rejects(
      () =>
        withSignInScope(
          pool,
          { brokerIssuer: POOL_A, brokerRef: SHARED_REF, stateDigest: STATE },
          (tx) => tx.query('UPDATE tenant.sign_in_attempt SET connection_id = $1', [DOOR_POOL]),
        ),
      (err: unknown) => {
        const code = (err as { code?: string }).code
        assert.equal(
          code,
          '42501',
          `expected a privilege refusal (42501) and got ${String(code)}: ${String(err)}`,
        )
        return true
      },
    )
  })

  it('5c. an attempt is invisible to a scope naming a different state digest', async () => {
    const rows = await withSignInScope(
      pool,
      { brokerIssuer: POOL_A, brokerRef: SHARED_REF, stateDigest: STATE_USED },
      async (tx) => (await tx.query('SELECT id FROM tenant.sign_in_attempt')).rows,
    )
    assert.deepEqual(
      rows.map((r) => (r as { id: string }).id),
      ['sia_used'],
      'Three attempts exist. A scope must reach the one whose digest it named and no ' +
        'other — otherwise a caller holding any `state` can enumerate every sign-in in ' +
        'flight, which is a list of who is signing in right now.',
    )
  })
})

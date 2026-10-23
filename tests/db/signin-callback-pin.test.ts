/**
 * `0280` AND `withSignInPinScope()` — G2235 APPLIED, 1 Oct 2026, G2481–G2484.
 *
 * The callback's FIRST transaction reads the door the redirect PINNED, keyed
 * on the digest of `state` and nothing else, so the broker pair the mint is
 * later scoped by is read off a row rather than out of a request. Every arm of
 * the recursion measurement `0280`'s header quotes is kept RUNNABLE here.
 *
 *   §1   the pin scope sees exactly the pinned door
 *   §1b  a wrong digest sees nothing
 *   §1c  the pin GUC ALONE sees nothing — the attempt is read through its own
 *        policy, so `app.signin_ref` is half of the key
 *   §1d  an EXPIRED attempt pins no door — D6-6 governs this read too
 *   §2   G344 is intact: the MINT scope (`withSignInScope()`) does not admit
 *        the pinned row beside the row its pair names
 *   §3   the policy is `FOR SELECT`, PERMISSIVE, and keyed on its own GUC
 *   §4   the pin transaction is READ ONLY — a write is refused by the mode
 *   §5   `readPinnedSignIn()`: the pair, the issuer, the endpoint and the claim
 *        names come off the row; replay and a re-pointed callback refuse
 *        before anything is returned
 *   §6   no recursion on the paths every request takes
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, type TenantPool } from '../../db/tenant-scope.ts'
import { withSessionScope } from '../../db/session-scope.ts'
import { withSignInPinScope, withSignInScope } from '../../db/signin-scope.ts'
import type { IdentityConnectionId, SessionHandleDigest } from '../../model/domain.ts'
import { SIGN_IN_REFUSALS, readPinnedSignIn } from '../../server/data-plane/signin.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_SIGNIN_PIN_DB_NAME'] ?? runScopedName('reconcile_signin_pin_test')

const ISS_A = 'https://idp.example/pool-a'
const ISS_B = 'https://idp.example/pool-b'
const DOOR_A = 'idc_pin_a' as IdentityConnectionId
const DOOR_B = 'idc_pin_b' as IdentityConnectionId
const LIVE = 'pin-live-digest' as SessionHandleDigest
const STALE = 'pin-stale-digest' as SessionHandleDigest
const USED = 'pin-used-digest' as SessionHandleDigest

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the sign-in pin-scope suite', probe)

async function asMigrator(sql: string, params: unknown[] = []): Promise<Array<Record<string, unknown>>> {
  const mig = await migratorClient()
  try {
    return (await mig.query(sql, params)).rows as Array<Record<string, unknown>>
  } finally {
    await mig.end()
  }
}

describe('0280 — the callback reads its door off the pinned attempt', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants('ten_acme', 'ten_globex')
    await asMigrator(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status, email_claim, name_claim, token_endpoint)
       VALUES ($1,'oidc','A','customer',NULL,'acc_acme',$2,'ref-a','active','email','name','https://idp.example/a/token'),
              ($3,'oidc','B','customer',NULL,'acc_acme',$4,'ref-b','active','email','name',NULL)`,
      [DOOR_A, ISS_A, DOOR_B, ISS_B],
    )
    await asMigrator(
      `INSERT INTO tenant.sign_in_attempt
         (id, handle_digest, connection_id, challenge_digest, started_at, expires_at, consumed_at)
       VALUES ('sia_pin_live', $1, $4, 'ch', now(), now() + interval '5 minutes', NULL),
              ('sia_pin_stale', $2, $4, 'ch', now() - interval '11 minutes', now() + interval '1 hour', NULL),
              ('sia_pin_used', $3, $4, 'ch', now(), now() + interval '5 minutes', now())`,
      [LIVE, STALE, USED, DOOR_A],
    )
    await asMigrator(
      `INSERT INTO tenant."user" (id,email,display_name,status,connection_id)
       VALUES ('usr_pin_m','m@a','M','active',$1)`,
      [DOOR_A],
    )
    await asMigrator(
      `INSERT INTO tenant.session
         (id,handle_digest,user_id,connection_id,tenant_id,issued_host,authenticated_at,last_used_at,expires_at,revoked_at)
       VALUES ('ses_pin','pin-session',
               'usr_pin_m',$1,NULL,'h',now(),now(),now()+interval '1 hour',NULL)`,
      [DOOR_A],
    )
    pool = await createAppPool(2)
  })

  after(async () => {
    await pool?.end()
  })

  const doors = (digest: string): Promise<string[]> =>
    withSignInPinScope(pool, { stateDigest: digest }, async (tx) =>
      ((await tx.query('SELECT id FROM tenant.identity_connection')).rows as Array<{ id: string }>).map((r) => r.id),
    )

  it('§1 · the pin scope sees EXACTLY the pinned door', async () => {
    assert.deepEqual(await doors(LIVE), [DOOR_A])
  })

  it('§1b · a wrong digest sees no door at all', async () => {
    assert.deepEqual(await doors('nobody-minted-this'), [])
  })

  it('§1c · the pin GUC ALONE sees nothing — the attempt is read through its own policy', async () => {
    const c = await pool.connect()
    try {
      await c.query('BEGIN READ ONLY')
      await c.query("SELECT set_config('app.signin_pin_ref', $1, true)", [LIVE])
      const rows = (await c.query('SELECT id FROM tenant.identity_connection')).rows
      await c.query('COMMIT')
      assert.deepEqual(rows, [], 'the pin policy admitted a door without the attempt being visible')
    } finally {
      c.release()
    }
  })

  it('§1d · an EXPIRED attempt pins no door — D6-6 governs this read without being restated', async () => {
    assert.deepEqual(await doors(STALE), [])
  })

  it('§2 · G344 INTACT — the mint scope does not admit the pinned row beside the pair’s row', async () => {
    const seen = await withSignInScope(
      pool,
      { brokerIssuer: ISS_B, brokerRef: 'ref-b', stateDigest: LIVE },
      async (tx) => (await tx.query('SELECT id FROM tenant.identity_connection')).rows as Array<{ id: string }>,
    )
    assert.deepEqual(
      seen.map((r) => r.id),
      [DOOR_B],
      'the MINT scope now sees the pinned door as well as the pair’s, so `readConnectionByBrokerHandle()` ' +
        'would answer `connection_absent` where G344 answers `sign_in_door_disagrees`. `0280` keys on ' +
        '`app.signin_pin_ref` precisely so this cannot happen.',
    )
  })

  it('§3 · the policy is FOR SELECT, PERMISSIVE, and keyed on its own GUC', async () => {
    const rows = await asMigrator(
      `SELECT permissive, cmd, qual FROM pg_policies
        WHERE schemaname='tenant' AND tablename='identity_connection'
          AND policyname='identity_connection_pin_rls'`,
    )
    assert.equal(rows.length, 1, 'the pin policy is gone')
    assert.equal(rows[0]?.['permissive'], 'PERMISSIVE')
    assert.equal(rows[0]?.['cmd'], 'SELECT', 'G1982: a policy with no FOR is FOR ALL, and reuses USING as the INSERT check')
    assert.match(String(rows[0]?.['qual']), /app\.signin_pin_ref/)
    const cols = await asMigrator(
      `SELECT is_nullable FROM information_schema.columns
        WHERE table_schema='tenant' AND table_name='identity_connection' AND column_name='token_endpoint'`,
    )
    assert.equal(cols[0]?.['is_nullable'], 'YES', 'NULL is a refusal (`token_endpoint_not_declared`), never a default')
  })

  it('§4 · the pin transaction is READ ONLY — a write is refused by the MODE', async () => {
    await assert.rejects(
      withSignInPinScope(pool, { stateDigest: LIVE }, (tx) =>
        tx.query('UPDATE tenant.sign_in_attempt SET consumed_at = now()'),
      ),
      /read-only transaction/,
      'the pin scope could WRITE — it could consume an attempt outside the mint transaction',
    )
  })

  it('§5 · readPinnedSignIn() returns the pair, the issuer, the endpoint and the claim names OFF THE ROW', async () => {
    const out = await withSignInPinScope(pool, { stateDigest: LIVE }, (tx) =>
      readPinnedSignIn(tx, { handleDigest: LIVE, connectionId: DOOR_A }),
    )
    assert.equal(out.ok, true, JSON.stringify(out))
    if (!out.ok) return
    assert.equal(out.connection.id, DOOR_A)
    assert.equal(out.brokerIssuer, ISS_A)
    assert.equal(out.brokerRef, 'ref-a')
    assert.equal(out.tokenEndpoint, 'https://idp.example/a/token')
    assert.deepEqual([...out.claimNames], ['email', 'name'])
  })

  it('§5b · a REPLAYED attempt and a RE-POINTED callback refuse before anything is returned', async () => {
    const replay = await withSignInPinScope(pool, { stateDigest: USED }, (tx) =>
      readPinnedSignIn(tx, { handleDigest: USED, connectionId: DOOR_A }),
    )
    assert.deepEqual(replay, { ok: false, kind: 'attempt', refusal: 'sign_in_attempt_replayed' })
    const repointed = await withSignInPinScope(pool, { stateDigest: LIVE }, (tx) =>
      readPinnedSignIn(tx, { handleDigest: LIVE, connectionId: DOOR_B }),
    )
    assert.deepEqual(repointed, { ok: false, kind: 'attempt', refusal: 'sign_in_attempt_connection_mismatch' })
    const absent = await withSignInPinScope(pool, { stateDigest: STALE }, (tx) =>
      readPinnedSignIn(tx, { handleDigest: STALE, connectionId: DOOR_A }),
    )
    assert.deepEqual(absent, { ok: false, kind: 'signin', refusal: SIGN_IN_REFUSALS.signInAttemptAbsent })
  })

  it('§6 · NO RECURSION on the paths every request takes, with `0280` applied', async () => {
    const people = await withSessionScope(pool, 'pin-session', async (tx) =>
      (await tx.query('SELECT id FROM tenant."user"')).rows,
    )
    assert.equal(people.length, 1, 'the session-scope person read changed under `0280`')
    const conns = await withSessionScope(pool, 'pin-session', async (tx) =>
      (await tx.query('SELECT id FROM tenant.identity_connection')).rows,
    )
    assert.equal(conns.length, 1)
    const signinPeople = await withSignInScope(
      pool,
      { brokerIssuer: ISS_A, brokerRef: 'ref-a', stateDigest: LIVE, externalSubject: 'nobody' },
      async (tx) => (await tx.query('SELECT id FROM tenant."user"')).rows,
    )
    assert.equal(signinPeople.length, 0)
  })
})

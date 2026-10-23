/**
 * `db/migrations/0290_sign_in_begin.sql`, WITNESSED AGAINST A LIVE PostgreSQL
 * — the owner's ruling of 1 Oct 2026 (G2541): *"INSERT-only grant on
 * sign_in_attempt with a restrictive WITH CHECK, attempt TTL per D6-6."*
 *
 *   §1   the policy's interval IS `SIGN_IN_ATTEMPT_TTL_MINUTES` — read back
 *        out of `pg_policies`, `0240` §1d's control one file over.
 *   §2   the POSITIVE control: a well-formed attempt, inside
 *        `withSignInBeginScope()`, as the APP role, is written.
 *   §3   each conjunct REFUSES, one at a time, with the other four satisfied:
 *        a digest the scope did not name, a back-dated start, an expiry past
 *        the TTL, a door no verified claim on the scope's domain reaches, and
 *        a door claimed but UNVERIFIED.
 *   §4   the column grant refuses `consumed_at` with `42501`, and there is no
 *        `DELETE`.
 *   §5   A HAZARD `0290` §2's FIRST DRAFT CLAIMED AND A MEASUREMENT REFUTED:
 *        the same fence over `tenant.identity_connection` does NOT recurse
 *        through `0280`'s pin policy. Kept runnable, so the correction holds.
 *   §6   THE POLICY IS THE CONTROL — dropped, the forged-door row of §3d is
 *        written. Restored in `finally`.
 *
 * ⚠️ EVERY WRITE BUT THE ONES UNDER TEST IS THE MIGRATOR'S, `LOGIN BYPASSRLS`.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, type TenantPool } from '../../db/tenant-scope.ts'
import { withSignInBeginScope } from '../../db/signin-scope.ts'
import { SIGN_IN_ATTEMPT_TTL_MINUTES } from '../../server/data-plane/signin.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_SIGNIN_BEGIN_FENCE_DB_NAME'] ?? runScopedName('reconcile_signin_begin_fence_test')

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the sign-in begin fence suite', probe)

const DOMAIN = 'acme.example'
const DOOR = 'idc_begin_acme'
const UNVERIFIED_DOOR = 'idc_begin_unverified'
const FOREIGN_DOOR = 'idc_begin_foreign'
/** `0360` — the registry-resolved host the begin scope names (G2549). */
const SCOPE_HOST = 'acme.us-west-2.reconcile.invalid'

async function mig<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = await migratorClient()
  try {
    return (await c.query(sql, params)).rows as T[]
  } finally {
    await c.end()
  }
}

let seq = 0
function nextId(): string {
  seq += 1
  return `sia_begin_${seq}`
}

/**
 * Insert as the APP role inside the begin scope. `started` and `expires` are
 * SQL EXPRESSIONS, never bound values: `now()` carries microseconds and a
 * JavaScript `Date` carries milliseconds, so a round-tripped "now" is not
 * `now()` and §2's positive control would be refused by `started_at = now()`.
 */
async function write(
  pool: TenantPool,
  opts: {
    scopeDigest: string
    rowDigest?: string
    door?: string
    started?: string
    expires?: string
    /** `0360`: the row's `begun_host`. Defaults to the scope's; `null` writes the column NULL. */
    rowHost?: string | null
  },
): Promise<string> {
  const id = nextId()
  await withSignInBeginScope(
    pool,
    { claimedDomain: DOMAIN, stateDigest: opts.scopeDigest, begunHost: SCOPE_HOST },
    (tx) =>
      tx.query(
        `INSERT INTO tenant.sign_in_attempt
           (id, handle_digest, connection_id, challenge_digest, started_at, expires_at, begun_host)
         VALUES ($1, $2, $3, 'challenge-digest',
                 ${opts.started ?? 'now()'}, ${opts.expires ?? "now() + interval '10 minutes'"}, $4)`,
        [
          id,
          opts.rowDigest ?? opts.scopeDigest,
          opts.door ?? DOOR,
          opts.rowHost === undefined ? SCOPE_HOST : opts.rowHost,
        ],
      ),
  )
  return id
}

function isRlsRefusal(err: unknown): boolean {
  const message = String((err as { message?: string }).message ?? err)
  assert.match(
    message,
    /violates row-level security policy/,
    `expected the RESTRICTIVE policy to refuse, and got: ${message}`,
  )
  return true
}

describe('0290 — the sign-in begin fence', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants('ten_acme', 'ten_globex')
    await mig(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1,'oidc','Acme','customer',NULL,'acc_acme','https://idp.acme.invalid/pool','acme-ref','active'),
              ($2,'oidc','Half','customer',NULL,'acc_acme','https://idp.half.invalid/pool','half-ref','active'),
              ($3,'oidc','Other','customer',NULL,'acc_globex','https://idp.other.invalid/pool','other-ref','active')`,
      [DOOR, UNVERIFIED_DOOR, FOREIGN_DOOR],
    )
    await mig(
      `INSERT INTO tenant.domain_claim (connection_id, domain, verified_at)
       VALUES ($1, $4, now()), ($2, $4, NULL), ($3, 'globex.example', now())`,
      [DOOR, UNVERIFIED_DOOR, FOREIGN_DOOR, DOMAIN],
    )
    pool = await createAppPool(2)
  })

  after(async () => {
    await pool?.end()
  })

  it('§1 · the fence’s interval IS `SIGN_IN_ATTEMPT_TTL_MINUTES`', async () => {
    const rows = await mig<{ permissive: string; cmd: string; with_check: string }>(
      `SELECT permissive, cmd, with_check FROM pg_policies
        WHERE tablename = 'sign_in_attempt' AND policyname = 'sign_in_attempt_begin_restrictive'`,
    )
    assert.equal(rows.length, 1, 'the begin fence is not installed')
    assert.equal(rows[0]?.permissive, 'RESTRICTIVE', 'a PERMISSIVE fence is widened by the next permissive policy')
    assert.equal(rows[0]?.cmd, 'INSERT')
    assert.match(
      rows[0]?.with_check ?? '',
      new RegExp(`'00:${String(SIGN_IN_ATTEMPT_TTL_MINUTES).padStart(2, '0')}:00'::interval`),
      'the policy’s TTL and `SIGN_IN_ATTEMPT_TTL_MINUTES` disagree — two homes for one number',
    )
  })

  it('§2 · POSITIVE CONTROL: a fresh attempt on a routed door is written by the app role', async () => {
    const id = await write(pool, { scopeDigest: 'digest-positive' })
    const rows = await mig<{ consumed_at: Date | null; connection_id: string }>(
      'SELECT consumed_at, connection_id FROM tenant.sign_in_attempt WHERE id = $1',
      [id],
    )
    assert.equal(rows.length, 1, 'the well-formed attempt was not written — every refusal below would be vacuous')
    assert.equal(rows[0]?.consumed_at, null)
    assert.equal(rows[0]?.connection_id, DOOR)
  })

  it('§3a · a row whose digest the SCOPE did not name is refused', async () => {
    await assert.rejects(() => write(pool, { scopeDigest: 'digest-a', rowDigest: 'digest-other' }), isRlsRefusal)
  })

  it('§3b · a BACK-DATED start is refused', async () => {
    await assert.rejects(
      () =>
        write(pool, {
          scopeDigest: 'digest-b',
          started: "now() - interval '1 minute'",
        }),
      isRlsRefusal,
    )
  })

  it('§3c · an expiry PAST the TTL is refused (D6-6 at the door, not only at the read)', async () => {
    await assert.rejects(
      () =>
        write(pool, {
          scopeDigest: 'digest-c',
          expires: "now() + interval '1 hour'",
        }),
      isRlsRefusal,
    )
  })

  it('§3d · a door no claim on the scope’s domain reaches is refused', async () => {
    await assert.rejects(() => write(pool, { scopeDigest: 'digest-d', door: FOREIGN_DOOR }), isRlsRefusal)
  })

  it('§3e · a door whose claim is UNVERIFIED is refused', async () => {
    await assert.rejects(() => write(pool, { scopeDigest: 'digest-e', door: UNVERIFIED_DOOR }), isRlsRefusal)
  })

  it('§4 · the app role may not write `consumed_at`, and may not DELETE', async () => {
    await assert.rejects(
      () =>
        withSignInBeginScope(pool, { claimedDomain: DOMAIN, stateDigest: 'digest-f', begunHost: SCOPE_HOST }, (tx) =>
          tx.query(
            `INSERT INTO tenant.sign_in_attempt
               (id, handle_digest, connection_id, challenge_digest, started_at, expires_at, consumed_at)
             VALUES ('sia_begin_consumed', 'digest-f', $1, 'c', now(), now() + interval '5 minutes', now())`,
            [DOOR],
          ),
        ),
      (err: unknown) => {
        assert.equal((err as { code?: string }).code, '42501', String(err))
        return true
      },
    )
    await assert.rejects(
      () =>
        withSignInBeginScope(pool, { claimedDomain: DOMAIN, stateDigest: 'digest-positive', begunHost: SCOPE_HOST }, (tx) =>
          tx.query('DELETE FROM tenant.sign_in_attempt'),
        ),
      (err: unknown) => {
        assert.equal((err as { code?: string }).code, '42501', String(err))
        return true
      },
    )
  })

  it('§5 · MEASURED, NOT FEARED: the same fence over `identity_connection` does NOT recurse', async () => {
    /* 0290 §2's first draft claimed this would be refused with `infinite
     * recursion detected` through 0280's pin policy. It is not — measured
     * here, and kept runnable so the header's correction stays true. The
     * reason the fence reads `domain_claim` is the VERIFICATION bit (§3e). */
    await mig(
      `CREATE POLICY probe_begin_cyclic ON tenant.sign_in_attempt
         AS RESTRICTIVE FOR INSERT
         WITH CHECK (EXISTS (SELECT 1 FROM tenant.identity_connection i
                              WHERE i.id = sign_in_attempt.connection_id))`,
    )
    try {
      const id = await write(pool, { scopeDigest: 'digest-g' })
      const rows = await mig('SELECT 1 FROM tenant.sign_in_attempt WHERE id = $1', [id])
      assert.equal(rows.length, 1)
    } finally {
      await mig('DROP POLICY probe_begin_cyclic ON tenant.sign_in_attempt')
    }
  })

  it('§6 · THE POLICY IS THE CONTROL: dropped, the forged-door row of §3d is written', async () => {
    const definition = await mig<{ with_check: string }>(
      `SELECT with_check FROM pg_policies WHERE policyname = 'sign_in_attempt_begin_restrictive'`,
    )
    const check = definition[0]?.with_check
    assert.ok(check, 'no fence to drop')
    await mig('DROP POLICY sign_in_attempt_begin_restrictive ON tenant.sign_in_attempt')
    try {
      const id = await write(pool, { scopeDigest: 'digest-h', door: FOREIGN_DOOR })
      const rows = await mig('SELECT 1 FROM tenant.sign_in_attempt WHERE id = $1', [id])
      assert.equal(rows.length, 1, 'with the fence dropped the forged door is still refused — §3d proves nothing')
    } finally {
      await mig(
        `CREATE POLICY sign_in_attempt_begin_restrictive ON tenant.sign_in_attempt
           AS RESTRICTIVE FOR INSERT WITH CHECK (${check})`,
      )
    }
  })

  it('§7 · `0360` (G2549): the row is pinned to the scope\'s host — NULL and a foreign host are both refused', async () => {
    /* Positive control first: §2 already writes with `rowHost` defaulted to
     * the scope's host, so a pass here is not vacuous. */
    const ok = await write(pool, { scopeDigest: 'digest-host-ok' })
    const rows = await mig<{ begun_host: string }>(
      'SELECT begun_host FROM tenant.sign_in_attempt WHERE id = $1',
      [ok],
    )
    assert.equal(rows[0]?.begun_host, SCOPE_HOST)
    await assert.rejects(() => write(pool, { scopeDigest: 'digest-host-null', rowHost: null }), isRlsRefusal)
    await assert.rejects(
      () => write(pool, { scopeDigest: 'digest-host-foreign', rowHost: 'evil.example' }),
      isRlsRefusal,
    )
  })

  it('§7b · `0360` is the control: dropped, the foreign-host row of §7 is written', async () => {
    await mig('DROP POLICY sign_in_attempt_begun_host_restrictive ON tenant.sign_in_attempt')
    try {
      const id = await write(pool, { scopeDigest: 'digest-host-foreign-2', rowHost: 'evil.example' })
      const rows = await mig('SELECT 1 FROM tenant.sign_in_attempt WHERE id = $1', [id])
      assert.equal(rows.length, 1, 'with 0360 dropped the foreign host is still refused — §7 proves nothing')
    } finally {
      await mig(
        `CREATE POLICY sign_in_attempt_begun_host_restrictive ON tenant.sign_in_attempt
           AS RESTRICTIVE FOR INSERT
           WITH CHECK (begun_host IS NOT NULL
                       AND begun_host = nullif(current_setting('app.begun_host', true), ''))`,
      )
    }
  })
})

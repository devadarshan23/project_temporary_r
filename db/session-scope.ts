/**
 * `withSessionScope()` — THE SECOND OF EXACTLY TWO NAMED SCOPED HELPERS, AND
 * THE ONLY ONE A SESSION READ MAY RUN INSIDE.
 *
 * `db/tenant-scope.ts` is the shape this file copies and its header is the one
 * to read first: the three ways connection state leaks (a session-level `SET`,
 * a `SET LOCAL` with no explicit transaction, transaction-mode pooling), and
 * the single arrangement that answers all three. Nothing about that argument
 * changes here. ONE THING DOES — the GUC, and the column the policy keys on.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHY THE SESSION READ CANNOT RUN INSIDE `withTenantScope()`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `Session.tenantId` is NULL between authentication and selection — the field
 * is required-and-nullable, and `model/domain.ts` calls the absence of
 * `TenantScoped` on that interface "the one structural fact the whole surface
 * turns on". `model/identity.ts` asserts the negative
 * (`_SessionIsNotTenantScoped`) so that `extends TenantScoped` is a compile
 * error rather than a code review.
 *
 * The predicate every other scoped table uses is
 *
 *     tenant_id = nullif(current_setting('app.tenant_id', true), '')
 *
 * and against a NULL column that comparison evaluates to NULL, which is not
 * TRUE. G100's polarity then denies UNCONDITIONALLY: the row would be
 * invisible to the very connection that just wrote it. Liveness could not be
 * checked before tenant selection, and nothing could ever select one.
 *
 * So the session read needs its OWN named helper, and the invariant becomes
 * *every query runs inside one of exactly two named scoped helpers* — S-1's
 * recommendation, with the cost it records: the negative control now has two
 * members and somebody will propose a third. The reason to refuse a third is
 * the reason there are two: each exists because a table cannot be protected by
 * the other's predicate, not because a caller found it convenient.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THE POLICY KEYS ON — G160, AND THE ALTERNATIVE IT REFUSED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The session policy keys on the HANDLE DIGEST, carried in `app.session_ref`.
 * The rejected option was the row ID in `app.session_id`, resolved by a
 * `SECURITY DEFINER` function `session_id_for_token()` — refused because such
 * a function "becomes the most security-relevant object in the schema", a
 * standing widening that outlives whatever request motivated it, and it would
 * need its own two-row negative test on top.
 *
 * ⚠️ THE COST G160 ACCEPTS IS NOT WAVED AWAY HERE: the digest must be computed
 * and carried on EVERY request. This function is where it is carried; computing
 * it is the request plane's, and this module deliberately does not compute it.
 *
 * ⚠️ AND THE VALUE IS A CREDENTIAL'S SHADOW, WHICH IS WHY THE BIND BELOW IS NOT
 * NEGOTIABLE. `SessionHandleDigest` exists because "a database dump containing
 * handles would be a session-hijack kit"; the digest is not the handle, but it
 * IS the lookup key, and a value interpolated into a statement string is a
 * value that reaches the parser.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It does not set `app.tenant_id`, and it must never be "helpfully" extended to
 * set both from one call. A session read that opened a tenant scope would hand
 * every caller of the cheaper helper a tenant scope derived from a row it had
 * not yet validated — invariant 1 relocated rather than held.
 * `tests/db/session-isolation.test.ts` asserts the absence against the
 * statement text that reached the server.
 *
 * It exports no pool constructor. `createAppPool()` in `db/tenant-scope.ts` is
 * the one pool, connecting as `reconcile_app` — NEITHER `BYPASSRLS` nor owner
 * of any table — and a second constructor here would be a second place for that
 * property to be got wrong. It also, and for the same reason, adds nothing to
 * `TenantPool`: that type has no `query` method so that `pool.query(...)`, one
 * autocommitted statement on a checked-out connection, is a COMPILE ERROR at
 * every call site rather than a code-review catch.
 */

import type { ScopedClient, TenantPool } from './tenant-scope.ts'

/**
 * Run `fn` inside an explicit transaction whose SESSION scope is set and cannot
 * outlive it.
 *
 * `handleDigest` is the digest of the presented `X-Session` value, computed by
 * the request plane. This function cannot check that it was computed rather
 * than echoed — it is the last link in the chain, not the first. What it does
 * guarantee is that whatever value it is given is the only session whose row
 * the enclosed queries can see, and that the value returns to the pool with the
 * connection carrying nothing.
 *
 * ⚠️ THE ENCLOSED QUERIES SEE NO TENANT SCOPE. `app.tenant_id` is unset inside
 * this transaction, so every tenant-scoped table reads as EMPTY here — G100's
 * deny-on-NULL, working. That is the intended blast radius: a session lookup
 * reaches the session row and nothing else, even if a handler asks for more.
 */
export async function withSessionScope<T>(
  pool: TenantPool,
  handleDigest: string,
  fn: (tx: ScopedClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    /**
     * ⚠️ `SET LOCAL app.session_ref = $1` DOES NOT WORK AND FAILS IN THE WORST
     * WAY — the identical trap `db/tenant-scope.ts` documents one predicate
     * over, and `db/provision.ts` documents again for `ALTER ROLE`.
     *
     * `SET` is utility syntax, not DML: it takes no bind parameters. The
     * obvious repair — interpolating the digest into the statement string — is
     * a SQL injection on the lookup key of a credential, reached on every
     * authenticated request, on the one surface that is unauthenticated until
     * this very statement resolves.
     *
     * `set_config(name, value, is_local)` is an ordinary function call, so the
     * value binds as $1 and is never parsed as SQL. The third argument `true`
     * is what makes it LOCAL: reverted at COMMIT or ROLLBACK, so the connection
     * returns to the pool carrying nothing. `SET LOCAL` inside an explicit
     * transaction is correct under BOTH pooling modes — G101, and it is the
     * only posture a later deployment decision cannot invalidate.
     */
    await client.query('SELECT set_config($1, $2, true)', ['app.session_ref', handleDigest])

    const out = await fn(client)
    await client.query('COMMIT')
    return out
  } catch (err) {
    // Best-effort: if the connection is already broken the ROLLBACK will throw
    // too, and the ORIGINAL error is the one worth propagating.
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    client.release()
  }
}

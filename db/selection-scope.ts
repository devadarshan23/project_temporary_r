/**
 * `withSelectionScope()` — THE THIRD NAMED SCOPED HELPER, AND `db/session-scope.ts`
 * PREDICTED IT AND TOLD YOU TO REFUSE IT. READ THIS WHOLE HEADER BEFORE USING IT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE STANDING OBJECTION, QUOTED IN FULL RATHER THAN PARAPHRASED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `db/session-scope.ts` says, of the set this file joins: *"the negative
 * control now has two members and somebody will propose a third. The reason to
 * refuse a third is the reason there are two: each exists because a table
 * cannot be protected by the other's predicate, not because a caller found it
 * convenient."* That is the bar, and this file is written to be measured
 * against it rather than to slip past it.
 *
 * **IT MEETS THE BAR, AND THE EVIDENCE IS A MEASUREMENT RATHER THAN AN
 * ARGUMENT.** The act this helper exists for — binding a tenant to a session —
 * cannot be performed inside EITHER existing helper, and both failures were
 * witnessed against a live PostgreSQL before this file was written:
 *
 *   INSIDE `withTenantScope()`  the session row is INVISIBLE. `tenant_id` is
 *     NULL between authentication and selection, `tenant_id = nullif(…)` is
 *     NULL against a NULL column, and G100's polarity denies unconditionally.
 *     `tests/db/session-isolation.test.ts` has witnessed this since #228 —
 *     *"the tenant-scoped helper cannot see a session row at all"*.
 *
 *   INSIDE `withSessionScope()`  the write is REFUSED, and this is the new
 *     finding. `0005_session_and_membership.sql` puts an `AS RESTRICTIVE`
 *     `WITH CHECK` on `tenant.session` whose disjunct is an `EXISTS` over
 *     `tenant.membership` — and **PostgreSQL applies row-level security to a
 *     table referenced inside a policy expression, as the querying role.**
 *     With only `app.session_ref` set, `membership_rls` denies on NULL, the
 *     `EXISTS` is empty, and a LEGITIMATE selection fails with
 *
 *         new row violates row-level security policy
 *         "session_selection_restrictive" for table "session"
 *
 * So there is no arrangement of the existing two under which the customer arm
 * G199 ships can perform its own write. Shipping the restrictive policy with
 * no helper that can satisfy it would be a control whose PERMITTED path is
 * unreachable — the shape #157 names: *"an unbuilt feature wearing an
 * invariant's badge."* One of those is already declared in this slice, for
 * staff, deliberately. A second, undeclared, for customers, is not acceptable.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS IS NOT THE COMBINED HELPER `db/session-scope.ts` FORBIDS, AND THE
 *    DISTINCTION IS THE ONLY THING KEEPING IT HONEST.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * That file's refusal reads: *"It does not set `app.tenant_id`, and it must
 * never be 'helpfully' extended to set both from one call. A session read that
 * opened a tenant scope would hand every caller of the cheaper helper a tenant
 * scope derived FROM A ROW IT HAD NOT YET VALIDATED — invariant 1 relocated
 * rather than held."*
 *
 * **The load-bearing words are `from a row it had not yet validated`.** The
 * tenant this helper scopes to does NOT come from the session row, and it does
 * not come from a request body. It comes from the HOST BINDING — G179, one
 * host per tenant, *"precisely so that there is no selector to defeat"* — read
 * out of the host→tenant registry by `checkHostBinding()` in
 * `model/serving-host.ts` before any row is touched. It is platform
 * configuration, which is the one source invariant 1 has always permitted.
 *
 * ⚠️ SO THE RULE THAT REPLACES THE OLD ONE IS NARROWER, NOT LOOSER, AND IT IS
 * THE RULE TO ENFORCE AT REVIEW: **`candidateTenantId` may be a value the
 * platform derived from the Host header through the registry, and nothing
 * else.** If it ever comes off `session.tenant_id`, off a payload, or off a
 * query string, this helper has become the relocation `session-scope.ts`
 * refuses and the fix is to delete it rather than to document it.
 *
 * ⚠️ AND THE BLAST RADIUS IS LARGER THAN `withSessionScope()`'s, SAID PLAINLY.
 * Inside this transaction every tenant-scoped table for the candidate tenant
 * IS readable, because `app.tenant_id` is set. That is not a side effect to be
 * tolerated — it is the mechanism: `membership_rls` narrows the restrictive
 * check's subquery to exactly that tenant, so the check can only pass when the
 * tenant being WRITTEN equals the tenant DECLARED. Two independent narrowings
 * over one write, from two policies neither of which knows about the other.
 * **Keep the body of `fn` to the selection and nothing else.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It exports no pool constructor, for `db/session-scope.ts`'s reason:
 * `createAppPool()` in `db/tenant-scope.ts` is the one pool, connecting as
 * `reconcile_app` — NEITHER `BYPASSRLS` nor owner of any table — and a second
 * constructor here would be a second place for that property to be got wrong.
 * It adds nothing to `TenantPool` either: that type has no `query` method so
 * that `pool.query(...)`, one autocommitted statement on a checked-out
 * connection, is a COMPILE ERROR at every call site.
 *
 * It does not decide anything. `selectTenantForSession()` (`model/access.ts`)
 * is the model half and is pure, total and reads no clock; this is the
 * transaction the database half is enforced in. Neither is sufficient alone,
 * which is #157's governing principle: *"either alone is a defeat."*
 */

import type { ScopedClient, TenantPool } from './tenant-scope.ts'

/**
 * Run `fn` inside an explicit transaction carrying BOTH scopes, neither of
 * which can outlive it.
 *
 * `handleDigest` is the digest of the presented `X-Session` value, computed by
 * the request plane — the same value and the same rules as
 * `withSessionScope()`.
 *
 * `candidateTenantId` is the tenant THE HOST IS BOUND TO. See the header: it
 * is platform configuration reached through `checkHostBinding()`, never a
 * value a caller supplied and never `session.tenant_id`.
 */
export async function withSelectionScope<T>(
  pool: TenantPool,
  handleDigest: string,
  candidateTenantId: string,
  fn: (tx: ScopedClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    /**
     * ⚠️ TWO `set_config` CALLS AND NOT ONE `SET LOCAL`, FOR THE REASON BOTH
     * SIBLING FILES STATE AND `db/provision.ts` STATES AGAIN FOR `ALTER ROLE`.
     *
     * `SET` is utility syntax, not DML: it takes no bind parameters. The
     * obvious repair — interpolating the value into the statement string — is
     * a SQL injection on a credential's shadow AND on the one value in the
     * system that must never be attacker-influenced, in the same transaction.
     *
     * `set_config(name, value, is_local)` is an ordinary function call, so each
     * value binds as $1 and is never parsed as SQL. The third argument `true`
     * is what makes it LOCAL: reverted at COMMIT or ROLLBACK, so the connection
     * returns to the pool carrying nothing. `SET LOCAL` inside an explicit
     * transaction is correct under BOTH pooling modes — G101.
     *
     * 🛑 THE ORDER IS SESSION FIRST, AND IT IS NOT COSMETIC. If the second call
     * throws, the transaction is rolled back and the whole helper fails — but a
     * reader stepping through has to see the narrower scope established before
     * the wider one, because that is the order the argument runs in: the
     * session is who you are, the candidate tenant is where the host says you
     * arrived.
     */
    await client.query('SELECT set_config($1, $2, true)', ['app.session_ref', handleDigest])
    await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', candidateTenantId])

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

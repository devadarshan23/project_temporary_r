/**
 * `withRealmScope()` — THE SIXTH NAMED SCOPED HELPER, AND THE FIRST THAT IS
 * OPENED FOR A CALLER WITH NO CREDENTIAL OF ANY KIND. READ THIS WHOLE HEADER
 * BEFORE USING IT.
 *
 * **G1945 (22 Sep 2026), under the owner's S7 ruling that `resolveHomeRealm`
 * is MOUNTED.** It is the transaction `server/data-plane/realm.ts` runs in, and
 * it exists for one operation.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE STANDING OBJECTION, QUOTED IN FULL RATHER THAN PARAPHRASED — AND IT
 *    IS NOW FOUR OBJECTIONS DEEP, WHICH MAKES THE BAR HIGHER AND NOT LOWER.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `db/session-scope.ts` wrote the rule when there were two:
 *
 *     "the negative control now has two members and somebody will propose a
 *      third. The reason to refuse a third is the reason there are two: each
 *      exists because a table cannot be protected by the other's predicate,
 *      not because a caller found it convenient."
 *
 * `db/selection-scope.ts` paid it with a measurement. `db/signin-scope.ts`
 * paid it with a measured DEADLOCK. `db/control-read-scope.ts` paid it with
 * two measurements and named what it spent. **This file owes the same and the
 * argument is that the existing five are each keyed on a credential this
 * caller does not hold.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE MEASUREMENT — THE REALM READ IS REFUSED INSIDE EVERY EXISTING HELPER,
 *    AND THE REFUSALS ARE FOUR DIFFERENT REFUSALS RATHER THAN ONE REPEATED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ✅ **THE ARMS BELOW HAVE NOW BEEN RUN — 22 Sep 2026 — AND THE PARAGRAPH
 * THAT SAID THEY HAD NOT IS CORRECTED RATHER THAN DELETED, because it is the
 * sentence that told a reader how much this header was worth.** It read:
 *
 *     "⚠️ **HOW THIS WAS ESTABLISHED, STATED FIRST SO IT IS NOT READ AS MORE
 *      THAN IT IS.** `db/selection-scope.ts` set the standard — *"the evidence
 *      is a measurement rather than an argument"* — and **the four arms below
 *      are DERIVED FROM THE POLICY TEXT, not run against a live server,
 *      because the machine this slice was built on has no PostgreSQL**
 *      (`psql -h 127.0.0.1`: `connection refused`) … **That is weaker than
 *      `selection-scope.ts`'s evidence and it is labelled as weaker rather
 *      than dressed up.**"
 *
 * **A machine with PostgreSQL 16.13 ran them and every arm holds.** The
 * evidence is now a measurement and no longer needs the caveat — which is the
 * whole product of having kept them RUNNABLE rather than narrated.
 *
 * 🛑 **AND KEEPING THEM RUNNABLE PAID FOR ITSELF, BECAUSE THE FIRST RUN FOUND
 * THAT ONE OF THE FOUR WAS NOT THERE — G1993.** This header said §3 *"opens
 * each of the four scopes in turn"* and that suite opened THREE: the missing
 * one was **`withSelectionScope()`, the widest scope in this directory and the
 * only one that sets BOTH GUCs** — so the arm likeliest to read something was
 * the arm nobody had written. It is there now and returns zero rows.
 * **A narration cannot notice its own gap; a suite can.**
 *
 * `tests/db/domain-claim.test.ts` §3 opens each of the four scopes in turn and
 * requires the realm read to return ZERO ROWS.
 *
 *   INSIDE `withTenantScope()`   there is no tenant, and there cannot be one.
 *     A realm lookup is the FIRST request a person makes: it precedes the
 *     session, which precedes `selectTenantForSession()`, which is the CHECK
 *     that binds a tenant at all (G210). Supplying one would be a tenant
 *     chosen at the door — invariant 1 relocated — and `tenant.domain_claim`
 *     is not keyed on `app.tenant_id` in any case, so the scope would be both
 *     wrong and useless in one call. `tenant.identity_connection` is not keyed
 *     on it either (0009).
 *
 *   INSIDE `withSessionScope()`  the read returns ZERO ROWS, and this is
 *     G340's deadlock arriving one step EARLIER than G340 found it.
 *     `identity_connection_rls` resolves the door THROUGH the session —
 *
 *         id = (SELECT s.connection_id FROM tenant.session s
 *                WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), ''))
 *
 *     — and `domain_claim_realm_rls` compares `domain` against an unset
 *     `app.claimed_domain`. Both are NULL, and G100's deny-on-NULL refuses
 *     everything. **A person asking which door to knock on has not been
 *     through any door**, so there is no session digest to supply and none
 *     that would help if there were.
 *
 *   INSIDE `withSignInScope()`   ZERO ROWS, and it is the closest miss, which
 *     is why it is the one to read. That helper is keyed on
 *     `(app.broker_issuer, app.broker_ref)` — **the handle of the door the
 *     caller has already been sent to.** `resolveHomeRealm` is the operation
 *     that ANSWERS which door that is. Reusing it would mean supplying the
 *     answer as the lookup key, and the only way to do that is to make one up:
 *     two empty strings, which `nullif(…, '')` turns into NULL, which denies.
 *     **A caller cannot name the door it is asking about.**
 *
 *   INSIDE `withSelectionScope()`  all of the above at once, and worse: it
 *     sets `app.tenant_id` from a HOST BINDING, and its own header forbids the
 *     use in as many words — *"`candidateTenantId` may be a value the platform
 *     derived from the Host header through the registry, and nothing else"*.
 *     A realm lookup is served on the marketing plane's apex, which is in no
 *     serving-host registry and binds no tenant.
 *
 *   INSIDE `withControlReadScope()`  it is the WRONG DATABASE. That helper
 *     opens the CONTROL database on a read-only credential; `domain_claim` and
 *     `identity_connection` are in the DATA one. It is named here rather than
 *     skipped because *"read-only and unauthenticated"* is a superficially
 *     attractive pairing and the reason it is wrong is topology rather than
 *     policy: `tests/http/console-roster-unreachable.test.ts` §1b refuses the
 *     cross-plane import in the other direction, and `db/control-read-scope.ts`
 *     reads `RECONCILE_CONTROL_READ_*`, its own prefix, which names no table
 *     this operation needs.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS IS NOT THE COMBINED HELPER `db/session-scope.ts` FORBIDS, AND IT IS
 *    THE NARROWEST SCOPE IN THIS DIRECTORY.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **One GUC. Not four, not two, one.** `app.tenant_id` is never set here and
 * must never be added: inside this transaction every tenant-scoped table reads
 * EMPTY, which is G100 working and is the intended blast radius.
 * `app.session_ref` is never set here either, which is the sharper half — a
 * caller with no credential must not be able to open a scope in which a
 * session row is addressable, even by a digest it guessed.
 *
 * **A caller in a realm scope can reach exactly two things: the claims on the
 * one domain it named, and the connections those claims point at.** Nothing
 * else in the database is visible to it at any price.
 *
 * ⚠️ **AND THE RULE TO ENFORCE AT REVIEW IS `db/signin-scope.ts`'s, VERBATIM,
 *    BECAUSE THE VALUE COMES FROM FURTHER AWAY THAN ANY OTHER IN THIS
 *    DIRECTORY: it is a field of an UNAUTHENTICATED request body.**
 *
 *     "They are LOOKUP KEYS, and the thing that makes supplying them safe is
 *      that holding one proves nothing: the policies admit exactly the row the
 *      key names, the caller learns only what it already named, and every
 *      DECISION downstream — which door, which organisation, which person — is
 *      read off the row rather than off the key. **If a value supplied through
 *      this helper ever reaches a decision without a row in between, this
 *      helper has become the relocation `session-scope.ts` refuses.**"
 *
 * A domain passes all three tests. It is not a tenant; it is not an
 * organisation — `orgClass` is `orgFor(connection.owner)` and this key never
 * touches `owner`; and it selects no scope, because no `set_config` here names
 * one. What the caller learns is whether the domain IT NAMED routes, which is
 * the DOMAIN-EXISTENCE oracle `docs/contracts/session.openapi.yaml` leaves
 * open deliberately and by name. **This helper does not widen it and must not
 * be used to narrow it either** — narrowing is a contract change on the
 * operation, not a policy change here.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It exports no pool constructor, for the reason all five siblings state:
 * `createAppPool()` in `db/tenant-scope.ts` is the one pool, connecting as
 * `reconcile_app` — NEITHER `BYPASSRLS` nor owner of any table — and a second
 * constructor here would be a second place for that property to be got wrong.
 *
 * **It does not normalise its own argument, and that is the load-bearing
 * omission.** `normaliseClaimedDomain()` (`model/domain.ts`) is the one place
 * a domain is folded, and a helper that folded its own input would be a second
 * one — §5.3, where the copy is what drifts, on a comparison whose own
 * declaration says *"this comparison decides an ORG CLASS, so folding is
 * load-bearing rather than tidy."* The caller normalises; see
 * `RealmScope.claimedDomain` below, which says so at the field.
 */

import type { ScopedClient, TenantPool } from './tenant-scope.ts'

/**
 * Everything the realm transaction is scoped by. One field, and it is still an
 * object rather than a bare parameter.
 *
 * ⚠️ AN OBJECT FOR ONE VALUE IS NOT CEREMONY HERE. `withSignInScope()` takes
 * four opaque strings of the same shape and says a positional call site that
 * transposed two of them *"would compile, run, and return an empty result —
 * which reads exactly like 'no such connection'."* A second GUC added to this
 * helper later would arrive as a second FIELD rather than as a second
 * positional argument, so the call sites do not have to be re-read.
 */
export interface RealmScope {
  /**
   * The domain to route, **already normalised**.
   *
   * 🛑 THE CALLER OWES `normaliseClaimedDomain()` AND THIS HELPER DOES NOT
   * CHECK THAT IT WAS CALLED. A check here would either be a second folding
   * (§5.3) or a comparison of the value against itself, and neither is a
   * control. What makes the omission safe is the fail-closed direction: an
   * unfolded value simply matches no stored row, so the answer is
   * `domain_not_claimed` rather than a wrong door.
   */
  readonly claimedDomain: string
}

/**
 * Run `fn` inside one explicit transaction carrying the realm scope, which
 * cannot outlive it.
 *
 * ⚠️ THE ENCLOSED QUERIES SEE NO TENANT SCOPE AND NO SESSION SCOPE. Every
 * tenant-scoped table reads EMPTY — G100's deny-on-NULL, working — and
 * `tenant.session` is unaddressable. That is the intended blast radius for a
 * caller who has presented nothing.
 */
export async function withRealmScope<T>(
  pool: TenantPool,
  scope: RealmScope,
  fn: (tx: ScopedClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    /**
     * ═════════════════════════════════════════════════════════════════════
     * 🛑 `BEGIN READ ONLY` — G1987, 22 Sep 2026. A SECOND, INDEPENDENT
     *    CONTROL, AND IT IS NOT A RESTATEMENT OF THE GRANT.
     * ═════════════════════════════════════════════════════════════════════
     *
     * **This was a bare `BEGIN` until 22 Sep 2026, which made it the only
     * read-only scope in this directory without the mode — and the one
     * opened for the caller with no credential of any kind.**
     *
     * `db/control-read-scope.ts` argues the control at length and the
     * argument transfers verbatim: **the GRANT is per RELATION and per
     * reviewer; the transaction mode is per STATEMENT and enforced by the
     * server.** `db/migrations/0220_domain_claim.sql` grants `SELECT` and
     * nothing else and `0009` grants no write on `tenant.identity_connection`
     * at all — so nothing here can write today, and that is a fact about two
     * migrations that a third could change without anybody re-reading this
     * file. This mode holds whatever those migrations say.
     *
     * 🛑 **AND IT IS WORTH MORE HERE THAN WHERE IT WAS BORROWED FROM,
     * BECAUSE OF WHAT 0170 GOT WRONG.** That migration's policies were
     * `FOR ALL` with an implied `WITH CHECK` derived from
     * `app.claimed_domain`, so a `GRANT INSERT` arriving later would have
     * been authorised BY THE POLICY to write precisely the takeover row.
     * The policies now name `FOR SELECT` and that hole is closed at the
     * source — **this mode is the layer that would have refused the write
     * even while the policy was wrong**, which is the definition of defence
     * in depth rather than duplication.
     *
     * ⚠️ **IT COSTS NOTHING THIS OPERATION DOES.** `resolveHomeRealm` issues
     * one `set_config` and two `SELECT`s. `set_config(…, is_local => true)`
     * is permitted in a read-only transaction — it changes session state, not
     * database state — which is measured by
     * `tests/db/domain-claim.test.ts` §8 rather than assumed, because a
     * read-only scope whose own scoping statement was refused would fail
     * closed and look like a policy problem.
     */
    await client.query('BEGIN READ ONLY')

    /**
     * ⚠️ `set_config` AND NOT `SET LOCAL`, FOR THE REASON ALL FIVE SIBLING
     * FILES STATE — and here it is the sharpest instance in the directory.
     *
     * `SET` is utility syntax, not DML: it takes no bind parameters. The
     * obvious repair — interpolating the value into the statement string —
     * would be a SQL injection **on a field of an unauthenticated request
     * body**. `withSignInScope()` calls its own values *"a sharper version of
     * the same trap"* because `brokerRef` arrives from outside the system;
     * this one arrives from outside the system with no session behind it at
     * all.
     *
     * `set_config(name, value, is_local)` is an ordinary function call, so the
     * value binds as $2 and is never parsed as SQL. The third argument `true`
     * is what makes it LOCAL: reverted at COMMIT or ROLLBACK, so the
     * connection returns to the pool carrying nothing — which matters more
     * here than anywhere else in this directory, because the NEXT checkout of
     * this connection may be a tenant-scoped request.
     */
    await client.query('SELECT set_config($1, $2, true)', [
      'app.claimed_domain',
      scope.claimedDomain,
    ])

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

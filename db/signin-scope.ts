/**
 * `withSignInScope()` — THE FOURTH NAMED SCOPED HELPER, AND IT OWES THE BAR
 * THE THIRD PAID. READ THIS WHOLE HEADER BEFORE USING IT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE STANDING OBJECTION, QUOTED IN FULL RATHER THAN PARAPHRASED — AND IT
 *    IS NOW TWO OBJECTIONS DEEP, WHICH MAKES THE BAR HIGHER AND NOT LOWER.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `db/session-scope.ts` wrote the rule when there were two:
 *
 *     "the negative control now has two members and somebody will propose a
 *      third. The reason to refuse a third is the reason there are two: each
 *      exists because a table cannot be protected by the other's predicate,
 *      not because a caller found it convenient."
 *
 * `db/selection-scope.ts` arrived as the third and did not plead an exception
 * — it argued itself against that sentence, and it won on a MEASUREMENT: the
 * tenant-binding write was witnessed REFUSED inside both existing helpers
 * against a live PostgreSQL, with the error text recorded on its face. Its own
 * header then says what kind of evidence counts here: *"the evidence is a
 * measurement rather than an argument."*
 *
 * **THIS FILE OWES THE SAME AND THE ARGUMENT IS THE DEADLOCK, NOT THE TIDINESS.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE MEASUREMENT. THE SIGN-IN READ IS REFUSED INSIDE EVERY EXISTING HELPER,
 *    AND ONE OF THE THREE REFUSALS IS THE REASON G340 WAS RULED AT ALL.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   INSIDE `withTenantScope()`   there is no tenant. A sign-in callback
 *     precedes every tenant fact — `MintedSession` fixes `tenantId` to `null`
 *     with a `const`, and G210 puts the selection in a later CHECK against the
 *     host-bound tenant. Supplying one here would be a tenant chosen at the
 *     door, which is invariant 1 relocated. And `identity_connection` is not
 *     keyed on `app.tenant_id` at all, so the scope would be both wrong and
 *     useless in the same call.
 *
 *   INSIDE `withSessionScope()`  the read returns ZERO ROWS, and this is the
 *     measured deadlock G340 is named for. `0009`'s policy resolves the
 *     directory THROUGH the session —
 *
 *         id = (SELECT s.connection_id FROM tenant.session s
 *                WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), ''))
 *
 *     — so at the callback `app.session_ref` names no row, the subquery is
 *     NULL, `id = NULL` is NULL, and G100's deny-on-NULL refuses everything.
 *     **You need a connection to mint a session and a session to read a
 *     connection.** `tests/db/federated-signin.test.ts` §1 runs that exact
 *     arrangement and REQUIRES the empty result, so the deadlock stays
 *     observable after it has been removed — `docs/HANDOFF.md` §5.6's mirror:
 *     a deletion whose effect is never observed is not a fix.
 *
 *   INSIDE `withSelectionScope()`  both of the above at once, and worse: it
 *     sets `app.tenant_id` from a host binding that has not been established,
 *     because the caller has no session to bind. Its own header forbids the
 *     use in as many words — *"`candidateTenantId` may be a value the platform
 *     derived from the Host header through the registry, and nothing else"* —
 *     and a callback has not reached `checkHostBinding()` yet.
 *
 * So there is no arrangement of the existing three under which a federated
 * callback can read the door it arrived through. G340 ruled the repair and
 * ruled OUT the three cheaper ones — a fourth PostgreSQL role (a serving
 * process would hold a second credential for its whole life, which is what
 * G193 split into one-shot jobs to prevent), declaring the directory
 * non-secret (it makes *"which directory does ten-acme use"* answerable by
 * anyone who can reach the plane), and asking the control plane (invariant 3:
 * the control plane never reads tenant data, and `identity_connection` IS
 * tenant data). **Those three are the row's, not this file's, and they are not
 * re-argued here.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS IS NOT THE COMBINED HELPER `db/session-scope.ts` FORBIDS, AND THE
 *    DISTINCTION IS THE ONLY THING KEEPING IT HONEST.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * That file's refusal reads: *"A session read that opened a tenant scope would
 * hand every caller of the cheaper helper a tenant scope derived FROM A ROW IT
 * HAD NOT YET VALIDATED — invariant 1 relocated rather than held."*
 *
 * **This helper opens no tenant scope at all.** `app.tenant_id` is never set
 * here and must never be added: inside this transaction every tenant-scoped
 * table reads as EMPTY, which is G100 working, and it is the intended blast
 * radius. A caller in a sign-in scope can reach exactly four rows — one
 * connection, one attempt, (once it names one) one PERSON, and (once it exists)
 * one session it has just written — and nothing else in the database.
 *
 * ⚠️ THAT SENTENCE SAID **THREE** UNTIL 21 Sep 2026 AND THE FOURTH IS THE ONE
 * THIS HELPER GAINED A GUC FOR. It is still a closed, countable list, which is
 * the property the sentence exists to state; a policy keyed on the DOOR alone
 * would have made the third entry "every person on that door" and the list
 * would have stopped being countable at all.
 *
 * ⚠️ AND THE RULE TO ENFORCE AT REVIEW IS NARROWER THAN THE ONE
 *    `selection-scope.ts` states, because the values here come from further
 *    away: **`brokerIssuer`, `brokerRef` and `stateDigest` are values a
 *    CALLER supplied.** That is not invariant 1 inverted — none of them is a
 *    tenant, none of them is an organisation, and none of them selects a
 *    scope. They are LOOKUP KEYS, and the thing that makes supplying them safe
 *    is that holding one proves nothing: the policies admit exactly the row the
 *    key names, the caller learns only what it already named, and every
 *    DECISION downstream — which door, which organisation, which person — is
 *    read off the row rather than off the key. **If a value supplied through
 *    this helper ever reaches a decision without a row in between, this helper
 *    has become the relocation `session-scope.ts` refuses.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 FIVE GUCs IN ONE HELPER, AND WHY THAT IS ONE HELPER RATHER THAN FIVE.
 *    ⚠️ THIS HEADING SAID **FOUR** UNTIL 21 Sep 2026 AND WAS CORRECT WHEN
 *    WRITTEN. The fifth is `app.external_subject` and it argues itself below
 *    against this file's own bar rather than pleading an exception.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G340 names one GUC. This sets five, and each of the extra four is forced:
 *
 *   `app.broker_issuer` + `app.broker_ref`   ONE KEY IN TWO COLUMNS — G343,
 *     argued on the face of `db/migrations/0013_federated_signin.sql`. G304
 *     already ruled that a provider name alone *"is a key that can COLLIDE
 *     ACROSS POOLS"*; a policy keyed on the reference alone would admit
 *     another pool's row to a caller who named only a provider name, and
 *     `orgFor(connection.owner)` would then answer about the wrong
 *     organisation with nothing reporting a problem.
 *
 *   `app.signin_ref`                          THE ATTEMPT'S OWN KEY. It cannot
 *     reuse `app.session_ref`, and the reason is not naming: the mint that
 *     follows must set `app.session_ref` to the digest of the NEW session
 *     handle, because that is what `session_rls`'s `WITH CHECK` compares. One
 *     GUC cannot hold both in one transaction.
 *
 *   `app.session_ref`                         OPTIONAL, AND IT IS THE REASON
 *     THIS IS ONE TRANSACTION. See below.
 *
 *   `app.external_subject`                    OPTIONAL, AND ADDED 21 Sep 2026
 *     — G1635, W3-S1. ⚠️ **THIS HEADER SAID "FOUR GUCs" AND THE HEADING TWO
 *     LINES UP STILL DOES; THERE ARE FIVE, AND THE HEADING IS CORRECTED
 *     RATHER THAN DELETED** because "four" is the number this file argued for
 *     at length and the one a reader would have quoted onward. **The bar is
 *     the same bar and it is paid the same way: a table cannot be protected
 *     by another's predicate.**
 *
 *     `db/migrations/0200_external_subject_and_claim_map.sql` §4 gives
 *     `tenant."user"` a sign-in policy, because `0009`'s `user_rls` resolves
 *     a person THROUGH the session and at a callback there is none —
 *     `0013`'s deadlock, one table over, measured at `[]`. **The broker pair
 *     cannot be that policy's key**, and that is the whole of the argument:
 *     a door has MANY people, so a policy keyed on it would admit every one
 *     of them, and the pair is a handle a CALLER supplies. That is the rule
 *     four paragraphs down being broken rather than applied — *"the policies
 *     admit exactly the row the key names"* — because it would admit every
 *     row the key's PARENT names, and a sign-in scope would become a
 *     directory enumeration surface.
 *
 *     ⚠️ IT IS A LOOKUP KEY AND NEVER A DECISION, which is the same test the
 *     other three supplied values pass. Holding a subject proves nothing:
 *     the policy admits exactly the one person `(door, subject)` names, and
 *     WHICH ORGANISATION that person belongs to is read off the DOOR's owner
 *     through `orgFor(connection.owner)` — never off this value. A token
 *     that claimed an organisation would be claiming something no policy and
 *     no reader consults.
 *
 *     ⚠️ ABSENT IS NOT "UNKNOWN" — IT IS "THIS TRANSACTION TOUCHES NO
 *     PERSON", exactly as `sessionRef`'s absence means "does not mint". With
 *     no value here the policy compares against NULL, G100 denies, and every
 *     sign-in read written before that migration — `assembleSignIn()`, which
 *     names no subject — reaches no person at all and is unchanged.
 *
 * **THE ALTERNATIVE WAS FOUR SMALL HELPERS OR FOUR TRANSACTIONS, AND BOTH LOSE
 * THE PROPERTY THE SLICE EXISTS FOR.** `docs/contracts/session.openapi.yaml`
 * requires the attempt to be consumed *"in the same transaction that mints the
 * `Session`"*, and G315 names the failure by name: *"a replayable `state` or a
 * reusable grant would hand the whole flow away."* Two transactions is a
 * window between reading an unconsumed attempt and writing `consumed_at`, and
 * a window is a replay. **The atomicity IS the single-use property**, so the
 * unit of scoping has to be the unit of atomicity, and that unit is the whole
 * callback. One act, one transaction, one helper.
 *
 * ⚠️ `sessionRef` IS OPTIONAL AND ITS ABSENCE IS THE DEFAULT, WHICH IS THE
 *    FENCE. A caller that passes none cannot write a session row at all:
 *    `session_rls`'s `WITH CHECK` compares `handle_digest` against an unset
 *    GUC, that is NULL, and the INSERT is refused. So the READ path — which is
 *    all this repository serves today — structurally cannot mint, and minting
 *    requires the caller to name the digest it is about to write. It is not a
 *    convenience parameter; it is the difference between a reader and a writer,
 *    made visible at the call site.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It exports no pool constructor, for the reason all three siblings state:
 * `createAppPool()` in `db/tenant-scope.ts` is the one pool, connecting as
 * `reconcile_app` — NEITHER `BYPASSRLS` nor owner of any table — and a second
 * constructor here would be a second place for that property to be got wrong.
 * It adds nothing to `TenantPool` either: that type has no `query` method, so
 * `pool.query(...)` — one autocommitted statement on a checked-out connection
 * — is a COMPILE ERROR at every call site rather than a code-review catch.
 *
 * It does not decide anything and it does not digest anything.
 * `consumeSignInAttempt()` (`model/domain.ts`) is the model half and is pure,
 * total and reads no clock; `server/data-plane/handle-digest.ts` is the one
 * seam that turns a handle into a digest, and it is the request plane's.
 * **A helper that digested its own argument would be a second place the digest
 * rule lives**, which is the shape §5.3 catalogues.
 */

import type { ScopedClient, TenantPool } from './tenant-scope.ts'

/**
 * Everything the sign-in transaction is scoped by, named rather than
 * positional.
 *
 * 🛑 AN OBJECT AND NOT FOUR PARAMETERS, AND IT IS NOT STYLE. Three of the four
 * are opaque strings of the same shape, and a positional call site that
 * transposed `brokerRef` and `stateDigest` would compile, run, and return an
 * empty result — which reads exactly like "no such connection" and would be
 * debugged as a missing row rather than as a swapped argument.
 */
export interface SignInScope {
  /**
   * The broker's own issuer, verbatim. Half of G304's pair; meaningless alone
   * and never parsed — no region, no pool id, no account is read out of it.
   */
  readonly brokerIssuer: string
  /** The name the broker gives this directory. The other half. */
  readonly brokerRef: string
  /**
   * The digest of the relay/`state` parameter — the attempt's lookup key.
   * NEVER the parameter: the same rule as `Session.handleDigest`, because a
   * value that reaches the database is a value that reaches a database dump.
   */
  readonly stateDigest: string
  /**
   * The digest of the session handle about to be MINTED, or absent.
   *
   * ⚠️ ABSENT IS NOT "UNKNOWN" — IT IS "THIS TRANSACTION DOES NOT MINT". See
   * the header: with no value here `session_rls`'s `WITH CHECK` compares
   * against NULL and any INSERT into `tenant.session` is refused by the
   * database. Supplying it is the visible act of becoming a writer.
   */
  readonly sessionRef?: string
  /**
   * The external subject — an OIDC `sub` — of the person this transaction is
   * about, or absent.
   *
   * ⚠️ ABSENT IS NOT "UNKNOWN" — IT IS "THIS TRANSACTION TOUCHES NO PERSON".
   * `user_signin_rls` compares against this GUC, so with no value here the
   * comparison is against NULL and G100 refuses every person row, for reading
   * as well as for writing. Supplying it is the visible act of naming the one
   * person a callback may see.
   *
   * 🛑 IT IS THE PERSON'S KEY AND NEVER THE PERSON'S ORGANISATION. See the
   * header: the door decides the organisation, through
   * `orgFor(connection.owner)`, and nothing downstream reads an org, a tenant
   * or a role off this string.
   */
  readonly externalSubject?: string
}

/**
 * Run `fn` inside one explicit transaction carrying the sign-in scope, none of
 * which can outlive it.
 *
 * ⚠️ THE ENCLOSED QUERIES SEE NO TENANT SCOPE AND NO SESSION SCOPE THEY DID NOT
 * ASK FOR. `app.tenant_id` is unset, so every tenant-scoped table reads as
 * EMPTY — G100's deny-on-NULL, working. That is the intended blast radius: a
 * federated callback reaches the door it named, the attempt it named, and
 * nothing else.
 */
export async function withSignInScope<T>(
  pool: TenantPool,
  scope: SignInScope,
  fn: (tx: ScopedClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    /**
     * ⚠️ `set_config` AND NOT `SET LOCAL`, FOR THE REASON ALL THREE SIBLING
     * FILES STATE AND `db/provision.ts` STATES AGAIN FOR `ALTER ROLE`.
     *
     * `SET` is utility syntax, not DML: it takes no bind parameters. The
     * obvious repair — interpolating the value into the statement string —
     * would be a SQL injection **on values a caller supplies**, which is a
     * sharper version of the same trap than either sibling faces: a session
     * digest is at least derived through one seam, whereas `brokerRef` arrives
     * from outside the system.
     *
     * `set_config(name, value, is_local)` is an ordinary function call, so each
     * value binds as $1 and is never parsed as SQL. The third argument `true`
     * is what makes it LOCAL: reverted at COMMIT or ROLLBACK, so the connection
     * returns to the pool carrying nothing. `SET LOCAL` inside an explicit
     * transaction is correct under BOTH pooling modes — G101.
     *
     * 🛑 THE ORDER IS THE ORDER THE ARGUMENT RUNS IN, as in
     * `db/selection-scope.ts`, and it is not cosmetic. The door first, because
     * a callback is first of all a claim about which door it came through; the
     * attempt second, because it is checked against that door; the session
     * last, because it does not exist until both have answered.
     */
    await client.query('SELECT set_config($1, $2, true)', [
      'app.broker_issuer',
      scope.brokerIssuer,
    ])
    await client.query('SELECT set_config($1, $2, true)', ['app.broker_ref', scope.brokerRef])
    await client.query('SELECT set_config($1, $2, true)', ['app.signin_ref', scope.stateDigest])
    /* The person, before the session: a callback finds or creates the person
     * and only then mints. Both are optional and their absences mean two
     * different narrowings — see `SignInScope`. */
    if (scope.externalSubject !== undefined) {
      await client.query('SELECT set_config($1, $2, true)', [
        'app.external_subject',
        scope.externalSubject,
      ])
    }
    if (scope.sessionRef !== undefined) {
      await client.query('SELECT set_config($1, $2, true)', ['app.session_ref', scope.sessionRef])
    }

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

/**
 * THE PIN SCOPE — G2235, applied 1 Oct 2026 (G2481). The transaction a
 * federated callback opens FIRST, before a broker pair exists anywhere.
 *
 * 🛑 IT TAKES A STATE DIGEST AND NOTHING ELSE, AND THAT IS THE WHOLE OF
 * G2235. `withSignInScope()` is keyed on a broker PAIR, and a real callback
 * carries no pair — so before this helper every way of obtaining one read it
 * from something the caller supplied. This scope sets the two GUCs that make
 * exactly ONE attempt and exactly ONE door visible — the door that attempt
 * PINNED at redirect, through `0280`'s `identity_connection_pin_rls` — and the
 * pair the MINT transaction is later scoped by is read off that row.
 *
 * ⚠️ IT LIVES IN THIS FILE AND NOT IN A SEVENTH `*-scope.ts`, because it is
 * the first half of the same act `withSignInScope()` is the second half of,
 * and the six-helper census is a census of ACTS, not of functions.
 *
 * ⚠️ TWO GUCs, BOTH THE DIGEST, AND NEITHER IS REDUNDANT. `app.signin_ref` is
 * what `sign_in_attempt_rls` keys on, and `0280`'s policy reads the attempt
 * THROUGH that policy — measured: with `app.signin_pin_ref` alone the door is
 * invisible. `app.signin_pin_ref` is what `0280` keys on, and it is a SEPARATE
 * name so that `withSignInScope()`, which sets `app.signin_ref` for the mint,
 * never admits the pinned row beside the row its pair names (`0280`'s header
 * measures what that would delete: G344's named refusal).
 *
 * 🛑 `BEGIN READ ONLY`, `db/control-read-scope.ts`'s argument verbatim: the
 * GRANT is per RELATION and per reviewer; the transaction mode is per
 * STATEMENT and enforced by the server. Nothing here writes — the attempt is
 * CONSUMED in the mint transaction, which is where the contract puts it
 * (*"in the same transaction that mints the Session"*).
 *
 * ⚠️ AND IT IS SHORT BY DESIGN, WHICH IS G2443's FOURTH BOUND SEEN FROM THIS
 * SIDE: the callback ends this transaction and RELEASES the connection before
 * the token endpoint is called, so no pooled connection is held across
 * somebody else's network round trip. `tests/http/federated-signin-served.test.ts`
 * measures the pool during the call rather than trusting this paragraph.
 */
export async function withSignInPinScope<T>(
  pool: TenantPool,
  scope: { readonly stateDigest: string },
  fn: (tx: ScopedClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN READ ONLY')
    await client.query('SELECT set_config($1, $2, true)', ['app.signin_ref', scope.stateDigest])
    await client.query('SELECT set_config($1, $2, true)', [
      'app.signin_pin_ref',
      scope.stateDigest,
    ])
    const out = await fn(client)
    await client.query('COMMIT')
    return out
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    client.release()
  }
}

/**
 * THE BEGIN SCOPE — the owner's ruling of 1 Oct 2026 (G2541), applied with
 * `db/migrations/0290_sign_in_begin.sql`. The transaction
 * `beginFederatedSignIn` opens to route a domain to a door AND write the
 * attempt that pins it, in one unit.
 *
 * ⚠️ IT LIVES IN THIS FILE AND NOT IN A SEVENTH `*-scope.ts`, for the pin
 * scope's reason (G2484): it is the FIRST half of the act `withSignInPinScope()`
 * and `withSignInScope()` finish, and the helper census is a census of ACTS.
 * `ls db/*-scope.ts | wc -l` stays 6.
 *
 * TWO GUCs, AND EACH IS A LOOKUP KEY RATHER THAN A GRANT:
 *
 *   · `app.claimed_domain` — `db/realm-scope.ts`'s GUC, so the read is the
 *     SAME read `resolveHomeRealm` makes (`0220`'s two policies) and the write
 *     is fenced by `0290`'s restrictive check to a door a VERIFIED claim on
 *     that domain reaches. **The caller owes `normaliseClaimedDomain()`**, as
 *     it does for `withRealmScope()`; an unfolded value matches no claim and
 *     the write is refused, the fail-closed direction.
 *   · `app.signin_ref` — the digest of the `state` this request MINTED. It is
 *     what `sign_in_attempt_rls` (0013) and `0290`'s fence pin the new row's
 *     `handle_digest` to, so the INSERT can write exactly the row this scope
 *     names and no other.
 *
 * 🛑 `app.signin_pin_ref`, THE BROKER PAIR, `app.external_subject` AND
 * `app.session_ref` ARE NEVER SET HERE. A caller with no credential must not
 * be able to open a scope in which a door is admitted by an attempt
 * (`0280`), a person by a subject (`0200`), or a session by a digest — the
 * sentence `db/realm-scope.ts` carries about the last of them, one helper over.
 *
 * ⚠️ AND IT IS AN ORDINARY `BEGIN`, NOT `BEGIN READ ONLY`, BECAUSE IT WRITES —
 * the absence of a mode is the honest shape, `db/control-write-scope.ts`'s
 * sentence: what contains the write is the column-level GRANT and the
 * RESTRICTIVE policy, both in `0290`, and nothing else. The route and the
 * write are one transaction so that a door routed and an attempt pinned
 * cannot be read off two different instants of `tenant.domain_claim`.
 */
export async function withSignInBeginScope<T>(
  pool: TenantPool,
  scope: {
    readonly claimedDomain: string
    readonly stateDigest: string
    /**
     * G2549 / `0360` — the REGISTRY-RESOLVED host the sign-in is begun on.
     * `sign_in_attempt_begun_host_restrictive` requires the row's `begun_host`
     * to equal this GUC, so the host the hand-off will later be bound to is
     * the one the scope names and not one the statement chose.
     */
    readonly begunHost: string
  },
  fn: (tx: ScopedClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT set_config($1, $2, true)', [
      'app.claimed_domain',
      scope.claimedDomain,
    ])
    await client.query('SELECT set_config($1, $2, true)', ['app.signin_ref', scope.stateDigest])
    await client.query('SELECT set_config($1, $2, true)', ['app.begun_host', scope.begunHost])
    const out = await fn(client)
    await client.query('COMMIT')
    return out
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    client.release()
  }
}

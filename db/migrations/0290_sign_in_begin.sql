-- =====================================================================
-- 0290 — A SIGN-IN CAN BE BEGUN: THE APP ROLE MAY WRITE AN ATTEMPT, AND THE
--        DOOR CARRIES THE ONE PLACE A BROWSER MAY BE SENT TO AUTHENTICATE.
--        THE OWNER'S RULING OF 1 Oct 2026 (G2541), applied with G2542–G2549.
--
-- THE RULING, verbatim, because it is the sentence this file executes:
--
--   *"Build a public 'start sign-in' operation that inserts an attempt row
--    (state, nonce, PKCE) and returns the broker redirect — same D6 posture:
--    WAF rate rule, servedPublicly, INSERT-only grant on sign_in_attempt with
--    a restrictive WITH CHECK, attempt TTL per D6-6."*
--
-- G88: forward-only. `0013`, `0220`, `0240` and `0280` ARE NOT EDITED —
--      `0017`'s precedent. This file adds ONE column, ONE grant and ONE policy
--      and replaces nothing.
-- ⚠️ SCHEMA-QUALIFIED THROUGHOUT, because 0003 requires it from 0004 on.
--
-- ---------------------------------------------------------------------
-- 🛑 THE SENTENCE IN `0013` THIS FILE ENDS, QUOTED SO IT IS NOT LOST:
--
--      `GRANT SELECT ON tenant.sign_in_attempt TO tenant_rw;`
--      `GRANT UPDATE (consumed_at) ON tenant.sign_in_attempt TO tenant_rw;`
--
--    and `tests/db/federated-signin.test.ts`'s own header: *"there is no
--    `INSERT` on the attempt table by design (0013: 'a write privilege ahead
--    of its writer')."* **This commit is the writer** —
--    `server/data-plane/signin-begin.ts` lands with it, which is G511's
--    *"the fence and the writer are one commit or neither"* and `0004`'s own
--    condition for a write privilege.
--
-- ---------------------------------------------------------------------
-- §1 · `GRANT INSERT (…)` — COLUMN-LEVEL, AND `consumed_at` IS NOT IN IT.
--
--    An attempt is written ONCE, unconsumed. A column-level INSERT grant means
--    an omitted column takes its default, and `consumed_at` has none, so it is
--    NULL — and a statement that NAMES `consumed_at` is refused by the
--    database with `42501`, not by review. A path that could insert a
--    pre-consumed attempt could not sign anybody in with it, so the harm is
--    small; the grant is narrow because a narrow grant is the one nobody has
--    to argue about later. NO `DELETE` and NO further `UPDATE`: an attempt
--    ages out under `0240`'s policy and is never removed by a request path.
--
-- §2 · THE RESTRICTIVE `WITH CHECK` — WHAT ANY APP-ROLE WRITER MAY WRITE.
--
--    `FOR INSERT` and `AS RESTRICTIVE`, so it is ANDed into every permissive
--    policy present and future (`0240`'s reason, and `0200`'s before it). FIVE
--    conjuncts, each pinning the row to a fact the SCOPE holds rather than to
--    one the statement supplies:
--
--      · `handle_digest = app.signin_ref` — the row is the one this scope's
--        `state` digest names. `sign_in_attempt_rls` (0013) already says this
--        as a PERMISSIVE check; it is restated here because a permissive
--        clause is widened by the next permissive policy and a restrictive
--        one is not.
--      · `consumed_at IS NULL` — the grant in §1 already makes this true; it
--        is restated so the property survives somebody widening the grant.
--      · `started_at = now()` — the attempt starts NOW. `now()` is
--        transaction-stable, so the writer's `now()` and this one are equal.
--        A back-dated start would let a writer spend some of the window before
--        the browser ever left.
--      · `expires_at <= now() + interval '10 minutes'` — D6-6's TTL as an
--        UPPER bound at the write. `0240` already makes a longer `expires_at`
--        HARMLESS (its fence is the EARLIER of the two); this makes it
--        UNWRITABLE, which is the ruling's *"attempt TTL per D6-6"* at the
--        door rather than only at the read. `SIGN_IN_ATTEMPT_TTL_MINUTES`
--        names the number; `tests/db/signin-begin-fence.test.ts` §1 reads
--        this policy back and requires the two to agree, exactly as `0240`'s
--        §1d does for that file.
--      · THE DOOR IS ONE THE SCOPE'S DOMAIN ROUTES TO — an `EXISTS` over
--        `tenant.domain_claim` with a VERIFIED claim on `app.claimed_domain`.
--        So an anonymous writer cannot pin an attempt to a door no verified
--        claim on the domain it named reaches: the attempt's `connection_id`
--        is bound to the same routing fact `resolveHomeRealm` answers from.
--
-- 🛑 WHY `domain_claim` AND NOT `identity_connection` — AND THE FIRST DRAFT
--    OF THIS PARAGRAPH WAS WRONG, CAUGHT BY MEASURING IT. It said a check
--    reading `identity_connection` would close the cycle
--    `sign_in_attempt → identity_connection (0280's pin policy) →
--    sign_in_attempt` and that PostgreSQL would refuse every INSERT with
--    `infinite recursion detected`. **Against a live PostgreSQL 14.18 it does
--    NOT recur** — the probe policy is installed and the write COMMITS —
--    and `tests/db/signin-begin-fence.test.ts` §5 keeps that measurement
--    RUNNABLE so the next reader neither fears it nor trusts it.
--    The real reason is the VERIFICATION BIT. In this scope
--    `identity_connection` is visible through `0220`'s
--    `identity_connection_realm_rls`, which admits a door with ANY claim on the
--    domain — verified or not, because `routeToConnection()` must SEE an
--    unverified claim to answer `domain_not_verified`. A fence that asked only
--    *"is this door visible"* would therefore admit an attempt pinned to an
--    UNVERIFIED claimant; asking `domain_claim` for `verified_at IS NOT NULL`
--    refuses it (§3e). ⚠️ WHAT IT COSTS: `status` lives on the CONNECTION, so
--    this policy cannot refuse a DISABLED door; `routeToConnection()` refuses
--    it in the handler (`connection_disabled`) before the write, and the
--    callback refuses it again (`sign_in_door_disabled`, G2483).
--
-- ⚠️ `app.claimed_domain` IS SET FROM A FIELD OF AN UNAUTHENTICATED BODY, AND
--    THAT IS `db/realm-scope.ts`'s LOOKUP-KEY RULE, NOT INVARIANT 1 INVERTED:
--    it narrows, it names no tenant and no organisation, and the decision is
--    read off a ROW.
--
-- §3 · `authorization_endpoint` — G2443's SECOND BOUND, ONE HOP EARLIER.
--
--    `0280` gave the door its `token_endpoint` because *"the PINNED
--    connection's token endpoint names a value no row carried."* The
--    authorize URL is the same shape one step earlier: the place a BROWSER is
--    sent to authenticate. **It comes off the row and never off the request**
--    — a request path that could choose it would be an OPEN REDIRECT on the
--    product's first public sign-in route, which is D6 §4.4's finding arriving
--    from the other end of the round trip. `0011` refused this column BY NAME
--    among its seven (*"a column ahead of its reader is `0004`'s refusal"*);
--    **this commit is the reader.**
--
--    ⚠️ NULLABLE, AND NULL IS A REFUSAL, NOT A DEFAULT — `0280`'s rule for
--    the token endpoint, for the same reason: a per-environment authorize URL
--    is the shape D6-5 refused for the issuer, and under G276's BYOA one URL
--    is one pool. ⚠️ NO `CHECK` ON THE SCHEME (`0069`'s polarity): the reader
--    refuses anything that is not `https:` or a loopback `http:` —
--    `pinnedEndpointUrl()` in `server/data-plane/code-exchange.ts`, ONE
--    function for both endpoints. 🛑 NO NEW GRANT AND NO WRITER: `0009`'s
--    `GRANT SELECT` covers a column added later, and the value arrives by
--    migrator like every other column on this table.
-- =====================================================================

ALTER TABLE tenant.identity_connection ADD COLUMN authorization_endpoint text;

GRANT INSERT (id, handle_digest, connection_id, challenge_digest, started_at, expires_at)
  ON tenant.sign_in_attempt TO tenant_rw;

CREATE POLICY sign_in_attempt_begin_restrictive ON tenant.sign_in_attempt
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    handle_digest = nullif(current_setting('app.signin_ref', true), '')
    AND consumed_at IS NULL
    AND started_at = now()
    AND expires_at <= now() + interval '10 minutes'
    AND EXISTS (
      SELECT 1
        FROM tenant.domain_claim c
       WHERE c.connection_id = sign_in_attempt.connection_id
         AND c.domain = nullif(current_setting('app.claimed_domain', true), '')
         AND c.verified_at IS NOT NULL
    )
  );

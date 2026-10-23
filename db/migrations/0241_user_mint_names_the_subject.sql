-- =====================================================================
-- 0241 — THE RESTRICTIVE MINT FENCE ON `tenant."user"` NAMES THE PERSON, NOT
--        ONLY THE DOOR. D6-7, THE OWNER'S RULING OF 29–30 Sep 2026.
--        G2204–G2207.
--
-- G88: forward-only. `0200` IS NOT EDITED — `0017`'s precedent — and this
--      file `ALTER POLICY`s its restrictive policy, which is `0008`'s and
--      `0210`'s choice: the policy keeps its NAME, so every refusal message
--      and every test that matches on `user_signin_mint_restrictive` still
--      means the same fence.
-- ⚠️ SCHEMA-QUALIFIED THROUGHOUT, because 0003 requires it from 0004 on.
--
-- ---------------------------------------------------------------------
-- 🛑 THE GAP, IN D6's WORDS: *"`user_signin_mint_restrictive` compares the
--    broker pair alone. `user_signin_rls` compares the pair AND
--    `external_subject`. A fifth permissive policy would meet the restrictive
--    test without ever naming a subject."* S1 reported it could not close
--    this path. It is PROSPECTIVE — no such policy exists — and that is the
--    reason the restrictive layer exists at all: it is ANDed into every
--    write REGARDLESS of which permissive policy admitted it.
--
--    WITNESSED RED before this file, not reasoned: with a probe permissive
--    policy `FOR INSERT WITH CHECK (true)` installed, a sign-in scope naming
--    subject A minted a person on the RIGHT door with subject B — the INSERT
--    LANDED. `tests/db/signin-expiry-and-subject-fence.test.ts` §2a. After
--    it, the refusal NAMES this policy, which PostgreSQL does only when a
--    RESTRICTIVE policy fails.
--
-- ---------------------------------------------------------------------
-- 🛑 THE RECURSION HAZARD, RE-MEASURED AND NOT ASSUMED.
--
--    S1 measured that a `user` policy subquerying `tenant.identity_connection`
--    answers `infinite recursion detected in policy for relation "user"` on
--    ELEVEN OF ELEVEN probe arms — the cycle closes through `0018`'s
--    `identity_connection_directory_rls`, which reads `tenant."user"`. **The
--    new term reads the row's OWN column against a GUC and nothing else**,
--    so there is no relation in its expansion at all.
--    Re-measured against a live PostgreSQL 14 with this file applied: the
--    session-scope read (`resolveSubject()`'s, on every request), the
--    sign-in-scope read and mint, and the tenant-scope read all complete
--    with no recursion — §3 of the suite drives each, and §3b reads the
--    deparsed `WITH CHECK` back and refuses a `SELECT` in it.
--
-- ⚠️ `WITH CHECK` ONLY — NO `USING`, AND `ALTER POLICY … WITH CHECK` LEAVES
--    THE ABSENT `USING` ABSENT. `0200` §6 measured a `USING` on this policy as
--    an AUTHENTICATION OUTAGE: `resolveSubject()` reads this table in a scope
--    where no sign-in GUC is set, so a restrictive `USING` here ANDs a
--    false-by-default test into every request the product serves.
--
-- ⚠️ IT DOES NOT CHANGE WHO MAY READ. A `WITH CHECK` is not consulted by
--    `SELECT`. The only write this policy can meet is the INSERT `0200`
--    granted (there is no `UPDATE` and no `DELETE` on this table), and that
--    INSERT's only writer — `server/data-plane/session-mint-store.ts` —
--    already writes `external_subject` equal to the scope's
--    `app.external_subject`, because `user_signin_rls` already requires it.
--    So the term costs the one legitimate writer nothing, and refuses only
--    what a future, wider permissive policy might admit.
--
-- ⚠️ THE CENSUS IS THE OTHER HALF AND THE OWNER TOOK BOTH: *"defence in
--    depth, which is this repo's established pattern for authority writes."*
--    §4 of the suite pins the exact policy set on `tenant."user"`, so the
--    fifth policy is a red gate before it is a silent widening.
-- =====================================================================

ALTER POLICY user_signin_mint_restrictive ON tenant."user"
  WITH CHECK (
    external_subject = nullif(current_setting('app.external_subject', true), '')
    AND broker_issuer = nullif(current_setting('app.broker_issuer', true), '')
    AND broker_ref    = nullif(current_setting('app.broker_ref', true), '')
  );

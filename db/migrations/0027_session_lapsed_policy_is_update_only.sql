-- =====================================================================
-- 0027 · `session_lapsed_member_rls` IS `FOR UPDATE`, AND IT WAS `FOR ALL`
--
-- 🛑 THE DEFECT, PROVED BY AN ADVERSARIAL PASS AGAINST 0019 AND REPRODUCED
--    BEFORE THIS FILE WAS WRITTEN.
--
--    `CREATE POLICY … ON tenant.session USING (…) WITH CHECK (…)` with no
--    `FOR` clause defaults to **`FOR ALL`**. So 0019's `WITH CHECK` — written
--    to constrain the revoking UPDATE — governed **INSERT** as well.
--
--    Inside a `manage_roles` act, the app role could FABRICATE A PRE-REVOKED
--    SESSION ROW FOR ANOTHER PERSON, with an arbitrary `handle_digest`, an
--    arbitrary `issued_host` and a back-dated `authenticated_at`. The
--    `WITH CHECK` was satisfied: the row carried the right `tenant_id`, had
--    `revoked_at IS NOT NULL`, and the transaction held a real grant.
--
--      A · app role INSERT, pre-revoked, user_id = someone else → rowCount 1, COMMITTED
--      B · same INSERT, no authorisation record (pre-0019)      → REFUSED (RLS)
--      C · same INSERT, wrong-capability record                 → REFUSED (RLS)
--      D · migrator sees {"id":"ses_forged","user_id":"usr_ops_mei",
--                         "issued_host":"attacker.invalid","authed":"2025-08-14"}
--
--    **B is the proof it is 0019's and not inherited**: the same INSERT was
--    refused before that migration existed.
--
-- 🛑 WHY THIS IS WORSE THAN AN ORDINARY WIDENING, AND IT IS THE SAME FILE'S
--    OWN ARGUMENT TURNED AROUND. G510 revoked `DELETE` on this table on the
--    ground that *"deleting the row destroys the `revoked_at` evidence the
--    column exists to hold"* — and the same slice made it possible to
--    MANUFACTURE that evidence. A table hardened against erasing a record of
--    an act accepted a forged one.
--
--    ⚠️ AND THE ROW IS PERMANENT. `handle_digest` is `NOT NULL UNIQUE`, so a
--    forged row squats a digest that nothing can ever reclaim — `DELETE` is
--    revoked, by G510, deliberately.
--
-- ⚠️ THE ROW IS INERT FOR AUTHENTICATION and that is not the point. It is
--    pre-revoked, so `resolveSubject()` refuses it; nobody signs in with it.
--    What it corrupts is the audit surface, which is the entire reason this
--    table carries `revoked_at` rather than losing the row.
--
-- 🛑 WHY A DROP AND CREATE RATHER THAN AN `ALTER POLICY`. **`ALTER POLICY`
--    CANNOT CHANGE A POLICY'S COMMAND.** `FOR ALL` → `FOR UPDATE` is not an
--    alterable property in PostgreSQL; the policy must be dropped and
--    recreated. That is forced, not chosen.
--
--    ⚠️ AND BECAUSE IT IS A RECREATE, THE FULL EXPRESSION BELOW IS COPIED
--    VERBATIM FROM 0019 AND DIFFED AGAINST IT. The slice before this one
--    recorded that its first `ALTER POLICY` draft silently dropped 0008's
--    three-governance-list `NOT EXISTS` and *"would have parsed and silently
--    widened invariant 8 to `statutory`"*. Both the `USING` and the
--    `WITH CHECK` here are byte-identical to 0019's apart from the `FOR`
--    clause. Reproduce the equivalence:
--
--      diff <(sed -n '/CREATE POLICY session_lapsed_member_rls/,/;$/p' \
--               db/migrations/0019_membership_revocation_voids_sessions.sql \
--             | grep -v 'CREATE POLICY') \
--           <(sed -n '/CREATE POLICY session_lapsed_member_rls/,/;$/p' \
--               db/migrations/0027_session_lapsed_policy_is_update_only.sql \
--             | grep -vE 'CREATE POLICY|FOR UPDATE')
--
-- ⚠️ WHAT THIS DOES NOT CLOSE, NAMED RATHER THAN LEFT TO BE FOUND. The same
--    pass proved two further defects in 0019 and **neither is repaired here**,
--    because each is a ruling rather than a slip:
--
--      · the trigger is keyed on the `revoked_at` COLUMN, not on the
--        membership ceasing to be live — so `expires_at` is a second,
--        entirely unguarded removal path, and every other liveness predicate
--        in this schema (0005, 0008, 0018) treats expiry and revocation
--        identically;
--      · the trigger BODY carries no live-membership re-check, so with two
--        live memberships for one person — a shape 0005 deliberately supports,
--        having no `UNIQUE (tenant_id, user_id)` — the outcome FLIPS on the
--        caller's `BYPASSRLS` bit.
--
--    Both are recorded for the owner. This migration fixes the one thing that
--    is unambiguously a defect: a policy that governs a command it was never
--    written for.
--
--
-- 🛑 AND `FOR UPDATE` ALONE IS NOT THE REPAIR — MEASURED, NOT REASONED ABOUT.
--    The adversarial pass proposed *"narrowest repair is `FOR UPDATE` on the
--    policy"*, and that is correct about INSERT and INCOMPLETE about the act
--    the policy exists to permit.
--
--    `UPDATE … WHERE …` requires the target rows to be VISIBLE, and visibility
--    comes from SELECT-applicable policies. Under `FOR ALL` this policy
--    supplied both. Narrowed to `FOR UPDATE` it supplies only the update, and
--    the only other permissive policy — `session_rls` — is keyed on
--    `app.session_ref`, which an administrative act does not set. Measured on
--    a throwaway database with `FOR UPDATE` alone:
--
--      visible sessions: 0
--      visible grants  : 1
--      visible members : 0
--      update rowCount : 0      ← the revoke silently does nothing
--
--    **That is `0019`'s own vacuity failure arriving again through the fix**:
--    expected 0, voided 0, they agree, the guard passes. The anti-vacuous
--    control in `tests/db/session-forge-refused.test.ts` §2 is what caught it,
--    which is exactly why that section exists.
--
--    So the policy is split in TWO: a `FOR SELECT` carrying the same `USING`,
--    and a `FOR UPDATE` carrying the `USING` and the `WITH CHECK`. Between
--    them INSERT is admitted by neither, `DELETE` remains revoked by G510, and
--    the revoking read-then-write still works.
--
-- G88: forward-only. There is no down migration.
-- =====================================================================

DROP POLICY session_lapsed_member_rls ON tenant.session;

-- The READ half. Same `USING`, byte for byte — an administrative act must be
-- able to SEE the lapsed person's session in order to revoke it.
CREATE POLICY session_lapsed_member_read ON tenant.session
  FOR SELECT
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')
    AND NOT EXISTS (
      SELECT 1
        FROM tenant.membership m
       WHERE m.user_id    = session.user_id
         AND m.tenant_id  = session.tenant_id
         AND m.revoked_at IS NULL
         AND (m.expires_at IS NULL OR m.expires_at > now())
    )
    AND EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
         AND g.capability = 'manage_roles'
         AND g.expires_at > now()
    )
  );

-- The WRITE half. INSERT is admitted by neither policy, which is the defect
-- this migration exists to close.
CREATE POLICY session_lapsed_member_rls ON tenant.session
  FOR UPDATE
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')
    AND NOT EXISTS (
      SELECT 1
        FROM tenant.membership m
       WHERE m.user_id    = session.user_id
         AND m.tenant_id  = session.tenant_id
         AND m.revoked_at IS NULL
         AND (m.expires_at IS NULL OR m.expires_at > now())
    )
    AND EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
         AND g.capability = 'manage_roles'
         AND g.expires_at > now()
    )
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')
    AND revoked_at IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
         AND g.capability = 'manage_roles'
         AND g.expires_at > now()
    )
  );

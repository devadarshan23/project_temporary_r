-- =====================================================================
-- 0400 — A PERSON'S `email_verified` MAY BE UPGRADED, AND ONLY UPGRADED,
--        AT SIGN-IN, FROM A TOKEN THAT PROVES THE SAME ADDRESS.
--        G2941–G2946 (2 Oct 2026). G2941 IS THE OWNER'S RULING, G2908's
--        answer; the rest are DERIVED and say so.
--
-- 🛑 THE RULING, VERBATIM (G2908, 2 Oct 2026 — the owner's):
--      *"Yes, upgrade-only: a column-level UPDATE that only ever sets
--       tenant."user".email_verified false→true, only inside a sign-in
--       scope, only from a verified token for that same subject."*
--
-- WHY IT WAS OWED. `0390` §1 stores whether a person's address was proved
-- AT PROVISIONING and grants no `UPDATE`, so a person provisioned with an
-- unproved address — or provisioned before `0390`, whose `DEFAULT false`
-- answered for every existing row — could never redeem an invitation even
-- after a later token proved the same address (G2908, and
-- `tests/db/partner-invitation-redemption.test.ts` §1c asserted exactly
-- that). G2906 made every later sign-in redeem, so the stored fact became
-- the only thing between such a person and an offer made to their address.
--
-- ═══════════════════════════════════════════════════════════════════════
-- THE FOUR TERMS OF THE RULING AND WHAT HOLDS EACH ONE
-- ═══════════════════════════════════════════════════════════════════════
--
--   (1) "a column-level UPDATE"          → §2's `GRANT UPDATE (email_verified)`.
--        The database refuses every other column by PRIVILEGE, before any
--        trigger runs — `0015`'s G358 shape, a fifth time in this directory.
--   (2) "only ever sets false→true"      → §1's trigger, which sees OLD and NEW
--        (`0059`'s precedent: a POLICY sees one row, a transition is a
--        relation between two). It also requires every OTHER column to be
--        byte-identical, so the property survives a later, wider grant.
--   (3) "only inside a sign-in scope"    → NOT A NEW POLICY, AND THAT IS A
--        MEASUREMENT (G2943). `0200` §6's `user_signin_mint_restrictive` is
--        `FOR ALL`, and `0200` says why in its own voice: *"`FOR ALL`'s
--        `WITH CHECK` also governs `UPDATE`, so if a later commit grants one
--        the door test is already in place."* After `0241` its `WITH CHECK`
--        pins `external_subject` AND the broker pair to the sign-in scope's
--        three GUCs. This file is that later commit; the door test was
--        waiting for it. A second restrictive policy restating the same three
--        terms would be §5.3 — two spellings of one fence, and the copy is the
--        one that drifts. `tests/db/email-verified-upgrade.test.ts` §0 pins
--        that policy's `cmd` at `ALL` so narrowing it to `INSERT` is a red
--        gate here and not a silent loss of this term.
--   (4) "only from a verified token for that same subject" → §1's proof term.
--        The writer sets `app.proved_email` ONLY when the token's
--        `email_verified` holds AND the door's claim map says that flag
--        attests the `email` claim (G2902's `addressIsVerified`), to the
--        address the token carries. The trigger requires it to equal the
--        STORED address, case-insensitively — see G2944 below.
--
-- 🛑 G2944 — THE PROOF IS BOUND TO THE STORED ADDRESS, AND THE RULING'S
--    WORDING ALONE WOULD NOT HAVE BEEN. There is no `UPDATE` on
--    `tenant."user".email` (none is granted here either), so the stored
--    address is the one the person was PROVISIONED with. A directory can
--    change a person's address afterwards, and a token proving the NEW
--    address says nothing about the OLD one. An upgrade keyed only on "the
--    token's flag is true" would mark an address proved that no token ever
--    proved — and `0370` §3a matches invitations to the STORED address, so
--    that is exactly G2816 again, reached through the repair. The writer's
--    `UPDATE` filters on the comparison too, so a mismatch is 0 rows and the
--    sign-in proceeds unupgraded rather than failing.
--
-- ⚠️ G2945 — THE TRIGGER BINDS EVERY ROLE ROW-LEVEL SECURITY BINDS, AND NO
--    OTHER. Its gate is `rolbypassrls OR rolsuper` on `current_user` — the
--    PROPERTY "does any policy on this table apply to the caller", rather than
--    `0059`'s landmark "is `app.tenant_id` set". A migrator is already outside
--    every policy here; fencing it would buy nothing a migrator cannot undo
--    with `ALTER TABLE … DISABLE TRIGGER`, and would break the fixtures that
--    set `email_verified` both ways (`partner-invitation-redemption` §1c).
--    The request path is the app role, which is `NOBYPASSRLS` by `db/provision.ts`.
--
-- ⚠️ NO `CHECK`, NO NEW POLICY, NO `ALTER POLICY`, AND NO OTHER GRANT.
--    `0009`'s `GRANT SELECT` and `0200` §7's `GRANT INSERT` are untouched; no
--    `DELETE`, and no `UPDATE` on any other column — `status` in particular
--    stays unwritable, which `0200` §7 says in its own voice must remain
--    refusable BY NAME.
--
-- ⚠️ RECURSION, MEASURED AND NOT ARGUED. The trigger reads OLD, NEW, one GUC
--    and `pg_roles`; no policy is added; `0241`'s `WITH CHECK` reads only the
--    row's own columns and three GUCs. Witnessed against PostgreSQL 14.18: an
--    upgrade inside `withSignInScope()` commits and every policy-bearing read
--    of `tenant."user"` in the same transaction still returns —
--    `tests/db/email-verified-upgrade.test.ts` §1 and §7.
-- =====================================================================

-- ═══════════════════════════════════════════════════════════════════════
-- §1 · THE TRANSITION AND THE PROOF (G2942, G2944, G2945)
-- ═══════════════════════════════════════════════════════════════════════
CREATE FUNCTION tenant.user_email_verified_upgrade_only()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = tenant, pg_catalog
AS $$
DECLARE
  proved text := nullif(current_setting('app.proved_email', true), '');
BEGIN
  -- G2945 — a role no policy binds is not a request path.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles r
     WHERE r.rolname = current_user
       AND (r.rolbypassrls OR r.rolsuper)
  ) THEN
    RETURN NEW;
  END IF;

  -- Every column but one is byte-identical. Compared as a whole row minus
  -- the one column, so a column added later is covered without an edit here.
  IF (to_jsonb(NEW) - 'email_verified') IS DISTINCT FROM (to_jsonb(OLD) - 'email_verified') THEN
    RAISE EXCEPTION 'user_update_touches_other_column: only email_verified may change on %', OLD.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Upgrade-only: false → true, and nothing else — not true → false, and not
  -- a no-op rewrite of a fact already held.
  IF NOT (OLD.email_verified IS FALSE AND NEW.email_verified IS TRUE) THEN
    RAISE EXCEPTION 'user_email_verified_upgrade_only: % → % refused on %', OLD.email_verified, NEW.email_verified, OLD.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- G2944 — a verified token proved THIS address.
  IF proved IS NULL OR lower(proved) <> lower(OLD.email) THEN
    RAISE EXCEPTION 'user_email_verified_unproved: no verified token in this transaction proved the address of %', OLD.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER user_email_verified_upgrade_only
  BEFORE UPDATE ON tenant."user"
  FOR EACH ROW
  EXECUTE FUNCTION tenant.user_email_verified_upgrade_only();

-- ═══════════════════════════════════════════════════════════════════════
-- §2 · THE GRANT — ONE COLUMN (G2941)
-- ═══════════════════════════════════════════════════════════════════════
-- The fence and the writer land in one commit (G511):
-- `server/data-plane/session-mint-store.ts`'s `upgradeEmailVerified()`.
GRANT UPDATE (email_verified) ON tenant."user" TO tenant_rw;

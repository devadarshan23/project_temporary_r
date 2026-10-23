-- =====================================================================
-- 0390 — THREE GAPS `0370` NAMED, CLOSED. G2901–G2905 (2 Oct 2026), all
-- DERIVED and NOT THE OWNER'S, each closing a row `0370`'s slice recorded
-- as ⛔ NOT APPLIED:
--
--   G2816 → §1 + §2  an invitation was redeemable by an address the
--                    directory never PROVED
--   G2811 → §3       an EXPIRED offer still blocked re-inviting its address
--   G2808 →          (no SQL — `listPartnerPeople` reads the open offers
--                    through `0321`'s own `partner_invitation_read_rls`)
--
-- ═══════════════════════════════════════════════════════════════════════
-- §1 · THE PERSON CARRIES WHETHER THEIR ADDRESS WAS PROVED (G2902)
-- ═══════════════════════════════════════════════════════════════════════
--
-- `0370` §3a matches an invitation to a sign-in by `lower(u.email)`, and that
-- address is the door's projection of a claim the DIRECTORY makes. Most
-- directories let a person set an address they have not confirmed, so until
-- this file anybody at a firm's door could type a colleague-to-be's address
-- and receive the role that person was offered — witnessed RED at
-- `tests/db/partner-invitation-redemption.test.ts` §9.
--
-- 🛑 WHAT PROVISIONING STORES IS BOTH — THE ADDRESS AND THE FACT — AND THE
--    REJECTED ALTERNATIVE IS PRESERVED. Storing NULL for an unproved address
--    would turn a directory's configuration into a person with no address on
--    the roster, and `email` is `NOT NULL` besides. Storing the address
--    ALONE is what made G2816 possible: every reader takes the column as
--    proved. So the column says which it is.
--
-- ⚠️ `NOT NULL DEFAULT false`, AND THE DEFAULT IS THE FAIL-CLOSED ARM FOR
--    EVERY EXISTING ROW. A person provisioned before this file was never
--    asked; `false` costs them nothing they could have had, because only a
--    FIRST sign-in redeems (G2810) and theirs has happened. Seeds and every
--    migrator INSERT that names no value are unproved by construction.
--
-- ⚠️ NO NEW GRANT: `0200` §7's `GRANT INSERT ON tenant."user"` is
--    table-level and covers a column added later; `0009`'s `SELECT` likewise.
--    And no `UPDATE` — a path that could flip this column could prove an
--    address by writing a boolean.
-- ---------------------------------------------------------------------
ALTER TABLE tenant."user"
  ADD COLUMN email_verified boolean NOT NULL DEFAULT false;

-- ═══════════════════════════════════════════════════════════════════════
-- §2 · THE REDEMPTION FENCE REFUSES AN UNPROVED ADDRESS BY NAME (G2901)
-- ═══════════════════════════════════════════════════════════════════════
--
-- `0370` §4's trigger function, replaced WHOLE with ONE new term — the
-- function, not the trigger, which is `0140`'s precedent (`0059` is not
-- edited and neither is `0370`: G88). Every other term is byte-for-byte
-- `0370`'s; `tests/db/partner-invitation-redemption.test.ts` §7 still breaks
-- each one in turn.
--
-- 🛑 THE TERM IS IN THE DATABASE AND NOT ONLY IN THE WRITER, for `0370`'s
--    own reason (G2638): *"a belt that passes with the braces cut is not
--    evidence about the braces."* The writer pre-filters nothing; it
--    attempts, and this refuses — so there is ONE enforcement and the suite
--    can cut it and watch the role be conferred (§9b).
--
-- ⚠️ IT READS `tenant."user"` FROM A TRIGGER, AND THAT IS NOT `0370`'s
--    RECURSION: G2804's cycle was a POLICY on the assignment reading a table
--    whose own policy reads the assignment. A trigger body is not part of any
--    policy's expansion, and this same function already reads
--    `partner_invitation`, whose `0370` §3a policy reads `"user"`. §0 of the
--    suite reads every table inside a redemption transaction and §9 redeems.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tenant.partner_role_assignment_redeems_an_invitation()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = tenant, pg_catalog
AS $$
DECLARE
  inv tenant.partner_invitation%ROWTYPE;
BEGIN
  -- The migrator's seeds and every pre-0370 row: nothing to redeem. The app
  -- role cannot reach this arm — §4's permissive policy requires an invitation.
  IF NEW.invitation_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO inv FROM tenant.partner_invitation WHERE id = NEW.invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'partner_invitation_not_redeemable: % is not an invitation this sign-in may redeem', NEW.invitation_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 0390 §2 — G2901. ASKED BEFORE THE CLOCK, so an address nobody proved
  -- learns nothing about the offer it matched. `NEW.user_id` is pinned to the
  -- session's person by `0370` §4's permissive policy; the row is read under
  -- `user_signin_rls`, and an UNREADABLE row is a refusal, never a pass.
  IF NOT EXISTS (
    SELECT 1 FROM tenant."user" u
     WHERE u.id = NEW.user_id
       AND u.email_verified
  ) THEN
    RAISE EXCEPTION 'partner_invitation_email_unverified: % has no address its directory proved', NEW.user_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF inv.expires_at <= now() THEN
    RAISE EXCEPTION 'partner_invitation_expired: % stopped standing at %', inv.id, inv.expires_at
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.partner_id   IS DISTINCT FROM inv.partner_id
     OR NEW.role_id      IS DISTINCT FROM inv.role_id
     OR NEW.role_version IS DISTINCT FROM inv.role_version
     OR NEW.granted_by   IS DISTINCT FROM inv.invited_by
     OR NEW.expires_at   IS DISTINCT FROM inv.assignment_expires_at THEN
    RAISE EXCEPTION 'partner_invitation_terms_disagree: the assignment does not copy % verbatim', inv.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.user_id = inv.invited_by THEN
    RAISE EXCEPTION 'partner_invitation_self: % would redeem their own invitation', NEW.user_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM tenant.partner_role r
     WHERE r.id         = inv.role_id
       AND r.partner_id = inv.partner_id
       AND r.status     = 'active'
       AND r.version    = inv.role_version
  ) THEN
    RAISE EXCEPTION 'partner_invitation_role_moved: % is no longer active at version %', inv.role_id, inv.role_version
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM tenant.partner_role_capability conferred
     WHERE conferred.role_id = inv.role_id
       AND NOT EXISTS (
         SELECT 1
           FROM tenant.partner_role_assignment a
           JOIN tenant.partner_role ar           ON ar.id = a.role_id AND ar.partner_id = a.partner_id
           JOIN tenant.partner_role_capability h ON h.role_id = a.role_id
          WHERE a.user_id     = inv.invited_by
            AND a.partner_id  = inv.partner_id
            AND a.revoked_at IS NULL
            AND a.expires_at  > now()
            AND ar.status     = 'active'
            AND ar.version    = a.role_version
            AND h.capability  = conferred.capability
       )
  ) THEN
    RAISE EXCEPTION 'partner_invitation_inviter_lacks_verb: % no longer holds every verb % confers', inv.invited_by, inv.role_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- §3 · ONE STANDING OFFER PER ADDRESS, NOT ONE OFFER FOR EVER (G2903)
-- ═══════════════════════════════════════════════════════════════════════
--
-- `0321`'s `partner_invitation_one_per_address` is UNIQUE on
-- `(partner_id, lower(email))` with no state, so a lapsed offer refused
-- every re-invitation of its address with a 422, for ever — there is no
-- revoke and no re-issue, and nothing could delete it.
--
-- 🛑 A PARTIAL INDEX CANNOT SAY "STANDING": `WHERE expires_at > now()` is
--    refused, because an index predicate must be IMMUTABLE and `now()` is
--    not. TWO SHAPES WERE CONSIDERED AND ARE REFUSED BY NAME:
--
--   · AN EXCLUSION CONSTRAINT over `tstzrange(invited_at, expires_at)` —
--     correct, and it needs `btree_gist` for the text equality. No migration
--     here creates an extension, the migrator is not a superuser, and a
--     deploy-time extension is an infrastructure decision this slice does
--     not get to take.
--   · A `superseded_by` COLUMN set on re-invite — an `UPDATE` on the
--     invitation, which `0321` refuses outright (*"an invitation re-pointed
--     at a stronger role is an escalation the `WITH CHECK` never saw"*).
--
-- WHAT IS TAKEN: a `BEFORE INSERT` trigger that refuses a new offer while
-- another for the same firm and address is STANDING (`expires_at > now()`),
-- under a transaction-scoped ADVISORY LOCK keyed on that pair.
--
-- ⚠️ THE LOCK IS THE HALF THE UNIQUE INDEX USED TO GIVE FOR FREE. Without
--    it two concurrent invitations to one address both see nothing and both
--    commit — and `partner-redemption-store.ts` THROWS on two standing
--    offers rather than choose a role. Under READ COMMITTED a VOLATILE
--    plpgsql function takes a fresh snapshot per statement, so the `SELECT`
--    after the lock sees the first writer's committed row. §10c holds two
--    real connections against each other.
--
-- ⚠️ IT READS UNDER THE INVITER'S RLS, AND THAT CANNOT FAIL OPEN. The row
--    can only be written if `0321`'s write policy holds — NEW.partner_id is
--    the firm a live `manage_partner_staff` record names — and that same
--    record is exactly what `partner_invitation_read_rls` admits that firm's
--    rows under. Either the INSERT is refused by policy, or this read saw
--    every offer the firm has. The migrator, which bypasses RLS, sees all.
--
-- ⚠️ SINGLE USE IS UNTOUCHED: it was never this index — it is `0370` §2's
--    UNIQUE on `partner_role_assignment.invitation_id`, one assignment per
--    offer. A re-invitation is a NEW offer, made by a person holding the verb
--    under a NEW record (G2812); a REDEEMED offer that is still standing
--    blocks a re-invite exactly as an open one does.
--
-- ⚠️ THE ERROR IS `unique_violation` (23505), DELIBERATELY: it is the
--    condition the index used to raise, so the writer's existing mapping —
--    `partner_person_already_invited`, a 422 — is unchanged in meaning.
-- ---------------------------------------------------------------------
DROP INDEX tenant.partner_invitation_one_per_address;

CREATE FUNCTION tenant.partner_invitation_one_standing_offer()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = tenant, pg_catalog
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('partner_invitation:' || NEW.partner_id || ':' || lower(NEW.email), 0)
  );
  IF EXISTS (
    SELECT 1
      FROM tenant.partner_invitation i
     WHERE i.partner_id   = NEW.partner_id
       AND lower(i.email) = lower(NEW.email)
       AND i.expires_at   > now()
  ) THEN
    RAISE EXCEPTION 'partner_invitation_offer_standing: % already holds a standing offer from %', lower(NEW.email), NEW.partner_id
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER partner_invitation_one_standing_offer
  BEFORE INSERT ON tenant.partner_invitation
  FOR EACH ROW
  EXECUTE FUNCTION tenant.partner_invitation_one_standing_offer();

-- A plain (non-unique) index for the trigger's read and for the redemption
-- policy's `(partner_id, lower(email))` comparison, which the dropped UNIQUE
-- index used to serve.
CREATE INDEX partner_invitation_by_address
  ON tenant.partner_invitation (partner_id, lower(email));

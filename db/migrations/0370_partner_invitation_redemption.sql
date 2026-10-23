-- =====================================================================
-- 0370 — A PARTNER INVITATION IS REDEEMED AT FIRST SIGN-IN. G2801–G2816
-- (2 Oct 2026). THE OWNER'S RULING, verbatim:
--
--     *"Drop `name` from invitePartnerPerson's 201 (filled at redemption).
--     Then mount it and build invitation redemption at first sign-in."*
--
-- `0321` (G2629) built the invitation and said, in its own voice, what it
-- owed: *"Redemption — the act that turns an invitation into an assignment at
-- first sign-in — is OWED, and it is where that grant lands, with its own
-- `WITH CHECK`, in one commit (G511)."* This file is that grant, that fence and
-- — with `server/data-plane/partner-redemption-store.ts` — that writer.
--
-- WHAT IT ADDS, IN FIVE SECTIONS:
--
--   §1  three columns on `partner_invitation`: the OFFER's end, the ROLE's
--       end, and the `manage_partner_staff` record the offer was made under —
--       plus two CHECKs and one restrictive policy that bound the first two
--   §2  one column and one UNIQUE index on `partner_role_assignment`: the
--       invitation an assignment was redeemed from. SINGLE USE IS THE INDEX
--   §3  three SELECT policies, each `FOR SELECT`, each inert outside a
--       sign-in transaction
--   §4  `GRANT INSERT ON partner_role_assignment`, one permissive INSERT
--       policy, and a `BEFORE INSERT` TRIGGER that is the no-escalation fence
--   §5  nothing else: NO `UPDATE`, NO `DELETE`, on either table
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE FENCE IS A TRIGGER AND NOT A `WITH CHECK`, AND THAT WAS MEASURED
--    AGAINST A LIVE POSTGRESQL 14.18 BEFORE THIS FILE WAS TRUSTED (G2804).
-- ═══════════════════════════════════════════════════════════════════════
--
-- The re-check needs four facts — the invitation, the redeemer's own person
-- row, the role invited into, and the INVITER's live roles. As a `WITH CHECK`
-- on `partner_role_assignment` every one of them closes a cycle through a
-- second table's `USING`:
--
--   assignment INSERT → partner_role         → partner_role_rls reads ASSIGNMENT
--   assignment INSERT → "user"               → user_partner_directory_rls reads ASSIGNMENT
--   assignment INSERT → partner_invitation   → (§3a) "user" → ASSIGNMENT
--
-- which is G2623's finding exactly: *"G449's 'a WITH CHECK subquerying its own
-- table does NOT recurse' is true of a direct self-reference and false of one
-- that closes through a second table's `USING`."* Measured, not inferred: a
-- `WITH CHECK` draft reading `partner_role` answered `infinite recursion
-- detected in policy for relation "partner_role_assignment"` (42P17) on the
-- first redemption. A `BEFORE INSERT` trigger's queries are separate
-- statements, so the assignment table is not on the rewriter's expansion
-- stack. Invoker rights (G160), read back from `pg_proc.prosecdef` by the suite.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE INVITER'S ROLES ARE MADE VISIBLE BY TWO GUCs, AND A FORGED VALUE IS
--    INERT IN THE ONLY DIRECTION THAT MATTERS (G2805).
-- ═══════════════════════════════════════════════════════════════════════
--
-- The re-check reads ANOTHER PERSON's assignments — the inviter's — inside the
-- REDEEMER's sign-in transaction, where `0250` hides every row but the acting
-- session's own. The obvious key is the invitation row itself (*"the inviter
-- this invitation names"*) and it is REFUSED ON A MEASUREMENT: a policy on
-- `partner_role_assignment` that reads `partner_invitation` puts the
-- assignment table inside `0321` §5's own expansion — the INVITATION's
-- no-escalation `WITH CHECK` reads assignments — and every `invitePartnerPerson`
-- answered `infinite recursion detected in policy for relation
-- "partner_invitation"`. So §3b and §3c key on `app.redeeming_partner` and
-- `app.redeeming_inviter`, which `redeemPartnerInvitation()` sets from the
-- invitation row it has just read.
--
-- A GUC is a value the SERVER supplies, never a person. And a wrong one makes
-- the inviter's roles INVISIBLE, which the trigger reads as *"holds nothing"*
-- and REFUSES — the fail-closed direction. It cannot make a refusal pass,
-- because the trigger compares every term against the INVITATION ROW, not
-- against the GUC. What a forged value buys is a read of one named person's
-- portal roles inside a server-held transaction that publishes nothing — and
-- only inside a sign-in transaction, because both policies also require
-- `app.signin_ref`, which only `withSignInScope()` sets.
--
-- ═══════════════════════════════════════════════════════════════════════
-- ⚠️ THE DATABASE PERMITS REDEMPTION IN ANY SIGN-IN TRANSACTION FOR THE
--    SESSION'S OWN PERSON; "AT FIRST SIGN-IN" IS THE WRITER'S (G2810).
-- ═══════════════════════════════════════════════════════════════════════
--
-- The ruling names first sign-in, and `mintFederatedSession()` calls the
-- redeemer only on the provisioning path. Nothing here forbids a later
-- ruling from redeeming for a person who already existed — DORA, signed in at
-- her firm's door before she was invited, is that person — and nothing here
-- needs to: every term below is about the invitation and the inviter, none
-- about whether the person is new. That gap is NAMED in G2810, not closed.
-- =====================================================================


-- ---------------------------------------------------------------------
-- §1 · THE OFFER, BOUNDED — and the record it was made under.
--
-- `expires_at`            when the OFFER stops standing. *"An open-ended
--                         grant is not a grant"*, `PartnerAccessGrant`'s rule,
--                         which `model/domain.ts`'s `Invitation.expiresAt`
--                         restates for an offer *"made to somebody who does
--                         not exist to the system yet"*.
-- `assignment_expires_at` when the ROLE it confers ends. Copied VERBATIM onto
--                         the assignment at redemption, exactly as
--                         `Invitation.membershipExpiresAt` is — decided at
--                         invitation time, never at redemption. NOT NULL
--                         because `DURABLE_ASSIGNMENT_PERMITTED.partner` is
--                         `false` and `0250` stores no never-expiring row.
-- `authorization_id`      the `manage_partner_staff` record the offer was
--                         made under — G229's `Invitation.grantId`, one table
--                         over: *"The authorising act is theirs and it is
--                         recorded before the invitee has done anything at
--                         all."* An assignment redeemed later traces through
--                         this column to an invariant 10 record.
--
-- ⚠️ ALL THREE ARE `NOT NULL` WITH NO DEFAULT, AND THE REFUSAL AGAINST A TABLE
--    HOLDING A ROW IS WANTED — `0140` §2's precedent. Nothing could write one:
--    `invitePartnerPerson` was unmounted (G2630), so the table is empty in
--    every deployed database.
--
-- 🛑 THE NUMBERS ARE BOUNDED HERE AS WELL AS IN THE MODEL (G2803), AND THE
--    MIRROR IS A TEST, NOT A HOPE. `PARTNER_INVITATION_OFFER_SECONDS` and
--    `PARTNER_INVITED_ROLE_SECONDS` in `model/partner-portal.ts` are what the
--    writer applies; the two CHECKs are what a writer cannot exceed.
--    `tests/db/partner-invitation-redemption.test.ts` §6 derives both
--    intervals from the model constants and requires the catalogue to agree,
--    so a constant moved on one side is a red gate — `0008`'s mirror
--    discipline. Without the CHECKs an app-role INSERT could name a role that
--    lasts a century, and redemption would copy it verbatim.
-- ---------------------------------------------------------------------
ALTER TABLE tenant.partner_invitation
  ADD COLUMN expires_at            timestamptz NOT NULL,
  ADD COLUMN assignment_expires_at timestamptz NOT NULL,
  ADD COLUMN authorization_id      text        NOT NULL;

ALTER TABLE tenant.partner_invitation
  ADD CONSTRAINT partner_invitation_offer_bounded
    CHECK (expires_at > invited_at AND expires_at <= invited_at + interval '14 days'),
  ADD CONSTRAINT partner_invitation_role_bounded
    CHECK (assignment_expires_at > expires_at
           AND assignment_expires_at <= invited_at + interval '90 days');

-- The clock and the receipt are the TRANSACTION's, not the caller's: a
-- backdated `invited_at` would move both bounds, and an `authorization_id`
-- naming some other record would launder this offer through it. RESTRICTIVE,
-- so the permissive `partner_invitation_write_rls` (`0321`) is not re-typed —
-- `0020`'s rule: an `ALTER POLICY` that re-types an expression can mistype it.
CREATE POLICY partner_invitation_clock_and_receipt ON tenant.partner_invitation
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    invited_at = now()
    AND authorization_id = nullif(current_setting('app.authorisation_ref', true), '')
  );


-- ---------------------------------------------------------------------
-- §2 · SINGLE USE IS A UNIQUE INDEX (G2802).
--
-- 🛑 AN INVITATION REDEEMED TWICE IS UNREPRESENTABLE, NOT REFUSED. The obvious
--    shape is a `redeemed_at` column on the invitation and a column-level
--    `GRANT UPDATE` to set it — G358's shape — and it is REFUSED for two
--    reasons. It is a second write in the redemption transaction that could be
--    forgotten while the first succeeds; and `0321` refused `UPDATE` on this
--    table outright (*"an invitation re-pointed at a stronger role is an
--    escalation the WITH CHECK never saw"*), which a column grant would begin
--    to spend. A UNIQUE index is not subject to RLS, so a second redemption
--    is a `23505` whoever can or cannot see the first assignment.
--
-- ⚠️ THE FOREIGN KEY IS CHECKED BY REFERENTIAL INTEGRITY, WHICH RUNS AS THE
--    TABLE OWNER WITH ROW SECURITY BYPASSED — so it proves the invitation
--    EXISTS and nothing about whether the redeemer may see it. The trigger is
--    what asks that.
-- ---------------------------------------------------------------------
ALTER TABLE tenant.partner_role_assignment
  ADD COLUMN invitation_id text REFERENCES tenant.partner_invitation (id);

CREATE UNIQUE INDEX partner_role_assignment_one_per_invitation
  ON tenant.partner_role_assignment (invitation_id);


-- ---------------------------------------------------------------------
-- §3 · VISIBILITY, AND ONLY INSIDE A SIGN-IN TRANSACTION.
--
-- Every policy here is `FOR SELECT` — G1982 and `0027`: a `FOR ALL` policy
-- with no `WITH CHECK` reuses its `USING` as the INSERT check.
-- ---------------------------------------------------------------------

-- §3a · THE REDEEMER'S OWN INVITATION, KEYED ON DATABASE FACTS AND NO GUC.
--       An invitation is visible iff its FIRM is the owner of the door this
--       sign-in came through and its ADDRESS is the address the door's claim
--       map projected onto the person this session belongs to — the person
--       row R5 has just written, from a VERIFIED token (G2806).
--
--       ⚠️ IT READS `session`, `"user"` AND `identity_connection`, AND NONE OF
--       THEIR POLICIES READS `partner_invitation` — `tests/db/partner-invitation-
--       redemption.test.ts` §0 re-witnesses that on every run, from every
--       table this file touches, inside a sign-in transaction and a portal act.
--
--       ⚠️ "THE SAME DOOR" IS THE FIRM'S DOOR. An invitation is per FIRM
--       (`0321`), a firm may hold more than one door, and the column that
--       decides is `owner_partner_id` on the door the SESSION names — a
--       customer-owned door has no partner and matches no invitation.
CREATE POLICY partner_invitation_redemption_rls ON tenant.partner_invitation
  FOR SELECT
  USING (
    nullif(current_setting('app.signin_ref', true), '') IS NOT NULL
    AND (partner_id, lower(email)) = (
      SELECT c.owner_partner_id, lower(u.email)
        FROM tenant.session s
        JOIN tenant."user" u              ON u.id = s.user_id
        JOIN tenant.identity_connection c ON c.id = s.connection_id
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
         AND c.owner_kind    = 'partner'
    )
  );

-- §3b · THE INVITER'S ROLES, under the two redemption GUCs — see the head.
CREATE POLICY partner_role_assignment_redemption_rls ON tenant.partner_role_assignment
  FOR SELECT
  USING (
    nullif(current_setting('app.signin_ref', true), '') IS NOT NULL
    AND partner_id = nullif(current_setting('app.redeeming_partner', true), '')
    AND user_id    = nullif(current_setting('app.redeeming_inviter', true), '')
  );

-- §3c · THE FIRM'S ROLE CATALOGUE — roles, not people — so the trigger can
--       read the role invited into and the inviter's roles. The capability
--       table follows `partner_role` unchanged (`0250`'s
--       `partner_role_capability_rls`).
CREATE POLICY partner_role_redemption_rls ON tenant.partner_role
  FOR SELECT
  USING (
    nullif(current_setting('app.signin_ref', true), '') IS NOT NULL
    AND partner_id = nullif(current_setting('app.redeeming_partner', true), '')
  );


-- ---------------------------------------------------------------------
-- §4 · THE WRITE: one grant, one permissive policy, one trigger.
--
-- The PERMISSIVE policy says WHO and WHERE: an assignment for the person this
-- sign-in session belongs to, inside a sign-in transaction, carrying an
-- invitation, granted now and not revoked. Every other term is the TRIGGER's.
-- It reads `session` and nothing else, so it closes no cycle.
--
-- 🛑 `invitation_id IS NOT NULL` IS WHAT MAKES THIS GRANT NARROW TO THE
--    REDEMPTION PATH. Without it the app role could write an assignment with
--    no invitation behind it, and the trigger — which returns early for a NULL
--    so the migrator's seeds still load — would have nothing to check.
-- ---------------------------------------------------------------------
CREATE POLICY partner_role_assignment_redemption_write ON tenant.partner_role_assignment
  FOR INSERT
  WITH CHECK (
    nullif(current_setting('app.signin_ref', true), '') IS NOT NULL
    AND invitation_id IS NOT NULL
    AND revoked_at IS NULL
    AND granted_at = now()
    AND user_id = (
      SELECT s.user_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
  );

-- 🛑 NO ESCALATION, RE-CHECKED AT REDEMPTION. Six refusals, each named so the
--    writer can report which one fired and the suite can witness each RED:
--
--   not_redeemable      the invitation is not visible to this sign-in — wrong
--                       address, wrong firm's door, or no such row
--   expired             the offer's own clock has run out
--   terms_disagree      the assignment does not copy the invitation verbatim
--                       (firm, role, pinned version, inviter, the role's end)
--   self                the redeemer IS the inviter
--   role_moved          the role invited into is archived or re-versioned
--   inviter_lacks_verb  the inviter no longer holds, LIVE, in this firm,
--                       through an active role whose pin has not moved, every
--                       verb the role confers — `0321` §5 term (b) at the
--                       moment it matters a second time
--
-- ⚠️ ERRCODE `insufficient_privilege` FOR ALL SIX, WITH THE REFUSAL AS THE
--    FIRST WORD OF THE MESSAGE: the writer maps a closed vocabulary, and a
--    message it does not recognise is a THROW, never a guessed refusal.
CREATE FUNCTION tenant.partner_role_assignment_redeems_an_invitation()
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

CREATE TRIGGER partner_role_assignment_redeems_an_invitation
  BEFORE INSERT ON tenant.partner_role_assignment
  FOR EACH ROW
  EXECUTE FUNCTION tenant.partner_role_assignment_redeems_an_invitation();


-- ---------------------------------------------------------------------
-- §5 · GRANTS. `INSERT` on the assignment — the writer is
-- `server/data-plane/partner-redemption-store.ts`, in this commit (G511).
-- STILL NO `UPDATE` AND NO `DELETE` on any of `0250`'s three or on the
-- invitation: `0250`'s *"a request path that could write role_assignment could
-- grant itself any capability in the closed set"* is answered by §4, not
-- waived — the only row this grant can write is one an invitation named.
-- ---------------------------------------------------------------------
GRANT INSERT ON tenant.partner_role_assignment TO tenant_rw;

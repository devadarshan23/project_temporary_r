-- =====================================================================
-- 0321 — A PARTNER FIRM'S OWN DIRECTORY, AND ITS INVITATION WRITER.
-- G2624–G2632 (1 Oct 2026). G2624 IS THE OWNER'S RULING, taking G447 for
-- partners:
--
--     *"A narrow SELECT policy on tenant."user" admitting rows with an
--     assignment in the same partner firm, only when the transaction carries
--     an authorisation record for view_partner_staff (0018's
--     administrative-directory shape)."*
--
-- 🛑 IT IS `0018`'s SHAPE, AND THE RECEIPT IS `0320`'s ROW RATHER THAN A FLAG.
--    `0018` keys the tenant directory on `tenant.authorization_grant` named by
--    `app.authorisation_ref`; here the receipt is the partner home's row,
--    named the same way by `writePartnerAuthorisationRecord()`. **A forged
--    name is INERT**: `0320` §2 refuses a record for a firm in which the actor
--    holds no live role carrying the verb, so pointing the GUC at a row the
--    actor could not have minted is pointing it at nothing — and the read
--    policy of `partner_authorization_grant` hides every other person's row
--    besides.
--
-- 🛑 FOUR POLICIES, NOT ONE, BECAUSE THE RULING'S ONE POLICY IS NOT READABLE
--    ON ITS OWN. The roster joins a person to an assignment to a role, and
--    `0250` keys the assignment and the role on the SESSION — so a policy on
--    `tenant."user"` admitting *"rows with an assignment in the same partner
--    firm"* would find NO such assignment, because the colleague's assignment
--    row is invisible to the reader. Measured, not inferred: with §1 alone
--    applied, ANA's `view_partner_staff` act read ONE person — herself, through
--    `user_visible_to_session`. So the same receipt opens, narrowly and in the
--    same firm only:
--
--      §1  `tenant."user"`                  — the ruling, verbatim in shape
--      §2  `tenant.partner_role_assignment` — the colleague's assignment
--      §3  `tenant.partner_role`            — the firm's role CATALOGUE
--      §4  `tenant.partner_invitation`      — the firm's open invitations
--
--    ⚠️ `0250`'s §2 test — *"a colleague at the SAME firm is invisible"* — STILL
--    HOLDS AND IS UNCHANGED, because it reads in a session scope with no
--    receipt. What this file opens exists only for the life of one act's
--    transaction, and only for the firm that act's record names.
--
-- 🛑 THE RECURSION HAZARD WAS RE-MEASURED AGAINST A LIVE POSTGRESQL BEFORE
--    THIS FILE WAS TRUSTED — the owner's instruction, and `0200`'s lesson:
--    *"does this policy name its own table"* is a LANDMARK; the property is
--    *"is this relation reachable from its own policy expansion"*. `0200`'s
--    first draft answered `infinite recursion detected in policy for relation
--    "user"` eleven times of eleven, through `identity_connection`. The
--    expansion here, walked edge by edge:
--
--      user        → partner_role_assignment, partner_authorization_grant
--      assignment  → session (own arm), partner_authorization_grant (§2)
--      grant       → session (read and write policies)
--      role        → assignment (0250), partner_authorization_grant (§3)
--      session     → membership, tenant_access_grant, authorization_grant
--
--    No policy reachable from `tenant."user"` reads `tenant."user"` or
--    `tenant.identity_connection`. ⚠️ AND ONE CYCLE THAT THIS FILE DID CLOSE WAS
--    FOUND HERE AND REPAIRED IN `0320`: `0320`'s first draft checked the
--    receipt's firm-and-verb term in its INSERT `WITH CHECK`, reading the
--    assignment and role tables — which §2 and §3 below make read the receipt.
--    Every portal act answered `infinite recursion detected in policy for
--    relation "partner_authorization_grant"`; the term is a trigger now, and
--    `0320` §2 records why. `tests/db/partner-directory.test.ts` §0
--    re-witnesses it on every run, from EVERY table this file touches, rather
--    than trusting this paragraph.
--
-- ⚠️ THE INVITATION IS ITS OWN TABLE AND `partner_role_assignment` GETS NO
--    `INSERT`, WHICH DEPARTS FROM THE BRIEF THIS SLICE WAS GIVEN AND IS ARGUED
--    RATHER THAN QUIETLY TAKEN (G2629). An invitation names an EMAIL; an
--    assignment needs a `user_id`, and a person invited by email has no
--    `tenant."user"` row until they first sign in (R5 auto-provisions on first
--    sign-in). A `GRANT INSERT` on the assignment table with no request path
--    able to name a `user_id` is `0004`'s refusal — a write privilege ahead of
--    its writer. **Redemption — the act that turns an invitation into an
--    assignment at first sign-in — is OWED, and it is where that grant lands,
--    with its own `WITH CHECK`, in one commit (G511).**
-- =====================================================================

-- ---------------------------------------------------------------------
-- §1 · THE RULING. A person is visible iff they hold an assignment in the
--      firm this act's `view_partner_staff` record names.
--
-- ⚠️ ANY assignment, live or not: a revoked or expired colleague is part of
--    the roster an administrator reads (`state` says which), and filtering
--    them out here would make the reader unable to report the departed
--    employee the contract calls *"a real hole with a real consequence"*.
-- ---------------------------------------------------------------------
CREATE POLICY user_partner_directory_rls ON tenant."user"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
        FROM tenant.partner_role_assignment a
       WHERE a.user_id = "user".id
         AND a.partner_id = (
           SELECT g.partner_id
             FROM tenant.partner_authorization_grant g
            WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
              AND g.capability = 'view_partner_staff'
              AND g.expires_at > now()
         )
    )
  );

-- ---------------------------------------------------------------------
-- §2 · THE COLLEAGUE'S ASSIGNMENT, in the same firm, under the same receipt.
-- ---------------------------------------------------------------------
CREATE POLICY partner_role_assignment_directory_rls ON tenant.partner_role_assignment
  FOR SELECT
  USING (
    partner_id = (
      SELECT g.partner_id
        FROM tenant.partner_authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.capability = 'view_partner_staff'
         AND g.expires_at > now()
    )
  );

-- ---------------------------------------------------------------------
-- §3 · THE FIRM'S ROLE CATALOGUE — roles, not people — under a staff
--      receipt of EITHER verb. The invitation writer needs it to name the
--      role it confers (and to fail CLOSED on one it cannot see; see §5),
--      and the roster needs it to label a colleague's role.
--      `partner_role_capability_rls` follows it unchanged: a role visible
--      here makes its verbs visible.
-- ---------------------------------------------------------------------
CREATE POLICY partner_role_catalogue_rls ON tenant.partner_role
  FOR SELECT
  USING (
    partner_id = (
      SELECT g.partner_id
        FROM tenant.partner_authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.capability IN ('view_partner_staff', 'manage_partner_staff')
         AND g.expires_at > now()
    )
  );

-- ---------------------------------------------------------------------
-- §4 · THE INVITATION. Five columns of fact and nothing a redeemer would
--      write: no `redeemed_at`, no `user_id`, no `revoked_at` — each a column
--      ahead of its writer (`0004`). No `name`: the request carries none, and
--      that absence is why `invitePartnerPerson` is NOT MOUNTED (its 201 is a
--      `PartnerPerson`, and `name` is `required` there — G2630).
-- ---------------------------------------------------------------------
CREATE TABLE tenant.partner_invitation (
  id           text        NOT NULL PRIMARY KEY,
  partner_id   text        NOT NULL,
  email        text        NOT NULL,
  role_id      text        NOT NULL,
  -- PINNED, as an assignment pins it: the role invited INTO is the version
  -- whose verbs the inviter was checked against, not whatever it grows into.
  role_version integer     NOT NULL,
  invited_by   text        NOT NULL,
  invited_at   timestamptz NOT NULL,

  -- G576's shape again: the invitation and its role cannot name two firms.
  FOREIGN KEY (role_id, partner_id)
    REFERENCES tenant.partner_role (id, partner_id)
);

-- One open invitation per address per firm. Re-inviting is a 422, not a
-- second row an eventual redeemer would have to choose between.
CREATE UNIQUE INDEX partner_invitation_one_per_address
  ON tenant.partner_invitation (partner_id, lower(email));

ALTER TABLE tenant.partner_invitation ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.partner_invitation FORCE  ROW LEVEL SECURITY;

CREATE POLICY partner_invitation_read_rls ON tenant.partner_invitation
  FOR SELECT
  USING (
    partner_id = (
      SELECT g.partner_id
        FROM tenant.partner_authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.capability IN ('view_partner_staff', 'manage_partner_staff')
         AND g.expires_at > now()
    )
  );

-- The PERMISSIVE write: the inviter is the acting person, and the firm is
-- the one their `manage_partner_staff` record names.
CREATE POLICY partner_invitation_write_rls ON tenant.partner_invitation
  FOR INSERT
  WITH CHECK (
    invited_by = (
      SELECT s.user_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
    AND partner_id = (
      SELECT g.partner_id
        FROM tenant.partner_authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.capability = 'manage_partner_staff'
         AND g.expires_at > now()
    )
  );

-- ---------------------------------------------------------------------
-- §5 · NO ESCALATION — a RESTRICTIVE `WITH CHECK` with NO `USING`, `0020`'s
--      shape for `role_assignment`, so a permissive INSERT policy somebody
--      adds later cannot route around it. Three terms:
--
--   (a) THE ROLE IS REAL, ACTIVE, PINNED AND THIS FIRM'S — and VISIBLE, which
--       is the term that makes (b) mean anything. (b) is a `NOT EXISTS` over
--       the role's verbs; over an INVISIBLE role it would be a `NOT EXISTS`
--       over nothing, and would PASS. (a) turns that fail-open into a refusal.
--   (b) EVERY VERB THE ROLE CONFERS IS ONE THE INVITER HOLDS LIVE, in this
--       firm, through an active role whose pin has not moved — `canGrant()`'s
--       rule. A partner user cannot invite an administrator; an administrator
--       whose own role lost a verb cannot confer it.
--   (c) NOT SELF. An invitation to the inviter's own address is refused; a
--       NULL comparison (the inviter's own row unreadable) refuses too, since
--       a policy expression that is not TRUE is a refusal.
-- ---------------------------------------------------------------------
CREATE POLICY partner_invitation_no_escalation ON tenant.partner_invitation
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM tenant.partner_role r
       WHERE r.id         = partner_invitation.role_id
         AND r.partner_id = partner_invitation.partner_id
         AND r.status     = 'active'
         AND r.version    = partner_invitation.role_version
    )
    AND NOT EXISTS (
      SELECT 1
        FROM tenant.partner_role_capability conferred
       WHERE conferred.role_id = partner_invitation.role_id
         AND NOT EXISTS (
           SELECT 1
             FROM tenant.partner_role_assignment a
             JOIN tenant.partner_role ar           ON ar.id = a.role_id AND ar.partner_id = a.partner_id
             JOIN tenant.partner_role_capability h ON h.role_id = a.role_id
            WHERE a.user_id     = partner_invitation.invited_by
              AND a.partner_id  = partner_invitation.partner_id
              AND a.revoked_at IS NULL
              AND a.expires_at  > now()
              AND ar.status     = 'active'
              AND ar.version    = a.role_version
              AND h.capability  = conferred.capability
         )
    )
    AND lower(partner_invitation.email) <> (
      SELECT lower(u.email) FROM tenant."user" u WHERE u.id = partner_invitation.invited_by
    )
  );

-- ---------------------------------------------------------------------
-- GRANTS. `SELECT, INSERT` on the invitation — the writer is
-- `server/data-plane/partner-staff-store.ts`, in this commit (G511). NO
-- `UPDATE` (an invitation re-pointed at a stronger role is an escalation the
-- `WITH CHECK` never saw) and NO `DELETE`. Nothing new on `0250`'s three.
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT ON tenant.partner_invitation TO tenant_rw;

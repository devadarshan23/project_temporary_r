-- =====================================================================
-- 0320 — INVARIANT 10's THIRD HOME: A PARTNER FIRM'S OWN PORTAL ACT.
-- G2621–G2623 (1 Oct 2026). G2621 IS THE OWNER'S RULING, taking G2327:
--
--     *"Session-keyed table: tenant.partner_authorization_grant keyed on the
--     acting session — G730's second-home shape, a third home for one
--     meaning."*
--
-- G2327 recorded the blocker this answers: *"`AuthorizationGrant extends
-- TenantScoped` and a portal act has no tenant, so `authorize()` cannot mint
-- its record and `mountTier()`'s sixth fence refuses a gated mount without
-- one."* ⚠️ The first half had in fact rotted by the time the ruling arrived
-- and is recorded rather than glossed: after G730, `authorize()` DID mint for
-- a tenant-less partner act — into the PLATFORM home, as though a partner's
-- deal registration were a 1CloudHub staff act on the fleet. That is worse
-- than no record, because an auditor reading `platform_authorization_grant`
-- to learn what 1CloudHub's own people did would find a partner's acts in it.
-- `model/access.ts` now mints `PartnerAuthorizationGrant` (`home: 'partner'`)
-- for every partner-only verb, keyed on the same class test the fifth arm
-- dispatches on.
--
-- 🛑 THE SHAPE IS `0091`'s, PLUS ONE COLUMN, PLUS ONE TRIGGER.
--
--   · `partner_id` is NOT NULL. The fifth arm refuses
--     `partner_staff_partner_unresolved` before it can allow, so every row
--     names a firm — and the firm is the value later policies key on.
--   · There is NO `tenant_id` column and there must never be one:
--     `PartnerRoleAssignment`'s note — *"If a `tenantId` is ever added here,
--     invariant 2 has a second path, written in a field."* Derive the absence
--     on the DECLARATION:
--     `grep -cE '^\s+tenant_id\s' db/migrations/0320_partner_authorisation_record.sql` → 0.
--   · An INSERT is checked for more than `0091` checks — by a TRIGGER, and §2 says why it cannot be a `WITH CHECK`.
--
-- 🛑 POLICIES ARE `FOR SELECT` AND `FOR INSERT`, NEVER `FOR ALL` — G1982 AND
--    `0027`. `0091` used `FOR ALL` with both clauses written out, which is
--    correct there; here the INSERT clause differs from the SELECT one, and
--    writing them as two commands keeps the read predicate from becoming the
--    write predicate by default the day somebody drops a clause.
-- =====================================================================

CREATE TABLE tenant.partner_authorization_grant (
  subject_user_id text        NOT NULL,
  id              text        NOT NULL,
  -- `partner` on every row; stamped from the principal, never a literal.
  org_class       text        NOT NULL,
  partner_id      text        NOT NULL,
  capability      text        NOT NULL,
  resource_class  text        NOT NULL,
  resource_type   text        NOT NULL,
  resource_id     text,
  solution_id     text,
  issued_at       timestamptz NOT NULL,
  expires_at      timestamptz NOT NULL,

  PRIMARY KEY (subject_user_id, id)
);

CREATE INDEX partner_authorization_grant_issued_idx
  ON tenant.partner_authorization_grant (subject_user_id, issued_at DESC);

CREATE TABLE tenant.partner_authorization_grant_via (
  subject_user_id text    NOT NULL,
  grant_id        text    NOT NULL,
  seq             integer NOT NULL,
  -- A `PartnerRoleAssignmentId` on every row. No foreign key, for `0010`'s
  -- reason: `DecisionVia.assignmentId` is a union over three tables.
  assignment_id   text    NOT NULL,
  role_id         text    NOT NULL,
  role_version    integer NOT NULL,

  PRIMARY KEY (subject_user_id, grant_id, seq),
  FOREIGN KEY (subject_user_id, grant_id)
    REFERENCES tenant.partner_authorization_grant (subject_user_id, id) ON DELETE CASCADE
);

ALTER TABLE tenant.partner_authorization_grant     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.partner_authorization_grant     FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.partner_authorization_grant_via ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.partner_authorization_grant_via FORCE  ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- §1 · READ: the acting session's own records — `0091`'s predicate VERBATIM.
-- ---------------------------------------------------------------------
CREATE POLICY partner_authorization_grant_read_rls ON tenant.partner_authorization_grant
  FOR SELECT
  USING (
    subject_user_id = (
      SELECT s.user_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
  );
-- ---------------------------------------------------------------------
-- §2 · WRITE: the acting session's own records — and, through the TRIGGER below,
--      ONLY FOR A FIRM IN WHICH THE ACTOR HOLDS A LIVE PORTAL ROLE THAT
--      CARRIES THE RECORDED VERB.
--
-- 🛑 THE FIRM-AND-VERB TERM IS THE ONE `0091` DOES NOT NEED AND THIS TABLE
--    DOES, AND THE REASON IS WHAT READS IT NEXT. `0321` and `0322` key a
--    firm's directory, its invitations, its deals and its sandbox on THIS
--    ROW's `partner_id` — the G507 shape `0018` uses for `manage_roles`: *"a
--    forged name is INERT."* A name is inert only if the row it names could
--    not have been written for a firm the actor does not belong to. Without
--    the term, a request path holding the app role could insert a record
--    naming ANOTHER firm and `view_partner_staff`, point `app.authorisation_ref`
--    at it, and read that firm's roster — the policy would then do the
--    cross-firm read for it. **Witnessed:** with the term absent, ANA's
--    Northwind session COMMITTED a Contoso `view_partner_staff` record.
--
-- 🛑 IT IS A TRIGGER AND NOT A `WITH CHECK`, AND THAT IS A MEASUREMENT, NOT A
--    TASTE. The term was first written as a `WITH CHECK` on this policy and it
--    was correct for exactly one commit. `0321` then gave `partner_role` and
--    `partner_role_assignment` arms that READ THIS TABLE (the directory and
--    the catalogue are keyed on the receipt), and every portal act thereafter
--    answered, against a live PostgreSQL 14.18:
--
--      ERROR:  infinite recursion detected in policy for relation
--              "partner_authorization_grant"          (42P17, fireRIRrules)
--
--    The cycle is `grant [WITH CHECK] → partner_role_assignment → grant`, and
--    it is `0200`'s class arriving through the other door: G449's *"a WITH
--    CHECK subquerying its own table does NOT recurse"* is true of a DIRECT
--    self-reference and false of one that closes through a second table's
--    `USING`. A trigger's query is a SEPARATE statement, rewritten on its own,
--    so the receipt's table is not on the expansion stack when the
--    assignment's policies are expanded. `0059`'s precedent for a trigger is
--    *"a policy cannot see what changed"*; this one's is *"a policy cannot
--    read a table whose policies read it"*.
--
-- ⚠️ IT RE-ASKS `decide()`'s FIFTH ARM IN SQL AND IS NOT A SECOND EVALUATOR —
--    `0020`'s shape. The model decides whether the act may happen; this asks
--    whether the ROW AS WRITTEN is one the model could have produced, against
--    the database's own copy of the assignment. Each is sufficient rather than
--    necessary, and a row must pass both.
--
-- ⚠️ NOT `SECURITY DEFINER` (G160): the function holds no authority of its
--    own, and its read of `partner_role_assignment` runs under the CALLER's
--    policies — the acting session's own rows, exactly as `readPartnerHeld()`
--    reads them. A caller who could not see the assignment cannot pass.
--
-- ⚠️ THE ORG TERM (that the actor's DOOR is owned by this firm) IS NOT HERE.
--    It would read `tenant."user"` and `tenant.identity_connection`, and
--    `0321` §1 now reads this table FROM `tenant."user"`. What stands in for it
--    is that an assignment row can only be written by the migrator — nothing
--    on a request path holds `INSERT` on `partner_role_assignment`.
-- ---------------------------------------------------------------------
CREATE POLICY partner_authorization_grant_write_rls ON tenant.partner_authorization_grant
  FOR INSERT
  WITH CHECK (
    subject_user_id = (
      SELECT s.user_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
    AND org_class = 'partner'
  );

CREATE FUNCTION tenant.partner_authorization_grant_is_a_receipt()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = tenant, pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM tenant.partner_role_assignment a
      JOIN tenant.partner_role r            ON r.id = a.role_id AND r.partner_id = a.partner_id
      JOIN tenant.partner_role_capability c ON c.role_id = a.role_id
     WHERE a.user_id     = NEW.subject_user_id
       AND a.partner_id  = NEW.partner_id
       AND a.revoked_at IS NULL
       AND a.expires_at  > now()
       AND r.status      = 'active'
       AND r.version     = a.role_version
       AND c.capability  = NEW.capability
  ) THEN
    RAISE EXCEPTION
      'partner authorisation record refused: % holds no live role in % carrying %',
      NEW.subject_user_id, NEW.partner_id, NEW.capability
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER partner_authorization_grant_is_a_receipt
  BEFORE INSERT ON tenant.partner_authorization_grant
  FOR EACH ROW
  EXECUTE FUNCTION tenant.partner_authorization_grant_is_a_receipt();

CREATE POLICY partner_authorization_grant_via_read_rls ON tenant.partner_authorization_grant_via
  FOR SELECT
  USING (
    subject_user_id = (
      SELECT s.user_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
  );

CREATE POLICY partner_authorization_grant_via_write_rls ON tenant.partner_authorization_grant_via
  FOR INSERT
  WITH CHECK (
    subject_user_id = (
      SELECT s.user_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
  );

-- ---------------------------------------------------------------------
-- GRANTS — `SELECT, INSERT`, and NO `UPDATE`, NO `DELETE`: `0010`'s
-- append-only-as-a-PRIVILEGE, a sixth time.
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT ON tenant.partner_authorization_grant     TO tenant_rw;
GRANT SELECT, INSERT ON tenant.partner_authorization_grant_via TO tenant_rw;

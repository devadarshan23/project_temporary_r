-- =====================================================================
-- 0250 — A PARTNER FIRM'S OWN PORTAL ROLES. G2321–G2326 (1 Oct 2026),
-- applying R10, THE OWNER'S RULING:
--
--     *"Partner role tables + a fifth arm: new partner_role /
--     partner_role_assignment tables keyed on partnerId, decide() gains a
--     fifth arm, and new resource classes for deals / sandbox / partner
--     staff."*
--
-- `docs/build/completion-plan.md` §4 R10 named the authority instrument as the
-- first of three missing parts: *"no partner staff roster exists in either
-- database"*. These three tables are that instrument. The taxonomy and the arm
-- are `model/governance.ts` and `model/access.ts` §6c, in the same commit,
-- because a table whose only reader is a branch that does not exist is
-- `0004_subject_ledger.sql`'s refusal — *a column ahead of its reader*.
--
-- 🛑 THE SHAPE IS `0009`'s PLATFORM TRIO, DELIBERATELY, PLUS ONE COLUMN AND
--    ONE CONSTRAINT THAT THE PLATFORM TRIO DOES NOT NEED.
--
--      tenant.partner_role              ↔ tenant.platform_role
--      tenant.partner_role_capability   ↔ tenant.platform_role_capability
--      tenant.partner_role_assignment   ↔ tenant.platform_role_assignment
--
--    The extra column is `partner_id`, on the role AND on the assignment: the
--    ruling says *"keyed on partnerId"*, and 1CloudHub is one organisation
--    while partners are many. The extra constraint is a COMPOSITE FOREIGN KEY
--    — `(role_id, partner_id)` REFERENCES `partner_role (id, partner_id)` —
--    so an assignment and its role CANNOT DISAGREE about the firm. That is
--    G576's shape on `0039`: a disagreeing row is UNREPRESENTABLE rather than
--    refused. The evaluator still compares both to the PRINCIPAL's firm
--    (`partner_staff_other_partner`), which is the second, independent term.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE RLS IS KEYED ON THE SESSION, NOT ON THE PARTNER, AND THAT IS THE
--    ONE DECISION IN THIS FILE THAT WAS ARGUED RATHER THAN COPIED.
-- ═══════════════════════════════════════════════════════════════════════
--
-- Two keyings were on the table.
--
--   SESSION-KEYED (TAKEN). The holder's own rows, by the acting session's
--   `user_id` — `0009`'s `platform_role_assignment_rls` predicate VERBATIM
--   apart from the table name. A portal session is bound to NO TENANT
--   (`partners.reconcileai.app` is a console host, G726), so a `tenant_id`
--   predicate would deny unconditionally under G100 — `0009`'s own reason for
--   keying the platform trio this way. It needs NO NEW SCOPE HELPER:
--   `withSessionScope()` already sets `app.session_ref`, and
--   `readPartnerHeld()` runs inside it exactly as `readPlatformHeld()` does.
--
--   PARTNER-KEYED (REFUSED). `partner_id = current_setting('app.partner_id')`.
--   Three costs, each sufficient:
--     (1) There is no `app.partner_id` GUC and no helper that sets one.
--         Adding it is a SEVENTH scope helper, and `db/session-scope.ts` sets
--         the bar a new helper must pay — *"somebody will propose a third"* —
--         with a measured refusal, not a convenience.
--     (2) It would make every one of these tables a FIRM ROSTER readable by
--         every person at the firm, which is `listPartnerPeople`'s read — an
--         ADMINISTRATIVE reach. `tests/db/administrative-reach.test.ts` (G447)
--         measures that this schema has none anywhere, and opening the first
--         one is a ruling with its own capability check (`view_partner_staff`)
--         and its own invariant 10 record, neither of which exists yet.
--     (3) The partner id is DERIVED from the door (`orgFor(connection.owner)`)
--         and a GUC carrying it would be a second, copyable statement of the
--         organisation axis — `ResolvedPrincipal.orgClass`'s reason for never
--         being stored, one field over.
--
-- ⚠️ THE COST OF THE KEYING TAKEN, NAMED: `listPartnerPeople` cannot be served
--    from these tables as they stand. That is recorded on the operation's own
--    exemption in `docs/contracts/administration.openapi.yaml` and in
--    `docs/build/completion-plan.md` W5, and it is the right direction to be
--    blocked in: a roster that is not readable is a refusal, a roster that is
--    readable by the wrong people is a disclosure.
--
-- 🛑 EVERY POLICY HERE IS `FOR SELECT`, AND THE KEYWORD IS NOT DECORATION —
--    G1982 AND `0027`. A policy with no `FOR` is `FOR ALL`, and a `FOR ALL`
--    policy with a `USING` and no `WITH CHECK` REUSES THE `USING` AS THE
--    `WITH CHECK` for INSERT — so the day somebody grants `INSERT` here for an
--    invitation writer, a `FOR ALL` policy would admit a person inserting an
--    assignment FOR THEMSELVES. `FOR SELECT` keeps the property through that
--    future grant; the writer's commit owes its own `WITH CHECK`.
--
-- 🛑 `SELECT` AND NOTHING ELSE TO THE APP ROLE, ON ALL THREE — `0004`'s rule
--    and `0009`'s sentence, unchanged: *"a request path that could write
--    `role_assignment` could grant itself any capability in the closed set,
--    and `decide()` would then permit it CORRECTLY."* Here the closed set the
--    fifth arm reads is six verbs, and the escalation is a partner user making
--    themselves the firm's administrator. **NOTHING WRITES THESE TABLES** —
--    no migration seeds a row and no handler is mounted; `invitePartnerPerson`
--    is the writer that is owed, and G511 binds it: *"the fence and the writer
--    are one commit or neither."*
--
-- ⚠️ NO `tenant_id` COLUMN IN THE FILE AT ALL, and the absence is the
--    declaration: `PartnerRoleAssignment`'s own note reads *"If a `tenantId`
--    is ever added here, invariant 2 has a second path, written in a field."*
--    Derive it on the DECLARATION rather than on this sentence, which names
--    the column: `grep -cE '^\s+tenant_id\s' db/migrations/0250_partner_role.sql` → 0.
--
-- ⚠️ NO `stakeholder_class` AND NO `pack_id`, AGAINST `0009`'s PLATFORM TRIO.
--    Every `StakeholderClass` is a position inside a customer tenant, and a
--    pack is a customer-installed artefact; `model/access.ts`'s `PartnerRole`
--    declares neither, and 0008's rule is that the column set is the
--    interface's — *"a column ahead of its reader is 0004's refusal."*
--
-- ⚠️ `partner_id` REFERENCES NOTHING, BECAUSE THERE IS NOTHING TO REFERENCE:
--    no partner registry table exists in either database (`listPartnerRegistry`
--    is declared and unmounted). `tenant.tenant.partner_id` and
--    `tenant.partner_access_grant.partner_id` are bare `text` for the same
--    reason. The commit that lands the registry owes the foreign key.
-- =====================================================================

CREATE TABLE tenant.partner_role (
  id         text    NOT NULL PRIMARY KEY,
  partner_id text    NOT NULL,
  label      text    NOT NULL,
  key        text    NOT NULL,
  version    integer NOT NULL,
  status     text    NOT NULL,

  -- *"Stable within the firm."* Two firms may each have a `partner_admin`.
  UNIQUE (partner_id, key),
  -- The target of the composite foreign key below. `id` alone is already
  -- unique, so this adds no constraint on the data — only an addressable pair.
  UNIQUE (id, partner_id)
);

CREATE TABLE tenant.partner_role_capability (
  role_id    text NOT NULL REFERENCES tenant.partner_role (id) ON DELETE CASCADE,
  -- Bare `text`, as `0009`'s two capability tables are: an unknown verb is
  -- DROPPED by the reader (`asCapability()`), never rejected at write time by
  -- a list somebody forgot to extend — `0007`/`0069`'s polarity.
  capability text NOT NULL,

  PRIMARY KEY (role_id, capability)
);

-- 🛑 `expires_at` IS `NOT NULL`, AS ON `platform_role_assignment`, AND FOR
--    THE SAME REASON: `DURABLE_ASSIGNMENT_PERMITTED.partner` is `false`, so a
--    never-expiring portal role cannot be typed in the model and cannot be
--    stored here either.
CREATE TABLE tenant.partner_role_assignment (
  id           text        NOT NULL PRIMARY KEY,
  partner_id   text        NOT NULL,
  user_id      text        NOT NULL,
  role_id      text        NOT NULL,
  role_version integer     NOT NULL,
  granted_by   text        NOT NULL,
  granted_at   timestamptz NOT NULL,
  expires_at   timestamptz NOT NULL,
  -- Read by `decide()` as `partner_staff_assignment_revoked`. No `WHERE` reads it.
  revoked_at   timestamptz,

  -- G576's shape: the assignment and its role cannot name two firms.
  FOREIGN KEY (role_id, partner_id)
    REFERENCES tenant.partner_role (id, partner_id) ON DELETE CASCADE
);

CREATE INDEX partner_role_assignment_holder_idx
  ON tenant.partner_role_assignment (user_id);


-- ---------------------------------------------------------------------
-- ROW-LEVEL SECURITY. `ENABLE` and `FORCE`, both, on all three — `0001`'s
-- argument unchanged: `ENABLE` alone leaves the TABLE OWNER exempt.
-- ---------------------------------------------------------------------

ALTER TABLE tenant.partner_role              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.partner_role              FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.partner_role_capability   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.partner_role_capability   FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.partner_role_assignment   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.partner_role_assignment   FORCE  ROW LEVEL SECURITY;

-- The holder's own assignments and nobody else's — `0009`'s
-- `platform_role_assignment_rls` predicate, verbatim. Not a roster: a partner
-- person cannot enumerate a colleague's portal role through it.
CREATE POLICY partner_role_assignment_rls ON tenant.partner_role_assignment
  FOR SELECT
  USING (
    user_id = (
      SELECT s.user_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
  );

-- A role is visible only through an assignment the caller holds. The inner
-- read of `partner_role_assignment` is itself narrowed by the policy above, so
-- this cannot reach a role the caller does not hold — and the FAIL DIRECTION
-- is the safe one: a policy denying where it should permit makes
-- `partnerHeld` resolve to `[]`, and `decide()` answers
-- `partner_staff_assignment_absent`.
CREATE POLICY partner_role_rls ON tenant.partner_role
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
        FROM tenant.partner_role_assignment a
       WHERE a.role_id = partner_role.id
    )
  );

CREATE POLICY partner_role_capability_rls ON tenant.partner_role_capability
  FOR SELECT
  USING (
    role_id IN (SELECT r.id FROM tenant.partner_role r)
  );


-- ---------------------------------------------------------------------
-- GRANTS. By name, because `0003` declines `ALTER DEFAULT PRIVILEGES` on this
-- schema. `SELECT` and nothing else — see the argument at the head of this
-- file.
-- ---------------------------------------------------------------------

GRANT SELECT ON tenant.partner_role            TO tenant_rw;
GRANT SELECT ON tenant.partner_role_capability TO tenant_rw;
GRANT SELECT ON tenant.partner_role_assignment TO tenant_rw;

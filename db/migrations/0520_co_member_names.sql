-- =====================================================================
-- 0520 — A CO-MEMBER'S NAME, AND NOTHING ELSE ABOUT THEM.
-- G3886–G3888, 4 Oct 2026. G3886 applies THE OWNER'S C3-05 RULING, quoted and
-- never paraphrased:
--
--   *"Narrow name-only read: a policy letting a tenant member read
--    display_name (only) of people who share their tenant membership; widen
--    G447's directory rule for that one column."*
--
-- WHAT IT ENDS. G3812 (round four, server) measured that NO scope a proposal,
-- an approval or an assignment read runs in may read another person's
-- `display_name`: every policy on `tenant."user"` is keyed on the acting
-- session (`0009`), on a `manage_roles` record (`0018`, G506) or on a partner
-- firm (`0321`). So the register said "a colleague" for every person but you.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 WHY A VIEW OWNED BY ITS OWN ROLE, AND NOT A POLICY ON THE APP ROLE
-- ═══════════════════════════════════════════════════════════════════════
--
-- Row level security is ROW-level. A permissive policy admitting co-members'
-- rows to `reconcile_app` would admit EVERY COLUMN of those rows — `email`,
-- `status`, `external_subject`, `broker_ref` — because `tenant_rw` holds
-- table-level `SELECT` on `tenant."user"` (`0009`). "display_name (only)" is a
-- COLUMN property, and a policy cannot express one.
--
-- So the reach is split across two objects that each say one half:
--
--   1. `reconcile_name_reader` — a NOLOGIN, NOBYPASSRLS role created by
--      `db/provision.ts` — holds `SELECT (id, display_name)` on
--      `tenant."user"` AND NO OTHER COLUMN, and is the ONLY role the new
--      policy below is `TO`. A query touching `email` as that role is
--      `permission denied for table user` — a PRIVILEGE, checked by the
--      server, not a convention in a view's text.
--   2. `tenant.co_member_name` — a view OWNED by that role. A PostgreSQL 14
--      view reads its base table with its OWNER's privileges and its OWNER's
--      policies (there is no `security_invoker` before 15), so the view sees
--      exactly the rows the policy admits and exactly the two columns the
--      grant admits. `tenant_rw` holds `SELECT` on the view and on nothing new.
--
-- ⚠️ `reconcile_app` IS NOT A MEMBER OF `reconcile_name_reader` and
--    `db/provision.ts` REVOKES that membership on every run, so no request
--    transaction can `SET ROLE` into the policy below and read a co-member's
--    `email` through the base table. `tests/db/co-member-names.test.ts` §4
--    witnesses the refusal.
--
-- ═══════════════════════════════════════════════════════════════════════
-- WHO A "CO-MEMBER" IS — G447's DIRECTORY RULE, WIDENED BY ONE COLUMN
-- ═══════════════════════════════════════════════════════════════════════
--
-- `0018`'s `user_directory_rls` is the shape, with ONE term removed: the
-- `g.capability = 'manage_roles'` conjunct. What is kept:
--
--   · the ACT'S OWN invariant 10 record (`app.authorisation_ref`), written by
--     `writeAuthorisationRecord()` before the body runs, in this tenant and
--     unexpired — so a forged name is inert and every read leaves a record;
--   · the ACTOR holds a LIVE membership in this tenant ("a tenant member", the
--     ruling's words). An FDE under a staff grant holds none and reads no
--     names. ⚠️ A PARTNER IS NOT REFUSED BY THIS TERM AS SUCH: one who holds
--     the expiring membership the partner arm is evaluated beside (the staging
--     mock seed grants one) SHARES the tenant membership and reads names, which
--     is the ruling's own test; one with no membership reads none. Measured in
--     the render check of integrate/4oct-j (G3886), not assumed;
--   · the PERSON NAMED holds a LIVE membership in this tenant — another
--     tenant's person, and a member whose membership lapsed, are not named.
--
-- ═══════════════════════════════════════════════════════════════════════
-- RECURSION — MEASURED, PER `0200`'s LESSON
-- ═══════════════════════════════════════════════════════════════════════
--
-- `0200` found a policy on `tenant."user"` recursing through a SECOND table
-- (`identity_connection_directory_rls` reads `tenant."user"`). This policy
-- reads `tenant.authorization_grant` and `tenant.membership`, whose ONLY
-- policies (`0010`, `0005`) are `0001`'s tenant predicate and reference no
-- other relation — so `tenant."user"` is not reachable from its own expansion
-- here. That is a property of the CATALOGUE, so it is re-measured rather than
-- trusted: `tests/db/co-member-names.test.ts` §6 reads every policy on both
-- tables back from `pg_policies` and requires none to mention `"user"`, and
-- §1–§3 run the read against a live PostgreSQL (14.18).
-- ---------------------------------------------------------------------

GRANT USAGE ON SCHEMA tenant TO reconcile_name_reader;

-- 🛑 TWO COLUMNS. NEVER `email`, `status`, `connection_id`, `external_subject`,
--    `broker_issuer`, `broker_ref`, `email_verified` or a later column.
GRANT SELECT (id, display_name) ON tenant."user" TO reconcile_name_reader;

-- The two relations the predicate reads, under their own (tenant) policies.
GRANT SELECT ON tenant.membership          TO reconcile_name_reader;
GRANT SELECT ON tenant.authorization_grant TO reconcile_name_reader;

-- ⚠️ AND THREE MORE, WHICH THIS POLICY DOES NOT READ AND THE OTHERS DO — MEASURED.
--    Every permissive policy on `tenant."user"` is `TO PUBLIC`, so it is
--    EVALUATED for this role too, and a policy's subquery is privilege-checked
--    as the querying role: the first run of `tests/db/co-member-names.test.ts`
--    answered `permission denied for table session` (`0009`'s `user_rls`). The
--    other two are `0321`'s `user_partner_directory_rls`. Each is keyed on a
--    GUC no tenant scope sets (`app.session_ref`; a PARTNER act's record), so
--    under its own row level security each reads NOTHING here — they widen
--    what the reader may be ASKED, not what it is ANSWERED.
GRANT SELECT ON tenant.session                     TO reconcile_name_reader;
GRANT SELECT ON tenant.partner_role_assignment     TO reconcile_name_reader;
GRANT SELECT ON tenant.partner_authorization_grant TO reconcile_name_reader;

CREATE POLICY user_co_member_name_rls ON tenant."user"
  FOR SELECT
  TO reconcile_name_reader
  USING (
    EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
         AND g.expires_at > now()
         AND EXISTS (
           SELECT 1
             FROM tenant.membership am
            WHERE am.user_id    = g.subject_user_id
              AND am.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
              AND am.revoked_at IS NULL
              AND (am.expires_at IS NULL OR am.expires_at > now())
         )
    )
    AND EXISTS (
      SELECT 1
        FROM tenant.membership m
       WHERE m.user_id    = "user".id
         AND m.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
         AND m.revoked_at IS NULL
         AND (m.expires_at IS NULL OR m.expires_at > now())
    )
  );

-- `security_barrier` so a caller's own predicate on the view cannot be pushed
-- beneath the policy and leak by side effect.
CREATE VIEW tenant.co_member_name WITH (security_barrier = true) AS
  SELECT u.id AS user_id, u.display_name
    FROM tenant."user" u;

-- Ownership needs `CREATE` on the schema at the moment of transfer and never
-- again; it is granted for the one statement and taken back, so the reader
-- role cannot create anything afterwards.
GRANT CREATE ON SCHEMA tenant TO reconcile_name_reader;
ALTER VIEW tenant.co_member_name OWNER TO reconcile_name_reader;
REVOKE CREATE ON SCHEMA tenant FROM reconcile_name_reader;

GRANT SELECT ON tenant.co_member_name TO tenant_rw;

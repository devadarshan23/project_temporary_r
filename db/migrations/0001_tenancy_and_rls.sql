-- =====================================================================
-- 0001 — TENANCY AND ROW-LEVEL SECURITY.
--
-- The first migration in the repository. It carries INVARIANT 1 —
-- "tenant scope is derived from the session, never read from a request" —
-- into the only place that can enforce it against a mistake in application
-- code: the database.
--
-- RULINGS THIS APPLIES (docs/HANDOFF.md §3):
--   G97   every branded id is `text`; the slug is stored VERBATIM. No uuid.
--   G100  the policy DENIES on NULL, and a separate BYPASSRLS role runs
--         migrations — never the table owner.
--   G101  transaction-mode pooling is assumed from day one; every query sits
--         inside an explicit transaction carrying SET LOCAL.
--   G88   forward-only expand/contract. This file is never edited once
--         applied; a change is a new migration.
--
-- 🛑 WHAT IS DELIBERATELY NOT HERE — the outbox columns.
--    Under G88's forward-only expand/contract, ADDING a column later is the
--    cheap direction. Nothing writes a `UsageRecord` today, and folding the
--    outbox in now would settle G30's open question — whether the dedup key
--    is `(idempotencyKey)` or `(idempotencyKey, meter)` — under schedule
--    pressure rather than on its merits. It waits for G30.
--
-- 🛑 PREREQUISITE, AND IT IS NOT A MIGRATION.
--    The three roles below are CLUSTER objects and their creation needs
--    superuser. They are not schema, they do not version, and a migration
--    that created them could not be run by the very role it creates. They
--    are provisioned separately — `db/provision.ts` does it for a local
--    disposable Postgres, and a DBA or an infrastructure module does it
--    anywhere else. This file assumes they exist and only GRANTs to them.
-- =====================================================================


-- ---------------------------------------------------------------------
-- THE THREE ROLES, AND WHY THERE ARE THREE.
--
--   reconcile_owner     NOLOGIN. Owns every table. Holds DDL rights.
--   reconcile_migrator  LOGIN, BYPASSRLS, member of reconcile_owner.
--                       Runs migrations and seeds fixtures.
--   reconcile_app       LOGIN, no BYPASSRLS, owns nothing. DML only.
--                       This is what the pg.Pool connects as.
--
-- G100's row states the reason for the split: "ownership carries DDL rights
-- alongside the read exemption, and there is no way to grant one without the
-- other." That is true of ownership ALONE, and `FORCE ROW LEVEL SECURITY`
-- below is the mechanism that separates them — see the note on it.
--
-- The property that matters, and it is asserted by the test rather than
-- assumed here: reconcile_app has NEITHER attribute. It cannot bypass a
-- policy and it cannot drop one.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- TENANT.
--
-- `id` is `text`, not uuid — G97. Every id in `model/` is
-- `Id<T> = string & { brand }` (model/kernel.ts:43) and every fixture id is a
-- readable prefixed slug: `ten_acme`, not a uuid. Stored verbatim, `text`
-- compares like-for-like against `current_setting('app.tenant_id')` with NO
-- CAST — and that comparison is the RLS predicate carrying invariant 1.
--
-- ⚠️ COST ACCEPTED, RECORDED ON G97: the database enforces no format, so
-- `ten_acme` and `ten_ACME` are both storable. Preventing that is a mint-time
-- rule in `model/`, not a column constraint. `citext` was rejected — it needs
-- an extension on every plane including BYOA.
-- ---------------------------------------------------------------------

CREATE TABLE tenant (
  id          text        PRIMARY KEY,
  name        text        NOT NULL,
  account_id  text        NOT NULL,
  status      text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------
-- TENANT_CONTACT — the first tenant-scoped table.
--
-- Mirrors `TenantContact extends TenantScoped` (model/domain.ts:817). Chosen
-- as the first scoped table because it is a TENANCY concern — "a contact is
-- party to the operation of the service" — so it belongs in a migration
-- scoped to tenancy, and it does not smuggle a reconciliation entity in
-- ahead of its own slice.
--
-- THE PRIMARY KEY IS COMPOSITE AND THAT IS THE POINT. model/domain.ts:629
-- records the reason on `Endpoint`: a bare `Id[]` "cannot check that the
-- endpoints are the SAME TENANT's. That is a composite (tenantId, id) foreign
-- key in the schema." Every scoped table gets `(tenant_id, id)` so that a
-- cross-tenant reference is unrepresentable rather than merely unlikely.
-- ---------------------------------------------------------------------

CREATE TABLE tenant_contact (
  tenant_id               text        NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  id                      text        NOT NULL,
  duty                    text        NOT NULL,
  contact_order           integer     NOT NULL,
  address                 text        NOT NULL,
  channel                 text        NOT NULL,
  data_class              text        NOT NULL,
  holder_name             text,
  verified_at             timestamptz,
  verification_expires_at timestamptz,

  PRIMARY KEY (tenant_id, id)
);


-- =====================================================================
-- ROW-LEVEL SECURITY.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ⚠️ `FORCE` IS NOT DECORATION AND ITS ABSENCE IS SILENT.
--
-- `ENABLE ROW LEVEL SECURITY` alone leaves the TABLE OWNER exempt. A test
-- that connects as the owner then passes with the policy doing nothing, and
-- passes just as well with the policy dropped — which is the exact failure an
-- audit already found in the loose specification of the two-tenant test.
--
-- `FORCE ROW LEVEL SECURITY` subjects the owner to the policy too. It is
-- therefore the mechanism that decouples the read exemption from ownership:
-- after FORCE, the ONLY way to hold the exemption is the explicit `BYPASSRLS`
-- attribute on reconcile_migrator, which is separately grantable and
-- separately revocable. This is what makes G100's "never the table owner"
-- enforceable rather than a convention.
-- ---------------------------------------------------------------------

ALTER TABLE tenant         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant         FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant_contact ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_contact FORCE  ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------
-- THE PREDICATE, AND ITS NULL POLARITY — G100.
--
--     nullif(current_setting('app.tenant_id', true), '')
--
-- Read it in three parts:
--
--   `current_setting(..., true)` — the second argument is `missing_ok`.
--   WITHOUT it, an unset variable RAISES rather than returning NULL, and the
--   error surfaces as a failed query rather than an empty read. We want the
--   empty read, because it is the behaviour that is identical under both
--   pooling modes.
--
--   `nullif(..., '')` — a GUC that has been SET and then reverted reads back
--   as the EMPTY STRING, not NULL. Without this, the predicate would be
--   `tenant_id = ''`, which is false for every row and therefore happens to
--   deny — but by accident, and only because no tenant id is the empty
--   string. G97 stores slugs verbatim with no format constraint at the
--   database, so relying on that would be a rule keyed on a convenient
--   landmark instead of the property it protects (docs/HANDOFF.md §5.1).
--
--   `tenant_id = NULL` — evaluates to NULL, which is not TRUE, so the row is
--   filtered. THE POLICY DENIES ON NULL. A forgotten transaction therefore
--   yields an EMPTY RESULT SET — loud, immediate, and caught by the first
--   test expecting a row — rather than a cross-tenant read that RLS reports
--   as success.
--
-- This matches the polarity of the rest of the codebase: `DENY_ALL` is the
-- failure value, `grantAllows` treats an empty nomination list as granting
-- nothing, and §5.5 records scope failing OPEN as a defect already fixed once.
--
-- `WITH CHECK` is stated explicitly rather than left to default from `USING`,
-- so that a later `FOR SELECT`/`FOR ALL` edit cannot silently drop the write
-- half. Without it a session could INSERT a row belonging to another tenant
-- and then be unable to see what it wrote.
-- ---------------------------------------------------------------------

CREATE POLICY tenant_rls ON tenant
  USING      (id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY tenant_contact_rls ON tenant_contact
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- ---------------------------------------------------------------------
-- GRANTS.
--
-- DML only, and no `CREATE` on the schema. reconcile_app cannot create a
-- table, cannot alter one, and therefore cannot drop a policy protecting one.
-- Losing the policy requires losing the owner or the migrator, not the
-- application role that faces the request path.
-- ---------------------------------------------------------------------

-- PostgreSQL grants CREATE on schema `public` to PUBLIC by default, which would
-- let reconcile_app create a table — and the owner of a table may disable RLS on
-- it. Revoked, so "reconcile_app owns nothing" is true of anything it could make
-- later and not only of what exists now.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO reconcile_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant         TO reconcile_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_contact TO reconcile_app;

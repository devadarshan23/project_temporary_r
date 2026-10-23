-- 0600 — THE TENANT'S NAME, COPIED TO THE DATA PLANE. G4311–G4315, 5 Oct 2026.
--
-- THE OWNER'S RULING, 5 Oct 2026: "Full restore: copy the tenant name to the
-- data plane, put onboarding writes and roster reads behind signed
-- control-plane endpoints, then retire both control-DB credentials from the
-- data plane." This file is the first clause.
--
-- 🛑 IT AMENDS G3356's MECHANISM AND NOT G185(d)'s PLACEMENT OF AUTHORITY.
-- G185(d) keeps the tenant's name a control-owned fact, and it still is: the
-- roster row in the control database is the AUTHORITY, and this table is a
-- PROJECTION of it that the data plane pulls (`server/data-plane/
-- tenant-name-sync.ts`) over the signed internal edge. It is NOT a column on
-- `tenant.tenant`, which is what G185(d) refused by name: a projection with its
-- own `pulled_at` says what it is, where a column would read as the source.
-- What G3356 did — read `tenancy_roster` through the read-only control pool on
-- every `getSessionPrincipal` — is what moves: the control database leaves the
-- tenant hot path, which is the point of the ruling.
--
-- ⚠️ A STALE NAME IS THE COST AND IT IS NAMED. A rename in the roster reaches
-- this table on the next pull (boot, then every ten minutes). A tenant removed
-- from the roster keeps its last pulled name until the tenant row goes, because
-- nothing here deletes on absence — a pull that answered EMPTY (a control plane
-- misconfigured, a roster truncated) must not erase every name in the fleet.
--
-- ⚠️ THE WRITE GOES TO THE APP ROLE, BOUND BY RLS, AND THE WRITER IS ONE FUNCTION
-- (G511). `INSERT` and `UPDATE (name, pulled_at)` to `tenant_rw`, so the
-- serving process — whose task role is the one caller the control plane admits
-- (G4307) — can upsert inside `withTenantScope()`. RLS pins every row to the
-- scope's tenant, so the widest thing a wrong caller can do is rename ITS OWN
-- tenant's display label. No `DELETE`. `tests/db/tenant-name-projection.test.ts`
-- witnesses the policy refusing a cross-tenant write.

CREATE TABLE tenant.tenant_name_projection (
  tenant_id text        PRIMARY KEY REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  name      text        NOT NULL,
  pulled_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tenant.tenant_name_projection ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.tenant_name_projection FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_name_projection_rls ON tenant.tenant_name_projection
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

GRANT SELECT, INSERT ON tenant.tenant_name_projection TO tenant_rw;
GRANT UPDATE (name, pulled_at) ON tenant.tenant_name_projection TO tenant_rw;

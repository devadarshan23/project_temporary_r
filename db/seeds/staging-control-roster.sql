-- ════════════════════════════════════════════════════════════════════════════
-- G3358 — THE STAGING TENANCY ROSTER, IN THE **CONTROL** DATABASE.
--
-- Applied by a person, as the control database's ADMIN, against the CONTROL
-- database and never the data one:
--
--   psql "$CONTROL_ADMIN_URL" -v ON_ERROR_STOP=1 -f db/seeds/staging-control-roster.sql
--
-- 🛑 WHY THIS FILE EXISTS. `getSessionPrincipal` (G3354) names the bound
--    tenant in the chrome, and the tenant's NAME lives here — G185(d) makes it a
--    control-owned fact, `0003` dropped it from the data projection on that
--    ground, and `tests/db/tenant-projection.test.ts` holds the absence. So on
--    staging, where `RECONCILE_DEV_SEED` is deliberately unset
--    (`infra/lib/planes-stack.ts`), the roster is EMPTY and every tenant's name
--    reads `null` — the chrome then draws the tenant id, which is true and is
--    what the live finding of 3 Oct 2026 saw.
--
-- ⚠️ ILLUSTRATIVE, AND `PRODUCT.md` GOVERNS IT: "Meridian Group Pte Ltd" is
--    `docs/handoff-pack/C1 Close.dc.html`'s own fictional tenant, the one
--    `db/seeds/staging-demo-data.sql` already seeds `ten_acme` as. No customer
--    is named.
--
-- ⚠️ THE ONBOARDING ROW IS NOT DECORATION: `server/data-plane/console-roster-
--    store.ts` refuses a roster row with no onboarding row
--    (`onboarding_record_absent`) and takes the whole `listTenants` response
--    down rather than invent a stage. Both land together or neither.
--
-- IDEMPOTENT: `ON CONFLICT DO NOTHING` on both, and NEVER `DO UPDATE` — an
-- existing roster row is somebody's record and is not overwritten, and
-- `0030`'s trigger refuses an `UPDATE` of an onboarding row from every role.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

INSERT INTO tenancy_roster (tenant_id, name, deployment_mode, residency, support_access_mode, plan) VALUES
  ('ten_acme', 'Meridian Group Pte Ltd', 'hosted', 'us-west-2', 'granted_only', NULL),
  ('ten_mock', 'Harbourline Mock Pte Ltd', 'hosted', 'us-west-2', 'granted_only', NULL)
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO onboarding_record (tenant_id, completed_steps) VALUES
  ('ten_acme', 6),
  ('ten_mock', 6)
ON CONFLICT (tenant_id) DO NOTHING;

COMMIT;

-- STAGING SIGN-IN SEED — PHASE 1 OF 2 (G2769, derived, 2 Oct 2026 — NOT THE
-- OWNER'S). FOR THE OWNER TO REVIEW. NOT RUN BY ANY TOOL IN THIS REPOSITORY.
--
-- ┌─ 🛑 WHY THIS IS NOT IN `db/migrations/`, AND IT IS NOT TIDINESS ─────────┐
-- │ A migration is SCHEMA HISTORY: it runs on every database this product   │
-- │ ever has, in order, forever (G88), and `tests/db/` proves it against a   │
-- │ disposable one. This file is DATA for ONE database — staging — naming a │
-- │ real person's directory (`1cloudhub.com`), a deployed Cognito pool and a │
-- │ provider handle. In `db/migrations/` it would run on every local stack  │
-- │ and every CI database and would make the staging owner a member of every │
-- │ test tenant `ten_acme` everywhere. `db/migrate.ts` reads `migrations/`   │
-- │ and `migrations-control/` and nothing else, so nothing here can be run   │
-- │ by accident, and `tools/check-migration-numbers.mjs` never sees it.      │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- RUN IT AS THE MIGRATOR (`reconcile_migrator`, BYPASSRLS) — the app role
-- holds `SELECT` alone on every table below, which is the point of every grant
-- argued in `db/migrations/0009`, `0220` and `0290`. Runbook:
-- `docs/build/deploy-handoff.md` §19.
--
--   psql "$MIGRATOR_URL" -v ON_ERROR_STOP=1 -f db/seeds/staging-signin-seed.sql
--
-- IDEMPOTENT: every write is `ON CONFLICT DO NOTHING` on the row's key, and the
-- one fact that may already exist and DISAGREE — `ten_acme`'s residency — is
-- checked and REFUSED rather than overwritten.
--
-- PHASE 2 (`staging-signin-seed-phase2.sql`) runs AFTER the owner's first
-- Entra sign-in. ⚠️ IT CANNOT BE FOLDED INTO THIS FILE, AND THAT IS MEASURED
-- FROM THE CODE RATHER THAN CHOSEN: R5 provisions the person on first sign-in
-- keyed on the VERIFIED BROKER TOKEN's `sub` (`completeFederatedSignIn` →
-- `mintFederatedSession()`), and that `sub` is the UUID Cognito mints for a
-- federated user at first sign-in. There is no value to pre-provision with.
-- A pre-provisioned row keyed on anything else would be a second identity for
-- one person, and auto-granting roles on first sign-in would need a write path
-- from the request into `tenant.membership` — the privilege `0009` refuses
-- every request path by name.

BEGIN;

-- 1 · THE TEST TENANT. `ten-acme.us-west-2.reconcileai.app` is the staging
-- measurement host every probe uses (`infra/lib/config.ts`'s
-- `SIGN_IN_DEPLOYMENT.staging.servingHosts` registers it to `ten_acme`).
-- Residency must agree with the host's region label, or D1 refuses
-- (`checkServingHostResidency()`).
INSERT INTO tenant.tenant (id, status, residency, environment, deployment_mode)
VALUES ('ten_acme', 'active', 'us-west-2', 'sandbox', 'hosted')
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF (SELECT residency FROM tenant.tenant WHERE id = 'ten_acme') <> 'us-west-2' THEN
    RAISE EXCEPTION 'ten_acme exists with a residency other than us-west-2; the registry maps '
      'ten-acme.us-west-2.reconcileai.app to it and D1 would refuse the disagreement. Not overwritten.';
  END IF;
END $$;

-- 2 · THE ENTRA DOOR (G2767). A CUSTOMER-owned door on the test tenant's
-- account, so a 1cloudhub.com person signing in through it is a CUSTOMER
-- MEMBER of `ten_acme` — which is what lets them exercise the tenant screens.
-- ⚠️ THE ALTERNATIVE IS NAMED: a PLATFORM-owned door is the honest owner for
-- 1CloudHub staff, but `orgFor()` would then make the owner a platform
-- principal, invariant 8 refuses a platform principal a tenant without a
-- `TenantAccessGrant`, and a tenant-admin ROLE would grant nothing. One domain
-- routes to one door and a door has one owner, so it is one or the other; the
-- brief asks for a tenant admin, and staging's `ten_acme` is a test tenant.
--
-- broker_issuer = the staging pool's issuer; broker_ref = the Cognito provider
-- name `c-<ENTRA_CONNECTION_HANDLE>`; both endpoints are the pool's hosted UI.
INSERT INTO tenant.identity_connection
  (id, protocol, label, owner_kind, owner_partner_id, owner_account_id, status,
   broker_issuer, broker_ref, email_claim, name_claim, token_endpoint, authorization_endpoint)
VALUES
  ('idc_staging_entra_1ch', 'oidc', '1CloudHub Entra ID (staging)', 'customer', NULL, 'acc_staging_acme',
   'active',
   'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_bWwWkb0iD',
   'c-536ff22dd95a0cd0',
   'email', 'name',
   'https://reconcile-000000000000-staging.auth.us-west-2.amazoncognito.com/oauth2/token',
   'https://reconcile-000000000000-staging.auth.us-west-2.amazoncognito.com/oauth2/authorize')
ON CONFLICT (id) DO NOTHING;

-- 2b · R2 AS AMENDED (G2571, #512): THE KEY DOCUMENT AND THE AUDIENCE ARE THE
-- DOOR'S. The plane loads them AT BOOT for every brokered door (`0300`'s
-- `key_inventory` policy), so a door written here is not verifiable until the
-- data plane RESTARTS — the runbook's step after this file says so.
UPDATE tenant.identity_connection
   SET jwks_uri = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_bWwWkb0iD/.well-known/jwks.json',
       audience = '6ig2p5gam6vhbjdugk9vo5e0vu'
 WHERE id = 'idc_staging_entra_1ch' AND jwks_uri IS NULL;

-- 3 · THE DOMAIN, VERIFIED. ⚠️ `verified_at` IS WRITTEN BY THE MIGRATOR AND
-- NOT BY A VERIFIER (G1952: none exists). 1CloudHub controls `1cloudhub.com`,
-- which is the fact a DNS-TXT verifier would establish; this row asserts it on
-- the owner's word, and says so.
INSERT INTO tenant.domain_claim (connection_id, domain, verified_at)
VALUES ('idc_staging_entra_1ch', '1cloudhub.com', now())
ON CONFLICT DO NOTHING;

-- 4 · THE TENANT ADMINISTRATOR ROLE on `ten_acme`. Tenant capabilities only:
-- no `substrate`/`catalogue` verb (platform-only, G601 — `decide()` refuses
-- them on a tenant arm regardless) and no partner-portal verb (R10).
-- `tests/db/staging-signin-seed.test.ts` §2 checks every name against the
-- model's closed set.
INSERT INTO tenant.role
  (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
VALUES ('ten_acme', 'rol_staging_tenant_admin', 'Tenant administrator (staging)', 'staging_tenant_admin',
        1, 'administrator', 'tenant', NULL, 'active')
ON CONFLICT DO NOTHING;

INSERT INTO tenant.role_capability (tenant_id, role_id, capability)
SELECT 'ten_acme', 'rol_staging_tenant_admin', c
  FROM unnest(ARRAY[
    'view_exception', 'view_document', 'view_dashboard', 'export_data', 'view_summary',
    'assign_exception', 'propose_resolution', 'approve_resolution', 'execute_resolution',
    'reverse_resolution', 'close_exception', 'trigger_run', 'close_period',
    'author_definition', 'configure_tolerance', 'install_pack', 'admit_source',
    'view_endpoint', 'configure_endpoint', 'configure_tag_policy',
    'manage_users', 'manage_roles', 'view_audit', 'view_access_log',
    'view_metering', 'view_commercial'
  ]) AS c
ON CONFLICT DO NOTHING;

COMMIT;

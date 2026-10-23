-- STAGING MOCK SIGN-IN — DOORS, PERSONAS, GRANTS AND DEMO DATA. G2998, G2999
-- (derived, 2 Oct 2026 — NOT THE OWNER'S), building THE OWNER'S RULINGS G2771:
-- *"Create a mock sign-in so Claude can run live browser tests against
-- staging without passkeys"* and a profile switcher across the three portals,
-- confirmed directly after the risk was stated in full.
--
-- FOR THE OWNER TO REVIEW. NOT RUN BY ANY TOOL IN THIS REPOSITORY.
--
-- ┌─ 🛑 THE RISK THIS FILE CARRIES OUT ───────────────────────────────────────┐
-- │ It creates three PUBLIC TEST DOORS on staging and grants the mock personas │
-- │ who walk through them real authority: a tenant administrator and two      │
-- │ approvers on the mock tenant, a partner reaching it under a live          │
-- │ PartnerAccessGrant, 1CloudHub platform roles, and an FDE holding a 90-day │
-- │ DELIVERY grant that opens every tenant-data operation on `ten_mock`.      │
-- │ Anybody holding the one mock password holds all of it. Staging only.      │
-- └───────────────────────────────────────────────────────────────────────────┘
--
-- 🛑 THE FENCES IN THIS FILE, EACH ALSO ASSERTED BY
-- `tests/db/staging-mock-personas.test.ts`:
--   ⛔ Every domain claimed here is under `mock.reconcileai.app`, and each is
--      claimed by exactly ONE mock door. §0 REFUSES to run if any other door
--      claims a mock domain or any mock door claims anything else.
--   ⛔ Nothing here touches `ten_acme`, the Entra door or `1cloudhub.com`:
--      the mock tenant is `ten_mock`, and §0 refuses to run if a mock door
--      has a person, membership or claim reaching `ten_acme`.
--   ⛔ A grant is written ONLY to the person provisioned on THAT persona's
--      mock door with THAT persona's address — never a namesake on another
--      door, and never by choosing one of two by row order.
--
-- ┌─ ⚠️ IT IS ONE FILE, RUN TWICE, AND THE TWO RUNS ARE MEASURED, NOT CHOSEN ─┐
-- │ The owner's brief asked for deterministic mock subjects "so the seed is    │
-- │ single-phase". The mock door's `sub` IS deterministic — and it is not the │
-- │ subject the plane stores. The plane verifies the BROKER's token (D6-5),   │
-- │ and Cognito's `sub` for a federated user is a UUID Cognito mints at that  │
-- │ user's FIRST sign-in; `completeFederatedSignIn` provisions the person on  │
-- │ it (R5). There is no value to pre-provision with (G2998).                 │
-- │                                                                            │
-- │   RUN 1, after `MockIdp` and `Identity` are deployed: §1–§6 write the      │
-- │     tenant, the doors, the claims, the roles and the demo data; §7 finds  │
-- │     nobody and says so per persona.                                       │
-- │   SIGN IN ONCE AS EACH PERSONA (the profile switcher does it): R5          │
-- │     provisions each person on their door, holding nothing.                │
-- │   RUN 2 (and after any later first sign-in): §7 grants each provisioned   │
-- │     persona exactly their role. Re-running is harmless.                   │
-- └────────────────────────────────────────────────────────────────────────────┘
--
-- RUN IT AS THE MIGRATOR (`reconcile_migrator`, BYPASSRLS) — the app role
-- holds no write on any table below. `db/seeds/staging-signin-seed.sql`'s
-- header argues why this is not in `db/migrations/`, and it holds here twice
-- over: this file names test doors and test people that must exist on ONE
-- database. Runbook: `docs/build/deploy-handoff.md` §26.
--
--   psql "$MIGRATOR_URL" -v ON_ERROR_STOP=1 -f db/seeds/staging-mock-personas.sql
--
-- IDEMPOTENT: deterministic ids, `ON CONFLICT DO NOTHING`. The one fact that
-- may already exist and DISAGREE — `ten_mock`'s residency or partner — is
-- REFUSED rather than overwritten. Personas, doors and domains are mirrored
-- from `infra/lib/mock-personas.ts`, and the suite requires the two to agree.

BEGIN;

-- 0 · THE FENCES, CHECKED BEFORE ANYTHING IS WRITTEN AND AGAIN AT THE END (§8).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM tenant.domain_claim
     WHERE (domain LIKE '%.mock.reconcileai.app' OR domain = 'mock.reconcileai.app')
       AND connection_id NOT IN ('idc_mock_customer', 'idc_mock_partner', 'idc_mock_platform')
  ) THEN
    RAISE EXCEPTION 'a door that is not a mock door claims a mock.reconcileai.app domain; refusing.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM tenant.tenant WHERE id = 'ten_mock'
       AND (residency <> 'us-west-2' OR partner_id IS DISTINCT FROM 'ptn_mock')
  ) THEN
    RAISE EXCEPTION 'ten_mock exists with a residency or partner this file did not write. Not overwritten.';
  END IF;
END $$;

-- 1 · THE MOCK TENANT. `ten-mock.us-west-2.reconcileai.app` is registered to it
-- in `infra/lib/config.ts` (`SIGN_IN_DEPLOYMENT.staging.servingHosts`, G2999);
-- residency agrees with the host's region label or D1 refuses. SOLD BY the
-- mock partner (`partner_id`), which is invariant 2's first conjunct — without
-- it no PartnerAccessGrant into it is representable (`0039`'s composite FK).
INSERT INTO tenant.tenant (id, status, residency, environment, deployment_mode, partner_id)
VALUES ('ten_mock', 'active', 'us-west-2', 'sandbox', 'hosted', 'ptn_mock')
ON CONFLICT (id) DO NOTHING;

-- 1a · ITS REPORTING CURRENCY — G4046, the owner's: "Staging demo seed: SGD".
-- `0560` §1: there is no default, so this row is the declaration.
INSERT INTO tenant.tenant_reporting_currency (tenant_id, currency)
VALUES ('ten_mock', 'SGD')
ON CONFLICT (tenant_id) DO NOTHING;

-- 2 · THE THREE MOCK DOORS. ONE OWNER EACH — `orgFor(connection.owner)` is the
-- only producer of `orgClass` (G289) — all brokered by the STAGING POOL, so
-- the broker pair is the pool's issuer and the provider name `c-<handle>`
-- (`MOCK_DOORS` in `infra/lib/mock-personas.ts`). The terms are the pool's,
-- exactly as the Entra door's: the plane verifies Cognito's token, never the
-- mock door's (D6-5). Loaded AT BOOT, so the data plane must restart after
-- this file's first run.
INSERT INTO tenant.identity_connection
  (id, protocol, label, owner_kind, owner_partner_id, owner_account_id, status,
   broker_issuer, broker_ref, email_claim, name_claim, token_endpoint, authorization_endpoint,
   jwks_uri, audience)
VALUES
  ('idc_mock_customer', 'oidc', 'MOCK customer door (staging test login)', 'customer', NULL, 'acc_mock', 'active',
   'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_bWwWkb0iD', 'c-b03a4f0fedb6a40f', 'email', 'name',
   'https://reconcile-000000000000-staging.auth.us-west-2.amazoncognito.com/oauth2/token',
   'https://reconcile-000000000000-staging.auth.us-west-2.amazoncognito.com/oauth2/authorize',
   'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_bWwWkb0iD/.well-known/jwks.json',
   '6ig2p5gam6vhbjdugk9vo5e0vu'),
  ('idc_mock_partner', 'oidc', 'MOCK partner door (staging test login)', 'partner', 'ptn_mock', NULL, 'active',
   'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_bWwWkb0iD', 'c-64d24e8b55c8742c', 'email', 'name',
   'https://reconcile-000000000000-staging.auth.us-west-2.amazoncognito.com/oauth2/token',
   'https://reconcile-000000000000-staging.auth.us-west-2.amazoncognito.com/oauth2/authorize',
   'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_bWwWkb0iD/.well-known/jwks.json',
   '6ig2p5gam6vhbjdugk9vo5e0vu'),
  ('idc_mock_platform', 'oidc', 'MOCK 1CloudHub door (staging test login)', 'platform', NULL, NULL, 'active',
   'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_bWwWkb0iD', 'c-825524648d0a49f6', 'email', 'name',
   'https://reconcile-000000000000-staging.auth.us-west-2.amazoncognito.com/oauth2/token',
   'https://reconcile-000000000000-staging.auth.us-west-2.amazoncognito.com/oauth2/authorize',
   'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_bWwWkb0iD/.well-known/jwks.json',
   '6ig2p5gam6vhbjdugk9vo5e0vu')
ON CONFLICT (id) DO NOTHING;

-- 3 · ONE CLAIM PER DOOR, VERIFIED. ⚠️ `verified_at` IS WRITTEN BY THE MIGRATOR
-- AND NOT BY A VERIFIER (G1952: none exists). `mock.reconcileai.app` sits in
-- `Z04053259WLMQJTR30EU`, which this product controls, so the claim is one a
-- future DNS-TXT verifier COULD confirm — the reason the test domain is not
-- `.invalid`, which no verifier ever could.
INSERT INTO tenant.domain_claim (connection_id, domain, verified_at) VALUES
  ('idc_mock_customer', 'customer.mock.reconcileai.app', now()),
  ('idc_mock_partner', 'partner.mock.reconcileai.app', now()),
  ('idc_mock_platform', 'staff.mock.reconcileai.app', now())
ON CONFLICT DO NOTHING;

-- 4 · ROLES. Tenant roles on `ten_mock` (customer actor classes, plus the one a
-- partner member holds there), partner-portal roles for `ptn_mock` (R10), and
-- platform roles (G289). Every name is checked against the model's closed set
-- by the suite; none of the tenant or partner roles carries a platform-only
-- verb (G601), and every platform verb is one `PLATFORM_ASSIGNMENT_REACHES`
-- opens.
INSERT INTO tenant.role (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status) VALUES
  ('ten_mock', 'rol_mock_admin', 'Tenant administrator (mock)', 'mock_tenant_admin', 1, 'administrator', 'tenant', NULL, 'active'),
  ('ten_mock', 'rol_mock_approver', 'Approver (mock)', 'mock_approver', 1, 'operator', 'tenant', NULL, 'active'),
  ('ten_mock', 'rol_mock_operator', 'User (mock)', 'mock_operator', 1, 'operator', 'tenant', NULL, 'active'),
  ('ten_mock', 'rol_mock_viewer', 'Assurance reader (mock)', 'mock_viewer', 1, 'operator', 'tenant', NULL, 'active'),
  ('ten_mock', 'rol_mock_engineer', 'Cloud engineer (mock)', 'mock_engineer', 1, 'operator', 'tenant', NULL, 'active'),
  ('ten_mock', 'rol_mock_partner_operator', 'Partner operator (mock)', 'mock_partner_operator', 1, 'operator', 'tenant', NULL, 'active')
ON CONFLICT DO NOTHING;

INSERT INTO tenant.role_capability (tenant_id, role_id, capability)
SELECT 'ten_mock', r.role_id, capability
  FROM (VALUES
    ('rol_mock_admin', ARRAY[
      'view_exception', 'view_document', 'view_dashboard', 'export_data', 'view_summary',
      'assign_exception', 'propose_resolution', 'approve_resolution', 'execute_resolution',
      'reverse_resolution', 'close_exception', 'trigger_run', 'close_period',
      'author_definition', 'configure_tolerance', 'install_pack', 'admit_source',
      'view_endpoint', 'configure_endpoint', 'configure_tag_policy',
      'manage_users', 'manage_roles', 'view_audit', 'view_access_log',
      'view_metering', 'view_commercial']),
    ('rol_mock_approver', ARRAY[
      'view_exception', 'view_document', 'view_dashboard', 'view_summary',
      'approve_resolution', 'execute_resolution']),
    ('rol_mock_operator', ARRAY[
      'view_exception', 'view_document', 'view_dashboard', 'view_summary', 'export_data',
      'assign_exception', 'propose_resolution', 'close_exception', 'trigger_run',
      'admit_correspondence', 'send_outbound']),
    ('rol_mock_viewer', ARRAY[
      'view_exception', 'view_document', 'view_dashboard', 'view_summary', 'export_data',
      'view_audit', 'view_access_log']),
    ('rol_mock_engineer', ARRAY[
      'view_document', 'view_dashboard', 'view_summary',
      'view_endpoint', 'configure_endpoint', 'admit_source']),
    ('rol_mock_partner_operator', ARRAY[
      'view_exception', 'view_document', 'view_dashboard',
      'assign_exception', 'propose_resolution', 'view_endpoint'])
  ) AS r(role_id, caps)
  CROSS JOIN LATERAL unnest(r.caps) AS capability
ON CONFLICT DO NOTHING;

INSERT INTO tenant.partner_role (id, partner_id, label, key, version, status) VALUES
  ('prl_mock_admin', 'ptn_mock', 'Partner administrator (mock)', 'partner_administrator', 1, 'active'),
  ('prl_mock_user', 'ptn_mock', 'Partner user (mock)', 'partner_user', 1, 'active'),
  ('prl_mock_delivery', 'ptn_mock', 'Partner delivery (mock)', 'partner_delivery', 1, 'active')
ON CONFLICT DO NOTHING;

INSERT INTO tenant.partner_role_capability (role_id, capability)
SELECT v.role_id, c
  FROM (VALUES
    ('prl_mock_admin', ARRAY['view_deals', 'register_deal', 'view_sandbox', 'operate_sandbox',
                             'view_partner_staff', 'manage_partner_staff']),
    ('prl_mock_user', ARRAY['view_deals', 'register_deal']),
    ('prl_mock_delivery', ARRAY['view_deals', 'view_sandbox', 'operate_sandbox'])
  ) AS v(role_id, caps)
  CROSS JOIN LATERAL unnest(v.caps) AS c
ON CONFLICT DO NOTHING;

INSERT INTO tenant.platform_role (id, label, key, version, stakeholder_class, status) VALUES
  ('plr_mock_platform', 'Platform and catalogue (mock)', 'mock_platform', 1, 'platform', 'active'),
  ('plr_mock_billing', 'Billing and commercial (mock)', 'mock_billing', 1, 'platform', 'active'),
  ('plr_mock_support', 'Support (mock)', 'mock_support', 1, 'platform', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO tenant.platform_role_capability (role_id, capability)
SELECT v.role_id, c
  FROM (VALUES
    ('plr_mock_platform', ARRAY['view_substrate', 'provision_substrate', 'view_catalogue',
                                'author_catalogue', 'publish_catalogue']),
    ('plr_mock_billing', ARRAY['view_commercial', 'view_substrate', 'view_catalogue']),
    ('plr_mock_support', ARRAY['view_substrate'])
  ) AS v(role_id, caps)
  CROSS JOIN LATERAL unnest(v.caps) AS c
ON CONFLICT DO NOTHING;

-- 5 · THE PARTNER'S REACH INTO THE MOCK TENANT — invariant 2's second
-- conjunct. ONE live grant (`UNIQUE (tenant_id)`), `exceptions_operate`, ninety
-- days from the first run. `PARTNER_CAPABILITY_MASK` is still the ceiling.
INSERT INTO tenant.partner_access_grant (tenant_id, id, partner_id, scope, expires_at, revoked_at)
VALUES ('ten_mock', 'pag_mock', 'ptn_mock', 'exceptions_operate', now() + interval '90 days', NULL)
ON CONFLICT DO NOTHING;

-- 6 · DEMO DATA ON `ten_mock` — enough to walk the drawn screens: a definition
-- with its archetype and dispositions and a four-eyes approval policy, a
-- period, five runs across the statuses, five exceptions across the
-- severities, a counterparty and a conversation, and two partner deals.
-- ⚠️ ILLUSTRATIVE, AND `PRODUCT.md` GOVERNS IT: no customer, no result.
INSERT INTO tenant.reconciliation_definition (tenant_id, id, version, status, name) VALUES
  ('ten_mock', 'def_mock_three_way', 1, 'active', 'Three-way match'),
  ('ten_mock', 'def_mock_bank', 1, 'active', 'Bank to ERP')
ON CONFLICT DO NOTHING;

-- G3352 — `0420` added `name` after staging already held these two rows, and
-- the INSERT above is `ON CONFLICT DO NOTHING`. Fill a name ONLY where none is
-- held, so an operator-set name is never overwritten and a re-run is a no-op.
UPDATE tenant.reconciliation_definition d SET name = v.name
  FROM (VALUES ('def_mock_three_way', 'Three-way match'), ('def_mock_bank', 'Bank to ERP'))
       AS v(id, name)
 WHERE d.tenant_id = 'ten_mock' AND d.id = v.id AND d.name IS NULL;

INSERT INTO tenant.reconciliation_period (tenant_id, id, status)
VALUES ('ten_mock', 'per_mock_2026_09', 'open')
ON CONFLICT DO NOTHING;

-- G3429 — `0430` added a period's calendar span after staging held this row.
-- Fill it ONLY where none is held (G3352's shape): the whole of September.
UPDATE tenant.reconciliation_period
   SET starts_on = DATE '2026-09-01', ends_on = DATE '2026-09-30'
 WHERE tenant_id = 'ten_mock' AND id = 'per_mock_2026_09' AND starts_on IS NULL;

INSERT INTO tenant.definition_archetype (tenant_id, definition_id, archetype, pack_key)
VALUES ('ten_mock', 'def_mock_three_way', 'n_way_document_match', 'pck_mock_ap')
ON CONFLICT DO NOTHING;

INSERT INTO tenant.disposition
  (tenant_id, pack_key, key, label, family, reversibility, terminal, requires_adjustment) VALUES
  ('ten_mock', 'pck_mock_ap', 'write_off', 'Write off', 'charge_variance', 'irreversible', true, false),
  ('ten_mock', 'pck_mock_ap', 'price_correction', 'Correct the price', 'price_variance', 'reversible', true, true)
ON CONFLICT DO NOTHING;

INSERT INTO tenant.approval_config (tenant_id, quorum, mandatory_at_or_above, segregation_of_duties)
VALUES ('ten_mock', 2, 'critical', true)
ON CONFLICT DO NOTHING;

INSERT INTO run
  (tenant_id, id, definition_id, definition_version, period_id, trigger_kind, status,
   started_at, finished_at, exceptions_raised)
VALUES
  ('ten_mock', 'run_mock_1', 'def_mock_three_way', 1, 'per_mock_2026_09', 'manual', 'completed', now() - interval '3 days', now() - interval '3 days', 5),
  ('ten_mock', 'run_mock_2', 'def_mock_three_way', 1, 'per_mock_2026_09', 'manual', 'failed', now() - interval '2 days', now() - interval '2 days', NULL),
  ('ten_mock', 'run_mock_3', 'def_mock_bank', 1, 'per_mock_2026_09', 'manual', 'incomplete', now() - interval '1 day', now() - interval '1 day', 0),
  ('ten_mock', 'run_mock_4', 'def_mock_bank', 1, 'per_mock_2026_09', 'manual', 'running', now() - interval '1 hour', NULL, NULL),
  ('ten_mock', 'run_mock_5', 'def_mock_three_way', 1, 'per_mock_2026_09', 'manual', 'queued', now(), NULL, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO tenant.exception
  (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
   domain, definition_id, rule_label, severity, severity_rank,
   value_at_risk_currency, value_at_risk_minor, value_at_risk_exponent,
   cost_centre, legal_entity, status, assigned_to, raised_at,
   explanation_summary, explanation_expected, explanation_confidence)
VALUES
  ('ten_mock', 'exc_mock_critical', 'mg_mock_1', 'rul_mock_price', 1, 1, 'finance', 'def_mock_three_way',
   'Three-way match', 'critical', 0, 'SGD', 1250000, 2, 'CC-1100', 'LE-SG', 'open', NULL, now() - interval '3 days',
   'Illustrative: the invoice price disagrees with the purchase order.', 'the purchase order price', 0.93),
  ('ten_mock', 'exc_mock_high', 'mg_mock_2', 'rul_mock_qty', 1, 1, 'finance', 'def_mock_three_way',
   'Three-way match', 'high', 1, 'SGD', 84000, 2, 'CC-1100', 'LE-SG', 'open', NULL, now() - interval '3 days',
   'Illustrative: the invoiced quantity exceeds the goods received.', 'the goods-received quantity', 0.88),
  ('ten_mock', 'exc_mock_medium', 'mg_mock_3', 'rul_mock_tax', 1, 1, 'finance', 'def_mock_three_way',
   'Three-way match', 'medium', 2, 'SGD', 1900, 2, 'CC-2200', 'LE-SG', 'open', NULL, now() - interval '3 days',
   'Illustrative: the tax code differs from the order.', 'the tax code on the order', 0.71),
  ('ten_mock', 'exc_mock_low', 'mg_mock_4', 'rul_mock_ref', 1, 1, 'finance', 'def_mock_three_way',
   'Three-way match', 'low', 3, NULL, NULL, NULL, 'CC-2200', 'LE-SG', 'open', NULL, now() - interval '3 days',
   'Illustrative: the supplier reference is missing.', 'the supplier reference', NULL),
  ('ten_mock', 'exc_mock_bank', 'mg_mock_5', 'rul_mock_bank', 1, 1, 'finance', 'def_mock_bank',
   'Bank statement match', 'high', 1, 'SGD', 450000, 2, 'CC-1100', 'LE-SG', 'open', NULL, now() - interval '1 day',
   'Illustrative: a bank credit has no ledger posting.', 'the ledger posting', 0.81)
ON CONFLICT DO NOTHING;

-- G3625 — `0480` gave an exception the run that raised it AFTER staging held
-- these rows, so the run is filled ONLY where none is held (G3352's shape).
-- The four three-way rows are `run_mock_1`'s: the only completed run of that
-- definition, and their `raised_at` is its finish. ⚠️ `exc_mock_bank` KEEPS
-- NULL: the only finished run of `def_mock_bank` is `run_mock_3`, which records
-- `exceptions_raised = 0`, so naming it would be inventing a run (`0480` §1).
-- It is the mock tenant's witness of the not-recorded arm. (And `run_mock_1`
-- records 5 raised against these 4 — a pre-existing mismatch, named not fixed.)
UPDATE tenant.exception
   SET run_id = 'run_mock_1'
 WHERE tenant_id = 'ten_mock'
   AND id IN ('exc_mock_critical', 'exc_mock_high', 'exc_mock_medium', 'exc_mock_low')
   AND run_id IS NULL;

INSERT INTO tenant.counterparty (tenant_id, id, display_name)
VALUES ('ten_mock', 'cpy_mock_supplier', 'Mock Supplier Pte Ltd (illustrative)')
ON CONFLICT DO NOTHING;

INSERT INTO tenant.correspondence_thread
  (tenant_id, id, counterparty_id, subject, channel, status, opened_at, last_message_at)
VALUES ('ten_mock', 'thr_mock_price', 'cpy_mock_supplier', 'Price on PO 4500 (illustrative)', 'email', 'open',
        now() - interval '2 days', now() - interval '1 day')
ON CONFLICT DO NOTHING;

INSERT INTO tenant.deal_registration (id, partner_id, shape, company, submitted_by, received_at, standing) VALUES
  ('drg_mock_1', 'ptn_mock', 'deal', 'Illustrative Prospect A', 'staging_mock_seed', now() - interval '5 days', 'waiting'),
  ('drg_mock_2', 'ptn_mock', 'deal', 'Illustrative Prospect B', 'staging_mock_seed', now() - interval '20 days', 'accepted')
ON CONFLICT DO NOTHING;

-- 7 · THE PERSONAS' GRANTS — written ONLY for a person R5 has provisioned on
-- that persona's door with that persona's address. A persona nobody has signed
-- in as yet is a NOTICE and writes nothing (the header's RUN 1 / RUN 2).
CREATE TEMP TABLE mock_persona (
  sub text PRIMARY KEY, door text NOT NULL, email text NOT NULL, kind text NOT NULL, role_id text
) ON COMMIT DROP;
INSERT INTO mock_persona (sub, door, email, kind, role_id) VALUES
  ('mock-cust-admin', 'idc_mock_customer', 'admin@customer.mock.reconcileai.app', 'customer', 'rol_mock_admin'),
  ('mock-cust-approver-a', 'idc_mock_customer', 'approver.a@customer.mock.reconcileai.app', 'customer', 'rol_mock_approver'),
  ('mock-cust-approver-b', 'idc_mock_customer', 'approver.b@customer.mock.reconcileai.app', 'customer', 'rol_mock_approver'),
  ('mock-cust-operator', 'idc_mock_customer', 'operator@customer.mock.reconcileai.app', 'customer', 'rol_mock_operator'),
  ('mock-cust-viewer', 'idc_mock_customer', 'viewer@customer.mock.reconcileai.app', 'customer', 'rol_mock_viewer'),
  ('mock-cust-engineer', 'idc_mock_customer', 'engineer@customer.mock.reconcileai.app', 'customer', 'rol_mock_engineer'),
  ('mock-partner-admin', 'idc_mock_partner', 'admin@partner.mock.reconcileai.app', 'partner', 'prl_mock_admin'),
  ('mock-partner-user', 'idc_mock_partner', 'user@partner.mock.reconcileai.app', 'partner', 'prl_mock_user'),
  ('mock-partner-delivery', 'idc_mock_partner', 'delivery@partner.mock.reconcileai.app', 'partner', 'prl_mock_delivery'),
  ('mock-staff-platform', 'idc_mock_platform', 'platform@staff.mock.reconcileai.app', 'platform', 'plr_mock_platform'),
  ('mock-staff-billing', 'idc_mock_platform', 'billing@staff.mock.reconcileai.app', 'platform', 'plr_mock_billing'),
  ('mock-staff-fde', 'idc_mock_platform', 'fde@staff.mock.reconcileai.app', 'fde', NULL),
  ('mock-staff-support', 'idc_mock_platform', 'support@staff.mock.reconcileai.app', 'platform', 'plr_mock_support');

DO $$
DECLARE
  p record;
  n integer;
BEGIN
  FOR p IN SELECT * FROM mock_persona ORDER BY sub LOOP
    SELECT count(*) INTO n FROM tenant."user"
     WHERE connection_id = p.door AND lower(email) = p.email;
    IF n > 1 THEN
      RAISE EXCEPTION 'more than one person on % carries %; refusing to choose one by row order.', p.door, p.email;
    END IF;
    IF n = 0 THEN
      RAISE NOTICE '% (%) has not signed in through the mock door yet; nothing granted.', p.sub, p.email;
    END IF;
  END LOOP;
END $$;

CREATE TEMP TABLE mock_person ON COMMIT DROP AS
SELECT p.sub, p.kind, p.role_id, u.id AS user_id
  FROM mock_persona p
  JOIN tenant."user" u ON u.connection_id = p.door AND lower(u.email) = p.email AND u.status = 'active';

-- 7a · customer personas: a DIRECT membership and the role, on `ten_mock`.
INSERT INTO tenant.membership (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
SELECT 'ten_mock', 'mem_' || replace(sub, '-', '_'), user_id, role_id, 'staging_mock_seed', now(), NULL, NULL
  FROM mock_person WHERE kind = 'customer'
ON CONFLICT DO NOTHING;
INSERT INTO tenant.role_assignment
  (tenant_id, id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
SELECT 'ten_mock', 'ras_' || replace(sub, '-', '_'), user_id, role_id, 1, 'staging_mock_seed', now(), NULL, NULL
  FROM mock_person WHERE kind = 'customer'
ON CONFLICT DO NOTHING;

-- 7b · partner personas: the partner-portal role (R10), and an EXPIRING
-- membership and role on `ten_mock`, which the partner arm then clamps to
-- `PARTNER_CAPABILITY_MASK[pag_mock.scope]`.
INSERT INTO tenant.partner_role_assignment
  (id, partner_id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
SELECT 'pra_' || replace(sub, '-', '_'), 'ptn_mock', user_id, role_id, 1, 'staging_mock_seed', now(),
       now() + interval '90 days', NULL
  FROM mock_person WHERE kind = 'partner'
ON CONFLICT DO NOTHING;
INSERT INTO tenant.membership (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
SELECT 'ten_mock', 'mem_' || replace(sub, '-', '_'), user_id, 'rol_mock_partner_operator', 'staging_mock_seed',
       now(), now() + interval '90 days', NULL
  FROM mock_person WHERE kind = 'partner'
ON CONFLICT DO NOTHING;
INSERT INTO tenant.role_assignment
  (tenant_id, id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
SELECT 'ten_mock', 'ras_' || replace(sub, '-', '_'), user_id, 'rol_mock_partner_operator', 1, 'staging_mock_seed',
       now(), now() + interval '90 days', NULL
  FROM mock_person WHERE kind = 'partner'
ON CONFLICT DO NOTHING;

-- 7c · 1CloudHub personas: a platform role (G289), expiring.
INSERT INTO tenant.platform_role_assignment
  (id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
SELECT 'pra_' || replace(sub, '-', '_'), user_id, role_id, 1, 'staging_mock_seed', now(),
       now() + interval '90 days', NULL
  FROM mock_person WHERE kind = 'platform'
ON CONFLICT DO NOTHING;

-- 7d · 🛑 THE FDE: A LIVE DELIVERY `TenantAccessGrant` INTO `ten_mock` (G75's
-- broad shape — `secret` is in `PERMITTED_RESOURCES.delivery`). 89 days, inside
-- `MAX_GRANT_HOURS.delivery`'s 90; its classes are EXACTLY what
-- `tenant.permitted_resource` permits for `delivery` (0008's mirror), so the
-- grant can be no wider than the purpose allows. Being staff is not access
-- (invariant 8): this row is the access.
INSERT INTO tenant.tenant_access_grant (tenant_id, id, purpose, staff_user_id, granted_at, expires_at, revoked_at)
SELECT 'ten_mock', 'tag_mock_fde', 'delivery', user_id, now(), now() + interval '89 days', NULL
  FROM mock_person WHERE kind = 'fde'
ON CONFLICT DO NOTHING;
INSERT INTO tenant.access_resource_grant (tenant_id, grant_id, resource)
SELECT 'ten_mock', 'tag_mock_fde', pr.resource
  FROM tenant.permitted_resource pr
 WHERE pr.purpose = 'delivery'
   AND EXISTS (SELECT 1 FROM tenant.tenant_access_grant g WHERE g.tenant_id = 'ten_mock' AND g.id = 'tag_mock_fde')
ON CONFLICT DO NOTHING;

-- 7e · ONE PENDING PROPOSAL, by the operator, on the CRITICAL exception — so
-- the two approvers have a four-eyes decision to make (C5; quorum 2,
-- segregation of duties, `approval_config` above).
INSERT INTO tenant.resolution_proposal
  (tenant_id, id, exception_id, proposed_by_kind, proposed_by_user_id, disposition_key, rationale, proposed_at)
SELECT 'ten_mock', 'prp_mock_pending', 'exc_mock_critical', 'user', user_id, 'write_off',
       'Illustrative: the supplier confirmed the price and the variance is to be written off.', now()
  FROM mock_person WHERE sub = 'mock-cust-operator'
ON CONFLICT DO NOTHING;

-- 8 · THE FENCES AGAIN, AFTER EVERY WRITE: no mock door reaches `ten_acme`,
-- and no mock door claims anything outside the mock domain.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM tenant.domain_claim
     WHERE connection_id IN ('idc_mock_customer', 'idc_mock_partner', 'idc_mock_platform')
       AND domain NOT LIKE '%.mock.reconcileai.app'
  ) THEN
    RAISE EXCEPTION 'a mock door claims a domain outside mock.reconcileai.app; refusing.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM tenant.membership m JOIN tenant."user" u ON u.id = m.user_id
     WHERE m.tenant_id <> 'ten_mock'
       AND u.connection_id IN ('idc_mock_customer', 'idc_mock_partner', 'idc_mock_platform')
  ) OR EXISTS (
    SELECT 1 FROM tenant.tenant_access_grant g JOIN tenant."user" u ON u.id = g.staff_user_id
     WHERE g.tenant_id <> 'ten_mock'
       AND u.connection_id IN ('idc_mock_customer', 'idc_mock_partner', 'idc_mock_platform')
  ) THEN
    RAISE EXCEPTION 'a mock persona reaches a tenant other than ten_mock; refusing.';
  END IF;
END $$;

COMMIT;

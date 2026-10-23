-- STAGING SIGN-IN SEED — PHASE 2 OF 2 (G2769). RUN AFTER THE OWNER'S FIRST
-- ENTRA SIGN-IN, AS THE MIGRATOR. NOT RUN BY ANY TOOL IN THIS REPOSITORY.
--
--   psql "$MIGRATOR_URL" -v ON_ERROR_STOP=1 -f db/seeds/staging-signin-seed-phase2.sql
--
-- Phase 1's header argues why this cannot run first: the person row is
-- written by R5 on first sign-in, keyed on the subject Cognito mints then.
--
-- 🛑 KEYED ON THE PROVISIONED ROW, FOUND BY DOOR **AND** EMAIL, AND REFUSED
-- UNLESS EXACTLY ONE MATCHES. The door is the Entra door phase 1 wrote, so a
-- person provisioned through ANY other door — another directory claiming the
-- same address, a mock persona — can never be granted here. The email is the
-- R6 projection of the VERIFIED broker token. Zero matches (not yet signed in)
-- is a NOTICE and writes nothing; more than one is an EXCEPTION, because
-- granting the first of two is choosing a person by row order. The resolved
-- `external_subject` is printed so the owner can confirm it is theirs.
--
-- IDEMPOTENT: deterministic ids, `ON CONFLICT DO NOTHING`.

BEGIN;

DO $$
DECLARE
  found_count integer;
  person      text;
  subject     text;
BEGIN
  SELECT count(*) INTO found_count
    FROM tenant."user"
   WHERE connection_id = 'idc_staging_entra_1ch'
     AND lower(email) = 'phani@1cloudhub.com';

  IF found_count = 0 THEN
    RAISE NOTICE 'phani@1cloudhub.com has not signed in through the Entra door yet. '
      'Sign in once at https://ten-acme.us-west-2.reconcileai.app/signin, then re-run this file.';
    RETURN;
  END IF;
  IF found_count > 1 THEN
    RAISE EXCEPTION 'more than one person on the Entra door carries phani@1cloudhub.com; '
      'refusing to choose one by row order.';
  END IF;

  SELECT id, external_subject INTO person, subject
    FROM tenant."user"
   WHERE connection_id = 'idc_staging_entra_1ch'
     AND lower(email) = 'phani@1cloudhub.com';

  IF (SELECT status FROM tenant."user" WHERE id = person) <> 'active' THEN
    RAISE EXCEPTION 'the provisioned person % is not active; nothing granted', person;
  END IF;

  -- The membership: what `selectTenantForSession()` binds a session on (G199).
  -- A DIRECT customer member, so `expires_at` is NULL (`Membership.expiresAt`:
  -- "Null only for direct staff" — here, direct members of the customer).
  INSERT INTO tenant.membership
    (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
  VALUES ('ten_acme', 'mem_staging_owner', person, 'rol_staging_tenant_admin',
          'staging_signin_seed', now(), NULL, NULL)
  ON CONFLICT DO NOTHING;

  -- The assignment: what `decide()` reads capabilities from.
  INSERT INTO tenant.role_assignment
    (tenant_id, id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
  VALUES ('ten_acme', 'ras_staging_owner_admin', person, 'rol_staging_tenant_admin', 1,
          'staging_signin_seed', now(), NULL, NULL)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'granted tenant administrator on ten_acme to % (external_subject %)', person, subject;
END $$;

COMMIT;

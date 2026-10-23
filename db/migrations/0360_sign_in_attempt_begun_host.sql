-- 0360 — THE HOST A SIGN-IN WAS BEGUN ON, PINNED ON THE ATTEMPT (G2761–G2763)
--
-- 🛑 THE OWNER'S RULING G2549, 2 Oct 2026, VERBATIM: *"One shared callback
-- host: all sign-ins return to one fixed callback which then 303s to the
-- tenant host via resolveServingHost (a registry lookup, grant bound to the
-- host)."*
--
-- The broker now returns EVERY sign-in to one fixed URL. That URL's host knows
-- nothing about where the browser came from, and it must not be told by the
-- browser: a `?return_to=` would be the open redirect D6 §4.4 names, and the
-- `state` carrying a tenant is the G315 shape G1710 warned a grant crossing a
-- host boundary would endorse. So the attempt row — which the `state` already
-- addresses by digest, single-use and ten-minute-bounded — gains ONE column:
-- the host `beginFederatedSignIn` resolved through the registry and wrote.
--
-- WHAT READS IT:
--   · `server/data-plane/signin-return.ts` — the relay. It re-resolves the
--     column through the registry (`resolveHandOffTarget()`), so a host
--     retired since the begin is refused rather than redirected to.
--   · `server/data-plane/federated-signin.ts` — the completion. It refuses a
--     `state` presented on any host but this one (`checkHandOffPresentation()`),
--     which is the binding the ruling asks for.
--
-- ⚠️ NULLABLE, AND A NULL IS A REFUSAL AND NEVER A DEFAULT. `ADD COLUMN … NOT
-- NULL` with no default refuses against a populated table, and a deployed
-- `tenant.sign_in_attempt` may hold attempts begun before this file; failing
-- the migration on a ten-minute row would block every deploy for a fact that
-- expires by itself. Every reader treats NULL as `hand_off_target_not_served`
-- and every WRITER is fenced below, so no row written from here on can be NULL.
--
-- 🛑 THE WRITE IS FENCED IN THE DATABASE AS WELL AS IN THE HANDLER. The begin
-- scope (`withSignInBeginScope()`) sets `app.begun_host` from the
-- REGISTRY-RESOLVED host, and the restrictive policy below requires the row's
-- column to equal it. A handler that wrote a different host — the request's
-- `Host` unresolved, a body field, a constant — is refused by the database.
--
-- ⚠️ NO NEW SELECT: `0013`'s table-level grant covers a column added later,
-- which `0011` and `0160` both witnessed rather than assumed.

ALTER TABLE tenant.sign_in_attempt ADD COLUMN begun_host text;

GRANT INSERT (begun_host) ON tenant.sign_in_attempt TO tenant_rw;

CREATE POLICY sign_in_attempt_begun_host_restrictive ON tenant.sign_in_attempt
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    begun_host IS NOT NULL
    AND begun_host = nullif(current_setting('app.begun_host', true), '')
  );

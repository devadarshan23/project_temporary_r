-- 0052 — THE DATA PLANE'S TWO CONTROL-DATABASE CREDENTIALS ARE RETIRED.
--
-- G4320–G4324, 5 Oct 2026, the last clause of THE OWNER'S "Full restore"
-- ruling: "…then retire both control-DB credentials from the data plane."
--
-- `0020` gave `reconcile_control_reader` (G1161) and `0040` gave
-- `reconcile_control_writer` (R9) their reach into this database, and both
-- credentials were held by the DATA plane. Since S3/S4 the data plane reaches
-- the roster and the onboarding record only through the control plane's signed
-- internal operations (`0050`'s grants, to the control plane's own role), so
-- neither role has a holder. This file takes everything away from both and
-- makes them unable to log in.
--
-- 🛑 REVOKED AND `NOLOGIN`, NOT DROPPED — AND THAT IS G88, NOT CAUTION. `0020` and
-- `0040` are forward-only and GRANT to these two names; PostgreSQL refuses a
-- GRANT to a role that does not exist, so a fresh database replaying the
-- migration set needs them to exist when those files run. The roles therefore
-- survive as INERT SHELLS: `server/control-plane/provision.ts` creates them
-- `NOLOGIN` with no password (never `LOGIN` again), and this file strips every
-- privilege they were given. A role is also CLUSTER-wide while a migration runs
-- per database, so a `DROP ROLE` here would fail on any cluster holding a second
-- control database that still carries the old grants.
-- `tests/db/control-plane-census.test.ts` asserts the end state: neither role
-- can log in, and neither holds any privilege on any relation in this database.
--
-- ⚠️ REVOKING ALL ON A TABLE ALSO REVOKES THE COLUMN-LEVEL PRIVILEGES — `0040`'s
-- `UPDATE (completed_steps)` — which PostgreSQL's REVOKE documents and the
-- census verifies with `has_any_column_privilege`.

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM reconcile_control_reader;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM reconcile_control_writer;
REVOKE USAGE ON SCHEMA public FROM reconcile_control_reader;
REVOKE USAGE ON SCHEMA public FROM reconcile_control_writer;

ALTER ROLE reconcile_control_reader NOLOGIN PASSWORD NULL;
ALTER ROLE reconcile_control_writer NOLOGIN PASSWORD NULL;

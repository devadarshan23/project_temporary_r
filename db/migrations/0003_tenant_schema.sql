-- =====================================================================
-- 0003 — DATA-PLANE TENANT SCHEMA AND NARROW TENANT PROJECTION.
--
-- G185 keeps the hosted plane boundary as separate schemas and separate
-- database roles. The authoritative tenant row is control-owned; this schema
-- carries only the id/status/residency projection the data plane needs.
--
-- ⚠️ THIS FILE WAS `0002_tenant_schema.sql` UNTIL 16 Aug 2026 AND THE RENUMBER
--    IS RECORDED RATHER THAN QUIETLY DONE. Main landed `0002_run.sql` while this
--    slice was open, so the merged tree briefly held TWO migrations at ordinal
--    0002. `db/migrate.ts` applies files in FILENAME order, so the pair happened
--    to order correctly — `0002_run.sql` sorts before `0002_tenant_schema.sql` —
--    and that is exactly the problem: the ordering was produced by the letter
--    `r` preceding the letter `t`, not by anything anybody decided. A rule keyed
--    on a convenient landmark instead of the property it protects
--    (docs/HANDOFF.md §5.1). Renumbering is available here and nowhere later:
--    G88 forbids editing an APPLIED file, and neither file has been applied
--    anywhere but a disposable local database that `resetSchema()` drops on
--    every run. **After the first deployment this repair is no longer legal.**
--
-- 🛑 ORDERING IS LOAD-BEARING AND IT IS `0002` THEN `0003`. `0002_run.sql`
--    creates `run` with `REFERENCES tenant (id)` while `tenant` is still in
--    `public`; a foreign key binds by OID, so it FOLLOWS the table through the
--    `SET SCHEMA` below and keeps pointing at `tenant.tenant`. Running this file
--    first would leave `0002_run.sql` resolving `tenant` through the role
--    search_path instead, which is a different and much weaker guarantee.
--
-- ⚠️ AND A CONSEQUENCE FOR EVERY MIGRATION AFTER THIS ONE, STATED HERE BECAUSE
--    NOTHING ELSE WILL SAY IT. `db/provision.ts` sets
--    `search_path = tenant, public` on the migrator and the app role, and
--    PostgreSQL creates an unqualified table in the first EXISTING schema of the
--    search path. Before this file, schema `tenant` did not exist and an
--    unqualified `CREATE TABLE` landed in `public` — which is why `run` is in
--    `public`. From this file onward it lands in `tenant`. **Qualify every
--    CREATE TABLE explicitly from 0004 on**, or the schema a table lives in
--    becomes a side effect of migration order.
-- =====================================================================

CREATE SCHEMA tenant;

ALTER TABLE tenant_contact SET SCHEMA tenant;
ALTER TABLE tenant SET SCHEMA tenant;

-- ---------------------------------------------------------------------
-- EXPAND, THEN CONTRACT — G88, AND THE FIRST FORM OF THIS FILE FAILED IT.
--
-- ⚠️ THIS READ `ADD COLUMN residency text NOT NULL` IN ONE STATEMENT UNTIL
--    16 Aug 2026, AND THAT FORM CANNOT APPLY TO A TABLE CONTAINING ROWS.
--    `NOT NULL` with no `DEFAULT` raises `ERROR: column "residency" of relation
--    "tenant" contains null values` the moment a single row exists. It worked
--    here only because the migration ran immediately behind an empty 0001 — the
--    property it depended on was "nobody has used this yet", which is the
--    property that stops being true first. `docs/day-2-operations.md` §3.2 says
--    expand/contract "must be adopted before the first deployment or not at
--    all"; this is before.
--
--    ⚠️ AND NOTHING WOULD HAVE CAUGHT IT. `tools/planner/extract-c4-data.mjs`
--    had no vocabulary for `UPDATE` or `ALTER COLUMN … SET NOT NULL`, so the
--    three-statement form was a hard `check:c4` failure and the one-statement
--    form passed. The scanner was enforcing the un-migratable shape. It is
--    taught the two forms in the same commit as this rewrite, red first.
--
-- 🛑 THE BACKFILL CONSTANT IS A DECLARED DEFAULT, NOT DERIVED DATA, AND IT IS
--    ONLY CORRECT AT N=1. No column on the pre-0003 `tenant` row carries a
--    residency — the fact was never recorded — so it cannot be computed, only
--    declared. Every row predating this column belongs to the single cluster
--    that exists, whose region is `ap-southeast-1` (G185: one writer,
--    ap-southeast-1; `seedTwoTenants` in db/provision.ts seeds the same value).
--    The instant a second residency region is in service this is a GUESS, and
--    the migration introducing that region must carry the real assignment
--    rather than inherit this one.
--
-- ⚠️ `residency` CARRIES NO CHECK CONSTRAINT AND G97 IS NOT THE REASON, THOUGH
--    #145 CITED IT. G97's argument is about BRANDED IDS, whose `text` type makes
--    them compare like-for-like against `current_setting('app.tenant_id')` — and
--    THAT COMPARISON IS THE RLS PREDICATE. `residency` is not a branded id and
--    appears in no policy, so G97 does not reach it: a rule keyed on a
--    convenient landmark instead of the property it protects. The five-member
--    closed set is `RegionKey` in `model/domain.ts` and nothing in the database
--    holds it, so invariant 7 gains no database-level guard from this file.
--
--    A CHECK constraint is NOT added, and the reason is `0002_run.sql`'s, in its
--    own words: a third copy of a closed enum is "a third place to drift — and
--    the one nothing checks, because no pair in the wire-mirror addresses SQL."
--    `status` and `trigger_kind` on `run` are unconstrained for exactly this
--    reason. `residency` is worse off than they are, because no wire-mirror pair
--    covers it either — so this is recorded as an OPEN GAP rather than argued
--    away, and the guard invariant 7 actually needs is `resolveModel()`-shaped:
--    one executable check, in one place, that a boundary calls.
-- ---------------------------------------------------------------------

ALTER TABLE tenant.tenant ADD COLUMN residency text;
UPDATE tenant.tenant SET residency = 'ap-southeast-1' WHERE residency IS NULL;
ALTER TABLE tenant.tenant ALTER COLUMN residency SET NOT NULL;


-- ---------------------------------------------------------------------
-- CONTRACT — AND THIS HALF IS ONE-WAY LOSS. SAY IT PLAINLY.
--
-- 🛑 THESE THREE DROPS DESTROY THE ONLY COPY OF `name`, `account_id` AND
--    `created_at` IN THE TREE. Under G185(d) they are CONTROL-OWNED and belong
--    in the control plane's `tenant` row — but the control schema is a LATER
--    SLICE (M0-2) and does not exist yet. So the destination these columns are
--    contracted TOWARD is not built, and a forward-only set has no `down`:
--    `db/migrate.ts` says "there is no `down`, and there is no facility for one."
--
--    This is acceptable HERE and only here, for one reason that will not hold
--    again: no deployment exists, so the rows destroyed are rows `resetSchema()`
--    created seconds earlier. It is NOT a precedent. A contract phase whose
--    destination is unbuilt is the wrong order, and the right order — build
--    `control.tenant`, copy, then drop — is what M0-2 must do if it ever runs
--    against data anybody wants.
-- ---------------------------------------------------------------------

ALTER TABLE tenant.tenant DROP COLUMN name;
ALTER TABLE tenant.tenant DROP COLUMN account_id;
ALTER TABLE tenant.tenant DROP COLUMN created_at;

ALTER TABLE tenant.tenant_contact DROP CONSTRAINT tenant_contact_tenant_id_fkey;
ALTER TABLE tenant.tenant_contact ADD CONSTRAINT tenant_contact_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenant.tenant (id) ON DELETE CASCADE;

-- Re-state the protection on the qualified identities after the move. The
-- policy objects move with their tables; these statements keep the executable
-- migration and the generated C4 claim visibly aligned.
ALTER TABLE tenant.tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.tenant FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant.tenant_contact ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.tenant_contact FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- THE GRANTS. `tenant_rw` IS AN INDIRECTION TODAY, NOT YET A RESTRICTION —
-- AND THAT IS STATED RATHER THAN DRESSED UP.
--
-- `db/provision.ts` GRANTs `tenant_rw` TO `reconcile_app`, and the statements
-- below REVOKE from `reconcile_app` and GRANT the identical privilege set to
-- `tenant_rw`. Effective privileges are therefore UNCHANGED, which is exactly
-- why `tests/db/tenant-isolation.test.ts` passes untouched. What it buys is the
-- named handle G185 requires — one role revocable from the app in a single
-- statement once a `control_rw` exists to be separated from. No claim of a
-- narrowing is made here.
--
-- ⚠️ NO `ALTER DEFAULT PRIVILEGES` ON SCHEMA `tenant`, AND THAT IS DELIBERATE.
--    A future table created here is unreachable by the app until granted BY
--    NAME. Combined with the search_path note at the top of this file — from
--    0004 on, an unqualified `CREATE TABLE` lands HERE — default privileges
--    would silently hand the request path a table nobody decided to expose.
--    Fail-closed, matching `DENY_ALL` and G100's deny-on-NULL. The cost is one
--    grant line per table, paid visibly.
-- ---------------------------------------------------------------------

REVOKE CREATE ON SCHEMA tenant FROM PUBLIC;
REVOKE ALL PRIVILEGES ON tenant.tenant FROM reconcile_app;
REVOKE ALL PRIVILEGES ON tenant.tenant_contact FROM reconcile_app;
GRANT USAGE ON SCHEMA tenant TO tenant_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant.tenant TO tenant_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant.tenant_contact TO tenant_rw;

-- =====================================================================
-- 0310 — INVARIANT 10's RECORD NAMES THE STAFF GRANT AN ACT RAN UNDER.
--        G2591–G2593, applying G2407 (THE OWNER'S RULING, 1 Oct 2026):
--        *"Full staff-grant branch — decide() honours the delivery grant's
--        whole class set on every mounted operation."*
--
-- G88: forward-only. `0010` IS NOT EDITED — `0017`'s precedent. This file
--      adds ONE column, relaxes THREE `NOT NULL`s, and adds ONE `CHECK`, ONE
--      foreign key and ONE index to `tenant.authorization_grant_via`.
-- ⚠️ SCHEMA-QUALIFIED THROUGHOUT, because 0003 requires it from 0004 on.
--
-- ---------------------------------------------------------------------
-- 🛑 §1 · WHY.
--
-- `decide()`'s platform arm now permits a verb on the strength of a LIVE
-- `TenantAccessGrant` (the staff-grant branch, `model/access.ts` 2a''). An
-- allow carries `Decision.via`, and invariant 10's record stores `via` here —
-- *"`Decision.via` named the authority and joined to nothing"* was the third
-- missing stream `0010` closed. A grant is not an assignment: it has no role
-- and no pinned version. So `via` became a DISCRIMINATED union in `model/`
-- (`DecisionViaAssignment` | `DecisionViaStaffGrant`), which is exactly what
-- `0010` said this table would owe the day `via` carried a second kind:
-- *"There is no discriminant column here because there is none on the type.
-- The day `via` becomes an input to a decision, it needs one, and this
-- paragraph is the warning that it does."* `via` is still not an input; it
-- now carries two kinds of authority, and recording a grant id in
-- `assignment_id` would be the un-discriminated id that paragraph warns about.
--
-- ---------------------------------------------------------------------
-- 🛑 §2 · THE SHAPE: TWO ARMS, EXCLUSIVE, AND THE DISCRIMINANT IS WHICH ONE IS
--    PRESENT. `access_grant_id` is non-NULL exactly when the three assignment
--    columns are all NULL. The `NOT NULL`s are relaxed only so the CHECK can
--    state the arm; every row `0010` admitted still satisfies the CHECK
--    unchanged (assignment arm, grant column NULL), and no row can be written
--    that carries neither authority or both.
--
-- ⚠️ A `CHECK` THAT EVALUATES TO NULL PASSES (G411). Every term below is an
--    `IS [NOT] NULL` test, which is never NULL, so the constraint cannot be
--    satisfied by an unknown.
--
-- 🛑 §3 · THE GRANT ARM HAS A FOREIGN KEY AND THE ASSIGNMENT ARM DOES NOT, AND
--    THE ASYMMETRY IS `0010`'s OWN REASONING APPLIED, NOT REVERSED. The
--    assignment arm names one of THREE tables (tenant, platform, partner
--    assignments) and a foreign key names one; the grant arm names exactly
--    one, `tenant.tenant_access_grant`. The key is COMPOSITE on `tenant_id`,
--    so a via line naming a grant in another tenant is UNREPRESENTABLE rather
--    than refused — G576's shape. MATCH SIMPLE: every assignment-arm row has
--    `access_grant_id` NULL and is never checked. No `ON DELETE` action: the
--    grant table has no `DELETE` grant to any serving role (`0008`), and a
--    tenant deletion cascades both tables from `tenant.tenant`.
--
-- ⚠️ NO NEW GRANT. `0010`'s table-level `GRANT SELECT, INSERT … TO tenant_rw`
--    covers a column added later, and RLS is `0010`'s, undisturbed by an
--    `ADD COLUMN`. Still NO `UPDATE` and NO `DELETE`: append-only as a
--    privilege, unchanged.
-- =====================================================================

ALTER TABLE tenant.authorization_grant_via ALTER COLUMN assignment_id DROP NOT NULL;
ALTER TABLE tenant.authorization_grant_via ALTER COLUMN role_id DROP NOT NULL;
ALTER TABLE tenant.authorization_grant_via ALTER COLUMN role_version DROP NOT NULL;

ALTER TABLE tenant.authorization_grant_via ADD COLUMN access_grant_id text;

ALTER TABLE tenant.authorization_grant_via
  ADD CONSTRAINT authorization_grant_via_one_authority CHECK (
    (access_grant_id IS NULL
      AND assignment_id IS NOT NULL
      AND role_id IS NOT NULL
      AND role_version IS NOT NULL)
    OR
    (access_grant_id IS NOT NULL
      AND assignment_id IS NULL
      AND role_id IS NULL
      AND role_version IS NULL)
  );

ALTER TABLE tenant.authorization_grant_via
  ADD CONSTRAINT authorization_grant_via_access_grant_fk
  FOREIGN KEY (tenant_id, access_grant_id)
  REFERENCES tenant.tenant_access_grant (tenant_id, id);

-- *"Which acts ran under this grant"* — the reverse question, and the one an
-- investigation of an FDE's reach starts from.
CREATE INDEX authorization_grant_via_access_grant_idx
  ON tenant.authorization_grant_via (tenant_id, access_grant_id);

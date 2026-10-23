-- =====================================================================
-- 0002 — RUN, THE FIRST TABLE THE REQUEST PATH READS.
--
-- 0001 carried invariant 1 into the database over `tenant_contact`, which is a
-- TENANCY concern. This adds the first RECONCILIATION entity, because
-- `GET /v1/runs` is the operation the first HTTP slice serves and it needs
-- something to serve.
--
-- 🛑 WHY `listRuns` AND NOT SOMETHING SMALLER.
--    `docs/contracts/README.md` rules F1 Tenant Context IN-PROCESS and says it
--    "must not become" an HTTP API, so `POST /context/resolve` — the obvious
--    first endpoint — is not available at any price. The capability tier is
--    "the only tier a customer's browser meets"; `listRuns` is its plainest
--    read; and its two query parameters carry constraints that exist ONLY in
--    the OpenAPI document — a five-member `status` enum and
--    `limit: {minimum: 1, maximum: 200}` — which is what makes ruling 1
--    ("the contracts are the router and the validator") assertable rather than
--    aspirational.
--
-- RULINGS THIS APPLIES (docs/HANDOFF.md §3), all identically to 0001:
--   G97   every branded id is `text`; the slug is stored VERBATIM. No uuid.
--   G100  the policy DENIES on NULL. A forgotten transaction yields an EMPTY
--         result set, never another tenant's rows.
--   G101  transaction-mode pooling assumed; `SET LOCAL` inside an explicit
--         transaction, issued only by `withTenantScope()`.
--   G88   forward-only expand/contract. 0001 IS NOT EDITED BY THIS FILE.
--
-- 🛑 WHAT IS DELIBERATELY NOT HERE.
--    `SetReconciliationResult.completeness`, `postconditions`, `residue`,
--    `admissionRates` and `refusedAtAdmission` reach NO contract tier — the
--    `Run` schema in capability.openapi.yaml is `additionalProperties: false`
--    with no findings channel at all, and its own comment says so. Storing
--    columns no wire can carry would create a second vocabulary with nothing
--    checking it. They land with the schemas that publish them.
-- =====================================================================


-- ---------------------------------------------------------------------
-- THE COLUMNS ARE THE CONTRACT'S, AND THE MAPPING IS ONE-TO-ONE.
--
-- `capability.openapi.yaml` → `components.schemas.Run`:
--   required [runId, definitionId, definitionVersion, periodId, trigger,
--             status, startedAt]
--
--   runId              -> id                  (with tenant_id, the composite PK)
--   definitionId       -> definition_id
--   definitionVersion  -> definition_version  "Pins the definition as it stood,
--                                              so a re-run is distinguishable."
--   periodId           -> period_id           nullable: "Null for continuous
--                                              reconciliation with no period."
--   trigger.kind       -> trigger_kind        RunTrigger is an object on the
--                                              wire; only `kind` is stored,
--                                              because attribution beyond it
--                                              arrives with `admitRun`, which
--                                              this slice does not serve.
--   status             -> status
--   startedAt          -> started_at
--   finishedAt         -> finished_at         nullable
--   exceptionsRaised   -> exceptions_raised   nullable
--   inputs             -> inputs              jsonb, "Document ids per slot,
--                                              pinned at admission."
--
-- ⚠️ `status` AND `trigger_kind` CARRY NO CHECK CONSTRAINT, AND THAT IS A
--    DECISION RATHER THAN AN OMISSION. Both are closed enums in
--    `capability.openapi.yaml` AND in `model/domain.ts`, and
--    `tools/check-wire-mirror.mjs` plus `tests/contracts/run-status-wire.test.mjs`
--    are what hold those two lists together. A third copy here would be a third
--    place to drift — and the one nothing checks, because no pair in the
--    wire-mirror addresses SQL. O-16 added `incomplete` to two lists on
--    16 Aug 2026; a CHECK constraint would have been the list nobody updated,
--    and the failure mode is a run the engine cannot record.
--
-- THE PRIMARY KEY IS COMPOSITE for the same reason `tenant_contact`'s is
-- (model/domain.ts:629 on `Endpoint`): a cross-tenant reference has to be
-- unrepresentable rather than merely unlikely.
-- ---------------------------------------------------------------------

CREATE TABLE run (
  tenant_id          text        NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  id                 text        NOT NULL,
  definition_id      text        NOT NULL,
  definition_version integer     NOT NULL,
  period_id          text,
  trigger_kind       text        NOT NULL,
  status             text        NOT NULL,
  inputs             jsonb,
  started_at         timestamptz NOT NULL,
  finished_at        timestamptz,
  exceptions_raised  integer,

  PRIMARY KEY (tenant_id, id)
);


-- `listRuns` is "Runs, most recent first" and pages by keyset on
-- (started_at, id). The index carries tenant_id first because every query
-- arrives already filtered to one tenant BY THE POLICY — the planner sees that
-- predicate even though no handler wrote it.
CREATE INDEX run_recent_idx ON run (tenant_id, started_at DESC, id DESC);


-- =====================================================================
-- ROW-LEVEL SECURITY — the same four statements as 0001, for the same reasons.
--
-- `FORCE` is not decoration: `ENABLE` alone leaves the TABLE OWNER exempt, so a
-- test connecting as the owner would pass with the policy doing nothing and
-- pass just as well with the policy dropped. `FORCE` is what makes the explicit
-- `BYPASSRLS` attribute on reconcile_migrator the ONLY route to the read
-- exemption — separately grantable, separately revocable, G100.
--
-- The predicate's null polarity is 0001's, verbatim and deliberately so:
--
--     nullif(current_setting('app.tenant_id', true), '')
--
--   `missing_ok = true`  — an unset variable returns NULL instead of raising,
--                          because the empty read is the behaviour that is
--                          identical under both pooling modes.
--   `nullif(…, '')`      — a GUC that was SET and reverted reads back as the
--                          EMPTY STRING, not NULL. Without this the predicate
--                          is `tenant_id = ''`, which denies BY ACCIDENT and
--                          only because no tenant id happens to be empty —
--                          a rule keyed on a convenient landmark instead of the
--                          property it protects (docs/HANDOFF.md §5.1).
--   `tenant_id = NULL`   — NULL is not TRUE, so the row is filtered.
--                          THE POLICY DENIES ON NULL.
--
-- `WITH CHECK` is stated explicitly rather than defaulted from `USING`, so a
-- later `FOR SELECT`/`FOR ALL` edit cannot silently drop the write half.
-- =====================================================================

ALTER TABLE run ENABLE ROW LEVEL SECURITY;
ALTER TABLE run FORCE  ROW LEVEL SECURITY;

CREATE POLICY run_rls ON run
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- DML only, and no CREATE on the schema — 0001 already revoked that from
-- PUBLIC. reconcile_app cannot alter this table and therefore cannot drop the
-- policy protecting it.
GRANT SELECT, INSERT, UPDATE, DELETE ON run TO reconcile_app;

-- =====================================================================
-- 0004 — THE SUBJECT LEDGER. G178, 23 Aug 2026, for #239 [I-5].
--
-- WHAT IT IS FOR. `RulePredicate.unique_within` has declared cross-run
-- uniqueness since before this pass began and nothing evaluated it — the
-- control was declared and did nothing. `model/reconciliation.ts` §11 is the
-- evaluator; this table is the state it evaluates against, because `period` and
-- `tenant_lifetime` cross run boundaries and no in-run check can see them.
--
-- 🛑 THE `UNIQUE` CONSTRAINT IS THE RACE GUARD AND IS THE POINT OF THE TABLE.
--    A check-then-insert is NOT it: two runs can both read "absent" before
--    either writes, and both then pay the same invoice. The pre-flight query
--    narrows the window; `subject_ledger_unique` closes it. G178 states this in
--    its own cell and it is the sentence to read before changing anything here.
--
-- 🛑 IT STORES A CANONICAL HASH AND NEVER THE RAW SUBJECT VALUE — amendment (b).
--    A raw invoice number is counterparty-controlled text, and this is a
--    PERMANENTLY-RETAINED, QUERYABLE column: `tenant_lifetime` means the ledger
--    remembers a value a data subject may have a PDPA right to erase. The hash
--    is produced by `model/canonical.ts` (G20) and hashed OUTSIDE `model/`,
--    which that module states for itself: *"It does not hash … The hasher lives
--    with the writer, outside `model/`."*
--
--    COST, STATED IN THE RULING AND NOT SOFTENED HERE: the ledger alone can no
--    longer show WHICH prior invoice collided — only that one did. That is
--    accepted. The alternative is a permanent plaintext index of every
--    identifier every counterparty ever sent.
--
-- ⚠️ SCHEMA-QUALIFIED, BECAUSE 0003 SAYS EVERY MIGRATION FROM 0004 ON MUST BE.
--    `db/provision.ts` sets `search_path = tenant, public`, and PostgreSQL
--    creates an unqualified table in the first EXISTING schema of that path —
--    which is why `run` is in `public` and everything after 0003 lands in
--    `tenant`. 0003's own header: *"Qualify every CREATE TABLE explicitly from
--    0004 on, or the schema a table lives in becomes a side effect of migration
--    order."* This is the first migration that sentence governs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- THE TABLE.
--
-- `text` for every branded id, under G97: the slug is stored verbatim, there is
-- no `uuid` anywhere in the model, and `text` compares like-for-like against
-- `current_setting('app.tenant_id')` with no cast — that comparison IS the RLS
-- predicate below.
--
-- ⚠️ `scope` IS CHECKED AGAINST THE FOUR THE MODEL DECLARES, not left open.
--    `UNIQUENESS_SCOPES` in `model/reconciliation.ts` is the source; a fifth
--    scope is a schema change here as well as a compile error there, which is
--    the point — a scope the evaluator cannot answer must not be storable.
--
-- 🛑 `subject_digest` IS NOT NULLABLE AND HAS NO DEFAULT. A NULL digest would
--    make the unique constraint below vacuous for that row — in PostgreSQL two
--    NULLs are distinct under a UNIQUE constraint, so every unhashed row would
--    insert successfully and collide with nothing. The evaluator's
--    `subject_not_digested` refusal is the model-side half of the same rule.
-- ---------------------------------------------------------------------

CREATE TABLE tenant.subject_ledger (
  tenant_id      text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  scope          text        NOT NULL
                             CHECK (scope IN ('group', 'run', 'period', 'tenant_lifetime')),
  -- The canonical hash. NEVER the subject value. See the header.
  subject_digest text        NOT NULL,
  -- Which run first wrote this digest. An id, not a payload: it is what an
  -- authorised follow-up read joins on, and it carries no counterparty text.
  first_seen_run text        NOT NULL,
  first_seen_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 🛑 THE COLUMN THAT IS DELIBERATELY NOT HERE, AND THE TEST THAT DECIDED IT.
--    READ THIS BEFORE ADDING ONE.
--
-- The first draft of this file carried a NOT NULL column naming the grant each
-- insert ran under, on #239 §7's reasoning: *"The pre-flight query and the
-- post-flight insert are acts against tenant data; each carries the
-- authorisation of the grant it ran under."* That reasoning is correct and the
-- column was still wrong HERE — and `tests/http/authorisation-record.test.ts`
-- is what said so, going RED the moment the column name appeared anywhere
-- under `db/migrations/`.
--
-- ⚠️ THE VOCABULARY IS CITED BY ANCHOR AND NOT BY NAME BELOW, AND THAT IS NOT
--    COYNESS. That suite greps this directory for seven exact words AND READS
--    COMMENTS DELIBERATELY — its own note says a comment naming the mechanism
--    *"is exactly how a half-built one gets introduced"*. A paragraph
--    explaining the absence in the forbidden words would re-fire the tripwire
--    it is explaining. Run the suite to see the list:
--
--        grep -n 'AUTHORISATION_VOCABULARY' -A 10 tests/http/authorisation-record.test.ts
--
-- WHY THE COLUMN LOST. That suite is a TRIPWIRE and its polarity is the point:
-- invariant 10 is UNBUILT on every served path. Nothing in `server/` mints a
-- grant, records a read, or writes any of the three record types `model/`
-- declares for the purpose. Its header states the exact failure this migration
-- was about to produce: *"What must not happen is a … table that nothing
-- writes, or a write with a null or invented grant id."*
--
-- **A NOT NULL column no code path populates is not enforcement of invariant
-- 10; it is the appearance of it.** There is no writer for this table in this
-- slice — `model/reconciliation.ts` §11 is pure and reaches no database, and no
-- operation is mounted — so the column would have been filled later by whoever
-- built the writer, with whatever they had to hand. The two things available
-- would have been a NULL where the model forbids one, or a minted id standing
-- for no authorisation anybody performed. Both are worse than the gap, because
-- both produce an audit trail that reads as evidence and is not.
--
-- 🛑 THE OBLIGATION IS DEFERRED, NOT DISCHARGED, AND IT BELONGS IN ONE COMMIT.
--    The commit that builds the ledger writer adds the column, the grant that
--    fills it, and the assertions that the record is WRITTEN — inside the same
--    `withTenantScope()` transaction as the insert, so a record cannot outlive
--    a rolled-back act. The tripwire will go RED again on that commit, which is
--    exactly when it should, and its header says what to do then: replace its
--    assertions and delete it.
--
--    ⚠️ DO NOT ADD THE COLUMN AHEAD OF THE WRITER TO SILENCE A REVIEW COMMENT.
--    The tripwire exists because a gap nothing names *"gets closed by accident,
--    half way, by somebody who did not know it was open."*
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- THE RACE GUARD.
--
-- Scoped by `tenant_id` FIRST, so the constraint can never be satisfied across
-- a tenant boundary — a digest colliding between two tenants is not a duplicate
-- invoice, it is two customers who happen to number invoices the same way, and
-- treating it as a collision would leak the existence of the other tenant's row
-- through a refusal.
--
-- ⚠️ RLS DOES NOT ENFORCE THIS; THE CONSTRAINT DOES. A unique index is checked
--    beneath row-level security, so it sees rows the querying session cannot.
--    That is exactly what makes it a race guard and it is also why `tenant_id`
--    must be the leading column: without it, one tenant's insert could be
--    refused by a row it is not permitted to see.
-- ---------------------------------------------------------------------

CREATE UNIQUE INDEX subject_ledger_unique
  ON tenant.subject_ledger (tenant_id, scope, subject_digest);

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY — G100's deny-on-NULL, written as the predicate rather
-- than described.
--
-- `ENABLE` and `FORCE`, both: `ENABLE` alone exempts the table OWNER, and the
-- owner is `reconcile_owner`, so without `FORCE` the protection would depend on
-- which role happened to connect.
--
-- `nullif(current_setting('app.tenant_id', true), '')` is 0001's predicate
-- verbatim. The `true` makes an unset setting return NULL instead of raising;
-- the `nullif` turns the empty string into NULL as well; and `= NULL` is NULL,
-- which is not TRUE, so a query outside `withTenantScope()` sees ZERO ROWS
-- rather than every row. A forgotten transaction yields an empty result set,
-- not a cross-tenant read.
--
-- `WITH CHECK` is stated explicitly rather than left to default from `USING`,
-- for 0001's reason: a later `FOR SELECT`/`FOR ALL` edit cannot then silently
-- drop the write half.
-- ---------------------------------------------------------------------

ALTER TABLE tenant.subject_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.subject_ledger FORCE  ROW LEVEL SECURITY;

CREATE POLICY subject_ledger_rls ON tenant.subject_ledger
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

-- ---------------------------------------------------------------------
-- GRANTS. By name, because 0003 deliberately declines to set
-- `ALTER DEFAULT PRIVILEGES` on this schema: *"A future table created here is
-- unreachable by the app until granted BY NAME … default privileges would
-- silently hand the request path a table nobody decided to expose."* This is
-- the one grant line that costs, paid visibly.
--
-- DML only, and no `CREATE`. The app role cannot alter this table and therefore
-- cannot drop the policy protecting it.
-- ---------------------------------------------------------------------

GRANT SELECT, INSERT, DELETE ON tenant.subject_ledger TO tenant_rw;

-- ⚠️ NO `UPDATE`, AND IT IS A DECISION RATHER THAN AN OVERSIGHT. A ledger row
--    records that a digest was seen; nothing about that fact can later become
--    untrue. `DELETE` is granted because the retention sweep needs it — held
--    work and ledger rows both expire — and `UPDATE` is granted to nobody,
--    so a row cannot be silently re-pointed at a different run.

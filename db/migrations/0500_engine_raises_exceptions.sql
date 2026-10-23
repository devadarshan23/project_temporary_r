-- =====================================================================
-- 0500 — THE ENGINE RAISES THE EXCEPTIONS A RUN PRODUCES, AND NOTHING
--        THAT SERVES A REQUEST CAN.
--        G3741–G3750 (4 Oct 2026). DERIVED, NOT THE OWNER'S — it answers
--        G3623, which `0480` named: *"the writer that owes this column is the
--        executor slice that first raises a persisted exception, and it lands
--        with its own `GRANT INSERT` (`0004`, G511)."* This is that slice, and
--        `server/data-plane/exception-raise.ts` is the writer, in the same
--        commit.
--
-- 🛑 READ §1 BEFORE ANYTHING ELSE. THE PRIVILEGE IS THE WHOLE QUESTION.
--
-- §1  THE GRANT GOES TO A NEW ROLE, `reconcile_engine`, AND NOT TO `tenant_rw`.
--
--    `0015` refused `INSERT` on `tenant.exception` in its own voice:
--
--      *"a request path that could INSERT an exception could **mint a finding
--       against itself**: raise a `critical` row, assign it, and the queue a
--       controller closes a period on is a queue the caller wrote."*
--
--    MEASURED, NOT ASSUMED: the run worker connects as `reconcile_app`.
--    `server/data-plane/run-worker-main.ts` calls `createAppPool()`, and
--    `infra/lib/run-queue-stack.ts` hands the worker task
--    `RECONCILE_APP_PASSWORD` — the SAME role every request handler holds. So
--    `GRANT INSERT … TO tenant_rw` (the shape every other write in this
--    directory takes) would hand the request path exactly the verb `0015`
--    refused, and every gate, policy and invariant 10 record would log a
--    self-minted finding as perfectly correct.
--
--    THREE SHAPES WERE CONSIDERED. ONE IS TAKEN.
--
--      (a) TAKEN — A SECOND LOGIN ROLE, `reconcile_engine`, `NOBYPASSRLS`,
--          a MEMBER of `reconcile_app` (so it reads and writes everything the
--          executor already did — `0001`/`0002`'s direct grants on `public`
--          and `tenant_rw`'s on `tenant` — under the same row level
--          security) and the
--          ONLY holder of `INSERT` on the two exception tables. The privilege
--          is a property of the CREDENTIAL, which is R9's argument one database
--          over (G1423, `0040` / `db/control-write-scope.ts`): *"a read pool's
--          protection is a HELPER a second caller need not use, while a grant
--          is a property of the CREDENTIAL."* And it is G1542's argument one
--          layer down: R-W gave the worker its OWN task role precisely so that
--          *"a request path [could not] drain the queue"*. The serving process
--          is never handed `RECONCILE_ENGINE_PASSWORD`, and `reconcile_app` is
--          NOT a member of `reconcile_engine`, so `SET ROLE reconcile_engine`
--          from a request transaction is refused by the server
--          (`tests/db/engine-raises-exceptions.test.ts` §1b). MEASURED, and
--          it is structural rather than remembered: while `reconcile_engine`
--          is a member of `reconcile_app`, PostgreSQL REFUSES the reverse —
--          `ERROR: role "reconcile_engine" is a member of role "reconcile_app"`
--          — and `createRoles()` revokes it on every run anyway, because a role
--          outlives every schema reset.
--
--      (b) REFUSED — a RESTRICTIVE policy admitting the INSERT only when a GUC
--          the executor sets is present. Every GUC in this schema is set with
--          `set_config()`, which `reconcile_app` may call with any value; the
--          gate would be a CONVENTION the next handler need not follow, and
--          `0019`'s `app.authorisation_ref` is honest about exactly that limit
--          (*"exactly as strong as invariant 1's own fence and no stronger"*).
--          A GUC fence on a privilege the request path HOLDS is a fence the
--          request path can open.
--
--      (c) REFUSED — `SECURITY DEFINER` function. G160 refused that object,
--          and `FORCE ROW LEVEL SECURITY` binds the owner, so the only role it
--          would work as is the `BYPASSRLS` migrator — the read exemption every
--          isolation assertion in `tests/` is relative to.
--
--    ⚠️ THE ROLE IS CREATED IN `db/provision.ts` AND NOT HERE. A migration
--       runs as `reconcile_owner`, which holds no `CREATEROLE`, and a role is
--       cluster-wide — `0020` (control) records the same placement. The GRANTs
--       below therefore require `createRoles()` to have run first, which is
--       the order `provision()` → `applyMigrations()` already has everywhere.
--
-- §2  A RESTRICTIVE `FOR INSERT` POLICY THAT PINS THE ENGINE'S OWN WRITE
--     SHAPE, ON EVERY ROLE.
--
--    The grant decides WHO; this decides WHAT a raised row may be. It is
--    `RESTRICTIVE` and carries no `TO`, so it binds `reconcile_engine` today
--    and any role a later commit grants `INSERT` — `0059`'s *"the property
--    survives a wider grant"*. An inserted exception must:
--
--      · NAME ITS RUN (`run_id IS NOT NULL`) — the owner's G3621, verbatim:
--        *"exceptions record the run that raised them"*. `0480` left the
--        column nullable for rows stored BEFORE it; nothing raised after it
--        may be unattributed.
--      · BE RAISED INSIDE ITS RUN'S ACCOUNT — a `tenant.run_engine_account`
--        row for that run must already be visible. The executor writes the
--        account and then the exceptions in ONE transaction, so this is
--        satisfiable exactly there, and an exception for a run nobody
--        reconciled is unrepresentable.
--      · CARRY NO AUTHORED PROSE (`explanation_summary IS NULL`) — R-D, THE
--        OWNER'S: *"Store typed facts only … the sentence is composed where it
--        is displayed."* `0161` made the column nullable; this makes it NULL
--        for every row the engine raises, in SQL rather than in a review.
--      · ARRIVE OPEN AND UNTOUCHED (`status = 'open'`, no assignee, no
--        resolution). A raised finding that arrives already resolved is a
--        resolution with no proposal, no approval and no authorisation record
--        — `0059`'s whole chain skipped by an INSERT.
--
--    ⚠️ THE MIGRATOR IS `BYPASSRLS` AND IS NOT BOUND, which is why the staging
--       seeds (`db/seeds/*`), which DO carry composed summaries (G3133), still
--       apply. That is the seeds' shape, not this policy's hole.
--
-- §3  WHERE THE ENGINE'S UNPRODUCED FIELDS COME FROM: DECLARED, NEVER INVENTED.
--
--    A residue entry is not yet an `Exception`. `model/reconciliation.ts`
--    says so in its own voice: *"A residue row HAS no severity … severity is
--    assigned when an exception is raised. Defaulting to `'low'` would buy a
--    pass through the severity dial."* And `tenant.exception` requires five
--    things the engine does not produce: `rule_id`, `rule_version`,
--    `rule_label`, `severity`, `domain`.
--
--    `tenant.definition_exception_rule` is where an operator DECLARES what a
--    residue entry raises, per (definition, side, cause kind) — the cause kind
--    being `ResidueCause['kind']`, the engine's own closed vocabulary. A
--    residue entry whose (side, cause) has NO row raises NOTHING: it stays in
--    `run_residue`, readable through `listRunResidue`, and the executor reports
--    how many were withheld. Withholding is not a loss; inventing a severity
--    would be.
--
--    `rule_label` is the operator's, not ours and not the counterparty's, and
--    the model says what it is for: *"Human-readable; becomes the `expected`
--    clause of the explanation"* (`MatchRule.label`). So it fills
--    `explanation_expected`, which `0015` keeps `NOT NULL` and `0161` did NOT
--    widen — **no migration to that column is needed and none is made.**
--
--    ⚠️ `domain` GOES ON THE DEFINITION, NOT ON EACH RULE. `0069` §1 refused a
--       `domain` column on `reconciliation_definition` because nothing read it;
--       the executor is the reader, in this commit — `0420`'s precedent for
--       `name`, and NULLABLE for `0420`'s reason: staging holds definitions and
--       both a default and a backfill would invent a domain. A definition with
--       no declared domain raises nothing, and says so.
--
--    `SELECT` AND NOTHING ELSE ON THE RULE TABLE, ON `0160`'s GROUND: *"a
--    caller who chooses the operands chooses the answer."* A path that could
--    write a declaration could set its own findings' severity to `low` and
--    bury them. THE WRITER IS OWED — no operation on any tier authors one.
--
-- §4  IDEMPOTENCY IS INHERITED, NOT ADDED.
--
--    A redelivered message (G1525) reaches the executor's `already_accounted`
--    arm and writes nothing; two concurrent deliveries collide on
--    `run_engine_account`'s PRIMARY KEY and the loser's transaction — its
--    exceptions included — rolls back. Exception ids are DETERMINISTIC
--    (`exc_<run>_r<residue ordinal>`), so `tenant.exception`'s own primary key
--    is a second, independent guard. Both are witnessed.
--
-- ⚠️ NO `CHECK` ON ANY VOCABULARY COLUMN (`0007`/`0069`'s polarity): an
--    unknown severity or cause kind must reach the reader as an `unreadable`
--    refusal, not be rejected at write time by a list somebody forgot to extend.
-- =====================================================================

-- §1 ---------------------------------------------------------------------
GRANT INSERT ON tenant.exception                TO reconcile_engine;
GRANT INSERT ON tenant.exception_observed_value TO reconcile_engine;

-- §2 ---------------------------------------------------------------------
CREATE POLICY exception_raised_by_engine_restrictive ON tenant.exception
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    run_id IS NOT NULL
    AND explanation_summary IS NULL
    AND status = 'open'
    AND assigned_to IS NULL
    AND resolution_mode IS NULL
    AND EXISTS (
      SELECT 1
        FROM tenant.run_engine_account a
       WHERE a.tenant_id = exception.tenant_id
         AND a.run_id    = exception.run_id
    )
  );

-- §3 ---------------------------------------------------------------------
ALTER TABLE tenant.reconciliation_definition ADD COLUMN domain text;

CREATE TABLE tenant.definition_exception_rule (
  tenant_id     text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  definition_id text    NOT NULL,
  -- `PopulationSide` — which side's residue this declaration raises for.
  side          text    NOT NULL,
  -- `ResidueCause['kind']`, the engine's closed vocabulary. No CHECK; see foot.
  cause_kind    text    NOT NULL,

  -- `MatchRule.id` / `.version` / `.label` / `.severity`, as the operator
  -- declared them. Pinned onto the exception at raise time (`0015`'s
  -- `rule_version`: *"an exception raised under v1 must stay explicable when
  -- the rule moves on"*).
  rule_id       text    NOT NULL,
  rule_version  integer NOT NULL,
  rule_label    text    NOT NULL,
  severity      text    NOT NULL,

  PRIMARY KEY (tenant_id, definition_id, side, cause_kind),
  FOREIGN KEY (tenant_id, definition_id)
    REFERENCES tenant.reconciliation_definition (tenant_id, id) ON DELETE CASCADE
);

ALTER TABLE tenant.definition_exception_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.definition_exception_rule FORCE  ROW LEVEL SECURITY;

CREATE POLICY definition_exception_rule_rls ON tenant.definition_exception_rule
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

GRANT SELECT ON tenant.definition_exception_rule TO tenant_rw;

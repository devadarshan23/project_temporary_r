-- =====================================================================
-- CONTROL PLANE 0040 — THE ONBOARDING WRITER. G1421/G1422/G1423/G1424
-- (21 Sep 2026).
--
-- **NO TABLE AND NO COLUMN: ONE ROLE'S WORTH OF GRANTS, ONE
--   `CREATE FUNCTION` AND ONE `CREATE TRIGGER`.** This is the first write
--   privilege this database has ever granted to anything that serves a
--   request, and the trigger is the property that privilege spends.
--
-- **R9, THE OWNER'S RULING OF 21 Sep 2026**, quoted because a paraphrased
-- ruling is a changed ruling:
--
--     "Yes, the data plane may hold a WRITING credential for the control
--      database, via a sixth scope helper and a second control-database
--      role."
--
-- ⚠️ **THE RULING IS THE OWNER'S. G1421–G1424 BELOW ARE DERIVED AND SAY SO
--    ON THEIR OWN FACES**, as G190, G356, G376, G511, G531, G533, G576,
--    G602, G782, G783, G832, G834, G941, G961, G1091, G1242 and G1243 do.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE OWNER ACCEPTED TWO NAMED COSTS AND THIS FILE PAYS THE SECOND. THE
--    FIRST IS PAID IN `tests/db/control-plane-census.test.ts`.
-- ═══════════════════════════════════════════════════════════════════════
--
--   (a) **`tests/db/control-plane-census.test.ts` §A GOES RED BY DESIGN.**
--       That assertion requires every serving role to hold NO write on any
--       relation in this database, and it is what G1161 put in place of
--       G193's *by construction*. A third role holding `UPDATE` is exactly
--       what it was written to catch. **It is re-argued at its own site, in
--       this commit, rather than loosened quietly** — the census now
--       partitions into *"no serving role writes anything EXCEPT the
--       argued write-role allow-list"*, which is the shape §C already used
--       for reads.
--
--       🛑 AND THE SHARPER HALF, WHICH THE CENSUS'S OWN HEADER GETS WRONG
--       AND WHICH IS FIXED IN THE SAME COMMIT: that header claims *"a third
--       role cannot arrive without either joining this census or failing to
--       compile somewhere."* **That was not true.** `SERVING_ROLES` is a
--       hand-written array, and a new `export const` joins nothing. Minting
--       `reconcile_control_writer` without touching that array would have
--       left §A GREEN and the write INVISIBLE — a census passing because it
--       was not looking, which is §5.6 inside the control written to replace
--       a construction. The role is added to `SERVING_ROLES` here.
--
--   (b) **`onboarding_record` HAD NO TRIGGER, AND ITS APPEND-ONLY-NESS WAS
--       ENTIRELY THE MODEL REFUSING `stepAlreadyDone`.** Nothing in SQL
--       stopped `completed_steps` going DOWN. That cost nothing while no
--       role held `UPDATE`; **it costs the property the moment this file
--       grants one**, and the owner named it in advance: *"A slice granting
--       `UPDATE (completed_steps)` owes a `BEFORE UPDATE` trigger on
--       `0059`'s precedent, or it spends a property and replaces it with
--       nothing."* That trigger is below.
--
-- ⚠️ **A `CHECK` CANNOT EXPRESS IT AND THAT IS WHY IT IS A TRIGGER RATHER
--    THAN THE CHEAPER OBJECT.** A `CHECK` sees one row; monotonicity is a
--    relation between OLD and NEW. `db/migrations/0059_resolution_chain.sql`
--    states the same finding for the same reason — *"a POLICY cannot see
--    what changed: `WITH CHECK` sees the NEW row, `USING` sees the OLD one,
--    and neither sees both"* — and reaches for a `BEFORE UPDATE` trigger.
--    This is that precedent, one database over.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 WHY A SECOND ROLE AND NOT A WIDER `reconcile_control_reader` — G1421.
--    **MEASURED, NOT PREFERRED.**
-- ═══════════════════════════════════════════════════════════════════════
--
-- The one-line alternative is `GRANT UPDATE … TO reconcile_control_reader`,
-- and `db/control-read-scope.ts`'s `BEGIN READ ONLY` looks like it would
-- contain the damage. **It does not, and the reason is that the transaction
-- mode is a property of the HELPER while the grant is a property of the
-- CREDENTIAL.** Witnessed against a live PostgreSQL 14.18 before this file
-- was written:
--
--     GRANT UPDATE (completed_steps) ON onboarding_record TO <reader>;
--     -- through the helper, as every console READ goes:
--     BEGIN READ ONLY; UPDATE onboarding_record SET completed_steps = 0;
--       -> ERROR:  cannot execute UPDATE in a read-only transaction
--     -- and through an ordinary transaction, as anything else would:
--     BEGIN;            UPDATE onboarding_record SET completed_steps = 0;
--       -> the statement is PERFORMED
--
-- **The second line is the whole argument.** The read pool's protection is
-- one helper that a second caller need not use, and `ControlReadPool` has no
-- `query` precisely because somebody would. Widening the reader would put a
-- privilege behind a convention; a separate role puts it behind a
-- credential, and `db/control-write-scope.ts` is the only module that holds
-- one.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 AND FOUR MORE MEASUREMENTS, RUN ON THE SAME CLUSTER AND THE SAME
--    FIXTURE, BECAUSE THREE CLAIMS BELOW WOULD OTHERWISE BE ARGUMENTS.
-- ═══════════════════════════════════════════════════════════════════════
--
--     -- the COLUMN list really bites, and it bites on the table:
--     as writer: UPDATE onboarding_record SET tenant_id = 'ten_other';
--       -> ERROR:  permission denied for table onboarding_record
--     as writer: UPDATE onboarding_record SET completed_steps = 4;
--       -> the statement is PERFORMED
--
--     -- `TRUNCATE` and `DELETE` are refused by the PRIVILEGE, which is what
--     -- the no-TRUNCATE-arm paragraph below rests on:
--     as writer: TRUNCATE onboarding_record;     -> permission denied
--     as writer: DELETE FROM onboarding_record;  -> permission denied
--
--     -- and row locking survives a COLUMN-LEVEL grant, which is not
--     -- obvious and which the handler depends on:
--     as writer: SELECT completed_steps FROM onboarding_record
--                 WHERE tenant_id = 'ten_probe' FOR UPDATE;   -> OK
--
-- ⚠️ **THE LAST ONE IS THE ONE THAT COULD HAVE GONE EITHER WAY.**
--    PostgreSQL requires `UPDATE`, `DELETE` or `SELECT … FOR UPDATE`
--    privilege to lock a row, and it was not obvious that a grant naming ONE
--    COLUMN would satisfy a lock that names none. It does. **Had it not,
--    the read-modify-write would have needed a table-level `UPDATE`** — the
--    thing the column list exists to refuse — and this slice would have owed
--    a different shape rather than a wider grant.
--
-- ⚠️ AND THE READER IS NOT WIDENED BY THIS FILE, WHICH IS ASSERTED RATHER
--    THAN ASSUMED: `tests/http/console-roster-unreachable.test.ts` §1d
--    enumerates every `… TO reconcile_control_reader` grant in this corpus
--    and requires the list to be exactly three SELECTs. **That assertion is
--    UNCHANGED by this commit and must stay so.**
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE GRANTS, AND THE FOUR VERBS THAT ARE REFUSED BY NAME — G1422.
-- ═══════════════════════════════════════════════════════════════════════
--
-- Ask what a path holding each one could do, which is the test `0002` sets
-- and `0030` repeats:
--
--   · **`UPDATE (completed_steps)` — COLUMN-LEVEL, and the column list is
--     the control.** `db/migrations/0015_exception_register.sql`'s G358 is
--     the precedent and the only other column-level UPDATE in the product.
--     A table-level `UPDATE` here would put `tenant_id` inside a handler's
--     reach, and a path that could rewrite `tenant_id` could move one
--     customer's delivery record onto another customer — silently, with the
--     foreign key satisfied at both ends.
--
--   · **NO `INSERT` ON `onboarding_record`.** The row's writer is
--     `createTenant`, which is declared and unmounted, and the seed.
--     `0004_subject_ledger.sql`: a write privilege ahead of its writer. A
--     path that could INSERT here could mint a delivery record for a tenant
--     nobody onboarded, and `readConsoleRoster()`'s `onboarding_record_absent`
--     — the refusal that takes the WHOLE roster down — would stop firing for
--     exactly the row that should have fired it.
--
--   · **NO `DELETE` ON `onboarding_record`.** Deleting the row is
--     indistinguishable from a tenant created before `0030` existed, which
--     is the ambiguity `console-roster-store.ts` refuses to resolve by
--     default. A path that could delete could therefore make a live tenant
--     read as absent rather than as onboarding.
--
--   · **`INSERT` AND NOTHING ELSE ON `onboarding_forced_step`.** No
--     `UPDATE`, no `DELETE` — `0010_authorisation_record.sql`'s
--     append-only-as-a-PRIVILEGE, and `0030`'s trigger enforces the same
--     thing against the admin. **The grant and the trigger fail in different
--     directions and neither is a restatement of the other**, which is
--     G1243's argument and is why that file has both.
--
-- ⚠️ `SELECT` ON ALL THREE, AND IT IS NOT OPTIONAL: both writes are
--    READ-MODIFY-WRITE. `completeStep()` and `forceStep()` are pure
--    functions of the CURRENT record, so the handler must read it, decide,
--    and write inside ONE transaction or the decision is about a state that
--    may have moved. `tenancy_roster` is read for the 404 — a tenant that is
--    not on the roster is `resource_not_found` rather than a row nobody
--    wrote.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 WHAT THE TRIGGER DOES **NOT** REFUSE, AND WHY — G1423.
-- ═══════════════════════════════════════════════════════════════════════
--
-- It refuses a DECREMENT and permits an EQUAL write. The rule is *advances
-- only*, not *strictly advances*, and the difference is deliberate:
--
--   · A DECREMENT is unrepresentable in `model/onboarding.ts` — neither
--     transition produces one, `completeStep()` advances by exactly one and
--     `forceStep()` advances to the forced index plus one. So a decrement
--     arriving at this table did not come from the model, and refusing it is
--     refusing a statement no writer of ours can make.
--
--   · An EQUAL write is a no-op that loses nothing, and refusing it would
--     turn an at-least-once RETRY into a 500 where the model already answers
--     `step_already_done` — a 409 the caller can read. **A stricter trigger
--     would move a refusal from a place that explains it to a place that
--     cannot.**
--
-- ⚠️ IT IS **NOT** A SECOND COPY OF THE SEQUENCE'S RULES AND MUST NOT
--    BECOME ONE. The model decides WHICH step may be completed, and that
--    decision needs `ONBOARDING_STEPS`' order, the forced list and the step
--    key; none of it is expressible here without the third copy of the tuple
--    `0030` spends four paragraphs refusing. **This trigger knows one thing:
--    a prefix length does not shrink.** That is the half of the property
--    that survives a handler nobody reviewed.
--
-- ⚠️ IT IS **NOT** `SECURITY DEFINER`, for G160's reason and `0030`'s: it
--    holds no authority, reads no table and takes no decision — it compares
--    two integers and raises. `tests/db/onboarding-write-pool.test.ts` reads
--    `pg_proc.prosecdef` from the catalogue rather than trusting that a
--    keyword was omitted.
--
-- ⚠️ NO `TRUNCATE` ARM, AND THE ASYMMETRY WITH `0030` IS ARGUED RATHER THAN
--    INHERITED — G1424. That file needs a statement-level trigger because a
--    `FOR EACH ROW` trigger never fires on `TRUNCATE`, and its property is
--    *these rows are never destroyed*. **This property is different: it is
--    about the RELATION between two values of one column**, and a `TRUNCATE`
--    produces no NEW row to compare. `TRUNCATE` here is refused by the
--    PRIVILEGE instead — it requires ownership or an explicit grant, and the
--    writer role holds neither — and by `onboarding_record`'s own foreign
--    key, which `0030` gave it and which `tenancy_roster` would block.
--    **`tests/db/onboarding-write-pool.test.ts` witnesses the refusal rather
--    than asserting this paragraph.**
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 NO ROW-LEVEL SECURITY AND NO POLICY, WHICH IS `0001`'s ARGUMENT AND
--    `0002`'s AND `0030`'s, UNCHANGED.
-- ═══════════════════════════════════════════════════════════════════════
--
-- There is no tenant session in this database and there cannot be one. This
-- file adds no table, so it adds no relation to the census's population;
-- what it adds is a GRANTEE, and §A is the assertion that sees one.
-- `db/control-write-scope.ts` sets no `app.*` GUC for the same reason
-- `db/control-read-scope.ts` sets none — derive it,
-- `grep -rn 'app\.tenant_id' db/migrations-control/` returns nothing.
--
-- RULINGS THIS APPLIES (docs/HANDOFF.md §3):
--   R9     the data plane may hold a WRITING credential for the control
--          database, via a sixth scope helper and a second role.
--          **THE OWNER'S.**
--   G1421  the writer is a SECOND ROLE and not a wider reader, because the
--          read helper's `READ ONLY` is a property of the helper and the
--          grant is a property of the credential. Measured. DERIVED.
--   G1422  `UPDATE` is COLUMN-LEVEL on one column; `INSERT` on the forced
--          table and nowhere else; four verbs refused by name. DERIVED.
--   G1423  the trigger refuses a DECREMENT and permits an EQUAL write, and
--          it is not a second copy of the sequence's rules. DERIVED.
--   G1424  no `TRUNCATE` arm, and the asymmetry with `0030` is argued: that
--          property is about rows surviving, this one is about a relation
--          between two values. DERIVED.
--   G511   the fence and the writer are one commit or neither — the two
--          handlers land with this file.
--   G358   column-level `UPDATE`, the second instance in the product.
--   G1161  the data plane reaching this database at all. Untouched in the
--          READ direction; this is a second, narrower edge beside it.
--   G88    forward-only. There is no `down`, and `0030` is not edited — its
--          grants block is corrected ON ITS OWN FACE for a claim that was
--          already false, which is `0017`'s precedent.
--
-- ⚠️ NOT SCHEMA-QUALIFIED, which is `0001`'s convention: there is no
--    `tenant` schema in this database and everything here is `public`.
--
-- ⚠️ THE NUMBER IS 0040 AND 0031–0039 ARE RESERVED ELSEWHERE AND UNSPENT.
--    `tools/check-migration-numbers.mjs` reports a gap and deliberately does
--    not fail on one: a collision makes the order ambiguous, a gap leaves it
--    total.
-- =====================================================================


-- ---------------------------------------------------------------------
-- THE ADVANCE-ONLY TRIGGER — G1423.
--
-- Read the header before changing anything here. The short version: until
-- this commit no role held `UPDATE` on this table, so *"a prefix length
-- never shrinks"* was a property of there being no writer. This file gives
-- it one.
--
-- ⚠️ `RETURN NEW` IS THE ORDINARY PATH. A `BEFORE UPDATE … FOR EACH ROW`
--    trigger that returned `NULL` would silently SKIP the update, which is
--    the one outcome worse than either allowing or refusing it.
-- ---------------------------------------------------------------------

CREATE FUNCTION onboarding_record_advances_only() RETURNS trigger AS $$
BEGIN
  IF NEW.completed_steps < OLD.completed_steps THEN
    RAISE EXCEPTION
      'public.onboarding_record ADVANCES ONLY: % -> % is a decrement'
      , OLD.completed_steps, NEW.completed_steps
      USING HINT =
        'completed_steps is a PREFIX LENGTH, not a counter: model/onboarding.ts '
        'holds the state as "how many steps are done, counted from the front" so '
        'that "step four done, step two not" has nowhere to be written down. '
        'Neither transition can shrink it — completeStep() advances by exactly '
        'one and forceStep() advances to the forced index plus one — so a '
        'decrement arriving here did not come from the model. Un-completing a '
        'step is not a smaller version of completing one: it is a ruling about '
        'what a delivery record MEANS, and nothing in the contract declares an '
        'operation for it.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER onboarding_record_advances_only
  BEFORE UPDATE ON onboarding_record
  FOR EACH ROW
  EXECUTE FUNCTION onboarding_record_advances_only();


-- ---------------------------------------------------------------------
-- GRANTS. To the WRITER role, and to nobody else.
--
-- 🛑 `reconcile_control_reader` GAINS NOTHING HERE AND
--    `reconcile_control_app` GAINS NOTHING HERE. The reader's set stays the
--    three SELECTs `0020` and `0030` gave it — asserted, not assumed, at
--    `tests/http/console-roster-unreachable.test.ts` §1d — and the control
--    plane's own role still cannot see either table, which is `0030`'s
--    narrowing and is unchanged.
--
-- ⚠️ `GRANT USAGE ON SCHEMA public` IS NOT REPEATED for the reader or the
--    app role and IS granted for the writer, because a role cannot reach a
--    relation in a schema it may not use. `0001` did this for the app role
--    and `0020` for the reader.
-- ---------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO reconcile_control_writer;

-- The 404, and the read half of every read-modify-write.
GRANT SELECT ON tenancy_roster           TO reconcile_control_writer;
GRANT SELECT ON onboarding_record        TO reconcile_control_writer;
GRANT SELECT ON onboarding_forced_step   TO reconcile_control_writer;

-- COLUMN-LEVEL. `tenant_id` is deliberately outside the list — see the
-- header: a path that could rewrite it could move one customer's delivery
-- record onto another customer with the foreign key satisfied at both ends.
GRANT UPDATE (completed_steps) ON onboarding_record TO reconcile_control_writer;

-- APPEND, and nothing else. `0030`'s trigger refuses the other two verbs to
-- every role in the cluster; this withholds them from the only one that
-- serves a request.
GRANT INSERT ON onboarding_forced_step TO reconcile_control_writer;

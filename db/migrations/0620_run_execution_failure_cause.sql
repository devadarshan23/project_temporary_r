-- 0620 — WHY A RUN WAS SETTLED `failed` BY THE WORKER. G4366, 5 Oct 2026.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- §0  THE RULING THIS APPLIES — THE OWNER'S, 5 Oct 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- *"Terminal status for an execution error: REUSE `failed` (no contract
-- change); record the reason separately."*
--
-- `failed` already exists on the wire (`RunStatus`, five members) and in
-- `0002`'s column, which carries NO `CHECK` by design. So the STATUS needs no
-- migration. The REASON does: `failed` is also what a run can mean for reasons
-- the engine owns, and an operator looking at a `failed` row must be able to
-- tell *"the engine judged it"* from *"the worker gave up on it"*.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- §1  ONE NULLABLE COLUMN, ON `run`, AND IT REACHES NO WIRE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `execution_failure_cause` — `RUN_EXECUTION_FAILURE_CAUSES` in
-- `server/data-plane/run-executor.ts`: `deadline_exceeded` · `execution_error`.
-- NULL means the worker did not settle this run; NO EXISTING ROW IS GIVEN ONE.
--
-- ⚠️ NO `CHECK` ON THE VOCABULARY — `0007`/`0069`'s polarity: an unknown value
--    must reach a reader as a refusal, not be rejected at write time by a list
--    somebody forgot to extend.
-- ⚠️ ONE `CHECK` THAT IS NOT A VOCABULARY: a cause may stand only beside
--    `failed`. A cause on a `completed` row would be a reason for an outcome
--    the row does not have, and nothing should ever be able to read one.
-- ⚠️ NOT ON THE WIRE. `Run` is unchanged (the ruling: *"no contract change"*);
--    the writer is `settleRunAsFailed()` and the reader is the worker's own log
--    line plus this column for an operator's triage. A wire field is a
--    contract change and is not taken here.
-- ⚠️ NO NEW GRANT: `0002` grants `UPDATE ON run` to the app role, and a
--    table-level grant covers a column added later (`0017`'s precedent).
--    `reconcile_engine` holds it by membership (`0500`).

ALTER TABLE run ADD COLUMN execution_failure_cause text;

ALTER TABLE run ADD CONSTRAINT run_execution_failure_cause_only_when_failed
  CHECK (execution_failure_cause IS NULL OR status = 'failed');

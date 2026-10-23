-- =====================================================================
-- 0510 · THE MONEY DELTA RECORDS ITS DIRECTION — G3803–G3806, 4 Oct 2026.
--
-- ┌─ OWNER RULING, 4 Oct 2026 (C3-02 / C3-09, THE OWNER'S) ────────────────┐
-- │ "Store a signed delta: the engine records direction (over/under); the  │
-- │  column shows sign, totals net correctly, 'In variance' is defined as  │
-- │  the open residual."                                                   │
-- └────────────────────────────────────────────────────────────────────────┘
--
-- THE DEFECT (docs/build/ui-audit/red-c1-round3.md C3-02). `Delta`'s money
-- arm is `{ absolute: Money … }` — a MAGNITUDE — and `0015` stores it in
-- `delta_money_minor`. The engine computed the sign (`signedVarianceMinor`,
-- `leftTotal − rightTotal`) and the writer threw it away, so the register's
-- Variance column printed `+412.35` beside a line whose own text said the pair
-- was declined at `-SGD 412.35`, and its total summed magnitudes as if signed.
--
-- 🛑 ONE COLUMN, AND `delta_money_minor` KEEPS ITS MEANING. Making that column
--    signed would change what every stored row means under G88's forward-only
--    rule — a row written yesterday as a magnitude would read tomorrow as an
--    over. The direction is its own fact and gets its own column.
--
--    'over'   the LEFT side exceeds the RIGHT — the sign convention
--             `ToleranceDirection` declares once (`signedVarianceMinor` is
--             `leftTotal − rightTotal`, `model/reconciliation.ts`) and nothing
--             re-derives. An invoice priced above its order is `over`.
--    'under'  the RIGHT side exceeds the LEFT.
--    NULL     on a money delta: NOT RECORDED — a row stored before this column
--             existed — when the magnitude is non-zero; and NO DIRECTION when
--             the magnitude is zero, because zero has no sign. The reader
--             (`server/data-plane/exception-store.ts`) refuses to sign a
--             non-zero magnitude it was not told the direction of: it publishes
--             `variance: null`, never a guessed `+`.
--
-- ⚠️ NO `CHECK` ON THE VOCABULARY — `0007`/`0069`'s polarity: an unknown value
--    reaches the reader as a refusal rather than being rejected at write time
--    by a list somebody forgot to extend. ONE whole-or-absent `CHECK`, which is
--    `0015`'s own precedent for a multi-column value: a direction with no money
--    magnitude is a half-written delta.
-- =====================================================================

ALTER TABLE tenant.exception ADD COLUMN delta_money_direction text;

ALTER TABLE tenant.exception
  ADD CONSTRAINT exception_delta_money_direction_has_magnitude CHECK (
    delta_money_direction IS NULL OR delta_money_minor IS NOT NULL
  );

-- ---------------------------------------------------------------------
-- THE ENGINE MAY NOT WRITE AN UNSIGNED NON-ZERO MONEY DELTA.
--
-- A second RESTRICTIVE `FOR INSERT` policy beside `0500`'s, with no `TO`, so it
-- binds every role and survives a wider grant (`0059`'s reason). Only
-- `reconcile_engine` holds `INSERT` on this table (`0500` §1); the migrator is
-- `BYPASSRLS` and the seed writes the column explicitly. It is a separate
-- policy rather than an `ALTER POLICY` of `0500`'s so that policy's text is not
-- re-typed and therefore cannot be mistyped — `0020`'s near-miss.
-- ---------------------------------------------------------------------
CREATE POLICY exception_money_delta_signed_restrictive ON tenant.exception
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    delta_money_minor IS NULL
    OR delta_money_minor = 0
    OR delta_money_direction IS NOT NULL
  );

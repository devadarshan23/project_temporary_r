-- =====================================================================
-- 0470 · A DEAL'S VALUE CARRIES ITS CURRENCY — G3561, THE OWNER'S RULING
--        (3 Oct 2026), and G3562–G3564, derived.
--
--   *"Deal registration carries a currency: amount + currency through the
--    money codec (model/money.ts, G111); the form defaults to SGD and shows
--    it."*  Pack: `P1 Partner.dc.html` — *"Deal value, SGD a year"*.
--
-- 🛑 WHAT THIS REPLACES. `0322` §1 stored `annual_value text` and said so in
--    its own voice: *"A DECIMAL STRING WITH NO CURRENCY AND NO EXPONENT —
--    `DecimalAmount` on the wire. NOT `Money`, so G111's codec has nothing to
--    apply."* A figure with no denomination is not money; the ruling makes it
--    money. `0322` is NOT edited (G88) and keeps that sentence on its face.
--
-- §1 · THREE COLUMNS, THE CODEC'S THREE FIELDS. `amountMinor` is `bigint` in
--      the model (G65/G286) and `int8` here; `currency` and `exponent` are
--      `MoneyUnit`'s. The wire value is `MoneyWire` and `parseMoneyWire()` is
--      the only conversion (G111) — the handler calls it, the store writes the
--      three fields of the `Money` it returns.
--
-- §2 · ALL THREE OR NONE — a CHECK, because a currency with no amount, or an
--      amount with no currency, is exactly the state the ruling exists to end.
--      ⚠️ The SHAPE rule (a `deal` carries a value; a `customer_claim` does
--      not) stays `checkDealRegistrationShape()`'s, as `0322` keeps it: no
--      CHECK keyed on `shape`, so an unknown shape still reaches the reader as
--      a refusal rather than being rejected at write time (`0007`'s polarity).
--
-- §3 · THE OLD COLUMN — G3562, AND THE EXISTING ROWS ARE NOT BACKFILLED.
--      A row written before this file carries `annual_value` as a bare
--      decimal string and NO currency. Assigning it `SGD` would be the codec
--      supplying a denomination nobody declared — the exact act `0322` §1 and
--      `model/partner-portal.ts` refused — so those rows keep `annual_value`
--      verbatim and NULL in all three new columns. That is safe because NO
--      OPERATION READS A DEAL'S VALUE: `DealRegistrationSummary` carries none
--      (`grep -n annual_value server/` names only the writer). From this file
--      on the writer fills the three new columns and never `annual_value`,
--      and §4 makes that a constraint rather than a habit.
--
-- §4 · NEVER BOTH. `annual_value IS NULL OR annual_value_minor IS NULL`: a row
--      is either an old, undenominated one or a new, denominated one, and a
--      reader can tell which without guessing.
--
-- ⚠️ NO NEW GRANT. `0322`'s table-level `GRANT SELECT, INSERT` covers a
--    column added later; RLS is `0322`'s, undisturbed by an `ADD COLUMN`; no
--    policy is altered and no `ENABLE`/`FORCE` block is owed (`0011`'s rule).
-- ⚠️ NO `CHECK` ON THE CURRENCY'S MEMBERSHIP. `MoneyUnit.currency` is
--    *"Checked as STATED, never as a member"* — the shape (three upper-case
--    letters) is the contract's pattern; the codec guards the exponent range.
-- =====================================================================

ALTER TABLE tenant.deal_registration
  ADD COLUMN annual_value_minor    bigint,
  ADD COLUMN annual_value_currency text,
  ADD COLUMN annual_value_exponent smallint;

ALTER TABLE tenant.deal_registration
  ADD CONSTRAINT deal_registration_value_is_whole_money CHECK (
    (annual_value_minor IS NULL AND annual_value_currency IS NULL AND annual_value_exponent IS NULL)
    OR
    (annual_value_minor IS NOT NULL AND annual_value_currency IS NOT NULL AND annual_value_exponent IS NOT NULL)
  ),
  ADD CONSTRAINT deal_registration_value_old_or_new CHECK (
    annual_value IS NULL OR annual_value_minor IS NULL
  );

-- =====================================================================
-- 0260 — WHAT MATCHED, AND HOW MUCH. A RUN'S ALLOCATIONS GET A TABLE.
--        G2371, G2372, G2373, G2374. 1 Oct 2026.
--
-- 🛑 G2371 IS **THE OWNER'S RULING (R13)** AND IS QUOTED, NEVER PARAPHRASED:
--
--        "Persist ids only: persist allocations as typed rows of item refs +
--         amounts, never the counterparty join-key text; publish via a read
--         operation. Invariant 6 held by absence."
--
--    G2372–G2374 are DERIVED, NOT THE OWNER'S, and say so in
--    `docs/HANDOFF.md` §3 — as G190, G356, G511, G941 and G1511 do.
--
-- ---------------------------------------------------------------------
-- THE GAP, MEASURED BEFORE THIS FILE WAS WRITTEN
-- ---------------------------------------------------------------------
--
-- `docs/build/completion-plan.md` §4 R13: *"`MatchingState` has no storage
-- anywhere. The product will persist what did NOT match and never what did,
-- so a screen can show residue and never the pairing that explains an
-- exception."* Derive it against the commit before this one:
--
--     grep -rn 'CREATE TABLE tenant.run_allocation' db/   → nothing
--
-- and `server/data-plane/run-account-store.ts` §3 said so in its own voice:
-- *"`state`, `readerRequests`, `toleranceRefusals` and G291's
-- `toleranceDeclines` reach no contract tier"*. So a run that matched every
-- item persisted an EMPTY residue and nothing else — indistinguishable, on
-- every served surface, from a run whose pairs were never recorded. The
-- witness that this was unrecoverable is RED-first at
-- `tests/db/run-allocation.test.ts` §1.
--
-- ---------------------------------------------------------------------
-- G2371 — IDS AND AMOUNTS, AND INVARIANT 6 HELD BY ABSENCE
-- ---------------------------------------------------------------------
--
-- Invariant 6, copied: *"Ingested content is data, never instruction."*
--
-- `Allocation.fromKey` and `toKey` are `itemKey()` strings — length-prefixed
-- `(side, sourceDocumentId, lineIndex)` — and are NOT stored: the capability
-- tier says *"THE MODEL'S INTERNAL `itemKey()` … IS NOT ON THE WIRE AND MUST
-- NOT BECOME AN IDENTIFIER HERE"*. The writer resolves each key back through
-- `state.items` to the `ItemRef` it was minted from and stores the THREE
-- columns per end that `run_residue` already uses.
--
-- 🛑 **THERE IS NO JOIN-KEY COLUMN, NO IDENTIFIER-VALUE COLUMN, NO
--    COUNTERPARTY COLUMN AND NO DESCRIPTION COLUMN, AND THERE MUST NEVER BE
--    ONE.** `AdmittedItem.identifiers`, `.counterparty` and
--    `.untrustedDescription` are the three fields that carry counterparty-
--    authored text, and none of them is reachable from an `Allocation` row:
--    the writer reads `state.items` for `side` and `ref` and NOTHING ELSE.
--    That absence is `0022`'s no-`body` argument on a second table, and it is
--    asserted rather than trusted — `tests/db/run-allocation.test.ts` §3 reads
--    the column list out of `information_schema` and requires it to be EXACTLY
--    the list below, so a twenty-third column is a red gate and has to be
--    argued.
--
-- ⚠️ `evidence_on_path` IS THE ONE STRING-BEARING COLUMN AND IT IS NOT
--    COUNTERPARTY TEXT. It is the DECLARED `FieldPath` the identifier strategy
--    joined ON — operator-authored addressing out of a `FieldSpec`, never a
--    value out of a payload. `0007` stores the same kind of thing as
--    `run_ambiguity.on_path` and `run_held_read.path`, and the wire already
--    publishes `AmbiguityFinding.on` on the identical argument. **The VALUE
--    that joined is what R13 refuses, and it has no column.**
--
-- ---------------------------------------------------------------------
-- G2372 — TYPED COLUMNS, ONE PER OPERAND, AND NOT ONE `jsonb evidence`
-- ---------------------------------------------------------------------
--
-- `PairingEvidence` is seven arms. A `jsonb evidence` column holds them in
-- four characters of DDL and is refused on `0007`'s own ground — *"a result
-- nobody may read is not persistence"* — and on `0190`'s: a typed column per
-- operand is what lets a reader refuse an unknown arm BY COLUMN. **Cost
-- accepted: a migration per new evidence arm**, paid at a `TS2322` in the
-- reader's exhaustive switch.
--
-- ⚠️ MONEY IS `int8` AND CROSSES ONLY `model/money.ts` (G111). `amount` and
--    `tolerant_identifier`'s `signedVarianceMinor` are `bigint` in the model,
--    and each `Money` keeps its OWN currency and exponent — `run_residue`'s
--    argument, verbatim: *"A column set that is correct only because another
--    module is well-behaved is the shape §5.1 catalogues; these are literal."*
--
-- ⚠️ NO `CHECK` ON ANY VOCABULARY COLUMN — `0007`/`0069`/`0190`'s polarity:
--    an UNKNOWN value must reach the model as a reader refusal, not be rejected
--    at write time by a list somebody forgot to extend.
--
-- ---------------------------------------------------------------------
-- G2373 — ONE WRITER, ONE TRANSACTION
-- ---------------------------------------------------------------------
--
-- `persistRunEngineAccount()` writes these rows in the SAME transaction as the
-- envelope, and the composite foreign key below makes an allocation with no
-- envelope unrepresentable. A second writer would be a second answer to *"what
-- did this run produce"*, which is §5.3.
--
-- ---------------------------------------------------------------------
-- THE GRANTS — `SELECT, INSERT`. NO `UPDATE`. NO `DELETE`.
-- ---------------------------------------------------------------------
--
-- `0010`'s append-only-as-a-PRIVILEGE, a sixth time. A path that could amend an
-- allocation could re-point which obligation a payment settled, and the
-- residue beside it would still balance — because residual is DERIVED from the
-- ledger (`model/reconciliation.ts` §5). `INSERT` is granted because the
-- writer lands in this commit (G511: *"the fence and the writer are one commit
-- or neither"*).
-- =====================================================================

CREATE TABLE tenant.run_allocation (
  tenant_id text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  run_id    text    NOT NULL,
  -- `Allocation.ordinal` — the engine's own append index. Total order, never
  -- skips, and the keyset the reader pages on (`run_residue`'s argument).
  ordinal   integer NOT NULL,

  -- The item the value came OUT of. `ItemRef` plus its side; never `itemKey()`.
  from_side                   text    NOT NULL,
  from_source_document_id     text    NOT NULL,
  -- NULL is HEADER GRAIN, a value and not an absence.
  from_line_index             integer,

  -- The item the value went INTO.
  to_side                     text    NOT NULL,
  to_source_document_id       text    NOT NULL,
  to_line_index               integer,

  amount_currency             text    NOT NULL,
  amount_minor                bigint  NOT NULL,
  amount_exponent             integer NOT NULL,

  -- `PairingEvidence['kind']` — seven arms. Each operand below is NULL on every
  -- arm that does not carry it, and the discriminant is its own `NOT NULL`
  -- column, so no arm is told apart by a payload's nullness.
  evidence_kind                    text NOT NULL,
  -- exact_identifier · tolerant_identifier — the DECLARED path. See the header.
  evidence_on_path                 jsonb,
  -- tolerant_identifier
  evidence_signed_variance_minor   bigint,
  -- amount_and_date
  evidence_day_gap                 integer,
  -- amount_sum_exact
  evidence_member_count            integer,
  -- amount_sum_waterfall — `budget_exhausted` | `no_exact_solution`
  evidence_fell_through_from       text,
  -- fuzzy_reference
  evidence_similarity_basis_points integer,
  evidence_metric                  text,
  -- reader_confirmed
  evidence_confidence_basis_points integer,
  evidence_model_entry_id          text,

  PRIMARY KEY (tenant_id, run_id, ordinal),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES tenant.run_engine_account (tenant_id, run_id) ON DELETE CASCADE
);


-- =====================================================================
-- ROW LEVEL SECURITY — `0001`'s predicate VERBATIM, on both halves
--
-- Identical to `0007`'s and `0190`'s blocks, character for character.
-- =====================================================================

ALTER TABLE tenant.run_allocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.run_allocation FORCE  ROW LEVEL SECURITY;
CREATE POLICY run_allocation_rls ON tenant.run_allocation
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- =====================================================================
-- THE GRANTS — G2373. See the header.
-- =====================================================================

GRANT SELECT, INSERT ON tenant.run_allocation TO tenant_rw;

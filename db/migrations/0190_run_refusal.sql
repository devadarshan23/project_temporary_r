-- =====================================================================
-- 0190 — THE `refused` ARM GETS COLUMNS, SO A RUN THE ENGINE REFUSED
--        STOPS LOOKING LIKE A RUN NOBODY RAN.
--        G1511, G1512, G1513, G1514. 21 Sep 2026. E6 of the plan's W1.
--
-- 🛑 ALL FOUR ARE **DERIVED, NOT THE OWNER'S**, and say so here — as G190,
--    G356, G511, G941, G961, G1091 and G1373 do. The ruling they apply is
--    `0007`'s own, written into that migration on the day it landed:
--
--        "`outcome` ADMITS `refused` ALREADY, AND NOTHING WRITES IT TODAY.
--         The column is the discriminant `RunEngineAccount` publishes, so the
--         migration that persists the refused arm ADDS COLUMNS rather than
--         reshaping this one — which is what G88's expand-then-contract asks
--         for. A reader must not take the presence of the word as evidence
--         the arm is served."
--
--    **This is that migration.** `0007` is NOT edited; G88 is forward-only and
--    `0017`'s precedent is that a successor keeps the correction on its own
--    face. Every column below is new.
--
-- ---------------------------------------------------------------------
-- WHY IT SHIPS IN THE SAME WAVE AS THE EXECUTOR, AND NOT ONE COMMIT LATER
-- ---------------------------------------------------------------------
--
-- `server/data-plane/run-account-store.ts` refuses the read today, in its own
-- voice, and names this migration as its condition:
--
--        "🛑 THE `refused` ARM HAS NO COLUMNS YET AND THIS REFUSES RATHER THAN
--         IMPROVISING. … Nothing writes the word today; the migration that
--         does also adds the columns."
--
-- So before this commit a refused run has NO `run_engine_account` ROW AT ALL,
-- and `getRunAccount` answers **404** — **the same answer it gives for a run
-- nobody reconciled**. That collision was theoretical while nothing executed.
-- 🛑 **E5 MAKES IT REAL: the moment an executor runs, runs start being refused
--    for genuine reasons — a definition whose `readerCandidateCap` is unstated,
--    a normalisation with an empty separator — and an operator cannot tell
--    *"the engine refused your definition"* from *"nobody ran it".**
--
-- `frontend/src/components/RunAccount.tsx` already keeps THREE state machines
-- for one route precisely so that a 404 is not folded into an empty page —
-- *"answering `{items: [], nextCursor: null}` to both would report a clean
-- close for a run nobody ran."* This is the distinction that screen is waiting
-- for, and shipping E5 without it would ship the lie the screen was built to
-- avoid.
--
-- ---------------------------------------------------------------------
-- G1511 — TYPED COLUMNS, ONE PER OPERAND, AND NOT ONE `jsonb`
-- ---------------------------------------------------------------------
--
-- `SetReconciliationRefusal` is FIFTEEN arms carrying, between them, two
-- integers, a side, a binding index, a `MoneyRefusal` kind, a two-arm tolerance
-- route, an `ItemRef`, a document id and two defect LISTS. **A `jsonb refusal`
-- column would hold all of it in four characters of DDL.**
--
-- 🛑 **IT SAID TWELVE IN A DRAFT OF THIS VERY HEADER, AND THE TOTAL `Record`
--    IN `server/data-plane/engine-vocabulary.ts` IS WHAT CAUGHT IT** —
--    `TS2739: … is missing the following properties: admitted_item_key_collision,
--    control_total_expected_but_absent, population_empty_and_not_expected`.
--    The twelve came from a `grep` over `model/reconciliation.ts` whose window
--    stopped three arms short, which is **the `no_items` incident that file
--    already records about `MONEY_REFUSAL_KIND`, happening again to a different
--    union in the same slice.** It is written down rather than quietly fixed,
--    because a transcription that is four-fifths right is exactly the drift a
--    total `Record` exists to catch, and a schema built on the short list would
--    have had three arms with nowhere to go.
--
-- **The `jsonb` is refused on `0007`'s own ground and `0160`'s**, which is the same
-- ground twice: G284 refused a `jsonb` operand column because *"a JSONB key
-- with no `FieldSpec` is UNREADABLE"* under invariant 4 and *"a result nobody
-- may read is not persistence"*. A refusal stored as opaque JSON is a refusal
-- an operator cannot be shown a reason from.
--
-- **Cost accepted and named, exactly as `0160` names it: a migration per new
-- refusal arm, forward-only under G88.** And it is paid at a COMPILE ERROR
-- rather than at a silent omission — `server/data-plane/run-account-store.ts`
-- switches exhaustively over `SetReconciliationRefusal`, so a SIXTEENTH arm is
-- a `TS2322` at a `never` before it is a missing column — which is the same
-- control that caught the three above, at the other end of the round trip.
--
-- ---------------------------------------------------------------------
-- G1512 — `population_integrity_refused` REUSES `tenant.run_population_defect`
-- ---------------------------------------------------------------------
--
-- That table already stores a `PopulationDefect` in typed columns, keyed on
-- `(owner, owner_ordinal, ordinal)` — a POLYMORPHIC owner, with `0007` naming
-- three values on the column itself: `'document_account' | 'postcondition' |
-- 'completeness'`. **This adds a FOURTH, `'refusal'`, and adds no table.**
--
-- ⚠️ `owner` CARRIES NO `CHECK`, so no constraint changes — which `0007` states
--    is deliberate on its own face, because it is *"this table's own join key,
--    and it is the only column in this file that names something the contract
--    does not"*. A second defect table would have been two spellings of one
--    `PopulationDefect` codec, and §5.3 says which of two copies drifts.
--
-- ---------------------------------------------------------------------
-- G1513 — `SELECT, INSERT` AND NOTHING ELSE
-- ---------------------------------------------------------------------
--
-- `0010`'s append-only-as-a-PRIVILEGE, carried across for the fifth time. NO
-- `UPDATE` and NO `DELETE`: a path that could amend a stored refusal could
-- rewrite WHY a run produced nothing — turning `normalisation_invalid` (an
-- operator's definition is wrong) into `cross_tenant_documents` (the platform
-- refused the caller), which are different findings with different owners.
--
-- ⚠️ AND `INSERT` IS GRANTED HERE BECAUSE THE WRITER LANDS IN THIS COMMIT —
--    `persistRunRefusal()` in `server/data-plane/run-account-store.ts`, called
--    from `server/data-plane/run-executor.ts`. **G511: the fence and the writer
--    are one commit or neither.** A `GRANT INSERT` with no writer is `0004`'s
--    *"a write privilege ahead of its writer"*, which is what `0007` was
--    careful not to do when it withheld these columns.
--
-- ---------------------------------------------------------------------
-- G1514 — NO `CHECK` ON ANY VOCABULARY COLUMN
-- ---------------------------------------------------------------------
--
-- `0007`'s and `0069`'s stated polarity, and it is the decision a reader's
-- instinct gets backwards: **an UNKNOWN value must reach the model as an
-- `*_unreadable` refusal, not be rejected at write time by a list somebody
-- forgot to extend.** A migration that declines a `CHECK` owes a READER that
-- refuses, and this one has it — `run-account-store.ts` answers `unpublishable`
-- BY COLUMN for a `kind` the model cannot name, and the suite asserts both
-- halves.
-- =====================================================================


-- =====================================================================
-- §1  THE REFUSAL ITSELF — one row per refused run, never more
--
-- The PRIMARY KEY is `(tenant_id, run_id)` and that is the cardinality
-- assertion rather than a convention: `SetReconciliationOutcome`'s `ok: false`
-- arm carries exactly ONE refusal, so a second row for a run is a constraint
-- violation rather than a longer list somebody has to pick from.
--
-- 🛑 EVERY OPERAND COLUMN IS NULLABLE AND THAT IS NOT LAXITY — it is twelve
--    arms sharing one row, where `expected` means something on exactly one of
--    them. **The DISCRIMINANT is `kind`, which is `NOT NULL`**, and G411's
--    finding is why that matters more than it looks: a `CHECK` that evaluates
--    to NULL PASSES, so a nullable discriminant makes every constraint keyed on
--    it vacuous. There are no CHECKs here (G1514), and the `NOT NULL` is still
--    the thing that makes the reader's switch total.
-- =====================================================================

CREATE TABLE tenant.run_refusal (
  tenant_id text NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  run_id    text NOT NULL,

  -- `SetReconciliationRefusal['kind']` — twelve members. No CHECK (G1514).
  kind      text NOT NULL,

  -- `PopulationSide`. Carried by SEVEN of the fifteen arms —
  -- `normalisation_invalid`, `declared_unit_invalid`,
  -- `population_integrity_refused`, `admitted_item_key_collision`,
  -- `control_total_expected_but_absent` and `population_empty_and_not_expected`.
  side      text,

  -- `strategy_binding_count_mismatch`. Both, or neither.
  expected  integer,
  supplied  integer,

  -- `strategy_binding_kind_mismatch`. Which binding disagreed.
  binding_index integer,

  -- `MoneyRefusal['kind']` — seven members, all of them kind-only, which is why
  -- one column carries the whole of it. Present on `declared_unit_invalid`,
  -- `declared_units_disagree` and `tolerance_unit_disagrees`.
  money_refusal_kind text,

  -- `tolerance_unit_disagrees` only, and the pair is `{ kind: 'pairing' } |
  -- { kind: 'strategy_binding'; index }`.
  --
  -- ⚠️ THE CONTRACT'S OWN WARNING IS ON THIS COLUMN RATHER THAN IN A HEADER,
  --    because it has already cost this repository two phantom enum members:
  --    `'pairing'` and `'strategy_binding'` ARE NOT ARMS OF
  --    `SetReconciliationRefusal` and must never be read as such. They are the
  --    NESTED union's discriminants, and `capability.openapi.yaml` records that
  --    #186's wire-mirror harvested them as outer arms until 16 Aug 2026.
  --    **The column is named `tolerance_route` and not `tolerance_kind` for
  --    exactly that reason** — a second `kind` column beside the first is how
  --    the confusion gets re-imported.
  tolerance_route text,
  tolerance_index integer,

  -- `admitted_item_key_collision`'s `ItemRef`. **`ref_line_index` IS NULLABLE
  -- INSIDE THE ARM ITSELF** — `ItemRef.lineIndex` is `number | null`, and a
  -- null there means HEADER GRAIN rather than absent — so it is
  -- `ref_source_document_id` that discriminates the arm, never the index.
  ref_source_document_id text,
  ref_line_index         integer,

  -- `control_total_expected_but_absent`. A DIFFERENT column from the one above
  -- and not a reuse: that one is half of an `ItemRef` and this one is a
  -- document on its own terms. `0007`'s `run_population_defect` keeps the same
  -- two apart for the same reason, and collapsing them would make the two arms
  -- indistinguishable on a row.
  source_document_id     text,

  recorded_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, run_id),

  -- 🛑 THE PARENT IS `run_engine_account` AND NOT `public.run`, WHICH IS THE
  --    LOAD-BEARING JOIN. It makes a refusal row without an envelope row
  --    UNREPRESENTABLE, so `outcome` can never be read as `'produced'` while a
  --    refusal sits beside it, and `getRunAccount`'s answer comes from ONE
  --    place. The composite key is `0007`'s argument carried across: *"a
  --    cross-tenant reference has to be unrepresentable rather than merely
  --    unlikely."*
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES tenant.run_engine_account (tenant_id, run_id) ON DELETE CASCADE
);


-- =====================================================================
-- §2  `normalisation_invalid`'s DEFECT LIST
--
-- `NormalisationDefect` is five arms — `max_input_chars_not_stated` carrying
-- nothing, and four `op_*` arms carrying an `opIndex`. A LIST, so it needs its
-- own table; `ordinal` preserves the order the engine produced, because the
-- defects are reported against an operator's `ops` array in sequence and a
-- re-ordered list sends somebody to the wrong operation.
--
-- ⚠️ IT CARRIES ITS OWN `tenant_id` AND ITS OWN POLICY, which `0007` argues is
--    not redundant: *"A child reachable only through a scoped parent is a child
--    protected by a JOIN somebody remembered to write."*
-- =====================================================================

CREATE TABLE tenant.run_refusal_normalisation_defect (
  tenant_id text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  run_id    text    NOT NULL,
  ordinal   integer NOT NULL,

  -- `NormalisationDefect['kind']`. No CHECK (G1514).
  kind      text    NOT NULL,
  -- NULL on `max_input_chars_not_stated`, which carries no operand at all.
  op_index  integer,

  PRIMARY KEY (tenant_id, run_id, ordinal),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES tenant.run_refusal (tenant_id, run_id) ON DELETE CASCADE
);


-- =====================================================================
-- §3  ROW LEVEL SECURITY — `0001`'s predicate VERBATIM, on both halves
--
-- Identical to `0007`'s block, deliberately and character for character. See
-- that file for the three-clause reading of `nullif(current_setting(…, true), '')`
-- and why `WITH CHECK` is stated rather than defaulted from `USING`.
-- =====================================================================

ALTER TABLE tenant.run_refusal ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.run_refusal FORCE  ROW LEVEL SECURITY;
CREATE POLICY run_refusal_rls ON tenant.run_refusal
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

ALTER TABLE tenant.run_refusal_normalisation_defect ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.run_refusal_normalisation_defect FORCE  ROW LEVEL SECURITY;
CREATE POLICY run_refusal_normalisation_defect_rls ON tenant.run_refusal_normalisation_defect
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- =====================================================================
-- §4  THE GRANTS — G1513
--
-- `SELECT, INSERT`. NO `UPDATE`. NO `DELETE`. See the header.
-- =====================================================================

GRANT SELECT, INSERT ON tenant.run_refusal                        TO tenant_rw;
GRANT SELECT, INSERT ON tenant.run_refusal_normalisation_defect   TO tenant_rw;

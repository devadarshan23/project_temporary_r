-- =====================================================================
-- 0160 — A DEFINITION'S CONTENT, IN TYPED COLUMNS, ONE PER DECLARED FIELD.
--        G1121, G1122, G1123, G1124, G1125. 20 Sep 2026.
--
-- 🛑 R-A IS **THE OWNER'S RULING OF 20 Sep 2026** AND NOT A DERIVED ONE, WHICH
--    IS SAID HERE BECAUSE MOST RULINGS IN THIS DIRECTORY SINCE G190 HAVE BEEN
--    DERIVED AND SAY SO ON THEIR OWN FACES:
--
--        "A definition's content lives in TYPED COLUMNS, one per declared
--         field."
--
-- ---------------------------------------------------------------------
-- THE GAP THIS CLOSES, DERIVED RATHER THAN ASSERTED. Run both:
--
--     awk '/export interface SetReconciliationInput/,/^}/' \
--       model/reconciliation.ts | grep -c '^  readonly'        → 18
--
--     awk '/CREATE TABLE tenant.reconciliation_definition \(/,/\);/' \
--       db/migrations/0069_run_admission.sql \
--       | grep -E '^  [a-z_]+ ' | awk '{print $1}'
--       → tenant_id  id  version  status
--
-- **`SetReconciliationInput` HAS EIGHTEEN FIELDS AND
-- `tenant.reconciliation_definition` STORES FOUR, NONE OF WHICH THE ENGINE
-- CONSUMES. The engine has had no definition to run since it was written.**
-- `0069` is not wrong about that — it stores exactly what run ADMISSION reads
-- and argues each of its eight absences — but nothing since has stored what
-- RECONCILIATION reads, and `docs/build/red-buildability.md` B3 named the shape
-- on 7 Aug 2026: *"Definition versioning pins a NUMBER and stores no version
-- content."*
--
-- ---------------------------------------------------------------------
-- 🛑 THE REJECTED ALTERNATIVE, PRESERVED, BECAUSE A REJECTED OPTION PRESERVED
--    IS THE ONLY THING THAT STOPS THE NEXT READER RE-TAKING IT.
--
-- **ONE `jsonb` SPEC COLUMN.** It is refused on `0007_run_engine_account.sql`'s
-- own ground. G284 refused a `jsonb` operand column for run RESULTS because it
--
--     "inherits invariant 4's G106 problem — a JSONB key with no `FieldSpec`
--      is UNREADABLE — so the findings would be *stored and unaddressable*,
--      and **a result nobody may read is not persistence**."
--
-- A definition stored that way is the same trap one table over, and worse in
-- one respect: the keys inside it would be OUR OWN field names rather than a
-- counterparty's, so the temptation to read them without a `FieldSpec` would be
-- overwhelming and the rule would be broken by the first convenient reader.
--
-- ⚠️ THE OTHER REJECTED OPTION, ALSO PRESERVED: **the content belongs to the
--    PACK and is published downward.** That is right in principle — `0069`
--    says in its own voice that *"a `ReconciliationDefinition` reaches a tenant
--    by PACK PUBLICATION"* — and it is BLOCKED, because G110's publication seam
--    does not exist and has not been started.
--
-- 🛑 **COST ACCEPTED AND NAMED: A MIGRATION PER NEW ENGINE KNOB, FORWARD-ONLY
--    UNDER G88.** G284 accepted the identical cost in the identical words
--    (*"a migration per new channel"*) and this file accepts it rather than
--    discovering it. A nineteenth field on `SetReconciliationInput` is a
--    `TS2739` in `server/data-plane/definition-store.ts` — see G1122 — so the
--    cost is PAID AT A COMPILE ERROR rather than at a silent omission.
--
-- ---------------------------------------------------------------------
-- RULINGS THIS APPLIES, identically to 0001–0150:
--   G97   every branded id is `text`; the slug is stored VERBATIM. No uuid.
--   G100  the policy DENIES on NULL. A forgotten transaction yields an EMPTY
--         result set, never another tenant's rows.
--   G101  transaction-mode pooling assumed; `SET LOCAL` inside an explicit
--         transaction, issued only by the scoped helpers.
--   G88   forward-only EXPAND. §6's one `ALTER TABLE … ADD COLUMN` is the
--         expand half and nothing is contracted; `0012` is not otherwise
--         edited by this file.
--   G286  money is `int8` minor units, never `numeric`, and `model/money.ts`
--         is the only codec that may convert one.
--   G214  a `FieldPath` is a TOKEN LIST and never a dotted string, stored as
--         `jsonb` beside its `fieldPathKey()` — `0012`'s two columns, verbatim,
--         because a SECOND representation would be `0002`'s third place to
--         drift on the one thing invariant 4 addresses positions by.
-- =====================================================================


-- =====================================================================
-- §1  THE RUN-WIDE KNOBS — G1121
--
-- One row per definition. `PairingSpec`'s three scalars, the obligation side,
-- the tolerance direction, `SubsetSumBound`'s three bounds, the reader cap, the
-- similarity policy and C13's admission ceiling.
--
-- 🛑 NOT ONE OF THESE COLUMNS IS NULLABLE AND THAT IS THE ENGINE'S OWN
--    DECISION RESTATED IN SQL, NOT A PREFERENCE. `SetReconciliationInput`
--    declares `readerCandidateCap`, `similarityMaxChars`, `subsetSumBound` and
--    `admissionRefusalCeilingBasisPoints` as REQUIRED WITH NO DEFAULT and says
--    why at each one — *"Required, no default"*, *"THE VALUE IS THE OWNER'S
--    (O-8) and is FDE-set pack configuration … never a constant here
--    (`PRODUCT.md`)"*. **A nullable column here would hand the first reader a
--    place to invent one**, which is the same move `PopulationBinding
--    .declaredUnit` refuses in its own docblock: *"NULLABLE WOULD REINTRODUCE
--    THE DEFECT WEARING A NULL."*
--
-- 🛑 ONE ROW PER DEFINITION AND **NOT** ONE ROW PER VERSION, AND THE COST IS
--    NAMED RATHER THAN HIDDEN. `tenant.reconciliation_definition`'s primary key
--    is `(tenant_id, id)` and `version` is a COLUMN on it, so this table's
--    foreign key can only be `(tenant_id, definition_id)`. The consequence:
--    **a re-run of an older `definition_version` reads TODAY'S spec**, which
--    partly defeats `public.run.definition_version`'s stated job — *"pins the
--    definition as it stood, so a re-run is distinguishable"*. Closing it means
--    making `reconciliation_definition` row-per-version, which changes a table
--    two other slices build against and is A RULING NOBODY HAS TAKEN. It is
--    reported here, not taken here, and `rerunRun` is unmounted anyway.
--
-- ⚠️ NO `CHECK` ON ANY VOCABULARY COLUMN — `0007`'s decision and `0069`'s
--    restatement of it, for the same two reasons. A `CHECK` naming the four
--    `PairingCardinality` members literally is a THIRD copy of a list
--    `model/domain.ts` already holds and nothing compares; **and the polarity
--    is the deciding half**, because an unknown value must reach the reader as
--    a refusal BY COLUMN (`server/data-plane/definition-store.ts` answers
--    `{ kind: 'unreadable', defect: { column } }`) rather than be rejected at
--    write time by a list somebody forgot to extend.
--    `tests/db/definition-engine-spec.test.ts` §6 asserts the absence, so a
--    later `CHECK` is a red gate rather than a thing a reviewer might miss.
--
-- ---------------------------------------------------------------------
-- 🛑 `Tolerance` IS SIX ARMS AND GETS A COLUMN PER ARM — G1123. `0015`'s
--    `delta_*` block is the precedent and the argument is identical: four arms
--    (`absolute`, `percentage`, `days`, `similarity`) share ONE `value:
--    number`, so they share one column and the `*_kind` discriminates; `money`
--    carries a whole `Money` and takes G65's three columns; `rounding` carries
--    `minorUnits` and takes its own.
--
--    ⚠️ **THE MONEY TRIPLE IS WHOLE-OR-ABSENT BY `CHECK`, AND THAT CONSTRAINT
--    IS NOT THE ONE REFUSED ABOVE.** It restates no closed enum — it asserts
--    that a MULTI-COLUMN VALUE this schema decomposed is not half-written,
--    which is a fact about THIS decomposition and exists nowhere else.
--    `0015`'s three constraints draw exactly that line and this file follows
--    it. *"A half-written `Money` is a row the reader must refuse to publish,
--    and catching it at write time names the writer instead of the reader."*
--
--    ⚠️ `absolute` AND `percentage` ARE STORABLE AND THE ENGINE REFUSES BOTH AT
--    USE, deliberately. `ToleranceRefusal` answers `float_money_tolerance` for
--    each — *"BOTH are floating-point money the moment they are applied to an
--    amount"* — and refusing them HERE would make a pack author's refusable
--    mistake into a definition this plane cannot describe. `0009`'s rule, on a
--    different axis: *"a disabled person must be VISIBLE so the model can
--    refuse them BY NAME."*
-- =====================================================================

CREATE TABLE tenant.definition_engine_spec (
  tenant_id            text NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  definition_id        text NOT NULL,

  -- `PopulationSide` — *"Which population holds what is owed. Required by the
  -- waterfall."* There is no safe default: guessing it inverts every
  -- allocation in the run.
  obligation_side      text NOT NULL,
  -- `ToleranceDirection` — A9(g). symmetric | left_greater_only | right_greater_only.
  tolerance_direction  text NOT NULL,
  -- `PairingCardinality` — one_to_one | one_to_many | many_to_one | many_to_many.
  pairing_cardinality  text NOT NULL,

  -- --- `PairingSpec.amountTolerance` — SIX ARMS, COLUMN PER ARM ---------
  amount_tolerance_kind                 text NOT NULL,
  -- The four arms that share `value: number`. `double precision` and not
  -- `numeric`: `absolute` and `percentage` are refused at use precisely
  -- BECAUSE they are floats, and `days`/`similarity` are not money at all.
  amount_tolerance_value                double precision,
  amount_tolerance_money_currency       text,
  amount_tolerance_money_minor          int8,
  amount_tolerance_money_exponent       integer,
  amount_tolerance_rounding_minor_units integer,

  -- --- `PairingSpec.dateTolerance` — the SAME six arms ------------------
  -- ⚠️ THE SHAPE IS REPEATED RATHER THAN SHARED, AND THAT IS THE COST OF
  -- TYPED COLUMNS PAID ON ITS FIRST DAY. A shared `tolerance` table keyed by
  -- `(definition_id, slot)` would remove the repetition and reintroduce the
  -- thing R-A is for: a reader would have to JOIN to discover whether a
  -- definition HAS an amount tolerance, and a missing join row would read as
  -- "no tolerance" rather than as a defect. Two `NOT NULL` kinds cannot.
  date_tolerance_kind                   text NOT NULL,
  date_tolerance_value                  double precision,
  date_tolerance_money_currency         text,
  date_tolerance_money_minor            int8,
  date_tolerance_money_exponent         integer,
  date_tolerance_rounding_minor_units   integer,

  -- --- `SubsetSumBound` — G105's THREE bounds, and all three are needed --
  -- *"`maxMembers` alone is NOT a tractability bound … C(400,8) ≈ 2×10^15
  -- combinations. It bounds TERMINATION and not COST."*
  subset_sum_max_members      integer NOT NULL,
  subset_sum_step_budget      integer NOT NULL,
  subset_sum_max_bucket_size  integer NOT NULL,

  -- §7's hard numeric cap on the reader's candidate set. **NOT the same knob
  -- as `AmountAnchor`, and the engine says so in capitals**: the candidate set
  -- is built under an EXACT anchor ALWAYS, and this is the bound a pack may
  -- NOT turn into a containment widening.
  reader_candidate_cap        integer NOT NULL,
  similarity_max_chars        integer NOT NULL,
  -- `SimilarityMetric` — levenshtein_ratio | jaro_winkler.
  similarity_metric           text    NOT NULL,

  -- C13's admission floor as a CEILING ON THE REFUSAL RATE, integer basis
  -- points in [0, 10000). ⚠️ NO `CHECK` ON THE RANGE EITHER, and this one is
  -- worth a sentence because the bound is arithmetic rather than a vocabulary:
  -- the engine's own gate is `refused × 10000 > ceiling × presented`, and the
  -- exclusivity of 10000 *"is the whole control"* — a value at or above it
  -- would *"certify OFF as STATED, which is §5.2 wearing a required-field
  -- costume"*. That gate lives in `checkPopulationIntegrity()` where the
  -- operands are, and a second copy here would be the drift `0002` forbids.
  admission_refusal_ceiling_basis_points integer NOT NULL,

  PRIMARY KEY (tenant_id, definition_id),

  -- 🛑 THE COMPOSITE FOREIGN KEY, FOR `0002_run.sql`'s REASON: *"a cross-tenant
  --    reference has to be unrepresentable rather than merely unlikely."*
  FOREIGN KEY (tenant_id, definition_id)
    REFERENCES tenant.reconciliation_definition (tenant_id, id) ON DELETE CASCADE,

  CONSTRAINT definition_amount_tolerance_money_whole CHECK (
    (amount_tolerance_money_currency IS NULL AND amount_tolerance_money_minor IS NULL
      AND amount_tolerance_money_exponent IS NULL)
    OR
    (amount_tolerance_money_currency IS NOT NULL AND amount_tolerance_money_minor IS NOT NULL
      AND amount_tolerance_money_exponent IS NOT NULL)
  ),
  CONSTRAINT definition_date_tolerance_money_whole CHECK (
    (date_tolerance_money_currency IS NULL AND date_tolerance_money_minor IS NULL
      AND date_tolerance_money_exponent IS NULL)
    OR
    (date_tolerance_money_currency IS NOT NULL AND date_tolerance_money_minor IS NOT NULL
      AND date_tolerance_money_exponent IS NOT NULL)
  )
);


-- =====================================================================
-- §2  THE TWO POPULATIONS — G1122
--
-- `PopulationBinding` is `PopulationSpec` plus the six fields the model does
-- not carry yet, and both sides are ROWS in one table keyed by `side`.
--
-- 🛑 ROWS AND NOT TWO COLUMN SETS ON §1, because `left` and `right` are the
--    SAME SHAPE and a `left_amount_path`/`right_amount_path` pair is one
--    declaration written twice — the drift `0002` names, at twelve columns
--    instead of one. A `side` key also makes *"exactly one left and exactly one
--    right"* a primary-key fact rather than a reader's assumption; the reader
--    answers `unreadable` when either is absent, and `tests/db/…` §1 is the
--    permitted case.
--
-- ⚠️ A `FieldPath` IS STORED AS `0012` STORES ONE — the token list as `jsonb`
--    AND `fieldPathKey()` beside it — and not as a dotted string. G214's
--    deciding fact is that *"the keys are counterparty-controlled: a dotted
--    path breaks on any key containing a dot, which is legal JSON, and its
--    failure mode is that it silently addresses the WRONG key rather than
--    refusing — scope failing open."* **That is as true of an operator's
--    DECLARED path as of a document's, because the declaration names the
--    document's keys.**
--
-- ⚠️ THE STORED `*_path_key` IS A JOIN KEY AND IS NEVER TRUSTED AS AN IDENTITY.
--    `server/data-plane/definition-store.ts` re-derives every key from the
--    token list `parseFieldPath()` just minted, which is `payload-store.ts`'s
--    rule and exists because *"a stored key that disagrees with its own path
--    would … silently address a position under the wrong identity."*
--
-- 🛑 `IdentifierNormalisation.ops` AND `PopulationSpec.identifiers` ARE ORDERED
--    LISTS AND THEREFORE ROWS — §3 and §4. An `ops` array in a `jsonb` column
--    would be the refused alternative arriving through a side door, and the
--    ORDER is semantic in both cases: `strip_literal` then `split_take` is not
--    `split_take` then `strip_literal`.
--
-- ⚠️ TWO NULLABLE PATHS AND BOTH ARE WHOLE-OR-ABSENT BY `CHECK`, for §1's
--    money reason. `counterparty` and `description` are `FieldPath | null` on
--    the model — a null is a STATED absence — and a row carrying a `path` with
--    no `path_key` (or the reverse) is half a declaration.
-- =====================================================================

CREATE TABLE tenant.definition_population (
  tenant_id     text NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  definition_id text NOT NULL,
  -- `PopulationSide`. Two rows per definition, by primary key.
  side          text NOT NULL,

  -- `PopulationSpec.documentTypeId`. **THE JOIN KEY INTO `0012`'s
  -- `document_field_spec`**, which is where `fieldClassification`,
  -- `modelPromptEligible` and `confidenceFloors` come from — see §6. No
  -- foreign key, because `0012` declares no `document_type` table and
  -- `document_field_spec`'s own key is `(tenant_id, document_type_id,
  -- path_key)`; a FK to a row set rather than an entity would forbid a
  -- population whose type has declared no field yet, which is a legal and
  -- refusable state (`field_not_classified`).
  document_type_id text NOT NULL,

  amount_path      jsonb NOT NULL,
  amount_path_key  text  NOT NULL,
  date_path        jsonb NOT NULL,
  date_path_key    text  NOT NULL,

  -- `MoneyUnit` — C16's ruling in two columns. *"CURRENCY IS DECLARED, NEVER
  -- INFERRED … `admitPopulation` used to seed the population's currency from
  -- WHICHEVER ROW WAS ADMITTED FIRST … The poisoned row was not rejected; it
  -- BECAME the definition."* Both `NOT NULL`: an unstated unit is a REFUSAL,
  -- and a nullable column here would reintroduce the defect wearing a null.
  declared_unit_currency text    NOT NULL,
  declared_unit_exponent integer NOT NULL,

  -- C18's SECOND VOICE — 'always' | 'never'. *"`SourceDocument.controlTotal`
  -- records what the PARSER found; this records what the format is SUPPOSED to
  -- carry."* Without it *"a shredder refactored to stop reading trailers
  -- reports `not_declared_by_format` for every file, and C18 then silently
  -- becomes a no-op on a green gate"* — §5.1.
  carries_control_total text NOT NULL,
  -- 'refuses' | 'permitted'.
  empty_expectation     text NOT NULL,

  -- `IdentifierNormalisation.then` — the terminal whole-value `Normaliser`.
  normalisation_then             text    NOT NULL,
  -- `IdentifierNormalisation.maxInputChars`. **NOT NULL AND NOT DEFAULTED**:
  -- *"a bound with no number is not a bound (§5.6)"*, and
  -- `validateNormalisation()` refuses a non-positive or non-integer value —
  -- which is a MODEL refusal and is deliberately not restated as a `CHECK`.
  normalisation_max_input_chars  integer NOT NULL,

  counterparty_path     jsonb,
  counterparty_path_key text,
  description_path      jsonb,
  description_path_key  text,

  PRIMARY KEY (tenant_id, definition_id, side),

  FOREIGN KEY (tenant_id, definition_id)
    REFERENCES tenant.reconciliation_definition (tenant_id, id) ON DELETE CASCADE,

  CONSTRAINT definition_population_counterparty_whole CHECK (
    (counterparty_path IS NULL AND counterparty_path_key IS NULL)
    OR
    (counterparty_path IS NOT NULL AND counterparty_path_key IS NOT NULL)
  ),
  CONSTRAINT definition_population_description_whole CHECK (
    (description_path IS NULL AND description_path_key IS NULL)
    OR
    (description_path IS NOT NULL AND description_path_key IS NOT NULL)
  )
);


-- =====================================================================
-- §3  THE IDENTIFIERS — `PopulationSpec.identifiers`, ORDERED
--
-- `ordinal` is the ZERO-BASED ARRAY INDEX and is stated as such, so row
-- `ordinal = N` is `identifiers[N]` and nothing has to be counted.
-- =====================================================================

CREATE TABLE tenant.definition_population_identifier (
  tenant_id     text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  definition_id text    NOT NULL,
  side          text    NOT NULL,
  ordinal       integer NOT NULL,

  path          jsonb   NOT NULL,
  path_key      text    NOT NULL,

  PRIMARY KEY (tenant_id, definition_id, side, ordinal),

  FOREIGN KEY (tenant_id, definition_id, side)
    REFERENCES tenant.definition_population (tenant_id, definition_id, side) ON DELETE CASCADE
);


-- =====================================================================
-- §4  THE NORMALISATION OPS — `IdentifierNormalisation.ops`, ORDERED
--
-- `ExtractionOp` is four arms and gets a column per arm, §1's shape a third
-- time. `trim` and `strip_leading_zeros` carry nothing and set no arm column.
--
-- ⚠️ `op_literal` AND `op_separator` ARE **AUTHORED CONFIGURATION AND NEVER
--    INGESTED CONTENT**, which is the one thing to be clear about before
--    anybody reads a `text` column here as an invariant 6 surface. *"Ingested
--    content is data, never instruction"* governs what a COUNTERPARTY writes;
--    these two are written by the FDE or by a pack, they are consumed by
--    `String.replaceAll` and `String.split` and by nothing else, and no model
--    and no prompt ever sees them.
--
-- ⚠️ NO `CHECK` REFUSING AN EMPTY `op_literal` OR `op_separator`, though
--    `validateNormalisation()` refuses both — `''` as a separator *"explodes to
--    characters"* and `''` as a literal *"inserts between every character.
--    Silent corruption, not a hang."* **The refusal stays in the model for
--    `0009`'s reason**: a constraint would make the malformed row
--    unrepresentable and the REFUSAL untestable, and this engine's defence is
--    that a bad parameterisation is REFUSED LOUDLY rather than never stored.
-- =====================================================================

CREATE TABLE tenant.definition_normalisation_op (
  tenant_id     text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  definition_id text    NOT NULL,
  side          text    NOT NULL,
  ordinal       integer NOT NULL,

  -- trim | strip_leading_zeros | strip_literal | split_take
  op_kind       text    NOT NULL,
  -- `strip_literal`
  op_literal    text,
  op_at         text,
  -- `split_take`
  op_separator  text,
  op_index      integer,

  PRIMARY KEY (tenant_id, definition_id, side, ordinal),

  FOREIGN KEY (tenant_id, definition_id, side)
    REFERENCES tenant.definition_population (tenant_id, definition_id, side) ON DELETE CASCADE
);


-- =====================================================================
-- §5  THE STRATEGIES **AND** THEIR BINDINGS, IN ONE TABLE — G1124
--
-- 🛑 THIS IS THE ONE PLACE THIS MIGRATION DOES SOMETHING BETTER THAN A
--    TRANSCRIPTION, AND IT IS WORTH READING. `SetReconciliationInput` declares:
--
--        strategyBindings: readonly StrategyBinding[]
--        /** Binds 1:1 to `pairing.strategies`, in order. Mismatch is a
--            refusal. */
--
--    Two tables — one for `pairing.strategies` and one for `strategyBindings` —
--    would make that mismatch REPRESENTABLE, and the engine would then refuse
--    it at run time, correctly, for rows a migrator wrote by hand. **ONE table
--    with ONE `ordinal` makes the mismatch UNREPRESENTABLE**, which is the
--    shape `0039` reaches for with its composite foreign key: *"a grant into a
--    tenant the partner did not sell is UNREPRESENTABLE rather than refused."*
--
--    ⚠️ THE COST IS THAT ONE ROW CARRIES TWO DECLARATIONS, and the column
--    prefixes say which is which: `strategy_*` is `PairingStrategy`,
--    `binding_*` is `StrategyBinding`'s two additional fields. The reader
--    builds both arrays from this one row set, so `pairing.strategies[i]` and
--    `strategyBindings[i].strategy` are the same value by construction, and
--    `tests/db/definition-engine-spec.test.ts` §1c asserts it rather than
--    assuming it.
--
-- ⚠️ `binding_amount_tolerance_kind` IS NULLABLE AND THE NULL IS A VALUE.
--    `StrategyBinding.amountTolerance: Tolerance | null` and *"`null` INHERITS
--    `PairingSpec.amountTolerance` — the same shape and the same reading as
--    `MatchRule.when: RulePredicate | null`, a guard whose null means
--    unguarded."* §1's `amount_tolerance_kind` is `NOT NULL` for the opposite
--    reason: `PairingSpec.amountTolerance` is not optional.
--
-- 🛑 `binding_amount_anchor` IS `NOT NULL` ON EVERY ROW THOUGH ONLY
--    `fuzzy_reference` READS IT, which is the model's own instruction —
--    *"Read only by `fuzzy_reference`; stated for every binding so it is
--    visible."* A nullable column would let the anchor be absent on the one
--    strategy that reads it and nobody would notice.
-- =====================================================================

CREATE TABLE tenant.definition_strategy (
  tenant_id     text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  definition_id text    NOT NULL,
  -- ZERO-BASED. Row `ordinal = N` is `pairing.strategies[N]` AND
  -- `strategyBindings[N]`. The ORDER is the whole of the multi-pass certainty
  -- design: *"The FIRST that pairs wins, which is what makes a pairing
  -- explicable."*
  ordinal       integer NOT NULL,

  -- --- `PairingStrategy` — FOUR ARMS -----------------------------------
  -- exact_identifier | amount_and_date | amount_sum | fuzzy_reference
  strategy_kind            text NOT NULL,
  -- `exact_identifier.on`
  strategy_on_path         jsonb,
  strategy_on_path_key     text,
  -- `amount_sum.maxMembers`. ⚠️ DUPLICATED IN SPIRIT WITH §1's
  -- `subset_sum_max_members` AND THEY ARE NOT THE SAME FIELD: this one is the
  -- STRATEGY's declared arity and §1's is `SubsetSumBound.maxMembers`, the
  -- engine's own bound. The model carries both separately and so does this.
  strategy_max_members     integer,
  -- `fuzzy_reference.minSimilarity`
  strategy_min_similarity  double precision,

  -- --- `StrategyBinding`'s two additional fields ------------------------
  -- NULL kind = INHERIT §1's `amount_tolerance_*`. See the header.
  binding_amount_tolerance_kind                 text,
  binding_amount_tolerance_value                double precision,
  binding_amount_tolerance_money_currency       text,
  binding_amount_tolerance_money_minor          int8,
  binding_amount_tolerance_money_exponent       integer,
  binding_amount_tolerance_rounding_minor_units integer,
  -- `AmountAnchor` — exact | within_tolerance.
  binding_amount_anchor                         text NOT NULL,

  PRIMARY KEY (tenant_id, definition_id, ordinal),

  FOREIGN KEY (tenant_id, definition_id)
    REFERENCES tenant.reconciliation_definition (tenant_id, id) ON DELETE CASCADE,

  CONSTRAINT definition_strategy_tolerance_money_whole CHECK (
    (binding_amount_tolerance_money_currency IS NULL
      AND binding_amount_tolerance_money_minor IS NULL
      AND binding_amount_tolerance_money_exponent IS NULL)
    OR
    (binding_amount_tolerance_money_currency IS NOT NULL
      AND binding_amount_tolerance_money_minor IS NOT NULL
      AND binding_amount_tolerance_money_exponent IS NOT NULL)
  ),
  CONSTRAINT definition_strategy_on_path_whole CHECK (
    (strategy_on_path IS NULL AND strategy_on_path_key IS NULL)
    OR
    (strategy_on_path IS NOT NULL AND strategy_on_path_key IS NOT NULL)
  )
);


-- =====================================================================
-- §6  THE ONE COLUMN THIS FILE ADDS TO ANOTHER MIGRATION'S TABLE — G1125
--
-- `ALTER TABLE tenant.document_field_spec ADD COLUMN confidence_floor`.
--
-- 🛑 THREE OF THE EIGHTEEN FIELDS ARE **NOT STORED HERE AT ALL** AND THAT IS
--    THE POINT OF THIS SECTION. `fieldClassification`, `modelPromptEligible`
--    and `confidenceFloors` are the caller's projections of `FieldSpec`, and
--    `FieldSpec` HAS A TABLE — `0012`'s `tenant.document_field_spec`. Storing
--    them again on a definition would be **invariant 4 broken by this very
--    migration**: *"Classification is declared once, on `FieldSpec`, and
--    everything derives from it."* The reader joins on
--    `definition_population.document_type_id` instead.
--
-- ⚠️ `FieldSpec` HAS SEVEN FIELDS AND `0012` STORED FOUR — `path`, `path_key`,
--    `data_class`, `model_processing_allowed`. `label`, `dataType` and
--    `required` are still absent and are still `0004`'s refusal: nothing reads
--    them. **`confidenceFloor` WAS ABSENT FOR THE SAME REASON AND ITS READER
--    ARRIVES IN THIS COMMIT**, which is the whole condition `0004` sets — *"a
--    column ahead of its reader would have been filled later by whoever built
--    the writer, with whatever they had to hand."*
--
-- 🛑 WITHOUT IT, `confidenceFloors` WOULD BE A HARD-CODED EMPTY MAP, AND AN
--    EMPTY MAP IS A STATEMENT RATHER THAN AN ABSENCE — the model says so:
--    *"an empty map says 'no field on this run declared a floor', an absent
--    field says nothing, and only the first is a statement a caller made."* A
--    reader returning `new Map()` unconditionally would be making that
--    statement on every run, for ever, and it would be §5.6 — a channel that
--    cannot fire is indistinguishable from one nobody wired up.
--
-- ⚠️ NULLABLE, AND THE NULL IS "NO FLOOR DECLARED" AND NOT "A FLOOR OF ZERO".
--    `FieldSpec.confidenceFloor` is `number | null`, and a zero would tell
--    `applyReaderVerdicts()` that a floor WAS declared and set to nothing —
--    which is `0015`'s `explanation_confidence` distinction one table over:
--    *"NULL MEANS NOT APPLICABLE, NEVER UNKNOWN."*
--
-- ⚠️ NO `ENABLE`/`FORCE` BLOCK AND NO NEW `GRANT` FOR THIS COLUMN — `0011`'s
--    precedent, verbatim: *"It is the FIRST migration here that adds a column
--    to another migration's table, so there is NO `ENABLE`/`FORCE` block and
--    there must not be one — 0009 owns that property and a column inherits
--    it."* `0012`'s `GRANT SELECT` covers a column added later, and `SELECT`
--    alone still means no request path can declare a classification.
--
-- ⚠️ `double precision` AND NOT `numeric`: it is a RATIO and not money, exactly
--    as `0015`'s `explanation_confidence` is.
-- =====================================================================

ALTER TABLE tenant.document_field_spec ADD COLUMN confidence_floor double precision;


-- =====================================================================
-- ROW LEVEL SECURITY — G100's deny-on-NULL, written as the predicate rather
-- than described. **`0001`'s predicate COPIED VERBATIM**, on `USING` **and**
-- on `WITH CHECK`, on all five new tables. It is copied, and this line says it
-- is copied, so a reader comparing the five against `0001` is comparing
-- characters rather than intentions; `tests/db/definition-engine-spec.test.ts`
-- §5b reads all five back out of `pg_policies` and requires them
-- byte-identical to each other.
--
-- `ENABLE` and `FORCE`, both, on every one. `ENABLE` alone leaves the TABLE
-- OWNER exempt, and `0001` states the consequence: *"a test that connects as
-- the owner then passes with the policy doing nothing, and passes just as well
-- with the policy dropped."*
--
-- 🛑 `WITH CHECK` IS STATED ON ALL FIVE THOUGH NONE OF THEM TAKES A WRITE FROM
--    THE REQUEST PATH, WHICH IS `0012`'s POSTURE VERBATIM: *"the two that do
--    not take one carry it anyway, so a later `GRANT INSERT` cannot arrive
--    without the write half already in place."*
--
-- ⚠️ NO `ALTER POLICY` ANYWHERE IN THIS FILE. It adds policies and replaces
--    none — worth one line because `0020` records the near-miss where a dropped
--    `NOT EXISTS` would have silently widened invariant 8 to `statutory`.
-- =====================================================================

ALTER TABLE tenant.definition_engine_spec            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.definition_engine_spec            FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.definition_population             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.definition_population             FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.definition_population_identifier  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.definition_population_identifier  FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.definition_normalisation_op       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.definition_normalisation_op       FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.definition_strategy               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.definition_strategy               FORCE  ROW LEVEL SECURITY;

CREATE POLICY definition_engine_spec_rls ON tenant.definition_engine_spec
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY definition_population_rls ON tenant.definition_population
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY definition_population_identifier_rls ON tenant.definition_population_identifier
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY definition_normalisation_op_rls ON tenant.definition_normalisation_op
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY definition_strategy_rls ON tenant.definition_strategy
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- =====================================================================
-- GRANTS — `SELECT` AND NOTHING ELSE, FIVE TIMES. G1126.
--
-- By name, because `0003` deliberately declines `ALTER DEFAULT PRIVILEGES` on
-- this schema: *"A future table created here is unreachable by the app until
-- granted BY NAME … default privileges would silently hand the request path a
-- table nobody decided to expose."*
--
-- 🛑 **ASK WHAT A REQUEST PATH THAT COULD WRITE A DEFINITION COULD DO, AND
--    THE ANSWER IS THE WHOLE ARGUMENT FOR THIS BLOCK. THERE ARE TWO HARMS AND
--    THE SECOND IS MUCH WORSE THAN THE FIRST.**
--
--    **(1) IT COULD CHOOSE ITS OWN REFUSALS.** `0069` already names this shape
--    for `reconciliation_definition`: *"a request path that could write a
--    definition could set its own `status` to `'active'` and then admit a run
--    against it, which makes `definition_not_active` a refusal the caller
--    controls."* The same move lands here on every engine gate: a path that
--    could `UPDATE tenant.definition_engine_spec SET
--    admission_refusal_ceiling_basis_points = 9999` turns C13's admission floor
--    off for the next run, and the engine would record `admissionRates`
--    faithfully and admit anyway — *"a permissive ceiling suppresses the
--    refusal and never the evidence"*, said by the model about a caller who is
--    supposed to be the OWNER of that number.
--
--    **(2) IT COULD CHOOSE THE ANSWER.** This is the one that decides the
--    grant. `definition_population.amount_path`, `date_path` and the identifier
--    rows ARE THE OPERANDS: they say which position in a document is the money,
--    which is the date, and which fields make a key. A caller who can rewrite
--    them reconciles a different pair of numbers and gets a different close —
--    **and every control downstream would log that act as perfectly correct.**
--    `db/migrations/0150` reached the identical conclusion from the document
--    side one week ago, in these words: *"a caller who chooses the operands
--    chooses the answer, and the gate, the policy and invariant 10's record
--    would each log that act as correct."* Two tables, two slices, one
--    sentence.
--
--    **(3) AND IT COULD DECLARE A CLASSIFICATION**, through §6's column, which
--    is `0012`'s own refusal for `document_field_spec`: *"a request path that
--    could write a `FieldSpec` could DECLARE A CLASSIFICATION"*, and invariant
--    4 says a classification is declared once.
--
-- 🛑 **SO THE WRITER IS OWED AND IS NOT TAKEN HERE, AND `0004`'s RULE IS WHY
--    IT CANNOT BE TAKEN HERE EITHER WAY.** *A write privilege ahead of its
--    writer* is refused in this directory, and there is no writer to grant it
--    for: **no contract operation on any of the seven tiers authors a
--    reconciliation definition.** Derive it —
--    `grep -c 'operationId: createReconciliationDefinition\|operationId: updateReconciliationDefinition' docs/contracts/*.openapi.yaml`
--    → 0 across the corpus. The intended writer is **G110's publication seam**
--    (a definition reaches a tenant by PACK PUBLICATION) or **G58's authoring
--    surface**, which `docs/HANDOFF.md` still records as *"blocked on
--    G2/G37"*. Rows arrive as the migrator today, exactly the way `0008`'s
--    governance lists, `0012`'s `document_field_spec` and `0069`'s three tables
--    do, and for the same stated reason.
--
-- ⚠️ **DO NOT READ THE ABSENCE OF A WRITER AS A REASON TO GRANT `INSERT` HERE
--    TO CLOSE A GAP.** G511's rule is the one that binds: *"the fence and the
--    writer are one commit or neither."* The commit that gives a definition a
--    writer owes this grant, a `RESTRICTIVE` policy over whatever authorises
--    the act, and the invariant 10 record that names it — all three, together.
-- =====================================================================

GRANT SELECT ON tenant.definition_engine_spec           TO tenant_rw;
GRANT SELECT ON tenant.definition_population            TO tenant_rw;
GRANT SELECT ON tenant.definition_population_identifier TO tenant_rw;
GRANT SELECT ON tenant.definition_normalisation_op      TO tenant_rw;
GRANT SELECT ON tenant.definition_strategy              TO tenant_rw;

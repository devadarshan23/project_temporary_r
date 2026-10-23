-- =====================================================================
-- 0007 — THE RECONCILIATION RESULT, IN TYPED COLUMNS. G284, 19 Sep 2026.
--
-- 🛑 THIS FILE ENDS THE SENTENCE TWO OTHER FILES HAVE BEEN CARRYING FOR A
--    MONTH. `docs/contracts/capability.openapi.yaml`, at the head of
--    `/runs/{runId}/account`: *"NOTHING PERSISTS A RECONCILIATION RESULT."*
--    `db/migrations/0002_run.sql`, from the other side: *"storing columns no
--    wire can carry would create a second vocabulary with nothing checking it.
--    They land with the schemas that publish them."* The schemas landed in
--    `375bb39d`. The columns are here. **The handlers are not, and that is a
--    RULING rather than an omission — read the next block before reading this
--    file as half-finished.**
--
-- ---------------------------------------------------------------------
-- 🛑 A CONTRACT COMMENT AND AN OWNER RULING DISAGREE ABOUT THIS COMMIT, AND THE
--    DISAGREEMENT IS RECORDED HERE RATHER THAN RESOLVED QUIETLY.
--
-- `docs/contracts/capability.openapi.yaml` says, of these exact two operations
-- and in its own voice: **"The handler lands with the migration, in that
-- commit."** This commit separates them.
--
-- **G200 was re-put to the owner on 19 Sep 2026 and the freeze was reaffirmed:
-- it binds until the gate GENUINELY ALLOWS SOMEBODY.** The gate exists —
-- `server/data-plane/authorise.ts` resolves a `PrincipalContext` and asks
-- `decide()` — and it answers `not_held` to every caller, because three of
-- `PrincipalContext`'s seven terms have no producer in this database. Mounting
-- `getRunAccount` today would therefore ship a route that 403s for everybody,
-- which is a route nobody can reach, and the owner refused it.
--
-- ⚠️ **AN OWNER RULING OUTRANKS A CONTRACT COMMENT AND THE COMMENT IS NOT
--    THEREBY WRONG.** Its argument is exactly right and it is the reason this
--    file is not simply a schema: *a column with no reader is a column nothing
--    checks*, and a migration landing alone is how a table acquires a shape
--    nobody ever exercised. So the thing that keeps these columns honest in the
--    meantime is **`server/data-plane/run-account-store.ts` plus
--    `tests/db/run-engine-account.test.ts`** — a writer that takes a real
--    `SetReconciliationResult`, a reader that produces the wire shape the two
--    declared operations publish, and a round trip through a real PostgreSQL
--    under `withTenantScope()`, with the RLS-disabled leak control that makes
--    every other assertion mean something.
--
--    **What is owed, named so it is not read as done:** the two handlers, in the
--    commit that makes the gate able to say yes to somebody. The store's read
--    functions are already shaped as the handlers need them, so that commit
--    mounts rather than builds.
--
-- ---------------------------------------------------------------------
-- THE RULING, AND THE ALTERNATIVE IT REFUSED
--
-- G284: **a reconciliation result is stored in TYPED COLUMNS, one per declared
-- findings channel — NOT in a `jsonb` operand column.**
--
-- The rejected alternative is preserved here rather than left in the table,
-- because it is the design a later reader will re-propose. A `jsonb` operand
-- column **inherits invariant 4's G106 problem directly**: a JSONB key with no
-- `FieldSpec` is UNREADABLE, fail-closed by design, so every finding would be
-- *stored and unaddressable* by any agent, prompt, export or dashboard until
-- G106's storage half exists — and that half is not written and is its own
-- slice. **A result nobody may read is not persistence.** The hybrid — typed
-- columns plus a reserved `jsonb` for channels that do not exist yet — was
-- refused on `0002_run.sql`'s own sentence: it puts two vocabularies in one
-- table on day one, with nothing checking the second.
--
-- ⚠️ THE COST IS ACCEPTED AND NAMED: **a migration per new channel**,
--    forward-only under G88. That is the honest price of a column set that
--    something checks.
--
-- ---------------------------------------------------------------------
-- 🛑 THE ONE PLACE `jsonb` SURVIVES, AND WHY IT IS NOT THE REFUSED COLUMN
--
-- `run_refused_item.path` and `run_ambiguity.on_path` are `jsonb`, and each
-- holds a `FieldPath` **in the wire form `model/field-path.ts` pins**: a JSON
-- ARRAY whose members are strings and numbers — *"A STRING member is a key
-- segment; a NUMBER member is an array index. That is the entire encoding and
-- there is nothing in it to escape."*
--
-- **That is not an operand column and it does not inherit G106.** G106 is about
-- a KEY with no `FieldSpec`; a token list **has no keys at all**. And the
-- column is not read by string surgery: `parseFieldPath()` is the ONE seam that
-- may construct a `FieldPath`, exactly as `model/money.ts` is the one seam that
-- may construct a `Money` from a decimal string. A column holding a declared
-- wire form behind a single codec is the shape this repository already uses for
-- money; it is not the shape G284 refused.
--
-- ---------------------------------------------------------------------
-- 🛑 WHAT THIS FILE PERSISTS, AND WHAT IT DELIBERATELY DOES NOT
--
-- `RunEngineAccount` is a `oneOf` on `outcome`. **This migration carries the
-- `produced` arm in full and does NOT carry the `refused` arm**, and that is a
-- stated cut rather than an omission:
--
--   · The `produced` arm's TEN required properties each have columns here.
--     ⚠️ TEN, NOT SIX. G284's row names six channels — `completeness`,
--     `postconditions`, `residue`, `admissionRates`, `refusedAtAdmission` and
--     `meterFacts` — and the SCHEMA's `required` list is
--     `[outcome, terminalStatus, admissionRates, documentAccounts,
--      refusedAtAdmission, ambiguities, searchBoundary, postconditions,
--      completeness, meterFacts]`. G236 added `documentAccounts` and G217 added
--     `ambiguities` and `searchBoundary` after the six were counted, and the
--     operation's own summary still says *"all SIX channels"*. **Derive the
--     list, never read it** —
--     `sed -n '/    RunEngineAccount:/,/discriminator/p' docs/contracts/capability.openapi.yaml`
--     — because a body missing a required property is a server disagreeing with
--     its own contract, and `fast-json-stringify` SERIALISES a response, it
--     does not validate one. Persisting six of ten would have shipped exactly
--     that.
--
--   · ✅ **THE `refused` ARM IS PERSISTED SINCE 21 Sep 2026 —
--     `db/migrations/0190_run_refusal.sql`, E6, G1511–G1515 — AND THE
--     PARAGRAPH BELOW IS AMENDED RATHER THAN DELETED**, because it is the
--     sentence that named its own successor and the one
--     `tests/http/run-account-served.test.ts` §5b was armed on. **That
--     tripwire fired on the commit that landed `0190` and its replacement
--     carries the positive assertions it demanded.**
--
--     **THE COLLAPSE IS ENDED: a refused run now has an account row with
--     `outcome = 'refused'`, and `getRunAccount` publishes the refusal.** A
--     run nobody reconciled still answers 404, so the two facts are no longer
--     one answer. `tests/db/run-executor.test.ts` §5 asserts the pair.
--
--     ⚠️ **AND ONE CASE STILL COLLAPSES, NAMED RATHER THAN QUIETLY FIXED
--     (G1522): a DOCUMENT-ASSEMBLY refusal leaves no account row**, because
--     `RunRefusal` is the ENGINE's closed union and
--     `line_grain_not_representable` is not a member of it — a sixteenth arm
--     is a contract change and therefore a ruling. So for that one path this
--     paragraph is still exactly true.
--
--     🛑 **AND ITS ARITHMETIC WAS RIGHT WHEN EVERYTHING ELSE WAS NOT: THIS
--     FILE SAID FIFTEEN ARMS AND E6's OWN DRAFT SAID TWELVE**, which
--     `RUN_REFUSAL_KIND`'s total `Record` caught as a `TS2739` naming the
--     three missed arms. **The migration that refused to persist the arm had
--     counted it correctly two days before the migration that persisted it.**
--     THE ORIGINAL FOLLOWS.
--
--   · The `refused` arm is NOT persisted. `RunRefusal` is fifteen arms, four of
--     which carry nested arrays, and none of them is a FINDING — a refused run
--     produced nothing and the refusal IS the output. It is a second slice with
--     a second migration. **The consequence is exact and is not hidden: a
--     refused run has no account row, so `getRunAccount` answers 404 for it —
--     the same answer it gives for a run nobody has reconciled yet.** Those two
--     facts are collapsed today. `server/data-plane/run-account.ts` says so at
--     the handler, and the 404 is honest about the RESOURCE it addresses (this
--     run has no account) while being silent about WHY, which is the loss.
--
-- ---------------------------------------------------------------------
-- 🛑 `toleranceDeclines` GETS NO COLUMN, AND NEITHER DOES `toleranceRefusals`.
--    READ THIS BEFORE ADDING ONE — G291 LANDED THE SAME DAY AS THIS FILE AND
--    THE TEMPTATION IS EXACT.
--
-- `SetReconciliationResult` carries SEVENTEEN properties. Ten reach
-- `RunEngineAccount`'s produced arm and have columns here. **Seven do not reach
-- any contract tier at all**, and the rule that decides them is
-- `0002_run.sql`'s: *"They land with the schemas that publish them."*
--
--   `state`            the matching ledger — no wire schema.
--   `readerRequests`   the quarantined reader's queue — no wire schema.
--   `toleranceRefusals`  *"this tolerance is nonsense"* — no wire schema.
--   `toleranceDeclines`  *"this tolerance is sound and it was too tight"* —
--                        **G291, 19 Sep 2026, and NO wire schema.**
--
-- Derive it, do not take it from this comment:
--     grep -c toleranceDeclines docs/contracts/*.yaml      → 0
--     grep -c toleranceRefusals docs/contracts/*.yaml      → 0
--     grep -c amount_tolerance_declined docs/contracts/capability.openapi.yaml → 2
--
-- ⚠️ THE ROW-LEVEL HALF OF G291 **DOES** REACH THE WIRE AND **DOES** HAVE A
--    COLUMN: `run_residue.cause_signed_variance_minor`, under the thirteenth
--    `ResidueCause`, `amount_tolerance_declined`. So an operator handed a
--    residue row is no longer told *nothing matched it* when the truth is *the
--    identifier join found its bucket and the money declined*. **The RUN-LEVEL
--    half — how many buckets declined and how wide each was — is not published
--    and therefore is not stored.**
--
-- 🛑 AND THE CONTRACT ITSELF ARGUES WHY, AT THE `amount_tolerance_declined` ARM,
--    SO THIS FILE IS APPLYING A DECISION RATHER THAN TAKING ONE: *"`RunAccount`
--    below publishes NEITHER tolerance channel, `toleranceRefusals` included.
--    Publishing one alone would put 'the tolerance was too tight' on the wire
--    while 'the tolerance is nonsense' stayed invisible, which is the
--    two-findings-one-view defect G291 corrects, pointing the other way. **Both,
--    or neither, and neither is what stands.**"* A column for one of them here
--    would be the invented second vocabulary `0002_run.sql`'s header names —
--    stored, unpublished, checked by nothing. **Both channels get columns in the
--    migration that publishes both schemas, and not before.**
--
-- ---------------------------------------------------------------------
-- 🛑 NO CHECK CONSTRAINT ON ANY VOCABULARY COLUMN, AND THAT IS `0002_run.sql`'s
--    DECISION APPLIED RATHER THAN A NEW ONE.
--
-- Every `_kind`, `side`, `meter`, `disposition` and `trailer` column below is a
-- closed union in `model/reconciliation.ts` AND an `enum` in
-- `capability.openapi.yaml`, and **`tools/check-wire-mirror.mjs` holds those two
-- together as SEQUENCES** — `admission_refusal_kinds`, `population_defect_kinds`,
-- `postcondition_failure_kinds`, `completeness_finding_kinds`,
-- `residue_cause_kinds`, `reader_refusal_kinds`, `money_refusal_kinds`,
-- `extraction_refusal_kinds`, `extracted_scalar_kinds`, `engine_meter`,
-- `pairing_strategy_kinds` and the rest. A CHECK here would be a THIRD copy,
-- and — 0002's deciding sentence — **the one nothing checks, because no pair in
-- the wire-mirror addresses SQL.**
--
-- ⚠️ THE GAP THAT LEAVES IS CLOSED WHERE IT CAN BE DERIVED INSTEAD OF COPIED:
--    at the read boundary, in `server/data-plane/run-vocabulary.ts`, whose
--    records are keyed `Record<Union['kind'], true>` so an arm added to the
--    model is a COMPILE ERROR in `server/` rather than a list somebody forgot.
--    That is the same answer `run` itself got for `status` and `trigger_kind`.
--
-- ⚠️ `0004_subject_ledger.sql` DOES CARRY A CHECK, ON `scope`, AND THE TWO
--    DECISIONS ARE NOT IN CONFLICT — the difference is named so nobody reads
--    this file as overturning that one. `UNIQUENESS_SCOPES` governs what the
--    EVALUATOR can answer and 0004's argument is *"a scope the evaluator cannot
--    answer must not be storable"*: the constraint protects a WRITE. Every
--    column here is on a read path with no writer in the tree, and its
--    vocabulary is pinned to the wire by a checker that runs in the gate. The
--    rule is the property, not the file.
--
-- ---------------------------------------------------------------------
-- RULINGS THIS APPLIES, all identically to 0001–0006:
--   G97   every branded id is `text`; the slug is stored VERBATIM. No uuid.
--   G100  the policy DENIES on NULL. A forgotten transaction yields an EMPTY
--         result set, never another tenant's rows.
--   G101  transaction-mode pooling assumed; `SET LOCAL` inside an explicit
--         transaction, issued only by `withTenantScope()`.
--   G88   forward-only expand/contract. 0001–0006 ARE NOT EDITED BY THIS FILE.
--   G286  MONEY IS `bigint`, SO A MONEY COLUMN IS `int8`. Every minor-unit
--         column below is `bigint` and NOT `numeric` and NOT `integer`:
--         `exceeds_exact_integer_range` now names exactly the `int8` bound,
--         −2^63 … 2^63−1, and `model/money.ts` refuses outside it AT ADMISSION
--         *"or it is an `INSERT` error after a run has already been computed —
--         and a run that cannot be stored is not a smaller success."*
--         🛑 `pg` RETURNS `int8` AS A STRING BY DEFAULT and that is not a
--         detail: the string is the WIRE FORM already
--         (`Money.amountMinor` is `{type: string, pattern: '^-?[0-9]+$'}`), so
--         the read seam validates it and passes it through rather than round-
--         tripping it through a `number` and back. See `run-account.ts`.
--
-- 🛑 EVERY TABLE IS SCHEMA-QUALIFIED `tenant.`, WHICH `0003_tenant_schema.sql`
--    MADE MANDATORY FROM 0004 ON: *"Qualify every CREATE TABLE explicitly from
--    0004 on, or the schema a table lives in becomes a side effect of migration
--    order."* `run` itself is in `public` — 0003 explains why, and it is why
--    every foreign key below names `public.run` rather than inheriting a
--    search_path.
-- =====================================================================


-- =====================================================================
-- §1  THE ENVELOPE
--
-- One row per run that has an engine account. **The row's EXISTENCE is the
-- fact `Run.completeness: null` could not carry** — `server/data-plane/runs.ts`
-- states the distinction that motivated this whole file:
--
--     `[]`    the ENGINE ran and observed no shortfall.
--     `null`  THIS PLANE HOLDS NO ENGINE ACCOUNT FOR THIS RUN AT ALL.
--
-- With this table, `null` becomes derivable rather than constant: no row here
-- means no account, and a row here means every channel below is the engine's
-- own and an empty channel is an OBSERVATION.
--
-- ⚠️ `outcome` ADMITS `refused` ALREADY, AND NOTHING WRITES IT TODAY. The
--    column is the discriminant `RunEngineAccount` publishes, so the migration
--    that persists the refused arm ADDS COLUMNS rather than reshaping this one
--    — which is what G88's expand-then-contract asks for. A reader must not
--    take the presence of the word as evidence the arm is served.
-- =====================================================================

CREATE TABLE tenant.run_engine_account (
  tenant_id       text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  run_id          text        NOT NULL,

  -- `RunEngineAccount.oneOf` discriminates on this. 'produced' | 'refused'.
  outcome         text        NOT NULL,

  -- `TerminalRunStatus` — completed | failed | incomplete. NULL on the refused
  -- arm, which carries no terminal status because it carries no ledger.
  --
  -- 🛑 IT IS STORED AND NOT DERIVED, AND THAT IS DELIBERATE. `terminalRunStatus()`
  --    computes it from `postconditions` plus `completeness` and
  --    `POSTCONDITION_PROPERTY`; recomputing it at READ time would mean a row
  --    could report a status its own stored channels do not produce, with no
  --    way to tell a drifted algorithm from a drifted row. The engine's answer
  --    is the fact; the read seam publishes it.
  terminal_status text,

  recorded_at     timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, run_id),

  -- 🛑 THE COMPOSITE FOREIGN KEY, FOR `0002_run.sql`'s REASON: *"a cross-tenant
  --    reference has to be unrepresentable rather than merely unlikely."* A
  --    single-column `REFERENCES public.run (id)` would not even compile — `run`'s
  --    primary key is `(tenant_id, id)` — and that is the point: the shape of
  --    the parent key is what forbids an account row pointing at another
  --    tenant's run.
  FOREIGN KEY (tenant_id, run_id) REFERENCES public.run (tenant_id, id) ON DELETE CASCADE
);


-- =====================================================================
-- §2  `admissionRates` — WHAT ADMISSION DID, PER SIDE
--
-- C13. Two rows on every produced run, `left` then `right`. The wire says
-- `minItems: 2, maxItems: 2`, so the PRIMARY KEY is `(tenant_id, run_id, side)`
-- and the cardinality is a structural fact rather than an ordering convention:
-- **a third rate for a side is unrepresentable, and a duplicate is a constraint
-- violation rather than a longer array.**
--
-- ⚠️ `ORDER BY side` IS THE WIRE ORDER BY LUCK AND THE READ SEAM DOES NOT RELY
--    ON IT. 'left' < 'right' in every collation that matters, and depending on
--    that would be a rule keyed on a convenient landmark (§5.1). The handler
--    emits the two in declared order by NAME.
-- =====================================================================

CREATE TABLE tenant.run_admission_rate (
  tenant_id text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  run_id    text    NOT NULL,
  side      text    NOT NULL,
  -- "Rows the DOCUMENTS presented. Independent of the admission fold."
  presented integer NOT NULL,
  admitted  integer NOT NULL,
  refused   integer NOT NULL,

  PRIMARY KEY (tenant_id, run_id, side),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES tenant.run_engine_account (tenant_id, run_id) ON DELETE CASCADE
);


-- =====================================================================
-- §3  `documentAccounts` — WHAT EVERY FILE SAID ABOUT ITSELF
--
-- G236. One row per document, left's then right's, each in supplied order,
-- INCLUDING documents whose trailer was met and documents whose format declares
-- none. `ordinal` is that supplied order and it is the whole ordering key —
-- sorting by `source_document_id` would publish an order the engine never
-- emitted.
--
-- 🛑 THE MET ROWS ARE THE POINT: *"a check that only speaks when it fails leaves
--    an operator unable to tell 'this file vouched for itself and was right'
--    from 'this file said nothing'."* So `verdict_kind` is NOT NULL and
--    `nothing_to_check` and `agreed` are ordinary stored values, not absences.
-- =====================================================================

CREATE TABLE tenant.run_document_account (
  tenant_id           text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  run_id              text    NOT NULL,
  -- Supplied order, left's documents then right's. The engine's emission index.
  ordinal             integer NOT NULL,

  side                text    NOT NULL,
  source_document_id  text    NOT NULL,

  -- `ControlTotal['kind']` verbatim — declared | not_declared_by_format |
  -- expected_but_absent. The wire declares the third *"rather than excluding it
  -- so that a new arm is a decision somebody has to take rather than a silent
  -- widening"*, and it is unreachable on a produced run.
  trailer             text    NOT NULL,

  -- Null where no trailer was found, or one was found declaring no count.
  declared_line_count integer,
  -- 🛑 `bigint`, G286. A `Money`'s minor units. Null where no trailer declared
  --    a total. `pg` hands this back as a STRING, which is the wire form.
  declared_minor      bigint,
  declared_exponent   integer,

  presented           integer NOT NULL,
  admitted            integer NOT NULL,
  refused             integer NOT NULL,

  -- `DocumentTrailerVerdict['kind']` — nothing_to_check | agreed | reported |
  -- not_evaluated_address_collision. The `reported` arm's defects are rows in
  -- §4, addressed `owner = 'document_account'`.
  verdict_kind        text    NOT NULL,

  PRIMARY KEY (tenant_id, run_id, ordinal),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES tenant.run_engine_account (tenant_id, run_id) ON DELETE CASCADE
);


-- =====================================================================
-- §4  `PopulationDefect` — ONE TABLE, THREE OWNERS
--
-- 🛑 THIS IS THE ONE PLACE THIS MIGRATION DEPARTS FROM ONE-TABLE-PER-CHANNEL,
--    AND THE DEPARTURE IS ARGUED RATHER THAN CONVENIENT. `PopulationDefect`
--    appears at THREE positions in the produced arm:
--
--      `documentAccounts[].verdict.reported.defects[]`   (an array)
--      `postconditions[].population_integrity_reported.defect`   (one)
--      `completeness[].source_self_report_unmet.defect`          (one)
--
--    `model/reconciliation.ts` states in its own voice that this is ONE
--    vocabulary and not three: the disagreeing case *"carries the same
--    `PopulationDefect` values that reach `postconditions` and `completeness`,
--    by reference, from one call of `checkPopulationIntegrity`. It is NOT a
--    second vocabulary for C18."* Three tables would be three places for one
--    vocabulary to drift — which is the exact failure `0002_run.sql`'s header
--    names, arriving from inside the fix for it.
--
-- ⚠️ THE COST IS A POLYMORPHIC PARENT POINTER AND IT IS NOT FREE. `owner` plus
--    `owner_ordinal` cannot be a foreign key — PostgreSQL has no polymorphic
--    references — so a defect row orphaned from its owner is representable
--    here and is caught nowhere in the database. `ON DELETE CASCADE` from the
--    ENVELOPE is what bounds the damage: a deleted account takes every defect
--    with it. The alternative, a nullable FK per owner with a CHECK that
--    exactly one is non-null, was considered and refused: it is three columns
--    and a constraint to express one relation, and it grows by two every time a
--    fourth position for this vocabulary appears.
--
-- ⚠️ EVERY ARM'S FIELD GETS ITS OWN COLUMN AND EVERY ONE IS NULLABLE, WHICH IS
--    SINGLE-TABLE INHERITANCE AND IS NAMED SO NOBODY HAS TO GUESS. The
--    invariant is that exactly the arm's declared fields are non-null, and it is
--    held by the READ seam — `run-account.ts` switches on `kind` and refuses a
--    row whose arm fields are absent, rather than publishing a defect with a
--    hole in it.
-- =====================================================================

CREATE TABLE tenant.run_population_defect (
  tenant_id     text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  run_id        text    NOT NULL,

  -- 'document_account' | 'postcondition' | 'completeness'. NOT a wire value —
  -- it is this table's own join key, and it is the only column in this file that
  -- names something the contract does not.
  owner         text    NOT NULL,
  -- The owning row's `ordinal`.
  owner_ordinal integer NOT NULL,
  -- Position within the owner's defect list. Always 0 for the two single-defect
  -- owners, which is a fact about those arms rather than a placeholder.
  ordinal       integer NOT NULL,

  kind          text    NOT NULL,

  -- `duplicate_item_address`
  ref_source_document_id text,
  ref_line_index         integer,
  occurrences            integer,

  -- `admission_refusal_rate_above_ceiling`
  refused_count          integer,
  -- "Rows on the WHOLE SIDE — not rows in one document."
  side_row_count         integer,
  ceiling_basis_points   integer,

  -- the six control-total arms
  source_document_id     text,
  declared_count         integer,
  document_row_count     integer,
  admitted_count         integer,
  -- `control_total_not_evaluable` — `MoneyRefusal['kind']`.
  money_refusal_kind     text,
  -- `declared_control_total_disagrees` — two `Money`s, G286, so `bigint`.
  declared_minor         bigint,
  declared_exponent      integer,
  admitted_minor         bigint,
  admitted_exponent      integer,

  PRIMARY KEY (tenant_id, run_id, owner, owner_ordinal, ordinal),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES tenant.run_engine_account (tenant_id, run_id) ON DELETE CASCADE
);


-- =====================================================================
-- §5  `refusedAtAdmission` — ONE ROW PER REFUSED ROW
--
-- "One entry per refused row, with its side, its `ItemRef`, the declared path
-- that refused and the reason admission gave."
--
-- 🛑 `path` IS THE OPERATOR'S DECLARED `FieldSpec` PATH AND NEVER A KEY READ OUT
--    OF THE PAYLOAD. `RefusedItem` carries the inverted containment split this
--    engine uses everywhere: the closed union carrying the REASON holds the
--    no-text proof, and the record carrying the declared path does not, because
--    `FieldSegment.key` is a bare `string`. **Nothing counterparty-authored
--    lands in this table.**
-- =====================================================================

CREATE TABLE tenant.run_refused_item (
  tenant_id text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  run_id    text    NOT NULL,
  ordinal   integer NOT NULL,

  side                   text  NOT NULL,
  ref_source_document_id text  NOT NULL,
  -- "Null for a header-grain transaction; the line index for a statement line."
  ref_line_index         integer,

  -- 🛑 A `FieldPath` IN ITS DECLARED WIRE FORM — a JSON array of strings and
  --    numbers. See this file's header for why this is not the `jsonb` operand
  --    column G284 refused: a token list has no keys, so there is no key for a
  --    `FieldSpec` to be missing from. `parseFieldPath()` is the only reader.
  path                   jsonb NOT NULL,

  -- `AdmissionRefusal['kind']`, and the three arms that carry a payload:
  refusal_kind             text,
  -- `amount_not_money` / `date_not_extractable` → `ExtractedScalar['kind']`
  refusal_found            text,
  -- `identifier_not_extractable` → `ExtractionRefusal['kind']`
  refusal_extraction_kind  text,
  -- `money_unit_disagrees_with_declared` / `amount_not_exact_money`
  -- → `MoneyRefusal['kind']`
  refusal_money_kind       text,

  PRIMARY KEY (tenant_id, run_id, ordinal),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES tenant.run_engine_account (tenant_id, run_id) ON DELETE CASCADE
);

-- ⚠️ `refusal_kind` IS NULLABLE ABOVE AND THAT IS A DEFECT THIS FILE DECLINES
--    TO CARRY. It is `NOT NULL` — expressed here rather than inline only so the
--    reason sits beside it: every `RefusedItem` has a refusal, the wire marks it
--    `required`, and a NULL would publish a refusal with no reason on the one
--    row a person reads to find out why admission said no.
ALTER TABLE tenant.run_refused_item ALTER COLUMN refusal_kind SET NOT NULL;


-- =====================================================================
-- §6  `ambiguities` — WHERE AN IDENTIFIER NAMED MORE THAN ONE ROW
--
-- G217. *"Without this an operator reading `no_strategy_paired` on a residue
-- row cannot tell nothing matched from two things matched and the engine would
-- not choose, and only the second is a duplicate-invoice finding."*
--
-- 🛑 IT ADDRESSES BY `ItemRef` AND NEVER BY KEY. This replaced two
--    `readonly (string | null)[]` arrays of COUNTERPARTY-AUTHORED bucket keys,
--    and that is why it could reach the wire at all. **There is no column here
--    for a bucket key and there must never be one.**
--
-- ⚠️ THE COUNTS AND THE ADDRESSES ARE STORED SEPARATELY BECAUSE THE WIRE
--    DECLARES THEM SEPARATELY AND THEY MUST AGREE. `leftCandidates` is not
--    `count(leftRefs)` by definition — it is what the join reached — and
--    deriving one from the other at read time would make a disagreement
--    unobservable. Two facts, two columns, and a consumer that can compare them.
-- =====================================================================

CREATE TABLE tenant.run_ambiguity (
  tenant_id text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  run_id    text    NOT NULL,
  ordinal   integer NOT NULL,

  -- `AmbiguityFinding.on` — the declared path the join ran on, or NULL. The
  -- wire's `oneOf: [FieldPath, null]`; NULL is a value, for a strategy that runs
  -- on no declared path.
  on_path           jsonb,
  -- `PairingStrategy['kind']` — exact_identifier | amount_and_date | amount_sum
  -- | fuzzy_reference.
  strategy_kind     text    NOT NULL,
  left_candidates   integer NOT NULL,
  right_candidates  integer NOT NULL,

  PRIMARY KEY (tenant_id, run_id, ordinal),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES tenant.run_engine_account (tenant_id, run_id) ON DELETE CASCADE
);

-- "EVERY left candidate, not the winner. The set is the finding."
CREATE TABLE tenant.run_ambiguity_ref (
  tenant_id         text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  run_id            text    NOT NULL,
  ambiguity_ordinal integer NOT NULL,
  -- Which of the finding's two arrays this row belongs to. 'left' | 'right'.
  side              text    NOT NULL,
  ordinal           integer NOT NULL,

  source_document_id text   NOT NULL,
  line_index         integer,

  PRIMARY KEY (tenant_id, run_id, ambiguity_ordinal, side, ordinal),
  FOREIGN KEY (tenant_id, run_id, ambiguity_ordinal)
    REFERENCES tenant.run_ambiguity (tenant_id, run_id, ordinal) ON DELETE CASCADE
);


-- =====================================================================
-- §7  `searchBoundary` — WHERE THE ENGINE STOPPED LOOKING
--
-- G217, and G114 before it: *"a bound that was hit is recorded, never silently
-- absorbed."* Three declared arrays, one table, discriminated by `channel`.
--
-- 🛑 THE DISTINCTION THIS CHANNEL EXISTS TO PRESERVE: `no_strategy_paired` on a
--    residue row means the engine LOOKED AND FOUND NOTHING; `search_budget_
--    exhausted` means it STOPPED LOOKING. *"A consumer that cannot separate the
--    two is reading a bound as a verdict."*
--
-- ⚠️ ALL THREE ARRAYS ARE REQUIRED AND MAY BE EMPTY, so a produced run with no
--    boundary rows at all still publishes `{oversizedBuckets: [],
--    exhaustedSearches: [], oversizedAmountBuckets: []}`. **The envelope row in
--    §1 is what makes those empties an observation rather than an absence** —
--    which is the same `[]`-versus-`null` argument `runs.ts` makes about
--    `Run.completeness`, one grain down.
-- =====================================================================

CREATE TABLE tenant.run_search_boundary_entry (
  tenant_id text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  run_id    text    NOT NULL,
  -- 'oversized_buckets' | 'exhausted_searches' | 'oversized_amount_buckets'.
  -- The three property names of `SearchBoundary`, in snake case. This table's
  -- own join key; the handler maps it back to the declared property.
  channel   text    NOT NULL,
  ordinal   integer NOT NULL,

  -- "Open items in scope when the engine stopped. Never a size class."
  item_count                  integer NOT NULL,
  example_source_document_id  text    NOT NULL,
  example_line_index          integer,

  PRIMARY KEY (tenant_id, run_id, channel, ordinal),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES tenant.run_engine_account (tenant_id, run_id) ON DELETE CASCADE
);


-- =====================================================================
-- §8  `postconditions` — WHAT THE ENGINE COULD NOT ESTABLISH
--
-- "In the order the engine emitted them — a shredded trailer produces a count
-- disagreement AND a total disagreement, and the two are independent findings
-- about the same file."  `ordinal` is that order.
--
-- 🛑 A NON-EMPTY LIST IS NOT AN INSTRUCTION AND MUST NOT BE READ AS ONE. Since
--    O-16, which of the two properties an arm is about is declared by
--    `POSTCONDITION_PROPERTY` and `terminalRunStatus()` is what a caller uses
--    instead of a length test. *"A caller that still treats this list as a
--    do-not-persist flag will discard sound partial closes."* That declaration
--    is NOT stored — see the handler; it is a constant the model owns, and a
--    second copy in a column is a second thing to drift.
-- =====================================================================

CREATE TABLE tenant.run_postcondition (
  tenant_id text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  run_id    text    NOT NULL,
  ordinal   integer NOT NULL,

  kind      text    NOT NULL,

  -- the four counting arms: open_item_missing_from_residue, item_in_residue_twice,
  -- fully_allocated_item_in_residue, negative_residual
  count           integer,

  -- `gross_not_partitioned` — two minor-unit totals computed from INDEPENDENT
  -- sources, which is what makes the check non-tautological. `bigint`, G286.
  admitted_minor  bigint,
  accounted_minor bigint,

  -- `population_integrity_reported` (defect in §4) and `population_wholly_refused`
  side            text,
  side_row_count  integer,

  PRIMARY KEY (tenant_id, run_id, ordinal),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES tenant.run_engine_account (tenant_id, run_id) ON DELETE CASCADE
);


-- =====================================================================
-- §9  `completeness` — SHORTFALL, AS OPPOSED TO UNSOUNDNESS
--
-- O-16, and G153's carve-out ⓐ at the grain it was actually about. Non-empty
-- maps to `RunStatus.incomplete`; it does NOT mean do-not-persist.
--
-- ⚠️ *"EMPTY ON A WHOLE RUN, which is what makes the state worth having: a
--    channel that fired on everything would be routed around within a week."*
-- =====================================================================

CREATE TABLE tenant.run_completeness (
  tenant_id text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  run_id    text    NOT NULL,
  ordinal   integer NOT NULL,

  -- rows_presented_not_admitted | source_self_report_unmet
  kind      text    NOT NULL,
  side      text    NOT NULL,

  -- `rows_presented_not_admitted`
  presented integer,
  admitted  integer,
  refused   integer,

  -- `source_self_report_unmet` carries a `PopulationDefect`, in §4,
  -- `owner = 'completeness'`.

  PRIMARY KEY (tenant_id, run_id, ordinal),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES tenant.run_engine_account (tenant_id, run_id) ON DELETE CASCADE
);


-- =====================================================================
-- §10  `meterFacts` — WHAT THE RUN SPENT
--
-- G237. Four meters and NOTHING ABOUT WHAT THEY ARE WORTH.
--
-- 🛑 THERE IS NO PRICE COLUMN HERE AND THERE MUST NEVER BE ONE. **Invariant 5 —
--    money is always derived.** `UsageRecord` is immutable and unpriced, which
--    is why `metering` is its own resource class with NO write mode: *"a raw
--    usage record is volume in the clear."* Anything that rates, divides or
--    totals these four is a DERIVATION and belongs where derivations live.
--    `tests/contracts/meter-fact-wire.test.mjs` scans the minted surface for
--    `price|rate|cost|amount|currency` — a column named for any of them here
--    would be the same defect one layer down, where that scan does not reach.
--
-- ⚠️ EMPTY IS LEGAL AND IS NOT THE SAME CLAIM AS ABSENT: *"a run that made no
--    model call and raised nothing has four meters' worth of nothing to
--    report."* The envelope row carries that distinction, as everywhere else
--    in this file.
-- =====================================================================

CREATE TABLE tenant.run_meter_fact (
  tenant_id text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  run_id    text    NOT NULL,
  ordinal   integer NOT NULL,

  -- `EngineMeter` — input_tokens | output_tokens | reconciliations_run |
  -- exceptions_raised. A STRICT SUBSET of `Meter`'s eight, and not the same
  -- vocabulary: the other four have other producers and this engine is not one.
  meter           text    NOT NULL,
  -- `minimum: 0` on the wire. A count, never an amount.
  quantity        integer NOT NULL,
  idempotency_key text    NOT NULL,
  -- Null where the meter is not a model call.
  model_entry_id  text,

  PRIMARY KEY (tenant_id, run_id, ordinal),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES tenant.run_engine_account (tenant_id, run_id) ON DELETE CASCADE
);


-- =====================================================================
-- §11  `residue` — THE PRODUCT
--
-- *"THE RESIDUE IS THE PRODUCT. Every row of the register an operator works is
-- one of these, and a residue of a hundred thousand open rows is not a property
-- on an envelope"* — which is why `listRunResidue` is its own cursor-paged
-- operation, and why this is the one channel whose shape was never in question:
-- **a hundred thousand rows cannot be keyset-paged out of a JSON array.**
--
-- Addressed by `ItemRef` at LINE grain, *"because a set reconciliation is LINE
-- grain: a bank statement is one document with four hundred lines, and a match
-- group addresses documents and can never record which line paired."*
--
-- 🛑 NO COUNTERPARTY PROSE. `AdmittedItem.untrustedDescription` is the one such
--    field in the engine and the wire schema names it *"precisely so nobody adds
--    it"* — this row is rendered on an operator surface and logged (invariant
--    6). **There is no description column here and there must never be one.**
--
-- ⚠️ THE ORDERING KEY IS `ordinal`, AND IT IS THE ENGINE'S EMISSION ORDER. It is
--    unique within a run, dense, and stable — so a keyset cursor on it cannot
--    skip a row or repeat one across pages, which an ordering on
--    `(source_document_id, line_index)` could not promise: `line_index` is
--    NULLABLE for a header-grain transaction, and NULLs order differently from
--    every value.
-- =====================================================================

CREATE TABLE tenant.run_residue (
  tenant_id text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  run_id    text    NOT NULL,
  ordinal   integer NOT NULL,

  side                   text    NOT NULL,
  ref_source_document_id text    NOT NULL,
  ref_line_index         integer,

  -- 🛑 `settlement_kind` NULL MEANS `settlement: null`, WHICH IS A VALUE AND NOT
  --    AN ABSENCE. The wire makes `settlement` REQUIRED AND NULLABLE, never
  --    optional, and says why in its own voice: *"The first version of this
  --    field was non-null and the refused case carried a zero in an empty
  --    currency — a FABRICATED zero sitting on the one row a finance user reads
  --    to find out what went wrong."* An item refused at admission has no
  --    settlement because it has no AMOUNT.
  settlement_kind        text,

  -- ⚠️ SIX COLUMNS AND NOT FOUR. `ItemSettlement`'s `partially_allocated` arm
  --    carries TWO `Money`s, and each `Money` carries its own currency and
  --    exponent. Storing one shared currency/exponent pair would compress on the
  --    assumption that the two always agree — which is true today, and true
  --    BECAUSE `sameUnit()` enforces it somewhere else. A column set that is
  --    correct only because another module is well-behaved is the shape §5.1
  --    catalogues; these are literal.
  settlement_allocated_currency text,
  settlement_allocated_minor    bigint,
  settlement_allocated_exponent integer,
  settlement_residual_currency  text,
  settlement_residual_minor     bigint,
  settlement_residual_exponent  integer,

  -- `EngineAssignableDisposition` — unidentified | error_left | error_right.
  -- 🛑 THREE OF THE SIX, AND THE OTHER THREE ARE NOT MISSING. `timing_difference`,
  --    `in_transit` and `write_off` are FINANCE JUDGEMENTS about why something
  --    failed to pair, *"and an engine that guessed one would be manufacturing a
  --    finance decision out of an absence."*
  disposition            text    NOT NULL,

  -- `ResidueCause['kind']` — thirteen members since G291, and
  -- `control_total_unverified` dominates the others deliberately.
  cause_kind                    text,
  -- `admission_refused` → `AdmissionRefusal`, flattened exactly as §5 flattens it.
  cause_admission_refusal_kind    text,
  cause_admission_found           text,
  cause_admission_extraction_kind text,
  cause_admission_money_kind      text,
  -- `reader_refused` → `ReaderRefusal['kind']`
  cause_reader_refusal_kind       text,
  -- 🛑 `amount_tolerance_declined` — G291, 19 Sep 2026, AND IT IS `bigint`.
  --    `leftTotal − rightTotal` over the WHOLE BUCKET, so on an N:M bucket every
  --    member carries the same figure and it is the BUCKET's. The wire publishes
  --    it as a decimal STRING for `Money.amountMinor`'s reason: *"a JSON number
  --    is an IEEE double that loses exactness above 2^53."*
  cause_signed_variance_minor     bigint,

  PRIMARY KEY (tenant_id, run_id, ordinal),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES tenant.run_engine_account (tenant_id, run_id) ON DELETE CASCADE
);

-- `cause` is `required` on `ResidueEntry`. See §5's note on `refusal_kind`: a
-- residue row with no cause is an open item with no reason, on the one surface
-- an operator works.
ALTER TABLE tenant.run_residue ALTER COLUMN cause_kind SET NOT NULL;

-- The paging index. `listRunResidue` is keyset-paged on `ordinal` ascending
-- within one run, and the tenant column leads for `run_recent_idx`'s reason:
-- *"every query arrives already filtered to one tenant BY THE POLICY — the
-- planner sees that predicate even though no handler wrote it."*
CREATE INDEX run_residue_page_idx ON tenant.run_residue (tenant_id, run_id, ordinal);


-- =====================================================================
-- §12  `ResidueEntry.heldReads` — EVERY READ THAT CAME IN UNDER ITS FLOOR
--
-- G227. *"It is HELD, not refused: the item is admitted, kept out of every pass,
-- and lands in the residue carrying this record."*
--
-- 🛑 NO EXTRACTED VALUE, EVER, AND THAT IS THE POINT RATHER THAN AN OMISSION.
--    *"The whole reason a read is held is that a person will look at the value —
--    which is exactly why it must be FETCHED under a classification rather than
--    embedded here."* **There is no value column in this table and there must
--    never be one.**
--
-- ⚠️ IT IS NOT KEYED ON `cause`. *"A row whose cause is
--    `control_total_unverified` may still carry a held read: the file's own
--    account dominates the cause, and the person's question survives it."* So
--    the foreign key is to the residue ROW and not to a cause value.
--
-- ⚠️ `read_confidence` AND `floor` ARE IN `FieldSpec.confidenceFloor`'S OWN UNIT
--    AND ARE NOT BASIS POINTS, against the habit of every other rate on this
--    tier. *"Converting would mint a second representation of one declared
--    number, which is the shape G111 refuses for money."* `double precision`,
--    therefore, and not an integer scaled by anybody's convention.
-- =====================================================================

CREATE TABLE tenant.run_held_read (
  tenant_id       text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  run_id          text    NOT NULL,
  residue_ordinal integer NOT NULL,
  ordinal         integer NOT NULL,

  ref_source_document_id text  NOT NULL,
  ref_line_index         integer,
  -- The declared `FieldSpec` path. Operator-authored, never counterparty content.
  path                   jsonb NOT NULL,

  -- 🛑 REQUIRED AND NULLABLE, NEVER OPTIONAL. *"Null means a floor WAS declared
  --    for this path and the extraction reported no confidence at all, so there
  --    was nothing to compare against it. That is HELD, not passed — fail-closed,
  --    the same direction as G106's unreadable-by-default."*
  read_confidence        double precision,
  floor                  double precision NOT NULL,

  PRIMARY KEY (tenant_id, run_id, residue_ordinal, ordinal),
  FOREIGN KEY (tenant_id, run_id, residue_ordinal)
    REFERENCES tenant.run_residue (tenant_id, run_id, ordinal) ON DELETE CASCADE
);


-- =====================================================================
-- ROW-LEVEL SECURITY — the same four statements per table as 0001 and 0002,
-- for the same reasons, stated once here and applied thirteen times below.
--
-- `FORCE` is not decoration: `ENABLE` alone leaves the TABLE OWNER exempt, so a
-- test connecting as the owner would pass with the policy doing nothing and pass
-- just as well with the policy dropped. `FORCE` is what makes the explicit
-- `BYPASSRLS` attribute on `reconcile_migrator` the ONLY route to the read
-- exemption — separately grantable, separately revocable, G100.
--
-- The predicate's null polarity is 0001's, verbatim and deliberately so:
--
--     nullif(current_setting('app.tenant_id', true), '')
--
--   `missing_ok = true`  — an unset variable returns NULL instead of raising.
--   `nullif(…, '')`      — a GUC that was SET and reverted reads back as the
--                          EMPTY STRING, not NULL. Without this the predicate is
--                          `tenant_id = ''`, which denies BY ACCIDENT and only
--                          because no tenant id happens to be empty — §5.1.
--   `tenant_id = NULL`   — NULL is not TRUE, so the row is filtered.
--                          THE POLICY DENIES ON NULL.
--
-- `WITH CHECK` is stated explicitly rather than defaulted from `USING`, so a
-- later `FOR SELECT`/`FOR ALL` edit cannot silently drop the write half.
--
-- 🛑 EVERY CHILD TABLE CARRIES ITS OWN `tenant_id` AND ITS OWN POLICY, AND THAT
--    IS NOT REDUNDANT. A child reachable only through a scoped parent is a child
--    protected by a JOIN somebody remembered to write — which is precisely the
--    handler-side filtering `runs.ts` refuses. Here the leaf row is invisible on
--    its own terms, so a future query that reaches it directly is safe by
--    construction rather than by review.
-- =====================================================================

ALTER TABLE tenant.run_engine_account       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.run_engine_account       FORCE  ROW LEVEL SECURITY;
CREATE POLICY run_engine_account_rls ON tenant.run_engine_account
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

ALTER TABLE tenant.run_admission_rate       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.run_admission_rate       FORCE  ROW LEVEL SECURITY;
CREATE POLICY run_admission_rate_rls ON tenant.run_admission_rate
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

ALTER TABLE tenant.run_document_account     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.run_document_account     FORCE  ROW LEVEL SECURITY;
CREATE POLICY run_document_account_rls ON tenant.run_document_account
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

ALTER TABLE tenant.run_population_defect    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.run_population_defect    FORCE  ROW LEVEL SECURITY;
CREATE POLICY run_population_defect_rls ON tenant.run_population_defect
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

ALTER TABLE tenant.run_refused_item         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.run_refused_item         FORCE  ROW LEVEL SECURITY;
CREATE POLICY run_refused_item_rls ON tenant.run_refused_item
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

ALTER TABLE tenant.run_ambiguity            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.run_ambiguity            FORCE  ROW LEVEL SECURITY;
CREATE POLICY run_ambiguity_rls ON tenant.run_ambiguity
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

ALTER TABLE tenant.run_ambiguity_ref        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.run_ambiguity_ref        FORCE  ROW LEVEL SECURITY;
CREATE POLICY run_ambiguity_ref_rls ON tenant.run_ambiguity_ref
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

ALTER TABLE tenant.run_search_boundary_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.run_search_boundary_entry FORCE  ROW LEVEL SECURITY;
CREATE POLICY run_search_boundary_entry_rls ON tenant.run_search_boundary_entry
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

ALTER TABLE tenant.run_postcondition        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.run_postcondition        FORCE  ROW LEVEL SECURITY;
CREATE POLICY run_postcondition_rls ON tenant.run_postcondition
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

ALTER TABLE tenant.run_completeness         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.run_completeness         FORCE  ROW LEVEL SECURITY;
CREATE POLICY run_completeness_rls ON tenant.run_completeness
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

ALTER TABLE tenant.run_meter_fact           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.run_meter_fact           FORCE  ROW LEVEL SECURITY;
CREATE POLICY run_meter_fact_rls ON tenant.run_meter_fact
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

ALTER TABLE tenant.run_residue              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.run_residue              FORCE  ROW LEVEL SECURITY;
CREATE POLICY run_residue_rls ON tenant.run_residue
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

ALTER TABLE tenant.run_held_read            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.run_held_read            FORCE  ROW LEVEL SECURITY;
CREATE POLICY run_held_read_rls ON tenant.run_held_read
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- =====================================================================
-- GRANTS — `SELECT` AND `INSERT`. NO `UPDATE` AND NO `DELETE`, AND BOTH HALVES
-- OF THAT ARE DECISIONS.
--
-- By name, because 0003 deliberately declines to set `ALTER DEFAULT PRIVILEGES`
-- on this schema: *"A future table created here is unreachable by the app until
-- granted BY NAME … default privileges would silently hand the request path a
-- table nobody decided to expose."*
--
-- ✅ `INSERT` IS GRANTED **BECAUSE THE WRITER LANDS IN THIS COMMIT**, which is
--    the condition `0005_session_and_membership.sql` set one file back when it
--    refused the same privilege: *"A write privilege ahead of a writer is the
--    shape `0004_subject_ledger.sql` refused at length … The commit that builds
--    the invitation writer adds the privilege, in the same commit as the
--    writer."* The writer here is `persistRunEngineAccount()` in
--    `server/data-plane/run-account-store.ts`, and it issues every statement
--    inside `withTenantScope()`.
--
-- 🛑 THAT IS ALSO WHAT PUTS THE POLICY'S `WITH CHECK` HALF UNDER TEST FOR THE
--    FIRST TIME IN THIS REPOSITORY. Every previous fixture seeded through
--    `reconcile_migrator`, which holds `BYPASSRLS` — so the write half of every
--    policy since 0001 has been stated and never exercised. A write issued as
--    `reconcile_app` under a scope for tenant A, naming tenant B, is refused by
--    the database, and `tests/db/run-engine-account.test.ts` requires it.
--
-- 🛑 NO `UPDATE` AND NO `DELETE`, AND THIS IS NOT CAUTION — IT IS WHAT AN ENGINE
--    ACCOUNT IS. **A run's account of itself is a fact about something that
--    already happened.** Amending it would mean the record of a close could
--    change after the close, with nothing able to tell an amended account from
--    the original one; the product's answer to a wrong result is a RE-RUN, which
--    `rerunRun` makes a new run with a new id and a required reason —
--    *"a re-run whose diff nobody can explain is a re-run nobody trusts."* That
--    is the same immutability `UsageRecord` carries under invariant 5, for the
--    same reason. Removal is not lost: `ON DELETE CASCADE` from `public.run` and
--    from `tenant.tenant` takes every row here with the run and with the tenant.
--
-- ⚠️ THE COST, STATED: re-persisting one run is a PRIMARY KEY violation rather
--    than an overwrite. That is the intended behaviour and the writer does not
--    dress it up — an engine account that already exists is not a request to
--    replace it.
-- =====================================================================

GRANT SELECT, INSERT ON tenant.run_engine_account        TO tenant_rw;
GRANT SELECT, INSERT ON tenant.run_admission_rate        TO tenant_rw;
GRANT SELECT, INSERT ON tenant.run_document_account      TO tenant_rw;
GRANT SELECT, INSERT ON tenant.run_population_defect     TO tenant_rw;
GRANT SELECT, INSERT ON tenant.run_refused_item          TO tenant_rw;
GRANT SELECT, INSERT ON tenant.run_ambiguity             TO tenant_rw;
GRANT SELECT, INSERT ON tenant.run_ambiguity_ref         TO tenant_rw;
GRANT SELECT, INSERT ON tenant.run_search_boundary_entry TO tenant_rw;
GRANT SELECT, INSERT ON tenant.run_postcondition         TO tenant_rw;
GRANT SELECT, INSERT ON tenant.run_completeness          TO tenant_rw;
GRANT SELECT, INSERT ON tenant.run_meter_fact            TO tenant_rw;
GRANT SELECT, INSERT ON tenant.run_residue               TO tenant_rw;
GRANT SELECT, INSERT ON tenant.run_held_read             TO tenant_rw;

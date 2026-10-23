-- =====================================================================
-- 0180 — THE DOCUMENT TYPE GETS A TABLE, AND WHAT A FILE SAID ABOUT
--        ITSELF GETS THREE ARMS RATHER THAN A NULL.
--        G1401, G1402, G1403, G1404, G1405. 21 Sep 2026.
--
-- 🛑 R11 IS **THE OWNER'S RULING OF 21 Sep 2026** AND NOT A DERIVED ONE, WHICH
--    IS SAID HERE BECAUSE MOST RULINGS IN THIS DIRECTORY SINCE G190 HAVE BEEN
--    DERIVED AND SAY SO ON THEIR OWN FACES (G356, G511, G941, G961, G1091):
--
--        "`DocumentType` gets its own tenant table, one row per document
--         type."
--
--    G1401 applies it. **G1402–G1405 ARE DERIVED, NOT THE OWNER'S**, and each
--    says so where it is spent.
--
-- ---------------------------------------------------------------------
-- THE GAP THIS CLOSES, DERIVED RATHER THAN ASSERTED. Run all three against
-- the commit before this one:
--
--     grep -rn 'CREATE TABLE tenant.document_type' db/          → nothing
--     grep -rln 'carries_control_total' db/migrations/
--       → db/migrations/0160_definition_engine_spec.sql   (ONE file, and it
--         is the DEFINITION's table, not the document type's)
--     awk '/^export interface DocumentType extends TenantScoped/,/^}/' \
--       model/domain.ts | grep -cE '^  [a-zA-Z]+:'         → 7 fields
--
-- **`DocumentType` HAS NO TABLE ANYWHERE.** Seven declared fields and not one
-- column, while `tenant.document_field_spec` (`0012` §5) and
-- `tenant.source_document` (`0012` §3) both key on `document_type_id` — two
-- tables pointing at a row that does not exist.
--
-- 🛑 AND THE CONSEQUENCE IS INVARIANT 4 FAILING ONE LEVEL UP, WHICH IS WHY
--    THIS IS A RULING AND NOT A CONVENIENCE. Copy the invariant, never
--    paraphrase it: *"**Classification is declared once**, on `FieldSpec`, and
--    everything derives from it."* `carriesControlTotal` is a declaration of
--    exactly that kind — *what this class of document is supposed to be* — and
--    `0160` stores it on `tenant.definition_population`, once PER DEFINITION
--    POPULATION. `model/reconciliation.ts` names that as a stopgap in its own
--    voice at the field it stores:
--
--        "⚠️ IT IS A STOPGAP AT THIS GRAIN AND SAYS SO. The declaration belongs
--         on `DocumentType`, which is where it is written (`model/domain.ts`);
--         `SetReconciliationInput` carries no `DocumentType`, so the binding
--         carries the value beside the model type until DP-2 folds it in. Two
--         spellings of one declaration is a drift risk, which is why this
--         comment names the owner."
--
--    **TWO DEFINITIONS READING THE SAME DOCUMENT TYPE CAN DISAGREE ABOUT ITS
--    FIDELITY AND ABOUT WHETHER IT CARRIES A TRAILER**, and nothing in the
--    schema could have noticed. That is a declaration with two homes and no
--    owner — the shape invariant 4 exists to forbid.
--
-- ⚠️ **AND THIS FILE DOES NOT CLOSE THE DRIFT, IT ONLY GIVES THE DECLARATION A
--    HOME. SAID HERE RATHER THAN LEFT TO BE DISCOVERED**, because a reader who
--    stops at the ruling will believe otherwise. `0160`'s column is NOT
--    dropped — G88 makes this directory forward-only and
--    `PopulationBinding.carriesControlTotal` is still a REQUIRED field of
--    `SetReconciliationInput`, so dropping it would be a model change (DP-2)
--    rather than a migration. **After this file there are TWO columns spelling
--    one declaration**, and the obligation moves to whoever assembles a
--    `PopulationBinding` (E4): it must read the DOCUMENT TYPE and pass the
--    value through, never read the definition's copy. §8 of
--    `tests/db/document-type-and-control-total.test.ts` pins the TWO at an
--    assertion the commit that folds them must delete on purpose — G1062's
--    shape, one directory over.
--
-- ---------------------------------------------------------------------
-- 🛑 THE REJECTED ALTERNATIVE, PRESERVED, BECAUSE A REJECTED OPTION PRESERVED
--    IS THE ONLY THING THAT STOPS THE NEXT READER RE-TAKING IT.
--
-- **LEAVE IT ON THE DEFINITION AND CALL THE DISAGREEMENT A VALIDATION.** It is
-- refused on the ground the engine itself already states:
-- `model/reconciliation.ts` declares
-- `control_total_arm_disagrees_with_document_type` as a `report`-grade defect,
-- so a disagreement between the TYPE and the PARSER is already a first-class
-- finding — and a disagreement between two DEFINITIONS about the same type is
-- not expressible as a finding at all, because no single run sees both. **A
-- check that cannot be reached from any run is not a check.**
--
-- ⚠️ **THE OTHER REJECTED OPTION, ALSO PRESERVED: a `jsonb` type descriptor.**
-- Refused on `0160`'s own ground, which is `0007`'s: *"a JSONB key with no
-- `FieldSpec` is UNREADABLE"*, and *"a result nobody may read is not
-- persistence"*. Same trap, one table over.
--
-- 🛑 **COST ACCEPTED AND NAMED: A MIGRATION PER NEW DECLARED PROPERTY OF A
--    DOCUMENT TYPE, FORWARD-ONLY UNDER G88.** `0007` accepted the identical
--    cost (*"a migration per new channel"*) and `0160` accepted it again
--    (*"a migration per new engine knob"*). This file accepts it rather than
--    discovering it.
--
-- ---------------------------------------------------------------------
-- RULINGS THIS APPLIES, identically to 0001–0161:
--   G97   every branded id is `text`; the slug is stored VERBATIM. No uuid.
--   G100  the policy DENIES on NULL. A forgotten transaction yields an EMPTY
--         result set, never another tenant's rows.
--   G101  transaction-mode pooling assumed; `SET LOCAL` inside an explicit
--         transaction, issued only by the scoped helpers.
--   G88   forward-only EXPAND. Two `CREATE TABLE`s and nothing else; `0012`
--         and `0160` are NOT edited by this file, and each keeps its own
--         refusal on its own face — `0017`'s precedent.
--   G286  money is `int8` minor units, never `numeric`, and `model/money.ts`
--         is the only codec that may convert one. `0015`'s three columns —
--         currency · minor · exponent — carried across.
--   G411  a `CHECK` that evaluates to `NULL` PASSES, so `NOT NULL` on a
--         discriminant is HALF of every constraint keyed on it. Both `CHECK`s
--         in §2 are total for that reason and §4a of the suite witnesses it.
-- =====================================================================


-- =====================================================================
-- §1  THE DOCUMENT TYPE — R11, G1401
--
-- Seven declared fields, SIX columns and one child table. `DocumentType.fields`
-- is `FieldSpec[]` and it already has a home: `tenant.document_field_spec`
-- (`0012` §5), keyed on `document_type_id`. This file declares no second one —
-- *"two spellings of one declaration is a drift risk"* applies to a field list
-- exactly as it applies to a flag.
--
-- ⚠️ **NO FOREIGN KEY FROM `tenant.document_field_spec` TO THIS TABLE, AND THE
--    ABSENCE IS DELIBERATE RATHER THAN FORGOTTEN.** A concurrent slice (E1) is
--    adding `data_type` to that table under its own migration block, and a
--    constraint added here would be this file editing a table another slice
--    holds open — which is exactly how two agents came to number a migration
--    `0011` each. Named so the commit that adds it meets this sentence.
--
-- 🛑 **AND NO FOREIGN KEY FROM `tenant.source_document` EITHER, FOR A REASON
--    THAT IS MEASURED AND IS NOT TIDINESS: IT WOULD BREAK THE ONE INGESTION
--    PATH THAT WORKS.** `server/data-plane/payload-store.ts`'s
--    `admitAndStoreArrival()` inserts a `source_document` row carrying a
--    `document_type_id` on every admitted arrival, and NOTHING CAN WRITE A ROW
--    HERE — see §4. So an FK would make every ingestion fail with
--    `violates foreign key constraint` from the commit that added it,
--    permanently, until a writer exists. **A referential guarantee whose only
--    effect today is to refuse the product's live path is not a guarantee.**
--    It is OWED, in the same commit as the writer, and is named here so that
--    commit does not have to rediscover it. §7 of the suite asserts the
--    absence in both directions, so adding one is a deliberate act.
--
-- ⚠️ NO `CHECK` ON ANY VOCABULARY COLUMN — `0007`'s decision, `0069`'s
--    restatement and `0160`'s. Three columns here are closed vocabularies in
--    `model/domain.ts` — `domain` (`DomainKey`), `expected_fidelity`
--    (`AcquisitionFidelity`) and `carries_control_total` (`'always' | 'never'`)
--    — and not one of them carries a `CHECK`. A `CHECK` naming the four
--    `AcquisitionFidelity` members literally is a THIRD copy of a list
--    `model/domain.ts` already holds and nothing compares; **and the polarity
--    is the deciding half**, because an unknown value must reach the reader as
--    a refusal BY COLUMN (`server/data-plane/document-type-store.ts` answers
--    `{ kind: 'unreadable', defect: { column } }`) rather than be rejected at
--    write time by a list somebody forgot to extend. §6 of the suite asserts
--    the absence, so a later `CHECK` is a red gate rather than a thing a
--    reviewer might miss.
--
-- ⚠️ `carries_control_total` IS `text` AND NOT `boolean`, WHICH LOOKS LIKE
--    WASTE AND IS THE MODEL'S OWN DECISION RESTATED IN SQL.
--    `model/reconciliation.ts` argues it at the sibling field: *"NOT A
--    BOOLEAN, for the same reason `carriesControlTotal` is not: the literal
--    union reads at the call site, and a third posture is addable without
--    inverting the meaning of a flag."* A `boolean` column would make a third
--    posture a schema change AND an inversion.
-- =====================================================================

CREATE TABLE tenant.document_type (
  tenant_id             text NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id                    text NOT NULL,

  -- The pack-stable name. `DocumentTypeTemplate = Omit<DocumentType, 'id' |
  -- 'tenantId'>` is what a pack publishes, so `key` is the thing that survives
  -- an install and `id` is minted per tenant — `InstalledPack
  -- .mintedDocumentTypeIds` is the read-back of exactly that act, and the
  -- contract states the rule: *"A pack may not point at tenant rows;
  -- installing mints."*
  --
  -- ⚠️ NO `UNIQUE (tenant_id, key)`, AND IT IS A REFUSAL RATHER THAN AN
  --    OMISSION. Nothing in `model/`, in `server/` or on any of the seven
  --    contract tiers looks a document type up BY KEY — derive it:
  --    `grep -rn "documentTypeKey\|documentType\.key" model/ server/` returns
  --    nothing — so a uniqueness constraint would be a guarantee with no
  --    reader, which is `0004`'s refusal wearing an index. And two packs
  --    publishing the same `key` into one tenant is a case nobody has ruled
  --    on; a constraint taken here would take that ruling by refusing the
  --    second install, quietly. The reader addresses by `id`.
  key                   text NOT NULL,

  -- Ours, not a counterparty's: a pack's own label for the type. It is the
  -- only free text in this file and it is rendered, never parsed.
  label                 text NOT NULL,

  -- `DomainKey`. Vocabulary; no `CHECK`.
  domain                text NOT NULL,

  -- `AcquisitionFidelity` — 'structured' | 'tabular' | 'digital_text' |
  -- 'scanned'. **THE FIELD AN EXTRACTION SEAM READS RATHER THAN INVENTS.**
  -- `server/data-plane/definition-store.ts` §0 records the reason the engine
  -- has no documents at all: *"a converter written here would be INVENTING A
  -- FIDELITY AND A CONFIDENCE for every value in the product, and `PRODUCT.md`
  -- forbids inventing a figure."* Fidelity is not per-value and never was —
  -- it is declared here, on the type, and read. Vocabulary; no `CHECK`.
  expected_fidelity     text NOT NULL,

  -- `'always' | 'never'`. C18's SECOND VOICE. `model/domain.ts` argues it:
  -- *"THE PARSER MAY NOT BE THE ONLY VOICE HERE … a parser reporting
  -- `not_declared_by_format` for a type declared `always` is itself a defect —
  -- which is the whole difference between a control and a control the checked
  -- component can turn off."* Vocabulary; no `CHECK`.
  carries_control_total text NOT NULL,

  PRIMARY KEY (tenant_id, id)
);


-- =====================================================================
-- §2  WHAT THE FILE SAID ABOUT ITSELF — C18's THREE ARMS, G1402.
--     **DERIVED, NOT THE OWNER'S.** R11 rules where `DocumentType` lives; how
--     a `ControlTotal` is stored is this file's to argue.
--
-- 🛑 THE THREE STATES ARE GENUINELY DISTINCT AND COLLAPSING ANY TWO IS THE
--    DEFECT. `model/domain.ts` states it at the union and this table is that
--    paragraph in SQL:
--
--        "THE THREE ARMS EXIST BECAUSE A NULLABLE FIELD CANNOT SAY THIS. The
--         obvious shape is `expectedLineCount: number | null` plus
--         `declaredControlTotal: Money | null`, and its null is AMBIGUOUS in
--         the one way that matters: it cannot distinguish 'this format has no
--         trailer' from 'the trailer should have been there and was not'. The
--         second is a truncated or tampered file, and a null that reads as
--         'unchecked' is scope failing OPEN."
--
--    · `declared`               the parser found a trailer.
--    · `expected_but_absent`    the format declares one and it was NOT there.
--                               **A REFUSAL, NEVER A ZERO** — a truncated file
--                               presents exactly like this.
--    · `not_declared_by_format` this format carries no trailer at all.
--
-- 🛑 **HOW THE THIRD IS MADE UNREPRESENTABLE AS THE SECOND, AND IT IS THE
--    WHOLE POINT OF THE COLUMN LAYOUT: THE DISCRIMINANT IS ITS OWN `NOT NULL`
--    COLUMN AND THE PAYLOAD IS NEVER THE DISCRIMINANT.** `kind` is `NOT NULL`,
--    so arms two and three are two DIFFERENT VALUES rather than two readings
--    of one absence. The four payload columns are NULL in BOTH of them and
--    carry no meaning in either — which is exactly the property the obvious
--    shape lacks. **There is no state in this table in which the nullness of a
--    payload column is what tells the arms apart.**
--
-- ⚠️ **AND THERE IS A FOURTH STATE THIS TABLE CANNOT HOLD AND MUST NOT
--    DEFAULT: NO ROW AT ALL** — a document nothing has extracted yet.
--    `SourceDocument.controlTotal` is *"Required and NON-OPTIONAL"* in the
--    model, so a missing row is not a `ControlTotal` and there is no arm it
--    may be read as. **Reading an absent row as `not_declared_by_format` would
--    switch C18 off for every document in the product, silently, on a green
--    gate** — the §5.1 shape `model/reconciliation.ts` names at
--    `PopulationBinding.carriesControlTotal`. SQL cannot forbid it: the FK
--    points from here to the document, and a `NOT NULL` FK the other way would
--    require a control total to exist before the document that has not been
--    extracted yet, which breaks `admitAndStoreArrival()` at the first
--    arrival. **So the fourth state is refused IN THE READER, BY NAME**:
--    `readDocumentControlTotal()` answers
--    `{ kind: 'unreadable', defect: { table: 'document_control_total',
--    column: 'kind' } }`, and §3c of the suite is the witness.
--
-- ⚠️ SEPARATE TABLE RATHER THAN COLUMNS ON `tenant.source_document`, AND THE
--    REASON IS A PRIVILEGE RATHER THAN TIDINESS. `0012` grants
--    `SELECT, INSERT` on `source_document` and that row is written at ADMISSION
--    — before any extractor has seen the bytes. Columns there would therefore
--    need `GRANT UPDATE` when a writer arrives, and **a path that could UPDATE
--    a control total could rewrite what the file said about itself after the
--    fact**, which is evidence tampering on the one check that catches a
--    truncated file. A separate table takes `SELECT, INSERT` when its writer
--    lands and no `UPDATE` ever — `0010`'s append-only-as-a-PRIVILEGE — so a
--    trailer, once recorded, is not amendable by any request path. It is
--    `0012` §4's own argument for splitting the payload off the document row,
--    reached from the privilege side instead of the erasure side.
--
-- 🛑 BOTH `CHECK`s BELOW ARE TOTAL AND THAT IS G411 RATHER THAN CARE. *"A
--    `CHECK` that evaluates to `NULL` PASSES"*, so `false OR NULL` admits the
--    row the constraint forbids. `kind` is `NOT NULL`, so `kind = 'declared'`
--    is never NULL; every other term is an `IS NULL` test, which is never
--    NULL. §4a witnesses both arms against a real PostgreSQL rather than
--    reasoning about them.
-- =====================================================================

CREATE TABLE tenant.document_control_total (
  tenant_id            text NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  source_document_id   text NOT NULL,

  -- THE DISCRIMINANT, and the only thing that distinguishes the three arms.
  -- `ControlTotal['kind']`. Vocabulary; **no `CHECK`**, deliberately: an
  -- unknown arm must reach the reader as `unreadable` BY COLUMN rather than be
  -- rejected at write time by a list somebody forgot to extend. §4b is the
  -- witness and §6 asserts the absence of the `CHECK`.
  kind                 text NOT NULL,

  -- THE `declared` ARM'S PAYLOAD AND NOTHING ELSE'S.
  --
  -- ⚠️ BOTH MAY BE NULL INSIDE THAT ARM, AND THAT NULL IS NOT THE AMBIGUOUS
  --    ONE. `model/domain.ts`: *"inside THIS arm a null means 'the trailer
  --    declared this one and not that one', which cannot be read as
  --    'unchecked' because the arm itself is the assertion that a trailer was
  --    found. A trailer declaring NEITHER is a defect, not a silent pass."*
  --    That defect is the ENGINE's — `control_total_declared_nothing` — and
  --    not a constraint here, because it is a finding an operator reads rather
  --    than a row the database refuses.
  line_count           integer,

  -- `Money`, G65's three columns as `0015` writes them. `int8` minor units
  -- under G286, never `numeric`; `model/money.ts` is the only codec permitted
  -- to convert one, and this table stores what that codec produced.
  total_currency       text,
  total_minor          int8,
  total_exponent       integer,

  PRIMARY KEY (tenant_id, source_document_id),
  FOREIGN KEY (tenant_id, source_document_id)
    REFERENCES tenant.source_document (tenant_id, id) ON DELETE CASCADE,

  -- STRUCTURAL, NOT VOCABULARY, AND THE DIFFERENCE IS WHAT KEEPS THE POLARITY
  -- ABOVE INTACT. This does not say which values `kind` may take — an unknown
  -- arm still stores and is still refused by the reader. It says the payload
  -- columns belong to ONE arm, so `not_declared_by_format` carrying a total is
  -- unrepresentable rather than merely unexpected.
  --
  -- ⚠️ IT IS `0012` §6's `CHECK (location_kind IN ('source_document'))` ONE
  --    TABLE OVER AND DELIBERATELY WEAKER — G322 admits ONE of eleven variants
  --    and REJECTS the other ten at write time. This admits every arm and
  --    constrains only the payload, because `0069`'s polarity landed after
  --    G322 and a rejected-at-write-time vocabulary is the thing it refuses.
  --    The departure is named so it does not read as an oversight.
  CONSTRAINT document_control_total_payload_is_declared_only CHECK (
    kind = 'declared'
    OR (line_count         IS NULL
        AND total_currency IS NULL
        AND total_minor    IS NULL
        AND total_exponent IS NULL)
  ),

  -- `0015`'s rule for every stored `Money`, verbatim in substance: *"a currency
  -- with no amount is a `Money` nobody can read"*. Three columns or none.
  CONSTRAINT document_control_total_money_is_whole CHECK (
    (total_currency IS NULL AND total_minor IS NULL AND total_exponent IS NULL)
    OR (total_currency IS NOT NULL AND total_minor IS NOT NULL AND total_exponent IS NOT NULL)
  )
);


-- =====================================================================
-- §3  ROW LEVEL SECURITY — G1403. **DERIVED, NOT THE OWNER'S.**
--
-- `ENABLE` **and** `FORCE`, both, on both tables. `ENABLE` alone leaves the
-- TABLE OWNER exempt and the owner is `reconcile_owner`, which is where every
-- one of these relations lands.
--
-- `0001`'s predicate VERBATIM — copied, not retyped — on `USING` **and** on
-- `WITH CHECK`. §5 of the suite reads both back out of `pg_policies` and
-- requires them byte-identical to the sibling policies this file did not
-- touch, which is `0020`'s control for the same class of mistake.
--
-- ⚠️ `WITH CHECK` IS STATED THOUGH NO REQUEST PATH TAKES A WRITE ON EITHER
--    TABLE, which is `0150`'s reason in `0150`'s words: the tables that do not
--    take a write carry it anyway, *"so a later `GRANT INSERT` cannot arrive
--    without the write predicate already in place."*
--
-- ⚠️ AND `tests/db/rls-census.test.ts` ENUMERATES SCHEMA `tenant` AND REQUIRES
--    `relrowsecurity AND relforcerowsecurity` OF EVERY RELATION, so a table
--    here that forgot either is a RED GATE rather than a thing a reviewer
--    might miss. That census is the reason this block is four lines and not an
--    argument.
-- =====================================================================

ALTER TABLE tenant.document_type          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.document_type          FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.document_control_total ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.document_control_total FORCE  ROW LEVEL SECURITY;

CREATE POLICY document_type_rls ON tenant.document_type
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY document_control_total_rls ON tenant.document_control_total
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- =====================================================================
-- §4  GRANTS — G1404. **DERIVED, NOT THE OWNER'S**, and this is the decision
--     in the file after the column layout.
--
-- By name, because `0003` deliberately declines `ALTER DEFAULT PRIVILEGES` on
-- this schema: *"A future table created here is unreachable by the app until
-- granted BY NAME … default privileges would silently hand the request path a
-- table nobody decided to expose."*
--
-- 🛑 `SELECT` AND NOTHING ELSE ON BOTH, AND **THE WRITER IS OWED.** The
--    question `0069` asks of every table it declares, asked here:
--
--    **WHAT COULD A REQUEST PATH THAT COULD WRITE `tenant.document_type` DO?**
--    It could set `carries_control_total = 'never'` on a type whose files
--    carry a trailer, **and C18 would then be off for that type with every
--    gate green** — which is precisely the harm `model/domain.ts` declares the
--    field to prevent: *"a control the checked component can turn off."* It
--    could also set `expected_fidelity = 'structured'` on a scanned type,
--    which selects a parse path for an image. Both are the reconciled party
--    editing the terms of their own reconciliation.
--
--    **AND `tenant.document_control_total`?** It could write
--    `not_declared_by_format` for a truncated file, and the trailer check
--    would then pass by never being attempted. `expected_but_absent` is the
--    arm that catches a tampered file; **a caller who may choose the arm is a
--    caller who may choose not to be caught.**
--
-- 🛑 IS A CALLER WRITING EITHER THE PRODUCT'S INTENT? MEASURED RATHER THAN
--    ASSUMED, AND THE ANSWER IS NO, WITH THE INTENDED WRITER NAMED:
--
--      · **No operation on any of the seven tiers authors a document type.**
--        Derive it, do not assume it:
--          grep -rn 'operationId' docs/contracts/*.openapi.yaml \
--            | grep -ciE 'documenttype|createdocument'          → 0
--        The only operations that MINT one are `installPack`
--        (`capability.openapi.yaml`) and `publishPackVersion`
--        (`platform-console.openapi.yaml`), and the contract states the rule
--        at `InstalledPack.mintedDocumentTypeIds`: *"A pack may not point at
--        tenant rows; installing mints."*
--      · **Both are DECLARED AND UNMOUNTED.** Derive it:
--          grep -rn 'installPack\|publishPackVersion' server/       → nothing
--        So the intended writer is **G110's publication seam** — unbuilt and
--        unstarted — with **G58's authoring surface** upstream of it. A
--        `GRANT INSERT` today is `0004`'s refusal exactly: *"a write privilege
--        ahead of its writer."*
--      · **The control total's writer is a different one and is also owed**:
--        the EXTRACTOR, which `0012` §3 already refused this column for —
--        *"`control_total` ABSENT. C18's `ControlTotal` is 'what the file said
--        about itself', read by an EXTRACTOR that does not exist here."*
--        **That sentence is still true at this commit** and is not corrected
--        by this file; what changes is that the column now exists for the
--        extractor to write, with a reader already reading it. E4 is that
--        writer, and it owes the `GRANT INSERT` in the same commit —
--        `0020`'s rule: *"the fence and the writer are one commit or
--        neither."*
--
-- ⚠️ THE COST OF SELECT-ONLY, STATED PLAINLY RATHER THAN LEFT TO BE FOUND:
--    every document type and every control total in this repository today is
--    written BY THE MIGRATOR, which is where `0008`'s governance lists,
--    `0012`'s `document_field_spec`, `0059`'s three reference tables,
--    `0069`'s three tables and `0150`'s bindings already are. They reach a
--    tenant by a seed or a fixture, and
--    `tests/db/document-type-and-control-total.test.ts` says so in its own
--    header rather than letting a green suite imply a product path that does
--    not exist.
-- =====================================================================

GRANT SELECT ON tenant.document_type          TO tenant_rw;
GRANT SELECT ON tenant.document_control_total TO tenant_rw;

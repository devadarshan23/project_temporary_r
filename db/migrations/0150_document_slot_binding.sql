-- =====================================================================
-- 0150 — THE BINDING. WHICH DOCUMENT OCCUPIES WHICH SLOT, OF WHICH
--        DEFINITION, FOR WHICH PERIOD. G961, G962, G963, G964.
--        20 Sep 2026. DERIVED, NOT THE OWNER'S.
--
-- 🛑 THIS FILE EXISTS TO GIVE ONE DECLARED FIELD A PRODUCER, AND THE FIELD HAS
--    HAD NONE SINCE IT WAS DECLARED ON 19 Sep 2026. THREE FILES CARRIED THE
--    SAME SENTENCE and each keeps its own copy, corrected on its own face;
--    derive the two that still shout it rather than taking this header's word:
--
--        grep -rln 'BINDS A .SourceDocument. TO A SLOT' model/ db/
--          → model/run-admission.ts · db/migrations/0069_run_admission.sql
--            · this file
--
--    The third is `server/data-plane/run-admission.ts`, which carried it in
--    lower case at the `fill: []` call site this slice replaces, and which
--    quotes its own old paragraph there rather than deleting it.
--
--    `model/run-admission.ts`, at `SlotFill` and again in its header:
--
--        "NOTHING BINDS A `SourceDocument` TO A SLOT ANYWHERE IN THIS
--         REPOSITORY. `db/migrations/0012`'s `source_document` carries an
--         arrival and a document type and no slot. So
--         `RunAdmissionSubstrate.fill` arrives EMPTY on every served request,
--         every `exactly_one` and `at_least_one` slot is unfilled, and a
--         definition declaring one is a refusal forever."
--
--    `db/migrations/0069_run_admission.sql` §2 says it again and names the
--    consequence: *"The reachable admitting case is therefore a definition all
--    of whose slots are `optional`, or one that declares none."*
--
--    **BOTH SENTENCES ARE TRUE AT THE COMMIT BEFORE THIS ONE, AND NEITHER IS
--    DELETED** — each keeps its own text under G88's forward-only posture, the
--    way `0017` keeps `0014`'s refusal on its face. What this file changes is
--    the tree they describe.
--
-- ---------------------------------------------------------------------
-- 🛑 A SECOND THING GOES FROM INERT TO LIVE HERE AND NO DOCUMENT NAMED IT.
--
--    `capability.openapi.yaml` says the idempotency key is computed *"from the
--    period, the definition and the slot-fill state — the fingerprint of
--    exactly which documents are sitting in which slots right now."* THREE
--    parts. With no producer for the third, `slotFillBasis([])` returned the
--    canonical form of `{}` on every request in this repository's history, so
--    `slotFillFingerprint` was A CONSTANT and the basis was two parts wearing
--    three. Measure it against the commit before this one:
--
--        node -e "import('./model/run-admission.ts').then(m => \
--          console.log(m.slotFillBasis([])))"        → { ok: true, basis: '{}' }
--
--    After this file the third part varies with the fill, which is what makes
--    *"a document landed, so this is a different run"* expressible at all.
--    `tests/http/slot-fill-served.test.ts` §4 is the witness, and it is an
--    assertion that could not have been written before this commit.
--
-- ---------------------------------------------------------------------
-- 🛑 WHAT THIS FILE IS NOT, FIRST, BECAUSE TWO OF THE THREE ARE THE REASON IT
--    IS FOUR COLUMNS RATHER THAN A FEATURE.
--
--   · **IT IS NOT A RUN EXECUTOR.** Nothing here reads a payload, evaluates a
--     rule or writes an exception. `admitRun` still ends at `status = 'queued'`
--     and `0069` §4's note stands unchanged: *"There is no executor."*
--   · **IT IS NOT AN INGESTION WRITER.** Which document belongs in which slot
--     is the INGESTION cascade's answer — `model/ingestion.ts` classifies an
--     arrival — and that cascade reaches this table through nothing, because
--     `createUpload` and `completeUpload` are declared and unmounted
--     (`grep -c 'aws-sdk' package.json` → 0, and `server/data-plane/start.ts`
--     refuses both by name). See the GRANTS block: the app role gets `SELECT`
--     and the writer is OWED.
--   · **IT IS NOT A DECISION ABOUT WHAT AN OPERATOR MAY BIND.** No contract
--     operation binds a document to a slot, on any of the seven tiers. Derive
--     it:
--
--         grep -rn 'operationId' docs/contracts/*.openapi.yaml | grep -ci slot
--           → 0
--
-- ---------------------------------------------------------------------
-- RULINGS THIS APPLIES, identically to 0001–0091:
--   G97   every branded id is `text`; the slug is stored VERBATIM. No uuid.
--   G100  the policy DENIES on NULL. A forgotten transaction yields an EMPTY
--         result set, never another tenant's rows.
--   G101  transaction-mode pooling assumed; `SET LOCAL` inside an explicit
--         transaction, issued only by the scoped helpers.
--   G88   forward-only. Nothing here edits another migration — no
--         `ALTER POLICY`, no `DROP`, and the only `ALTER TABLE` is this file's
--         own `ENABLE`/`FORCE` pair.
--
-- 🛑 THE TABLE IS SCHEMA-QUALIFIED `tenant.`, WHICH `0003_tenant_schema.sql`
--    MADE MANDATORY FROM 0004 ON.
-- =====================================================================


-- =====================================================================
-- §1  THE BINDING — G961
--
-- FOUR COLUMNS AND NOT ONE MORE. Every absence is `0004_subject_ledger.sql`'s
-- rule: a column ahead of its reader *"would have been filled later by whoever
-- built the writer, with whatever they had to hand."*
--
--   `bound_at`      ABSENT. Nothing reads a binding's age. Admission asks WHICH
--                   documents occupy the slot right now and asks nothing about
--                   when they got there; `source_document.ingested_at` already
--                   carries the artefact's own clock, one table over.
--   `bound_by`      ABSENT, AND IT IS THE ONE THAT WILL LOOK LIKE AN OVERSIGHT.
--                   There is no writer on any request path (see GRANTS), so
--                   there is no principal to attribute. `0012`'s `arrival`
--                   records an `authorization_id` precisely because ITS writer
--                   exists; attribution for an act nobody performs is a column
--                   the first person with a value to hand would fill.
--   `id`            ABSENT. Nothing names a binding: the reader selects by
--                   `(definition_id, period_id)` and the model keys the fill by
--                   `SlotName`. A surrogate key here would exist to satisfy a
--                   constraint rather than a reader — §3.
--   `role`          ABSENT. `SourceSlot.role` — `'reference' | 'comparand'` —
--                   is a property of the SLOT, and `0069` §2 already refuses it
--                   there because no rule is evaluated on this path. A copy
--                   here would be a second home for one fact.
--   `superseded_at` ABSENT. Unbinding is a DELETE and nothing on a request path
--                   holds one. `0010`'s note is the precedent: *"a revocation is
--                   a NEW ROW superseding an old one"* is a decision somebody
--                   must take, not a column to reserve in advance.
-- =====================================================================

CREATE TABLE tenant.document_slot_binding (
  tenant_id          text NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,

  -- The definition whose slot this is — NOT a run's. A run pins the documents
  -- it consumed in `run.inputs` at admission; this table is the state that
  -- admission READ, and the two are deliberately not the same row.
  definition_id      text NOT NULL,

  -- `SlotName`, stored verbatim (G97), and the key of
  -- `ReconciliationRun.inputs: Record<SlotName, SourceDocumentId[]>`.
  slot               text NOT NULL,

  -- `ReconciliationPeriodId`, or NULL. **THE NULL IS A VALUE AND NOT A
  -- WILDCARD** — §2 argues it, and the reader's `IS NOT DISTINCT FROM` is the
  -- half that makes the argument true rather than merely stated.
  period_id          text,

  -- `SourceDocumentId`. The document that occupies the slot.
  source_document_id text NOT NULL,

  -- =================================================================
  -- §2  THE NULL PERIOD IS THE UNPERIODISED FILL, AND IT IS NOT A WILDCARD —
  --     G962.
  --
  -- `admitRun`'s body makes `periodId` optional and nullable — *"all three of
  -- absent, `null` and a string are legal and the first two mean the same thing
  -- here"* — so the fill is a function of a PAIR, `(definition, period)`, and
  -- `null` is a member of that pair's second position exactly as it is of
  -- `Run.periodId`. A binding whose `period_id` is NULL belongs to the
  -- unperiodised run and to nothing else.
  --
  -- 🛑 THE WILDCARD READING IS REFUSED BY NAME, because it is the cheap one and
  --    it deletes the control this table exists to feed. If NULL meant *"any
  --    period"*, one binding would satisfy a required slot for EVERY period —
  --    including one reopened six months later against a different calendar —
  --    and `slot_fill_incomplete` would stop being a statement about THIS
  --    period. `0069` §3 spends its whole header arguing that a run must be
  --    attributable to the accounting period it was admitted against; a
  --    wildcard fill hands back the other half of that.
  --
  -- ⚠️ THE COST IS NAMED: a definition run both with and without a period needs
  --    TWO rows for the same document, and nothing dedupes them. That is the
  --    honest consequence of the null being a value. The alternative —
  --    `period_id NOT NULL` — is a PRODUCT decision rather than a schema one,
  --    because it would make a definition with a required slot unrunnable
  --    without naming a period, which is a constraint the contract does not
  --    state and this file has no standing to invent.
  -- =================================================================

  -- =================================================================
  -- §3  UNIQUENESS WITHOUT A PRIMARY KEY — G962, second half.
  --
  -- 🛑 THERE IS NO `PRIMARY KEY` ON THIS TABLE AND THE ABSENCE IS FORCED. Every
  --    column of a PRIMARY KEY is `NOT NULL` by definition, and §2 makes
  --    `period_id`'s null a VALUE. The three ways out, and why two are refused:
  --
  --      (a) a surrogate `id` — §1 refuses it: nothing names a binding, so the
  --          column would exist to satisfy a constraint rather than a reader.
  --      (b) `UNIQUE NULLS NOT DISTINCT` — **NOT AVAILABLE.** It is PostgreSQL
  --          15, and the disposable local database this suite runs against is
  --          14.18. A schema that silently requires a major version nobody has
  --          ruled on is a deployment decision taken inside a migration, and a
  --          contributor's `npm run check` would stop proving anything about
  --          `db/` on the machine `db/env.ts` is written for.
  --      (c) TWO PARTIAL UNIQUE INDEXES — this. One over four columns for the
  --          periodised arm, one over three for the null arm. Between them they
  --          are TOTAL over the rows this table can hold, because `period_id`
  --          is either NULL or it is not.
  --
  -- 🛑 AND UNIQUENESS IS LOAD-BEARING RATHER THAN TIDY, WHICH IS WHY IT IS A
  --    CONSTRAINT AND NOT A `SELECT DISTINCT`. `slotFillBasis()` sorts each
  --    slot's document list and canonicalises it; **it does not dedupe.** So the
  --    same document bound twice into one slot yields a DIFFERENT basis from the
  --    same document bound once — a different idempotency key, and a second run
  --    over inputs that are identical. **The race `admitRun` is named for would
  --    be lost to a duplicate row.** A `DISTINCT` in the reader would be a reader
  --    compensating for what storage allows, which is the shape `0039`'s reader
  --    note refuses one table over.
  -- =================================================================

  -- =================================================================
  -- §4  THE FOREIGN KEYS — G963. THREE, AND EACH BUYS A REFUSAL THE MODEL
  --     THEREFORE DOES NOT NEED AN ARM FOR.
  --
  -- `0002_run.sql`'s reason first: *"a cross-tenant reference has to be
  -- unrepresentable rather than merely unlikely."* Then `0069` §2's second
  -- reason, which is the one that does the work here: a reference that cannot
  -- be written is a refusal the cascade never has to carry.
  --
  --   → `definition_slot`  A binding to a slot the definition does not DECLARE
  --                        is UNWRITABLE. Without it `model/run-admission.ts`
  --                        would need a `slot_not_declared` arm — and worse, the
  --                        fill could carry slot names the definition never
  --                        heard of, which the model silently ignores because it
  --                        iterates DECLARATIONS. A binding that is accepted and
  --                        then ignored is the worst of those three outcomes.
  --   → `reconciliation_period`  A binding to a period nobody opened is
  --                        UNWRITABLE. ⚠️ **AND THE NULL ARM IS UNCONSTRAINED BY
  --                        CONSTRUCTION, WHICH IS DELIBERATE AND IS `0039`'s
  --                        MEASURED PROPERTY:** under MATCH SIMPLE a composite
  --                        foreign key with any NULL referencing column is
  --                        SATISFIED WITHOUT A LOOKUP. So the periodised arm is
  --                        checked and the unperiodised arm has nothing to
  --                        check — §2's semantics expressed as a constraint
  --                        rather than as a comment.
  --   → `source_document`  A binding naming a document that does not exist is
  --                        UNWRITABLE, so the reader needs no `document_absent`
  --                        arm and `RunAdmissionRefusal` does not grow a tenth.
  --
  -- ⚠️ ALL THREE CASCADE ON DELETE AND THAT IS NOT `0022`'s G473 CASE. G473
  --    refused a foreign key to `tenant.exception` because *"a retention sweep
  --    must not erase the record of what we told a vendor about."* A binding is
  --    not a record of an act: the record of which documents a run actually
  --    consumed is `run.inputs`, pinned at admission and never read back from
  --    here. Erasing a document SHOULD erase the statement that it occupies a
  --    slot.
  -- =================================================================

  FOREIGN KEY (tenant_id, definition_id, slot)
    REFERENCES tenant.definition_slot (tenant_id, definition_id, slot) ON DELETE CASCADE,

  FOREIGN KEY (tenant_id, period_id)
    REFERENCES tenant.reconciliation_period (tenant_id, id) ON DELETE CASCADE,

  FOREIGN KEY (tenant_id, source_document_id)
    REFERENCES tenant.source_document (tenant_id, id) ON DELETE CASCADE
);

-- §3's two halves.
CREATE UNIQUE INDEX document_slot_binding_periodised
  ON tenant.document_slot_binding (tenant_id, definition_id, slot, period_id, source_document_id)
  WHERE period_id IS NOT NULL;

CREATE UNIQUE INDEX document_slot_binding_unperiodised
  ON tenant.document_slot_binding (tenant_id, definition_id, slot, source_document_id)
  WHERE period_id IS NULL;


-- =====================================================================
-- ROW LEVEL SECURITY — G100's deny-on-NULL, written as the predicate rather
-- than described. `0001`'s predicate VERBATIM, on `USING` **and** on
-- `WITH CHECK`.
--
-- 🛑 THE PREDICATE IS COPIED OUT OF `db/migrations/0001_tenancy_and_rls.sql`
--    AND NOT RETYPED FROM MEMORY. That is the one claim in this file a reader
--    cannot check by reading this file, so it is checked from the CATALOGUE
--    instead: `tests/db/document-slot-binding.test.ts` §5 reads `qual` and
--    `with_check` back out of `pg_policies` and byte-compares them against the
--    sibling policies this migration did not touch. A near-miss parses cleanly
--    — `0020` records exactly that near-miss — so a comparison against a
--    policy nobody edited is the only form of this check that bites.
--
-- `ENABLE` **and** `FORCE`. `ENABLE` alone leaves the TABLE OWNER exempt, and
-- `0001` states the consequence: *"a test that connects as the owner then
-- passes with the policy doing nothing, and passes just as well with the policy
-- dropped."*
--
-- ⚠️ `WITH CHECK` IS STATED THOUGH NO REQUEST PATH TAKES A WRITE HERE, which is
--    `0012`'s posture and `0069`'s after it: *"the two that do not take one
--    carry it anyway, so a later `GRANT INSERT` cannot arrive without the write
--    half already in place."*
-- =====================================================================

ALTER TABLE tenant.document_slot_binding ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.document_slot_binding FORCE  ROW LEVEL SECURITY;

CREATE POLICY document_slot_binding_rls ON tenant.document_slot_binding
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- =====================================================================
-- GRANTS — G964, AND THIS IS THE DECISION IN THE FILE.
--
-- By name, because `0003` deliberately declines `ALTER DEFAULT PRIVILEGES` on
-- this schema: *"A future table created here is unreachable by the app until
-- granted BY NAME … default privileges would silently hand the request path a
-- table nobody decided to expose."*
--
-- 🛑 THE QUESTION `0069` ASKS OF EVERY TABLE IT DECLARES, ASKED HERE: **WHAT
--    COULD A REQUEST PATH THAT COULD WRITE THIS TABLE DO?**
--
--    It could bind a document of its own choosing into a required slot and then
--    admit a run in the next request. That makes `slot_fill_incomplete` **A
--    REFUSAL THE CALLER CONTROLS**, which is `0069`'s own sentence arriving
--    from the other side: that file refuses `DELETE` on `definition_slot`
--    because *"a path that could DELETE a slot row could turn a
--    `slot_fill_incomplete` refusal into an admission by removing the
--    requirement rather than satisfying it"* — and an `INSERT` here satisfies
--    the requirement with a document the caller picked rather than the one
--    intake delivered. Same refusal, opposite door.
--
--    🛑 AND THE SECOND HALF IS WORSE THAN THE FIRST, BECAUSE NOTHING
--       DOWNSTREAM COULD RECOVER FROM IT. `run.inputs` is *"Document ids per
--       slot, pinned at admission"* — the operand set a run engine will read.
--       **A caller who chooses the operands chooses the answer.** A
--       reconciliation whose inputs the reconciled party selected is not an
--       assurance, and the gate, the policy and invariant 10's record would all
--       record that act as perfectly correct, because it is: the caller was
--       permitted to do the thing they did.
--
-- 🛑 IS A CALLER CHOOSING THE BINDING THE PRODUCT'S INTENT? MEASURED RATHER
--    THAN ASSUMED, AND THE ANSWER IS NO ON THREE COUNTS:
--
--      · **No operation declares it.** Seven contract documents, 136
--        operations, and not one binds a document to a slot:
--        `grep -rn 'operationId' docs/contracts/*.openapi.yaml | grep -ci slot`
--        → 0. There is no request body, no capability and no 422 for this act
--        anywhere in the corpus.
--      · **The model already says whose answer it is.** `SourceSlot` is part of
--        `ArchetypeConfig`, which reaches a tenant by PACK PUBLICATION
--        (`0069` §1), and WHICH document lands in it is the INGESTION cascade's
--        verdict — `model/ingestion.ts` classifies an arrival and `0012`'s
--        `source_document` records what an ADMITTED arrival became. Neither of
--        those is an operator pressing a button.
--      · **Neither writer exists.** The publication seam is G110's unbuilt half;
--        the ingestion route is `createUpload`/`completeUpload`, declared and
--        unmounted for want of an object store.
--
--    **So a `GRANT INSERT` here would be `0004`'s refusal exactly — a write
--    privilege ahead of its writer.** `SELECT` and nothing else, and the writer
--    is OWED, named here so the commit that builds one meets this argument
--    rather than rediscovering it. That commit owes the fence in the same
--    breath, which is `0020`'s rule for `role_assignment`: *"the fence and the
--    writer are one commit or neither."*
--
-- ⚠️ THE COST OF SELECT-ONLY, STATED PLAINLY RATHER THAN LEFT TO BE FOUND:
--    every binding in this repository today is written BY THE MIGRATOR, which
--    is where `0008`'s governance lists, `0012`'s `document_field_spec`,
--    `0059`'s three reference tables and `0069`'s three tables already are. A
--    binding therefore reaches a tenant by a seed or a fixture, and
--    `tests/http/slot-fill-served.test.ts` says so in its own header rather
--    than letting a green suite imply a product path that does not exist.
-- =====================================================================

GRANT SELECT ON tenant.document_slot_binding TO tenant_rw;

-- =====================================================================
-- 0069 — RUN ADMISSION. THE DEFINITION, ITS SLOTS, THE PERIOD, AND THE
--        IDEMPOTENCY BASIS. G691, G692, G693, G694. 19 Sep 2026.
--
-- 🛑 THIS FILE EXISTS TO DISCHARGE A NAMED, DATED, UNMET WITNESS AND NOTHING
--    ELSE. `tests/http/engine-on-served-path.test.ts` §4 has carried a `todo`
--    since 16 Aug 2026 whose text is a list of what was missing:
--
--        "needs `admitRun` MOUNTED … the three blockers are enumerated
--         verbatim in the header of `tests/contracts/request-body-schema.test.ts`
--         — NO `definition` TABLE, so `definitionVersion` would be a number
--         with no source; no document or slot substrate, so
--         `outcome: deduplicated` is unreachable and the guarantee the
--         operation is NAMED for would be false; and no member of
--         `errors.yaml`'s closed 71-code enum means 'declared and unbuilt'."
--
--    THIS MIGRATION IS THE FIRST TWO. Derive that they were true until now:
--
--        git show HEAD -- db/migrations/ | grep -c reconciliation_definition  → 0
--        grep -c 'definition_id' db/migrations/0002_run.sql                   → 1
--          (a COLUMN on `run`, pointing at nothing)
--
--    THE THIRD IS NOT A BLOCKER AND THE TODO WAS WRONG ABOUT IT, WHICH IS
--    RECORDED HERE RATHER THAN LEFT TO BE REDISCOVERED: `admitRun` declares no
--    404 and needs none. Every refusal it can produce is already a member of
--    the closed enum — `definition_not_active`, `slot_fill_incomplete`,
--    `trigger_not_enabled` and `period_closed`. Derive it:
--
--        grep -cE '^        - (definition_not_active|slot_fill_incomplete|period_closed)$' \
--          docs/contracts/errors.yaml   → 3
--
-- ---------------------------------------------------------------------
-- 🛑 EVERY COLUMN BELOW HAS A READER IN THIS COMMIT, AND THE ONES THAT WOULD
--    NOT ARE ABSENT. `0004_subject_ledger.sql`'s rule, applied four times in
--    this directory already: a column ahead of its reader *"would have been
--    filled later by whoever built the writer, with whatever they had to
--    hand."* So `ReconciliationDefinition` has TWELVE fields and this table
--    carries FOUR of them, and each absence is argued at the table.
--
-- 🛑 AND THE ONE THAT WILL LOOK LIKE AN OVERSIGHT IS `enabled_triggers`, SO IT
--    IS ARGUED FIRST. The contract declares a `trigger_not_enabled` refusal on
--    `admitRun` — *"`manual` is not in the definition's `enabledTriggers`"* —
--    and `model/domain.ts` makes that refusal **UNREACHABLE FOR THIS
--    OPERATION**, in its own voice, at `RUN_TRIGGER_KINDS`:
--
--        "`manual` and `rerun` are deliberately ABSENT from this list. Both are
--         always available to an operator and neither is a configuration
--         choice … A contract review caught the contradiction: the comment was
--         right and the placement was wrong."
--
--    `admitRun` *"always records `{ kind: 'manual', byUserId }`"*. A `manual`
--    trigger therefore cannot fail an `enabledTriggers` test, because `manual`
--    is not a member of the set that column would hold. **A column whose only
--    reader is an unreachable branch is a column with no reader.** The
--    contract's 422 arm stays declared and stays unreachable from this
--    operation; `model/run-admission.ts` says the same thing at the refusal
--    union, where a later `scheduled` or `ingest` admitter will meet it.
--
-- ---------------------------------------------------------------------
-- RULINGS THIS APPLIES, identically to 0001–0039:
--   G97   every branded id is `text`; the slug is stored VERBATIM. No uuid.
--   G100  the policy DENIES on NULL. A forgotten transaction yields an EMPTY
--         result set, never another tenant's rows.
--   G101  transaction-mode pooling assumed; `SET LOCAL` inside an explicit
--         transaction, issued only by the scoped helpers.
--   G88   forward-only EXPAND. The two `ALTER TABLE run ADD COLUMN`s below are
--         the expand half and nothing is contracted; `0002_run.sql` is not
--         otherwise edited by this file.
--
-- 🛑 EVERY NEW TABLE IS SCHEMA-QUALIFIED `tenant.`, WHICH
--    `0003_tenant_schema.sql` MADE MANDATORY FROM 0004 ON. `run` itself is in
--    `public` — 0003 explains why — which is why the `ALTER`s below name it
--    bare and the foreign keys elsewhere name `public.run`.
-- =====================================================================


-- =====================================================================
-- §1  THE DEFINITION — G691
--
-- `ReconciliationDefinition`, projected to the two facts run admission reads.
--
-- 🛑 FOUR COLUMNS, AND THE EIGHT ABSENCES ARE THE ARGUMENT:
--
--   `name`            ABSENT. Operator-authored text with no reader here.
--                     `admitRun` publishes `Run`, which carries no definition
--                     name, and a refusal that carried one would put operator
--                     text into a log — the shape `IntakeChannelDefect`'s
--                     docblock refuses by name.
--   `domain`          ABSENT. `DomainKey` governs labelling and classification
--                     defaults; nothing on this path labels or classifies.
--   `archetype`       ABSENT.
--   `config`          ABSENT, AND THIS IS THE ONE TO READ. `ArchetypeConfig` is
--                     a four-arm union carrying `PopulationSpec`s, `MatchKey`s
--                     and `MatchRule`s, and the ONLY thing admission needs out
--                     of it is the SLOTS — which §2 holds as rows instead.
--                     Storing the whole union as `jsonb` would inherit
--                     invariant 4's G106 problem exactly as `0007` records for
--                     the engine's operands: *a JSONB key with no `FieldSpec`
--                     is UNREADABLE*, so the config would be **stored and
--                     unaddressable**, and G284's sentence applies unchanged —
--                     *"a result nobody may read is not persistence."*
--   `fx`              ABSENT. `FxPolicy` is read by the engine, not by
--                     admission.
--   `enabledTriggers` ABSENT. See the header: unreachable for `manual`.
--   `tags`            ABSENT. Chargeback and governance, read by neither.
--   `procedureId`     ABSENT. No procedure runtime exists.
--
-- ⚠️ NOTHING ON A REQUEST PATH WRITES THIS TABLE AND THE GRANT BELOW SAYS SO.
--    A `ReconciliationDefinition` reaches a tenant by PACK PUBLICATION, and
--    the publication seam is G110's unbuilt half — *"blocked on an
--    `administration.openapi.yaml` that does not exist"*, which G288 has since
--    landed DECLARED AND UNMOUNTED. Until then rows arrive as the migrator,
--    exactly the way `0008`'s governance lists and `0012`'s `document_field_spec`
--    do, and for the same stated reason. **Do not read the absence of a writer
--    as a reason to grant INSERT here to close a gap:** a request path that
--    could write a definition could set its own `status` to `'active'` and
--    then admit a run against it, which makes `definition_not_active` a
--    refusal the caller controls.
--
-- 🛑 NO CHECK ON `status`, AND THIS IS `0007`'s DECISION RATHER THAN `0004`'s.
--    `0004_subject_ledger.sql` CHECKs `scope` because *"a scope the evaluator
--    cannot answer must not be storable"*. Here the evaluator answers every
--    string: `model/run-admission.ts` tests for the ONE value that admits
--    (`'active'`) and refuses everything else as `definition_not_active`, so an
--    unknown status is not unanswerable — it is a REFUSAL, which is the
--    fail-closed direction. A CHECK naming the three members would be a third
--    copy of a vocabulary `model/domain.ts` already holds, and the one nothing
--    compares: unlike `run_status` there is no wire enum for it and therefore
--    no `check-wire-mirror` pair to hold it against.
-- =====================================================================

CREATE TABLE tenant.reconciliation_definition (
  tenant_id text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id        text    NOT NULL,

  -- `ReconciliationDefinition.version`. **THIS COLUMN IS THE FIRST OF THE
  -- TODO'S TWO REAL BLOCKERS.** `Run.definitionVersion` is `required` on the
  -- wire and `0002_run.sql` has carried `definition_version integer NOT NULL`
  -- since 9 Aug 2026 with nothing to read it from — so an admitter would have
  -- had to invent an integer, and `fast-json-stringify` serialises a response
  -- without validating it, so the invention would have shipped silently.
  -- *"Pins the definition as it stood, so a re-run is distinguishable."*
  version   integer NOT NULL,

  -- `'draft' | 'active' | 'archived'`. Read by ONE comparison, in
  -- `model/run-admission.ts`, and that comparison is against `'active'`.
  status    text    NOT NULL,

  PRIMARY KEY (tenant_id, id)
);


-- =====================================================================
-- §2  THE SLOTS — G692
--
-- `SourceSlot`, projected to the one fact admission reads: whether a slot
-- REQUIRES a document. This is the second of the todo's two real blockers —
-- *"no document or slot substrate, so `outcome: deduplicated` is unreachable
-- and the guarantee the operation is NAMED for would be false."*
--
-- 🛑 WHY THE SLOTS ARE ROWS AND NOT A `jsonb` COLUMN ON §1. Because the
--    QUESTION is per slot — *"a slot with cardinality `exactly_one` or
--    `at_least_one` has nothing in it"* — and the answer must name WHICH slot.
--    A `jsonb` blob would make the refusal's `slot` field come from walking an
--    undeclared document, which is the one enumeration invariant 4 forbids by
--    name. Rows make the slot a primary key instead.
--
-- 🛑 TWO COLUMNS OUT OF `SourceSlot`'s FOUR, AND BOTH ABSENCES ARE ARGUED:
--
--   `documentTypeId`  ABSENT. It says which `DocumentType`'s `FieldSpec`s
--                     address a document in this slot — a question for
--                     EXTRACTION, which does not exist here, and `0012`'s §5
--                     already holds the join key it would duplicate.
--   `role`            ABSENT. `'reference' | 'comparand'` decides what
--                     `Explanation.expected` is drawn from when a RULE fails.
--                     No rule is evaluated on this path.
--
-- ⚠️ AND THE HONEST STATEMENT OF WHAT SLOT-FILL MEANS TODAY, because a reader
--    will otherwise take the refusal for a bug. **NOTHING IN THIS REPOSITORY
--    BINDS A `SourceDocument` TO A SLOT.** `0012`'s §3 carries `arrival_id`
--    and `document_type_id` and no slot; `run.inputs` is written BY admission
--    and read by nobody else. So every `exactly_one` and every `at_least_one`
--    slot is EMPTY, on every definition, always — and `admitRun` against a
--    definition that declares one is a 422 forever, by design rather than by
--    accident. That is the correct answer: *"Running anyway would raise
--    exceptions for absent documents and call them breaks."*
--
--    The reachable admitting case is therefore a definition all of whose slots
--    are `optional`, or one that declares none. **That is a narrow product and it is a
--    REAL one**: `existence_completeness` over two optional slots is a
--    legal archetype config, and a definition with no slot rows is the shape a
--    pack ships before its sources are bound. What must NOT happen is an
--    admitter that treats an empty slot table as "all slots filled" — it does
--    not; it treats it as "no slot requires a document", which is a different
--    sentence and the true one.
--
-- 🛑 NO CHECK ON `cardinality`, FOR §1's REASON, PLUS A SHARPER ONE.
--    `model/run-admission.ts` reads its direction out of
--    `CARDINALITY_REQUIRES_A_DOCUMENT`, a TOTAL `Record<Cardinality, boolean>`,
--    precisely so a fourth cardinality member cannot slip through as a
--    silently-permissive default — the same shape and the same argument as
--    `CHANNEL_DRAWS_THROUGH_AN_ENDPOINT` in `model/ingestion.ts`, whose
--    docblock `0012` quotes when it declines the same CHECK. A SQL CHECK
--    naming the three members literally is the lazy repair that record exists
--    to refuse: a fourth member added to the model would pass it silently.
--    **AND THE POLARITY IS THE DECIDING HALF:** an UNKNOWN cardinality is
--    absent from the total record, so the reader refuses the whole admission
--    (`slot_cardinality_unreadable`) rather than treating the slot as
--    optional. A CHECK would have been a second, weaker copy of that.
-- =====================================================================

CREATE TABLE tenant.definition_slot (
  tenant_id     text NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  definition_id text NOT NULL,

  -- `SlotName`. The slot's own name, stored verbatim (G97), and the key of
  -- `ReconciliationRun.inputs: Record<SlotName, SourceDocumentId[]>`.
  slot          text NOT NULL,

  -- `Cardinality` — exactly_one | at_least_one | optional.
  cardinality   text NOT NULL,

  PRIMARY KEY (tenant_id, definition_id, slot),

  -- 🛑 THE COMPOSITE FOREIGN KEY, FOR `0002_run.sql`'s REASON: *"a cross-tenant
  --    reference has to be unrepresentable rather than merely unlikely."* It
  --    buys the same second thing `0012`'s `arrival` FK buys: a slot naming a
  --    definition that does not exist is UNWRITABLE, so the admission cascade
  --    needs no `slot_orphaned` arm and does not have one.
  FOREIGN KEY (tenant_id, definition_id)
    REFERENCES tenant.reconciliation_definition (tenant_id, id) ON DELETE CASCADE
);


-- =====================================================================
-- §3  THE PERIOD — G693, AND IT IS A FAIL-CLOSED REGISTER
--
-- The contract's 409: *"`period_closed` — the period was closed and a run
-- against it would reopen a signed number behind the controller's back. Reopen
-- the period first; that is a deliberate, audited act."*
--
-- 🛑 A `periodId` WITH NO ROW HERE IS REFUSED AS `period_closed`, AND THAT IS
--    A DECISION RATHER THAN A COLLAPSE. G693. Read it before "fixing" it.
--
--    The alternative — admit against an unknown period — is scope failing
--    OPEN, which G106 records this codebase refusing once already: *"defaulting
--    unmapped keys to the most sensitive class was refused, because
--    readable-by-default-with-a-high-bar is scope failing OPEN."* Here the
--    open default is worse than that, because the thing being defaulted is a
--    CLOSE. A period this plane has no record of cannot be shown to be open,
--    and a run admitted against it attributes a reconciliation to an
--    accounting period nobody opened — which is the exact harm the 409 exists
--    to prevent, arriving through the door marked "unknown" instead of the one
--    marked "closed".
--
--    ⚠️ THE COST IS NAMED RATHER THAN HIDDEN: the two causes are ONE ANSWER to
--    a caller, so an operator who mistypes a period id is told it is closed.
--    That is the same posture `getRun`'s 404 takes for *"a row that does not
--    exist and a row in another tenant"*, and `CODES.tenantContextMissing`
--    takes for four distinct registry outcomes — *"distinguishing them would
--    make this endpoint an existence oracle."* A period register is a list of
--    a customer's accounting calendar, and an operation that told a caller
--    which period ids exist would be one.
--
-- 🛑 NOTHING WRITES THIS TABLE EITHER, AND THE ABSENT WRITER IS A DIFFERENT
--    ABSENCE FROM §1's. Closing a period is `close_period`, a capability in
--    the closed set (`grep -n close_period model/access.ts`), and there is no
--    operation for it on any tier this plane mounts. So the register is
--    migrator-seeded and every row in it today is one a test put there.
--    **A request path that could write a period could OPEN a closed one**,
--    which is the audited act the contract says must be deliberate — so the
--    grant is `SELECT` and the argument is `0012`'s, one table over.
--
-- ⚠️ ONE COLUMN OUT OF `ReconciliationPeriod`'s SEVEN, AND THE SIX ABSENCES
--    ARE `0004`'s RULE AGAIN. The entity IS declared — derive it,
--    `grep -n 'interface ReconciliationPeriod' model/domain.ts` — and carries
--    `label`, `from`, `to`, `cutOffAt`, `status`, `closedAt` and `closedBy`.
--    `label` is operator text with no reader here; `from`, `to` and `cutOffAt`
--    are the CALENDAR, read by the ingestion cascade that decides which period
--    a document falls into and by nothing on this path; `closedAt` and
--    `closedBy` are written by the closing act, and there is no closing act.
--    A column for any of them would be filled by the first person who had a
--    value to hand.
--
-- 🛑 FOUR STATUS MEMBERS AND TWO OF THEM ADMIT, WHICH IS A DECISION AND NOT A
--    TRANSCRIPTION. `ReconciliationPeriod.status` is
--    `'open' | 'closing' | 'closed' | 'reopened'`, and
--    `model/run-admission.ts` admits `open` and `reopened` and refuses the
--    other two — plus absence, per the block above.
--
--    `reopened` ADMITS because reopening is exactly the remedy the contract
--    prescribes: *"Reopen the period first; that is a deliberate, audited
--    act."* A `reopened` period that still refused would make the remedy
--    inert, which is G60's shape — a rule that makes the act it names
--    structurally impossible.
--
--    `closing` REFUSES, and it is the close call. A period mid-close is one
--    whose numbers are being signed; admitting a run against it is the same
--    harm as admitting against a closed one, arriving a minute earlier. The
--    ADMITTING set is written out member by member rather than as
--    `status <> 'closed'`, because the negative form admits a fifth member
--    silently and the positive form makes it a refusal — the same polarity
--    `CHANNEL_DRAWS_THROUGH_AN_ENDPOINT` takes for a fifth intake channel.
-- =====================================================================

CREATE TABLE tenant.reconciliation_period (
  tenant_id text NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id        text NOT NULL,

  -- `ReconciliationPeriod.status` — open | closing | closed | reopened. TWO
  -- members admit and §3's header argues which and why; everything else, AND
  -- ABSENCE, is `period_closed`.
  status    text NOT NULL,

  PRIMARY KEY (tenant_id, id)
);


-- =====================================================================
-- §4  THE IDEMPOTENCY BASIS, AND THE ATTRIBUTION — G694
--
-- Two columns added to `public.run`. G88's EXPAND, and nothing is contracted.
--
-- ---------------------------------------------------------------------
-- 🛑 `idempotency_key` — THE UNIQUE INDEX IS THE GUARANTEE, NOT THE HANDLER.
--
-- The contract's whole argument for this operation is a RACE:
--
--     "A client-supplied key would let a client mint a duplicate run by
--      varying it, which is the race this rule exists to close: an operator
--      presses Run at the same moment a document lands and fires the `ingest`
--      trigger, and two runs form over identical inputs."
--
-- A handler that SELECTed and then INSERTed would lose that race — two
-- requests both find nothing and both insert, which is precisely the outcome
-- the operation is named for preventing. So the uniqueness is a CONSTRAINT and
-- the handler's dedup is `INSERT … ON CONFLICT DO NOTHING`: the database picks
-- the winner and the loser reads the winner's row. **Deleting this index turns
-- `admitRun` from idempotent into usually-idempotent, and nothing else in the
-- tree would notice.** `tests/db/run-admission.test.ts` §4 is the control:
-- two concurrent inserts of the same key, one row.
--
-- ⚠️ IT IS NULLABLE AND THAT IS NOT A WEAKENING — PostgreSQL treats NULLs as
--    DISTINCT in a unique index by default, so every pre-existing row (and any
--    run a later non-manual trigger writes without a basis) coexists freely.
--    `NULLS NOT DISTINCT` would have made the FIRST such row block the second,
--    which is the opposite of what a nullable basis means.
--
-- 🛑 THE KEY IS NOT A SECRET AND IT IS NOT PUBLISHED. `RunAdmission` returns
--    the BASIS — `{definitionId, periodId, slotFillFingerprint}` — *"returned
--    so a puzzled operator can see WHY their press of Run joined an existing
--    run"*. The derived key itself reaches no wire, so there is no schema to
--    mirror and no `check-wire-mirror` pair to add.
--
-- ---------------------------------------------------------------------
-- 🛑 `trigger_by_user_id` — THE ATTRIBUTION `0002` HAD NOWHERE TO PUT.
--
-- `RunTrigger` is a UNION and only its `kind` was stored, so `toRun()` has
-- published `{ kind: row.trigger_kind }` and said so: *"Only `kind` is stored
-- by 0002; the rest arrives with the operation that records it."* **This is
-- that operation.** The contract:
--
--     "THE TRIGGER IS ATTRIBUTION, NEVER IDENTITY. This operation always
--      records `{ kind: 'manual', byUserId }` taken from the session. A client
--      cannot claim `scheduled` or `ingest` … A trigger a caller could assert
--      would be a trigger a caller could disown."
--
-- Mounting the operation without this column would have recorded the FIRST
-- half of that sentence and dropped the second — a manual run with nobody
-- attached to it — and the drop would have been invisible, because the wire's
-- `RunTrigger` is `additionalProperties: true, required: [kind]` and a
-- `{kind: 'manual'}` with no `byUserId` VALIDATES.
--
-- ⚠️ NO FOREIGN KEY TO `tenant."user"`, AND IT IS `0012`'s `authorization_id`
--    ARGUMENT REPEATED: a run is a durable record of an act and a person may
--    be deleted from the directory; a `REFERENCES … ON DELETE CASCADE` would
--    take the run with them and a `RESTRICT` would make erasure fail on an
--    audit row. The value is the `UserId` the SESSION resolved, stored
--    verbatim (G97).
--
-- ⚠️ IT IS NULLABLE, AND THE NULL IS A VALUE. Four of five `RunTrigger` kinds
--    have no human principal — `model/governance.ts` says so in its own voice —
--    *"Four of five `RunTrigger` kinds have no human principal"* — so a
--    `scheduled` row legitimately carries none. `toRun()` reads `trigger_kind`
--    FIRST and only then looks here, which is what makes an inapplicable NULL
--    distinguishable from a missing one; it is `0007` §4's single-table
--    inheritance, at one column.
-- =====================================================================

ALTER TABLE run ADD COLUMN idempotency_key    text;
ALTER TABLE run ADD COLUMN trigger_by_user_id text;

-- One run per basis, per tenant. See §4's header: this index IS the
-- idempotency guarantee, and the handler's `ON CONFLICT` is how it is read.
CREATE UNIQUE INDEX run_idempotency_key
  ON run (tenant_id, idempotency_key);


-- =====================================================================
-- ROW LEVEL SECURITY — G100's deny-on-NULL, written as the predicate rather
-- than described. `0001`'s predicate VERBATIM, on `USING` **and** on
-- `WITH CHECK`, on all three new tables.
--
-- `ENABLE` and `FORCE`, both, on every one. `ENABLE` alone leaves the TABLE
-- OWNER exempt, and `0001` states the consequence: *"a test that connects as
-- the owner then passes with the policy doing nothing, and passes just as well
-- with the policy dropped."*
--
-- 🛑 `WITH CHECK` IS STATED ON ALL THREE EVEN THOUGH NONE OF THEM TAKES A
--    WRITE FROM THE REQUEST PATH, WHICH IS `0012`'s POSTURE VERBATIM: *"the two
--    that do not take one carry it anyway, so a later `GRANT INSERT` cannot
--    arrive without the write half already in place."*
--
-- ⚠️ `public.run` IS NOT TOUCHED HERE. `0002` already `ENABLE`s and `FORCE`s it
--    and its policy is `USING`/`WITH CHECK` over the same predicate, so the two
--    columns added above are covered by an existing policy rather than by a new
--    one. **No `ALTER POLICY` anywhere in this file** — `0008` is the only
--    migration in this directory that has ever needed one, and a column
--    addition is not that.
-- =====================================================================

ALTER TABLE tenant.reconciliation_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.reconciliation_definition FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.definition_slot           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.definition_slot           FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.reconciliation_period     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.reconciliation_period     FORCE  ROW LEVEL SECURITY;

CREATE POLICY reconciliation_definition_rls ON tenant.reconciliation_definition
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY definition_slot_rls ON tenant.definition_slot
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY reconciliation_period_rls ON tenant.reconciliation_period
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- =====================================================================
-- GRANTS. By name, because `0003` deliberately declines
-- `ALTER DEFAULT PRIVILEGES` on this schema: *"A future table created here is
-- unreachable by the app until granted BY NAME … default privileges would
-- silently hand the request path a table nobody decided to expose."*
--
-- 🛑 READ THE VERBS. `SELECT` AND NOTHING ELSE, ON ALL THREE. NO `INSERT`, NO
--    `UPDATE`, NO `DELETE` ANYWHERE IN THIS FILE, AND EACH REFUSAL IS A
--    DIFFERENT SENTENCE:
--
--   `reconciliation_definition`  A path that could INSERT could mint a
--                                definition with `status = 'active'` and admit
--                                a run against it in the next request, which
--                                makes `definition_not_active` a refusal THE
--                                CALLER CONTROLS. A path that could UPDATE
--                                could bump `version`, and `definitionVersion`
--                                is the field whose whole job is *"pins the
--                                definition as it stood, so a re-run is
--                                distinguishable"* — a re-run against a version
--                                somebody edited is indistinguishable from the
--                                first run, which is the one thing the column
--                                exists to prevent.
--   `definition_slot`            A path that could DELETE a slot row could turn
--                                a `slot_fill_incomplete` refusal into an
--                                admission by removing the requirement rather
--                                than satisfying it. That is the shape
--                                `0009_identity_substrate.sql` refuses for
--                                `role_assignment`: *"a path that could would
--                                grant itself any capability in the closed set,
--                                and `decide()` would then permit it
--                                CORRECTLY."*
--   `reconciliation_period`      A path that could UPDATE could REOPEN a closed
--                                period, which the contract calls *"a
--                                deliberate, audited act"* and this plane has
--                                no audited act to offer. `close_period` is a
--                                capability in the closed set with no operation
--                                on any mounted tier.
--
-- ⚠️ AND ONE THING THIS FILE DOES NOT DO, RECORDED BECAUSE IT IS THE OBVIOUS
--    NEXT MOVE AND IT IS SOMEBODY ELSE'S. `0002_run.sql` grants
--    `SELECT, INSERT, UPDATE, DELETE ON run TO reconcile_app`, and `admitRun`
--    needs `INSERT` alone: nothing in `server/` issues an `UPDATE run` or a
--    `DELETE FROM run` — derive it, `grep -rn 'UPDATE run\|DELETE FROM run' server/`
--    → 0. So two of those four verbs are privileges ahead of their writers,
--    which is `0004`'s refusal wearing a grant. **They are REPORTED here and
--    not revoked**, because `run` is a shared table that concurrent slices are
--    building against, and a REVOKE lands as an invisible failure in whatever
--    is mid-flight. It is named so the next person to touch `0002`'s grants
--    meets it.
-- =====================================================================

GRANT SELECT ON tenant.reconciliation_definition TO tenant_rw;
GRANT SELECT ON tenant.definition_slot           TO tenant_rw;
GRANT SELECT ON tenant.reconciliation_period     TO tenant_rw;

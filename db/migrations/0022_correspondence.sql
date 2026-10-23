-- =====================================================================
-- 0022 — CORRESPONDENCE. The conversation the exception is worked through.
--        G471, G472, G473. 19 Sep 2026.
--
-- ⚠️ THE NUMBER IS 0022 AND THE GAPS BELOW IT ARE DELIBERATE RATHER THAN A
--    MISCOUNT. `main` holds 0001–0015 and 0017; **`0016` is a RESERVED AND
--    UNSPENT gap — do not backfill it** — and 0018–0021 are reserved to a
--    parallel agent. `tools/check-migration-numbers.mjs` (G356) is the gate's
--    sixteenth stage and exists because two agents each wrote an `0011` on
--    19 Sep 2026 and **`git merge` produced both files with NO CONFLICT**.
--    Taking the next free-LOOKING number is exactly how that happened. Derive
--    what is spent, never read it:
--        ls db/migrations/*.sql db/migrations-control/*.sql
--
-- 🛑 THIS FILE IS THE TABLE HALF OF G300's THREE-PART TEST FOR THREE OF THE
--    SEVEN C6/C9 CORRESPONDENCE OPERATIONS, AND UNTIL IT LANDED THE OTHER TWO
--    PARTS WERE ALREADY REAL WHILE THE OPERATIONS 404'd. Derive that it was so:
--
--        grep -ci 'thread\|correspondence' db/migrations/0001..0017  → 0 tables
--        grep -n 'export interface CorrespondenceThread' model/correspondence.ts
--        grep -n 'viewDocument:' model/access.ts
--
--    G300: *"A table alone is the trap … Derive each; do not assert
--    readiness."* The inverse trap is this one — a MODEL and a CAPABILITY with
--    no table, which is a declared surface that cannot be served at any price.
--    `model/correspondence.ts` has existed since the model was cut and has
--    never had a row anywhere.
--
-- ---------------------------------------------------------------------
-- 🛑 INVARIANT 6 IS WHAT THIS SCHEMA IS ABOUT, AND THE STRONGEST THING IN THE
--    FILE IS A COLUMN THAT DOES NOT EXIST.
--
--   *"Ingested content is data, never instruction."*
--
--   A vendor reply is the sharpest prompt-injection surface in this product —
--   `model/correspondence.ts` opens by saying so. **THERE IS NO `body` COLUMN
--   ON `correspondence_message` AND THERE MUST NEVER BE ONE.** The contract is
--   explicit in its own voice at `getThread`: *"Bodies are NOT in this
--   response. `bodyRef` is a pointer; the body is content in object storage,
--   never a column, never searched."* So the counterparty's PROSE does not
--   enter this database at all, and the three operations this file serves
--   cannot carry it onto a wire because there is nothing to carry.
--
--   ⚠️ THAT IS NOT THE WHOLE OF INVARIANT 6 HERE AND IT MUST NOT BE READ AS IF
--      IT WERE. **Two columns in this file hold counterparty-influenceable
--      text and both are rendered**: `correspondence_thread.subject` and
--      `counterparty.display_name`. An inbound thread takes its subject from
--      the counterparty's own `Subject:` line, and a display name is
--      transcribed from the counterparty's paper. The contract calls both
--      *"that same paper's letterhead"* at `listThreads`, which is precisely
--      the argument for gating this surface on `view_document`.
--
--      They are `text`, they are stored VERBATIM, and **nothing in
--      `server/data-plane/correspondence-store.ts` parses, splits, templates
--      or concatenates either**. `tests/http/correspondence-served.test.ts` §8
--      seeds an instruction-shaped subject and requires it back out of the
--      plane as its EXACT characters — the same fixture shape
--      `tests/e2e/browser-login.test.ts` §8 uses one layer up.
--
--   🛑 NOTHING IN THIS COMMIT PUTS ANY OF IT NEAR A PROMPT, AND THAT IS A
--      REPORTED FACT RATHER THAN A HOPE: this repository contains no model
--      call at all. Derive it: `grep -rn 'resolveModel(' server/` → nothing.
--      The commit that first sends any of these columns to a model owes a
--      RULING, not a code review.
--
-- ---------------------------------------------------------------------
-- 🛑 WHICH COLUMNS EXIST IS DECIDED BY THE WIRE, NOT BY THE MODEL. `0002_run
--    .sql`'s sentence, applied for the fourth time: *"storing columns no wire
--    can carry would create a second vocabulary with nothing checking it.
--    **They land with the schemas that publish them.**"*
--
--    THAT RULE LOSES FIVE MODEL FIELDS HERE AND THEY ARE NAMED RATHER THAN
--    QUIETLY DROPPED. READ THIS BEFORE "COMPLETING" A TABLE.
--
--      `Counterparty.externalRefs`   no wire field on any of the three served
--                                    operations. It is *"resolved from
--                                    documents; never authoritative here"*.
--      `Counterparty.endpoints`      `CounterpartyEndpoint` is the outbound
--                                    surface's input and `requireVerifiedEndpoint`
--                                    is its reader. Neither is mounted. A
--                                    table of addresses ahead of the thing
--                                    that verifies them is `0004`'s refusal
--                                    with a phishing vector attached.
--      `Counterparty.status`         `EntityStatus` reaches no field of
--                                    `Thread`. Nothing filters on it.
--      `CorrespondenceMessage.disclosure`  see the `DisclosureRecord` block
--                                    below — this one is the load-bearing
--                                    absence and it has its own argument.
--      `CorrespondenceMessage.attachmentRefs` DOES get a column; the WIRE's
--                                    `attachmentDocumentIds` does not, and the
--                                    store REFUSES rather than invents. See §4.
--
-- ---------------------------------------------------------------------
-- 🛑 THE `DisclosureRecord` HAS NO COLUMNS AND THAT IS THE STRONGEST DECISION
--    IN THIS FILE AFTER THE ABSENT BODY. READ IT BEFORE ADDING ONE.
--
--   `Message.disclosure` and `Message.redactedPaths` are BOTH published by
--   `getMessage` and `getThread`, so the *"lands with the schema that
--   publishes it"* rule points AT columns here. They are still refused, on a
--   second rule that points harder the other way — `0004`'s, quoted by two
--   later migrations: **a column ahead of its writer is a refusal.**
--
--   A `DisclosureRecord` is written BECAUSE A DISCLOSURE HAPPENED. The only
--   thing that can make one is `sendOutboundMessage`, which **is not mounted
--   and cannot be** (see the four refusals at the foot of
--   `server/data-plane/correspondence.ts`). So every row this database can
--   produce arrives from the migrator, and a `disclosed_class` column would
--   hold a hand-written claim that a disclosure occurred — *"a log line"*,
--   which is the exact thing the contract says a `DisclosureRecord` is not.
--
--   ⚠️ BOTH FIELDS ARE OPTIONAL ON THE WIRE — neither is in `Message.required`
--      — so their ABSENCE IS EXPRESSIBLE, which is why this is a decision and
--      not a defect. It is `ExceptionQueueRow.hasProposal`'s case exactly:
--      omitted rather than set null, because null would claim *"nothing was
--      disclosed"* where the truth is *"this database cannot say"*.
--
--   🛑 AND THE CONSEQUENCE IS STATED PLAINLY RATHER THAN LEFT TO BE FOUND: an
--      OUTBOUND row is storable here and its disclosure is not. **The only
--      outbound rows this schema should ever hold are fixtures.** The commit
--      that mounts `sendOutboundMessage` owes the columns AND the writer AND
--      the ceiling in one commit — `0009`'s rule, *"the commit that grants a
--      write here owes it in the same commit as the writer"* — and
--      `tests/db/correspondence.test.ts` §6 asserts all four columns are
--      ABSENT so that a half-built successor arrives against a RED rather than
--      silently. `0015` §6 is the same tripwire for the same reason.
--
-- ---------------------------------------------------------------------
-- 🛑 WHAT THIS FILE DOES **NOT** GIVE A WRITER. SEE THE GRANTS BLOCK AT THE
--    FOOT — THERE IS NO `INSERT`, NO `UPDATE` AND NO `DELETE` ANYWHERE.
--
--   · NOTHING ON A REQUEST PATH MAY OPEN A THREAD. `openThread` is not
--     mounted, and granting `INSERT` ahead of it is `0004`'s refusal wearing a
--     privilege. It is worse than it was at `0015`: a request path that could
--     INSERT a thread could **mint a correspondence history against itself** —
--     fabricate "we asked the vendor on the 3rd and they never replied", which
--     is evidence in a dispute and a defence in an audit.
--   · NOTHING MAY ADMIT. `decideAdmission` is *"THE MOST SECURITY-SENSITIVE
--     OPERATION IN THE PRODUCT"* in the contract's own capitals, and
--     `admitted_as_evidence_at` is the column that decides whether an agent
--     may be fed a vendor's words as grounds. **`GRANT UPDATE
--     (admitted_as_evidence_at)` would be a one-parenthesis change that hands
--     invariant 6's checkpoint to a handler**, and `0015`'s G358 precedent —
--     a column-level UPDATE for `assigned_to` — is exactly the shape somebody
--     will reach for. It is refused here in advance and by name.
--   · NO `DELETE`. `RetentionPolicy` is a sweep's verb and there is no sweep.
--     `0012` and `0015` both say the same about erasure.
--
-- ---------------------------------------------------------------------
-- RULINGS THIS APPLIES, and the three it takes
--
--   G300  An operation may mount when its TABLE **and** MODEL **and**
--         CAPABILITY are all real, per operation, derived and not asserted.
--         This file is the table for THREE of the seven C9 operations.
--   G301  An operation may not mount until it MINTS an authorisation record.
--         Every handler reading these tables is an `AuthorisedOperation` and
--         reads through the transaction the mint opened — it takes no pool.
--   G471  THE BODY IS NEVER A COLUMN, AND `subject` AND `display_name` ARE
--         STORED VERBATIM AND PARSED BY NOTHING. Invariant 6, argued above.
--   G472  THE `DisclosureRecord` GETS NO COLUMNS UNTIL THE SEND EXISTS.
--         Argued above against the *"lands with the schema"* rule rather than
--         around it.
--   G473  THE THREAD↔EXCEPTION LINK CARRIES NO FOREIGN KEY TO `exception`.
--         Argued at §3.
--   G214  A `FieldPath` is a STRUCTURED TOKEN LIST parsed at ONE seam. No
--         column in this file holds one, which is why no `jsonb` appears.
--   G097  Every branded id is `text`, compared with NO CAST — which is what
--         makes `tenant_id = current_setting(...)` the RLS predicate.
--   G088  Forward-only. Nothing here alters or drops anything.
--
-- 🛑 EVERY TABLE IS SCHEMA-QUALIFIED `tenant.`, WHICH `0003_tenant_schema.sql`
--    MADE MANDATORY FROM 0004 ON: *"Qualify every CREATE TABLE explicitly from
--    0004 on, or the schema a table lives in becomes a side effect of
--    migration order."*
--
-- 🛑 NO `CHECK` CONSTRAINT ON ANY VOCABULARY COLUMN, AND THE ABSENCE IS
--    `0002_run.sql`'s RULING RATHER THAN AN OVERSIGHT: a third copy of a
--    closed enum *"would be a third place to drift — and the one nothing
--    checks, because no pair in the wire-mirror addresses SQL."* The narrowing
--    lives where it can be DERIVED from the model instead of copied —
--    `server/data-plane/correspondence-vocabulary.ts`, keyed
--    `Record<Union, true>` so an arm added to a model union is a `TS2741`
--    there rather than a word the product's own types cannot name arriving on
--    the wire.
-- =====================================================================


-- =====================================================================
-- §1  THE COUNTERPARTY — deliberately thin, and thinner here than in the model
--
-- `model/correspondence.ts`: *"This is NOT a vendor master. It holds no
-- commercial terms, no bank details, no addresses beyond contact endpoints."*
-- This table is thinner still: it holds the ONE field the wire publishes.
--
-- 🛑 `display_name` IS COUNTERPARTY-SHAPED TEXT AND IT IS RENDERED. It reaches
--    `Thread.counterpartyName`, which the contract calls the counterparty's
--    *"letterhead"* and which is the stated reason `listThreads` is gated on
--    `view_document` rather than `view_exception`. Stored verbatim; parsed by
--    nothing. See the invariant 6 block in the header.
--
-- ⚠️ THE ALTERNATIVE WAS TO OMIT THIS TABLE ENTIRELY AND OMIT
--    `Thread.counterpartyName` WITH IT — which is legal, because the field is
--    not `required`, and which is exactly what `listExceptions` does with
--    `definitionName` (*"there is no `definition` table to name one from"*).
--    It is refused because it would hollow out the capability argument: the
--    contract's whole case for `view_document` on this surface is that the
--    thread carries the counterparty's letterhead, and a thread with no
--    letterhead would be gated on a capability it does not need.
-- =====================================================================

CREATE TABLE tenant.counterparty (
  tenant_id    text NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id           text NOT NULL,
  display_name text NOT NULL,

  PRIMARY KEY (tenant_id, id)
);


-- =====================================================================
-- §2  THE THREAD — the conversation, and the row `listThreads` pages
--
-- 🛑 THE ORDERING IS `last_message_at DESC, id ASC` AND IT IS THE ONLY ONE.
--    `listThreads` DECLARES NO `sort` PARAMETER — unlike `listExceptions`,
--    which declares four — so there is one ordering to have and the contract
--    chose it by omission. It is spelled out here and in
--    `correspondence-store.ts`'s `ORDER_BY`, and the index below matches it
--    column for column, because an index that disagrees with the `ORDER BY`
--    is an index the planner does not use.
--
--    ⚠️ `id ASC` IS NOT DECORATION. `last_message_at` is not unique — two
--       threads answered in the same transaction share it — and a keyset
--       cursor over a non-total ordering SKIPS ROWS AT THE PAGE BOUNDARY while
--       looking complete. The primary key's own column makes it total.
--
-- 🛑 `subject` IS THE SECOND COUNTERPARTY-INFLUENCEABLE COLUMN. See §1 and the
--    header. On an inbound-originated thread it IS the counterparty's own
--    `Subject:` line.
--
-- ⚠️ `awaiting_step_id` IS A POINTER AND NOT A FOREIGN KEY. There is no
--    `procedure_step` table — `0015`'s `match_group_id` note takes the same
--    shape for the same reason. What makes `await.counterparty_reply`
--    executable is admission, and nothing here admits.
-- =====================================================================

CREATE TABLE tenant.correspondence_thread (
  tenant_id       text        NOT NULL,
  id              text        NOT NULL,

  -- A REAL foreign key, unlike every pointer in `0015`, because the table it
  -- points at is created three statements above this one. Composite on
  -- `(tenant_id, …)` so it cannot bind a row to another tenant's counterparty
  -- even with row-level security disabled.
  counterparty_id text        NOT NULL,

  subject         text        NOT NULL,
  channel         text        NOT NULL,
  status          text        NOT NULL,

  opened_at       timestamptz NOT NULL,
  last_message_at timestamptz NOT NULL,

  awaiting_step_id text,
  await_deadline   timestamptz,

  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, counterparty_id)
    REFERENCES tenant.counterparty (tenant_id, id) ON DELETE CASCADE
);

-- The one ordering, and `overdueOnly` rides the same index's leading column
-- only incidentally — it is a `WHERE`, not a sort.
CREATE INDEX correspondence_thread_by_last_message
  ON tenant.correspondence_thread (tenant_id, last_message_at DESC, id);

-- `listThreads?counterpartyId=` — the contract's second filter.
CREATE INDEX correspondence_thread_by_counterparty
  ON tenant.correspondence_thread (tenant_id, counterparty_id, last_message_at DESC, id);


-- =====================================================================
-- §3  THE LINK — `Thread.exceptionIds`, and it is MANY-TO-MANY
--
-- The contract is emphatic and the model agrees: *"One vendor reply can
-- concern three invoices and one exception can need two conversations.
-- Filtering by `exceptionId` therefore returns threads that also concern other
-- exceptions, and that is correct — hiding the rest would hide the reason the
-- vendor's answer is ambiguous."*
--
-- A table and not a `text[]` column, for two reasons that are not style:
--   · `listThreads?exceptionId=` is a MEMBERSHIP QUERY, and a join row indexes
--     where an array membership test does not.
--   · The act of linking *"is a judgement, and it is AUDITED"* — recorded as
--     an AuditEvent rather than inferred. A judgement with its own lifetime is
--     a row, not a member of somebody else's column.
--
-- 🛑 G473 — NO FOREIGN KEY TO `tenant.exception`, AND THIS IS A DECISION
--    AGAINST THE OBVIOUS. `tenant.exception` exists (`0015`) and a composite
--    FK would typecheck, cost nothing, and be WRONG:
--
--      · `ON DELETE CASCADE` would let a retention sweep over
--        `RetentionPolicy.days.exception` silently erase the record of WHAT WE
--        TOLD A VENDOR ABOUT. That record is the disclosure history, and it is
--        the half PDPA cares about most — it must outlive the finding.
--      · `ON DELETE RESTRICT` would make the retention sweep fail on any
--        exception ever discussed, which is every exception worth discussing.
--
--    `0015`'s `carried_forward_from` declines an FK for the near-identical
--    reason (*"a FK would make the retention sweep delete the descendant"*).
--    The cost is accepted and named: **this column can point at an exception
--    that is gone**, and a reader must treat it as a pointer rather than a
--    join guarantee. `correspondence-store.ts` never joins it to `exception`.
--
-- ⚠️ THE FK TO `correspondence_thread` IS REAL AND CASCADES, which is the
--    opposite call and is right for the opposite reason: a link with no thread
--    is not a surviving record of anything, it is a dangling row.
-- =====================================================================

CREATE TABLE tenant.correspondence_thread_exception (
  tenant_id    text NOT NULL,
  thread_id    text NOT NULL,
  exception_id text NOT NULL,

  PRIMARY KEY (tenant_id, thread_id, exception_id),
  FOREIGN KEY (tenant_id, thread_id)
    REFERENCES tenant.correspondence_thread (tenant_id, id) ON DELETE CASCADE
);

-- `listThreads?exceptionId=` reads this direction — exception to threads.
CREATE INDEX correspondence_thread_exception_by_exception
  ON tenant.correspondence_thread_exception (tenant_id, exception_id, thread_id);


-- =====================================================================
-- §4  THE MESSAGE — an envelope and an evidence state. NEVER A BODY.
--
-- 🛑 READ THE HEADER'S INVARIANT 6 BLOCK BEFORE ADDING A COLUMN HERE. There is
--    no `body`, and `body_ref` is a POINTER into object storage that this
--    database never dereferences.
--
-- 🛑 THE THREE EVIDENCE STATES ARE THREE COLUMNS AND NOT ONE `state` STRING,
--    AND THE CONTRACT'S OWN WORDS ARE THE ARGUMENT: *"THREE STATES, NOT TWO.
--    Unadmitted is not a weaker form of refused and refused is not a slower
--    form of unadmitted."* They are derived from the pair
--    `(admitted_as_evidence_at, refused_for)` exactly as
--    `model/correspondence.ts` derives them — *"Both null means the decision
--    is still pending"* — because a stored `state` string would be a FOURTH
--    copy of a three-arm union, and the one that could disagree with the two
--    timestamps beside it. `isAdmissible()` in the model is the function that
--    reads the pair, and `correspondence-store.ts` CALLS it rather than
--    restating it.
--
-- ⚠️ `admitting_tool_scope_size` IS RECORDED AND NOT DERIVED, and the model
--    says why in its own voice: *"Kept on the message so an audit can check
--    the control held at the time rather than trusting that the procedure has
--    not been edited since."* A procedure edited afterwards would otherwise
--    rewrite the history of every message it admitted.
--
-- 🛑 `data_class` IS A COPY OF A CLASSIFICATION AND INVARIANT 4 IS NOT
--    SATISFIED BY IT. *"Classification is declared once, on `FieldSpec`, and
--    everything derives from it."* This column holds the class the CLASSIFIER
--    found in a body — *"set by classification, NEVER asserted by the
--    sender"*, because a sender-declared class on an inbound message would let
--    the sender lower the bar for admitting itself. There is no classifier in
--    this repository, so every value in this column today arrives from the
--    migrator. `0015`'s `exception_observed_value.data_class` carries the
--    identical caveat.
--
-- 🛑 `attachment_refs` IS A `text[]` AND `attachmentDocumentIds` HAS NO COLUMN,
--    WHICH MAKES ONE WIRE SHAPE UNPUBLISHABLE ON PURPOSE.
--
--    `EvidenceUnadmitted.attachmentRefs` is REQUIRED and these are it: opaque
--    blob refs, *"not document ids, and not fetchable as documents"*. A bare
--    string per element, so `0015`'s child-table treatment of `ObservedValue`
--    does not apply — that array's elements were compounds with six arms.
--
--    `EvidenceAdmitted.attachmentDocumentIds` is ALSO required, and it is a
--    DIFFERENT list: *"Attachments become SourceDocuments and re-enter the
--    intake flow at admission and not before."* **There is no `document`
--    table**, so nothing here can produce one. The store therefore REFUSES to
--    publish an admitted message that has attachments — `unpublishable`, with
--    the column named — rather than inventing ids or quietly emitting `[]`.
--    An admitted message with NO attachments publishes `[]` truthfully and is
--    the only admitted shape this database can serve. `tests/db/
--    correspondence.test.ts` §5 witnesses both halves.
--
--    ⚠️ QUIETLY EMITTING `[]` WAS THE OBVIOUS ALTERNATIVE AND IT IS THE
--       DANGEROUS ONE: it would tell an operator that an admitted message had
--       no attachments when it had two, and *"an attachment from a hostile
--       sender enters extraction"* is the failure the whole admission
--       checkpoint exists to prevent. A 500 that names the column is a worse
--       day and a better outcome.
-- =====================================================================

CREATE TABLE tenant.correspondence_message (
  tenant_id text        NOT NULL,
  id        text        NOT NULL,
  thread_id text        NOT NULL,

  direction text        NOT NULL,
  channel   text        NOT NULL,
  -- `MessageTrust`. *"This is not a severity or a confidence. It is
  -- provenance, and it is the field an agent prompt must branch on."*
  trust     text        NOT NULL,

  at        timestamptz NOT NULL,

  -- 🛑 A POINTER. There is no body column and there must never be one.
  body_ref  text        NOT NULL,
  -- Opaque blob refs. NOT document ids. See §4's header.
  attachment_refs text[] NOT NULL DEFAULT '{}',

  data_class text       NOT NULL,

  /* --- the trust boundary. Both null means undecided. --- */
  admitted_as_evidence_at   timestamptz,
  -- `ProposalActor` is a union of `user` and `agent`; the wire publishes
  -- `{kind}` and nothing narrower on this tier, so one column carries it.
  admitted_by_kind          text,
  admitting_tool_scope_size integer,
  admission_seconded_by     text,

  refused_for text,
  -- The wire's `EvidenceRefused` requires `refusedAt` and the MODEL HAS NO
  -- SUCH FIELD — `CorrespondenceMessage` carries `refusedFor` alone. The
  -- column exists because the WIRE requires it, which is the rule this file
  -- follows in the other direction everywhere else, and the divergence is
  -- named here rather than resolved: closing it is a change to
  -- `model/correspondence.ts`, which is a wave of its own.
  refused_at  timestamptz,
  refused_by  text,

  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, thread_id)
    REFERENCES tenant.correspondence_thread (tenant_id, id) ON DELETE CASCADE
);

-- `getThread` returns *"the thread with its messages IN ORDER"*. `at ASC` is
-- the order a conversation is read in, and `id` makes it total for the same
-- reason §2's does.
CREATE INDEX correspondence_message_by_thread
  ON tenant.correspondence_message (tenant_id, thread_id, at, id);


-- =====================================================================
-- ROW LEVEL SECURITY — G100's deny-on-NULL, written as the predicate rather
-- than described. `0001`'s predicate VERBATIM, on `USING` **and** on
-- `WITH CHECK`, on all four tables.
--
-- `ENABLE` and `FORCE`, both, on every one. `ENABLE` alone leaves the TABLE
-- OWNER exempt, and `0001` states the consequence: *"a test that connects as
-- the owner then passes with the policy doing nothing, and passes just as well
-- with the policy dropped."* `tests/db/correspondence.test.ts` §3 is the
-- negative control that tells database isolation from a handler's `WHERE`.
--
-- 🛑 `WITH CHECK` IS STATED EXPLICITLY ON ALL FOUR EVEN THOUGH **NONE** TAKES A
--    WRITE, WHICH IS `0009`'s RULE AND `0012`'s AND `0015`'s PRACTICE: the
--    tables that take no write carry it anyway *"so a later `GRANT INSERT`
--    cannot arrive without the write half already in place."* On this surface
--    that matters more than it did there — the first write anybody adds here
--    will be `openThread`'s `INSERT`, and a policy with no `WITH CHECK` would
--    let it write a row into another tenant.
--
-- ⚠️ `tests/db/rls-census.test.ts` (G446) ENUMERATES EVERY TABLE IN `tenant.`
--    FROM THE CATALOGUE AND FAILS ON ONE WITHOUT RLS. It exists because a
--    probe table shipped through all nine checkers and then read across
--    tenants. Four tables are added here and the census is what proves all
--    four are covered — not this comment.
-- =====================================================================

ALTER TABLE tenant.counterparty                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.counterparty                     FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.correspondence_thread            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.correspondence_thread            FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.correspondence_thread_exception  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.correspondence_thread_exception  FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.correspondence_message           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.correspondence_message           FORCE  ROW LEVEL SECURITY;

CREATE POLICY counterparty_rls ON tenant.counterparty
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY correspondence_thread_rls ON tenant.correspondence_thread
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY correspondence_thread_exception_rls ON tenant.correspondence_thread_exception
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY correspondence_message_rls ON tenant.correspondence_message
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- =====================================================================
-- GRANTS. By name, because `0003` deliberately declines `ALTER DEFAULT
-- PRIVILEGES` on this schema: *"A future table created here is unreachable by
-- the app until granted BY NAME … default privileges would silently hand the
-- request path a table nobody decided to expose."*
--
-- 🛑 READ THE VERBS. `SELECT`, FOUR TIMES, AND NOTHING ELSE. NO `INSERT`, NO
--    `UPDATE`, NO `DELETE`, NOT EVEN A COLUMN-LEVEL ONE.
--
-- ---------------------------------------------------------------------
-- WHY NO `INSERT` ON `correspondence_thread`. `openThread` is not mounted —
-- `server/data-plane/correspondence.ts` derives per operation why not — and a
-- privilege ahead of its writer is `0004`'s refusal. The specific harm is
-- worse here than at `0015`: a request path that could INSERT a thread and a
-- message could **fabricate a correspondence history**, which is evidence in a
-- commercial dispute and a defence in an audit. "We chased them on the 3rd and
-- they never replied" is a claim the product would then be asserting on behalf
-- of whoever held a session.
--
-- ---------------------------------------------------------------------
-- 🛑 WHY NO `GRANT UPDATE (admitted_as_evidence_at)`, WHICH IS THE ONE
--    SOMEBODY WILL REACH FOR. `0015` established the column-level UPDATE as a
--    least-privilege TOOL (G358, `GRANT UPDATE (assigned_to)`), and the
--    obvious next step is to use the same tool to mount `decideAdmission`
--    cheaply. **That would be the narrow privilege applied to the widest
--    possible consequence.**
--
--    Admission is the checkpoint invariant 6 is enforced at: *"Without this
--    checkpoint, 'the agent read the email' and 'the agent obeyed the email'
--    are the same event."* The decision is gated on `capabilityToAdmit`
--    CONJOINED with `orgClassesThatMayAdmit` CONJOINED with
--    `secondPersonToAdmitAboveClass`, and **`CorrespondenceConfig` has no
--    table**, so a handler holding this privilege today would be taking the
--    product's most security-sensitive decision with two of its three gates
--    unreadable. Derive the absence:
--        grep -rnE '^[^-]*(correspondence_config|orgClassesThatMayAdmit)' db/migrations/
--    → nothing. (G2181 — the unanchored form answered TWO, both of them this
--    paragraph and the sentence above it.) The grant lands with the config, the gate and the test that
--    each arm refuses — in one commit, `0009`'s rule.
--
-- ---------------------------------------------------------------------
-- 🛑 NO `DELETE` ANYWHERE. A sweep's verb, and there is no sweep. `0012` and
--    `0015` both say the same about erasure. It matters more here: the
--    disclosure history of what a tenant told a third party is the record an
--    erasure request is answered FROM, and a request path that could delete it
--    could delete the evidence that the request was honoured.
-- =====================================================================

GRANT SELECT ON tenant.counterparty                    TO tenant_rw;
GRANT SELECT ON tenant.correspondence_thread           TO tenant_rw;
GRANT SELECT ON tenant.correspondence_thread_exception TO tenant_rw;
GRANT SELECT ON tenant.correspondence_message          TO tenant_rw;

-- =====================================================================
-- 0014 — INVARIANT 10's THREE EVENT STREAMS. G317 (19 Sep 2026).
--
-- **THE SUCCESSOR `tests/http/authorisation-record.test.ts` §8 WAS WAITING
--   FOR, AND THAT FILE NAMED THE CONDITIONS IN ADVANCE.** Its assertion —
--   that `audit_event`, `data_access_event` and `usage_record` do not exist —
--   goes RED on this file, deliberately, and its own words are the
--   instruction this commit follows: *"Do not delete this assertion to go
--   green; replace it with the positive one, which is exactly what this file
--   did to the tripwire it replaced."* It is replaced, not deleted, in this
--   commit.
--
-- `CLAUDE.md`, verbatim, because a paraphrased invariant is a changed
-- invariant:
--
--     "10. **An act with no authorisation is unrecordable.** `authorize()`
--      mints an `AuthorizationGrant` and nothing else does; `AuditEvent`,
--      `DataAccessEvent` and `UsageRecord` all carry its id, and
--      `AUTHORIZATION_MAY_BE_ABSENT` says which actor kinds may leave it null
--      (one: `system`). This does **not** make an unauthorised act impossible
--      — nothing can, against root — it makes one visible or detectable,
--      which is strictly more than the model had."
--
-- 🛑 THE CLAUSE THIS FILE ADDRESSES IS THE MIDDLE ONE, AND NOTHING MORE.
--    *"`AuditEvent`, `DataAccessEvent` and `UsageRecord` all carry its id"* —
--    that is three tables, three columns, and a rule about when the column
--    may be null. `0010_authorisation_record.sql` built the thing the id
--    points AT. This builds the three things that point at it. **Neither
--    file, nor both together, makes an unauthorised act impossible.**
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 READ THIS BEFORE READING A COLUMN: **NOTHING WRITES THESE TABLES FROM A
--    REQUEST PATH, AND THAT IS STATED HERE RATHER THAN DISCOVERED LATER.**
-- ═══════════════════════════════════════════════════════════════════════
--
-- `CLAUDE.md` says, in its own voice and about `0010`: *"a served read
-- records THE AUTHORISATION IT RAN UNDER and not THE ACCESS. **Nobody should
-- read an access log off `tenant.authorization_grant`.**"* **THAT SENTENCE IS
-- STILL TRUE AFTER THIS FILE**, and the reason is not that the table is
-- missing any more — it is that the three streams carry terms with **no
-- producer in this repository**:
--
--   `DataAccessEvent.maxDataClass`  — *"Highest classification actually
--        returned."* Nothing computes one. Invariant 4 says classification is
--        declared once on `FieldSpec` and that **a key with no `FieldSpec` is
--        UNREADABLE**; G106's rejected alternative was *"defaulting unmapped
--        keys to the most sensitive class … readable-by-default-with-a-high-
--        bar is scope failing OPEN."* A served read that stamped a guessed
--        class into an append-only, hash-chained stream would put a FALSE
--        classification beyond amendment — worse than the gap, and the same
--        shape as *"an audit trail that reads as evidence and is not."*
--   `AuditEvent.action` / `before` / `after` — nothing on this plane performs
--        a tenant WRITE. Both run operations are reads.
--   `UsageRecord.meter` / `quantity` / `dataPlaneId` / `sequence` — nothing
--        meters, and there is no `data_plane` table for `dataPlaneId` to name.
--   `RecordChain.sequence` — the CANONICALISER exists (`model/canonical.ts`,
--        RFC 8785, G20, applied 9 Aug 2026 — ⚠️ which makes `RecordChain`'s
--        own warning, *"NO CANONICALISATION SCHEME IS DEFINED ANYWHERE IN
--        THIS REPOSITORY"*, STALE; it is that module's to correct, not this
--        file's). What does NOT exist is a SEQUENCE ALLOCATOR: a monotonic,
--        gapless counter per tenant per stream, allocated under concurrency.
--        The unique constraints below make a duplicate impossible; they do not
--        hand anybody the next number.
--
-- ⚠️ SO THIS FILE IS A SCHEMA AHEAD OF ITS WRITERS, WHICH IS THE THING
--    `0004_subject_ledger.sql` REFUSES, AND THE DEPARTURE IS ARGUED RATHER
--    THAN SLIPPED PAST.
--
--    0004's rule: *"a `NOT NULL` column no code path populates is not
--    enforcement of invariant 10; it is the appearance of it."* And `0010`
--    sharpens it: *"A table here and a writer in a later commit would be the
--    0004 shape arriving a second time."*
--
--    **The distinction is what the artefact CLAIMS.** 0004's refused column
--    claimed an enforcement it did not perform. `0010`'s table claims that an
--    act leaves a record, and a writerless version of it would have made
--    invariant 10 a lie. **These three tables claim nothing.** They are the
--    ANSWER TO ONE QUESTION, and G317 is explicit that the question is single:
--    *"which stream carries what is a single question, and answering it three
--    times across three commits is how two vocabularies for one concept get
--    started — §5.3, which this record has already caught twice."* A shape
--    cannot be answered by a writer that has no terms to write.
--
--    ⚠️ AND THE COST IS NAMED RATHER THAN ABSORBED: until a writer exists,
--    **every property below is a property of the SCHEMA and of the store in
--    `server/data-plane/event-stream-store.ts`, witnessed by
--    `tests/db/event-streams.test.ts` over a real PostgreSQL as the app role**
--    — and none of them is a property of any served request.
--    `0007_run_engine_account.sql` set this precedent the same day and named
--    the same tension on its own face; the store lands with the schema for
--    that file's reason — *a column with no reader is a column nothing
--    checks*.
--
-- ═══════════════════════════════════════════════════════════════════════
-- RULINGS THIS APPLIES (docs/HANDOFF.md §3):
--   G317  the three streams land in ONE migration, each carrying the
--         authorisation id, with `AUTHORIZATION_MAY_BE_ABSENT` enforced AT
--         THE COLUMN. **Enforced on two of the three. See the `usage_record`
--         header — the third carries no actor, so there is nothing to key the
--         constraint on, and that is reported rather than faked.**
--   G301  append-only as a PRIVILEGE, inherited from `0010` unchanged:
--         `SELECT, INSERT`, no `UPDATE`, no `DELETE`.
--   G303  `AssignmentScope`'s six dimensions get columns with the first
--         MOUNTED operation that READS one. **There are none here**, and
--         `decision.scope` is `DENY_ALL` for every row this database can
--         produce.
--   G97   every branded id is `text`; the slug is stored VERBATIM. **THERE IS
--         NO `uuid` ANYWHERE IN THIS FILE AND THERE IS NONE IN THIS MODEL.**
--   G100  every policy DENIES on NULL. A forgotten `set_config` yields an
--         EMPTY result set — and, on a write, a refusal.
--   G101  transaction-mode pooling assumed; `SET LOCAL` only, through
--         `db/tenant-scope.ts`. This file adds no helper.
--   G88   forward-only. There is no `down`. 0001–0013 ARE NOT EDITED BY THIS
--         FILE.
--
-- ⚠️ SCHEMA-QUALIFIED THROUGHOUT, because 0003 requires it from 0004 on.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE COLUMN RULE THIS FILE HOLDS ITSELF TO, STATED ONCE AND APPLIED
--    THREE TIMES: **EVERY COLUMN IS A DECLARED FIELD, AND EVERY DECLARED
--    FIELD IS A COLUMN. NOTHING IS INVENTED AND NOTHING IS DROPPED.**
-- ═══════════════════════════════════════════════════════════════════════
--
-- 0008's rule is *"the column set is the predicate's and not the
-- interface's"*, and it is the right rule for a table that exists to serve one
-- policy expression. **It is the wrong rule here, and the reason is the store.**
-- `writeAuditEvent()` takes an `AuditEvent` — the model's own type, whole —
-- because a store that took a NARROWED type would be a second vocabulary for
-- the thing G317 exists to keep single, and a store that took the whole type
-- and dropped a field would be a writer that silently loses the authority the
-- field was added to carry.
--
-- The one discipline that survives from 0004 is the one that still bites:
-- **no column may be invented.** Where the model declares nothing, this file
-- stores nothing — there is no `revoked_at`, no `redeemed_at`, no scope
-- column, and no discriminant on any flattened union.
--
-- ⚠️ AND WHERE THE MODEL IS INTERNALLY IN TENSION, THE TENSION IS RECORDED
--    RATHER THAN RESOLVED BY A COLUMN CHOICE. See `usage_record.shipped_at`
--    and `.tags_locked_at`, both of which the declaration expects to be SET
--    LATER and which the inherited append-only privilege makes unsettable.
-- =====================================================================


-- ═══════════════════════════════════════════════════════════════════════
-- THE ACTOR, FLATTENED — `AuditActor`, a FIVE-ARM DISCRIMINATED UNION, and
-- the shape both event tables below repeat.
--
-- Derive the declaration, do not read it here:
--   grep -n 'export type AuditActor' -A 90 model/governance.ts
--
-- 🛑 EIGHTEEN COLUMNS FOR ONE FIELD, AND THE ALTERNATIVE WAS WORSE IN A WAY
--    THE DECLARATION ITSELF NAMES. Every arm's payload is AUTHORITY, and
--    `AuditActor` says why it is inline rather than joined: *"a row must
--    reach its authority without traversing a mutable table."* A narrower
--    column set would put `partnerId`, `supportGrantId`,
--    `supportAuthorisationId` and the agent's `onBehalfOf` back behind a join
--    to a table that changes — which is the asymmetry §8.3 added them to
--    close: *"an agent's read could be traced to the authority behind it and
--    a human's could not."*
--
-- 🛑 AND G88 IS WHAT MAKES THE WIDTH NON-NEGOTIABLE RATHER THAN MERELY
--    PREFERABLE. Migrations are FORWARD-ONLY, and `UsageRecord.authorizationId`
--    already records what that costs a stream that starts narrow: *"⚠️ NOT
--    BACKFILLABLE. Every record written before this field existed carries null
--    and is indistinguishable from a legitimate machine sample. The cut-over
--    date is the only thing separating them, and it is not on the row."*
--    **An append-only stream is the one place a column added later is a
--    permanent hole.** These tables hold no rows today, so the width costs
--    nothing and the narrowness would have cost everything.
--
-- ⚠️ NO `CHECK` MAKING THE ARM PAIRING EXCLUSIVE, for
--    `0009_identity_substrate.sql`'s reason on `IdentityConnection.owner`,
--    which is the same three-columns-for-one-union shape: *"a malformed row …
--    is possible in this table and is REFUSED BY THE READER."* That is
--    `readAuditEvent()`'s job on the day one is written, and there is no
--    reader today — so the absence here is the same absence, and it is the
--    one place this file's "every field a column" rule and 0009's reader-
--    refusal rule agree.
--
-- ⚠️ NO `CHECK` ON `actor_kind`, `actor_org_class`, `max_data_class` OR
--    `meter` EITHER, for `0002_run.sql`'s reason in its own words — a third
--    copy of a closed enum is *"a third place to drift, and the one nothing
--    checks, because no pair in the wire-mirror addresses SQL."* **The ONE
--    constraint below that names a member of a closed set is a different
--    thing and argues itself where it stands.**
-- ═══════════════════════════════════════════════════════════════════════


-- ---------------------------------------------------------------------
-- THE WRITE STREAM — `AuditEvent`, `model/domain.ts`.
--
--   grep -n 'export interface AuditEvent extends TenantScoped' -A 80 model/domain.ts
--
-- *"The current Admin UI advertises 'Audit Logs' and no such route, surface or
-- API exists."* It still does not; this is the table one would be built on.
--
-- THE PRIMARY KEY IS COMPOSITE for `0010`'s reason and for `0009`'s: a
-- cross-tenant reference has to be UNREPRESENTABLE rather than merely
-- unlikely.
--
-- 🛑 `before` AND `after` ARE `jsonb`, AND THE PROBLEM THEY INHERIT IS NAMED
--    HERE RATHER THAN DISCOVERED BY THE FIRST WRITER.
--
--    `0007_run_engine_account.sql` refused a `jsonb` operand column on G106's
--    ground: *"a JSONB key with no `FieldSpec` is UNREADABLE — so the findings
--    would be stored and unaddressable, and a result nobody may read is not
--    persistence."* **That argument does not transfer, and the reason is what
--    the column is FOR.** 0007's operand column was the only home for a value
--    the PRODUCT must read back by key; a before/after image is read WHOLE, by
--    an auditor, and is never addressed by key by anything.
--
--    ⚠️ WHAT DOES TRANSFER IS THE HALF NOBODY SHOULD SKIP: an image of a
--    changed row can carry values of any `DataClass`, and **nothing here
--    classifies them**, so nothing can redact them on a subject-erasure path
--    and nothing can hold them below a model-processing ceiling. That is
--    invariant 4's question arriving on this column, unanswered. It is not
--    answered by omitting the column — `AuditEvent` declares it, and a store
--    that dropped it would lose what changed while claiming to record it. It
--    is `0009_identity_substrate.sql`'s formula for `label`, applied:
--    **nothing writes this column today, and the first thing that does
--    inherits that question and does not get to skip it.**
-- ---------------------------------------------------------------------

CREATE TABLE tenant.audit_event (
  tenant_id       text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  -- `AuditEvent.id` is a BARE `string` in the model and stays bare here. R4.
  id              text        NOT NULL,

  /* --- `chain: RecordChain` — tamper evidence, flattened. -------------- *
   * *"Monotonic per tenant per stream. Gaps are the detection; absence of a
   * row is invisible without it."* The uniqueness is stated below, per
   * tenant, because the declaration scopes the counter per tenant per stream
   * and this table IS one stream. */
  chain_sequence      integer NOT NULL,
  -- *"Null only at sequence 1."* Represented as a null rather than as a
  -- sentinel hash: a sentinel would be a value the verifier has to know about,
  -- and a chain whose head is indistinguishable from a link is a chain that
  -- can be re-rooted.
  chain_previous_hash text,
  chain_body_hash     text    NOT NULL,

  /* --- `actor: AuditActor` — the five arms, flattened. ----------------- */
  actor_kind                      text NOT NULL,
  -- `user` · `partner_staff` · `platform_staff`. Null on `system` and `agent`,
  -- neither of which carries one — an agent reaches a person through
  -- `on_behalf_of` and machinery reaches nobody.
  actor_user_id                   text,
  -- `user` arm. *"Org is DERIVED from the identity connection at
  -- authentication and stamped here at write time, because an IdP knows who
  -- someone is now and an audit needs who they were then."*
  actor_org_class                 text,
  -- `user` arm. *"Null ONLY where no assignment was in the path."* A null here
  -- is therefore meaningful in two different ways — arm-absent and
  -- within-arm-absent — and `actor_kind` is what tells them apart.
  actor_assignment_id             text,
  -- `partner_staff` arm.
  actor_partner_id                text,
  actor_grant_id                  text,
  -- `platform_staff` arm. *"Null where there was none to draw against — a
  -- grant predating the regime, or a `BreakGlassPreservation` … A null is
  -- therefore meaningful rather than missing, and is the row an auditor should
  -- read first."*
  actor_support_grant_id          text,
  actor_support_authorisation_id  text,
  -- `system` arm. *"Genuine machinery — a scheduler, a retention sweep. NOT an
  -- agent."*
  actor_component                 text,
  -- `agent` arm. `stepId` and `stepExecutionId` are BARE in the model
  -- deliberately — *"branding them is the identity sweep's business, not the
  -- trim's"* — and stay bare here.
  actor_step_id                   text,
  actor_step_execution_id         text,
  -- BRANDED `ModelCatalogEntryId` in the model. ⚠️ THIS IS NOT
  -- `UsageRecord.model`: that one is a LIVE residency bypass and this one is
  -- not. See the `usage_record` header, which says so at length so the two are
  -- never read as the same column.
  actor_model_id                  text,
  -- `agent.onBehalfOf` — a two-arm union nested inside a five-arm one.
  -- `user` | `policy`.
  actor_on_behalf_of_kind             text,
  actor_on_behalf_of_user_id          text,
  actor_on_behalf_of_assignment_id    text,
  actor_on_behalf_of_policy_id        text,
  actor_on_behalf_of_policy_version   integer,

  /* --- THE SPINE. ------------------------------------------------------ *
   * *"The authorisation this write ran under — the same id carried by
   * `DataAccessEvent` and `UsageRecord`, so who / what / cost is ONE query."*
   *
   * NO FOREIGN KEY to `tenant.authorization_grant`, and the absence is a
   * decision rather than an omission. `0010`'s table is append-only but its
   * rows are minted with a TTL of minutes and `ON DELETE CASCADE` from
   * `tenant.tenant`; a foreign key would make an event stream's rows
   * deletable by a path that deletes a grant, and would make the event
   * unwritable in any transaction that had not already committed its grant.
   * **An event stream must be able to outlive the row it names.** The cost is
   * the one `0010` already names for `assignment_id`: an id that resolves to
   * nothing is possible, and a reader must discriminate rather than assume. */
  authorization_id text,

  -- *"Never parsed"* — the `(subjectType, subjectId)` pair IS the identifier,
  -- and it is deliberately identical in shape to `DataAccessEvent`'s, because
  -- *"the two streams answer 'who read this and who changed it' together, and
  -- a divergence in this pair between them is what would break that join."*
  action          text        NOT NULL,
  subject_type    text        NOT NULL,
  subject_id      text        NOT NULL,
  -- `Json | null`. See the header block above before writing one.
  before_image    jsonb,
  after_image     jsonb,
  at              timestamptz NOT NULL,

  PRIMARY KEY (tenant_id, id),

  /* 🛑 THE COLUMN-LEVEL RULE G317 NAMES, AND IT NAMES ONE VALUE RATHER THAN
   * ENUMERATING A SET.
   *
   * `authorizationIsWellFormed()` is `AUTHORIZATION_MAY_BE_ABSENT[actor.kind]`
   * and nothing else. This is that function, made unrepresentable instead of
   * remembered — G317: *"A nullable column with a review convention behind it
   * is §5.6 wearing a schema."*
   *
   * ⚠️ IT IS NOT `0002_run.sql`'s FORBIDDEN THIRD COPY. That prohibition is on
   * transcribing a CLOSED ENUM into SQL, where a member added in TypeScript
   * leaves the SQL list silently short. This constraint transcribes NO list:
   * it names the single member `AUTHORIZATION_MAY_BE_ABSENT` admits. A sixth
   * `AuditActor` variant does not make it wrong — the new kind is DENIED a
   * null, which is the fail-closed direction and the same direction the model
   * takes, where `Record<AuditActor['kind'], boolean>` is a COMPILE ERROR
   * until somebody decides.
   *
   * ⚠️ AND IF SOMEBODY DECIDES THE NEW KIND MAY BE ABSENT, THIS IS A SECOND
   * PLACE TO EDIT — which is drift, and is answered the way
   * `0008_staff_grant_selection.sql` answers the same problem for the three
   * governance lists: **a test asserting set equality with `model/governance.ts`
   * in BOTH directions.** `tests/db/event-streams.test.ts` §2 derives the
   * permitted set from `AUTHORIZATION_MAY_BE_ABSENT` itself and requires the
   * DATABASE to accept a null for exactly those kinds and refuse it for
   * exactly the others — so a sixth variant turns the suite red without
   * anybody remembering this paragraph.
   *
   * 🛑 AND IT DOES NOT MAKE ANY REFUSAL UNTESTABLE, WHICH IS THE TRAP
   * `0009_identity_substrate.sql` RECORDS. That file declined a `CHECK` on the
   * connection owner pairing because the control there IS THE READER'S
   * REFUSAL, and a reader cannot be witnessed refusing a row the database
   * will not store. **Nothing here is like that.**
   * `authorizationIsWellFormed()` is a pure function over VALUES, not over
   * rows: `tests/http/authorisation-record.test.ts` §1 witnesses all five
   * kinds with object literals and touches no database at all. The constraint
   * removes no witness; it adds one. */
  CONSTRAINT audit_event_authorisation_present
    CHECK (authorization_id IS NOT NULL OR actor_kind = 'system'),

  /* *"Gaps are the detection"* — and a DUPLICATE is the other half. Two rows
   * at one sequence make the chain ambiguous about which body the next
   * `previous_hash` covers, which is a fork rather than a gap and is
   * undetectable by counting. */
  CONSTRAINT audit_event_chain_sequence_unique UNIQUE (tenant_id, chain_sequence)
);

-- *"What happened here, most recent first"* — `tenant_id` leads because
-- `audit_event_rls` has already narrowed to one tenant before the index is
-- consulted. Same shape as `authorization_grant_subject_idx`.
CREATE INDEX audit_event_recent_idx
  ON tenant.audit_event (tenant_id, at DESC);

-- *"Who changed this row"* — the pair is the identifier, so the index is on
-- the pair.
CREATE INDEX audit_event_subject_idx
  ON tenant.audit_event (tenant_id, subject_type, subject_id, at DESC);

-- 🛑 THE SPINE JOIN, AND IT IS THE INDEX THE WHOLE RULING IS FOR. *"who / what
-- / cost is ONE query"* is three seeks on this key across three tables.
CREATE INDEX audit_event_authorisation_idx
  ON tenant.audit_event (tenant_id, authorization_id);


-- ---------------------------------------------------------------------
-- THE READ STREAM — `DataAccessEvent`, `model/governance.ts`.
--
--   grep -n 'export interface DataAccessEvent extends TenantScoped' -A 40 model/governance.ts
--
-- *"Read access to sensitive data is itself an event."*
--
-- 🛑 THIS IS THE STREAM THE RECORD SAYS THE JOIN MATTERS MOST ON, AND THE ONE
--    `CLAUDE.md` NAMES AS MISSING: *"a served read records THE AUTHORISATION
--    IT RAN UNDER and not THE ACCESS."* The declaration's own version:
--    *"`maxDataClass` records HOW SENSITIVE the read was and `actor` records
--    WHO — and the authorisation that permitted a `sensitive_personal` read
--    was computed, used, and discarded. So the one question a regulator asks
--    first, under what authority was this person's record opened, was
--    answerable only by reconstructing the principal's assignments as they
--    stood at the time, from a table that has since changed."*
--
-- ⚠️ AND THE TABLE EXISTING DOES NOT ANSWER IT. `max_data_class` has no
--    producer — see the header block — so the served path still cannot write
--    a row here, and **`CLAUDE.md`'s sentence stands unchanged until it can.**
--    This file does not license anybody to amend it.
--
-- ⚠️ THE COLUMN SET IS `AuditEvent`'s MINUS `action`, `before` and `after`,
--    PLUS `max_data_class`. That is the model's difference, not a
--    simplification: a read changes nothing, so there is no image to record,
--    and what a read needs instead is how sensitive what it returned was.
--    **The actor block is IDENTICAL, column for column and comment for
--    comment**, for the declaration's own reason about the subject pair: the
--    two streams answer one question together and a divergence between them
--    is what breaks the join.
-- ---------------------------------------------------------------------

CREATE TABLE tenant.data_access_event (
  tenant_id       text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id              text        NOT NULL,

  chain_sequence      integer NOT NULL,
  chain_previous_hash text,
  chain_body_hash     text    NOT NULL,

  actor_kind                      text NOT NULL,
  actor_user_id                   text,
  actor_org_class                 text,
  actor_assignment_id             text,
  actor_partner_id                text,
  actor_grant_id                  text,
  actor_support_grant_id          text,
  actor_support_authorisation_id  text,
  actor_component                 text,
  actor_step_id                   text,
  actor_step_execution_id         text,
  actor_model_id                  text,
  actor_on_behalf_of_kind             text,
  actor_on_behalf_of_user_id          text,
  actor_on_behalf_of_assignment_id    text,
  actor_on_behalf_of_policy_id        text,
  actor_on_behalf_of_policy_version   integer,

  authorization_id text,

  at              timestamptz NOT NULL,
  subject_type    text        NOT NULL,
  subject_id      text        NOT NULL,
  -- *"Highest classification actually returned."* NOT the highest the caller
  -- was permitted to see, and not a declared ceiling — a fact about the bytes
  -- that left. **Nothing computes one. See the header.**
  max_data_class  text        NOT NULL,

  PRIMARY KEY (tenant_id, id),

  /* The same constraint, the same argument, the same test. It is stated twice
   * rather than factored into a shared domain because a `CREATE DOMAIN`
   * carrying a predicate over ANOTHER column is not expressible, and a trigger
   * would be a third mechanism where two suffice. The sameness across the two
   * tables is load-bearing rather than tidy — a reader comparing them should
   * find it identical. */
  CONSTRAINT data_access_event_authorisation_present
    CHECK (authorization_id IS NOT NULL OR actor_kind = 'system'),

  CONSTRAINT data_access_event_chain_sequence_unique UNIQUE (tenant_id, chain_sequence)
);

CREATE INDEX data_access_event_recent_idx
  ON tenant.data_access_event (tenant_id, at DESC);

-- *"Who read this"* — the question a subject-access request starts from.
CREATE INDEX data_access_event_subject_idx
  ON tenant.data_access_event (tenant_id, subject_type, subject_id, at DESC);

CREATE INDEX data_access_event_authorisation_idx
  ON tenant.data_access_event (tenant_id, authorization_id);


-- ---------------------------------------------------------------------
-- THE METER STREAM — `UsageRecord`, `model/billing.ts`.
--
--   grep -n 'export interface UsageRecord' -A 110 model/billing.ts
--
-- *"One metered fact. Append-only; never updated, never priced."*
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 INVARIANT 5 GOVERNS THIS TABLE AND IT IS THE FIRST THING TO READ.
-- ═══════════════════════════════════════════════════════════════════════
--
-- *"**Money is always derived.** `UsageRecord` is immutable and unpriced —
-- which is why `metering` is its own resource class: it has **no write mode**,
-- and it cannot live in `commercial`, whose defining rule is that a partner
-- may read it. A raw usage record is volume in the clear."*
--
-- **SO: THERE IS NO PRICE COLUMN, NO RATE COLUMN, NO DERIVED TOTAL AND NO
-- CURRENCY ANYWHERE BELOW, AND THERE MUST NEVER BE ONE.** `MeterPrice` and
-- `PriceTier` are both `@dropped-for-v1` and a rating column here would
-- un-drop them in SQL. The unit is `quantity`; the money is somewhere else,
-- derived, and a partner who could read this table would be reading the
-- customer's volume rather than their invoice.
--
-- 🛑 `quantity` IS `numeric` AND NOT `double precision`, AND NOT AN INTEGER.
--    *"Integer where the meter is countable; decimals only for storage."* A
--    float would make a token count inexact on the one record class that is
--    the billing spine; a bare integer would make `storage_gb_month` — the one
--    STOCK meter, per `METER_AGGREGATION` — unrepresentable. `numeric` is
--    exact and holds both. **This is not money and G111 does not apply:
--    `model/money.ts` is the only thing that may convert a `Money`, and there
--    is no `Money` on this record by construction.**
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 **G317's COLUMN-LEVEL ENFORCEMENT IS NOT AVAILABLE ON THIS TABLE, AND
--    THAT IS REPORTED RATHER THAN FAKED.** READ THIS BEFORE ADDING A `CHECK`.
-- ═══════════════════════════════════════════════════════════════════════
--
-- The ruling says *"`AUTHORIZATION_MAY_BE_ABSENT` IS ENFORCED AT THE COLUMN,
-- NOT IN REVIEW"*, and on the two event tables above it is. **`UsageRecord`
-- carries no actor at all.** It has no `AuditActor`, no `kind`, and no field
-- from which one could be derived — so there is no discriminant for a `CHECK`
-- to key on, and the constraint that holds above is not expressible here.
--
-- What the declaration says the null MEANS is unchanged and is the reason the
-- gap is narrow rather than alarming: *"NULL IS LEGITIMATE FOR
-- MACHINE-ORIGINATED CONSUMPTION — a retention sweep's storage sample, a
-- scheduled re-index — matching `AUTHORIZATION_MAY_BE_ABSENT.system` …
-- `storage_gb_month` is the standing example: it is a STOCK sampled on a timer,
-- and no principal incurred any particular sample."*
--
-- **THREE REPAIRS WERE CONSIDERED AND ALL THREE ARE REFUSED, WITH REASONS,
-- SO THE NEXT READER ARGUES RATHER THAN REPEATS:**
--
--   1. `CHECK (authorization_id IS NOT NULL OR meter = 'storage_gb_month')`.
--      REFUSED. It is over-narrow — *"a scheduled re-index"* emits countable
--      meters too — and it is exactly `0002_run.sql`'s forbidden third copy of
--      a closed enum, transcribing a `METERS` member into SQL where a rename
--      leaves the constraint silently wrong.
--   2. An invented `actor_kind` column. REFUSED, and this is the important
--      one. `UsageRecord` is **the one record class that SHIPS TO THE CONTROL
--      PLANE**, and it is safe to ship precisely because it is *"PII-free BY
--      CONSTRUCTION — tenant, meter, quantity, model, cost centre, and no
--      content field at all."* The declaration argues at length that an
--      `AuthorizationGrantId` was chosen over a `UserId` because *"an
--      `AuthorizationGrantId` is an opaque scalar that identifies nobody"* and
--      a principal identifier *"would cross the plane boundary on every
--      metered event and break invariant 3."* Adding a principal ATTRIBUTE to
--      win a constraint re-opens the question that argument settled.
--   3. An invented `machine_component` column mirroring
--      `AuditActor.system.component`, with `CHECK (authorization_id IS NOT
--      NULL OR machine_component IS NOT NULL)`. REFUSED for (2)'s reason plus
--      one more: `component` is a free string, and a free string on the record
--      that crosses the plane boundary is a content field on the one record
--      that has none.
--
-- **WHAT IS THEREFORE TRUE, EXACTLY:** on this table the rule lives in
-- `authorizationIsWellFormed()` and in the writer, and the database does not
-- enforce it. `tests/db/event-streams.test.ts` §4 asserts that absence
-- DELIBERATELY — the `tests/http/authorisation-record.test.ts` §8 shape,
-- reused on purpose — so that adding a constraint here is a RED TEST and a
-- ruling rather than a quiet improvement.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 TWO DECLARED FIELDS ARE SET AFTER INSERT AND THE INHERITED PRIVILEGE
--    MAKES THAT IMPOSSIBLE. THE COLLISION IS RECORDED, NOT RESOLVED.
-- ═══════════════════════════════════════════════════════════════════════
--
-- `UsageRecord`'s own header says *"Append-only; never updated"*, and then
-- declares two fields whose documented behaviour is an update:
--
--   `shippedAt`    *"Null while still buffered in a data plane that is
--                  offline; replay preserves `sequence` and `recordedAt`."*
--   `tagsLockedAt` *"Set at close. Non-null means the attribution is frozen …
--                  Enforced against BillingPeriod.status, not by convention."*
--
-- **The app role holds no `UPDATE` on this table, so neither can ever be set
-- after the row is written.** Both columns exist — the rule of this file is
-- that no declared field is dropped — and both can only ever carry their
-- insert-time value.
--
-- ⚠️ THE COLUMNS ARE NOT THE DEFECT AND REMOVING THEM WOULD NOT FIX IT. G317
--    already states the shape the successor must take, in its own voice:
--    *"Revocation is therefore a NEW ROW superseding an old one, never an
--    `UPDATE`."* Shipping and tag-locking are the same problem wearing a
--    different noun, and the answer is the same — a superseding row, or the
--    control plane's own copy, which the declaration already calls *"the
--    BILLING record"* while this one is *"the buffer"*.
--
--    🛑 AND ONE HALF OF IT IS ALREADY SOLVED BY THE PRIVILEGE RATHER THAN BY A
--    COLUMN. `costCenter` is *"Immutable once its billing period closes —
--    re-tagging after close would silently rewrite a customer's chargeback
--    history."* Under `SELECT, INSERT` and no `UPDATE`, re-tagging is
--    impossible at any time, closed period or not. **The constraint subsumes
--    the field it was going to be enforced by**, and `tags_locked_at` is
--    therefore a column with nothing left to protect — which is why it is
--    listed here rather than quietly kept.
--
-- 🛑 `NO FOREIGN KEY` ON `run_id`, `pack_id` OR `data_plane_id`. There is no
--    `data_plane` table and no `pack` table in this database at all, and
--    `run_id` is deliberately unbound for the reason the spine column above
--    states: a metered fact must be able to outlive the thing it meters, and a
--    cascade from `run` would delete billing evidence.
-- ---------------------------------------------------------------------

CREATE TABLE tenant.usage_record (
  -- ⚠️ `UsageRecord` does NOT extend `TenantScoped` — it declares `tenantId`
  -- itself — and the column is identical either way. The RLS below does not
  -- care which, and neither should a reader.
  tenant_id        text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id               text        NOT NULL,
  -- *"Which plane emitted it. `sequence` below is monotonic PER DATA PLANE, on
  -- a record that did not name its plane — so the gap check could not be
  -- run."*
  data_plane_id    text        NOT NULL,
  -- *"Deduplication key, taken from the provider's own request id where one
  -- exists. At-least-once delivery otherwise double-counts tokens into an
  -- append-only table that has no compensating instrument."*
  idempotency_key  text        NOT NULL,
  -- *"When the metered event happened."*
  at               timestamptz NOT NULL,
  -- *"When the PLANE recorded it. NOT the billing period key."* The two are
  -- separate columns because a customer-owned plane's clock is the customer's:
  -- *"a plane three days slow shifted revenue across a period boundary, into
  -- an append-only table with no compensating instrument."*
  recorded_at      timestamptz NOT NULL,
  -- *"Monotonic per data plane … so a gap in this sequence is detectable
  -- rather than merely absent."*
  sequence         bigint      NOT NULL,
  -- *"Null while still buffered."* Unsettable after insert — see the header.
  shipped_at       timestamptz,
  meter            text        NOT NULL,
  -- See the header: `numeric`, and never a price.
  quantity         numeric     NOT NULL,

  /* THE SPINE, on the meter stream. *"This record named a tenant, a plane, a
   * run, a pack, a cost centre and a model, AND NO PRINCIPAL AT ALL … 'Who
   * authorised the run that spent it, and were they allowed to' was
   * unanswerable from stored rows."*
   *
   * Nullable, and on THIS table the database does not say when. See the header
   * block, which argues why and names the three repairs it refuses. */
  authorization_id text,

  run_id           text,
  domain           text,
  pack_id          text,
  -- *"Customer-defined allocation tag. Opaque to the platform."* ⚠️ THE ONE
  -- COUNTERPARTY-AUTHORED STRING ON THE RECORD THAT CROSSES THE PLANE
  -- BOUNDARY, and the declaration has already ruled it safe to ship by listing
  -- it among the PII-free fields. Nothing renders it; invariant 6 arrives with
  -- the first thing that does.
  cost_center      text,
  -- *"Set at close."* Unsettable after insert — see the header, which argues
  -- that the append-only privilege has already done this column's job.
  tags_locked_at   timestamptz,
  /* 🛑 THE LIVE RESIDENCY BYPASS, STORED AS IT IS AND LAUNDERED BY NOTHING.
   *
   * `UsageRecord.model` is a bare `string` in the model — one of the two live
   * bypasses `CLAUDE.md` lists under *"On invariant 7"* — and it reaches a
   * model identity **without passing `resolveModel()`, which is the only
   * executable enforcement of invariant 7 in this codebase.**
   *
   * ⚠️ IT IS NOT FIXED HERE AND MUST NOT BE. Branding it is a MODEL ruling
   * nobody has taken, and `CLAUDE.md` is explicit that *"No document may claim
   * the sweep closed E5."*
   *
   * ⚠️ AND IT IS NOT LAUNDERED HERE EITHER, WHICH IS THE SUBTLER HALF.
   * `audit_event.actor_model_id` two tables up is a `ModelCatalogEntryId` and
   * has been since 7 Aug 2026; this column is not, and the two must never be
   * read as the same fact or joined as though they were. **A value in this
   * column asserts NOTHING about whether the catalogue ever saw it, and a
   * reader that resolved it against `ModelCatalogEntry` would be inventing a
   * check that did not happen.** */
  model            text,

  PRIMARY KEY (tenant_id, id),

  /* 🛑 THE TWO CONSTRAINTS THAT SPAN TENANTS, AND THEY MUST, WHICH MAKES THEM
   * THE ONLY ONES OF THEIR KIND IN THIS DIRECTORY.
   *
   * `sequence` is monotonic PER DATA PLANE and a hosted plane serves many
   * tenants, so a per-tenant uniqueness would let two tenants on one plane
   * both claim sequence 41 and would make the fleet-wide gap check — the whole
   * reason the field exists — assert nothing. Same for the deduplication key,
   * which comes from the provider and is replayed by the plane.
   *
   * ⚠️ THE COST IS NAMED: a unique index is enforced regardless of RLS, so a
   * colliding INSERT tells the writer that SOME row exists with that key,
   * across the tenant boundary. That is an existence oracle on a monotonic
   * counter and on a provider request id, and it carries no tenant content, no
   * principal and no volume. It is the price of the gap check being real. */
  CONSTRAINT usage_record_plane_sequence_unique UNIQUE (data_plane_id, sequence),
  CONSTRAINT usage_record_idempotency_unique    UNIQUE (data_plane_id, idempotency_key)
);

CREATE INDEX usage_record_recent_idx
  ON tenant.usage_record (tenant_id, at DESC);

CREATE INDEX usage_record_authorisation_idx
  ON tenant.usage_record (tenant_id, authorization_id);


-- =====================================================================
-- ROW-LEVEL SECURITY.
--
-- `ENABLE` and `FORCE`, both, on all three — `0001`'s argument unchanged and
-- repeated because it is what makes the negative control in
-- `tests/db/event-streams.test.ts` mean anything: `ENABLE` alone leaves the
-- TABLE OWNER exempt, so a test connecting as the owner passes with the policy
-- doing nothing and passes just as well with the policy DROPPED. `FORCE` is
-- what makes the explicit `BYPASSRLS` attribute on `reconcile_migrator` the
-- ONLY route to the exemption.
--
-- 🛑 `WITH CHECK` IS STATED ON ALL THREE, because the app role WRITES all
--    three — `0009_identity_substrate.sql`'s standing rule: *"The commit that
--    grants a write here owes the `WITH CHECK` in the same commit as the
--    writer."* It is stated rather than left to default from `USING`, for
--    `0005`'s reason: *"so that a later `FOR SELECT`/`FOR ALL` edit cannot
--    silently drop the write half."*
--
-- ⚠️ THE ATTACK THE `WITH CHECK` ANSWERS IS `0010`'s, ARRIVING ON THREE MORE
--    TABLES. Without it, a writer that took the tenant from the EVENT OBJECT
--    rather than from the transaction's scope would file one tenant's audit
--    row under another — *"an audit trail that reads as evidence and is not"*.
--    With it, the two must agree or the INSERT fails and the surrounding
--    `withTenantScope()` rolls the act back with it.
-- =====================================================================

ALTER TABLE tenant.audit_event        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.audit_event        FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.data_access_event  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.data_access_event  FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.usage_record       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.usage_record       FORCE  ROW LEVEL SECURITY;

-- `0001`'s predicate, VERBATIM. The sameness across 0001, 0005, 0007, 0008,
-- 0009, 0010 and this file is load-bearing rather than tidy — a reader
-- comparing them should find it identical, and if it is not, this file has
-- quietly re-decided tenancy while claiming to add to it.
--
-- G97 is why there is no cast: every branded id is `text`, and `text` compares
-- like-for-like against `current_setting('app.tenant_id')`. **That comparison
-- IS the predicate.**
CREATE POLICY audit_event_rls ON tenant.audit_event
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY data_access_event_rls ON tenant.data_access_event
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY usage_record_rls ON tenant.usage_record
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- ---------------------------------------------------------------------
-- GRANTS. By name, because 0003 declines `ALTER DEFAULT PRIVILEGES` on this
-- schema.
--
-- 🛑 `SELECT` AND `INSERT`. **NO `UPDATE`. NO `DELETE`.** Inherited from
--    `0010` unchanged and named by G317 as not this commit's to soften:
--    *"append-only as a PRIVILEGE, so nothing on a request path can amend or
--    erase a record of an act."*
--
--    On an EVENT stream that is stronger than it is on the grant table,
--    because these three are the rows an investigation reads. Nothing
--    reachable from a request can edit what it did, or delete the row saying
--    it did — not the handler that wrote it, not a later handler, not a bug in
--    either. The app role holds no `ALTER`, so it cannot drop the policies
--    above; that comes from `createRoles()` in `db/provision.ts`.
--
-- 🛑 AND THE APPEND-ONLY PRIVILEGE IS WHAT MAKES `RecordChain` WORTH HAVING
--    AT ALL. A chain detects a deleted or edited row; a privilege prevents
--    one. Neither is sufficient alone: *"It does NOT defend against a root
--    holder who rewrites the whole chain, and under BYOA that is exactly who
--    holds the database."* The privilege stops the request path; the chain
--    makes the root holder's rewrite detectable; `ChainAnchor` is what makes
--    the chain mean something when the customer holds it. **Only the first of
--    those three exists in this database, and this file adds it.**
--
-- ⚠️ AND THE ONE THING THAT CAN STILL ERASE A ROW IS NAMED, AS `0010` NAMES
--    IT: `ON DELETE CASCADE` from `tenant.tenant`. Deleting a tenant deletes
--    its audit trail, its access log and its usage records — the right answer
--    for a right-to-erasure path and the wrong answer for evidence, and the
--    two have not been reconciled anywhere in this repository. It is 0001's
--    cascade, inherited deliberately rather than quietly diverged from, and
--    these three tables join `tenant.authorization_grant` in the scope of the
--    retention ruling that eventually settles it.
-- ---------------------------------------------------------------------

GRANT SELECT, INSERT ON tenant.audit_event       TO tenant_rw;
GRANT SELECT, INSERT ON tenant.data_access_event TO tenant_rw;
GRANT SELECT, INSERT ON tenant.usage_record      TO tenant_rw;

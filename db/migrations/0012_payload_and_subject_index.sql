-- =====================================================================
-- 0011 — THE PAYLOAD, ITS CLASSIFICATION, AND WHERE THE SUBJECT RESTS.
--        G295, G320, G321, G322. 19 Sep 2026.
--
-- 🛑 THIS FILE IS G106's STORAGE HALF, AND IT IS THE HALF `CLAUDE.md`'s
--    INVARIANT 4 HAS BEEN NAMING AS ABSENT IN ITS OWN VOICE: *"G106's storage
--    half — the JSONB column — is not written: `db/migrations/` holds no
--    payload table."* Derive that it was true until this commit:
--
--        git show HEAD~1 --stat -- db/migrations/ | grep -c payload    → 0
--        grep -rln 'jsonb' db/migrations/                              → 0007 only
--
-- ---------------------------------------------------------------------
-- 🛑 THE THREE THINGS IN THIS COMMIT ARE ONE THING, AND G295 IS THE RULING
--    THAT SAYS SO. READ THIS BEFORE READING ANY TABLE.
--
-- G295: **G106's storage half lands WITH the ingestion wave, not before it and
-- not after it.** Its word for the alternative is **UNRECOVERABLE** —
--
--     "you cannot retroactively discover which rows held whose data, and
--      invariant 4's whole content is that a JSONB key with no `FieldSpec` is
--      UNREADABLE — stored, but unaddressable by any agent, prompt, export or
--      dashboard. A row written before the column exists is therefore not
--      merely unclassified; **it is unclassifiABLE.**"
--
-- So this migration carries THREE things that a later reader will be tempted to
-- split, and splitting them is the one outcome the ruling exists to prevent:
--
--   1 · THE PAYLOAD — `tenant.document_payload`, one `jsonb` column.
--   2 · THE ADDRESSING — `tenant.document_field_spec`, `FieldSpec.path` as a
--       stored column, which is what makes a position in (1) nameable at all.
--   3 · THE REGISTERED LOCATION — `tenant.subject_index_entry`, so a value
--       already stored can be FOUND when a data subject asks.
--
-- ⚠️ "ATTRIBUTABLE" MEANS TWO DIFFERENT THINGS HERE AND THE FILE WOULD BE
--    UNREADABLE IF IT DID NOT SEPARATE THEM:
--
--      READ-attributable   — this position has a `FieldSpec`, so its class is
--                            declared and something may read it. G106's
--                            UNREADABLE is the failure of this one, and it is
--                            FAIL-CLOSED BY DESIGN: an unmapped key stays
--                            stored and stays unreadable, forever, and that is
--                            the rule rather than a gap.
--      ERASURE-attributable — this document is registered as a LOCATION where
--                            some subject's data rests, so an erasure plan can
--                            reach it. G295's UNRECOVERABLE is the failure of
--                            this one, and it is NOT recoverable later: nothing
--                            can walk a jsonb column afterwards and discover
--                            whose data it held, because the index is written
--                            at CREATION time — `SubjectLocation`'s own
--                            declaration says so: *"Written at CREATION time,
--                            not discovered by scanning. A scan cannot find a
--                            value inside a stored Explanation, and an erasure
--                            design that depends on finding it later will
--                            quietly miss it."*
--
--    (1) alone is the UNRECOVERABLE state. (1)+(2) alone is a readable payload
--    nobody can erase. All three, in one transaction, is the property.
--
-- ---------------------------------------------------------------------
-- 🛑 G320 — WHY THIS IS A `jsonb` COLUMN WHEN `0007` REFUSED ONE, ARGUED
--    AGAINST G284'S OWN REASONING RATHER THAN AROUND IT.
--
-- G284 refused a `jsonb` operand column for the run engine and its reason was
-- exact: such a column *"inherits invariant 4's G106 problem directly — a JSONB
-- key with no `FieldSpec` is UNREADABLE, fail-closed by design, so every
-- finding would be stored and unaddressable by any agent, prompt, export or
-- dashboard **until G106's storage half exists — and that half is not written
-- and is its own slice**. A result nobody may read is not persistence."*
--
-- **THIS IS THAT SLICE.** The objection is therefore DISCHARGED here rather
-- than waived, and the discharge is a table and not a sentence:
-- `tenant.document_field_spec` is the addressing G284 said did not exist, it is
-- fully relational and typed, and `server/data-plane/payload-store.ts` reads a
-- position ONLY through it. Nothing about G284's ruling is weakened — its own
-- premise has stopped holding, in the commit that stops it.
--
-- AND THE TWO CASES ARE NOT THE SAME CASE, WHICH IS THE OTHER HALF:
--
--   · `0007`'s refused column would have held OUR OWN DECLARED VOCABULARY —
--     ten findings channels the contract already publishes as typed schemas.
--     There is a closed set of arms, so there are typed columns to have, and
--     `jsonb` would have created *"a second vocabulary with nothing checking
--     it"* — `0002_run.sql`'s sentence.
--   · A PAYLOAD HAS NO CLOSED SET OF KEYS. It is a counterparty's document and
--     it is schema-agnostic BY DESIGN — `model/kernel.ts` says so on
--     `FieldPath` itself: *"A payload is schema-agnostic JSONB and a
--     counterparty supplies its keys."* A typed column per key is a migration
--     per counterparty document type, which is exactly the dependency G206
--     refused on the classification axis: *"without it, EVERY NEW DOCUMENT TYPE
--     IS A PLATFORM RELEASE."*
--
-- ⚠️ THE COST IS ACCEPTED AND NAMED, AS G284 NAMED ITS OWN: the database
--    enforces NOTHING about the shape of a payload. No CHECK, no constraint, no
--    column type. Everything that makes a position readable lives in
--    `tenant.document_field_spec` and in `model/field-path.ts`'s one seam, and
--    a bug in either is a bug the database cannot catch. `0007` bought column
--    types at the price of a migration per channel; this buys schema-agnosticism
--    at the price of a fail-closed reader being the ONLY control. Both prices
--    are real and neither is hidden.
--
-- ---------------------------------------------------------------------
-- RULINGS THIS APPLIES, and the three it takes
--
--   G106  `FieldSpec` gains a real JSONB path, and A KEY WITH NO `FieldSpec`
--         IS UNREADABLE — stored, but unaddressable. Fail-closed, matching
--         `DENY_ALL`. 🛑 ITS REJECTED ALTERNATIVE IS NOT QUIETLY RE-TAKEN HERE:
--         defaulting an unmapped key to the most sensitive class was REFUSED,
--         because readable-by-default-with-a-high-bar is scope failing OPEN.
--         There is no default class column anywhere in this file and there must
--         never be one.
--   G214  A `FieldPath` is a STRUCTURED TOKEN LIST parsed at ONE seam. The
--         `path` column below holds its declared wire form and `parseFieldPath()`
--         is the only thing that may read it back. NOTHING HERE SPLITS A STRING.
--   G295  The payload table, the `FieldSpec` path column and the subject index
--         land TOGETHER with the ingestion path. This commit is that.
--   G184/G205/G206  The intake vocabulary, the `Arrival` row and the cascade.
--         `model/ingestion.ts` is the model; this is its state.
--   G88   Forward-only. 0001–0010 ARE NOT EDITED BY THIS FILE.
--   G97   Every branded id is `text`; the slug is stored VERBATIM. No uuid.
--   G100  The policy DENIES on NULL. A forgotten transaction yields an EMPTY
--         result set, never another tenant's rows.
--   G101  Transaction-mode pooling assumed; `SET LOCAL` inside an explicit
--         transaction, issued only by `db/tenant-scope.ts`.
--
--   G320  THE PAYLOAD IS ONE `jsonb` COLUMN AND THE ADDRESSING IS A RELATIONAL
--         TABLE BESIDE IT. Argued above against G284 rather than around it.
--   G321  THE SUBJECT INDEX STORES A TENANT-SALTED KEYED DIGEST AND NOT
--         `SubjectKeyScheme`'s HMAC, BECAUSE THERE IS NO KEY STORE. Argued at
--         §6 and stated as a weakening rather than as a design.
--   G322  `SubjectLocation` GETS COLUMNS FOR ONE VARIANT — the one with a
--         producer. Argued at §6; it is `0004`'s own refusal applied to a
--         union instead of to a column.
--
-- 🛑 EVERY TABLE IS SCHEMA-QUALIFIED `tenant.`, WHICH `0003_tenant_schema.sql`
--    MADE MANDATORY FROM 0004 ON: *"Qualify every CREATE TABLE explicitly from
--    0004 on, or the schema a table lives in becomes a side effect of migration
--    order."*
-- =====================================================================


-- =====================================================================
-- §1  THE LANE — `IntakeChannel`, G184's one intake vocabulary
--
-- Four kinds, one row per configured lane. `model/ingestion.ts` is the
-- authority for the member set and for the biconditional
-- `kind = 'upload' ⟺ endpointId IS NULL`, which `guardIntakeChannel()`
-- evaluates IN BOTH DIRECTIONS and which this table does NOT restate as a
-- constraint — see the note under the table.
--
-- 🛑 `lastArrivalAt` IS DECLARED ON THE MODEL AND IS NOT A COLUMN HERE, AND THE
--    ABSENCE IS THE MODEL'S OWN INSTRUCTION RATHER THAN AN OMISSION.
--    `IntakeChannel.lastArrivalAt`'s docblock: *"THE `arrivedAt` OF THE MOST
--    RECENT `Arrival` ROW ON THIS CHANNEL — DERIVED FROM THE ROW, NEVER WRITTEN
--    BY THE LANDING NOTIFICATION … A channel that received a notification the
--    cascade could not resolve does NOT advance its liveness signal."* A stored
--    column would be a second source of truth for a fact §2's rows already
--    carry, and it would go wrong in exactly the direction the docblock names:
--    written on notification rather than on admission. `arrival_by_channel`
--    below is the index that makes the derivation cheap.
-- =====================================================================

CREATE TABLE tenant.intake_channel (
  tenant_id   text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id          text    NOT NULL,

  -- `IntakeChannelKind` — upload | watched_drop | connector_pull | mailbox.
  kind        text    NOT NULL,

  -- Null exactly when `kind = 'upload'`. NOT enforced by a CHECK — see below.
  endpoint_id text,

  -- "Whether the lane is live. A disabled lane admits nothing."
  enabled     boolean NOT NULL,

  PRIMARY KEY (tenant_id, id)
);

-- ---------------------------------------------------------------------
-- 🛑 NO CHECK ON `kind`, AND NO CHECK EXPRESSING THE BICONDITIONAL. THIS IS
--    `0007`'s DECISION APPLIED AND `0004`'s DECISION DECLINED, AND THE
--    DIFFERENCE BETWEEN THEM IS THE RULE RATHER THAN THE FILE.
--
-- `0004_subject_ledger.sql` carries a CHECK on `scope` because *"a scope the
-- evaluator cannot answer must not be storable"* — the constraint protects a
-- WRITE against a value the model has no arm for.
--
-- `0007_run_engine_account.sql` carries none, because a CHECK would be a THIRD
-- copy of a vocabulary already held together as a SEQUENCE by
-- `tools/check-wire-mirror.mjs` — *"and the one nothing checks, because no pair
-- in the wire-mirror addresses SQL."*
--
-- `IntakeChannelKind` is `check-wire-mirror`'s `intake_channel_kinds` pair,
-- compared AS A SEQUENCE against `IntakeChannelStatus.properties.channel.enum`.
-- So it is `0007`'s case, not `0004`'s, and the third copy is refused.
--
-- THE BICONDITIONAL IS REFUSED FOR A SHARPER REASON. `guardIntakeChannel()`
-- reads its direction out of `CHANNEL_DRAWS_THROUGH_AN_ENDPOINT`, a TOTAL
-- `Record<IntakeChannelKind, boolean>`, precisely *"so a fifth channel member
-- cannot slip through as a silently-permissive default"*. A SQL CHECK naming
-- `'upload'` literally is the lazy repair that function's docblock exists to
-- refuse — it would implement `⟺` as a hard-coded arm, and a fifth kind added
-- to the model would pass it silently. The guard runs on every admission
-- (`guardChannelLive()` → `channel_is_not_a_legal_lane`), so a malformed lane
-- admits nothing; it is simply not the DATABASE that says no.
-- ---------------------------------------------------------------------


-- =====================================================================
-- §2  THE ARTEFACT — `Arrival`, G205's second primitive
--
-- G205's reason for existing, in its own words: *"a channel that has seen forty
-- thousand files has ONE ROW AND ONE TIMESTAMP, and without this nothing
-- anywhere records that file 39,998 was refused or why."* This table is where
-- file 39,998 lives.
--
-- 🛑 A REFUSED ARRIVAL NEVER BECOMES A `SourceDocument`, WHICH IS WHY THIS IS
--    NOT A COLUMN SET ON `source_document`. `model/ingestion.ts` states the
--    rejected alternative on the declaration: *"FOLDING THIS INTO
--    `SourceDocument` … the rows this entity exists for are exactly the rows
--    that would not exist. The alternative silently makes the refusal record
--    unrepresentable, which is the hole."*
--
-- ⚠️ INVARIANT 10 — `authorization_id` IS `NOT NULL` AND HAS NO FOREIGN KEY,
--    AND BOTH HALVES ARE DELIBERATE.
--
--    NOT NULL, because `ArrivalFacts.authorizationId` is non-nullable in the
--    model and the model argues it from `EndpointReading`'s precedent:
--    *"reaching a customer's ERP on a credential is never a system act with
--    nobody behind it"*, so `system` — the sole member of
--    `AUTHORIZATION_MAY_BE_ABSENT` — never covers an acquisition.
--
--    NO FOREIGN KEY, because the grant this names is the STANDING grant minted
--    when the connection was configured, and `tenant.authorization_grant`
--    (0010) holds the PER-ACT grant a handler mints — sixty seconds to an hour
--    by `MAX_AUTHORIZATION_SECONDS`. A reference from here to there would
--    assert they are one kind of thing, and they are not.
--
--    🛑 SAY THE CONSEQUENCE PLAINLY RATHER THAN LET IT BE INFERRED: **NOTHING
--    IN THIS REPOSITORY MINTS A STANDING GRANT**, so the value written here
--    today comes from the caller of `admitAndStoreArrival()`, and the only
--    caller is a test. The commit that mounts an intake operation is the commit
--    that mints it through `authorize()` — *"`authorize()` mints an
--    `AuthorizationGrant` and nothing else does"* — and that commit owes the
--    foreign key or a written argument for its absence. This one owes the
--    sentence, and here it is.
-- =====================================================================

CREATE TABLE tenant.arrival (
  tenant_id       text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id              text        NOT NULL,

  -- The facts, as the cascade received them. `ArrivalFacts` has six fields and
  -- five of them are here; the sixth, `byteCount`, is a property of the
  -- ARTEFACT rather than of the record and has no reader — `0004`'s refusal.
  channel_id      text        NOT NULL,
  channel_kind    text        NOT NULL,
  endpoint_id     text,
  authorization_id text       NOT NULL,

  -- "OUR OBSERVATION, made by our clock; it is not a fact the artefact asserts
  -- about itself." `ArrivalContext.now`, not `ArrivalFacts`.
  arrived_at      timestamptz NOT NULL,

  -- `ArrivalVerdict['kind']` — admitted | refused. NOT NULL: *"THERE IS NO
  -- THIRD STATE and no partially-admitted artefact."*
  verdict_kind    text        NOT NULL,

  -- `ArrivalRefusal['kind']`, and NULL exactly on the admitted arm. Single-table
  -- inheritance, `0007` §4's shape, and the three arm columns below are read by
  -- switching on THIS column — which is what makes a legitimately-null arm
  -- field distinguishable from an inapplicable one.
  refusal_kind    text,

  -- 🛑 ONLY THREE ARMS GET A COLUMN, AND THE OTHER SIX GET NONE ON PURPOSE.
  --    `channel_disabled` and `arrival_is_empty` carry a `channelId`;
  --    `authorisation_not_presented` and `standing_authorisation_expired` carry
  --    an `authorizationId`; `channel_not_the_one_presented` and
  --    `channel_kind_disagrees` each carry an `onFacts` half. **Every one of
  --    those five values is already a column on this row** — they are the
  --    FACTS, and the facts are what the row records. A duplicate column would
  --    be a second source of truth for one fact, which is the defect
  --    `guardEndpointAgreement()`'s docblock names about denormalisation:
  --    *"a denormalised copy that nothing compares is not a control, it is a
  --    second source of truth, and it goes stale."*
  --
  --    What is NOT on the row is the half that came from the CHANNEL, and that
  --    is what these three hold.
  --
  -- `channel_not_the_one_presented.onChannel` — the loaded lane's own id.
  refusal_on_channel_id       text,
  -- `channel_kind_disagrees.onChannel` — the loaded lane's own kind.
  refusal_on_channel_kind     text,
  -- `channel_endpoint_disagrees.onChannel` — `EndpointId | null`, and THE NULL
  -- IS A VALUE. Readable as one only because `refusal_kind` names the arm.
  refusal_on_channel_endpoint text,
  -- `channel_is_not_a_legal_lane.defect.kind` — `IntakeChannelDefect['kind']`.
  -- The defect's `channelId` is this row's own `channel_id`.
  refusal_defect_kind         text,
  -- `duplicate_of_earlier_arrival.earlier` — the ARRIVAL this one repeats.
  refusal_earlier_arrival_id  text,

  -- Set only when the verdict admitted; NULL on every refusal.
  source_document_id text,
  -- "The reading that drew it, on a drawing lane. Null on an upload." No
  -- `endpoint_reading` table exists, so this is NULL on every row today and it
  -- is here because `Arrival.readingId` is on the model and the writer carries
  -- it through rather than dropping it. ⚠️ A column with no producer is
  -- `0004`'s refusal and this is the one place this file comes close to it —
  -- the difference is that the WRITER writes it (from `ArrivalFacts`' own
  -- caller) and the READER returns it; what is missing is a row for it to point
  -- at, which is a different absence from a column nothing fills.
  reading_id         text,

  PRIMARY KEY (tenant_id, id),

  -- 🛑 THE COMPOSITE FOREIGN KEY, FOR `0002_run.sql`'s REASON: *"a cross-tenant
  --    reference has to be unrepresentable rather than merely unlikely."* It
  --    buys a second thing here, and it is the one the store leans on: an
  --    arrival naming a lane that does not exist is UNWRITABLE, so
  --    `ArrivalRefusal` needs no `channel_absent` arm and does not have one.
  --    The cascade takes a LOADED channel row — *"Supplied by the caller, never
  --    by the notification"* — and this constraint is why that is not merely a
  --    convention about who loads what.
  FOREIGN KEY (tenant_id, channel_id)
    REFERENCES tenant.intake_channel (tenant_id, id) ON DELETE CASCADE
);

-- `lastArrivalAt` is DERIVED, per §1. This is the index that derivation reads,
-- and it is also the index the operator question *"what came down this lane"*
-- reads. `tenant_id` leads because the policy has already narrowed to one
-- tenant before the index is consulted — the planner sees that predicate even
-- though no reader wrote it. Same shape as `0010`'s.
CREATE INDEX arrival_by_channel
  ON tenant.arrival (tenant_id, channel_id, arrived_at DESC);


-- =====================================================================
-- §3  THE DOCUMENT — what an ADMITTED arrival became
--
-- 🛑 THIS TABLE IS DELIBERATELY SMALLER THAN `SourceDocument`, AND EVERY
--    ABSENCE IS ARGUED. `0004_subject_ledger.sql`'s rule: a column ahead of its
--    reader is refused, because *"it would have been filled later by whoever
--    built the writer, with whatever they had to hand."*
--
--   `filename`       ABSENT, and this is the one worth reading. `ArrivalFacts`
--                    has SIX fields and *"what is absent is the declaration:
--                    No `filename`, no `bytes`, no `contentType`, no header row,
--                    no parser message"* — `_ArrivalFactsHoldsNoText` makes
--                    adding one a `TS2344`. **The ingestion path this slice
--                    builds therefore has no filename to write.** A column for
--                    it would be filled by the first person who had a string to
--                    hand, which is precisely the counterparty text the cascade
--                    was shaped to keep out.
--   `storage_ref`    ABSENT. No object is stored by this path; `createUpload`
--                    and F8's `putObject` are unbuilt and unmounted.
--   `control_total`  ABSENT. C18's `ControlTotal` is *"what the file said about
--                    itself"*, read by an EXTRACTOR that does not exist here.
--   `synthetic`      ABSENT. A caller-supplied flag with no caller.
--   `purge_after` / `purged_at`  ABSENT. Both are retention, `purgedAt` is
--                    written by a sweep, and there is no sweep. The model calls
--                    the purged row *"a tombstone for audit"*; a tombstone
--                    column with nothing to write it is a promise.
--
-- ⚠️ THE CONSEQUENCE, SO NOBODY READS THIS TABLE AS `SourceDocument`: a
--    `getDocument` handler needs `extracted`, `lines`, `provenance`,
--    `acquisitionFidelity` and `redactedPaths`, and this slice produces NONE of
--    them. What it produces is the thing under all of those — a stored payload
--    whose addressable positions are declared and whose location is registered.
-- =====================================================================

CREATE TABLE tenant.source_document (
  tenant_id        text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id               text        NOT NULL,

  -- The arrival this document came down. `Arrival.sourceDocumentId` points the
  -- other way; both directions are stored because both questions are asked —
  -- "where did this document come from" and "what did this arrival become" —
  -- and a single direction makes one of them a table scan.
  arrival_id       text        NOT NULL,

  -- Which `DocumentType`'s `FieldSpec`s address this payload. THE JOIN KEY OF
  -- THE WHOLE FILE: §5's rows are keyed on it, and a document whose type
  -- declares no fields has NO readable position at all, which is G106's
  -- fail-closed default arriving as a join that returns nothing.
  document_type_id text        NOT NULL,

  ingested_at      timestamptz NOT NULL,

  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, arrival_id)
    REFERENCES tenant.arrival (tenant_id, id) ON DELETE CASCADE
);


-- =====================================================================
-- §4  THE PAYLOAD — G106's storage half, one `jsonb` column
--
-- 🛑 THE WHOLE DOCUMENT IS STORED, INCLUDING EVERY KEY NOTHING DECLARED, AND
--    THAT IS G106 RATHER THAN A CONCESSION TO IT.
--
-- The temptation is to store only the declared positions — it would make the
-- "unreadable" rule trivially true. It is refused for two reasons and the
-- second is the one that decides it:
--
--   · A document is EVIDENCE. Storing a projection of it means an operator
--     comparing our record against the counterparty's original is comparing
--     against something we edited, and no audit can distinguish "the field was
--     not there" from "the field was not declared".
--   · **A projection makes G106 UNFALSIFIABLE.** If the unmapped keys are not
--     in the database, "an unmapped key is unreadable" is a statement about
--     what we wrote, not a property a test can probe. With the whole document
--     stored, `tests/db/payload-and-subject-index.test.ts` §2 can read the raw
--     column AS THE MIGRATOR, see the undeclared key sitting there, and then
--     require the reader not to return it. **That is the difference between a
--     control and an assertion about a control.**
--
-- ⚠️ SO THE READER IS THE ONLY THING STANDING BETWEEN A STORED KEY AND A
--    CONSUMER, AND IT IS NAMED: `readAddressablePayload()` in
--    `server/data-plane/payload-store.ts`. It joins §5 and returns positions
--    keyed by `fieldPathKey()`; there is no code path in it that can enumerate
--    the document. `model/field-path.ts`'s `addressableKeys()` states the same
--    rule one layer up — *"THE SET IS BUILT FROM THE DECLARATIONS AND NEVER
--    FROM THE DOCUMENT."*
--
-- 🛑 NO DEFAULT CLASSIFICATION COLUMN, EVER. G106's rejected alternative was
--    defaulting an unmapped key to the most sensitive class, refused because
--    *"readable-by-default-with-a-high-bar is scope failing OPEN, which §5.5
--    records this codebase already fixing once."* A `default_data_class` column
--    on this table is that alternative wearing a schema. There is none.
--
-- ⚠️ SEPARATE TABLE RATHER THAN A COLUMN ON §3, AND THE REASON IS ERASURE.
--    The document ROW is ours — an id, a type, a timestamp. The PAYLOAD is the
--    counterparty's bytes and carries every data subject in the file. They have
--    different dispositions under `purgeVerdict()`: the model says a purged
--    `SourceDocument` *"survives as a tombstone for audit"*, which is only
--    expressible if the thing that goes away is separable from the thing that
--    stays. One table would make the tombstone a lie or the purge a delete.
-- =====================================================================

CREATE TABLE tenant.document_payload (
  tenant_id          text  NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  source_document_id text  NOT NULL,

  -- The counterparty's document, verbatim, as parsed JSON. No shape is asserted
  -- and none may be: `model/kernel.ts`, on `FieldPath` — *"A payload is
  -- schema-agnostic JSONB and a counterparty supplies its keys."*
  payload            jsonb NOT NULL,

  PRIMARY KEY (tenant_id, source_document_id),
  FOREIGN KEY (tenant_id, source_document_id)
    REFERENCES tenant.source_document (tenant_id, id) ON DELETE CASCADE
);


-- =====================================================================
-- §5  THE ADDRESSING — `FieldSpec`, AND THIS IS THE COLUMN G106 NAMES
--
-- Invariant 4: *"Classification is declared once, on `FieldSpec`, and
-- everything derives from it."* This table is that declaration, stored.
--
-- 🛑 TWO COLUMNS FOR ONE PATH, AND IT IS NOT §5.3's SECOND VOCABULARY. READ
--    THIS BEFORE COLLAPSING THEM.
--
--   `path`      the declared `FieldPath` in the WIRE FORM `model/field-path.ts`
--               pins — *"a JSON ARRAY whose members are strings and numbers …
--               That is the entire encoding and there is nothing in it to
--               escape."* `parseFieldPath()` is the ONLY thing that may read it
--               back, exactly as `0007`'s `run_refused_item.path` is read.
--   `path_key`  `fieldPathKey(path)` — the length-prefixed, injective identity
--               token. It is DERIVED from `path` by one function, and
--               `model/kernel.ts` argues why it is not a grammar: *"nothing
--               parses it back. `fieldPathKey()` is the only producer and there
--               is no reader … A grammar is a thing you can be wrong about in
--               both directions; this is a one-way fingerprint."*
--
-- The pair exists because the KEY is what a primary key, a join and a
-- `Record<FieldPathKey, …>` need — a `jsonb` array cannot be a sane key and
-- `jsonb` equality is not the identity `fieldPathKey()` defines — while the
-- PATH is what a reader must walk. A generated column would be the right
-- answer and PostgreSQL cannot call `fieldPathKey()`, so the derivation lives
-- in the writer and is asserted in BOTH directions by
-- `tests/db/payload-and-subject-index.test.ts` §1, the same discipline
-- `0008_staff_grant_selection.sql` uses for its mirrored governance lists.
--
-- ⚠️ `SELECT` ONLY TO THE APP ROLE, AND IT IS THE STRONGEST GRANT DECISION IN
--    THIS FILE. A request path that could INSERT here could DECLARE A
--    CLASSIFICATION — it would widen what is readable by writing a row, and
--    invariant 4's "declared once" would become "declared by whoever asked
--    last". `0009_identity_substrate.sql` makes the identical argument about
--    `role_assignment`: *"nothing on the request path mints a role assignment,
--    because a path that could would grant itself any capability in the closed
--    set and `decide()` would then permit it CORRECTLY."*
--
-- 🛑 SO THIS TABLE HAS NO WRITER ON ANY REQUEST PATH AND THAT IS OWED WORK,
--    NAMED: a `FieldSpec` reaches a tenant by PACK PUBLICATION, and the
--    publication seam is G110's unbuilt half — *"blocked on an
--    `administration.openapi.yaml` that does not exist"*, which G288 has since
--    landed DECLARED AND UNMOUNTED. Until then rows arrive as the migrator, the
--    way `0008`'s governance lists do. **Do not read the absence of a writer as
--    a reason to grant INSERT here to close a gap.**
-- =====================================================================

CREATE TABLE tenant.document_field_spec (
  tenant_id                text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  document_type_id         text    NOT NULL,

  -- `fieldPathKey(path)`. Injective, one-way, and the identity of the position.
  path_key                 text    NOT NULL,
  -- The token list. `parseFieldPath()` is the only reader. NOT a dotted string:
  -- *"a dotted path breaks on any key containing a dot, which is legal JSON,
  -- and its failure mode is that it silently addresses the WRONG key rather
  -- than refusing — scope failing open."*
  path                     jsonb   NOT NULL,

  -- `FieldSpec.dataClass` — the declaration invariant 4 says is made once.
  data_class               text    NOT NULL,
  -- `FieldSpec.modelProcessingAllowed`. Stored beside the class because
  -- invariant 7's ceiling derives from it and a second home would drift.
  model_processing_allowed boolean NOT NULL,

  PRIMARY KEY (tenant_id, document_type_id, path_key)
);


-- =====================================================================
-- §6  THE REGISTERED LOCATION — `SubjectIndexEntry`, G295's other half
--
-- *"The index that makes erasure executable."* Written at CREATION time, in the
-- SAME TRANSACTION as §4's payload row — which is the whole of what G295 buys
-- and is asserted by `tests/db/payload-and-subject-index.test.ts` §7: make the
-- registration fail and NO payload row survives.
--
-- ---------------------------------------------------------------------
-- 🛑 G321 — `subject_ref` IS A TENANT-SALTED KEYED DIGEST AND IT IS NOT
--    `SubjectKeyScheme`'s HMAC. THIS IS A WEAKENING AND IT IS STATED AS ONE.
--
-- The model declares `SubjectKeyScheme` — `hmac_sha256` under a per-tenant
-- `keyRef`, *"the salt never leaves the tenant's region"*, and *"No field in
-- this model may hold key material."* **There is no key store in this
-- repository**: no KMS client, no secret manager, and G290 deliberately
-- withheld `kms:ScheduleKeyDeletion` from the one key-minting lambda that
-- exists. So the scheme's `keyRef` has nothing to reference.
--
-- WHAT IS BUILT INSTEAD: HMAC-SHA256 with the TENANT ID as the key, over
-- `model/canonical.ts`'s RFC 8785 form of the value —
-- `server/data-plane/subject-digest.ts`, the one seam, and the hasher lives
-- with the writer outside `model/` exactly as `0004_subject_ledger.sql` records
-- for `subject_digest`.
--
-- WHAT THAT DOES AND DOES NOT BUY, precisely, because the difference is the
-- reason this needs a ruling rather than a commit message:
--
--   ✅ IT DEFEATS CROSS-TENANT CORRELATION, which is the failure
--      `SubjectIndexEntry`'s own docblock names: *"A global key would turn the
--      privacy index itself into a cross-tenant correlation surface — exactly
--      the failure this design exists to prevent."* One subject in two tenants
--      digests to two unrelated values.
--   ❌ IT DOES NOT RESIST A GUESSING ATTACK. The key is the tenant id and the
--      tenant id is not secret, so a holder of this table can test a guessed
--      identifier against it. A real HMAC key would stop that and this does
--      not. **Nobody may describe this column as an HMAC under
--      `SubjectKeyScheme`.**
--
-- ⚠️ IT IS STILL STRICTLY BETTER THAN THE ALTERNATIVE AVAILABLE, WHICH IS WHY
--    IT SHIPS RATHER THAN BLOCKS: the alternative is a PERMANENT, QUERYABLE
--    PLAINTEXT INDEX OF EVERY IDENTIFIER EVERY COUNTERPARTY EVER SENT —
--    `0004`'s words for the same choice — on a table whose retention is
--    `tenant_lifetime`. The upgrade is a new column and a re-index under G88,
--    and it is owed to whoever lands the key store.
--
-- ---------------------------------------------------------------------
-- 🛑 G322 — `SubjectLocation` HAS ELEVEN VARIANTS AND THIS TABLE HOLDS ONE.
--
-- `location_kind` is CHECKed to `'source_document'` — the only variant with a
-- PRODUCER (this file's ingestion path) and a READER. That is `0004`'s rule
-- applied to a union instead of to a column: *"a scope the evaluator cannot
-- answer must not be storable."* A `blob`, a `trace` or a `bi_dataset` row
-- written today would be written by nobody, read by nothing, and would make the
-- index look complete while being empty in ten of eleven directions.
--
-- ⚠️ AND THE HONEST STATEMENT OF WHAT THIS INDEX COVERS, because a partial
--    erasure index that reads as total is worse than none: it covers PAYLOADS
--    STORED BY THIS PATH. It does not cover exports, page renders,
--    correspondence bodies, notifications, traces or the BI dataset — every one
--    of which `SubjectLocation` has a variant for and none of which has a
--    writer anywhere. `docs/handoff-pack/Functional Specification.dc.html`
--    records the whole of it as *"not built"*; this moves ONE variant and
--    claims nothing about the other ten. The CHECK is what stops a later commit
--    quietly implying otherwise.
--
-- 🛑 NO SURROGATE `id`. `SubjectIndexEntry.id` is a bare `string` that nothing
--    in the model references, and the natural key IS the fact: *this subject's
--    data rests at this location*. A surrogate would make the same fact
--    storable twice, and the dedup would then live in whoever wrote the second
--    row. The primary key below makes it unrepresentable instead.
-- =====================================================================

CREATE TABLE tenant.subject_index_entry (
  tenant_id                   text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,

  -- G321. The tenant-salted keyed digest. NEVER the natural identifier.
  subject_ref                 text        NOT NULL,

  -- `SubjectLocation['kind']`, and one member is admissible. G322.
  location_kind               text        NOT NULL
                                          CHECK (location_kind IN ('source_document')),
  -- `SubjectLocation.source_document.sourceDocumentId`.
  location_source_document_id text        NOT NULL,

  -- 🛑 THE MAXIMUM OVER THE `FieldSpec` CLASSES THAT PRODUCED THIS SUBJECT AT
  --    THIS LOCATION, AND IT IS DERIVED RATHER THAN DECLARED. Invariant 4:
  --    *"Classification is declared once, on `FieldSpec`, and everything
  --    derives from it."* G134 puts the document-level ceiling at the maximum
  --    across a `DocumentType`'s fields and G208 points the same rule outward;
  --    this is that rule pointed at one subject in one document. A declared
  --    class here would be a SECOND declaration of the thing the invariant says
  --    is declared once — §5.3 by construction.
  data_class                  text        NOT NULL,

  recorded_at                 timestamptz NOT NULL,

  PRIMARY KEY (tenant_id, subject_ref, location_kind, location_source_document_id),
  FOREIGN KEY (tenant_id, location_source_document_id)
    REFERENCES tenant.source_document (tenant_id, id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- THE QUERY THIS TABLE EXISTS TO ANSWER: *"a subject asked; where does their
-- data rest?"* — which is a lookup on `subject_ref` and NOT on the document.
-- Without this index the erasure path is a sequential scan of every row in the
-- tenant, which is the shape that makes a compliance obligation quietly
-- unaffordable rather than visibly unbuilt.
-- ---------------------------------------------------------------------
CREATE INDEX subject_index_by_subject
  ON tenant.subject_index_entry (tenant_id, subject_ref);


-- =====================================================================
-- ROW LEVEL SECURITY — G100's deny-on-NULL, written as the predicate rather
-- than described. `0001`'s predicate VERBATIM, on `USING` **and** on
-- `WITH CHECK`, on all six tables.
--
-- `ENABLE` and `FORCE`, both, on every one. `ENABLE` alone leaves the TABLE
-- OWNER exempt, and `0001` states the consequence: *"a test that connects as
-- the owner then passes with the policy doing nothing, and passes just as well
-- with the policy dropped."*
--
-- `WITH CHECK` is stated explicitly rather than left to default from `USING`,
-- for `0001`'s reason and for `0009`'s: *"the commit that grants a write here
-- owes it in the same commit as the writer."* Four of these six tables take a
-- write from the request path in this very commit, so all four owe it here —
-- and the two that do not take one carry it anyway, so a later `GRANT INSERT`
-- cannot arrive without the write half already in place.
-- =====================================================================

ALTER TABLE tenant.intake_channel       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.intake_channel       FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.arrival              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.arrival              FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.source_document      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.source_document      FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.document_payload     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.document_payload     FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.document_field_spec  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.document_field_spec  FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.subject_index_entry  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.subject_index_entry  FORCE  ROW LEVEL SECURITY;

CREATE POLICY intake_channel_rls ON tenant.intake_channel
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY arrival_rls ON tenant.arrival
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY source_document_rls ON tenant.source_document
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY document_payload_rls ON tenant.document_payload
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY document_field_spec_rls ON tenant.document_field_spec
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY subject_index_entry_rls ON tenant.subject_index_entry
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- =====================================================================
-- GRANTS. By name, because `0003` deliberately declines
-- `ALTER DEFAULT PRIVILEGES` on this schema: *"A future table created here is
-- unreachable by the app until granted BY NAME … default privileges would
-- silently hand the request path a table nobody decided to expose."*
--
-- 🛑 READ THE VERBS. FOUR TABLES TAKE `SELECT, INSERT` AND NOTHING ELSE; TWO
--    TAKE `SELECT` ALONE. THERE IS NO `UPDATE` AND NO `DELETE` ANYWHERE IN
--    THIS FILE, AND EACH ABSENCE IS A DIFFERENT ARGUMENT:
--
--   `intake_channel`       SELECT. A lane is OPERATOR CONFIGURATION. A request
--                          path that could write one could enable a disabled
--                          lane, or repoint it at another endpoint, and
--                          `guardChannelLive()` would then pass correctly on a
--                          lane the request had just legitimised.
--   `document_field_spec`  SELECT. §5's argument: a path that could declare a
--                          classification could widen what is readable.
--
--   `arrival`              SELECT, INSERT. **No `UPDATE`:** an arrival's verdict
--                          is the cascade's, decided once, and *"THERE IS NO
--                          THIRD STATE"*. A path that could amend a verdict
--                          could turn file 39,998's refusal into an admission
--                          after the fact, which is the one thing G205 built
--                          this row to prevent.
--   `source_document`      SELECT, INSERT. **No `UPDATE`:** `purgedAt` is a
--                          sweep's column and there is no sweep; granting the
--                          verb ahead of the writer is `0004`'s refusal wearing
--                          a privilege.
--   `document_payload`     SELECT, INSERT. **No `UPDATE`:** a stored document is
--                          what arrived. Amending it would silently falsify
--                          every `subject_index_entry` already registered
--                          against it — the subject would be indexed at a
--                          location that no longer holds them, and erasure
--                          would report success over a value it never saw.
--                          **No `DELETE`:** erasure needs it and erasure has no
--                          writer; the grant lands with the sweep, in that
--                          commit, with the assertions that it ran.
--   `subject_index_entry`  SELECT, INSERT. **Append-only as a PRIVILEGE**, the
--                          shape `0010_authorisation_record.sql` takes for
--                          invariant 10's record and for the same reason: an
--                          index of where a subject's data rests is a record of
--                          a fact, and *"nothing on a request path can amend or
--                          erase a record of an act."* The erasure sweep that
--                          eventually removes an entry removes it alongside the
--                          payload, under a grant that lands with it.
-- =====================================================================

GRANT SELECT                 ON tenant.intake_channel      TO tenant_rw;
GRANT SELECT, INSERT         ON tenant.arrival             TO tenant_rw;
GRANT SELECT, INSERT         ON tenant.source_document     TO tenant_rw;
GRANT SELECT, INSERT         ON tenant.document_payload    TO tenant_rw;
GRANT SELECT                 ON tenant.document_field_spec TO tenant_rw;
GRANT SELECT, INSERT         ON tenant.subject_index_entry TO tenant_rw;

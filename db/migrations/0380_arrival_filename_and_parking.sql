-- =====================================================================
-- 0380 — AN ARRIVAL'S NAME, THE PARKED PILE, ITS DRAIN, AND RAISING A
--        PARKED SAMPLE WITH THE FDE
--
-- C9 rows 7 (*Unmatched deliveries*), 9 (*The sample is their first
-- delivery*), 13 (*Raising it with the FDE*) and 16 (*The drain*).
-- G2831–G2840, 2 Oct 2026, applying G2692 — **THE OWNER'S RULING**:
--
--   *"Yes, both: store an Arrival's filename verbatim, interpreted by
--    nothing (invariant 6 via 0022's precedent); add a `parked`
--    ArrivalVerdict arm."*
--
-- One column, three tables, one constraint. ONE FILE, so the count moves by
-- ONE.
-- =====================================================================


-- =====================================================================
-- §1  `tenant.arrival.filename` — `0012` §3's REFUSAL, CORRECTED HERE
--
-- 🛑 `0012` §3 REFUSED `filename` BY NAME AND THAT FILE IS NOT EDITED (G88 —
--    migrations are forward-only, and `0017`'s precedent is that a successor
--    keeps the correction on its own face while the predecessor keeps its
--    refusal on its). Its sentence, quoted so it can be recognised:
--
--      *"`filename` ABSENT, and this is the one worth reading. … **The
--       ingestion path this slice builds therefore has no filename to
--       write.** A column for it would be filled by the first person who had
--       a string to hand, which is precisely the counterparty text the
--       cascade was shaped to keep out."*
--
--    **Its premise was right and its conclusion is overturned by ruling, not
--    by drift.** The column exists now because something READS it — the pair
--    classifier (`decideArrival()`, `model/ingestion.ts` §2a) — which is
--    `0004`'s condition for a column, and because the cascade is still shaped
--    to keep it out: `ArrivalFacts` is unchanged at six fields and
--    `_ArrivalFactsHoldsNoText` still holds. The name is read strictly AFTER
--    the cascade admits, and only to select among pairs an OPERATOR declared.
--
-- 🛑 IT IS ON THE ARRIVAL AND NOT ON `source_document`, WHERE `0012` §3
--    REFUSED IT. A refused or parked artefact never becomes a document, and
--    those are exactly the rows whose name a person needs: the pane (row 19)
--    names the sample by what the source called it. `model/ingestion.ts`'s
--    argument against folding `Arrival` into `SourceDocument` is the same one.
--
-- ⚠️ VERBATIM, AND THEREFORE NO `CHECK`. A constraint on the name's SHAPE
--    would be this database interpreting it; the one thing refused is what a
--    `text` column cannot hold (a NUL), and that is refused by
--    `arrivalFilenameFrom()` before a statement is issued. Length is the
--    reader's too (1024).
--
-- ⚠️ NULLABLE, AND THE NULL MEANS "WRITTEN BEFORE THIS FILE". `NOT NULL`
--    with no default would refuse to apply against a table holding a row, and
--    G88 forbids rewriting a history row to give it a name it never carried.
--    `0012`'s `admitAndStoreArrival()` — the caller-typed upload path —
--    still writes NULL; the classifying path always writes one.
--
-- ⚠️ NO NEW GRANT: `0012`'s table-level `GRANT SELECT, INSERT` covers a column
--    added later (`0017`'s and `0160`'s precedent), and there is still no
--    `UPDATE` — a name cannot be changed after it arrived.
-- =====================================================================

ALTER TABLE tenant.arrival ADD COLUMN filename text;

-- `verdict_kind` gains a third value, `parked`, and THIS FILE ADDS NO
-- `CHECK` FOR IT — `0012` §2 declined one on `0007`'s polarity (*"an UNKNOWN
-- value must reach the model as an `*_unreadable` refusal, not be rejected at
-- write time by a list somebody forgot to extend"*). The reader refuses
-- against `ARRIVAL_VERDICT_KINDS`, a total record over the model's union.


-- =====================================================================
-- §2  `tenant.held_artefact` — ROW 9's *"Held unextracted"*
--
-- A parked artefact's record, held whole, until a pair drains it.
--
-- 🛑 G106 HOLDS AND IS THE WHOLE READ STORY: NOTHING CLASSIFIES A HELD
--    ARTEFACT, SO EVERY VALUE IN IT IS UNREADABLE. It has no document type,
--    so no `FieldSpec` addresses any position in it, and *"a key with no
--    `FieldSpec` is UNREADABLE"*. The pane publishes the record's top-level
--    KEYS — its shape, which is what a person needs to write a mapping — and
--    never a value (`server/data-plane/parked.ts`, `tests/http/parked-pile-
--    served.test.ts` §6).
--
-- 🛑 G295 DOES NOT HOLD FOR THE PARKED INTERVAL, AND THAT IS NAMED RATHER
--    THAN PAPERED OVER (G2836, ⛔). G295: *"no classified value is ever stored
--    without an addressable classification"*. A held artefact is stored with
--    NO classification and its subjects are NOT registered, because which
--    positions denote a subject is the TYPE's declaration and there is no
--    type yet. **An erasure sweep that reads `subject_index_entry` will not
--    find a subject inside a held artefact.** Two things bound it: the
--    interval ends at the drain, which DELETES the held copy in the same
--    transaction that registers the document's subjects (§2's restrictive
--    policy); and every held artefact is enumerable by arrival, so an
--    erasure plan can treat each as wholly subject-bearing. **That plan is
--    owed**, as is the next `SubjectLocation` variant G322 left unbuilt.
--
-- ⚠️ `DELETE` IS GRANTED, AND ONLY A DRAINED ARTEFACT CAN BE DELETED. The
--    restrictive policy below admits a `DELETE` only where an `arrival_drain`
--    row for the same arrival is visible — so the one statement that removes
--    a held copy is the drain's, after it has recorded the drain. A `DELETE`
--    of an undrained held artefact matches ZERO rows and raises nothing;
--    `tests/db/arrival-parking.test.ts` §4 witnesses both arms. `0010`'s
--    append-only-as-a-privilege is about RECORDS OF ACTS; this is a payload,
--    and keeping an unattributable copy after its attributable one exists is
--    the G295 exposure above made permanent.
--
-- ⚠️ AND AN `INSERT` ONLY FOR A PARKED ARRIVAL — a restrictive `WITH CHECK`
--    reading the arrival's own verdict, so a held copy of an ADMITTED or
--    REFUSED artefact is unwritable.
-- =====================================================================

CREATE TABLE tenant.held_artefact (
  tenant_id   text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  arrival_id  text        NOT NULL,
  -- The counterparty's record, whole. `0012` §4's `jsonb` argument (G320):
  -- a delivered record has no closed set of keys.
  payload     jsonb       NOT NULL,
  held_at     timestamptz NOT NULL,

  PRIMARY KEY (tenant_id, arrival_id),
  FOREIGN KEY (tenant_id, arrival_id)
    REFERENCES tenant.arrival (tenant_id, id) ON DELETE CASCADE
);


-- =====================================================================
-- §3  `tenant.source_document` GAINS ONE UNIQUE CONSTRAINT
--
-- It exists so §4 can point at a document AND ITS ARRIVAL as one key: a drain
-- naming a document that came down a DIFFERENT arrival is then a foreign-key
-- violation rather than a reviewed convention. `(tenant_id, id)` is already
-- the primary key, so the constraint admits nothing new; it is a target.
-- =====================================================================

ALTER TABLE tenant.source_document
  ADD CONSTRAINT source_document_arrival_key UNIQUE (tenant_id, id, arrival_id);


-- =====================================================================
-- §4  `tenant.arrival_drain` — ROW 16, *"Declaring a pair extracts the
--     documents already parked against it, automatically"*
--
-- 🛑 A SEPARATE APPEND-ONLY ACT AND NOT AN `UPDATE` OF THE ARRIVAL. The
--    arrival's verdict is what was decided WHEN IT ARRIVED and it stays
--    `parked`; the drain is a later act, by a different person, under a
--    different authorisation, and invariant 10 wants that act's own record
--    pinned: `authorization_id` is the record `declareEndpointDocumentType`
--    minted. `0340` §4's stop event is the shape.
--
-- 🛑 ONE DRAIN PER ARRIVAL, BY PRIMARY KEY — a document cannot be extracted
--    twice from one artefact, and two concurrent pair declarations that both
--    match it cannot both drain it.
--
-- 🛑 THREE COMPOSITE FOREIGN KEYS, AND THE MIDDLE ONE IS WHY A DRAIN CANNOT
--    LIE ABOUT ITS TYPE: `(pair_id, document_type_id)` must be a real pair
--    with that type (`0341` §1's target), and `(source_document_id,
--    arrival_id)` must be the document THIS arrival became (§3).
--
-- ⚠️ THE METER DOES NOT MOVE AND ROW 16 SAYS IT SHOULD (G2837, ⛔). *"It is
--    extraction: it counts, the meter moves."* It COUNTS — `listParkedArrivals`
--    publishes each drain by pair — and it moves no meter, because
--    `UsageRecord.sequence` is *"monotonic per data plane"* and nothing in
--    this repository allocates one; `writeUsageRecord()` has no caller outside
--    `tests/`. A drain that wrote a usage row with an invented sequence would
--    be the gap the sequence exists to make detectable.
--
-- ⚠️ `SELECT, INSERT` — NO `UPDATE`, NO `DELETE`. `0010`'s
--    append-only-as-a-privilege, applied to the record of an act. And a
--    restrictive `WITH CHECK` admits a drain only of a PARKED arrival.
-- =====================================================================

CREATE TABLE tenant.arrival_drain (
  tenant_id          text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  arrival_id         text        NOT NULL,
  pair_id            text        NOT NULL,
  document_type_id   text        NOT NULL,
  source_document_id text        NOT NULL,
  drained_at         timestamptz NOT NULL,
  authorization_id   text        NOT NULL,

  PRIMARY KEY (tenant_id, arrival_id),
  UNIQUE (tenant_id, source_document_id),
  FOREIGN KEY (tenant_id, arrival_id)
    REFERENCES tenant.arrival (tenant_id, id),
  FOREIGN KEY (tenant_id, pair_id, document_type_id)
    REFERENCES tenant.endpoint_document_type (tenant_id, id, document_type_id),
  FOREIGN KEY (tenant_id, source_document_id, arrival_id)
    REFERENCES tenant.source_document (tenant_id, id, arrival_id)
);

CREATE INDEX arrival_drain_by_pair ON tenant.arrival_drain (tenant_id, pair_id, drained_at);


-- =====================================================================
-- §5  `tenant.parked_escalation` — ROW 13, *"Raising it with the FDE"*
--
-- *"A control on this pane, carrying the pack, the type and the sample. The
-- pair stays parked pending, and the source's other pairs are unaffected — a
-- source goes partly live, with the pending pair counted separately."*
--
-- 🛑 IT CARRIES THE SAMPLE AND THE TYPE AND NOT THE PACK, AND THE MISSING
--    THIRD IS A MEASUREMENT (G2839, 🟠): `tenant.document_type` (`0180`) has
--    no pack column, and the writer that would mint one — `installPack` — is
--    G110's seam and unmounted. A `pack_id` here would be filled by whoever
--    had a string to hand. The pack is reachable once a type knows its pack.
--
-- ⚠️ ONE PER SAMPLE, BY `UNIQUE (tenant_id, arrival_id)` — raising the same
--    parked artefact twice is one request, and the act answers the existing
--    one rather than minting a second. `SELECT, INSERT`, append-only; there
--    is no "resolved" column because the resolution IS a drain (§4), and a
--    second fact about it would be a second home.
--
-- ⚠️ THE TYPE IS A FOREIGN KEY INTO THE TENANT'S OWN TYPES (`0341` §1's
--    argument): an escalation naming a type that does not exist, or another
--    tenant's, is refused rather than recorded.
-- =====================================================================

CREATE TABLE tenant.parked_escalation (
  tenant_id        text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id               text        NOT NULL,
  arrival_id       text        NOT NULL,
  document_type_id text        NOT NULL,
  raised_at        timestamptz NOT NULL,
  authorization_id text        NOT NULL,

  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, arrival_id),
  FOREIGN KEY (tenant_id, arrival_id)       REFERENCES tenant.arrival (tenant_id, id),
  FOREIGN KEY (tenant_id, document_type_id) REFERENCES tenant.document_type (tenant_id, id)
);


-- =====================================================================
-- §6  ROW-LEVEL SECURITY — `0001`'s predicate VERBATIM on `USING` AND on
--     `WITH CHECK`, ENABLEd AND FORCEd on all three; and three RESTRICTIVE
--     policies, each `FOR` exactly the verb it governs (`0027`'s lesson: a
--     policy with no `FOR` is `FOR ALL`, and `0220`'s G1982 is what that
--     costs when nobody notices).
-- =====================================================================

ALTER TABLE tenant.held_artefact     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.held_artefact     FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.arrival_drain     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.arrival_drain     FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.parked_escalation ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.parked_escalation FORCE  ROW LEVEL SECURITY;

CREATE POLICY held_artefact_rls ON tenant.held_artefact
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));
CREATE POLICY arrival_drain_rls ON tenant.arrival_drain
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));
CREATE POLICY parked_escalation_rls ON tenant.parked_escalation
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

-- A held copy only of a PARKED arrival.
CREATE POLICY held_artefact_only_parked ON tenant.held_artefact
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenant.arrival a
     WHERE a.tenant_id = held_artefact.tenant_id
       AND a.id = held_artefact.arrival_id
       AND a.verdict_kind = 'parked'));

-- A held copy may be removed only once its drain is recorded.
CREATE POLICY held_artefact_delete_only_drained ON tenant.held_artefact
  AS RESTRICTIVE FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tenant.arrival_drain d
     WHERE d.tenant_id = held_artefact.tenant_id
       AND d.arrival_id = held_artefact.arrival_id));

-- A drain only of a PARKED arrival.
CREATE POLICY arrival_drain_only_parked ON tenant.arrival_drain
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenant.arrival a
     WHERE a.tenant_id = arrival_drain.tenant_id
       AND a.id = arrival_drain.arrival_id
       AND a.verdict_kind = 'parked'));

-- An escalation only of a PARKED arrival that has not been drained.
CREATE POLICY parked_escalation_only_parked ON tenant.parked_escalation
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant.arrival a
       WHERE a.tenant_id = parked_escalation.tenant_id
         AND a.id = parked_escalation.arrival_id
         AND a.verdict_kind = 'parked')
    AND NOT EXISTS (
      SELECT 1 FROM tenant.arrival_drain d
       WHERE d.tenant_id = parked_escalation.tenant_id
         AND d.arrival_id = parked_escalation.arrival_id));


-- =====================================================================
-- §7  GRANTS. By name.
--
--   `held_artefact`      SELECT, INSERT, DELETE — the DELETE fenced by §6.
--   `arrival_drain`      SELECT, INSERT. Append-only.
--   `parked_escalation`  SELECT, INSERT. Append-only.
-- =====================================================================

GRANT SELECT, INSERT, DELETE ON tenant.held_artefact     TO tenant_rw;
GRANT SELECT, INSERT         ON tenant.arrival_drain     TO tenant_rw;
GRANT SELECT, INSERT         ON tenant.parked_escalation TO tenant_rw;

-- =====================================================================
-- 0341 — SOURCE × DOCUMENT TYPE, AND WHAT EACH SOURCE CALLS EACH FIELD
--
-- C9 rows 6 (*Source × document type*), 11 (*OCR is the pack's
-- declaration*) and 14 (*Field mapping*). G2687 and G2690, 1 Oct 2026,
-- DERIVED AND NOT THE OWNER'S.
--
-- Row 6, quoted: *"One source carries several types. The type is not a
-- property of the source, so it cannot be picked once at declaration. The
-- identifier is the pair — this source, and a pattern within it … each pair
-- naming one type."* Row 14: *"What the page calls a field against what the
-- type calls it, per source-and-pattern pair, because one supplier's layout is
-- not another's. Required before extraction, so an incomplete mapping refuses
-- the declaration."*
--
-- TWO TABLES, ONE FILE, so the count moves by ONE.
-- =====================================================================


-- =====================================================================
-- §1  `tenant.endpoint_document_type` — THE PAIR
--
-- 🛑 THE PATTERN IS TWO TYPED COLUMNS AND A LITERAL. `match_kind` is
--    `path_prefix` | `filename` (`SOURCE_MATCH_KINDS`), `match_value` is
--    compared byte for byte, and NOTHING IS COMPILED — G130/G206's rule for
--    the pack's own classification rules, applied to the customer's half.
--
-- 🛑 THERE IS NO FIDELITY COLUMN AND ITS ABSENCE IS ROW 11 (G2690). *"Per
--    document type, not per source and not detected per document. So a type
--    either reads OCR or does not, and every source paired to it inherits
--    that."* `tenant.document_type.expected_fidelity` (`0180`) is the one
--    home; a pair column would be a second, and `0180` already records what
--    two homes for one declaration cost. `tests/db/source-declaration.test.ts`
--    §6 asserts the absence by catalogue.
--
-- ⚠️ A FOREIGN KEY INTO `tenant.document_type`, AND `0180`'s REFUSAL OF ONE
--    DOES NOT APPLY. `0180` refused an FK from `source_document` because
--    nothing writes a `document_type` row, so it *"would refuse EVERY
--    ingestion permanently"*. A pair is the opposite case: a declaration
--    against a type that does not exist SHOULD be refused, and refusing every
--    pair until a type exists is the correct answer, not a lock-out.
--
-- ⚠️ `UNIQUE (tenant_id, endpoint_id, match_kind, match_value)`: one pattern
--    names ONE type. Two pairs whose patterns OVERLAP (a prefix and a filename
--    under it) are NOT refused here — deciding which wins is the classifier's,
--    and the classifier is not built (G2692). That is the decidable/undecidable
--    split `validatePackClassificationRules()` states for its own half.
-- =====================================================================

CREATE TABLE tenant.endpoint_document_type (
  tenant_id        text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id               text        NOT NULL,
  endpoint_id      text        NOT NULL,
  match_kind       text        NOT NULL,
  match_value      text        NOT NULL,
  document_type_id text        NOT NULL,
  declared_at      timestamptz NOT NULL,
  declared_authorization_id text NOT NULL,

  PRIMARY KEY (tenant_id, id),
  -- The target the mapping's composite key needs: a mapping row cannot name
  -- a type its pair does not.
  UNIQUE (tenant_id, id, document_type_id),
  UNIQUE (tenant_id, endpoint_id, match_kind, match_value),
  FOREIGN KEY (tenant_id, endpoint_id)      REFERENCES tenant.endpoint (tenant_id, id),
  FOREIGN KEY (tenant_id, document_type_id) REFERENCES tenant.document_type (tenant_id, id)
);


-- =====================================================================
-- §2  `tenant.endpoint_field_mapping` — WHAT THIS SOURCE CALLS EACH FIELD
--
-- 🛑 IT POINTS AT `document_field_spec` AND NEVER WRITES IT (`0012` §5:
--    *"a path that could INSERT here could DECLARE A CLASSIFICATION"*). The
--    composite foreign key `(tenant_id, document_type_id, path_key)` makes a
--    mapping onto a field the type does not declare UNREPRESENTABLE, and the
--    second one `(tenant_id, pair_id, document_type_id)` makes a mapping onto
--    ANOTHER type's field unrepresentable — the pair's type is the only one
--    its lines may name.
--
-- ⚠️ COMPLETENESS IS NOT A CONSTRAINT AND CANNOT BE: *"every declared field is
--    mapped"* is a relation over a SET of rows, which no row-level CHECK sees.
--    It is `checkSourcePair()`'s, inside the transaction that writes the set,
--    and the pair and its lines are one statement group — so no committed
--    instant holds a pair with half a mapping.
-- =====================================================================

CREATE TABLE tenant.endpoint_field_mapping (
  tenant_id        text NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  pair_id          text NOT NULL,
  document_type_id text NOT NULL,
  path_key         text NOT NULL,
  source_field     text NOT NULL,

  PRIMARY KEY (tenant_id, pair_id, path_key),
  UNIQUE (tenant_id, pair_id, source_field),
  FOREIGN KEY (tenant_id, pair_id, document_type_id)
    REFERENCES tenant.endpoint_document_type (tenant_id, id, document_type_id),
  FOREIGN KEY (tenant_id, document_type_id, path_key)
    REFERENCES tenant.document_field_spec (tenant_id, document_type_id, path_key)
);


-- =====================================================================
-- §3  RLS AND GRANTS
--
-- `0001`'s predicate VERBATIM on `USING` and `WITH CHECK`. `SELECT, INSERT`
-- and nothing else: changing a pair or its mapping is *"Editing an installed
-- pack"*'s neighbour and is NOT built — a path that could UPDATE a mapping
-- could re-point a source's `amount` column at the type's `reference` field
-- after a period had closed on it, which is a period measured two ways.
-- =====================================================================

ALTER TABLE tenant.endpoint_document_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.endpoint_document_type FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.endpoint_field_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.endpoint_field_mapping FORCE  ROW LEVEL SECURITY;

CREATE POLICY endpoint_document_type_rls ON tenant.endpoint_document_type
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY endpoint_field_mapping_rls ON tenant.endpoint_field_mapping
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

GRANT SELECT, INSERT ON tenant.endpoint_document_type TO tenant_rw;
GRANT SELECT, INSERT ON tenant.endpoint_field_mapping TO tenant_rw;

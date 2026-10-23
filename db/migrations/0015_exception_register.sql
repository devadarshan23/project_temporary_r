-- =====================================================================
-- 0015 — THE EXCEPTION REGISTER. The product's actual operator surface.
--        G357, G358, G359. 19 Sep 2026.
--
-- ⚠️ THE NUMBER IS 0015 AND NOT 0013, AND THE GAP IS DELIBERATE RATHER THAN A
--    MISCOUNT. `0013` and `0014` are RESERVED to two other agents working in
--    parallel; `tools/check-migration-numbers.mjs` (G356) is the gate's
--    sixteenth stage and exists because two agents each wrote an `0011` on
--    19 Sep 2026 and **`git merge` produced both files with NO CONFLICT**.
--    Taking the next free-looking number is exactly how that happened. Derive
--    what is spent, never read it:
--        ls db/migrations/*.sql db/migrations-control/*.sql
--
-- 🛑 THIS FILE IS THE TABLE HALF OF G300's THREE-PART TEST FOR THE C6
--    EXCEPTION OPERATIONS, AND UNTIL IT LANDED THE OTHER TWO PARTS WERE
--    ALREADY REAL WHILE THE OPERATIONS 404'd. Derive that it was so:
--
--        grep -c -i 'exception' db/migrations/0001..0012                → 0 tables
--        grep -n 'export interface Exception ' model/domain.ts          → the model
--        grep -n 'viewException\|assignException' model/access.ts       → the capability
--
--    G300: *"A table alone is the trap … Derive each; do not assert
--    readiness."* The inverse trap is this one — a model and a capability with
--    no table, which is a declared surface that cannot be served at any price.
--
-- ---------------------------------------------------------------------
-- 🛑 WHAT THE CONTRACT ASKS FOR, AND WHY THE SHAPE FOLLOWS `0007` RATHER THAN
--    `0012`. THESE ARE THE TWO PRECEDENTS AND THEY POINT OPPOSITE WAYS.
--
--   `0007_run_engine_account.sql` refused a `jsonb` operand column and took a
--   TYPED COLUMN PER DECLARED CHANNEL, because *"there is a closed set of arms,
--   so there are typed columns to have, and `jsonb` would have created a second
--   vocabulary with nothing checking it"* (`0002_run.sql`).
--
--   `0012_payload_and_subject_index.sql` took one `jsonb` column under G320,
--   because *"A PAYLOAD HAS NO CLOSED SET OF KEYS … a typed column per key is a
--   migration per counterparty document type."*
--
--   **AN EXCEPTION IS `0007`'s CASE AND NOT `0012`'s, AND THE TEST IS THE ONE
--   G320 ITSELF STATES: does the thing have a closed set of arms?** Every
--   compound this file stores does:
--
--     `Delta`            FOUR arms — numeric · money · temporal · textual.
--     `ExtractedScalar`  SIX arms — text · number · date · money · identifier
--                        · absent.
--     `ExceptionResolution` THREE arms — autonomous · approved · manual.
--     `ReversalReason`   FIVE members, and the distinction inside it is
--                        load-bearing: `reversalIndictsAutonomy()` reads it.
--     `Money`            currency · amountMinor · exponent, G65's three.
--
--   So each gets columns, and an arm added to any of those unions is a column
--   this file does not have — which is a migration, and which G357 accepts by
--   name as the price, exactly as G284 accepted *"a migration per new
--   channel"*. **The alternative — `explanation jsonb` — is refused for
--   G284's own reason and not for a new one: it inherits invariant 4's G106
--   problem.** A `jsonb` explanation is a bag of keys with no `FieldSpec`, so
--   every finding in it would be stored and UNREADABLE, and *"a result nobody
--   may read is not persistence."*
--
-- 🛑 THE ONE `jsonb` COLUMN IN THIS FILE IS A `FieldPath`, AND IT IS THE SAME
--    COLUMN `0007` AND `0012` BOTH ALREADY HAVE. `exception_observed_value
--    .path` holds the declared wire form `model/field-path.ts` pins — *"a JSON
--    ARRAY whose members are strings and numbers … That is the entire encoding
--    and there is nothing in it to escape."* `parseFieldPath()` is the ONLY
--    thing that may read it back. NOTHING HERE SPLITS A STRING: G214, and *"a
--    dotted path breaks on any key containing a dot, which is legal JSON, and
--    its failure mode is that it silently addresses the WRONG key rather than
--    refusing — scope failing open."*
--
-- ---------------------------------------------------------------------
-- 🛑 WHICH COLUMNS EXIST IS DECIDED BY THE WIRE, NOT BY THE MODEL, AND THAT
--    RULE LOSES THREE MODEL FIELDS HERE. READ THIS BEFORE "COMPLETING" THE
--    TABLE.
--
-- `0002_run.sql`: *"storing columns no wire can carry would create a second
-- vocabulary with nothing checking it. **They land with the schemas that
-- publish them.**"* G303 applied that to `AssignmentScope` twelve days ago and
-- this file applies it again.
--
-- ⚠️ AND APPLYING IT SURFACED A REAL DIVERGENCE BETWEEN THE MODEL AND THE
--    WIRE, WHICH IS RECORDED HERE RATHER THAN QUIETLY RESOLVED IN EITHER
--    DIRECTION. `model/domain.ts`'s `ExceptionResolution` is a THREE-ARM
--    DISCRIMINATED UNION; `capability.openapi.yaml`'s is a FLAT RECORD with a
--    `mode` string, and the flat one cannot carry three of the model's fields:
--
--      `approvedBy: UserId[]`      the model's `approved` arm carries EVERY
--                                  approver — *"Quorum may exceed 1 and
--                                  four-eyes means two names."* The wire has
--                                  `decidedBy`, SINGULAR. A four-eyes approval
--                                  is not expressible on this tier.
--      `executedBy: UserId`        the model's own docblock calls this *"the
--                                  person who acted. A different fact from
--                                  proposer and from approver."* No wire field.
--      `policyEvaluationId`        *"the evaluation that decided, not merely
--                                  the policy that could have. Without it an
--                                  auditor holding this row can reach a spec
--                                  but never the decision."* No wire field.
--
--    **None of the three gets a column here**, because the rule above says a
--    column lands with the schema that publishes it, and no schema publishes
--    these. **That is a LOSS and it is named as one rather than hidden**: the
--    model went to some trouble to make `{mode:'autonomous', …: null}`
--    unrepresentable and this tier's wire re-admits it. Fixing it is a contract
--    change on `ExceptionResolution`, which is a wave of its own and is not
--    taken here. `tests/db/exception-register.test.ts` §6 asserts the three
--    columns are ABSENT, so a later commit adding one arrives against a red
--    rather than silently.
--
-- ---------------------------------------------------------------------
-- 🛑 WHAT THIS FILE DOES **NOT** GIVE A WRITER, AND THE ABSENCES ARE THE
--    STRONGEST DECISIONS IN IT. SEE THE GRANTS BLOCK AT THE FOOT.
--
--   · NOTHING ON A REQUEST PATH MAY INSERT AN EXCEPTION. An exception is
--     RAISED BY THE ENGINE, and the engine has no writer on this plane —
--     `0007`'s thirteen tables persist a `SetReconciliationResult` and nothing
--     converts one into an `Exception`. Granting INSERT ahead of that writer is
--     `0004`'s refusal wearing a privilege, and it would additionally let a
--     request path mint a finding against itself.
--   · THE ONLY WRITE ON A REQUEST PATH IS `UPDATE (assigned_to)`, COLUMN-LEVEL.
--     G358. See the grants block: a blanket `UPDATE` would put `severity`,
--     `status`, `value_at_risk_*` and `explanation_summary` inside reach of a
--     handler, and the first three are the columns a queue is triaged by.
--   · NO `UPDATE` ANYWHERE ON `exception_observed_value`. An explanation is
--     EVIDENCE. `0012` makes the identical argument about `document_payload`:
--     amending it *"would silently falsify every `subject_index_entry` already
--     registered against it."*
--   · `exception_reversal` IS `SELECT` ONLY AND HAS NO MOUNTED WRITER, because
--     `reverseResolution` IS NOT MOUNTED IN THIS COMMIT. See G359 and the note
--     at §3.
--
-- ---------------------------------------------------------------------
-- RULINGS THIS APPLIES, and the three it takes
--
--   G300  An operation may mount when its TABLE **and** MODEL **and**
--         CAPABILITY are all real, per operation, derived and not asserted.
--         This file is the table for four of the five C6 operations.
--   G301  An operation may not mount until it MINTS an authorisation record.
--         Every handler reading these tables is an `AuthorisedOperation` and
--         reads through the transaction the mint opened — it takes no pool.
--   G303  `AssignmentScope`'s six dimensions get columns with the first
--         mounted operation that READS one. 🛑 THIS FILE DOES NOT TAKE THAT
--         STEP AND MUST NOT BE READ AS TAKING IT. `cost_centre` and
--         `legal_entity` below are `Exception`'s OWN fields — the attributes an
--         assignment narrows ON — and they are published by
--         `ExceptionQueueRow`. The SCOPE side, `AssignmentScope.costCentres`,
--         still has no column anywhere and `Decision.scope` is still
--         `DENY_ALL`. Derive it:
--         `grep -cE '^[^-]*solutionIds' db/migrations/*.sql` → 0.
--         (G2181 — the unanchored form answered 1 for this file, on this
--         line.) **A reader that filtered this queue by an assignment's scope
--         would be filtering against a scope that denies everything**, which is
--         why no handler in this commit reads one.
--   G284  A typed column per declared channel, and a migration per new one as
--         the accepted price. Argued above against G320 rather than around it.
--   G320  A `jsonb` column is for a thing with NO closed set of keys. The one
--         here is a `FieldPath`, which is `0012`'s own case.
--   G214  A `FieldPath` is a STRUCTURED TOKEN LIST parsed at ONE seam.
--   G286  `Money.amountMinor` is `bigint` in the model and a DECIMAL STRING on
--         the wire. Every money column below is `int8`, and `model/money.ts` is
--         the only thing permitted to convert in either direction — G111.
--         🛑 `double precision` NEVER HOLDS MONEY IN THIS FILE. Derive it:
--         `grep -n 'double precision' db/migrations/0015_exception_register.sql`
--         returns confidences, ratios, rates and box coordinates, and no amount.
--   G88   Forward-only. 0001–0014 ARE NOT EDITED BY THIS FILE.
--   G97   Every branded id is `text`; the slug is stored VERBATIM. No uuid.
--   G100  The policy DENIES on NULL. A forgotten transaction yields an EMPTY
--         result set, never another tenant's rows.
--   G101  Transaction-mode pooling assumed; `SET LOCAL` inside an explicit
--         transaction, issued only by `db/tenant-scope.ts`.
--
--   G357  THE REGISTER IS RELATIONAL AND TYPED, COLUMN PER UNION ARM, AND THE
--         WIRE DECIDES WHICH COLUMNS EXIST. Argued at the top of this file.
--   G358  THE ONLY REQUEST-PATH WRITE IS A COLUMN-LEVEL `UPDATE (assigned_to)`.
--         Argued in the grants block.
--   G359  FOUR OF THE FIVE C6 OPERATIONS MOUNT; `reverseResolution` DOES NOT.
--         Argued at §3.
--
-- 🛑 EVERY TABLE IS SCHEMA-QUALIFIED `tenant.`, WHICH `0003_tenant_schema.sql`
--    MADE MANDATORY FROM 0004 ON: *"Qualify every CREATE TABLE explicitly from
--    0004 on, or the schema a table lives in becomes a side effect of migration
--    order."*
--
-- 🛑 NO `CHECK` CONSTRAINT ON ANY VOCABULARY COLUMN, AND THE ABSENCE IS
--    `0002_run.sql`'s RULING RATHER THAN AN OVERSIGHT: a third copy of a closed
--    enum *"would be a third place to drift — and the one nothing checks,
--    because no pair in the wire-mirror addresses SQL."* The narrowing lives
--    where it can be DERIVED from the model instead of copied —
--    `server/data-plane/exception-vocabulary.ts`, keyed `Record<Union, true>`
--    so an arm added to a model union is a `TS2741` there rather than a word
--    the product's own types cannot name arriving on the wire.
-- =====================================================================


-- =====================================================================
-- §1  THE FINDING — `Exception`, and the queue it is read through
--
-- 🛑 THE DENORMALISED COLUMNS ARE THE DESIGN AND NOT A CACHE. The contract says
--    so in its own voice at `listExceptions`: *"EVERY FILTER AND SORT HERE READS
--    A DENORMALISED COLUMN, AND THAT IS WHY THOSE COLUMNS EXIST … Reaching
--    `domain` through the live relations is three joins; rule labels live inside
--    a JSON array on the definition. At a hundred thousand open rows that is the
--    difference between a home screen and a timeout."*
--
--    ⚠️ AND `model/domain.ts` CALLS THEM *"Derived, never authoritative"*. The
--    live relations remain the source of truth. **There are no live relations
--    in this database** — no `match_group`, no `rule`, no `definition` — so
--    today these columns are the ONLY copy, which makes "derived" a statement
--    about a future writer rather than about this schema. Named rather than
--    glossed: a reader who assumes a join is available will not find one.
--
-- 🛑 `severity_rank` IS A COLUMN AND NOT A CASE EXPRESSION, FOR THE REASON THE
--    MODEL AND THE CONTRACT BOTH GIVE IN THE SAME WORDS: *"ORDER BY on the
--    string union sorts critical, high, low, medium — alphabetically, and
--    therefore wrongly, in a way that looks plausible enough to ship."*
--
-- ⚠️ `cost_centre` AND `legal_entity` ARE A DIFFERENT KIND OF COLUMN FROM THE
--    OTHER FIVE AND THE MODEL SAYS SO AT LENGTH. They are the attributes
--    `AssignmentScope.costCentres` and `.legalEntities` narrow ON; until they
--    existed *"both dimensions matched every row — the narrowing typechecked,
--    rendered in an access review, and did nothing."*
--
--    🛑 **NULL MUST NEVER SATISFY A `these` NARROWING.** An untagged exception
--    is OUTSIDE every cost-centre-scoped assignment, not inside all of them.
--    SQL gives this for free — `NULL IN ('CC-1100')` is NULL, so `WHERE` drops
--    the row — *"and that accident is the enforcement, which is exactly why it
--    is written down here: a hand-built matcher in application code that
--    treated null as 'unscoped' would reverse it, and would look reasonable
--    while doing so."* Both are `text` and BOTH ARE NULLABLE, deliberately.
--
-- ⚠️ BRITISH SPELLING, AND IT IS THE MODEL'S OWN PRE-EXISTING DIVERGENCE RATHER
--    THAN A CHOICE MADE HERE. `UsageRecord.costCenter` is American;
--    `AssignmentScope.costCentres`, `CardFilter.costCentres` and
--    `Exception.costCentre` are British. This column takes the spelling of the
--    dimension it must bind against, *"because that join is an authorisation
--    decision and the billing one is not."*
-- =====================================================================

CREATE TABLE tenant.exception (
  tenant_id            text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id                   text        NOT NULL,

  -- --- identity and pinning -------------------------------------------
  -- `MatchGroup` is minted per run. There is no `match_group` table, so this is
  -- a pointer for a later migration to land against and NOT a foreign key —
  -- `0005`'s `role_id` note takes the same shape for the same reason.
  match_group_id       text        NOT NULL,
  rule_id              text        NOT NULL,
  -- *"Pins the rule as it was when this fired."* An exception raised under v1
  -- must stay explicable when the rule moves on.
  rule_version         integer     NOT NULL,
  definition_version   integer     NOT NULL,
  -- Set for line-scoped rules. *"Lines are paired by LineMatchKey, never by
  -- position — positional pairing is wrong the moment a vendor sorts
  -- differently."* So this is a KEY and never an index.
  line_key             text,
  -- 🛑 CROSS-RUN IDENTITY, AND IT IS A SELF-REFERENCE WITH NO FOREIGN KEY.
  -- *"MatchGroup is minted per run, so without this March's exception stays
  -- open forever after April's run resolves it."* No FK because the ancestor
  -- may have been purged under `RetentionPolicy.days.exception` while this row
  -- survives, and a FK would make the retention sweep delete the descendant.
  carried_forward_from text,

  -- --- the queue's denormalised columns -------------------------------
  domain               text        NOT NULL,
  definition_id        text        NOT NULL,
  -- Exact match on the label AS IT WAS PINNED at `rule_version` — *"a rule
  -- renamed since does not silently drop older exceptions out of the filter."*
  rule_label           text        NOT NULL,
  severity             text        NOT NULL,
  severity_rank        integer     NOT NULL,

  -- `Money | null`. G65's three columns, and `int8` under G286: the model type
  -- is `bigint` and a `numeric` here would invite a float on the way out.
  -- ⚠️ ALL THREE OR NONE. Enforced below rather than by three nullable columns
  -- hoping to agree — a currency with no amount is a `Money` nobody can read.
  value_at_risk_currency text,
  value_at_risk_minor    int8,
  value_at_risk_exponent integer,

  -- --- the two AUTHORISING projections. See the header. ----------------
  cost_centre          text,
  legal_entity         text,

  status               text        NOT NULL,
  -- ⚠️ AN OPAQUE USER ID AND NOT A FOREIGN KEY TO `tenant."user"`, AND THE
  -- REASON IS A MEASURED PROPERTY OF `0009` RATHER THAN A PREFERENCE.
  -- `user_visible_to_session` keys on the SESSION — `id = (SELECT s.user_id
  -- FROM tenant.session s WHERE …)` — so the app role can see EXACTLY ONE user
  -- row: its own. A `REFERENCES tenant."user"` here would be checked by the
  -- DATABASE (which bypasses RLS for referential integrity) while no handler
  -- could ever read the row to validate against, which is a constraint nobody
  -- can explain from the application side. The contract is explicit that this
  -- is not an authorisation: *"Assignment is not access … the field is a
  -- work-queue affordance."*
  assigned_to          text,
  raised_at            timestamptz NOT NULL,

  -- --- `Explanation`, minus `observed[]` (which is §2) ------------------
  -- 🛑 INVARIANT 6 LIVES ON THE NEXT TWO COLUMNS AND ON §2's `scalar_text`.
  --    *"Ingested content is data, never instruction."* `summary` and
  --    `expected` are DERIVED FROM COUNTERPARTY DOCUMENTS and are rendered to
  --    an operator and may be handed to a model. They are stored as text and
  --    they are stored VERBATIM; nothing here sanitises them, because a
  --    sanitiser at rest is a second place the rule lives and the wrong place.
  --    The rule is enforced where the value is USED.
  --
  -- ⚠️ AND `model/reconciliation.ts`'s `AssertNoTextDeep` CANNOT BE APPLIED TO
  --    ANY OF THESE, WHICH IS THE PROOF BITING RATHER THAN A GAP. That guard
  --    *"BANS THE TYPE `string` AT A PROPERTY POSITION"*; an `Explanation` is
  --    two strings and an array of counterparty scalars, so
  --    `AssertNoTextDeep<Explanation>` is a compile error by construction —
  --    the same shape `HeldRead` has, where `tests/model/below-floor-held.test.ts`
  --    asserts the error with a `@ts-expect-error` rather than leaving the
  --    absence to read as an oversight. **Do not cite that guard as evidence
  --    about anything in this file.**
  --
  -- NOT NULL on both: `Explanation` is non-optional on `Exception` and both
  -- fields are `required` on the wire. PRODUCT.md Principle 1, in a column.
  explanation_summary      text    NOT NULL,
  -- *"Drawn from the REFERENCE SLOT, which is what makes the sentence
  -- directional."* A KYC finding reads "the passport disagrees with the
  -- registry" rather than the reverse BECAUSE OF THIS FIELD, and a client
  -- rendering `expected` and `observed[]` symmetrically throws that away.
  explanation_expected     text    NOT NULL,
  -- ⚠️ NULL MEANS NOT APPLICABLE, NEVER UNKNOWN — a parsed e-invoice has no OCR
  -- and no model call. *"A client that renders null as 0% has inverted the
  -- meaning of the most trustworthy path in the product."* `double precision`
  -- and not `numeric`: it is a ratio, not money.
  explanation_confidence   double precision,

  -- --- `Delta | null`: FOUR ARMS, COLUMN PER ARM (G357) ------------------
  -- Null `delta_kind` is the `null` delta. A non-null kind with none of its
  -- own columns set is unpublishable and the reader says so rather than
  -- shaping a half-arm.
  delta_kind               text,
  -- `numeric` and `textual` share nothing; `percentage` is on `numeric` AND on
  -- `money` and is therefore one column, which is the one collapse in this
  -- block and is safe because both arms mean the same thing by it.
  delta_percentage         double precision,
  delta_numeric_absolute   double precision,
  -- 🛑 THE `money` ARM CARRIES ITS CURRENCY, WHICH IS WHAT MAKES
  -- `autoResolveValueCeiling` ENFORCEABLE AT ALL — *"a USD invoice compared
  -- against an SGD purchase order once reported a 35% critical variance on a
  -- correct invoice."*
  delta_money_currency     text,
  delta_money_minor        int8,
  delta_money_exponent     integer,
  -- `FxConversion | null` on the money arm. *"Named so a disputed conversion is
  -- traceable to a source."* `rate` is `double precision` because G67 puts rate
  -- parsing in one codec and a rate is not an amount.
  delta_fx_from            text,
  delta_fx_to              text,
  delta_fx_rate            double precision,
  delta_fx_as_at           timestamptz,
  delta_fx_source          text,
  delta_temporal_days      integer,
  delta_textual_similarity double precision,

  -- --- `ExceptionResolution | null` -------------------------------------
  -- 🛑 THESE COLUMNS HAVE NO WRITER IN THIS COMMIT AND THEY ARE NOT
  --    SPECULATIVE. `Exception.resolution` is `required` on the wire, so
  --    `getException` cannot answer without them; a row whose resolution is
  --    null publishes `null`, which is the true answer for every row this
  --    database can hold today. `0007` set the precedent of landing columns
  --    *"proven by a test rather than by a route"* and
  --    `tests/db/exception-register.test.ts` §4 is that test.
  --
  -- ⚠️ THREE MODEL FIELDS ARE ABSENT BY RULE — `approvedBy[]`, `executedBy`,
  --    `policyEvaluationId`. See the header. The wire does not publish them.
  resolution_mode                         text,
  resolution_disposition_key              text,
  resolution_proposal_id                  text,
  -- *"Without it the accountability chain terminates at the agent — the
  -- authorless output that makes abdication easy."*
  resolution_authorised_by_policy_id      text,
  resolution_authorised_by_policy_version integer,
  -- The wire's `decidedBy`, singular. THE MODEL'S IS `approvedBy: UserId[]`.
  resolution_decided_by                   text,
  resolution_at                           timestamptz,

  PRIMARY KEY (tenant_id, id),

  -- 🛑 THE ONLY THREE `CHECK`s IN THIS FILE, AND NONE OF THEM RESTATES A CLOSED
  --    ENUM. Each asserts that a MULTI-COLUMN VALUE is whole or absent, which
  --    is a fact about THIS schema's decomposition and exists nowhere else —
  --    so it is not `0002`'s "third place to drift". A half-written `Money` is
  --    a row the reader must refuse to publish, and catching it at write time
  --    names the writer instead of the reader.
  CONSTRAINT exception_value_at_risk_whole CHECK (
    (value_at_risk_currency IS NULL AND value_at_risk_minor IS NULL AND value_at_risk_exponent IS NULL)
    OR
    (value_at_risk_currency IS NOT NULL AND value_at_risk_minor IS NOT NULL AND value_at_risk_exponent IS NOT NULL)
  ),
  CONSTRAINT exception_delta_money_whole CHECK (
    (delta_money_currency IS NULL AND delta_money_minor IS NULL AND delta_money_exponent IS NULL)
    OR
    (delta_money_currency IS NOT NULL AND delta_money_minor IS NOT NULL AND delta_money_exponent IS NOT NULL)
  ),
  -- A resolution is `{mode, dispositionKey, proposalId, at}` or it is nothing.
  -- This is the flat wire record's `required` list, in a constraint — and it is
  -- the nearest this schema can get to the model's discriminated union, which
  -- the wire cannot express. See the header.
  CONSTRAINT exception_resolution_whole CHECK (
    (resolution_mode IS NULL AND resolution_disposition_key IS NULL
      AND resolution_proposal_id IS NULL AND resolution_at IS NULL)
    OR
    (resolution_mode IS NOT NULL AND resolution_disposition_key IS NOT NULL
      AND resolution_proposal_id IS NOT NULL AND resolution_at IS NOT NULL)
  )
);

-- ---------------------------------------------------------------------
-- THE FOUR ORDERINGS, EACH WITH AN INDEX. The contract: *"THE SORT SET IS
-- CLOSED. Four orderings, each backed by a covering index. An arbitrary
-- `sort=<column>` parameter is how a queue acquires a sort nobody indexed, and
-- the first person to notice is the customer with the most exceptions — which
-- is the customer who matters most."*
--
-- 🛑 EVERY ONE LEADS ON `tenant_id` AND ENDS ON `id`. The lead is because RLS
--    adds `tenant_id = …` to every scan and an index that did not carry it
--    would be a filter after a seek. The tail is because THE CURSOR IS A
--    KEYSET: `server/data-plane/exception-store.ts` pages on the full ordering
--    tuple, and a tuple that is not unique skips or repeats rows at a page
--    boundary. `id` is unique within a tenant by the primary key, so appending
--    it makes every ordering total.
--
-- ⚠️ `value_at_risk_minor` SORTS ACROSS CURRENCIES AND THAT IS WRONG, AND IT IS
--    THE CONTRACT'S OWN DECLARED SORT RATHER THAN THIS FILE'S CHOICE. 1000 JPY
--    (exponent 0) and 10.00 SGD (exponent 2) are both `1000` minor units and
--    this index orders them equal. The contract refuses a bare value THRESHOLD
--    for exactly this reason — `valueAtRiskAtLeastMinor` *"REQUIRES A
--    CURRENCY"* — and then declares `value_at_risk_desc` as a sort with no
--    currency at all. **The filter is guarded and the sort is not.** Named here
--    and in `exception-store.ts`; closing it is a contract change (a sort
--    scoped to a currency, or a reporting-currency column) and is not this
--    file's to take.
-- ---------------------------------------------------------------------

-- 🛑 `DESC NULLS LAST` IS SPELLED OUT AND IS NOT THE DEFAULT. PostgreSQL's
--    default for `DESC` is `NULLS FIRST`, which would put every NON-MONETARY
--    finding at the top of a queue sorted by value at risk — the rows with no
--    value, ordered above the rows with the largest. The contract's own words
--    for the adjacent case: *"a non-monetary finding is not below the
--    threshold, it is outside the question."* The ORDER BY in
--    `server/data-plane/exception-store.ts` spells it identically, and the two
--    must agree or the index is not the one the planner uses.
--
-- `severity_then_value` — the journey's stated default. `severity_rank` ASC
-- because 0 is critical; value DESC within a rank.
CREATE INDEX exception_by_severity_then_value
  ON tenant.exception (tenant_id, severity_rank, value_at_risk_minor DESC NULLS LAST, id);

CREATE INDEX exception_by_value_at_risk
  ON tenant.exception (tenant_id, value_at_risk_minor DESC NULLS LAST, id);

CREATE INDEX exception_by_raised_at_desc
  ON tenant.exception (tenant_id, raised_at DESC, id);

CREATE INDEX exception_by_raised_at_asc
  ON tenant.exception (tenant_id, raised_at, id);


-- =====================================================================
-- §2  THE EVIDENCE — `ObservedValue[]`, the array inside `Explanation`
--
-- 🛑 A TABLE AND NOT A `jsonb` ARRAY, FOR G284's REASON AT ONE MORE GRAIN DOWN:
--    `ExtractedScalar` has SIX arms and `Provenance` has three fields, all
--    closed, so there are typed columns to have. A `jsonb` array here would put
--    the product's OWN closed vocabulary into an unaddressable bag, which is
--    the *"second vocabulary with nothing checking it"* `0002_run.sql` refuses.
--
-- 🛑 `data_class` IS A COPY OF A `FieldSpec` DECLARATION AND INVARIANT 4 IS NOT
--    THEREBY BROKEN — BUT READ THIS BEFORE ADDING A SECOND ONE.
--
--    Invariant 4: *"Classification is declared once, on `FieldSpec`, and
--    everything derives from it."* The declaration is
--    `tenant.document_field_spec` (`0012` §5) and it stays the only
--    declaration. This column is a CAPTURED value's class at the moment it was
--    captured, and the model argues the copy in its own voice: *"Explanation
--    outlives the document it was drawn from — `days.exception` is deliberately
--    longer than `days.source_document` — so purging the source does not remove
--    this copy. Carrying the class here is what makes the subject index in
--    governance.ts able to find and erase it."*
--
--    ⚠️ SO THE COPY IS WHAT MAKES ERASURE POSSIBLE AFTER THE SOURCE IS GONE,
--       AND IT IS NOT A DEFAULT. **There is no default class column and there
--       must never be one**, here or anywhere: G106's rejected alternative was
--       defaulting an unmapped key to the most sensitive class, refused because
--       *"readable-by-default-with-a-high-bar is scope failing OPEN, which §5.5
--       records this codebase already fixing once."* A row reaches this table
--       only with a class already declared for its path.
--
-- 🛑 AND THE HALF THAT IS **NOT** BUILT, NAMED RATHER THAN LEFT TO BE NOTICED:
--    G295's `subject_index_entry` (`0012` §6) is *"the index that makes erasure
--    executable"*, written at CREATION time — *"a scan cannot find a value
--    inside a stored Explanation, and an erasure design that depends on finding
--    it later will quietly miss it."* `SubjectLocation`'s own declaration names
--    an Explanation as exactly the place a scan cannot reach. **Nothing in this
--    commit registers an observed value in that index**, because nothing in
--    this commit WRITES an observed value on a request path — the grants below
--    give no INSERT. The day a writer arrives it owes the index entry in the
--    same transaction, which is G295's whole content, and it owes it BEFORE the
--    first row exists because the state without it is UNRECOVERABLE.
-- =====================================================================

CREATE TABLE tenant.exception_observed_value (
  tenant_id          text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  exception_id       text    NOT NULL,
  -- Array position. `Explanation.observed` is an ordered array on the wire and
  -- an unordered read would reorder a reviewer's evidence between two loads.
  ordinal            integer NOT NULL,

  slot               text    NOT NULL,
  -- The token list. `parseFieldPath()` is the ONLY reader. See the header.
  path               jsonb   NOT NULL,
  line_index         integer,
  source_document_id text    NOT NULL,

  -- --- `ExtractedScalar`: SIX ARMS, COLUMN PER ARM (G357) ---------------
  -- `absent` carries no value at all, which is why every value column is
  -- nullable and why the kind is the discriminator rather than a null test.
  scalar_kind           text    NOT NULL,
  -- 🛑 COUNTERPARTY TEXT. Invariant 6 — data, never instruction. Stored
  -- verbatim; the rule is enforced where the value is USED. See §1.
  scalar_text           text,
  scalar_number         double precision,
  -- `date` is a STRING in the model, not a `date` column: it is what the
  -- document said, and normalising it here would lose an unparseable date
  -- rather than report one.
  scalar_date           text,
  scalar_money_currency text,
  scalar_money_minor    int8,
  scalar_money_exponent integer,

  -- --- `Provenance` — *"Renders as a highlight over the source page."* ---
  -- All four box columns or none: a bounding box missing its height is a
  -- highlight nobody can draw.
  provenance_page       integer,
  provenance_box_x      double precision,
  provenance_box_y      double precision,
  provenance_box_width  double precision,
  provenance_box_height double precision,
  -- ⚠️ THE SECOND CONFIDENCE, AND IT IS NOT `explanation_confidence`. This one
  -- is THIS VALUE's extraction confidence; the one on §1 is the finding's. The
  -- contract's whole argument for exposing confidence only on the detail read
  -- turns on the two sitting together — *"a low number is a pointer at which
  -- value to check first, not a substitute for checking."*
  provenance_confidence double precision,

  -- See the long note above. A CAPTURED class, never a declaration.
  data_class            text    NOT NULL,

  PRIMARY KEY (tenant_id, exception_id, ordinal),
  FOREIGN KEY (tenant_id, exception_id)
    REFERENCES tenant.exception (tenant_id, id) ON DELETE CASCADE,

  CONSTRAINT observed_scalar_money_whole CHECK (
    (scalar_money_currency IS NULL AND scalar_money_minor IS NULL AND scalar_money_exponent IS NULL)
    OR
    (scalar_money_currency IS NOT NULL AND scalar_money_minor IS NOT NULL AND scalar_money_exponent IS NOT NULL)
  ),
  CONSTRAINT observed_bounding_box_whole CHECK (
    (provenance_box_x IS NULL AND provenance_box_y IS NULL
      AND provenance_box_width IS NULL AND provenance_box_height IS NULL)
    OR
    (provenance_box_x IS NOT NULL AND provenance_box_y IS NOT NULL
      AND provenance_box_width IS NOT NULL AND provenance_box_height IS NOT NULL)
  )
);


-- =====================================================================
-- §3  THE UNDOING — `ExceptionReversal[]`
--
-- 🛑 THIS TABLE HAS NO MOUNTED WRITER AND THAT IS G359 RATHER THAN AN
--    OMISSION. `reverseResolution` IS DECLARED AND IS NOT MOUNTED IN THIS
--    COMMIT, and the reason is G300's own three-part test failing on a part
--    this file cannot supply:
--
--      TABLE       ✅ this one, plus §1's resolution columns.
--      CAPABILITY  ✅ `reverse_resolution`, a member of the closed set.
--      MODEL       ✅ `ExceptionReversal`, `ReversalReason`,
--                  `reversalIndictsAutonomy()`.
--
--    …so all three ARE real, and the operation still does not mount, because a
--    fourth thing is missing that G300 does not name and that the contract
--    does: **there is nothing to reverse.** `409` on this operation is
--    *"`validation_failed` — there is no resolution to reverse"*, and a
--    resolution arrives from `executeProposal`, which needs `Proposal`, which
--    needs a `proposal` table that does not exist. Every row this database can
--    produce today has `resolution_mode IS NULL`, so the operation's only
--    reachable answer is its own 409.
--
--    ⚠️ MOUNTING IT ANYWAY WAS CONSIDERED AND IS REFUSED ON G300's OWN
--       ARGUMENT, READ IN THE DIRECTION IT POINTS: *"a 403 indistinguishable
--       from an unbuilt feature is worse than an honest 404 from the router."*
--       A 409 indistinguishable from an unbuilt feature is the same sentence. A
--       router 404 tells a caller something true — this path is not built —
--       and a blanket 409 tells them something false: that they asked wrongly.
--
-- ⚠️ SO WHY DOES THE TABLE LAND AT ALL? Because `Exception.reversals` is
--    `required` on the wire and `getException` — which DOES mount — must
--    publish it. An empty array is the true answer and it needs a table to be
--    read from; fabricating `[]` in the handler would be the `[]`-versus-`null`
--    defect `0007` spent a section removing, at the grain where it is least
--    visible. `0007`'s precedent is exact: columns land *"proven by a test
--    rather than by a route"*, and `tests/db/exception-register.test.ts` §5 is
--    that test.
--
-- 🛑 `indicts_autonomy` IS NOT A COLUMN, DELIBERATELY. It is DERIVED from
--    `reason` by `reversalIndictsAutonomy()`, which is *"a function rather than
--    a comment, because every call site that computes a reversal rate must
--    agree — and one that quietly counts all reversals will drive autonomy to
--    `none` across the fleet and look like evidence while doing it."* A stored
--    copy is a second call site that cannot be recompiled. The wire publishes
--    it; `server/data-plane/exception-store.ts` computes it by calling the
--    model's function, not by reading a list.
-- =====================================================================

CREATE TABLE tenant.exception_reversal (
  tenant_id                 text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  exception_id              text        NOT NULL,
  -- *"Reversals accumulate as an array. An exception resolved, reversed,
  -- re-resolved and reversed again is a signal in itself, and a flag would have
  -- erased it."* The ordinal is what keeps the sequence readable.
  ordinal                   integer     NOT NULL,

  at                        timestamptz NOT NULL,
  -- *"Always a human. A reversal is a correction, and corrections are signed."*
  -- There is no agent path to this row — the contract refuses one because *"an
  -- agent that can undo its own resolutions can launder a bad one."*
  reversed_by               text        NOT NULL,
  reason                    text        NOT NULL,
  -- Operator prose. Invariant 6 applies to it exactly as to §1's summary.
  note                      text,
  new_status                text        NOT NULL,
  corrected_disposition_key text,

  PRIMARY KEY (tenant_id, exception_id, ordinal),
  FOREIGN KEY (tenant_id, exception_id)
    REFERENCES tenant.exception (tenant_id, id) ON DELETE CASCADE
);


-- =====================================================================
-- ROW LEVEL SECURITY — G100's deny-on-NULL, written as the predicate rather
-- than described. `0001`'s predicate VERBATIM, on `USING` **and** on
-- `WITH CHECK`, on all three tables.
--
-- `ENABLE` and `FORCE`, both, on every one. `ENABLE` alone leaves the TABLE
-- OWNER exempt, and `0001` states the consequence: *"a test that connects as
-- the owner then passes with the policy doing nothing, and passes just as well
-- with the policy dropped."* `tests/db/exception-register.test.ts` §3 is the
-- negative control that tells database isolation from a handler's `WHERE`.
--
-- 🛑 `WITH CHECK` IS STATED EXPLICITLY ON ALL THREE EVEN THOUGH ONLY ONE TAKES
--    A WRITE, WHICH IS `0009`'s RULE AND `0012`'s PRACTICE: *"the commit that
--    grants a write here owes it in the same commit as the writer"*, and the
--    tables that take no write carry it anyway *"so a later `GRANT INSERT`
--    cannot arrive without the write half already in place."*
--
-- ⚠️ ON `UPDATE`, `WITH CHECK` IS THE HALF THAT MATTERS AND IT IS EASY TO
--    MISREAD. `USING` decides which rows an UPDATE may SEE; `WITH CHECK`
--    decides what the row may BECOME. Without it, a row could be updated INTO
--    another tenant — `SET tenant_id = 'ten_globex'` — and the policy would
--    have permitted it because the row it started from was visible. The
--    column-level grant below makes that unreachable a second way (no privilege
--    on `tenant_id`), and both controls are stated rather than one relied on.
-- =====================================================================

ALTER TABLE tenant.exception                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.exception                FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.exception_observed_value ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.exception_observed_value FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.exception_reversal       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.exception_reversal       FORCE  ROW LEVEL SECURITY;

CREATE POLICY exception_rls ON tenant.exception
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY exception_observed_value_rls ON tenant.exception_observed_value
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY exception_reversal_rls ON tenant.exception_reversal
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- =====================================================================
-- GRANTS. By name, because `0003` deliberately declines `ALTER DEFAULT
-- PRIVILEGES` on this schema: *"A future table created here is unreachable by
-- the app until granted BY NAME … default privileges would silently hand the
-- request path a table nobody decided to expose."*
--
-- 🛑 READ THE VERBS. THERE IS NO `INSERT` AND NO `DELETE` ANYWHERE IN THIS
--    FILE, AND EXACTLY ONE `UPDATE`, WHICH IS COLUMN-LEVEL. G358.
--
--   `exception`                 SELECT, and `UPDATE (assigned_to)`.
--   `exception_observed_value`  SELECT.
--   `exception_reversal`        SELECT.
--
-- ---------------------------------------------------------------------
-- WHY NO `INSERT` ON `exception`. An exception is RAISED BY THE ENGINE, and
-- there is no engine writer: `0007`'s thirteen tables persist a
-- `SetReconciliationResult` and nothing converts one into an `Exception`.
-- Granting the verb ahead of that writer is `0004`'s refusal wearing a
-- privilege — and it is worse here than there, because a request path that
-- could INSERT an exception could **mint a finding against itself**: raise a
-- `critical` row, assign it, and the queue a controller closes a period on is
-- a queue the caller wrote. Rows arrive as the migrator, the way `0008`'s
-- governance lists and `0012`'s `document_field_spec` rows do.
--
-- ---------------------------------------------------------------------
-- 🛑 WHY `UPDATE (assigned_to)` AND NOT `UPDATE`. G358, AND IT IS THE ONE
--    GENUINELY NEW PRIVILEGE SHAPE IN THIS REPOSITORY — DERIVE IT:
--        grep -c 'GRANT UPDATE (' db/migrations/*.sql        → this file only
--
-- `assignException` is the operating act C3 is built around — *"taking a row is
-- the operating act exceptions_operate names"* — and it is a PUT that replaces
-- exactly one field. A blanket `GRANT UPDATE ON tenant.exception` would serve
-- it, and it would also put inside a handler's reach:
--
--   `severity` / `severity_rank`   the ordering the whole queue is triaged by.
--                                  A caller who could lower a rank could bury a
--                                  critical finding under a page boundary and
--                                  nothing in the product would look wrong.
--   `status`                       resolution state, with no resolution row and
--                                  no reversal trail — the exact laundering the
--                                  contract refuses an agent at
--                                  `reverseResolution`.
--   `value_at_risk_*`              the number a period is closed on.
--   `explanation_summary`          EVIDENCE. `0012`: amending stored evidence
--                                  *"would silently falsify"* what was
--                                  registered against it.
--   `cost_centre` / `legal_entity` **THE AUTHORISATION ATTRIBUTES.** A request
--                                  path that could write these could re-scope
--                                  who may see the row, which is invariant 8's
--                                  narrowing rewritten by the thing it narrows.
--
-- PostgreSQL grants `UPDATE` per column, so the narrow privilege is available
-- and costs one pair of parentheses. **Taking the wide one would be a privilege
-- chosen for convenience over a control that was already there**, which is §5's
-- own shape. `tests/db/exception-register.test.ts` §2 witnesses it: the app
-- role updates `assigned_to` and succeeds, then updates `severity_rank` in the
-- same scope and is refused by the database — not by a `WHERE`, not by a
-- handler, and not by a review.
--
-- ⚠️ `tenant_id` IS NOT IN THE GRANT, WHICH IS THE SECOND HALF OF THE RLS NOTE
--    ABOVE. A row cannot be updated INTO another tenant because nothing on the
--    request path holds the privilege to write the column that would do it.
--
-- 🛑 NO `DELETE` ANYWHERE. `RetentionPolicy.days.exception` is a sweep's verb
--    and there is no sweep; the grant lands with it, in that commit, with the
--    assertions that it ran. `0012` says the same about erasure and
--    `document_payload`.
-- =====================================================================

GRANT SELECT                        ON tenant.exception                TO tenant_rw;
GRANT UPDATE (assigned_to)          ON tenant.exception                TO tenant_rw;
GRANT SELECT                        ON tenant.exception_observed_value TO tenant_rw;
GRANT SELECT                        ON tenant.exception_reversal       TO tenant_rw;

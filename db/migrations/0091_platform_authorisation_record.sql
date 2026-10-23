-- =====================================================================
-- 0091 — THE PLATFORM AUTHORISATION RECORD. G730 (19 Sep 2026).
--
-- **INVARIANT 10's SECOND HOME.** `CLAUDE.md`, verbatim, because a paraphrased
-- invariant is a changed invariant:
--
--     "10. **An act with no authorisation is unrecordable.** `authorize()`
--      mints an `AuthorizationGrant` and nothing else does; `AuditEvent`,
--      `DataAccessEvent` and `UsageRecord` all carry its id, and
--      `AUTHORIZATION_MAY_BE_ABSENT` says which actor kinds may leave it null
--      (one: `system`). This does **not** make an unauthorised act impossible
--      — nothing can, against root — it makes one visible or detectable,
--      which is strictly more than the model had."
--
-- 🛑 THE INVARIANT'S SENTENCE DOES NOT MOVE AND MUST NOT BE REWRITTEN. The
--    owner's ruling of 19 Sep 2026 is about WHERE the record lives, not about
--    what it means: **"invariant 10 keeps one meaning with two homes, and each
--    home has a scope that can actually read it."**
--
-- ═══════════════════════════════════════════════════════════════════════
-- THE MEASURED PROBLEM THIS ANSWERS — G728, WHICH REPORTED IT RATHER THAN
-- CLOSING IT.
-- ═══════════════════════════════════════════════════════════════════════
--
-- `decide()`'s fourth arm ALLOWS a tenant-less platform principal — witnessed
-- in `tests/model/console-principal.test.ts` §2a. `authorize()` could not
-- record the act: `AuthorizationGrant extends TenantScoped`,
-- `db/migrations/0010_authorisation_record.sql` keys its policy on
-- `app.tenant_id`, and **G301 makes minting a PRECONDITION OF MOUNTING** —
-- `mountTier()`'s sixth fence refuses a gated operation whose handler mints
-- nothing. So a console operation could be DECIDED and could not BOOT. G728's
-- own words: *"that is the thing standing between a console principal and a
-- mounted console operation, and it is a RULING rather than a missing line."*
--
-- 🛑 THE SHORTCUT THAT WAS REFUSED, AND IT IS REFUSED AGAIN HERE RATHER THAN
--    QUIETLY TAKEN: a nullable `tenant_id` on `tenant.authorization_grant`.
--    Under G100 every policy DENIES on NULL, so that row would be visible to
--    NO SCOPE — a record that exists and cannot be read, which is G284's
--    *"a result nobody may read is not persistence"* arriving on the audit
--    trail. `grep -cE '^[^-]*tenant_id' db/migrations/0091_platform_authorisation_record.sql`
--    → 0. There is no tenant column in this file at all.
--
-- ⚠️ THE `^[^-]*` IS NEW — G2181, 28 Sep 2026 — AND THE UNANCHORED FORM
--    ANSWERED **SEVEN** AGAINST A STATED ZERO, ON THE ONE DERIVATION IN THIS
--    FILE THAT CARRIES AN INVARIANT. All seven were comments, this one among
--    them, and the claim they falsified is the load-bearing sentence beside
--    them: *there is no tenant column in this file at all*. It is still true;
--    the command could not show it.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE SHAPE IS `0009`'s, COPIED AND NOT REINVENTED, AND ITS SENTENCE IS
--    THE JUSTIFICATION FOR THIS ONE.
-- ═══════════════════════════════════════════════════════════════════════
--
-- Five of `db/migrations/0009_identity_substrate.sql`'s eight tables are keyed
-- on the SESSION rather than on a tenant, and that file says why:
--
--     "because a person is read BEFORE a tenant is selected and a `tenant_id`
--      predicate would deny unconditionally under G100"
--
-- A console act is the same fact one step later: there is no tenant to select,
-- so a `tenant_id` predicate on its record would deny unconditionally for
-- exactly the same reason. **The owner named that precedent in the ruling**:
-- *"`0009` already does exactly this for the five tables read BEFORE a tenant
-- is selected. Same argument, same shape."* The predicate below is `0009`'s,
-- byte for byte apart from the column it compares, and the sameness is
-- load-bearing rather than tidy — a reader comparing them should find it
-- identical, and if it is not, this file has quietly re-decided how a session
-- is identified while claiming only to add a table.
--
-- RULINGS THIS APPLIES (docs/HANDOFF.md §3):
--   G730  the second home, keyed on the acting session. THE OWNER'S.
--   G728  the finding this closes, and the nullable column it refused.
--   G301  the record is minted IN THE HANDLER, and an operation may not MOUNT
--         until it mints one. **THE FENCE IS UNTOUCHED BY THIS FILE AND MUST
--         STAY THAT WAY**: it keys on `capability.kind === 'capability'` and
--         knows nothing about homes, so a gated console operation whose
--         handler mints nothing still does not boot.
--   G303  `AssignmentScope`'s six dimensions get columns with the first
--         mounted operation that READS one. **There are none here**, and on
--         this table the argument is stronger than on `0010`'s: `decide()`'s
--         platform arm returns `DENY_ALL` on an ALLOW, deliberately — *"a
--         platform allow is a VERB and never a DIMENSION"* — so six columns
--         here would store one constant six times for every row the arm can
--         ever produce.
--   G97   every branded id is `text`. **THERE IS NO `uuid` IN THIS FILE.**
--   G100  every policy DENIES on NULL. With `app.session_ref` unset the
--         subquery below returns no row, the comparison is against NULL, and
--         both the read and the write fail closed.
--   G101  transaction-mode pooling assumed; `SET LOCAL` only, through
--         `db/session-scope.ts`. This file adds no helper.
--   G88   forward-only. There is no `down`. NO EARLIER MIGRATION IS EDITED BY
--         THIS FILE — no `ALTER POLICY`, no `ALTER TABLE`, nothing.
--
-- ⚠️ SCHEMA-QUALIFIED THROUGHOUT, because 0003 requires it from 0004 on.
--
-- ⚠️ IT LIVES IN `tenant.` AND HOLDS NO TENANT ROW, WHICH LOOKS WRONG AND IS
--    `0009`'s PRECEDENT EXACTLY: `tenant.platform_role`,
--    `tenant.platform_role_capability` and `tenant.platform_role_assignment`
--    are platform-scoped rows in that schema already. The schema is where the
--    application's data lives, not a claim about tenancy — and the practical
--    consequence is the one that matters: `tests/db/rls-census.test.ts` (G446)
--    enumerates every table in `tenant.` from the catalogue and fails on one
--    without RLS. **A table placed outside `tenant.` to be "more honest" would
--    be a table the census cannot see**, which is §5.1 — a rule keyed on a
--    landmark — being defeated by the very move that looks tidier. The census
--    is itself keyed on that landmark and an adversarial pass has already
--    flagged it; putting this table where the census looks is the cheap half
--    of that, and widening the census is its own slice.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 WHAT THIS FILE DELIBERATELY DOES NOT BUILD. THE ABSENCES ARE `0010`'s,
--    LISTED RATHER THAN DISCOVERED, AND EACH IS STILL OPEN BY NAME.
-- ═══════════════════════════════════════════════════════════════════════
--
--   NO `revoked_at`.        A revocation is an ACT, and there is no operation
--                           that takes it and no reader that would honour it.
--                           `0004_subject_ledger.sql`'s rule, which this
--                           directory has now applied five times: a column
--                           ahead of its reader is a column nothing checks.
--   NO EVENT STREAMS.       `db/migrations/0014_invariant_10_event_streams.sql`
--                           gives `AuditEvent`, `DataAccessEvent` and
--                           `UsageRecord` tables and every one of them is
--                           TENANT-SCOPED, with `tenant_id` in the policy and
--                           in the primary key. **So a console act leaves a
--                           record of its AUTHORISATION and no record of its
--                           ACCESS, and nobody should read an access log off
--                           this table.** Whether those three streams gain a
--                           platform home is the same ruling one table over
--                           and it is NOT taken here — writing three more
--                           tables today would be three vocabularies with
--                           nothing checking any of them, which is the reason
--                           `0010` gave for not writing them either.
--   NO `redeemed_at`.       Nothing presents a grant id: the mint and the act
--                           are one transaction. `redeemAuthorization()` takes
--                           an `AuthorizationGrant` and binds FOUR things, one
--                           of which is the TENANT — so a platform redeem is a
--                           different function with three bindings, and it is
--                           owed by the commit that first hands a grant id to
--                           a caller.
--   NO `home` COLUMN.       `model/access.ts` discriminates the two grant types
--                           on a `home` tag. **The TABLE is the home.** A
--                           column holding one constant on every row is
--                           `0002_run.sql`'s prohibition and `0010`'s scope
--                           note, and it would additionally be a second place
--                           for the routing decision to be got wrong.
--
-- ⚠️ AND ONE ABSENCE THAT IS THIS FILE'S OWN. `AUTHORIZATION_MAY_BE_ABSENT`
--    admits exactly one actor kind — `system` — and G317 requires that
--    enforced AT THE COLUMN rather than in review. **There is nothing here for
--    it to be enforced on**: that rule governs a row that REFERENCES an
--    authorisation (`0014`'s three streams carry `CHECK (authorization_id IS
--    NOT NULL OR actor_kind = 'system')`), and this table IS the
--    authorisation. The rule lands on the platform event streams when somebody
--    writes them, and it is named here so that commit does not have to
--    rediscover it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- THE GRANT — `model/access.ts`'s `PlatformAuthorizationGrant`, which extends
-- NOTHING, and in particular does not extend `TenantScoped`.
--
-- Derive the declaration, do not read it here:
--   grep -n 'export interface PlatformAuthorizationGrant' -A 40 model/access.ts
--
-- 🛑 THE PRIMARY KEY IS COMPOSITE — `(subject_user_id, id)` — AND IT IS
--    `0010`'s `(tenant_id, id)` WITH THE SCOPE COLUMN SWAPPED. The reason
--    transfers exactly: *"a cross-tenant reference has to be UNREPRESENTABLE
--    rather than merely unlikely."* Here it is cross-SUBJECT, and
--    `platform_authorization_grant_via` below carries the composite key
--    forward, so **a via line for another person's grant cannot be written at
--    all.** The leading column is also the one the policy narrows on, so the
--    planner sees a predicate no reader wrote — the shape
--    `authorization_grant_subject_idx` and `role_assignment_holder_idx`
--    already take.
--
-- ⚠️ NO `CHECK` CONSTRAINT ON `org_class`, `capability`, `resource_class` OR
--    `resource_type`, for `0002_run.sql`'s reason in its own words — a third
--    copy of a closed enum is *"a third place to drift, and the one nothing
--    checks, because no pair in the wire-mirror addresses SQL."* Every one of
--    them is written from a value the TYPE SYSTEM has already closed.
--
-- ⚠️ AND NO `CHECK (org_class = 'platform')`, WHICH IS THE ONE A REVIEWER WILL
--    ASK FOR. It would be true of every row this repository can produce —
--    `decide()`'s 2f guard refuses a tenant-less customer and a tenant-less
--    partner BY NAME, so the platform arm is the only one that reaches here.
--    It is refused for the same reason as the other four, and for a second:
--    the column is STAMPED so that *"an auditor reading a March row needs
--    March's organisation"*, and a constraint asserting what the stamp must
--    say would make the stamp decorative.
--
-- 🛑 `expires_at` IS `NOT NULL`, the model's sentence made unrepresentable
--    rather than checked — `0010`'s move and `0009`'s before it. *"An
--    open-ended grant is not a grant."*
-- ---------------------------------------------------------------------

CREATE TABLE tenant.platform_authorization_grant (
  -- WHO, and ALSO the scope this row is read under. The two are one column
  -- deliberately: the policy compares this against the user of the session
  -- named in `app.session_ref`, so a record can be written by the person it
  -- is about and by nobody else.
  --
  -- ⚠️ THERE IS NO `session_id` AND NO `handle_digest` COLUMN, WHICH IS THE
  --    OTHER SHAPE THIS COULD HAVE TAKEN. The session is how the database
  --    learns who is asking; it is not a fact about the act. Storing the
  --    digest would put a credential-derived value in an append-only table
  --    that outlives every session it could name, and would make an auditor's
  --    row join to a credential rather than to a person.
  subject_user_id text        NOT NULL,
  id              text        NOT NULL,
  -- Derived at session establishment from the DOOR — `orgFor(connection.owner)`
  -- — and STAMPED here, never re-derived. See the note above about the `CHECK`
  -- this deliberately does not carry.
  org_class       text        NOT NULL,
  -- Null on every row this arm can produce. A null is a VALUE, not an absence.
  partner_id      text,
  -- WHAT. One capability. *"A grant that covered several would be a session."*
  capability      text        NOT NULL,
  -- ON WHAT — `ResourceRef`, flattened into four columns because it is a value
  -- object and not an entity. `0010`'s argument, unchanged, including the one
  -- about denormalising the class rather than joining to today's mapping:
  -- *"an auditor reading a March grant needs March's classification."*
  resource_class  text        NOT NULL,
  resource_type   text        NOT NULL,
  -- NULLABLE, and the null is the load-bearing case: *"opening a list, running
  -- a report."*
  resource_id     text,
  -- A SCOPE, NEVER A GRANT. *"Its presence narrows; its absence never widens."*
  solution_id     text,
  issued_at       timestamptz NOT NULL,
  expires_at      timestamptz NOT NULL,

  PRIMARY KEY (subject_user_id, id)
);

-- The query an auditor asks of this table: *"what did this person do, most
-- recent first"*. The primary key already leads with the subject and the policy
-- has already narrowed to one, so this adds the ORDER and nothing else.
CREATE INDEX platform_authorization_grant_issued_idx
  ON tenant.platform_authorization_grant (subject_user_id, issued_at DESC);


-- ---------------------------------------------------------------------
-- WHAT CARRIED IT — `DecisionVia`, and `0010`'s child table with the scope
-- column swapped.
--
-- 🛑 A CHILD TABLE, NOT A `jsonb` COLUMN AND NOT THREE PARALLEL ARRAYS, FOR
--    `0009`'s REASON ABOUT `role_capability` and `0010`'s restatement of it:
--    the one question an auditor asks is *"which acts ran under assignment
--    X"*, which is a relational query against rows and is not a query at all
--    against an opaque value.
--
-- 🛑 NO FOREIGN KEY ON `assignment_id`, AND THE REASON IS `0010`'s AND IS A
--    TYPE RATHER THAN A PREFERENCE. `DecisionVia.assignmentId` is
--    `RoleAssignmentId | PlatformRoleAssignmentId` — a union of two brands
--    over two different tables — and a foreign key has to name ONE.
--
--    ⚠️ AND THE TEMPTING NARROWING IS REFUSED HERE TOO, EVEN THOUGH IT LOOKS
--    SAFE ON THIS TABLE. Every row reachable today carries a
--    `PlatformRoleAssignmentId`, because only `decide()`'s platform arm can
--    produce a grant with no tenant — so `REFERENCES tenant.platform_role_
--    assignment (id)` would appear to cost nothing. It is refused because the
--    column's TYPE is still the union: the day a second arm can mint a
--    tenant-less grant, the key makes that grant's via line UNWRITABLE, which
--    is the failure `0010` names for the mirror case — *"naming
--    `role_assignment` would make a platform principal's grant unwritable, the
--    one organisation whose acts an auditor most wants recorded."* A schema
--    that is correct only while one arm exists is `0010`'s warning read
--    backwards.
--
--    The cost is `0010`'s, unchanged and named rather than absorbed: a via
--    line can point at an assignment id that exists in no table, and nothing
--    in the database says it is wrong. *"A READER MUST DISCRIMINATE BEFORE
--    DEREFERENCING, and nothing here will remind them."*
--
-- ⚠️ `seq` RATHER THAN A BARE SET, for `0010`'s reason: `Decision.via` is
--    ORDERED, and a `PRIMARY KEY (subject_user_id, grant_id, assignment_id)`
--    would silently collapse a duplicate and lose the order.
-- ---------------------------------------------------------------------

CREATE TABLE tenant.platform_authorization_grant_via (
  subject_user_id text    NOT NULL,
  grant_id        text    NOT NULL,
  -- Zero-based, in `Decision.via`'s own order.
  seq             integer NOT NULL,
  -- A `PlatformRoleAssignmentId` on every row reachable today. See above.
  assignment_id   text    NOT NULL,
  role_id         text    NOT NULL,
  -- PINNED. `decide()` stops evaluating an assignment whose pin has moved in
  -- EITHER direction, so the version stored here is the one that actually
  -- decided, not the one the role carries today.
  role_version    integer NOT NULL,

  PRIMARY KEY (subject_user_id, grant_id, seq),
  FOREIGN KEY (subject_user_id, grant_id)
    REFERENCES tenant.platform_authorization_grant (subject_user_id, id) ON DELETE CASCADE
);

-- *"Which acts ran under this assignment"* — the reverse question, and the one
-- an investigation starts from.
CREATE INDEX platform_authorization_grant_via_assignment_idx
  ON tenant.platform_authorization_grant_via (assignment_id);


-- =====================================================================
-- ROW-LEVEL SECURITY.
--
-- `ENABLE` and `FORCE`, both, on both — 0001's argument unchanged and repeated
-- because it is what makes the negative control in
-- `tests/db/platform-authorisation-record.test.ts` mean anything: `ENABLE`
-- alone leaves the TABLE OWNER exempt, so a test connecting as the owner
-- passes with the policy doing nothing and passes just as well with the policy
-- DROPPED. `FORCE` is what makes the explicit `BYPASSRLS` attribute on
-- `reconcile_migrator` the ONLY route to the exemption.
--
-- 🛑 `WITH CHECK` IS STATED ON BOTH, AND IT IS THE HALF THAT MATTERS MOST HERE.
--    `0009` omits it on its three tenant-scoped policies and says what is
--    owed: *"the commit that grants a write here owes the `WITH CHECK` in the
--    same commit as the writer."* This commit grants `INSERT`, so it owes one.
--    Stated on both halves rather than left to default from `USING`, for
--    0005's reason: *"so that a later `FOR SELECT`/`FOR ALL` edit cannot
--    silently drop the write half."*
--
-- ⚠️ THE ATTACK THE `WITH CHECK` ANSWERS IS `0010`'s, ARRIVING ON A DIFFERENT
--    AXIS. There it is a bug that takes the TENANT from the grant object
--    rather than from the transaction's scope; here it is a bug — or a caller
--    — that writes a record naming SOMEBODY ELSE as the subject. Without it, a
--    console session could deposit a row in the audit trail attributing its
--    own act to another staff member. With it, the two must agree or the
--    INSERT fails and the enclosing transaction rolls the whole act back.
--    **The act and the record fall together. That is the property, and it is
--    the same property `0010` states one table over.**
-- =====================================================================

ALTER TABLE tenant.platform_authorization_grant     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.platform_authorization_grant     FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.platform_authorization_grant_via ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.platform_authorization_grant_via FORCE  ROW LEVEL SECURITY;

-- `0009`'s SESSION PREDICATE, VERBATIM apart from the column it compares. The
-- sameness across `user_rls`, `identity_connection_rls`,
-- `platform_role_assignment_rls` and this policy is load-bearing rather than
-- tidy.
--
-- ⚠️ `tenant.session` IS ITSELF UNDER RLS INSIDE THIS SUBQUERY, which is not
--    folklore here — 0005 MEASURED it: *"PostgreSQL applies row-level security
--    to tables referenced inside a policy expression, as the querying role."*
--    `session_rls` opens exactly the row whose `handle_digest` matches
--    `app.session_ref`, so the subquery is doubly narrowed and cannot return
--    another person's session even if the `WHERE` clause were dropped.
CREATE POLICY platform_authorization_grant_rls ON tenant.platform_authorization_grant
  USING (
    subject_user_id = (
      SELECT s.user_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
  )
  WITH CHECK (
    subject_user_id = (
      SELECT s.user_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
  );

-- 🛑 KEYED ON ITS OWN `subject_user_id` RATHER THAN JOINING TO THE PARENT,
--    which is `0009`'s decision for `role_capability` and `0010`'s for
--    `authorization_grant_via`, and the same argument: a join would be a
--    second expression that has to agree with the first, and §5.3 says the
--    copy is always what drifts. The composite foreign key already makes a via
--    line for another person's grant unrepresentable, so the two narrowings
--    cannot disagree about anything.
CREATE POLICY platform_authorization_grant_via_rls ON tenant.platform_authorization_grant_via
  USING (
    subject_user_id = (
      SELECT s.user_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
  )
  WITH CHECK (
    subject_user_id = (
      SELECT s.user_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
  );


-- ---------------------------------------------------------------------
-- GRANTS. By name, because 0003 declines `ALTER DEFAULT PRIVILEGES` on this
-- schema.
--
-- 🛑 `SELECT` AND `INSERT`. **NO `UPDATE`. NO `DELETE`.** `0010`'s sentence,
--    unchanged: *"append-only is a PRIVILEGE here rather than a convention."*
--    Nothing reachable from a request can amend a record of an act, or erase
--    one — not the handler that wrote it, not a later handler, not a bug in
--    either. The app role holds no `ALTER` either, so it cannot drop the
--    policies above; that comes from `createRoles()` in `db/provision.ts`
--    rather than from this file.
--
-- ⚠️ AND THE ONE CASCADE `0010` NAMES DOES NOT EXIST HERE, WHICH IS WORTH
--    SAYING BECAUSE IT CHANGES THE RETENTION ANSWER. `tenant.authorization_grant`
--    is `ON DELETE CASCADE` from `tenant.tenant`, so deleting a tenant erases
--    its authorisation records — *"the right answer for a right-to-erasure
--    path and the wrong answer for an audit trail."* This table references no
--    tenant, so nothing erases it, and there is no `tenant."user"` foreign key
--    either: a person's platform acts survive their directory row. **That is
--    the opposite trade from `0010`'s and it is taken deliberately** — a
--    platform principal is OURS, not a customer's, so no erasure request
--    reaches these rows and the audit answer wins. The retention ruling that
--    eventually settles `0010`'s cascade now has two tables to reconcile and
--    they do not agree; that is named rather than harmonised by guesswork.
-- ---------------------------------------------------------------------

GRANT SELECT, INSERT ON tenant.platform_authorization_grant     TO tenant_rw;
GRANT SELECT, INSERT ON tenant.platform_authorization_grant_via TO tenant_rw;

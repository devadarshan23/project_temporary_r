-- =====================================================================
-- 0010 — THE AUTHORISATION RECORD. G301 (19 Sep 2026).
--
-- **THIS IS INVARIANT 10's TABLE, AND UNTIL TODAY INVARIANT 10 HAD NONE.**
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
-- 🛑 READ THE LAST SENTENCE BEFORE READING THE TABLE, AND DO NOT LET THIS FILE
--    BE QUOTED AS MORE THAN IT IS. Nothing below stops anybody holding the
--    migrator credential from reading `tenant.run` and writing no row here.
--    What it does is make the ACT and the RECORD arrive in ONE TRANSACTION on
--    the only path a request can take — so an act with no record is an act that
--    did not happen, and an act by a caller no authority covers never opens the
--    transaction at all. **Visible or detectable. Not impossible.**
--
-- ⚠️ WHAT ENDED HERE, NAMED SO THE SIZE OF IT IS NOT LOST. Since G200's gate
--    landed, `tests/http/authorisation-record.test.ts` has PASSED BECAUSE THE
--    PROPERTY WAS ABSENT — a tripwire asserting that `server/` and
--    `db/migrations*/` contained not one of seven words. It fired on this file.
--    Its own header names the two things it demanded of the commit that made it
--    fire: *"the record updated, and these assertions replaced by ones that
--    verify the record is WRITTEN rather than that it is absent."* Both are in
--    this commit. **The suite was not made green by deleting an assertion.**
--
-- 🛑 AND THE DEFERRAL THIS ENDS IS ONE THIS DIRECTORY ALREADY PAID FOR ONCE.
--    `db/migrations/0004_subject_ledger.sql` records a `NOT NULL` grant column
--    being REMOVED rather than shipped, because *"a `NOT NULL` column no code
--    path populates is not enforcement of invariant 10; it is the appearance of
--    it."* This file lands the column set WITH its writer —
--    `server/data-plane/authorisation-record.ts` — and with the reader that
--    witnesses it, `tests/db/authorisation-record.test.ts`. A table here and a
--    writer in a later commit would be the 0004 shape arriving a second time.
--
-- RULINGS THIS APPLIES (docs/HANDOFF.md §3):
--   G301  the record is minted IN THE HANDLER, because a handler knows its
--         `ResourceRef` and a `preValidation` hook does not; and **an operation
--         may not MOUNT until it mints one.** The mounting half is not in this
--         file — it is a boot fence in `server/http/app.ts` — but this file is
--         what makes it satisfiable.
--   G303  `AssignmentScope`'s six dimensions get columns with the first mounted
--         operation that READS one. **There are none here.** See the scope note.
--   G97   every branded id is `text`; the slug is stored VERBATIM. **THERE IS
--         NO `uuid` ANYWHERE IN THIS FILE AND THERE IS NONE IN THIS MODEL.**
--   G100  every policy DENIES on NULL. A forgotten `set_config` yields an EMPTY
--         result set — and, on a write, a refusal.
--   G101  transaction-mode pooling assumed; `SET LOCAL` only, through
--         `db/tenant-scope.ts`. This file adds no helper.
--   G88   forward-only. There is no `down`. 0001–0009 ARE NOT EDITED BY THIS
--         FILE.
--
-- ⚠️ SCHEMA-QUALIFIED THROUGHOUT, because 0003 requires it from 0004 on.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 WHAT THIS FILE DELIBERATELY DOES NOT BUILD. G301 SAYS SO IN ITS OWN
--    VOICE AND THE ABSENCES ARE LISTED RATHER THAN DISCOVERED.
-- ═══════════════════════════════════════════════════════════════════════
--
-- The row says: *"WHAT IS NOT SETTLED HERE: the grant LIFECYCLE — expiry,
-- revocation, and which of `AuditEvent`, `DataAccessEvent` and `UsageRecord`
-- carry the id on which path."* So:
--
--   NO `revoked_at`.        A revocation is an ACT, and there is no operation
--                           that takes it and no reader that would honour it.
--                           `0004_subject_ledger.sql`'s rule, which this
--                           directory has now applied four times: a column
--                           ahead of its reader is a column nothing checks.
--                           `redeemAuthorization()` already re-derives the
--                           whole authority on every presentation — *"a fired
--                           employee's in-flight acts stop on the next call"* —
--                           so the absence costs a stored-revocation query and
--                           costs nothing at the boundary.
--   NO `data_access_event`. NO `audit_event`. NO `usage_record`. Those are the
--                           three STREAMS that carry the id, and which one a
--                           served read belongs in is the question G301 leaves
--                           open. Writing all three today would be three
--                           vocabularies with nothing checking any of them.
--                           **The narrow claim this file earns is exact: a
--                           SERVED READ leaves a record of the authorisation it
--                           ran under. It does not yet leave an access-log
--                           entry, and nobody should read one off this table.**
--   NO `redeemed_at`.       Nothing presents a grant id: the mint and the act
--                           are one transaction, so there is no second hop to
--                           stamp. The day a grant is handed to a caller and
--                           presented back, `redeemAuthorization()` is the
--                           reader and it owes its own column.
-- =====================================================================


-- ---------------------------------------------------------------------
-- THE GRANT — `model/access.ts`'s `AuthorizationGrant`, which
-- **`extends TenantScoped`**, so 0001's predicate applies verbatim and nothing
-- about tenancy is invented here.
--
-- Derive the declaration, do not read it here:
--   grep -n 'export interface AuthorizationGrant extends TenantScoped' -A 60 model/access.ts
--
-- THE PRIMARY KEY IS COMPOSITE for 0001's reason and for 0009's: a
-- cross-tenant reference has to be UNREPRESENTABLE rather than merely unlikely.
-- `authorization_grant_via` below carries the composite key forward, so a via
-- line for another tenant's grant cannot be written at all.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE COLUMN SET IS THE INTERFACE'S MINUS `scope`, AND THAT ONE OMISSION
--    IS A RULING RATHER THAN A SHORTFALL.
-- ═══════════════════════════════════════════════════════════════════════
--
-- **G303: `AssignmentScope`'s six dimensions get columns with the first mounted
-- operation that READS one.** `0009_identity_substrate.sql` already carries the
-- long version of why, and the consequence lands here rather than there:
-- `role_assignment` has no scope columns, so `server/data-plane/identity.ts`
-- supplies `DENY_ALL` for both the assignment scope and the role's
-- `defaultScope`; `narrowestScope(DENY_ALL, DENY_ALL)` is `DENY_ALL`; and
-- `decision.scope` is therefore `DENY_ALL` **for every row this database can
-- produce.** Six columns storing one constant six times is not a record of
-- anything — it is a second vocabulary with nothing checking it, which is
-- `0002_run.sql`'s prohibition.
--
-- ⚠️ AND THE DEBT IS EXACT, SO NOBODY READS THE ABSENCE AS A DECISION THAT
--    SCOPES DO NOT MATTER: the commit that gives `role_assignment` its scope
--    columns owes them HERE in the same commit, because the moment a decision
--    can carry a real scope, a grant that does not pin it is a grant that looks
--    unconditional. `AuthorizationGrant.scope` says so on itself — *"THE
--    EFFECTIVE SCOPE AT MINT. Pinned, and intersected again at redeem."*
--
-- ⚠️ NO `CHECK` CONSTRAINT ON `org_class`, `capability`, `resource_class` OR
--    `resource_type`, for `0002_run.sql`'s reason in its own words — a third
--    copy of a closed enum is *"a third place to drift, and the one nothing
--    checks, because no pair in the wire-mirror addresses SQL."* Every one of
--    them is written from a value the TYPE SYSTEM has already closed:
--    `authorize()` takes a `Capability`, `CAPABILITY_RESOURCE_CLASS` is a total
--    `Record<Capability, AccessResourceClass>`, and `orgClass` comes off a
--    `PrincipalContext`. **The write side is closed by `tsc`; the read side, if
--    one is ever built, classifies rather than casts.**
--
-- 🛑 `expires_at` IS `NOT NULL`, AND IT IS THE MODEL'S SENTENCE MADE
--    UNREPRESENTABLE RATHER THAN CHECKED — the same move `0009` makes for
--    `platform_role_assignment.expires_at`. The declaration: *"Required, never
--    null. 'An open-ended grant is not a grant' — `PartnerAccessGrant`'s rule,
--    and this is the shortest-lived grant in the model, so it is the last place
--    to relax it."* `MAX_AUTHORIZATION_SECONDS` bounds it in the model at 60
--    seconds to an hour by resource class; this column cannot bound it, and
--    does not pretend to.
-- ---------------------------------------------------------------------

CREATE TABLE tenant.authorization_grant (
  tenant_id       text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id              text        NOT NULL,
  -- WHO. Narrowed to the `userId` half of `PrincipalContext.subject` — there is
  -- no email and no display name here, and the narrowing is the declaration's
  -- own: *"no evaluation and no audit row should be able to reach an email or a
  -- display name through an authorisation."*
  subject_user_id text        NOT NULL,
  -- Derived at session establishment from the DOOR — `orgFor(connection.owner)`
  -- — and STAMPED here, never re-derived. `AuditActor` stamps it for the same
  -- reason: an auditor reading a March row needs March's organisation.
  org_class       text        NOT NULL,
  -- Null unless `org_class = 'partner'`. A null is a VALUE, not an absence.
  partner_id      text,
  -- WHAT. One capability. *"A grant that covered several would be a session."*
  capability      text        NOT NULL,
  -- ON WHAT — `ResourceRef`, flattened into four columns because it is a value
  -- object and not an entity: `docs/identity-classification.md` is the
  -- authority, and nothing anywhere points at a `ResourceRef` by id.
  --
  -- 🛑 `resource_class` IS DENORMALISED FROM `CAPABILITY_RESOURCE_CLASS` RATHER
  --    THAN JOINED AT READ TIME, and the declaration argues it: *"the mapping
  --    is a platform artefact and a platform release may move a capability
  --    between classes — `configure_telemetry` moved from `configuration` to
  --    `authority` on 5 Aug. An auditor reading a March grant needs March's
  --    classification, and a join to today's table gives them today's."*
  resource_class  text        NOT NULL,
  -- *"Entity name: 'Exception', 'SourceDocument', 'Solution'. Never parsed."*
  resource_type   text        NOT NULL,
  -- NULLABLE, and the null is the load-bearing case rather than the leftover
  -- one: *"Null where the act is genuinely not instance-bound — opening a list,
  -- running a report. A null here is what makes `scope` load-bearing rather
  -- than redundant: with no instance to check, the scope IS the check."*
  -- `listRuns` writes a null here on every request, which is exactly why the
  -- G303 debt above is named rather than deferred quietly.
  resource_id     text,
  -- A SCOPE, NEVER A GRANT. *"Its presence narrows; its absence never widens."*
  solution_id     text,
  issued_at       timestamptz NOT NULL,
  expires_at      timestamptz NOT NULL,

  PRIMARY KEY (tenant_id, id)
);

-- The query an auditor asks of this table: *"what did this person do, most
-- recent first"*. `tenant_id` leads because `authorization_grant_rls` has
-- already narrowed to one tenant before the index is consulted — the planner
-- sees that predicate even though no reader wrote it. Same shape as
-- `role_assignment_holder_idx` and `membership_live_idx`.
CREATE INDEX authorization_grant_subject_idx
  ON tenant.authorization_grant (tenant_id, subject_user_id, issued_at DESC);


-- ---------------------------------------------------------------------
-- WHAT CARRIED IT — `DecisionVia`, and **THE FIELD G301 NAMES BY NAME.**
--
-- The ruling: *"`Decision.via` now names the `assignmentId`, the `roleId` and
-- the pinned `roleVersion`"* — and that is *"the evidence an
-- `AuthorizationGrant` would be minted FROM."* `AuthorizationGrant.via` says
-- what storing it buys, and it is the whole of the third missing stream:
-- *"`Decision.via` named the authority and joined to nothing because the
-- decision was computed and thrown away."* It is not thrown away now.
--
-- 🛑 A CHILD TABLE, NOT A `jsonb` COLUMN AND NOT THREE PARALLEL ARRAYS, FOR
--    `0009`'s REASON ABOUT `role_capability`: the one question an auditor asks
--    of this table is *"which acts ran under assignment X"*, which is a
--    relational query against rows and is not a query at all against an opaque
--    value. Three parallel arrays would additionally be three lists that can
--    disagree about their own length.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 NO FOREIGN KEY ON `assignment_id`, AND THE REASON IS A TYPE RATHER THAN A
--    PREFERENCE. READ IT BEFORE ADDING ONE.
-- ═══════════════════════════════════════════════════════════════════════
--
-- `DecisionVia.assignmentId` is `RoleAssignmentId | PlatformRoleAssignmentId`
-- — **a union of two brands over two DIFFERENT tables**, widened on 19 Sep 2026
-- by G289, whose own declaration says why: *"The platform arm carries a
-- `PlatformRoleAssignmentId`, which is a DIFFERENT brand over a different row
-- in a different table, and the two must not be interchangeable."* A foreign
-- key has to name ONE table. Naming `role_assignment` would make a platform
-- principal's grant UNWRITABLE — the one organisation whose acts an auditor
-- most wants recorded — and naming neither is the only shape that is true of
-- both arms.
--
-- ⚠️ THE COST IS REAL AND IS NAMED RATHER THAN ABSORBED: a via line can point
--    at an assignment id that exists in no table, and nothing in the database
--    says it is wrong. What survives is the declaration's own warning, which is
--    now a property of this schema too: *"A READER MUST DISCRIMINATE BEFORE
--    DEREFERENCING, and nothing here will remind them … `via` is an audit
--    artefact, not an input to another decision."* **There is no discriminant
--    column here because there is none on the type.** The day `via` becomes an
--    input to a decision, it needs one, and this paragraph is the warning that
--    it does.
--
-- ⚠️ `seq` RATHER THAN A BARE SET. `Decision.via` is `readonly DecisionVia[]` —
--    ORDERED — and `decide()` builds it by mapping over the assignments that
--    carried the verb in the order the reader returned them. A `PRIMARY KEY
--    (tenant_id, grant_id, assignment_id)` would silently collapse a duplicate
--    and would lose the order; this keeps both, and the write is a single
--    multi-row `INSERT` either way.
-- ---------------------------------------------------------------------

CREATE TABLE tenant.authorization_grant_via (
  tenant_id    text    NOT NULL,
  grant_id     text    NOT NULL,
  -- Zero-based, in `Decision.via`'s own order.
  seq          integer NOT NULL,
  -- `RoleAssignmentId` OR `PlatformRoleAssignmentId`. See the note above.
  assignment_id text   NOT NULL,
  role_id      text    NOT NULL,
  -- PINNED. G301 names this term explicitly, and `decide()` stops evaluating an
  -- assignment whose pin has moved in EITHER direction — so the version stored
  -- here is the one that actually decided, not the one the role carries today.
  role_version integer NOT NULL,

  PRIMARY KEY (tenant_id, grant_id, seq),
  FOREIGN KEY (tenant_id, grant_id)
    REFERENCES tenant.authorization_grant (tenant_id, id) ON DELETE CASCADE
);

-- *"Which acts ran under this assignment"* — the reverse question, and the one
-- an investigation starts from.
CREATE INDEX authorization_grant_via_assignment_idx
  ON tenant.authorization_grant_via (tenant_id, assignment_id);


-- =====================================================================
-- ROW-LEVEL SECURITY.
--
-- `ENABLE` and `FORCE`, both, on both — 0001's argument unchanged and repeated
-- because it is what makes the negative control in
-- `tests/db/authorisation-record.test.ts` mean anything: `ENABLE` alone leaves
-- the TABLE OWNER exempt, so a test connecting as the owner passes with the
-- policy doing nothing and passes just as well with the policy DROPPED. `FORCE`
-- is what makes the explicit `BYPASSRLS` attribute on `reconcile_migrator` the
-- ONLY route to the exemption.
--
-- 🛑 `WITH CHECK` IS STATED, AND THIS FILE IS WHERE `0009` SAID IT WOULD BE.
--    That file omits `WITH CHECK` on all three of its tenant-scoped policies
--    and says exactly why, and what is owed: *"The app role holds `SELECT` and
--    nothing else on every table here, so there is no write for a `WITH CHECK`
--    to constrain … **The commit that grants a write here owes the `WITH CHECK`
--    in the same commit as the writer.**"* **This is the first table on the
--    request path the app role may WRITE since `tenant.session`,** and the
--    predicate is stated on both halves rather than left to default from
--    `USING` — 0005's reason: *"so that a later `FOR SELECT`/`FOR ALL` edit
--    cannot silently drop the write half."*
--
-- ⚠️ THE `WITH CHECK` IS NOT DECORATION HERE, AND THE ATTACK IT ANSWERS IS
--    SPECIFIC. Without it, a bug anywhere in the minting path that took the
--    tenant from the GRANT OBJECT rather than from the transaction's scope
--    would write a record attributing one tenant's act to another — an audit
--    trail that reads as evidence and is not, which is the exact failure the
--    tripwire this file retires was written to prevent. With it, the two must
--    agree or the INSERT fails and `withTenantScope()` rolls the whole act back.
--    **The act and the record fall together. That is the property.**
-- =====================================================================

ALTER TABLE tenant.authorization_grant     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.authorization_grant     FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.authorization_grant_via ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.authorization_grant_via FORCE  ROW LEVEL SECURITY;

-- 0001's predicate, VERBATIM. The sameness across 0001, 0005, 0007, 0008, 0009
-- and this file is load-bearing rather than tidy — a reader comparing them
-- should find it identical, and if it is not, this file has quietly re-decided
-- tenancy while claiming to add to it.
CREATE POLICY authorization_grant_rls ON tenant.authorization_grant
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

-- 🛑 KEYED ON ITS OWN `tenant_id` RATHER THAN JOINING TO THE PARENT, which is
--    `0009`'s decision for `role_capability` and the same argument: a join
--    would be a second expression that has to agree with the first, and §5.3
--    says the copy is always what drifts. The composite foreign key already
--    makes a via line for another tenant's grant unrepresentable, so the two
--    narrowings cannot disagree about anything.
CREATE POLICY authorization_grant_via_rls ON tenant.authorization_grant_via
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- ---------------------------------------------------------------------
-- GRANTS. By name, because 0003 declines `ALTER DEFAULT PRIVILEGES` on this
-- schema.
--
-- 🛑 `SELECT` AND `INSERT`. **NO `UPDATE`. NO `DELETE`.** And that is the
--    schema saying what the declaration says: *"IMMUTABLE ONCE WRITTEN, which
--    is what makes it safe for the three streams to reference it rather than
--    duplicate the principal. The standing discipline — 'a row must reach its
--    authority without traversing a mutable table' — is satisfied by the table
--    being append-only, not by copying fields out of it."*
--
--    **Append-only is a PRIVILEGE here rather than a convention.** Nothing
--    reachable from a request can amend a record of an act, or erase one — not
--    the handler that wrote it, not a later handler, not a bug in either. The
--    app role holds no `ALTER` either, so it cannot drop the policies above;
--    that comes from `createRoles()` in `db/provision.ts` rather than from this
--    file.
--
-- ⚠️ AND THE ONE THING THAT CAN STILL ERASE A ROW IS NAMED: `ON DELETE CASCADE`
--    from `tenant.tenant`. Deleting a tenant deletes its authorisation records
--    along with everything else about it, which is the right answer for a
--    right-to-erasure path and the wrong answer for an audit trail — and the
--    two have not been reconciled anywhere in this repository. It is 0001's
--    cascade, inherited deliberately rather than quietly diverged from, and it
--    is named so the retention ruling that eventually settles it knows this
--    table is in scope.
-- ---------------------------------------------------------------------

GRANT SELECT, INSERT ON tenant.authorization_grant     TO tenant_rw;
GRANT SELECT, INSERT ON tenant.authorization_grant_via TO tenant_rw;

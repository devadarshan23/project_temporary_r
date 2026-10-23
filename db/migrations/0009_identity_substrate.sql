-- =====================================================================
-- 0009 — THE IDENTITY SUBSTRATE. G299 (19 Sep 2026), for S-22.
--
-- WHAT IT IS FOR, IN ONE SENTENCE THE WHOLE PRODUCT HAS BEEN WAITING ON:
-- **every authorisation arm in this repository is built and every one of them
-- refuses for want of a subject.** G299 states the premise better than a
-- paraphrase can, so it is quoted:
--
--     "`decide()` needs a seven-field `PrincipalContext` and THREE TERMS HAVE
--      NO PRODUCER — `subject.status` (no `user` table), `orgClass` (no
--      `identity_connection` table) and `held` (no `role_assignment` table).
--      G289's platform arm refuses for want of `platformHeld`; S-21's staff arm
--      refuses for want of a `staffGrant` producer; the data plane's authoriser
--      answers `not_held` to every caller. **That is not three problems. It is
--      one, and this row is it.**"
--
-- **THIS FILE IS THE PRODUCER.** Four tables the record names, plus the two
-- G289's platform arm needs and the two capability tables a role's verbs live
-- in — eight in all. After this, `resolveSubject()` is CALLABLE, `orgFor()` has
-- a connection to derive from, and `decide()` can answer `permitted` to a
-- seeded subject. **It has never answered `permitted` to anybody on a served
-- path before today.**
--
-- ⚠️ G299's OWN DERIVATION OF THE GAP IS SCHEMA-BLIND AND STILL RETURNS 0 AFTER
--    THIS FILE LANDS. The row reads:
--
--      grep -h 'CREATE TABLE' db/migrations/*.sql \
--        | grep -cE ' (user|identity_connection|role|role_assignment)'   → 0
--
--    Every table below is SCHEMA-QUALIFIED because 0003 requires it from 0004
--    on, so the name is preceded by `tenant.` or by `tenant."` and never by a
--    space. The command measures unqualified names in a directory that has had
--    none since 0004. **The derivation that actually moves is:**
--
--      grep -hoE 'CREATE TABLE tenant\.("?)[a-z_]+' db/migrations/*.sql \
--        | sed 's/.*tenant\.//; s/"//' | sort -u | wc -l
--
--    → 30 tables in schema `tenant`, of which EIGHT are this file's. **Derive
--    it; do not read it** — ⚠️ THIS LINE SAID 13 IN ITS FIRST DRAFT AND 13 WAS
--    NEVER TRUE OF ANY TREE: it was a guess written beside a command nobody had
--    run, in a header whose whole subject is a derivation that returns the
--    wrong answer. Caught by running the command. The ruling's own command is
--    not corrected here — G88 makes this directory forward-only and
--    `docs/HANDOFF.md` is not this file's to edit — it is NAMED, which is the
--    only mitigation available and the same one 0008 took for 0005's
--    undischarged cost.
--
-- RULINGS THIS APPLIES (docs/HANDOFF.md §3):
--   G299  the TABLES land first, so `resolveSubject()` becomes CALLABLE and the
--         three terms get producers; Cognito is wired later as the thing that
--         POPULATES them, and is FREE TO FORCE A SECOND MIGRATION — which is
--         why this file writes the narrowest column set the readers need and
--         not a guess at a token claim set.
--   G289  the platform arm is built and `platformHeld` has no producer.
--         `tenant.platform_role` and `tenant.platform_role_assignment` are that
--         producer. The arm's own table, `PLATFORM_ASSIGNMENT_REACHES`, decides
--         what it may reach; this file decides nothing about reach.
--   G97   every branded id is `text`; the slug is stored VERBATIM. **THERE IS
--         NO `uuid` ANYWHERE IN THIS FILE AND THERE IS NONE IN THIS MODEL.**
--   G100  every policy DENIES on NULL. A forgotten `set_config` yields an EMPTY
--         result set, never another tenant's rows and never another person's.
--   G101  transaction-mode pooling assumed; `SET LOCAL` only, through a named
--         scoped helper. This file adds no helper — `db/session-scope.ts` and
--         `db/tenant-scope.ts` are the two these tables are read inside, and
--         WHICH ONE is a property of the table, argued at each policy.
--   G88   forward-only. There is no `down` and no facility for one. 0001–0008
--         ARE NOT EDITED BY THIS FILE.
--
-- ⚠️ SCHEMA-QUALIFIED THROUGHOUT, because 0003 requires it from 0004 on:
--    *"Qualify every CREATE TABLE explicitly from 0004 on, or the schema a
--    table lives in becomes a side effect of migration order."*
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE FOLLOW-ON THIS FILE EXISTS TO UNBLOCK IS A **DELETION**, AND IT IS
--    NOT OPTIONAL. G299 CAPITALISES IT AND SO DOES THIS HEADER.
-- ═══════════════════════════════════════════════════════════════════════
--
-- `server/data-plane/session.ts` records that `resolveSubject()` *"IS NOT
-- CALLED HERE AND IT CANNOT BE"*, and that its read therefore enforces **two of
-- the seven arms in the `WHERE` of one statement and four not at all**:
--
--     WHERE revoked_at IS NULL
--       AND expires_at > now()
--
-- *"FOUR ARMS ARE UNENFORCED: a DISABLED PERSON and a DISABLED DIRECTORY both
-- reach this plane today."* **That predicate is deleted in the commit that
-- lands this file**, in favour of `resolveSubject()` reading all seven off
-- three rows. A slice that adds these tables and leaves the `WHERE` standing
-- has built the substrate and kept the defect — which is the shape #157 names
-- as *"an unbuilt feature wearing an invariant's badge"*, arriving inverted.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 WHICH SCOPE EACH TABLE IS READ IN, BECAUSE IT DECIDES THE PREDICATE AND
--    THE PREDICATE IS THE WHOLE OF THE SECURITY OF THIS FILE.
-- ═══════════════════════════════════════════════════════════════════════
--
--   `user`, `identity_connection`        SESSION scope — `app.session_ref`.
--   `platform_role_assignment`,          They are read BEFORE a tenant exists:
--   `platform_role`, their capabilities  `Session.tenant_id` is NULL between
--                                        authentication and selection, so a
--                                        `tenant_id` predicate would deny
--                                        unconditionally under G100 and NOBODY
--                                        COULD EVER AUTHENTICATE.
--
--   `role`, `role_assignment`,           TENANT scope — `app.tenant_id`, 0001's
--   `role_capability`                    predicate VERBATIM. They are
--                                        `TenantScoped` in `model/access.ts`
--                                        and there is nothing to invent.
--
-- ⚠️ THE SESSION-SCOPED PREDICATE IS NOT A NEW IDEA; IT IS 0005's MEASURED FACT
--    USED IN THE ONE DIRECTION IT HELPS. 0005 records, from a measurement
--    rather than from folklore: **"PostgreSQL applies row-level security to
--    tables referenced inside a policy expression, as the querying role."** So
--    a policy on `user` that resolves the session through `tenant.session` is
--    narrowed TWICE — once by its own subquery, and once by `session_rls`
--    keying that subquery on the same GUC. The two agree by construction
--    because they read the same variable, and neither knows about the other.
-- =====================================================================


-- ---------------------------------------------------------------------
-- THE PERSON — `model/domain.ts`'s `User`, which §8.6 records was
-- **CONSULTED BY NOTHING**.
--
-- Derive the declaration, do not read it here:
--   grep -n 'export interface User' -A 45 model/domain.ts
--
-- 🛑 `tenant."user"` IS QUOTED AND THE QUOTES ARE LOAD-BEARING SYNTAX, NOT
--    STYLE. `USER` is a RESERVED key word in PostgreSQL — it is the spelling of
--    `CURRENT_USER` — so `CREATE TABLE tenant.user (…)` is a SYNTAX ERROR and
--    every statement that touches this table must quote it the same way.
--    **The alternative was to name it `app_user` and the alternative was
--    refused:** `model/domain.ts` calls the interface `User`, G299 calls the
--    table `user`, and renaming it here would put a translation step between
--    the record and the schema that every future reader has to know about. One
--    pair of quotes, in a handful of statements, is the cheaper cost — and it
--    is a cost a `psql` session announces immediately rather than one that
--    hides.
--
-- ⚠️ NOT TENANT-SCOPED, AND THAT IS THE SAME STRUCTURAL FACT `tenant.session`
--    TURNS ON. A person exists before a tenant is selected — `Session.tenant_id`
--    is NULL between authentication and selection — so a `tenant_id` column
--    here would have to be nullable, and a nullable tenant column under G100's
--    polarity denies unconditionally. A user does not BELONG to a tenant in
--    this model; `Membership` is what joins the two, and it already has a table.
--
-- 🛑 `status` IS THE POINT OF THE WHOLE TABLE. §8.6: *"`assignmentGrants()`
--    took no `User` at all — so a disabled user's assignments evaluated as
--    granted."* `decide()` reads it at step 1 and `resolveSubject()` reads it at
--    arm five. **It is NOT read by the policy below, deliberately and at
--    length: see the policy.**
--
-- ⚠️ NO `CHECK` CONSTRAINT ON `status`, for `0002_run.sql`'s reason in its own
--    words — a third copy of a closed enum is *"a third place to drift, and the
--    one nothing checks, because no pair in the wire-mirror addresses SQL."*
--    The closed set lives in `model/domain.ts`; a row carrying anything else is
--    refused by the reader, which classifies rather than casts.
--
-- ⚠️ `email` AND `display_name` ARE STORED AND ARE READ BY NOTHING ON THIS
--    PATH, AND THAT IS STATED RATHER THAN QUIETLY TRUE. `PrincipalContext` is
--    *"structurally narrowed to `{ userId, status }` … so that no evaluation
--    can reach an email, a display name, or the `identityProvider` field the
--    org axis is derived from."* They are here because `User` declares them
--    required and a row that could not represent a person would be a different
--    table wearing this one's name — but the reader in
--    `server/data-plane/identity.ts` does not SELECT them, so the narrowing
--    survives the column existing. **The day something renders a name, that is
--    a new read with its own classification question, not a free consequence of
--    this file.**
-- ---------------------------------------------------------------------

CREATE TABLE tenant."user" (
  id            text NOT NULL PRIMARY KEY,
  email         text NOT NULL,
  display_name  text NOT NULL,
  status        text NOT NULL,
  -- `User.connectionId`: *"The directory that authenticated them."* No foreign
  -- key — see the note below `identity_connection`.
  connection_id text NOT NULL
);


-- ---------------------------------------------------------------------
-- THE DOOR — `IdentityConnection`, and **THE ONE PRODUCER OF `orgClass`**.
--
-- Derive the declaration:
--   grep -n 'export interface IdentityConnection' -A 90 model/domain.ts
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE OWNER IS THREE COLUMNS FOR ONE DISCRIMINATED UNION, AND EVERY OTHER
--    SHAPE WAS WORSE.
-- ═══════════════════════════════════════════════════════════════════════
--
--     owner: | { kind: 'platform' }
--            | { kind: 'partner';  partnerId: PartnerId }
--            | { kind: 'customer'; accountId: AccountId }
--
-- `owner_kind` plus `owner_partner_id` plus `owner_account_id`, each nullable
-- where the arm does not carry it. **There is no `CHECK` making the pairing
-- exclusive**, for 0002's enum reason above, and the consequence is named
-- rather than left: a malformed row — `owner_kind = 'partner'` with a NULL
-- `owner_partner_id` — is possible in this table and is **REFUSED BY THE
-- READER**, which cannot construct an `IdentityConnection['owner']` out of it
-- and therefore cannot call `orgFor()`.
--
-- 🛑 AND REFUSING IS THE ONLY ANSWER, BECAUSE G289 ALREADY PRICED THE OTHER
--    ONE. *"Defaulting it to `customer` routes a partner down the customer arm
--    past the live-grant check, the `partnerId` check, revocation, expiry and
--    `PARTNER_CAPABILITY_MASK` — five controls deleted by one assignment."*
--    An unresolvable owner is an unresolvable ORGANISATION, and an
--    unresolvable organisation is a 401 — not a `customer`.
--
-- ⚠️ `domains` IS ABSENT AND IT IS NOT AN OVERSIGHT. `DomainClaim[]` is read by
--    `mayRouteToConnection()` at HOME-REALM ROUTING time, and nothing routes a
--    realm in this repository — there is no sign-in path at all. 0008's rule
--    applies unchanged: *"the column set is the predicate's and not the
--    interface's"*, and `0004_subject_ledger.sql` refused a column ahead of its
--    reader at length. **The commit that builds federated sign-in owns the
--    `domain_claim` table, in the same commit as the router that reads it.**
--
-- ⚠️ `label` IS STORED AND IS READ BY NOTHING HERE, for `email`'s reason one
--    table up — and with a sharper edge. G232 rules the label OPERATOR-WRITTEN
--    precisely because *"a customer-authored label is COUNTERPARTY TEXT"* and
--    invariant 6 has never been ruled for a configuration field a staff console
--    renders. Nothing in `server/` selects this column today; the first thing
--    that does inherits that question and does not get to skip it.
--
-- 🛑 NO FOREIGN KEY FROM `tenant."user".connection_id` TO HERE, AND FROM
--    `tenant.session.user_id` / `.connection_id` TO EITHER, AND THE ABSENCE IS
--    A DECISION THIS FILE ARGUES RATHER THAN INHERITS.
--
--    0005 declined an FK on `membership.role_id` because there was nothing to
--    point at: *"a foreign key to nothing is not available at any price."*
--    There IS something to point at now, so the easy inheritance is not
--    available and the question has to be answered.
--
--    **The answer is no, and the reason is that the constraint would delete a
--    control rather than add one.** `server/data-plane/identity.ts` refuses a
--    session whose user row or connection row is absent — *"a session whose
--    person cannot be read is not a session"* — and
--    `tests/http/identity-substrate-served.test.ts` witnesses that refusal by
--    minting exactly such a session. An FK makes that state UNREPRESENTABLE,
--    which sounds stronger and is weaker in the one way that matters here: the
--    refusal becomes untestable, and a refusal nothing exercises is the shape
--    `docs/HANDOFF.md` §5.6 catalogues. The four arms this slice exists to
--    enforce were unenforced for exactly as long as nobody could construct the
--    case.
--
--    ⚠️ IT IS ALSO NOT FREE AND THE COST IS NAMED: an orphan session row can be
--    written by anything holding the migrator credential, and nothing in the
--    database says it is wrong. What says so is the reader, on every request.
-- ---------------------------------------------------------------------

CREATE TABLE tenant.identity_connection (
  id               text NOT NULL PRIMARY KEY,
  protocol         text NOT NULL,
  label            text NOT NULL,
  -- `platform` | `partner` | `customer`. The org axis derives from HERE and
  -- from nowhere else — never from a membership, never from a route.
  owner_kind       text NOT NULL,
  -- Non-null exactly when `owner_kind = 'partner'`. Enforced by the reader.
  owner_partner_id text,
  -- Non-null exactly when `owner_kind = 'customer'`. Enforced by the reader.
  owner_account_id text,
  status           text NOT NULL
);


-- ---------------------------------------------------------------------
-- THE ROLE — `model/access.ts`'s `Role`, which **`extends TenantScoped`**, so
-- 0001's predicate applies verbatim and nothing here is invented.
--
-- Derive the declaration:
--   grep -n 'export interface Role extends TenantScoped' -A 40 model/access.ts
--
-- THE PRIMARY KEY IS COMPOSITE for 0001's reason: a cross-tenant reference has
-- to be unrepresentable rather than merely unlikely.
--
-- 🛑 THE UNIQUENESS BELOW IS THE CONSTRAINT `Role.key` HAS BEEN ASKING FOR IN
--    WRITING SINCE 7 Aug 2026. Its own declaration:
--    *"THE FIRST HALF HAS NOT CLOSED and is the live risk now — two packs
--    shipping `approver` still collide unless `(packId, key)` is the uniqueness
--    constraint in the schema. Nothing in `model/` can enforce that; the first
--    migration must, and `packId` is nullable here (platform and tenant roles),
--    so the constraint has to treat null as a distinct namespace rather than as
--    a wildcard."*
--
--    ⚠️ **AND A PLAIN `UNIQUE (tenant_id, pack_id, key)` DOES EXACTLY THE WRONG
--    THING WITH THE NULL.** Under the SQL default two rows with a NULL `pack_id`
--    and the same `key` are BOTH permitted — NULLs are distinct — which is the
--    wildcard reading the declaration refuses by name: every platform and tenant
--    role would sit in a namespace where nothing collides, and
--    `('ten_acme', NULL, 'approver')` could be written twice.
--
--    🛑 **`NULLS NOT DISTINCT` WAS WRITTEN HERE FIRST AND WAS WITNESSED RED,
--    WHICH IS WHY THE REPAIR IS RECORDED RATHER THAN THE FIRST ATTEMPT SIMPLY
--    DELETED.** It is PostgreSQL 15+ syntax; the developer database this
--    repository is run against is **14.18**, and the migration failed on it with
--    `42601 syntax error at or near "NULLS"`. G254 pins the AURORA engine at
--    17.9 and pins nothing about a laptop — **so a schema that compiles only on
--    the deployment target is a schema whose tests nobody local can run**, which
--    is `tests/reachability.ts`'s whole subject arriving as a version floor
--    instead of as a missing server.
--
--    THE REPLACEMENT IS TWO PARTIAL UNIQUE INDEXES AND IT IS STRICTLY BETTER
--    THAN THE THING IT REPLACES, not merely portable: each states ONE half of
--    the rule in its own predicate, neither needs a version floor, and — unlike
--    the `coalesce(pack_id, '')` trick a hurried reader reaches for next —
--    **neither depends on no pack id happening to be the empty string**. That
--    dependency is the accidental-denial shape 0005 warns about at
--    `nullif(…, '')`, and it has no place in a uniqueness constraint.
--
-- ⚠️ `defaultScope` HAS NO COLUMNS — SEE THE SCOPE NOTE UNDER `role_assignment`,
--    WHICH ARGUES BOTH.
-- ---------------------------------------------------------------------

CREATE TABLE tenant.role (
  tenant_id         text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id                text    NOT NULL,
  label             text    NOT NULL,
  key               text    NOT NULL,
  -- `Role.version`: *"Immutable on write … an auditor following a bare pointer
  -- reads today's definition, not the one that decided."* `decide()` compares
  -- it against `RoleAssignment.roleVersion` and stops evaluating on a mismatch.
  version           integer NOT NULL,
  stakeholder_class text    NOT NULL,
  -- `pack` | `tenant` | `platform`.
  origin            text    NOT NULL,
  -- Null for platform and tenant roles. See the UNIQUE constraint's note.
  pack_id           text,
  -- `active` | `archived`. `decide()` refuses `role_not_active`.
  status            text    NOT NULL,

  PRIMARY KEY (tenant_id, id)
);

-- Role identity WITH a pack is `(tenant, pack, key)` — two packs shipping
-- `approver` into one tenant are two rows and always were.
CREATE UNIQUE INDEX role_pack_key_uniq
  ON tenant.role (tenant_id, pack_id, key)
  WHERE pack_id IS NOT NULL;

-- Role identity WITHOUT a pack is `(tenant, key)` — the missing pack is ONE
-- namespace, which is *"a distinct namespace rather than a wildcard"* in the
-- declaration's own words, written as a predicate rather than described.
CREATE UNIQUE INDEX role_unpacked_key_uniq
  ON tenant.role (tenant_id, key)
  WHERE pack_id IS NULL;


-- ---------------------------------------------------------------------
-- THE ROLE'S VERBS — a child table, because `capabilities` is a LIST and this
-- schema stores lists as rows.
--
-- 🛑 IT IS NOT A `text[]` COLUMN, AND THE REASON IS THE ONE 0002 GIVES FOR NOT
--    COPYING AN ENUM: an array column would be a single opaque value that no
--    index, no join and no future `SELECT capability, count(*)` can reach, and
--    the one question an auditor asks of this table is *"who holds
--    `approve_resolution`"* — which is a relational query against rows and is
--    not a query at all against an array.
--
-- 🛑 NO FOREIGN KEY TO A CAPABILITY TABLE, BECAUSE THERE IS NO CAPABILITY
--    TABLE AND THERE MUST NOT BE ONE. `CAPABILITIES` is a CLOSED set that is a
--    PLATFORM RELEASE to change — *"a pack composes these into roles and can
--    never introduce one"* — so a table of them is a third copy of the enum,
--    which is 0002's prohibition exactly. A row naming a string that is not a
--    capability is invisible to `decide()`: `role.capabilities.includes()`
--    matches nothing, and the reader drops it rather than widening the union.
--    **Fails closed.**
--
-- ⚠️ THE FAIL DIRECTION IS WORTH STATING, BECAUSE 0008's FAIL-OPEN BLOCK IS THE
--    SHARPEST WARNING IN THIS DIRECTORY AND THIS TABLE IS THE MIRROR OF IT.
--    If these rows were UNREADABLE to the app role, every role would resolve
--    with an EMPTY capability list, `decide()` would answer
--    `no_assignment_carries_capability`, and **everything would be refused**.
--    An unreadable capability table denies; an unreadable `permitted_resource`
--    in 0008 permits. The difference is the shape of the predicate, and this
--    one is the safe shape.
-- ---------------------------------------------------------------------

CREATE TABLE tenant.role_capability (
  tenant_id  text NOT NULL,
  role_id    text NOT NULL,
  capability text NOT NULL,

  PRIMARY KEY (tenant_id, role_id, capability),
  FOREIGN KEY (tenant_id, role_id)
    REFERENCES tenant.role (tenant_id, id) ON DELETE CASCADE
);


-- ---------------------------------------------------------------------
-- THE ASSIGNMENT — `RoleAssignment`, the authority record. `TenantScoped`.
--
-- Derive the declaration:
--   grep -n 'export interface RoleAssignment extends TenantScoped' -A 25 model/access.ts
--
-- 🛑 `revoked_at` AND `expires_at` ARE COLUMNS AND **NOTHING IN THIS FILE OR IN
--    THE READER FILTERS ON THEM**, WHICH IS THE OPPOSITE OF WHAT A HURRIED
--    READER WILL EXPECT AND IS THE WHOLE ARGUMENT OF THIS SLICE.
--
--    `decide()` owns those two questions and answers them SEPARATELY, by name:
--    `assignment_revoked` and `assignment_expired`. Its own declaration says
--    why two members rather than one, one arm up: *"A revocation is an ACT
--    somebody took and is answerable; an expiry is a clock arriving and is
--    nobody's act. An audit that cannot tell them apart cannot answer 'who took
--    this away'."* A reader that narrowed on liveness would hand `decide()` a
--    list in which every row is live, both reasons would become unreachable,
--    and the evaluator would be reporting on a question the SQL had already
--    decided — which is precisely the defect
--    `server/data-plane/session.ts`'s two-term `WHERE` was, one table over,
--    deleted in this same commit.
--
-- ⚠️ `expires_at` IS NULLABLE AND ONLY THE CUSTOMER ROW MAY USE THE NULL.
--    `DURABLE_ASSIGNMENT_PERMITTED` is `{platform: false, partner: false,
--    customer: true}` and `decide()` refuses
--    `durable_assignment_forbidden_for_org` on a non-customer holding one.
--    **That check lives in the evaluator and cannot live here**, because the
--    organisation is derived per request from the DOOR and is not a fact about
--    this row — storing it would be the *"stored copy of a derived fact"* the
--    org axis exists to avoid.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 `scope` HAS NO COLUMNS, AND NEITHER DOES `Role.defaultScope`. READ THIS
--    BEFORE ADDING ONE, AND BEFORE READING A DECISION'S SCOPE OFF THIS PATH.
-- ═══════════════════════════════════════════════════════════════════════
--
-- `AssignmentScope` is SIX dimensions plus a value ceiling. Not one of them is
-- read on the path this slice builds: `server/data-plane/authorise.ts` states,
-- at its single call site, *"the `scope` on the decision is deliberately NOT
-- read here … Reading it and dropping it would be worse than not reading it: a
-- narrowed grant would look like an unconditional one."*
--
-- So the reader supplies **`DENY_ALL`** for both, and `DENY_ALL` is the SAFE
-- direction rather than a convenient one: every dimension is `{these: []}` and
-- the ceiling is zero, so `Decision`'s own rule — *"a caller that ignores the
-- boolean and applies the scope still denies"* — holds for every row this
-- database can produce. It is the same value G289's platform arm returns on an
-- ALLOW, for the same argument: *"a platform allow is a VERB and never a
-- DIMENSION."*
--
-- 🛑 **THE DEBT IS THEREFORE EXACT AND IS NAMED HERE RATHER THAN DISCOVERED:
--    THE FIRST HANDLER THAT READS A DECISION'S SCOPE NEEDS THESE COLUMNS, AND
--    UNTIL IT HAS THEM IT WOULD READ `DENY_ALL` AND DENY EVERYTHING.** That is
--    the safe failure, which is why it is acceptable to ship without them; it
--    is not a failure that hides. 0008's rule applies unchanged — *"the column
--    set is the predicate's and not the interface's"* — and
--    `0004_subject_ledger.sql` refused a column ahead of its reader at length.
-- ---------------------------------------------------------------------

CREATE TABLE tenant.role_assignment (
  tenant_id    text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id           text        NOT NULL,
  user_id      text        NOT NULL,
  role_id      text        NOT NULL,
  -- PINNED. *"A widened role is a NEW version and needs consent."* `decide()`
  -- stops evaluating an assignment whose pin has moved, in EITHER direction.
  role_version integer     NOT NULL,
  granted_by   text        NOT NULL,
  granted_at   timestamptz NOT NULL,
  -- NULL is indefinite, and only a customer org may hold one. See above.
  expires_at   timestamptz,
  -- RETAINED RATHER THAN DELETED, like `membership.revoked_at`. `decide()`
  -- reads it; no `WHERE` in this repository does.
  revoked_at   timestamptz,

  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, role_id)
    REFERENCES tenant.role (tenant_id, id) ON DELETE CASCADE
);

-- The lookup the reader performs, once per gated request, inside
-- `withTenantScope()`. `tenant_id` leads because `role_assignment_rls` has
-- already narrowed to one tenant before this index is consulted — the planner
-- sees that predicate even though no handler wrote it. Same shape as
-- `membership_live_idx` and `tenant_access_grant_live_idx`.
CREATE INDEX role_assignment_holder_idx
  ON tenant.role_assignment (tenant_id, user_id);


-- =====================================================================
-- THE PLATFORM PAIR — G289's arm, and the term it has never had.
--
-- 🛑 NEITHER TABLE CARRIES A `tenant_id`, AND `PlatformRoleAssignment`'s
--    DECLARATION SAYS WHAT ADDING ONE WOULD MEAN, IN CAPITALS: *"If a
--    `tenantId` is ever added here, invariant 8 has been deleted in a field."*
--    A staff person who needs to reach a customer tenant does it through a
--    `TenantAccessGrant` — `tenant.tenant_access_grant`, 0008 — and that is a
--    different table with a different predicate and a different lifetime.
--
-- ⚠️ THEY LIVE IN THE `tenant` SCHEMA AND ARE NOT TENANT DATA, WHICH READS AS A
--    CONTRADICTION AND IS NOT ONE. `tenant` is the name of the DATA PLANE's
--    schema — 0003 created it and every table since sits in it, including
--    0008's four platform-configuration lists, which hold no tenant data
--    either. The plane boundary is G193's TOPOLOGY (two processes, two
--    databases); the schema name is not a second statement of it.
--
-- 🛑 AND THE REASON THEY ARE IN THE DATA PLANE'S DATABASE AT ALL IS THAT
--    `decide()` IS. G289 refused a second evaluator — *"Splitting one decision
--    across two components is the structural precondition for a confused
--    deputy"* — so the ONE evaluator runs where the request is served, and the
--    term it reads has to be readable there. A control-plane copy would be the
--    two-halves split wearing a schema's name.
-- =====================================================================

CREATE TABLE tenant.platform_role (
  id                text    NOT NULL PRIMARY KEY,
  label             text    NOT NULL,
  -- *"Stable identifier. No pack namespace, because no pack may ship one."*
  key               text    NOT NULL UNIQUE,
  version           integer NOT NULL,
  stakeholder_class text    NOT NULL,
  status            text    NOT NULL
);

CREATE TABLE tenant.platform_role_capability (
  role_id    text NOT NULL REFERENCES tenant.platform_role (id) ON DELETE CASCADE,
  capability text NOT NULL,

  PRIMARY KEY (role_id, capability)
);

-- 🛑 `expires_at` IS `NOT NULL` HERE AND NULLABLE ON `role_assignment`, AND THE
--    DIFFERENCE IS `DURABLE_ASSIGNMENT_PERMITTED` MADE UNREPRESENTABLE RATHER
--    THAN CHECKED. The declaration: *"a never-expiring staff assignment cannot
--    be typed. The refusal `durable_assignment_forbidden_for_org` therefore
--    CANNOT ARISE on this arm, which is a stronger statement than the branch it
--    replaces."* The column matches the type, so the same statement holds one
--    layer down and this database cannot store the row either.
CREATE TABLE tenant.platform_role_assignment (
  id           text        NOT NULL PRIMARY KEY,
  user_id      text        NOT NULL,
  role_id      text        NOT NULL REFERENCES tenant.platform_role (id) ON DELETE CASCADE,
  role_version integer     NOT NULL,
  granted_by   text        NOT NULL,
  granted_at   timestamptz NOT NULL,
  -- NOT NULLABLE. See the note above.
  expires_at   timestamptz NOT NULL,
  -- Read by `decide()` as `platform_assignment_revoked`. No `WHERE` reads it.
  revoked_at   timestamptz
);

CREATE INDEX platform_role_assignment_holder_idx
  ON tenant.platform_role_assignment (user_id);


-- =====================================================================
-- ROW-LEVEL SECURITY.
--
-- `ENABLE` and `FORCE`, both, on all eight — 0001's argument unchanged and
-- repeated here because it is the one that makes every test below mean
-- anything: `ENABLE` alone leaves the TABLE OWNER exempt, so a test connecting
-- as the owner passes with the policy doing nothing and passes just as well
-- with the policy DROPPED. `FORCE` is what makes the explicit `BYPASSRLS`
-- attribute on `reconcile_migrator` the ONLY route to the read exemption.
--
-- 🛑 `tests/db/identity-substrate.test.ts` CARRIES THE NEGATIVE CONTROL THAT
--    MAKES THIS SECTION EVIDENCE RATHER THAN INTENT: with RLS DISABLED on
--    `tenant.role_assignment` the same read returns BOTH tenants' rows, and
--    with it enabled it returns one tenant's. A policy that is never witnessed
--    failing is `docs/HANDOFF.md` §5.6.
-- =====================================================================

ALTER TABLE tenant."user"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant."user"                     FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.identity_connection        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.identity_connection        FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.role                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.role                       FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.role_capability            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.role_capability            FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.role_assignment            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.role_assignment            FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.platform_role              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.platform_role              FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.platform_role_capability   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.platform_role_capability   FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.platform_role_assignment   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.platform_role_assignment   FORCE  ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------
-- 🛑 THE SESSION-KEYED POLICIES. READ THE WHOLE NOTE BEFORE CHANGING ONE
--    TOKEN, AND READ THE `status` PARAGRAPH TWICE.
--
-- The predicate resolves the CURRENT SESSION out of `tenant.session` by the
-- digest in `app.session_ref` — G160's GUC, the same one `session_rls` keys on
-- — and admits exactly the row that session names. Written out:
--
--     id = (SELECT s.user_id
--             FROM tenant.session s
--            WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), ''))
--
--   `missing_ok = true`  — an unset variable returns NULL instead of raising,
--                          because the empty read is the behaviour that is
--                          identical under both pooling modes.
--   `nullif(…, '')`      — a GUC that was SET and reverted reads back as the
--                          EMPTY STRING, not NULL. Without this the subquery
--                          matches on `handle_digest = ''`, which denies BY
--                          ACCIDENT and only because no digest is empty.
--                          `digestOfHandle()` refuses an empty handle for the
--                          other half of this same argument.
--   scalar subquery      — returns NULL when it matches no row, and
--                          `id = NULL` is NULL, which is not TRUE.
--                          **THE POLICY DENIES ON NULL.** G100.
--
-- ⚠️ THE SUBQUERY IS ITSELF NARROWED BY `session_rls`, AND THAT IS 0005's
--    MEASURED FACT WORKING FOR US RATHER THAN AGAINST US: *"PostgreSQL applies
--    row-level security to tables referenced inside a policy expression, as the
--    querying role."* In 0005 that fact made a legitimate selection FAIL inside
--    the session helper and forced a third named helper into existence. Here
--    both predicates key on `app.session_ref`, so the narrowing is the same
--    narrowing twice and there is nothing to disagree about. **It is also a
--    guarantee rather than a coincidence: a caller cannot see another
--    session's row, so it cannot reach another session's person through this
--    subquery even if the outer predicate were wrong.**
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE POLICY DOES **NOT** FILTER ON `status`, AND THAT IS THE ENTIRE POINT
--    OF THE SLICE ARRIVING IN THE ONE PLACE IT WOULD BE EASIEST TO UNDO.
-- ═══════════════════════════════════════════════════════════════════════
--
-- `… AND status = 'active'` is one clause, it looks like defence in depth, and
-- it would **DELETE THE CONTROL THIS FILE EXISTS TO BUILD.** A disabled person
-- would become an INVISIBLE person; `resolveSubject()` would receive no user
-- row at all; and the refusal would be *"this session has no person"* instead
-- of `user_disabled`. The two are not the same fact, an audit cannot tell them
-- apart, and one of them is a statement about our substrate rather than about
-- a person — the identical distinction `decide()` draws between
-- `platform_assignment_unreadable` and `platform_assignment_absent`.
--
-- **The row must be VISIBLE so that the model can REFUSE it by name.** Same for
-- `identity_connection.status`. `tests/http/identity-substrate-served.test.ts`
-- asserts both refusals ARRIVE, which is what would go red if this clause were
-- ever added.
-- ---------------------------------------------------------------------

CREATE POLICY user_rls ON tenant."user"
  USING (
    id = (
      SELECT s.user_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
  );

CREATE POLICY identity_connection_rls ON tenant.identity_connection
  USING (
    id = (
      SELECT s.connection_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
  );

-- The staff person's own platform assignments, and nobody else's. Same
-- predicate, keyed on the holder instead of on the row's identity — so this is
-- not a roster: a platform principal cannot enumerate their colleagues'
-- authority through it.
CREATE POLICY platform_role_assignment_rls ON tenant.platform_role_assignment
  USING (
    user_id = (
      SELECT s.user_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
  );

-- 🛑 A PLATFORM ROLE IS VISIBLE ONLY THROUGH AN ASSIGNMENT THE CALLER HOLDS,
--    AND THE NESTING IS DELIBERATE RATHER THAN CLEVER. The inner reference to
--    `tenant.platform_role_assignment` is itself narrowed by the policy above —
--    the measured fact again — so this expression cannot reach an assignment
--    the caller does not hold, and the role CATALOGUE is not published to
--    anyone who authenticates. A platform role's `label` and `key` name the
--    shape of our own support organisation; that is not a customer's to read.
--
--    ⚠️ AND THE FAIL DIRECTION IS THE SAFE ONE. If this policy denied where it
--    should permit, `platformHeld` would resolve to `[]` and `decide()` would
--    answer `platform_assignment_absent` — a refusal. There is no arrangement
--    of these two policies that permits more than the assignment does.
CREATE POLICY platform_role_rls ON tenant.platform_role
  USING (
    EXISTS (
      SELECT 1
        FROM tenant.platform_role_assignment a
       WHERE a.role_id = platform_role.id
    )
  );

CREATE POLICY platform_role_capability_rls ON tenant.platform_role_capability
  USING (
    role_id IN (SELECT r.id FROM tenant.platform_role r)
  );


-- ---------------------------------------------------------------------
-- THE TENANT-SCOPED POLICIES — 0001's predicate, VERBATIM, three times.
--
--     tenant_id = nullif(current_setting('app.tenant_id', true), '')
--
-- There is nothing new to argue: `Role` and `RoleAssignment` both
-- `extends TenantScoped`, `withTenantScope()` is the one helper that sets the
-- variable, and G100's polarity means a query issued outside it sees ZERO ROWS
-- rather than every row. The sameness across 0001, 0005, 0008 and this file is
-- load-bearing rather than tidy — a reader comparing them should find the
-- predicate identical, and if it is not, this file has quietly re-decided
-- tenancy while claiming to add to it.
--
-- ⚠️ `WITH CHECK` IS OMITTED ON ALL THREE AND THAT IS A CONSEQUENCE OF THE
--    `GRANT` AT THE FOOT OF THIS FILE RATHER THAN AN OVERSIGHT. The app role
--    holds `SELECT` and nothing else on every table here, so there is no write
--    for a `WITH CHECK` to constrain. 0005 states its `WITH CHECK` explicitly
--    *"so that a later `FOR SELECT`/`FOR ALL` edit cannot silently drop the
--    write half"* — and `tenant.session` is written on the request path, which
--    none of these are. **The commit that grants a write here owes the `WITH
--    CHECK` in the same commit as the writer.**
--
-- 🛑 `role_capability` KEYS ON ITS OWN `tenant_id` RATHER THAN JOINING TO
--    `role`. A join would be a second expression that has to agree with the
--    first, and §5.3 says the copy is always what drifts. The composite foreign
--    key already makes a capability line for another tenant's role
--    unrepresentable, so the two narrowings cannot disagree about anything.
-- ---------------------------------------------------------------------

CREATE POLICY role_rls ON tenant.role
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY role_capability_rls ON tenant.role_capability
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY role_assignment_rls ON tenant.role_assignment
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- ---------------------------------------------------------------------
-- GRANTS. By name, because 0003 declines `ALTER DEFAULT PRIVILEGES` on this
-- schema: *"A future table created here is unreachable by the app until granted
-- BY NAME … default privileges would silently hand the request path a table
-- nobody decided to expose."*
--
-- 🛑 `SELECT` AND NOTHING ELSE, ON ALL EIGHT — 0005's and 0008's decision
--    applied to the sharpest objects yet. Nothing on the request path mints a
--    user, a directory, a role or an assignment: there is no `/invite` handler,
--    no sign-in path, no role-authoring operation and no admin tier mounted at
--    all. *"A write privilege ahead of a writer is the shape
--    `0004_subject_ledger.sql` refused at length."*
--
--    **And the consequence here is larger than it was there, which is why it is
--    spelled out: a request path that could write `role_assignment` could grant
--    itself any capability in the closed set, and `decide()` would then permit
--    it CORRECTLY.** The evaluator is only as honest as the rows it reads. The
--    seed that makes this slice testable therefore runs as the MIGRATOR, from
--    `server/dev/`, behind G192's flag — not through any connection a plane
--    holds. See `server/dev/identity-seed.ts`.
--
-- ⚠️ THE APP ROLE CANNOT `ALTER` THESE TABLES AND THEREFORE CANNOT DROP THE
--    POLICIES PROTECTING THEM. That is the property `FORCE` above is relative
--    to, and it comes from `createRoles()` in `db/provision.ts` rather than
--    from this file.
-- ---------------------------------------------------------------------

GRANT SELECT ON tenant."user"                   TO tenant_rw;
GRANT SELECT ON tenant.identity_connection      TO tenant_rw;
GRANT SELECT ON tenant.role                     TO tenant_rw;
GRANT SELECT ON tenant.role_capability          TO tenant_rw;
GRANT SELECT ON tenant.role_assignment          TO tenant_rw;
GRANT SELECT ON tenant.platform_role            TO tenant_rw;
GRANT SELECT ON tenant.platform_role_capability TO tenant_rw;
GRANT SELECT ON tenant.platform_role_assignment TO tenant_rw;

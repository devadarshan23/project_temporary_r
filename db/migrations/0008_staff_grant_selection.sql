-- =====================================================================
-- 0008 — THE STAFF ARM OF TENANT SELECTION. G199 (S-21) and G292, for
-- #157 [M1-2]. THE OTHER HALF OF `model/access.ts` §7a's staff arm.
--
-- WHAT IT IS FOR. `0005_session_and_membership.sql` shipped the CUSTOMER arm
-- and DECLARED its own cost in its own header, in these words:
--
--     "A PLATFORM FDE HAS NO `Membership` … So the `EXISTS` below is EMPTY FOR
--      AN FDE, `session.tenant_id` can never be set for staff, and invariant
--      8's PERMITTED path is structurally unreachable until the staff slice
--      lands. No document may describe that path as built, reachable or
--      enforced."
--
-- **THIS IS THAT SLICE.** 0005's sentence is not edited — G88 makes migrations
-- forward-only and 0001–0007 ARE NOT EDITED BY THIS FILE — so a reader who
-- arrives at 0005 alone reads a cost this file has since discharged, and there
-- is nothing in `tools/` that could tell them so. That is the same hazard G199
-- records about G167's unedited row, one layer down, and it is named here
-- because naming it is the only mitigation available.
--
-- RULINGS THIS APPLIES (docs/HANDOFF.md §3):
--   G199  the staff arm ships as its own slice with its own RED test, adding
--         `staffGrant: TenantAccessGrant | null` to `TenantSelectionInput`,
--         ONE arm in `selectTenantForSession()`, and **one additional
--         `OR EXISTS (… tenant_access_grant …)` disjunct in the
--         `AS RESTRICTIVE` `WITH CHECK`**. All three land together.
--   G292  a `TenantAccessGrant` IS LIVE IFF **unrevoked, unexpired, AND within
--         a maximum duration ceiling** — and the ceiling is "a property of the
--         PREDICATE rather than of whoever issues the grant, so a grant cannot
--         be issued, or extended, past it, and the enforcement does not depend
--         on the issuing path being the only path."
--   G167  (surviving its own reversal by G199) the staff arm tests
--         `PERMITTED_RESOURCES`, `CONTRACT_ONLY_RESOURCES` **and**
--         `NON_DELEGABLE_RESOURCES` — ALL THREE. G75 exists because a third
--         list nobody had named made G60 INERT for eight days.
--   G97   every branded id is `text`; the slug is stored VERBATIM. No uuid.
--   G100  the policy DENIES on NULL, on every table this file creates.
--   G101  transaction-mode pooling assumed; `SET LOCAL` only, via a named
--         scoped helper — `db/selection-scope.ts`, unchanged by this file.
--   G88   forward-only. There is no `down` and no facility for one.
--
-- 🛑 THE MODEL HALF AND THIS HALF ARE ONE COMMIT, WHICH IS #157's GOVERNING
--    PRINCIPLE AND NOT A PREFERENCE: *"either alone is a defeat."* **The split
--    G199 made is CUSTOMER-VERSUS-STAFF, never model-versus-database.**
--
-- 🛑 AND THE TWO TESTS THAT ASSERTED THE DECLARED COST WENT RED IN THIS COMMIT,
--    WHICH IS WHAT THEY WERE FOR — `test_the_staff_path_is_unreachable_and_
--    that_is_G199s_declared_cost` and `test_the_staff_path_is_unreachable_in_
--    the_database_too_and_that_is_G199s_cost`. Both were witnessed FAILING
--    before either was amended. A red seen after the edit proves the edit.
--
-- ⚠️ SCHEMA-QUALIFIED THROUGHOUT, because 0003 requires it from 0004 on:
--    *"Qualify every CREATE TABLE explicitly from 0004 on, or the schema a
--    table lives in becomes a side effect of migration order."*
-- =====================================================================


-- ---------------------------------------------------------------------
-- THE GRANT — invariant 8's permitted path, as a row.
--
-- Mirrors the LOAD-BEARING SUBSET of `TenantAccessGrant` (`model/governance.ts`)
-- and NOT the whole interface. Derive the declaration, do not read it here:
-- `grep -n 'export interface TenantAccessGrant' -A 70 model/governance.ts`.
--
-- 🛑 SEVEN COLUMNS FOR TWENTY-ONE FIELDS, AND THE OMISSIONS ARE A DECISION
--    RATHER THAN AN OVERSIGHT. `justification`, `engagement_ref`,
--    `idle_revoke_days`, `last_used_at`, `extensions`, `visible_to_tenant`,
--    `customer_notified_at`, `customer_approved_at`, `approved_by_staff_user_id`,
--    `revoked_by`, `revocation_reason` and the resource MODE are all absent.
--    **Every one of them is read by `evaluateTenantAccess()`, and NONE of them
--    is read by the selection predicate at the bottom of this file**, because
--    SELECTION IS NOT USE: binding a tenant to a session is not reaching a
--    resource. `0004_subject_ledger.sql` refused a column ahead of its reader
--    at length one file back, and this is the same refusal.
--
--    ⚠️ THE CONSEQUENCE, STATED PLAINLY: this table cannot answer whether a
--    grant may be USED. The commit that builds the grant-issuing path owns
--    adding those columns, and it owns them in the same commit as the writer.
--
-- 🛑 NOTHING MINTS ONE OF THESE ROWS. The grants below the `GRANT` line at the
--    foot of this file are `SELECT` only, exactly as 0005 decided for
--    `tenant.membership` — *"A write privilege ahead of a writer is the shape
--    `0004_subject_ledger.sql` refused"* — so the request path can read a grant
--    and can never write one. **The arm is reachable and its term has no
--    producer**, which is the same shape G289 recorded for `platformHeld` on
--    the same day, behind the same fence, and it is named rather than left.
--
-- THE PRIMARY KEY IS COMPOSITE for 0001's reason: a cross-tenant reference has
-- to be unrepresentable rather than merely unlikely.
--
-- 🛑 NO `CHECK` CONSTRAINT ON `purpose` OR ANYWHERE ELSE, for `0002_run.sql`'s
--    reason in its own words — a third copy of a closed enum is *"a third place
--    to drift, and the one nothing checks, because no pair in the wire-mirror
--    addresses SQL."* `purpose` is constrained instead by the JOIN to
--    `tenant.grant_duration_ceiling` in the policy: a purpose with no ceiling
--    row matches nothing and the grant admits nobody. **Fails closed, and a
--    test asserts the ceiling table equals `MAX_GRANT_HOURS` in both
--    directions**, which is the difference between a copy and a drift.
-- ---------------------------------------------------------------------

CREATE TABLE tenant.tenant_access_grant (
  tenant_id      text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id             text        NOT NULL,
  purpose        text        NOT NULL,
  staff_user_id  text        NOT NULL,
  -- G292's three liveness terms live in these three columns plus `purpose`.
  -- `granted_at` is NOT decorative here: the ceiling is measured FROM it, so a
  -- grant that lies about when it started shortens nothing — it lengthens, and
  -- the predicate refuses it.
  granted_at     timestamptz NOT NULL,
  expires_at     timestamptz NOT NULL,
  -- RETAINED RATHER THAN DELETED, like `membership.revoked_at` and for the same
  -- reason: a revoked grant is still a row, and an `EXISTS` on
  -- `(staff_user_id, tenant_id)` alone would re-grant every access ever
  -- withdrawn.
  revoked_at     timestamptz,

  PRIMARY KEY (tenant_id, id)
);

-- The lookup the restrictive `WITH CHECK` performs. `tenant_id` leads because
-- the grant's own policy has already narrowed the subquery to one tenant before
-- this index is consulted — the planner sees that predicate even though no
-- handler wrote it. Same shape as `membership_live_idx`.
CREATE INDEX tenant_access_grant_live_idx
  ON tenant.tenant_access_grant (tenant_id, staff_user_id);


-- ---------------------------------------------------------------------
-- THE RESOURCE LINES — what the grant CLAIMS to reach, which is what the three
-- governance lists are consulted about.
--
-- ⚠️ THE COLUMN SET IS AGAIN THE PREDICATE'S AND NOT THE INTERFACE'S.
--    `AccessResourceGrant` also carries `mode` and `nominatedSubjectIds`; both
--    are read by `grantAllows()` at USE time and by nothing here. The
--    enumeration rule (`REQUIRES_ENUMERATION`) is a FOURTH list and is
--    deliberately not applied at selection: it decides whether a grant may
--    reach a NAMED SUBJECT, and selection names none.
--
-- 🛑 THE FOREIGN KEY IS COMPOSITE AND CARRIES `tenant_id`, so a resource line
--    cannot belong to another tenant's grant. That is 0001's rule again, and it
--    is load-bearing twice here: it also guarantees that a line is visible
--    under exactly the tenant scope its grant is visible under — see the
--    FAIL-OPEN warning on the policy below, which is the whole reason this
--    table's policy is byte-identical to the grant's.
-- ---------------------------------------------------------------------

CREATE TABLE tenant.access_resource_grant (
  tenant_id text NOT NULL,
  grant_id  text NOT NULL,
  resource  text NOT NULL,

  PRIMARY KEY (tenant_id, grant_id, resource),
  FOREIGN KEY (tenant_id, grant_id)
    REFERENCES tenant.tenant_access_grant (tenant_id, id) ON DELETE CASCADE
);


-- =====================================================================
-- THE THREE LISTS, AS SEEDED REFERENCE DATA.
--
-- 🛑 READ THIS BLOCK BEFORE READING THE TABLES. THIS IS A THIRD COPY OF THREE
--    CLOSED SETS THAT ALREADY EXIST IN `model/governance.ts`, AND THIS
--    REPOSITORY NORMALLY FORBIDS EXACTLY THAT. `0002_run.sql` states the
--    prohibition and its reason: a duplicated enum is *"a third place to drift
--    — and the one nothing checks, because no pair in the wire-mirror addresses
--    SQL."*
--
--    **THE PROHIBITION IS ABOUT THE UNCHECKED-NESS, NOT ABOUT THE COPY**, and
--    that is the whole of the argument for these three tables:
--
--      · a policy expression cannot import a TypeScript constant, so the
--        database half of G167's three-list check either lives here as DATA or
--        does not exist — and "does not exist" means the model half and the
--        database half would answer DIFFERENTLY about a grant claiming
--        `statutory`, which is the third defeat #157 never named;
--      · `tests/db/session-membership-selection.test.ts` reads all three tables
--        AND the three model constants and requires **set equality in BOTH
--        directions**. Editing `NON_DELEGABLE_RESOURCES` without editing the
--        seed below is a RED, immediately, by name.
--
--    A copy with a total equality test over it is a MIRROR. A copy without one
--    is the drift 0002 refuses. **Do not add a fourth list here without adding
--    its equality assertion in the same commit.**
--
-- ⚠️ NO ROW-LEVEL SECURITY ON ANY OF THE THREE, AND IT IS DELIBERATE. They hold
--    no tenant data and no customer data: they are PLATFORM CONFIGURATION,
--    published downward, the same class of fact as a host binding under G179.
--    A tenant-scoped predicate is unavailable in any case — there is no
--    `tenant_id` to key one on — and inventing a synthetic one would be a rule
--    keyed on a convenient landmark rather than the property it protects
--    (§5.1). They are granted `SELECT` and nothing else, to one role.
--
-- 🛑 AND THE FAIL-OPEN TRAP THAT FOLLOWS FROM THAT, NAMED HERE BECAUSE IT IS
--    THE SHARPEST THING IN THIS FILE. The list check in the policy below is a
--    `NOT EXISTS (… unreachable line …)`. **If `non_delegable_resource` or
--    `contract_only_resource` were ever UNREADABLE to the querying role, the
--    `IN (SELECT …)` would match nothing, the `NOT EXISTS` would be TRUE, and
--    the check would PERMIT everything it exists to refuse** — including
--    `statutory`, which invariant 8 refuses *"at any price"*. Two things stand
--    against that and both are asserted rather than assumed:
--
--      (1) the `GRANT SELECT` at the foot of this file, and a test that reads
--          all three tables AS THE APP ROLE inside a selection scope and
--          requires each to be NON-EMPTY;
--      (2) `access_resource_grant`'s policy is byte-identical to
--          `tenant_access_grant`'s, so a resource line is visible under exactly
--          the scope its grant is visible under. A grant found with its lines
--          hidden is the only shape that could hide a `statutory` claim, and
--          two identical predicates cannot produce it.
--
--    `permitted_resource` fails the OTHER way — an empty table refuses
--    everything — which is worth knowing when a test goes inexplicably red.
-- =====================================================================

-- Classes no purpose and no contract opens. Checked FIRST, always — the
-- ordering `authorisationPermits()` states in its own header and that G75 had
-- to be taken to discover. A list of one, which is the point.
CREATE TABLE tenant.non_delegable_resource (
  resource text PRIMARY KEY
);
INSERT INTO tenant.non_delegable_resource (resource) VALUES ('statutory');

-- Classes a purpose never opens by itself, and a `SupportAuthorisation` may.
-- 🛑 NO `SupportAuthorisation` EXISTS IN THIS DATABASE AND THE SELECTION ARM
--    READS NONE — G292 was offered *"requiring an active `SupportAuthorisation`
--    alongside"* and DECLINED it, because *"a second document is a second thing
--    that can be absent when somebody needs access urgently."* So membership of
--    this list is, at selection time, an outright refusal rather than a
--    contract-gated permit. **The decline removed a REQUIREMENT, not a CHECK.**
CREATE TABLE tenant.contract_only_resource (
  resource text PRIMARY KEY
);
INSERT INTO tenant.contract_only_resource (resource) VALUES ('authority');

-- What each purpose may EVER reach on the strength of the purpose alone.
-- ⚠️ `secret` IS IN `delivery` AND THAT IS G60/G75, TAKEN AGAINST A WRITTEN
--    RECOMMENDATION AND NOT TO BE QUIETLY NARROWED BACK. G56 puts source
--    configuration with the FDE and a source has a credential, so the old
--    invariant made the FDE's own job structurally impossible. A test asserts
--    that a delivery grant claiming `secret` and nothing else BINDS A TENANT —
--    a positive control, because a reversal recorded only in prose is a
--    reversal that decays.
CREATE TABLE tenant.permitted_resource (
  purpose  text NOT NULL,
  resource text NOT NULL,
  PRIMARY KEY (purpose, resource)
);
INSERT INTO tenant.permitted_resource (purpose, resource) VALUES
  ('delivery', 'telemetry'),
  ('delivery', 'configuration'),
  ('delivery', 'identity'),
  ('delivery', 'endpoint'),
  ('delivery', 'tenant_data'),
  ('delivery', 'secret'),
  ('incident', 'telemetry'),
  ('incident', 'configuration'),
  ('incident', 'endpoint'),
  ('incident', 'tenant_data');

-- ---------------------------------------------------------------------
-- G292's THIRD TERM, AS DATA. `MAX_GRANT_HOURS`, per purpose.
--
-- 🛑 THE CEILING IS A PROPERTY OF THE PREDICATE, WHICH IS THE WHOLE RULING:
--    *"a grant cannot be issued, or extended, past it, and the enforcement does
--    not depend on the issuing path being the only path."* There is no issuing
--    path in this repository at all — nothing writes a grant row — so a ceiling
--    enforced at issue would be a ceiling enforced nowhere.
--
-- ⚠️ IT IS PER PURPOSE AND THE DIFFERENCE IS 90×: `delivery` is 24 × 90 hours
--    and `incident` is 24. A single number here would silently hand every
--    incident grant a ninety-day reach, and a test asserts the differential by
--    running the SAME dates under both purposes.
--
-- ⚠️ `SupportAuthorisation.maxHours` — the negotiated per-customer number that
--    WINS outright where one exists, §8.5 — is NOT represented and cannot be:
--    see the decline recorded on `contract_only_resource` above. The platform
--    default is therefore the only ceiling at selection time, which is the
--    NARROWER reading in every case where the negotiated number is larger and
--    the WIDER one where it is smaller. **That asymmetry is owed to whoever
--    builds the authorisation table**, and it is named rather than hidden.
-- ---------------------------------------------------------------------

CREATE TABLE tenant.grant_duration_ceiling (
  purpose   text    PRIMARY KEY,
  max_hours integer NOT NULL
);
INSERT INTO tenant.grant_duration_ceiling (purpose, max_hours) VALUES
  ('delivery', 2160),   -- 24 * 90
  ('incident', 24);


-- =====================================================================
-- ROW-LEVEL SECURITY on the two tenant-scoped tables.
--
-- `ENABLE` and `FORCE`, both, for 0001's argument unchanged: `ENABLE` alone
-- leaves the TABLE OWNER exempt, so a test connecting as the owner passes with
-- the policy doing nothing and passes just as well with the policy dropped.
-- =====================================================================

ALTER TABLE tenant.tenant_access_grant   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.tenant_access_grant   FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.access_resource_grant ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.access_resource_grant FORCE  ROW LEVEL SECURITY;

-- 0001's predicate, verbatim, twice — and the sameness is load-bearing rather
-- than tidy. See the FAIL-OPEN warning above: these two policies must narrow
-- IDENTICALLY, or a grant could be found with its resource lines hidden and the
-- three-list check would silently pass over a `statutory` claim. A test compares
-- the two expressions in `pg_policy` and requires them equal.
CREATE POLICY tenant_access_grant_rls ON tenant.tenant_access_grant
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY access_resource_grant_rls ON tenant.access_resource_grant
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- =====================================================================
-- 🛑 G199's ONE ADDITIONAL DISJUNCT. THIS IS THE SLICE.
--
-- READ `0005_session_and_membership.sql`'s note on this policy first — the
-- whole of it. Everything it says about `AS RESTRICTIVE` being AND-ed rather
-- than OR-ed, about the absent `USING` restricting WRITES ONLY, about
-- `tenant_id IS NULL` being the mint path rather than a convenience, and about
-- `now()` being the TRANSACTION's clock while the model's is the CALLER's, is
-- unchanged and still governs. This file adds one disjunct and changes nothing
-- else.
--
-- ⚠️ `ALTER POLICY` RATHER THAN `DROP` + `CREATE`, AND THE CHOICE IS A CONTROL.
--    `ALTER POLICY … WITH CHECK (…)` replaces the expression and CANNOT change
--    the policy's identity: it stays `AS RESTRICTIVE`, stays `FOR ALL`, and
--    stays without a `USING`. A `DROP POLICY` + `CREATE POLICY` pair would
--    restate all three, and a restatement is a place to fat-finger `RESTRICTIVE`
--    into a permissive policy — which 0005 warns *"would have WIDENED what may
--    be written, which is the exact opposite of the intent and would have
--    looked almost identical in a diff."* One token, invisible in review,
--    catastrophic in effect. This form makes that token unreachable.
--
-- 🛑 THE STAFF DISJUNCT IS THE SECOND, NOT THE FIRST, AND THE MEMBERSHIP
--    DISJUNCT IS REPRODUCED BYTE-FOR-BYTE FROM 0005. A reader comparing the two
--    files should find the first `EXISTS` identical; if it is not, this file has
--    silently re-decided the customer arm while claiming to add to it.
--
-- ⚠️ THE SECOND NARROWING 0005 DISCOVERED APPLIES HERE UNCHANGED AND FOR FREE.
--    **PostgreSQL applies row-level security to a table referenced inside a
--    policy expression, as the querying role** — measured, not reasoned — so
--    `tenant_access_grant_rls` narrows this subquery to `app.tenant_id` exactly
--    as `membership_rls` narrows the first. The check can therefore pass only
--    when the tenant being WRITTEN equals the tenant scope DECLARED, for staff
--    as for customers, from two policies neither of which knows about the other.
--    `db/selection-scope.ts` — which this file does not touch — is still the one
--    helper that opens both GUCs.
--
-- THE TERMS, AND EACH IS G292's OR G199's RATHER THAN THIS FILE'S:
--
--   g.staff_user_id = session.user_id   the principal. Without it an FDE binds
--                                       a tenant on somebody ELSE's grant.
--   g.tenant_id     = session.tenant_id a grant for tenant A cannot bind B —
--                                       `grantAllows()`'s correction of 5 Aug
--                                       2026, in SQL.
--   g.revoked_at IS NULL                G292 term 1.
--   g.expires_at > now()                G292 term 2. An expired grant is NOT a
--                                       revoked one; both are refused and they
--                                       are refused SEPARATELY, because that
--                                       distinction already cost a real defect
--                                       in the customer arm.
--   expires_at <= granted_at + ceiling  G292 term 3, THE ONE THE MEMBERSHIP ARM
--                                       HAS NO NEED OF. The JOIN supplies the
--                                       ceiling and also validates the purpose:
--                                       a purpose with no row matches nothing.
--   NOT EXISTS (… unreachable line …)   G167's three lists, all three, in the
--                                       order `authorisationPermits()` fixes.
--
-- ⚠️ THE MODEL HALF WALKS `extensions[]` AND THIS ONE CANNOT, WHICH IS NAMED
--    RATHER THAN LEFT TO A FAILING TEST. There is no extension table here, so in
--    the database a grant's `expires_at` IS its effective expiry, and the only
--    way to extend a grant is to UPDATE that column — which the ceiling term
--    above catches for exactly the same arithmetic. The two halves therefore
--    agree on every state this database can represent. **The commit that adds
--    an `access_extension` table owes the `greatest(…)` term, and until then
--    the model half is the stricter of the two** — which is the safe direction.
--
-- ⚠️ ORDER WITHIN THE `AND` CHAIN IS THE PLANNER'S AND CARRIES NO MEANING. The
--    first-position property that matters for `NON_DELEGABLE_RESOURCES` is a
--    property of `authorisationPermits()` in the model half; here every term is
--    conjunctive, so a `statutory` line refuses the grant whichever term the
--    planner evaluates first. **Do not read the layout as an order.**
-- =====================================================================

ALTER POLICY session_selection_restrictive ON tenant.session
  WITH CHECK (
    tenant_id IS NULL
    OR EXISTS (
      SELECT 1
        FROM tenant.membership m
       WHERE m.user_id   = session.user_id
         AND m.tenant_id = session.tenant_id
         AND m.revoked_at IS NULL
         AND (m.expires_at IS NULL OR m.expires_at > now())
    )
    OR EXISTS (
      SELECT 1
        FROM tenant.tenant_access_grant g
        JOIN tenant.grant_duration_ceiling c ON c.purpose = g.purpose
       WHERE g.staff_user_id = session.user_id
         AND g.tenant_id     = session.tenant_id
         AND g.revoked_at IS NULL
         AND g.expires_at > now()
         AND g.expires_at <= g.granted_at + (c.max_hours * interval '1 hour')
         AND NOT EXISTS (
           SELECT 1
             FROM tenant.access_resource_grant r
            WHERE r.tenant_id = g.tenant_id
              AND r.grant_id  = g.id
              AND (
                   r.resource IN (SELECT n.resource FROM tenant.non_delegable_resource n)
                OR r.resource IN (SELECT o.resource FROM tenant.contract_only_resource o)
                OR NOT EXISTS (
                     SELECT 1
                       FROM tenant.permitted_resource p
                      WHERE p.purpose  = g.purpose
                        AND p.resource = r.resource
                   )
              )
         )
    )
  );


-- ---------------------------------------------------------------------
-- GRANTS. By name, because 0003 declines `ALTER DEFAULT PRIVILEGES` on this
-- schema: *"A future table created here is unreachable by the app until granted
-- BY NAME … default privileges would silently hand the request path a table
-- nobody decided to expose."*
--
-- 🛑 `SELECT` AND NOTHING ELSE, ON ALL SIX, AND THAT IS 0005's DECISION
--    APPLIED TO A SHARPER OBJECT. 0005 withholds INSERT/UPDATE/DELETE on
--    `tenant.membership` because *"nothing on the request path mints a
--    membership"*; nothing on the request path mints a GRANT either, and a
--    grant is the stronger instrument — it crosses the staff/customer boundary
--    invariant 8 is about. **A request path that could write
--    `tenant_access_grant` could mint its own tenant scope in two statements,
--    and the second one would be a staff scope.** The commit that builds the
--    grant-issuing path adds the privilege, in the same commit as the writer,
--    and it will need the eleven columns this file did not create.
--
-- ⚠️ THE THREE LISTS AND THE CEILING MUST BE READABLE OR THE CHECK FAILS OPEN —
--    see the FAIL-OPEN block above. These four grants are load-bearing in a way
--    a `SELECT` grant usually is not.
-- ---------------------------------------------------------------------

GRANT SELECT ON tenant.tenant_access_grant     TO tenant_rw;
GRANT SELECT ON tenant.access_resource_grant   TO tenant_rw;
GRANT SELECT ON tenant.non_delegable_resource  TO tenant_rw;
GRANT SELECT ON tenant.contract_only_resource  TO tenant_rw;
GRANT SELECT ON tenant.permitted_resource      TO tenant_rw;
GRANT SELECT ON tenant.grant_duration_ceiling  TO tenant_rw;

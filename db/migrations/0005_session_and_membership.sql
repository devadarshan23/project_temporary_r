-- =====================================================================
-- 0005 — THE SESSION AND THE MEMBERSHIP. G160 (S-2) and G199 (S-21),
-- for #157 [M1-2]. The deepest dependency in the product.
--
-- WHAT IT IS FOR. Invariant 1 — "tenant scope is derived from the session,
-- never read from a request" — has had no session to derive it from.
-- `db/migrations/0001_tenancy_and_rls.sql` carried the invariant's READ half
-- into the database over `tenant_contact`; this file carries its WRITE half,
-- because `docs/build/stateless-red-session.md` B1 found that the invariant's
-- sentence survived while being DEFEATED BY RELOCATION: the request-supplied
-- tenant did not disappear, it moved into the one write that establishes a
-- scope, and nothing anywhere constrained what that write may write.
--
-- RULINGS THIS APPLIES (docs/HANDOFF.md §3):
--   G160  the session policy keys on the HANDLE DIGEST IN A GUC, never on a
--         row id via `SECURITY DEFINER`. There is no `CREATE FUNCTION` in this
--         file and there must never be one.
--   G199  the CUSTOMER ARM SHIPS NOW, on `Membership` alone. The staff arm is
--         its own later slice. THE COST IS DECLARED BELOW, not discovered.
--   G97   every branded id is `text`; the slug is stored VERBATIM. No uuid.
--   G100  the policy DENIES on NULL. A forgotten transaction yields an EMPTY
--         result set, never another tenant's — or another session's — rows.
--   G101  transaction-mode pooling assumed; `SET LOCAL` inside an explicit
--         transaction, issued only by a named scoped helper.
--   G88   forward-only. There is no `down` and no facility for one. 0001–0004
--         ARE NOT EDITED BY THIS FILE.
--
-- 🛑 THE MODEL HALF AND THIS HALF ARE ONE COMMIT, AND THAT IS #157's GOVERNING
--    PRINCIPLE RATHER THAN A PREFERENCE: *"This slice lands the model half and
--    the database half together, because either alone is a defeat."*
--    `selectTenantForSession()` (`model/access.ts` §7a) is the other half.
--    **The split G199 made is CUSTOMER-VERSUS-STAFF, never
--    model-versus-database.**
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE COST G199 REQUIRES TO BE DECLARED RATHER THAN DISCOVERED.
-- ═══════════════════════════════════════════════════════════════════════
--
-- A PLATFORM FDE HAS NO `Membership` — that is what being platform staff means
-- in this model; staff reach a tenant by `TenantAccessGrant`, not by
-- membership. So the `EXISTS` below is EMPTY FOR AN FDE, `session.tenant_id`
-- can never be set for staff, and **invariant 8's PERMITTED path is
-- structurally unreachable until the staff slice lands.** No document may
-- describe that path as built, reachable or enforced.
--
-- #157 states the stakes in the form to quote: *"A prohibition that is
-- enforced by making the permission unreachable is not an enforced invariant;
-- it is an unbuilt feature wearing an invariant's badge."* G60 read as applied
-- for eight days while the FDE could not bind a credential, and it took G75
-- finding a third constant to notice. ⚠️ **The difference this time is that
-- the unreachability is DECLARED rather than discovered — and a declared
-- temporary is still a temporary that becomes permanent by silence.**
--
-- THE FOLLOW-ON IS REQUIRED, NOT OPTIONAL, and G199 gives it a shape: one
-- additional `OR EXISTS (… tenant_access_grant …)` disjunct in the
-- `AS RESTRICTIVE` `WITH CHECK` below, landing in the same commit as its model
-- arm, with the three-list check — `PERMITTED_RESOURCES`,
-- `CONTRACT_ONLY_RESOURCES` and `NON_DELEGABLE_RESOURCES`, all three, in ONE
-- helper with ONE call site, because `authorisationPermits()` tests the third
-- FIRST. A staff arm consulting two of the three reproduces G60's defect
-- exactly.
--
-- ⚠️ SCHEMA-QUALIFIED, BECAUSE 0003 SAYS EVERY MIGRATION FROM 0004 ON MUST BE.
--    `db/provision.ts` sets `search_path = tenant, public`, and PostgreSQL
--    creates an unqualified table in the first EXISTING schema of that path.
--    0003: *"Qualify every CREATE TABLE explicitly from 0004 on, or the schema
--    a table lives in becomes a side effect of migration order."*
-- =====================================================================


-- ---------------------------------------------------------------------
-- MEMBERSHIP — the authorization primitive, and the only thing that may
-- satisfy the restrictive check at the bottom of this file.
--
-- Mirrors `Membership` (`model/domain.ts`) field for field; derive the shape,
-- do not read it here: `grep -n 'export interface Membership' -A 60
-- model/domain.ts`.
--
-- 🛑 `id` IS A COLUMN AND `(user_id, tenant_id)` IS NOT A KEY, AND THE
--    DECLARATION SAYS WHY IN ITS OWN VOICE: *"A membership is REVOKED AND
--    RETAINED rather than deleted, so `(userId, tenantId)` was never a key:
--    the same pair recurs every time a person is re-granted … a transfer
--    between partners is meant to leave both rows."* A `UNIQUE (tenant_id,
--    user_id)` constraint here would make the second grant unrepresentable and
--    would be discovered by a customer, not by a test.
--
-- THE PRIMARY KEY IS COMPOSITE for 0001's reason (`model/domain.ts` on
-- `Endpoint`): a cross-tenant reference has to be unrepresentable rather than
-- merely unlikely.
--
-- ⚠️ `role_id` CARRIES NO FOREIGN KEY, AND THAT IS A GAP RATHER THAN A
--    DECISION. A `Role`'s identity is `(packId, key)` and no pack table exists
--    in this database; a foreign key to nothing is not available at any price,
--    and inventing a `role` table to hold one would be this slice minting the
--    pack line. Recorded as owed, not argued away.
--
-- 🛑 NO `CHECK` CONSTRAINT ANYWHERE ON THIS TABLE, for `0002_run.sql`'s reason
--    stated in its own words: a third copy of a closed enum is *"a third place
--    to drift — and the one nothing checks, because no pair in the wire-mirror
--    addresses SQL."*
-- ---------------------------------------------------------------------

CREATE TABLE tenant.membership (
  tenant_id  text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id         text        NOT NULL,
  user_id    text        NOT NULL,
  role_id    text        NOT NULL,
  granted_by text        NOT NULL,
  granted_at timestamptz NOT NULL,
  -- `Membership.expiresAt`: *"Partner-scoped memberships must expire. Null only
  -- for direct staff."* Nullable here for exactly that reason, and the NULL is
  -- read as "does not expire" by both halves of the check — see the policy.
  expires_at timestamptz,
  -- RETAINED RATHER THAN DELETED, so a transfer between partners is auditable.
  -- This column is why the restrictive check below cannot be a bare `EXISTS`
  -- on the pair: a revoked row is still a row.
  revoked_at timestamptz,

  PRIMARY KEY (tenant_id, id)
);

-- The lookup the restrictive `WITH CHECK` performs on every write to
-- `tenant.session`, and nothing else. `tenant_id` leads because the membership
-- policy has already narrowed the subquery to one tenant before this index is
-- consulted — the planner sees that predicate even though no handler wrote it.
CREATE INDEX membership_live_idx ON tenant.membership (tenant_id, user_id);


-- ---------------------------------------------------------------------
-- SESSION — ten columns for eleven keys, and the missing one is deliberate.
--
-- `Session.secondFactorAt` is `@dropped-for-v1` under G223 — *"federation owns
-- the second factor"* — and the standing v1 discipline is that a dropped
-- declaration gets *"no table, no endpoint, no code"*. A column here would be
-- the producer `tests/model/session-shape.test.ts` sweeps `model/` for, one
-- layer down where that sweep cannot see it.
--
-- 🛑 NOT TENANT-SCOPED, AND IT IS THE ONE STRUCTURAL FACT THE WHOLE SURFACE
--    TURNS ON. `tenant_id` is NULL between authentication and selection, so
--    this row CANNOT be protected by the predicate every other scoped table
--    uses: `tenant_id = nullif(current_setting('app.tenant_id', true), '')`
--    evaluates to NULL against a NULL column, and G100's polarity then denies
--    UNCONDITIONALLY — the row would be invisible to the very connection that
--    just wrote it, liveness could not be checked before selection, and
--    nothing could ever select. `model/identity.ts` asserts the negative
--    (`_SessionIsNotTenantScoped`) so that `extends TenantScoped` is a compile
--    error rather than a code review.
--
-- ⚠️ THE PRIMARY KEY IS `id` ALONE, AND IT IS THE ONE PLACE THIS FILE DEPARTS
--    FROM THE COMPOSITE-KEY HOUSE RULE. `(tenant_id, id)` is unavailable: a
--    composite primary key cannot contain a nullable column, and `tenant_id`
--    must be nullable for the paragraph above. The rule the composite key
--    exists to enforce — that a cross-tenant reference is unrepresentable —
--    is bought here by a different mechanism, the restrictive policy at the
--    bottom of this file, which is strictly stronger for this table because
--    it constrains the VALUE rather than the reference.
--
-- `handle_digest` is `NOT NULL UNIQUE` because it is the lookup key AND the
-- RLS predicate under G160. Two keys, deliberately and not redundantly: `id`
-- is what a record cites and may appear in a log; `handle_digest` is the
-- credential's shadow and appears in neither. The PREIMAGE IS NEVER STORED —
-- *"a database dump containing handles would be a session-hijack kit"*.
-- ---------------------------------------------------------------------

CREATE TABLE tenant.session (
  id               text        PRIMARY KEY,
  handle_digest    text        NOT NULL UNIQUE,
  user_id          text        NOT NULL,
  connection_id    text        NOT NULL,
  tenant_id        text        REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  -- G180, and the binding is PERMANENT: *"any request whose Host differs is
  -- refused and the session revoked."* Stored rather than derived because a
  -- session minted WITHOUT it would need a migration to add it, under G88, on
  -- the one field G180 calls permanent. THE CHECK IS THE REQUEST PLANE'S and
  -- is not written anywhere yet.
  issued_host      text        NOT NULL,
  authenticated_at timestamptz NOT NULL,
  -- G220 reversed `docs/build/stateless-green-session.md` §6.4 and put this
  -- back: without it there is nothing to compare the idle clock against and
  -- `maxIdleSeconds` becomes a number the system holds and cannot act on.
  last_used_at     timestamptz NOT NULL,
  expires_at       timestamptz NOT NULL,
  -- Self-service sign-out, and G180's host check. Revoking a PERSON's access
  -- is `User.status` or the assignment, not this column.
  revoked_at       timestamptz
);


-- =====================================================================
-- ROW-LEVEL SECURITY.
-- =====================================================================

-- `ENABLE` and `FORCE`, both, on both tables — 0001's argument unchanged:
-- `ENABLE` alone leaves the TABLE OWNER exempt, so a test connecting as the
-- owner passes with the policy doing nothing and passes just as well with the
-- policy dropped. `FORCE` is what makes the explicit `BYPASSRLS` attribute on
-- reconcile_migrator the ONLY route to the read exemption.

ALTER TABLE tenant.membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.membership FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.session    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.session    FORCE  ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------
-- MEMBERSHIP'S POLICY — 0001's predicate, verbatim and deliberately so.
--
--     nullif(current_setting('app.tenant_id', true), '')
--
--   `missing_ok = true`  — an unset variable returns NULL instead of raising,
--                          because the empty read is the behaviour that is
--                          identical under both pooling modes.
--   `nullif(…, '')`      — a GUC that was SET and reverted reads back as the
--                          EMPTY STRING, not NULL. Without this the predicate
--                          is `tenant_id = ''`, which denies BY ACCIDENT and
--                          only because no tenant id happens to be empty.
--   `tenant_id = NULL`   — NULL is not TRUE, so the row is filtered.
--                          THE POLICY DENIES ON NULL.
--
-- 🛑 THIS POLICY IS LOAD-BEARING TWICE, AND THE SECOND TIME IS NOT OBVIOUS.
--    It protects membership rows from a cross-tenant read, which is its job.
--    It ALSO narrows the subquery inside the session's restrictive check
--    below, because **PostgreSQL applies row-level security to tables
--    referenced inside a policy expression, as the querying role.** That is
--    not folklore here: it was MEASURED against a local PostgreSQL before this
--    file was written, and the measurement is what decided the shape of
--    `db/selection-scope.ts`. See the restrictive policy's own note.
-- ---------------------------------------------------------------------

CREATE POLICY membership_rls ON tenant.membership
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- ---------------------------------------------------------------------
-- THE SESSION'S PERMISSIVE POLICY — G160, AND THE ALTERNATIVE IT REFUSED.
--
-- The predicate keys on the HANDLE DIGEST carried in `app.session_ref`. The
-- rejected option was the row id in `app.session_id`, resolved by a
-- `SECURITY DEFINER` function `session_id_for_token()` — refused because such
-- a function *"becomes the most security-relevant object in the schema"*, a
-- standing widening that outlives whatever request motivated it, and it would
-- need its own two-row negative test on top.
--
-- ⚠️ THE COST G160 ACCEPTS IS NOT WAVED AWAY: the digest must be computed and
--    carried on EVERY request. `db/session-scope.ts` is where it is carried;
--    computing it is the request plane's.
--
-- SAME NULL POLARITY AS EVERY OTHER POLICY IN THIS DIRECTORY. A query outside
-- a scoped helper sees ZERO ROWS rather than every row.
--
-- `WITH CHECK` is stated explicitly rather than left to default from `USING`,
-- so that a later `FOR SELECT`/`FOR ALL` edit cannot silently drop the write
-- half. Without it a connection could INSERT a session row for a digest it is
-- not scoped to and then be unable to see what it wrote.
-- ---------------------------------------------------------------------

CREATE POLICY session_rls ON tenant.session
  USING      (handle_digest = nullif(current_setting('app.session_ref', true), ''))
  WITH CHECK (handle_digest = nullif(current_setting('app.session_ref', true), ''));


-- ---------------------------------------------------------------------
-- 🛑 THE RESTRICTIVE POLICY. THIS IS B1's CONTROL AND THE REASON THE FILE
--    EXISTS. READ THE WHOLE NOTE BEFORE CHANGING ONE TOKEN OF IT.
--
-- WHAT WAS WRONG WITHOUT IT. The permissive policy above constrains the DIGEST
-- COLUMN and nothing else, so `UPDATE session SET tenant_id = 'ten_acme'` on
-- YOUR OWN ROW satisfies its `WITH CHECK` for ANY value that satisfies the
-- foreign key. B1's scenario, with inputs: an attacker holding a legitimate
-- session binds it to a tenant they hold nothing in; `resolveSubject()` then
-- returns `ok`; `TenantContext` carries the other tenant's residency,
-- environment and deployment mode — a cross-tenant read of tenancy metadata on
-- its own — and every handler that reads a scoped row WITHOUT routing through
-- `decide()` reads that tenant's rows with **RLS reporting success**.
-- G100's deny-on-NULL backstops a FORGOTTEN `set_config`. It backstops nothing
-- against a CHOSEN one.
--
-- ⚠️ `AS RESTRICTIVE`, NOT A SECOND PERMISSIVE POLICY, AND THE DIFFERENCE IS
--    THE WHOLE CONTROL. Permissive policies are OR-ed: a second one would have
--    WIDENED what may be written, which is the exact opposite of the intent
--    and would have looked almost identical in a diff. Restrictive policies are
--    AND-ed with the permissive result. Both must hold.
--
-- ⚠️ NO `USING` CLAUSE, AND THE ABSENCE IS DELIBERATE AND MEASURED. A
--    restrictive policy with no `USING` restricts WRITES ONLY; reads continue
--    to be decided by `session_rls` alone. That was verified against a live
--    PostgreSQL rather than assumed — a restrictive `USING` here would make a
--    session row unreadable until its membership was re-proved on every
--    request, including the requests whose whole purpose is to discover that
--    the session is revoked.
--
-- 🛑 `tenant_id IS NULL OR …` IS THE FIRST DISJUNCT AND IT IS NOT A
--    CONVENIENCE. `completeFederatedSignIn` mints a session with `tenantId`
--    constrained to `null` on the wire PRECISELY SO THAT AUTHENTICATION CANNOT
--    CONFER A SCOPE. Without this disjunct the mint itself would be refused,
--    and the repair a hurried reader would reach for is to widen the second
--    disjunct — which is how a write-side control becomes decorative.
--
-- ⚠️ THE DATABASE'S LIVENESS TERMS ARE STRICTER THAN B1's QUOTED PREDICATE,
--    AND THE DIVERGENCE IS NAMED RATHER THAN SLIPPED IN. B1 writes the control
--    as `… AND m.revoked_at IS NULL` and stops there. An EXPIRED membership is
--    not revoked, so that predicate would let a lapsed partner-scoped
--    membership bind a tenant forever — and `Membership.expiresAt`'s own
--    declaration rules that *"partner-scoped memberships must expire"*. The
--    `expires_at` term is therefore added here, in the safe direction, and
--    `selectTenantForSession()` carries the identical pair so the two halves
--    cannot answer differently.
--
-- ⚠️ AND ONE DIVERGENCE THAT CANNOT BE REMOVED: `now()` IS THE TRANSACTION'S
--    CLOCK, AND THE MODEL'S IS THE CALLER'S. `selectTenantForSession()` takes
--    `now` as a parameter for `PrincipalContext.now`'s reason — *"a decision
--    has to be reproducible in an audit"* — and a policy expression has no
--    parameter to take. The two clocks agree to within one transaction, which
--    is the whole of the exposure, and stating it is cheaper than discovering
--    it in a test that fails once a year.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE MEASURED FACT THAT DECIDED `db/selection-scope.ts`, RECORDED HERE
--    BECAUSE THIS IS THE STATEMENT IT IS ABOUT.
-- ═══════════════════════════════════════════════════════════════════════
--
-- **PostgreSQL applies row-level security to `tenant.membership` INSIDE this
-- subquery, as the querying role.** Measured, not reasoned: with only
-- `app.session_ref` set — which is every transaction `withSessionScope()`
-- opens — `membership_rls` denies on NULL, the `EXISTS` is empty, and a
-- LEGITIMATE selection is refused with
--
--     new row violates row-level security policy
--     "session_selection_restrictive" for table "session"
--
-- So this policy is satisfiable ONLY inside a transaction that ALSO carries
-- `app.tenant_id`, and `db/selection-scope.ts` is the one named helper that
-- opens both. The candidate tenant it sets comes from the HOST BINDING under
-- G179/G210 — never from the session row and never from a request body —
-- which is the distinction that makes the third helper legitimate rather than
-- the "helpfully" combined helper `db/session-scope.ts` forbids.
--
-- ✅ AND THE CONSEQUENCE IS A SECOND NARROWING NOBODY DESIGNED, WHICH IS WORTH
--    HAVING IN WRITING. Because `membership_rls` narrows the subquery to
--    `app.tenant_id`, this check can only pass when the tenant being WRITTEN
--    equals the tenant scope DECLARED. An attacker who declares their own
--    tenant and writes another's fails on the join; one who declares the
--    victim's tenant fails on the membership. Both were measured refused.
-- ---------------------------------------------------------------------

CREATE POLICY session_selection_restrictive ON tenant.session
  AS RESTRICTIVE
  FOR ALL
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
  );


-- ---------------------------------------------------------------------
-- GRANTS. By name, because 0003 deliberately declines to set
-- `ALTER DEFAULT PRIVILEGES` on this schema: *"A future table created here is
-- unreachable by the app until granted BY NAME … default privileges would
-- silently hand the request path a table nobody decided to expose."*
--
-- DML only, and no `CREATE`. The app role cannot alter either table and
-- therefore cannot drop the policies protecting them.
--
-- ⚠️ `tenant.membership` GETS NO `INSERT`, `UPDATE` OR `DELETE`, AND THAT IS A
--    DECISION. Nothing on the request path mints a membership: `/invite` is
--    drawn and unbuilt, `Invitation` is declared and has no table, and G229
--    rules that *"the inviter's act carries the grant; acceptance redeems
--    it"* — a flow with no operation, no handler and no writer here. A write
--    privilege ahead of a writer is the shape `0004_subject_ledger.sql`
--    refused at length one file back. `SELECT` alone is exactly what the
--    restrictive check needs, and the check is the only reader in the tree.
--    **The commit that builds the invitation writer adds the privilege, in the
--    same commit as the writer.**
-- ---------------------------------------------------------------------

GRANT SELECT                         ON tenant.membership TO tenant_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant.session    TO tenant_rw;

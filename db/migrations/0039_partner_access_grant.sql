-- =====================================================================
-- 0039 — INVARIANT 2's OWN ARTEFACT. G576, 19 Sep 2026.
--
-- THE INVARIANT, COPIED AND NOT PARAPHRASED (CLAUDE.md, the only place the
-- eleven are numbered):
--
--     "Exactly one cross-tenant read path — `partner_admin(P)` may read tenant
--      `T` iff `T.partnerId = P`, and only within a live `PartnerAccessGrant`
--      beyond commercial metadata."
--
-- 🛑 WHAT THIS FILE IS FOR, IN ONE SENTENCE: `partnerGrant` HAS BEEN THE ONE
--    TERM OF `PrincipalContext` WITH NO PRODUCER SINCE G299 LANDED THE OTHER
--    SEVEN, and `server/data-plane/authorise.ts` names it by hand:
--
--        ⛔ `partnerGrant`  **STILL NO `partner_access_grant` TABLE.** A partner
--                           principal is refused at `partner_grant_absent` — on
--                           the PARTNER arm, by name.
--
--    This is that table. After it, `decide()`'s partner arm has a producer for
--    every one of its five terms and every one of its five refusals is
--    REACHABLE — which is the difference between a control and
--    `docs/HANDOFF.md` §5.6.
--
-- ⚠️ IT IS THE PARTNER MIRROR OF `0008_staff_grant_selection.sql`, AND THAT
--    FILE IS THE ONE TO READ BESIDE THIS ONE. 0008 built invariant 8's staff
--    grant; this builds invariant 2's partner grant. The discipline is copied
--    deliberately: the column set is the PREDICATE's rather than the
--    interface's, the omissions are named, the policy is 0001's verbatim, and
--    the app role gets `SELECT` and nothing else.
--
-- ⚠️ AND ONE THING 0008 DID NOT HAVE TO DO. Invariant 8 is a single term — a
--    live grant. **Invariant 2 is a CONJUNCTION**: `T.partnerId = P` *and* a
--    live grant. The first half has never existed anywhere in this repository
--    — `tenant.tenant` carries `id`, `name`, `account_id`, `status`,
--    `created_at` and nothing about who sold it — so a grant table alone would
--    have built HALF an invariant and called it done. §1 below is the other
--    half, and §2's composite foreign key is what JOINS them: **a grant into a
--    tenant the partner did not sell is UNREPRESENTABLE**, not merely refused.
--
-- RULINGS THIS APPLIES (docs/HANDOFF.md §3):
--   G576  the partner grant is a ROW, at most one per tenant, and the
--         `T.partnerId = P` half is a COMPOSITE FOREIGN KEY rather than a
--         predicate somebody has to remember to write.
--   G87   the partner mask is an ALLOW-LIST: absence is the default and
--         silence is safe. Nothing here widens it; `PARTNER_CAPABILITY_MASK`
--         is untouched and is still the ceiling.
--   G97   every branded id is `text`; stored VERBATIM; no uuid, no cast. The
--         RLS predicate compares `text` to `current_setting(...)` directly.
--   G100  the policy DENIES on NULL, on the table this file creates.
--   G101  transaction-mode pooling assumed; `SET LOCAL` only, through a named
--         scoped helper — `db/tenant-scope.ts`, unchanged by this file.
--   G88   forward-only. There is no `down` and no facility for one.
--
-- ⚠️ SCHEMA-QUALIFIED THROUGHOUT, because 0003 requires it from 0004 on:
--    *"Qualify every CREATE TABLE explicitly from 0004 on, or the schema a
--    table lives in becomes a side effect of migration order."*
-- =====================================================================


-- =====================================================================
-- §1 — `T.partnerId`. THE HALF OF INVARIANT 2 NOTHING HAS EVER HELD.
--
-- 🛑 THIS IS A COLUMN ADDED TO A TABLE FROM 0001, WHICH THIS REPOSITORY
--    NORMALLY TREATS AS A SMELL, SO THE ARGUMENT IS MADE RATHER THAN ASSUMED.
--    `0004_subject_ledger.sql` refuses a column ahead of its reader at length,
--    and 0008 repeats the refusal. **The reader here is in this file**: the
--    composite `FOREIGN KEY` in §2 reads this column on every insert and every
--    update of a grant row, and it reads it as the DATABASE rather than as a
--    handler somebody could forget to call. A column whose reader is a
--    constraint declared eleven lines later is not a column ahead of its
--    reader.
--
-- ⚠️ NULLABLE, AND THE NULL IS A VALUE. A tenant 1CloudHub sold directly has
--    no partner, and `PartnerAccessGrant`'s own declaration says the default
--    posture is *"no access: absence of a grant means partners see commercial
--    metadata only."* A `NOT NULL DEFAULT ''` would invent a partner called
--    the empty string and hand the FK a value to match against.
--
-- 🛑 AND THE NULL FAILS CLOSED THROUGH THE FOREIGN KEY, WHICH IS THE PROPERTY
--    TO CHECK BEFORE TRUSTING ANY OF THIS. The grant's `partner_id` is
--    `NOT NULL`, so the pair `(tenant_id, partner_id)` can never match a
--    `tenant` row whose `partner_id` is NULL — under MATCH SIMPLE a NULL on the
--    REFERENCED side matches nothing, and the referencing side has no NULL to
--    exempt itself with. **A direct-sold tenant can therefore hold no partner
--    grant at all, by construction.** That is the strongest reading of
--    `T.partnerId = P` available in DDL and it is the reason this column is
--    here rather than in the handler that will one day set it.
--
-- ⚠️ NO `partner` TABLE, AND THE OMISSION IS NAMED. `PartnerId` is a branded
--    `text` under G97 and there is nowhere in this database that a partner
--    organisation is a row — `tenant.identity_connection.owner_partner_id`
--    (0009) is the same unreferenced string. A `REFERENCES tenant.partner (id)`
--    would be the right constraint and there is nothing to point it at; the
--    commit that builds the partner registry — `listPartnerRegistry` in
--    `docs/contracts/administration.openapi.yaml`, unmounted — owes both this
--    FK and 0009's.
--
-- 🛑 IT WIDENS G185(d)'s NARROW PROJECTION AND A TRIPWIRE SAID SO IN THE
--    COMMIT THAT ADDED IT. `tests/db/tenant-projection.test.ts` asserts the
--    column set of this table with a `deepEqual` against a CLOSED LIST —
--    *"what keeps a fourth column from arriving unremarked"* — and it went RED
--    here, which is the second time it has caught a widening and the first
--    time it has caught one that LOOKS control-side. **The argument for
--    admitting it is in that test, not here, because that is the file a reader
--    meets the question in**: the short form is that the constraint which
--    makes the column load-bearing is a DATA-PLANE constraint and there is no
--    cross-database foreign key, so putting `partner_id` on the control plane
--    would degrade invariant 2's first conjunct from unrepresentable to
--    remembered. `name`, `account_id` and `created_at` stay out.
--
-- 🛑 THE APP ROLE CAN WRITE THIS COLUMN AND THAT IS MEASURED, NOT OVERLOOKED.
--    `0003_tenant_schema.sql` grants `SELECT, INSERT, UPDATE, DELETE ON
--    tenant.tenant TO tenant_rw`, so a request path inside a tenant scope can
--    set its OWN tenant's `partner_id` to any string. **It confers nothing**:
--    the grant table below is `SELECT`-only to the same role, so the second
--    half of invariant 2's conjunction stays unwritable, and `decide()` refuses
--    a partner with no grant row at `partner_grant_absent` however the tenant
--    row is labelled. The fence is the GRANT, not the label — and
--    `tests/db/partner-access-grant.test.ts` §6 is the adversarial control that
--    says so rather than leaving it to be reasoned. Narrowing the 0003 grant to
--    a column list is a change to a privilege four other tables depend on and
--    is not this file's to take.
-- =====================================================================

ALTER TABLE tenant.tenant ADD COLUMN partner_id text;

-- The composite FK in §2 needs a unique constraint over exactly these two
-- columns; `PRIMARY KEY (id)` alone cannot serve one. It is redundant as a
-- uniqueness claim — `id` is already unique — and it is REQUIRED as a
-- referenceable key, which is the only reason it exists.
ALTER TABLE tenant.tenant
  ADD CONSTRAINT tenant_id_and_partner_key UNIQUE (id, partner_id);


-- =====================================================================
-- §2 — THE GRANT.
--
-- Mirrors the LOAD-BEARING SUBSET of `PartnerAccessGrant` (`model/domain.ts`)
-- and NOT the whole interface. Derive the declaration, do not read it here:
-- `grep -n 'export interface PartnerAccessGrant' -A 30 model/domain.ts`.
--
-- 🛑 SIX COLUMNS FOR NINE FIELDS, AND THE OMISSIONS ARE 0008's DECISION TAKEN
--    AGAIN RATHER THAN A DIFFERENT ONE. `grantedBy`, `grantedAt` and
--    `revokedBy` are absent. **Every one of them is read by an audit and NONE
--    of them is read by `decide()`**, whose partner arm takes
--    `PartnerGrantTerms` — `partnerId`, `scope`, `expiresAt`, `revokedAt` —
--    and nothing else. 0008's sentence transfers unchanged: *"the column set
--    is the PREDICATE's and not the interface's."*
--
--    ⚠️ THE CONSEQUENCE, STATED PLAINLY: this table cannot answer WHO granted
--    the access or WHEN, and `PartnerAccessGrant` says the answer matters —
--    *"Granted by the CUSTOMER, never by the partner or by 1CloudHub."* **The
--    commit that builds the grant-issuing path owns those three columns, and it
--    owns them in the same commit as the writer.** Until then the fact is
--    unrecorded rather than wrongly recorded.
--
-- 🛑 NOTHING MINTS ONE OF THESE ROWS, EXACTLY AS IN 0008. The `GRANT` at the
--    foot of this file is `SELECT` only. **A request path that could write this
--    table could mint itself the only cross-tenant read path in the product**,
--    which is a sharper object than 0008's staff grant by precisely the margin
--    invariant 2 is narrower than invariant 8. The arm is reachable and its
--    writer does not exist; that is named here rather than left.
--
-- ⚠️ AND THERE IS DELIBERATELY NO REQUEST PATH TO ADD ONE LATER WITHOUT A
--    RULING. `docs/contracts/administration.openapi.yaml` draws
--    `listPartnerAccessGrants` and NO POST, and quotes the pack's reason:
--    *"There is no button here to request one, because the request is a
--    commercial and legal act between you and your customer."*
-- =====================================================================

CREATE TABLE tenant.partner_access_grant (
  tenant_id  text        NOT NULL,
  id         text        NOT NULL,
  -- Invariant 2's `P`. NOT NULL, which is what makes the FK below fail closed
  -- against a direct-sold tenant — see §1.
  partner_id text        NOT NULL,
  -- `PartnerAccessScope`: commercial_only | exceptions_read | exceptions_operate.
  -- 🛑 NO `CHECK` CONSTRAINT, for `0002_run.sql`'s reason in its own words — a
  --    third copy of a closed enum is *"a third place to drift, and the one
  --    nothing checks, because no pair in the wire-mirror addresses SQL."*
  --    0008 constrained `purpose` by JOINing it to a seeded ceiling table; there
  --    is no analogous table here and inventing one would be a fourth copy.
  --    **The constraint is at the READER**: `partnerScope()` in
  --    `server/data-plane/identity.ts` narrows this string against
  --    `PARTNER_ACCESS_SCOPES` — the exported `const` in `model/access.ts`,
  --    ITERATED rather than copied — and an unrecognised value is
  --    `value_unrecognised`, a 401. Fails closed, and a fourth scope is
  --    admitted the instant the model declares it, with nothing to forget.
  scope      text        NOT NULL,
  -- Required. `PartnerAccessGrant`: *"An open-ended grant is not a grant."*
  -- `decide()` refuses `partner_grant_expired` on it and the reader does NOT
  -- filter on it — see the reader's header.
  expires_at timestamptz NOT NULL,
  -- RETAINED RATHER THAN DELETED, like `membership.revoked_at` and
  -- `tenant_access_grant.revoked_at`, and for the same reason: a revoked grant
  -- is still a row, and deleting it would make `partner_grant_revoked` and
  -- `partner_grant_absent` the same answer. They are two refusals in
  -- `DECISION_REASONS` because a revocation is an act somebody took and an
  -- absence is not.
  revoked_at timestamptz,

  PRIMARY KEY (tenant_id, id),

  -- ═══════════════════════════════════════════════════════════════════════
  -- 🛑 INVARIANT 2's FIRST CONJUNCT, AS A CONSTRAINT.
  --
  -- `T.partnerId = P`, enforced by the database on every write, for every
  -- writer that will ever exist, including one written in a hurry by somebody
  -- who has not read this file. 0001's rule, quoted by 0008: *"a cross-tenant
  -- reference has to be UNREPRESENTABLE rather than merely unlikely."*
  --
  -- ⚠️ WHY NOT A POLICY OR A HANDLER CHECK. A `WITH CHECK` would bind only the
  --    app role, and the migrator writes fixtures; a handler check would bind
  --    only the handler that has it. This binds the MIGRATOR TOO, which is the
  --    property that matters: every `tests/` fixture that seeds a grant must
  --    first say which partner sold the tenant, so a test cannot accidentally
  --    prove the partner arm works against a shape the product forbids.
  -- ═══════════════════════════════════════════════════════════════════════
  CONSTRAINT partner_access_grant_sold_by_this_partner
    FOREIGN KEY (tenant_id, partner_id)
      REFERENCES tenant.tenant (id, partner_id) ON DELETE CASCADE,

  -- ═══════════════════════════════════════════════════════════════════════
  -- 🛑 AT MOST ONE GRANT PER TENANT, AND THIS CONSTRAINT IS WHAT KEEPS THE
  --    READER FROM DECIDING.
  --
  -- `PrincipalContext.partnerGrant` is `PartnerGrantTerms | null` — SINGULAR,
  -- by declaration. Something has to make it singular, and there are exactly
  -- three candidates:
  --
  --   (a) THIS CONSTRAINT — the database offers one row or none;
  --   (b) the READER picks one of several — REFUSED. `server/data-plane/
  --       identity.ts` opens by saying *"IT DECIDES NOTHING"*, and choosing
  --       between a revoked grant and a live one IS the decision `decide()`
  --       owns. Picking the live one is the permissive direction; picking the
  --       worst one is wrong the moment a grant is legitimately re-issued;
  --   (c) the MODEL takes a list — a change to `PrincipalContext` and to
  --       `decide()`, which is a ruling and not this slice's to take.
  --
  -- (a) is the only one of the three that adds no judgement anywhere. It is
  -- also the NARROW direction: a unique constraint can refuse a write and can
  -- never admit one, so the worst it can do is make a legitimate second grant
  -- fail loudly at insert time.
  --
  -- ⚠️ THE COST, NAMED: THERE IS NO GRANT HISTORY HERE. Re-issuing after a
  --    revocation means UPDATING this row, which overwrites the record that a
  --    previous grant existed — the same shape 0008 accepted for extension
  --    (*"the only way to extend a grant is to UPDATE that column"*). The
  --    history belongs in `tenant.audit_event` (0014), which already carries an
  --    `authorization_id` and which nothing on this path writes yet. **(c) is
  --    the ruling to take if a tenant ever needs two live grants at once; this
  --    constraint is what will make that need announce itself.**
  --
  -- ⚠️ IT IS STATED AS `(tenant_id)` RATHER THAN `(tenant_id, partner_id)`
  --    BECAUSE THE FK ABOVE ALREADY MAKES `partner_id` FUNCTIONALLY DEPENDENT
  --    ON `tenant_id`. The two-column form would read as the weaker claim while
  --    being the identical one, which is worse than either.
  -- ═══════════════════════════════════════════════════════════════════════
  CONSTRAINT partner_access_grant_one_per_tenant UNIQUE (tenant_id)
);


-- =====================================================================
-- ROW-LEVEL SECURITY.
--
-- `ENABLE` and `FORCE`, both, for 0001's argument unchanged: `ENABLE` alone
-- leaves the TABLE OWNER exempt, so a test connecting as the owner passes with
-- the policy doing nothing and passes just as well with the policy dropped.
-- `tests/db/rls-census.test.ts` enumerates every table in `tenant.` from the
-- catalogue and fails on one that carries neither.
--
-- 🛑 THE PREDICATE IS 0001's, VERBATIM, ON `USING` **AND** ON `WITH CHECK`,
--    AND THE `WITH CHECK` IS NOT DECORATION ON A `SELECT`-ONLY TABLE. 0009
--    states the rule this follows: *"the commit that grants a write here owes
--    it in the same commit as the writer."* Writing it now costs nothing and
--    means the commit that adds `INSERT` cannot ship a table whose writes are
--    unscoped — it would have to DELETE a line rather than forget to add one.
--
-- ⚠️ AND IT IS THE TENANT SCOPE, NOT A PARTNER SCOPE. A row is visible to
--    whoever holds `app.tenant_id` for the tenant it grants access TO. There is
--    no `app.partner_id` GUC and this file does not invent one: the partner
--    term is checked by `decide()` against a `partnerId` derived from
--    `orgFor(connection.owner)`, which is the ONE source §9.5 permits. A policy
--    keyed on a partner GUC would be a second source for the term this
--    repository has spent three rulings keeping single.
-- =====================================================================

ALTER TABLE tenant.partner_access_grant ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.partner_access_grant FORCE  ROW LEVEL SECURITY;

CREATE POLICY partner_access_grant_rls ON tenant.partner_access_grant
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- ---------------------------------------------------------------------
-- GRANTS. By name, because 0003 declines `ALTER DEFAULT PRIVILEGES` on this
-- schema: *"A future table created here is unreachable by the app until granted
-- BY NAME … default privileges would silently hand the request path a table
-- nobody decided to expose."*
--
-- 🛑 `SELECT` AND NOTHING ELSE. See the argument on the table above: this is
--    the one cross-tenant read path in the product, and a request path that
--    could write it could mint that path for itself in one statement. 0008
--    withheld the same three verbs on `tenant.tenant_access_grant` for the
--    weaker of the two invariants.
--
-- ⚠️ NO INDEX. The reader's `WHERE` is EMPTY — the policy is the whole
--    predicate and the unique constraint above already indexes `tenant_id`,
--    which is exactly the column the policy narrows on. A second index would be
--    the same B-tree under another name.
-- ---------------------------------------------------------------------

GRANT SELECT ON tenant.partner_access_grant TO tenant_rw;

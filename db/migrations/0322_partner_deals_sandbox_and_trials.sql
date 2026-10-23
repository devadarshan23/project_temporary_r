-- =====================================================================
-- 0322 — A PARTNER FIRM'S DEALS, ITS SANDBOX AND ITS TRIAL REQUESTS.
-- G2633–G2640 (1 Oct 2026), all DERIVED and not the owner's.
--
-- `docs/build/completion-plan.md` W5 named the first blocker on the partner
-- portal's mounts as *"A table per operation's data (deals, sandbox lifecycle,
-- invitations …)"*. `0321` gave invitations theirs; this file gives the other
-- three. G300's test is table AND model AND capability AND record: the model is
-- `model/partner-portal.ts`, the capabilities are R10's six, and the record is
-- `0320`'s third home — so the operations whose writer and reader exist mount
-- in the same commit (`server/data-plane/partner-portal.ts`).
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 EVERY TABLE HERE IS KEYED ON THE ACT'S OWN RECEIPT, NOT ON THE SESSION
--    AND NOT ON A PARTNER GUC — AND THAT IS ARGUED, BECAUSE THE BRIEF SAID
--    "PARTNER-KEYED VIA SESSION".
-- ═══════════════════════════════════════════════════════════════════════
--
-- The three keyings, each measured against the property the table holds:
--
--   SESSION-KEYED (`0250`'s, REFUSED HERE). A deal is the FIRM's, not the
--   person's: a partner user registers a claim and the partner administrator
--   must see it on the `deals` destination. Keying on `submitted_by` would hide
--   every colleague's claim — the registry would show each person their own.
--
--   PARTNER-GUC-KEYED (REFUSED, `0250`'s three costs unchanged). There is no
--   `app.partner_id` and adding one is a seventh scope helper; a GUC carrying
--   the firm is a second, copyable statement of the organisation axis.
--
--   RECEIPT-KEYED (TAKEN). `partner_id = <the firm named by the act's own
--   invariant 10 record>`, where the record is `app.authorisation_ref`'s row in
--   `partner_authorization_grant`. It is the SESSION, one hop removed: that
--   row's read policy admits only the acting session's own records, and
--   `0320`'s trigger refuses a record for a firm in which the actor holds no
--   live role carrying the verb. **So the read is per-FIRM, it exists only
--   inside an act, and it names the verb the act was allowed** — `0018`'s
--   shape, and `0321`'s, a third time. Outside an act, every table here reads
--   EMPTY under G100.
--
-- 🛑 NOTHING HERE NAMES A TENANT AND THAT IS INVARIANT 2's DEFENCE.
--    *"`partner_admin(P)` may read tenant `T` iff `T.partnerId = P`, and only
--    within a live `PartnerAccessGrant`"* is still the ONE cross-tenant path.
--    A claim is on a COMPANY that may never become a tenant; a sandbox request
--    is a request that the platform provision a plane; a trial request names a
--    registration, never a tenant. Derive the absence:
--    `grep -cE '^\s+tenant_id\s' db/migrations/0322_partner_deals_sandbox_and_trials.sql` → 0.
--
-- 🛑 NO `UPDATE` AND NO `DELETE` ANYWHERE. A partner may not move a claim's
--    standing (*"partners submit, staff approve"*), may not rewrite when it was
--    received (*"a submitter-supplied time would let a partner backdate a
--    claim"*), and may not withdraw a sandbox or trial request the platform is
--    acting on. Every write is an `INSERT`, and each `WITH CHECK` pins the
--    columns a submitter could otherwise choose: `standing = 'waiting'`,
--    `received_at = now()`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- §1 · DEAL REGISTRATION — `listDealRegistrations`, `submitDealRegistration`.
-- ---------------------------------------------------------------------
CREATE TABLE tenant.deal_registration (
  id               text        NOT NULL PRIMARY KEY,
  partner_id       text        NOT NULL,
  -- `deal` or `customer_claim`. Bare `text`, `0007`/`0069`'s polarity; the
  -- shape rule is `checkDealRegistrationShape()`'s and the reader refuses an
  -- unknown member by name.
  shape            text        NOT NULL,
  -- Counterparty-authored, stored VERBATIM, parsed by nothing.
  company          text        NOT NULL,
  -- THE KEY PRECEDENCE IS DECIDED ON, generated from the SAME rule as
  -- `normaliseCompany()` — whitespace runs collapsed, ends trimmed, ASCII
  -- letters lowered — so the database and the model cannot hold two
  -- normalisations. `tests/db/partner-deals.test.ts` §3b asserts they agree.
  --
  -- 🛑 `COLLATE "C"` IS LOAD-BEARING (G2636), AND §3b FOUND IT: `lower()`
  --    follows the column's collation, so the same expression lowercased `Ü`
  --    on an `en_US` cluster and left it alone on this repository's `C` one —
  --    while JavaScript's `toLowerCase()` lowercased it everywhere. A
  --    precedence key that depends on which cluster it runs on is two keys.
  --    Pinning the collation makes the rule ASCII-only on BOTH sides, and the
  --    cost is named: `Ünïcode` and `ünïcode` are two companies to the index.
  --    ⚠️ AND THE WHITESPACE CLASS IS SPELLED OUT FOR THE SAME REASON: §3b
  --    found `\s` disagreeing too — JavaScript's matches a no-break space and
  --    a `C`-collated ARE's does not — so both sides name the six ASCII
  --    characters rather than trusting either engine's `\s`.
  company_key      text        GENERATED ALWAYS AS (
                                 lower(btrim(regexp_replace(company COLLATE "C", '[ \t\n\r\f\v]+', ' ', 'g'), ' '))
                               ) STORED,
  -- ⚠️ A DECIMAL STRING WITH NO CURRENCY AND NO EXPONENT — `DecimalAmount` on
  --    the wire. NOT `Money`, so G111's codec has nothing to apply; stored
  --    verbatim, computed on by nothing, and returned by no operation.
  annual_value     text,
  expected_close   text,
  contact          text,
  rationale        text,
  resale_scope     text[],
  submitted_by     text        NOT NULL,
  -- AUTHORITATIVE, AND OURS. Pinned to `now()` by the write policy.
  received_at      timestamptz NOT NULL,
  standing         text        NOT NULL,
  -- *"What dormancy is computed from."* No writer yet — staff activity on a
  -- claim is `acceptRegistration`'s, declared and unmounted — so NULL on every
  -- row a request path can write, and the wire field is optional.
  last_activity_at timestamptz,

  -- The target of `trial_tenant_request`'s composite key: a trial can only
  -- name a registration of its OWN firm.
  UNIQUE (id, partner_id)
);

-- 🛑 ONE STANDING CLAIM PER COMPANY, ACROSS EVERY FIRM — G2635.
--    The contract's 422 reads *"a company on which a claim already stands"*,
--    so the refusal is already declared; this index is what makes it TRUE
--    under a race rather than a `SELECT`-then-`INSERT` that two partners can
--    both pass. ⚠️ TWO THINGS IT DOES THAT ARE NAMED RATHER THAN HIDDEN:
--    (1) it decides P9.4's open question — *"first to register, or first to
--        bring the meeting"* — as FIRST TO REGISTER, by `received_at`'s order
--        of commit. The contract had already taken that by declaring the 422;
--        a different precedence rule is an owner's ruling and a new index.
--    (2) it is a cross-firm EXISTENCE signal: a unique index is not subject to
--        RLS, so a 422 tells a partner that SOME firm holds a claim. It never
--        says which — no response shape has a field for the rival — and the
--        contract accepts the signal in its own words: *"We are not telling
--        you whose."* `refused` releases the company; `dormant` does not
--        (*"A claim does not expire"*).
CREATE UNIQUE INDEX deal_registration_one_standing_claim_per_company
  ON tenant.deal_registration (company_key)
  WHERE standing <> 'refused';

CREATE INDEX deal_registration_firm_idx ON tenant.deal_registration (partner_id, received_at DESC);

-- ---------------------------------------------------------------------
-- §2 · THE SANDBOX'S LIFECYCLE — `getSandboxTenant`. ONE ROW PER FIRM, and
--      the request path may only READ it: provisioning is a DEPLOYMENT into
--      the partner's own AWS account (G276), performed by the platform under
--      `provision_substrate`. That writer is OWED; until it exists every firm's
--      answer is `none`, which the contract calls *"a live answer and not a
--      404"*. No `monthly_wholesale`: commercial, optional on the wire, and a
--      column ahead of its writer (`0004`).
-- ---------------------------------------------------------------------
CREATE TABLE tenant.partner_sandbox (
  partner_id     text        NOT NULL PRIMARY KEY,
  standing       text        NOT NULL,
  seed_version   text,
  next_reset_at  timestamptz,
  aws_account_id text,
  residency      text
);

-- ---------------------------------------------------------------------
-- §3 · THE SANDBOX REQUEST — `requestSandboxTenant`. 202, *"because nothing
--      exists when this returns"*. ONE PER FIRM, EVER, until a closing writer
--      exists: `UNIQUE (partner_id)` is the contract's 409 *"a sandbox already
--      stands. One per partner"* made true under a race, and the cost is
--      named — a firm that hands its sandbox back cannot ask again until the
--      platform's lifecycle writer closes the request.
-- ---------------------------------------------------------------------
CREATE TABLE tenant.partner_sandbox_request (
  id           text        NOT NULL PRIMARY KEY,
  partner_id   text        NOT NULL UNIQUE,
  requested_by text        NOT NULL,
  requested_at timestamptz NOT NULL
);

-- ---------------------------------------------------------------------
-- §4 · THE TRIAL TENANT REQUEST — `requestTrialTenant`. *"Attribution runs
--      through an accepted registration"*: the composite foreign key makes a
--      request naming ANOTHER firm's registration unrepresentable, and the
--      write policy requires the registration to be `accepted`.
--      ⚠️ NOT MOUNTED (G2639): nothing on any request path writes `accepted`,
--      so the operation's only reachable answer is its own 422 — G359's
--      reason for not mounting `reverseResolution`, read the same way.
-- ---------------------------------------------------------------------
CREATE TABLE tenant.trial_tenant_request (
  id              text        NOT NULL PRIMARY KEY,
  partner_id      text        NOT NULL,
  registration_id text        NOT NULL,
  note            text,
  requested_by    text        NOT NULL,
  requested_at    timestamptz NOT NULL,

  FOREIGN KEY (registration_id, partner_id)
    REFERENCES tenant.deal_registration (id, partner_id)
);

-- ---------------------------------------------------------------------
-- ROW-LEVEL SECURITY. `ENABLE` and `FORCE`, both, on all four.
-- ---------------------------------------------------------------------
ALTER TABLE tenant.deal_registration       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.deal_registration       FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.partner_sandbox         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.partner_sandbox         FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.partner_sandbox_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.partner_sandbox_request FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.trial_tenant_request    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.trial_tenant_request    FORCE  ROW LEVEL SECURITY;

-- ⚠️ THE READ POLICIES NAME THE WRITE VERB TOO, and it is not a widening: an
--    `INSERT … RETURNING` is checked against the SELECT policies as well, so a
--    registration a `register_deal` act just wrote must be readable in that
--    act — and a partner user who may register may already list (`USER_VERBS`
--    holds both). The firm is the receipt's in every arm.
CREATE POLICY deal_registration_read_rls ON tenant.deal_registration
  FOR SELECT
  USING (
    partner_id = (
      SELECT g.partner_id
        FROM tenant.partner_authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.capability IN ('view_deals', 'register_deal')
         AND g.expires_at > now()
    )
  );

CREATE POLICY deal_registration_write_rls ON tenant.deal_registration
  FOR INSERT
  WITH CHECK (
    submitted_by = (
      SELECT s.user_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
    AND partner_id = (
      SELECT g.partner_id
        FROM tenant.partner_authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.capability = 'register_deal'
         AND g.expires_at > now()
    )
    -- *"partners submit, staff approve"* — a partner cannot write a claim
    -- that is already accepted, nor one with a history it did not have.
    AND standing = 'waiting'
    AND last_activity_at IS NULL
    -- *"Precedence is decided on this value"*: not the submitter's to choose.
    AND received_at = now()
  );

CREATE POLICY partner_sandbox_read_rls ON tenant.partner_sandbox
  FOR SELECT
  USING (
    partner_id = (
      SELECT g.partner_id
        FROM tenant.partner_authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.capability IN ('view_sandbox', 'operate_sandbox')
         AND g.expires_at > now()
    )
  );

CREATE POLICY partner_sandbox_request_read_rls ON tenant.partner_sandbox_request
  FOR SELECT
  USING (
    partner_id = (
      SELECT g.partner_id
        FROM tenant.partner_authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.capability IN ('view_sandbox', 'operate_sandbox')
         AND g.expires_at > now()
    )
  );

CREATE POLICY partner_sandbox_request_write_rls ON tenant.partner_sandbox_request
  FOR INSERT
  WITH CHECK (
    requested_by = (
      SELECT s.user_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
    AND partner_id = (
      SELECT g.partner_id
        FROM tenant.partner_authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.capability = 'operate_sandbox'
         AND g.expires_at > now()
    )
    AND requested_at = now()
  );

CREATE POLICY trial_tenant_request_read_rls ON tenant.trial_tenant_request
  FOR SELECT
  USING (
    partner_id = (
      SELECT g.partner_id
        FROM tenant.partner_authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.capability IN ('view_deals', 'register_deal')
         AND g.expires_at > now()
    )
  );

CREATE POLICY trial_tenant_request_write_rls ON tenant.trial_tenant_request
  FOR INSERT
  WITH CHECK (
    requested_by = (
      SELECT s.user_id
        FROM tenant.session s
       WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
    )
    AND partner_id = (
      SELECT g.partner_id
        FROM tenant.partner_authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.capability = 'register_deal'
         AND g.expires_at > now()
    )
    AND requested_at = now()
    -- *"your accepted registration attributes it to you"* — accepted, and
    -- visible, which under the read policy above means this firm's.
    AND EXISTS (
      SELECT 1
        FROM tenant.deal_registration d
       WHERE d.id         = trial_tenant_request.registration_id
         AND d.partner_id = trial_tenant_request.partner_id
         AND d.standing   = 'accepted'
    )
  );

-- ---------------------------------------------------------------------
-- GRANTS — by name (`0003` declines default privileges). Each `INSERT` lands
-- with its writer in `server/data-plane/partner-portal-store.ts`, this commit
-- (G511). `partner_sandbox` is `SELECT` alone: its writer is the platform's.
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT ON tenant.deal_registration       TO tenant_rw;
GRANT SELECT         ON tenant.partner_sandbox         TO tenant_rw;
GRANT SELECT, INSERT ON tenant.partner_sandbox_request TO tenant_rw;
GRANT SELECT, INSERT ON tenant.trial_tenant_request    TO tenant_rw;

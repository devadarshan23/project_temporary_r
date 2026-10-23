-- =====================================================================
-- 0560 · A TENANT DECLARES ITS REPORTING CURRENCY — G4046, THE OWNER'S
--        RULING (4 Oct 2026): *"Declare tenant currency."* Applied as G4101–
--        G4110 (derived).
--
--   The question (#587, C3-25's first half): C1 draws the tenant chip as
--   `SG · SGD`; the tree drew `US` alone because *"nothing serves a tenant
--   currency"* (G3473). The owner took option (a) — a DECLARED tenant
--   reporting currency, ISO 4217 — over (b) the page's own money currency,
--   which is page-local and wrong for a multi-currency tenant.
--
-- 🛑 §0 · WHERE IT LIVES, AND THE TWO PLACES IT DOES NOT (G4102).
--
--   (1) `tenancy_roster` in the CONTROL database — where the tenant's NAME
--       lives — is REFUSED, and the refusal is G185(d)'s own column list
--       rather than a preference: *"The control-owned row may carry ONLY
--       identification and placement — `id`, `name`, `account_id`, `status`,
--       `residency`, `created_at` … No reconciliation content … no derived
--       figures may ever join it."* A reporting currency is neither an
--       identification nor a placement: it is how a tenant's OWN figures are
--       to be reported, and its future readers — FX normalisation, the
--       disposition mix's absent `valueAtRisk` (G954), the C8 meter — are all
--       on the DATA plane, inside the tenant's region. Putting it control-side
--       would make each of those a cross-plane read for a fact about how
--       tenant data is presented, which is invariant 3's neighbourhood
--       (*"the control plane publishes downward and never reads tenant
--       data"*) arrived at from the other side.
--
--   (2) A column on `tenant.tenant` is REFUSED. That table is G185(d)'s
--       *"narrow data-plane PROJECTION of `id`, `status`, `residency`"* of a
--       control-owned row — `0006` widened it only with two control-owned
--       facts, and said so. A tenant's own configuration is not a projection
--       of the registry, and a column there would blur the one table whose
--       column list G185 asks us to keep narrow.
--
--   (3) TAKEN: its own data-plane table, keyed on the tenant, under `0001`'s
--       predicate VERBATIM. One row per tenant (the PRIMARY KEY), and the
--       absence of a row is a FACT — *"this tenant has declared no reporting
--       currency"* — not a gap to be filled.
--
-- 🛑 §1 · NO DEFAULT, AND NO BACKFILL (G4103). `currency` is `NOT NULL` with
--   no `DEFAULT`, and no row is inserted for any existing tenant. A default of
--   `SGD` — or the residency's "home" currency — would be this repository
--   INVENTING a declaration nobody made, which is `0470` §3's refusal one
--   table over (*"the codec supplying a denomination nobody declared"*). A
--   tenant with no row is served `reportingCurrency: null` and the chip draws
--   no currency at all, exactly as it did before this file. OMITTED, not
--   refused: refusing would make the chrome's who-am-I a 500 for every tenant
--   that has not yet declared — a denial of service written as a safety
--   check — while omitting asserts nothing false.
--
-- ⚠️ §2 · A SHAPE CHECK, NOT A MEMBERSHIP CHECK. `currency ~ '^[A-Z]{3}$'` is
--   the shape the contract's pattern publishes (`administration.openapi.yaml`
--   already uses it). It is NOT a list of ISO 4217 members: `model/money.ts`
--   says `MoneyUnit.currency` is *"checked as STATED, never as a member"*, and
--   there is no currency table anywhere in `model/`. `0007`'s polarity —
--   *"an UNKNOWN value must reach the model as a refusal, not be rejected at
--   write time by a list somebody forgot to extend"* — is about vocabularies;
--   a three-letter shape is not one, and a lower-case or empty value is
--   malformed rather than unknown. The reader re-checks the shape anyway
--   (`server/data-plane/session-principal.ts`), because a CHECK can be
--   dropped by a later migration and the reader is the half that publishes.
--
-- 🛑 §3 · `SELECT` AND NOTHING ELSE (G4104). No operation on any tier
--   declares a tenant's currency, so a `GRANT INSERT` would be `0004`'s
--   *"write privilege ahead of its writer"*. The writer is owed — a tenant
--   settings surface, gated on a capability nobody has minted for it — and
--   until then a row arrives by MIGRATOR: the staging seed
--   (`db/seeds/staging-demo-data.sql`, through its generator, and
--   `db/seeds/staging-mock-personas.sql`) declares `SGD` for the demo and
--   mock tenants, which is the owner's *"Staging demo seed: SGD"*.
--   A path that could write here could change how every figure in a tenant
--   is reported; G511's *"the fence and the writer are one commit or
--   neither"* binds the commit that adds one.
--
-- ⚠️ §4 · NO FOREIGN KEY FROM ANYTHING INTO IT, and its own FK points at the
--   projection (`tenant.tenant`), as `tenant_contact`'s does after `0003`.
-- =====================================================================

CREATE TABLE tenant.tenant_reporting_currency (
  tenant_id   text PRIMARY KEY REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  currency    text NOT NULL,
  CONSTRAINT tenant_reporting_currency_is_iso_shaped CHECK (currency ~ '^[A-Z]{3}$')
);

ALTER TABLE tenant.tenant_reporting_currency ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.tenant_reporting_currency FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_reporting_currency_rls ON tenant.tenant_reporting_currency
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

GRANT SELECT ON tenant.tenant_reporting_currency TO tenant_rw;

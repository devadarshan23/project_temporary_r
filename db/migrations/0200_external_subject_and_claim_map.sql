-- =====================================================================
-- 0200 — THE EXTERNAL SUBJECT, THE CLAIM MAP, AND THE FIRST WRITE PRIVILEGE
--        THIS SCHEMA HAS EVER GRANTED ON A PERSON. W3-S1, G1631–G1637,
--        21 Sep 2026.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 READ THE GRANT FIRST. IT IS THE LARGEST WRITE PRIVILEGE IN THIS
--    DIRECTORY AND EVERYTHING ELSE IN THIS FILE EXISTS TO FENCE IT.
-- ═══════════════════════════════════════════════════════════════════════
--
-- `db/migrations/0009_identity_substrate.sql` gave the app role `SELECT` and
-- nothing else on **all eight** identity tables, and argued it in one
-- sentence about a different table:
--
--     "a request path that could write `role_assignment` could grant itself
--      any capability in the closed set, and `decide()` would then permit it
--      CORRECTLY."
--
-- ⚠️ THAT ARGUMENT IS ABOUT `role_assignment` AND IT IS NOT ABOUT `user`, SO
--    IT DOES NOT AUTOMATICALLY REFUSE THIS — **AND NOTHING IN `0009`
--    LICENSES IT EITHER.** A person is not a capability; but a path that can
--    mint a person is a path that can mint the SUBJECT every later control is
--    asked about. This file does not reason from `0009`'s silence. The owner
--    took the ruling; this file's job is to make the fence the interesting
--    part.
--
-- RULINGS THIS APPLIES (docs/HANDOFF.md §3):
--   G1631  **THE OWNER'S, 21 Sep 2026 (R5).** *"A person is AUTO-PROVISIONED
--          ON FIRST SIGN-IN."* This is the `GRANT INSERT` half. The writer is
--          `server/data-plane/session-mint-store.ts` and lands in the SAME
--          COMMIT — G511, *"the fence and the writer are one commit or
--          neither"* — because a write privilege ahead of its writer is
--          `0004_subject_ledger.sql`'s refusal, restated by `0005` for
--          `tenant.membership` and by `0013` for `tenant.sign_in_attempt`
--          fourteen lines from the foot of that file.
--   G1632  **THE OWNER'S, 21 Sep 2026 (R6).** *"The claim map is
--          PER-CONNECTION, as TYPED COLUMNS … never a `jsonb` column."*
--          §3 below.
--   G1633  DERIVED, NOT THE OWNER'S — **a policy on `tenant."user"` may not
--          READ `tenant.identity_connection`, measured; so the door test is a
--          COMPOSITE FOREIGN KEY plus own-row columns, and the restrictive
--          fence carries `WITH CHECK` and **no `USING`**. Two absences, two
--          separate measurements — (e) and (c). §2, §5 and §6.
--   G1634  DERIVED, NOT THE OWNER'S — the subject is unique PER CONNECTION,
--          which DERIVES the per-issuer scoping instead of restating it, and
--          is STRONGER than the literal spelling §2 now makes available. §3.
--   G1635  DERIVED, NOT THE OWNER'S — a FIFTH GUC, because a door is not a
--          person. `db/signin-scope.ts`.
--   G1636  DERIVED, NOT THE OWNER'S — every column added here is NULLABLE and
--          an absent claim name is a REFUSAL rather than a fall-back to the
--          OIDC standard name. §1 and §4.
--   G1637  DERIVED, NOT THE OWNER'S — the writer PROVISIONS and MINTS in one
--          transaction and is reached by NO ROUTE.
--          `server/data-plane/session-mint-store.ts`.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 WHAT WAS MEASURED AGAINST A LIVE POSTGRESQL. FIVE FACTS, AND TWO OF
--    THEM CHANGED THE DESIGN — (e) REWROTE HALF THE FILE.
-- ═══════════════════════════════════════════════════════════════════════
--
--   (a) THE APP ROLE CANNOT MINT A PERSON TODAY, AND THE REFUSAL IS THE
--       GRANT AND NOT THE POLICY. An `INSERT INTO tenant."user"` inside
--       `withSignInScope()` answers:
--
--           permission denied for table user
--
--       — not a row-level-security refusal. So every policy below is
--       currently unreachable and this file's `GRANT` is what makes them
--       load-bearing. `tests/db/external-subject-and-claim-map.test.ts` §0
--       keeps that ordering observable.
--
--   (b) A SIGN-IN SCOPE SEES **ZERO** PERSONS TODAY. `SELECT id FROM
--       tenant."user"` inside `withSignInScope()` returns `[]`, because
--       `0009`'s `user_rls` resolves a person THROUGH the session and
--       `app.session_ref` names no row yet. **That is `0013`'s deadlock
--       arriving one table over**: you need a person to mint a session and a
--       session to read a person. §4 is the same repair `0013` made for the
--       door, and it is made here for the same reason.
--
--   (c) 🛑 **A `RESTRICTIVE … FOR ALL` POLICY CARRYING A `USING` NARROWS
--       `SELECT`, AND ON THIS TABLE THAT DESTROYS THE SESSION PATH.**
--       Measured NON-VACUOUSLY — in a session scope where the read really
--       returns a row, because the first attempt to measure it ran in a
--       sign-in scope, where fact (b) means the read is `[]` before and after
--       and the probe proves nothing (§5.6, caught in the probe rather than
--       in review):
--
--           baseline, session scope                      -> [usr_acme_mei]
--           + RESTRICTIVE FOR ALL USING (false)          -> []
--           + RESTRICTIVE FOR ALL WITH CHECK (false)     -> [usr_acme_mei]
--
--       **So the absent `USING` in §5 is not tidiness — it is the difference
--       between a fence and an outage.** A `USING` there would AND this
--       policy's test into every read `resolveSubject()` makes on every
--       request, in a session scope where no broker GUC is set.
--
--   (d) `ADD COLUMN … NOT NULL` WITH NO DEFAULT REFUSES AGAINST A POPULATED
--       TABLE — witnessed, `column "…" of relation "user" contains null
--       values`. See §1 for what that costs here, which is not nothing.
--
--   (e) 🛑 **AND THE ONE THAT REWROTE THIS FILE: A POLICY ON `tenant."user"`
--       MAY NOT READ `tenant.identity_connection` AT ALL.** A first draft of
--       §4 and §5 resolved the door with
--       `connection_id = (SELECT c.id FROM tenant.identity_connection c WHERE
--       <pair matches the GUCs>)`, and **every arm of the probe — eleven of
--       eleven, reads and writes alike — answered:**
--
--           infinite recursion detected in policy for relation "user"
--
--       **The cycle is not self-reference and that is why it was not
--       predicted.** `0018_administrative_directory.sql`'s
--       `identity_connection_directory_rls` ends `AND (id IN (SELECT
--       u.connection_id FROM tenant."user" u))` — so `user` -> subquery on
--       `identity_connection` -> that policy -> subquery on `user` closes the
--       loop through a SECOND TABLE. ⚠️ **AND IT IS STRUCTURAL RATHER THAN
--       CONDITIONAL**: that policy's leading `EXISTS` is false whenever
--       `app.authorisation_ref` names no live `manage_roles` grant, which is
--       every sign-in — and PostgreSQL still refused, because the recursion is
--       found while the expression is EXPANDED and not while it is evaluated.
--
--       🛑 **THAT IS `0020`'s RECURSION CLASS, REACHED THROUGH A TABLE NOBODY
--       WAS LOOKING AT. THE FIRST DRAFT OF THIS VERY FILE ASSERTED THE
--       OPPOSITE IN ITS OWN §5** — *"this policy's subquery reads
--       `tenant.identity_connection`, not `tenant."user"`, so there is no
--       self-reference and 0020's recursion never arises"* — **and the
--       database refused it on the first run.** G449 measured that a `WITH
--       CHECK` subquerying its OWN table does not recurse; nobody had measured
--       the two-table cycle, and the lesson is that *"does this policy name its
--       own table"* is a LANDMARK and the property is *"is this relation
--       reachable from its own policy expansion"* — §5.1, inside the argument
--       written to avoid §5.1.
--
--       **The repair is §2's composite FOREIGN KEY: the door test reads the
--       row's OWN columns and the GUCs, and never another relation.**
--
-- ⚠️ THIS FILE MOUNTS NOTHING AND DECLARES NO OPERATION. Derive the served
--    set, never read it: `grep -rn 'handlers:' server/*/start.ts`.
-- =====================================================================


-- ---------------------------------------------------------------------
-- §1 — THE EXTERNAL SUBJECT. ONE COLUMN, NULLABLE, AND THE NULLABILITY IS
--      ARGUED RATHER THAN DEFAULTED INTO (G1636).
--
-- This is the claim that says WHICH PERSON a verified token is about — an
-- OIDC `sub` in the ordinary case. It is stored so that the SECOND sign-in
-- finds the person the FIRST one provisioned; without it R5's
-- auto-provisioning has no idempotency and every sign-in mints a new person.
--
-- 🛑 NULLABLE, AND `NOT NULL` IS REFUSED ON THE MERITS RATHER THAN ON THE
--    COST. A person created by any path that is not a federated sign-in has
--    no external subject and there is nothing truthful to put in the column:
--    `server/dev/identity-seed.ts` writes two, and roughly twenty fixtures
--    under `tests/` write their own, all as the migrator. `NOT NULL` would
--    force every one of them to INVENT a subject, which is the
--    "defaulting is inventing" refusal `0012` makes for an unmapped payload
--    key and G106 makes for an unclassified field. **A column whose value
--    some writers must fabricate is a column that lies about those writers.**
--
-- ⚠️ AND THE COST OF THE OTHER CHOICE WAS MEASURED, NOT ASSUMED — see (d).
--    `ADD COLUMN … NOT NULL` with no default REFUSES against a table holding
--    a row, and `tenant."user"` holds rows the moment the dev seed or any
--    fixture has run. It would apply cleanly against a freshly migrated
--    database and refuse against every database anybody has used, which is
--    the worst of the two: green in CI, red on the machine that matters.
--    **No migration in this directory inserts into `tenant."user"`** —
--    derive it, never read it:
--    `grep -lE '^[^-]*INSERT INTO tenant."user"' db/migrations/*.sql`
--    -> nothing. (G2181: the unanchored form named THIS file, because of
--    this line.)
--
-- ⚠️ NO `CHECK` ON THE VALUE, deliberately, and it is `0007`'s and `0069`'s
--    stated polarity: an UNKNOWN value must reach the model as an
--    `*_unreadable` refusal, never be rejected at write time by a list
--    somebody forgot to extend. A `sub` is whatever the broker mints.
-- ---------------------------------------------------------------------

ALTER TABLE tenant."user" ADD COLUMN external_subject text;


-- ---------------------------------------------------------------------
-- §2 — THE DOOR, CARRIED ON THE PERSON AND BOUND BY A COMPOSITE FOREIGN
--      KEY (G1633). **THIS IS THE REPAIR MEASUREMENT (e) FORCED, AND IT IS
--      THE MOST IMPORTANT BLOCK IN THE FILE.**
--
-- §4 and §5 have to answer ONE question — *is this person's door the door
-- the callback arrived through?* — and measurement (e) proves they may not
-- answer it by READING `tenant.identity_connection`, at any price, because
-- `0018`'s `identity_connection_directory_rls` reads `tenant."user"` back and
-- PostgreSQL refuses the cycle while expanding it.
--
-- 🛑 SO THE PAIR IS CARRIED ON THE ROW, AND THE FOREIGN KEY IS WHAT MAKES
--    THAT A PROJECTION RATHER THAN A SECOND HOME. This is
--    `0039_partner_access_grant.sql`'s shape exactly, and G576's sentence is
--    the precedent in its own words: the composite FK makes the disagreeing
--    row **UNREPRESENTABLE rather than refused**, *"and the FK binds the
--    MIGRATOR too, so no `tests/` fixture can prove the arm against a shape
--    the product forbids."*
--
--    `(connection_id, broker_issuer, broker_ref)` must be a real triple on
--    `tenant.identity_connection`. A person cannot carry Acme's broker pair
--    and Globex's `connection_id`: there is no such row to reference.
--
-- ⚠️ THE AUTHORITY IS STILL `connection_id` AND THESE TWO COLUMNS ARE NOT IT.
--    `orgFor(connection.owner)` reads the CONNECTION, as `0009` requires, and
--    nothing derives an organisation, a tenant or a role from these two
--    columns. They exist so that a POLICY can ask the door question without
--    leaving the row. **A reader who starts treating them as the door has
--    reintroduced the second home the FK exists to prevent.**
--
-- 🛑 MATCH SIMPLE IS WHY THIS IS SAFE AGAINST EVERY ROW THAT ALREADY EXISTS,
--    and it is the same clause `0039` leans on from the other side: **if ANY
--    referencing column is NULL the constraint is not checked at all.** A
--    seeded person carries NULL in both, so the FK never fires for them —
--    and this migration therefore does NOT retroactively demand that every
--    existing person's `connection_id` resolve, which would have been a
--    change to `0009`'s semantics smuggled in as a repair.
--
-- ⚠️ THE FK TARGET IS A NEW UNIQUE CONSTRAINT AND IT HAD TO BE. `0011`'s
--    broker uniqueness is a PARTIAL unique INDEX
--    (`… WHERE broker_ref IS NOT NULL`) and PostgreSQL will not reference a
--    partial index, so `(id, broker_issuer, broker_ref)` gets its own
--    constraint. It is trivially satisfied — `id` is already the primary key
--    — and it adds no rule: it exists to be pointed at.
--
-- 🛑 AND `0011`'s INDEX IS STILL LOAD-BEARING, WHICH IS WHAT MAKES THE DOOR
--    TEST EXACT RATHER THAN MERELY CONSISTENT. The policy pins the PAIR to
--    the scope's GUCs; the FK pins `connection_id` to a row carrying that
--    pair; and `identity_connection_broker_handle_uniq` makes AT MOST ONE row
--    carry it. Three database objects, no subquery, and the door is
--    determined. **Delete `0011`'s index and this fence degrades silently**,
--    which is why `tests/db/external-subject-and-claim-map.test.ts` §5c
--    asserts it is still there.
-- ---------------------------------------------------------------------

ALTER TABLE tenant."user" ADD COLUMN broker_issuer text;
ALTER TABLE tenant."user" ADD COLUMN broker_ref    text;

ALTER TABLE tenant.identity_connection
  ADD CONSTRAINT identity_connection_id_broker_handle_uniq
  UNIQUE (id, broker_issuer, broker_ref);

ALTER TABLE tenant."user"
  ADD CONSTRAINT user_door_matches_broker_handle
  FOREIGN KEY (connection_id, broker_issuer, broker_ref)
  REFERENCES tenant.identity_connection (id, broker_issuer, broker_ref);


-- ---------------------------------------------------------------------
-- §3 — THE SUBJECT IS UNIQUE **PER CONNECTION**, AND THAT DERIVES THE
--      PER-ISSUER RULE INSTEAD OF RESTATING IT (G1634).
--
-- `0011_federated_connection.sql` made the broker handle a PAIR and said why:
-- *"a Cognito provider name is unique WITHIN ONE POOL and nowhere else"*, and
-- a colliding handle *"resolves to the wrong `owner` and therefore the wrong
-- `orgClass`"*. **The same reasoning applies one level down and it is sharper:
-- a `sub` is unique within an ISSUER and nowhere else.** Two brokers can and
-- do mint the same `sub` string; treating one as a global key would let a
-- person at one customer's IdP resolve to a person at another's.
--
-- 🛑 SO WHY IS THE INDEX NOT `(broker_issuer, broker_ref, external_subject)`,
--    WHICH IS WHAT THE RULE LITERALLY SAYS — ESPECIALLY NOW THAT §2 PUTS
--    THOSE TWO COLUMNS ON THIS TABLE AND MAKES IT EXPRESSIBLE? **Because
--    `(connection_id, external_subject)` IMPLIES IT AND IS STRICTLY
--    STRONGER**, and choosing the weaker spelling because it reads like the
--    sentence would be the landmark-over-property mistake twice in one file.
--
--    The derivation is exact rather than approximate. `0011` carries a
--    PARTIAL UNIQUE INDEX on `(broker_issuer, broker_ref)`, so a broker pair
--    names **at most one** connection; therefore two rows agreeing on
--    `(broker_issuer, broker_ref, external_subject)` necessarily agree on
--    `connection_id`, and this index refuses them. And it bites in a case the
--    literal spelling cannot reach at all: a NON-BROKERED connection carries
--    NULL in both broker columns (G305), so the literal index would be
--    VACUOUS on every one of them while this one still holds.
--
-- ⚠️ PARTIAL, `WHERE external_subject IS NOT NULL`, and it has to be: §1
--    leaves the column nullable and every seeded person carries NULL. A
--    total unique index would be satisfied anyway — PostgreSQL treats NULLs
--    as distinct — so the `WHERE` buys no correctness here; it buys a SMALLER
--    index and, more usefully, it states on the index's own face that a NULL
--    subject is outside the rule rather than an unnoticed hole in it.
--    (`NULLS NOT DISTINCT` is PostgreSQL 15; `0150` records that the local
--    database is 14, so it is not available regardless.)
-- ---------------------------------------------------------------------

CREATE UNIQUE INDEX user_external_subject_per_connection
  ON tenant."user" (connection_id, external_subject)
  WHERE external_subject IS NOT NULL;


-- ---------------------------------------------------------------------
-- §4 — THE CLAIM MAP. **TWO** TYPED COLUMNS, PER CONNECTION, AND NOT A
--      `jsonb` (G1632 — THE OWNER'S).
--
-- The owner's ruling, quoted rather than paraphrased:
--
--     "The claim map is PER-CONNECTION, as TYPED COLUMNS on
--      `tenant.identity_connection` (`email_claim`, `name_claim` or
--      equivalent), never a `jsonb` column."
--
-- 🛑 IT IS PER-CONNECTION BECAUSE OF BYOA, AND THAT IS THE WHOLE REASON A
--    PLATFORM CONSTANT WILL NOT DO. G276 puts the pool in the CUSTOMER's
--    account, **where we do not control the claim names.** A single global
--    map would be correct for every door we provisioned and silently wrong
--    for every door a customer did.
--
-- 🛑 THIS OVERTURNS A REFUSAL `0011` MADE BY NAME, AND IT SAYS SO HERE RATHER
--    THAN THERE. G306 refused `audience`, `jwks_uri`, **`claim_map`**,
--    `attribute_mapping` and `enabled_at` on `0011`'s face, each *"because
--    nothing here verifies a token and a column ahead of its reader is
--    0004's refusal"*. **The premise has changed on both halves**: a verifier
--    exists (`server/data-plane/token-verify.ts`, G976) and a READER lands in
--    this commit (`server/data-plane/session-mint-store.ts`). `0011` IS NOT
--    EDITED — `0035`'s statement of the rule: *"G88 makes migrations
--    forward-only … it keeps its refusal on its face and this file keeps the
--    correction on its own."* The other four of G306's five refusals STAND.
--
-- ⚠️ A `jsonb` MAP IS THE REJECTED ALTERNATIVE AND IT IS PRESERVED HERE. It
--    is refused on `0007`'s ground and on G306's own words — that ruling
--    called a `jsonb` claim map *"that ruling taken by a migration,
--    quietly"*. Typed columns pay the cost at a COMPILE ERROR and at a
--    migration, where it is visible, rather than at a key nobody declared.
--    **Cost accepted and named: a migration per new claim.**
--
-- 🛑 NULLABLE, AND AN ABSENT CLAIM NAME IS A **REFUSAL** RATHER THAN A
--    FALL-BACK TO `sub`/`email`/`name` (G1636). The OIDC standard names are
--    the obvious defaults and they are refused: a default that is right for
--    every door we provisioned and wrong for a BYOA door **maps the wrong
--    claim silently**, which is scope failing OPEN — the failure `0012` and
--    G106 both refuse by name. A door with no declared map cannot provision
--    anybody, and the reader answers `connection_claim_map_absent`. That is
--    `0069`'s polarity applied to a NAME instead of to a value.
--
-- ⚠️ SO EVERY EXISTING CONNECTION ROW IS UNPROVISIONABLE UNTIL AN OPERATOR
--    DECLARES ITS MAP, AND THAT IS THE INTENDED STATE rather than an
--    oversight: nothing has declared one, because until this commit there was
--    nowhere to declare it.
--
-- ⚠️ NO `CHECK` ON EITHER — `0007`'s polarity again. A claim name is whatever
--    the broker emits.
--
-- 🛑 **AND THERE IS NO `subject_claim`, WHICH IS THE ONE PLACE THIS FILE
--    DEPARTS FROM ITS OWN FIRST DRAFT ON A SECURITY ARGUMENT RATHER THAN A
--    MEASUREMENT.** A third column was written and removed. The owner's
--    ruling names *"`email_claim`, `name_claim` or equivalent"* and does NOT
--    name the subject, and three things say it must not be mapped:
--
--      · **IT IS THE SCOPE'S LOOKUP KEY, SO IT IS NEEDED BEFORE THE
--        TRANSACTION OPENS.** `app.external_subject` is set by
--        `withSignInScope()` at `BEGIN`; a claim-mapped subject could only be
--        computed AFTER reading the connection, which is a statement inside
--        that same transaction. **The ordering is impossible, not merely
--        awkward** — and the repair (re-`set_config` mid-transaction) would
--        put a second place the GUC is set, which is §5.3.
--      · **IT MUST BE IMMUTABLE AND AN OPERATOR COULD POINT IT AT `email`.**
--        A subject mapped to a mutable claim makes an ACCOUNT REASSIGNABLE:
--        whoever next controls that address becomes that person. `sub` is the
--        one claim OIDC requires to be stable and never re-issued.
--      · `email` and `display_name` are DESCRIPTIONS and the subject is the
--        IDENTITY; mapping the first two costs a wrong label, mapping the
--        third costs the account.
--
--    **So the subject is `sub`, fixed, and `server/data-plane/
--    session-mint-store.ts` names it once.** If a broker ever presents an
--    identifier under another name, that is a ruling and not a column.
-- ---------------------------------------------------------------------

ALTER TABLE tenant.identity_connection ADD COLUMN email_claim text;
ALTER TABLE tenant.identity_connection ADD COLUMN name_claim  text;


-- ---------------------------------------------------------------------
-- §5 — THE SIGN-IN READ AND WRITE PATH. ONE PERMISSIVE POLICY, KEYED ON THE
--      SIGN-IN GUCs AND ON THE ROW'S OWN COLUMNS, AND IT ADMITS **ONE ROW**.
--
-- This is `0013`'s `identity_connection_signin_rls` one table over, for
-- measurement (b): at a callback there is no session, so `0009`'s `user_rls`
-- resolves nothing and a person is invisible to the transaction that has to
-- find or create them.
--
-- 🛑 IT READS NO OTHER RELATION, AND THAT IS MEASUREMENT (e) RATHER THAN A
--    STYLE. Every term is either a column of the row being tested or a GUC.
--    §2's FOREIGN KEY is what makes that sufficient: the pair cannot
--    disagree with `connection_id`, so testing the pair IS testing the door.
--
-- 🛑 IT IS KEYED ON THE SUBJECT AS WELL AS ON THE DOOR, AND THE SUBJECT TERM
--    IS THE ONE THAT MATTERS (G1635). `db/signin-scope.ts` states the rule
--    this file is held to, in its own voice:
--
--        "the policies admit exactly the row the key names, the caller learns
--         only what it already named, and every DECISION downstream — which
--         door, which organisation, which person — is read off the row rather
--         than off the key."
--
--    **A door is not a person.** Keyed on the broker pair alone this policy
--    would admit EVERY person on that door, and the broker pair is a handle a
--    caller supplies — so the sign-in scope would become a directory
--    enumeration surface for anyone who could name a customer's provider.
--    That is not "exactly the row the key names"; it is every row the key's
--    PARENT names. Hence the fifth GUC, and hence `withSignInScope()` gains
--    one optional field rather than this policy widening.
--
-- ⚠️ `app.external_subject` IS OPTIONAL ON THE HELPER AND ITS ABSENCE IS THE
--    DEFAULT, exactly as `sessionRef`'s is. Unset, `nullif(current_setting(…),
--    '')` is NULL, `external_subject = NULL` is NULL, and G100's deny-on-NULL
--    refuses every row — so every sign-in read written before this commit
--    (`assembleSignIn()`, which names no subject) reaches no person at all and
--    is unchanged by this file.
--
-- ⚠️ THE `WITH CHECK` IS THE `USING` EXPRESSION, SPELLED TWICE, WHICH IS
--    `0013`'s `sign_in_attempt_rls` SHAPE AND NOT A NEW ONE. Omitting `WITH
--    CHECK` would make PostgreSQL reuse `USING` for it and read identically
--    today; it is written out because the two are free to diverge and a
--    reader should not have to know the defaulting rule to see that they do
--    not.
-- ---------------------------------------------------------------------

CREATE POLICY user_signin_rls ON tenant."user"
  USING (
    external_subject = nullif(current_setting('app.external_subject', true), '')
    AND broker_issuer = nullif(current_setting('app.broker_issuer', true), '')
    AND broker_ref    = nullif(current_setting('app.broker_ref', true), '')
  )
  WITH CHECK (
    external_subject = nullif(current_setting('app.external_subject', true), '')
    AND broker_issuer = nullif(current_setting('app.broker_issuer', true), '')
    AND broker_ref    = nullif(current_setting('app.broker_ref', true), '')
  );


-- ---------------------------------------------------------------------
-- §6 — THE FENCE. A RESTRICTIVE POLICY, `WITH CHECK` ONLY, **NO `USING`**
--      (G1633) — AND BOTH ABSENCES ARE MEASUREMENTS RATHER THAN OMISSIONS.
--
-- `0020_capability_granting.sql`'s `role_assignment_grant_restrictive` is the
-- precedent for the shape. Its argument was about RECURSION — a `USING`
-- *"would be applied to the read inside the policy's own expression"* — and
-- G449 measured that a `WITH CHECK` subquerying its own table does not
-- recurse.
--
-- 🛑 **HERE THE TWO ABSENCES ANSWER TWO DIFFERENT MEASUREMENTS, AND SAYING SO
--    IS THE POINT OF THIS PARAGRAPH.**
--
--    **NO SUBQUERY AT ALL — measurement (e).** 0020's recursion argument is
--    not merely inherited, it is STRONGER here than 0020 knew: this policy
--    cannot read `tenant.identity_connection` even from a `WITH CHECK`,
--    because the cycle runs through `0018`'s policy on THAT table and back to
--    this one. §2's FK is what lets the test be written without a read.
--
--    **NO `USING` — measurement (c).** A RESTRICTIVE policy applies to every
--    command it covers and restrictive policies AND with permissive ones, so
--    `FOR ALL` reaches `SELECT`. A `USING` here would AND the broker-pair
--    test into every read of `tenant."user"` — and `resolveSubject()` reads
--    that table on EVERY REQUEST, in a session scope where no broker GUC is
--    set. Witnessed: the session-scope read went from `[usr_acme_mei]` to
--    `[]`. **The obvious tidy-up — "the policy should say which rows it
--    applies to" — is an authentication outage**, and
--    `tests/db/external-subject-and-claim-map.test.ts` §6 goes red on exactly
--    that edit.
--
-- 🛑 WHAT IT BUYS THAT §5 DOES NOT: §5 is PERMISSIVE, and permissive policies
--    **OR**. `0009`'s `user_rls` is also permissive, and its `USING` doubles
--    as a `WITH CHECK` for INSERT because it declares none — so a row that
--    satisfied `user_rls` would be admitted by that disjunct alone, with no
--    door test of any kind. **That is reachable and it is not theoretical:**
--    `tenant.session.user_id` carries no foreign key, so a writer holding
--    both privileges could mint the SESSION first, pointing at a person id
--    that does not exist yet, and then mint the person — at which point
--    `user_rls`'s `id = (SELECT s.user_id FROM tenant.session s WHERE
--    s.handle_digest = app.session_ref)` is TRUE and admits it. This policy
--    is ANDed into every write regardless of which permissive policy
--    admitted it, so **the door test cannot be routed around by satisfying a
--    different policy.**
--
-- 🛑 AND IT IS WHERE "`orgClass` IS NEVER CONFERRED BY THE TOKEN" IS
--    ENFORCED, WHICH IS THE SHARPEST THING IN THIS FILE. `tenant."user"`
--    carries no organisation and no tenant — it carries `connection_id`, and
--    `orgFor(connection.owner)` derives the organisation from the DOOR
--    (`0009`'s rule; `tests/db/identity-substrate.test.ts` §6b asserts that a
--    partner and a customer may share a broker). A minted person therefore
--    inherits the owner of the door the callback arrived through, and this
--    policy plus §2's FK is what makes "the door the callback arrived
--    through" mean the door named by the SCOPE rather than the door named by
--    the row being written. **Without it, a writer could name any
--    `connection_id` it liked and choose the organisation of the person it
--    was creating** — G289's five deleted controls, reached by a writer
--    instead of by a default.
--
-- ⚠️ `FOR ALL` AND NOT `FOR INSERT`, THOUGH ONLY `INSERT` IS GRANTED. `FOR
--    ALL`'s `WITH CHECK` also governs `UPDATE`, so if a later commit grants
--    one the door test is already in place; `FOR INSERT` would silently stop
--    applying at exactly the moment the privilege widened. It costs nothing,
--    because a `WITH CHECK` is not consulted by `SELECT` or `DELETE` — which
--    is measurement (c)'s other half.
-- ---------------------------------------------------------------------

CREATE POLICY user_signin_mint_restrictive ON tenant."user"
  AS RESTRICTIVE
  FOR ALL
  WITH CHECK (
    broker_issuer = nullif(current_setting('app.broker_issuer', true), '')
    AND broker_ref = nullif(current_setting('app.broker_ref', true), '')
  );


-- ---------------------------------------------------------------------
-- §7 — GRANTS. `INSERT` ONLY, ON ONE TABLE, AND THE THREE VERBS THAT ARE
--      REFUSED ARE REFUSED BY NAME.
--
-- 🛑 NO `UPDATE`, AND THIS IS THE REFUSAL TO READ TWICE. `0009` says in its
--    own voice that none of its policies filters on `status`, DELIBERATELY,
--    because *"a disabled person must be VISIBLE so the model can refuse them
--    BY NAME"* — `resolveSubject()` answers `user_disabled`, and
--    `model/session-mint.ts` refuses to mint for one at all. **A path holding
--    `UPDATE` could flip `status` from `disabled` back to `active` and that
--    refusal would simply stop happening** — the control would still be
--    present, still correct, and asked about a row somebody had edited. An
--    `UPDATE` would also let a path move an `external_subject` from one
--    person to another, which is §3's uniqueness satisfied while the identity
--    it protects is reassigned.
--
-- ⚠️ THE CONSEQUENCE IS NAMED RATHER THAN HIDDEN: a person's `email` and
--    `display_name` therefore go STALE when the broker's claims change, and
--    nothing in this repository refreshes them. Re-projecting a person's
--    claims on each sign-in is an `UPDATE` and is a separate ruling with the
--    paragraph above as its first objection. Not taken here.
--
-- 🛑 NO `DELETE`. `0010`'s append-only-as-a-PRIVILEGE, a fifth time. A path
--    that could delete a person could delete the subject every audit row,
--    every `granted_by` and every `assigned_to` in the schema points at —
--    and `0019`'s membership trigger and `0039`'s grants all resolve through
--    it. Deletion is a retention act, not a request-path one.
--
-- ⚠️ NO NEW GRANT ON `tenant.identity_connection`. `0009`'s `GRANT SELECT`
--    covers the three columns §4 adds, and SELECT-only still means no serving
--    process can write a claim map — a path that could would point the email
--    claim at a claim the caller controls and provision a person under
--    somebody else's address.
--
-- ⚠️ TABLE-LEVEL AND NOT COLUMN-LEVEL, which is worth one line because the
--    column-level form is fresh in this directory (`0015`'s `GRANT UPDATE
--    (assigned_to)`, `0013`'s `GRANT UPDATE (consumed_at)`). It would buy
--    nothing here: an INSERT must write every `NOT NULL` column, so a
--    column-level `INSERT` naming all eight is the table-level grant with
--    more to keep in step. It also keeps the grant VISIBLE to
--    `has_table_privilege`, which returns FALSE for a column-level grant and
--    is what `tests/db/control-plane-census.test.ts` and any future census
--    are built on.
--
-- 🛑 NO `GRANT` ON `tenant.session` — AND THAT ABSENCE IS THE SUBJECT OF A
--    WHOLE SLICE. W3-S0 (`tests/db/session-mint-scope.test.ts`) measured that
--    a TENANTLESS `INSERT INTO tenant.session` needs no new grant and no new
--    policy — `0005` already grants `INSERT` and `0027` records that *"INSERT
--    is admitted by neither policy"* — while a TENANTFUL one is refused by
--    `session_selection_restrictive`, which is invariant 1 held in SQL.
--    **That measurement was re-run against this tree and agrees**, so this
--    file adds nothing there and must not.
-- ---------------------------------------------------------------------

GRANT INSERT ON tenant."user" TO tenant_rw;

-- =====================================================================
-- 0020 — CAPABILITY GRANTING. G512 (19 Sep 2026), building the fence G449
-- DESIGNED, G511 RE-MEASURED, AND NEITHER SLICE WAS ALLOWED TO LAND.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 READ THIS FIRST: THIS FILE IS HALF OF ONE COMMIT AND IS MEANINGLESS
--    ALONE. TWO SLICES REFUSED TO WRITE IT AND BOTH WERE RIGHT.
-- ═══════════════════════════════════════════════════════════════════════
--
-- `0009_identity_substrate.sql` refuses the `GRANT` at the foot of this file,
-- in capitals, and its sentence is copied rather than paraphrased:
--
--     "a request path that could write `role_assignment` could grant itself
--      any capability in the closed set, and `decide()` would then permit it
--      CORRECTLY."
--
-- and `0004_subject_ledger.sql` names the shape:
--
--     "A write privilege ahead of a writer."
--
-- **G449 and G511 each designed this fence, measured it on a throwaway
-- database, and DELIBERATELY LANDED NOTHING**, because a `GRANT INSERT ON
-- tenant.role_assignment` with no operation behind it is exactly that shape.
-- G511's disposition cell says so: *"The fence and the writer are one commit or
-- neither."*
--
-- **THIS IS THAT COMMIT.** The writer is `grantRoleAssignment` —
-- `docs/contracts/capability.openapi.yaml`, `x-capability: manage_roles`,
-- mounted in `server/data-plane/start.ts`, bodied in
-- `server/data-plane/role-grants.ts`, and minting invariant 10's record through
-- `authorisedHandler()` before it writes a row. **If you are reading this file
-- because you are deleting that operation, delete the `GRANT` in the same
-- commit** — otherwise the privilege outlives its only reason to exist and
-- `0009`'s sentence becomes true again.
--
-- RULINGS THIS APPLIES (docs/HANDOFF.md §3):
--   G512  the fence and the writer land together. The five terms below are
--         G449's, re-measured by G511 across twelve outcomes, BUILT rather
--         than redesigned.
--   G507  `manage_roles` is expressed in SQL as THE ACT'S OWN INVARIANT 10
--         RECORD and never as a second capability evaluator. `0018` carries
--         the long argument; this file uses the mechanism and repeats only
--         what it must.
--   G289  ONE EVALUATOR. The policy below asks about a RECORD, not about
--         authority, for the reason G289 refused a control-plane evaluator
--         beside `decide()`.
--   G100  every predicate DENIES on NULL. `nullif(current_setting(…, true),
--         '')`, verbatim, every time.
--   G101  transaction-mode pooling; `SET LOCAL` only, through a named helper.
--         This file adds no helper and no GUC-setting code.
--   G97   every branded id is `text`. No uuid.
--   G88   forward-only. There is no `down`.
--
-- ⚠️ SCHEMA-QUALIFIED THROUGHOUT, because 0003 requires it from 0004 on.
--
-- ⚠️ A CITATION IN `0018` POINTS AT THIS FILE AND MEANS A DIFFERENT THING, AND
--    IT IS NAMED HERE RATHER THAN LEFT TO RESOLVE-BUT-BE-WRONG.
--    `0018_administrative_directory.sql` says *"Nothing in this file repairs
--    G399 in general — see `0020`"*. It was written before `0019` existed and
--    `0019_membership_revocation_voids_sessions.sql` IS that repair. **This
--    file is not it and does not touch G399.** The class is the one `CLAUDE.md`
--    catalogues twenty times over: a citation that resolves and points at the
--    wrong thing.
--
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 PART ONE — `0009`'s OWED `WITH CHECK`, AND THE `ALTER` IS WRITTEN IN THE
--    ONE FORM THAT CANNOT SILENTLY WIDEN ANYTHING.
-- ═══════════════════════════════════════════════════════════════════════
--
-- `0009` omitted a `WITH CHECK` on all three of `role_rls`,
-- `role_capability_rls` and `role_assignment_rls`, and said why, and said what
-- would owe one:
--
--     "The app role holds `SELECT` and nothing else on every table here, so
--      there is no write for a `WITH CHECK` to constrain. … **The commit that
--      grants a write here owes the `WITH CHECK` in the same commit as the
--      writer.**"
--
-- This commit grants a write on ONE of the three. It therefore owes the
-- `WITH CHECK` on ONE of the three, and `role_rls` and `role_capability_rls`
-- are left exactly as `0009` wrote them — their sentence is undischarged
-- because their privilege is unchanged.
--
-- ┌─ 🛑 `ALTER POLICY` REPLACES WHAT IT NAMES, AND THE NEAR-MISS IS RECORDED ─┐
-- │  `0008` had to restate `session_selection_restrictive`'s whole expression │
-- │  because it was ADDING A DISJUNCT to it, and a draft of that slice        │
-- │  dropped `0008`'s three-governance-list `NOT EXISTS` while doing so —     │
-- │  which **would have parsed cleanly and silently widened invariant 8 to    │
-- │  `statutory`**, the class invariant 8 refuses *"at any price"*.           │
-- │                                                                           │
-- │  **This `ALTER` names `WITH CHECK` AND NOTHING ELSE.** PostgreSQL leaves  │
-- │  an omitted clause of `ALTER POLICY` UNCHANGED, so the `USING` expression │
-- │  `0009` wrote is not re-typed here and therefore cannot be mistyped here. │
-- │  That is a stronger guarantee than a careful copy: the clause this file   │
-- │  does not name is a clause this file cannot replace.                      │
-- │                                                                           │
-- │  It is not left to the reader's memory of the manual either.              │
-- │  `tests/db/capability-granting.test.ts` §0 reads `pg_policies.qual` for   │
-- │  `role_assignment_rls` AFTER migration and asserts it is still `0001`'s   │
-- │  predicate, character for character, against the two sibling policies     │
-- │  `0009` wrote beside it and this file did not touch.                      │
-- └───────────────────────────────────────────────────────────────────────────┘
--
-- ⚠️ THE PREDICATE IS `0001`'s AND IS NOT RE-DECIDED HERE. It is the same
--    sentence on `USING` and on `WITH CHECK`, which is `0010`'s shape and
--    `0005`'s: a row may be READ from this tenant and may be WRITTEN into this
--    tenant, and the two are the same fact asked twice. **This is the
--    CROSS-TENANT refusal in G511's list** — a granting act that named another
--    tenant's id in the row would be refused here, before the restrictive
--    policy below is ever consulted.
-- ---------------------------------------------------------------------

ALTER POLICY role_assignment_rls ON tenant.role_assignment
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- =====================================================================
-- 🛑 PART TWO — THE FENCE. FIVE TERMS, EACH CLOSING ONE CLAUSE OF `0009`'s
--    REFUSAL, AND NOT ONE OF THEM IS NEW HERE.
-- =====================================================================
--
-- G449 designed these five and witnessed eleven outcomes on a throwaway
-- database. G511 re-measured them against the BUILT directory and got twelve.
-- **This file builds them; it does not redesign them.** G449's own list,
-- copied:
--
--     `granted_by = <actor>`; `user_id <> <actor>`; every capability of the
--     conferred role already held by the actor through a LIVE assignment; the
--     actor holds `manage_roles`; and deny-on-NULL.
--
-- ─────────────────────────────────────────────────────────────────────
-- 🛑 TERM 4 IS THE ONE THAT MADE THIS POSSIBLE, AND IT IS `0018`'s MECHANISM
--    RATHER THAN A CAPABILITY CHECK. READ `0018`'s HEADER BEFORE CHANGING A
--    TOKEN OF THE EXPRESSION BELOW.
-- ─────────────────────────────────────────────────────────────────────
--
-- The obvious way to say *"the actor holds `manage_roles`"* in SQL is to join
-- `role_assignment` to `role_capability` and look for the verb. `0018` writes
-- that expression out in full and refuses it, and the refusal is the reason
-- this file exists at all:
--
--     "That expression is a **SECOND CAPABILITY EVALUATOR**, and it is a
--      STRICTLY WEAKER one than the first. … So the danger is not that the copy
--      DRIFTS. The danger is that it is born wrong and looks right."
--
-- `decide()` answers `subject_not_active`, `connection_disabled`,
-- `owner_unresolvable`, four `OrgClass` arms, `role_not_active`, the role
-- VERSION PIN, `assignment_revoked` and `assignment_expired` **as two different
-- facts**, `durable_assignment_forbidden_for_org`, `PARTNER_CAPABILITY_MASK`
-- and the resource class. A four-line `EXISTS` answers three of those and says
-- `true` to the rest.
--
-- **So term 4 below asks whether THIS TRANSACTION CARRIES AN INVARIANT 10
-- RECORD FOR `manage_roles`**, named in `app.authorisation_ref`, written by
-- `writeAuthorisationRecord()` — which takes an `AuthorizationGrant` it cannot
-- construct, from `authorize()`, which asked `decide()`, which is the single
-- evaluator. The policy re-derives nothing and knows no arms.
--
-- ⚠️ 🛑 THE HONEST BOUND, COPIED FROM `0018` RATHER THAN RE-ARGUED AND NOT
--    SOFTENED BY THE FACT THAT THIS TABLE MATTERS MORE:
--
--        **This fence is exactly as strong as invariant 1's own fence and no
--        stronger.**
--
--    It anchors on a GUC that `server/` sets. A handler that could forge
--    `app.authorisation_ref` could forge `app.tenant_id` and read across
--    tenants today, which is a defeat this repository already accepts and
--    names — `db/tenant-scope.ts` calls that value *"the one value in the
--    system that must never be attacker-influenced."* G449 stated this bound
--    in its own row and G511 carried it forward unchanged; **it is not
--    upgraded by being written down a third time.**
--
--    What it buys OVER a bare flag is `0018`'s two things, unchanged: a forged
--    NAME is inert, because the row must exist and carry the verb and be
--    unexpired and be in this tenant; and **every conferral is auditable by
--    construction**, because the record the policy requires lands in an
--    APPEND-ONLY table (`0010` grants `SELECT, INSERT` and deliberately no
--    `UPDATE` and no `DELETE`) inside the same transaction as the write.
--
-- ─────────────────────────────────────────────────────────────────────
-- 🛑 AND TERM 3 IS **NOT** A SECOND EVALUATOR, THOUGH IT LOOKS LIKE ONE. THE
--    DISTINCTION IS WHAT IS BEING DECIDED, AND IT IS WORTH THE PARAGRAPH.
-- ─────────────────────────────────────────────────────────────────────
--
-- Term 3 loops the conferred role's capabilities and requires the actor to
-- already hold each through a live assignment. That IS a copy of `canGrant()`'s
-- loop, and `model/access.ts` runs the same loop one layer up.
--
-- **It is not the §5.3 shape, and the test is which question is being
-- answered.** Term 4's question is *"may this actor act?"* — an authority
-- question, which `decide()` owns and which this file must not re-answer.
-- Term 3's question is *"is this ROW an escalation?"* — a question about the
-- row being written, which nothing in `decide()` asks and which the database is
-- the last place able to ask. The two answers are about different objects.
--
-- ⚠️ THE TWO COPIES ARE EACH **SUFFICIENT** AND NEITHER IS NECESSARY, WHICH IS
--    `0018`'s OWN TEST FOR DEFENCE IN DEPTH RATHER THAN DUPLICATION: delete the
--    handler's `canGrant()` and this policy still refuses the escalation;
--    delete this term and `canGrant()` still refuses it. §5.3's copies are each
--    NECESSARY, so the two must agree or the control breaks. These two may
--    disagree only by one being STRICTER, and a stricter database is a refused
--    write rather than a widened one.
--
--    🛑 AND THEY DO DISAGREE, DELIBERATELY, IN THE SAFE DIRECTION. `canGrant()`
--    additionally refuses `granter_not_customer_org` and
--    `target_not_customer_org` and compares `AssignmentScope`. **This policy
--    can express none of those**: organisation is derived per request from the
--    DOOR and is *"a stored copy of a derived fact"* if written down (`0009`'s
--    own words), and `AssignmentScope` HAS NO COLUMNS — `0009`'s scope note
--    argues both at length. So the model is strictly stricter and the database
--    is strictly narrower in a different dimension, and **a row must pass
--    both.** Neither is the whole control and this file does not claim to be.
--
-- ─────────────────────────────────────────────────────────────────────
-- 🟢 THE MEASUREMENT G449 CALLED ITS SHARPEST, REPRODUCED AND RELIED ON HERE.
-- ─────────────────────────────────────────────────────────────────────
--
--     A `WITH CHECK` on `tenant.role_assignment` whose expression SUBQUERIES
--     `tenant.role_assignment` does **NOT** trigger PostgreSQL's policy
--     recursion.
--
-- The self-reference is in a `WITH CHECK`, and a `WITH CHECK` is not applied to
-- a read: the subquery is an ordinary `SELECT` narrowed by the PERMISSIVE
-- policy (`role_assignment_rls`'s `USING`) only. `tests/db/capability-granting
-- .test.ts` §1 is the ALLOW arm and would fail with `infinite recursion
-- detected in policy for relation "role_assignment"` if that were wrong, so the
-- measurement is re-witnessed on every run rather than trusted from a row.
--
-- ⚠️ AND IT IS WHY THIS POLICY STATES `WITH CHECK` AND **NO `USING`**. A
--    `USING` clause here would be applied to reads — including the read inside
--    its own expression — and that IS the recursion. It would also gate
--    `DELETE`, which PostgreSQL decides on `USING`; `0019`'s
--    `session_lapsed_member_rls` is the same shape for the same reason, and
--    `tests/db/administrative-reach.test.ts` §5 measures that consequence one
--    table over.
--
-- ─────────────────────────────────────────────────────────────────────
-- 🛑 FOUR MECHANICAL THINGS, IN `0018`'s ORDER, BECAUSE EVERY ONE OF THEM HAS
--    SHIPPED AS A DEFECT IN THIS DIRECTORY AT LEAST ONCE.
-- ─────────────────────────────────────────────────────────────────────
--
-- (1) **RESTRICTIVE POLICIES ARE `AND`-ed, SO THIS NARROWS AND CANNOT WIDEN.**
--     `role_assignment_rls` is PERMISSIVE and stays the only thing that decides
--     WHICH ROWS ARE VISIBLE. This adds a conjunct to the write and to nothing
--     else. There is no arrangement of the two that publishes a row.
--
--     ⚠️ AND THE INHERITED-NARROWING QUESTION `0018` (1) ASKS MUST BE ASKED
--     HERE TOO, IN THE OTHER DIRECTION: does any OTHER policy read
--     `tenant.role_assignment`, and would it now inherit a restriction? **No,
--     and it could not**: a `WITH CHECK` is not applied to the read a policy
--     expression performs. `tests/db/capability-granting.test.ts` §9 asserts
--     the set of policies reading this table FROM THE CATALOGUE, in both
--     directions, so the next one is a red gate rather than a thing somebody
--     notices.
--
-- (2) **`nullif(current_setting(…, true), '')`, VERBATIM, EVERY TIME.** `0005`
--     states the argument and it is copied rather than restated: a GUC that was
--     SET and reverted reads back as the EMPTY STRING, not NULL, so without the
--     `nullif` the predicate becomes `= ''`, which denies BY ACCIDENT and only
--     because no id happens to be empty. With `missing_ok = true` an unset
--     variable returns NULL, `= NULL` is NULL, NULL is not TRUE, and **the
--     policy denies.** G100. Two GUCs are read below and both are that form.
--
-- (3) **EVERY TABLE INSIDE THE EXPRESSION IS ITSELF NARROWED BY ITS OWN POLICY,
--     AS THE QUERYING ROLE** — `0005`'s measured fact, for the fifth time in
--     this directory. Worked out rather than assumed:
--
--       · `tenant.authorization_grant g` → `authorization_grant_rls`, so a
--         grant minted in ANOTHER tenant cannot name a conferral here even if
--         its id were known.
--       · `tenant.role tr` / `gr`        → `role_rls`
--       · `tenant.role_capability`       → `role_capability_rls`
--       · `tenant.role_assignment ga`    → `role_assignment_rls`'s `USING`
--
--     With `app.tenant_id` UNSET every one of them returns NOTHING, the
--     outermost `EXISTS` is empty, and the write is refused. **The explicit
--     `tenant_id` terms below are therefore each SUFFICIENT rather than
--     NECESSARY** — `0018`'s distinction — which is defence in depth and not
--     §5.3's copy: delete one and the inherited policy still confines the
--     expression; widen the inherited policy and the explicit term still
--     confines it.
--
--     🛑 THE ONE PLACE THAT IS LOAD-BEARING RATHER THAN BELT-AND-BRACES:
--     `ga.user_id = g.subject_user_id` reads the ACTOR's assignments out of the
--     same tenant-narrowed set. An actor's authority in ANOTHER tenant confers
--     nothing here, and that is invariant 8's shape arriving on the customer
--     arm: authority is per tenant or it is not authority.
--
-- (4) **THE LITERAL `'manage_roles'` IS A MODEL CONSTANT SPELLED IN SQL**,
--     which is `0002`'s *"third place to drift"*. It is MIRRORED rather than
--     copied, by `0008`'s answer and `0018`'s:
--     `tests/db/capability-granting.test.ts` §10 reads the literal back out of
--     `pg_policies.with_check` and asserts membership in `CAPABILITIES`.
--     Without that test the failure mode is the worst one available — a
--     capability renamed in the model leaves this policy matching nothing,
--     every conferral is refused, and everything merely LOOKS safe.
--
-- ⚠️ WHAT THIS FENCE DOES **NOT** CLOSE, CARRIED FORWARD FROM G449 AND G511
--    WORD FOR WORD RATHER THAN QUIETLY DROPPED:
--
--      · **LATERAL SPREAD BY TWO COLLUDING HOLDERS.** Each confers what it
--        holds and the pair ends holding the union. That is a property of
--        delegation itself and no expression here can refuse it.
--      · **A SINGLE COMPROMISED HOLDER OF `manage_roles` CREATING
--        PERSISTENCE.** They may confer only what they already hold, so they
--        gain no verb — and they may give a second account everything they
--        have, which survives the first account being disabled.
--
--    Both are named on the operation as well. Neither is closed by this file
--    and neither should be read as closed because the file is long.
-- ---------------------------------------------------------------------

CREATE POLICY role_assignment_grant_restrictive ON tenant.role_assignment
  AS RESTRICTIVE
  FOR ALL
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
         -- TERM 4 · the act's own record, and never a second evaluator. G507.
         AND g.capability = 'manage_roles'
         AND g.expires_at > now()
         -- TERM 1 · `granted_by` is the ACTOR, read off the record rather than
         --          declared beside it. One name, one source — `0018`'s rule.
         AND g.subject_user_id = role_assignment.granted_by
         -- TERM 2 · nobody grants to themselves. `canGrant()`'s
         --          `self_grant_forbidden`, said again where the row lands.
         AND g.subject_user_id <> role_assignment.user_id
         -- THE PIN ON THE ROW BEING WRITTEN. `decide()` stops evaluating an
         -- assignment whose pin has moved, IN EITHER DIRECTION, so a row whose
         -- `role_version` does not match the role it names is authority nobody
         -- can ever use. It is refused rather than stored, because an inert
         -- authority row and a live one are indistinguishable to an auditor
         -- reading this table — and because the capabilities term below is
         -- computed against the CURRENT definition, so a row pinned elsewhere
         -- would have been checked against a role it does not mean.
         AND EXISTS (
           SELECT 1
             FROM tenant.role tr
            WHERE tr.tenant_id = role_assignment.tenant_id
              AND tr.id        = role_assignment.role_id
              AND tr.status    = 'active'
              AND tr.version   = role_assignment.role_version
         )
         -- TERM 3 · NO ESCALATION. There is no capability of the conferred
         --          role that the actor does not already hold through a LIVE
         --          assignment. Written as a double negative because that is
         --          what "every" is in SQL, and because the positive form
         --          (`count(*) = count(*)`) is the one that reads as true when
         --          both sides are zero for different reasons.
         AND NOT EXISTS (
           SELECT 1
             FROM tenant.role_capability conferred
            WHERE conferred.tenant_id = role_assignment.tenant_id
              AND conferred.role_id   = role_assignment.role_id
              AND NOT EXISTS (
                SELECT 1
                  FROM tenant.role_assignment ga
                  JOIN tenant.role gr
                    ON gr.tenant_id  = ga.tenant_id
                   AND gr.id         = ga.role_id
                  JOIN tenant.role_capability grc
                    ON grc.tenant_id = ga.tenant_id
                   AND grc.role_id   = ga.role_id
                 WHERE ga.user_id     = g.subject_user_id
                   AND grc.capability = conferred.capability
                   -- LIVE, in the three senses `decide()` answers separately.
                   -- They are collapsed into one predicate here ON PURPOSE:
                   -- this expression is not reporting WHY, it is deciding
                   -- whether a row may be written, and `0009`'s objection to a
                   -- liveness `WHERE` was that it would rob the EVALUATOR of a
                   -- named refusal. Nothing downstream of this reads a reason.
                   AND ga.revoked_at IS NULL
                   AND (ga.expires_at IS NULL OR ga.expires_at > now())
                   AND gr.status  = 'active'
                   AND gr.version = ga.role_version
              )
         )
    )
  );


-- ---------------------------------------------------------------------
-- THE GRANT. `INSERT` ON ONE TABLE, AND NOTHING ELSE ANYWHERE.
--
-- By name, because 0003 declines `ALTER DEFAULT PRIVILEGES` on this schema.
--
-- 🛑 NO `UPDATE` AND NO `DELETE`, AND THAT IS `0010`'s APPEND-ONLY-AS-A-
--    PRIVILEGE APPLIED TO THE AUTHORITY RECORD ITSELF. A request path that
--    could `UPDATE tenant.role_assignment` could set `revoked_at = NULL` on a
--    revocation somebody took, or move a `role_version` pin onto a widened
--    role — **both of which are escalations that write no new row and would
--    pass every term above, because a `WITH CHECK` on an `UPDATE` sees the NEW
--    row and this expression would find its own conferral record missing.**
--    Revocation is therefore STILL not built and is still owed, and it owes its
--    own `USING` clause when it lands, not this one.
--
-- 🛑 NO `INSERT` ON `tenant.role` AND NONE ON `tenant.role_capability`, WHICH
--    IS THE REFUSAL THAT KEEPS TERM 3 MEANING ANYTHING. A path that could
--    author a role could write a role carrying `approve_resolution`, and term 3
--    would then compare the conferred role against the actor's holdings and
--    refuse — so authoring alone is not an escalation. **But a path that could
--    write `role_capability` could add a verb to a role the actor ALREADY
--    HOLDS**, which widens the actor's own authority with no conferral at all
--    and which nothing in this file looks at. Role authoring is `install_pack`
--    and a pack is a platform release; it is not this operation's to open, and
--    G449 and G511 both measured these two refusals as part of the fence
--    rather than as an omission.
--
-- ⚠️ THE APP ROLE CANNOT `ALTER` THIS TABLE AND THEREFORE CANNOT DROP THE
--    POLICIES PROTECTING IT. That property comes from `createRoles()` in
--    `db/provision.ts` and is what `FORCE ROW LEVEL SECURITY` in `0009` is
--    relative to.
-- ---------------------------------------------------------------------

GRANT INSERT ON tenant.role_assignment TO tenant_rw;

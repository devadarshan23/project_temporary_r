-- =====================================================================
-- 0018 — THE ADMINISTRATIVE DIRECTORY. G506 (19 Sep 2026), applying the
-- OWNER'S FIRST RULING of 19 Sep 2026 and closing the read half of G449.
--
-- WHAT IT IS FOR, IN THE OWNER'S OWN SENTENCE, COPIED RATHER THAN
-- PARAPHRASED:
--
--     "A person is visible to a caller whose tenant holds a live membership
--      for them AND who holds `manage_roles`."
--
-- G447 measured why that was not expressible: `tenant."user"` is keyed on the
-- ACTING SESSION'S OWN ROW and carries NO `tenant_id` column, so a caller sees
-- exactly one person — itself — and inside `withTenantScope()`, the
-- transaction every gated handler runs in, it sees ZERO. **A tenant could read
-- WHO BELONGS (`tenant.membership` is tenant-scoped) and could not read WHO
-- THEY ARE.** This file opens the second half of that asymmetry, on the join
-- that already exists.
--
-- 🛑 AND IT DOES NOT ADD A `tenant_id` TO A PERSON, WHICH IS THE REPAIR A
--    HURRIED READER WILL REACH FOR FIRST. **A person may belong to SEVERAL
--    tenants — that is exactly why `tenant."user"` has no tenant column** —
--    and a tenant column would make the second membership unrepresentable,
--    which is `0005`'s own argument against `UNIQUE (tenant_id, user_id)` on
--    `tenant.membership` arriving one table over. The membership IS the join
--    and the ruling uses it.
--
-- RULINGS THIS APPLIES (docs/HANDOFF.md §3):
--   G506  a person is visible via a LIVE MEMBERSHIP in the caller's tenant
--         plus the caller holding `manage_roles`. The owner's ruling.
--   G507  `manage_roles` is expressed in SQL as THE ACT'S OWN INVARIANT 10
--         RECORD and never as a second capability evaluator. See the long
--         block below — it is the load-bearing decision in this file.
--   G289  ONE EVALUATOR. *"Splitting one decision across two components is the
--         structural precondition for a confused deputy."* G289 refused a
--         control-plane evaluator beside `decide()`; this file refuses a SQL
--         one on the same argument, and the refusal is what shaped it.
--   G100  every policy DENIES on NULL. A forgotten `set_config` yields an
--         EMPTY result set, never a directory.
--   G101  transaction-mode pooling assumed; `SET LOCAL` only, through a named
--         helper. **This file adds no helper and no GUC-setting code.**
--   G97   every branded id is `text`. No uuid.
--   G88   forward-only. There is no `down`. 0001–0017 ARE NOT EDITED BY THIS
--         FILE — both policies below are NEW, and `user_rls` and
--         `identity_connection_rls` are left exactly as 0009 wrote them.
--
-- ⚠️ SCHEMA-QUALIFIED THROUGHOUT, because 0003 requires it from 0004 on.
--
-- ⚠️ NO `GRANT` IN THIS FILE, AND THE ABSENCE IS THE RULE RATHER THAN AN
--    OVERSIGHT. `0009` already grants the app role `SELECT` on both tables and
--    grants nothing else; this file widens WHICH ROWS a `SELECT` returns and
--    does not widen WHAT MAY BE DONE. Nothing here can write a person, a door,
--    a role or an assignment, and `0004`'s rule — *"a write privilege ahead of
--    its writer"* — is therefore not engaged at all.
--
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE HARD PART, AND THE WHOLE REASON THIS FILE IS LONG: HOW
--    `<caller holds manage_roles>` IS SAID IN SQL WITHOUT BUILDING A SECOND
--    EVALUATOR. READ THIS BEFORE CHANGING ONE TOKEN OF EITHER POLICY.
-- ═══════════════════════════════════════════════════════════════════════
--
-- THE OBVIOUS FORM IS THE WRONG ONE, AND IT IS WRONG IN A WAY THAT PASSES
-- REVIEW. Written out, so it is refused in writing rather than re-proposed:
--
--     AND EXISTS (SELECT 1
--                   FROM tenant.role_assignment a
--                   JOIN tenant.role_capability rc
--                     ON rc.tenant_id = a.tenant_id AND rc.role_id = a.role_id
--                  WHERE a.user_id = <caller>
--                    AND rc.capability = 'manage_roles'
--                    AND a.revoked_at IS NULL
--                    AND (a.expires_at IS NULL OR a.expires_at > now()))
--
-- That expression is a **SECOND CAPABILITY EVALUATOR**, and it is a STRICTLY
-- WEAKER one than the first. `decide()` answers, by name and in a fixed order:
-- `user_disabled`, `connection_disabled`, `owner_unresolvable`, the four
-- `OrgClass` arms, `role_not_active`, the role VERSION PIN
-- (`RoleAssignment.roleVersion` against `Role.version`, *"a widened role is a
-- NEW version and needs consent"*), `assignment_revoked` and
-- `assignment_expired` **as two different facts**, `durable_assignment_-
-- forbidden_for_org`, `PARTNER_CAPABILITY_MASK`, and the resource class
-- through `CAPABILITY_RESOURCE_CLASS`. The four lines above answer THREE of
-- those and silently answer `true` to the rest.
--
-- **So the danger is not that the copy DRIFTS. The danger is that it is born
-- wrong and looks right** — §5.3's two-vocabularies shape, with the second
-- vocabulary shorter than the first. `0009` already refused the mirror of this
-- for the same reason: *"`revoked_at` and `expires_at` are columns and NOTHING
-- IN THIS FILE OR IN THE READER FILTERS ON THEM … `decide()` owns those two
-- questions and answers them SEPARATELY, by name."* A policy that filtered on
-- them would be the reader's defect one layer lower, where no test that reads
-- `model/` can see it.
--
-- ─────────────────────────────────────────────────────────────────────
-- 🟢 WHAT THIS FILE DOES INSTEAD: IT CHECKS FOR THE RECORD, NOT FOR THE
--    AUTHORITY. **INVARIANT 10 IS THE MECHANISM.**
-- ─────────────────────────────────────────────────────────────────────
--
-- Invariant 10, copied from `CLAUDE.md` rather than paraphrased:
--
--     "An act with no authorisation is unrecordable. `authorize()` mints an
--      `AuthorizationGrant` and nothing else does."
--
-- `tenant.authorization_grant` (0010) is where that record lands, and
-- `server/data-plane/authorisation-record.ts` writes it **INSIDE THE ACT'S OWN
-- TRANSACTION, BEFORE THE ACT RUNS**. So by the time a handler body issues its
-- first `SELECT`, the transaction already contains a row saying WHO is acting,
-- UNDER WHICH CAPABILITY, in WHICH TENANT, with an EXPIRY — written by the one
-- function permitted to mint one, which asked `decide()`, which is the single
-- evaluator.
--
-- **The policy therefore asks a question about the transaction's own record
-- rather than a question about authority.** It re-derives nothing. It re-reads
-- no assignment, no role, no version pin, no organisation. If `decide()` grows
-- an arm tomorrow, this expression is unchanged and is automatically correct,
-- because it never knew the arms in the first place.
--
-- The act names its own record through `app.authorisation_ref`, a GUC set from
-- the minted grant's id in the same seam that writes the row. It is a NAME,
-- not a CLAIM: setting it to a value for which no row exists opens nothing.
--
-- ⚠️ 🛑 THE HONEST BOUND, STATED BECAUSE THE PREVIOUS SLICE STATED IT AND
--    BECAUSE UNDERSTATING IT WOULD BE THE WORST THING THIS FILE COULD DO.
--    **This fence is exactly as strong as invariant 1's own fence and no
--    stronger.** It anchors on a GUC that `server/` sets; a handler that could
--    forge `app.authorisation_ref` could forge `app.tenant_id` and read across
--    tenants today, which is a defeat this repository already accepts and
--    names — `db/tenant-scope.ts` calls that value *"the one value in the
--    system that must never be attacker-influenced."*
--
--    **What it buys OVER a bare flag is not nothing, and it is precisely two
--    things:**
--
--      1 · A FORGED NAME IS INERT. `app.directory_reach = '1'` would be a
--          claim the database must believe. A grant id is a name the database
--          CHECKS: the row must exist, must be in this tenant scope (its own
--          policy sees to that), must carry `manage_roles`, and must be
--          unexpired. Forging the GUC without a matching record opens nothing,
--          and the only writer of a matching record is `authorize()`.
--      2 · **EVERY DIRECTORY READ IS AUDITABLE BY CONSTRUCTION.** The row the
--          policy requires is an invariant 10 record, on an APPEND-ONLY table
--          — `0010` grants `SELECT, INSERT` and deliberately no `UPDATE` and
--          no `DELETE`. A read of another person cannot happen without a
--          durable record of the authorisation it ran under existing first.
--          That is strictly more than the model had, which is invariant 10's
--          own claim about itself.
--
--    **And what it does NOT buy, said plainly: it does not make an
--    unauthorised read impossible.** Invariant 10's own sentence applies
--    unchanged — *"nothing can, against root"* — it makes one visible or
--    detectable.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 FOUR MECHANICAL THINGS THAT CAN EACH SILENTLY DEFEAT THIS, ANSWERED IN
--    ORDER. EVERY ONE OF THEM IS A REAL DEFECT THIS DIRECTORY HAS SHIPPED.
-- ═══════════════════════════════════════════════════════════════════════
--
-- (1) **PERMISSIVE POLICIES ARE OR-ed, SO THIS WIDENS `user_rls`. THAT IS
--     INTENDED, AND HERE IS THE INTENT, PER OPERATION.**
--
--     `0009`'s `user_rls` and `identity_connection_rls` have no `WITH CHECK`
--     and the app role holds `SELECT` only, so `FOR ALL` on a permissive
--     policy reaches exactly one operation: **SELECT**. The union after this
--     file is:
--
--         {the caller's own person}                          — `user_rls`
--       ∪ {live members of `app.tenant_id`, when the act's own record
--          carries `manage_roles`}                  — `user_directory_rls`
--
--     The first disjunct MUST survive: `resolveSubject()` reads the caller's
--     own row on every request, BEFORE any capability is known, and gating
--     that on `manage_roles` would make signing in require the capability that
--     signing in produces. That is the circularity `POST /context/resolve`'s
--     own G200 exemption names.
--
--     ⚠️ AND THE SECOND HALF OF (1) IS THE ONE THAT IS EASY TO MISS: **does
--     any OTHER table inherit this widening through a join?** A policy
--     expression that reads `tenant."user"` would silently gain the directory.
--     **Measured at this commit: none does.** Derive it, do not read it —
--
--         grep -n 'tenant\."user"' db/migrations/*.sql
--
--     returns table, grants, `ENABLE`/`FORCE` and comments, and no policy
--     expression. `tests/db/administrative-directory.test.ts` §6 asserts the
--     same property FROM THE CATALOGUE (`pg_policies.qual`) rather than from
--     the files, so the next policy that joins to a person is a RED GATE and
--     not a thing somebody notices. That is `0009`'s own lesson about
--     `platform_role_rls` — a nested policy inherits the narrowing of the
--     table it reads, in both directions.
--
-- (2) **`nullif(current_setting(…, true), '')`, VERBATIM, EVERY TIME.**
--     `0005` states the argument and it is copied rather than restated: a GUC
--     that was SET and reverted reads back as the EMPTY STRING, not NULL, so
--     without the `nullif` the predicate becomes `tenant_id = ''`, which
--     denies BY ACCIDENT and only because no tenant id happens to be empty.
--     With `missing_ok = true` an unset variable returns NULL, `= NULL` is
--     NULL, NULL is not TRUE, and **the policy denies.** G100. Every predicate
--     below is that form and none of them invents a new one.
--
-- (3) **`membership_rls` APPLIES INSIDE THE `EXISTS`, AND HERE IS EXACTLY
--     WHAT THE SUBQUERY SEES — WORKED OUT RATHER THAN ASSUMED.**
--
--     `0005`'s measured fact, for the fourth time in this directory:
--     *"PostgreSQL applies row-level security to a table referenced inside a
--     policy expression, as the querying role."* It is what made G180's revoke
--     fail and what forced `db/selection-scope.ts` into existence.
--
--     So `tenant.membership m` below is narrowed by `membership_rls` —
--     `tenant_id = nullif(current_setting('app.tenant_id', true), '')` —
--     BEFORE this expression's own `WHERE` is applied. The subquery therefore
--     sees:
--
--       · with `app.tenant_id` SET   → that tenant's memberships, and no other
--                                      tenant's, whatever this expression says
--       · with `app.tenant_id` UNSET → **NOTHING**, because `membership_rls`
--                                      denies on NULL. The `EXISTS` is empty,
--                                      the policy is FALSE, and the directory
--                                      is closed. **`withSessionScope()` alone
--                                      opens no directory** — which is correct
--                                      and is the same denial G447 §1b
--                                      measured for the unwidened tree.
--
--     Likewise `tenant.authorization_grant g` is narrowed by
--     `authorization_grant_rls` to `app.tenant_id`, so a grant minted in
--     ANOTHER tenant cannot name a directory here even if its id were known.
--
--     ⚠️ AND THE `m.tenant_id` AND `g.tenant_id` TERMS ARE WRITTEN OUT ANYWAY,
--     WHICH LOOKS LIKE THE DUPLICATION §5.3 FORBIDS AND IS NOT. §5.3's copies
--     are each NECESSARY, so the two must agree or the control breaks. **These
--     two are each SUFFICIENT**: delete the explicit term and the inherited
--     policy still confines the read; widen the inherited policy and the
--     explicit term still confines it. Two independent statements of one
--     property, where either alone holds, is defence in depth rather than a
--     second vocabulary. On the table that decides WHICH PEOPLE ARE IN A
--     DIRECTORY that is worth its two lines.
--
-- (4) **THE CAPABILITY LITERAL `'manage_roles'` IS A MODEL CONSTANT SPELLED IN
--     SQL, WHICH IS `0002`'s *"third place to drift"*, AND IT IS MIRRORED
--     RATHER THAN COPIED.** `0008` faced this exactly — *"a policy expression
--     cannot import a TypeScript constant"* — and answered it with a test
--     asserting set equality in BOTH directions.
--     `tests/db/administrative-directory.test.ts` §5 reads the literal back
--     out of `pg_policies.qual` and asserts it is a member of `CAPABILITIES`
--     in `model/access.ts`. A capability renamed in the model and not here is
--     then a RED GATE, and the failure mode without that test is the worst
--     one available: the policy would match nothing, the directory would
--     close, and everything would merely look refused.
-- =====================================================================


-- ---------------------------------------------------------------------
-- THE DIRECTORY, ON THE PERSON.
--
-- Two `EXISTS` clauses, and they answer two different questions. Keep them
-- separate: collapsing them into one join would make the failure of either
-- indistinguishable from the failure of the other, and `0009`'s whole argument
-- about `platform_assignment_unreadable` versus `platform_assignment_absent`
-- is that a refusal must say WHICH.
--
--   THE FIRST  — is this act carrying an authorisation for `manage_roles`,
--                and is the actor STILL a live member of this tenant?
--   THE SECOND — is the row being read a live member of this tenant?
--
-- 🛑 THE ACTOR'S OWN MEMBERSHIP TERM IS IN THE FIRST CLAUSE AND IT IS NOT
--    DECORATION. The grant proves the evaluator said yes AT MINT TIME. The
--    membership term proves the actor STILL BELONGS AT READ TIME, and G399 is
--    precisely the case where those differ: a session binds while a membership
--    is live and keeps acting after it lapses, because `session_selection_-
--    restrictive` is a `WITH CHECK` and re-proves nothing on a read. Nothing
--    in this file repairs G399 in general — see `0020` — but the DIRECTORY
--    closes for a lapsed member the moment their membership lapses, on the
--    same predicate `0005` uses, with the `expires_at` term `0005` added in
--    the safe direction over B1's quoted `revoked_at`-only form.
--
-- ⚠️ `g.subject_user_id` AND NOT A SECOND GUC. The grant already records WHO
--    acted — *"narrowed to the `userId` half of `PrincipalContext.subject`"* —
--    so the actor's identity is read from the record rather than declared
--    alongside it. One name, one source.
--
-- ⚠️ `g.expires_at > now()` USES THE TRANSACTION'S CLOCK, AND `0005` NAMES THE
--    DIVERGENCE THIS INHERITS: *"`now()` is the transaction's clock, and the
--    model's is the caller's."* The two agree to within one transaction, which
--    is the whole of the exposure. A grant's TTL is a served act's, seconds
--    rather than hours, so the window is smaller here than anywhere `0005`
--    accepted it.
--
-- ⚠️ NO `WITH CHECK`, FOR `0009`'s STATED REASON, UNCHANGED: the app role holds
--    `SELECT` and nothing else on this table, so there is no write for one to
--    constrain. **The commit that grants a write here owes the `WITH CHECK` in
--    the same commit as the writer** — which is the sentence `0019` is about
--    to discharge one table over.
-- ---------------------------------------------------------------------

CREATE POLICY user_directory_rls ON tenant."user"
  USING (
    EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
         AND g.capability = 'manage_roles'
         AND g.expires_at > now()
         AND EXISTS (
           SELECT 1
             FROM tenant.membership am
            WHERE am.user_id    = g.subject_user_id
              AND am.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
              AND am.revoked_at IS NULL
              AND (am.expires_at IS NULL OR am.expires_at > now())
         )
    )
    AND EXISTS (
      SELECT 1
        FROM tenant.membership m
       WHERE m.user_id    = "user".id
         AND m.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
         AND m.revoked_at IS NULL
         AND (m.expires_at IS NULL OR m.expires_at > now())
    )
  );


-- ---------------------------------------------------------------------
-- THE DIRECTORY, ON THE DOOR — AND IT IS DERIVED FROM THE ONE ABOVE RATHER
-- THAN RESTATED, WHICH IS THE WHOLE OF ITS ARGUMENT.
--
-- WHY IT IS NEEDED AT ALL: G449's blocker is `canGrant()`'s `target.orgClass`,
-- and `model/access.ts` is emphatic that it has exactly ONE source —
-- `orgFor(connection.owner)`, *"never a membership and never the route"*.
-- Reading a person gives their `connection_id`; the ORGANISATION lives on the
-- connection. **A directory that opened the person and not the door would
-- close G449's read half by exactly zero**, and the tempting repair — default
-- the target's org to `customer` because they have a membership — is G289's
-- own trap in the target position and is refused in writing at
-- `tests/db/administrative-reach.test.ts` §2.
--
-- 🛑 THE FIRST DRAFT OF THIS POLICY WAS `id IN (SELECT u.connection_id FROM
--    tenant."user" u)` AND NOTHING ELSE, AND IT BROKE SIGNING IN. THE
--    MEASUREMENT IS RECORDED RATHER THAN THE REPAIR ALONE, because the
--    reasoning that produced it is the reasoning a later reader will repeat.
--
--    The argument was: the inner reference is narrowed by the policies on
--    `tenant."user"`, so this policy *"admits exactly the doors of the people
--    the caller can already see and cannot exceed the person directory by
--    construction"* — `0009`'s `platform_role_rls` shape, with no capability
--    term because that would be a second copy of the expression above.
--
--    ⚠️ **THE ARGUMENT IS TRUE AND THE CONCLUSION WAS WRONG, BECAUSE THE UNION
--    ON `tenant."user"` INCLUDES `user_rls` — THE CALLER'S OWN PERSON.** So on
--    an ORDINARY SESSION PATH, with no authorisation record anywhere, this
--    policy still resolved the caller's own `user` row and admitted the door
--    on THAT row — which is not always the door the SESSION came through.
--    `tenant."user".connection_id` is *"the directory that authenticated
--    them"* and `tenant.session.connection_id` is the door this session used;
--    `0009` gives the two no foreign key to each other and nothing makes them
--    equal.
--
--    🛑 **THE FAILURE WAS A WIDENING THAT PRESENTED AS A REFUSAL, WHICH IS WHY
--    IT IS WORTH THE PARAGRAPH.** `server/data-plane/identity.ts` reads the
--    door for the current session and had never had to consider seeing TWO.
--    With two rows visible it resolved the wrong one and refused —
--    `connection_absent`, `broker_unresolvable`, a partner served 401 — and
--    `tests/db/identity-substrate.test.ts` 2d/5/6b/6c/6d and
--    `tests/http/identity-substrate-served.test.ts` §4 all went red.
--    **Six assertions, and not one of them said "too many rows".**
--    A permissive policy can only ADD rows, so a suite that goes red after one
--    lands is reporting a reader that assumed a singleton, every time.
--
-- ✅ THE REPAIR IS THE CAPABILITY TERM THIS POLICY ARGUED ITSELF OUT OF, AND
--    THE MEASUREMENT IS WHAT OVERRULES THE ARGUMENT. With it, the door
--    directory contributes NOTHING outside a `manage_roles` act — which is
--    what *"derived from the person directory"* was supposed to mean and did
--    not, because the person directory is a UNION and only one of its two
--    disjuncts is the directory.
--
--    The `id IN (…)` half is unchanged and still does the real work: the doors
--    admitted are exactly the doors of the people the caller can see, so this
--    cannot exceed the person directory. `0009`'s `platform_role_rls`
--    precedent holds for that half. What it could not carry is the GATE.
--
--    This is `0009`'s `platform_role_rls` shape, deliberately and by name:
--    *"A platform role is visible only through an assignment the caller holds
--    … the inner reference is itself narrowed by the policy above — the
--    measured fact again — so this expression cannot reach an assignment the
--    caller does not hold."* Same mechanism, same fail direction: if the
--    person directory denies, this resolves to an empty set and `orgFor()`
--    receives nothing, so the model refuses `owner_unresolvable` **by name**
--    rather than defaulting. There is no arrangement of these two policies
--    that publishes more doors than people.
--
-- ⚠️ IT IS THE THIRD PERMISSIVE POLICY ON THIS TABLE. `0009` wrote
--    `identity_connection_rls` (the caller's own door) and `0013` added
--    `identity_connection_signin_rls` (the door being signed in through,
--    keyed on `app.broker_issuer` and `app.broker_ref`). Three permissive
--    policies OR together; the sign-in one requires two GUCs no served path
--    sets, this one requires an authorisation record no sign-in holds, and the
--    two cannot both be satisfied by one transaction today. Stated because
--    three OR-ed policies on one table is the point at which somebody should
--    be asked to justify a fourth.
-- ---------------------------------------------------------------------

CREATE POLICY identity_connection_directory_rls ON tenant.identity_connection
  USING (
    EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
         AND g.capability = 'manage_roles'
         AND g.expires_at > now()
    )
    AND id IN (SELECT u.connection_id FROM tenant."user" u)
  );

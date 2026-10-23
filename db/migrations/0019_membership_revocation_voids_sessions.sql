-- =====================================================================
-- 0019 — REVOKING A MEMBERSHIP VOIDS THAT PERSON'S SESSIONS. G508 (19 Sep
-- 2026), applying the OWNER'S SECOND RULING of 19 Sep 2026 and closing G450
-- and G399 AT SOURCE.
--
-- WHAT IT IS FOR, IN THE OWNER'S OWN SENTENCE, COPIED RATHER THAN
-- PARAPHRASED:
--
--     "Revoking a membership voids that person's sessions, with BOTH guards:
--      a trigger, AND a row-count assertion."
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE FAILURE MODE THIS FILE EXISTS TO PREVENT IS **SILENCE**, AND IT WAS
--    MEASURED BEFORE IT WAS DESIGNED AGAINST. READ G450 BEFORE THIS FILE.
-- ═══════════════════════════════════════════════════════════════════════
--
-- `tests/db/administrative-reach.test.ts` §4b measured it against a live
-- PostgreSQL: an administrator CAN revoke another person's membership
-- (`tenant.membership` is tenant-scoped, `rowCount = 1`) and CANNOT revoke
-- their session — `session_rls` is keyed on the ACTING session's own
-- `handle_digest`, so
--
--     UPDATE tenant.session SET revoked_at = now() WHERE user_id = <other>
--
-- **matches ZERO ROWS AND COMMITS.** It does not raise. Every other refusal in
-- this repository is a thrown policy violation; this one is `rowCount = 0`.
-- **So the natural implementation of the ruling would commit the membership
-- revocation, report success, and leave every session of the removed person
-- live, with no error anywhere** — which is G399's defect reproduced by the
-- fix intended to close it.
--
-- That is why the owner ruled BOTH guards, and it is the same lesson G180's
-- swallowed error taught: *a denied write and a successful one looked
-- identical from outside, and that is why it survived.*
--
-- RULINGS THIS APPLIES (docs/HANDOFF.md §3):
--   G508  revoking a membership voids that person's sessions, by TRIGGER, so
--         the two acts cannot be separated by any caller. The owner's ruling.
--   G509  the removed person's sessions are reached by a NEW PERMISSIVE POLICY
--         gated on the act's own invariant 10 record — NOT by widening
--         `session_rls`, and NOT by a `SECURITY DEFINER` function. Derived.
--   G510  `DELETE ON tenant.session` is REVOKED from the app role, closing the
--         destroy-the-evidence containment G450 found. Derived.
--   G448  session-then-membership commits and membership-then-session is
--         refused. **THIS FILE REVERSES THAT CONSTRAINT DELIBERATELY** — see
--         the amendment block. The measurement stands; the constraint does not.
--   G160  **there is still NO `SECURITY DEFINER` IN THIS SCHEMA.** See below —
--         the design exists to keep that true.
--   G100  every policy DENIES on NULL.
--   G88   forward-only. There is no `down`. `0005` IS NOT EDITED; its
--         restrictive policy is `ALTER POLICY`-ed, which is `0008`'s precedent.
--
-- ⚠️ SCHEMA-QUALIFIED THROUGHOUT, because 0003 requires it from 0004 on.
--
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THIS FILE INTRODUCES THE FIRST TRIGGER AND THE FIRST FUNCTION IN THIS
--    SCHEMA. THERE IS NO PRECEDENT. IT IS ARGUED HERE RATHER THAN ASSUMED.
-- ═══════════════════════════════════════════════════════════════════════
--
-- Derive the claim, do not read it:
--
--     grep -rn 'CREATE FUNCTION\|CREATE TRIGGER' db/
--
-- returned exactly ONE line before this file — a COMMENT in `0005` saying
-- *"There is no `CREATE FUNCTION` in this file and there must never be one."*
-- An adversarial pass verified the same catalogue-wide. **So this file is a
-- mechanism with no precedent in a directory that has deliberately had none,
-- and the burden is on it.**
--
-- ── WHY A TRIGGER RATHER THAN TWO STATEMENTS IN A HANDLER ──────────────
--
-- Because the owner ruled that the two acts **cannot be separated by any
-- caller**, and a trigger is the only construction here that makes that
-- structurally true rather than conventionally true. Two statements in a
-- handler is a convention: the second one can be forgotten, reordered,
-- short-circuited by an early return, or omitted by the NEXT writer of a
-- membership revocation, who will not have read this file. G450's whole
-- finding is that the omission is SILENT — so the convention's failure mode is
-- a person who appears signed out and is not.
--
-- ── WHAT IT MEANS FOR `0002`'s CAUTION, WHICH IS THE RIGHT OBJECTION ───
--
-- `0002_run.sql` refuses a `CHECK` constraint copying a closed enum because it
-- would be *"a third place to drift — and the one nothing checks, because no
-- pair in the wire-mirror addresses SQL."* **That caution applies to this
-- trigger and it is not waved away: a trigger IS a second vocabulary, and
-- nothing in `npm run check` reads PL/pgSQL.**
--
-- The difference, stated so it can be disagreed with rather than assumed:
-- `0002`'s refused `CHECK` would have been a COPY of a fact declared in
-- `model/` — two statements of one truth, which must agree. **This trigger
-- copies nothing.** It states a RELATIONSHIP BETWEEN TWO TABLES that is
-- declared nowhere else and that `model/` cannot state, because `model/` has
-- no transactions. There is no first copy for it to drift from.
--
-- ⚠️ AND THE CAUTION IS ANSWERED WITH A CONTROL RATHER THAN AN ARGUMENT, which
--    is what `0008` did for its seeded governance lists.
--    `tests/db/membership-revocation.test.ts` witnesses the trigger FIRING, the
--    trigger REFUSING on each of its three guards, and — §7 — reads the trigger
--    and function back OUT OF THE CATALOGUE (`pg_trigger`, `pg_proc`) and
--    asserts the function is **NOT `SECURITY DEFINER`** and that the trigger is
--    still attached. A trigger nobody checks is exactly `0002`'s fear; this one
--    is checked in four directions.
--
-- ── 🛑 AND THE THING THAT MAKES THIS TRACTABLE: **IT IS NOT
--      `SECURITY DEFINER`, AND IT DOES NOT NEED TO BE.** ─────────────────
--
-- The obvious way to let a trigger reach another person's session is to make
-- the function `SECURITY DEFINER` so it runs with an owner's or a migrator's
-- rights. **That is refused here, and G160 already wrote the refusal for a
-- different function:** such an object *"becomes the most security-relevant
-- object in the schema"*, a standing widening that outlives whatever request
-- motivated it.
--
-- It is also, measured, WORSE THAN USELESS as written: `reconcile_owner` is
-- `NOLOGIN NOBYPASSRLS` and every table here is `FORCE ROW LEVEL SECURITY`, so
-- a `SECURITY DEFINER` function owned by the owner is **still subject to RLS**
-- and still sees zero rows. The only role it would work as is
-- `reconcile_migrator`, which is `BYPASSRLS` — i.e. the repair is *"put a
-- BYPASSRLS execution path on the request path"*, which is the single thing
-- this schema's role separation exists to prevent.
--
-- **So the reach is granted by a POLICY instead, and the policy is narrow, and
-- the function is a plain `SECURITY INVOKER` one that can do nothing its
-- caller could not do.** That inverts the usual trigger risk: this trigger
-- holds no authority of its own at all. If the policy below were dropped the
-- trigger would go LOUD rather than silent — see its second guard.
--
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE POLICY. WHY THIS SHAPE AND NOT THE THREE OTHERS.
-- ═══════════════════════════════════════════════════════════════════════
--
-- REFUSED (a) — **widen `session_rls` with a tenant disjunct.** G450 names
-- this as *"expressible"* and it is the wrong shape: it would publish EVERY
-- session row in the tenant to every tenant-scoped transaction, including
-- `handle_digest`, which `0005` calls the credential's shadow — *"a database
-- dump containing handles would be a session-hijack kit."* A directory of live
-- credentials is a far larger widening than the ruling asked for.
--
-- REFUSED (b) — **a `SECURITY DEFINER` function.** Above.
--
-- REFUSED (c) — **a bare GUC flag** (`app.revoking = '1'`). A claim the
-- database must believe, forgeable by anything that can set a GUC, and
-- leaving no record. `0018` argues this at length for the directory and the
-- argument transfers unchanged.
--
-- ✅ TAKEN — **the session of somebody who is NOT a live member, reachable
-- only inside an act carrying an invariant 10 record for `manage_roles`.**
--
-- Two terms, and each is doing distinct work:
--
--   · `NOT EXISTS (live membership)` — this opens EXACTLY the set G399 calls
--     *"no containment"* and no other row. **A live member's session stays
--     invisible to everybody but themselves**, which is `session_rls`
--     unchanged. The set is empty in the ordinary case and becomes non-empty
--     only at the instant a membership stops being live — including, inside
--     the revoking transaction, because the transaction's own uncommitted
--     `revoked_at` is visible to this subquery.
--
--     🛑 THAT LAST CLAUSE IS `0005`'s MEASURED FACT ARRIVING FOR THE FIFTH
--     TIME AND THE FIRST TIME IT HELPS: *"PostgreSQL applies row-level
--     security to a table referenced inside a policy expression, as the
--     querying role"*, and a transaction sees its own uncommitted writes. In
--     G448 that fact made the natural order FAIL. Here it is the entire
--     mechanism: the trigger fires AFTER the membership row is revoked, so by
--     the time it runs the sessions it must void have ALREADY become visible
--     to it. **Nothing had to be added to make the ordering work; the ordering
--     works because the fact that used to break it now carries it.**
--
--   · the invariant 10 record — `0018`'s mechanism, reused rather than
--     reinvented, and the reuse is the point: there is ONE way in this schema
--     to say *"the single evaluator authorised this act"* and this is a second
--     reader of it, not a second vocabulary. Read `0018`'s long block; every
--     word of it applies here, **including the honest bound: this is exactly
--     as strong as invariant 1's own fence and no stronger.**
--
-- ⚠️ THE CAPABILITY IS `manage_roles`, THE SAME ONE, AND THAT IS A DECISION
--    RATHER THAN A DEFAULT. Removing a person from a tenant is an act of the
--    same authority as granting them a role — it is the same administrator
--    doing the inverse thing — and minting a second capability for it would
--    widen `CAPABILITIES`, which is a PLATFORM RELEASE to change and not a
--    migration's to take. If a later ruling splits them, this literal and
--    `0018`'s move together and `tests/db/*.test.ts` mirrors both.
--
-- ⚠️ AND THE MIGRATOR IS UNAFFECTED BY ALL OF IT. `reconcile_migrator` is
--    `BYPASSRLS`, so the seed and the test harness reach these rows without
--    any of this — which is why the suite can establish a fixture and then
--    prove the app role cannot.
-- ---------------------------------------------------------------------

CREATE POLICY session_lapsed_member_rls ON tenant.session
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')
    AND NOT EXISTS (
      SELECT 1
        FROM tenant.membership m
       WHERE m.user_id    = session.user_id
         AND m.tenant_id  = session.tenant_id
         AND m.revoked_at IS NULL
         AND (m.expires_at IS NULL OR m.expires_at > now())
    )
    AND EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
         AND g.capability = 'manage_roles'
         AND g.expires_at > now()
    )
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')
    AND revoked_at IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
         AND g.capability = 'manage_roles'
         AND g.expires_at > now()
    )
  );

-- ⚠️ THE `WITH CHECK` IS NOT THE `USING`, AND THE TWO DIFFERENCES ARE BOTH
--    DELIBERATE. It drops the `NOT EXISTS` term — the row being written has
--    already been selected through `USING`, and repeating the membership test
--    on the NEW row would make the write depend on a subquery the write itself
--    does not change, for no gain. And it ADDS `revoked_at IS NOT NULL`, which
--    is the whole of what this policy permits: **through this policy a session
--    may be REVOKED and may not be edited in any other way.** A rebinding
--    (`SET tenant_id = …`) with a null `revoked_at` falls straight through to
--    `session_selection_restrictive` and is refused there, exactly as before.


-- ---------------------------------------------------------------------
-- 🛑 THE AMENDMENT TO `session_selection_restrictive`, AND IT IS AN AMENDMENT
--    TO THE ONE POLICY INVARIANT 1's WRITE GATE LIVES ON. G450 said in terms
--    that this *"is not a Builder's to take"*. **The owner has now taken it**,
--    and this is the narrowest disjunct that discharges the ruling.
--
-- WITHOUT IT THE TRIGGER CANNOT WORK, AND G448 IS THE PROOF. That row
-- measured, inside one transaction: `UPDATE session …` then
-- `UPDATE membership …` COMMITS; the reverse is REFUSED with
--
--     new row violates row-level security policy
--     "session_selection_restrictive" for table "session"
--
-- because the restrictive `WITH CHECK` reads `tenant.membership` and the
-- revoking transaction's own uncommitted `revoked_at` is visible to it. **A
-- trigger on membership revocation runs in exactly the order G448 measured as
-- REFUSED, necessarily and by construction** — the trigger fires after the
-- membership write. So the ruling is unimplementable until this policy admits
-- the one write the trigger makes.
--
-- ⚠️ `ALTER POLICY` RATHER THAN `DROP` + `CREATE`, WHICH IS `0008`'s CHOICE AND
--    ITS ARGUMENT: `ALTER POLICY … WITH CHECK (…)` replaces the expression and
--    CANNOT change the policy's kind or its `FOR`, so it stays `AS RESTRICTIVE`
--    and stays without a `USING`. A `DROP` + `CREATE` pair would let a typo
--    silently turn the repository's only restrictive policy permissive.
--
-- 🛑 WHAT THE NEW DISJUNCT IS, AND WHY IT IS SAFE — THE FULL ARGUMENT, BECAUSE
--    THIS IS THE RISKIEST LINE IN THE SLICE.
--
--     OR (revoked_at IS NOT NULL
--         AND EXISTS (a membership for this person in this tenant, LIVE OR NOT))
--
--   · `revoked_at IS NOT NULL` — **the row being written is a DEAD session.**
--     `resolveSubject()` refuses `session_revoked` BY NAME and does so BEFORE
--     it reads `session.tenantId` at all, so the tenant a revoked session
--     names is never read by anything. Derive it, do not read this line:
--     `sed -n '/export function resolveSubject/,/^}/p' model/access.ts` — the
--     `revokedAt` arm precedes the `tenantId` arm. **A revoked session is
--     inert, so permitting a write that produces one confers nothing.**
--
--   · `EXISTS (… LIVE OR NOT)` — **and this is the term that stops the
--     disjunct being a hole.** Without it, any session could be bound to ANY
--     tenant provided it were revoked in the same statement. With it, a
--     session may only be written toward a tenant **the person has at some
--     point genuinely belonged to** — which for the trigger's write is
--     trivially true (the membership being revoked IS that row, and a revoked
--     row is still a row, which is `0005`'s own reason for `revoked_at`
--     existing rather than a `DELETE`).
--
--   · THE TWO-STEP IS CLOSED TOO. Revoke-then-unrevoke does not work: the
--     second write presents `revoked_at IS NULL`, skips this disjunct, and
--     falls to the live-membership `EXISTS`, which fails for a lapsed member.
--     **It fails closed in both directions and was measured doing so** —
--     `tests/db/membership-revocation.test.ts` §5.
--
-- 🛑 THE FIRST TWO DISJUNCTS ARE REPRODUCED BYTE-FOR-BYTE FROM `0008`, AND
--    **THE FIRST DRAFT OF THIS FILE GOT THE SECOND ONE WRONG.** It is recorded
--    rather than quietly fixed, because it is the best evidence available for
--    why the control below exists.
--
--    `ALTER POLICY … WITH CHECK (…)` **REPLACES THE WHOLE EXPRESSION.** There
--    is no syntax for appending a disjunct, so amending this policy means
--    restating everything already in it — and what was restated, from the
--    prose of G199's row rather than from `0008`'s bytes, was:
--
--        AND g.subject_user_id = session.user_id
--        AND g.granted_at > now() - make_interval(hours => g.max_hours)
--
--    **Three errors in two lines.** The column is `g.staff_user_id`, not
--    `g.subject_user_id`; the ceiling is not a column on the grant at all but
--    a JOIN to `tenant.grant_duration_ceiling`, which is G292's seeded
--    reference data; and the whole `NOT EXISTS` over
--    `access_resource_grant` × the three governance lists —
--    `non_delegable_resource`, `contract_only_resource`, `permitted_resource`
--    — **was simply absent.** That is `authorisationPermits()`'s three-list
--    check, and G75's own finding is that consulting two of the three
--    reproduces G60's defect exactly.
--
--    ⚠️ **AND IT WOULD NOT HAVE FAILED LOUDLY.** `subject_user_id` does not
--    exist, so that draft would have failed at migration time — this time. A
--    draft that dropped only the `NOT EXISTS` would have PARSED, APPLIED, and
--    silently widened invariant 8's staff path to any resource class including
--    `statutory`, which invariant 8 refuses *at any price*. **The near-miss is
--    the argument: this is `0002`'s "third place to drift", and the third
--    place is a policy nobody diffs because it is spelled out in a file whose
--    subject is something else.**
--
-- ✅ SO THE MITIGATION IS A CONTROL AND NOT A PROMISE, WHICH IS `0008`'s OWN
--    ANSWER TO ITS OWN PROBLEM. `tests/db/membership-revocation.test.ts` §6
--    reads this policy's expression back out of `pg_policies.qual` /
--    `with_check` and asserts that **every table and every governance list the
--    three sources depend on is still referenced by name** — `membership`,
--    `tenant_access_grant`, `grant_duration_ceiling`, `access_resource_grant`,
--    `non_delegable_resource`, `contract_only_resource`, `permitted_resource`
--    — plus this file's own disjunct. An amendment that drops G199's staff arm
--    while adding something else is then a RED GATE rather than a quiet
--    reversal, and the next migration that has to restate this expression
--    inherits the control rather than the hazard.
-- ---------------------------------------------------------------------

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
    OR (
      revoked_at IS NOT NULL
      AND EXISTS (
        SELECT 1
          FROM tenant.membership m
         WHERE m.user_id   = session.user_id
           AND m.tenant_id = session.tenant_id
      )
    )
  );


-- ---------------------------------------------------------------------
-- 🛑 THE TRIGGER FUNCTION, AND **ALL THREE GUARDS THE OWNER'S RULING NAMES
--    LIVE IN IT**. Read the guard block below before the body.
--
-- `SECURITY INVOKER` — the DEFAULT, stated by omission because PostgreSQL has
-- no `SECURITY INVOKER` keyword requirement and writing nothing is what makes
-- it so. `tests/db/membership-revocation.test.ts` §7 asserts
-- `pg_proc.prosecdef = false` from the catalogue, because *"stated by
-- omission"* is exactly the kind of claim that is true until somebody
-- helpfully adds a word.
--
-- ⚠️ `SET search_path` IS PINNED ON THE FUNCTION. A function whose
--    `search_path` comes from its caller can be made to resolve `membership`
--    to a table the caller created — the standard PostgreSQL function
--    hijack — and this one is reached from the request path. Every reference
--    in the body is schema-qualified as well, so the pin is the second of two
--    independent statements of one property, which is `0018`'s (3) again.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE GUARDS. **THE OWNER RULED "A TRIGGER **AND** A ROW-COUNT
--    ASSERTION", AND THE ROW-COUNT ASSERTION IS ONLY MEANINGFUL IF THE
--    COUNTER CAN SEE.** That is the trap, and it is G450's trap one level in.
-- ═══════════════════════════════════════════════════════════════════════
--
-- A naive row-count assertion inside a trigger is **VACUOUS**, and saying why
-- is more useful than the assertion. Row-level security makes *hidden* and
-- *absent* indistinguishable to the invoker: if the policy above denies, the
-- trigger's `SELECT count(*)` returns 0, its `UPDATE` affects 0, the two agree,
-- and the assertion passes while voiding nothing. **That is G450 exactly,
-- reproduced inside the guard written to catch G450.** §5.6 in one statement.
--
-- So the guards are ordered to make the count meaningful BEFORE taking it:
--
--   GUARD 1 · PRECONDITION, IN TWO PARTS, AND THE SECOND PART WAS ADDED
--             BECAUSE THE FIRST ONE ALONE WAS MEASURED INSUFFICIENT.
--
--             (a) `app.tenant_id` is set and EQUALS the revoked membership's
--                 tenant. A real containment on its own: a caller cannot
--                 revoke a membership in tenant A from a transaction scoped to
--                 tenant B.
--             (b) this transaction carries an invariant 10 record for
--                 `manage_roles` — **the same predicate
--                 `session_lapsed_member_rls` requires**, asked again here.
--
--             🛑 (b) IS NOT BELT-AND-BRACES AND IT WAS NOT IN THE FIRST DRAFT.
--             It was found by running this file's suite beside
--             `tests/db/administrative-reach.test.ts` §4, which revoked
--             another person's membership inside a `withSelectionScope()`
--             transaction — tenant scope correct, so (a) passed — **and
--             carried no authorisation record.** The sessions were therefore
--             invisible to the trigger, `expected` was 0, `voided` was 0, the
--             two AGREED, and the trigger committed having voided nothing.
--             **That is G450 surviving inside the trigger written to close
--             it**, and it is precisely the vacuity this block warns about,
--             arriving in this file's own first draft.
--
--             With (b), the trigger can only run in a transaction the policy
--             will also open, so the count it takes is over the complete set.
--             ⚠️ IT BINDS `BYPASSRLS` CALLERS TOO — the migrator and the seed
--             must mint a record to remove somebody — and that is deliberate
--             rather than incidental: for a BYPASSRLS caller the rows are
--             visible anyway, so (b) buys no visibility there and buys
--             something better, **a declaration of intent that lands in an
--             append-only table**. A person removed by a migration is then as
--             answerable as one removed over HTTP.
--             ⚠️ AND IT IS NOT A SECOND EVALUATOR, for `0018`'s reason
--             unchanged: it checks for the RECORD, never for the AUTHORITY.
--   GUARD 2 · THE ROW-COUNT ASSERTION the owner ruled — sessions expected
--             against sessions voided, `RAISE EXCEPTION` on any mismatch,
--             which **fails the transaction** and takes the membership
--             revocation back with it. Given guard 1 it is not vacuous: the
--             two numbers are taken through the same policy, and the case it
--             catches is the one where the `UPDATE` is refused or partially
--             applied where the `SELECT` succeeded — a missing privilege, a
--             restrictive policy amended wrongly, a future `BEFORE` trigger.
--   GUARD 3 · POSTCONDITION — no live session for that person in that tenant
--             remains. Strictly stronger than guard 2 and cheap: guard 2
--             compares two numbers this statement produced, guard 3 asks the
--             question the RULING asks, in the ruling's own terms.
--
-- ⚠️ 🛑 **AND HERE IS WHAT IS *NOT* DISCHARGED, STATED PLAINLY RATHER THAN
--    LEFT TO BE INFERRED.** The owner's "row-count assertion" is written as
--    *"the CALLER compares sessions expected against sessions voided"*, and
--    there is **no caller**: nothing in `server/` revokes a membership, and
--    `0005` grants the app role no `UPDATE` on `tenant.membership` — a
--    privilege this file deliberately does not add, because *"a write
--    privilege ahead of a writer"* is the shape `0004` refused at length and
--    the writer does not exist. **All three guards above are inside the
--    database, so they are not INDEPENDENT of each other in the way the
--    owner's phrasing implies** — a caller-side count would catch this trigger
--    being dropped, and no guard inside the trigger can. The nearest available
--    substitute is `tests/db/membership-revocation.test.ts` §7, which asserts
--    from `pg_trigger` that the trigger is still attached; that is a gate
--    control and not a runtime one. **The caller-side half is OWED, and it is
--    owed to the commit that builds a membership-revocation operation.**
--
-- ⚠️ `AFTER UPDATE`, NOT `BEFORE`. A `BEFORE` trigger runs before the
--    membership's new `revoked_at` is visible to the policy subqueries, so the
--    sessions would still be a live member's and still invisible — the
--    mechanism described above depends on running AFTER. It is also why there
--    is no `BEFORE DELETE` arm: `0005` retains rather than deletes, nothing
--    holds `DELETE` on `tenant.membership`, and a trigger for an act nobody
--    can perform is a column ahead of its reader wearing a trigger's clothes.
--
-- ⚠️ `WHEN (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL)` — the
--    TRANSITION, not the state. Without it, every later `UPDATE` touching an
--    already-revoked membership re-fires the trigger, and guard 2 then
--    compares 0 expected against 0 voided and passes noisily rather than not
--    firing at all. Narrowing on the transition is what keeps the guards' zero
--    case meaningful.
-- ---------------------------------------------------------------------

CREATE FUNCTION tenant.void_sessions_on_membership_revocation()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = tenant, pg_catalog
AS $$
DECLARE
  scoped_tenant text := nullif(current_setting('app.tenant_id', true), '');
  expected      integer;
  voided        integer;
  remaining     integer;
BEGIN
  -- GUARD 1a · PRECONDITION, THE SCOPE. Deny on NULL, G100, expressed as a
  -- raise rather than as an empty result — because an empty result is the
  -- defect this whole file is about.
  IF scoped_tenant IS NULL OR scoped_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION
      'membership revocation outside its own tenant scope: app.tenant_id is %, membership is %',
      coalesce(scoped_tenant, '<unset>'), NEW.tenant_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- GUARD 1b · PRECONDITION, THE RECORD. The same predicate
  -- `session_lapsed_member_rls` requires, asked again — so the trigger cannot
  -- run in a transaction whose sessions it would be unable to see. Without
  -- this, `expected` and `voided` are both 0, they agree, and guard 2 passes
  -- while nothing is voided: G450 inside the guard written to close it.
  IF NOT EXISTS (
    SELECT 1
      FROM tenant.authorization_grant g
     WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
       AND g.tenant_id  = NEW.tenant_id
       AND g.capability = 'manage_roles'
       AND g.expires_at > now()
  ) THEN
    RAISE EXCEPTION
      'membership revocation carries no manage_roles authorisation record: app.authorisation_ref is %',
      coalesce(nullif(current_setting('app.authorisation_ref', true), ''), '<unset>')
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT count(*) INTO expected
    FROM tenant.session s
   WHERE s.user_id    = NEW.user_id
     AND s.tenant_id  = NEW.tenant_id
     AND s.revoked_at IS NULL;

  UPDATE tenant.session s
     SET revoked_at = now()
   WHERE s.user_id    = NEW.user_id
     AND s.tenant_id  = NEW.tenant_id
     AND s.revoked_at IS NULL;

  GET DIAGNOSTICS voided = ROW_COUNT;

  -- GUARD 2 · THE ROW-COUNT ASSERTION. The owner's second guard, and the
  -- direct answer to G450's `rowCount = 0` that committed.
  IF voided IS DISTINCT FROM expected THEN
    RAISE EXCEPTION
      'membership revocation voided % of % live sessions for % in %',
      voided, expected, NEW.user_id, NEW.tenant_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- GUARD 3 · POSTCONDITION, in the ruling's own terms.
  SELECT count(*) INTO remaining
    FROM tenant.session s
   WHERE s.user_id    = NEW.user_id
     AND s.tenant_id  = NEW.tenant_id
     AND s.revoked_at IS NULL;

  IF remaining <> 0 THEN
    RAISE EXCEPTION
      'membership revoked with % live session(s) remaining for % in %',
      remaining, NEW.user_id, NEW.tenant_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NULL;   -- AFTER triggers ignore the return value; NULL says so.
END;
$$;

CREATE TRIGGER membership_revocation_voids_sessions
  AFTER UPDATE ON tenant.membership
  FOR EACH ROW
  WHEN (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL)
  EXECUTE FUNCTION tenant.void_sessions_on_membership_revocation();


-- ---------------------------------------------------------------------
-- 🛑 G510 — THE `DELETE` HOLE, CLOSED BY REMOVING THE PRIVILEGE RATHER THAN
--    BY ADDING A POLICY.
--
-- G450's third measured fact: `session_selection_restrictive` gates `UPDATE`
-- and **not** `DELETE`. `0005`'s header says a restrictive policy with no
-- `USING` *"restricts WRITES ONLY"*, which reads as if it restricts every
-- write; PostgreSQL gates `DELETE` on `USING` and `INSERT`/`UPDATE` on
-- `WITH CHECK`, and that policy states only the latter. **So a lapsed
-- member's own session — the case G399 calls "no containment" — could not be
-- revoked and COULD be deleted.** A containment existed and it was the wrong
-- one: deleting the row destroys the `revoked_at` evidence the column exists
-- to hold.
--
-- ⚠️ THE OBVIOUS REPAIR IS THE WRONG ONE AND `0005` MEASURED WHY. Adding a
--    `USING` to the restrictive policy would gate `DELETE` — and would also
--    gate `SELECT`, *"which would make a session row unreadable until its
--    membership was re-proved on every request, including the requests whose
--    whole purpose is to discover that the session is revoked."* That is a
--    verified measurement in that file, not a worry.
--
-- ✅ SO THE PRIVILEGE GOES INSTEAD. **Nothing deletes a session.** Derive it:
--
--     grep -rnE "^[^-*]*DELETE FROM tenant\.session" server/ db/ model/
--       → nothing
--
--     ⚠️ THE `^[^-*]*` IS NEW — G2181, 28 Sep 2026. The unanchored form
--     answered ONE against a stated NOTHING, and the one was this line. The
--     anchor admits any statement and excludes a `--` SQL comment and a ` *`
--     TypeScript block comment, which is every false hit this corpus has.
--
--    `0005` granted `SELECT, INSERT, UPDATE, DELETE` and the `DELETE` has
--    never had a writer. This is `0004`'s rule applied in the one direction
--    this directory has not used it before: not *a privilege ahead of its
--    writer*, but **a privilege that outlived the absence of one**. Retention
--    is now a property of the GRANT rather than of a policy expression, which
--    is where it is cheapest to check and hardest to amend by accident.
--
-- ⚠️ AND THE HOLE IS NOW CLOSED TWICE OVER, WHICH IS WORTH STATING BECAUSE THE
--    SECOND CLOSURE IS THE INTERESTING ONE: the lapsed member's session that
--    could only be DESTROYED can now be REVOKED — `session_lapsed_member_rls`
--    above — so the containment G399 lacked exists AND it is the right one.
--    The wrong containment is gone in the same file that supplies the right
--    one, which is `0017`'s *"replaced by the positive assertion in the same
--    commit"* discipline.
-- ---------------------------------------------------------------------

REVOKE DELETE ON tenant.session FROM tenant_rw;

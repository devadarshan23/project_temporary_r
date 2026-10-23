-- =====================================================================
-- 0035 · THE TRIGGER IS KEYED ON THE MEMBERSHIP CEASING TO BE **LIVE**, AND
--        ITS BODY ASKS THE SAME QUESTION ITS POLICY ASKS.
--
-- G561 · the firing condition is the LIVENESS predicate every other file in
--        this schema uses, negated — not `revoked_at` changing. Derived,
--        19 Sep 2026, **NOT the owner's**, and it says so on its own face as
--        G190, G356, G376 and G510 do.
-- G562 · the trigger BODY carries the live-membership term the POLICY carries,
--        so the outcome cannot flip on the caller's `BYPASSRLS` bit. Derived,
--        same day, same standing.
--
-- G88: forward-only. There is no down migration. `0019` IS NOT EDITED.
-- ⚠️ SCHEMA-QUALIFIED THROUGHOUT, because 0003 requires it from 0004 on.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 BOTH DEFECTS WERE PROVED AGAINST A LIVE POSTGRESQL BEFORE THIS FILE WAS
--    WRITTEN, AND `0027` NAMED BOTH AND DELIBERATELY LEFT THEM OPEN:
--    *"Both are recorded for the owner. This migration fixes the one thing
--    that is unambiguously a defect."* They are unambiguous now — each has a
--    measurement, and each refutes a sentence `0019` states about itself.
-- ═══════════════════════════════════════════════════════════════════════
--
--
-- ── DEFECT 1 · A RULE KEYED ON A CONVENIENT LANDMARK ───────────────────
--
-- `0019` fires on
--
--     WHEN (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL)
--
-- **the COLUMN, not the property.** `expires_at` is a second, entirely
-- unguarded removal path, and it was measured on this schema:
--
--     live sessions before: 1
--     UPDATE tenant.membership SET expires_at = now() - interval '1 hour'
--       → rowCount 1, NO authorisation record, NO app.tenant_id, no raise
--     live sessions after: 1      ← every session still live
--
-- 🛑 EVERY OTHER LIVENESS PREDICATE IN THIS SCHEMA TREATS EXPIRY AND
--    REVOCATION IDENTICALLY, AND `0019` IS INCONSISTENT WITH ITSELF FOUR
--    LINES ABOVE ITS OWN TRIGGER. `0005`'s `session_selection_restrictive`,
--    `0008`'s staff arm, `0018`'s directory and `0019`'s own
--    `session_lapsed_member_rls` all read
--
--        revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
--
--    and `0005` says why in its own voice: an expired membership is not a
--    revoked one, so a predicate reading only `revoked_at` *"would let a
--    lapsed partner-scoped membership bind a tenant forever"*, and
--    `Membership.expiresAt`'s declaration rules that *"partner-scoped
--    memberships must expire."* `tests/db/administrative-directory.test.ts`
--    §5 and §5b USE expiry for precisely this reason and say so.
--    `docs/HANDOFF.md` §5.1 — a rule keyed on a convenient landmark instead
--    of the property it protects — arriving in this repository's first
--    trigger.
--
-- ⚠️ IT REFUTES TWO OF `0019`'s OWN CLAIMS AND THEY ARE QUOTED RATHER THAN
--    SUMMARISED, because both are sentences a reader would have trusted:
--
--      · *"the two acts cannot be separated by any caller"* — they were
--        separable by any caller willing to use the other column.
--      · *"IT BINDS `BYPASSRLS` CALLERS TOO — the migrator and the seed must
--        mint a record to remove somebody … A person removed by a migration
--        is then as answerable as one removed over HTTP."* — **false.** A
--        migration removed a person via `expires_at` with no invariant 10
--        record at all, and nothing landed in the append-only table.
--
-- ⚠️ NOT REACHABLE BY THE APP ROLE TODAY, AND THAT IS A REASON TO FIX IT NOW
--    RATHER THAN A REASON NOT TO. `0005` grants `SELECT` alone on
--    `tenant.membership` — derive it,
--    `grep -cE "^[^-]*GRANT UPDATE.*membership" db/migrations/*.sql` → 0
--    (G2181: the unanchored form answered 1, and the 1 was this line) — so no
--    HTTP caller can write either column.
--    **It goes live the moment a membership-revocation writer lands.** The
--    obvious containment for that commit is a COLUMN-LEVEL
--    `GRANT UPDATE (revoked_at)` under G358's precedent, and a blanket
--    `GRANT UPDATE` would have reopened this hole in one word.
--
--    🛑 **AND THAT CONTAINMENT IS EXACTLY WHY THE REPAIR BELONGS IN THE
--    TRIGGER INSTEAD.** A property held by the shape of a grant nobody has
--    written yet is a property held by the next author remembering to read
--    G358. After this file the trigger fires on either column, so the
--    property survives a blanket grant. The column-level grant is still the
--    right grant — it keeps `role_id`, `granted_by` and `granted_at` out of a
--    handler's reach, which is G358's actual subject — but it is now defence
--    in depth rather than the whole of the control.
--
--
-- ── DEFECT 2 · THE BODY DOES NOT ASK WHAT THE POLICY ASKS ──────────────
--
-- `0005` deliberately has **no `UNIQUE (tenant_id, user_id)`** — *"the same
-- pair recurs every time a person is re-granted"* — so **two live memberships
-- for one person is a SUPPORTED SHAPE.** `0019`'s body writes
--
--     UPDATE tenant.session … WHERE s.user_id = NEW.user_id
--
-- with no live-membership term. The POLICY has one; the BODY does not — and
-- **for a `BYPASSRLS` caller the policy is inert.** Revoking one of two,
-- measured:
--
--     migrator (BYPASSRLS) | sessions VOIDED ANYWAY | all three guards pass
--     app role             | NOT voided, committed  | all three guards pass
--
-- Both are wrong, in opposite directions. The migrator signs out a person who
-- is **still a member**. The app role reaches `expected = voided = remaining
-- = 0` and commits — **exactly the vacuity `0019`'s own header warns about,
-- surviving its guard 1b**, because guard 1b proves a RECORD exists and proves
-- nothing about whether `NOT EXISTS (live membership)` opens the set.
--
-- 🛑 SO `0019`'s LOAD-BEARING SENTENCE IS FALSE AS WRITTEN: *"With (b), the
--    trigger can only run in a transaction the policy will also open, so the
--    count it takes is over the complete set."* The policy carries THREE
--    terms — the tenant, the record, and `NOT EXISTS (live membership)` — and
--    guard 1 re-checks the first two. The third is the one that decides
--    whether the sessions are visible in the case that matters.
--
-- ✅ THE TERM ADDED BELOW IS NOT A SECOND COPY OF THE POLICY'S TERM; IT IS THE
--    PRECONDITION THAT MAKES THE POLICY'S TERM TRUE. Past the early return,
--    the person has no live membership, so `session_lapsed_member_read`'s
--    `NOT EXISTS` holds and the count that follows is over the complete set —
--    for both roles, because `membership_rls` narrows the subquery to
--    `app.tenant_id` and guard 1a has already required that to equal
--    `NEW.tenant_id`. **That is what makes guard 2 non-vacuous, and it is what
--    `0019` believed guard 1b was doing.**
--
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 WHAT THE NEW FIRING CONDITION IS, AND WHY IT IS THE STATE AND NOT THE
--    TRANSITION. THIS OVERTURNS AN ARGUMENT `0019` MAKES EXPLICITLY.
-- ═══════════════════════════════════════════════════════════════════════
--
--     WHEN (NOT (NEW.revoked_at IS NULL
--                AND (NEW.expires_at IS NULL OR NEW.expires_at > now())))
--
-- **the negation of the liveness predicate, byte-comparable with the four
-- policies that state it.** `OLD` is not read at all.
--
-- `0019` argues for the transition form: *"Without it, every later `UPDATE`
-- touching an already-revoked membership re-fires the trigger, and guard 2
-- then compares 0 expected against 0 voided and passes noisily rather than not
-- firing at all. Narrowing on the transition is what keeps the guards' zero
-- case meaningful."*
--
-- ⚠️ THE ANSWER IS THAT THE ZERO CASE IS KEPT MEANINGFUL BY GUARD 1b AND BY
--    THE NEW LIVE-MEMBERSHIP TERM, NOT BY THE `WHEN`. Past both, a zero means
--    zero live sessions rather than zero visible ones — which is the only
--    reading `0019` ever wanted and the one the transition form did not
--    actually supply.
--
-- 🛑 AND THE TRANSITION FORM, WRITTEN OVER LIVENESS, WOULD HAVE BEEN A
--    REGRESSION. It was drafted first and rejected on a measurement:
--
--        live → revoked          transition: FIRES   state: FIRES
--        live → expired          transition: FIRES   state: FIRES
--        ALREADY EXPIRED → revoked
--                                transition: DOES NOT FIRE   state: FIRES
--
--    The third row is reachable by an administrator doing the obviously right
--    thing — tidying up a membership the clock has already ended — and
--    `0019`'s COLUMN-keyed `WHEN` fires on it today. A liveness TRANSITION
--    would have closed one hole and opened a narrower one in the same commit,
--    which is `docs/HANDOFF.md` §5.1 answered with §5.1.
--
-- ⚠️ WHAT THE STATE FORM COSTS, STATED RATHER THAN DISCOVERED: **any `UPDATE`
--    to a membership row that is not live now demands a tenant scope and a
--    `manage_roles` record**, including one that touches neither column. That
--    is a refusal, so it fails closed, and it is the honest price of firing on
--    a state: the trigger cannot tell a correction from a removal without
--    reading `OLD`, and reading `OLD` is what produced the regression above.
--    Nothing in the tree writes `tenant.membership` at all, so the price is
--    paid by a writer that does not exist yet, which is the cheapest moment to
--    impose it.
--
-- 🛑 AND WHAT IT DOES **NOT** CLOSE, NAMED RATHER THAN LEFT TO BE FOUND: **the
--    CLOCK ARRIVING IS NOT AN `UPDATE`.** A membership that lapses purely by
--    the passage of `expires_at`, with no statement written against the row,
--    fires nothing — a trigger has no tick. The person's sessions stay live
--    until their own `session.expires_at` passes or somebody writes to the
--    membership. **That gap is not new and this file does not widen it**; what
--    is new is that it is now the ONLY expiry gap, where before it sat beside
--    a writable one. Closing it needs a reader-side liveness check or a
--    sweeper, and neither is a trigger's to decide — it is put to the owner,
--    not taken here.
--
--
-- ── WHAT IT MEANS FOR `0002`'s CAUTION, WHICH `0019` OWED AN ANSWER TO ──
--
-- `0002_run.sql` refuses a `CHECK` copying a closed enum because it would be
-- *"a third place to drift — and the one nothing checks, because no pair in
-- the wire-mirror addresses SQL."* `0019` answered that a trigger *"copies
-- nothing"* — it states a relationship between two tables declared nowhere
-- else. **That answer was right about the trigger and wrong about this
-- predicate.** The liveness expression below IS a copy: the same five tokens
-- appear in `0005`'s restrictive policy, in `0008`'s, in `0018`'s, in
-- `0019`'s own permissive policy, in `0027`'s two halves and in
-- `selectTenantForSession()`. **Defect 1 is what that drift looks like when it
-- happens** — one of the copies was written with one term missing, and nothing
-- in `npm run check` reads PL/pgSQL or SQL predicates.
--
-- ✅ SO THE CAUTION IS ANSWERED WITH A CONTROL RATHER THAN AN ARGUMENT, WHICH
--    IS `0008`'s AND `0019`'s OWN DISCIPLINE.
--    `tests/db/membership-revocation.test.ts` §12 reads the trigger's `WHEN`
--    clause and the function body back OUT OF THE CATALOGUE
--    (`pg_get_triggerdef`, `pg_proc.prosrc`) and asserts that **both mention
--    `expires_at` and `revoked_at` together**, so a future edit that drops one
--    term from either is a RED GATE rather than a quiet reversal. That is the
--    seventh statement of one predicate, and it is the first one anything
--    checks.
--
--
-- ── MECHANICS, AND WHICH PART IS FORCED ────────────────────────────────
--
-- ⚠️ `CREATE OR REPLACE FUNCTION` RATHER THAN `DROP` + `CREATE`, WHICH IS
--    `0008`'s AND `0019`'s ARGUMENT FOR `ALTER POLICY`: a replace CANNOT
--    change the return type, so the function stays `RETURNS trigger`, and
--    every trigger referencing it keeps referencing it. `DROP FUNCTION` would
--    have to cascade to the trigger and recreate it blind.
--
-- 🛑 THE TRIGGER ITSELF IS DROPPED AND RECREATED, AND THAT IS FORCED, NOT
--    CHOSEN. **PostgreSQL has no `ALTER TRIGGER … WHEN`** — the condition is
--    not an alterable property. `0027` hit the identical wall for
--    `FOR ALL` → `FOR UPDATE` and recorded it the same way. The exposure a
--    drop-and-create carries is that the `CREATE` could be forgotten or
--    misspelled; `tests/db/membership-revocation.test.ts` §7 already reads
--    `pg_trigger` and asserts EXACTLY ONE non-internal trigger in schema
--    `tenant`, by name, so that failure is a red gate and not a silence.
--
-- ⚠️ THE IDENTIFIERS AND THE TWO DIAGNOSTIC STRINGS STILL SAY "REVOCATION",
--    AND THEY ARE NOW NARROWER THAN THE ACT THEY GUARD. That is left
--    deliberately: `CLAUDE.md` rules that *"cleanups are separate, isolated
--    commits, never folded into feature work"*, three suites assert on those
--    strings, and a rename inside a defect fix is a second change wearing the
--    first one's clothes. **It is owed, and naming it here is what stops it
--    being discovered.**
--
-- ⚠️ NO POLICY IS TOUCHED BY THIS FILE, AND THAT IS WORTH STATING BECAUSE IT
--    IS THE RISKIEST THING IT COULD HAVE DONE. `session_lapsed_member_read`
--    and `session_lapsed_member_rls` (`0027`) already carry the full liveness
--    predicate, and `session_selection_restrictive`'s third disjunct
--    (`0019`) requires only that a membership row EXIST, live or not — which
--    it does on either removal path. Nothing in the reach the trigger needs
--    changes. **G180's absent-membership arm is untouched**: a person who
--    never had a membership row still cannot have a session revoked, and
--    `tests/e2e/browser-login.test.ts` §12b is still the standing unmet
--    witness for it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- THE BODY. Unchanged from `0019` apart from GUARD 1c, which is new, and the
-- comments that argue it. `SECURITY INVOKER` is still stated by OMISSION and
-- `tests/db/membership-revocation.test.ts` §7 still reads
-- `pg_proc.prosecdef = false` from the catalogue, because that is exactly the
-- kind of claim a replace can lose in one word.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION tenant.void_sessions_on_membership_revocation()
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
  -- defect `0019` exists about.
  IF scoped_tenant IS NULL OR scoped_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION
      'membership revocation outside its own tenant scope: app.tenant_id is %, membership is %',
      coalesce(scoped_tenant, '<unset>'), NEW.tenant_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- GUARD 1b · PRECONDITION, THE RECORD. The same predicate
  -- `session_lapsed_member_rls` requires, asked again — so the trigger cannot
  -- run in a transaction whose sessions it would be unable to see.
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

  -- ═══════════════════════════════════════════════════════════════════
  -- GUARD 1c · PRECONDITION, THE PERSON IS ACTUALLY GONE. **NEW IN `0035`,
  --            AND IT IS DEFECT 2.**
  -- ═══════════════════════════════════════════════════════════════════
  --
  -- `0005` has no `UNIQUE (tenant_id, user_id)` on purpose, so one person may
  -- hold several live memberships. Ending ONE of them removes nobody, and the
  -- statements below would then sign a live member out — which is what a
  -- `BYPASSRLS` caller measurably did, because for such a caller
  -- `session_lapsed_member_read` is inert and hides nothing.
  --
  -- 🛑 THIS IS NOT THE POLICY'S TERM COPIED FOR SAFETY. It is the PRECONDITION
  --    THAT MAKES THE POLICY'S TERM TRUE. Past this point the person holds no
  --    live membership in this tenant, so `NOT EXISTS (live membership)`
  --    holds, so `expected` below is a count over the COMPLETE set rather
  --    than over the visible one. **That is the only thing that makes guard 2
  --    non-vacuous**, and `0019` believed guard 1b was doing it.
  --
  -- ⚠️ THE SUBQUERY IS NARROWED BY `membership_rls` FOR A NON-BYPASSRLS
  --    CALLER — `0005`'s measured fact, for the sixth time — and guard 1a has
  --    already required `app.tenant_id = NEW.tenant_id`, so the two roles read
  --    the same rows and reach the same answer. **That is the flip closed at
  --    its cause rather than at its symptom.**
  --
  -- ⚠️ `NEW` ITSELF CANNOT MATCH. The trigger's `WHEN` fires only when `NEW`
  --    is not live, so the row being written is excluded by the predicate
  --    rather than by an `id <> NEW.id` term — which would have been a second
  --    way of saying the same thing, and the wrong one, because it would also
  --    exclude `NEW` in a future `WHEN` that let a live row through.
  IF EXISTS (
    SELECT 1
      FROM tenant.membership m
     WHERE m.user_id    = NEW.user_id
       AND m.tenant_id  = NEW.tenant_id
       AND m.revoked_at IS NULL
       AND (m.expires_at IS NULL OR m.expires_at > now())
  ) THEN
    RETURN NULL;
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

  -- GUARD 2 · THE ROW-COUNT ASSERTION. The owner's second guard under G508,
  -- and the direct answer to G450's `rowCount = 0` that committed.
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


-- ---------------------------------------------------------------------
-- THE FIRING CONDITION. Dropped and recreated because `WHEN` is not
-- alterable; the argument is in the header, and §7's catalogue assertion is
-- what makes a forgotten `CREATE` a red gate.
-- ---------------------------------------------------------------------

DROP TRIGGER membership_revocation_voids_sessions ON tenant.membership;

CREATE TRIGGER membership_revocation_voids_sessions
  AFTER UPDATE ON tenant.membership
  FOR EACH ROW
  WHEN (
    NOT (
      NEW.revoked_at IS NULL
      AND (NEW.expires_at IS NULL OR NEW.expires_at > now())
    )
  )
  EXECUTE FUNCTION tenant.void_sessions_on_membership_revocation();

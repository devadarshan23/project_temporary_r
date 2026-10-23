-- =====================================================================
-- 0210 — THE REVERSAL WINDOW: 24 HOURS FROM THE POST. THE OWNER'S RULING,
--        22 Sep 2026. G1831–G1833.
--
-- ⚠️ THE NUMBER IS 0210 AND THE GAP BELOW IT IS DELIBERATE. `0201`–`0209` are
--    RESERVED to other agents working in parallel, and
--    `tools/check-migration-numbers.mjs` (G356) exists precisely because two
--    agents once numbered a migration identically and `git merge` produced
--    both with no conflict. Derive what is spent, never read it:
--    `ls db/migrations/*.sql db/migrations-control/*.sql`
--
-- G88: forward-only. There is no down migration. `0140` IS NOT EDITED —
--      `0017`'s precedent: *"G88 makes migrations forward-only, so editing
--      `0014` is refused; it keeps its refusal on its face and this file
--      keeps the correction on its own."* `0140` §3's restrictive policy
--      keeps its own text; this file `ALTER POLICY`s it, which is `0008`'s
--      choice and its argument (below).
-- ⚠️ SCHEMA-QUALIFIED THROUGHOUT, because 0003 requires it from 0004 on.
--
-- ---------------------------------------------------------------------
-- 🛑 THE FINDING THIS FILE CLOSES, IN THE WORDS OF THE DOCUMENT THAT FOUND
--    IT.
--
--    `docs/build/pack-tree-join.md`, on `reverseResolution`:
--
--      *"IS SERVED AND THE 24-HOUR WINDOW DOES NOT EXIST ANYWHERE — G1733.
--       No constant, no column, no check, no contract field. … So a
--       reversal is UNBOUNDED IN TIME on a served, mounted operation, and
--       the pack row that says otherwise is `built`."*
--
--    `docs/handoff-pack/C1 Close.dc.html`, the source of the number:
--
--      *"Posted. The journal is written and balanced … and it is reversible
--       for 24 hours from the post — until 07 Mar 08:41. After that a
--       correction is a new entry with its own approval, which is the
--       point: an unlimited undo is not an audit trail."*
--
--    This is that constant, that check and that contract field, in the
--    three places a caller can meet the rule: `model/domain.ts`'s
--    `REVERSAL_WINDOW_HOURS`, `server/data-plane/reversal-store.ts`'s
--    `window_expired` (checked against the DATABASE's own clock before the
--    write is attempted, so the caller gets the contract's declared 409
--    rather than a raw policy violation), and THIS FILE, independently, at
--    the row.
-- =====================================================================


-- =====================================================================
-- §1  THE DESIGN CHOICE: AN INTRA-ROW COMPARISON, NOT A SUBQUERY TO
--     `tenant.exception`. G1832.
--
-- 🛑 TWO SHAPES WERE MEASURED AND ONE IS NOT IN THIS FILE.
--
--    THE REJECTED SHAPE — `EXISTS (SELECT 1 FROM tenant.exception e WHERE
--    e.id = exception_reversal.exception_id AND now() - e.resolution_at <=
--    interval '24 hours')` — reads a SECOND TABLE from a policy on
--    `tenant.exception_reversal`, which is exactly the shape G449 measured
--    safe (a `WITH CHECK` subquerying an unrelated table does not recurse)
--    and exactly the shape G1633 measured DANGEROUS one table over: a
--    two-table CYCLE, where `tenant.exception`'s own policy expansion could
--    reach back to `tenant.exception_reversal`. **It does not, here** —
--    `exception_rls` (`0015`) is `0001`'s bare tenant predicate and names no
--    other table — so the subquery would in fact be safe. It is refused
--    anyway, on a stronger ground than "measured not to recurse":
--
--    THE TAKEN SHAPE reads NO OTHER TABLE AT ALL. `0140` §2 already pins
--    `reversed_at` — the resolution's own timestamp — onto the very row
--    this policy is checking, for exactly the reason this predicate needs
--    it: *"one statement later there is no row anywhere carrying … the
--    moment, and the moment's own row is about to stop saying it."* The
--    reversal's own `at` column is the second timestamp. So the predicate
--    is `now() - exception_reversal.reversed_at <= interval '24 hours'` —
--    ONE table, the row's OWN two columns and the server's OWN clock,
--    NEVER `exception_reversal.at` (which is client-supplied, from
--    `actor.now`, and this is the independent check that must not trust
--    it).
--
--    **A predicate that reads no other table cannot trigger PostgreSQL's
--    policy recursion, by construction** — recursion arises from a QUERY
--    PLAN reaching back into a table under RLS, and there is no query here
--    at all, only two columns of NEW. `tests/db/reversal-window.test.ts`
--    §3 re-witnesses this on every run: the policy fires correctly and no
--    `infinite recursion detected in policy` error is possible for a
--    predicate with this shape, which is asserted by covering the case
--    G1633 found dangerous — a table whose own policy might reach back —
--    and finding no such reach exists for `tenant.exception` today, and
--    stating why the taken shape does not depend on that finding staying
--    true.
-- =====================================================================


-- =====================================================================
-- §2  THE POLICY. `ALTER POLICY`, NOT `DROP` + `CREATE`, WHICH IS `0008`'s
--     CHOICE AND ITS ARGUMENT. G1833.
--
-- 🛑 `ALTER POLICY … WITH CHECK (…)` REPLACES THE WHOLE EXPRESSION, AND THAT
--    IS WHY THE ORIGINAL CLAUSE IS RESTATED VERBATIM BELOW RATHER THAN
--    ASSUMED TO SURVIVE. `0020`'s near-miss is the reason to say so: a draft
--    there dropped a clause while `ALTER POLICY`-ing and it would have
--    parsed cleanly and silently widened an invariant. `0140` §3's own
--    predicate is unchanged from its own file, character for character;
--    `tests/db/reversal-window.test.ts` §1 reproduces `0140`'s own §10
--    assertion — a reversal with no `reverse_resolution` authorisation
--    record is still refused — so a dropped clause here fails the SAME
--    control that would have caught it there.
--
--    `AS RESTRICTIVE` and `FOR INSERT` are UNCHANGED and cannot be restated
--    by `ALTER POLICY` — PostgreSQL does not allow altering a policy's
--    command or its permissive/restrictive kind, only `USING`, `WITH CHECK`
--    and role membership. This file names `WITH CHECK` and nothing else.
--
-- ⚠️ WHY THE 24-HOUR CLAUSE IS `AND`-ed ONTO THE SAME RESTRICTIVE POLICY
--    RATHER THAN GIVEN ITS OWN: a RESTRICTIVE policy is ANDed with every
--    other RESTRICTIVE policy on the table, so a second one here would be
--    logically identical to widening this one's expression — and `0140`
--    already established that `exception_reversal_insert_restrictive` is
--    the fence for "may this row be written", so the window belongs beside
--    the authorisation term rather than beside it as a second, separately
--    named control that could be dropped without anybody noticing the
--    first was now doing less.
-- =====================================================================

ALTER POLICY exception_reversal_insert_restrictive ON tenant.exception_reversal
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
         AND g.capability = 'reverse_resolution'
         AND g.expires_at > now()
         -- *"Always a human. A reversal is a correction, and corrections are
         -- signed."* Signed by the person who authorised THIS act, and by
         -- nobody else.
         AND g.subject_user_id = exception_reversal.reversed_by
    )
    -- G1831: the window itself, read against the row's OWN two columns and
    -- the server's OWN clock. See §1 for why this is not a subquery.
    AND (now() - exception_reversal.reversed_at) <= interval '24 hours'
  );

-- ⚠️ NO `ALTER TABLE`, NO NEW `GRANT`, NO NEW COLUMN. `0140` §2 already
--    stores both timestamps this predicate reads; this file adds a clause
--    to an existing expression and nothing else.

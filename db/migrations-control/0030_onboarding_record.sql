-- =====================================================================
-- CONTROL PLANE 0030 — H2's ONBOARDING STATE, PERSISTED. G1241/G1242/G1243
-- (20 Sep 2026).
--
-- **TWO TABLES, ONE TRIGGER, AND NO `stage` COLUMN — WHICH IS THE WHOLE
--   POINT OF THE FILE AND NOT AN OMISSION.**
--
-- `CLAUDE.md`, verbatim, because a paraphrased invariant is a changed
-- invariant:
--
--     "3. **The control plane publishes downward and never reads tenant
--      data.**"
--
-- THE OWNER'S RULING OF 20 Sep 2026, which this file applies:
--
--     "Onboarding state lives in a table in the CONTROL database, one row per
--      tenant, beside the roster — and `stage` is DERIVED at read time from
--      the stored step state, never stored twice."
--
-- ⚠️ **THE RULING IS THE OWNER'S. G1242 AND G1243 BELOW ARE DERIVED AND SAY
--    SO ON THEIR OWN FACES**, as G190, G356, G376, G511, G531, G533, G576,
--    G602, G782, G783, G832 and G834 do.
--
-- ═══════════════════════════════════════════════════════════════════════
-- WHY THE CONTROL DATABASE, IN THE RULING'S OWN TERMS.
-- ═══════════════════════════════════════════════════════════════════════
--
-- `platform-console.openapi.yaml` carries the argument on the operation
-- itself. `listOnboardingSteps`'s exemption text calls this state
-- *"1CloudHub's own delivery record about its own work"*, and that is the
-- definition of a control-owned fact under G831. **Invariant 3 is satisfied
-- by construction: a record of OUR delivery work is not tenant data**, and no
-- column below can be populated by reading one.
--
-- 🛑 THE TEST EVERY COLUMN HERE PASSED IS `0002_tenancy_roster.sql`'s:
--    **WHAT WOULD HAVE TO READ A TENANT'S DATA TO POPULATE IT?** For
--    `completed_steps` and for a forced mark the answer is *a staff person
--    ticking a box in the console* — `S1 Staff.dc.html`'s six-step panel, and
--    nothing else. `first_run` is the one to look at twice, because it reads
--    as a fact about the tenant: it is not. It is OUR record that we watched
--    a first run happen; the run itself lives in `public.run` in the other
--    database and nothing here counts, times or measures it.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 THE TWO REJECTED SHAPES, PRESERVED RATHER THAN SUMMARISED, BECAUSE THE
--    NEXT READER WILL REACH FOR ONE OF THEM AND THE SECOND HAS ALREADY BEEN
--    REFUSED ONCE BY NAME.
-- ═══════════════════════════════════════════════════════════════════════
--
--   (a) MAKE `stage` OPTIONAL ON THE WIRE. A one-line change to
--       `TenantSummary.required`, and `listTenants` mounts today with no
--       table at all. **REFUSED.** It does not remove the blocker, it removes
--       the ALARM: the tenancy pane then renders blank in the `Onboarding`
--       column for every tenant in the fleet, and `S1`'s roster is a screen
--       whose whole subject is *"where each one has got to"*. **The surface
--       lies by omission rather than by a missing field, and an omission is
--       the harder of the two to notice.** G656's finding is why the current
--       state is a blocker rather than a gap — `fast-json-stringify`
--       serialises without validating — and weakening the schema spends the
--       one thing that was catching it.
--
--   (b) A `stage` COLUMN ON `tenancy_roster`. **REFUSED, AND G833 REFUSED IT
--       FIRST, BY NAME, ON THAT MIGRATION'S OWN FACE:** *"A `stage` column
--       here would be a SECOND HOME for onboarding state … §5.3, with the
--       copy in the place a console reads."* Nothing about that has changed.
--       The state `model/onboarding.ts` owns is a PREFIX LENGTH and a list of
--       forced marks; a stage is a two-armed function OF that state. Storing
--       the function's output beside its input is two vocabularies for one
--       concept, **and the two drift the first time a step is forced** —
--       because forcing moves `completed` by more than one and every writer
--       would have to remember to move the other column too.
--
-- ⚠️ SO THERE IS NO `stage` COLUMN IN THIS FILE EITHER, AND
--    `tests/db/tenancy-roster.test.ts` §4a's ASSERTION IS UNCHANGED TO THE
--    CHARACTER. What changed is that `stage` now has a PRODUCER — a derived
--    one — and the producer is `model/onboarding.ts#onboardingStage()`,
--    called by `server/data-plane/console-roster-store.ts` and by nothing
--    else. **G833 is not discharged: it stands, and the mount happens
--    without it having to be.**
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 PROPERTY ONE: THE STATE IS A PREFIX LENGTH AND NOT A SET, AND THE
--    SCHEMA IS WHAT MAKES THAT TRUE HERE.
-- ═══════════════════════════════════════════════════════════════════════
--
-- `model/onboarding.ts` states it and gives the reason:
--
--     "§5.5 — DO NOT MAKE AN INVALID STATE REPRESENTABLE. The obvious shape
--      is `Record<OnboardingStepKey, boolean>` or a list of completed keys,
--      and both admit *"`pack_installed` done, `tag_policy` not"* — a state
--      the rules below can never produce and every reader would then have to
--      defend against."
--
-- **The obvious SQL is the obvious TypeScript wearing a different syntax**,
-- and there are two of them: six `boolean` columns, or a `completed_step`
-- child table with one row per finished step. Both make *"step four done,
-- step two not"* a row somebody can write, and a reader would then owe a
-- prefix check on every read for ever.
--
-- 🛑 SO THERE IS ONE INTEGER. A non-prefix onboarding has **nowhere to be
--    written down** in this schema — not "is rejected", not "is checked":
--    there is no column that could hold one. That is §5.5 in DDL, and it is
--    the same move `model/onboarding.ts` makes one layer up.
--
-- ⚠️ `CHECK (completed_steps >= 0)` AND **NO UPPER BOUND**, WHICH LOOKS LIKE
--    HALF A CONSTRAINT AND IS A DELIBERATE POLARITY — G1242. An upper bound
--    would be `<= 6`, and 6 is `ONBOARDING_STEPS.length`: a THIRD copy of the
--    sequence's length, in a database no wire-mirror pair addresses, which
--    G88's forward-only rule then freezes until somebody writes an `ALTER`.
--    **A seventh step would be legal in `model/` and refused by this file**,
--    and the failure would land on the writer rather than on the reader.
--    `0069_run_admission.sql` states the deciding half for vocabulary
--    columns and it is the same argument for a bound:
--
--        "an UNKNOWN value must reach the model as an `*_unreadable`
--         refusal, not be rejected at write time by a list somebody forgot
--         to extend."
--
--    `readConsoleRoster()` is where an out-of-range count is refused, by
--    name, as `completed_count_unreadable`, and it refuses the WHOLE read
--    rather than the row — see that module for why a roster missing one
--    tenant is the same failure `0002` refused an empty array for.
--    **The non-negative half is kept because it is not a copy of anything**:
--    a negative prefix length is not a value any sequence could have.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 PROPERTY TWO: THE FORCED MARK IS APPEND-ONLY, AND IT IS ENFORCED TWICE
--    BECAUSE THE TWO ENFORCEMENTS FAIL IN DIFFERENT DIRECTIONS — G1243.
-- ═══════════════════════════════════════════════════════════════════════
--
-- The contract calls the reason *"PERMANENT, AND THE ONLY RECORD OF WHY THE
-- SEQUENCE WAS BROKEN"* and adds *"there is no operation that clears it: a
-- gate that can be un-forced leaves no evidence it was ever forced."*
-- `model/onboarding.ts` turns that into a rule — *"A record a second write
-- can overwrite is not a permanent record"* — and diverges from `S1`'s
-- prototype, which keeps one slot and silently destroys the first reason on
-- a second force.
--
--   · THE PRIVILEGE. No role is granted `UPDATE` or `DELETE` on
--     `onboarding_forced_step`. That is `0010_authorisation_record.sql`'s
--     append-only-as-a-PRIVILEGE, carried across a database boundary, and it
--     additionally makes `INSERT … ON CONFLICT DO UPDATE` unreachable —
--     PostgreSQL requires `UPDATE` for the conflict arm, so **the upsert a
--     writer would reach for first is refused by the grant rather than by a
--     review.** `tests/db/control-plane-census.test.ts` §A enumerates it over
--     every relation and every serving role, so the next table cannot inherit
--     the claim without inheriting the check.
--
--   · THE TRIGGER. `onboarding_forced_step_is_append_only` RAISES on
--     `UPDATE`, on `DELETE` and on `TRUNCATE`.
--
-- 🛑 **WHY BOTH, AND WHY THE TRIGGER IS NOT A RESTATEMENT OF THE GRANT. THE
--    GRANT IS VACUOUS AGAINST THE ONLY WRITER THIS TABLE HAS.** Nothing on a
--    request path can write here — there is no `INSERT` grant either — so the
--    ONLY thing that writes a forced mark today is
--    `server/control-plane/provision.ts`, running as the **admin**, and an
--    admin holds every privilege by construction. A property enforced purely
--    by a withheld `GRANT` is therefore a property about a caller that does
--    not exist yet, and silent about the one that does. The trigger binds
--    every role in the cluster including the owner and the migrator, which is
--    what makes *"permanent"* a statement about the TABLE rather than about
--    the grant list.
--
-- ⚠️ THE `TRUNCATE` ARM IS A SEPARATE STATEMENT-LEVEL TRIGGER AND IT IS NOT
--    TIDINESS. A `FOR EACH ROW` trigger does not fire on `TRUNCATE` at all —
--    PostgreSQL has no per-row notion of it — so an append-only guarantee
--    resting on a row trigger alone is defeated by **one statement**, and
--    would look exactly like a guarantee right up until it was. Measured
--    before this file was written, against a row-trigger-only draft on a
--    fixture of this table's exact shape:
--
--        UPDATE onboarding_forced_step SET reason = 'x';  -> ERROR (raised)
--        DELETE FROM onboarding_forced_step;              -> ERROR (raised)
--        TRUNCATE onboarding_forced_step;                 -> TRUNCATE TABLE
--        SELECT count(*) FROM onboarding_forced_step;     -> 0
--
--    `tests/db/onboarding-record.test.ts` §3 re-witnesses all three on every
--    run, as the ADMIN, because a trigger somebody drops while tidying looks
--    exactly like a trigger somebody never wrote.
--
-- ⚠️ IT IS **NOT** `SECURITY DEFINER`, AND THE OBJECT IS REFUSED FOR G160's
--    REASON. It holds no authority of its own, reads no table and takes no
--    decision — it raises. `db/migrations/0019_membership_revocation_voids_
--    sessions.sql` is the precedent and `tests/db/membership-revocation.test.ts`
--    §7 reads `pg_proc.prosecdef` from the catalogue rather than trusting a
--    keyword to have been omitted; §3d here does the same.
--
-- 🛑 AND THIS IS THE FIRST TRIGGER AND THE FIRST FUNCTION THIS DATABASE HAS
--    EVER HAD. Derive it, never read it:
--    `grep -rn 'CREATE FUNCTION\|CREATE TRIGGER' db/migrations-control/`.
--    `0019` needed the same sentence written about the other database, and
--    `0005_session_and_membership.sql` says in its own voice that there must
--    never be one there — a claim `0019` had to overturn with an argument.
--    **There is no such claim in `db/migrations-control/`**, so nothing is
--    overturned here; what is spent is the fact that this set had none, and
--    it is spent for a property no privilege can express.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 NO ROW-LEVEL SECURITY AND NO POLICY, AND SAYING SO IS THE POINT RATHER
--    THAN LEAVING IT TO LOOK LIKE AN OMISSION.
-- ═══════════════════════════════════════════════════════════════════════
--
-- `0001_catalogue.sql` wrote the warning every later table here has to
-- answer, and `0002_tenancy_roster.sql` answered it for the first table with
-- a `tenant_id` column in it. Both of these tables carry one, so the answer
-- is owed twice and it is the same answer:
--
--     "Adding an empty policy here would be worse than adding none: it would
--      make a reader believe this database has a tenant boundary to enforce."
--
-- **There is no tenant session in this database and there cannot be one.**
-- `server/control-plane/start.ts`'s `ChannelPrincipal` is
-- `{ channel: 'local-development' }` and carries no tenant; nothing in
-- `server/control-plane/` imports `db/tenant-scope.ts`; and the DATA plane's
-- reach into this database is `db/control-read-scope.ts`, which sets **no
-- `app.*` GUC at all** and says at length why one would protect nothing.
-- Derive it: `grep -rn 'app\.tenant_id' db/migrations-control/` returns
-- nothing, and `tests/db/control-plane-census.test.ts` §B2 is the assertion.
--
-- A policy here would therefore be `USING (true)`, which is not a control, or
-- keyed on a GUC nothing sets, which under G100 denies unconditionally and
-- makes the roster unreadable by the only process that may read it.
--
-- ⚠️ SO THE ASSURANCE IS THE CENSUS, AND **THESE TWO TABLES JOIN IT
--    AUTOMATICALLY** — that is `tests/db/control-plane-census.test.ts`'s
--    whole design. It enumerates from `pg_class` rather than from a list, so
--    §A (no serving role writes anything) and §B (a `tenant_id` column is on
--    an ARGUED list) apply to this file the moment it applies. **Two
--    deliberate edits are owed there and are made in the same commit**: both
--    tables are added to `TENANT_COLUMN_BY_DESIGN` with the argument, and §C's
--    `CONSOLE_READABLE` widens from one table to three. §C is the one to read
--    — *"widening this list is a DECISION, not a fix."*
--
-- RULINGS THIS APPLIES (docs/HANDOFF.md §3):
--   G1241  onboarding state lives in the control database, one row per
--          tenant, and `stage` is DERIVED at read time. **THE OWNER'S.**
--   G1242  the prefix-length property is held by there being ONE INTEGER and
--          no upper bound; an out-of-range count is a READER refusal, not a
--          write-time rejection. DERIVED.
--   G1243  append-only is held by a TRIGGER as well as by a withheld grant,
--          because the grant is vacuous against the only writer that exists —
--          and the `TRUNCATE` arm is a second trigger because a row trigger
--          cannot see one. DERIVED.
--   G833   `stage` is refused as a column. **UNCHANGED AND NOT DISCHARGED**;
--          this file gives it a derived producer instead.
--   G832   the census enumerates from the catalogue, so these tables join it
--          by applying.
--   G193   two processes, two databases. Still two.
--   G97    every branded id is `text`. **THERE IS NO `uuid` IN THIS FILE.**
--   G88    forward-only. There is no `down`, and neither `0001_catalogue.sql`
--          nor `0002_tenancy_roster.sql` nor `0020_console_read_role.sql` is
--          edited by this file — no `ALTER TABLE`, no `ALTER POLICY`, no
--          `REVOKE`.
--
-- ⚠️ NOT SCHEMA-QUALIFIED, which is 0001's convention: there is no `tenant`
--    schema in this database and everything here is `public`.
--
-- ⚠️ THE NUMBER IS 0030 AND 0003–0019 AND 0021–0029 ARE GAPS OR RESERVED
--    ELSEWHERE. `tools/check-migration-numbers.mjs` reports a gap and
--    deliberately does not fail on one: a collision makes the order
--    ambiguous, a gap leaves it total.
-- =====================================================================


-- ---------------------------------------------------------------------
-- ONBOARDING_RECORD — one row per tenant, TWO columns, and the second one is
-- the whole of `OnboardingRecord.completed`.
--
-- 🛑 `tenant_id` IS A REAL FOREIGN KEY HERE, WHICH IS THE ONE THING
--    `0002_tenancy_roster.sql` COULD NOT HAVE. That file records the cost of
--    its own primary key: *"`tenant.tenant` lives in the OTHER database;
--    PostgreSQL has no cross-database reference. So a roster row can name a
--    tenant that does not exist."* **Both ends of THIS key are in THIS
--    database**, so the cost does not repeat: an onboarding row naming a
--    tenant with no roster entry is unrepresentable rather than refused.
--
-- ⚠️ AND THE CONVERSE IS NOT EXPRESSIBLE AND IS NAMED RATHER THAN LEFT: a
--    roster row with NO onboarding row is legal in SQL. Making it illegal
--    needs a circular `NOT NULL` reference or a deferred constraint, and
--    `0002` is not this file's to `ALTER` under G88. So it is refused at the
--    READER — `onboarding_record_absent`, a whole-read refusal — and the
--    reason it is not defaulted to `newOnboarding()` is on that module's
--    face: **an absent row cannot be told apart from a tenant created before
--    this table existed, and defaulting would publish `onboarding` about a
--    tenant that has been live for a year.** G511: the fence and the writer
--    are one commit or neither, and `createTenant` writes both rows or it is
--    not `createTenant`.
--
-- ⚠️ NO `started_at`, NO `completed_at`, NO `updated_at`, AND THE ABSENCE IS
--    G535's DELIBERATE ONE ARRIVING IN SQL. `model/onboarding.ts`:
--    *"`stalled` is not derivable here: it needs a timestamp per step
--    transition and a threshold, and neither has a producer."* A timestamp
--    column would give the first a producer and leave the second an
--    invention, and `onboardingStage()` would still answer two arms — so the
--    column would be read by nothing, which is
--    `0004_subject_ledger.sql`'s refusal. **`S1` draws `stalled · 19 days`
--    and this schema cannot say it. That is the honest state, and
--    `tests/model/onboarding.test.ts` §6 already asserts the absence one
--    layer up.**
-- ---------------------------------------------------------------------

CREATE TABLE onboarding_record (
  tenant_id       text    NOT NULL,
  -- HOW MANY STEPS ARE DONE, counted from the front. `0` is a tenant that has
  -- just been created — `model/onboarding.ts#newOnboarding()` — and it is the
  -- ordinary starting value rather than a sentinel, which is why there is no
  -- DEFAULT: a writer that did not say must not be given an answer.
  completed_steps integer NOT NULL,

  PRIMARY KEY (tenant_id),
  CONSTRAINT onboarding_record_tenant_is_on_the_roster
    FOREIGN KEY (tenant_id) REFERENCES tenancy_roster (tenant_id),
  -- See the header: NON-NEGATIVE ONLY. The upper bound is
  -- `ONBOARDING_STEPS.length`, and a copy of it here is a third home for the
  -- sequence's length that G88 then freezes.
  CONSTRAINT onboarding_record_completed_is_a_prefix_length
    CHECK (completed_steps >= 0)
);


-- ---------------------------------------------------------------------
-- ONBOARDING_FORCED_STEP — one row per forced gate. APPEND-ONLY.
--
-- Mirrors `model/onboarding.ts#ForcedStep`, which has exactly two fields:
--
--   step   -> step     the gate that was forced
--   reason -> reason   PERMANENT, free text, and OURS
--
-- 🛑 THE PRIMARY KEY IS `(tenant_id, step)` AND THAT IS THE PROTOTYPE'S
--    DIVERGENCE MADE STRUCTURAL. `S1` holds `forced:{t, i, why}` — ONE slot —
--    so forcing a second gate overwrites the first reason. Here a second
--    force of the SAME step is a key violation and a force of a DIFFERENT
--    step is a second row, which is precisely
--    `forceStep()`'s *"APPEND. Nothing in this module removes an entry."*
--
-- ⚠️ `reason` IS FREE TEXT AND INVARIANT 6 IS NOT IN PLAY, WHICH IS WORTH
--    STATING BECAUSE EVERY OTHER TEXT COLUMN IN THIS DATABASE IS AN
--    IDENTIFIER OR A CLOSED VOCABULARY. *"Ingested content is data, never
--    instruction"* governs COUNTERPARTY-authored text;
--    `model/onboarding.ts` names the direction — *"this is OUR prose, not a
--    counterparty's"* — a staff person typed it into `S1`'s modal. It is
--    stored verbatim and parsed by nothing.
--
-- ⚠️ NO `CHECK` ON `step`, WHICH IS `0007_run_engine_account.sql`'s DECISION
--    AND `0069`'s POLARITY. A `CHECK (step IN (…))` would be a THIRD copy of
--    `ONBOARDING_STEPS` — the tuple, the `S1` prototype, and here — in a
--    database no wire-mirror pair addresses. An unrecognised step reaches
--    `readConsoleRoster()` as `forced_step_unreadable` and refuses the read.
--    🛑 THAT REFUSAL IS NOT OPTIONAL AND IS NOT A CONVENIENCE: a reader that
--    merely failed to match an unknown key would DROP the forced mark and
--    publish the tenant as ordinarily `done` — **silently losing the only
--    record of why the sequence was broken**, which is the exact harm the
--    append-only trigger above exists to prevent, arriving through the
--    reader instead of through a write.
--
-- ⚠️ NO `forced_at` AND NO `forced_by`, AND BOTH ARE OWED RATHER THAN
--    REFUSED — `model/onboarding.ts` says so at the declaration and this file
--    inherits it: *"The commit that gives this a table owes both — 'a review
--    asking why a first period was wrong reads the reason in the words of the
--    person who decided it', and 'the person' is not in this record yet."*
--    **They are not added here because `ForcedStep` does not declare them**,
--    and a column ahead of the interface is a column with no reader —
--    `0004_subject_ledger.sql`. The commit that adds them adds them to
--    `model/onboarding.ts` FIRST, in the same commit, or it has built the
--    second vocabulary this file spends four paragraphs refusing.
--
-- ⚠️ NO `CHECK (length(btrim(reason)) >= 7)`, REFUSED BY NAME. The floor is
--    `MIN_FORCE_REASON_CHARS` in `model/onboarding.ts` and `minLength: 7` on
--    `ForceStepRequest.reason` in the contract — TWO homes already, and the
--    wire and the model are joined by a person reading both. A third, in SQL,
--    would be the one that drifts and the one G88 freezes; and it would guard
--    a writer that does not exist, since no role holds `INSERT`.
-- ---------------------------------------------------------------------

CREATE TABLE onboarding_forced_step (
  tenant_id text NOT NULL,
  step      text NOT NULL,
  reason    text NOT NULL,

  PRIMARY KEY (tenant_id, step),
  CONSTRAINT onboarding_forced_step_tenant_is_on_the_roster
    FOREIGN KEY (tenant_id) REFERENCES tenancy_roster (tenant_id)
);


-- ---------------------------------------------------------------------
-- THE APPEND-ONLY TRIGGER — G1243.
--
-- Read the header before changing anything here. The short version: the
-- withheld `UPDATE`/`DELETE` grant is a property about a request path that
-- does not exist yet, and this is the property about the ADMIN, which is the
-- only writer this table has today.
--
-- ⚠️ `RETURN NULL` IS NEVER REACHED AND IS THERE BECAUSE PostgreSQL REQUIRES
--    A `trigger` RETURN TYPE. The `RAISE` is the whole body.
-- ---------------------------------------------------------------------

CREATE FUNCTION onboarding_forced_step_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'public.onboarding_forced_step is APPEND-ONLY: % is refused'
    , TG_OP
    USING HINT =
      'A forced onboarding gate records WHY the sequence was broken, and the '
      'contract calls that reason "PERMANENT, AND THE ONLY RECORD OF WHY THE '
      'SEQUENCE WAS BROKEN". model/onboarding.ts: "A record a second write can '
      'overwrite is not a permanent record." Correcting a mark means appending '
      'a new fact, not editing the old one — and if that is genuinely needed, '
      'the ruling it requires is the one that decides what a correction MEANS.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER onboarding_forced_step_is_append_only
  BEFORE UPDATE OR DELETE ON onboarding_forced_step
  FOR EACH ROW
  EXECUTE FUNCTION onboarding_forced_step_append_only();

-- 🛑 A SECOND TRIGGER, AND IT IS NOT A DUPLICATE. A `FOR EACH ROW` trigger
--    does not fire on `TRUNCATE` — there are no rows to fire per — so the one
--    above is defeated by a single statement. Measured; see the header.
CREATE TRIGGER onboarding_forced_step_is_not_truncatable
  BEFORE TRUNCATE ON onboarding_forced_step
  FOR EACH STATEMENT
  EXECUTE FUNCTION onboarding_forced_step_append_only();


-- ---------------------------------------------------------------------
-- GRANTS. `SELECT` to the CONSOLE READER, and to NOBODY ELSE.
--
-- 🛑 `reconcile_control_app` GETS NOTHING, WHICH IS A NARROWING RATHER THAN
--    AN OVERSIGHT AND IS `0020_console_read_role.sql`'s OWN ARGUMENT RUN IN
--    REVERSE. That file describes the app role's `SELECT` set as *"the set of
--    everything this database publishes downward to the whole fleet"*. **This
--    is not published downward to anybody**: no contract operation on
--    `control-plane.openapi.yaml` names an onboarding step, the control plane
--    mounts one operation, and a tenant's own data plane has no business
--    reading 1CloudHub's delivery notes about it. A grant there would be a
--    privilege ahead of a reader in the one direction `0004_subject_ledger.sql`
--    did not have to name, because the reader would be a whole other plane.
--
-- 🛑 NO `INSERT`, NO `UPDATE`, NO `DELETE`, TO ANY ROLE. **THE WRITER IS
--    `completeOnboardingStep` / `forceOnboardingStep` AND NEITHER IS MOUNTED**
--    — both are `platform-console.openapi.yaml`'s, both are gated, and
--    `0004_subject_ledger.sql`'s rule is the whole reason this block has one
--    verb in it: *a write privilege ahead of a writer*. Ask what a path that
--    could write here would be able to do, which is the test `0002` sets:
--    it could mark a tenant's onboarding COMPLETE — making `stage` read
--    `live` for a tenant nobody has bound a source for — or it could FORGE
--    the permanent record of why a step was forced, which is the one row in
--    this database whose entire purpose is to be evidence in a review.
--
-- 🛑 ⚠️ **TWO CLAUSES OF THE PARAGRAPH ABOVE WERE FACTUALLY WRONG WHEN IT WAS
--    WRITTEN, AND THEY ARE THE TWO THE WHOLE GRANT ARGUMENT RESTED ON. THEY
--    ARE CORRECTED HERE RATHER THAN EDITED AWAY** — G88 makes this file
--    forward-only and `0017_usage_record_actor.sql` is the precedent for a
--    successor keeping the correction on its own face — **because a reader
--    checking whether the refusal still holds would have gone to
--    `platform-console.openapi.yaml` and found nothing at all.**
--
--    **Measured, 21 Sep 2026:**
--
--        grep -c 'completeOnboardingStep\|forceOnboardingStep' \
--          docs/contracts/platform-console.openapi.yaml        -> 0
--
--    Both operations are, and always were, in
--    `docs/contracts/administration.openapi.yaml`; and **neither was gated** —
--    both carried `x-capability: 'exempt: …'`. So *"both are gated"* described
--    no operation in the corpus, and **the argument for withholding a write
--    privilege rested on a gate that did not exist.** The refusal was right;
--    its stated reason was not.
--
--    ✅ **R8 (21 Sep 2026, THE OWNER'S) MAKES THE GATE REAL** — both are
--    annotated `view_substrate` in place, which G911 made representable on
--    that tier by retiring `TIER_REQUIRES_CAPABILITY` — **and R9 gives the
--    write its privilege**, in `0040_onboarding_writer.sql`, to a role this
--    file had never heard of. **The grants below are NOT edited**: this file
--    still grants `SELECT` and nothing else, to the reader and nobody else,
--    and every write privilege lives in `0040` where a reviewer meets it
--    beside the trigger that pays for it.
--
--    ⚠️ **AND THE REFUSAL OF `INSERT` ON `onboarding_record` SURVIVES `0040`
--    UNTOUCHED AND IS THE NARROWEST THING IN EITHER FILE.** The serving role
--    may ADVANCE a delivery record and may not CREATE one: the initial row is
--    the admin's, at provisioning time, because a path that could INSERT here
--    could mint a delivery record for a tenant nobody onboarded — and
--    `readConsoleRoster()`'s `onboarding_record_absent`, the refusal that
--    takes the WHOLE roster down, would stop firing for exactly the row that
--    should have fired it.
--
-- ⚠️ `GRANT USAGE ON SCHEMA public` IS NOT REPEATED for either role: `0001`
--    granted it to the app role and `0020` to the reader, and G88 makes those
--    grants this database's rather than those files'.
-- ---------------------------------------------------------------------

GRANT SELECT ON onboarding_record      TO reconcile_control_reader;
GRANT SELECT ON onboarding_forced_step TO reconcile_control_reader;

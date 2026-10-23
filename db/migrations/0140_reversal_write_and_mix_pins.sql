-- =====================================================================
-- 0140 — UNDOING A RESOLUTION, AND THE THREE FACTS THAT SURVIVE THE UNDOING.
--        G946, G947, G948, G949. 20 Sep 2026.
--
-- ⚠️ THE NUMBER IS 0140 AND THE GAP BELOW IT IS DELIBERATE. `0092`–`0139` are
--    RESERVED to other agents working in parallel, and
--    `tools/check-migration-numbers.mjs` (G356) is the gate's stage that exists
--    because two agents each wrote an `0011` on 19 Sep 2026 and **`git merge`
--    produced both files with NO CONFLICT**. Derive what is spent, never read
--    it:  `ls db/migrations/*.sql db/migrations-control/*.sql`
--
-- G88: forward-only. There is no down migration. **`0015` IS NOT EDITED AND
--      `0059` IS NOT EDITED.** `0017`'s precedent: *"G88 makes migrations
--      forward-only, so editing `0014` is refused; it keeps its refusal on its
--      face and this file keeps the correction on its own."* `0015`'s
--      `GRANT SELECT` on `tenant.exception_reversal` and `0059`'s trigger both
--      keep their own text; this file records what changed and why.
-- ⚠️ SCHEMA-QUALIFIED THROUGHOUT, because 0003 requires it from 0004 on.
--
-- ---------------------------------------------------------------------
-- 🛑 WHAT THIS FILE IS FOR, IN THE TWO SENTENCES THE FILES IT UNBLOCKS WROTE
--    ABOUT THEMSELVES.
--
--    `server/data-plane/proposals.ts`:
--
--      *"OBSTACLE 2 · THE PRIVILEGES. 🟠 HALF CLOSED … `tenant.
--       exception_reversal` still has `GRANT SELECT` only, so the act's own
--       row — the reversal itself — cannot be written, and mounting the
--       operation today would still answer 500 on the happy path."*
--
--    `tests/db/resolution-chain.test.ts` §10, on why the grant was not taken
--    there:
--
--      *"the `GRANT INSERT` is not taken here because `0004`'s rule binds in
--       both directions and G511 states it in one line — the fence and the
--       writer are one commit or neither."*
--
--    **This is that commit.** `server/data-plane/reversal-store.ts` and
--    `reverseResolution`'s mount in `server/data-plane/exceptions.ts` land in
--    it. Delete either and this migration becomes `0004`'s refusal — a write
--    privilege ahead of its writer — and must be deleted with them.
--
-- ---------------------------------------------------------------------
-- 🛑 AND A SECOND OPERATION LANDS ON THE SAME THREE COLUMNS, WHICH IS WHY THEY
--    ARE HERE RATHER THAN IN A LATER FILE. G948.
--
--    `getDispositionMix` — C11's report — publishes, per disposition, a
--    `count` and a `reversalRate`. The contract's own gloss is the whole
--    argument for the pins in §2: *"a disposition CHOSEN four hundred times
--    and reversed a third of the time was not the success its volume
--    suggests."* **`count` counts CHOICES, and `reversalRate`'s denominator is
--    that same count.**
--
--    A reversal CLEARS `tenant.exception.resolution_*` — `model/domain.ts`:
--    *"The current resolution. Null while unresolved, and cleared on
--    reversal."* So the moment `reverseResolution` mounts, a reversed choice
--    leaves NO trace of which disposition was chosen, in which mode, or when.
--    **Without §2 the report would then publish `reversalRate: 0` for every
--    disposition and a `count` that silently loses every reversed choice** —
--    two wrong numbers, published as an answer, with nothing to notice them.
--    That is the failure `0059` names at length: *"`fast-json-stringify`
--    SERIALISES a response; it does not VALIDATE one"*, one step worse,
--    because these fields are PRESENT and WRONG rather than absent.
--
-- =====================================================================


-- =====================================================================
-- §1  THE WRITE — `GRANT INSERT` ON `tenant.exception_reversal`, AND NOTHING
--     WIDER. G946.
--
-- 🛑 `INSERT` ONLY. **NO `UPDATE`, NO `DELETE`, AND NEITHER IS AN OVERSIGHT.**
--    `0010`'s append-only-as-a-PRIVILEGE, carried across for the fourth time.
--
--      An `UPDATE` would let a request path REWRITE A CORRECTION — change
--      `reason` from `wrong_disposition` to `data_corrected` and the reversal
--      stops indicting the autonomy that produced it, which is
--      `AutonomyDials.reversalRate` edited from a handler. It would also let a
--      path move `reversed_by`, and *"a reversal is a correction, and
--      corrections are signed."*
--
--      A `DELETE` would let a path erase the correction entirely. *"Reversals
--      accumulate as an array. An exception resolved, reversed, re-resolved
--      and reversed again is a signal in itself, and a flag would have erased
--      it."* A `DELETE` is that flag with extra steps.
--
-- ⚠️ NO `GRANT` ON `tenant.exception` IS NEEDED OR TAKEN HERE. `0059` already
--    grants `UPDATE` on `status` and the six `resolution_*` columns, which is
--    exactly what a reversal needs to CLEAR one — and `0059` said so in
--    advance: *"`tenant.exception` now takes `GRANT UPDATE` on its resolution
--    columns and on `status`, which is the half a reversal needs to CLEAR
--    one."* The five columns `0015` refused — `severity`, `severity_rank`,
--    `value_at_risk_*`, `explanation_*`, `cost_centre`/`legal_entity` — stay
--    unwritable and `tests/db/exception-register.test.ts` §2 still asserts it.
--
-- ⚠️ NO NEW RLS BLOCK. `0015` ENABLEs **and** FORCEs row-level security on
--    this table and carries `0001`'s predicate VERBATIM on `USING` **and** on
--    `WITH CHECK`, so the `INSERT` granted here is tenant-fenced by a policy
--    that already existed. A column and a privilege inherit the table's RLS;
--    `0011` established that inheritance is WITNESSED rather than assumed, and
--    `tests/db/resolution-chain.test.ts` §9 already drops a policy on this
--    schema and requires the read to fail closed. ⚠️ **THE DROPPED-POLICY
--    CONTROL FOR *THIS* TABLE IS NOT WRITTEN AND IS NAMED RATHER THAN
--    IMPLIED**: §10 witnesses the restrictive policy of §3 refusing a write
--    with no record, which is a different property. The tenant fence on this
--    `INSERT` is `0015`'s and is inherited, and the commit that doubts it owes
--    the negative control rather than a paragraph.
-- =====================================================================

GRANT INSERT ON tenant.exception_reversal TO tenant_rw;


-- =====================================================================
-- §2  THE THREE PINS — WHAT THE REVERSAL UNDID. G947.
--
-- 🛑 READ WHY THESE ARE COLUMNS AND NOT A JOIN, BECAUSE A JOIN IS THE OBVIOUS
--    FIRST ANSWER AND IT DOES NOT SURVIVE THE ACT.
--
--    A reversal NULLs `tenant.exception.resolution_mode`,
--    `resolution_disposition_key`, `resolution_proposal_id`,
--    `resolution_decided_by`, `resolution_executed_by` and `resolution_at`.
--    After that write there is no row anywhere carrying "this exception was
--    settled as `write_off`, in `approved` mode, at 14:05" — the proposal
--    survives in `tenant.resolution_proposal`, but a PROPOSAL IS NOT A
--    RESOLUTION: most proposals are never executed, and `executed` is decided
--    by `tenant.exception.resolution_proposal_id`, the column being cleared.
--    **The link that would have carried the join is the link the act
--    destroys.**
--
-- ⚠️ THIS IS `0015`'s OWN PATTERN AND NOT A NEW ONE. That file pins
--    `rule_version` (*"Pins the rule as it was when this fired"*) and
--    `rule_label` (*"AS IT WAS PINNED at `rule_version` — a rule renamed since
--    does not silently drop older exceptions out of the filter"*). These three
--    pin the RESOLUTION as it was when it was undone, for the same reason: the
--    fact is about a moment, and the moment's own row is about to stop saying
--    it.
--
-- 🛑 ALL THREE ARE `NOT NULL`, AND THE `NOT NULL` IS HALF OF EVERY CLAIM THE
--    REPORT MAKES — G411's finding, applied one table over. A nullable pin
--    means `getDispositionMix` has to decide what an unattributable reversal
--    counts as, and every available answer is a wrong number rather than a
--    refusal. There is no null case to decide: the operation's own 409 is
--    *"there is no resolution to reverse"*, so a reversal row EXISTS ONLY
--    BECAUSE a resolution existed, and the three facts are the ones it had.
--
-- ⚠️ `ADD COLUMN … NOT NULL` WITH NO `DEFAULT` REFUSES TO APPLY AGAINST A
--    TABLE THAT ALREADY HOLDS A ROW, AND THAT REFUSAL IS WANTED RATHER THAN
--    WORKED AROUND. Until this file, `tenant.exception_reversal` held
--    `GRANT SELECT` and nothing else and no migration inserts into it — so a
--    database with a row here has one nobody had a privilege to write, which
--    is a fact somebody must look at before this migration lands. Failing
--    loudly at `0140` is the fail-closed direction; a `DEFAULT ''` would mint
--    a disposition key that names nothing and the report would count it.
--
-- ⚠️ NEITHER THE MODEL NOR THE WIRE GAINS A FIELD, AND THAT IS DELIBERATE.
--    `ExceptionReversal` is `{ at, reversedBy, reason, note, newStatus,
--    correctedDispositionKey }` and stays so; `getException` publishes exactly
--    those six. **These three are a STORAGE fact, read by one report and by
--    nothing else.** Putting them on the wire would publish the undone
--    resolution beside the reversal as though it were still a resolution,
--    which is the state the model's own *"cleared on reversal"* exists to make
--    unrepresentable. `tests/http/proposal-chain-served.test.ts` §10 asserts
--    the three are ABSENT from the served `reversals[]` entry, over a socket,
--    which is where the absence is observable at all — `fast-json-stringify`
--    DROPS rather than refuses, so `additionalProperties: false` would not
--    have caught a leak.
--
-- ⚠️ AND NO `GRANT` LINE FOLLOWS THEM. `0011` measured that a column added to
--    an existing table inherits that table's privileges — `0015`'s
--    `GRANT SELECT` and §1's `GRANT INSERT` both cover a column added later —
--    and inventing a column-level grant here would be a second, narrower
--    statement of a privilege the table already carries.
-- =====================================================================

ALTER TABLE tenant.exception_reversal
  ADD COLUMN reversed_disposition_key text        NOT NULL,
  ADD COLUMN reversed_mode            text        NOT NULL,
  ADD COLUMN reversed_at              timestamptz NOT NULL;

-- ⚠️ NO `CHECK` ON `reversed_mode`, AND IT IS `0002_run.sql`'s RULE RATHER
--    THAN AN OMISSION: a CHECK here would be a third copy of a closed enum
--    *"and the one nothing checks, because no pair in the wire-mirror
--    addresses SQL."* The narrowing happens where it can be DERIVED —
--    `server/data-plane/exception-vocabulary.ts`'s `isResolutionMode()`,
--    against `model/domain.ts` — and an out-of-vocabulary row is a 500 with
--    the column named, never a silently dropped row. A dropped row is a
--    disposition whose count is quietly short, which is the one failure this
--    report must not have.


-- =====================================================================
-- §3  THE ACTOR IS READ OFF THE RECORD, NOT TAKEN FROM THE HANDLER. G948.
--
-- `0059`'s `approval_decision_insert_restrictive` shape, taken a second time
-- and for the same reason its own header gives: the row's actor column is
-- compared against `tenant.authorization_grant.subject_user_id` — the record
-- THIS act minted, named by `app.authorisation_ref` — so **a handler that
-- passed somebody else's id has its INSERT refused rather than its lie
-- stored.**
--
-- 🛑 THE CAPABILITY TERM IS THE OTHER HALF AND IT IS NOT DECORATION. Without
--    it, any act holding any verb could write a reversal by naming its own
--    record; with it, the row can only be written inside an act that
--    `decide()` allowed for `reverse_resolution` specifically. That is the
--    gate's own verdict, re-read at the row, and `0020`'s sentence applies
--    unchanged: it is *"exactly as strong as invariant 1's own fence and no
--    stronger"*, and what it buys is that a forged reference is INERT.
--
-- ⚠️ `AS RESTRICTIVE … FOR INSERT … WITH CHECK` AND **NO `USING`**, which is
--    `0020`'s measurement rather than an omission: `FOR INSERT` has no `USING`
--    to state, and a policy whose expression reads its own table is
--    PostgreSQL's policy recursion. The permissive tenant policy `0015`
--    installed still governs the tenant term; this narrows, it does not
--    replace.
--
-- 🛑 NOTHING HERE CHECKS WHETHER THERE *WAS* A RESOLUTION. That is the
--    operation's 409 and it belongs in the handler, where it can be a
--    `validation_failed` problem document rather than a `42501` the caller
--    cannot read. The database refuses the things a rewritten handler must
--    still not be able to do; it is not a second copy of the handler.
-- =====================================================================

CREATE POLICY exception_reversal_insert_restrictive ON tenant.exception_reversal
  AS RESTRICTIVE
  FOR INSERT
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
  );


-- =====================================================================
-- §4  THE TRIGGER LEARNS ONE MORE VERB, AND ONLY IN ONE DIRECTION. G949.
--
-- `0059`'s `tenant.exception_resolution_requires_record()` is REPLACED, not
-- edited in place in `0059` — G88 again — and the TRIGGER IS NOT TOUCHED: its
-- `WHEN` clause already fires on `status` and on all six `resolution_*`
-- columns, which is exactly the set a reversal writes. `0035` established
-- replacing a function under a trigger that keeps its own definition; the
-- difference from `0035` is that there the firing condition moved and here it
-- does not, so there is no `DROP`/`CREATE TRIGGER` in this file.
--
-- ┌─ WHY THE FUNCTION HAD TO MOVE AT ALL ──────────────────────────────────────┐
-- │ `0059` GUARD 1 reads *"A RESOLUTION IS WRITTEN BY AN EXECUTION AND BY      │
-- │ NOTHING ELSE"* and demands an `execute_resolution` record for ANY change   │
-- │ to the six columns. A reversal changes all six — to NULL — under a         │
-- │ `reverse_resolution` record. **Unmodified, `0059` refuses the reversal**,  │
-- │ and `reverseResolution` would answer 500 for a reason nobody would guess   │
-- │ from the grants.                                                           │
-- │                                                                            │
-- │ GUARD 2 names three verbs on `status` — propose, approve, execute — and    │
-- │ calls them *"the closed set of verbs the contract declares on this         │
-- │ column, and a fourth would arrive with its own migration and its own line  │
-- │ here."* **This is that fourth verb and this is that line.** The contract   │
-- │ declares `newStatus` as `reverseResolution`'s own required body field —    │
-- │ *"Where it goes. Usually back to `open`."*                                 │
-- └────────────────────────────────────────────────────────────────────────────┘
--
-- 🛑 THE WIDENING IS DIRECTIONAL AND THE DIRECTION IS THE WHOLE CONTROL.
--    `reverse_resolution` may CLEAR a resolution and may not MINT one. The new
--    arm fires only when every one of the six columns is going to NULL from a
--    row that had a resolution; anything else falls through to GUARD 1 and
--    still demands `execute_resolution`.
--
--    **That is the contract's own fear, expressed in SQL.** It refuses an
--    agent this operation because *"an agent that can undo its own resolutions
--    can launder a bad one"*, and the laundering move is undo-then-redo in one
--    act. A `reverse_resolution` record that could write a disposition key
--    would be exactly that: a second, unapproved resolution wearing a
--    correction's name. `tests/db/resolution-chain.test.ts` §11 drives it —
--    ONE act, ONE `reverse_resolution` record, a clearing UPDATE that is
--    PERMITTED and then a minting UPDATE that is REFUSED, so the two arms are
--    witnessed against the same record rather than against two fixtures.
--
-- ⚠️ AN EXECUTOR MAY NO LONGER CLEAR, AND THAT IS NARROWING RATHER THAN
--    LOSS. Before this file `execute_resolution` satisfied every resolution
--    write including a clearing one; after it, a clearing write demands
--    `reverse_resolution`. Nothing in `server/` clears under
--    `execute_resolution` — `executeProposalNow()` only ever SETS — so no
--    behaviour is removed, and the statement is now the true one: the only act
--    that unmakes a resolution is the act named for unmaking one.
--
-- ⚠️ THE SCOPE GATE AND THE TENANT CHECK ARE `0059`'s, COPIED VERBATIM AND NOT
--    RE-REASONED. A writer with no `app.tenant_id` returns early and is
--    ungoverned; the only writer that can reach that line is a `BYPASSRLS` one
--    — the MIGRATOR — because G100's deny-on-NULL means a `NOBYPASSRLS` role
--    with no scope SEES NO ROW and can therefore UPDATE none. `0059` states
--    the residual and it is unchanged: a compromised migrator can write
--    anything here, and no trigger changes that.
--
-- 🛑 NOT `SECURITY DEFINER`, exactly as `0019`, `0035` and `0059` are not —
--    and it is a `CREATE OR REPLACE` of a function `0059` created without the
--    keyword, so the property is inherited rather than re-declared.
--    ⚠️ **THE CATALOGUE READ IS NOT WRITTEN FOR THIS REPLACEMENT AND IS NAMED
--    RATHER THAN IMPLIED.** `tests/db/membership-revocation.test.ts` §7 reads
--    `pg_proc.prosecdef` for `0019`'s function and §12 reads `pg_proc.prosrc`
--    back for `0035`'s predicate; **no equivalent exists for this one**, so
--    what stands behind the two new terms is `tests/db/resolution-chain.test.ts`
--    §11 — a BEHAVIOURAL witness, which catches a deleted all-NULL test and
--    would NOT catch a `SECURITY DEFINER` added later. That gap is stated
--    here because a successor reading `0019`'s precedent would otherwise
--    assume the catalogue control came across with the shape.
-- =====================================================================

CREATE OR REPLACE FUNCTION tenant.exception_resolution_requires_record()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = tenant, pg_catalog
AS $$
DECLARE
  scoped_tenant text := nullif(current_setting('app.tenant_id', true), '');
  ref           text := nullif(current_setting('app.authorisation_ref', true), '');
  resolution_changed boolean;
  resolution_cleared boolean;
BEGIN
  -- THE SCOPE GATE. See the header: no scope means no request path.
  IF scoped_tenant IS NULL THEN
    RETURN NEW;
  END IF;

  IF scoped_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION
      'exception resolution outside its own tenant scope: app.tenant_id is %, exception is %',
      scoped_tenant, NEW.tenant_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  resolution_changed :=
       OLD.resolution_mode            IS DISTINCT FROM NEW.resolution_mode
    OR OLD.resolution_disposition_key IS DISTINCT FROM NEW.resolution_disposition_key
    OR OLD.resolution_proposal_id     IS DISTINCT FROM NEW.resolution_proposal_id
    OR OLD.resolution_decided_by      IS DISTINCT FROM NEW.resolution_decided_by
    OR OLD.resolution_executed_by     IS DISTINCT FROM NEW.resolution_executed_by
    OR OLD.resolution_at              IS DISTINCT FROM NEW.resolution_at;

  -- 🛑 THE CLEARING SHAPE, AND EVERY TERM IS LOAD-BEARING. The row HAD a
  --    resolution and is going to hold NONE OF IT. A write that leaves any one
  --    of the six set is not a clearing write and does not reach GUARD 1a.
  resolution_cleared :=
        OLD.resolution_mode            IS NOT NULL
    AND NEW.resolution_mode            IS NULL
    AND NEW.resolution_disposition_key IS NULL
    AND NEW.resolution_proposal_id     IS NULL
    AND NEW.resolution_decided_by      IS NULL
    AND NEW.resolution_executed_by     IS NULL
    AND NEW.resolution_at              IS NULL;

  IF resolution_changed THEN
    -- GUARD 1a · A RESOLUTION IS UNMADE BY A REVERSAL AND BY NOTHING ELSE.
    IF resolution_cleared THEN
      IF NOT EXISTS (
        SELECT 1
          FROM tenant.authorization_grant g
         WHERE g.id         = ref
           AND g.tenant_id  = NEW.tenant_id
           AND g.capability = 'reverse_resolution'
           AND g.expires_at > now()
      ) THEN
        RAISE EXCEPTION
          'exception resolution cleared with no reverse_resolution authorisation record: app.authorisation_ref is %',
          coalesce(ref, '<unset>')
          USING ERRCODE = 'insufficient_privilege';
      END IF;
      RETURN NEW;
    END IF;

    -- GUARD 1 · A RESOLUTION IS WRITTEN BY AN EXECUTION AND BY NOTHING ELSE.
    IF NOT EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = ref
         AND g.tenant_id  = NEW.tenant_id
         AND g.capability = 'execute_resolution'
         AND g.expires_at > now()
    ) THEN
      RAISE EXCEPTION
        'exception resolution carries no execute_resolution authorisation record: app.authorisation_ref is %',
        coalesce(ref, '<unset>')
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  -- GUARD 2 · `status` IS THE CHAIN'S OWN COLUMN AND THE CHAIN NOW HAS FOUR
  --           VERBS. Each of the four moves it, and nothing else may:
  --             propose_resolution  open → resolution_proposed | pending_approval
  --             approve_resolution  … → rejected
  --             execute_resolution  … → resolved | investigating
  --             reverse_resolution  resolved | investigating → the body's
  --                                 `newStatus`, *"usually back to open"*
  --           A bare list of four is not an "exemption list one entry stale in
  --           the wrong direction" — it is the closed set of verbs the
  --           contract declares on this column, and a fifth would arrive with
  --           its own migration and its own line here.
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = ref
         AND g.tenant_id  = NEW.tenant_id
         AND g.capability IN (
               'propose_resolution',
               'approve_resolution',
               'execute_resolution',
               'reverse_resolution'
             )
         AND g.expires_at > now()
    ) THEN
      RAISE EXCEPTION
        'exception status change carries no resolution-chain authorisation record: app.authorisation_ref is %',
        coalesce(ref, '<unset>')
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

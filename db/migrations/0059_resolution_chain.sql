-- =====================================================================
-- 0059 — THE RESOLUTION CHAIN. C4's other half.
--        G656, G657, G658, G659, G660. 19 Sep 2026.
--
-- ⚠️ THE NUMBER IS 0059 AND THE GAP BELOW IT IS DELIBERATE. `0040`–`0058` are
--    RESERVED to other agents working in parallel, and
--    `tools/check-migration-numbers.mjs` (G356) is the gate's stage that exists
--    because two agents each wrote an `0011` on 19 Sep 2026 and **`git merge`
--    produced both files with NO CONFLICT**. Derive what is spent, never read
--    it:  `ls db/migrations/*.sql db/migrations-control/*.sql`
--
-- ---------------------------------------------------------------------
-- 🛑 WHAT THIS FILE IS FOR, IN ONE SENTENCE FROM THE FILE IT COMPLETES.
--
--    `server/data-plane/exceptions.ts` shipped C4's read and its one reachable
--    act, and said plainly what it left:
--
--      *"C4 is half of C4. Accept/Reject/Park/Attach are all
--       `proposeResolution` → `decideApproval` → `executeProposal`, and THERE
--       IS NO `proposal` TABLE."*
--
--    This is that table, and the five others the chain cannot be served
--    without. **Six tables, one added column, one trigger.**
--
-- ---------------------------------------------------------------------
-- 🛑 G300's THREE-PART TEST IS WHY THERE ARE SIX TABLES AND NOT ONE, AND THE
--    TRAP IT NAMES IS A *PARTIAL* TABLE RATHER THAN A MISSING ONE.
--
--    `fast-json-stringify` SERIALISES a response; it does not VALIDATE one. So
--    an operation whose model and capability are real and whose table is
--    *almost* complete ships a 200 with `required` fields missing, silently,
--    and the first reader to notice is a client that crashed. Every `required`
--    field of every 200 these six operations declare was walked back to a
--    producer, and three of the six tables below exist for no other reason:
--
--      `listAvailableDispositions` 200 requires `archetype`  → §1
--                                          and `dispositions` → §2
--      `Proposal.execution.requiredApprovals` requires `quorum`,
--          `segregationOfDuties`, `mandatoryAtOrAbove`        → §3
--
--    Derive the walk rather than trusting this list:
--      sed -n '/^    Proposal:/,/^    ExecutionResult:/p' docs/contracts/capability.openapi.yaml
--
-- ---------------------------------------------------------------------
-- 🛑 THE THING THE CHAIN EXISTS FOR IS NOT EXPRESSIBLE ON THE CAPABILITY TIER,
--    AND THIS FILE IS HALF OF WHERE IT BECAME EXPRESSIBLE. G658.
--
--    `server/contract/capability.ts`'s `Annotation` carries ONE SCALAR
--    CAPABILITY PER OPERATION, and `decide(principal, capability)` takes ONE
--    PRINCIPAL AND NO RESOURCE STATE. `ApprovalConfig.quorum` counts DISTINCT
--    PEOPLE across several acts; `segregationOfDuties` asserts
--    approver ≠ proposer. Both are RELATIONAL, and before this commit
--    `grep -rn distinctHolders model/ server/ tests/` returned the
--    declaration, three literal `2`s and two equality assertions — **zero
--    evaluators**.
--
--    So the capability tier supplies the FIRST-ORDER gate only — *"the
--    caller's role is not in `ApprovalConfig.approverRoles`"* is answered by
--    `approve_resolution` and nothing finer — and the four-eyes rule lives
--    where the state is. **It lives in TWO places and that is deliberate:**
--
--      · `model/approval.ts` — `approvalState()`, the ONE evaluator, called by
--        the handler. Not a second `decide()`: it never answers *"may X"*. It
--        answers *"is this proposal executable"*, which is a property of the
--        PROPOSAL, and it is asked strictly AFTER `decide()` has allowed the
--        verb.
--      · `approval_decision_insert_restrictive`, below — the same predicate at
--        the row, so a handler that forgot it cannot write the row anyway.
--
--    ⚠️ TWO PLACES IS A MIRROR AND NOT `0002`'s "third place to drift", AND
--       THE THING THAT MAKES IT ONE IS A TEST IN BOTH DIRECTIONS, exactly as
--       `0008_staff_grant_selection.sql` requires of its own copy of
--       `model/governance.ts`: `tests/db/resolution-chain.test.ts` §6 drives
--       the same violation past the handler and into the database and requires
--       BOTH to refuse. A mirror with no such test is a second vocabulary.
--
-- ---------------------------------------------------------------------
-- ⚠️ WHAT IS *NOT* ENFORCED, NAMED RATHER THAN GLOSSED.
--
--    `ApprovalConfig.approvers: CapabilityRequirement[]` — "what an approver
--    must HOLD", with `distinctHolders` inside it — is **NOT** evaluated, and
--    the blocker is a MEASURED property of `0009_identity_substrate.sql`
--    rather than a preference. `user_visible_to_session` keys on the SESSION,
--    so the app role can read EXACTLY ONE user row: its own. Evaluating
--    "does this OTHER person hold `approve_resolution` on this domain" needs
--    their `role_assignment` rows, and a request path cannot see them.
--    `distinctHolders` therefore still has no evaluator and this file does not
--    pretend otherwise; `quorum` (a count of distinct names on rows we CAN
--    read) and `segregationOfDuties` (a comparison of two ids we hold) do.
--
--    🛑 THE HONEST CONSEQUENCE: an approver's ENTITLEMENT is checked once, by
--       the capability gate, and never against `approvers[]`. A tenant whose
--       `ApprovalConfig.approvers` is narrower than `approve_resolution` has a
--       control that reads as present and is not — which is the exact failure
--       shape `ApprovalConfig.segregationOfDuties`'s own field comment names
--       for an agent proposer. Closing it needs a readable directory for the
--       APPROVER, which is `0018`'s shape and is not this file's to take.
--
-- ---------------------------------------------------------------------
-- 🛑 `ALTER POLICY` APPEARS NOWHERE IN THIS FILE, DELIBERATELY, AND THAT IS
--    WORTH ONE LINE BECAUSE THE NEAR-MISS IS ON RECORD. `0020`'s header:
--    *"`ALTER POLICY` REPLACES WHAT IT NAMES"* — a draft that dropped a
--    `NOT EXISTS` would have silently widened invariant 8 to `statutory`. This
--    file adds policies and adds a trigger; it replaces none. The one existing
--    object it touches is `tenant.exception`, and it touches it with
--    `ADD COLUMN` and `GRANT`, both of which are additive and neither of which
--    can silently drop a clause.
--
-- ---------------------------------------------------------------------
-- G88: FORWARD ONLY. Nothing here is reversible and nothing here drops.
-- =====================================================================


-- =====================================================================
-- §1  THE DEFINITION'S ARCHETYPE — the narrowest projection that answers
--     `listAvailableDispositions`, and NOT a `definition` table.
--
-- 🛑 READ THE NAME. `db/migrations/0015_exception_register.sql` states as a
--    fact about this database that *"there are no live relations … no
--    `match_group`, no `rule`, no `definition`"*, and that sentence stays true.
--    This is a PROJECTION of two fields off a definition, keyed by the
--    `definition_id` `tenant.exception` already carries, and it is named for
--    what it holds rather than for what it is a piece of — because a table
--    called `definition` with four columns is a table the next reader will
--    join to for a fifth.
--
-- ⚠️ TWO COLUMNS, AND EACH IS A SEPARATE `required` FIELD OF ONE 200:
--
--      `archetype`  determines WHICH FAMILIES exist. A pack parameterises
--                   within an archetype and can never extend it, so the
--                   family filter in `server/data-plane/proposal-store.ts` is
--                   `DISPOSITION_FAMILIES[archetype]` READ FROM `model/` and
--                   never restated here. There is deliberately no
--                   `family`-to-`archetype` table.
--      `pack_key`   NULLABLE, and null is a value. The contract: *"Null for a
--                   tenant-authored definition with no pack behind it."*
--
-- 🛑 A NULL `pack_key` YIELDS AN EMPTY DISPOSITION SET IN THIS DATABASE, AND
--    THAT IS A STATEMENT RATHER THAN A HOLE. The contract says the set is then
--    *"whatever that definition's archetype allows, which is narrower than a
--    pack's"* — but an archetype allows FAMILIES, and a disposition is NAMED by
--    a pack author. Nothing in this repository authors a tenant disposition, so
--    the true answer is `[]` and it is published as `[]`. Fabricating one
--    disposition per family would invent keys no pack ships and no
--    `proposeResolution` would accept — the `[]`-versus-invented defect `0007`
--    spent a section removing.
--
-- ⚠️ NO FOREIGN KEY TO `tenant.exception.definition_id`, AND THE DIRECTION IS
--    THE REASON: many exceptions share one definition, so the reference points
--    the other way, and `definition_id` on `tenant.exception` is a POINTER
--    rather than a key (`0015` §1 says so at `match_group_id` for the same
--    reason). An exception whose definition has no row here is a real state —
--    it publishes an EMPTY disposition set and the handler says which.
-- =====================================================================

CREATE TABLE tenant.definition_archetype (
  tenant_id     text NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  definition_id text NOT NULL,
  archetype     text NOT NULL,
  pack_key      text,

  PRIMARY KEY (tenant_id, definition_id)
);


-- =====================================================================
-- §2  THE DISPOSITION CATALOGUE — the closed set, and the answer to
--     *"where do the valid values come from"*.
--
-- The contract's own sentence, and it is the whole design:
--
--   *"A disposition key is never typed, never guessed and never carried in a
--    client-side constant."*
--
-- 🛑 SEEDED REFERENCE DATA, WRITTEN BY THE MIGRATOR, AND THERE IS NO `INSERT`
--    GRANT. `SolutionPack.dispositions` are *"minted into the tenant at
--    install"*, and `installPack` is declared and unmounted — so rows arrive
--    the way `0008`'s governance lists and `0012`'s `document_field_spec` rows
--    do. A request path that could INSERT here could **mint the judgement it
--    is about to make**: name a disposition, propose it, execute it, and the
--    closed set a controller relies on is a set the caller wrote.
--
-- ⚠️ `family` AND `reversibility` ARE UNCONSTRAINED `text` AND THAT IS
--    `0002_run.sql`'s RULE, NOT AN OVERSIGHT: a CHECK here would be a third
--    copy of a closed enum *"and the one nothing checks, because no pair in
--    the wire-mirror addresses SQL."* The narrowing happens where it can be
--    DERIVED — `server/data-plane/resolution-vocabulary.ts`, against
--    `model/domain.ts`'s `DISPOSITION_FAMILIES` and `REVERSIBILITY` — and an
--    out-of-vocabulary row is a 500 with the column named, never a silently
--    dropped option. A dropped option is a disposition that vanishes from an
--    operator's choices without saying so, which is worse than a refusal.
--
-- 🛑 `reversibility` IS DECLARED AND NEVER INFERRED, and the model says why:
--    *"Whether posting a credit note can be undone is a fact about the
--    customer's finance process and the world, not about anything we can
--    observe — and it is the only one of the four autonomy dials that cannot
--    be measured."* There is therefore no derivation to prefer to the column.
-- =====================================================================

CREATE TABLE tenant.disposition (
  tenant_id           text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  -- NOT NULL: a disposition is named BY a pack. See §1 on the null case.
  pack_key            text    NOT NULL,
  key                 text    NOT NULL,
  label               text    NOT NULL,
  -- `DispositionFamily`. Belongs to the ARCHETYPE, never the domain.
  family              text    NOT NULL,
  -- `Reversibility`. Declared by the pack author. See the header.
  reversibility       text    NOT NULL,
  -- False routes to another procedure rather than closing the exception.
  terminal            boolean NOT NULL,
  requires_adjustment boolean NOT NULL,

  PRIMARY KEY (tenant_id, pack_key, key)
);


-- =====================================================================
-- §3  THE APPROVAL POLICY — `ApprovalConfig`, and the three terms that are
--     `required` on the wire.
--
-- 🛑 ONE ROW PER TENANT, WHICH IS NARROWER THAN THE MODEL AND IS SAID SO
--    RATHER THAN IMPLIED. `ApprovalConfig` is carried by a `Policy`, and a
--    `Policy` has a SCOPE — so the model admits a different configuration per
--    domain, per definition, per solution. There is no `policy` table, and
--    inventing a scope column with no scope resolver would be a narrowing
--    nobody chose that LOOKS like one somebody did. A tenant-wide row is the
--    honest subset: it is the configuration every proposal in the tenant is
--    evaluated against, and `getProposal` publishes it verbatim so an operator
--    can see the gate rather than infer it.
--
-- ⚠️ `secondApproverAbove` ON THE WIRE IS **NOT** THIS TABLE'S
--    `mandatory_at_or_above_value` AND MUST NOT BE MAPPED ONTO IT. The
--    contract is explicit: *"From the `human` step, not from policy — the two
--    are separate gates and BOTH must be satisfied."* There is no
--    `procedure_step` table, so `secondApproverAbove` has no producer and is
--    OMITTED from the published `requiredApprovals` — it is not in that
--    object's `required` list precisely so an absence is expressible. Mapping
--    the policy threshold onto the step threshold would collapse two gates
--    into one and report the collapse as satisfaction.
--
-- ⚠️ `escalate_after_hours` IS STORED AND READ BY NOTHING, AND IT IS HERE
--    BECAUSE ITS `t0` FINALLY EXISTS. `model/policy.ts` records the field as
--    *"UNENFORCEABLE FROM THE MODEL AS IT STANDS … there is no `t0` to measure
--    these hours from"*, and names the fix: `ApprovalDecision.requestedAt`.
--    §6 below has that column and §6's writer fills it from the proposal's own
--    `proposed_at`. **The clock exists; the sweep that reads it does not**, and
--    a sweep is a writer this schema has no grant for. Named, not built.
--
-- 🛑 THE `mandatory_at_or_above_value` TRIPLE IS G65's THREE COLUMNS AND `int8`
--    UNDER G286, for `0015`'s reason: the model type is `bigint` and a
--    `numeric` here would invite a float on the way out. All three or none,
--    enforced below rather than by three nullable columns hoping to agree.
-- =====================================================================

CREATE TABLE tenant.approval_config (
  tenant_id                text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,

  -- `ApprovalConfig.quorum`. How many DISTINCT approvers. >1 is four-eyes.
  quorum                   integer NOT NULL,
  -- `Severity` at or above which approval is mandatory regardless of value.
  mandatory_at_or_above    text    NOT NULL,
  -- `MoneyAmount | null` — value at or above which approval is mandatory
  -- regardless of severity. Added to the model 5 Aug 2026 after a review found
  -- there was NO monetary gate on the human path at all.
  mandatory_value_currency text,
  mandatory_value_minor    int8,
  mandatory_value_exponent integer,
  -- The approver may not be the proposer. ENFORCED — see the header, and see
  -- `approval_decision_insert_restrictive`.
  segregation_of_duties    boolean NOT NULL,
  -- Read by nothing. See the header: the `t0` exists now, the sweep does not.
  escalate_after_hours     integer,

  PRIMARY KEY (tenant_id),

  -- Multi-column wholeness, which is a fact about THIS decomposition and
  -- exists nowhere else — so it is not `0002`'s "third place to drift".
  CONSTRAINT approval_config_value_whole CHECK (
    (mandatory_value_currency IS NULL AND mandatory_value_minor IS NULL
      AND mandatory_value_exponent IS NULL)
    OR
    (mandatory_value_currency IS NOT NULL AND mandatory_value_minor IS NOT NULL
      AND mandatory_value_exponent IS NOT NULL)
  )
);


-- =====================================================================
-- §4  THE PROPOSAL — `ResolutionProposal`, and the first row on this plane
--     that records a JUDGEMENT.
--
-- 🛑 `disposition_key` AND NOT AN ACTION STRING. The model:
--    *"Replaces ResolutionProposal.action, which was a free-text string — so
--    the judgement the product exists to automate could not be scored,
--    reported on, learned from, or varied per domain."* There is no
--    free-text fallback column here and there will not be one; `rationale` is
--    the prose and is DELIBERATELY not the disposition, *"which is what stops
--    the rationale becoming a de facto free-text disposition."*
--
-- ⚠️ INVARIANT 6 LIVES ON `rationale` AND ON §5's `note`. Both are
--    operator-authored and both are rendered and may be handed to a model.
--    They are stored VERBATIM; nothing here sanitises them, because a
--    sanitiser at rest is a second place the rule lives and the wrong place.
--    The rule binds where the value is USED.
--
-- 🛑 `superseded_by_proposal_id` IS A SELF-REFERENCE AND A SUPERSEDED PROPOSAL
--    IS KEPT. The contract: *"An exception that took three proposals to settle
--    is a signal about the rule or the pack, and deleting the first two erases
--    it."* This is the ONE column on this table a request path may UPDATE, and
--    the grant is column-level for G358's reason.
--
-- ⚠️ THE ACTOR IS DECOMPOSED RATHER THAN STORED AS JSON. `ProposalActor` is a
--    union — a user, or an AGENT STEP with its model — and `0007`'s rule
--    applies: there is a closed set of arms, so there are typed columns to
--    have. **Only the `user` arm has a producer in this repository**: nothing
--    here runs an agent, `proposeResolution`'s own description says *"From this
--    operation the actor is always the session user"*, and the restrictive
--    policy below refuses any other. The agent columns are declared because
--    `0004`'s refusal is about columns ahead of a READER, and these have one —
--    `getProposal` publishes `ProposalActor` and must be able to say which arm
--    a row is. A row in the agent arm is unwritable today, which the policy
--    makes true rather than the comment.
-- =====================================================================

CREATE TABLE tenant.resolution_proposal (
  tenant_id                 text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id                        text        NOT NULL,
  exception_id              text        NOT NULL,

  -- --- `ProposalActor`, column per arm ---------------------------------
  proposed_by_kind          text        NOT NULL,
  -- ⚠️ AN OPAQUE USER ID AND NOT A FOREIGN KEY TO `tenant."user"`, FOR
  -- `0015`'s MEASURED REASON: `user_visible_to_session` keys on the SESSION,
  -- so the app role can see exactly one user row — its own. A `REFERENCES`
  -- here would be checked by the DATABASE while no handler could ever read the
  -- row to validate against. The value is pinned by the restrictive policy
  -- instead, against the act's OWN authorisation record, which is a stronger
  -- statement than referential integrity: not merely *a* user, but THIS one.
  proposed_by_user_id       text,
  proposed_by_step_id       text,
  proposed_by_model_id      text,

  disposition_key           text        NOT NULL,
  -- Operator prose. Invariant 6 applies. See the header.
  rationale                 text        NOT NULL,

  -- `Money | null`. Required when the disposition says `requires_adjustment`.
  -- G65's three columns, `int8` under G286. All three or none.
  adjustment_currency       text,
  adjustment_minor          int8,
  adjustment_exponent       integer,

  proposed_at               timestamptz NOT NULL,
  -- Null while current. See the header.
  superseded_by_proposal_id text,

  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, exception_id)
    REFERENCES tenant.exception (tenant_id, id) ON DELETE CASCADE,

  CONSTRAINT resolution_proposal_adjustment_whole CHECK (
    (adjustment_currency IS NULL AND adjustment_minor IS NULL AND adjustment_exponent IS NULL)
    OR
    (adjustment_currency IS NOT NULL AND adjustment_minor IS NOT NULL
      AND adjustment_exponent IS NOT NULL)
  ),

  -- ⚠️ THIS IS A WHOLENESS CONSTRAINT AND NOT AN ENUM COPY, AND THE
  --    DISTINCTION IS WORTH ONE SENTENCE BECAUSE IT LOOKS LIKE ONE. What it
  --    asserts is WHICH COLUMNS ACCOMPANY WHICH DISCRIMINATOR — a fact about
  --    this decomposition, which exists nowhere else. That it also refuses an
  --    unknown discriminator is a CONSEQUENCE of both arms failing, not the
  --    purpose; the vocabulary itself is still narrowed in
  --    `resolution-vocabulary.ts`, against the model.
  CONSTRAINT resolution_proposal_actor_whole CHECK (
    (proposed_by_kind = 'user'
      AND proposed_by_user_id IS NOT NULL
      AND proposed_by_step_id IS NULL
      AND proposed_by_model_id IS NULL)
    OR
    (proposed_by_kind = 'agent'
      AND proposed_by_user_id IS NULL
      AND proposed_by_step_id IS NOT NULL)
  )
);

-- 🛑 LEADS ON `tenant_id` AND ENDS ON `id`, FOR `0015`'s TWO REASONS. The lead
--    is because RLS adds `tenant_id = …` to every scan. The tail is because
--    `listProposals` orders NEWEST FIRST and two proposals minted in the same
--    microsecond would otherwise have no total order — and an unstable order
--    in a list of judgements is a list that reorders itself between renders.
CREATE INDEX resolution_proposal_by_exception
  ON tenant.resolution_proposal (tenant_id, exception_id, proposed_at DESC, id);


-- =====================================================================
-- §5  THE EVIDENCE FOR *THIS* DISPOSITION — `ProposalEvidence[]`.
--
-- 🛑 A TABLE AND NOT A `jsonb` ARRAY, for `0015` §2's reason at the same grain:
--    `EvidenceKind` is a closed set of five and the record is three fields, so
--    there are typed columns to have.
--
-- ⚠️ READ WHAT THIS IS NOT. *"`evidence` IS FOR WHY *THIS* DISPOSITION, NOT WHY
--    IT BROKE. Those are different questions and conflating them is the most
--    common misreading of this model."* `Explanation.observed[]` —
--    `tenant.exception_observed_value`, `0015` §2 — is why it broke. This is
--    the delivery note, the vendor reply, the prior case that settled the same
--    way.
--
-- 🛑 `ref` IS OPAQUE AND IS NEVER PARSED. A document id, a thread id, a
--    message id, a prior exception id. **Exactly one kind is CHECKED**: a
--    `correspondence` ref must name an ADMITTED message, and
--    `tenant.correspondence_message.admitted_as_evidence_at` (`0022`) is the
--    column that decides. That check is in the handler and not a foreign key,
--    because the other four kinds name rows in tables that do not exist and a
--    per-kind FK is not a thing SQL has.
-- =====================================================================

CREATE TABLE tenant.proposal_evidence (
  tenant_id   text    NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  proposal_id text    NOT NULL,
  -- The order the proposer stated it in. Evidence is an argument and an
  -- argument has an order.
  ordinal     integer NOT NULL,
  kind        text    NOT NULL,
  ref         text    NOT NULL,
  -- Operator prose. Invariant 6 applies exactly as to §4's `rationale`.
  note        text,

  PRIMARY KEY (tenant_id, proposal_id, ordinal),
  FOREIGN KEY (tenant_id, proposal_id)
    REFERENCES tenant.resolution_proposal (tenant_id, id) ON DELETE CASCADE
);


-- =====================================================================
-- §6  THE APPROVAL — `ApprovalDecision`, KEYED TO THE PROPOSAL.
--
-- 🛑 TO THE PROPOSAL AND NOT TO THE EXCEPTION, AND THE MODEL STATES THE WHOLE
--    REASON: *"`ApprovalConfig.quorum` and `segregationOfDuties` were
--    unimplementable against an exception key: you cannot count distinct
--    approvers of a thing, nor assert approver ≠ proposer, without knowing
--    which proposal is being decided."* That sentence is why this table has the
--    shape it has, and this migration is the first thing in the repository that
--    can act on it.
--
-- ⚠️ SEVERAL ROWS PER PROPOSAL, DELIBERATELY. `quorum` counts DISTINCT
--    approvers of ONE proposal, so `(proposal_id, decided_by)` is not the key
--    and `id` is its own address — the model says so at the field. The
--    counting is `count(DISTINCT decided_by)`, so a person who decides twice
--    does not become two people.
--
-- 🛑 `requested_at` IS THE MISSING `t0` AND IT IS FILLED FROM THE PROPOSAL.
--    `model/policy.ts`: *"a missing notification stalls an approval
--    permanently, with no clock and nothing to escalate."* The clock's zero is
--    the moment the proposal was made, which is the moment approval became
--    outstanding. It is not `now()` at decision time — that would make every
--    decision instantaneous and the field decorative.
--
-- ⚠️ NO `UPDATE` AND NO `DELETE` GRANT ANYWHERE ON THIS TABLE. A decision is
--    an ACT. Amending one would rewrite who approved what, and the whole
--    reason `quorum` is countable is that each act left a row. A changed mind
--    is a NEW row, and `approvalState()` reads the whole set.
-- =====================================================================

CREATE TABLE tenant.approval_decision (
  tenant_id    text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id           text        NOT NULL,
  proposal_id  text        NOT NULL,
  -- Carried as well as reachable through the proposal, because the model
  -- carries it: `ApprovalDecision` names both. It is pinned to the proposal's
  -- own `exception_id` by the restrictive policy rather than by a second FK,
  -- so the two cannot disagree.
  exception_id text        NOT NULL,
  decided_by   text        NOT NULL,
  decision     text        NOT NULL,
  reason       text,
  -- See the header: the proposal's `proposed_at`, not `now()`.
  requested_at timestamptz NOT NULL,
  decided_at   timestamptz NOT NULL,

  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, proposal_id)
    REFERENCES tenant.resolution_proposal (tenant_id, id) ON DELETE CASCADE,

  -- 🛑 A CROSS-COLUMN RULE AND NOT AN ENUM COPY. *"REJECTION REQUIRES A REASON
  --    … A rejection without one tells the next reviewer nothing and the
  --    analyst who proposed it less."* The handler answers
  --    `approval_rejection_reason_required` with a 422 before reaching here;
  --    this is the half that survives a handler somebody rewrites.
  CONSTRAINT approval_decision_reason_whole CHECK (
    decision <> 'rejected' OR reason IS NOT NULL
  )
);

CREATE INDEX approval_decision_by_proposal
  ON tenant.approval_decision (tenant_id, proposal_id, decided_at, id);


-- =====================================================================
-- §7  THE ONE COLUMN ADDED TO AN EXISTING TABLE — and the two that are NOT.
--
-- 🛑 `tests/db/exception-register.test.ts` §6 ASSERTS THAT THREE MODEL FIELDS
--    HAVE NO COLUMN *"so a later commit adding one meets a red"*, AND ITS OWN
--    MESSAGE SAYS WHAT TO DO ABOUT IT: *"If the contract now does, this
--    assertion is the place to amend — and amending it is the point, because
--    the model/wire divergence it records is a real loss."* **This is that
--    commit.** It is amended, not deleted, and it is now a three-way
--    differential rather than three absences.
--
--   `resolution_executed_by`          ADDED. `ExceptionResolution`'s `approved`
--                                     and `manual` arms both carry
--                                     `executedBy: UserId` — *"The person who
--                                     acted. A different fact from proposer and
--                                     from approver."* `executeProposal` is its
--                                     producer and `ExceptionResolution.
--                                     executedBy` is now on the wire.
--
--   `resolution_approved_by`          STILL ABSENT, AND ON PURPOSE. The wire
--                                     GAINS `approvedBy` in this commit and it
--                                     is DERIVED — `SELECT DISTINCT decided_by
--                                     FROM tenant.approval_decision WHERE
--                                     decision = 'approved'`. A stored copy
--                                     would be a second answer to a question
--                                     §6's rows already answer, and the two
--                                     would disagree the first time a decision
--                                     arrived after execution. Same argument
--                                     `0015` gives for not storing
--                                     `indicts_autonomy`.
--
--   `resolution_policy_evaluation_id` STILL ABSENT, AND SO IS THE WIRE FIELD.
--                                     It belongs to `mode: 'autonomous'`, which
--                                     is UNREACHABLE here: nothing in this
--                                     repository is an agent proposer, there is
--                                     no `policy` table and no policy
--                                     evaluation. A column ahead of its writer
--                                     is `0004`'s refusal, and a WIRE FIELD
--                                     ahead of its writer is worse — it reads
--                                     as a fact that is merely null.
--
-- ⚠️ `resolution_authorised_by_policy_id` AND `_version` ALREADY EXIST (`0015`)
--    AND GET **NO** `UPDATE` GRANT BELOW. Same reason: they are the autonomous
--    arm's, and no request path may write an arm no request path can reach.
-- =====================================================================

ALTER TABLE tenant.exception ADD COLUMN resolution_executed_by text;


-- =====================================================================
-- ROW LEVEL SECURITY — `0001`'s predicate VERBATIM, on `USING` **and** on
-- `WITH CHECK`, on all six. `ENABLE` **and** `FORCE` on all six.
--
-- `ENABLE` alone leaves the TABLE OWNER exempt, and `0001` states the
-- consequence: *"a test that connects as the owner then passes with the policy
-- doing nothing, and passes just as well with the policy dropped."*
-- `tests/db/rls-census.test.ts` enumerates every table in the catalogue and
-- requires both flags, so a seventh table added here without them is a red
-- gate rather than a thing a reviewer notices.
--
-- 🛑 `WITH CHECK` IS STATED ON THE THREE REFERENCE TABLES TOO, WHICH TAKE NO
--    WRITE, AND THAT IS `0009`'s RULE AND `0015`'s PRACTICE: *"so a later
--    `GRANT INSERT` cannot arrive without the write half already in place."*
-- =====================================================================

ALTER TABLE tenant.definition_archetype  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.definition_archetype  FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.disposition           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.disposition           FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.approval_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.approval_config       FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.resolution_proposal   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.resolution_proposal   FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.proposal_evidence     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.proposal_evidence     FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.approval_decision     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.approval_decision     FORCE  ROW LEVEL SECURITY;

CREATE POLICY definition_archetype_rls ON tenant.definition_archetype
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY disposition_rls ON tenant.disposition
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY approval_config_rls ON tenant.approval_config
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY resolution_proposal_rls ON tenant.resolution_proposal
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY proposal_evidence_rls ON tenant.proposal_evidence
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY approval_decision_rls ON tenant.approval_decision
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- =====================================================================
-- THE RESTRICTIVE WRITE POLICIES — G507's receipt, used three times.
--
-- 🛑 EACH ASKS ONE QUESTION AND IT IS NOT AN AUTHORITY QUESTION: **does this
--    transaction carry an invariant 10 record for the capability this write
--    requires, and does the row agree with it?** `0018`'s header carries the
--    whole argument and `0020` is the worked example; the short form:
--
--      · These policies do NOT re-evaluate authority. Re-deriving *"holds
--        `propose_resolution`"* in SQL would be a SECOND EVALUATOR — §5.3, and
--        the exact thing G289 refused when it declined a control-plane
--        evaluator beside `decide()` — and a STRICTLY WEAKER one: `decide()`
--        answers the role-version pin, the org arms,
--        `PARTNER_CAPABILITY_MASK`, revoked and expired as two different
--        facts, and a four-line `EXISTS` answers none of them.
--      · So they check for **the RECORD**, which only `authorize()` can have
--        written — invariant 10: *"`authorize()` mints an `AuthorizationGrant`
--        and nothing else does."*
--
-- ⚠️ IT IS A NAME, NOT A CLAIM. Setting `app.authorisation_ref` to a value for
--    which no row exists opens nothing at all.
--
-- 🛑 AND THEN EACH ADDS THE TERM THE RECORD CANNOT SUPPLY: **the row's own
--    actor must be the record's subject.** That is what stops a handler —
--    this one, or the next one somebody writes — from attributing a judgement
--    to somebody who did not make it. `0018`'s rule: one name, one source,
--    read off the record rather than declared beside it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 🛑 TWO POLICIES ON ONE TABLE, `FOR INSERT` AND `FOR UPDATE`, AND THE SPLIT
--    IS A CORRECTION RATHER THAN A STYLE. A single `FOR ALL … WITH CHECK`
--    carrying the authorship term is WRONG HERE and the bug is quiet: the
--    supersede `UPDATE` rewrites an OLDER proposal, whose `proposed_by_user_id`
--    is a DIFFERENT PERSON, so the authorship term would compare the new
--    proposer against the old proposer and refuse every supersede in a tenant
--    with two operators — while passing every test written by one.
-- ---------------------------------------------------------------------

CREATE POLICY resolution_proposal_insert_restrictive ON tenant.resolution_proposal
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
         -- The act's own record, and never a second evaluator. G507.
         AND g.capability = 'propose_resolution'
         AND g.expires_at > now()
         -- THE ACTOR, read off the record. A proposal attributed to anybody
         -- but the person whose authorisation opened this transaction is
         -- refused by the database, not by the handler.
         AND g.subject_user_id = resolution_proposal.proposed_by_user_id
    )
    -- 🛑 AND THE AGENT ARM IS UNWRITABLE, WHICH IS THE COLUMN COMMENT MADE
    --    TRUE. `AuthorizationGrant.subjectUserId` names a person; there is no
    --    agent principal on this plane. The clause is stated rather than left
    --    to follow from the one above, because the one above would also be
    --    satisfied by a NULL comparison quietly yielding NULL.
    AND resolution_proposal.proposed_by_kind = 'user'
  );

CREATE POLICY resolution_proposal_supersede_restrictive ON tenant.resolution_proposal
  AS RESTRICTIVE
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
         AND g.capability = 'propose_resolution'
         AND g.expires_at > now()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
         AND g.capability = 'propose_resolution'
         AND g.expires_at > now()
    )
  );

-- ---------------------------------------------------------------------
-- 🛑 THE FOUR-EYES RULE, AT THE ROW. THIS IS G658's SECOND HALF AND THE FIRST
--    TIME `ApprovalConfig.segregationOfDuties` HAS BEEN ENFORCED ANYWHERE.
--
-- Before this commit the field was a boolean nothing read. The contract's own
-- sentence is the specification: *"SEGREGATION OF DUTIES IS ENFORCED HERE AND
-- NOT ADVISED … The same person approving their own proposal is not a policy
-- nuance; it is the control being absent."*
--
-- ⚠️ THE SUBQUERIES ARE THEMSELVES ROW-LEVEL-SECURED AND THAT IS A SECOND
--    NARROWING FOR FREE, which `0008` measured for `tenant.membership` inside
--    its own restrictive policy. `tenant.approval_config` and
--    `tenant.resolution_proposal` are both scoped to `app.tenant_id` inside
--    this expression, so a config or a proposal in another tenant is invisible
--    here exactly as it is everywhere else.
--
-- 🛑 A TENANT WITH NO `approval_config` ROW CANNOT APPROVE AT ALL, AND THAT IS
--    FAIL-CLOSED RATHER THAN AN OVERSIGHT. The `EXISTS` below requires the row;
--    absent, the whole clause is false and the INSERT is refused. The
--    alternative — treating a missing config as "no segregation required" — is
--    scope failing OPEN, which `docs/HANDOFF.md` §5.5 records this codebase
--    already fixing once.
-- ---------------------------------------------------------------------

CREATE POLICY approval_decision_insert_restrictive ON tenant.approval_decision
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = nullif(current_setting('app.authorisation_ref', true), '')
         AND g.tenant_id  = nullif(current_setting('app.tenant_id', true), '')
         AND g.capability = 'approve_resolution'
         AND g.expires_at > now()
         -- THE APPROVER, read off the record. An approval attributed to
         -- anybody but the person who authorised this act is refused.
         AND g.subject_user_id = approval_decision.decided_by
    )
    AND EXISTS (
      SELECT 1
        FROM tenant.resolution_proposal p
        JOIN tenant.approval_config c ON c.tenant_id = p.tenant_id
       WHERE p.id        = approval_decision.proposal_id
         -- The two ids on the row must name the same thing. A second foreign
         -- key could not say this; a decision naming proposal A and exception
         -- B is a row whose `exception_id` is a lie.
         AND p.exception_id = approval_decision.exception_id
         -- 🛑 FOUR EYES. Read it as: either the tenant does not require
         --    separation, or the approver is not the proposer.
         AND (c.segregation_of_duties IS NOT TRUE
              OR p.proposed_by_user_id IS DISTINCT FROM approval_decision.decided_by)
    )
  );


-- =====================================================================
-- THE TRIGGER — `tenant.exception`'s RESOLUTION COLUMNS AND ITS `status`,
-- WRITABLE ONLY BY AN ACT THAT CARRIES THE RIGHT RECORD. G659.
--
-- ┌─ WHY A TRIGGER AND NOT A POLICY, WHICH IS THE ONLY INTERESTING QUESTION ──┐
-- │ `GRANT UPDATE (status, resolution_*)` is a privilege of the ROLE, and the │
-- │ role serves every operation on this plane. `assignException` writes       │
-- │ `assigned_to` and nothing else — but the PRIVILEGE it runs under would    │
-- │ now reach `status` too, and `0015` spent a section on why that must not   │
-- │ be reachable: *"resolution state, with no resolution row and no reversal  │
-- │ trail — the exact laundering the contract refuses an agent at             │
-- │ `reverseResolution`."*                                                     │
-- │                                                                            │
-- │ A RESTRICTIVE POLICY CANNOT CLOSE IT. A policy's `WITH CHECK` sees the NEW │
-- │ row and its `USING` sees the OLD one; **neither can see BOTH**, so no      │
-- │ policy can say *"this UPDATE CHANGED `status`"*. It could only say *"this  │
-- │ row's status is now X"*, which is false of every row that already had X.   │
-- │ A `BEFORE UPDATE … FOR EACH ROW` trigger is the one construct that holds   │
-- │ OLD and NEW at once. `0019` established the precedent and `0035` amended   │
-- │ it; the shape here is theirs.                                              │
-- └────────────────────────────────────────────────────────────────────────────┘
--
-- 🛑 THE GUARD IS KEYED ON THE SCOPE, NOT ON THE ROLE, AND THAT IS THE
--    SENTENCE TO READ BEFORE CALLING THE EARLY RETURN A HOLE.
--
--    A writer with no `app.tenant_id` returns early and is ungoverned. The
--    only writer that can reach that line is a `BYPASSRLS` one — because
--    G100's deny-on-NULL means a `NOBYPASSRLS` role with no scope SEES NO ROW
--    and can therefore UPDATE none. So the ungoverned writer is the MIGRATOR,
--    and a migrator writing rows is precisely how `0015` says exception rows
--    arrive: *"Rows arrive as the migrator, the way `0008`'s governance lists
--    and `0012`'s `document_field_spec` rows do."*
--
--    ⚠️ THE RESIDUAL, NAMED: a compromised migrator can write anything here.
--       That was already true of every table in this database and no trigger
--       changes it. What this closes is the REQUEST PATH, which is the thing
--       `0015`'s grant note is about.
--
-- ⚠️ THE `WHEN` CLAUSE NARROWS ON THE **TRANSITION** AND NOT ON THE STATE, for
--    `0019`'s reason: without it every `assignException` re-fires the trigger,
--    and a guard that runs on a write it has no opinion about is a guard whose
--    zero case means nothing. An `UPDATE … SET assigned_to = $2` does not fire
--    this at all.
--
-- 🛑 NOT `SECURITY DEFINER`. It runs as the invoking role, so `tenant.
--    authorization_grant` is read under that role's own row-level security —
--    which is what makes the tenant term below redundant rather than
--    load-bearing, and it is stated anyway because `0019` states it.
-- =====================================================================

CREATE FUNCTION tenant.exception_resolution_requires_record()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = tenant, pg_catalog
AS $$
DECLARE
  scoped_tenant text := nullif(current_setting('app.tenant_id', true), '');
  ref           text := nullif(current_setting('app.authorisation_ref', true), '');
  resolution_changed boolean;
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

  -- GUARD 1 · A RESOLUTION IS WRITTEN BY AN EXECUTION AND BY NOTHING ELSE.
  IF resolution_changed THEN
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

  -- GUARD 2 · `status` IS THE CHAIN'S OWN COLUMN AND THE CHAIN HAS THREE
  --           VERBS. Each of the three moves it, and nothing else may:
  --             propose_resolution  open → resolution_proposed | pending_approval
  --             approve_resolution  … → rejected
  --             execute_resolution  … → resolved | investigating
  --           A bare list of three is not an "exemption list one entry stale
  --           in the wrong direction" — it is the closed set of verbs the
  --           contract declares on this column, and a fourth would arrive with
  --           its own migration and its own line here.
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT EXISTS (
      SELECT 1
        FROM tenant.authorization_grant g
       WHERE g.id         = ref
         AND g.tenant_id  = NEW.tenant_id
         AND g.capability IN ('propose_resolution', 'approve_resolution', 'execute_resolution')
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

CREATE TRIGGER exception_resolution_requires_record
  BEFORE UPDATE ON tenant.exception
  FOR EACH ROW
  WHEN (
       OLD.status                     IS DISTINCT FROM NEW.status
    OR OLD.resolution_mode            IS DISTINCT FROM NEW.resolution_mode
    OR OLD.resolution_disposition_key IS DISTINCT FROM NEW.resolution_disposition_key
    OR OLD.resolution_proposal_id     IS DISTINCT FROM NEW.resolution_proposal_id
    OR OLD.resolution_decided_by      IS DISTINCT FROM NEW.resolution_decided_by
    OR OLD.resolution_executed_by     IS DISTINCT FROM NEW.resolution_executed_by
    OR OLD.resolution_at              IS DISTINCT FROM NEW.resolution_at
  )
  EXECUTE FUNCTION tenant.exception_resolution_requires_record();


-- =====================================================================
-- GRANTS. By name, because `0003` deliberately declines `ALTER DEFAULT
-- PRIVILEGES` on this schema: *"A future table created here is unreachable by
-- the app until granted BY NAME … default privileges would silently hand the
-- request path a table nobody decided to expose."*
--
-- 🛑 READ THE VERBS.
--
--   `definition_archetype`  SELECT.                    Seeded reference data.
--   `disposition`           SELECT.                    Seeded reference data.
--   `approval_config`       SELECT.                    Seeded reference data.
--   `resolution_proposal`   SELECT, INSERT, and
--                           UPDATE (superseded_by_proposal_id).
--   `proposal_evidence`     SELECT, INSERT.
--   `approval_decision`     SELECT, INSERT.
--   `exception`             UPDATE on SEVEN NAMED COLUMNS, and no others.
--
-- **NO `DELETE` ANYWHERE IN THIS FILE.** `RetentionPolicy` is a sweep's verb
-- and there is no sweep; the grant lands with it, in that commit, with the
-- assertions that it ran. `0015` and `0012` say the same.
--
-- ---------------------------------------------------------------------
-- WHY `INSERT` ON THE THREE ACT TABLES AND NOT ON THE THREE REFERENCE ONES.
-- A proposal, its evidence and an approval ARE acts a person takes over HTTP;
-- that is the whole of what this slice mounts. A disposition, an archetype and
-- an approval policy are CONFIGURATION, and a request path that could write
-- them could mint the judgement it is about to make, or lower its own quorum
-- to one, or set `segregation_of_duties` to false and then approve its own
-- proposal. **The four-eyes rule is only worth having if the row that declares
-- it is out of reach of the person it binds.**
--
-- ---------------------------------------------------------------------
-- 🛑 WHY `UPDATE (superseded_by_proposal_id)` AND NOT `UPDATE`. G358's shape,
--    taken a fourth time. A blanket grant would put inside a handler's reach:
--
--   `disposition_key`     THE JUDGEMENT. A proposal approved for `write_off`
--                         and executed as `dispute` is a laundered decision
--                         with two signatures on it.
--   `rationale`           THE ARGUMENT, which the approver read.
--   `adjustment_*`        THE AMOUNT. Approved at 100 and executed at 100000.
--   `proposed_by_user_id` THE AUTHOR — and with it the four-eyes rule, which
--                         is a comparison against exactly this column.
--   `exception_id`        the row it is about.
--
--    PostgreSQL grants `UPDATE` per column, so the narrow privilege costs one
--    pair of parentheses. Taking the wide one would be a privilege chosen for
--    convenience over a control that was already there — §5's own shape.
--
-- ---------------------------------------------------------------------
-- 🛑 AND THE SEVEN COLUMNS ON `tenant.exception`, WHICH IS THE ONE WIDENING IN
--    THIS FILE AND IS ARGUED RATHER THAN SLIPPED IN.
--
--    `0015` granted `UPDATE (assigned_to)` ALONE and listed, in capitals, what
--    a blanket grant would expose. **Its argument against `status` was
--    conditional and the condition has changed**: *"`status` — resolution
--    state, WITH NO RESOLUTION ROW AND NO REVERSAL TRAIL."* There is a
--    resolution row now (§4, §6) and every status transition is accompanied by
--    the act that caused it. The other five reasons it gave are UNTOUCHED and
--    stay unwritable:
--
--      `severity` / `severity_rank`   the ordering the queue is triaged by
--      `value_at_risk_*`              the number a period is closed on
--      `explanation_*`                EVIDENCE
--      `cost_centre` / `legal_entity` THE AUTHORISATION ATTRIBUTES
--      `tenant_id`                    a row updated INTO another tenant
--
--    `tests/db/exception-register.test.ts` §2 asserts every one of those is
--    still `permission denied`; this commit moves `status` out of that list
--    and into a trigger assertion, because the privilege moved and the
--    PROPERTY did not.
--
--    ⚠️ `resolution_authorised_by_policy_id` AND `_version` ARE **NOT** IN THE
--       GRANT. They are the `autonomous` arm's and no request path can reach
--       that arm. A privilege ahead of a writer is `0004`'s refusal.
-- =====================================================================

GRANT SELECT                                 ON tenant.definition_archetype TO tenant_rw;
GRANT SELECT                                 ON tenant.disposition          TO tenant_rw;
GRANT SELECT                                 ON tenant.approval_config      TO tenant_rw;

GRANT SELECT, INSERT                         ON tenant.resolution_proposal  TO tenant_rw;
GRANT UPDATE (superseded_by_proposal_id)     ON tenant.resolution_proposal  TO tenant_rw;

GRANT SELECT, INSERT                         ON tenant.proposal_evidence    TO tenant_rw;
GRANT SELECT, INSERT                         ON tenant.approval_decision    TO tenant_rw;

GRANT UPDATE (
  status,
  resolution_mode,
  resolution_disposition_key,
  resolution_proposal_id,
  resolution_decided_by,
  resolution_executed_by,
  resolution_at
) ON tenant.exception TO tenant_rw;

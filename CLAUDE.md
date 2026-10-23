# CLAUDE.md — ReconcileAI

> **STATUS:** LIVING CONTROL
> **V1 AUTHORITY:** YES — **the only place the invariants are numbered**, and the entry point for the verification surface. Copy an invariant, never paraphrase it.
> Maintained. ⚠️ It is not immune: it has carried a stale module count and a stale capability count before, which is why every count on it now ships with the command that reproduces it — run `node tools/check-doc-counts.mjs` before trusting one. `docs/HANDOFF.md` §3 outranks it on any decision.
> *Banner added 8 Aug 2026.*
>
> 🛑 **AND THE BANNER UNDERSTATED THE PROBLEM UNTIL 16 Aug 2026.** Stale *counts*
> are the failure it names; on 16 Aug 2026 this file was found **green on every
> count and wrong about the repository** — it described a tree with no `server/`,
> no `compose.yaml`, no `Dockerfile`, no `design/` and no `DESIGN.md`, a week
> after the first two serving processes landed, while `node tools/check-doc-counts.mjs`
> exited 0 throughout. **The checker reads numbers in prose. It cannot see a
> missing directory, a rotted `file:line` that still resolves, or a document
> described as uncorrected after it corrected itself — and this page carried all
> three at once.** Run the checker, then read the tree.
> *Banner extended 16 Aug 2026.*

> A general reconciliation platform | 1CloudHub

---

## What this repository is

**A domain model, the design record that argues for it, a drawn design system, and
— since 16 Aug 2026 — TWO SERVING PROCESSES.**

> ⚠️ **THIS HEADING READ *"Nothing is built"* AND THE NEXT SENTENCE READ *"No AWS
> resource has been created, no schema written, no code deployed, no CI."* BOTH
> WENT FALSE ON 9 Aug 2026 AND ARE CORRECTED HERE RATHER THAN DELETED**, because
> they are the sentences a reader would have trusted. **A schema is written** —
> `db/migrations/0001_tenancy_and_rls.sql` — **and CI exists**,
> `.github/workflows/check.yml`. What is still exactly true: **no AWS resource
> has been created.** Phase one runs against a disposable local Postgres.
> *Corrected 10 Aug 2026.*
>
> 🛑 **AND THE CI HALF OF THAT CORRECTION WENT FALSE ON 18 Sep 2026 AND STOOD
> FOR THREE DAYS — G1331. `.github/` IS ABSENT FROM THIS TREE.** The clause
> **"and CI exists, `.github/workflows/check.yml`"** is kept above rather than
> deleted because it is the sentence this page repeats in four more places and
> the one a reader would have quoted onward. **The workflow was RETIRED** under
> the ruling recorded at `tests/ci/gate.test.ts`
> (`test_the_github_actions_workflow_is_retired_and_the_pipeline_holds_its_property`),
> **and that test now fails if the file EXISTS** — the opposite of what the
> working-practice bullet at the foot of this page still says it does. Derive
> both, never read them: `ls -la .github` → *No such file or directory*, and
> `grep -n 'existsSync(WORKFLOW)' -A2 tests/ci/gate.test.ts` → `false`.
> ⚠️ **THIS IS THE MIRROR OF EVERY OTHER BANNER HERE AND IS THE MORE DANGEROUS
> DIRECTION:** the rest of this page records claims that went false because work
> LANDED; this one told readers a control was RUNNING that had been deliberately
> switched off. **A record asserting a retired control is worse than no record**,
> because nobody goes looking for a gate they have been told they have.
> *Corrected 21 Sep 2026 — G1331.*
>
> 🛑 **AND THE REPLACEMENT WENT STALE IN ITS TURN. THIS HEADING READ *"a first
> thin slice of built substrate"* AND THE PARAGRAPH BELOW OPENED *"There is no
> application here and no deployed stack"* UNTIL 16 Aug 2026. BOTH ARE NOW FALSE
> AND THE SECOND IS THE WORSE ONE**, because it is the sentence that tells a
> reader they may skip a directory. **There IS an application**: `server/` holds
> **two Fastify planes** — 21 files, `git ls-files server | wc -l` — routed and
> validated *by* the four OpenAPI tiers rather than beside them (**G191**), with
> a local-only signed test token (**G192**); and there **is** a deployed stack in
> the sense that matters locally — `compose.yaml` stands up **six services across
> two networks**, every published port bound to `127.0.0.1`, from one
> `Dockerfile` that carries both planes (**G193**). All three rulings were taken
> on 16 Aug 2026 and landed the same day, in `#182`.
> **What is STILL exactly true, and it is the narrow claim that survives: no AWS
> resource has been created.** The compose stack is a disposable local one.
> *Corrected 16 Aug 2026.*

The stack is **no longer undecided**: G71 put it at TypeScript end to end, on
8 Aug 2026 G97–G101 decided the database, the client, the ORM, the RLS polarity
and the pooling mode, and on 16 Aug 2026 **G191/G193 decided the HTTP framework
and the process topology**. `docs/domain-model.md` still describes the backend as
*undecided by design*, and **§3 of `docs/HANDOFF.md` outranks it.**

```
package.json 10 devDeps AND 7 RUNTIME dependencies, all pinned exact —
             fastify · pg · yaml (G191) · react · react-dom (G198) ·
             @aws-sdk/client-sqs (R-C, G1202) ·
             @aws-sdk/client-secrets-manager (G2404).
             🛑 **THIS SAID 6 UNTIL 1 Oct 2026 AND THE SEVENTH ARRIVES BY
             RULING, NOT BY CONVENIENCE.** G2401, the owner's: source
             credentials live in Secrets Manager under the tenant's own KMS
             key, and the serving process must WRITE one there. G2404 takes
             `client-secrets-manager` at `client-sqs`'s exact version, so the
             two share one transitive closure — measured, the lockfile grew by
             ONE package. **BOTH FENCES BELOW ARE WIDENED BY NAME, NOT
             RELAXED**: the manifest test permits two named clients and
             `client-s3` is still absent; the scope test permits ONE FILE PER
             CLIENT. ⚠️ **AND THE SCOPE TEST WAS BLIND TO A MULTI-LINE IMPORT
             UNTIL THE SAME COMMIT (G2409)** — measured, it reported one SDK
             home where two existed.
             🛑 **THIS SAID 5 UNTIL 20 Sep 2026 AND THE SIXTH IS THE ONE THIS
             PAGE HAS SPENT A MONTH SAYING WOULD NEVER ARRIVE.** R-C, the
             owner's ruling: `@aws-sdk/client-sqs` is taken for R-B's run
             queue, and **G212 is DISCHARGED BY ITS OWN CONDITION rather than
             overturned** — that row says the SDK is revisited *"when an
             actual AWS resource exists — which is a fact about the account,
             not about the code"*, and nine top-level stacks are live.
             ⚠️ **IT IS NARROW BY NAME AND FENCED IN TWO PLACES**: exactly one
             `@aws-sdk/*` package, pinned exact
             (`tests/infra/manifest.test.mjs`), and SERVER-ONLY — `model/`,
             `tools/`, `frontend/` and `db/` may import none and exactly ONE
             file under `server/` may (`tests/ci/aws-sdk-scope.test.ts`).
             ⚠️ **"exactly one" IS TWO SINCE 1 Oct 2026 — G2404 — and is
             corrected rather than deleted: two named packages, and one file
             per client** (`sqs-run-queue.ts`, `secrets-manager-store.ts`).
             ⚠️ THIS SAID "2 devDeps … AND 3 RUNTIME" UNTIL 22 Aug 2026; the
             frontend root doubled both. Derive, never read:
             `node -e "const p=require('./package.json');console.log(p.dependencies,p.devDependencies)"`
             `npm ci && npm run check`
model/       32 TypeScript modules — the canonical domain model.
             ⚠️ **THIS SAID 31 UNTIL 4 Oct 2026 AND WAS CORRECT WHEN WRITTEN.**
             THE THIRTY-SECOND IS **model/publication.ts** (U-29, G4201–G4207,
             DERIVED) — G110's publication seam's REFUSAL LOGIC for document
             types: `validateDocumentTypeTemplates()` and
             `admitDocumentTypeDeclaration()`, the second of which also runs
             G206's `validatePackClassificationRules()`. 🛑 **IT IS NOT A
             WRITER**: no grant, no route, no migration — which operation,
             capability and principal may author a document type is G4204,
             ⛔ PUT TO THE OWNER. `tools/check-pack-safety.mjs` calls the new
             validator in the same commit, so it has a CI call site. Derive it,
             never read it: `ls model/*.ts | wc -l` → 32.
             ⚠️ **THE PREVIOUS ENTRY IS KEPT WHOLE:**
             ⚠️ **THIS SAID 30 UNTIL 1 Oct 2026 AND WAS CORRECT WHEN WRITTEN.**
             THE THIRTY-FIRST IS **model/partner-portal.ts** (W5, G2633–G2640) —
             the partner portal's invitations, roster state, deals, sandbox and
             trial requests, and NOT ONE OF THEM NAMES A TENANT
             (`_PartnerPortalRecordsNameNoTenant`). Derive it, never read it:
             `ls model/*.ts | wc -l` → 31.
             🛑 **30 IS A THIRD ANSWER NEITHER PARENT EVER COMPUTED, AND THIS
             LINE READ 29 AFTER A CLEAN AUTO-MERGE — WHICH IS THE WORST WAY
             THIS DEFECT CAN ARRIVE.** Both branches added ONE module to
             twenty-eight, both wrote `29`, and `git merge` therefore found
             the two sides IDENTICAL on this line and took it **with no
             conflict at all**. *The number agreed and the sets did not* — the
             16 Aug 2026 capability row's exact shape — and this time the
             merge tool itself was the thing that hid it. **A conflict marker
             is a gift; this line did not get one.** The two modules are
             `model/extraction.ts` (G1451–G1459, E2) and `model/session-mint.ts`
             (G1601–G1612, W3-S2). Derive the pair, never read it:
             `git diff --name-only --diff-filter=A origin/main -- model`; and
             derive the count: `ls model/*.ts | wc -l` → 30.
             ✅ **AND THE CEILING IS NO LONGER 30 — G1479, 21 Sep 2026, ONE
             SLICE EARLIER IN THIS SAME WAVE.**
             ⚠️ **THE PARAGRAPH THAT STOOD HERE IS QUOTED RATHER THAN KEPT IN
             PLACE, because it was TRUE when written and because THIS MERGE IS
             THE EVENT IT WAS WARNING ABOUT:** *"🛑 AND THE CEILING IS 30,
             WHICH MAKES THIS THE ONE COUNT ON THIS PAGE WITH A DEADLINE.
             `tools/check-doc-counts.mjs` governs `modules` with a band of
             `[8, 30]`, and a count that crosses its band is SILENTLY SKIPPED
             rather than reported — which is the `contract operations`
             incident this page already records: 'operations and paths are now
             ABOVE check-doc-counts's [40, 120] band … so nothing checks
             either figure any more.' ONE MODULE OF HEADROOM REMAINS. The
             thirtieth is checked; the thirty-first makes every stated module
             count in this repository uncheckable, including this line."*
             **TWO modules landed at once in this wave**, so at the old
             ceiling the thirty-first would have arrived in the very next
             slice. The band is now `[8, 60]` — derive it, never read it:
             `grep -n "key: 'modules'" tools/check-doc-counts.mjs` — leaving
             **30 OF HEADROOM**, and every band prints its own headroom on
             every run (G1479), so the next crossing is reported rather than
             silent.
             ✅ **AND THE SISTER HAZARD IS CLOSED — G1771/G1772, 21 Sep 2026,
             K5's SLICE. ⚠️ THE SENTENCE BELOW IS CORRECTED RATHER THAN
             DELETED, because it is the one `docs/build/completion-plan.md`
             §6 also carried and because ITS SECOND HALF WAS TOO STRONG:**
             *"⚠️ AND THE SISTER HAZARD THAT WARNING NAMES IS LIVE AND IS NOT
             FIXED HERE: `visuals` HOLDS 1 AGAINST A FLOOR OF 1 — ZERO
             HEADROOM (G1480, reported not fixed). Deleting the one generated
             visual takes that metric out of band and stops every stated
             visual count being checked at all."*
             🛑 **THE BAND IS `[0, 30]` AND THE FLOOR IS GONE BECAUSE ZERO IS
             A REACHABLE VALUE OF THIS METRIC** — G264 deleted NINE visuals
             in one commit — **and a floor that excludes a value its own
             subject can take is hiding its own numbers rather than a foreign
             one.** Derive it, never read it:
             `grep -n "key: 'visuals'" tools/check-doc-counts.mjs`.
             🛑 **THE SILENCE WAS LIVE RATHER THAN PROSPECTIVE, WHICH IS WHAT
             THE OLD SENTENCE GOT WRONG IN THE OTHER DIRECTION.** Witnessed at
             the floor of 1: a line reading *"The repository ships 0
             visuals."* — WRONG, the tree holds 1 — was **never reported and
             the run was EXIT 0**, while lines saying 2, 9 and 10 were. At
             `[0, 30]` it is `STALE`, EXIT 1.
             ⚠️ **AND THE WIDENING WAS MEASURED BEFORE IT WAS TAKEN, which is
             the check 400 failed for `contract operations`: the metric
             reports THE SAME SEVEN LINES at a floor of 1 and at a floor of
             0.** Nothing foreign enters.
             ⚠️ **THE *"stops every stated visual count being checked at all"*
             HALF WAS NEVER TRUE**: `tests/tools/band-does-not-silence.test.mjs`
             already made an actual crossing a RED GATE, so a deletion would
             have failed the gate rather than passing quietly. **What the fix
             buys is the live blind spot above, plus the removal of a
             pre-emptive red on a legitimate deletion** — and §2 and §3 of
             that suite now pin the floor and the headroom reading, each
             witnessed RED by putting the old value back.
             **BOTH PARENTS' NARRATIONS ARE KEPT BELOW AND EACH IS CURRENT
             ABOUT ITS OWN MODULE; only this first number is the claim.**
             *Derived 21 Sep 2026 — integrate/all-sixteen.*
             ⚠️ **THIS SAID 28 UNTIL 21 Sep 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE TWENTY-NINTH IS **model/extraction.ts** (G1451–
             G1459, E2, DERIVED except for R12 which is the OWNER'S) — **the
             ONE conversion seam between a stored position and an
             `ExtractedValue`**, and the first module in `model/` whose total
             `Record` has a REAL CONSTRUCTION SITE.
             🛑 **IT DISPATCHES ON THE DECLARATION AND NEVER ON THE VALUE,
             WHICH IS INVARIANT 4 AND WAS MEASURED BEFORE IT WAS WRITTEN:** a
             converter dispatching on `typeof value` disagreed with the
             operator's declaration on **FOUR of FOUR** of E1's own fixture
             rows — `1000` declared `money` sniffed as `number`, `"0012"`
             declared `identifier` sniffed as `text`. `tests/model/
             extraction.test.ts` §7 keeps that measurement RUNNABLE.
             🛑 **THE TOTAL `Record` BITES TWICE FOR ONE EDIT, AND THAT IS THE
             ANSWER TO THIS PAGE'S OWN WARNING** that *"a total `Record` only
             bites where something CONSTRUCTS one, and in a types-only model
             nothing does"*. Witnessed by mutation: a sixth `DataType` is
             `TS2741` at `EXTRACTED_KIND_FOR_DATA_TYPE` **and** `TS2322` at
             the exhaustive switch's `never` arm — the first demands the
             scalar arm it produces, the second demands the branch that
             produces it.
             🛑 **R12, THE OWNER'S RULING OF 21 Sep 2026: *"Build extraction
             for `structured` and `tabular` ONLY. G7 and G8 are NOT taken."***
             `digital_text` and `scanned` put OCR and a model in the path,
             which invariant 7 governs — and G7 and G8 are both `not applied`,
             so **invariant 7 has nothing to enforce against there.** The fence
             is keyed on `FIDELITY_CROSSES_MANAGED_SERVICE`, which **already
             existed in `model/ingestion.ts` and is IMPORTED rather than
             restated** (§5.3). ⚠️ **THE FENCE IS NOT THE RULING**: R12 says
             the OCR path is NOT TAKEN, not forbidden, and the slice that takes
             G7/G8 deletes the refusal arm rather than weakening the predicate.
             ⚠️ **MONEY GOES THROUGH `model/money.ts` AND NOTHING ELSE (G111),
             SO A JSON NUMBER AT A `money` POSITION IS REFUSED** — a number
             carries no currency and no exponent, and the only alternative to
             refusing is supplying a denomination nobody declared.
             ⚠️ **AND THE FAIL-CLOSED CONFIDENCE HOLD IT LEANS ON IS INERT AND
             THE MODULE SAYS SO**: every position it produces carries
             `confidence: null`, `heldReadsFor()` holds only where a FLOOR was
             declared, and G139 records that no authoring surface for floors
             exists — so **not one of those nulls is held**. The mechanism is
             correct, wired and unreachable.
             🛑 **IT MOUNTS NOTHING AND HAS NO CALLER OUTSIDE `tests/`** —
             E3, E4 and E5 are separate slices. `server/data-plane/token-verify.ts`'s
             shape and `0007`'s precedent: a surface proven without a route.
             ⚠️ **THIS SAID 28 UNTIL 21 Sep 2026 AND WAS CORRECT WHEN WRITTEN**,
             which is recorded because most sweeps of this line have found it
             already behind. **THE 29th IS model/session-mint.ts — G1601–G1612,
             W3-S2 — and it is the TYPE-LEVEL HALF OF INVARIANT 1, aimed at the
             one breach that arrives wearing a ruling's endorsement.** G315 puts
             the tenant in the OIDC `state` DELIBERATELY as a routing fact for
             the 302, so a mint writer that carries it forward makes tenant
             scope a thing conferred by AUTHENTICATION with a decision behind
             it that looks deliberate — because it was, about a different act.
             `MintSessionInput` has **no `tenantId` field at all — absent, not
             `null`** — so passing one is a `tsc` error and not a review
             comment. `tests/model/session-mint.test.ts` §1 mounts that
             `@ts-expect-error` and §1b is its anti-vacuity arm.
             🛑 **A KEY CHECK ALONE LEAKS, AND THE GAP IS ONE FIELD AWAY —
             MEASURED, NOT IMAGINED.** Adding `surface: ServedSurface` (the
             value the caller is already holding, derived from the host, which
             is invariant 1's own chain) leaves
             `_MintSessionInputCarriesNoTenantId` **GREEN** and fails only at
             `_MintSessionInputReachesNoTenantDeep`, because a `ServedSurface`'s
             tenant arm carries a `TenantId`. **`AssertNoTenantDeep` is
             `NoTextField`'s idiom pointed at a different leaf and is a
             different ORDER rather than a second implementation of one** — and
             its leaf test is `Extract`, never `extends`, because
             `TenantId | null extends TenantId` is FALSE and would wave through
             exactly the shape `Session.tenantId` has.
             ⚠️ **THE OUTPUT `Omit` IS THE LOAD-BEARING HALF AND THE KEY CHECK
             IS THE LEGIBLE ONE**, because excess-property checking is a check
             on LITERALS: a caller who spreads a wider object passes a
             `tenantId` with no error at all. It is then discarded, because
             `MintedSessionFacts` is `Omit<Session, 'tenantId' | …>` and has
             nowhere to put it. §1c measures that limit rather than claiming
             the key check is total.
             🛑 **NO WRITER, NO ROUTE, NO MIGRATION, AND NO TIMESTAMP.** The
             model reads no clock — `Timestamp` is a string alias and G111's
             codec is not started — so the mint returns the VALIDATED bounds
             and `expires_at` is `now() + interval` in SQL. **R7 is NOT taken**,
             and one half of it is decided by invariant 1 rather than by
             preference: **at mint time there is no tenant, so a PER-TENANT
             bound is not merely unconfigured, it is UNREADABLE.**
             ⚠️ **`MintedSession` IS WIRE-ONLY AND THIS MODULE IS NOT IT** —
             there is no `tsc` link between the 200 body and `Session`, and one
             contract test holds it. 🛑 **AND THE OBVIOUS DERIVATION IS WRONG,
             WHICH IS G1612 AND WAS CAUGHT ON THIS PAGE'S OWN FIRST DRAFT: this
             line said `grep -rn 'MintedSession' model/ | wc -l` → 0 AND THE
             COMMAND RETURNS 16** — eleven matches are `MintedSessionFacts`,
             because the name is a PREFIX of it, and five are the prose that
             exists to say the thing is absent. **A grep for a name, in a file
             that discusses the name, measures the discussion** — G978's
             finding arriving a second time, §5.1 wearing a `grep`. Derive it
             on the DECLARATION, never on the mention:
             `grep -rnE '(export )?(type|interface|const) MintedSession\b' model/`
             → 0, with `grep -rn 'MintedSession:' docs/contracts/*.yaml` → 1
             beside it, because *absent from `model/`* and *present on the
             wire* are two claims.
             🛑 **28 IS A THIRD ANSWER NEITHER PARENT EVER COMPUTED — §5.11
             WITH A SECOND PARENT, AND BOTH BRANCHES WROTE "THE 27th".** Two
             slices landed a module on 19 Sep 2026 — `model/approval.ts`
             (G658) and `model/run-admission.ts` (G692) — and each narration
             below is correct about the branch that wrote it and wrong about
             this tree. **Both are kept**; deleting one would erase a control
             that really fired. Derive it: `ls model/*.ts | wc -l`.
             🛑 THE 27th IS model/approval.ts — G658, 19 Sep 2026 — and it is
             THE FIRST EVALUATOR `ApprovalConfig.quorum` AND
             `segregationOfDuties` HAVE EVER HAD. Measured before it was
             written: `grep -rn distinctHolders model/ server/ tests/`
             returned the declaration, three literal `2`s and two equality
             assertions — ZERO evaluators — while `model/policy.ts` already
             said what that costs: *"A control that always passes is a false
             assurance, and a false assurance is the one thing worse than a
             missing control."*
             🛑 IT IS NOT A SECOND EVALUATOR BESIDE `decide()` AND ITS HEADER
             ARGUES IT RATHER THAN ASSERTING IT: it takes no argument that is
             a principal, it never sees a role or a capability, and it is
             asked STRICTLY AFTER the gate. A refusal here is a 409, never a
             403 — the caller is permitted and the THING is not ready.
             ⚠️ `ApprovalConfig.approvers` AND `CapabilityRequirement
             .distinctHolders` ARE STILL UNEVALUATED and the blocker is a
             MEASURED property of `db/migrations/0009`: `user_visible_to_session`
             keys on the SESSION, so a request path reads exactly one person's
             assignments — its own — and cannot ask what an approver holds.
             🛑 THE 27th IS model/run-admission.ts — G692, 19 Sep 2026 — and it
             is the executable form of a sentence `RUN_TRIGGER_KINDS` has
             carried in prose since 5 Aug 2026 with nothing anywhere doing it:
             *"run admission must be idempotent on (period, definition,
             slot-fill state); the trigger is then ATTRIBUTION, and never
             identity."* Three total `Record`s and a NINE-ARM refusal union
             carrying branded ids only, so `AssertNoTextDeep` holds on it —
             the unfilled SLOT NAMES travel on a separate field outside the
             proof, because `SlotName` is `= string` and bare.
             ⚠️ IT DOES NOT HASH: `slotFillBasis()` returns the RFC 8785
             canonical form and the digest lives with the writer outside
             `model/`, which is `0012` §6's rule for `subject_ref`.
             ⚠️ `trigger_not_enabled` IS NOT AN ARM AND CANNOT BE — `manual`
             is deliberately outside `RUN_TRIGGER_KINDS`, so the contract's
             422 is unreachable from `admitRun` and belongs to the
             `scheduled` admitter nobody has written.
             🛑 NOTHING BINDS A `SourceDocument` TO A SLOT anywhere in this
             repository, so the fill is EMPTY on every served request and a
             definition declaring an `exactly_one` slot is a 422 forever. That
             is the correct answer — *"Running anyway would raise exceptions
             for absent documents and call them breaks"* — and it is stated on
             the declaration so nobody reads `[]` as *all slots satisfied*.
             🛑 THE 26th IS model/onboarding.ts — H2's SEQUENCE, G535,
             19 Sep 2026 — and it is the MODEL third of G300 and deliberately
             not the other two: six ordered steps transcribed from
             `S1 Staff.dc.html`'s own `STEPS` array, `whoseHands` total over
             them, exactly-one-`next`, force-marks-everything-below, and an
             APPEND-ONLY forced mark. It closes the pack's own H2 row —
             *"Onboarding state in the model: nothing persists the sequence,
             the force or the mark. NOT BUILT"* — in the MODEL sense only.
             ⚠️ NO TABLE, NO HANDLER, NO CLOCK. `grep -rn 'onboarding'
             db/migrations/` returns nothing and none lands with it (G511:
             *"the fence and the writer are one commit or neither"*), and
             there is NO `stalled` stage though `S1` draws one — it needs a
             per-transition timestamp with no producer and a threshold nobody
             has ruled on. The absence is a tripwire, not an oversight.
             ⚠️ THIS SAID 23
             AND THE COMMAND ALREADY RETURNED 24 BEFORE THIS COMMIT TOUCHED THE
             DIRECTORY: model/held-work.ts landed and nothing here followed it.
             The 24 was not G286's to make stale and is named so this sweep is
             not read as accounting for both. THE 25th IS model/money.ts —
             G111's MONEY CODEC, 19 Sep 2026 under G286, which is where
             model/reconciliation.ts §3 went and which is the only thing
             permitted to convert between the model's `bigint` and the wire's
             decimal string. ⚠️ IT SAID 22
             UNTIL 24 Aug 2026, when model/ingestion.ts landed under G225 carrying
             G184's one intake vocabulary, G205's `Arrival` and G206's pack
             classification rules — a `module_specified_not_written` gap the
             graph had been reporting as a document promising a file. IT SAID 19
             UNTIL 22 Aug 2026, 20 FOR A FEW HOURS AFTER, AND 21 UNTIL 23 Aug
             2026, when model/serving-host.ts landed under G225 and closed
             G179's circularity. TWO MODULES LANDED
             ON TWO BRANCHES AT ONCE — model/session.ts (G225) and
             model/field-path.ts (G214's one parse seam) — AND EACH BRANCH SAID
             TWENTY. THE MERGED TREE IS TWENTY-ONE, WHICH NEITHER SIDE EVER
             COMPUTED. This is §5.11 with a second parent, exactly as the
             reproduction block below warns. Derive it: `ls model/*.ts | wc -l`
db/          SEVENTY-THREE migration files across TWO directories — derive it,
             never read it: `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             🛑 **SEVENTY-THREE IS AN ANSWER NEITHER PARENT OF #606's REBASE COMPUTED —
             §5.11 (G4452).** `origin/main` (#607, integrate/6oct-m) was SEVENTY-TWO;
             the S5 branch added `migrations-control/0052_retire_data_plane_control_roles.sql`
             and said SEVENTY-TWO of a DIFFERENT set, because its base had not seen
             #598's `migrations/0620`. 72 + 1 is 73. `node tools/check-migration-numbers.mjs`
             → 0 duplicates in both sequences. **BOTH SEVENTY-TWO NARRATIONS ARE KEPT
             BELOW; only this first word is the claim.** *Derived 6 Oct 2026 — rebase of #606.*
db/          SEVENTY-TWO migration files across TWO directories — derive it,
             never read it: `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             🛑 **SEVENTY-TWO IS AN ANSWER NO PARENT OF integrate/6oct-m COMPUTED —
             §5.11 (G4443).** `origin/main` was SIXTY-EIGHT. #598 added
             `migrations/0620_run_execution_failure_cause.sql` and said SIXTY-NINE;
             the console stack (#600 → #602 → #604) added
             `migrations-control/0050`, `migrations/0600` and `migrations-control/0051`
             and said SEVENTY-ONE, while #600 ALSO said SIXTY-NINE of a DIFFERENT
             sixty-ninth. 68 + 4 is 72. Derive the four, never read them:
             `git diff --name-only --diff-filter=A d7cb1fe6 -- db/migrations db/migrations-control`.
             `node tools/check-migration-numbers.mjs` → 0 duplicates in both
             sequences. **EVERY NARRATION BELOW IS KEPT; only this first word is the
             claim.** *Derived 6 Oct 2026 — integrate/6oct-m.*
db/          SEVENTY-TWO migration files across TWO directories — derive it,
             never read it: `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID SEVENTY-ONE UNTIL LATER ON 5 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE SEVENTY-SECOND IS `migrations-control/0052_retire_data_plane_control_roles.sql`
             (G4320): S5, the last clause of **THE OWNER'S "Full restore" RULING** —
             *"…then retire both control-DB credentials from the data plane."* Every
             privilege `reconcile_control_reader` (G1161) and `reconcile_control_writer`
             (R9) held is revoked and both are `NOLOGIN`; they survive only as shells
             forward-only `0020`/`0040` GRANT to. 🛑 **AND THE SCOPE HELPERS ARE SIX,
             NOT EIGHT** — `db/control-read-scope.ts` and `db/control-write-scope.ts` are
             deleted with the credentials. Derive it: `ls db/*-scope.ts | wc -l` → 6.
             *Derived 5 Oct 2026.* THE PREVIOUS ENTRY FOLLOWS, KEPT WHOLE:
db/          SEVENTY-ONE migration files across TWO directories — derive it,
             never read it: `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID SEVENTY UNTIL LATER ON 5 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE SEVENTY-FIRST IS `migrations-control/0051_forced_mark_authorisation.sql`
             (G4317): a forced onboarding mark names the platform authorisation it
             was written under — S3 of **THE OWNER'S "Full restore" RULING**, in which
             the onboarding WRITES move behind the control plane's signed endpoints
             and the data plane stops opening its writing control-database pool
             (G4316). NULLABLE: earlier marks are append-only and are not backfilled.
             *Derived 5 Oct 2026.* THE PREVIOUS ENTRY FOLLOWS, KEPT WHOLE:
db/          SEVENTY migration files across TWO directories — derive it,
             never read it: `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID SIXTY-NINE UNTIL LATER ON 5 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE SEVENTIETH IS `migrations/0600_tenant_name_projection.sql`
             (G4311–G4315), S2 of **THE OWNER'S "Full restore" RULING**: *"copy the
             tenant name to the data plane"*. A PROJECTION of the roster's name,
             pulled over the signed internal edge — not a `tenant.tenant` column,
             which G185(d) still refuses — so `getSessionPrincipal` no longer reads
             the control database (G3356 amended). *Derived 5 Oct 2026.* THE PREVIOUS
             ENTRY FOLLOWS, KEPT WHOLE:
db/          SIXTY-NINE migration files across TWO directories — derive it,
             never read it: `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID SIXTY-EIGHT UNTIL 5 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE SIXTY-NINTH IS `migrations/0620_run_execution_failure_cause.sql`
             (G4366), applying **THE OWNER'S RULING G4362**: *"Terminal status for an
             execution error: REUSE `failed` (no contract change); record the reason
             separately."* ONE nullable column on `run`, `execution_failure_cause`, and
             ONE `CHECK` that it stands only beside `failed` — no vocabulary `CHECK`
             (`0007`'s polarity), no grant (`0002`'s covers it), and NO wire field.
             🛑 **AND #600 WROTE THE SAME HEADLINE OF A DIFFERENT FILE — §5.11, KEPT
             RATHER THAN MERGED INTO ONE (G4443):** ⚠️ **THIS SAID SIXTY-EIGHT UNTIL
             5 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE SIXTY-NINTH IS `migrations-control/0050_control_plane_serves_console.sql`
             (G4306–G4309), the first half of **THE OWNER'S "Full restore" RULING**:
             *"…put onboarding writes and roster reads behind signed control-plane
             endpoints, then retire both control-DB credentials from the data
             plane."* `0040`'s writer grants, given to `reconcile_control_app` — the
             CONTROL plane's own role — plus `internal_request_receipt`, the
             append-only table the internal writes are idempotent on, carrying the
             platform authorisation id of every act. 🛑 **NOTHING IS REVOKED YET**:
             the data plane still holds `reconcile_control_reader` and
             `reconcile_control_writer` until the stack's S5 drops both.
             *Derived 5 Oct 2026.* THE PREVIOUS ENTRY FOLLOWS, KEPT WHOLE:
db/          SIXTY-EIGHT migration files across TWO directories — derive it,
             never read it: `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID SIXTY-SEVEN UNTIL 4 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE SIXTY-EIGHTH IS `migrations/0560_tenant_reporting_currency.sql`
             (G4101–G4110), applying **THE OWNER'S RULING G4046**: *"Declare tenant
             currency."* ONE TABLE, `tenant.tenant_reporting_currency`, PK
             `tenant_id`, `0001`'s predicate verbatim, `SELECT` only. 🛑 **NOT THE
             ROSTER**: G185(d) limits the control-owned row to identification and
             placement, and a reporting currency is neither (G4102). ⚠️ **NO
             DEFAULT AND NO BACKFILL** — an undeclared tenant is served `null`,
             never an invented currency (G4103); staging's `SGD` arrives by seed.
             *Derived 4 Oct 2026.* THE PREVIOUS ENTRY FOLLOWS, KEPT WHOLE:
db/          SIXTY-SEVEN migration files across TWO directories — derive it,
             never read it: `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID SIXTY-SIX UNTIL integrate/4oct-j AND WAS CORRECT WHEN
             WRITTEN.** THE SIXTY-SEVENTH IS `migrations/0520_co_member_names.sql`
             (G3886–G3888), applying **THE OWNER'S C3-05 RULING**: *"Narrow
             name-only read: a policy letting a tenant member read display_name
             (only) of people who share their tenant membership; widen G447's
             directory rule for that one column."* ONE policy, `TO
             reconcile_name_reader` alone — a NOLOGIN role holding `SELECT (id,
             display_name)` on `tenant."user"` and nothing else, which no request
             role can become — and ONE security-barrier view it OWNS,
             `tenant.co_member_name`, which `tenant_rw` may select. 🛑 **ROW LEVEL
             SECURITY CANNOT SAY "ONE COLUMN"**: a policy admitting co-members to
             the app role would have admitted their `email` too, witnessed RED.
             *Derived 4 Oct 2026 — integrate/4oct-j.* THE PREVIOUS ENTRY FOLLOWS, KEPT WHOLE:
db/          SIXTY-SIX migration files across TWO directories — derive it,
             never read it: `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID SIXTY-FIVE UNTIL LATER ON 4 Oct 2026 AND WAS CORRECT
             WHEN WRITTEN.** THE SIXTY-SIXTH IS `migrations/0510_signed_variance.sql`
             (G3803–G3806), applying **THE OWNER'S RULING ON C3-02/C3-09**: *"Store
             a signed delta: the engine records direction (over/under); the column
             shows sign, totals net correctly, 'In variance' is defined as the open
             residual."* ONE column, `exception.delta_money_direction` — the money
             delta's `absolute` STAYS A MAGNITUDE, so no stored row changes meaning
             under G88 — one whole-or-absent `CHECK`, and a second RESTRICTIVE
             `FOR INSERT` policy refusing an engine row with an unsigned non-zero
             money delta. *Derived 4 Oct 2026.* THE PREVIOUS ENTRY FOLLOWS, KEPT WHOLE:
db/          SIXTY-FIVE migration files across TWO directories — derive it,
             never read it: `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID SIXTY-FOUR UNTIL 4 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE SIXTY-FIFTH IS `migrations/0500_engine_raises_exceptions.sql`
             (G3741–G3750, derived): `INSERT` on `tenant.exception` and
             `exception_observed_value` goes to a SECOND LOGIN ROLE,
             `reconcile_engine` (member of `reconcile_app`, `NOBYPASSRLS`), and to
             NO role a request handler holds — `0015`'s *"mint a finding against
             itself"* refusal stands for the request path, witnessed. A
             RESTRICTIVE `FOR INSERT` policy pins an engine-raised row (run named,
             account present, no summary, open). Plus `tenant.definition_exception_rule`
             (declared rule/severity per residue cause; `SELECT` only, writer owed)
             and a nullable `reconciliation_definition.domain`. *Derived 4 Oct 2026.*
db/          SIXTY-FOUR migration files across TWO directories — derive it,
             never read it: `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             🛑 **THE SIXTY-THREE BELOW IS #560's AND THE SIXTY-FOUR FURTHER DOWN IS
             #566's; NEITHER IS ABOUT THIS TREE BY ITSELF — §5.11 (integrate/3oct-h).**
             The sixty-fourth is `migrations/0480_exception_run_id.sql`; the
             sixty-third is `migrations/0470_deal_value_currency.sql`. Both
             narrations are kept below. *Derived 3 Oct 2026 — integrate/3oct-h.*
db/          SIXTY-THREE migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THE HEADLINE BELOW SAID SIXTY-ONE AND THE COMMAND ALREADY
             RETURNED SIXTY-TWO BEFORE THIS SLICE** (`migrations/0430_period_dates.sql`
             landed and no headline followed it; not this slice's to make stale).
             THE SIXTY-THIRD IS `migrations/0470_deal_value_currency.sql`
             (G3561, **THE OWNER'S**: *"Deal registration carries a currency:
             amount + currency through the money codec"*; G3562–G3563 derived) —
             three columns, the codec's three fields, and two CHECKs: whole money
             or none, and never both the old undenominated `annual_value` and the
             new money. 🛑 **THE ROWS BEFORE IT ARE NOT BACKFILLED** — assigning
             SGD would be supplying a denomination nobody declared (G3562).
             *Derived 3 Oct 2026.* THE PREVIOUS ENTRY FOLLOWS, KEPT WHOLE:
db/          SIXTY-FOUR migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THE HEADLINE BELOW SAYS SIXTY-ONE AND THE COMMAND ALREADY
             RETURNED SIXTY-THREE BEFORE THIS SLICE TOUCHED THE DIRECTORY** —
             `0430_period_dates` and `0470_deal_value_currency` landed and no
             headline followed them; they were not this slice's to make stale.
             THE SIXTY-FOURTH IS `migrations/0480_exception_run_id.sql`
             (G3621–G3628; **G3621 IS THE OWNER'S**: *"Add run id: exceptions
             record the run that raised them; the register, counts and 'Needs
             you' can scope to the selected run."*) — ONE nullable column, a
             composite FK to `public.run` (NO ACTION) and one index. **NULL means
             not recorded; no existing row is given a run.** No grant: nothing in
             `server/` inserts an exception, so the engine writer is owed (G3623).
             *Derived 3 Oct 2026.* THE PREVIOUS ENTRY FOLLOWS, KEPT WHOLE:
db/          SIXTY-ONE migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID SIXTY UNTIL 3 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE SIXTY-FIRST IS `migrations/0420_definition_name.sql`
             (G3351–G3353, derived) — ONE `ADD COLUMN name text` on `0069`'s
             `tenant.reconciliation_definition`, the column `0069` refused BY
             NAME because nothing read it; `Run.definitionName` is the reader,
             in the same commit. ⚠️ **NULLABLE, against G1372, because staging
             holds rows and both defaults would invent a name.** No grant, no
             policy, no `CHECK`. ⚠️ **AND THE TENANT'S NAME GOT NO COLUMN**:
             G185(d) keeps it control-side, so `getSessionPrincipal` reads it
             from `tenancy_roster` instead (G3356).
             *Derived 3 Oct 2026.* THE PREVIOUS ENTRY FOLLOWS, KEPT WHOLE:
db/          SIXTY migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID FIFTY-NINE UNTIL 2 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE SIXTIETH IS
             `migrations/0400_email_verified_upgrade.sql` (G2941–G2946;
             **G2941 IS THE OWNER'S**, answering G2908: *"Yes, upgrade-only: a
             column-level UPDATE that only ever sets
             tenant."user".email_verified false→true, only inside a sign-in
             scope, only from a verified token for that same subject."*).
             🛑 **`GRANT UPDATE (email_verified)` AND NOTHING WIDER — THE FIRST
             `UPDATE` OF ANY KIND ON `tenant."user"`**, which `0200` §7 refused
             by name for `status`; `status` stays unwritable. A `BEFORE UPDATE`
             trigger holds the transition (`false → true` only — `0059`'s
             reason: a policy cannot see OLD and NEW), pins every OTHER column
             by the whole row so the property survives a wider grant, and
             requires `app.proved_email` to equal the STORED address (G2944:
             a token proving a NEW address says nothing about the OLD one, and
             `0370` §3a matches offers to the stored one).
             ⚠️ **NO NEW POLICY, AND THAT IS A MEASUREMENT (G2943)**: `0241`'s
             `user_signin_mint_restrictive` is `FOR ALL`, so its `WITH CHECK`
             already pins an `UPDATE` to the sign-in scope's subject and door —
             `0200` wrote it that way *"so if a later commit grants one the door
             test is already in place."* A second spelling would be §5.3.
             Recursion measured against PostgreSQL 14.18: none (G2946).
             **THE PREVIOUS ENTRY IS KEPT WHOLE BELOW.**
db/          FIFTY-NINE migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             🛑 **FIFTY-NINE IS AN ANSWER NO PARENT OF integrate/2oct-d EVER
             COMPUTED — §5.11 WITH THREE PARENTS (G2931).** `origin/main` was
             FIFTY-SIX. #518 and #521 each said FIFTY-SEVEN of a DIFFERENT
             fifty-seventh (`0380_arrival_filename_and_parking` and
             `0390_invitation_gaps`), and #520 wrote no count at all for its
             own `migrations/0360_sign_in_attempt_begun_host.sql` — the
             omission class, which `check-doc-counts` cannot see. **56 + 3 is
             59.** Derive the three, never read them:
             `git diff --name-only --diff-filter=A 7d3f51db -- db/migrations db/migrations-control`.
             `node tools/check-migration-numbers.mjs` reports **0 duplicates**
             across both sequences — the reservation held. **EVERY NARRATION
             BELOW IS KEPT AND EACH IS CORRECT ABOUT ITS OWN BRANCH; only this
             first word is the claim.**
             *Derived 2 Oct 2026 — integrate/2oct-d.*
db/          FIFTY-SEVEN migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             🛑 **FIFTY-SEVEN IS AN ANSWER NEITHER PARENT OF #518's MERGE WITH
             `origin/main` EVER COMPUTED — §5.11 WITH A SECOND PARENT (G2922).**
             BOTH parents said FIFTY-SIX and each meant a DIFFERENT fifty-sixth:
             `feat/arrivals-parked` added `migrations/0380_arrival_filename_and_parking.sql`,
             `origin/main` (#517) added `migrations/0370_partner_invitation_redemption.sql`.
             *The number agreed and the sets did not.* 55 + 2 is 57, and
             `node tools/check-migration-numbers.mjs` reports **0 duplicates**
             across both sequences — the reservation held. **BOTH NARRATIONS
             ARE KEPT BELOW, UNDER ONE HEADLINE THAT EACH OF THEM WROTE.**
             *Derived 2 Oct 2026 — merge of origin/main into feat/arrivals-parked.*
db/          FIFTY-SEVEN migration files across TWO directories — #521's
             narration (`fix/invitation-gaps`), correct about its own branch:
             ⚠️ **THIS SAID FIFTY-SIX UNTIL LATER ON 2 Oct 2026 AND WAS CORRECT
             WHEN WRITTEN.** THE FIFTY-SEVENTH IS
             `migrations/0390_invitation_gaps.sql` (G2901–G2905, ALL DERIVED),
             closing three gaps `0370`'s own slice named ⛔: **G2816** — a
             redemption keyed on an address nobody PROVED; `tenant."user"`
             gains `email_verified` and `0370`'s fence refuses
             `partner_invitation_email_unverified` BY NAME, witnessed RED with
             the term cut (§9b); **G2811** — `0321`'s stateless one-per-address
             UNIQUE index is DROPPED for a trigger allowing ONE STANDING offer,
             under an advisory lock; single use is untouched. ⚠️ **THE ENTRY
             BELOW IS KEPT WHOLE AND IS CORRECT ABOUT ITS OWN FILE:**
db/          FIFTY-SIX migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID FIFTY-FIVE UNTIL 2 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE FIFTY-SIXTH IS
             **`migrations/0380_arrival_filename_and_parking.sql`** (G2831–
             G2840), applying **G2692 — THE OWNER'S RULING**: *"Yes, both: store
             an Arrival's filename verbatim, interpreted by nothing (invariant 6
             via 0022's precedent); add a `parked` ArrivalVerdict arm."*
             🛑 **`0012` §3 REFUSED `filename` BY NAME AND IS NOT EDITED (G88)**;
             `0380` §1 quotes the refusal and overturns its conclusion by
             ruling. The column is on the ARRIVAL, because a parked or refused
             artefact never becomes a document and those are the rows whose name
             a person needs. **`ArrivalFacts` is unchanged at six fields** — the
             name never enters the cascade; it only selects among pairs an
             operator declared, after admission (`model/ingestion.ts` §2a).
             🛑 **THREE TABLES — `held_artefact` (row 9, *"Held unextracted"*),
             `arrival_drain` (row 16) and `parked_escalation` (row 13)** — and
             the one DELETE this schema grants on a payload is FENCED: a held
             copy may be deleted only once its drain is recorded (a restrictive
             policy, witnessed RED by mutation).
             ⚠️ **G295 DOES NOT HOLD FOR THE PARKED INTERVAL AND THAT IS NAMED
             (G2836, ⛔)**: a held artefact has no type, so its subjects are not
             registered until the drain stores it. **The erasure plan over held
             artefacts is owed.**
             ⚠️ **AND THE OTHER PARENT'S NARRATION OF THE SAME NUMBER IS KEPT WHOLE BELOW — §5.11 (G2921).**
             `migrations/0370_partner_invitation_redemption.sql` (G2801–G2816,
             **G2801 THE OWNER'S**: *"Drop `name` from invitePartnerPerson's
             201 (filled at redemption). Then mount it and build invitation
             redemption at first sign-in."*). 🛑 **IT IS THE FIRST `INSERT`
             THIS SCHEMA HAS EVER GRANTED ON A PORTAL-ROLE TABLE, AND IT IS
             NARROW TO ONE PATH**: a permissive policy that requires a sign-in
             transaction, an invitation and the session's own person, plus a
             `BEFORE INSERT` TRIGGER that re-checks no-escalation at the moment
             of redemption — a trigger because, as a `WITH CHECK`, it RECURSED
             (G2804, kept runnable at `tests/db/partner-invitation-redemption.test.ts`
             §8a). Single use is a UNIQUE INDEX (G2802). *Derived 2 Oct 2026.*
db/          FIFTY-FIVE migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             🛑 **FIFTY-FIVE IS AN ANSWER NO PARENT OF integrate/1oct-c EVER
             COMPUTED — §5.11 WITH FIVE PARENTS, AND FOUR OF THEM WROTE THE
             SAME KIND OF SENTENCE ABOUT DIFFERENT FILES (G2746).** The tree at
             the fork (`9e0c4c10`) was **47**. #511 added `0310` and said
             FORTY-EIGHT; #512 added `0300` and said FORTY-EIGHT; #513 added
             `0290` and said FORTY-EIGHT — **three FORTY-EIGHTs, three different
             files**, the 16 Aug 2026 capability row's shape three ways at once;
             #514 added `0320`–`0322` and said FIFTY; #515 added `0340`–`0341`
             and said FORTY-NINE. **47 + 1 + 1 + 1 + 3 + 2 = 55.** Derive the
             eight, never read them:
             `git diff --name-only --diff-filter=A 9e0c4c10 -- db/migrations db/migrations-control`.
             `node tools/check-migration-numbers.mjs` → **0 duplicates** across
             both sequences: the reservation scheme held across five agents.
             ⚠️ **THE SCOPE HELPERS ARE EIGHT** (`ls db/*-scope.ts | wc -l`) and
             only #512 moved them (`key-inventory-scope.ts`), so that one figure
             below is correct as written. **EVERY PARENT'S NARRATION IS KEPT
             BELOW AND EACH IS CURRENT ABOUT ITS OWN FILES; only this first word
             is the claim.** *Derived 2 Oct 2026 — integrate/1oct-c.*
db/          FORTY-EIGHT migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID FORTY-SEVEN UNTIL 1 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE FORTY-EIGHTH IS
             `migrations/0300_connection_key_document.sql` (G2571–G2576,
             **R2 AS AMENDED BY THE OWNER**: *"Per-connection, boot-time: fetch
             every registered connection's JWKS at boot and cache by
             connection; audience becomes a column."*) — TWO nullable columns,
             `jwks_uri` and `audience`, which `0011` refused BY NAME as columns
             ahead of their reader; **this commit is the reader**. And ONE
             policy, the SIXTH on `tenant.identity_connection` and the first
             that is an INVENTORY rather than an ADDRESS: it admits every
             BROKERED row when `app.key_inventory = 'boot'`, which only
             `db/key-inventory-scope.ts` sets — the EIGHTH scope helper
             (`ls db/*-scope.ts | wc -l` → 8). 🛑 **IT ADMITS WHOLE ROWS AND
             ITS BOUND IS A CENSUS** — one call site, in `main.ts`, at boot;
             three named columns; `BEGIN READ ONLY` — and the column-granted
             role that would have been a CONSTRUCTION was measured and FAILS
             (`permission denied for table membership`, G2573). **NO WRITER**:
             a path that could write `jwks_uri` could point a door at a key set
             it controls.
             ⚠️ **AND THE PREVIOUS ENTRY IS KEPT WHOLE BELOW, because it is
             correct about its own four files:**
             ⚠️ **THIS SAID FORTY-SEVEN UNTIL LATER ON 1 Oct 2026 AND WAS
             CORRECT WHEN WRITTEN.** THE FORTY-EIGHTH IS
             `migrations/0290_sign_in_begin.sql` (G2541–G2545, **THE OWNER'S
             RULING**: *"INSERT-only grant on sign_in_attempt with a
             restrictive WITH CHECK, attempt TTL per D6-6"*). It ENDS `0013`'s
             *"no `INSERT` on the attempt table by design"* — **the writer is
             `server/data-plane/signin-begin.ts`, in the same commit (G511)** —
             with a COLUMN-LEVEL `INSERT` that omits `consumed_at`, and a
             RESTRICTIVE `FOR INSERT` fence pinning the row to the SCOPE: its
             digest, `started_at = now()`, an expiry no later than the TTL, and
             a door a VERIFIED claim on the scope's domain reaches. Plus ONE
             column, `identity_connection.authorization_endpoint` — the place a
             browser may be sent, off the ROW and never off the request.
             🛑 **ITS FIRST DRAFT CLAIMED A CHECK OVER `identity_connection`
             WOULD RECURSE THROUGH `0280`'s PIN POLICY, AND MEASURING IT
             REFUTED THAT** — the write commits; the real reason for reading
             `domain_claim` is the verification bit. Corrected on the file's
             face and kept runnable at `tests/db/signin-begin-fence.test.ts` §5.
             `0291`–`0299` are reserved to this slice and UNSPENT.
db/          FIFTY migration files across TWO directories — derive it, never
             read it: `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID FORTY-SEVEN UNTIL 1 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE THREE ADDED ARE W5's — the partner portal, and they
             are one argument in three files:
             **`0320_partner_authorisation_record.sql`** (G2621, THE OWNER'S —
             invariant 10's THIRD home, session-keyed, no `tenant_id` column),
             **`0321_partner_directory_and_invitation.sql`** (G2624, THE OWNER'S —
             G447 for partners: a narrow `SELECT` on `tenant."user"` under a
             `view_partner_staff` record, plus the three policies that make it
             readable, plus `partner_invitation` with a RESTRICTIVE no-escalation
             `WITH CHECK`) and **`0322_partner_deals_sandbox_and_trials.sql`**
             (G2631–G2640, derived — four tables keyed on the act's RECEIPT).
             🛑 **THE RECURSION HAZARD THE OWNER SAID TO RE-MEASURE DID FIRE — ON
             THE RECEIPT, NOT ON THE PERSON (G2623).** `0320`'s firm-and-verb term
             was a `WITH CHECK` and, once `0321` gave the assignment and role
             tables arms that read the receipt, every portal act answered
             `infinite recursion detected in policy for relation
             "partner_authorization_grant"`. It is a `BEFORE INSERT` trigger now.
             ⚠️ **`partner_role_assignment` STILL HAS NO `INSERT` (G2629)** — an
             invitation names an email and an invitee has no user row until first
             sign-in, so the grant went to the invitation table and REDEMPTION is
             owed. **NOTHING HERE NAMES A TENANT** — invariant 2's single path is
             still the only one, asserted over a socket.
db/          FORTY-NINE migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID FORTY-SEVEN UNTIL 1 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE TWO ADDED ARE C9's DECLARATION HALF (G2681–G2690,
             DERIVED AND NOT THE OWNER'S): **`0340_source_declaration.sql`** —
             `tenant.endpoint` gains its declaration (five `NOT NULL` columns),
             the address becomes TWO TYPED TABLES (`endpoint_sftp`,
             `endpoint_s3`) pinned to their kind by a composite foreign key,
             `intake_channel` gains a column-level `INSERT` and `UPDATE
             (enabled)`, and the stop is an APPEND-ONLY event table — and
             **`0341_source_document_type_pair.sql`**, the source × type pair and
             its field mapping, which POINTS AT `document_field_spec` and never
             writes it. 🛑 **THE `INSERT` ON `tenant.endpoint` NAMES SEVEN
             COLUMNS AND NOT THE THREE BINDING ONES**, so a declaration cannot
             arrive carrying a credential reference — custody stays the only
             writer of `credential_ref` (G2401). `0342`–`0359` are reserved and
             unspent.
db/          FORTY-SEVEN migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             🛑 **FORTY-SEVEN IS AN ANSWER NO PARENT OF THIS MERGE EVER
             COMPUTED — §5.11 WITH FOUR SECOND PARENTS, G2533, integrate/1oct-b
             (1 Oct 2026).** `origin/main` (after #505) held **43**. R13 (#503)
             added `0260` and said FORTY-TWO; C9 (#506) added `0270` and said
             FORTY-TWO; R10 (#507) added `0250` and said FORTY-TWO; S6 (#509)
             added `0280` and said FORTY-FOUR. **THREE BRANCHES WROTE THE SAME
             WORD AND MEANT THREE DIFFERENT FILES** — *the number agreed and the
             sets did not*, the 16 Aug 2026 capability row's shape — and git
             aligned their three `FORTY-TWO` headlines with each other, which is
             the merge tool hiding it a second time. **43 + 4 is 47.** Derive the
             four, never read them:
             `git diff --name-only --diff-filter=A origin/main -- db/migrations db/migrations-control`
             → `0250_partner_role` · `0260_run_allocation` ·
             `0270_endpoint_credential_ref` · `0280_signin_callback_pin`.
             `node tools/check-migration-numbers.mjs` reports **0 duplicates**
             across both sequences — the reservation held. **EVERY PARENT'S
             NARRATION IS KEPT BELOW AND EACH IS CURRENT ABOUT ITS OWN FILE; only
             this first word is the claim.**
db/          FORTY-TWO migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THE HEADLINE BELOW SAID THIRTY-FIVE AND THE COMMAND ALREADY
             RETURNED FORTY-ONE BEFORE R10 TOUCHED THE DIRECTORY.** The six
             were not R10's to make stale and are named so this sweep is not
             read as accounting for them; the many entries below are kept as
             the history they are. **THE FORTY-SECOND IS
             `migrations/0250_partner_role.sql` — R10, THE OWNER'S (G2321–
             G2326, 1 Oct 2026)**: `tenant.partner_role`,
             `tenant.partner_role_capability`, `tenant.partner_role_assignment`
             — `0009`'s platform trio plus `partner_id` on both rows and a
             COMPOSITE FOREIGN KEY, so a role and an assignment cannot name two
             firms. 🛑 **RLS IS SESSION-KEYED AND THE PARTNER-KEYED SHAPE IS
             REFUSED ON THE FILE'S FACE** (G2325): it would need a seventh scope
             helper and would make every table a FIRM ROSTER — the
             administrative reach G447 measures this schema as having nowhere.
             ⚠️ **EVERY POLICY IS `FOR SELECT`** (G1982 / `0027`), and the app
             role holds `SELECT` alone: nothing writes a row, so every partner
             reaching the fifth arm is refused at
             `partner_staff_assignment_absent` today. ⚠️ **NO `tenant_id`
             COLUMN** — *"If a `tenantId` is ever added here, invariant 2 has a
             second path, written in a field."*
db/          FORTY-TWO migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             🛑 **THE HEADLINE BELOW SAYS THIRTY-FIVE AND THE COMMAND ALREADY
             RETURNED FORTY-ONE BEFORE THE C9 SLICE TOUCHED THE DIRECTORY** —
             the six were not its to make stale and are named so this sweep is
             not read as accounting for them. **THE ONE IT ADDS IS
             `migrations/0270_endpoint_credential_ref.sql`** (G2401, THE
             OWNER'S, and G2406) — TWO TABLES, ONE FILE.
             🛑 **ITS STRONGEST PROPERTY IS A COLUMN THAT DOES NOT EXIST**:
             `tenant.endpoint` has no secret, password or value column — *"only
             a credentialRef lives in Postgres"* — and a CHECK makes key
             material UNSTORABLE in `credential_ref` (`^cred_[0-9a-f]{32}$`).
             `tests/http/credential-binding-served.test.ts` §4 searches every
             relation in `tenant` and `public` for a bound value rather than
             trusting the absence. `SELECT` and a COLUMN-LEVEL `UPDATE` on the
             three binding columns — G358's shape a fifth time — and **no
             `INSERT`, no `DELETE`**: declaring a source is its own C9 row.
             ⚠️ **AND `tenant.tenant_key_handle` HAS A READER AND NO WRITER**:
             the handle-to-tenant join was promised to the control-plane
             catalogue and exists nowhere, so a bind for a tenant with no row
             REFUSES rather than encrypting under a shared key.
db/          FORTY-FOUR migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID FORTY-THREE UNTIL 1 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE FORTY-FOURTH IS
             **`migrations/0280_signin_callback_pin.sql`** (W3/S6, G2481,
             G2485 — G2235 and G2443 applied): ONE column,
             `identity_connection.token_endpoint` (G2443's *"the PINNED
             connection's token endpoint only"* had no column to be read from),
             and ONE `FOR SELECT` policy admitting the door a `state`'s attempt
             PINNED, keyed on its own GUC so the MINT scope never sees it beside
             its pair (G344 intact). The recursion hazard `0200` measured was
             RE-MEASURED against a live PostgreSQL first, seven arms, kept
             runnable at `tests/db/signin-callback-pin.test.ts`.
db/          FORTY-THREE migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THE HEADLINE BELOW SAYS THIRTY-FIVE AND THE COMMAND ALREADY
             RETURNED FORTY-ONE BEFORE THE D6-6/D6-7 SLICE TOUCHED THE
             DIRECTORY** — the merges since that sweep carried six more files
             and the first word moved for none of them. **The six were
             not this slice's to make stale** and are named so this sweep is
             not read as accounting for them. THE TWO THIS SLICE ADDS ARE
             **`migrations/0240_sign_in_attempt_expiry.sql`** (D6-6, THE
             OWNER'S, G2201–G2203 — a RESTRICTIVE policy ages a sign-in
             attempt out after ten minutes, a window the SLICE chose) and
             **`migrations/0241_user_mint_names_the_subject.sql`** (D6-7, THE
             OWNER'S, G2204–G2206 — `user_signin_mint_restrictive` gains the
             SUBJECT term; the recursion hazard S1 measured was RE-MEASURED
             against a live PostgreSQL rather than assumed). Both witnessed
             RED first at `tests/db/signin-expiry-and-subject-fence.test.ts`.
             ⚠️ **NEITHER MOUNTS ANYTHING.** The entries below are kept whole
             and each is correct about its own files.
db/          FORTY-TWO migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             🛑 **THIS HEADLINE SAID THIRTY-FIVE AND THE COMMAND ALREADY
             RETURNED FORTY-ONE BEFORE R13 TOUCHED THE DIRECTORY — the six were
             not R13's to make stale and are named so this sweep is not read as
             accounting for them.** THE FORTY-SECOND IS
             `migrations/0260_run_allocation.sql` (**R13, THE OWNER'S, 1 Oct
             2026** — G2371–G2374): ONE table, `tenant.run_allocation`, a run's
             allocations as `(side, ItemRef)` pairs plus `Money` plus typed
             `PairingEvidence` operands. *"Persist ids only … never the
             counterparty join-key text … Invariant 6 held by absence."* There
             is no join-key, counterparty or description column and
             `tests/db/run-allocation.test.ts` §3/§5 assert the absence.
             `SELECT, INSERT`; no `UPDATE`, no `DELETE`; one writer,
             `persistRunEngineAccount()`, in the envelope's transaction.
             ⚠️ **THE ENTRY BELOW SAID THIRTY-FIVE AND IS KEPT WHOLE**, because
             it is correct about its own file:
             ⚠️ **THIS SAID THIRTY-FOUR UNTIL 22 Sep 2026 AND WAS CORRECT WHEN
             WRITTEN — the FOURTH consecutive sweep of this line to find it
             right, after nine that did not.** THE THIRTY-FIFTH IS
             `migrations/0220_domain_claim.sql` (G1942–G1944, under the
             owner's S7 ruling).
             🛑 **IT IS OWED TO THIS COMMIT BY NAME, BY ANOTHER MIGRATION**, and
             that is why it is not a column on an existing table. `0009` refused
             a `domains` column and said: *"`DomainClaim[]` is read by
             `mayRouteToConnection()` at HOME-REALM ROUTING time, and nothing
             routes a realm in this repository … **The commit that builds
             federated sign-in owns the `domain_claim` table, in the same
             commit as the router that reads it.**"* `resolveHomeRealm` is that
             router, and it is mounted in the same commit.
             🛑 **THREE COLUMNS, AND THE TWO THAT ARE ABSENT ARE REFUSED BY
             NAME.** `challenge` is the VERIFIER's — there is no verifier, and
             `keyRef` would be a pointer into a key store this repository does
             not have, in a table the request path can read. `verification
             _expires_at` is **G231 DECLINING A DECISION**: nothing routes on
             it, `mayRouteToConnection()` takes no clock for the same reason,
             and a column here would be the obvious thing for the next reader
             to add an `AND … > now()` against — the polarity that locks a
             tenant out of its own directory on a clerical failure. The absence
             is a TRIPWIRE at `tests/db/domain-claim.test.ts` §5.
             🛑 **TWO POLICIES, AND THE SECOND IS OWED BY ONE REFUSAL ARM.**
             `domain_claim_realm_rls` keys on `app.claimed_domain` — a GUC set
             from a field of an UNAUTHENTICATED request body, which is
             `db/signin-scope.ts`'s LOOKUP-KEY rule and not invariant 1
             inverted: it narrows, it names no tenant and no organisation, and
             every decision downstream is read off a ROW. The third policy on
             `tenant.identity_connection` exists because `status` lives on the
             CONNECTION, so without it `connection_disabled` is unreachable and
             **every claimed domain answers `domain_not_claimed` — a refusal
             that is WRONG and looks right.**
             🛑 `SELECT` AND NOTHING ELSE (G1952). A path that could write here
             could claim a domain it does not own, prove it by writing a
             timestamp, and capture every sign-in at it — and the ORGANISATION
             those people resolve to, because `orgClass` is
             `orgFor(connection.owner)`. **THE WRITER IS OWED AND IT IS TWO
             THINGS**: `addSignInDomain` mounted, and a DNS TXT verifier.
             🛑 **AND BOTH POLICIES SHIPPED AS `FOR ALL` WITH A PERMISSIVE
             WRITE CLAUSE NOBODY WROTE — G1982, 22 Sep 2026, AND THE
             MIGRATION ASSERTED THE OPPOSITE ON ITS OWN FACE.** It said
             *"NO `WITH CHECK`, BECAUSE THERE IS NO WRITE TO CHECK"*; its
             premise was true and its conclusion was inverted. **A policy
             with no `FOR` is `FOR ALL`, and a `FOR ALL` policy with a
             `USING` and no `WITH CHECK` REUSES THE `USING` EXPRESSION AS THE
             `WITH CHECK` for INSERT.** So the clause governing writes was
             present, permissive, and derived from `app.claimed_domain` — a
             value the CALLER supplies.
             🛑 WITNESSED RED AGAINST A LIVE PostgreSQL 16.13, not derived
             from the documentation: with the `INSERT` deliberately granted
             to a NOBYPASSRLS role, `INSERT … VALUES ('idc_attacker',
             'victim.example', now())` inside
             `set_config('app.claimed_domain','victim.example')` returned
             **`INSERT 0 1` and COMMITTED**, while the same INSERT for a
             domain the caller had NOT named was refused. **The policy
             admitted precisely the takeover row.** Nothing was reachable —
             the app role holds `SELECT` — so it is a repair and not an
             incident; what `FOR SELECT` buys is that the property survives
             the `GRANT INSERT` `addSignInDomain` will need.
             ⚠️ **`db/migrations/0027_session_lapsed_policy_is_update_only.sql`
             EXISTS IN THIS REPOSITORY FOR EXACTLY THIS DEFECT** — the same
             `FOR ALL` default, on `tenant.session`, where it let the app role
             fabricate a pre-revoked row for another person — **and `0170`
             cited it nowhere.** It does now.
             🛑 **AND ONE INDEX, WHICH IS NOT A PERFORMANCE NOTE (G1981):**
             the PK is `(connection_id, domain)`, PostgreSQL has no index skip
             scan, and **`domain` is the only column any reader or policy
             filters on** — so every realm lookup was a sequential scan whose
             cost an ANONYMOUS caller chooses, holding a pooled connection for
             its whole length.
             ⚠️ **`UNIQUE (domain) WHERE verified_at IS NOT NULL` IS PUT TO
             THE OWNER AND NOT TAKEN (G1983, ⛔).** The argument FOR it is
             real and no document had made it: **the shipped behaviour turns
             a takeover into a PERMANENT SIGN-IN OUTAGE for the victim**,
             which is the opposite of `model/domain.ts`'s own *"A denial of
             service is not an improvement on a takeover"*. Three costs
             against are named on `0170`'s face, and
             `tests/db/domain-claim.test.ts` §7a asserts the index ABSENT so
             the commit that takes the ruling meets the argument.
             ⚠️ **AND THE PREVIOUS ENTRY SAID THIRTY-FOUR AND IS KEPT WHOLE
             BELOW**, because it is correct about its own file:
db/          THIRTY-NINE migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             🛑 **THIRTY-NINE IS A FIFTH ANSWER NO BRANCH EVER COMPUTED, AND
             THIS LINE IS WHERE THE WHOLE WAVE'S §5.11 ARRIVES AT ONCE.** The
             tree at the fork was **THIRTY-FOUR**. FIVE migrations landed
             across the wave, on four different branches, and **no two
             branches saw the same subset** — so the sweeps said THIRTY-FIVE
             (twice, of two DIFFERENT sets), THIRTY-SIX and THIRTY-SEVEN, and
             every one of them was correct about the branch that wrote it.
             **34 + 5 is 39.** Derive the five, never read them:
             `git diff --name-only --diff-filter=A origin/main -- db/migrations db/migrations-control`
             → `migrations/0170_field_spec_data_type` ·
             `migrations/0180_document_type_and_control_total` ·
             `migrations/0190_run_refusal` ·
             `migrations/0200_external_subject_and_claim_map` ·
             `migrations-control/0040_onboarding_writer`.
             ⚠️ **AND THE TWO SWEEPS THAT BOTH SAID THIRTY-FIVE ARE THE 16 Aug
             2026 CAPABILITY ROW'S SHAPE — *the number agreed and the sets did
             not*:** one thirty-five is 34 + `migrations-control/0040`, the
             other is 34 + `migrations/0200`, and neither contains the other's
             file. **Three separate sweeps also carried a clause congratulating
             this line on being right** — *"the FOURTH consecutive sweep of
             this line to find it right, after nine that did not"* — **while
             not one of their numbers was right about the tree that resulted.**
             This line's own tally is now eleven wrongs deep and none of them
             has ever been an arithmetic mistake.
             ⚠️ **`check-doc-counts` GOVERNS NO MIGRATION COUNT**, so the gate
             was EXIT 0 with all four figures standing. The control that DOES
             read these files is `node tools/check-migration-numbers.mjs`, and
             it reports **0 duplicates across both sequences** on the merged
             tree — the reservation scheme held. **That is a different question
             from how many there are, and it is the only one anything
             automated can answer.**
             **EVERY BRANCH NARRATION IS KEPT BELOW AND EACH IS CURRENT ABOUT
             ITS OWN FILES; only this first word is the claim**, derived by
             hand on the merged tree.
             *Derived 21 Sep 2026 — integrate/all-sixteen.*
db/          THIRTY-SEVEN migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID THIRTY-SIX UNTIL LATER ON 21 Sep 2026 AND WAS
             CORRECT WHEN WRITTEN.** THE THIRTY-SEVENTH IS
             **`db/migrations/0190_run_refusal.sql`** (G1511–G1515, E6,
             DERIVED AND NOT THE OWNER'S) — TWO TABLES, and it is the
             migration `0007` NAMED IN ADVANCE on its own face: *"`outcome`
             ADMITS `refused` ALREADY, AND NOTHING WRITES IT TODAY … the
             migration that persists the refused arm ADDS COLUMNS rather than
             reshaping this one."*
             🛑 **IT ENDS A COLLISION THAT WAS THEORETICAL UNTIL THE SAME
             COMMIT MADE IT REAL.** A refused run had NO account row, so
             `getRunAccount` answered **404 — the identical answer it gives
             for a run nobody reconciled.** Nothing executed, so nothing was
             ever refused; **E5 lands in this commit and runs start being
             refused for genuine reasons**, and an operator could not tell
             *"the engine refused your definition"* from *"nobody ran it"*.
             `frontend/src/components/RunAccount.tsx` keeps THREE state
             machines for that route precisely so the distinction can be
             rendered once it becomes real.
             🛑 **TYPED COLUMNS AND NOT ONE `jsonb`, ON `0007`'s OWN GROUND** —
             *"a result nobody may read is not persistence"*, and a refusal
             stored as opaque JSON is a refusal an operator cannot be shown a
             reason from. **Cost accepted: a migration per new refusal arm**,
             paid at a `TS2322` in the reader's exhaustive switch.
             🛑 **`SetReconciliationRefusal` IS FIFTEEN ARMS AND A DRAFT OF
             THIS SLICE SAID TWELVE — the total `Record` caught it, not a
             person** (`TS2739: … missing admitted_item_key_collision,
             control_total_expected_but_absent,
             population_empty_and_not_expected`). That is the `no_items`
             incident `engine-vocabulary.ts` already records, happening again
             to a different union in the same file. G1515.
             ⚠️ **`SELECT, INSERT` AND NOTHING ELSE — NO `UPDATE`** (a path
             that could amend a stored refusal could rewrite WHY a run
             produced nothing, turning an operator's broken definition into a
             platform refusal) **AND NO `DELETE`**; `0010`'s
             append-only-as-a-PRIVILEGE, a fifth time. The `INSERT` is granted
             because `persistRunRefusal()` lands with it — G511.
             ⚠️ **NO `CHECK` ON ANY VOCABULARY COLUMN** (`0007`/`0069`'s
             polarity) and `tests/db/run-executor.test.ts` §9b reads
             `pg_constraint` back and requires ZERO, so a later one is a red
             gate. **AND `population_integrity_refused` ADDS NO TABLE**: it
             reuses `0007`'s `run_population_defect` with a FOURTH `owner`.
             ⚠️ **AND THE PREVIOUS ENTRY IS KEPT WHOLE BELOW, because it is
             correct about its own two files:**
             THIRTY-SIX migration files across TWO directories — derive it,
             never read it — 🛑 **AND THIRTY-SIX IS A THIRD ANSWER NEITHER
             PARENT EVER COMPUTED: both said THIRTY-FIVE and each meant a
             DIFFERENT file** (`0170` on one branch, `0180` on the other).
             *The number agreed and the sets did not* — the 16 Aug 2026
             capability row's exact shape, on this line, for the second time.
             **This line's own tally is now ten wrongs deep and none of them
             was an arithmetic mistake.** Re-derived by hand on the merged
             tree, 21 Sep 2026:
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID THIRTY-FOUR UNTIL 21 Sep 2026 AND WAS CORRECT WHEN
             WRITTEN — the FOURTH consecutive sweep of this line to find it
             right, after nine that did not.** THE THIRTY-FIFTH IS
             🛑 **BOTH NARRATIONS BELOW ARE KEPT AND NEITHER IS CORRECT
             ABOUT THIS TREE — §5.11 WITH A SECOND PARENT, ARRIVING AS A
             DUPLICATED ENTRY RATHER THAN AS A WRONG NUMBER.** One branch
             landed `0170` and one landed `0180`; **each is correct about the
             branch that wrote it and each said the count moved by ONE.** The
             merged tree took BOTH, so it moved by TWO and neither parent ever
             computed it. **Derive it; do not read it.**
             **`db/migrations/0170_field_spec_data_type.sql`** (G1371–G1374,
             DERIVED AND NOT THE OWNER'S) — **NO TABLE, NO POLICY, NO GRANT
             AND NO `CHECK`: ONE `ALTER TABLE … ADD COLUMN data_type text
             NOT NULL`** on `0012`'s `tenant.document_field_spec`.
             🛑 **IT IS INVARIANT 4's COLUMN AND ITS ABSENCE WAS INVARIANT 4's
             LARGEST HOLE.** *"Classification is declared once, on `FieldSpec`,
             and everything derives from it"* — and `FieldSpec` HAS SEVEN
             FIELDS of which `0012` stored FOUR and `0160` added a FIFTH.
             `grep -rn 'data_type' db/` returned NOTHING until this commit,
             and **`0160` §6 names the absence in its own voice**: *"`label`,
             `dataType` and `required` are still absent and are still
             `0004`'s refusal: nothing reads them."* **This commit is the
             reader**, which is `0004`'s own condition and the one `0160` met
             for `confidence_floor`.
             🛑 **WITHOUT IT A CONVERTER DECIDES `ExtractedScalar.kind` BY
             SNIFFING COUNTERPARTY-CONTROLLED JSON** — is `"1234"` an
             identifier or a number? — **which is classification declared by
             the ARTEFACT, exactly what G106 refused on the class axis**, and
             it fails SILENTLY rather than refusing. Every later W1 slice
             breaches invariant 4 without this column. The fixture makes it
             concrete: `invoice.total` is the JSON NUMBER `1000` declared
             `money`, so a sniffer answers `number` and `model/money.ts` is
             never reached for a figure that is money.
             ⚠️ **`NOT NULL`, NO DEFAULT, AND THE RULE IS THE TABLE'S OWN
             (G1372): the column is nullable exactly when the model's field
             is.** `data_class` and `model_processing_allowed` are `NOT NULL`
             because their fields are; `confidence_floor` is nullable because
             `FieldSpec.confidenceFloor` is `number | null`. **`dataType` is
             `DataType` and not `DataType | null`.** The refusal against a
             table holding a row is WANTED — `0140` §2's precedent — and it
             costs nothing today, measured: **no migration inserts a
             `document_field_spec` row**, so the table is empty in every
             deployed database.
             🛑 **NO `CHECK` ON THE VOCABULARY (G1373), WHICH IS THE ONE
             DECISION A READER'S INSTINCT GETS BACKWARDS** — `0007`'s and
             `0069`'s stated polarity: *"an UNKNOWN value must reach the model
             as an `*_unreadable` refusal, not be rejected at write time by a
             list somebody forgot to extend."* **A migration that declines a
             `CHECK` owes a reader that refuses**, and before this slice it
             had none: with `data_type = 'currency'` stored,
             `readAddressablePayload()` answered `"kind":"document"` and
             published the position as good. `asDataType()` is that refusal
             and `tests/db/field-spec-data-type.test.ts` §3 asserts BOTH
             halves.
             ⚠️ **NO `ENABLE`/`FORCE`, NO `ALTER POLICY` AND NO NEW `GRANT`
             (G1374)** — `0011`'s precedent, `0160` §6's verbatim, and all
             three are WITNESSED rather than assumed: §5b DROPS
             `document_field_spec_rls` and requires ZERO ROWS, and §2 SELECTs
             the new column AS THE APP ROLE to prove the table-level grant
             covers a column added later. **`0012` §5's refusal is untouched**
             — a path that could write this column could declare that an
             identifier is a number and have it compared as one.
             🛑 **AND IT MOUNTS NOTHING**: `classifyValue`, `getDocument`,
             `createUpload` and `completeUpload` stay declared and unrouted,
             so the column is proven against a real PostgreSQL rather than by
             a route — `0007`'s precedent. **`0171`–`0179` ARE RESERVED AND
             UNSPENT.**
             ⚠️ **AND THE PREVIOUS ENTRY IS KEPT WHOLE BELOW, because it is
             correct about its own file:**
             **0180_document_type_and_control_total.sql — R11, THE OWNER'S
             RULING OF 21 Sep 2026** (G1401–G1405): *"`DocumentType` gets its
             own tenant table, one row per document type."*
             🛑 IT IS TWO TABLES AND THE COUNT MOVES BY **ONE**, because a
             migration is a FILE and not a table — the same distinction the
             entry below draws in the other direction.
             🛑 `DocumentType` HAD **NO TABLE ANYWHERE**: seven declared
             fields and not one column, while `tenant.document_field_spec`
             and `tenant.source_document` BOTH key on `document_type_id` —
             two tables pointing at a row that did not exist. Derive it
             against the commit before this one:
             `grep -rn 'CREATE TABLE tenant.document_type' db/` → nothing.
             🛑 **IT IS INVARIANT 4 FAILING ONE LEVEL UP AND THAT IS WHY IT
             IS A RULING.** `carriesControlTotal` lived only on
             `0160`'s `definition_population` — once per DEFINITION — so
             **two definitions reading the same document type could disagree
             about its fidelity and about whether it carries a trailer**, and
             nothing in the schema could notice.
             `model/reconciliation.ts` had already named it a stopgap in its
             own voice: *"The declaration belongs on `DocumentType` … Two
             spellings of one declaration is a drift risk."*
             ⚠️ **AND THE DRIFT IS NOT CLOSED, ONLY HOMED.** `0160`'s column
             is NOT dropped — G88 is forward-only and
             `PopulationBinding.carriesControlTotal` is still REQUIRED on
             `SetReconciliationInput`, so dropping it is a MODEL change
             (DP-2). **There are now TWO columns spelling one declaration**,
             pinned at `tests/db/document-type-and-control-total.test.ts` §8b
             so the commit that folds them deletes an assertion on purpose.
             The obligation moves to E4: read the DOCUMENT TYPE, never the
             definition's copy.
             🛑 **`control_total` IS THREE ARMS AND NEVER A DEFAULT, AND THE
             THIRD IS UNREPRESENTABLE AS THE SECOND BECAUSE THE DISCRIMINANT
             IS ITS OWN `NOT NULL` COLUMN.** `declared` ·
             `expected_but_absent` (a truncated file — a REFUSAL, never a
             zero) · `not_declared_by_format`. The four payload columns are
             NULL in both of the latter and carry no meaning in either, so
             there is no state in which a payload's nullness tells the arms
             apart — which is exactly what `model/domain.ts` says the obvious
             nullable shape cannot do.
             ⚠️ **AND A FOURTH STATE — NO ROW AT ALL, a document nothing has
             extracted — IS REFUSED IN THE READER AND NOT IN SQL**, because
             the FK points from the control total to the document and the
             reverse would demand a trailer before the document it was read
             out of, breaking `admitAndStoreArrival()` at the first arrival.
             Reading it as `not_declared_by_format` would switch C18 OFF for
             every document in the product, silently, on a green gate. §3d is
             the witness.
             ⚠️ **`SELECT` ONLY ON BOTH, AND THE WRITER IS OWED** — no
             operation on any of the seven tiers authors a document type, and
             the two that MINT one (`installPack`, `publishPackVersion`) are
             DECLARED AND UNMOUNTED, so the intended writer is G110's
             publication seam with G58's authoring surface upstream. A
             `GRANT INSERT` today is `0004`'s *"a write privilege ahead of its
             writer"*. ⚠️ **AND NO FOREIGN KEY INTO IT**, measured rather than
             forgotten: nothing can write a `document_type` row, so an FK from
             `source_document` would refuse EVERY ingestion permanently.
             ⚠️ **THE PREVIOUS ENTRY IS KEPT WHOLE BELOW AND IS CORRECT ABOUT
             ITS OWN FILE:**
db/          THIRTY-FIVE migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID THIRTY-FOUR UNTIL 21 Sep 2026 AND WAS CORRECT WHEN
             WRITTEN — the FOURTH consecutive sweep of this line to find it
             right, after nine that did not.** THE THIRTY-FIFTH IS
             `migrations-control/0040_onboarding_writer.sql` — **R9, THE
             OWNER'S RULING OF 21 Sep 2026**: *"Yes, the data plane may hold a
             WRITING credential for the control database, via a sixth scope
             helper and a second control-database role."*
             🛑 **NO TABLE AND NO COLUMN: one role's worth of GRANTS, one
             `CREATE FUNCTION` and one `CREATE TRIGGER`.** It is the first
             write privilege this database has ever granted to anything that
             serves a request, and the trigger is the property that privilege
             SPENDS: until this file, *"a prefix length never shrinks"* was
             held by there being no writer at all.
             🛑 **`UPDATE` IS COLUMN-LEVEL ON ONE COLUMN AND FOUR VERBS ARE
             REFUSED BY NAME** — G358's shape, the second instance in the
             product. NO `INSERT` on `onboarding_record` (the serving role may
             ADVANCE a delivery record and may not CREATE one), NO `DELETE`,
             and `INSERT` and nothing else on `onboarding_forced_step`.
             Witnessed live, each one: `permission denied for table
             onboarding_record`.
             ⚠️ **A `CHECK` CANNOT EXPRESS MONOTONICITY** — it sees one row and
             the rule is a relation between OLD and NEW — which is `0059`'s
             finding one database over, and why this is a `BEFORE UPDATE`
             trigger. **It refuses a DECREMENT and PERMITS an EQUAL write**,
             because refusing the equal would turn an at-least-once retry into
             a 500 where the model already answers a 409.
             ⚠️ **AND IT MADE TWO TEST FIXTURES RED, WHICH IS THE TRIGGER
             WORKING**: `tests/db/onboarding-record.test.ts` §7a and §7b
             restored an out-of-range count by writing it back DOWN, as the
             ADMIN, and now DELETE-and-INSERT instead. The captured red is
             quoted on both.
             🛑 **AND `tests/db/control-plane-census.test.ts` §A WENT RED BY
             DESIGN AND IS RE-ARGUED AT ITS OWN SITE**, which the owner
             accepted as one of R9's two named costs: `deepEqual(writable, [])`
             becomes an enumeration against `WRITE_BY_DESIGN`, two (role,
             relation) pairs. **The empty list is not weakened, it is SPENT.**
db/          THIRTY-FIVE migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ **THIS SAID THIRTY-FOUR UNTIL 21 Sep 2026 AND WAS CORRECT WHEN
             WRITTEN — the FOURTH consecutive sweep of this line to find it
             right, after nine that did not.** THE THIRTY-FIFTH IS
             `db/migrations/0200_external_subject_and_claim_map.sql`
             (W3-S1, G1631–G1636) and it is **THE LARGEST WRITE PRIVILEGE THIS
             SCHEMA HAS EVER GRANTED**: `GRANT INSERT ON tenant."user"`, for
             **R5, THE OWNER'S** — *"a person is AUTO-PROVISIONED ON FIRST
             SIGN-IN."*
             🛑 **AND THE FENCE IS THE INTERESTING PART, BECAUSE THE OBVIOUS
             ONE IS UNWRITABLE. A POLICY ON `tenant."user"` MAY NOT READ
             `tenant.identity_connection` AT ALL** — a first draft resolved the
             door with a subquery and **every arm of the probe, eleven of
             eleven, answered `infinite recursion detected in policy for
             relation "user"`.** The cycle is NOT self-reference, which is why
             it was not predicted: `0018`'s `identity_connection_directory_rls`
             ends `AND (id IN (SELECT u.connection_id FROM tenant."user" u))`,
             so the loop closes through a SECOND TABLE — and it is STRUCTURAL,
             because that policy's leading `EXISTS` is false on every sign-in
             and PostgreSQL still refuses. **That is `0020`'s recursion class
             through a table nobody was looking at**, and the lesson is that
             *"does this policy name its own table"* is a LANDMARK while the
             property is *"is this relation reachable from its own policy
             expansion"* — §5.1, inside the argument written to avoid §5.1.
             🛑 **THE REPAIR IS G576's COMPOSITE FOREIGN KEY**: the broker pair
             is carried ON the person and `(connection_id, broker_issuer,
             broker_ref)` REFERENCES the connection, so a disagreeing row is
             UNREPRESENTABLE rather than refused and the policy reads the row's
             OWN columns. **MATCH SIMPLE is what makes it safe against every
             existing row** — a seeded person carries NULL in both and the
             constraint is never checked.
             🛑 **THE DOOR TEST IS THREE DATABASE OBJECTS AND DELETING ANY ONE
             DEGRADES IT SILENTLY**: the policy pins the PAIR to the scope's
             GUCs, the FK pins `connection_id` to a row carrying that pair, and
             `0011`'s partial unique index makes at most ONE row carry it.
             ⚠️ **AND THE RESTRICTIVE POLICY CARRIES `WITH CHECK` AND NO
             `USING`, ON A SECOND AND DIFFERENT MEASUREMENT**: a `RESTRICTIVE …
             FOR ALL USING (false)` took a session-scope read of
             `tenant."user"` from one row to ZERO while `WITH CHECK (false)`
             left it untouched — so the obvious tidy-up is an **authentication
             outage**, because `resolveSubject()` reads that table on every
             request in a scope where no broker GUC is set.
             ⚠️ **NO `UPDATE` AND NO `DELETE`** — an `UPDATE` could flip
             `status` from `disabled` back to `active`, which `0009` says in
             its own voice must stay refusable BY NAME. The cost is named: a
             person's `email` and `display_name` go STALE and re-projection is
             a separate ruling.
             ⚠️ **AND THERE IS NO `subject_claim`** though R6 mints a claim
             map: the subject is the sign-in scope's LOOKUP KEY and is needed
             BEFORE the transaction opens, and a subject mapped to a mutable
             claim makes an account REASSIGNABLE. `sub`, fixed.
             ⚠️ **THIS SAID THIRTY-TWO UNTIL LATER ON 20 Sep 2026 AND WAS
             CORRECT WHEN WRITTEN — the THIRD consecutive sweep of this line
             to find it right, after nine that did not.** THE THIRTY-THIRD
             AND THIRTY-FOURTH ARE ONE SLICE AND ARE **G1241, THE OWNER'S
             RULING OF 20 Sep 2026**: *"Onboarding state lives in a table in
             the CONTROL database, one row per tenant, beside the roster —
             and `stage` is DERIVED at read time from the stored step state,
             never stored twice."*
             🛑 THEY ARE **ONE FILE**, `migrations-control/0030_onboarding_
             record.sql`, AND THE COUNT MOVES BY **ONE**; the sentence above
             says TWO because `0161` and `0160` landed in the same window on
             another branch. **Derive it; this line's own tally is nine
             wrongs deep and none of them was an arithmetic mistake.**
             🛑 IT IS THE **FIRST TRIGGER AND THE FIRST FUNCTION THIS
             DATABASE HAS EVER HAD** — `grep -rn 'CREATE FUNCTION\|CREATE
             TRIGGER' db/migrations-control/` — and unlike `0019` one
             database over it OVERTURNS NO CLAIM, because nothing here had
             said there must never be one. **TWO triggers, not one, and that
             is G1243's measurement rather than tidiness: a `FOR EACH ROW`
             trigger does not fire on `TRUNCATE` at all**, so an append-only
             guarantee resting on one is defeated by a single statement and
             looks exactly like a guarantee until it is. Witnessed against a
             row-trigger-only draft: `UPDATE` → ERROR, `DELETE` → ERROR,
             `TRUNCATE` → `TRUNCATE TABLE`, `count(*)` → 0.
             🛑 **THE APPEND-ONLY TRIGGER IS THERE BECAUSE THE GRANT IS
             VACUOUS AGAINST THE ONLY WRITER THIS TABLE HAS.** `0010`'s
             append-only-as-a-PRIVILEGE is taken — no role holds `UPDATE` or
             `DELETE`, which also makes `INSERT … ON CONFLICT DO UPDATE`
             unreachable — but no role holds `INSERT` either, so the only
             thing that writes a forced mark is `server/control-plane/
             provision.ts` as the **ADMIN**, and an admin holds every
             privilege by construction.
             ⚠️ **THE PREFIX-LENGTH PROPERTY IS HELD BY AN ABSENCE AND NOT BY
             A CHECK (G1242): ONE INTEGER COLUMN, so `"step four done, step
             two not"` has nowhere to be written down.** `CHECK
             (completed_steps >= 0)` and **NO UPPER BOUND** — a `<= 6` is a
             third copy of `ONBOARDING_STEPS.length` that G88 then freezes,
             so an out-of-range count is a READER refusal
             (`completed_count_unreadable`) using a bound read from the tuple
             itself. `0069`'s polarity, applied to a number.
             ⚠️ **NO `stage` COLUMN, AND G833 IS NOT DISCHARGED — IT IS WHAT
             MADE A DERIVATION NECESSARY.** `onboardingStage()` is the one
             place the rule lives; `tests/db/tenancy-roster.test.ts` §4a is
             UNCHANGED TO THE CHARACTER and still passes.
             ⚠️ **NO RLS AND NO POLICY**, which is `0001`'s argument and
             `0002`'s, unchanged: there is no tenant session in that database
             and there cannot be one. The assurance is
             `tests/db/control-plane-census.test.ts`, which both tables join
             by APPLYING — two deliberate edits are owed there and are made
             in the same commit.
             ⚠️ **AND THE PREVIOUS ENTRY SAID THIRTY AND IS KEPT WHOLE BELOW**,
             because it is correct about its own two files:
             ⚠️ **THIS SAID THIRTY UNTIL 20 Sep 2026 AND WAS CORRECT WHEN
             WRITTEN**, which is recorded because this line's own tally says
             it has been wrong on this axis nine times and this is the second
             consecutive sweep to find it right. THE THIRTY-FIRST AND
             THIRTY-SECOND ARE ONE SLICE AND ARE THE OWNER'S TWO RULINGS OF
             20 Sep 2026 — 0160_definition_engine_spec.sql (R-A, G1121–G1126)
             and 0161_explanation_is_not_authored.sql (R-D, G1127).
             🛑 THE THIRTY-FIRST IS THE FIRST TABLE SET THE **ENGINE** CAN
             READ AN INPUT OUT OF. Measured before it was written:
             `SetReconciliationInput` has EIGHTEEN fields and
             `tenant.reconciliation_definition` stored FOUR — `tenant_id`,
             `id`, `version`, `status`, **none of which the engine consumes**
             — so `runSetReconciliation()` has had no definition to run since
             the day it was written. Derive both: `awk '/export interface
             SetReconciliationInput/,/^}/' model/reconciliation.ts | grep -c
             '^  readonly'` → 18. FIVE tables, ONE column added to `0012`'s
             `document_field_spec`, all five ENABLEing AND FORCEing RLS with
             0001's predicate VERBATIM on `USING` **and** on `WITH CHECK`.
             🛑 **A `jsonb` SPEC COLUMN IS THE REJECTED ALTERNATIVE AND IT IS
             PRESERVED ON THE MIGRATION'S FACE**, refused on `0007`'s own
             ground: G284 refused a `jsonb` operand column because *"a JSONB
             key with no `FieldSpec` is UNREADABLE"* and *"a result nobody may
             read is not persistence"*. **Cost accepted and named: a migration
             per new engine knob, forward-only under G88** — paid at a
             COMPILE ERROR rather than at a silent omission, because
             `server/data-plane/definition-store.ts` types its answer as an
             `Omit` of the engine's own interface (G1122).
             🛑 `SELECT` AND NOTHING ELSE ON ALL FIVE, and the deciding
             sentence is `0150`'s from a week earlier, reached independently
             from the other side: **a caller who chooses the operands chooses
             the answer**, and the gate, the policy and invariant 10's record
             would each log that act as perfectly correct. `amount_path`,
             `date_path` and the identifier rows ARE the operands. **THE
             WRITER IS OWED** — no contract operation on any of the seven
             tiers authors a definition, so a `GRANT INSERT` would be `0004`'s
             privilege ahead of its writer; the intended one is G110's
             publication seam or G58's authoring surface.
             ⚠️ ONE ROW PER DEFINITION AND **NOT** ONE PER VERSION, with the
             cost named rather than hidden: a re-run of an older
             `definition_version` reads TODAY'S spec, which partly defeats
             `public.run.definition_version`'s stated job. Closing it means
             making `reconciliation_definition` row-per-version, which is a
             ruling nobody has taken.
             🛑 THE THIRTY-SECOND IS **ONE STATEMENT** —
             `ALTER TABLE tenant.exception ALTER COLUMN explanation_summary
             DROP NOT NULL` — and it is an INVARIANT rather than a schema
             note. R-D: *"Store typed facts only … the sentence is composed
             where it is displayed."* **If nothing ever writes prose,
             invariant 6 cannot be REACHED through `tenant.exception` at any
             price**, rather than being reachable and defended — which is
             `0015`'s own paragraph (*"the rule is enforced where the value is
             USED"*) in a strictly stronger form.
             ⚠️ **A WIDENING OWES AN ANSWER TO WHAT NOW GUARANTEES A READER
             HAS SOMETHING TO RENDER, AND THE ANSWER IS THE READER, BY NAME.**
             Measured rather than argued: with `0161` applied and
             `exception-store.ts` unchanged, `readExceptionQueuePage` answered
             `'page'` and `readException` answered `'exception'` — **both
             surfaces published `"summary": null` against a `required`
             string**, because `fast-json-stringify` serialises without
             validating. Both now answer `unpublishable` by column, in the
             commit that widened it (G511). ⚠️ **AND THE STORE MINTS NO
             DEFAULT STRING**: *"no explanation recorded"* would satisfy the
             wire and would be this repository AUTHORING an explanation.
             ⚠️ **`explanation_expected` IS NOT WIDENED** and the
             non-widening is asserted rather than assumed — so its `NOT NULL`
             is a SECOND, independent blocker on the first executor that
             raises an exception.

db/          THIRTY-ONE migration files across TWO directories — derive it,
             never read it:
             `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             🛑 THE THIRTY-FIRST IS THE SECOND EVER IN
             `db/migrations-control/` THAT IS NOT A TABLE:
             migrations-control/0020_console_read_role.sql (G1161/G1162,
             20 Sep 2026) — **NO TABLE, NO COLUMN, ONE `GRANT USAGE` AND ONE
             `GRANT SELECT`, TO A ROLE THAT BELONGS TO THE OTHER PLANE.**
             The owner's ruling: *"The data plane gains a READ-ONLY
             control-database pool. A second connection, `SELECT` only, on
             its own credential."*
             🛑 **IT SPENDS G193's *BY CONSTRUCTION* AND THE RULING SAYS SO
             IN ITS OWN WORDS:** *"What replaces it is a CENSUS … By
             construction becomes by census, and that is a real loss, not a
             wash."* Until 20 Sep 2026 no process could reach that
             database's storage but the one that owns it, and that was true
             because of `compose.yaml` and an import graph rather than
             because of a `GRANT`. **A census can be undone by a commit that
             adds a table, a grant and an exemption together; a construction
             could not.** What `tests/db/control-plane-census.test.ts` buys
             back is that the undoing is a RED GATE rather than silence.
             ⚠️ READ THE DIRECTION BEFORE QUOTING ANY OF IT: the edge is the
             DATA plane reading the CONTROL database — DOWNWARD, into a
             process that publishes nothing back. **The direction invariant 3
             forbids is untouched**: `server/control-plane/` imports no
             `db/tenant-scope.ts`, holds no `RECONCILE_DB_*`, and is on
             `control-net` alone, so `data-plane-db` still does not resolve
             inside it.
             🛑 `SELECT` ON ONE TABLE AND `pack_catalogue` REFUSED BY NAME —
             it is what the control plane publishes downward over
             `listEntitledPacks`, a declared operation with a version window
             and a lifecycle filter, so a direct read is a SECOND path to the
             artefact past every one of those. Witnessed live
             (`permission denied for table pack_catalogue`) rather than
             inferred from an absent `GRANT`, because an absent grant and an
             absent table look identical in a migration set.
             ⚠️ TWO INDEPENDENT CONTROLS, NOT ONE: the `GRANT` is per
             RELATION and per reviewer; `db/control-read-scope.ts`'s
             `BEGIN READ ONLY` is per STATEMENT and enforced by the server.
             **Witnessed RED against a role deliberately granted the write** —
             `cannot execute INSERT in a read-only transaction`, with an
             ordinary transaction committing the same INSERT as the control
             arm.
             🛑 AND IT MOUNTS NOTHING. `listTenants` is refused on **G833**,
             not on topology: `stage` is `required` on `TenantSummary`,
             nothing persists an `OnboardingRecord`, and
             `fast-json-stringify` serialises without validating. THE
             TOPOLOGY BLOCKER CLOSED AND THE SCHEMA ONE DID NOT
             (G1168, ⛔ not applied).
             ⚠️ THE ROLE IS MINTED IN `server/control-plane/provision.ts` AND
             NOT IN `db/provision.ts`, which is where the slice was told to
             put it: that module connects to `dbTarget()`, and a PostgreSQL
             role is CLUSTER-wide rather than cluster-spanning. §5.1 — the
             landmark was a filename, the property is *the cluster that holds
             the control database*.
             ⚠️ THIS SAID THIRTY UNTIL 20 Sep 2026 AND WAS CORRECT WHEN
             WRITTEN, which is recorded because this line has been wrong on
             the same axis on nine of its previous sweeps.
             🛑 **THIS SAID TWENTY-NINE UNTIL 20 Sep 2026 AND THIRTY IS A
             THIRD ANSWER NEITHER PARENT EVER COMPUTED — §5.11 WITH A SECOND
             PARENT, AND THE INTERESTING PART IS THAT THE MERGE SAW IT AND
             DID HALF THE REMEDY.** It inserted the banner immediately below
             — *"Each is correct about the branch that wrote it and none is
             correct about this tree. Derive; do not read."* — and then left
             the headline word unswept, so **the two entries under it both
             open "THE TWENTY-NINTH IS"** (`0140_reversal_write_and_mix_pins`
             on one branch, `0150_document_slot_binding` on the other) and the
             first word agreed with neither tree. **A banner saying DERIVE
             above a number that was never derived is weaker than no banner**,
             because a reader who takes the instruction seriously stops at the
             headline. `check-doc-counts` governs no migration count, so
             `npm run check` was EXIT 0 throughout — the ninth time this line
             has been wrong on the same axis by its own tally, and the first
             time it was wrong while carrying a warning about being wrong.
             **Both narrations below are kept; this first word is the claim.**
             *Corrected 20 Sep 2026 — G1096.*
> 🛑 **SEVERAL SLICES SWEPT THIS SECTION ON 20 Sep 2026 AND THE MERGE KEEPS
> EVERY NARRATION, WHICH IS §5.11 WITH A SECOND PARENT ARRIVING AS A
> DUPLICATED ENTRY RATHER THAN AS A WRONG NUMBER.** Each is correct about the
> branch that wrote it and none is correct about this tree. **Derive; do not
> read.**

             🛑 THE TWENTY-NINTH IS 0150_document_slot_binding.sql (G961–G964,
             20 Sep 2026, DERIVED AND NOT THE OWNER'S) — ONE TABLE, FOUR
             COLUMNS, TWO PARTIAL UNIQUE INDEXES AND THREE FOREIGN KEYS, and
             it ENDS A SENTENCE THREE FILES CARRIED: *"NOTHING BINDS A
             `SourceDocument` TO A SLOT ANYWHERE IN THIS REPOSITORY."* Both
             `model/run-admission.ts` and `db/migrations/0069` §2 keep their
             own text and are corrected on their own faces rather than
             rewritten.
             🛑 A SECOND THING WENT FROM INERT TO LIVE AND NO DOCUMENT NAMED
             IT: the contract computes the idempotency key from THREE parts —
             *"the period, the definition and the slot-fill state"* — and with
             no producer for the third, `slotFillBasis([])` returned the
             canonical form of `{}` on every request this repository had ever
             served. **`slotFillFingerprint` WAS A CONSTANT**, so the basis was
             two parts wearing three. `tests/http/slot-fill-served.test.ts` §4
             is the first assertion that could ever have caught it.
             🛑 `SELECT` AND NOTHING ELSE, AND THE ARGUMENT IS ON THE
             MIGRATION'S FACE: a request path that could write this table could
             satisfy a required slot with a document IT chose, which makes
             `slot_fill_incomplete` a refusal THE CALLER CONTROLS — `0069`'s
             own sentence about `definition_slot`, arriving through the other
             door. **And the worse half is that `run.inputs` is the operand set
             a run engine will read: a caller who chooses the operands chooses
             the answer**, and the gate, the policy and invariant 10's record
             would each log that act as perfectly correct. Measured rather than
             assumed: no contract operation binds a document to a slot on any
             of the seven tiers, so a `GRANT INSERT` would be `0004`'s write
             privilege ahead of its writer. **THE WRITER IS OWED** — it is the
             ingestion cascade's, and `createUpload`/`completeUpload` are
             declared and unmounted.
             ⚠️ A NULL `period_id` IS THE UNPERIODISED FILL AND NOT A WILDCARD,
             and the reader's `IS NOT DISTINCT FROM` is the half that makes
             that true; `= $2` returns NO ROWS for every unperiodised press and
             would reinstate the 422 this slice removes, silently, with the
             bindings sitting in the table. NO PRIMARY KEY — every PK column is
             `NOT NULL` and the null is a VALUE; `NULLS NOT DISTINCT` is
             PostgreSQL 15 and the local database is 14.
             ⚠️ AND ONE ARM IS NOW REACHABLE AND STILL UNJUDGED, reported
             rather than closed: TWO DISTINCT documents in one `exactly_one`
             slot ADMITS. `CARDINALITY_REQUIRES_A_DOCUMENT` tests for emptiness
             and not exactness, `errors.yaml`'s closed enum has no member for
             it, and all three repairs are rulings. Named on that declaration
             so the commit that takes one meets it.
             🛑 THE TWENTY-EIGHTH IS THE FIRST IN FIVE WEEKS THAT IS NOT IN

             🛑 THE TWENTY-NINTH IS 0140_reversal_write_and_mix_pins.sql
             (G946–G949, 20 Sep 2026) — NO TABLE: ONE `GRANT`, THREE COLUMNS,
             ONE RESTRICTIVE POLICY AND ONE `CREATE OR REPLACE FUNCTION`, and
             it is the fence `tests/db/resolution-chain.test.ts` §10 had been
             asserting the ABSENCE of since G656. `GRANT INSERT ON
             tenant.exception_reversal` and nothing wider — **NO `UPDATE`
             (a path that could rewrite a `reason` from `wrong_disposition` to
             `data_corrected` edits `AutonomyDials.reversalRate` from a
             handler) and NO `DELETE`** (*"reversals accumulate as an array …
             a flag would have erased it"*, with extra steps). 0010's
             append-only-as-a-PRIVILEGE, a fourth time.
             🛑 G511 IS WHY IT IS THIS COMMIT AND NOT AN EARLIER ONE — *"the
             fence and the writer are one commit or neither"* — so
             `server/data-plane/reversal-store.ts` and `reverseResolution`'s
             mount land with it. Delete either and this file becomes 0004's
             refusal. THE RED WAS WITNESSED FIRST: with the `GRANT` commented
             out, the happy path answered **500 `upstream_unavailable`** with
             `permission denied for table exception_reversal`, which is the
             exact 500 `server/data-plane/proposals.ts` predicted in its own
             voice.
             🛑 THE THREE COLUMNS ARE THE HALF NOBODY ASKED FOR AND THEY ARE
             WHY W1-B AND W1-C ARE ONE COMMIT (G947, G952). A reversal CLEARS
             `tenant.exception.resolution_*` — *"cleared on reversal"* — so
             one statement later NO ROW carries which disposition was chosen,
             in which mode, or when. **Mounting `reverseResolution` alone
             would have made `getDispositionMix` publish `reversalRate: 0`
             for every disposition and a `count` short by every reversed
             choice**: two numbers PRESENT and WRONG, one step worse than
             G284's silently absent field. `reversed_disposition_key`,
             `reversed_mode` and `reversed_at` pin the resolution the act
             destroys, all three `NOT NULL` (G411's finding one table over),
             and **none reaches the wire** — `ExceptionReversal` is six fields
             and stays six.
             ⚠️ `ADD COLUMN … NOT NULL` WITH NO DEFAULT REFUSES TO APPLY
             AGAINST A TABLE HOLDING A ROW, AND THAT REFUSAL IS WANTED: until
             this file the table had `GRANT SELECT` alone and no migration
             inserts, so a row here is one nobody had a privilege to write.
             🛑 THE TRIGGER LEARNS A FOURTH VERB IN EXACTLY ONE DIRECTION
             (G949). `0059`'s GUARD 2 called its three *"the closed set of
             verbs the contract declares on this column, and a fourth would
             arrive with its own migration and its own line here"* — this is
             that verb and that line. **`reverse_resolution` may CLEAR a
             resolution and may not MINT one**: the new arm fires only when
             all six columns go to NULL from a row that had one, so
             undo-then-redo in a single act is unrepresentable — *"an agent
             that can undo its own resolutions can launder a bad one"*, in
             SQL. ⚠️ `0059` IS NOT EDITED AND THE TRIGGER IS NOT TOUCHED;
             only the FUNCTION is replaced, which is 0035's precedent minus
             the firing-condition change.
             ⚠️ AND THE TWENTY-EIGHTH IS THE FIRST IN FIVE WEEKS THAT IS NOT IN
             `db/migrations/` AT ALL: migrations-control/0002_tenancy_roster.sql
             (G831, 20 Sep 2026, THE OWNER'S) — **the SECOND table this
             repository's CONTROL database has ever had**, and the answer to
             the question `tests/http/administration-tier-unmounted.test.ts`
             §4b had been asking since G534: *"a roster across all tenants is
             not expressible in [the data] database at all … It belongs in the
             CONTROL database, and that database has one table."*
             🛑 THE MEASURED PROBLEM IS ONE LAYER BELOW THE THREE G534 NAMED,
             AND IT IS A READ: a console act's transaction is a SESSION scope
             (`server/data-plane/authorisation-record.ts`'s platform arm), so
             `app.tenant_id` is unset for its whole life and under G100 every
             tenant-scoped table reads EMPTY. `listTenants` mounted against
             `tenant.tenant` answers `200 {"tenants":[]}` — worse than G300's
             honest 404.
             🛑 SIX COLUMNS AND SIXTEEN REFUSED BY NAME, ON ONE TEST: **what
             would have to read a tenant's data to populate it?** A column
             ahead of its READER is 0004's refusal and is merely wasteful; a
             column whose only possible PRODUCER is a read of
             `tenant.exception`, `public.run` or `tenant."user"` breaks
             invariant 3 at the moment it is filled. `open_exception_count`,
             `value_at_risk_minor`, `last_run_at`, `user_count`, `health` and
             eight more are refused on that; `created_at` and `retention` on
             0004's narrower rule.
             🛑 AND `stage` IS REFUSED THOUGH `TenantSummary` MARKS IT
             `required`, WHICH MAKES ONE REFUSAL A BLOCKER RATHER THAN A GAP
             (G833): nothing persists an `OnboardingRecord` — G535's
             deliberate absence — so a `stage` column here is a SECOND HOME
             for H2's state in the OTHER database, and G656's finding is why
             it matters: `fast-json-stringify` serialises without validating,
             so mounting `listTenants` would ship a 200 missing its own
             required field SILENTLY.
             ⚠️ NO RLS AND NO POLICY, WHICH IS 0001's ARGUMENT AND NOT AN
             OMISSION — there is no tenant session in that database and there
             cannot be one, so a policy would be `USING (true)` or would deny
             unconditionally. **The assurance moved to a place a future table
             cannot slip past instead**: `tests/db/control-plane-census.test.ts`
             (G832) ENUMERATES every relation there and requires the app role
             to hold no write on any of them and a `tenant_id` column to be
             argued. `tests/db/rls-census.test.ts` (G446) cannot see that
             database — it enumerates schema `tenant` in the other one.
             🛑 AND IT MOUNTS NOTHING, FOR A BLOCKER THE OWNER NAMED IN
             ADVANCE AND G835 MEASURES: **G726 put the console SESSION on the
             DATA plane and G831 put the ROSTER in the CONTROL database, and
             nothing joins them.** `compose.yaml` has `data-plane` on
             `data-net` alone; `server/data-plane/config.ts` reads no
             `RECONCILE_CONTROL_*` and says why; `grep -rn 'fetch(' server/`
             returns nothing. Which plane serves the consoles is an OWNER'S
             RULING — see `tests/http/console-roster-unreachable.test.ts`.
             ✅ **THE OWNER TOOK IT ON 20 Sep 2026 — G1161 — AND THE
             PARAGRAPH ABOVE IS CORRECTED RATHER THAN DELETED, because two
             of its three derivations are now false and it is the sentence
             four files carried.** `compose.yaml` puts `data-plane` on
             `data-net` **and `console-read-net`**, a third network whose
             only other member is `control-plane-db`; and
             `server/data-plane/config.ts` reads `RECONCILE_CONTROL_READ_*`,
             its own prefix and **not** the control plane's, with its header
             corrected in place. ⚠️ **THE THIRD DERIVATION IS UNCHANGED AND
             IS THE ONE THAT SAYS WHICH SHAPE WAS TAKEN: `grep -rn 'fetch('
             server/` STILL RETURNS NOTHING.** The SigV4 pull was the
             rejected alternative, and `console-read-net` joins the data
             plane to the control DATABASE and not to the control PLANE
             precisely so no listener resolves. **The consoles are still
             unmounted** — G833, not topology.
             🛑 THE TWENTY-SEVENTH IS 0091_platform_authorisation_record.sql
             (G730, 19 Sep 2026) — TWO TABLES, and it is **INVARIANT 10's
             SECOND HOME**: tenant.platform_authorization_grant and its via
             lines, for an act that HAS NO TENANT. The owner's ruling:
             *"policy keyed on the acting SESSION rather than on a tenant —
             `0009` already does exactly this for the five tables read BEFORE
             a tenant is selected. Same argument, same shape."* **Invariant
             10 keeps ONE MEANING with TWO HOMES, and each home has a scope
             that can actually read it.** The predicate is 0009's VERBATIM
             apart from the column it compares, on `USING` **and** on
             `WITH CHECK`; `SELECT, INSERT` to the app role and **NO
             `UPDATE`, NO `DELETE`** — 0010's append-only-as-a-PRIVILEGE,
             carried across. ⚠️ **THERE IS NO `tenant_id` COLUMN IN THE FILE
             AT ALL** — `grep -c tenant_id db/migrations/0091_platform_authorisation_record.sql`
             → 0 — because G728 refused a nullable one: under G100 that row
             is visible to NO SCOPE, which is G284's *"a result nobody may
             read is not persistence"* on the audit trail. ⚠️ NO
             `revoked_at` and NO PLATFORM EVENT STREAMS: 0014's three streams
             are all tenant-scoped, so **a console act records its
             AUTHORISATION and not its ACCESS**, and whether they gain a
             platform home is the same ruling one table over, NOT taken here.
             ⚠️ IT LIVES IN `tenant.` AND HOLDS NO TENANT ROW, which is
             0009's precedent for `tenant.platform_role*` and is also what
             keeps it inside `tests/db/rls-census.test.ts`'s catalogue sweep.
             🛑 **AND IT MOUNTS NOTHING. THE SERVED SET IS UNCHANGED AT 23 OF
             136** — `grep -rn 'handlers:' server/*/start.ts` — because
             `capability.openapi.yaml` declares no verb reaching `substrate`,
             `catalogue` or `commercial`, so `decide()` refuses every platform
             principal at the GATE, and the 26 `platform-role` operations sit
             on a tier G602 measures as ALL-OR-NOTHING. **G730 removes the
             blocker and performs no mount**, which is the difference between
             unblocking one and taking one.
             🛑 **AND THERE IS A SECOND BLOCKER AT A THIRD LAYER, MEASURED
             RATHER THAN LEFT TO BE FOUND: A CONSOLE ACT'S TRANSACTION IS A
             SESSION SCOPE, SO `app.tenant_id` IS UNSET AND EVERY
             TENANT-SCOPED TABLE READS EMPTY UNDER G100.** `listTenants` is
             the clearest case — `tenant_rls` is
             `USING (id = nullif(current_setting('app.tenant_id', true), ''))`
             — so mounting it would return a 200 with an empty array, which
             is worse than G300's honest 404. Which policy opens the
             platform's view of the fleet is a RULING and it is invariant 3's
             neighbourhood. Named so nobody attempts the mount as a one-liner.
             ⚠️ **THIS SAID TWENTY-SIX UNTIL 19 Sep 2026**, and the
             TWENTY-SIX was itself a third answer neither parent computed:
             one branch landed `0059_resolution_chain.sql` and said
             TWENTY-FIVE, the other landed `0069_run_admission.sql` and said
             the same, and the merged tree carried both — §5.11 with a
             second parent. Run the command; do not read the word.
             🛑 THE TWENTY-FIFTH IS 0059_resolution_chain.sql (G656–G660,
             19 Sep 2026) — SIX TABLES, ONE ADDED COLUMN AND ONE TRIGGER, and
             it is C4's OTHER HALF: tenant.{definition_archetype, disposition,
             approval_config, resolution_proposal, proposal_evidence,
             approval_decision}. It ends the sentence
             `server/data-plane/exceptions.ts` carried in its own voice —
             *"C4 is half of C4 … and THERE IS NO `proposal` TABLE."*
             🛑 THREE OF THE SIX EXIST ONLY BECAUSE G300's TRAP IS A PARTIAL
             TABLE RATHER THAN A MISSING ONE: `fast-json-stringify` serialises
             without validating, so an operation with a model, a capability
             and an almost-complete table ships a 200 missing `required`
             fields SILENTLY. `archetype` and `dispositions` are `required` on
             `listAvailableDispositions`; `quorum`, `segregationOfDuties` and
             `mandatoryAtOrAbove` are `required` on every `Proposal`.
             🛑 THE GRANTS ARE THE PART TO READ. The three REFERENCE tables
             take `SELECT` and nothing else (G657) — a path that could write
             `tenant.disposition` could MINT THE JUDGEMENT IT IS ABOUT TO
             MAKE, and one that could write `tenant.approval_config` could set
             its own quorum to 1 and then approve its own proposal. The three
             ACT tables take `SELECT, INSERT`, plus `UPDATE
             (superseded_by_proposal_id)` — G358's shape, a fourth time.
             NO `DELETE` ANYWHERE.
             🛑 AND ONE WIDENING, ARGUED: `GRANT UPDATE` on SEVEN NAMED
             COLUMNS of `tenant.exception`, including `status`. `0015` refused
             that grant CONDITIONALLY — *"resolution state, WITH NO RESOLUTION
             ROW AND NO REVERSAL TRAIL"* — and the condition has changed. The
             property is restored by a `BEFORE UPDATE` TRIGGER (G659) because
             a POLICY cannot see what changed: `WITH CHECK` sees the NEW row,
             `USING` sees the OLD one, and neither sees both. The other five
             columns `0015` named stay unwritable.
             ⚠️ NO `ALTER POLICY` ANYWHERE IN THE FILE — it adds policies and
             a trigger and replaces none, which is worth one line because
             `0020` records the near-miss where a dropped `NOT EXISTS` would
             have silently widened invariant 8 to `statutory`.
             ⚠️ 0040–0058 ARE RESERVED ELSEWHERE AND UNSPENT. TWENTY-FIVE
             FILES and the highest number is 0059 — not the same fact, and
             `ls` answers the first.
             🛑 THE TWENTY-FIFTH IS 0069_run_admission.sql (G691-G694,
             19 Sep 2026) — THREE TABLES and TWO COLUMNS, and it is the table
             half of the two mounts below. tenant.reconciliation_definition x
             tenant.definition_slot x tenant.reconciliation_period, each
             ENABLEing AND FORCEing RLS with 0001's predicate VERBATIM on
             `USING` **and** on `WITH CHECK`, and **`SELECT` and nothing else
             to the app role on all three** — a path that could write a
             definition could set its own `status = 'active'` and make
             `definition_not_active` a refusal THE CALLER CONTROLS; one that
             could delete a slot turns `slot_fill_incomplete` into an
             admission by removing the requirement rather than satisfying it;
             one that could write a period could REOPEN a closed one, which
             the contract calls a deliberate, audited act.
             🛑 THE TWO COLUMNS ARE ON `public.run` — G88's EXPAND, no
             `ALTER POLICY` anywhere in the file — and the INDEX BESIDE THEM IS
             THE POINT: `CREATE UNIQUE INDEX run_idempotency_key ON run
             (tenant_id, idempotency_key)` **IS** `admitRun`'s idempotency
             guarantee, and the handler's `ON CONFLICT` is how it is read. A
             `SELECT`-then-`INSERT` loses the exact race the operation is
             named for. `trigger_by_user_id` is the other, and without it the
             mount would have shipped a silent loss: the wire's `RunTrigger`
             is `additionalProperties: true, required: [kind]`, so a manual
             run with nobody attached to it VALIDATES.
             ⚠️ NO `CHECK` ON ANY VOCABULARY COLUMN — `0007`'s decision, and
             the polarity is the deciding half: an UNKNOWN value must reach
             the model as an `*_unreadable` refusal, not be rejected at write
             time by a list somebody forgot to extend.
             ⚠️ AND ONE THING IT DOES NOT DO, REPORTED RATHER THAN DONE:
             `0002_run.sql` grants `SELECT, INSERT, UPDATE, DELETE ON run` and
             nothing in `server/` issues an `UPDATE run` or a `DELETE FROM
             run` — derive it with a recursive grep for both over `server/`,
             which returns nothing. Two of those four verbs are privileges
             ahead of their writers, which is `0004`'s refusal wearing a
             grant. They are NOT revoked here, because `run` is a shared table
             concurrent slices build against and a REVOKE lands as an
             invisible failure in whatever is mid-flight.
             ✅ **THE `UPDATE` HALF WENT FALSE ON 4 Oct 2026 — G4031 — AND IS
             CORRECTED RATHER THAN DELETED:** `server/data-plane/run-executor.ts`
             issues `UPDATE run` (status, `finished_at`, `exceptions_raised`)
             through ONE writer that refuses to commit unless exactly one row
             moved (G4001), as `reconcile_engine`, which holds the privilege by
             MEMBERSHIP of `reconcile_app` — so **no migration was owed
             (G4002)**. `DELETE FROM run` still has no writer, and the serving
             role's `UPDATE` is still `0002`'s, pinned rather than revoked at
             `tests/db/engine-raises-exceptions.test.ts` §7c.
             ⚠️ THIS SAID TWENTY-ONE AND THE COMMAND ALREADY RETURNED 22
             BEFORE `0035` TOUCHED THE DIRECTORY: 0027_session_lapsed_policy_is_
             update_only.sql landed and this first word did not move. **The 22
             was not `0035`'s to make stale** and is named so this sweep is not
             read as accounting for both. THAT IS THE EIGHTH TIME THIS LINE HAS
             BEEN WRONG ON THE SAME AXIS.
             🛑 THE TWENTY-THIRD IS 0035_membership_liveness_voids_sessions.sql
             (G561/G562, 19 Sep 2026) — NO TABLE, NO POLICY, NO GRANT: one
             `CREATE OR REPLACE FUNCTION` and one `DROP`+`CREATE TRIGGER`, and
             it repairs the TWO DEFECTS `0027` NAMED AND DELIBERATELY LEFT
             OPEN. **G561: the trigger fires on the membership ceasing to be
             LIVE, not on `revoked_at` changing** — `expires_at` was a second,
             entirely unguarded removal path, measured at *rowCount 1, no
             record, no scope, no raise, every session still live*. **G562: the
             trigger BODY carries the live-membership term the POLICY carries**
             — without it, revoking one of two live memberships VOIDED a live
             member's sessions for a `BYPASSRLS` caller and voided nothing for
             the app role, **all three of `0019`'s guards passing in both
             arms.** ⚠️ NEITHER `0019` NOR `0027` IS EDITED — `0017`'s
             precedent: *"G88 makes migrations forward-only, so editing `0014`
             is refused; it keeps its refusal on its face and this file keeps
             the correction on its own."* 🛑 WHAT G561 DOES NOT CLOSE, named:
             **the clock arriving is not an `UPDATE`**, so a membership that
             lapses purely by time fires nothing — a trigger has no tick. Put
             to the owner, not taken.
             ✅ AND THE OWNER TOOK IT THE SAME DAY — **G641**, and the sentence
             above is CORRECTED RATHER THAN DELETED because it is the ruling's
             own premise and is unchanged about the TRIGGER. **The ruling is
             read-side: no sweeper and no clock.** `holdsLiveMembership()`
             (`model/access.ts` §7a) is the one place the predicate is written,
             `selectTenantForSession()` calls it at binding and
             `resolveAuthority()` calls it on EVERY request — so a lapsed
             member stops being authorised at their next request rather than
             being signed out in the background. **THIS MIGRATION IS
             UNTOUCHED** and 0035 remains correct for what it covers; nothing
             in `db/` moved, which is why the count above did not.
             🛑 THE TWENTY-SECOND IS 0027_session_lapsed_policy_is_update_only.sql
             — `session_lapsed_member_rls` defaulted to `FOR ALL`, so `0019`'s
             `WITH CHECK` governed **INSERT** and the app role could FABRICATE
             a pre-revoked session row for another person. Split in two,
             `FOR SELECT` + `FOR UPDATE`, because `FOR UPDATE` alone left the
             revoking read invisible and the revoke silently doing nothing.
             🛑 THE TWENTY-THIRD IS 0039_partner_access_grant.sql (G576,
             19 Sep 2026) — TWO TABLES' WORTH OF CHANGE IN ONE FILE, and it is
             INVARIANT 2's TABLE. `tenant.partner_access_grant` (six columns,
             `PartnerGrantTerms`'s four plus the pair that names it) **and one
             `ALTER TABLE tenant.tenant ADD COLUMN partner_id`**, which is the
             half of invariant 2 that had never existed anywhere.
             🛑 THE INVARIANT IS A CONJUNCTION — *"`partner_admin(P)` may read
             tenant `T` **iff `T.partnerId = P`**, and only within a live
             `PartnerAccessGrant`"* — and `tenant.tenant` carried nothing about
             who sold it. **A grant table alone would have been HALF an
             invariant under the whole one's name, and it would have looked
             finished.** The join is a composite
             `FOREIGN KEY (tenant_id, partner_id) REFERENCES tenant.tenant
             (id, partner_id)`: the referencing columns are NOT NULL, so under
             MATCH SIMPLE a direct-sold tenant (`partner_id IS NULL`) matches
             nothing and **can hold no partner grant at all, by
             construction** — and the FK binds the MIGRATOR too, so no
             `tests/` fixture can prove the arm against a shape the product
             forbids. It also refuses RELABELLING a tenant that carries a
             grant, which nobody asked for and which is the right order.
             ⚠️ ONE GRANT PER TENANT, `UNIQUE (tenant_id)` — because
             `PrincipalContext.partnerGrant` is SINGULAR by declaration and the
             only alternatives are a READER that chooses (forbidden — *"IT
             DECIDES NOTHING"*) or a MODEL that takes a list (a ruling). THE
             COST IS NAMED: no grant history; re-issuing is an UPDATE.
             ENABLE **and** FORCE RLS, 0001's predicate VERBATIM on `USING`
             **and** on `WITH CHECK`, `SELECT` and nothing else to the app
             role — *"a request path that could write this table could mint the
             only cross-tenant read path in the product."*
             ⚠️ THE READER'S `WHERE` IS **EMPTY** and that is the load-bearing
             line: `partner_id = $1` would delete `partner_grant_other_partner`,
             `revoked_at IS NULL` would delete `partner_grant_revoked`,
             `expires_at > now()` would delete `partner_grant_expired`. The
             tenant narrowing is the POLICY's.
             🛑 IT MOUNTS NOTHING. `administration.openapi.yaml`'s 24 partner
             operations are still unserved and the tier is still not in
             `TIERS` — G578 measures why, and the finding is that the grant was
             never that tier's blocker.
             ⚠️ AND THE WORD ABOVE SAID TWENTY-ONE WHILE THE COMMAND ALREADY
             RETURNED 22 BEFORE THIS SLICE TOUCHED THE DIRECTORY —
             0027_session_lapsed_policy_is_update_only.sql landed and this
             first word did not move. The 22 was not G576's to make stale and
             is named so this sweep is not read as accounting for both. THAT IS
             THE NINTH TIME THIS LINE HAS BEEN WRONG ON THE SAME AXIS.
             ⚠️ 0016, 0021, 0023–0026 AND 0028–0038 ARE GAPS OR RESERVED.
             TWENTY-THREE FILES and the highest number is 0039 — not the same
             fact, and `ls` answers the first.
             🛑 THE TWENTY-FIRST IS 0020_capability_granting.sql (G512,
             19 Sep 2026) — NO TABLE, ONE `ALTER POLICY`, ONE NEW POLICY AND
             ONE `GRANT`, and it is the first write privilege this directory
             has ever granted on the AUTHORITY tables. Two earlier slices
             DESIGNED this fence, measured it, and landed nothing — G449 and
             G511 — because `GRANT INSERT ON tenant.role_assignment` with no
             operation behind it is `0004`'s *"a write privilege ahead of a
             writer"*, and `0009` restates it for this exact table: *"a
             request path that could write `role_assignment` could grant
             itself any capability in the closed set, and `decide()` would
             then permit it CORRECTLY."* **The fence and the writer are one
             commit or neither**, and this is that commit —
             `server/data-plane/role-grants.ts` is the other half.
             🛑 `role_assignment_grant_restrictive` IS A `RESTRICTIVE … FOR
             ALL … WITH CHECK` WITH **NO `USING`**, AND THE ABSENCE IS THE
             MEASUREMENT RATHER THAN AN OMISSION: a `USING` would be applied
             to the read inside the policy's own expression, and that IS
             PostgreSQL's policy recursion. G449 measured that a `WITH CHECK`
             subquerying its own table does NOT recurse, and
             `tests/db/capability-granting.test.ts` §1 re-witnesses it on
             every run instead of trusting the row.
             🛑 `manage_roles` IS G507's RECORD AND NEVER A SECOND EVALUATOR,
             exactly as 0018 does it. The other four terms are `granted_by` =
             the acting subject, `user_id <> actor`, every conferred
             capability already held LIVE by the actor, and deny-on-NULL.
             ⚠️ THE `ALTER POLICY` NAMES `WITH CHECK` AND NOTHING ELSE —
             0009's owed clause — so the `USING` expression is not re-typed
             and therefore cannot be mistyped. §0 of that suite reads
             `pg_policies.qual` back and requires it byte-identical to the two
             sibling policies this file did not touch. 🛑 THAT CONTROL EXISTS
             BECAUSE THE NEAR-MISS IS ON THE RECORD: a draft of 0008 dropped
             the three-governance-list `NOT EXISTS` while `ALTER POLICY`-ing
             `session_selection_restrictive`, which would have parsed cleanly
             and silently widened invariant 8 to `statutory`.
             ⚠️ `INSERT` ONLY, ON ONE TABLE. NO `UPDATE`, NO `DELETE` (an
             `UPDATE` would let a path clear somebody's `revoked_at` or move a
             pin, and a `WITH CHECK` on an UPDATE sees only the NEW row), and
             NO `INSERT` on `role` or `role_capability` — a path that could
             add a verb to a role the granter ALREADY HOLDS widens their own
             authority with no conferral at all.
             ⚠️ 0016 IS STILL A PERMANENT UNSPENT GAP AND 0021 IS STILL
             RESERVED AND UNSPENT. TWENTY-ONE FILES and the highest number is
             0022 — not the same fact, and `ls` answers the first.
             ⚠️ THE WORD ABOVE SAID TWENTY UNTIL 19 Sep 2026 and was correct
             when written, which is the whole reason the command sits beside
             it. THE OLD ENTRY AND ITS §5.11 NARRATION FOLLOW, UNCHANGED:
             TWENTY migration files across TWO directories — derive it, never
             read it: `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             🛑 TWENTY IS A THIRD ANSWER NEITHER PARENT EVER COMPUTED — §5.11
             WITH A SECOND PARENT, AND THIS ENTRY IS WHERE IT LANDED. `main`
             said EIGHTEEN after 0022_correspondence.sql; the administrative-
             directory branch said NINETEEN after 0018 and 0019; the merged
             tree carries all three migrations and neither side ever wrote the
             number down. **A count is a fact about a tree, and a merge makes
             a new tree.** Both descriptions below are current about their own
             files; only this first word was wrong on both sides.
             🛑 THE EIGHTEENTH AND NINETEENTH ARE ONE SLICE AND ARE THE OWNER'S
             TWO RULINGS OF 19 Sep 2026 — 0018_administrative_directory.sql
             (G506/G507) and 0019_membership_revocation_voids_sessions.sql
             (G508/G509/G510). Together they END the sentence four documents
             carried for a day: *"there is no administrative reach in this
             schema."*
             🛑 0019 IS THE FIRST TRIGGER AND THE FIRST FUNCTION THIS SCHEMA
             HAS EVER HAD, and `0005` says in its own voice that there must
             never be one. Derive it, never read it:
             `grep -rn 'CREATE FUNCTION\|CREATE TRIGGER' db/`. It is NOT
             `SECURITY DEFINER` — G160 refused that object and it would be
             useless besides, because `FORCE ROW LEVEL SECURITY` binds the
             owner too, so the only role it would work as is the BYPASSRLS
             migrator. The reach comes from a narrow POLICY instead and the
             function holds no authority of its own;
             `tests/db/membership-revocation.test.ts` §7 reads
             `pg_proc.prosecdef` from the catalogue rather than trusting that
             a keyword was omitted.
             ⚠️ AND ITS FIRING CONDITION AND ITS BODY ARE `0035`'s SINCE
             19 Sep 2026 — G561/G562. `0019` is still the FIRST trigger and
             still the only one; what moved is WHEN it fires (the liveness
             predicate, not the `revoked_at` column) and what its body asks
             before it counts (the live-membership term the policy carries).
             §12 of that suite reads `pg_get_triggerdef` and `pg_proc.prosrc`
             back and requires the WHOLE predicate in both, comments stripped,
             because a first draft checking only the two COLUMN NAMES was
             survived by a mutation that deleted the expiry term.
             🛑 `manage_roles` IS EXPRESSED IN SQL AS THE ACT'S OWN INVARIANT
             10 RECORD AND NEVER AS A SECOND EVALUATOR — G507. The policies
             ask whether this transaction carries a `tenant.authorization_grant`
             row for the capability, named by `app.authorisation_ref`, which
             `writeAuthorisationRecord()` sets from the grant it just wrote.
             ⚠️ IT IS EXACTLY AS STRONG AS INVARIANT 1's OWN FENCE AND NO
             STRONGER, and both files say so; what it buys over a flag is that
             a forged name is INERT and that every directory read leaves an
             append-only record behind it.
             ⚠️ NO NEW `GRANT` IN EITHER FILE and ONE `REVOKE` — G510 takes
             `DELETE ON tenant.session` away, because nothing deletes a session
             and `0005`'s grant had never had a writer. That is `0004`'s rule
             in a direction this directory had not used: not a privilege ahead
             of its writer, but one that outlived the absence of one.
             🛑 THE EIGHTEENTH IS 0022_correspondence.sql (G471/G472/G473,
             19 Sep 2026) — FOUR TABLES, and it is CORRESPONDENCE's table:
             tenant.{counterparty, correspondence_thread,
             correspondence_thread_exception, correspondence_message}. All
             four ENABLE **and** FORCE RLS and carry 0001's predicate VERBATIM
             on `USING` **and** on `WITH CHECK`.
             🛑 THE STRONGEST THING IN THE FILE IS A COLUMN THAT DOES NOT
             EXIST: there is **no `body` column** and there must never be one.
             Invariant 6 — *"Ingested content is data, never instruction"* —
             and the contract agrees at `getThread`: *"Bodies are NOT in this
             response. `bodyRef` is a pointer."* That absence is why a
             correspondence READ surface is safe to mount before its admission
             gate exists. ⚠️ TWO COLUMNS ARE STILL COUNTERPARTY-INFLUENCEABLE
             AND BOTH ARE RENDERED — `correspondence_thread.subject` and
             `counterparty.display_name`, the contract's *"letterhead"* — and
             both are stored verbatim and parsed by nothing.
             🛑 `SELECT` ONLY, FOUR TIMES, AND NOTHING ELSE: no INSERT (a path
             that could open a thread could FABRICATE A CORRESPONDENCE
             HISTORY — evidence in a dispute), no DELETE, and **no
             `GRANT UPDATE (admitted_as_evidence_at)`, refused in advance by
             name** because 0015's G358 makes the column-level UPDATE the
             obvious shortcut to mounting the product's most
             security-sensitive operation with two of its three gates
             unreadable. ⚠️ G472: the `DisclosureRecord` gets NO COLUMNS even
             though `getMessage` publishes it — a column ahead of its writer
             is 0004's refusal, and tests/db/correspondence.test.ts §6 is the
             tripwire. ⚠️ G473: the thread↔exception link carries NO FK to
             tenant.exception, because a retention sweep must not erase the
             record of what we told a vendor about.
             ⚠️ THE NUMBER IS 0022 AND 0016 IS STILL A RESERVED, UNSPENT GAP;
             0018–0021 are reserved elsewhere. EIGHTEEN FILES and the highest
             number is 0022 — not the same fact, and `ls` answers the first.
             🛑 THE SEVENTEENTH IS 0017_usage_record_actor.sql (G387/G411,
             19 Sep 2026) — NO TABLE, ONE COLUMN AND ONE CONSTRAINT, and it
             ENDS THE TWO-OF-THREE: `tenant.usage_record` gains `actor_kind`
             and `audit_event`'s CHECK VERBATIM, so invariant 10's rule is on
             ALL THREE streams. It OVERTURNS refusal (2) on 0014's own face
             and says so there; refusals (1) and (3) STAND.
             🛑 THE KIND AND NEVER AN ID, AND THAT IS THE WHOLE RULING:
             `UsageRecord` is the one record class that SHIPS TO THE CONTROL
             PLANE, so the migration re-examines invariant 3 on its face —
             an actor KIND is a five-member closed vocabulary and is not a
             person; an actor ID would be tenant data on a control-plane wire
             and G387 explicitly does NOT take that decision.
             ⚠️ WHAT CROSSES TODAY IS NOTHING, MEASURED: `PlaneUsageEvent` is
             a SUBSET of the record — twelve properties,
             `additionalProperties: false`, no actor AND NO `authorizationId`
             either — and NOTHING SHIPS ONE AT ALL, because `shipUsageEvents`
             and `recordUsage` are declared and unmounted and
             `grep -rn 'fetch(' server/` returns nothing.
             🛑 G411 IS THE FINDING NOBODY HAD WRITTEN DOWN AND IT BINDS 0014
             TOO: a `CHECK` that evaluates to `NULL` PASSES, so
             `false OR NULL` would admit exactly the row invariant 10 forbids
             — the `NOT NULL` on `actor_kind` is HALF of every constraint
             keyed on it. Found by MUTATION, and the first version of the test
             that catches it passed for the wrong reason. NO `UPDATE`, NO
             `DELETE`, NO NEW GRANT: 0014's table-level `GRANT SELECT, INSERT`
             covers a column added later, and RLS is 0014's, undisturbed by an
             `ADD COLUMN`.
             ⚠️ THIS SAID FOURTEEN UNTIL 19 Sep 2026 AND THE COMMAND ALREADY
             RETURNED SIXTEEN BEFORE 0017 TOUCHED THE DIRECTORY —
             0015_exception_register.sql landed and this first word did not
             move, while the entry below describes it at length. The SIXTEEN
             was not 0017's to make stale and is named so this sweep is not
             read as accounting for all three. ⚠️ AND 0016 IS RESERVED, not
             missing: `tools/check-migration-numbers.mjs` reports a gap and
             deliberately does not fail on one — a collision makes the order
             ambiguous, a gap leaves it total. SEVENTEEN FILES and the highest
             number is 0017; `ls` answers the first.
             ⛔ SUPERSEDED, KEPT AS THE HISTORY IT IS — the line below opened
             this entry until 19 Sep 2026 and every entry under it is still
             current about its own migration:
             FOURTEEN migration files across TWO directories — derive it, never
             read it. 🛑 THE FOURTEENTH IS 0013_federated_signin.sql (G340
db/          SIXTEEN migration files across TWO directories — derive it, never
             read it. ⚠️ THIS SAID FOURTEEN AND THE COMMAND ALREADY RETURNED 16
             BEFORE THE G386 SLICE TOUCHED THE TREE: `0014_invariant_10_event_streams.sql`
             and `0015_exception_register.sql` both landed and this first word
             moved for neither, while the entries below describe both at
             length. **The 16 was not G386's to make stale** — that slice adds
             NO migration at all and deliberately leaves its reserved `0016`
             UNSPENT — and it is named here so this sweep is not read as
             accounting for it. THAT IS THE SEVENTH TIME THIS LINE HAS BEEN
             WRONG ON THE SAME AXIS. 🛑 THE FOURTEENTH IS 0013_federated_signin.sql (G340
             applied, G343 and G344 taken, 19 Sep 2026) — ONE TABLE
             (tenant.sign_in_attempt, seven columns, SignInAttempt's seven
             keys) and ONE SECOND POLICY on tenant.identity_connection, which
             is G340's whole mechanism: a caller with NO SESSION reads exactly
             the door whose broker handle it names. ⚠️ G340's TEXT NAMES ONE
             GUC AND THIS SETS TWO — G343, argued on the migration's face: a
             policy keyed on `broker_ref` alone is the collided key G304
             refused, and the red is recorded —
             `tests/db/federated-signin.test.ts` §2b returned TWO rows against
             a reference-only predicate, the second of them a PARTNER door in
             another pool. 🛑 NO `INSERT` ON THE ATTEMPT TABLE: the writer is
             G315's regional auth host and it does not exist, so this is 0004's
             refusal of a privilege ahead of its writer. The app role holds
             `SELECT` plus `UPDATE (consumed_at)` — COLUMN-LEVEL, which is what
             stops a request path re-pointing a pinned door.
             ⚠️ THIS SAID TWELVE AND THE COMMAND ALREADY RETURNED 13 BEFORE
             THIS COMMIT TOUCHED THE DIRECTORY — 0012_payload_and_subject_index.sql
             (G320) landed and nothing here followed it. The 13 was not this
             slice's to make stale and is named so the sweep is not read as
             accounting for both. 🛑 AND THE NUMBER 0012 WAS NEARLY SPENT TWICE:
             this migration was written as 0012 on a branch whose base did not
             carry G320's, which is precisely the collision `check:migrations`
             (G356) now fails the gate on. THE ELEVENTH IS 0011_federated_connection.sql
             read it. 🛑 THE FOURTEENTH IS 0015_exception_register.sql
             (G357/G358/G359, 19 Sep 2026) — THREE TABLES, and it is the
             OPERATOR SURFACE's table: tenant.exception,
             tenant.exception_observed_value, tenant.exception_reversal.
             ⚠️ THE NUMBER IS 0015 AND NOT 0013, AND THE GAP IS DELIBERATE:
             0013 and 0014 are RESERVED to two concurrent agents, under the
             reservation scheme G356's checker exists because nobody had
             extended it to migrations. So FOURTEEN FILES and the highest
             number is 0015 — not the same fact, and `ls` answers the first.
             🛑 G358 IS THE ONE GENUINELY NEW PRIVILEGE SHAPE IN THIS
             DIRECTORY: `GRANT UPDATE (assigned_to)`, COLUMN-LEVEL, the only
             request-path write in the whole register. Derive it:
             `grep -c 'GRANT UPDATE (' db/migrations/*.sql` → this file only.
             A blanket UPDATE would put `severity_rank`, `status`,
             `value_at_risk_*`, `explanation_summary` and — worst —
             `cost_centre`/`legal_entity`, THE AUTHORISATION ATTRIBUTES,
             inside a handler's reach. NO INSERT (an exception is RAISED BY
             THE ENGINE; a path that could INSERT one could mint a finding
             against itself) and NO DELETE anywhere. All three tables ENABLE
             AND FORCE RLS and carry 0001's predicate VERBATIM on `USING`
             **and** on `WITH CHECK`.
             ⚠️ THIS SAID TWELVE UNTIL 19 Sep 2026. 🛑 THE TWELFTH IS 0011_federated_connection.sql
             read it. ⚠️ THIS SAID TWELVE UNTIL 19 Sep 2026, AND TWELVE WAS
             ALREADY ONE BEHIND BEFORE 0014 TOUCHED THE DIRECTORY:
             0012_payload_and_subject_index.sql landed and this first word did
             not move, while the entry three paragraphs down describes it at
             length. The THIRTEEN was not 0014's to make stale and is named so
             this sweep is not read as accounting for both.
             🛑 THE FOURTEENTH IS 0014_invariant_10_event_streams.sql
             (G317/G376/G377, 19 Sep 2026) — THREE TABLES,
             tenant.{audit_event, data_access_event, usage_record}, and it is
             the OTHER HALF of INVARIANT 10: *"`AuditEvent`, `DataAccessEvent`
             and `UsageRecord` all carry its id"*. Every one ENABLEs AND FORCEs
             RLS and carries 0001's predicate VERBATIM on `USING` **and** on
             `WITH CHECK`; all three take `SELECT, INSERT` and **NO `UPDATE`,
             NO `DELETE`**, inherited from 0010 unchanged.
             🛑 `AUTHORIZATION_MAY_BE_ABSENT` IS ENFORCED AT THE COLUMN ON TWO
             OF THE THREE — `CHECK (authorization_id IS NOT NULL OR actor_kind
             = 'system')` — and the constraint NAMES ONE MEMBER rather than
             transcribing a closed enum, so a sixth actor kind is DENIED a null
             rather than silently permitted. ✅ ON THREE OF THREE SINCE
             0017_usage_record_actor.sql (G387), LATER THE SAME DAY.
             ⚠️ THE PARAGRAPH BELOW READ *"`usage_record` GETS NONE AND THAT
             IS G376"* AND IS CORRECTED RATHER THAN DELETED, because it is the
             sentence that told a reader the meter stream sat outside
             invariant 10's column-level rule, and because G376's three
             refusals are the reasoning G387 answers. THE OWNER TOOK THE FIRST
             OF THE TWO OPTIONS G376 SAID WERE OWED: `UsageRecord` gains a
             discriminant in `model/` — `actorKind`, the KIND and never an ID
             — and 0017 re-examines invariant 3 on its own face rather than
             waving it through. REFUSAL (2) IS OVERTURNED; (1) AND (3) STAND.
             THE TRIPWIRE FIRED AND WAS REPLACED BY THE POSITIVE ASSERTION IN
             THE SAME COMMIT, as its own text demanded. THE ORIGINAL FOLLOWS.
             ⚠️ `usage_record` GETS NONE AND
             THAT IS G376: `UsageRecord` carries NO ACTOR, so there is no
             discriminant to key on; the migration names three repairs and
             refuses all three, the deciding one being that this is the record
             that SHIPS TO THE CONTROL PLANE and a principal attribute on it
             breaks invariant 3. The absence is a TRIPWIRE in
             tests/db/event-streams.test.ts §5a, not an oversight.
             🛑 NOTHING ON A REQUEST PATH WRITES ANY OF THE THREE and
             `CLAUDE.md`'s own sentence — *"a served read records THE
             AUTHORISATION IT RAN UNDER and not THE ACCESS"* — SURVIVES THIS
             MIGRATION UNCHANGED. `DataAccessEvent.maxDataClass` has no
             producer and invariant 4 forbids guessing one; the columns are
             proven by tests/db/event-streams.test.ts over a real PostgreSQL,
             which is 0007's precedent. NO SCOPE COLUMNS: G303, unchanged.
             🛑 THE TWELFTH IS 0011_federated_connection.sql
             (G304/G305/G306, 19 Sep 2026) — NO TABLE, TWO COLUMNS, and it is
             THE ONE BLOCKER `docs/build/deploy-handoff.md` §5a named:
             *"tenant.identity_connection has no column that can hold a Cognito
             provider name. Seven columns, none a broker handle."* It is the
             FIRST migration here that adds a column to another migration's
             table, so there is NO `ENABLE`/`FORCE` block and there must not be
             one — 0009 owns that property and a column inherits it; the
             inheritance is WITNESSED rather than assumed in
             tests/db/identity-substrate.test.ts §6f, where the policy is
             DROPPED and the read must return zero rows.
             🛑 THE HANDLE IS A PAIR — `(broker_issuer, broker_ref)` — because a
             Cognito provider name is unique WITHIN ONE POOL and nowhere else,
             and a colliding handle resolves to the wrong `owner` and therefore
             the wrong `orgClass`: G289's five deleted controls reached by a
             route that needs no default. One PARTIAL UNIQUE INDEX enforces it.
             ⚠️ NO `CHECK` ON THE PAIRING, deliberately, on 0009's own ground —
             a constraint would make the malformed row unrepresentable and the
             REFUSAL untestable. ⚠️ NO `audience`, NO `jwks_uri`, NO
             `claim_map`, NO `attribute_mapping`, NO `enabled_at` — G306, each
             refused BY NAME on the migration's face, because nothing here
             verifies a token and a column ahead of its reader is 0004's
             refusal. ⚠️ NO NEW GRANT: 0009's `GRANT SELECT` covers columns
             added later, and SELECT-only still means no serving process can
             write a broker handle — a path that could would point a door at a
             broker it controls.
             ⚠️ THIS SAID ELEVEN UNTIL 19 Sep 2026. 🛑 THE ELEVENTH IS 0010_authorisation_record.sql
             read it. 🛑 THE TWELFTH IS 0012_payload_and_subject_index.sql
             (G295/G320/G321/G322, 19 Sep 2026) — SIX TABLES, and it is
             INVARIANT 4's TABLE: G106's STORAGE HALF, which this page said in
             its own voice was absent (*"db/migrations/ holds no payload
             table"*). tenant.{intake_channel, arrival, source_document,
             document_payload, document_field_spec, subject_index_entry}.
             🛑 THE THREE PIECES ARE ONE COMMIT BECAUSE G295 RULES THEY MUST
             BE — the payload (a `jsonb` column), the ADDRESSING
             (document_field_spec, `FieldSpec.path` stored, which is what makes
             a position nameable) and the REGISTERED LOCATION
             (subject_index_entry). The contract's word for landing the first
             without the third is UNRECOVERABLE. Every table ENABLEs AND FORCEs
             RLS and carries 0001's predicate VERBATIM on `USING` **and** on
             `WITH CHECK`. ⚠️ NO `UPDATE` AND NO `DELETE` ANYWHERE: four tables
             take `SELECT, INSERT`, and intake_channel and document_field_spec
             take `SELECT` ALONE — a request path that could write a
             `FieldSpec` could DECLARE A CLASSIFICATION, which is 0009's
             role_assignment argument on a different table.
             🛑 G320 ARGUES THE `jsonb` AGAINST G284 RATHER THAN AROUND IT: the
             refusal at 0007 named *"until G106's storage half exists — and
             that half is not written"* as its own premise, and this is that
             slice. A payload has NO CLOSED SET OF KEYS, so there are no typed
             columns to have. ⚠️ G321: `subject_ref` is a TENANT-SALTED KEYED
             DIGEST and NOT `SubjectKeyScheme`'s HMAC — it defeats cross-tenant
             correlation and does NOT resist a guessing attack, because there
             is no key store. ⚠️ G322: ONE of `SubjectLocation`'s ELEVEN
             variants gets columns, behind a CHECK. NOTHING IS MOUNTED.
             🛑 THE ELEVENTH IS 0010_authorisation_record.sql
             (G301, 19 Sep 2026) — TWO TABLES, tenant.authorization_grant and
             its via lines, and it is INVARIANT 10's TABLE. Until it landed the
             invariant had none, and `tests/http/authorisation-record.test.ts`
             was a TRIPWIRE that PASSED BECAUSE THE PROPERTY WAS ABSENT. Both
             ENABLE AND FORCE RLS; 0001's predicate VERBATIM on `USING` **and**
             on `WITH CHECK` — the first `WITH CHECK` this directory has owed
             since 0009 said *"the commit that grants a write here owes it in
             the same commit as the writer."* `SELECT, INSERT` to the app role
             and **NO `UPDATE`, NO `DELETE`**: append-only as a PRIVILEGE, so
             nothing on a request path can amend or erase a record of an act.
             ⚠️ NO `revoked_at`, NO `data_access_event`, NO `audit_event`, NO
             `usage_record` — G301 leaves the LIFECYCLE open by name, and a
             column ahead of its reader is 0004's refusal. 🛑 THE LAST THREE OF
             THOSE WENT FALSE ON 19 Sep 2026 UNDER G317 AND ARE CORRECTED HERE
             RATHER THAN DELETED, because this is the sentence
             `tests/http/authorisation-record.test.ts` §8's tripwire was armed
             on: 0014 lands all three TABLES. `revoked_at` is still absent and
             still refused — G317 says a revocation is a NEW ROW superseding an
             old one, never an `UPDATE`. NO SCOPE COLUMNS
             either: G303, and `decision.scope` is `DENY_ALL` for every row this
             database can produce.
             ⚠️ THIS SAID TEN UNTIL 19 Sep 2026. 🛑 THE TENTH IS 0009_identity_substrate.sql (G299,
             19 Sep 2026) — EIGHT TABLES, and it is **the last blocker**:
             tenant."user", tenant.identity_connection, tenant.role ×
             role_capability × role_assignment, and G289's platform_role ×
             platform_role_capability × platform_role_assignment. Every one
             ENABLEs AND FORCEs RLS. The tenant-scoped three carry 0001's
             predicate VERBATIM; the other five are keyed on the SESSION —
             `id = (SELECT s.user_id FROM tenant.session s WHERE
             s.handle_digest = nullif(current_setting('app.session_ref',
             true), ''))` — because a person is read BEFORE a tenant is
             selected and a `tenant_id` predicate would deny unconditionally
             under G100.
             🛑 NONE OF THE POLICIES FILTERS ON `status`, DELIBERATELY:
             a disabled person must be VISIBLE so the model can refuse them BY
             NAME, and `... AND status = 'active'` would turn `user_disabled`
             into "this session has no person". `SELECT` ONLY to the app role
             on all eight — nothing on the request path mints a role
             assignment, because a path that could would grant itself any
             capability in the closed set and `decide()` would then permit it
             CORRECTLY.
             ⚠️ AND NINE IS A THIRD ANSWER NEITHER PARENT COMPUTED: main said
             EIGHT after 0007, the S-21 branch said EIGHT after 0008, and the
             merged tree carries BOTH. §5.11 with a second parent, for the
             fifth time on 19 Sep 2026 — a count is a fact about a tree, and a
             merge makes a new tree.
             read it: `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`.
             ⚠️ THIS SAID SEVEN UNTIL 19 Sep 2026, when G284 landed
             0007_run_engine_account.sql — THIRTEEN TABLES, a TYPED COLUMN PER
             DECLARED FINDINGS CHANNEL, and the end of a sentence two other
             files had carried for a month: *"NOTHING PERSISTS A RECONCILIATION
             RESULT"*. 🛑 THE HANDLERS DID NOT LAND WITH IT AND THE CONTRACT
             SAYS THEY SHOULD HAVE — G200's freeze was re-put to the owner the
             same day and REAFFIRMED (**it binds until the gate GENUINELY ALLOWS
             SOMEBODY**), so `getRunAccount` and `listRunResidue` are still
             unmounted and the columns are proven by
             tests/db/run-engine-account.test.ts instead of by a route. The
             migration records that tension on its face rather than resolving it
             quietly. ⚠️ G291's `toleranceDeclines` GETS NO COLUMN: it reaches
             no contract tier, and the contract refuses to publish one tolerance
             channel without the other — *"Both, or neither, and neither is what
             stands."* Its ROW-level half does have one,
             run_residue.cause_signed_variance_minor.
             ⚠️ IT SAID SIX EARLIER ON 19 Sep 2026 and NAMED THREE before that,
             🛑 THE EIGHTH IS 0008_staff_grant_selection.sql (S-21, G199/G292),
             AND IT IS THE FIRST MIGRATION HERE THAT `ALTER POLICY`s ANOTHER
             MIGRATION'S CONTROL rather than creating its own: it adds G199's
             one `OR EXISTS (… tenant_access_grant …)` disjunct to 0005's
             `session_selection_restrictive`, plus six tables — the grant, its
             resource lines, and the THREE GOVERNANCE LISTS and the duration
             ceiling as SEEDED REFERENCE DATA, because a policy expression
             cannot import a TypeScript constant. That copy is a MIRROR rather
             than the third-place-to-drift 0002 forbids, and the thing that
             makes it one is a test asserting set equality with
             `model/governance.ts` in BOTH directions.
             ⚠️ ANOTHER AGENT HELD 0007 UNCOMMITTED WHILE THIS LANDED, so this
             number is a fact about a tree that a merge will change — §5.11 with
             a second parent, exactly as the reproduction block warns. Run the
             command; do not read the word.
             ⚠️ THIS SAID SIX UNTIL 19 Sep 2026 and NAMED THREE before that,
             with no 0004 and no 0005; the omission class again, which
             check-doc-counts cannot see because an absent file has no number
             in it.
             migrations/{0001_tenancy_and_rls,0002_run,0003_tenant_schema,
             0004_subject_ledger,0005_session_and_membership,
             0006_tenant_context_projection,0007_run_engine_account,
             0008_staff_grant_selection,0009_identity_substrate,
             0010_authorisation_record,0011_federated_connection,
             0012_payload_and_subject_index,0013_federated_signin,
             0014_invariant_10_event_streams,0015_exception_register,
             0017_usage_record_actor,0018_administrative_directory,
             0019_membership_revocation_voids_sessions}.sql ·
             ⚠️ 0013 AND 0015 WERE MISSING FROM THIS LIST UNTIL 19 Sep 2026 —
             BOTH HAD LANDED AND BOTH ARE DESCRIBED AT LENGTH ABOVE, so this
             is the omission class arriving inside the list that exists to
             prevent it, and `check-doc-counts` was EXIT 0 throughout because
             an absent filename has no number in it. `0016` IS RESERVED AND
             `0013` IS NOT ABSENT ANY MORE, which is why the sentence below is
             corrected rather than deleted.
             ⚠️ 0011 WAS MISSING FROM THIS LIST UNTIL 19 Sep 2026 AND `0013` IS
             GENUINELY ABSENT — reserved to a concurrent agent, which
             `tools/check-migration-numbers.mjs` reports as a gap and
             deliberately does NOT fail: a collision makes the order
             ambiguous, a gap leaves it total. An omission has no number in it,
             so `check-doc-counts` was EXIT 0 while 0011 sat unlisted ·
             migrations-control/0001_catalogue.sql · pg.ts + pg.d.ts ·
             provision.ts · env.ts · migrate.ts. First slice landed 9 Aug 2026.
             🛑 0006 ADDS `environment` AND `deployment_mode` TO THE TENANT
             PROJECTION BECAUSE D1 COULD NOT ANSWER WITHOUT THEM — `TenantContext`
             is four required keys and 0003 shipped two of them. The alternative
             was a handler INVENTING a compliance posture, and the migration
             refuses it in its own header. BOTH VALUES ARE DECLARED DEFAULTS,
             not derived data, and both are control-owned facts with NO
             publication path — owed, not done.
             🛑 SIX NAMED SCOPED HELPERS AND THE SIXTH ARRIVED 22 Sep 2026 —
             derive it, never read it: `ls db/*-scope.ts | wc -l` → 6.
             **THE SIXTH IS realm-scope.ts (withRealmScope, G1945) AND IT IS
             THE FIRST THAT IS OPENED FOR A CALLER WITH NO CREDENTIAL OF ANY
             KIND.** ONE GUC — `app.claimed_domain` — and it is the narrowest
             scope in this directory: `app.session_ref` is never set here
             either, which is the sharper half, because a caller with no
             credential must not be able to open a scope in which a session
             row is addressable even by a digest it guessed.
             🛑 **AND IT ISSUED A BARE `BEGIN` UNTIL 22 Sep 2026 — G1987 —
             WHICH MADE IT THE ONLY READ-ONLY SCOPE IN THIS DIRECTORY WITHOUT
             THE MODE, AND THE ONE OPENED FOR THE CALLER WITH NO CREDENTIAL.**
             It is `BEGIN READ ONLY` now, on `control-read-scope.ts`'s
             argument verbatim: **the GRANT is per RELATION and per reviewer;
             the transaction mode is per STATEMENT and enforced by the
             server.** ⚠️ **AND IT IS WORTH MORE HERE THAN WHERE IT WAS
             BORROWED FROM, BECAUSE OF WHAT G1982 FOUND ONE FILE OVER: it is
             the layer that would have refused a write WHILE THE POLICY WAS
             WRONG.** Both arms are witnessed — the mode read back from
             `SHOW transaction_read_only`, and a write refused by the mode
             alone.
             🛑 IT OWES `session-scope.ts`'s BAR AND **PAYS IT WITH WEAKER
             EVIDENCE THAN ITS FOUR PREDECESSORS, WHICH IS LABELLED AS WEAKER
             ON THE FILE'S OWN FACE RATHER THAN DRESSED UP.** The four arms —
             refused inside `withTenantScope()`, `withSessionScope()`,
             `withSignInScope()` and `withSelectionScope()` — are DERIVED FROM
             THE POLICY TEXT and were not run, because the machine this slice
             was built on has no PostgreSQL (`psql -h 127.0.0.1`:
             `connection refused`). They are kept RUNNABLE at
             `tests/db/domain-claim.test.ts` §3 instead of narrated, so the
             first machine with a database either confirms the header or fails
             the gate.
             🛑 THE CLOSEST MISS IS `withSignInScope()` AND IT IS THE ONE TO
             READ: that helper is keyed on the handle of the door the caller
             has ALREADY been sent to, and `resolveHomeRealm` is the operation
             that ANSWERS which door that is. **A caller cannot name the door
             it is asking about.**
             ⚠️ THIS LINE SAID FIVE UNTIL 22 Sep 2026 and was correct when
             written, which is the whole reason the command sits beside it.
             🛑 SIX NAMED SCOPED HELPERS AND THE SIXTH ARRIVED 21 Sep 2026 —
             derive it, never read it: `ls db/*-scope.ts | wc -l` → 6.
             **THE SIXTH IS control-write-scope.ts (withControlWriteScope, R9,
             THE OWNER'S) AND IT IS THE FIRST THAT MAY WRITE TO A DATABASE THE
             PROCESS HOLDING IT DOES NOT OWN.** It sets NO GUC, for the fifth
             helper's reason exactly, and what it does instead is `BEGIN` —
             **an ordinary transaction, and the absence of a mode is the
             honest shape rather than a missing control.**
             🛑 IT OWES `session-scope.ts`'s BAR AND PAYS IT WITH TWO
             MEASUREMENTS, both against a live PostgreSQL 14.18 before the file
             was written. **REUSING `withControlReadScope()` IS REFUSED BY THE
             SERVER, PER STATEMENT** — `cannot execute UPDATE in a read-only
             transaction`, with the reader deliberately granted the write — so
             the fifth helper cannot be pointed at a write at ANY grant, which
             is the strongest possible form of the answer. **AND THE CONTROL
             ARM IS THE SECOND FINDING**: an ordinary `BEGIN` on that same
             credential PERFORMS the statement, so widening the reader would
             put a privilege behind a CONVENTION where a second role puts it
             behind a CREDENTIAL.
             ⚠️ **WHAT CONTAINS IT IS THE GRANT AND NOTHING ELSE, AND THAT IS
             STATED PLAINLY RATHER THAN DRESSED UP.** There is no `READ ONLY`
             to add and no policy to key a GUC on; `0040` gives the role
             `SELECT` on three tables, `UPDATE` on ONE COLUMN of one, and
             `INSERT` on one. `tests/db/onboarding-write-pool.test.ts` §3
             witnesses seven refusals and one permitted write.
             ⚠️ AND IT HAS NO `query` ON THE POOL, for `tenant-scope.ts`'s
             reason plus one: here the leak would be ATOMICITY, not a scope.
             Both onboarding writes are READ-MODIFY-WRITE, so three
             autocommitted statements let two staff people advance one
             sequence once — **and the trigger cannot see it, because two
             increments are not a decrement.**
             **THE FIFTH IS control-read-scope.ts (withControlReadScope,
             G1161, THE OWNER'S) AND IT IS THE FIRST THAT OPENS A CONNECTION
             TO A DATABASE WITH NO ROW-LEVEL SECURITY IN IT AT ALL.** It sets
             NO GUC — there is nothing in that database that reads one — and
             what it does instead is `BEGIN READ ONLY`.
             🛑 IT OWES `session-scope.ts`'s BAR AND PAYS IT WITH TWO
             MEASUREMENTS RATHER THAN AN ARGUMENT, both run against a live
             PostgreSQL before the file was written. **REUSING
             `withTenantScope()` SETS A SCOPE THAT NARROWS NOTHING**:
             `set_config('app.tenant_id','ten_acme',true)` returned
             `ten_acme` and a bare roster read still returned **2** rows for
             two different tenants — §5.6 wearing a scope's name, and a
             reader meeting it in a diff would believe the read was narrowed.
             **REUSING `CataloguePool.query()` IS A CROSS-PLANE IMPORT** that
             `tests/http/console-roster-unreachable.test.ts` §1b refuses, and
             that assertion SURVIVES this slice unchanged.
             🛑 `BEGIN READ ONLY` IS A SECOND, INDEPENDENT CONTROL AND NOT A
             RESTATEMENT OF THE GRANT — the grant is per RELATION and per
             reviewer, the transaction mode is per STATEMENT and enforced by
             the server. Witnessed RED against a role deliberately granted
             `INSERT`: `cannot execute INSERT in a read-only transaction`,
             with an ordinary transaction committing the same statement as
             the control arm. `tests/db/control-read-pool.test.ts` §5
             re-witnesses BOTH arms on every run.
             ⚠️ THIS LINE SAID FOUR UNTIL 20 Sep 2026 and was correct when
             written, which is the whole reason the command sits beside it.
             tenant-scope.ts (withTenantScope, and the ONE pool) ·
             session-scope.ts (withSessionScope, G160's digest in
             app.session_ref) · selection-scope.ts (withSelectionScope, BOTH
             GUCs, for the tenant-binding write alone) · signin-scope.ts
             (withSignInScope, G340 — `app.broker_issuer`, `app.broker_ref`,
             `app.signin_ref` and an OPTIONAL `app.session_ref`, for the
             federated callback and nothing else. ⚠️ **AND AN OPTIONAL FIFTH,
             `app.external_subject`, SINCE 21 Sep 2026 — G1635** — because
             `0200` §5 gives `tenant."user"` a sign-in policy and **a door has
             MANY people**: keyed on the broker pair alone that policy would
             admit every person on the door, and the pair is a handle a CALLER
             supplies, so a sign-in scope would become a DIRECTORY ENUMERATION
             SURFACE. That is the helper's own rule broken rather than applied.
             Its absence means *this transaction touches no person*, exactly as
             `sessionRef`'s means *does not mint*). session-scope.ts warned
             that "somebody will propose a third"; the third argues itself in
             its own header against that bar and its argument is a MEASURED
             refusal, not a convenience. ⚠️ THIS LINE SAID THREE UNTIL THE
             FOURTH LANDED, AND THE FOURTH OWES THE SAME BAR AND PAYS IT THE
             SAME WAY: the sign-in read is witnessed REFUSED inside
             withSessionScope() — `tests/db/federated-signin.test.ts` §1, which
             is G340's deadlock kept RUNNABLE rather than narrated. 🛑 IT SETS
             FOUR GUCs AND NOT ONE, AND THE REASON IS ATOMICITY RATHER THAN
             TIDINESS: the contract requires the attempt to be consumed *"in
             the same transaction that mints the Session"*, so the unit of
             scoping has to be the unit of atomicity, and a second transaction
             is the replay window G315 names
> 🛑 **SEVERAL SLICES SWEPT THIS SECTION ON 20 Sep 2026 AND THE MERGE KEEPS
> EVERY NARRATION, WHICH IS §5.11 WITH A SECOND PARENT ARRIVING AS A
> DUPLICATED ENTRY RATHER THAN AS A WRONG NUMBER.** Each is correct about the
> branch that wrote it and none is correct about this tree. **Derive; do not
> read.**

server/      105 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES, AND
             A SIGNED INTERNAL EDGE BETWEEN THEM.
             🛑 **105 IS AN ANSWER NO PARENT OF integrate/6oct-m COMPUTED — §5.11
             (G4443).** `origin/main` was 94. #598 added two
             (`data-plane/run-engine-thread.ts`, `data-plane/run-worker-process.ts`)
             and said 96; the console stack added nine (#600's eight, #602's
             `data-plane/tenant-name-sync.ts`) and said 103. 94 + 2 + 9 is 105.
             **THE SERVED SET IS 56 OF 154** — `node tools/served-set.mjs` — and it is
             #600's figure surviving intact: no other parent mounts or declares an
             operation. *Derived 6 Oct 2026 — integrate/6oct-m.* EVERY NARRATION
             BELOW IS KEPT:
server/      96 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             ⚠️ **THIS SAID 94 UNTIL 5 Oct 2026 AND WAS CORRECT WHEN WRITTEN.** The
             two added are **`data-plane/run-engine-thread.ts`** (G4365: the engine
             runs on a `worker_threads` Worker so a deadline can TERMINATE it —
             `runSetReconciliation()` is synchronous, so a timer cannot) and
             **`data-plane/run-worker-process.ts`** (G4366: the worker's body, moved
             so a test drives it; it settles `failed` only from `running`, on the
             deadline or the LAST delivery, and otherwise leaves the message for
             SQS — the owner's amendment of G211, G4361). No operation is mounted
             or declared; the served set is unchanged. *Derived 5 Oct 2026.*
server/      103 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             ⚠️ **THIS SAID 102 UNTIL LATER ON 5 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE ONE ADDED IS `data-plane/tenant-name-sync.ts` (G4311–
             G4315): the tenant-name pull, a SYSTEM act over the signed edge
             (`system` as its authorisation, G4312), at boot and every ten minutes,
             never stopping the plane. No operation is declared or mounted; the
             served set is unchanged at **56 OF 154**. *Derived 5 Oct 2026.* THE
             PREVIOUS ENTRY FOLLOWS, KEPT WHOLE:
server/      102 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES,
             AND SINCE 5 Oct 2026 A SIGNED INTERNAL EDGE BETWEEN THEM.
             ⚠️ **THIS SAID 94 UNTIL 5 Oct 2026 AND WAS CORRECT WHEN WRITTEN.**
             THE EIGHT ADDED ARE S1 OF **THE OWNER'S "Full restore" RULING** and its
             **"SigV4 task role"** ruling (G4301–G4310): `http/internal-request.ts`
             (the one digest both planes sign and verify), `data-plane/sigv4.ts`,
             `data-plane/control-plane-client.ts`, `dev/internal-token.ts` (the local
             seam, behind G192's fence), and `control-plane/{sts-verifier,
             internal-auth,console-store,internal}.ts`. 🛑 **THE CONTROL PLANE VERIFIES
             BY ASKING STS** — a role's SigV4 signature cannot be checked without
             AWS's key, so the data plane signs `sts:GetCallerIdentity` with a digest
             of the real request in its SIGNED headers and the control plane forwards
             it (G4302). That is ONE outbound request from the control plane, and
             `tests/http/console-roster-unreachable.test.ts` §1c is re-argued for it.
             **THE SERVED SET IS 56 OF 154 ACROSS 142 PATHS** — four internal
             operations declared AND mounted on the control plane; derive both:
             `node tools/served-set.mjs` · `node tools/check-doc-counts.mjs --derive`.
             ⚠️ **NOTHING ON THE DATA PLANE CALLS THEM YET** — S3/S4 move the console
             writes and reads behind them. *Derived 5 Oct 2026.* THE PREVIOUS ENTRY
             FOLLOWS, KEPT WHOLE — and its `52 OF 150 ACROSS 138 PATHS` was correct
             when written:
server/      94 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             🛑 **94 IS AN ANSWER NEITHER PARENT COMPUTED — §5.11 WITH A SECOND
             PARENT.** Both said 93 of 92 + one DIFFERENT file:
             `data-plane/document-types.ts` (feat/document-type-labels, G3941) and
             `data-plane/former-member.ts` (#582, G4021). 92 + 2 is 94. The served
             set WAS **52 OF 150 ACROSS 138 PATHS** until 5 Oct 2026 (`node tools/served-set.mjs`) —
             #582 mounts nothing. *Derived 4 Oct 2026, merge of origin/main into
             feat/document-type-labels.* BOTH NARRATIONS ARE KEPT BELOW:
server/      93 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             ⚠️ **THIS SAID 92 UNTIL LATER ON 4 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** The ninety-third is **`data-plane/document-types.ts`** —
             `listDocumentTypes`, `GET /document-types`, on `view_endpoint`
             (G3941–G3945, C3-15): the pick list that names each document type by
             the pack's LABEL, so Setup and the parked pile stop printing `dt_…`
             ids. Declared AND mounted in one commit through `authorisedHandler()`.
             **THE SERVED SET IS 52 OF 150 ACROSS 138 PATHS** — derive both, never
             read them: `node tools/served-set.mjs` and
             `node tools/check-doc-counts.mjs --derive`. *Derived 4 Oct 2026.*
server/      93 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             ⚠️ **THIS SAID 92 UNTIL LATER ON 4 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** The ninety-third is **`data-plane/former-member.ts`**
             (G4021): whether an unnamed approver, proposer or assignee is a
             FORMER member, read off `tenant.membership` alone — never a name, so
             the owner's C3-05 ruling is not widened. And the executor now writes
             the run row's `status`, `finished_at` and `exceptions_raised` (G4031).
             No operation is mounted or declared; the served set is unchanged.
             *Derived 4 Oct 2026.* THE PREVIOUS ENTRY FOLLOWS, KEPT WHOLE:
server/      92 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             ⚠️ **THIS SAID 91 UNTIL 4 Oct 2026 AND WAS CORRECT WHEN WRITTEN.**
             The ninety-second is **`data-plane/exception-raise.ts`** (G3741–G3750):
             the executor now RAISES the exceptions a run produces, in the
             account's transaction, when it runs as `reconcile_engine` — and over
             the app pool it says `not_persisted: privilege_absent` by name. No
             operation is mounted or declared; the served set is unchanged.
             ⚠️ AND `summary` IS NULLABLE ON THE WIRE (G3748, R-D carried through).
server/      91 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             ⚠️ **THE FIRST HEADLINE BELOW SAYS 90 AND THE COMMAND RETURNS 91**
             — §5.11 arriving as a duplicated entry: #534's 90 was merged above
             the 91 of `data-plane/session-principal.ts`, so the first word a
             reader meets was one behind. **The 3 Oct 2026 UI wave (#545–#560)
             added NO file under `server/`.** It widened responses
             (`settlementTallies`, `variance`, `Run.completeness`,
             `capabilities`, `resolution_not_configured`) and **mounted no
             operation**: the served set is still **51 OF 149** —
             `node tools/served-set.mjs`. Derive the absence, never read it:
             `git diff --name-only --diff-filter=A 549d3dd5 caf66abe -- server`
             → nothing. *Derived 3 Oct 2026 — docs/handoff-ui-wave.*
server/      90 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             ⚠️ **THIS SAID 89 UNTIL #534 MERGED origin/main AND WAS CORRECT
             WHEN WRITTEN (G3257).** The ninetieth is **`http/cross-origin.ts`**
             (G3231–G3236): every cookie-authenticated non-safe operation is
             refused at the transport when a browser marks it as started by
             another origin, keyed on the ROUTE, so `signOut` (#528) is covered
             with no edit. The served set is unchanged at **50 OF 148** —
             `node tools/served-set.mjs`. *Derived 2 Oct 2026.*
server/      91 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             ⚠️ **THIS SAID 89 AND THE COMMAND ALREADY RETURNED 90 BEFORE THIS
             SLICE TOUCHED THE DIRECTORY** — `http/cross-origin.ts` (#534, the
             CSRF hook) landed and no headline followed it. The 90 was not this
             slice's to make stale and is named so this sweep is not read as
             accounting for both. THE NINETY-FIRST IS
             **data-plane/session-principal.ts** —
             `getSessionPrincipal`, `GET /session/principal` (G3354, derived):
             the chrome's who-am-I. It names the caller's person AS STORED
             (verbatim, parsed by nothing — D6-9), their `orgClass` from
             `orgFor()`, and the BOUND tenant's NAME read from the control
             database's `tenancy_roster` through G1161's read-only pool —
             **NOT from a `tenant.tenant` column, which G185(d) refuses.**
             **THE SERVED SET IS NOW 51 OF 149 ACROSS 137 PATHS** — derive both,
             never read them: `node tools/served-set.mjs` and
             `node tools/check-doc-counts.mjs --derive`. ⚠️ AND `Run` GAINED
             `definitionName` (G3351, `db/migrations/0420`), which moves NO
             operation count: a property is not an operation.
             *Derived 3 Oct 2026.*
server/      89 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             ✅ **89 IS THE ONE PARENT'S NUMBER THAT SURVIVES integrate/2oct-e,
             AND THAT WAS DERIVED RATHER THAN TAKEN (G3196).** Of the five
             parents only #528 adds a `server/` file — **`data-plane/sign-out.ts`**
             (`signOut`, G3004) — and #528's own entry, kept further down, says
             89; #526, #529, #530 and #531 add none. 88 + 1 is 89. **THE SERVED
             SET WAS 50 OF 148 ACROSS 136 PATHS** until G3354 — `node tools/served-set.mjs` and
             `node tools/check-doc-counts.mjs --derive` — and `signOut` is the one
             mount that moved it: it was already DECLARED, so the denominator did
             not move. **EVERY NARRATION BELOW IS KEPT.**
             *Derived 2 Oct 2026 — integrate/2oct-e.*
server/      88 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             🛑 **88 IS AN ANSWER NO PARENT OF integrate/2oct-d COMPUTED (G2932).**
             `origin/main` was 86; #518 said 87 (its own merge, `data-plane/parked.ts`
             on top of #517's file); #521 added no file; and #520 added
             **`data-plane/signin-return.ts`** (`relayBrokerReturn`, G2762, the
             owner's G2549) and wrote no headline for it. 86 + 2 is 88.
             🛑 **THE SERVED SET IS 49 OF 148 ACROSS 136 PATHS** — derive both,
             never read them: `node tools/served-set.mjs` and
             `node tools/check-doc-counts.mjs --derive`. `origin/main` was 45 of
             144; #518 said 48 of 147 (three declared AND mounted); #520 said
             46 of 145 (`relayBrokerReturn` declared AND mounted); #521 mounts
             nothing new. **45 + 3 + 1 is 49, and 144 + 3 + 1 is 148.** No
             branch computed either. **EVERY NARRATION BELOW IS KEPT.**
             *Derived 2 Oct 2026 — integrate/2oct-d.*
server/      87 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             🛑 **87 IS A THIRD ANSWER — §5.11 WITH A SECOND PARENT (G2923).**
             Both parents said 86, each of 85 + one DIFFERENT file:
             `data-plane/parked.ts` (#518) and
             `data-plane/partner-redemption-store.ts` (#517). 85 + 2 is 87.
             🛑 **THE SERVED SET IS 48 OF 147** — derive it, never read it:
             `node tools/served-set.mjs`. #518 said **47 of 147** (44 + three
             it declared AND mounted) and #517 said **45 of 144** (44 + one it
             mounted, denominator unchanged); **44 + 1 + 3 is 48, and 144 + 3 is
             147.** Neither parent computed it. **BOTH NARRATIONS ARE KEPT
             BELOW, UNDER ONE HEADLINE THAT EACH OF THEM WROTE.**
             *Derived 2 Oct 2026 — merge of origin/main into feat/arrivals-parked.*
server/      86 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             ⚠️ **THIS SAID 85 UNTIL 2 Oct 2026 AND WAS CORRECT WHEN WRITTEN.**
             THE ONE ADDED IS **data-plane/parked.ts** — C9's parked pile,
             G2831–G2840, applying **G2692 (THE OWNER'S)**: `listParkedArrivals`,
             `getParkedArrival` and `raiseParkedArrival`, all three DECLARED AND
             MOUNTED in one commit, plus the DRAIN inside
             `declareEndpointDocumentType` (row 16).
             🛑 **THE SERVED SET IS 47 OF 147** — derive it, never read it:
             `node tools/served-set.mjs` (147 operations across 135 paths).
             🛑 **THE CLASSIFYING INTAKE HAS NO CALLER OUTSIDE `tests/`**:
             `admitClassifyAndStoreArrival()` is the writer a source delivers
             through, and nothing reads a source — the connector is not built.
             What is SERVED is everything downstream of a parked artefact.
             ⚠️ **THE PANE PUBLISHES A HELD RECORD'S KEYS AND NEVER A VALUE** —
             no `FieldSpec` addresses a held artefact, so G106 makes every
             value in it UNREADABLE; `tests/model/arrival-parking.test.ts` §7 is
             a census that fails if any file in `server/` interprets a name.
             ⚠️ **AND THE OTHER PARENT'S NARRATION OF THE SAME NUMBER IS KEPT WHOLE BELOW — §5.11 (G2921).**
             THE EIGHTY-SIXTH IS `data-plane/partner-redemption-store.ts`
             (G2801, the owner's), called from `mintFederatedSession()` INSIDE
             the sign-in transaction. 🛑 **THE SERVED SET IS 45 OF 144** —
             `node tools/served-set.mjs` — and the forty-fifth is
             `invitePartnerPerson`, whose 201 is an `InvitedPartnerPerson` with
             no `name` (G2807). The denominator did not move. *Derived 2 Oct 2026.*
server/      85 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             🛑 **85 IS AN ANSWER NO PARENT OF integrate/1oct-c EVER COMPUTED —
             §5.11 WITH FIVE PARENTS (G2746).** The fork (`9e0c4c10`) was
             **80**. #511 and #512 added no file under `server/`; #513 added
             `data-plane/signin-begin.ts` and said 81; #514 added
             `data-plane/partner-staff-store.ts`, `partner-portal-store.ts` and
             `partner-portal.ts` and said 83; #515 added `data-plane/sources.ts`.
             **80 + 1 + 3 + 1 = 85.**
             🛑 **THE SERVED SET IS 44 OF 144** — derive both, never read them:
             `node tools/served-set.mjs`, and
             `node tools/check-doc-counts.mjs --derive` (144 operations across
             132 paths). #513 said 34 of 139, #514 38 of 138, #515 its own; the
             denominator is 138 + 1 (`beginFederatedSignIn`) + 5 (C9's sources)
             and the numerator is every parent's mounts on one tree.
             ⚠️ **AND THE MERGE OWED TWO REPAIRS NEITHER PARENT COULD SEE**:
             `signin-begin.ts` read a plane-wide `terms.audience` that #512
             removed — the begin's `client_id` is now the ROUTED door's own
             audience (G2741) — and #514's partner-home via writer read the
             assignment arm of a `DecisionVia` #511 had made a union (G2742).
             ✅ **AND #511's RED PR GATE IS ROOT-CAUSED AND CLOSED HERE (G2745)**:
             a body's answer is now HELD until its transaction commits —
             `authorisedHandler()` hands every body a non-thenable view of the
             reply. **EVERY PARENT'S NARRATION IS KEPT BELOW; only this first
             number is the claim.** *Derived 2 Oct 2026 — integrate/1oct-c.*
server/      81 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             ⚠️ **THIS SAID 80 UNTIL LATER ON 1 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE ONE ADDED IS **data-plane/signin-begin.ts** —
             `beginFederatedSignIn`, **THE OWNER'S RULING G2541**, and it closes
             G2497: *"NOTHING BEGINS A SIGN-IN."* It routes the domain with
             `routeToConnection()` (the browser's `connectionId` is COMPARED,
             never trusted — G2542), writes the attempt under `0290`'s fence,
             and returns an authorize URL built from the PINNED ROW (G2544) plus
             the two values only the TAB keeps — `state` and the PKCE verifier,
             which is stored NOWHERE by the plane (G2543). **No egress**: the URL
             is a string the browser carries, so §1c's two-file census is
             unchanged.
             🛑 **THE SERVED SET IS 34 OF 139** — derive it, never read it:
             `node tools/served-set.mjs`. The corpus moved by ONE operation and
             ONE path (139 across 128), because the operation is DECLARED in the
             same commit it is mounted. `servedPublicly()` is compelled by the
             seventh fence exactly as for the callback.
             ✅ **AND G2495 IS CLOSED IN THE SAME SLICE (G2547)**: the mint
             transaction reads the attempt `FOR UPDATE`, witnessed by two
             concurrent callbacks that minted TWO sessions before the lock and
             one after.
server/      83 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             ⚠️ **THIS SAID 80 UNTIL 1 Oct 2026 AND WAS CORRECT WHEN WRITTEN.**
             THE THREE ADDED ARE W5's: **data-plane/partner-staff-store.ts**,
             **data-plane/partner-portal-store.ts** and
             **data-plane/partner-portal.ts**.
             🛑 **THE SERVED SET IS 38 OF 138** — derive it, never read it:
             `npm run served`. ⚠️ **THE DENOMINATOR DID NOT MOVE**: the five are
             `listDealRegistrations`, `submitDealRegistration`, `getSandboxTenant`,
             `requestSandboxTenant` and `listPartnerPeople`, all declared since
             G288, now GATED on R10's verbs, answered on `decide()`'s fifth arm and
             recorded in invariant 10's third home (G2621). **They are the first
             partner-portal operations either plane has served.** Four more are
             annotated and deliberately unmounted, each named at the mount
             (G2630, G2639, G2640). `EXEMPT_WITH_A_PERSON_TO_ASK.administration`
             moves 42 → **33**, and the anchored `servedWithoutAGate` count is
             unchanged: this adds no ungated mount.
             ⚠️ **THIS SAID 80 UNTIL 1 Oct 2026 AND WAS CORRECT WHEN WRITTEN.**
             THE ONE ADDED IS **`data-plane/sources.ts`** — C9's declaration
             half (G2681–G2690): `listEndpoints` (`view_endpoint`) and
             `declareEndpoint`, `stopEndpoint`, `resumeEndpoint`,
             `declareEndpointDocumentType` (`configure_endpoint`), each through
             `authorisedHandler()`, each DECLARED and MOUNTED in one commit.
             🛑 **THE SERVED SET IS 38 OF 143 ACROSS 131 PATHS** — derive it,
             never read it: `node tools/served-set.mjs` and
             `node tools/check-doc-counts.mjs --derive`. ⚠️ **AND NONE OF IT
             CONNECTS TO ANYTHING**: row 2's *"Test before declare"* is
             request-path egress (G2151), and the classifier and the drain are
             blocked on an `Arrival` that carries no filename (G2692).
server/      80 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES.
             🛑 **80 IS A MERGE'S NUMBER AND NO PARENT COMPUTED IT — G2533,
             integrate/1oct-b.** `origin/main` held **76**. S6 (#509) added
             `data-plane/federated-signin.ts` and said **77**; C9 (#506) added
             `credential-binding.ts`, `credential-store.ts` and
             `secrets-manager-store.ts` and said **79**; R13 (#503) and R10
             (#507) added no file and each said **76**. **76 + 1 + 3 is 80.**
             🛑 **THE SERVED SET IS 33 OF 138** — derive it, never read it:
             `node tools/served-set.mjs`. S6 said **31 of 136**, R13 **31 of
             137**, C9 a set one larger than its base — and the 137 that R13 and
             C9 BOTH wrote are two different 137s (`listRunAllocations` on one,
             `bindEndpointCredential` on the other). **138 operations across 127
             paths WAS the merged tree's** (⚠️ it said so until G2541 declared a 139th, later on 1 Oct 2026), re-derived by the parser and by
             paths was the merged tree's** (⚠️ 143 across 131 since G2681, above), re-derived by the parser and by
             `node tools/check-doc-counts.mjs --derive`, and pinned at
             `tests/tools/served-set.test.mjs` §1 (G2532). R10 mounts nothing.
             **The parents' entries below are kept whole; only this first line
             is the claim.**
server/      77 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES,
             AND — SINCE 1 Oct 2026, S6 — A PUBLIC ENDPOINT THAT MINTS A SESSION.
             ⚠️ **THIS SAID 76 UNTIL 1 Oct 2026 AND WAS CORRECT WHEN WRITTEN.**
             THE ONE ADDED IS **data-plane/federated-signin.ts** —
             `completeFederatedSignIn`, MOUNTED under `servedPublicly()` (D6-1,
             THE OWNER'S: *"Both operations go public; mount the callback
             too."*). Derive the served set, never read it:
             `node tools/served-set.mjs` → **31 of 136**.
             🛑 **AND `code-exchange.ts` IS THE SECOND FILE THAT REACHES THE
             NETWORK, BY RULING — G2443, THE OWNER'S, APPLIED (G2485):** one
             POST, to the PINNED door's `token_endpoint`, `3_000` ms, with the
             pin transaction ENDED and its connection released before the
             call. `tests/http/console-roster-unreachable.test.ts` §1c is a
             `deepEqual` to those two names and no wider, and
             `tests/http/federated-signin-served.test.ts` §5 reads
             `pg_stat_activity` from inside the broker's handler and requires
             ZERO app-role backends in a transaction — witnessed RED by moving
             the call inside the pin scope.
             🛑 **THE BROKER PAIR AND THE ISSUER COME OFF THE PINNED ROW, NEVER
             THE BODY (G2235/D6-5):** the request is `state`, `code`,
             `codeVerifier`, `connectionId`, and anything else is a 400. **THE
             REDIRECT IS A `303` TO A PATH (G2493)** on the host the callback
             arrived at, so there is no host for a caller to choose.
             ⚠️ **WHAT IS STILL NOT TRUE, AND IT IS WHY NOBODY SIGNS IN ON
             STAGING YET:** nothing BEGINS a sign-in — no operation writes a
             `sign_in_attempt` row (G2497) — and the broker registers console
             callback URLs only (G2494). The gate's suites seed the attempt as
             the migrator and drive a LOCAL broker.
server/      89 files (`git ls-files server | wc -l`) — ⚠️ **THIS SAID 76 AND THE
             COMMAND RETURNED 88 BEFORE G3004 TOUCHED THE DIRECTORY**; the
             twelve were not this slice's to make stale and are named so this
             sweep is not read as accounting for them. **THE ONE IT ADDS IS
             data-plane/sign-out.ts** — `signOut`, `DELETE /session`, mounted
             `servedWithoutAGate()` (G3004): the REVOKE half of the owner's
             profile-switcher ruling G2771. It revokes the caller's OWN row and
             no other, in `withSelectionScope()` when the session is bound
             (G180's measured reason). Derive the served set, never read it:
             `node tools/served-set.mjs` → 50 of 148 at this commit.
             🛑 **AND A FINDING THE SWITCHER SURFACED AND DID NOT FIX — G3006:
             NOTHING IN A BROWSER CAN BIND A TENANT.** D1 wants the session
             handle in its BODY and the cookie is `HttpOnly`, so every
             tenant-host sign-in lands authenticated and UNSCOPED. A contract
             change or a bind-at-mint, either an owner's ruling.
server/      76 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES,
             ✅ **R13 — 1 Oct 2026 — ADDS NO FILE AND MOUNTS ONE OPERATION:
             `listRunAllocations`** (G2374), declared on `capability.openapi.yaml`
             and mounted through `authorisedHandler` on `admit_source`, in
             `server/data-plane/run-account.ts` beside `listRunResidue`. **THE
             SERVED SET IS 31 OF 137 OPERATIONS ACROSS 126 PATHS** — derive it,
             never read it: `node tools/served-set.mjs` and
             `node tools/check-doc-counts.mjs --derive`. ⚠️ **The 76 above did
             not move**: the route, the reader and the writer extension landed
             in files that already existed.
server/      79 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES,
             AND — SINCE 25 Sep 2026, R2 — ONE FILE THAT REACHES THE NETWORK.
             ⚠️ **THIS SAID 76 UNTIL 1 Oct 2026 AND WAS CORRECT WHEN WRITTEN.**
             THE THREE ADDED ARE C9's FIRST VERTICAL SLICE, under the owner's
             G2401: **data-plane/credential-binding.ts**
             (`bindEndpointCredential`), **data-plane/credential-store.ts** (the
             seam — a WRITER with no reader, by shape) and
             **data-plane/secrets-manager-store.ts** (the second SDK home,
             G2404). 🛑 **THE SERVED SET MOVES BY ONE AND SO DOES THE
             DENOMINATOR**, because the operation is DECLARED in the same
             commit — derive both: `node tools/served-set.mjs`. It is the first
             served operation whose capability is of class `secret`.
             ⚠️ **AND AN FDE CANNOT TAKE IT — G2407, THE OWNER'S TO RULE**:
             `decide()` has no staff-grant arm, so a platform principal is
             refused `secret` by `PLATFORM_ASSIGNMENT_REACHES` whatever grant it
             holds; a customer principal holding `bind_secret` binds.
             ⚠️ **THIS SAID 65 AND THE COMMAND ALREADY RETURNED 72 BEFORE THE
             S4/S5 SLICE TOUCHED THE DIRECTORY. THE SEVEN WERE NOT ITS TO MAKE
             STALE** and are named so this sweep is not read as accounting for
             them — that is the TENTH time this line has been behind the tree
             when a sweep arrived, by its own tally below. **THE FOUR THIS
             SLICE ADDS ARE W3's S4, S5 AND R7:**
             **data-plane/jwks-source.ts** (R2's transport),
             **data-plane/verification-terms.ts** (R2's resolver),
             **data-plane/code-exchange.ts** (R3/R4's exchange) and
             **data-plane/session-bounds.ts** (R7's reader).
             🛑 **`jwks-source.ts` IS THE FIRST FILE IN THIS REPOSITORY THAT
             MAKES AN OUTBOUND HTTP REQUEST, AND R2 SPENDS A PROPERTY SIX
             FILES ASSERTED: *"The JWKS is fetched ONCE AT BOOT and cached in
             memory. No runtime egress."*** Until now
             `tests/http/console-roster-unreachable.test.ts` §1c demanded an
             EMPTY list over both plane directories. **It is RE-ARGUED rather
             than deleted, and the split is the argument**: the CONTROL plane
             is still asserted empty at full strength — that was §1c's stated
             subject, the SigV4 pull — and the DATA plane gets a `deepEqual`
             against ONE NAMED FILE. *"By construction becomes by census, and
             that is a real loss, not a wash"* (G1161, one database over).
             ⚠️ **BOTH ARMS WERE WITNESSED RED**: a second outbound call in
             `code-exchange.ts` → `Found: [code-exchange.ts | jwks-source.ts]`;
             a STATIC value import of the transport → `Found:
             [verification-terms.ts]`.
             🛑 **THE BOOT-ONLY HALF IS G1201's DYNAMIC-IMPORT FENCE, AND THE
             DERIVATION FOR IT IS A TEST BECAUSE THE OBVIOUS `grep` MEASURES
             ITS OWN PROSE (G2134).** A draft of both new headers said
             `grep -rn "from './jwks-source.ts'" server/` → *"exactly one
             line"*; **it answers THREE and two are the claim itself.** G978
             again, caught by running it. ⚠️ **AND A STATIC `import type` IS
             NOT A BREACH** — `verbatimModuleSyntax` erases it before the
             loader sees it, so a path-grep cannot answer this question at all.
             🛑 **AND IT MOUNTS NOTHING: THE SERVED SET IS UNCHANGED AS A
             SET**, which is a stronger claim than a number and is the one
             this slice can actually stand behind. R1 — the D6 threat model —
             is an OPEN OWNER'S RULING and `completeFederatedSignIn` would be
             the first public unauthenticated CREDENTIAL-MINTING endpoint;
             `tests/http/code-exchange.test.ts` §8 asserts the absence over
             both `start.ts` files and **pins no count**. **Measured two
             ways**: neither `start.ts` is touched by this slice at all
             (`git diff --stat` on both is EMPTY), and the mounted set derived
             at `cc58f357` and at this commit is IDENTICAL — zero added, zero
             removed.
             🛑 **THE SIZE IS 30 AND THIS SLICE FIRST REPORTED 29 — G2160, AND
             IT IS THE §5.1 CLASS ARRIVING INSIDE A DERIVATION WRITTEN TO
             REPLACE A §5.1-SHAPED ONE.** It stripped comments, as this page
             warns, and **then keyed on `identifier:`** — while
             `server/data-plane/start.ts` mounts the local health check as
             `handlers: { checkLocalHealth }`, **ES6 shorthand, no colon**.
             ⚠️ **AND THE NAIVE GREP IS WRONG A SECOND WAY THAT NO NUMBER HERE
             HAD NAMED**: `handlers:` occurs once per **TIER MOUNT**, not once
             per operation — comment-stripped it answers **seven**. Caught by
             a sibling slice (PR #492) that built a parser for this exact
             question. ⚠️ **THE DENOMINATOR IS NOT GREP-ABLE EITHER**:
             `grep -c 'operationId:' docs/contracts/*.openapi.yaml` sums to
             **137** while the parser answers **136**, the extra being prose.
             **Derive the denominator with
             `node tools/check-doc-counts.mjs --derive` (a governed total),
             and the numerator by intersecting the identifiers inside each
             comment-stripped `handlers` block with the DECLARED
             operationIds** — the property `mountTier()` itself enforces,
             rather than the punctuation a mount happens to use.
             🛑 **R2 AND R3 PULL IN OPPOSITE DIRECTIONS AND THE SLICE STOPS AT
             THE SEAM RATHER THAN RESOLVING THEM QUIETLY (G2151).** A code
             exchange is an outbound POST **per sign-in** and cannot happen at
             boot, so R3 built whole is request-path egress — the one thing
             R2's second sentence names. **R2 settles that this product may
             make an outbound request AT ALL; nothing settles whether it may
             make one on a request path.** `code-exchange.ts` therefore builds
             the request, reads the response, verifies and binds — and ships
             `unauthorisedEgressTransport()`, which refuses loudly and names
             the open ruling. ⚠️ **THE COST IS NAMED: SIGN-IN CANNOT
             COMPLETE**, which costs nothing today because S6 is blocked on R1
             regardless.
             ✅ **AND D6 §4.3's SECOND UNDEFENDED ATTACK IS CLOSED (G2141):**
             `VerifiedClaims` gains `nonce` — READ, never checked, `iat`'s
             treatment — and `bindTokenToAttempt()` compares its digest
             against the challenge the REDIRECT pinned. D6 measured that
             `challengeDigest` *"compares two values the SAME caller
             supplied"*; a signed nonce is not one. **G344's move, one field
             over.** ⚠️ **AND `tests/http/token-verify.test.ts` §1b WENT RED
             ON THE WIDENING, WHICH IS THAT CONTROL WORKING** — six keys to
             seven — and the list is NOT loosened to "six or more", because
             `email` is the one that must never appear.
             ⚠️ **THE ENTRY BELOW SAID 65 AND IS KEPT WHOLE, because it is
             correct about its own file:**
             🛑 **THIS SAID 60 AND THE COMMAND ALREADY RETURNED 64 BEFORE THIS
             SLICE TOUCHED THE DIRECTORY.** The FOUR were not G1941's to make
             stale and are named so this sweep is not read as accounting for
             them: this page carries THREE `server/` entries below saying 61,
             56 and 49, which is §5.11 with a second parent arriving as a
             duplicated entry for the fourth time on this line, and the merge
             that produced 64 swept none of the four headlines. **THE ONE THIS
             SLICE ADDS IS `data-plane/realm.ts`** — `resolveHomeRealm`, and
             it is **the first unauthenticated person-facing operation this
             product has ever served.**
             🛑 **`checkLocalHealth` IS NOT THE PRECEDENT AND THE DIFFERENCE
             IS NOT PEDANTRY**: `data-plane-local.openapi.yaml` declares no
             security scheme, so `callerOf()` answers `none` and its callers
             are *"ALBs and scrapers"* — **nobody is on the other end.** Here
             somebody is.
             🛑 **THE SERVED SET IS NOW 27 OF 136** — derive both, never read
             them: `grep -rn 'handlers:' server --include start.ts` and
             `node tools/check-doc-counts.mjs --derive`. ⚠️ **THE DENOMINATOR
             DID NOT MOVE**: `resolveHomeRealm` has been on
             `session.openapi.yaml` since #230, declared and unmounted, and
             this slice edits no contract document at all.
             🛑 **IT CROSSES G200's MOUNTING FREEZE AND THE CROSSING IS THE
             RULING RATHER THAN A CONSEQUENCE — G1941, THE OWNER'S.** G296's
             condition (*"the freeze lifts when the authoriser can say YES to
             somebody"*) is about GATED operations and cannot speak about this
             one: there is no caller for an authoriser to say yes to. **And it
             is a DEPARTURE from G165 rather than an interpretation of it** —
             *"THE D6 THREAT-MODEL GATE LANDS BEFORE THE FIRST UNAUTHENTICATED
             ENDPOINT"*, and D6 is not written. G248's mitigation binds
             unchanged: *"a threat model written after the surface it covers
             must be allowed to change the surface, or it is documentation
             rather than a control."*
             🛑 **THE FOURTH FENCE DOES NOT FIRE FOR IT AND THE MARK IS TAKEN
             ANYWAY — G1948, ⛔ NOT APPLIED AND NAMED.** `callerOf([])` is
             `none` and `callerMayBeAPerson('none')` is false, so
             `mountTier()` drops the one operation where a person has
             presented nothing BECAUSE THEY HAVE NOT SIGNED IN YET. **That is
             §5.1: a fence keyed on the SECURITY SCHEME rather than on whether
             a human is there**, and the obvious widening is a boot failure on
             `checkLocalHealth`. `servedWithoutAGate()` is taken voluntarily
             and is lawful — the fence's second half refuses a mark only on a
             GATED operation.
             ⚠️ **AND `grep -rn 'servedWithoutAGate(' server/` NEVER MEASURED
             THAT POPULATION — G1947.** It returned FOURTEEN lines when that
             row ran it and ELEVEN were PROSE, while `server/http/app.ts`
             said *"there are three in `server/`"* and
             `server/data-plane/start.ts` said *"IT IS THE ONLY CALL TO IT"*:
             two files, two numbers, one call. ⚠️ **THE COMMAND ANSWERS 21 AT
             THIS COMMIT (G1996)** — every correction that NAMES it adds a
             line to the thing it counts, so a stale figure here is not drift
             but the defect restating itself.
             🛑 **AND THE REPAIR THIS SLICE FIRST WROTE WAS THE SAME
             DEFECT NARROWED RATHER THAN CLOSED — G1953, CAUGHT BY RUNNING IT
             BEFORE THE COMMIT LANDED.** `grep -rn 'servedWithoutAGate('
             server --include start.ts` drops the prose mentions in `app.ts`
             and keeps the ones in `start.ts` — **the file the narrowing
             selected FOR** — so the filter is anti-correlated with the noise
             it was written to remove. Wrong by seven instead of by twelve is
             still a derivation that cannot see a call, and this page has now
             recorded the §5.1-wearing-a-grep class three times in two days.
             🛑 **G1953 WROTE *NINE* AND THE COMMAND ANSWERS EIGHT — G1996,
             22 Sep 2026. The row that exists to record a number written
             rather than run carried a number written rather than run**, at
             all four of its sites. **It is not replaced with a third number
             to be trusted**; it moves on any comment edit in either
             `start.ts`. Key on the CALL SYNTAX and never on the file:
             `grep -rnE ': *servedWithoutAGate\(' server --include start.ts`
             → 2.
             ✅ **G1948 IS TAKEN — D6-8, THE OWNER'S, APPLIED 1 Oct 2026
             (G2241–G2245) — AND THE THREE PARAGRAPHS ABOVE ARE CORRECTED
             RATHER THAN DELETED, BECAUSE THEY ARE THE ARGUMENT THE RULING
             ANSWERS.** Not by widening the fourth fence: a SEVENTH,
             appended, compels `servedPublicly()` on any `caller: 'none'`
             mount whose tier `PUBLIC_OPERATION_AUDIENCE` says faces a person
             (`server/contract/capability.ts`) — `session` does,
             `dataPlaneLocal` does not, so `checkLocalHealth` still mounts
             bare. **`resolveHomeRealm`'s mark MOVES to `servedPublicly()`,
             so the `servedWithoutAGate()` call count is ONE again and the
             `→ 2` above is a fact about 22–30 Sep 2026.** Derive both on the
             AST, never on a grep: `tests/http/per-operation-gate-verdict.test.ts`
             §5a and `tests/http/public-mount-fence.test.ts` §3.
             🛑 **AND NOTHING WRITES A DOMAIN CLAIM ON ANY REQUEST PATH
             (G1952), SO EVERY DOMAIN ANSWERS `domain_not_claimed` UNTIL A
             MIGRATOR WRITES A ROW.** `addSignInDomain` is on the unmounted
             administration tier and there is no DNS TXT verifier; the
             `GRANT INSERT` is `0004`'s refusal and G511's *"the fence and the
             writer are one commit or neither"*.
             ⚠️ THE ENTRY BELOW SAID 58 UNTIL LATER ON 20 Sep 2026 AND WAS
             CORRECT WHEN WRITTEN.** THE TWO ADDED ARE **data-plane/console-roster-store.ts**
server/      71 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES,
             AND — SINCE 21 Sep 2026 — A PROCESS THAT RECONCILES.
             🛑 **71 IS AN ANSWER NO BRANCH IN THIS WAVE EVER COMPUTED, AND
             THIS ENTRY NOW APPEARS FIVE TIMES BELOW — SAYING 68, 66, 65, 67
             AND 65 AGAIN.** §5.11 with a second parent, arriving as a
             DUPLICATED ENTRY five deep, which is the shape this line has now
             recorded more times than any other on the page. The tree at the
             fork was **64** (`git ls-tree -r --name-only 7fe6d9af server |
             wc -l`). **SEVEN files were added across the wave and no two
             branches added the same one, so 64 + 7 is 71.** Derive them,
             never read them:
             `git diff --name-only --diff-filter=A origin/main -- server` →
             `data-plane/document-assembly.ts` ·
             `data-plane/document-type-store.ts` ·
             `data-plane/onboarding-store.ts` · `data-plane/onboarding.ts` ·
             `data-plane/run-executor.ts` · `data-plane/session-mint-store.ts`
             · `http/log-allow-list.ts`.
             ⚠️ **AND TWO SWEEPS BOTH SAID 65 OF TWO DIFFERENT SETS** — one is
             64 + the logger file, the other 64 + the document-type store, and
             neither contains the other's. *The number agreed and the sets did
             not*, in the entry that exists to warn about it.
             🛑 **THE SERVED SET IS 29 OF 136, AND IT IS THE ONBOARDING
             CHAIN'S FIGURE SURVIVING THE MERGE INTACT**: every other branch in
             this wave mounts nothing and each says so in its own voice, so no
             two sides disagreed about it. **Derive it, never read it, and note
             the two paths are SPELLED OUT because `server/<star>/start.ts`
             inside a block comment closes the comment:**
             `grep -rn 'handlers:' server/data-plane/start.ts
             server/control-plane/start.ts`, then count the keys.
             **EVERY BRANCH NARRATION IS KEPT BELOW AND EACH IS CURRENT ABOUT
             ITS OWN FILES; only this first number is the claim**, derived by
             hand on the merged tree.
             *Derived 21 Sep 2026 — integrate/all-sixteen.*
server/      68 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES,
             AND — SINCE 21 Sep 2026 — A PROCESS THAT RECONCILES.
             🛑 **68 IS A THIRD ANSWER NEITHER PARENT EVER COMPUTED, AND THIS
             ENTRY NOW APPEARS THREE TIMES BELOW — ONCE SAYING 65, ONCE SAYING
             67 AND ONCE SAYING 65 AGAIN OF A DIFFERENT SET.** §5.11 with a
             second parent, for the fourth time on this line. The tree at the
             fork was **64**; the logger slice added ONE
             (`http/log-allow-list.ts`) and said 65; the engine chain added
             THREE (`data-plane/document-type-store.ts`, then
             `data-plane/document-assembly.ts` and
             `data-plane/run-executor.ts`) and said 67; and **64 + 1 + 3 is
             68.** ⚠️ **AND THE TWO ENTRIES THAT BOTH SAY 65 ARE THE 16 Aug
             2026 CAPABILITY ROW'S SHAPE AGAIN — *the number agreed and the
             sets did not*:** one 65 is 64 + the logger file, the other is
             64 + the document-type store, and neither contains the other's
             file. **Derive it, never read it**; the only file this merge had
             to add to the engine chain's own tree is
             `server/http/log-allow-list.ts`.
             **ALL THREE NARRATIONS ARE KEPT BELOW AND EACH IS CURRENT ABOUT
             ITS OWN FILES; only this first number is the claim**, derived by
             hand on the merged tree.
             *Derived 21 Sep 2026 — integrate/all-sixteen.*
server/      65 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES,
             ⚠️ **THIS SAID 60 AND THE COMMAND ALREADY RETURNED 64 BEFORE
             THIS SLICE TOUCHED THE DIRECTORY.** The 64 was not G1391's to make
             stale and is named so this sweep is not read as accounting for all
             five. **THE ONE THIS SLICE ADDS IS `http/log-allow-list.ts`** —
             G261 §12.1's containment rule expressed as code, and the first
             file either plane has ever had between itself and a log line.
             🛑 **IT MOUNTS NOTHING, DECLARES NOTHING AND MINTS NO
             CAPABILITY** — derive the served set, never read it:
             `grep -rn 'handlers:' server/*/start.ts`. What changed is that the
             logger is ON (G1067 discharged) and that everything it prints
             passes a two-rule allow-list: the NAME in a closed set or
             id-/count-shaped, **and** the VALUE a number, a boolean or a
             string with no whitespace. **Neither rule alone would do**, and
             the hole in each is concrete rather than theoretical — read the
             module's header before widening either.
             ⚠️ **AND `logger: true` ALONE WOULD HAVE BREACHED §12.1 ON
             ITS FIRST REQUEST**, which is why G1067 sat ⛔ for a day rather
             than being a one-line change.
server/      67 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES,
             AND — SINCE 21 Sep 2026 — A PROCESS THAT RECONCILES.
             ⚠️ **THIS SAID 65 UNTIL 21 Sep 2026 AND WAS CORRECT WHEN
             WRITTEN.** THE TWO ADDED ARE W1's LAST TWO SLICES:
             **data-plane/document-assembly.ts** (E4, G1501–G1506) and
             **data-plane/run-executor.ts** (E5, G1521–G1528).
             🛑 **THE SENTENCE THIS PAGE, `definition-store.ts` AND
             `run-worker.ts` ALL CARRIED IS NOW FALSE AND IS CORRECTED ON
             EACH OF THEIR OWN FACES:** *"nothing in `server/` produces an
             `ExtractedValue`"*. **Derive it — and note the `grep -v`, which
             is the honest half: the naive form counts the four PROSE lines
             that quote it, which is G978's shape:**
             `grep -rn 'ExtractedValue\|ExtractedLine' server/ | grep -v '^\S*: *\*' | wc -l`
             🛑 **AND `run-worker.ts`'s CAPITALISED *"THIS WORKER DELIBERATELY
             RECONCILES NOTHING"* WENT WITH IT (G1527).** It is corrected in
             place with the original quoted — a capitalised claim left
             standing after it goes false is worse than none, because the next
             reader trusts the capitals. ⚠️ **AND IT IS STILL EXACTLY TRUE OF
             THAT FILE**: `claimAdmittedRun()` still only reads and reports;
             what changed is that `run-worker-main.ts` calls the EXECUTOR
             after it, in its own scope.
             🛑 **THE SERVED SET IS UNCHANGED AND NO OPERATION IS DECLARED** —
             derive it, never read it, and note the two paths are SPELLED OUT
             because `server/<star>/start.ts` inside a block comment closes the
             comment:
             `grep -rn 'handlers:' server/data-plane/start.ts server/control-plane/start.ts`.
             **The executor is reached by a QUEUE and by no route**, which is
             R-B's shape.
             🛑 **`lines` IS ALWAYS EMPTY AND AN INDEXED DECLARATION IS
             REFUSED (G1504), WHICH IS THE FINDING OF E4.**
             `readAddressablePayload()` is header-grain, and `presentedRows()`
             returns exactly ONE row when `lines.length === 0` — so a ledger
             declared as `lines[0].ref`, `lines[1].ref`, `lines[2].ref` would
             have reconciled ONE row of three and reported success, with C18
             silent because the format declares no trailer. **Witnessed RED by
             deleting the four-line guard: `out.ok` true, three rows assembled
             as one document.**
             ⚠️ **AND TWO THINGS ARE OPEN AND NAMED RATHER THAN CLOSED**:
             whether the engine is fast enough to hold a transaction open for
             a REAL document set is **UNMEASURED — no real corpus exists here
             to time it against** (G1524, and it is a POOLING question under
             G101); and execution may exceed the queue's 30-second visibility
             timeout, in which case a second worker duplicates the WORK —
             `run_engine_account`'s PRIMARY KEY is what makes exactly one
             account row survive, **not `run_idempotency_key`, which is about
             ADMISSION** (G1525, witnessed at `tests/db/run-executor.test.ts`
             §6b).
             ⚠️ **AND THE ENTRY BELOW IS KEPT WHOLE, because it is correct
             about its own file:**
server/      65 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES,
             ⚠️ **THIS SAID 60 AND THE COMMAND ALREADY RETURNED 64 BEFORE THE
             R11 SLICE TOUCHED THE DIRECTORY.** Four files landed and this
             first word moved for none of them; **the 64 was not G1405's to
             make stale** and is named so this sweep is not read as accounting
             for all five. THE ONE THIS SLICE ADDS IS
             **data-plane/document-type-store.ts** (G1405, R11) —
             `readDocumentType()` and `readDocumentControlTotal()`, and it is a
             **READER WITH NO ROUTE**, called from `tests/` and nowhere else,
             which is `definition-store.ts`'s shape beside it,
             `control-plane/roster-store.ts`'s one plane over, and `0007`'s
             precedent for a column set proven without one.
             🛑 **IT MOUNTS NOTHING AND THE SERVED SET IS UNCHANGED** — derive
             it, never read it, and note the two paths are SPELLED OUT because
             `server/<star>/start.ts` inside a block comment CLOSES THE COMMENT
             and turns the rest of the file into code (witnessed in this slice:
             20 `TS1005`/`TS1443`/`TS1489` errors from one derivation in a
             header):
             `grep -rn 'handlers:' server/data-plane/start.ts server/control-plane/start.ts`.
             No contract operation on any of the seven tiers reads a document
             type's declaration, so G300's test cannot be STARTED for one.
             🛑 **ITS ANSWER TYPE IS AN `Omit` OF `DocumentType` AND NOT A
             RESTATEMENT OF IT**, so an EIGHTH field on the model's interface is
             a `TS2739` HERE rather than a column somebody forgets — G1122's
             device, carried across. ⚠️ **THE TWO IT OMITS ARE OMITTED FOR TWO
             REASONS**: `tenantId` is invariant 1's (the column exists because
             the POLICY keys on it and is never read back as a value), and
             `fields` ALREADY HAS A HOME in `tenant.document_field_spec`, which
             a concurrent E1 slice holds open and this one does not touch.
server/      66 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES,
             ⚠️ **THIS SAID 60 UNTIL 21 Sep 2026 AND WAS ALREADY FOUR BEHIND
             BEFORE THIS SLICE TOUCHED THE DIRECTORY — the tree at the fork
             was 64** (`git ls-tree -r --name-only 7fe6d9af server | wc -l`),
             from the run queue and the console reader landing on other
             branches. **The four were not R8's to make stale** and are named
             so this sweep is not read as accounting for all six. THE TWO
             ADDED HERE ARE **data-plane/onboarding.ts** and
             **data-plane/onboarding-store.ts** — R8 and R9, the owner's — and
             they are the first files in `server/` that WRITE to a database
             this process does not own.
             🛑 **THE SERVED SET IS NOW 29 OF 136 AND THE TWENTY-SEVENTH,
             -EIGHTH AND -NINTH ARE THE FIRST OPERATIONS THE `administration`
             TIER HAS EVER MOUNTED — AND TWO OF THEM ARE THE FIRST CONSOLE
             WRITES EITHER PLANE HAS SERVED.** Derive both, never read them:
             `grep -rn 'handlers:' server/*/start.ts` and
             `grep -c 'operationId:' docs/contracts/*.openapi.yaml`.
             ⚠️ **THE DENOMINATOR DID NOT MOVE — this slice DECLARES no
             operation**; all three have been on `administration.openapi.yaml`
             since G288. It DOES change that document: three `x-capability`
             annotations and two inline `enum`s, neither of which is an
             operation.
             🛑 **R8 IS WHAT MADE THE MOUNT POSSIBLE AND G911 IS WHAT MADE R8
             POSSIBLE.** All three carried `x-capability: 'exempt: …'`, and an
             exemption is not a capability — `decide()` is never asked. Until
             G911 retired `TIER_REQUIRES_CAPABILITY` a gated operation on this
             tier was UNREPRESENTABLE, which is why G781 cut fourteen others
             into a second document. **Annotating in place is less surgery
             than a second split**, and the owner's objection to the split
             shape still stands on that document's face.
             🛑 **SO THE FENCE THAT APPLIES IS THE SIXTH AND NOT THE FOURTH,
             AND THE COUNT OF `servedWithoutAGate()` CALLS IS UNCHANGED AT
             ONE.** Derive it: `grep -rn 'servedWithoutAGate(' server/`. An
             `exempt:` handler facing a person needs that mark; a GATED one
             needs `authorisedHandler()`, because *"an operation may not mount
             until it mints a record"*. `EXEMPT_WITH_A_PERSON_TO_ASK.administration`
             moves 45 → **42** and the document still declares 45 — **the two
             numbers have stopped agreeing, and that gap is the finding.**
             ⚠️ **THE OTHER 42 ARE NOT A BACKLOG** and every argument against
             mounting one is unchanged: each is an operation the gate never
             touches and which would mint no invariant 10 record.
server/      65 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES,
             ⚠️ **THIS SAID 60 AND THE COMMAND ALREADY RETURNED 64 BEFORE
             W3-S3 TOUCHED THE DIRECTORY** — four files landed on the branch
             chain below this slice and nothing here followed them. **The 64
             was not this slice's to make stale** and is named so this sweep is
             not read as accounting for all five. THE ONE THIS SLICE ADDS IS
             **data-plane/session-mint-store.ts** (W3-S3, G1637–G1640) — the
             federated mint writer, and it is **REACHED BY NO ROUTE**:
             `completeFederatedSignIn` is declared and mounted nowhere because
             the plan puts that at S6 behind **R1, an OPEN OWNER'S RULING**,
             and these would be the product's first public UNAUTHENTICATED
             endpoints. `0007`'s precedent for a surface proven without a
             route; `data-plane/definition-store.ts`'s shape one file over.
             🛑 **IT MOUNTS NOTHING AND THE SERVED SET IS UNCHANGED** — derive
             it, never read it: `grep -rn 'handlers:' server/*/start.ts`.
             🛑 **IT CONSUMES THE ATTEMPT, PROVISIONS THE PERSON AND MINTS THE
             SESSION IN ONE TRANSACTION, AND THE PERSON BEING INSIDE IT IS THE
             HALF NOBODY ASKED FOR (G1637)**: provisioning in its own
             transaction would leave **a directory that grows by one row per
             abandoned callback**, each a real `tenant."user"` row
             `resolveSubject()` would resolve.
             🛑 **INVARIANT 1 IS HELD BY FOUR INDEPENDENT CONTROLS AND THIS IS
             THE FIRST REAL CALLER OF TWO OF THEM.** `MintSessionInput` has no
             `tenantId` field (S2); `MintedSessionFacts` is an `Omit` with
             nowhere to put one — **the load-bearing half, because
             excess-property checking is LITERAL-ONLY and a spread would pass
             one silently**; `session_selection_restrictive` refuses a
             tenantful row in a sign-in scope (S0, re-measured on this tree and
             AGREEING); and `tests/db/session-mint-writer.test.ts` §3 reads the
             written row back. Witnessed RED: binding a tenant into the INSERT
             answers `new row violates row-level security policy
             "session_selection_restrictive"`.
             ⚠️ **AND NOTHING CALLS IT WITH A REAL TOKEN.** S4 is blocked on
             R2 and S5 on R3, and `0013` grants the app role no `INSERT` on
             `tenant.sign_in_attempt` — so an attempt row is written by the
             migrator, in a test, and by nothing else.
             ⚠️ **AND THE ENTRY BELOW SAID 58 AND IS KEPT WHOLE**, because it
             is correct about its own two files.
             ⚠️ **THIS SAID 58 UNTIL LATER ON 20 Sep 2026 AND WAS CORRECT
             WHEN WRITTEN.** THE TWO ADDED ARE **data-plane/console-roster-store.ts**
             and **data-plane/console-roster.ts** — G1241, the owner's ruling
             — and they are the first files in `server/` that serve a caller
             with NO TENANT.
             🛑 **THE SERVED SET IS NOW 26 OF 136 AND THE TWENTY-SIXTH IS THE
             FIRST CONSOLE OPERATION EITHER PLANE HAS EVER MOUNTED.** Derive
             both, never read them: `grep -rn 'handlers:' server/*/start.ts`
             and `grep -c 'operationId:' docs/contracts/*.openapi.yaml`.
             ⚠️ **THE DENOMINATOR DID NOT MOVE — this slice DECLARES no
             operation**; `listTenants` has been on
             `platform-console.openapi.yaml` since G781.
             🛑 **FOUR THINGS HAD TO HOLD AT ONCE AND EACH HAS ITS OWN FILE:**
             the TABLE (G831 and G1241), the REACH (G1161's read-only control
             pool), the CAPABILITY (`view_substrate`, G601 — of class
             `substrate`, which `PLATFORM_ASSIGNMENT_REACHES` opens) and
             **invariant 10's SECOND HOME** (G730), without which
             `mountTier()`'s SIXTH FENCE refuses to boot a gated operation
             whose handler mints no record. `tests/http/console-roster-served.test.ts`
             §4 witnesses that fence still firing on a bare handler for this
             exact operationId.
             ⚠️ **THE ACT'S RECORD AND THE ACT'S DATA ARE IN TWO DIFFERENT
             DATABASES, AND THAT IS THE SHAPE OF EVERY CONSOLE OPERATION FROM
             HERE.** `authorisedHandler()`'s platform arm opens a SESSION
             scope on the DATA database and writes
             `tenant.platform_authorization_grant`; the body ignores that
             `tx` and reads the roster through `withControlReadScope()`. The
             record is still written BEFORE the act, so a read that throws
             takes its own record down — what is lost is atomicity in the
             other direction, and `console-roster.ts` names it as the SAFE
             direction rather than hiding it.
             ⚠️ **THE OTHER THIRTEEN CONSOLE OPERATIONS ARE NOT A BACKLOG**:
             `tests/http/console-roster-unreachable.test.ts` §5a derives, per
             operation, which `required` field has no producer — twelve have
             no table in either database, and the thirteenth
             (`openByoaEscalation`) is held out BY NAME because a `reason`
             column on an UNRELATED table made the scanner call it producible.
             **That false positive is this slice's own, measured on the first
             run after the migration**, and it is §5.1 inside a control
             written to measure a §5.1-shaped blocker.
             ⚠️ THE ENTRY BELOW SAID 57 UNTIL 20 Sep 2026 AND WAS CORRECT WHEN
             WRITTEN. THE ONE ADDED IS **data-plane/definition-store.ts**
             (G1122, W3-A) — `readSetReconciliationDefinition()`, and it is a
             **READER WITH NO ROUTE**, called from `tests/` and nowhere else,
             which is `control-plane/roster-store.ts`'s shape one directory
             over and `0007`'s precedent for a column set proven without one.
             🛑 **IT MOUNTS NOTHING AND THE SERVED SET IS UNCHANGED** — derive
             it, never read it: `grep -rn 'handlers:' server/*/start.ts`. No
             contract operation on any of the seven tiers reads a definition's
             engine spec, so G300's test cannot even be STARTED for one.
             🛑 **ITS ANSWER TYPE IS AN `Omit` OF `SetReconciliationInput` AND
             NOT A RESTATEMENT OF IT**, so a nineteenth field on the engine's
             interface is a `TS2739` HERE rather than a column somebody
             forgets — which is how G1121's *"a migration per new engine
             knob"* is made payable instead of merely stated.
             ⚠️ **TWO OF THE ENGINE'S EIGHTEEN FIELDS CANNOT BE REPRESENTED
             AND THE MODULE STOPS AT THAT BOUNDARY (G1130)**: `leftDocuments`
             and `rightDocuments` are `SourceDocument[]`, a `SourceDocument`
             carries `extracted`/`lines`, and **extraction is the engine's
             INPUT and not its output** — `grep -rn
             'ExtractedValue\|ExtractedLine' server/` → 0.
             ✅ **BOTH CLAUSES WENT FALSE ON 21 Sep 2026 — E4 AND E5 — AND ARE
             CORRECTED RATHER THAN DELETED, because this is the sentence four
             files carried.** `server/data-plane/document-assembly.ts`
             produces `ExtractedValue`s and `server/data-plane/run-executor.ts`
             consumes them. ⚠️ **AND THE DERIVATION BESIDE IT NEVER MEASURED
             THE CLAIM — G978's shape: it counts PROSE quoting it, this
             correction included. The honest form appends
             `| grep -v '^\S*: *\*'`.**
             `readAddressablePayload()` returns an `AddressableValue`, which is
             a CLASSIFIED POSITION with no scalar kind, no fidelity and no
             confidence. So `completeSetReconciliationInput()` takes the
             documents FROM ITS CALLER and this plane manufactures none.
             🛑 **57 WAS A THIRD ANSWER NEITHER PARENT EVER COMPUTED, AND THIS
server/      61 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES,
             AND — SINCE 20 Sep 2026, R-B — ONE PROCESS THAT IS NEITHER.
             ⚠️ **THIS SAID 57 UNTIL 20 Sep 2026 AND WAS CORRECT WHEN WRITTEN.**
             THE FOUR ADDED ARE R-B's RUN QUEUE:
             **data-plane/run-queue.ts** (the message, its codec, its five
             refusals and the boot seam), **data-plane/sqs-run-queue.ts** (the
             ONE file in this repository that names an AWS SDK — R-C, G1202),
             **data-plane/run-worker.ts** and **data-plane/run-worker-main.ts**.
             🛑 **THE WORKER IS THE SEAM AND NOT THE EXECUTOR, AND ITS HEADER
             SAYS SO IN CAPITALS SO NOBODY READS A WORKER THAT DOES NOTHING AS
             A BUG.** It takes one message, opens exactly that tenant's scope,
             reads the run it was told about and reports. **Nothing calls
             `runSetReconciliation()` and nothing writes a row.** Measured
             rather than asserted: `SetReconciliationInput` needs EIGHTEEN
             fields and `tenant.reconciliation_definition` stores FOUR —
             `awk '/export interface SetReconciliationInput/,/^}/'
             model/reconciliation.ts | grep -c '^\s*readonly'` → 18. R-A gives
             a definition its content and is being built concurrently.
             🛑 **THE SERVED SET IS UNCHANGED AT 25 OF 136** — derive it, never
             read it: `grep -rn 'handlers:' server/*/start.ts`. `admitRun` was
             mounted already; what changed is that it PUBLISHES, and that a
             run no longer sits `queued` with nothing anywhere told about it.
             ⚠️ **AND `run-worker-main.ts` IS REACHED BY NO ROUTE AND RUNS
             NOWHERE IN AWS** — `infra/lib/run-queue-stack.ts` grants
             `sqs:SendMessage` and grants NOBODY `sqs:ReceiveMessage`, because
             where that process runs is a person's decision (G1204, G1205).
             ✅ **THE PERSON DECIDED ON 21 Sep 2026 — R-W, G1541 — AND HALF
             THAT SENTENCE IS NOW FALSE WHILE THE OTHER HALF IS EXACTLY TRUE,
             WHICH IS WHY IT IS CORRECTED RATHER THAN DELETED.** The stack
             grants `sqs:ReceiveMessage` and `sqs:DeleteMessage` to a
             SCHEDULED ECS TASK's own role — **so the clause about the grant
             is dead.** ⚠️ **`REACHED BY NO ROUTE AND RUNS NOWHERE IN AWS`
             STILL HOLDS TO THE WORD**: the slice is code and `cdk synth`,
             nothing was deployed, and **a deployed task definition and a
             deployed IMAGE are two facts** (G1285) — the running fleet's
             image contains no `server/data-plane/run-queue.ts`, so a tick
             would not resolve its entry point until D-2. ⚠️ **AND NO FILE
             UNDER `server/` MOVED**: R-W needed none, because this file has
             been one-message-and-exit since the day it was written.
             🛑 **57 IS A THIRD ANSWER NEITHER PARENT EVER COMPUTED, AND THIS
             ENTRY APPEARS TWICE BELOW — ONCE SAYING 54 AND ONCE SAYING 56.**
             §5.11 with a second parent, arriving as a DUPLICATED ENTRY, which
             is the shape this line has now recorded three times. The tree at
             the fork was 53 — `git ls-tree -r --name-only 56d9d053 server |
             wc -l` — W1-E added ONE (`data-plane/token-verify.ts`) and said
             54, W1-B/C added THREE (`data-plane/{reversal-store,
             disposition-mix-store,reports}.ts`) and said 56, and **53 + 4 is
             57.** Each copy is right about the branch that wrote it.
             🛑 **THE MERGE SAW THE SHAPE AND DID HALF THE REMEDY:** it
             inserted the §5.11 banner above this block and then swept neither
             headline, so a banner instructing a reader to DERIVE sat on top of
             a number that had not been derived. `check-doc-counts` governs no
             `server/` file count, so the gate was EXIT 0 throughout.
             **Both copies are left standing as the history they are; THIS
             LINE IS THE CLAIM**, derived on the merged tree.
             *Corrected 20 Sep 2026 — G1096.*
             ⚠️ THE ENTRY BELOW SAID 53 UNTIL 20 Sep 2026 AND WAS CORRECT WHEN WRITTEN —
             the second consecutive sweep of this line that did not find it
             already behind. THE ONE ADDED IS **data-plane/token-verify.ts**
             (G976–G978, W1-E) — `verifyIdentityToken()`, RS256, `node:crypto`,
             PURE, and **reached by no route**: it is a READER WITH NO CALLER
             OUTSIDE `tests/`, which is `control-plane/roster-store.ts`'s shape
             one directory over and `0007`'s precedent for a surface proven
             without a route.
             🛑 IT CLOSES THE FIRST CLAUSE OF *"NOTHING VERIFIES A TOKEN, SO
             NOTHING RESOLVES A PERSON, SO NOTHING MINTS A SESSION"* AND
             NEITHER OF THE OTHER TWO. No migration, no contract edit, no
             mount — the served set is unchanged; derive it, never read it:
             `grep -rn 'handlers:' server/*/start.ts`.
             🛑 **THE JWKS IS AN ARGUMENT AND THERE IS NO `fetch(`** — G977.
             `grep -rn 'fetch(' server/` still returns nothing, which
             `tests/http/console-roster-unreachable.test.ts` §1c asserts over
             both plane directories; where the key document comes from is the
             NEXT slice and an owner's decision. **And no dependency is taken**:
             `node:crypto` imports an RSA public key straight from a JWK.
             ⚠️ THE ALGORITHM IS OURS AND NEVER THE TOKEN'S — `header.alg` is
             COMPARED against a constant and is never dispatched on, so
             `alg: none` and an HS256 forgery keyed with the PUBLISHED RSA
             public key both leave through `token_algorithm_not_allowed`
             BEFORE a key is selected. `tests/http/token-verify.test.ts` mounts
             that forgery for real rather than describing it.
             ⚠️ THIS SAID 52 UNTIL 20 Sep 2026 AND WAS CORRECT WHEN WRITTEN,

server/      56 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES,
             ⚠️ THIS SAID 53 UNTIL LATER ON 20 Sep 2026 AND WAS CORRECT WHEN
             WRITTEN — the second consecutive sweep of this line to find it
             right, which is worth a clause because most have not. THE THREE
             ADDED ARE G946–G954's TWO MOUNTS:
             **data-plane/reversal-store.ts** (`reverseResolution`'s body),
             **data-plane/disposition-mix-store.ts** and
             **data-plane/reports.ts** (`getDispositionMix`'s body and its
             route).
             🛑 **THE SERVED SET IS NOW 25 OF 136** — derive it, never read
             it: `grep -rn 'handlers:' server/*/start.ts` and count the keys.
             ⚠️ **THE DENOMINATOR DID NOT MOVE: this slice DECLARES no
             operation** — both were already on `capability.openapi.yaml` —
             though it DOES change that document, adding a `422` to
             `getDispositionMix` (G954). A response status is not an
             operation, so `node tools/check-doc-counts.mjs --derive` still
             reports 136 across 125.
             🛑 **`reverseResolution` IS THE FIFTH C6 OPERATION AND ITS
             REFUSAL STOOD IN FIVE FILES.** G359 declined it because *"nothing
             in this repository can produce a resolution, so its only
             reachable answer is its own 409"*; G658's `executeProposal` ended
             that, and `db/migrations/0140` §1 ended the second obstacle
             `tests/db/resolution-chain.test.ts` §10 had been holding open.
             **The 409 is still reachable and is now a refusal about a ROW** —
             `tests/http/proposal-chain-served.test.ts` §10 is the 201 and
             §10b is the 409, in one suite, so neither can be mistaken for the
             other.
             🛑 **`getDispositionMix` IS G318's FOURTH WAVE ARRIVING AT LAST,
             AND ITS BLOCKER WAS NAMED MECHANICALLY RATHER THAN IN PROSE.**
             `tests/contracts/customer-surface-reach.test.mjs` §4 held it back
             on `label` and `family` — *"Nothing in `db/migrations/` declares
             [a catalogue]"* — and G657's `tenant.disposition` fired that
             tripwire, which recorded in its own voice that *"its blocker is
             now a commit rather than a schema."*
             ⚠️ **AND A SECOND BLOCKER WAS FOUND ON THE WAY IN AND IS REFUSED
             RATHER THAN IGNORED (G954): `periodId` IS A DECLARED FILTER WITH
             NO PRODUCER.** `grep -c 'period_id\|run_id'
             db/migrations/0015_exception_register.sql` → 0, and nothing joins
             an exception to a run — so the filter is not unbuilt, it is
             INEXPRESSIBLE. It answers 422 and the 422 is declared in the same
             commit, because ignoring it would return every period as though
             it were the one asked for.
             ⚠️ **`valueAtRisk` IS NOT PUBLISHED AND IT IS THE ONE ROW
             PROPERTY NOT IN `required`**: summing `value_at_risk_*` across
             currencies needs an FX rate no producer on this path has, and
             G111 has no arm for it.
             ⚠️ THE ENTRY BELOW SAID 52 EARLIER ON 20 Sep 2026 AND WAS CORRECT WHEN WRITTEN,
             which is recorded because most sweeps of this line have found it
             already wrong in one direction or the other. THE ONE ADDED IS
             **control-plane/roster-store.ts** (G831) — and it is only the
             SECOND file this repository has ever added under
             `server/control-plane/`, a directory that had not grown since
             16 Aug 2026. It is a READER WITH NO ROUTE, called from `tests/`
             and nowhere else, which is `0007`'s precedent for a column set
             proven without a route and `data-plane/event-stream-store.ts`'s
             shape one plane over. 🛑 **IT DOES NOT MEAN THE CONTROL PLANE
             SERVES THE CONSOLES AND ITS HEADER SAYS SO IN CAPITALS**: the
             console tier is `TIER_REQUIRES_CAPABILITY: true`, and
             `refuseGatedOperations()` throws AT BOOT for any mounted
             operation naming a capability — witnessed live, not reasoned, at
             `tests/http/console-roster-unreachable.test.ts` §2a.
             ⚠️ **THE ENTRY BELOW SAID 56 AND THE COMMAND RETURNED 52 BEFORE G730 TOUCHED
             THE DIRECTORY — STALE IN THE OTHER DIRECTION, WHICH IS THE FIRST
             TIME THIS LINE HAS BEEN AHEAD OF THE TREE RATHER THAN BEHIND IT.**
             A merge that kept both parents' ENTRIES and one parent's NUMBER
             produces exactly this, and it is worse than a low number because
             a reader cannot tell it from a file they failed to find. **G730
             ADDS NO FILE TO `server/`** — it extends
             `data-plane/authorisation-record.ts` with a second writer and a
             second arm, which is the whole of the change here — so the 52 is
             not this slice's to have made stale and is named rather than
             absorbed. Derive it; the number moves every slice.
             🛑 **56 WAS A THIRD ANSWER NEITHER PARENT COMPUTED, AND THIS ENTRY
             NOW APPEARS TWICE BELOW — ONCE SAYING 50 AND ONCE SAYING 49.**
             §5.11 with a second parent, arriving as a DUPLICATED ENTRY
             exactly as it did once before on this line. One branch added
             `proposals.ts`, `proposal-store.ts` and `resolution-vocabulary.ts`
             (G656); the other added `intake.ts` and `run-admission.ts`
             (G691/G692). **`check-doc-counts` CANNOT SEE IT**: each copy's
             number was right about the branch that wrote it, and the checker
             reads a number beside a noun rather than how many nouns there
             are. Both copies are left standing as the history they are;
             **this line is the claim**, derived on the merged tree.
             ⚠️ THIS SAID 47 UNTIL 19 Sep 2026. THE THREE ADDED ARE G656's
             C4 WAVE — data-plane/{proposals,proposal-store,
             resolution-vocabulary}.ts — and they mount SIX operations on
             FOUR DISTINCT CAPABILITIES: `view_exception` on the three reads,
             then `propose_resolution`, `approve_resolution` and
             `execute_resolution` on the three acts. A viewer reads and
             proposes nothing; a partner under the strongest operating scope
             reaches `propose_resolution` and is refused the other two by
             `PARTNER_CAPABILITY_MASK`, because *"a partner may operate on a
             customer's exceptions and may never be the approving authority
             for them."*
             🛑 THE FOUR-EYES RULE IS NOT ONE OF THOSE CAPABILITIES AND COULD
             NOT BE — `Annotation` carries ONE SCALAR CAPABILITY PER
             OPERATION and `decide()` takes ONE PRINCIPAL AND NO RESOURCE
             STATE, while quorum counts distinct PEOPLE and segregation
             compares TWO actors of TWO acts. It lives in `model/approval.ts`
             and again as a RESTRICTIVE POLICY on
             `tenant.approval_decision`, and neither is a second `decide()`:
             neither answers *"may X"*.
             🛑 `reverseResolution` IS STILL NOT MOUNTED AND ONE OF ITS **TWO**
             OBSTACLES IS NOW CLOSED. G359 named only the first — *"nothing
             can produce a resolution"* — and `executeProposal` closes it; the
             second is that `tenant.exception_reversal` takes `GRANT SELECT`
             alone, so mounting it today would answer **500, not 409**.
             `tests/db/resolution-chain.test.ts` §10 asserts both halves so
             the next reader cannot mistake one removed obstacle for none.
server/      49 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES,
             ⚠️ THIS SAID 47 UNTIL 19 Sep 2026. THE TWO ADDED ARE
             data-plane/intake.ts (G691, the channel roster) and
             data-plane/run-admission.ts (G694, `POST /v1/runs`), which is
             G318's FIRST wave arriving LAST — the sequence is *"INGESTION,
             EXCEPTIONS, CORRESPONDENCE"* and waves two and three landed
             first, because `db/migrations/0012` gave ingestion its TABLE and
             nothing gave it a ROUTE.
             🛑 `admitRun` IS THE THIRD WRITE THIS PLANE SERVES AND THE FIRST
             THAT CREATES A ROW IN `public.run`, and mounting it DISCHARGES A
             WITNESS THAT HAD BEEN RED SINCE 16 Aug 2026 WITH NO OWNER:
             `tests/http/engine-on-served-path.test.ts` §4, *"NO REQUEST BODY
             IS VALIDATED ANYWHERE IN THIS SERVER … a 2xx would mean it is
             mounted and the key was accepted, which is strictly worse."* The
             `todo` option is deleted and the assertion is unchanged to the
             character. ⚠️ ONE OF THE THREE BLOCKERS THAT `todo` NAMED WAS
             NEVER A BLOCKER — there is no member of `errors.yaml` meaning
             "declared and unbuilt" and `admitRun` needs none, because it
             declares no 404 and its three refusals are already in the enum.
             🛑 FOUR OF THE SIX C1/C2/C5 OPERATIONS ARE STILL UNMOUNTED AND
             EACH IS REFUSED BY NAME IN `start.ts`: `createUpload` (no object
             store — `grep -c 'aws-sdk' package.json` → 0
             ⚠️ **AND THAT COMMAND RETURNS 1 SINCE 20 Sep 2026 AND NO LONGER
             MEASURES THIS REFUSAL — R-C, THE OWNER'S RULING: `@aws-sdk/client-sqs`
             IS TAKEN, pinned exact, for R-B's run queue, and G212 is
             DISCHARGED BY ITS OWN CONDITION.** The refusal has not moved: what
             is absent is an **S3** client, and R-C is narrow by name. Derive
             the right thing instead —
             `node -e "console.log(Object.keys(require('./package.json').dependencies).filter(d=>d.startsWith('@aws-sdk/')))"`
             → `[ '@aws-sdk/client-sqs' ]`, fenced at
             `tests/infra/manifest.test.mjs`), `completeUpload`
             and `getDocument` (0012 §3 refuses `filename`, `synthetic`,
             `status` and every extraction column BY NAME), and `rerunRun` —
             which needs a `RunTrigger` of kind `rerun` carrying `ofRunId` and
             `reason`, columns `public.run` does not have, and which would
             VALIDATE as `{ kind: 'rerun' }` while dropping the whole of
             *"Carries what changed, so superseded exceptions are
             explicable."*
             ⚠️ THIS SAID 46 UNTIL 19 Sep 2026. THE ONE ADDED IS
             data-plane/role-grants.ts — G512's `grantRoleAssignment`, and it
             is **the first operation either plane has mounted that CREATES
             AUTHORITY**. Every other handler reads, and one amends a single
             column; this one writes a row into `tenant.role_assignment`, the
             table `db/migrations/0009` withheld every write privilege from.
             🛑 FOUR CONTROLS STAND BETWEEN A REQUEST AND THAT ROW AND THEY
             ANSWER FOUR DIFFERENT QUESTIONS: the GATE (`decide()`, may this
             caller act), the RECORD (invariant 10, minted before the act),
             `canGrant()` (is this ROW an escalation) and
             `role_assignment_grant_restrictive` (the same question in SQL,
             against the row as written). The last two are each SUFFICIENT
             rather than each necessary, which is what makes the duplication
             defence in depth rather than §5.3 — and they disagree in BOTH
             directions, deliberately: the model also checks organisation and
             scope, the database also reads capability rows the model's closed
             set does not name. A row must pass both.
             ⚠️ AND IT CANNOT AUTHOR A ROLE, CANNOT REVOKE ONE AND CANNOT
             NARROW ONE — each refused by a privilege `0020` withholds by
             name, not by a feature nobody wrote.
             🛑 THE BOOTSTRAP IS NOT CLOSED AND THE FILE SAYS SO ON ITS FACE:
             no-escalation means the FIRST holder of a capability in a tenant
             cannot arrive through a conferral, so `server/dev/identity-seed.ts`
             is still a migrator write. What moved is the SECOND holder.
             ⚠️ THIS SAID 43 UNTIL 19 Sep 2026. THE THREE ADDED ARE G471's
             CORRESPONDENCE WAVE — data-plane/{correspondence,
             correspondence-store,correspondence-vocabulary}.ts, G318's THIRD
             wave after ingestion and exceptions. 🛑 THREE OF THE SEVEN
             DECLARED C9 OPERATIONS MOUNT AND THE FOUR THAT DO NOT ARE ALL OF
             THE WRITES — `openThread`, `checkOutboundDisclosure`,
             `sendOutboundMessage` and `decideAdmission` — each refused BY NAME
             at the foot of `correspondence.ts`, on a DIFFERENT missing table
             in three of the four cases. The common one is
             `CorrespondenceConfig`, which has no table anywhere. ⚠️
             `decideAdmission` is *"THE MOST SECURITY-SENSITIVE OPERATION IN
             THE PRODUCT"* in the contract's own capitals and is where
             invariant 6 is enforced; two of its three gates have no producer.
             THE SERVED SET IS NOW **23** of 136 declared operations — 🛑 **AND
             23 IS A THIRD ANSWER NEITHER PARENT COMPUTED: one branch said 21
             after G656's six, the other said 17 after G691/G694's two, and
             both were right about their own tree.** §5.11 with a second
             parent, in the one figure this page tells a reader to derive.
             Both narrations follow and neither is correct about this tree.
             ⚠️ **this
             said 15 of 136 until G656 mounted C4's other half later on
             19 Sep 2026, 14 before that and 11 before that.** Derive it,
             never read it: `grep -rn 'handlers:' server/*/start.ts`.
             ⚠️ **THE DENOMINATOR DID NOT MOVE THIS TIME** — G656 declares no
             operation, it mounts six that `capability.openapi.yaml` has
             carried since it was written. It DOES change that document:
             `ExceptionResolution` gains `approvedBy` and `executedBy`
             (G660), which is a property change and not an operation.
             THE SERVED SET IS NOW **17** of 136 declared operations — ⚠️ **this
             said 15 until G691 and G694 mounted `listIntakeChannels` and
             `admitRun` later on 19 Sep 2026, 14 until G512 mounted
             `grantRoleAssignment`, and 11 before that.** ⚠️ **THE DENOMINATOR
             DID NOT MOVE: this slice DECLARES no operation** — both were
             already on `capability.openapi.yaml` — which is the difference
             between mounting one and minting one. Derive both, never read
             them: `grep -rn 'handlers:' server/*/start.ts` and
             `grep -c 'operationId:' docs/contracts/*.openapi.yaml`.
             ⚠️ AND THE DENOMINATOR MOVED IN THE SAME COMMIT — 135 -> 136
             operations across 124 -> 125 paths — because the operation was
             DECLARED here as well as mounted. Both figures are derived, never
             read: `grep -c 'operationId:' docs/contracts/*.openapi.yaml`.
             ⚠️ AND THE ENTRY BELOW SAID 41 UNTIL EARLIER THE SAME DAY. THE TWO ADDED ARE G386's, AND
             THEY ARE A PAIR RATHER THAN TWO FILES:
             **data-plane/session-cookie.ts** — the WHOLE of the session
             handle's delivery channel, `__Host-reconcile_session`, `HttpOnly`
             `Secure` `SameSite=Lax` `Path=/`, and the only place in `server/`
             that may name the cookie, set its attributes or parse its value —
             and **dev/session-header.ts**, which is where `X-Session` WENT.
             🛑 THE MOVE IS THE POINT RATHER THAN TIDYING: `session.ts`
             exported `const SESSION_HEADER = 'x-session'` and read it on every
             request, and a production module that still NAMED the header would
             be one edit from reading it while the grep that proves the fence
             kept returning nothing. A plane started without
             `RECONCILE_LOCAL_TEST_AUTH=1` now holds
             `databaseReader(pool, sessionCookieFrom)` — chosen ONCE, at boot —
             and never loads the dev module at all. Derive both, never read
             them: `grep -rn "from '\.\./dev/" server/data-plane/` → nothing,
             and `grep -rn "'x-session'" server/data-plane/` → nothing.
             ⚠️ AND THE DELIVERY HALF HAS NO PRODUCTION CALLER: nothing mints a
             session, so `mintedSessionCookie()` is called by `tests/` alone.
             That is said here rather than discovered — G386's row is 🟠.
             🛑 THIS PAGE CARRIED **TWO** `server/` ENTRIES UNTIL 19 Sep 2026,
             ONE SAYING 37 AND ONE SAYING 35, AND BOTH WERE RIGHT ABOUT THE
             BRANCH THAT WROTE THEM. A merge kept both branches' sweeps, so
             §5.11 with a second parent arrived as a **DUPLICATED ENTRY**
             rather than as a wrong number — a shape this page had not
             recorded. ⚠️ `check-doc-counts` CANNOT SEE IT: each copy's number
             agreed with the tree its author measured, and the checker reads a
             number beside a noun, not how many nouns there are. The 35 copy is
             DELETED rather than banner-ed, because two entries for one
             directory is not history a reader benefits from — it is a page
             that answers the same question twice, differently. The surviving
             count is DERIVED on the merged tree:
             `git ls-files server | wc -l` → 37.
             routed, validated, GATED AND — since 19 Sep 2026, G301 — RECORDING.
             ⚠️ THIS SAID 34 AND THE COMMAND ALREADY RETURNED 36 BEFORE THIS
             COMMIT TOUCHED THE DIRECTORY — G320's ingestion wave landed two
             files and nothing here followed them. The 36 was not this slice's
             to make stale and is named so the sweep is not read as accounting
             for all three. THE ONE THIS SLICE ADDS IS
             data-plane/signin.ts — `assembleSignIn()`, G340/G344.
             🛑 IT IS REACHED BY NO ROUTE AND THAT IS STATED ON ITS FACE RATHER
             THAN LEFT TO BE DISCOVERED: `completeFederatedSignIn` is declared
             on the session tier and MOUNTED NOWHERE, because a mint needs a
             `user_id`, a `user_id` needs the subject a directory asserted, and
             **nothing in this repository verifies a token** — G306's own
             derivation, `grep -rn 'jwtVerify\|createRemoteJWKSet' server/` →
             nothing.
             ✅ **THE FIRST HALF OF THAT WENT FALSE ON 20 Sep 2026 — G976,
             `server/data-plane/token-verify.ts` — AND IT IS CORRECTED RATHER
             THAN DELETED, because it is the sentence six files carried.**
             🛑 **AND THE DERIVATION BESIDE IT WAS NEVER A MEASUREMENT OF IT —
             G978. THE COMMAND RETURNED *THREE* LINES BEFORE THAT SLICE AND ALL
             THREE WERE PROSE**, this one among them: three headers QUOTING the
             command in order to say it returns nothing. It counts two `jose`
             identifiers, `jose` is not a dependency here, and `node:crypto`
             uses neither name. **It answers `4` today — this very correction is the
             fourth prose line — and it would answer `4` if a verifier had
             never been written.** **§5.1 wearing a
             `grep`.** Derive it honestly instead:
             `grep -rln '^export function verifyIdentityToken' server/` →
             exactly one. ⚠️ **WHAT IS STILL EXACTLY TRUE AND IS WHY
             `completeFederatedSignIn` IS STILL MOUNTED NOWHERE: `tenant."user"`
             has NO EXTERNAL-SUBJECT COLUMN (G306's refusal, now UNBLOCKED and
             still unwritten), `tenant.session.user_id` is `NOT NULL` with no
             writer on any request path, and `MintedSession` carries no handle —
             so even a complete mint would not sign a browser in.**
             What the module DOES do is real and is proven against a
             live PostgreSQL: it reads the attempt, decides with
             `consumeSignInAttempt()`, consumes it, resolves the door from the
             broker handle, and REFUSES `sign_in_door_disagrees` when the door
             the broker names is not the door the redirect pinned. Derive the
             served set, never read it: `grep -rn 'handlers:' server/*/start.ts`.
             ⚠️ THIS SAID 33 UNTIL G300 LATER THE SAME DAY; the one added is
             refusal, not a convenience
server/      37 files (`git ls-files server | wc -l`) — TWO FASTIFY PLANES,
             routed, validated, GATED AND — since 19 Sep 2026, G301 — RECORDING.
             🛑 THIS ENTRY EXISTS TWICE BELOW, ONCE SAYING 34 AND ONCE SAYING
             35, AND NEITHER WAS EVER RIGHT ABOUT THE MERGED TREE. Two branches
             each swept their own copy correctly and the merge kept BOTH —
             §5.11 with a second parent, arriving as a DUPLICATED ENTRY rather
             than as a wrong number, which is a shape this page has not
             recorded before and which `check-doc-counts` cannot see because
             each copy's number was right about the branch that wrote it.
             Both are left standing as the history they are; this line is the
             claim. The one added by G317 is
             **data-plane/event-stream-store.ts** — three write functions over
             0014's three tables, each taking the MODEL's own type whole
             (G377), and **called from `tests/` and from nowhere else**.
             🛑 IT MOUNTS NOTHING AND THAT IS G300 APPLIED RATHER THAN
             DEFERRED: its test is table AND model AND capability, and there is
             no capability in the closed set for reading an audit trail and no
             contract operation declaring one. G301's sixth boot fence is
             untouched — this file marks no handler, which
             `tests/http/authorisation-record.test.ts` §2b still requires.
             Derive it; the number moves every slice.
             ⚠️ THE ENTRY BELOW SAID 33 UNTIL G300 LATER THE SAME DAY; the one added is
             data-plane/run-account.ts, the ROUTE over G284's store — and it is
             the first file here that MOUNTS rather than builds: its two bodies
             were `run-account-store.ts` §4 and §5 already. SEVEN OPERATIONS
             ARE NOW SERVED, not five — `grep -rn 'handlers:' server/*/start.ts`
             — and the two added are `getRunAccount` and `listRunResidue`.
             ⚠️ THIS SAID 32 UNTIL G301 EARLIER THE SAME DAY; the one added is
compose.yaml SEVEN services, THREE networks, every published port on 127.0.0.1
             ⚠️ **THIS SAID FOUR NETWORKS EARLIER ON 5 Oct 2026 — G4323 RETIRED
             `console-read-net`** with the data plane's read-only control pool, under
             the owner's "Full restore" ruling. The three are `data-net`,
             `control-net` and `internal-net` (G4310); `control-plane-db` is on
             `control-net` alone again. Derive both numbers (the command is below).

compose.yaml SEVEN services, FOUR networks, every published port on 127.0.0.1
             ⚠️ **THIS SAID THREE NETWORKS UNTIL 5 Oct 2026 — G4310, THE OWNER'S "Full
             restore" RULING.** The fourth is `internal-net` and it joins EXACTLY
             `data-plane` and `control-plane`: the data plane's signed calls to the
             control plane's internal tier, with no database on it.
             `tests/http/console-roster-unreachable.test.ts` §1a3 enumerates it.
             Derive both numbers, never read them (the command is below).

compose.yaml SEVEN services, THREE networks, every published port on 127.0.0.1
             🛑 **SEVEN-AND-THREE IS A THIRD ANSWER NEITHER PARENT EVER
             COMPUTED, AND IT ARRIVED IN THE MERGE THAT WROTE THIS LINE —
             §5.11 WITH A SECOND PARENT, CAUGHT LIVE RATHER THAN NARRATED
             AFTERWARDS.** One branch said SIX services and THREE networks
             (G1161's `console-read-net`); the other said SEVEN and TWO
             (G1208's `run-queue`). **Each was correct about the branch that
             wrote it and neither was correct about this tree**, because the
             two changes are orthogonal: one adds a network, the other a
             service. A resolution that took either side's text would have
             been textually clean and wrong in one column.
             **Derive BOTH, never read them:**
             `node -e "const y=require('yaml').parse(require('fs').readFileSync('compose.yaml','utf8'));console.log(Object.keys(y.services).length,Object.keys(y.networks).length)"`
             ⚠️ **AND `grep -c` ANSWERS NEITHER** — it counts this header
             block's own prose, which is why the membership assertion is a
             test (`tests/http/console-roster-unreachable.test.ts` §1a) and
             not a number.
             *Resolved 21 Sep 2026.*

             **BOTH PARENT NARRATIONS ARE KEPT BELOW AND EACH IS CURRENT
             ABOUT ITS OWN SUBJECT; only the two numerals above are the
             claim.**

compose.yaml SIX services, THREE networks, every published port on 127.0.0.1
             ⚠️ **THIS SAID TWO NETWORKS UNTIL 20 Sep 2026 — G1161, THE
             OWNER'S.** The third is `console-read-net` and it joins EXACTLY
             `data-plane` and `control-plane-db`; a third member is a ruling
             rather than a compose edit, and
             `tests/http/console-roster-unreachable.test.ts` §1a enumerates
             the membership in both directions. **`control-net` was the
             obvious edit and is REFUSED**: it also carries `control-plane`,
             so the data plane would resolve a LISTENER, which is the
             SigV4-pull shape the owner did not take. Derive the MEMBERSHIP
             rather than the mentions — `grep -c` counts the header block's
             prose too, which is why the assertion is a test and not a
             number.

compose.yaml SEVEN services, TWO networks, every published port on 127.0.0.1
             ⚠️ THIS SAID SIX UNTIL 21 Sep 2026; the seventh is `run-queue`
             (R-B, G1208) — an SQS-compatible local queue holding NO
             credential of ours, on `data-net` alone so invariant 3's
             topology argument is untouched. 🛑 IT IS THERE BECAUSE G1206
             REFUSED IT ON A PREMISE THAT WAS FALSE: *"it could not be
             VERIFIED … within ten minutes"* — **the pull was still
             running, and a refusal resting on a timeout is a refusal
             resting on a stopwatch.** Derive the count, never read it:
             `node -e "console.log(Object.keys(require('yaml').parse(require('fs').readFileSync('compose.yaml','utf8')).services).length)"`
Dockerfile   ONE image, both planes, `npm ci --omit=dev` — no typescript in it
.dockerignore
⛔ DESIGN.md  DELETED 18 Sep 2026 under G264. `git show archive/pre-handoff-pack:DESIGN.md`
             The pack's `Design System` record replaces it. 🛑 BUT G275: the two
             records each claim NINETEEN named rules and the SETS DIFFER —
             twelve DESIGN.md rules have no pack number, and `Second Design`
             (below 820px the register is not a narrower register) is the one to
             check. Re-home or retire each before quoting the pack's nineteen
frontend/    126 tracked files (`git ls-files frontend | wc -l`).
             ⚠️ **THIS SAID 125 UNTIL integrate/5oct-l AND WAS CORRECT WHEN
             WRITTEN — #595 added a file and swept no headline (G4211).** THE
             ONE ADDED IS **`src/components/StatusGrammar.tsx`** (U-27,
             G4181–G4186): the wide bar, the narrow tappable row and the sheet,
             ONE implementation the tenant Close surface, the staff console and
             the partner portal all render. #591, #592, #593 and #594 add no
             file under `frontend/`. Routes and screens do not move. Derive it:
             `git diff origin/main --name-status --diff-filter=AD -- frontend`.
             *Derived 5 Oct 2026 — integrate/5oct-l.* THE PREVIOUS ENTRY IS KEPT WHOLE:
frontend/    125 tracked files (`git ls-files frontend | wc -l`).
             ⚠️ **THIS SAID 123 UNTIL fix/c3-audit-24-25-28-30 AND WAS CORRECT
             WHEN WRITTEN.** THE TWO ADDED ARE **`src/overlays/menu-keys.ts`**
             (G4041: the arrow keys a `role="menu"` promises — the account menu
             is a menu now, in all three chromes) and **`src/period-word.ts`**
             (G4042: the status bar says *reading the period* while the runs read
             is out, never *no period*). Routes and screens do not move; the close
             surface's first tab stop is a skip link to the register (G4043).
             *Derived 4 Oct 2026.* THE PREVIOUS ENTRY IS KEPT WHOLE:
frontend/    123 tracked files (`git ls-files frontend | wc -l`).
             ⚠️ **THIS SAID 122 UNTIL integrate/4oct-j AND WAS CORRECT WHEN
             WRITTEN.** THE ONE ADDED IS **`src/run-account-words.ts`** (#576,
             G3832/G3833): the run page's plain words and its 403 sentence, which
             G3882 then corrected for the owner's G3802 ruling (*"partners still
             see exceptions, not run residue"*). Routes and screens do not move.
             *Derived 4 Oct 2026 — integrate/4oct-j.* THE PREVIOUS ENTRY IS KEPT WHOLE:
frontend/    122 tracked files (`git ls-files frontend | wc -l`).
             ⚠️ **THIS SAID 121 UNTIL fix/partner-staff-apex-round2 AND WAS
             CORRECT WHEN WRITTEN.** THE ONE ADDED IS
             **`src/components/quiet-drop.ts`** (G3710): the partner bar's drop
             order and `+N` cue, MOVED out of `PartnerPortal.tsx` so the staff
             console's bar wears it too (§5.3). Routes and screens do not move.
             *Derived 4 Oct 2026.* THE PREVIOUS ENTRY IS KEPT WHOLE:
frontend/    121 tracked files (`git ls-files frontend | wc -l`).
             ⚠️ **THIS SAID 118 UNTIL feat/register-next-acts AND WAS CORRECT
             WHEN WRITTEN.** THE THREE ADDED ARE **`src/register-acts.ts`**,
             **`src/register-acts-run.ts`** and
             **`src/components/ReopenDialog.tsx`** (G3641–G3650): the register's
             Accept and Reopen, driving `proposeResolution` / `executeProposal`
             and `reverseResolution`. Routes and screens do not move. ⚠️ A
             merge with another frontend slice makes this a third answer —
             derive it. *Derived 3 Oct 2026.* THE PREVIOUS ENTRY IS KEPT WHOLE:
frontend/    118 tracked files (`git ls-files frontend | wc -l`).
             ⚠️ **THIS SAID 117 UNTIL fix/staff-apex-round1 AND WAS CORRECT WHEN
             WRITTEN.** THE ONE ADDED IS **`src/error-copy.ts`** (G3581): E1's
             records moved out of `ErrorPage.tsx` into a `.ts` module so a test
             can drive them, with each host's home way (the register, the partner
             portal, the staff console — THE OWNER'S RULING) filled from
             `routes/surface.ts`. Routes and screens do not move.
             *Derived 3 Oct 2026.* THE PREVIOUS ENTRY IS KEPT WHOLE:
frontend/    117 tracked files (`git ls-files frontend | wc -l`).
             🛑 **117 IS AN ANSWER NO PARENT OF integrate/3oct-g COMPUTED — §5.11.**
             `origin/main` was 112 (#553 added `src/initials.ts`); #555 said 115
             of its own base; #556 added `src/capabilities.ts` and swept
             nothing. 112 + 4 + 1 is 117. Derive the five, never read them:
             `git diff --name-status --diff-filter=A origin/main -- frontend`.
             **THE ENTRY BELOW IS KEPT WHOLE AND IS CORRECT ABOUT ITS BRANCH.**
             *Derived 3 Oct 2026 — integrate/3oct-g.*
frontend/    115 tracked files (`git ls-files frontend | wc -l`).
             ⚠️ **THIS SAID 111 UNTIL feat/ui-parked-pile AND WAS CORRECT WHEN
             WRITTEN.** THE FOUR ADDED ARE C9 rows 18/19's (G3501–G3507):
             **`src/api/parked.ts`** (the three parked-arrival operations; the
             sample copied BY NAME, keys and never a value — G106),
             **`src/parked.ts`** (the words), **`src/parked.css`** and
             **`src/components/ParkedPile.tsx`** — the pile on `/close`,
             counted APART from the register, and its in-page pane. Routes and
             screens are unchanged. *Derived 3 Oct 2026.*
frontend/    111 tracked files (`git ls-files frontend | wc -l`). ⚠️ **THE TWO
             HEADLINES BELOW SAY 99 AND 93 AND THE COMMAND ALREADY RETURNED 109
             BEFORE fix/ui-close-round2 TOUCHED THE DIRECTORY** — §5.11 with a
             second parent, and the later Close-surface files on top; none of
             that was this slice's to make stale. **THE TWO IT ADDS ARE
             `src/chrome-state.ts`** (the account square's initials and the
             residency country, G3473) **and `src/components/LiveRun.tsx`** (a
             running run's live sign, G3476). Routes and screens are unchanged.
             🛑 **AND THE TWO ENTRIES BELOW WERE COMMITTED TO `main` INSIDE AN
             UNRESOLVED MERGE CONFLICT** — `<<<` / `===` / `>>>` markers between
             fix/ui-foundations' 99 and fix/ui-secondary-surfaces' 93, each
             correct about its own branch. The markers are removed and BOTH
             narrations are kept (§5.11); this first number is the claim.
             *Derived 3 Oct 2026.*
frontend/    99 tracked files (`git ls-files frontend | wc -l`) — and SINCE
             3 Oct 2026 (fix/ui-foundations) THE PORTAL ACTUALLY DRAWS IN PLEX.
             ⚠️ **THIS SAID 85 AND WAS CORRECT WHEN WRITTEN.** THE FOURTEEN ADDED:
             **`fonts/`** — eight self-hosted IBM Plex woff2 faces, `OFL.txt`
             and `plex.css` (RV-01, G3391: the portal had NEVER loaded the face
             the kernel names; the apex site dropped Google Fonts with it) —
             plus `src/theme.ts`, `src/components/ThemeToggle.tsx` and
             `public/theme-boot.js` (RV-13,
             G3392, THE OWNER'S: the theme follows the OS; the toggle is
             exported and mounting it is the Close-surface slice's) and
             `src/luminous.css` (RM-04, G3399: a `.lit` strip cell could not
             paint). Routes and screens did not move. Derive it, never read it:
             `git ls-files frontend | wc -l` → 99.
frontend/    93 tracked files (`git ls-files frontend | wc -l`) — NINETEEN
             routes, TWELVE screens in the tenant shell, and the same two host
             surfaces. ⚠️ **THIS SAID 85 AND SIX SCREENS UNTIL 3 Oct 2026 AND WAS
             CORRECT WHEN WRITTEN.** `fix/ui-secondary-surfaces` (G3461–G3468)
             adds EIGHT files — `src/words.ts`, `src/resolve-logic.ts`,
             `src/secondary.css`, `src/api/resolution.ts`,
             `src/components/{Trail,Resolve,Approvals,Quiet}.tsx` — and SIX
             screens: `/`, `/signin/lapsed`, `/invite`, `/ask`, `/reports` (RC-01:
             none renders the route layer's scope any more) and
             `/close/finding/:ref/post`, C5's approve-and-post surface. **No route
             is added.** Derive both, never read them:
             `git ls-files frontend | wc -l` → 93 ·
             `grep -cE "^    '/[^']*': \(" frontend/src/main.tsx` → 12.
             ⚠️ **AND THE ENTRY BELOW SAID 85 AND IS KEPT WHOLE:**
frontend/    85 tracked files (`git ls-files frontend | wc -l`) — NINETEEN
             routes, SIX screens in the tenant shell, and TWO HOST SURFACES
             outside it: the S1 staff console on the console host's `/` and the
             P1 partner portal on the partner host.
             🛑 **85 IS AN ANSWER NO PARENT OF integrate/3oct-f COMPUTED (G3374).**
             The tree at the fork was 77. #543 added ONE (`src/api/principal.ts`)
             and said 78; #538 added FOUR (`src/api/console.ts`,
             `src/components/StaffConsole.tsx`, `src/routes/surface.ts`,
             `src/staff.css`) and swept nothing; #542 added FIVE
             (`src/api/partner.ts`, `src/components/ConsoleHome.tsx`,
             `src/components/PartnerPortal.tsx`, `src/partner.css`,
             `src/routes/host-surface.ts`) and swept nothing. **The merge DELETED
             two of #542's five** — `routes/host-surface.ts`, because two modules
             answering *which surface is this host* is §5.3 (G3371), and
             `components/ConsoleHome.tsx`, #542's interim console front door,
             because #538 built the real one the same day (G3372). 77 + 1 + 4 +
             5 − 2 is 85. ⚠️ **THE ROUTE COUNT MOVED 16 → 19** — #542's three
             `/partner/*` paths, answered only on the partner host and a 404 on a
             tenant host. Derive all three, never read them:
             `git ls-files frontend | wc -l` → 85 ·
             `awk '/^export const ROUTE_PATHS = \[/,/^\] as const/' frontend/src/routes/table.ts | grep -cE "^  '/"` → 19 ·
             `grep -cE "^    '/[^']*': \(" frontend/src/main.tsx` → 6.
             ✅ **BOTH HOST SURFACES NAME THE SIGNED-IN PERSON (G3373)** from
             #543's `getSessionPrincipal`, as text nodes; the partner FIRM is
             still unnamed because nothing served names it.
             *Derived 3 Oct 2026 — integrate/3oct-f.*
frontend/    78 tracked files (`git ls-files frontend | wc -l`) — SIXTEEN
             routes and SIX screens. ⚠️ **THIS SAID 77 UNTIL 3 Oct 2026 AND WAS
             CORRECT WHEN WRITTEN.** The seventy-eighth is
             **`src/api/principal.ts`** (G3354/G3359) — the client for
             `getSessionPrincipal`, read once D1 settles on a signed-in surface.
             The chrome now names the person, the org class and the bound
             tenant, and the strip names each definition — every one as a TEXT
             NODE (D6-9). *Derived 3 Oct 2026.*
frontend/    77 tracked files (`git ls-files frontend | wc -l`) — SIXTEEN
             routes and SIX screens. ⚠️ **THIS SAID 76 UNTIL #534 MERGED
             origin/main AND WAS CORRECT WHEN WRITTEN (G3257).** The
             seventy-seventh is **`src/api/context.ts`** (#532, G3213) — the
             client for D1, which the app calls once per boot on a signed-in
             surface and never on a signed-out one (G3251). *Derived 2 Oct 2026.*
frontend/    76 tracked files (`git ls-files frontend | wc -l`) — SIXTEEN
             routes and SIX screens, and — since #530 — A SECOND BUNDLE.
             🛑 **76 IS AN ANSWER NO PARENT OF integrate/2oct-e COMPUTED, AND NO
             PARENT SWEPT THIS LINE AT ALL (G3196)** — it said 48 on every branch
             while each added files. 48 + 4 (#526: `components/EntryTop.tsx`,
             `components/ErrorPage.tsx`, `entry.css`, `routes/surfaces.ts`) + 4
             (#531: `api/intake.ts`, `close.css`, `components/Soon.tsx`,
             `format.ts`) + 18 (#530: the seventeen files of **`frontend/site/`**,
             the apex marketing site's OWN Vite build, plus `routes/apex.ts`) + 2
             (#528: `components/ProfileSwitcher.tsx`, `test-personas.ts`) is 76.
             ⚠️ **`frontend/src/api/intake.ts` IS ONE PATH WITH TWO HISTORIES AND
             ONLY ONE SURVIVES**: #527 created it as `/demo`'s intake client, #530
             DELETED it when the screens moved to the apex (`frontend/site/src/api/
             intake.ts` replaced it), and #531 created a DIFFERENT file at the same
             path — `listIntakeChannels` for C1's "How the documents arrived" strip.
             The merge kept #531's, which is the right one: nothing in
             `frontend/src` posts an intake any more. Derive all three, never read
             them: `git ls-files frontend | wc -l` → 76 ·
             `awk '/^export const ROUTE_PATHS = \[/,/^\] as const/' frontend/src/routes/table.ts | grep -cE "^  '/"` → 16 ·
             `grep -cE "^    '/[^']*': \(" frontend/src/main.tsx` → 6.
             ⚠️ **AND `/demo` AND `/lookup` ARE STILL TWO OF THE SIXTEEN** though
             this bundle renders neither: they REDIRECT to the apex (G3156), so a
             route is a path the application ANSWERS, not one it draws.
             *Derived 2 Oct 2026 — integrate/2oct-e.*
frontend/    48 tracked files (`git ls-files frontend | wc -l`) — SIXTEEN
             routes and SIX screens. ⚠️ **THIS SAID 46, FIFTEEN AND FIVE UNTIL
             2 Oct 2026 AND ALL THREE WERE CORRECT WHEN WRITTEN.** The two
             added are `api/sources.ts` and `components/Setup.tsx` (G2871–G2880):
             C9's Setup surface at **`/setup`**, the pack's `/setup/*` taken as
             ONE route because the drawing renders its four sub-surfaces as
             sections of one pane, cited on the PACK arm at
             `C1 Close.dc.html#work`. It is wired to the six served endpoint
             operations — list, declare (SFTP/S3), stop and resume, pair with a
             field mapping, bind a credential that is never displayed back.
             🛑 **ROW #22's ADMIN-ONLY NAV IS NOT BUILT (G2871)**: nothing the
             plane serves tells a client what its session may do, so the Setup
             door is drawn for everyone and `/setup` renders the plane's 403 as a
             hatched REFUSED state. ⚠️ **AND THE ACCOUNT MENU'S WHOLE-MENU HATCH
             IS GONE (G2877)** — it read *"Setup has no served operation"*, which
             was false. Derive all three, never read them:
             `git ls-files frontend | wc -l` → 48 ·
             `awk '/^export const ROUTE_PATHS = \[/,/^\] as const/' frontend/src/routes/table.ts | grep -cE "^  '/"` → 16 ·
             `grep -cE "^    '/[^']*': \(" frontend/src/main.tsx` → 6.
             The entry below is kept whole and is correct about its own files.
frontend/    46 tracked files (`git ls-files frontend | wc -l`) — FIFTEEN
             routes and FIVE screens. ⚠️ **THIS SAID 45 UNTIL LATER ON 1 Oct
             2026 AND WAS CORRECT WHEN WRITTEN.** The one added is
             `components/SignIn.tsx` (G2550, under the owner's G2541): `/signin`
             gets a screen — the begin half. It splits the address LOCALLY,
             asks `resolveHomeRealm` and then `beginFederatedSignIn`, keeps the
             tab's `state` and verifier, and sends the browser to the plane's
             authorize URL; `tests/e2e/browser-login.test.ts` §24a starts from
             its button. **NO ROUTE IS ADDED** — `/signin` was already in
             `ROUTE_PATHS` — so the route count stays 15 and the SCREEN count
             moves 4 → 5. Derive it, and note the derivation below that says
             `→ 3` is two screens behind:
             `grep -cE "^    '/[^']*': \(" frontend/src/main.tsx` → 5.
frontend/    45 tracked files (`git ls-files frontend | wc -l`) — and FIFTEEN
             routes. ⚠️ **THIS SAID 43 AND FOURTEEN UNTIL 1 Oct 2026 AND BOTH
             WERE CORRECT WHEN WRITTEN.** W3/S7 (G2501, G2502) adds
             `api/signin.ts` and `components/SignInCallback.tsx`, and
             `/signin/callback` — a STATE of the drawn `/signin`
             (*"Returning from the directory"*) given the fixed address a
             broker returns to, `/signin/lapsed`'s precedent. **G1914 —
             `/signin` against the pack's `/entry` — IS NOT RESOLVED**; the
             tree's spelling is used. Derive the routes:
             `awk '/^export const ROUTE_PATHS = \[/,/^\] as const/' frontend/src/routes/table.ts | grep -cE "^  '/"`
             → 15. The entry below is kept whole and is correct about its
             own files.
frontend/    43 tracked files (`git ls-files frontend | wc -l`) — THE FRONTEND
             ROOT, React + Vite + Tailwind under G198. src/Shell.tsx · components/*
             · overlays/* · routes/* · api/{plane,runs,exceptions}.ts · bridge.css ·
             vite.config.ts · tsconfig.json.
             🛑 **43 IS THE SAME NUMBER AND NOT THE SAME SET — G1031,
             20 Sep 2026 — WHICH IS THE ONE WAY THIS LINE CAN BE STALE WHILE
             THE COMMAND AGREES WITH IT.** `components/RunAccount.tsx` is
             ADDED and `components/RunDetail.tsx` is DELETED in the same
             commit, so the count did not move and the tree did. *The number
             agreed and the sets did not* is the 16 Aug 2026 capability row's
             shape arriving on a FILE count; `check-doc-counts` cannot see it
             and neither can the command beside it. Retrieve the deleted file:
             `git show HEAD~1:frontend/src/components/RunDetail.tsx`.
             ⚠️ THE DELETION IS NOT A TIDY-UP: the drawer was the STAND-IN for
             `/close/run/:runId` while the route layer was dead code, its own
             header recorded it as *"STILL UNWITNESSED AS A RENDERED
             SURFACE"*, and `Register`'s `onOpen` went with it — `accountLink`
             inherits that prop's whole argument, absence included.
             ✅ **THE ROUTE LAYER IS WIRED IN — G486, 19 Sep 2026 — AND THE
             SENTENCE BELOW THAT SAID IT WAS DEAD CODE IS CORRECTED RATHER THAN
             DELETED**, because it is the sentence this page, `Shell.tsx` and
             `tests/app/route-provenance.test.ts` all carried and the one a
             reader would have quoted onward. `main.tsx` builds ONE router at
             module scope over `frontend/src/routes/table.ts` and hands
             `RouteView` a PARTIAL MAPPED TYPE of screens, so a thirteenth
             route is `TS2353` at the wiring as well as at the table. Derive
             it, never read it:
             `grep -rln "routes/table\|routes/router\|routes/screens" frontend/src | grep -v '^frontend/src/routes/'`
             🛑 THREE OF THE **FOURTEEN** HAVE A SCREEN — `/close` (the
             register, which MOVED THERE FROM `/`), `/close/finding/:ref`
             (G486's narrow finding surface, NOT the pack's C4) and — since
             20 Sep 2026, G1031 — `/close/run/:runId`, the run's own account.
             The other **ELEVEN** render the route layer's own scope with NO
             HATCH, because the hatch means REFUSED (G216 as amended, G245)
             and an undrawn surface is a GAP. Derive BOTH, never read them:
             `grep -cE "^    '/[^']*': \(" frontend/src/main.tsx` → 3 ·
             `awk '/^export const ROUTE_PATHS = \[/,/^\] as const/' frontend/src/routes/table.ts | grep -cE "^  '/"` → 14
             ⚠️ **THE SECOND NUMBER SAID 12 UNTIL 22 Sep 2026 AND WAS CORRECT
             WHEN WRITTEN.** THE TWO ADDED ARE `/demo` AND `/lookup` — G1911,
             the pack's own PUBLIC-PLANE route table, which marks both
             `specified` and neither `built`. **NO FILE IS ADDED AND THE 43
             ABOVE DOES NOT MOVE**: two lines in `ROUTE_PATHS`, two entries in
             `ROUTES`, and no screen for either.
             🛑 **THEY ARE THE FIRST ROUTES IN THIS TABLE FROM AN AUTHORITY
             THAT IS NOT THE DELETED DRAWN RECORD**, which is why `RouteSpec`
             became a UNION (G1913): `design/routes/` never held a
             `demo.html` or a `lookup.html`, so the old
             `{ tier, file, anchor }` shape could only take them by INVENTING
             a citation to a position that has never existed in any tree —
             strictly worse than the twelve rotted-but-once-real ones G278 and
             G319 record. The `specified` arm names the PACK RECORD and
             carries **no anchor**, because the pack ships none.
             ⚠️ **AND `Tier` GAINED A THIRD MEMBER, `Public`, WHICH IS THE
             PACK'S PLANE COLUMN AND NOT THE DRAWN RECORD'S TIER TABLE
             (G1912)** — two vocabularies in one field, §5.3's shape, taken
             knowingly against the alternative of a second `plane` field that
             would be a third authority for a fact the pack already states.
             🛑 **THE `/entry` ↔ `/signin` COLLISION IS RECORDED AND NOT
             RECONCILED (G1914), AND THIS SLICE MADE IT ANOMALOUS RATHER THAN
             UNIFORM**: the tree now takes the pack's spelling verbatim for
             `/demo` and `/lookup` and keeps its own for the one that is
             DRAWN. It is a 3→1 COLLAPSE and not a rename — `/signin`,
             `/signin/lapsed` and `/invite` all sit on the pack's single
             `/entry` — and **which name stands is an OWNER'S RULING** that
             `tests/app/route-provenance.test.ts` has said is the owner's
             since G319.
             ⚠️ **AND THE `specified` JOIN DOES NOT JUDGE ANY OF THE THREE
             PUBLIC-PLANE ROWS (G1916)**: §4b of that suite — *"a row the pack
             marks `specified` whose path DOES resolve is ALSO a RED"* — is
             filtered to `plane === 'data'`, so `/`, `/demo` and `/lookup`
             resolve under a `specified` word and nothing reds. **`/` was
             already in that position and no document had said so.** It is
             COUNTED rather than closed, at §6 of that suite, which goes red
             the day either side moves.
             ⚠️ **THIS SAID TWO AND TEN UNTIL 20 Sep 2026 AND WAS CORRECT WHEN
             WRITTEN.** The third arrived because a HATCH was wrong, not
             because a route was chosen: `Register.tsx` refused the run's
             account on G200 with *"getRunAccount and listRunResidue are
             declared and not mounted"* while **G300 had mounted both the day
             before**. A hatch means REFUSED and G245 minted a separate ink
             step to keep it meaning only that, so a hatch asserting a
             discharged refusal is worse than one asserting *unfinished* — a
             reader cannot tell a wrong hatch from a right one. The mark is
             DELETED and quoted on its own site; derive the mount:
             `grep -n 'getRunAccount\|listRunResidue' server/data-plane/start.ts`.
             🛑 **AND THE SCREEN'S HONEST PRIMARY STATE IS A 404**: nothing
             persists a `SetReconciliationResult`, so `getRun` answers 200 and
             both account reads answer `no_account` on the SAME run. That is
             why `main.tsx` keeps THREE state machines for one route and why
             the 404 has its own arm — folding it into an empty page would
             *"report a clean close for a run nobody ran"*.
             ⚠️ `/` IS NOW THE ENTRY ROUTE AND IS NOT THE REGISTER, which is a
             behaviour change a reader meets on the first page load.
             🛑 TWO DEFECTS THE WIRING EXPOSED AND NOTHING ELSE COULD HAVE
             SEEN — both measured, neither reasoned: `resolve()` never
             PERCENT-DECODED a bound segment (G487), so an id containing a
             space or a colon 404'd; and `base: './'` made every asset URL
             relative (G488), so ANY deep link below the root served
             `index.html` as JavaScript and painted a blank page.
             ⚠️ THIS SAID 41 UNTIL G486, which added `routes/useRoute.ts` (the
             React seam `router.ts` said was owed) and `components/Finding.tsx`.
             ⚠️ THIS SAID 39 UNTIL 19 Sep 2026, when G357 added
             api/exceptions.ts and components/ExceptionRegister.tsx — the
             pack's C3, drawn against a served operation and driven in a real
             browser by tests/e2e/browser-login.test.ts §6–§9.
             🛑 `endpoint()` IN api/runs.ts IS NOW EXPORTED AS `planeEndpoint()`
             AND THE EXPORT IS THE POINT RATHER THAN A CONVENIENCE: it is a
             REPAIR, not a helper — its own block records that the
             concatenating spelling put `?tenantId=` on the wire through
             `?plane=` — so a second client with its own URL builder would be
             that defect fixed once and regressed in the copy.
             ⛔ SUPERSEDED BY G486 ABOVE, KEPT AS THE HISTORY IT IS — and its
             SECOND sentence is still exactly true, which is why it is kept
             whole rather than half:
             ⚠️ THE ROUTE LAYER IS STILL DEAD CODE AND THIS SLICE DID NOT WIRE
             IT. C2 and C3 are SEPARATE SCREENS in the pack and stack on ONE
             route here; `Shell.tsx`'s `exceptions` prop says why at length,
             and says that wiring a router is a materially larger change.
             🛑 C2 AND C3 STILL STACK ON ONE ROUTE AFTER G486. Splitting them
             would be a THIRTEENTH route and therefore a design change, so the
             router made the FINDING addressable and did not split the
             register.
             IN THE GATE TWICE: `typecheck:frontend` and `build:frontend`.
             ⚠️ THIS SAID 22 AND THE COMMAND ALREADY RETURNED 36 BEFORE THIS
             COMMIT TOUCHED THE DIRECTORY — G247's four overlay primitives and
             their specimen landed without it. The 36 was not #267's to make
             stale and is named so the sweep is not read as accounting for all
             seventeen. Derive it; the number moves every frontend slice.
             🛑 THIS ENTRY DID NOT EXIST UNTIL 22 Aug 2026 AND NEITHER DID THE
             WORD "frontend" ANYWHERE ON THIS PAGE — `grep -c 'frontend' CLAUDE.md`
             RETURNED 0 while an application root sat in the tree and in the gate.
             ✅ THERE IS A ROUTE TABLE — src/routes/{table,screens,router}.ts,
             #267. ⚠️ THIS READ "THERE IS NO ROUTE TABLE YET:
             `git ls-files frontend | grep -ci route` → 0, which is #267" and it
             is corrected rather than deleted, because it is the sentence a
             reader would have trusted before deciding whether to build one.
             The command now returns 3. ⚠️ **THIS SAID "TWELVE ROUTES" UNTIL
             22 Sep 2026 AND WAS CORRECT WHEN WRITTEN; THERE ARE FOURTEEN
             (G1911) AND THE COMMAND IS THE CLAIM, NOT THE WORD** —
             `awk '/^export const ROUTE_PATHS = \[/,/^\] as const/' frontend/src/routes/table.ts | grep -cE "^  '/"`.
             🛑 THE SENTENCE THAT
             STOOD HERE — "the SEVENTEEN the drawn record enumerates as undrawn
             are ABSENT rather than hatched … which is the assertion
             `tests/app/route-table.test.ts` §2 carries" — IS CORRECTED RATHER
             THAN DELETED, because it named a control that NO LONGER EXISTS.
             That suite was RETIRED 18 Sep 2026 (G278): every path in it was
             read at runtime out of `design/routes/index.html`, which G264
             deleted. 🛑 THE NEXT CLAUSE READ "and it CANNOT be re-homed because
             the pack ships no URL at all — `grep -ohE
             '<code>/[a-z0-9/:*-]+</code>' docs/handoff-pack/*.dc.html` returns
             nothing", AND IT IS CORRECTED RATHER THAN DELETED, because it is
             the sentence that told a reader a control could not be rebuilt.
             THE COMMAND IS CORRECT AND STILL RETURNS NOTHING; THE CONCLUSION IS
             WRONG — §5.1, a rule keyed on a landmark (`<code>`) instead of the
             property. THE PACK HAS PATHS IN THREE MACHINE-READABLE FORMS and
             G319 (19 Sep 2026) amends G278 on that premise. Derive them:
             `grep -c 'rt-route' 'docs/handoff-pack/User Journeys.dc.html'` → 13
             rows · `grep -oh "surface:'[^']*'" docs/handoff-pack/*.dc.html |
             wc -l` → 156 steps, 68 of them URL-shaped · plus a role × route
             access matrix. ✅ THE REPLACEMENT IS BUILT —
             `tests/app/route-provenance.test.ts`, which derives BOTH sides at
             runtime and joins the pack's `exists` column to the tree in TWO
             kinds: a `built` row that does not resolve is a red, and so is a
             `specified` row that does. ⚠️ EXACT OVERLAP IS FOUR OF TWELVE BY
             NAME and the suite records the other sixteen as argued entries
             rather than silencing them. 🛑 WHAT SURVIVES OF G278: the pack
             ships NO per-screen anchor, so `RouteSpec.file` and
             `RouteSpec.anchor` point at nothing and cannot be repaired; and
             §2's "the undrawn routes are ABSENT rather than hatched" has no
             home in the pack either — ✅ **THOUGH IT HAS ONE IN A BROWSER
             SINCE G486**: `tests/e2e/browser-login.test.ts` §17 navigates to
             an undrawn path and requires `No such route` and ZERO `.nb`
             elements under the route root, which is §2's property witnessed
             at runtime rather than against a deleted file. ✅ **AND THE
             LARGER GAP IS CLOSED — G486, 19 Sep 2026.** ⚠️ THE SENTENCE THAT
             STOOD HERE IS CORRECTED RATHER THAN DELETED, because it is the
             one a reader would have quoted onward: "🛑 AND A LARGER GAP,
             REPORTED NOT FIXED: NOTHING OUTSIDE `frontend/src/routes/`
             IMPORTS THE ROUTE LAYER — not main.tsx, not Shell.tsx — so
             `vite build` drops it and the twelve are unreachable from the
             running application." **`main.tsx` imports all three modules and
             the twelve resolve in a real browser.** The pack
             implies ≈58 routes. G278 and G319 name what is owed.
⛔ design/    DELETED 18 Sep 2026 under G264 — all 25 files: system/ (the old
             kernel and five sheets), routes/ (six drawn routes), the eleven
             close-* concept sheets, logo.html. ALL RETRIEVABLE:
             `git show archive/pre-handoff-pack:design/system/tokens.css`
             THE KERNEL MOVED, IT DID NOT DIE: it is now
             docs/handoff-pack/tokens.css — a measured SUPERSET (73 light + 26
             dark properties against 40; 36 of the 40 survive by name, 26
             byte-identical), and `frontend/src/bridge.css` imports it.
             🛑 "SUPERSET" IS TRUE OF CUSTOM PROPERTIES AND FALSE OF KEYFRAMES,
             AND NO DOCUMENT SAID SO UNTIL 19 Sep 2026. The old kernel declared
             FIVE keyframes and the new one declares FOUR, of which only TWO
             names survive. Derive both, never read them:
             `git show archive/pre-handoff-pack:design/system/tokens.css |
             grep -oE '@keyframes [a-z-]+' | sort -u` → alive · halo · lv ·
             settle · sweep, against `grep -oE '@keyframes [a-z-]+'
             docs/handoff-pack/tokens.css | sort -u` → alive · mascot-cascade ·
             mascot-cascade-mid · sweep.
             ⚠️ THE THREE LOSSES ARE NOT ONE FINDING and reporting them as one
             would overstate two of them. `settle` was ALREADY DEAD by the old
             kernel's own header — "declared, applied to nothing. Not carried."
             `halo` was applied to nothing in the old kernel either: the
             connection ring used `alive` then and uses it now, and the new
             kernel still calls that ring "the halo" in its reduced-motion
             comment.
             🛑 `lv` IS THE REAL ONE. The pack kernel's own MOTION INVENTORY
             names FOUR PRODUCT ANIMATIONS — sweep · alive · lv · toast-in —
             and declares a keyframe for two of them. `@keyframes lv` sits in
             docs/handoff-pack/system-page.css, a PAGE sheet the frontend does
             not import, while `Design System.dc.html` and `Handoff
             Specification.dc.html` both still specify its 1.4s duration and
             its reduced-motion behaviour. So the agent's level bars are
             SPECIFIED by the records and UNREACHABLE from the kernel that
             ships. THE MISSING KEYFRAMES ARE THE OWNER'S TO RULE ON — this
             page reports, it does not restore
⛔ .impeccable/ DELETED 18 Sep 2026 under G264 — 11 files.
             `git show archive/pre-handoff-pack:.impeccable/direction-record.md`
             G72's world survives in the pack; G186 had already replaced its palette
tests/       node --test — app · ci · contracts · db · design · docs · e2e ·
             http · infra · model ·
             scenarios · tools. ⚠️ THIS OMITTED `e2e` UNTIL 19 Sep 2026, AND THE
             OMISSION CLASS IS THE ONE THIS PAGE CATALOGUES THREE TIMES — an
             absent name has no number in it, so `check-doc-counts` is EXIT 0
             throughout. Derive it: `ls -d tests/*/ | wc -l`.
             🛑 `tests/e2e/` IS THE ONLY PLACE A BROWSER MEETS A REAL PLANE.
             `browser-login.test.ts` drives the BUILT bundle in chromium
             against `startDataPlane()` with NO `authorise` and NO `substrate`
             argument — the PRODUCTION seams — over one origin, and asserts
             that the browser-driven read MINTED invariant 10's record.
             `single-origin.ts` is the local mirror of the deployed CloudFront
             arrangement and forwards `Host` BYTE-FOR-BYTE, because G180
             compares it on every request and revokes on a mismatch.
             ⚠️ `probe-staging.mjs` IS NOT A CHECKER AND IS NOT IN THE GATE —
             it reaches the public internet, which G108's determinism condition
             forbids. It is not named `*.test.mjs` for that reason. Run it by
             hand: `node tests/e2e/probe-staging.mjs`
docs/        the design record, SEVEN OpenAPI contracts, and ONE HTML visual
             (c4.html, generated and gate-checked; nine were deleted 18 Sep 2026).
             ⚠️ THIS SAID SIX UNTIL 19 Sep 2026, when the OWNER'S SPLIT RULING
             landed contracts/platform-console.openapi.yaml — FOURTEEN staff-
             console operations over THIRTEEN paths, cut out of
             administration.openapi.yaml so that ONE tier can carry
             `TIER_REQUIRES_CAPABILITY: true`. Derive it, never read it:
             `ls docs/contracts/*.openapi.yaml | wc -l` → 7.
             🛑 THE TOTALS DID NOT MOVE AND THAT IS THE POINT OF A SPLIT:
             136 operations across 125 paths, before and after — 59 -> 45 here
             and 0 -> 14 there, 52 -> 39 and 0 -> 13. **A split is the one
             change to this corpus that adds a FILE and no OPERATION**, which
             is why `check-doc-counts`'s two contract totals are silent on it
             and why the file count is checked by nothing but a person.
             🛑 IT IS THE SECOND TIER EVER TO BE GATED, and the owner's own
             objection is on the document's face rather than resolved:
             *"it is still contract surgery and still a ruling."* The verdict
             is per FILE, so the file boundary now carries an authorisation
             decision — §5.1's shape, named in the document's §7 with the
             repair (a per-OPERATION verdict) that nobody has ruled on.
             ⚠️ THE RULING SAID 26 AND THE TIER TAKES 14. G602's table records
             `platform-role` (26) as annotatable since G601 and is WRONG about
             twelve of them: the partner registry and the notification tray
             have no resource class at all, `identity` is refused by
             `PLATFORM_ASSIGNMENT_REACHES` DELIBERATELY, the support-case and
             break-glass acts are invariant 8's grant path, and
             `raiseAdjustment` is a POST on `commercial`, which is OPEN and
             has NO WRITE VERB. Derive the split, never read it:
             `grep -c 'x-admin-authority: platform-role' docs/contracts/*.openapi.yaml`
             ⚠️ IT MOUNTS NOTHING and the blocker is `mountTier()`'s SIXTH
             FENCE, not effort: `AuthorizationGrant extends TenantScoped` and a
             platform principal acting on the fleet has no tenant for
             invariant 10's record to live in — G728's finding, reached from
             the console-session side. NOBODY HOLDS ANY OF THE SIX VERBS
             either; no seed has ever written a platform_role_assignment row.
             ⚠️ THIS SAID FIVE UNTIL 19 Sep 2026, when G288 landed
             contracts/administration.openapi.yaml — the partner portal and the
             staff console, 59 operations over 52 paths, DECLARED AND UNMOUNTED.
             ✅ AND REGISTERED IN `TIERS` SINCE 19 Sep 2026 — G533. ⚠️ THIS
             READ "and NOT REGISTERED IN `TIERS`" AND IS CORRECTED RATHER
             THAN DELETED, because it is the sentence that told a reader a
             third of the contract surface was invisible to the gate, and it
             was TRUE: `check:annotations` walked 77 operations and now walks
             136. `TIER_REQUIRES_CAPABILITY.administration` is `false` and
             THE ARGUMENT IS ON THE ENTRY ITSELF — read it before mounting
             anything, because on THIS tier `false` means a mounted operation
             is served to any authenticated caller with no gate and mints no
             invariant 10 record. 🛑 STILL UNMOUNTED, and that is G534 rather
             than a backlog. Derive both, never read them.
             ⚠️ THIS ENTRY READ "135 operations and 124 paths are now ABOVE
             check-doc-counts's [40, 120] band … so nothing checks either figure
             any more", AND IT WAS TRUE WHEN WRITTEN. It is FIXED in the commit
             that merged it rather than left owed: the band is [40, 160], and
             `tests/tools/band-does-not-silence.test.mjs` makes the next
             crossing a RED GATE instead of another silent one. 400 was tried
             first and is WRONG — it reports docs/salvage-ledger.md's "~184
             operations", a claim about the REPLACED SAP-line application, as
             our stale number, which is exactly what the band exists to
             exclude. 🛑 AND THE SAME DEFECT WAS ALREADY LIVE AT THE FLOOR AND
             HAD BEEN SINCE G264: `visuals` held 1 against a floor of 3, so
             every line correctly saying ONE visual was skipped while stale
             lines saying TEN kept being checked. Found by that test on its
             first real run:
             `ls docs/contracts/*.openapi.yaml | wc -l` · `ls docs/*.html | wc -l`
             · tech-stack.md — THE stack and deployment authority (G252–G263)
             · handoff-pack/ — 25 files, THE NORTH STAR (G264, 18 Sep 2026):
               four records, nine surfaces, and tokens.css, WHICH IS THE KERNEL
⛔ Mockups/   DELETED 18 Sep 2026 under G264 — 22 files, 18 drawn screens.
             `git show archive/pre-handoff-pack:Mockups/rec/Navigation.dc.html`
             ⚠️ IT WAS CITED BY LINE FROM BUILT CODE — ChromeBar.tsx calls
             `Navigation.dc.html:451` "the authority" and Shell.tsx cites
             `Sitemap.dc.html:102`. The pack reproduces every one of those
             positions (nine controls, three destinations, no tiles, no sidebar)
             so the citations RE-POINT rather than die — but they are not all
             re-pointed yet, and that is a known gap, not a finished sweep
tools/       11 checkers, 1 shared module, 3 REPORTERS — `ls tools/*.mjs | wc -l`
             → 15. ⚠️ **SAID 2 REPORTERS → 14 UNTIL 5 Oct 2026 AND WAS CORRECT WHEN
             WRITTEN.** The third reporter is **run-measure.mjs** (G4368,
             `npm run measure:run`): G1524's measurement on a SYNTHETIC corpus —
             read, engine and write time, peak RSS, and how long a pooled connection
             is HELD. It prints and fails nothing and is NOT in the gate (a timing is
             neither deterministic nor fast, G108); `tests/tools/run-measure.test.mjs`
             asserts the absence. The `checkers` total is unchanged. *Derived 5 Oct
             2026.* THE PREVIOUS ENTRY FOLLOWS, KEPT WHOLE:
tools/       11 checkers, 1 shared module, 2 REPORTERS — `ls tools/*.mjs | wc -l`
             → 14. ⚠️ **SAID 10 · 1 · 1 → 12 UNTIL 23 Sep 2026.** The eleventh
             checker is **check-self-measuring-derivations.mjs** (G2081,
             `check:derivations`) and the second reporter is
             **served-set.mjs** (G2083, `npm run served`) — which prints and
             cannot fail anything, like `skip-census.mjs`. Both exist because
             TWO derivations this page hands out were counting their own
             quotation in prose, and a circulated summary ran them and
             reported *"29 / 137 operations served"* against a truth of **30
             of 136**. ✅ **AND BOTH GATE NUMBERS ARE GOVERNED SINCE 21 Sep 2026 —
             G1471.** `checkers` and `gate stages` are derived totals in
             `tools/check-doc-counts.mjs`, so a stale figure anywhere in the
             record is a GATE FAILURE. It caught THREE stale lines on its
             first run — `README.md` said FIVE checkers and named five by
             hand while ten were in the gate, and `docs/HANDOFF.md` said FOUR
             twice. **That is the ninth recorded wrong value across these two
             numbers and the first found by a checker rather than a person.**
             🛑 **EVERY CHECKER NOW PRINTS A DENOMINATOR AND FIVE OF THEM
             REPORTED SUCCESS OVER NOTHING UNTIL THIS COMMIT — G1473–G1477,
             `docs/build/completion-plan.md` K4**, which is §5.6 arriving in
             the tools written to catch §5.6. Each was WITNESSED printing a
             tick at EXIT 0 over an empty subject before its guard was
             written: `check-migration-numbers` (*"✔ db/migrations — 0
             migrations, 0 distinct numbers"*, twice), `check-c4-freshness`
             (*"OK C4 artefacts match the tree — 0 modules, 0 import edges, 0
             exports"*), `check-g-numbers` (*"G rows: 0 · duplicates 0"*),
             `check-citations` (*"Citations resolved: 0 (OK 0 · SUSPECT 0 ·
             DEAD 0)"*) and `check-wire-mirror` — **whose `DRIFT (0). Every
             compared pair mirrors its model declaration` over ZERO
             comparisons is the one to read twice**, a true sentence about an
             empty set printed in the vocabulary of an all-clear.
             ⚠️ **`check-doc-counts` WAS THE SIXTH ON K4's LIST AND IS NOT ONE
             (G1478): its derivations THROW on a broken subject**, measured
             three ways, so it already failed closed. It gained the printed
             denominator and a documented tripwire, and the correction is
             recorded rather than the count quietly being called six.
             `tests/tools/checker-denominators.test.mjs` derives the checker
             set from `package.json`, so an eleventh checker with no
             denominator is a RED. 🛑 THE TENTH IS check-clock-fixtures.mjs (G1351,
             21 Sep 2026), in the gate as `check:clocks`, AND IT EXISTS
             BECAUSE THE FIXTURE DETONATED RATHER THAN BECAUSE SOMEBODY
             FORESAW IT: G1209 found a fixture seeded from the DATABASE's
             clock and asserted against a FROZEN one, which had already
             flipped on 2026-09-20T12:00Z and would have gone on asserting
             the OPPOSITE of what it was written to assert. **A defect that
             arrives by the calendar has no commit to blame and reads as
             flake.** G1209's own row ends by saying the sweep is owed and
             *"wants a control rather than a reading"* — a one-off grep by a
             person rots the moment the next fixture lands.
             🛑 WITNESSED RED FIRST against the REAL pre-repair file
             (`git show 15fcd10e~1:tests/db/identity-substrate.test.ts`):
             `FIRED — flipped 2026-09-20T12:00:00.000Z`, EXIT 1 — **and it
             DERIVED that date rather than being told it.**
             ⚠️ IT PRINTS A DENOMINATOR ON EVERY RUN, which is what
             `docs/build/completion-plan.md` K4 says two checkers here do not:
             `337 file(s) scanned · 15 with a frozen now: clock · 7 with a
             past-direction now() - interval · 0 with BOTH`. Derive it, never
             read it: `node tools/check-clock-fixtures.mjs`.
             ⚠️ AND IT IS A LANDMARK, NOT THE PROPERTY, BY ITS OWN HEADER: it
             cannot see `CURRENT_TIMESTAMP`, a computed or bound interval, or
             a clock reaching the evaluator through a helper. It catches the
             one that bit. 🛑 THE NINTH IS check-migration-numbers.mjs (G356,
             19 Sep 2026), in the gate as `check:migrations`, AND IT EXISTS
             BECAUSE THE COLLISION HAPPENED RATHER THAN BECAUSE SOMEBODY
             FORESAW IT: two agents each numbered a migration `0011` and
             `git merge` PRODUCED BOTH WITH NO CONFLICT, because different
             filenames give git nothing to object to. `db/migrate.ts` orders by
             `readdir().sort()` and keys the ledger on the FILENAME, so both
             would have applied in ALPHABETICAL order — an order nobody chose,
             under G88's forward-only. ⚠️ THE G-BLOCK RESERVATION HANDED TO
             EACH AGENT WORKED — zero duplicate G numbers across seven rulings
             from four agents — AND NOBODY EXTENDED IT TO MIGRATION NUMBERS,
             which is exactly how the G numbers stayed clean while the
             migrations collided. A reservation is only as wide as the
             namespaces somebody listed. 🛑 THIS SAID "6 checkers … → 8" UNTIL 19 Sep 2026 AND BOTH
             NUMBERS WERE ALREADY ONE BEHIND BEFORE THIS COMMIT TOUCHED THE
             DIRECTORY: check-absent-rows.mjs (G242) is a checker and is in the
             gate as `check:absent-rows`, and nothing here followed it. The
             7-and-9 was not this commit's to make stale and is named so the
             sweep is not read as accounting for both. THIS COMMIT ADDS THE
             EIGHTH, check-capability-annotations.mjs, in the gate as
             `check:annotations` — and it is a MOVE, not a new file:
             `tests/contracts/annotations.mjs` said in its own header that
             "`tools/` takes a checker when the gate it checks exists, and today
             the gate does not", and G200's request-time gate landing IS that
             event. DERIVE BOTH — the FILE count has now been a wrong proxy for
             the CHECKER count four times, and this is the second time the
             checker count itself was stale:
             `node -e "console.log(Object.keys(require('./package.json').scripts).filter(k=>k.startsWith('check:')))"`
             🛑 THIS SAID "5 checkers … → 7" UNTIL 22 Aug 2026 AND BOTH
             NUMBERS WERE WRONG: check-g-numbers.mjs is the SIXTH checker and
             is in the gate as `check:g-numbers`. ⚠️ IT EARLIER SAID
             "5 checkers (`ls tools/*.mjs | wc -l`)"
             AND THE COMMAND ALREADY RETURNED 6 AT origin/main: the sixth file is
             citation-symbols.mjs, a shared declaration index imported by
             check-citations, not a checker anybody runs. The seventh is
             skip-census.mjs, a node:test REPORTER — it prints, it cannot
             fail a run, and it must not be counted as a checker either.
             THE CHECKERS: check-doc-counts · check-citations ·
             check-wire-mirror · check-pack-safety · check-c4-freshness ·
             check-g-numbers · check-migration-numbers · check-absent-rows ·
             check-clock-fixtures (G1351 — a fixture on the database's clock
             asserted against a FROZEN one; it prints its own denominator and
             its header states at length what it cannot see) ·
             check-capability-annotations (G200's boot fences, applied to
             every declared operation no plane mounts — the 7 that ARE
             mounted are fenced by `mountTier()` instead. ⚠️ THIS SAID 4 UNTIL
             G300 mounted two more on 19 Sep 2026, and the 4 was ALREADY WRONG:
             `resolveTenantContext`, `listRuns`, `getRun`, `checkLocalHealth`
             and `listEntitledPacks` are five. DERIVE IT:
             `grep -rn 'handlers:' server/*/start.ts`)
             — plus planner/extract.mjs (the model graph)
             and planner/{extract-c4-data,render-c4-components,render-c4-page}
infra/       THE CDK APP, landed 18 Sep 2026 under G259 — its OWN package.json
             (aws-cdk-lib and constructs must NEVER enter the root manifest;
             that is the property G212 refused the AWS SDK to protect), its own
             tsconfig.json carrying the same seven options as the other four,
             and `bin/app.ts` run by `node` with no build step.
             🛑 **THIRTEEN STACK FILES SINCE 2 Oct 2026 — `ls infra/lib/*-stack.ts
             | wc -l` → 13 — AND THE THIRTEENTH IS IN THE APP ONLY ON REQUEST.**
             `MockIdp` (`lib/mock-idp-stack.ts`, G2996, THE OWNER'S RULING
             G2771): a STAGING-ONLY mock OIDC provider — **a public test login,
             accepted in writing** — rendered only under `-c mockSignIn=on`,
             with its three Cognito providers in `Identity` only under
             `-c mockIdpIssuer`, and a synth FAILURE for any other environment
             (G2997). Without either flag every template is byte-identical.
             Runbook: `docs/build/deploy-handoff.md` §26.
             TWELVE STACKS — ⚠️ **THIS SAID ELEVEN UNTIL 22 Sep 2026 AND WAS
             CORRECT WHEN WRITTEN — the SECOND consecutive sweep of this line
             to find it right.** THE TWELFTH IS `Amplify` (S5, G1961–G1980,
             **THE OWNER'S RULING**) — the PUBLIC MARKETING PLANE at the apex
             `reconcileai.app`, honouring `docs/build/deploy-handoff.md` §5.4:
             *"a different tool for a different job."* Derive it, never read
             it: `ls infra/lib/*-stack.ts | wc -l` → 12.
             🛑 **IT ANSWERS A SENTENCE `EDGE_APEX_IS_SERVED_ELSEWHERE` HAS
             CARRIED SINCE 19 Sep 2026 AND DOES NOT MAKE IT FALSE.** That
             constant says the apex is *"not the `Edge` stack's"*, and G298
             confirmed the narrow reading of G297's *"flat apex"*; this stack
             is the ELSEWHERE. **The apex does not collide with the
             `*.reconcileai.app` sinkhole, for the one fact G297's whole
             argument rests on: a wildcard matches exactly ONE label**, so the
             flat wildcard covers `console.` and `ten-acme.` and covers the
             apex not at all — in DNS and in TLS alike. Amplify therefore
             issues a **THIRD certificate**, for one name, in a region it
             chooses, and neither `EdgeCertificate` stack knows about it.
             🛑 **THE APEX A RECORD IS NOT IN THE TEMPLATE AND CANNOT BE, AND
             THAT IS A MEASUREMENT: `AWS::Amplify::Domain` PUBLISHES NO
             DISTRIBUTION DOMAIN AND NO HOSTED-ZONE ID** — its attributes are
             `Arn · AutoSubDomainCreationPatterns · AutoSubDomainIamRole ·
             Certificate · CertificateRecord · DomainName · DomainStatus ·
             EnableAutoSubDomain · StatusReason · UpdateStatus` — and an apex
             must be an ALIAS, because a CNAME at a zone apex is forbidden.
             **Amplify writes the records into `Z04053259WLMQJTR30EU` itself**,
             and a second writer of one record name is the G297 Route 53 race
             this product has already paid for once (*"both reported success.
             The A record was GONE afterwards"*). The absence is asserted and
             the domain's state is OUTPUT.
             🛑 **TWO REWRITES, AND ONE IS NARROWER THAN THE SLICE WAS ASKED
             FOR.** `/demo/intake` → an intake Lambda; `/session/realm` →
             `https://console.reconcileai.app/session/realm` **and NOT
             `/session/*`**. A 200 rewrite is invisible to the browser, so
             every cookie on the exchange is the APEX'S — and
             `completeFederatedSignIn` MINTS a session, which would bind
             `__Host-reconcile_session` to `reconcileai.app` and then be
             REVOKED by G180's `checkHostBinding()` at the real host on the
             next request. `resolveHomeRealm` is the one session-tier
             operation that mints nothing, sets no cookie, reads no cookie and
             *"is never GIVEN a user to look up"*.
             ⚠️ **AND THE TARGET REACHES NO PLANE TODAY** — `edge-stack.ts`
             measures the console distribution at `CacheBehaviors.Quantity: 0`
             — so the rewrite is CORRECT and INERT until a sibling slice gives
             it a data-plane origin.
             🛑 **NO REPOSITORY, NO TOKEN, NO WEBHOOK, AND THAT DEPARTS FROM
             `ci-image-stack.ts`'s PRECEDENT ON A MEASUREMENT:
             `AWS::Amplify::App` HAS NO CODECONNECTIONS PROPERTY AT ALL.** AWS
             documents its two token fields as *"the **personal access token**
             for a GitHub repository"*, which is the shape `connections.ts`
             records G263 as forbidding — and **there is no marketing
             repository to connect**: `1CloudHub/Reconcile` builds the
             APPLICATION SHELL, and pointing the apex at that is precisely
             what `EDGE_APEX_IS_SERVED_ELSEWHERE` exists to forbid. Manual
             deploy, `aws amplify start-deployment`, no credential anywhere.
             🛑 **THE PARAGRAPH BELOW WAS FALSE FOR HALF A DAY AND IS
             CORRECTED RATHER THAN DELETED — G2001, 22 Sep 2026 — BECAUSE IT
             IS THE SENTENCE FIVE FILES CARRIED AND THE ONE A READER WOULD
             HAVE QUOTED ONWARD.** IT READ: *"🛑 REFERRAL-CODE VALIDITY
             CANNOT LEAK BECAUSE IT IS NEVER EVALUATED: the intake forwards
             the code to the CRM as an opaque string and the match happens in
             the STAFF CONSOLE, which is where the pack puts it. The
             enforcement is a SIGNATURE — `ACCEPTED` is a frozen constant
             taking no argument — and `tests/infra/demo-intake.test.mjs`
             drives two codes through the whole function and requires
             byte-identical answers."*
             🛑 **THE FIRST CLAUSE IS TRUE AND DOES NOT IMPLY THE SECOND. THE
             FUNCTION DID NOT EVALUATE THE CODE AND LEAKED IT ANYWAY, BY
             ASKING SOMETHING THAT DOES**: `deliver()` returned `ACCEPTED`
             iff the CRM answered `2xx`, so against a CRM that 404s an
             unknown code and 409s a duplicate lead the endpoint answered
             `PARTNER-ACME-2026` → **202** and `GUESS-0001` → **502**, at a
             public URL with no credential. **A frozen constant cannot make a
             claim about the answer, because the answer is the CHOICE OF
             WHETHER TO RETURN IT.** ⚠️ **AND BOTH CONTROLS PASSED**: the
             two-code test used a double answering `201` to BOTH, and the
             refusal-code tripwire greps `referral|company|email|domain|
             partner` while the leak arrived through `crm_unavailable`.
             §5.1 twice, inside the controls written against it.
             ✅ **WHAT HOLDS IT NOW IS CONTROL FLOW: `deliver()` HAS ONE
             `return` AND NO `throw`** — the CRM is attempted, its outcome is
             reported to the log and to a metric, and `ACCEPTED` is returned
             on every path. Derive it, never read it:
             `grep -c 'return ACCEPTED' infra/lambda/demo-intake/index.mjs`
             → 1, and `grep -c 'throw' infra/lambda/demo-intake/index.mjs`
             inside `deliver` → 0. The double now REFUSES one of the two
             codes, and a second assertion drives **every status 100–599**
             plus a dead socket and requires ONE answer.
             ⚠️ **WHAT IS NOT CLOSED AND IS NAMED: LATENCY (G2007).** The
             status no longer varies; the time to it still does. The repair
             is a queue and it is an OWNER'S RULING.
             ✅ **CLOSED BY G3681, 3 Oct 2026 — THE OWNER'S: *"Queue it: the
             intake enqueues and returns immediately; a worker delivers to
             the CRM. Constant-time answer."*** The sentence above is kept
             as it stood. The intake now holds `sqs:SendMessage` alone and
             answers before the CRM is touched; `demo-intake/worker.mjs`, on
             an SQS event source with a dead-letter queue, is the only code
             that reads the CRM secret. ⚠️ **AND AN UNCONFIGURED SECRET IS
             NOW A 202 TO THE VISITOR AND A LOUD WORKER** (G3685), with a
             DLQ redrive as the person step — `docs/build/deploy-handoff.md`
             §27.
             ⚠️ **NO CRM CREDENTIAL IS IN THE TREE AND THE SECRET IS CREATED
             EMPTY**, so every intake answers `crm_not_configured` with a 502
             until a person runs one `put-secret-value` — `Observability`'s
             `AlarmsPageNobodyUntil` shape. ⚠️ **AND THERE IS NO WAF AND NO
             RATE LIMIT** on an unauthenticated public POST; the closed field
             set, the per-field caps, the 8 KiB body cap and a reserved
             concurrency of 5 are the only fences it has, and that is named
             rather than implied.
             🛑 **AND THE REAL BOUND IS NOT THE ONE THAT SENTENCE IMPLIES —
             G2015, 22 Sep 2026.** COMPUTE is genuinely capped at ~**$44 a
             month** at saturation, and that is the part the row got right.
             **What it omits is the two axes reserved concurrency does not
             bound at all:** ① **the CRM**, which at five concurrent
             invocations against a ~100 ms responder takes **≈4.3M junk
             leads a day** — and the HEALTHIER the CRM the more it takes,
             because the bound is OUR concurrency over THEIR latency; and
             ② **availability, for about FIFTY concurrent connections from
             one host** — the sixth simultaneous request is throttled by
             Lambda and answered with a **raw AWS 429**, a body this
             repository did not write carrying a code in **no `errors.yaml`
             enum**. **Raising the concurrency trades ② for ①**, which is why
             the repair is a rate limit and not a number.
             ✅ **AND THE INTAKE IS ALARMED SINCE 22 Sep 2026 — G2006.**
             ⚠️ **THIS ENTRY SAID *"no alarm on the intake (G1976)"* AND IT
             IS CORRECTED RATHER THAN DELETED.** 🛑 **IT IS NEEDED MORE THAN
             G1976 KNEW: `handler()` CATCHES, so a dropped lead is a
             SUCCESSFUL invocation and `AWS/Lambda Errors` reads 0** — no
             built-in metric can see it, and after G2001 the visitor is told
             `received` either way, so this is the ONLY signal there is.
             🛑 **WHERE IT LIVES WAS DECIDED BY A CONTROL RATHER THAN BY THE
             SLICE.** The first draft put the alarm in `amplify-stack.ts`,
             reaching the topic by a SPELLED ARN so that no export was
             minted — and `tests/infra/observability.test.mjs`'s
             `test_no_other_stack_in_the_app_declares_an_alarm` **went RED**:
             *"alarms are declared in the Observability stack. A second home
             for them is §5.3."* **The alarm moved rather than the
             assertion**, and that suite's alarm CENSUS then caught it
             arriving untested — the second time in two days (G1283 was the
             first). Neither control was relaxed.
             ⚠️ **SO THE FILTER IS IN `Amplify`, WITH THE LOG GROUP IT
             READS, AND THE ALARM IS THE TENTH IN `Observability`** — each
             half with the thing it cannot be separated from, and no
             coupling either way, because an alarm needs a namespace and a
             metric NAME and both are constants.
             ⚠️ **IT STILL PAGES NOBODY** (G1062, R-F), asserted at zero
             subscriptions rather than assumed.
             ⚠️ **IT TOUCHES `Planes`, `Network` AND `Edge` IN NO WAY** — and
             unlike `Storage` and `RunQueue` that independence costs nothing,
             because the only thing it reaches outside itself is a HOSTNAME.
             **MEASURED: ALL ELEVEN pre-existing staging templates are
             BYTE-IDENTICAL before and after.**
             ⚠️ **AND IT IS TEN SINCE 22 Sep 2026, NOT ELEVEN — G2006 —
             AND THE SENTENCE ABOVE IS CORRECTED RATHER THAN DELETED BECAUSE
             IT IS THE SLICE'S OWN HEADLINE PROPERTY.** `Observability` gains
             ONE alarm, on `Reconcile/DemoIntake:CrmDeliveryFailed`, because
             **G261 puts every alarm there and
             `tests/infra/observability.test.mjs` REFUSED the draft that put
             it in `Amplify`** — the alarm moved rather than the assertion.
             🛑 **IT IS NOT A COUPLING REGRESSION AND THAT IS MEASURED RATHER
             THAN ARGUED: ONE resource added to each of the two templates,
             ZERO exports minted in either direction, and no new
             `Fn::ImportValue` anywhere.** An alarm needs a NAMESPACE and a
             metric NAME, both constants in `lib/config.ts`, so neither stack
             references a construct in the other. **The other TEN are
             byte-identical.**
             ⚠️ **`www.reconcileai.app` IS NOT SERVED and falls into the `Edge`
             flat sinkhole, so it resolves and is then REFUSED AT THE TLS
             HANDSHAKE** — for a marketing site the worst of the three possible
             answers. Adding it is one `subDomainSettings` entry and one
             decision that is marketing's, under G180's permanence.
             ⚠️ **AND `PLANES` GAINS A SIXTH MEMBER, `public`** — the pack's
             own *"third plane the architecture documents do not describe"*.
             `edge` would say it belongs to the `Edge` stack's fleet and
             `shared` would say it serves both planes; both are false
             statements in the one field G260 says invariant 3 is audited from.
             ⛔ **THE ENTRY BELOW SAID ELEVEN AND IS KEPT AS THE HISTORY IT IS,
             because it is correct about its own stack and its `→ 11` is the
             number a reader would otherwise have quoted onward:**
             THE ELEVENTH IS `RunQueue`
             (R-B, G1201/G1204) — ONE SQS queue, ONE dead-letter queue with a
             redrive policy, and ONE identity policy granting the data plane's
             serving task role `sqs:SendMessage` BY NAME. Derive it, never
             read it: `ls infra/lib/*-stack.ts | wc -l` → 11.
             ⚠️ **STILL ELEVEN AFTER D6-4, 22 Sep 2026 — G1871–G1875, THE
             OWNER'S RATE-LIMITING RULING — AND THAT IS NAMED RATHER THAN
             LEFT FOR THIS LINE TO BE MISREAD AS UNSWEPT.** A
             `wafv2.CfnWebACL` closing (part of) `docs/build/d6-threat-model.md`
             §4.5's pool-exhaustion finding lives INSIDE `EdgeCertificateStack`
             — no new `*-stack.ts` file — because a `Scope: CLOUDFRONT` WebACL
             MUST be created in `us-east-1`, exactly the region argument that
             already put the two viewer certificates in that stack rather than
             in `Edge`. Derive it again to confirm: the command above still
             returns 11.
             ✅ **IT GRANTS `sqs:ReceiveMessage` AND `sqs:DeleteMessage` TO
             ONE ROLE SINCE 21 Sep 2026 — R-W, THE OWNER'S RULING — AND THE
             PARAGRAPH BELOW IS CORRECTED RATHER THAN DELETED, because it is
             the sentence four files carried and the one that named its own
             successor** (*"the receive grant lands in the commit that deploys
             one"*). **THE STACK COUNT DID NOT MOVE AND IS STILL 11**: R-W is
             a scheduled ECS task INSIDE `RunQueue`, so no `*-stack.ts` file
             was added. Derive it, never read it —
             `ls infra/lib/*-stack.ts | wc -l` → 11 — **and this line is named
             as UNSWEPT rather than swept, which is not the same as a sweep
             that found nothing to do.**
             🛑 **THE ROLE IS THE WORKER'S OWN AND THAT IS THE WHOLE SECURITY
             CONTENT OF THE SLICE (G1542): a shape that granted receive to
             `reconcile-staging-data-service-task` WOULD LET A REQUEST PATH
             DRAIN THE QUEUE** — take an admitted run off it and delete it,
             with the gate, the policy and invariant 10's record each logging
             the act as correct. The cheap shape (schedule the EXISTING data
             plane task definition with a command override) is REFUSED for
             exactly that, and **three assertions in
             `tests/infra/run-queue.test.mjs` §4 were witnessed RED against
             it** rather than the refusal being asserted.
             🛑 **AND IT DRAINS THE QUEUE WITHOUT EXECUTING A RUN.** The
             worker claims, reads and reports; `runSetReconciliation()` has no
             caller anywhere. **Do not price one as the other** — the stack
             OUTPUTs that sentence rather than leaving it to be inferred.
             ⚠️ **NOTHING IS DEPLOYED BY ANY OF THIS AND THE NARROW CLAIM
             SURVIVES: `run-worker-main.ts` STILL RUNS NOWHERE IN AWS.** This
             slice is code and `cdk synth`; a synthesised schedule is not a
             running task, and **the image the fleet runs contains no
             `server/data-plane/run-queue.ts` at all** (G1285), so the first
             tick would fail to resolve its own entry point until D-2 rebuilds
             one. THE ORIGINAL PARAGRAPH FOLLOWS:
             🛑 **IT GRANTS NOBODY `sqs:ReceiveMessage`, AND THAT IS THE ROW TO
             READ (G1204): nothing in this account runs the worker**, and a
             permission with no holder is `0004`'s *"a write privilege ahead
             of its writer"* arriving in IAM. Three process shapes are named
             on the stack's face with their costs; choosing one is a person's.
             ⚠️ **IT TOUCHES `Planes` IN NO WAY** — the same constraint
             `Observability` records, for the same reason: CDK mints a
             cross-stack export per attribute READ, and an export on `Planes`
             is a `Planes` deploy (G1012). The join is
             `iam.Role.fromRoleName()`, `Storage`'s precedent. **MEASURED: the
             synthesised `Planes`, `Network`, `Edge`, `Storage`,
             `Observability` and `Data` templates are BYTE-IDENTICAL before
             and after.**
             ⚠️ **AND NOTHING DEPLOYED READS ITS URL (G1205)**: wiring
             `RECONCILE_RUN_QUEUE_URL` into `Planes`' task definition is a
             `Planes` deploy and is left to a person, so a run admitted in
             staging is published NOWHERE and the plane says `run queue
             ABSENT` in its own start-up line.
             ✅ **THE WIRING IS WRITTEN — G1281, 20 Sep 2026 — AND THE
             SENTENCE ABOVE IS CORRECTED RATHER THAN DELETED, because it is
             the one G1205 put in four files and the one a reader would have
             quoted onward.** `infra/lib/planes-stack.ts` sets
             `RECONCILE_RUN_QUEUE_URL` from `runQueueUrl()` — spelled from the
             account, the region and the queue NAME, **never imported**,
             because `RunQueue` already joins `Planes` by name and the
             opposite edge would make the pair a DEPLOY-ORDER DEADLOCK on any
             account where neither is deployed. ⚠️ **AND `Planes` GAINS NO
             OUTPUT AND NO EXPORT** — measured, 17 → 17, exports identical —
             so G1012's constraint holds and `Edge` and `Observability` need
             no redeploy.
             🛑 **BUT "NOTHING DEPLOYED READS IT" IS STILL EXACTLY TRUE AND
             WILL BE UNTIL AN IMAGE IS REBUILT — G1285.** The fleet runs
             `56d9d053269f0bea14d74344f3e01b4b0f330148` (read back from the
             service's own task definition, revision 39) and **that commit
             contains no `server/data-plane/run-queue.ts` at all**. Derive it,
             never read it: `git ls-tree -r --name-only
             56d9d053269f0bea14d74344f3e01b4b0f330148 -- server/data-plane/`
             and look for the file. **A deployed task definition and a
             deployed IMAGE are two facts, and nothing in `npm run check` can
             compare either to a running service.**
             🛑 THE TENTH IS `Observability` — THIS SAID NINE UNTIL 20 Sep 2026, when G1061's
             `Observability` LANDED AND CLOSED THE LAST NAME IN THE
             "still absent" LIST THIS ENTRY HAS CARRIED SINCE 18 Sep 2026:
             ONE SNS topic, EIGHT alarms, FOUR EventBridge rules and VPC flow
             logs. Derive it, never read it:
             `ls infra/lib/*-stack.ts | wc -l` → 10, and
             `grep -rln 'Alarm' infra/lib/` — which returned NOTHING until
             that commit.
             ✅ **R14 IS TAKEN — G1811, 22 Sep 2026, THE OWNER'S: "Use a
             placeholder email address that must be replaced before
             production." THE SENTENCE BELOW IS CORRECTED RATHER THAN
             DELETED**, because it is the sentence `tests/infra/
             observability.test.mjs` was armed on and the one a reader would
             have quoted onward. IT READ: *"🛑 THE TOPIC HAS NO SUBSCRIPTION
             AND THEREFORE PAGES NOBODY (G1062), which is stated on the
             stack's face, OUTPUT by the stack as `AlarmsPageNobodyUntil`, and
             pinned by an assertion the subscribing commit must DELETE. Who is
             paged is an OWNER'S RULING; `docs/tech-stack.md` §14 already
             carries `Owner` as a placeholder."*
             🛑 **THE TOPIC NOW CARRIES EXACTLY ONE SUBSCRIPTION — A
             PLACEHOLDER EMAIL ADDRESS, MARKER-ASSERTED — AND STILL PAGES
             NOBODY, FOR A DIFFERENT REASON.** SNS cannot auto-confirm an
             email subscription, so it sits `PendingConfirmation` until an
             inbox at that address clicks the confirmation link, and this
             address is not a real inbox. The old pinned-zero test is
             DELETED, deliberately, exactly as its own comment demanded; what
             replaces it asserts EXACTLY one subscription, EMAIL protocol,
             and the literal marker `PLACEHOLDER-REPLACE-BEFORE-PRODUCTION`
             on the endpoint, so a real address landing without deleting the
             marker — or the marker being deleted without a real address — is
             a red gate either way. The stack now OUTPUTs
             `AlarmsPageAPlaceholderUntil` in place of `AlarmsPageNobodyUntil`,
             because the old name would now be a false claim.
             🛑 IT ADDS NO OUTPUT TO `Planes` AND THAT IS A CONSTRAINT RATHER
             THAN A STYLE — CDK mints a cross-stack export PER ATTRIBUTE READ,
             and a new export on `Planes` is a `Planes` DEPLOY, which G1012
             and G1013 measure as rolling both planes back to an image ECR has
             EXPIRED. So the ECS names come from the NAMED exports and the ALB
             dimension is derived from the ALREADY-EXPORTED ARN with
             `Fn::Select`/`Fn::Split` rather than from `loadBalancerFullName`.
             MEASURED: the synthesised `Planes`, `Network` and `Edge`
             templates are BYTE-IDENTICAL before and after.
             ⚠️ THE CONTROL PLANE'S ALB GETS NO ALARM AND THAT IS CORRECT
             (G1066): its ingress list is `[]`, so it emits no `RequestCount`
             at all and an alarm there would read OK for ever — green by
             unavailability, inside the stack built to end it. Its SERVICE and
             its CLUSTER are alarmed.
             ✅ **THE LOGGER IS ON SINCE 21 Sep 2026 — G1391–G1396, AND
             G1067 IS DISCHARGED. THE SENTENCE BELOW IS CORRECTED RATHER THAN
             DELETED**, because it is the one four files carried and the one a
             reader would have quoted before concluding a 5xx could not be
             explained. IT READ: *"⚠️ `server/http/app.ts` STILL SETS
             `logger: false`, so an alarm on 5xx has no structured log to
             explain one — G1067, ⛔ NOT APPLIED and owed."*
             🛑 **ITS REASON IS UNCHANGED AND IS WHY THE REPAIR IS A MODULE
             RATHER THAN A BOOLEAN**: Fastify's DEFAULT `req` serializer logs
             `req.url` and a url carries the QUERY STRING, which G261 §12.1
             forbids by name — and it also logs `req.host`, which resolves to
             a TENANT under G179/G180, and on a 500 `err.message`/`err.stack`,
             where a `pg` failure's `detail` is a ROW VALUE. Both planes now
             log through `loggerOptions(plane)` from
             `server/http/log-allow-list.ts`.
             🛑 **AND THE TRIPWIRE THAT SENTENCE POINTED AT DID NOT FIRE —
             G1392, AND IT IS THE FINDING RATHER THAN THE FIX.** It said
             *"a tripwire in `tests/infra/observability.test.mjs` §9 makes the
             commit that turns it on meet that rule at a red assertion."* **It
             met no red.** The assertion was
             `assert.match(source, /logger:\s*false/)` and it PASSED against the
             commit that turned the logger on — satisfied by two PROSE
             COMMENTS narrating the history, with the live setting three hundred
             lines below — and passed again against a deliberately bad
             implementation keeping `headers`. **A grep cannot tell code from a
             sentence about code**: §5.1, in the one control written to keep
             this slice honest. The replacement asks about the CONTRACT and
             reads the AST, because comments are not nodes.
             ⚠️ **AND ONE CHANNEL IS STILL UNGOVERNED (G1395):**
             `console.error` is not the logger, and roughly twenty call sites
             under `server/data-plane/` reach the same CloudWatch stream through
             no serializer at all. ⚠️ AND G260's AWS Config half is STILL not built
             (G1068): a Config rule with no account-wide configuration
             recorder evaluates nothing and reads as enforcement.
             ⛔ **AND IT NEVER WILL BE — R15, 1 Oct 2026, THE OWNER'S (G2441):
             *"No account-wide AWS Config recorder."*** The sentence above
             said *"STILL not built"*, which reads as owed; it is kept and is
             no longer a backlog. **No AWS Config rule exists in this app BY
             DECISION**, tag enforcement is the synth-time Aspect plus its
             tests, and `docs/build/completion-plan.md` D-5 is CLOSED AS
             DECLINED.
             🛑 THE ENTRY BELOW SAID NINE STACKS AND IS KEPT AS THE HISTORY IT
             IS — 🛑 THIS SAID EIGHT UNTIL 19 Sep 2026, when G302's
             `Identity` LANDED: COGNITO AS A **BROKER** FOR EXTERNAL IdPs, with
             ZERO identity providers, so NOBODY CAN SIGN IN AND THAT IS THE
             DEPLOYED STATE. Verified against AWS rather than the template —
             `GET /login` on the hosted UI is a 302 to `/error`, an account
             admin holding a native user's own permanent password is refused
             `Auth flow not enabled for this client`, and `SignUp` is
             `NotAuthorizedException`. ⚠️ NATIVE USERS ARE NOT IMPOSSIBLE AND
             THE STACK SAYS SO IN CAPITALS: a user pool IS a directory. They
             are unreachable at three fences and the load-bearing one is
             `server/data-plane/identity.ts`, not `infra/` — a native user has
             no `tenant.identity_connection` row, so `orgFor()` has nothing to
             derive from and the refusal is `owner_unresolvable`.
             ⚠️ THIS SAID SIX UNTIL 19 Sep 2026, when G293's
             `Edge` and `EdgeCertificate` landed. ⚠️ AND THIS SENTENCE READ
             "ONE CloudFront distribution, a wildcard cert over
             `*.reconcileai.app`" UNTIL G297 THE SAME DAY. IT IS CORRECTED
             RATHER THAN DELETED: TWO distributions and TWO certificates —
             `*.us-west-2.reconcileai.app` for TENANTS,
             `*.reconcileai.app` for the CONSOLES — with the data plane as a
             SECOND ORIGIN on the tenant one through a CloudFront VPC ORIGIN so
             both ALBs stay internal. Derive it, never read it:
             `grep -c 'new cloudfront.Distribution' infra/lib/edge-stack.ts` → 2. 🛑 THE CERTIFICATE IS ITS OWN STACK AND ITS OWN REGION —
             `us-east-1`, because CloudFront reads viewer certificates from no
             other one, which is the ONE exception to G256's refusal of that
             region and is argued as one rather than taken quietly.
             `CiImage` (G258), `Pipeline` (G257), `Network`
             (G253), `Data` (G254), `Planes` (G253) and — 19 Sep 2026 —
             `Storage` (G287, one object bucket per data plane, SSE-KMS,
             per-tenant key — and since 19 Sep 2026 G290's KEY-MINTING LAMBDA,
             the first and only code this app deploys: `kms:CreateKey` and
             deliberately NOT `kms:ScheduleKeyDeletion`; the bucket-policy loop
             does NOT close and the stack says so on its face).
             ⚠️ THIS SAID "FOUR" AND THE COMMAND BELOW ALREADY
             RETURNED 5 BEFORE THIS COMMIT TOUCHED THE DIRECTORY: `Planes` was
             written AND instantiated and nothing here followed it. The 5 was
             not this slice's to make stale and is named so the sweep is not
             read as accounting for both. ⚠️ THIS SAID "TWO STACKS, AND ONLY TWO"
             AND LISTED `Network` AND `Data` AMONG FIVE THAT WERE "NOT WRITTEN —
             blocked on G277's organisation-scoped console host and G276's BYOA
             shape". IT IS CORRECTED RATHER THAN DELETED, and the sharper half
             of the correction is that NEITHER WAS EVER BLOCKED ON EITHER
             QUESTION — five stacks were swept under one blocker and two of them
             did not belong there. Derive it, never read it:
             `ls infra/lib/*-stack.ts | wc -l` → 9. ⚠️ THIS SAID 8 UNTIL
             G302's `Identity` LANDED THE SAME DAY, and the 8 was correct when
             written — which is the whole reason the command sits beside it.
             ✅ `Observability` IS WRITTEN SINCE 20 Sep 2026 — G1061. ⚠️ THIS
             SENTENCE READ "🛑 `Observability` IS still NOT WRITTEN" AND IS
             CORRECTED RATHER THAN DELETED, because it is the sentence four
             files carried and the one that told a reader the product's
             staging environment could page nobody. **It was TRUE for two
             days and it is the LAST of the five names this entry has been
             correcting one at a time since 18 Sep 2026.** ⚠️ AND IT WAS
             NEVER BLOCKED ON G277 OR G276 EITHER, which is the fifth time
             that sweep has had to say so: the original sentence put five
             stacks under two blockers and only `Edge` ever belonged there.
             ⚠️ THIS SENTENCE ALSO READ
             "`Edge` and `Observability` ARE still NOT WRITTEN and the two
             blockers above are unchanged for them" AND THE `Edge` HALF WENT
             FALSE ON 19 Sep 2026 — it is corrected rather than deleted,
             because it is the sentence that told a reader the product had no
             way to reach a browser. `Edge` WAS genuinely blocked, on G277's
             "the consoles have no host at all", and the block was lifted by
             the OWNER NAMING THE HOSTS — console.reconcileai.app and
             partners.reconcileai.app — not by anybody deciding it did not
             matter. G276's BYOA shape is untouched and blocks nothing here.
             ⚠️ THIS SENTENCE ALSO NAMED
             `Planes` AMONG THEM AND WAS ALREADY FALSE — it is written,
             instantiated and DEPLOYED. `Storage` was never blocked on either
             question either: G287 is an object-storage ruling, and G277's
             console host was `Edge`'s blocker, not this one.
             ✅ AND G293's WILDCARD COLLIDED WITH G179's HOST GRAMMAR AND THE
             OWNER RULED — G297, 19 Sep 2026, APPLIED AND DEPLOYED. ⚠️ THIS
             PARAGRAPH READ "The flat grammar is implemented because it is what
             G293 says; the owner owes a ruling" AND IS CORRECTED RATHER THAN
             DELETED, because it is the sentence a reader would have trusted
             and because G293's flat decision was taken DELIBERATELY: this is
             an AMENDMENT, not a mistake erased. A wildcard matches EXACTLY ONE
             LABEL, so `*.reconcileai.app` covers `<tenant>.reconcileai.app`
             and covers no `{tenant}.{region}.{domain}` host at all. TENANTS
             ARE NOW `{tenant}.us-west-2.reconcileai.app` under
             `*.us-west-2.reconcileai.app`, and THE CONSOLES STAY FLAT because
             a console has no tenant and a region label on one would assert a
             residency invariant 3 says the control plane does not have.
             🛑 THE PROPERTY, WITNESSED FROM AWS AND NOT FROM A TEMPLATE:
             `ten-acme.reconcileai.app` RESOLVES, CONNECTS ON 443, AND IS
             REFUSED AT THE TLS HANDSHAKE WITH NO CERTIFICATE OFFERED AT ALL —
             residency held at the TRANSPORT layer rather than by an
             application check. Reproduce it:
             `openssl s_client -connect 13.33.88.20:443 -servername ten-acme.reconcileai.app`
             → `alert handshake failure` · `no peer certificate available`.
             🛑 WHAT G297 DOES NOT CLOSE: the MINT-TIME RULE on the tenant slug
             that G179 asks for STILL DOES NOT EXIST in `model/`. It is now
             WEAKER — the grammars no longer share a namespace, so a tenant
             slugged `console` no longer takes the staff console's host — and
             it is STILL OWED, because G36/G276's BYOA and vanity domains put a
             customer back into a flat namespace under G180's permanence.
             `Data` PINS THE AURORA ENGINE AT 17.9 and records the
             `describe-db-engine-versions` run it came from, which is G254's
             PRECONDITION on this slice and G177's STANDING VERIFICATION
             discharged. IN THE GATE TWICE: `typecheck:infra` and `synth:infra`.
             🛑 THIS READ "NOTHING IS DEPLOYED. `no AWS resource has been
             created` is STILL EXACTLY TRUE at this commit — a stack that
             synthesises is not a stack that exists". BOTH SENTENCES ARE FALSE
             AND ARE CORRECTED RATHER THAN DELETED, because the second is the
             one narrow claim this page has protected since 6 Aug 2026 and a
             reader would have quoted it onward. ⚠️ IT WENT FALSE BEFORE THIS
             COMMIT, NOT IN IT: `docs/build/deploy-handoff.md` §2 records SIX
             stacks live in `000000000000` / `us-west-2` on 18 Sep 2026, both
             planes ACTIVE and answering their health checks. This commit adds
             a SEVENTH, `reconcile-storage-staging`. Derive it, never read it:
             `AWS_PROFILE=crm-frontend aws cloudformation list-stacks
             --region us-west-2 --stack-status-filter CREATE_COMPLETE
             UPDATE_COMPLETE --query
             'StackSummaries[?starts_with(StackName,\`reconcile\`)].StackName'`
             ⛔ **THAT CONTROL ENDED ON 20 Sep 2026 AND THE SENTENCE BELOW IS
             CORRECTED RATHER THAN DELETED, BECAUSE IT IS THE ONE THIS PAGE HAS
             PROTECTED SINCE 22 Aug 2026 AND THE ONE A READER WOULD HAVE QUOTED
             ONWARD.** It read: *"✅ WHAT DOES SURVIVE, AND IT IS G212's OWN
             CONTROL RATHER THAN A CLAIM ABOUT THE ACCOUNT:
             `grep -c 'aws-sdk' package.json` → 0. The root manifest still
             holds no AWS SDK."* **It returns 1.** R-C, 20 Sep 2026, THE
             OWNER'S RULING: `@aws-sdk/client-sqs` is taken, pinned exact under
             G191, server-only, for R-B's run queue — and **G212 is DISCHARGED
             BY ITS OWN CONDITION, not overturned**: that row says the SDK is
             revisited *"when an actual AWS resource exists — which is a fact
             about the account, not about the code, and so is checkable rather
             than arguable"*, and NINE top-level stacks are live. Verify it
             read-only:
             `AWS_PROFILE=crm-frontend aws cloudformation list-stacks
             --region us-west-2 --stack-status-filter CREATE_COMPLETE
             UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE --query
             'StackSummaries[?starts_with(StackName,\`reconcile\`) && ParentId==null].StackName'`
             ✅ **WHAT REPLACES IT IS NARROWER AND IS STILL ONE COMMAND**, and
             the ASSERTION that made the old one real is REPLACED rather than
             removed — a control deleted when it fires is not a control:
             **exactly one `@aws-sdk/*` package, pinned exact**,
             `tests/infra/manifest.test.mjs`, plus a SERVER-ONLY fence at
             `tests/ci/aws-sdk-scope.test.ts` (`model/`, `tools/`, `frontend/`
             and `db/` may not import one, and exactly ONE file under `server/`
             may). ⚠️ **TWO PACKAGES AND ONE FILE PER CLIENT SINCE 1 Oct 2026 —
             G2404, under the owner's G2401; the command below now answers
             `[ '@aws-sdk/client-secrets-manager', '@aws-sdk/client-sqs' ]`.**
             Derive it, never read it:
             `node -e "console.log(Object.keys(require('./package.json').dependencies).filter(d=>d.startsWith('@aws-sdk/')))"`
             ⚠️ AND THE SECOND PROPERTY ENDED WITH IT: `npm ci --omit=dev` no
             longer produces a container holding the driver and no compiler AND
             NOTHING ELSE — it installs 25 more packages, all of them the
             client's transitive closure, and the `Dockerfile` header says so
             in its own voice. **The `no compiler` half is unchanged**
⛔ .github/  RETIRED 18 Sep 2026 — **THE DIRECTORY IS ABSENT FROM THIS TREE.**
             ⚠️ **THIS LINE READ *"workflows/check.yml — `npm ci` then
             `npm run check`, nothing else"* IN THE PRESENT TENSE UNTIL
             21 Sep 2026 AND IS CORRECTED RATHER THAN DELETED (G1331)**,
             because it is the layout block — the place a reader looks to
             learn what the repository CONTAINS — and it named a directory
             that is not here. Derive it, never read it: `ls -la .github`.
             🛑 **`tests/ci/gate.test.ts` ASSERTS ITS ABSENCE BY NAME** and
             says why in its own voice: *"two gates are two definitions of
             green (G108), and this one targeted a self-hosted runner that no
             longer exists, so it queued forever rather than failing."*
             ⚠️ **WHAT REPLACED IT IS NOT IN THIS TREE EITHER — IT IS IN AN
             AWS ACCOUNT**: the CodePipeline **Gate** stage,
             `reconcile-gate-staging` in `000000000000`/`us-west-2`
             (`infra/lib/pipeline-stack.ts`), whose two inherited assertions
             live at `tests/infra/pipeline.test.mjs`
             (`test_the_gate_build_phase_is_exactly_npm_ci_then_npm_run_check`
             and `test_no_gate_setup_command_checks_anything_it_only_boots_the_image`).
             🛑 **AND NOTHING CHECKS A PULL REQUEST UNLESS SOMEBODY TURNED IT
             ON**: `reconcile-gate-pr-<env>` is behind `-c pullRequestGate=on`,
             **DEFAULT OFF**, and `infra/lib/pipeline-stack.ts` says so in
             capitals — *"WITH THE FLAG OFF NOTHING CHECKS A PULL REQUEST."*
             **That is a fact about the account, not about this tree, and no
             command in `npm run check` can answer it.**
assets/      one brand asset
PRODUCT.md CLAUDE.md README.md
```

> ⚠️ **This block listed `tools/` as *"planner/extract.mjs · check-doc-counts.mjs"*
> and had no `db/` and no `.github/` line at all until 10 Aug 2026.** Two checkers
> it never named — `check-wire-mirror.mjs` and `check-pack-safety.mjs` — were
> already in `npm run check`. `tools/check-doc-counts.mjs` **cannot catch this
> class**: an omission has no number in it, which is the same failure that hid
> `Mockups/rec/` below.

> 🛑 **AND IT HAPPENED AGAIN, LARGER, ON 16 Aug 2026 — THIS BLOCK HAD NO
> `server/`, NO `compose.yaml`, NO `Dockerfile`, NO `design/`, NO `DESIGN.md` AND
> NO `.impeccable/` LINE.** `git ls-files | awk -F/ '{print $1}' | sort -u`
> returned **21** top-level entries when this banner was written, and returns
> **19** at 19 Sep 2026 — ⚠️ **the figure is left in the past tense rather than
> swept in place, because the banner is a statement about the tree of
> 16 Aug 2026 and G264 has since deleted `design/`, `Mockups/`, `DESIGN.md` and
> `.impeccable/` while `infra/` arrived. Run the command; every arithmetic
> sentence below that rests on 21 is history, not a current claim.** This
> block named **twelve**. Of the nine it
> did not name, two are noise (`.gitignore`, `package-lock.json`) and **seven are
> substantive — and one of the seven is an application**. **The omissions are the exact
> class the paragraph above says the checker cannot catch, arriving a second time
> and bigger** — `tools/check-doc-counts.mjs` was EXIT 0 on this page the whole
> time, because an absent directory has no number in it. The two lines that were
> not merely absent but **false** are corrected in place and named here so the
> correction is not silent:
>
> - `package.json typescript@5.9.3 · @types/node (G96)` — it now also carries
>   **three runtime `dependencies`**, `fastify` 5.12.5 (⚠️ **this said 5.12.0
>   until 19 Sep 2026** — two advisories, a schema-validation bypass via root
>   primitive coercion and `X-Forwarded-*` spoofing under `trustProxy`
>   hop-count, both landing on what G191 makes load-bearing), `pg` 8.23.0 and
>   `yaml` 2.9.0, all pinned exact under G191. Derive it: `node -e
>   "console.log(require('./package.json').dependencies)"`.
> - `` `pg` is NOT in package.json `` — **that is now flatly wrong**, and it is
>   corrected at length in *Writing code that touches the database*, below, where
>   it was the load-bearing caveat on what a green `npm run check` proved.

> ⚠️ **This block said *"no test framework configured"* and *"one dependency:
> typescript@5.9.3"* until 8 Aug 2026 evening.** Both were true when written and
> both were ended deliberately: **G95** put the runner in, **G96** ends the
> one-dependency property because `tsc` over `tests/` cannot resolve `node:test`
> without `@types/node`. **Verify before quoting either line** — `cat package.json`
> and `ls tests/` — because `tests/` was untracked and `package.json` modified but
> uncommitted when this was written. ⚠️ **G96 ended the *one-dependency*
> property; G191 ended the *dev-dependencies-only* property**, which is a
> different and larger thing: this repository now ships code that runs in
> production shape, so `npm ci --omit=dev` is a meaningful command and the
> `Dockerfile` says in its own header which three packages survive it.

That is the whole repository. **If you are looking for the application, it is now
`server/`** — ⚠️ **this sentence read *"it is not here — see Salvage, below"*
until 16 Aug 2026, and there is no Salvage heading on this page; the pointer was
to `docs/salvage-ledger.md`, which is about the REPLACED application and answers a
different question.** Both halves of that sentence are corrected here rather than
deleted. For the replaced product, see `docs/salvage-ledger.md` and the three
archive tags below.

> ⚠️ **`Mockups/rec/` was missing from this list until 7 Aug 2026**, and from
> `README.md` and `docs/INDEX.md` with it — while this paragraph said *"that is the
> whole repository."* It is **22 tracked files** (`git ls-files Mockups | wc -l`)
> and the largest product-specification artefact here. **A reader deriving scope
> from this list would not have known the product was drawn.**
> `docs/screen-pack-ledger.md` joins it to the model. Note that
> `tools/check-doc-counts.mjs` **cannot catch this class** — an omission has no
> number in it.

**Reproduce every count on this page** — this file has
carried a stale module count and a stale capability count before, and
`docs/HANDOFF.md` §5.11 records that as a defect shape rather than an accident.
**All five below were re-run by hand on 8 Aug 2026 evening and all five still
hold** (they were last stated at `571e7c26`, 7 Aug). ⚠️ **Run them yourself
anyway**: `tools/check-doc-counts.mjs` is blind to the Markdown table form — the
number sits in a different cell from the noun — so a count inside a table on this
page is checked by nothing but a person:

```bash
ls model/*.ts | wc -l                                  # 28 modules — 🛑 A MERGE'S
#   NUMBER: both parents said 27 and meant different sets (`model/approval.ts`
#   on one, `model/run-admission.ts` on the other). §5.11 with a second parent.
#   ⚠️ SAID 26
#   UNTIL 19 Sep 2026, when model/approval.ts landed under G658 carrying the
#   FIRST evaluator `ApprovalConfig.quorum` and `segregationOfDuties` have ever
#   had. `check-doc-counts` reported this one STALE, which is the FIRST time
#   this fence has been caught by the checker rather than by a person — the
#   four occasions below were all HISTORICAL-or-unnoticed. ⚠️ SAID 25
#   UNTIL 19 Sep 2026, when model/onboarding.ts landed under G535 carrying H2's
#   ordered sequence. `check-doc-counts` classified the 25 HISTORICAL rather
#   than STALE and the gate was EXIT 0 while it was one behind, which is THE
#   FOURTH TIME A NUMBER IN THIS FENCE HAS GONE STALE UNCHECKED and the
#   sentence two paragraphs up happening to itself for the second time.
#   ⚠️ SAID 22
#   UNTIL 19 Sep 2026, THREE BEHIND. model/held-work.ts and model/ingestion.ts
#   landed without this fence moving; model/money.ts (G286, G111's codec) is the
#   twenty-fifth. THE FENCE HAS NOW BEEN STALE THREE TIMES, twice by omission
#   and once on the day a module landed, which is the sentence below happening
#   for the fourth time. ⚠️ SAID 20
#   AND `check-doc-counts` NEVER FLAGGED IT, on 23 Aug 2026: the modules matcher
#   reads prose and this line is inside a fence, so a reproduction block stating
#   the wrong number is checked by nothing but a person — which is the sentence
#   two paragraphs up, happening to itself. `model/serving-host.ts` (G179/G225)
#   is the twenty-second.
ls docs/*.html | wc -l                                 # 1 visual — c4.html, the
#   only one left. ⚠️ SAID 10 UNTIL 18 Sep 2026, when G264 adopted the build pack
#   and NINE STALE VISUALS WERE DELETED rather than re-banner-ed: access-matrix,
#   component-architecture, decision-defects, deployment-topology, model-topology,
#   service-stacks, systems-end-to-end, user-journeys, value-layers. Every one of
#   them is retrievable at `git show archive/pre-handoff-pack:<path>`. c4.html
#   survives because it is GENERATED and `check:c4` fails the gate when it drifts
#   — which is the property the other nine never had and why they went stale.
grep -h '^export ' model/*.ts | wc -l                  # DERIVE IT — SEE BELOW,
#   🛑 AND THE NUMBER IS DELIBERATELY NOT WRITTEN ON THIS LINE ANY MORE.
#   19 Sep 2026: **THREE parents each swept this fence on the same day, two of
#   them wrote the SAME number and meant DIFFERENT SETS, and no parent ever
#   computed the answer.** `origin/main` reached **1189** by merging
#   `model/approval.ts`'s fifteen with `model/run-admission.ts`'s fifteen —
#   each parent having said 1174 and meant a different fifteen — and the
#   console-session branch reached **1177** by adding its eighteen to the same
#   1159. **`node tools/check-doc-counts.mjs --derive | grep exports` is the
#   citation now**, because this fence has carried a wrong value SEVEN TIMES
#   and every repair has been a better number rather than no number.
#   ⚠️ THE THREE NARRATIONS BELOW ARE ALL KEPT AND NONE IS CORRECT ABOUT THIS
#   TREE. Each was right about the branch that wrote it, and deleting one
#   would erase a sweep that really happened.
#   🛑 THE CONSOLE-SESSION SLICE (G726–G729) ADDED EIGHTEEN across two
#   modules — `model/serving-host.ts` §7–§8 (fourteen: CONSOLE_KINDS,
#   ConsoleHost, ConsoleHostResolution, resolveConsoleHost,
#   CONSOLE_HOST_REGISTRATION_REFUSALS and its two types,
#   checkConsoleHostRegistration, SERVED_SURFACE_KINDS, ServedSurfaceKind,
#   ServedSurface, SERVED_HOST_REFUSALS, ServedHostRefusal,
#   ServedHostResolution, and the exhaustiveness assertion) and
#   `model/access.ts` (`StaffGrantTerms`).
#   🛑 AND 1189 IS A MERGE'S NUMBER: BOTH PARENTS SAID 1174 AND MEANT DIFFERENT
#   SETS — fifteen from `model/approval.ts` on one side, fifteen from
#   `model/run-admission.ts` on the other. *The number agreed and the sets did
#   not*, which is the 16 Aug 2026 capability row's exact shape, for the second
#   time in this fence. Re-derived by hand on the merged tree.
#   ⚠️ SAID 1159 UNTIL 19 Sep 2026, when model/approval.ts (G658) added FIFTEEN:
#   `SEVERITY_ORDER`, `severityAtOrAbove`, `ApprovalGate`,
#   `_ApprovalGateNamesApprovalConfigFields`, `ApprovalRecord`, `ProposerRef`,
#   `ProposalUnderApproval`, `APPROVAL_STATES`, `ApprovalState`,
#   `APPROVAL_BLOCKERS`, `ApprovalBlocker`, `ApprovalVerdict`,
#   `segregationViolated`, `approvalRequiredFor` and `approvalState`. **The
#   1159 was CORRECT when this sweep arrived**, which is recorded because most
#   sweeps of this fence have found it already behind. Swept in the commit that
#   moved it, §5.11.
#   ⚠️ SAID 1159 UNTIL 19 Sep 2026, when model/run-admission.ts (G692) added
#   FIFTEEN: the three total Records, the four substrate records, the fact and
#   verdict types, the nine-arm refusal union and its containment proof, the
#   idempotency basis, `slotFillBasis()` and `admitRun()`. `check-doc-counts`
#   reported this line and it was read rather than reclassified. Swept in the
#   commit that moved it, §5.11.
#   ⚠️ AND SAID 1159 UNTIL 19 Sep 2026 ON THE OTHER PARENT TOO, when the
#   CONSOLE-SESSION slice (G726–G729) added EIGHTEEN across two modules —
#   `model/serving-host.ts` §7–§8 (fourteen: CONSOLE_KINDS, ConsoleHost,
#   ConsoleHostResolution, resolveConsoleHost,
#   CONSOLE_HOST_REGISTRATION_REFUSALS and its two types,
#   checkConsoleHostRegistration, SERVED_SURFACE_KINDS, ServedSurfaceKind,
#   ServedSurface, SERVED_HOST_REFUSALS, ServedHostRefusal,
#   ServedHostResolution, and the exhaustiveness assertion) and
#   `model/access.ts` (`StaffGrantTerms`). `check-doc-counts` classified that
#   1159 HISTORICAL rather than STALE, so the gate was EXIT 0 while it was
#   eighteen behind.
#   🛑 BOTH PARENTS SAID 1157 AND MEANT DIFFERENT SETS — §5.11 WITH A SECOND
#   PARENT, AND THIS IS THE 16 Aug 2026 CAPABILITY ROW'S EXACT SHAPE: *the
#   number agreed and the sets did not.* `origin/main` reached 1157 by adding
#   G601's two to 1155; this branch reached 1157 by adding G641's two to the
#   same 1155. **The merged tree is 1159, which neither side ever computed**,
#   and a rebase that took either narration's number would have looked
#   textually clean and been wrong. Re-derived by hand on the merged tree.
#   BOTH NARRATIONS ARE KEPT BELOW; each is right about its own parent.
#   ⚠️ SAID 1155 UNTIL 19 Sep 2026, when G601 added TWO to model/access.ts —
#   PLATFORM_ONLY_RESOURCE_CLASSES and capabilityIsPlatformOnly(), the fence
#   that keeps its five new capabilities out of every tenant arm. FIVE
#   CAPABILITY MEMBERS MOVED NO EXPORT LINE, because they are properties of
#   one already-exported const — which is the blind spot the capabilities awk
#   below exists to cover and the reason the two numbers move independently.
#   `check-doc-counts` called the 1155 line HISTORICAL, not STALE, for the
#   FIFTH time on this one line; swept in the commit that moved it, §5.11.
#   ⚠️ SAID 1155 UNTIL 19 Sep 2026, when G641 added TWO to model/access.ts §7a —
#   `LiveMembershipInput` and `holdsLiveMembership()`, the ONE place the
#   membership liveness predicate is written. It is a MOVE and not a widening:
#   `selectTenantForSession()` used to state the four terms inline and now
#   calls them, so the count of PREDICATES went one to one while the count of
#   `export ` lines went 1155 -> 1157. `check-doc-counts` reported this line
#   and it was read rather than reclassified. Swept in the commit that moved
#   it, §5.11.
#   ⚠️ SAID 1128 UNTIL 19 Sep 2026, when model/onboarding.ts (G535) added 27:
#   the sequence, the two total Records, the step-state and refusal
#   vocabularies, the two transitions and the derived count union with its
#   compile-time proof. `check-doc-counts` called the 1128 line HISTORICAL,
#   not STALE — the gate was EXIT 0 while it was 27 behind, for the fourth
#   time on this one line. Swept in the commit that moved it, §5.11.
#   ⚠️ SAID 1126 UNTIL 19 Sep 2026, when G304/G305 added TWO to model/domain.ts —
#   `BrokeredConnection` (the broker handle, a PAIR) and `PROTOCOL_IS_BROKERED`
#   (the total Record that says which protocols are brokered). Swept in the
#   commit that moved it, §5.11. `check-doc-counts` reported this line STALE and
#   this time it was read rather than reclassified.
#   ⚠️ AND 1126 WAS A THIRD ANSWER NEITHER PARENT EVER COMPUTED. `main` said 1122
#   after G289's five; the G291 branch said 1121 after its four; the MERGED tree
#   is 1126. §5.11 with a second parent, for the fourth time in one day — a
#   count is a fact about a tree, and a merge makes a new tree. Re-derived on
#   the merged tree by hand, not taken from either side.
#   ⚠️ SAID 1117 UNTIL 19 Sep 2026, when G289 gave `decide()` its FOURTH `OrgClass`
#   ARM. The five are `model/access.ts` §6a — PlatformRoleAssignmentId,
#   PlatformRole, PlatformRoleAssignment, HeldPlatformAssignment and
#   PLATFORM_ASSIGNMENT_REACHES — and `check-doc-counts` classified the 1117 line
#   HISTORICAL rather than STALE, so the gate was EXIT 0 while the number was
#   five behind. THAT IS THE THIRD TIME A NUMBER IN THIS FENCE HAS GONE STALE
#   UNCHECKED and it is the sentence twelve lines down happening again: a fence
#   is checked by nothing but a person, whichever way the checker classifies it.
#   ⚠️ SAID 1052 UNTIL 19 Sep 2026 AND THE TREE ALREADY SAID 1105 BEFORE G286
#   TOUCHED IT — fifty-three behind, from model/held-work.ts and work after it.
#   G286 moves it 1105 -> 1117: model/money.ts declares the money surface that
#   model/reconciliation.ts used to, plus the four wire functions and the two
#   range constants that are new, and the old home re-exports it — a re-export
#   line begins `export ` and counts. THE 1105 WAS NOT THIS COMMIT'S TO MAKE
#   STALE and is named so the sweep is not read as accounting for all 65.
#   ⚠️ SAID 1023 UNTIL 24 Aug 2026. model/ingestion.ts is a new module carrying
#   27 top-level exports, plus two branded ids in model/kernel.ts — and this
#   fence is checked by NOTHING BUT A PERSON, which is the sentence four lines
#   down happening for the third time. Swept in the commit that moved it.
#   ⚠️ SAID 1000 UNTIL 24 Aug 2026. G217 and G228 (#201, #247) added ten to
#   model/reconciliation.ts — SearchBoundaryEntry, SearchBoundary,
#   KeyedSearchBoundaryEntry, LineFinding, LineFindingRefusal,
#   LineFindingOutcome, openLineFinding and three containment proofs. Swept in
#   the commit that moved it (§5.11).
#
#   two branches each said a different number and the merge made a third.
#   ⚠️ SAID 1000 UNTIL 24 Aug 2026, and `check-doc-counts` classified that line
#   HISTORICAL rather than STALE — so the run was EXIT 0 while the number was
#   thirteen behind. The thirteen are #235 [A-14]'s invitation block in
#   `model/domain.ts` plus `InvitationId` in `model/kernel.ts` and the two
#   absence proofs in `model/identity.ts`. THIS IS THE SECOND TIME A NUMBER IN
#   THIS FENCE HAS GONE STALE UNCHECKED, and the first is narrated four lines
#   up: a fence is checked by nothing but a person, whichever way the checker
#   classifies it.
#   🛑 AND IT WAS 17 BEHIND BEFORE ANYBODY TOUCHED IT: this line read 911 on
#   23 Aug 2026 while the tree said 928, and G236/G227 (#198, #248) then took it
#   to 934 with six new exports in model/reconciliation.ts — HeldRead,
#   DocumentTrailerVerdict, RunDocumentAccount, documentAccounts and the two
#   containment proofs. The 928 was not this pass's to make stale and is named
#   so the sweep is not read as accounting for all 23. §5.11: swept in the
#   commit that moved it.
awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts \
  | grep -cE '^  [a-zA-Z]+:'                           # 51 capabilities — ⚠️ SAID
#   50 UNTIL 4 Oct 2026, when G3881 (THE OWNER'S RULING ON G3802) minted
#   `view_run`: the five run reads' verb, CARRIED by `view_exception` and in no
#   partner scope, so no customer's reach moved and partners lost the run reads.
#   ⚠️ AND IT SAID
#   44 UNTIL 1 Oct 2026, when R10 (THE OWNER'S) minted SIX on three new
#   partner-only classes: view_deals · register_deal · view_sandbox ·
#   operate_sandbox · view_partner_staff · manage_partner_staff. `decide()`
#   answers them on its FIFTH arm alone and refuses them to every customer and
#   platform principal (`PARTNER_ONLY_RESOURCE_CLASSES`), so no tenant's reach
#   moved and no cross-tenant path was added. ⚠️ AND IT SAID
#   39 UNTIL 19 Sep 2026, when G601 minted FIVE that no tenant principal may
#   hold: view_substrate · provision_substrate · view_catalogue ·
#   author_catalogue · publish_catalogue. `decide()` refuses all five on the
#   customer and partner arms at their first line
#   (`PLATFORM_ONLY_RESOURCE_CLASSES`), so the roster grew and no tenant's
#   reach did. THIS IS THE FIRST TIME THIS LINE HAS MOVED SINCE 16 Aug 2026.
awk '/^export const ACCESS_RESOURCE_CLASSES = \{/,/^\}/' model/governance.ts \
  | grep -cE '^  [a-zA-Z]+:'                           # 16 resource classes — ⚠️
#   SAID 13 UNTIL 1 Oct 2026, when R10 added `deal`, `sandbox` and
#   `partner_staff` — a partner firm's own surface, held in no tenant.
```

> 🛑 **16 Aug 2026 — THIS BLOCK IS THE DEFECT IT WARNS ABOUT, ARRIVING IN THE BLOCK
> ITSELF, AND BOTH SIDES OF A MERGE WERE WRONG AT ONCE.** Two sessions each swept
> these five lines against **their own** tree and each was correct there. Neither
> was correct about the tree that resulted from merging them:
>
> | | visuals | exports |
> |---|---:|---:|
> | `design/teal-world-and-o16` (ours) | **9** | **854** |
> | `origin/main` | **10** | **849** |
> | `feat/invariant-10-event-streams` (G376–G377) | 319 | **92** |
| **the merged tree** | **325** | **99** |
>
> Ours never saw `docs/c4.html`, which is origin's tenth visual; origin never saw
> the five exports our `model/` change added. **The merge did not pick a winner —
> it produced a third answer neither branch had ever computed**, and both sides'
> numbers were dead the instant the trees joined. The two lines above are the
> re-derived merged values, run by hand against the working tree on 16 Aug 2026,
> and they are the only two figures on this page whose provenance is a merge
> rather than a commit. ⚠️ **`node tools/check-doc-counts.mjs` would have called
> BOTH pre-merge values STALE and neither branch would have believed it, because
> each was green on its own tree.** This is `docs/HANDOFF.md` §5.11 with a second
> parent: **a count is a fact about a tree, and a merge makes a new tree.** Re-run
> the block; do not read it.
>
> 🛑 **AND IT HAPPENED A SECOND TIME, ON THE SAME PAGE, IN THE SAME WEEK — the
> merge of `origin/main` into `feat/authorisation-pass`, 16 Aug 2026.** Two of
> the five lines conflicted again and, again, **neither side was right about the
> merged tree**:
>
> | | exports | capabilities |
> |---|---:|---:|
> | `feat/authorisation-pass` (ours) | **866** | **38** — with `admit_source` |
> | `origin/main` | **864** | **38** — with `view_endpoint` |
> | **the merged tree** | **876** | **39** — both |
>
> **The capability row is the one to read.** Both branches said *thirty-eight* and
> the two thirty-eights were not the same set: ours added `admit_source` to a
> shared 37, origin added `view_endpoint` to the same 37. A merge that picked
> either side's *number* would have been wrong while looking textually clean —
> **the number agreed and the sets did not.** What caught it was not this page and
> not `check-doc-counts`: it was `tsc`, because
> `CAPABILITY_STAKEHOLDER_CLASSES`, `SEEDED_CAPABILITY_HOLDERS` and
> `PARTNER_MASK_MEMBERSHIP` are TOTAL over `Capability`, so the thirty-ninth
> member is three `TS1360`s at three literals that must each be answered. This is
> the argument for a total `Record` stated by a merge instead of by a paragraph.
> Both figures above are re-derived from the merged tree; run the block.
>
> ✅ **All five re-run by hand later on 16 Aug 2026 against `origin/main`, and all
> five still hold** — 18 · 10 · 854 · 37 · 13. **That is the uncomfortable part of
> this sweep and it is recorded rather than buried:** the same tree was missing
> `server/`, `compose.yaml`, `Dockerfile`, `design/`, `DESIGN.md` and
> `.impeccable/` from the layout block six inches above, and a first Fastify plane
> had landed. **Every number on this page was right while the page was wrong about
> what the repository IS.** A count control cannot see a directory. Do not read a
> green `check-doc-counts` as a green page.

> ✅ **RESOLVED 10 Aug 2026 — the deferral that stood here is discharged, in the
> commit it was waiting for.** This block said the `832 exports` line above was
> STALE-but-correct-at-`HEAD` and was to be **LEFT ALONE**, because a concurrent
> session held an uncommitted `model/` change and an uncommitted fourth contract
> file, so sweeping would have made the record wrong the moment that work landed
> — `docs/HANDOFF.md` §5.11. **That work lands here.** The exports line now reads
> **837**, and every `65 operations` / `62 paths` line across the record has been
> swept — first to **70** and **67**, then on 16 Aug 2026 to **72** and **69**,
> when the engine's read surface minted `getRunAccount` and `listRunResidue` on
> the capability tier, and on 23 Aug 2026 to **76** operations across **72**
> paths, when the FIFTH tier — `docs/contracts/session.openapi.yaml`, #230/#231 —
> added four operations across three paths. **Both figures have now moved three
> times; derive them, never quote them.** The fourth contract tier is
> `docs/contracts/data-plane-local.openapi.yaml` (3 paths, 3 operations); the
> control plane also gained two. ⚠️ **The "re-run by hand on 8 Aug 2026 evening
> and all five still hold" sentence above is therefore history, not a current
> claim — the exports figure has moved twice since.** Derive it; do not read it.
>
> ⚠️ **AND IT MOVED AGAIN THE SAME DAY: 837 → 843, C17.** `model/reconciliation.ts`
> gained six top-level exports — `PopulationDefect`,
> `_PopulationDefectHoldsNoTextDeep`, `POPULATION_DEFECT_KINDS`,
> `_EveryPopulationDefectKindIsListed`, `PopulationIntegrityInput` and
> `checkPopulationIntegrity` — so `node tools/check-doc-counts.mjs` reported this
> one line STALE and the number above is swept in the same commit that made it
> stale, which is the rule §5.11 exists to state. **This is the third value that
> line has carried in four days. Run the command.**

## ⚠️ A third of `model/` is DECLARED AND NOT BUILT

Since 7 Aug 2026 the scope of v1 is a **decision**, not an aspiration.

- **`drop_for_v1`** — the type **stays declared**, carries a dated note, and gets
  **no table, no endpoint, no code**. It is **not deleted**.
- **`delete`** — removed from the tree. There is **exactly one** in the whole
  pass: `ROLE_KEYS` and the `RoleKey` type.

Every dropped declaration says so on itself:

```
/** @dropped-for-v1 7 Aug 2026 — <why>. Declared, not built. */
```

**197** top-level exports carry it — ⚠️ **THIS SAID 196 AND THE COMMAND ALREADY
RETURNED 197 BEFORE THE G304 SLICE TOUCHED THE TREE.** That slice adds no
`@dropped-for-v1` marker at all — `grep -c '@dropped-for-v1'` over its diff is
0 — so the 196 was not its to make stale; it is corrected here because the
sweep ran the derivation, and it is named so this commit is not read as
accounting for it. `check-doc-counts` classified the line HISTORICAL rather
than STALE, which is how it survived. — 🛑 **and the awk BELOW, which this page has
quoted as the derivation since 7 Aug 2026, RETURNS 198 AND IS WRONG. It is kept
here, struck, because it is quoted in other documents and a reader must be able to
recognise it:** ~~`awk '/@dropped-for-v1/{f=1;next} f&&/^export /{c++;f=0;next} f&&NF{f=0} END{print c}' model/*.ts`~~
It arms on any line **containing** the marker, including prose *about* another
declaration's drop — the identical false-positive class that made the C4 page render
seven live exports as dropped. **Both figures now come from one derivation, the
TypeScript parser:** `node tools/check-doc-counts.mjs --derive | grep exports`
— plus field- and union-member-level drops (**236** markers in total,
`grep -rho '@dropped-for-v1' model/*.ts | wc -l`; **236 at `HEAD` and 236 in the
working tree**, so unlike the exports figure this one is safe to state).
⚠️ **This said 235 until 22 Aug 2026**; the 236th is `Session.secondFactorAt`,
under **G223** — *"no second factor in v1; federation owns it"* — which lands as
a field-level drop on a row that did not exist when the previous figure was
written. **And the false-positive class the strike-through above describes bit
the very commit that swept this line, twice**: two successive drafts of a
paragraph in `model/identity.ts` EXPLAINING the drop each spelled the marker
out, and each moved this count by one while dropping nothing. The paragraph now
cites the marker by anchor rather than by copy, which is the discipline
`model/kernel.ts` already states for `FieldPath`'s superseded declaration.
⚠️ **This said 229 until 8 Aug 2026, then 230 until 10 Aug 2026** — the 230th
was `SolutionPack.palette` (`model/domain.ts:2450`; ⚠️ **that citation said
`:2250` until 10 Aug 2026, and `:2250` still resolves, to a `cost_overrun` union
member; it then said `:2384` until 16 Aug 2026, and `:2384` still resolved too —
to a bare `*/` closing someone else's docblock. Twice rotted, twice resolving.
Derive it: `grep -n 'palette' model/domain.ts`**), a
field-level drop reserving a key with no reader in v1, under G90 and G102.
`node tools/check-doc-counts.mjs` reported this line STALE the moment that field
landed, and STALE again for the five markers after it, which is exactly what that
tool is for. Two modules are dropped whole:
**`presentation.ts`** and **`deployment.ts`**, each with a ⚠️ banner at the top of
the file.

**Before you build against a type, check whether it is dropped.** Before you
extend one, read `docs/v1-scope-ledger.md` — and `docs/HANDOFF.md` §0, which is
the shorter version.

## STOP — where things are

**`main` is the trunk.** `origin/HEAD` points at it. It is a fresh orphan root
cut on 6 Aug 2026 and it shares history with none of the eight root commits in
this remote's past. There is no other branch you should be working from unless
someone names one.

> 🛑 **18 Sep 2026 — READ THIS BEFORE FOLLOWING ANY CITATION TO `Mockups/`,
> `design/system/`, `design/routes/`, `DESIGN.md`, `.impeccable/`,
> `docs/screen-pack-ledger.md`, `docs/design-tokens.md` OR ANY `docs/*.html`
> BUT `c4.html`. ALL OF THEM ARE DELETED FROM THE TREE**, under **G264**, which
> adopted `docs/handoff-pack/` as the north star. **Nothing is lost — every one
> resolves at a tag:**
>
> ```bash
> git show archive/pre-handoff-pack:design/system/tokens.css
> git show archive/pre-handoff-pack:Mockups/rec/Navigation.dc.html
> git show archive/pre-handoff-pack:DESIGN.md
> ```
>
> ⚠️ **THIS PAGE AND `docs/HANDOFF.md` STILL CARRY ROUGHLY 246 CITATIONS TO
> THOSE PATHS AND THEY HAVE NOT BEEN REWRITTEN, DELIBERATELY.** Most narrate a
> decision that was true when it was taken, and rewriting them would destroy the
> reasoning this record exists to hold. **The rule is: a citation to one of
> those paths is a citation to the TAG, not to the tree.** A citation that names
> a line number in one of them is subject to the resolving-but-wrong class this
> page catalogues twenty times over — **derive, do not read**.
>
> 🛑 **AND THE ONE CLASS THAT IS NOT MERELY HISTORICAL: built code cites two of
> them by line.** `frontend/src/components/ChromeBar.tsx` calls
> `Mockups/rec/Navigation.dc.html:451` *"the authority"*;
> `frontend/src/bridge.css` cites `DESIGN.md` by R-number and by line. **The
> pack reproduces every one of those positions, so they RE-POINT rather than
> die — and they are not re-pointed yet.** That is **G275**, open, and nothing
> in `npm run check` can see it.

**The old product is not gone; it is tagged.** ⚠️ **There are now FOUR archive
tags that matter, not three** — `archive/pre-handoff-pack` joined them on
18 Sep 2026 and is the one every deleted path above resolves at. The three
below are the REPLACED APPLICATION and answer a different question:

| Tag | What it holds |
|---|---|
| `archive/sap-line` | The SAP-line application. Every `src/…` path in this repository means `archive/sap-line:src/…` |
| `archive/design-record` | The trunk's full design record before the cut, including the ten documents that described the replaced application |
| `archive/trunk-pre-rebuild` | The trunk exactly as it stood before the re-root — 446 files |

Retrieve anything with `git show <tag>:<path>`. Tags survive branch deletion and
force-push; that is why they exist. **A citation with no branch qualifier is a
dead citation** — if you add one, qualify it.

---

## Invariants the model exists to hold

These are the load-bearing eleven. The numbered enumeration exists **only here**.
Elsewhere there are unnumbered one-line restatements. Copy them, never paraphrase
them: a paraphrased invariant is a changed invariant.

1. **Tenant scope is derived from the session, never read from a request.**
   ⚠️ **The wire carries TWO deviations from this, and two documents say one.**
   Found 8 Aug 2026 by a recursive `$ref` scan of every request body, and ruled
   the same evening as **G113**. The surviving one is the usage-event stream's
   `tenantRef`, which argues its exception at the point of use
   (`docs/contracts/control-plane.openapi.yaml:1295-1310`): a multi-tenant hosted
   plane ships events for many tenants in one batch, so the batch genuinely cannot
   carry one session tenant. **`InstallationReport.tenantRef`
   (`docs/contracts/control-plane.openapi.yaml:1840` — ⚠️ **this said `:1826`
   until 22 Aug 2026 and `:1826` still resolves, to `signature:`. The TWENTY-FIRST
   instance of the resolving-but-wrong class on this page. Derive it:
   `grep -n 'tenantRef' docs/contracts/control-plane.openapi.yaml`**) is a bare
   `{type: string}`
   with no argument anywhere**, on the only contract that crosses an account
   boundary — G113 removes it rather than documenting it. 🛑 **RULED, NOT
   APPLIED:** the field is still on the wire, and
   `docs/contracts/control-plane.openapi.yaml:67` still says *"one deviation
   exists"*. **The invariant's own sentence is unchanged by this and must stay so.**

   > ⚠️ **BOTH CONTRACT CITATIONS IN THIS INVARIANT WERE DEAD UNTIL 16 Aug 2026,
   > AND BOTH STILL RESOLVED.** `:1188-1201` landed on the word *"our database."*
   > and a stray `additionalProperties: false`; `:1612` landed on *"Hours after
   > expiry during which IN-FLIGHT WORK COMPLETES"*, inside a grant schema, not on
   > `InstallationReport` at all. The contract grew by hundreds of lines and the
   > citations followed nothing. Derive both:
   > `grep -n 'tenantRef\|InstallationReport' docs/contracts/control-plane.openapi.yaml`.
   >
   > 🛑 **AND ONE CLAIM IN THIS INVARIANT WAS NOT STALE BUT WRONG.** It read that
   > `docs/contracts/control-plane.openapi.yaml:67` **and
   > `docs/contracts/README.md:84`** *"both still say"* one deviation exists.
   > **`docs/contracts/README.md` does not say it and has not since 8 Aug 2026** —
   > it strikes the sentence through at `:133` and says in its own voice *"THAT
   > SENTENCE WAS FALSE. THERE ARE TWO,"* under G113, with `:43` carrying the same
   > correction at the head of the file. This page was reporting a document as
   > uncorrected **after** that document corrected itself, which is a worse defect
   > than a rotted line number: a stale citation misplaces a fact, a stale
   > *characterisation* invents one. The count is therefore **one** document still
   > carrying the sentence, not two, and the one that carries it is the contract —
   > which, as `README.md:133` says, is not that file's to correct.
2. **Exactly one cross-tenant read path** — `partner_admin(P)` may read tenant `T` iff `T.partnerId = P`, and only within a live `PartnerAccessGrant` beyond commercial metadata.
3. **The control plane publishes downward and never reads tenant data.**
4. **Classification is declared once**, on `FieldSpec`, and everything derives from it.
   ⚠️ **HOW THIS IS MECHANISED OVER A SCHEMA-AGNOSTIC JSONB PAYLOAD WAS UNDECIDED
   UNTIL 8 Aug 2026 — G106.** The decided storage shape is a JSONB column inside
   PostgreSQL, and **a JSONB key with no `FieldSpec` has no classification** — so
   `dataClass`, `modelProcessingAllowed`, redaction and the model-processing
   ceiling would all silently address nothing over the half of a payload nobody
   mapped. G106 rules that **`FieldSpec` gains a real JSONB path, and that a key
   with no `FieldSpec` is UNREADABLE** — stored, but unaddressable by any agent,
   prompt, export or dashboard. Fail-closed, matching `DENY_ALL`. **The rejected
   alternative is preserved:** defaulting unmapped keys to the most sensitive class
   was refused, because readable-by-default-with-a-high-bar is scope failing OPEN,
   which `docs/HANDOFF.md` §5.5 records this codebase already fixing once.
   🟠 **PARTLY APPLIED — and this block said NOT APPLIED until 9 Aug 2026, which
   had gone false.** ⚠️ **The correction is recorded rather than overwritten,
   because the sentence that was wrong is the one a reader would have trusted.**
   It read: *"the unreadable-by-default rule has no executable form anywhere in
   `model/`."* It has one. `AdmissionRefusal` carries
   `{ kind: 'field_not_classified' }` — one declaration — and
   `admitPopulation()` refuses on it at **four** call sites (amount, date, and
   two more) whenever a declared path is absent from `fieldClassification`.
   🛑 **ALL FIVE LINE NUMBERS ARE GONE FROM THIS PARAGRAPH, DELIBERATELY, AND
   THE REASON IS THAT THE SWEEP BELOW DID NOT HOLD: they rotted a SECOND time
   and were `:1074` · `:1351` · `:1372` · `:1386` · `:1404` until 19 Sep 2026,
   every one of them still resolving to a real line that says something else.**
   The banner immediately below records the FIRST time this happened, in the
   same words, and ends by telling the reader to run the command — and the next
   reader wrote five fresh numbers anyway. **The numbers are not replaced with
   new numbers. The grep is the citation.** **Fail-closed, exactly as G106 requires**, and it
   arrived with the reconciliation engine rather than as a change to `FieldSpec`,
   which is why nobody updated this paragraph. Reproduce — this is the derivation,
   the five line numbers are not:
   `grep -n 'field_not_classified' model/reconciliation.ts` → 5 lines (the
   declaration plus four refusals).

   > ⚠️ **ALL FIVE OF THOSE CITATIONS WERE DEAD UNTIL 16 Aug 2026 AND ALL FIVE
   > STILL RESOLVED**, which makes this the largest single instance of the
   > resolving-but-wrong class on the page. Previously `:847` (a `return { ok:
   > false, refusal: gb }` in an unrelated guard), `:1015` (`readonly lineIndex:
   > number | null`), `:1030` (a sentence about passing a source file BINARY to
   > `grep`), `:1044` (`readonly ref: ItemRef`) and `:1062` (a docblock about FIFO
   > ties). C13, C17, C17b, C18 and O-15 inserted roughly 250 lines above them.
   > `npm run check:citations` is EXIT 0 and structurally cannot see this class,
   > because every one of the five points at a real line. **The `grep -c` on this
   > line survived unharmed while every number beside it rotted — which is the
   > argument for the grep anchor over the line number, and why the five have been
   > swept but the sentence now tells you to run the command instead.**
   ✅ **THE ADDRESSING HALF LANDED 22 Aug 2026 — G214, #237 — AND THIS BLOCK
   SAID IT HAD NOT UNTIL THEN. THE OLD PARAGRAPH IS QUOTED RATHER THAN DELETED,
   because it is the sentence a reader would have trusted and it is quoted in
   other documents:** *"🛑 WHAT IS STILL NOT APPLIED, and do not read the
   existing field as the ruling. `FieldSpec.path` … is typed `FieldPath`, and
   `FieldPath` is a naked `= string` alias (`model/kernel.ts:423`) — an
   unstructured string with **nothing tying it to a payload key**. So the REFUSAL
   half is real and the JSONB PATH half is not."* **Both of its claims are now
   false.** ⚠️ Its two citations had also rotted in the usual way — `:1717` was
   `/**` and `:423` moved — which is why neither is restated here.

   **What is true at the tree.** `FieldPath` is a **branded token list** — a
   readonly array of `FieldSegment`, each a key or a zero-based array index —
   and it is **parsed at exactly one seam**, `parseFieldPath()` in
   **`model/field-path.ts`**, which is the only thing in the repository that may
   construct one. `FieldSpec.path` is retyped in the same commit. Derive all
   three, and do not read a line number from this page:

   ```bash
   grep -c 'export type FieldPath = string' model/kernel.ts   # 0
   grep -n 'export type FieldPath'          model/kernel.ts   # the token list
   grep -rln 'export function parseFieldPath' model/          # exactly one file
   ```

   **The deciding fact was that the keys are counterparty-controlled**: a dotted
   path breaks on any key containing a dot, which is legal JSON, and its failure
   mode is that it silently addresses the WRONG key rather than refusing — scope
   failing open. **JSON Pointer was the respectable alternative and is preserved
   as rejected**, because its correctness lives in a parse-and-unescape step at
   every boundary, which is the shape G111 refuses for money.

   ✅ **THE STORAGE HALF LANDED 19 Sep 2026 — G295, G320 — AND THIS BLOCK SAID
   IT HAD NOT UNTIL THEN. THE OLD PARAGRAPH IS QUOTED RATHER THAN DELETED,
   because it is the sentence G295's own row cites as its premise and the one a
   reader would have trusted before deciding whether to build one:** *"🛑 WHAT
   IS STILL NOT DONE, AND IT IS NARROWER THAN WHAT WAS. G106's storage half —
   the JSONB **column** — is not written: `db/migrations/` holds no payload
   table, and #237 §3 names that as the follow-on rather than inventing one."*
   **Both halves of that are now false.**

   **What is true at the tree.** `db/migrations/0012_payload_and_subject_index.sql`
   carries the payload as one `jsonb` column and `FieldSpec.path` as a stored
   column beside it, and **G295 made the two inseparable from a third** — the
   subject index, *"the registered location, without which a stored classified
   value cannot be attributed later"*. The word the record uses for landing the
   payload alone is **UNRECOVERABLE**. Derive all three, and do not read a table
   name from this page:

   ```bash
   grep -c 'payload *jsonb'      db/migrations/0012_payload_and_subject_index.sql   # 1
   grep -c 'document_field_spec' db/migrations/0012_payload_and_subject_index.sql   # non-zero
   grep -c 'subject_index_entry' db/migrations/0012_payload_and_subject_index.sql   # non-zero
   ```

   🛑 **G106's REJECTED ALTERNATIVE IS NOT RE-TAKEN AND THE ABSENCE IS
   MECHANICAL: there is no default-class column in that migration and no arm in
   `readAddressablePayload()` that returns an undeclared position.** An unmapped
   key is STORED — the whole document is, deliberately, so the rule is
   falsifiable rather than a statement about what the writer chose to write —
   and it is UNREADABLE. `tests/db/payload-and-subject-index.test.ts` §2b reads
   the raw column as the migrator, sees the undeclared key sitting there, and
   requires the reader not to return it.

   🛑 **WHAT IS STILL NOT DONE, AND IT IS NARROWER AGAIN.** Nothing is MOUNTED:
   `createUpload`, `completeUpload`, `getDocument` and `classifyValue` stay
   declared and unrouted, because G300's test is **table AND model AND
   capability** and `Document` requires an extraction and a `Provenance` this
   slice does not produce. `tenant.document_field_spec` has **no writer on any
   request path** — `SELECT` only to the app role, deliberately — so a
   classification reaches a tenant by migrator today and G110's publication seam
   is still owed. And `FieldSpec.dataClass` is still declared per field;
   **G208** (an outbound payload's class is the maximum over the `FieldSpec`
   classes it carries) and **#173 [E-2]** are unblocked and **not applied** —
   though the maximum itself is now built in one place, on
   `subject_index_entry.data_class`. **The invariant's own sentence is unchanged
   by all of this and must stay so.**
5. **Money is always derived.** `UsageRecord` is immutable and unpriced — which
   is why `metering` is its own resource class: it has **no write mode**, and it
   cannot live in `commercial`, whose defining rule is that a partner may read
   it. A raw usage record is volume in the clear.
6. **Ingested content is data, never instruction.**
7. **Residency survives inference** — `global.*` model routing is rejected outright.
   ⚠️ `resolveModel()` is the only executable enforcement of this, and bare-string
   model identities skip it. **The list of which ones has changed — it is below,
   under "On invariant 7", with the command that derives it.** (This addendum
   used to name `Scorer.model`, `PackBinding.modelOverride` and
   `ProposalActor.agent.modelId`; the last two were branded on 7 Aug 2026 and two
   fields it never named are live bypasses. The invariant's own sentence is
   unchanged and must stay so.)
8. **Being staff is not access.** Reaching a tenant requires a `TenantAccessGrant`
   — and reaching a **class of thing** requires that class to appear in
   `PERMITTED_RESOURCES` or in a signed `SupportAuthorisation`. **`statutory`
   appears in neither, at any price**: a statutory obligation is not the
   customer's to delegate to a processor.

   > 🛑 **AMENDED 7 Aug 2026 — G60. THIS IS THE FIRST INVARIANT REVERSAL IN THE
   > RECORD AND IT IS RECORDED AS ONE.** This invariant read *"`statutory` **and
   > `secret`** appear in neither, at any price: a credential is not the
   > customer's to delegate to a processor any more than a statutory obligation
   > is."* **The product owner decided that the FDE may reach `secret`**, because
   > G56 puts source configuration with the FDE and a source has a credential —
   > so the invariant as written made the FDE's own job structurally impossible.
   > The concern was put in writing before the decision and the decision was
   > reaffirmed; **do not relitigate it, and do not quietly restore the old
   > wording.**
   >
   > **What is gone:** the claim that no staff grant reaches a customer credential
   > at any price. **What survives, and it is not nothing:** `statutory` is still
   > unreachable; and every reach is still a grant, still authorised, still
   > audited.
   >
   > 🛑 **SHAPE SETTLED 8 Aug 2026 — G75, AND IT IS THE BROAD ONE.** This block
   > said the shape was *"NOT settled and the narrow one is strongly preferred"*,
   > and that `secret` was *"still **not** in `PERMITTED_RESOURCES`"*. **Both
   > sentences are now false and are replaced rather than deleted.** The product
   > owner put `secret` into **`PERMITTED_RESOURCES.delivery`** — a **standing
   > 90-day reach** (`MAX_GRANT_HOURS.delivery = 24 * 90`) — not into
   > `CONTRACT_ONLY_RESOURCES`.
   >
   > **The argument against it was put in writing before the decision and is
   > preserved here rather than dropped:** pass A recorded that
   > `PERMITTED_RESOURCES` is *"the single constraint that makes a weeks-long
   > grant acceptable"*, and pass F records the first non-demo customer as a
   > regulated enterprise. **The decision was taken with that in front of it. Do
   > not relitigate it, and do not quietly narrow it back.**
   >
   > ⚠️ **A THIRD LIST GOVERNS THIS AND NO DOCUMENT NAMED IT UNTIL 8 Aug 2026.**
   > `secret` also sat in **`NON_DELEGABLE_RESOURCES`**, which
   > `authorisationPermits()` checks **first — before the null check, before
   > withdrawal, before anything**. G60 as written would have been **inert**:
   > recorded as applied, with the FDE still unable to bind a credential. G75
   > therefore removes `secret` from that list too, leaving `statutory` alone in
   > it. **If you are checking whether a class is reachable, read all THREE
   > constants, not two.**
9. **Only outcome-level scorers may trigger a rollback** — with one deliberate
   exception, `rollbackTriggerForFailedProbe()`, because a safety regression is
   not quality drift. Qualified further by `docs/access-and-agency.md` §10.5:
   **a rollback reverts behaviour, never authority.** Role capabilities stay at
   the narrower of the two versions, or a failed injection probe widens live
   authority unattended.
10. **An act with no authorisation is unrecordable.** `authorize()` mints an
    `AuthorizationGrant` and nothing else does; `AuditEvent`, `DataAccessEvent`
    and `UsageRecord` all carry its id, and `AUTHORIZATION_MAY_BE_ABSENT` says
    which actor kinds may leave it null (one: `system`). This does **not** make
    an unauthorised act impossible — nothing can, against root — it makes one
    visible or detectable, which is strictly more than the model had.
11. **A container is never granted.** `AGENTS_HOLD_ROLES = false` and
    `SOLUTION_IS_GRANTABLE = false`. You may narrow **to** a solution
    (`AssignmentScope.solutionIds`); you may not be granted one, because the
    assembly reaches a `credentialRef` and granting it atomically would confer
    something no grant may confer at any price.

> **Invariants 2 and 8 are being extended, not replaced.** A third access axis —
> `OrgClass` (platform · partner · customer) — plus federation, so customers and
> partners bring their own identity provider and org derives from which
> connection authenticated the session. Nineteen decisions across
> `docs/access-and-agency.md` §8–§10. Read those before touching `model/access.ts`
> or `model/governance.ts`; several claims elsewhere in the record are superseded
> in place, including *"deny is not representable"* (§2, see §8.6).
>
> **And a fourth axis — resource class.** Thirteen classes
> ⚠️ **— SIXTEEN, AND FIFTY-ONE CAPABILITIES SINCE 4 Oct 2026 (G3881's
> `view_run`, carried by `view_exception`; it said FIFTY from 1 Oct 2026): R10, THE OWNER'S,
> added `deal`, `sandbox` and `partner_staff` with six verbs answered on
> `decide()`'s FIFTH arm alone; this sentence said thirteen and forty-four and
> is corrected beside itself rather than rewritten** —
> (`model/governance.ts:141`), joined to the **forty-four** capabilities by
> `CAPABILITY_RESOURCE_CLASS` (derive it — ⚠️ **this said `model/access.ts:556`
> until 19 Sep 2026, the SECOND rotted number on this one citation, and `:556`
> still resolved; the declaration is now a thousand lines further down and the
> number is not restated**), which is a
> `Record<Capability, …>` so an unclassified capability is a compile error.
> ⚠️ **That citation said `:517` until 10 Aug 2026, and `:517` still resolves —
> to a line inside a doc comment.** The declaration moved and the citation
> followed nothing; `tools/check-citations.mjs` cannot catch this class because
> the citation *resolves*. Reproduce:
> `grep -n 'export const CAPABILITY_RESOURCE_CLASS' model/access.ts`.
> (Thirty-four until 7 Aug 2026, when `view_metering` and `view_commercial` were
> minted for two classes that were reachable and empty; **thirty-six until 9 Aug
> 2026, when G128 minted `promote_learning` as the thirty-seventh** —
> `grep -n 'promote_learning' model/access.ts` returns it in `CAPABILITIES`, in
> `CAPABILITY_RESOURCE_CLASS` under `authority`, and in the module's own note —
> ⚠️ **cited as `model/access.ts:549` until 19 Sep 2026 and resolving to
> something else; derive it with
> `grep -n 'until G128 added' model/access.ts` instead**. **Count the array, do not
> trust this line** — it has been wrong twice already, and every other stated count
> in this repository is marked stale in place rather than rewritten for exactly
> that reason.)
> **TWO of the thirteen classes still have no capability**, down from six —
> ⚠️ **THIS SAID FOUR UNTIL 19 Sep 2026 AND THE TWO IT NAMED FIRST ARE THE TWO
> THAT MOVED. G601 gave `substrate` and `catalogue` five verbs between them.**
> The statement below is kept because it is STILL TRUE OF A TENANT CAPABILITY,
> which is the only thing it ever claimed: *`catalogue` and `substrate` are
> deliberate statements (a platform release reaches them, a grant does not, and
> a capability is the currency of grants)*. **G289 built a second instrument
> that spends capabilities and is not a grant**, and the five verbs are
> denominated in that one alone —
> `PLATFORM_ONLY_RESOURCE_CLASSES` names both classes and `decide()` refuses
> them on the customer and partner arms at their first line.
> `schedule` and `telemetry` are the two that remain, and they are open **gaps**
> for different reasons — which is exactly why G601 left them alone —
> `docs/access-and-agency.md` §11.9a argues each class separately.
> `AssignmentScope` has **six** dimensions, not five. Read
> `docs/access-and-agency.md` §11 before touching either module.

**On invariant 7 — the ⚠️ above names three fields and TWO OF THEM ARE NOW
BRANDED.** The text is left as written because `Scorer.model` still skips
`resolveModel()`. **This note has itself been wrong twice** — it previously listed
`MeterPrice.model` at `model/billing.ts:237`, and that line is
`UsageRecord.model`, a different and more important field. **Do not trust the
table below either. Run the command.**

```bash
grep -rnE "\b(model|modelId|modelOverride)\s*\??:\s*string\b" model/*.ts \
  | grep -v '^\S*:[0-9]*: *\*'
```

**It returns FIVE lines — re-run 10 Aug 2026, still five, and the verdicts are
unchanged. One citation moved:**

| Field | | Verdict |
|---|---|---|
| `UsageRecord.model` | `model/billing.ts:238` | ⚠️ **LIVE bypass.** Not dropped — this is invariant 5's own record |
| `PolicySubject` `model_call.model` | derive: `grep -n "type: 'model_call'" model/policy.ts` | ⚠️ **LIVE bypass**, and it was invisible to the previous grep because it sits inside a **union type alias**, not an interface body. ⚠️ **This said `:852` until 10 Aug 2026 and `:894` until 19 Sep 2026, and BOTH still resolved** — `:852` to `\| 'admission_agent_not_permitted'`, a member of a different union. **Twice rotted, twice resolving, so the number is replaced by the grep rather than by a third number** |
| `Scorer.model` | `model/evaluation.ts:158` | Bypass, but `@dropped-for-v1` — declared, not built |
| `ModelCatalogEntry.modelId` | `model/catalog.ts:118` | ✅ **Correctly bare** under rule R1 |
| `resolveModel()` parameter | `model/catalog.ts:185` | ✅ **Correctly bare** under rule R1 |

⚠️ **That last line said `model/catalog.ts:168` until 8 Aug 2026, and `:168` still
resolves — to `| { reason: 'not_in_catalogue' }`, a member of `ModelResolution`.**
The declaration moved and the citation followed nothing; `tools/check-citations.mjs`
cannot catch this class, because the citation *resolves*. **Re-run the grep above
rather than reading the table** — that is the third time a line in this block has
been wrong.

R1: the string **AWS mints** stays a string, because branding a foreign namespace
claims an authority we do not have.

**Branded on 7 Aug 2026 — four fields, all to `ModelCatalogEntryId`:**
`PackBinding.modelOverride` (`domain.ts:2369`), `TokenUsage.model`
(`domain.ts:2745`), `ProposalActor` agent `.modelId` (`domain.ts:3506`),
`AuditActor` agent `.modelId` (`governance.ts:1072`).

⚠️ **ALL FOUR OF THOSE CITATIONS WERE WRONG UNTIL 10 Aug 2026 AND ALL FOUR STILL
RESOLVED.** Previously recorded here, and each pointing at nothing:
`domain.ts:2142` (a bare `}`), `domain.ts:2491` (a comment `*`),
`domain.ts:3194` (`from: ProcedureStepId`) and `governance.ts:964`
(`return false`). `npm run check:citations` reported two of them SUSPECT and was
silent on the other two.

🛑 **AND THREE OF THE FOUR REPLACEMENTS ROTTED IN THEIR TURN BY 16 Aug 2026 —
AGAIN ALL THREE STILL RESOLVING.** `domain.ts:2303` had become
`| { kind: 'time_based'; rampDays: number }`, `:2679` a docblock sentence about
what TypeScript cannot express, `:3382` a docblock sentence about the agent
delegation chain. **Only `governance.ts:1072` held, and it held by luck rather
than by design.** The 10 Aug narration ended *"derive them, do not copy them"* and
the very next reader copied them — including, twice, this file. **Do not add a
line number to this page without asking whether a grep anchor would do instead.**
Derive them:
`grep -n 'modelOverride: ModelCatalogEntryId\|^  model: ModelCatalogEntryId\|modelId: ModelCatalogEntryId' model/domain.ts model/governance.ts`.

**No document may claim the sweep closed E5.** Two live fields still reach a model
without passing the only executable residency check in the codebase.

> 🛑 **THE RUNNING TALLY OF THE RESOLVING-BUT-WRONG CLASS ON THIS PAGE IS NOW
> TWENTY, UP FROM NINE.** The 16 Aug 2026 sweep found **eleven** more, every one
> of them pointing at a real line in a real file:
> `control-plane.openapi.yaml:1188-1201` and `:1612`; `reconciliation.ts:847`,
> `:1015`, `:1030`, `:1044` and `:1062`; `domain.ts:2384`; and the three branded
> replacements `domain.ts:2303`, `:2679`, `:3382`. **`npm run check:citations` was
> EXIT 0 across all eleven and is not broken** — it checks that a citation
> resolves, and all eleven did. **The defect is the line number itself.** Every
> citation added to this page from here should be a grep anchor unless the line is
> the point; where a number survives, it is because the derivation sits beside it.

> ⚠️ **The lesson in this block is bigger than the block.** Two of the four
> branded fields — `TokenUsage.model` and `PackBinding.modelOverride` — were not
> id-shaped names, so `tools/planner/extract.mjs` could not see them and neither
> interface was a graph node at all. **That invisibility is precisely why they
> went unnoticed.** A reference field must be named id-shaped or no tool here can
> count it. `docs/HANDOFF.md` §7.

---

## The three things you can actually verify

⚠️ **THIS SECTION OPENED *"There is no CI"* UNTIL 16 Aug 2026 — a sentence its own
first blockquote had been contradicting since 9 Aug, and which stood at the head of
the section for a week after `.github/workflows/check.yml` landed.** It is corrected
here rather than deleted because it is the sentence a reader meets first and the
one most likely to be quoted onward. **There IS CI**, it runs `npm run check` and
nothing else, and `npm run check` is the one gate.

> 🛑 **AND THE CORRECTION ROTTED IN ITS TURN, IN THE OTHER DIRECTION — G1331,
> 21 Sep 2026. THE SENTENCE *"There IS CI"* IS KEPT ABOVE RATHER THAN DELETED
> BECAUSE IT IS THE ONE A READER MEETS FIRST, AND IT IS NOW MISLEADING IN THE
> WORST OF THE TWO DIRECTIONS.** The 16 Aug banner corrected *"There is no CI"*
> to *"There IS CI"* on the strength of `.github/workflows/check.yml`.
> **That file was RETIRED on 18 Sep 2026 and `.github/` is absent from this
> tree** — `ls -la .github` → *No such file or directory* — and
> `tests/ci/gate.test.ts` now fails **if it exists**.
>
> **WHAT IS EXACTLY TRUE, AND IT IS THE CLAUSE THAT SURVIVED BOTH ROTS:
> `npm run check` IS THE ONE GATE.** G108 is untouched and no sentence below
> about what the gate CONTAINS has moved. What moved is **who runs it**:
>
> - **A PERSON RUNS IT.** That is the whole of the verification surface you can
>   rely on from a checkout, and it is what the three headings below describe.
> - **AWS runs it on a PUSH** — the CodePipeline **Gate** stage,
>   `reconcile-gate-staging` in `000000000000`/`us-west-2`, on G258's ARM CI
>   image. Its two inherited assertions are at `tests/infra/pipeline.test.mjs`.
>   **That is a fact about an account**, and `cdk synth` proving the stage
>   exists is not the same as the stage having run.
> - **NOTHING RUNS IT ON A PULL REQUEST UNLESS AN OWNER TURNED IT ON.**
>   `reconcile-gate-pr-<env>` is behind `-c pullRequestGate=on`, **DEFAULT
>   OFF**, and the stack says so in capitals: *"WITH THE FLAG OFF NOTHING
>   CHECKS A PULL REQUEST."* **Whether it is on in `000000000000` is not
>   determinable from this tree.**
>
> ⚠️ **SO A GREEN PULL REQUEST HERE MAY MEAN NOTHING RAN.** That is not the
> 17 Aug defect below — a runner standing suites down silently — it is one
> layer further out: **no runner at all.** Do not read an absent red X as a
> green gate; run `npm run check` yourself and paste the tail.
> *Corrected 21 Sep 2026 — G1331.*

The three below are the verification surface a *person* drives, and
**you need all three** — the second exists because the first is weak here, and the
third exists because neither of the first two can read a sentence. **All three are
inside `npm run check`**, along with two more checkers and the suite; run the gate,
then run the extractor separately when you have touched `model/`.

> ⚠️ **THIS SECTION SAID "there is no test framework and no CI" AND THE FIRST HALF
> STOPPED BEING TRUE ON 8 Aug 2026.** **G95** took the first exception to the
> standing CI position and put the runner in: `node --test` over `tests/`, with
> `tests/tsconfig.json` **separate** from `model/tsconfig.json`, because
> `model/tsconfig.json` is `"include": ["*.ts"]` and must not be given an
> `extends`. **G96** ends the one-dependency property deliberately —
> `@types/node`, pinned exact — because `tsc` over `tests/` emits
> `TS2307: Cannot find module 'node:test'` without it.
>
> ✅ **G108 — ONE GATE, AND THE SCRIPT HALF IS APPLIED.** ⚠️ **This block said
> *"RULED BUT NOT APPLIED"* and *"running `npm run check` does NOT run the
> tests"*, and told readers to run both. Both sentences went false on 9 Aug 2026
> and are corrected here rather than deleted, because a reader acting on them
> would have concluded the gate was decorative.** `npm run check` **does** run
> the tests, and it runs five checkers, not two. ⚠️ **This read *four* until
> 12 Aug 2026, when the owner ruled `check:c4` into the gate.** Derive it, do not trust this
> line:
>
> ```bash
> node -e "console.log(require('./package.json').scripts.check)"
> #   typecheck && typecheck:server && typecheck:frontend && typecheck:infra
> #   && synth:infra && check:counts && check:citations && check:wire
> #   && check:packs && check:c4 && check:g-numbers && check:absent-rows
> #   && check:migrations && check:annotations && check:clocks
> #   && check:derivations && build:frontend && npm test
#                                                      ← EIGHTEEN stages
> #  ⚠️ SAID SEVENTEEN UNTIL 23 Sep 2026, when `check:derivations` joined under
> #  G2081 — the EIGHTEENTH stage and the ELEVENTH checker, added because two
> #  derivations this page hands out were COUNTING THEIR OWN QUOTATION, and a
> #  circulated summary ran them faithfully and reported "29 / 137 operations
> #  served" against a truth of 30 of 136. Derive it, never read it:
> #  `node -e "console.log(require('./package.json').scripts.check.split('&&').length)"`
> #  🛑 **SEVENTEEN IS A THIRD ANSWER NEITHER PARENT OF THIS MERGE COMPUTED —
> #  §5.11 WITH A SECOND PARENT, ON THE ONE FENCE WHOSE WHOLE SUBJECT IS THAT
> #  IT KEEPS GOING STALE.** One branch (G1332, 21 Sep 2026) swept this fence
> #  and left it at SIXTEEN, correctly, because `check:clocks` did not exist
> #  on it; the other (G1351, G1471) added the stage and reached SEVENTEEN.
> #  **Each was right about the branch that wrote it. BOTH NARRATIONS ARE
> #  KEPT BELOW** — deleting either erases a slice that really landed — and
> #  this headline is re-derived by hand on the merged tree. Derive it, never
> #  read it:
> #    node -e "console.log(require('./package.json').scripts.check.split('&&').length)"
> #  ✅ **AND FROM 21 Sep 2026 IT IS NOT READ BY A PERSON EITHER: `gate stages`
> #  IS A GOVERNED TOTAL IN `tools/check-doc-counts.mjs` (G1471)**, so a stale
> #  figure on this line is a GATE FAILURE rather than something somebody has
> #  to notice. That is the first time in this fence's history that the number
> #  beside the command has been checked by anything.
> #
> #  --- PARENT ONE — G1351/G1471, the stage and the pin -------------------
> #  ⚠️ SAID SIXTEEN UNTIL 21 Sep 2026, when `check:clocks` joined under G1351
> #  — the SEVENTEENTH stage and the TENTH checker, added because a fixture
> #  reading the database's clock against a frozen one had ALREADY FLIPPED
> #  (G1209). Derive it, never read it:
> #  `node -e "console.log(require('./package.json').scripts.check.split('&&').length)"`
> #  ✅ **AND THE FENCE IS NO LONGER PINNED BY A PERSON — G1471, 21 Sep 2026.**
> #  ⚠️ IT READ: *"🛑 AND THIS FENCE IS PINNED BY NOTHING BUT A PERSON FOR
> #  SIXTEEN OF ITS SEVENTEEN STAGES — `docs/build/completion-plan.md` K2
> #  measures that deleting any of eleven of them leaves `npm run check` EXIT 0
> #  with everything green. `check:clocks` is the exception and only because
> #  `tests/tools/check-clock-fixtures.test.mjs` asserts its script name and
> #  its membership of `scripts.check` by hand."* **Every clause of that was
> #  TRUE and is now false, and it is corrected rather than deleted because it
> #  is the sentence K2 was commissioned against.**
> #  🛑 **THE ELEVEN WERE WITNESSED, NOT REASONED.** `npm run check:migrations`
> #  was deleted from `scripts.check`, leaving sixteen stages, and the FULL
> #  gate was run: **EXIT 0 · tests 3320 · pass 3318 · fail 0**, with
> #  `check:migrations` producing no output at all and the skip census
> #  reporting nothing stood down. **A checker leaving the gate was invisible
> #  to the gate.**
> #  ✅ ALL SEVENTEEN ARE PINNED BY `tests/ci/gate-stages.test.ts`, as an
> #  ORDERED `deepEqual` against a list typed into that file — so a deletion,
> #  an addition and a REORDERING are each red. Re-run with the stage deleted:
> #  **3 assertions fail.** ⚠️ AND THE COUNT ITSELF IS DERIVED NOW: `gate
> #  stages` and `checkers` are governed totals in `tools/check-doc-counts.mjs`
> #  (G1471), so a stale figure in prose is a GATE FAILURE rather than a number
> #  somebody remembers to update — which is the whole of K2's argument, and
> #  the reason this fence has been wrong at ELEVEN, FOURTEEN, FIFTEEN and
> #  SIXTEEN. **It caught three stale `checkers` lines on its first run**, in
> #  `README.md` and twice in `docs/HANDOFF.md`.
> #
> #  --- PARENT TWO — G1332, and ITS ORDER FINDING IS STILL LIVE ------------
> #  ⚠️ **THIS PARENT'S HEADLINE READ *"← SIXTEEN stages"* AND ITS TRANSCRIPTION
> #  ENDED `&& check:migrations && check:annotations && build:frontend && npm
> #  test`. Both were CORRECT on the branch that wrote them and neither is
> #  correct about this tree**, which is why the headline above is derived and
> #  not taken from either side. **The rest of the block is kept whole, and the
> #  finding in its second half is NOT history — it is still true here:**
> #  🛑 THE WORD ABOVE IS DERIVED BY NOTHING AND IS NOT A SEVENTEENTH
> #  NUMBER'S PROBLEM TO FIX — G1332, 21 Sep 2026. `check-doc-counts` governed
> #  no stage count when that was written, so every value this fence had
> #  carried was checked by a person, and by its own tally below it has been
> #  wrong at least three times. THE NUMBER IS NOT SWEPT TO A BETTER ONE. Run
> #  the command:
> #    node -e "console.log(require('./package.json').scripts.check.split('&&').length)"
> #  🛑 **AND THE TRANSCRIPTION ABOVE IS STILL STALE IN A WAY NO COUNT CAN SEE,
> #  ON THIS TREE, TODAY: THE STAGES ARE THE RIGHT SEVENTEEN, IN THE WRONG
> #  ORDER.** The tree runs `check:g-numbers && check:migrations &&
> #  check:absent-rows`; the block above says `check:g-numbers &&
> #  check:absent-rows && check:migrations`. *The number agreed and the order
> #  did not* — the 16 Aug 2026 capability row's shape arriving on a pipeline,
> #  where it matters because these stages are sequential and the FIRST failure
> #  is the one a reader is shown. **`gate stages` being governed does not
> #  close this**: the checker counts the stages and cannot read their order.
> #  THE TRANSCRIPTION IS LEFT AS THE HISTORY IT IS; the command is the claim.
> #  ⚠️ **THIS BLOCK'S LAST CLAUSE READ *"PINNING THE STAGES SO THIS FENCE
> #  CANNOT ROT AGAIN IS A CONTROL NOBODY HAS BUILT (the completion plan calls
> #  it K2). It is NOT built here."* — TRUE WHEN WRITTEN, FALSE ON THIS TREE,
> #  and corrected rather than deleted because it is the sentence K2 was
> #  commissioned against.** `tests/ci/gate-stages.test.ts` is that control and
> #  it arrived on the other parent of this merge.
> #  ⚠️ SAID FIFTEEN UNTIL 19 Sep 2026, when `check:migrations` joined under
> #  G356 — the SIXTEENTH stage and the NINTH checker, added because two agents
> #  each numbered a migration `0011` and `git merge` produced BOTH WITH NO
> #  CONFLICT. ⚠️ SAID FOURTEEN BEFORE THAT, when `check:annotations` joined
> #  under G200. Derive it, never read it:
> #  `node -e "console.log(require('./package.json').scripts.check.split('&&').length)"`
> #  🛑 THIS COMMENT SAID "ELEVEN" AND THE SCRIPT ALREADY HAD TWELVE BEFORE THE
> #  infra/ SLICE TOUCHED IT — check:absent-rows landed and nothing followed it
> #  here. The 12 was not this commit's to make stale and is named so the sweep
> #  is not read as accounting for all three. DERIVE IT; this fence has now been
> #  wrong twice and is checked by nothing but a person.
> ls tools/*.mjs | wc -l    # 12 files — 10 CHECKERS, plus citation-symbols.mjs
> #                          (a shared module) and skip-census.mjs (a REPORTER)
> #  ⚠️ **THIS SAID "10 files — 8 CHECKERS" UNTIL 21 Sep 2026 AND BOTH HALVES
> #  WERE WRONG, WHICH IS THE FIFTH TIME FOR THE FILE COUNT AND THE THIRD FOR
> #  THE CHECKER COUNT.** `check-migration-numbers.mjs` and
> #  `check-clock-fixtures.mjs` had both landed as checkers, both were in the
> #  gate, and neither moved this line.
> #  ✅ **NEITHER NUMBER IS A PROSE CLAIM ANY MORE: `checkers` IS A GOVERNED
> #  TOTAL (G1471)**, derived from the `check:*` scripts rather than from a
> #  directory listing, so this half is a gate failure when it goes stale.
> #  **The FILE count is still governed by nothing** — deliberately, because a
> #  file in `tools/` is not a checker and the two must not be conflated.
> #  ⚠️ said 4 until 12 Aug 2026, 5 until 17 Aug 2026, 7-files-5-checkers until
> #  22 Aug 2026 and 8-files-6-checkers until 19 Sep 2026 — every one of those
> #  was wrong when written, AND THE LAST ONE WAS WRONG IN BOTH HALVES BEFORE
> #  `check:annotations` EXISTED: check-absent-rows.mjs had already landed as a
> #  checker and nothing here followed it. Count the CHECKERS by name; the FILE
> #  count has now been a wrong proxy five times. DERIVE THE CHECKERS:
> #  `node -e "console.log(Object.keys(require('./package.json').scripts).filter(k=>k.startsWith('check:')).length)"`
> ```
>
> ⚠️ **The comment above omitted `typecheck:server` until 16 Aug 2026, and the
> sentence below said *"type-checks BOTH projects"*.** The omission arrived with
> `server/` in `#182` and is corrected rather than deleted, because a reader who
> copied that comment into a script would have shipped a server the gate never
> compiled.
>
> 🛑 **AND IT HAPPENED A THIRD TIME, LARGER, AND THIS BLOCK SAID *"three
> TypeScript projects"* UNTIL 22 Aug 2026. THERE ARE FOUR.** The fourth is
> **`frontend/tsconfig.json`**, and the gate compiles it AND builds it —
> `typecheck:frontend` and `build:frontend`, two of the three stages the comment
> above had also lost. The quoted `scripts.check` was **EIGHT** stages against a
> real **ELEVEN**. Derive both, never read them:
>
> ```bash
> node -e "console.log(require('./package.json').scripts.check)"
> git ls-files | grep tsconfig        # 5 — frontend · infra · model · server · tests
> ```
>
> 🛑 **AND A FOURTH TIME, 18 Sep 2026: THERE ARE FIVE.** The fifth is
> **`infra/tsconfig.json`** (**G259**), and the gate compiles it AND SYNTHESISES
> it — `typecheck:infra` and `synth:infra`. The line above said **4** and the
> paragraph above says *"THERE ARE FOUR"*; the sentence is left standing as the
> history it is and corrected here, which is what this page does with every other
> claim that went false because work landed. **`infra/` carries the same seven
> compiler options and `extends` nothing, like the other four** — and
> `tests/infra/manifest.test.mjs` asserts that parity in BOTH directions, so the
> five drifting apart is a red gate rather than a thing a person notices.
>
> 🛑 **THE OMISSION IS TOTAL, AND IT IS THE WORST SINGLE FACT ON THIS PAGE:
> `grep -c 'frontend' CLAUDE.md` RETURNED `0`.** An entire application root — 22
> tracked files, React + Vite, in the gate twice — was named **nowhere** on the
> page that governs how code is written here. It was the ONLY unnamed top-level
> tracked entry of the **22** the tree then carried — ⚠️ **the tree carries
> **19** at 19 Sep 2026, and the 22 is left as the history it is: the loop
> below is the control, and it answers for whatever the tree holds on the day
> it is run.** Reproduce the check itself, which is now the cheapest
> control this page could carry:
>
> ```bash
> for d in $(git ls-files | awk -F/ '{print $1}' | sort -u); do
>   grep -q -- "$d" CLAUDE.md || echo "UNNAMED: $d"; done
> ```
>
> **This is the third instance of the class the 16 Aug banner named — an absent
> directory has no number in it, so `check-doc-counts` was EXIT 0 throughout —
> and it is the second time an APPLICATION went unnamed.** *Corrected 22 Aug 2026.*
>
> `npm test` is itself `typecheck:tests && node --test` over `tests/**`, so the
> single command type-checks all FIVE projects, runs every checker, BUILDS THE
> FRONTEND, SYNTHESISES THE CDK APP and runs the suite. ⚠️ **This said *"all
> three projects"* and omitted the build until 22 Aug 2026** — `build:frontend`
> runs a Vite build and an SSR prerender inside the gate, which is a materially
> larger thing than a typecheck and was not stated anywhere. ⚠️ **And it said
> *"all FOUR projects"* until 18 Sep 2026**, when `infra/` landed and
> `synth:infra` joined the gate under **G259** — `cdk synth` is another
> materially larger thing than a typecheck, and it is deterministic and offline
> by construction rather than by hope: no construct performs a context lookup,
> `--no-lookups` is passed anyway, and `tests/infra/manifest.test.mjs` asserts
> both.
> ⚠️ **"every checker" went false on 12 Aug 2026 when the fifth checker landed
> outside the gate, and went TRUE AGAIN the same day when the owner ruled the
> wiring. Both movements are recorded rather than overwritten, because a reader who
> arrived between them was told the gate was incomplete and was right.**
> `tools/check-c4-freshness.mjs` **is** in `npm run check` now, as `check:c4`. The
> condition G108 attaches was **measured, not asserted** — three consecutive runs at
> ~0.6s wall with byte-identical output — and the checker was **witnessed RED
> first**, because a checker added to the gate without a demonstrated red is §5.6
> wearing a different hat. That condition still governs every addition: **each
> checker must be deterministic and fast**, because the gate slows as checkers
> accumulate and one flaky checker blocks everything.
>
> ⚠️ **One honest caveat on what green means.** `tests/db/tenant-isolation.test.ts`
> carries `{ skip }` on its one `describe` (⚠️ **cited as `:134` until 19 Sep
> 2026 and resolving to another line; derive it —
> `grep -n "describe('tenant isolation" tests/db/tenant-isolation.test.ts`**)
> and skips loudly
> when no local Postgres answers. A green `npm run check` on a machine with no
> database is **not** evidence that tenant isolation holds — the test file says so
> in its own header. ⚠️ **What changed on 16 Aug 2026 is WHY it skips, and the
> improvement is real but partial.** It used to skip partly because the driver was
> not installed at all; `pg` is now a pinned runtime dependency, so `npm ci`
> installs it and the missing piece is only the **server**. `compose.yaml` stands
> one up. The skip is therefore now a statement about the machine rather than
> about the manifest — but a green run on a machine with no Postgres still proves
> nothing about isolation, and that half is unchanged.
>
> 🛑 **17 Aug 2026 — THE CAVEAT ABOVE APPLIED TO CI AND NOBODY HAD MADE IT COST
> ANYTHING THERE, AND A RED TRUNK WAS MERGED THROUGH THE GAP.**
> ⚠️ **READ THE NEXT SENTENCE IN THE PAST TENSE — G1331, 21 Sep 2026.** It is
> written in the present and `.github/workflows/check.yml` **no longer exists**;
> it is left in its own tense because this block is a statement about the tree
> of 17 Aug 2026 and rewriting it would destroy the reasoning. **The three
> repairs it describes are INSIDE `npm run check` and every one of them still
> runs** — that is exactly why they survived the workflow's retirement.
> `.github/workflows/check.yml` runs on `[self-hosted, reconcile]`, which has
> neither a PostgreSQL nor a browser binary. PR #257 merged a trunk its own body
> records as `npm run check` EXIT 1, because its CI check reported SUCCESS while
> `describe('the engine over HTTP', { skip })` stood down entirely; run
> 31961439743 was reported `success` with **seven** test databases unreachable
> and no chromium. **Three things now sit against that, and all three are inside
> `npm run check` — no workflow step was added, G108 is untouched:**
>
> · **`tests/reachability.ts`** — `databaseRequiredUnderCi()` and
>   `browserRequiredUnderCi()`, called at the TOP LEVEL of every dependent suite,
>   OUTSIDE every `describe`. A guard inside a skipped suite is never registered.
>   Both are conditioned on `CI`, deliberately: a contributor with neither
>   dependency still gets a runnable suite, and `npm ci && npm run check` on a
>   clean checkout with no Postgres and no chromium is **verified EXIT 0**.
> · **`tests/ci/reachability-guards.test.ts`** — the guards spawned over a failed
>   probe with `CI` set and unset, both outcomes demanded, plus an AST check that
>   every dependent suite calls its guard at the top level. The next suite
>   somebody adds cannot skip silently without failing this.
> · **`tools/skip-census.mjs`** — because **`skipped N` IS NOT THE NUMBER OF
>   ASSERTIONS THAT DID NOT RUN.** `describe(…, { skip })` never invokes its
>   callback, so its children are never created and never counted. Measured on
>   this tree: pointing the database at a dead port and the browser path at an
>   empty directory moved `tests` by **89** and `skipped` by **4**. The census
>   joins the runner's own skipped-suite events to a TypeScript-AST walk of each
>   suite's callback and prints the real figure at the end of the gate output.
>
> ⚠️ **A green `npm run check` is still not evidence about isolation or about the
> hatch on a machine that has neither dependency — that sentence has not moved.
> What moved is that the SAME run under `CI` is now RED rather than green.**
>
> ⚠️ **And what the tests found on their first day is the argument for having
> them.** Three of the sixteen modules — `agents.ts`, `examples.ts`,
> `observability.ts` — could not be **loaded** by Node at all, because each
> carried an extensionless **value** import; the other thirteen loaded only
> because every inter-module import in them is `import type`, which
> `verbatimModuleSyntax` erases before the loader sees it. **`tsc` was green
> throughout and cannot see this class.** Value imports inside `model/` are
> written `./access.ts`, with `allowImportingTsExtensions` in the tsconfig.

**1. The typecheck.**

```bash
npx -y typescript@5.9.3 tsc -p model/tsconfig.json --noEmit; echo "EXIT: $?"
```

It must print `EXIT: 0`. All **25** modules (`ls model/*.ts | wc -l`; ⚠️ **this
said *sixteen* until 10 Aug 2026, *18* until 22 Aug 2026, *20* until 23 Aug 2026
and *22* until 19 Sep 2026 — the *18* was already two behind when the 22 Aug
sweep found it, the *20* was two behind again a day later, and the *22* was
three behind when G286 found it, which is why the command sits beside
it**) compile under `strict`,
`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`,
`verbatimModuleSyntax`, `noUnusedLocals` and `noUnusedParameters` — **stricter
than the replaced application ever ran.**

> **Trap that costs people an hour.** `cd` inside a compound Bash command
> silently swallows this. `mkdir … && cd … && tsc …` does not run the compiler
> and does not tell you it did not — it returns a status that looks like success.
> Run the compiler as **its own command**, with **absolute paths**, and read the
> `EXIT:` line.
>
> **The same trap, one layer out: piping it returns the PIPE's status.**
> `tsc … | head` reports `head`'s exit code, which is 0. Capture it unpiped.
>
> `model/tsconfig.json` is standalone: no `extends`, no `references`,
> `include: ["*.ts"]`. Do not give it an `extends`. It is verified to compile
> with no `package.json`, no `node_modules` and no root tsconfig present.
>
> ⚠️ **THIS SUBSECTION DESCRIBED ONE TYPECHECK UNTIL 16 Aug 2026 AND THERE ARE
> THREE.** `tests/tsconfig.json` arrived with G95 and `server/tsconfig.json` with
> G191 in `#182`; all three carry the same `compilerOptions` and each has its own
> `include`, deliberately — none of the three `extends` another, so the standalone
> property above survives for `model/` and is bought at the cost of three copies
> that must be edited together. **`server/` and `tests/` are NOT standalone in the
> sense `model/` is**: both resolve `@types/node`, and `server/` additionally
> resolves `fastify`, `pg` and `yaml`, so neither compiles without
> `node_modules`. The single command that runs all three is `npm run check`:
>
> ```bash
> npm run typecheck && npm run typecheck:tests && npm run typecheck:server
> ```

**2. The model graph.**

```bash
node tools/planner/extract.mjs            # report only — writes NOTHING
node tools/planner/extract.mjs --write    # also updates docs/model-graph.json
```

⚠️ **A green `tsc` is WEAK evidence in this repository and you must not rely on it
alone.** The model is types only — nothing assigns values, so most changes
*cannot* fail to compile. In an earlier slice `tsc` was green for months while 18
of 172 edges resolved to nothing; the extractor caught it. Report **edges by kind**
and **gaps by kind** after any model change, and compare against the previous run.

The committed `docs/model-graph.json` records **156 nodes · 286 typed
edges, 286 resolving, 0 dangling · 17 bare id-shaped fields · 51 capabilities ·
16 resource classes · 154 contract operations · 161 gaps**. ⚠️ **`150 contract
operations` UNTIL 5 Oct 2026 (G4301)** — the control plane's four internal
operations; no gap kind moved, re-run with `--write`. ⚠️ **THIS SAID
160 GAPS UNTIL 4 Oct 2026 (G4201)**: `model/publication.ts` adds ONE
`types_without_operations` gap, because no contract operation reaches the seam
— G4204 is the ruling that would give it one. Derive any of them
without re-running the extractor:

> ⚠️ **`149 contract operations` UNTIL 4 Oct 2026 (feat/document-type-labels,
> G3941) and correct when written** — the hundred-and-fiftieth is
> `listDocumentTypes`. Re-run with `--write` on the tree merged with #579; no
> node, edge or gap kind moved, because an operation reaching an existing
> capability (`view_endpoint`) closes no gap and opens none.

> ⚠️ **RE-DERIVED WHOLE ON 4 Oct 2026 ON integrate/4oct-j's MERGED TREE, WITH
> `--write`.** It said `153 · 278 · 50 capabilities · 136 contract operations ·
> 167 gaps`, the 1 Oct figure, and every number but the bare-field and
> resource-class counts had moved under work this line never followed. The one
> THIS merge moved is `capabilities` 50 → **51**: `view_run` (G3881, the owner's
> G3802 ruling), CARRIED by `view_exception` and in no partner scope.

> ⚠️ **RE-DERIVED WHOLE ON 1 Oct 2026 UNDER R10 WITH `--write`, AGAINST THE
> WORKING TREE, AND THE ARTEFACT, THIS LINE AND THE TREE AGREE AGAIN.** It said
> `150 · 270 · 44 capabilities · 13 resource classes · 163 gaps`, and that line
> was ALREADY stale before R10 — the block below records the three-way
> disagreement since 20 Sep 2026. The committed artefact R10 found said
> `151 nodes · 160 gaps`. **What R10 itself moved, by kind:**
> `capability_without_contract` 21 → **27** (six verbs minted, and no operation
> names one — every partner op they fit is TABLE-BLOCKED and stays `exempt:`);
> `entity_unreferenced` 51 → **52** and `types_without_operations` 18 → **19**
> (`model/access.ts` §6c's portal-role types, reached by no contract tier yet);
> nodes 151 → **153** (`PartnerRole`, `PartnerRoleAssignment`).
> `module_specified_not_written` 4 → **3** is NOT R10's — it is the stale
> artefact catching up with modules other slices landed — and is named so this
> sweep is not read as accounting for it. `resource_class_without_capability`
> stays **2**: all three new classes arrived WITH verbs, so `schedule` and
> `telemetry` are still the two.

> 🛑 **THIS LINE, THE COMMITTED ARTEFACT AND THE TREE ARE THREE DIFFERENT
> ANSWERS AS OF 20 Sep 2026, AND THE `write_commercial` SLICE MOVED NONE OF
> THEM — it adds no module, no capability and no operation, and the extractor
> run against `git archive HEAD` in a scratch tree is BYTE-FOR-BYTE the run
> against its working tree.** Named here rather than swept, because it is not
> this slice's to sweep and naming it is what stops the next reader treating
> one sweep as having accounted for all three:
> · **this line** says `150 nodes · 270 edges · 163 gaps`;
> · **`docs/model-graph.json`** says `151 · 289 · 164`, with
>   `capability_without_contract: 27`;
> · **the TREE at `HEAD`** says `151 · 272 · 158`, with
>   `capability_without_contract: 21`.
> **The artefact is stale because G781's console split ANNOTATED 14 operations
> and did not regenerate** — a capability counts as reaching a contract when an
> operation names it, so six stopped being gaps and the committed file never
> heard. ⚠️ **NOTHING IN `npm run check` READS THE GRAPH**, which is why all
> three could disagree at EXIT 0; `check-doc-counts` reads the TREE. Whoever
> next touches `model/` or `docs/contracts/` owes
> `node tools/planner/extract.mjs --write` and a whole-line re-derivation —
> **not a one-field sweep**, which is the failure the paragraph below this
> block records.

> ⚠️ **RE-DERIVED WHOLE ON 19 Sep 2026 UNDER G656–G660 RATHER THAN SWEPT ONE
> FIELD AT A TIME.** It said `161 gaps` and every other figure was CORRECT.
> **Exactly one gap kind moved and reading the total alone would have hidden
> which:** `types_without_operations` 15 → **16**, because `model/approval.ts`
> declares types no contract tier reaches — the extractor saying out loud the
> thing the module says in prose, rather than letting a new module arrive
> unremarked. 🛑 **`nodes`, `edges` and `bare id-shaped fields` DID NOT MOVE**:
> the module declares no id-shaped field and no branded id, so the extractor
> cannot see it — which is the blind spot the paragraph four below this one
> warns about, arriving in the same commit that quotes it. ⚠️ **`contract
> operations` did not move either**, and that is the honest shape of this
> slice: six operations were MOUNTED and none was DECLARED.
> ⚠️ **RE-DERIVED WHOLE ON 19 Sep 2026 UNDER G692 RATHER THAN SWEPT ONE FIELD
> AT A TIME.** It said `161 gaps`. **SEVEN OF THE EIGHT FIGURES DID NOT MOVE
> AND THAT IS THE INTERESTING HALF**: `model/run-admission.ts` declares no
> interface with an id-shaped field and no branded alias, so the extractor
> cannot see it at all — the blind spot the paragraph four below this one
> warns about, arriving in the same commit that quotes it. **The one gap kind
> that moved is `types_without_operations`, 15 → 16**, because the module's
> types reach no contract tier: `admitRun` publishes `RunAdmission` and `Run`,
> which are `capability.openapi.yaml`'s own schemas, and the cascade's
> refusal union reaches the wire only as three closed error codes.
> ⚠️ **`capability_without_contract` DID NOT MOVE EITHER, AND IT WOULD HAVE
> BEEN A MISTAKE TO EXPECT IT TO: this slice mints no capability and declares
> no operation.** It MOUNTS two that were already declared and already
> annotated, which the extractor cannot distinguish from unmounted — the
> served count is `grep -rn 'handlers:' server/*/start.ts`, and the graph has
> never been able to answer it.

> ⚠️ **RE-DERIVED WHOLE ON 19 Sep 2026 UNDER G601 RATHER THAN SWEPT ONE FIELD
> AT A TIME**, which is what the paragraph below this block asks for. It said
> `39 capabilities · 158 gaps`. **`nodes`, `edges` and `bare id-shaped fields`
> did NOT move**: G601 adds no interface and no id-shaped field, only five
> members of an existing const and one derived predicate — the extractor's own
> blind spot, arriving in the same commit that quotes it. **TWO GAP KINDS MOVED
> IN OPPOSITE DIRECTIONS and reading the total alone would have hidden both:**
> `capability_without_contract` 22 → **27**, because five verbs were minted and
> no contract operation names one (G602 measures why the annotation is
> all-or-nothing and therefore blocked); and
> `resource_class_without_capability` 4 → **2**, because `substrate` and
> `catalogue` now carry verbs. The two remaining are `schedule` and
> `telemetry`, which `model/governance.ts` records as GAPS rather than
> statements — which is exactly why G601 did not touch them.

> ⚠️ **THE WHOLE LINE WAS RE-DERIVED ON 19 Sep 2026 UNDER G535/G536 RATHER THAN
> SWEPT ONE FIELD AT A TIME, WHICH IS WHAT THE PARAGRAPH BELOW THIS BLOCK ASKS
> FOR.** It said `135 contract operations · 159 gaps`. Two things moved and they
> moved in opposite directions, which is why reading the total alone would have
> been useless: `types_without_operations` 14 → **15**, because
> `model/onboarding.ts` declares types no contract tier reaches and the
> extractor says so rather than letting a module arrive unremarked; and
> `no_administration_tier` **1 → 0**, which is **G536 — a gap that had asserted
> `administration.openapi.yaml does not exist` on every run since the day G288
> created that file.** It was pushed unconditionally and could not close.
> `nodes`, `edges` and `bare id-shaped fields` did NOT move: `model/onboarding.ts`
> declares no id-shaped field, so the extractor cannot see it — which is the
> blind spot the paragraph four below this one warns about, arriving in the same
> commit that quotes it. ⚠️ **`at HEAD` IS DROPPED FROM THIS SENTENCE**: the
> figures are the WORKING TREE's, re-run with `--write`, and the standing rule
> is that you report which of the two you ran.

> 🛑 **THIS LINE SAID 142 · 250 · 15 · 72 · 152 UNTIL 19 Sep 2026 AND SIX OF THE
> EIGHT FIGURES WERE ALREADY WRONG BEFORE G289's ARM TOUCHED `model/`.** Measured
> rather than asserted: the extractor run against `HEAD` — `git archive HEAD` into
> a scratch tree, then `node tools/planner/extract.mjs` — reported **148 nodes ·
> 266 typed edges · 17 bare id-shaped fields · 135 contract operations · 158
> gaps**. G289 moves it 148 → **150** and 266 → **270** (`PlatformRole`,
> `PlatformRoleAssignment` and `HeldPlatformAssignment`, plus the
> `PlatformRoleAssignmentId` brand), and `entity_unreferenced` 49 → **50**,
> because nothing references a platform assignment yet — which is the extractor
> saying out loud the thing §6a says in prose: **there is no producer.**
> **The six stale figures were not this commit's to make stale** and are named so
> the sweep is not read as accounting for them; `contract operations` alone was
> SIXTY-THREE behind, from G288's administration tier. **`check-doc-counts` reads
> the TREE and not the graph, so every one of them sat here with the gate EXIT 0.**
> Re-run the derivation and replace the whole line; do not sweep it one field at a
> time, which is the failure the paragraph below this block records.

> ⚠️ **THIS LINE WAS A MERGE CONFLICT AND NEITHER SIDE WAS TAKEN — INCLUDING ON
> THE FIGURE BOTH SIDES AGREED ON.** Both branches swept it and each was right
> only about its own half: this branch read **37 capabilities** because
> `view_endpoint` did not exist here, and trunk read **38** because #194 landed
> it. **Both said 166 gaps, and both were wrong.** The extractor was re-run on
> the MERGED tree and every number above is its output: the true figure is
> **167**, because `types_without_operations` goes 9 → **10** — `model/connectors.ts`
> declares types that reach no contract tier, and the extractor says so rather
> than letting a new module arrive unremarked. Taking either side's text would
> have understated the record's largest single gap. `capability_without_contract`
> is **38**, following the capability count: minting a capability and publishing
> no operation for it widens that gap by exactly one.
>
> 🛑 **AND THE SENTENCE BELOW ABOUT A SIDE EFFECT IS FALSE — IT COST THIS MERGE A
> WRONG NUMBER BEFORE IT WAS CAUGHT.** `node tools/planner/extract.mjs` **does
> not** rewrite `docs/model-graph.json`; it prints `NOTHING WRITTEN. Use --write
> to update docs/model-graph.json.` and exits 0. A run without `--write` leaves
> the stale committed graph in place, so deriving counts from the JSON straight
> after an apparently successful run reproduces the OLD figures — which is
> exactly how 166 survived. **Use `node tools/planner/extract.mjs --write`, or
> read the numbers off the extractor's own stdout rather than the file.**
> **`docs/model-graph.json` was the other conflict and neither side was taken
> there either: it is regenerated from the merged tree.**
>
> ⚠️ **AND THE SAME THING HAPPENED ONE MERGE LATER — `origin/main` into
> `feat/authorisation-pass`, 16 Aug 2026 — so the paragraph above is now history
> and its figures are dead.** The graph was regenerated from that merged tree and
> the line at the top of this block is its output: **39 capabilities** (both
> `admit_source` and `view_endpoint`, which is the whole of what the merge did to
> the roster) and **152 gaps**, not 167. `capability_without_contract` is **23**,
> not 38 — the authorisation pass annotated all 72 operations with
> `x-capability` (⚠️ **that 72 was right when written and the tree now says 76**,
> the session tier's four having arrived on 23 Aug 2026 annotated `exempt:`
> rather than with a capability — they widen the denominator and narrow no gap),
> and the extractor counts a capability as reaching a contract
> when an operation names it. **A gap total falling is not a gap total drifting**;
> re-run `node tools/planner/extract.mjs --write` and read its stdout rather than
> either paragraph.

```bash
node -e "const g=require('./docs/model-graph.json');\
const k={};for(const e of g.edges)k[e.kind]=(k[e.kind]||0)+1;\
const q={};for(const x of g.gaps)q[x.kind]=(q[x.kind]||0)+1;\
console.log(g.nodes.length,'nodes',k,g.gaps.length,'gaps',q)"
```

⚠️ **This line said 140 · 249 · 13 · 36 capabilities · 65 · 154 gaps, dated
"7 Aug 2026 after G46 and G47", until 10 Aug 2026** — and then said 140 · 249 ·
13 · **37** · 65 · **162** until 16 Aug 2026, **which was a partial sweep and is
the more instructive of the two failures.** On 10 Aug only the two figures a
reader had noticed moving were swept; the other four were left, and the block
immediately below already contained their correct values, written down, as a
prediction. **The page held the right numbers and the wrong numbers three
paragraphs apart for six days.** Do not sweep a derived line one field at a time —
re-run the derivation and replace the whole line, which is what the one-liner
above is for. **Eight gap kinds, and the one to read is unchanged:**
`module_specified_not_written` is **7** — `connections`, `execution`,
`held-work`, `ingestion`, `matching`, `money`, `session`. **Four are new —
`execution`, `held-work`, `ingestion`, `session`** — minted by design records
committed at `ac75f80a` that name modules **which do not exist in `model/`**.
A gap of that kind is a document promising a file. Reproduce with the one-liner
above, or:
`node -e "for(const x of require('./docs/model-graph.json').gaps) if(x.kind==='module_specified_not_written') console.log(x.subject, x.evidence)"`

✅ **RESOLVED 16 Aug 2026 — AND THE RESOLUTION IS THE INTERESTING PART.** This
block read: 🛑 *"THE EXTRACTOR READS THE WORKING TREE, NOT `HEAD`, AND THAT
MATTERS RIGHT NOW.* A run on 10 Aug 2026 against an uncommitted tree reported 142
nodes · 250 typed edges · 15 bare id-shaped fields · **70 contract operations** ·
165 gaps — because a concurrent session holds an unstaged `model/` change and an
untracked fourth contract file. **The numbers above are the ones that belong beside
a commit made against `HEAD`.**"

**Those five predicted figures are now the COMMITTED ones, exactly** — 142 · 250 ·
15 · 70 · 165, verified by `node tools/planner/extract.mjs` against `origin/main`
on 16 Aug 2026 and identical to `docs/model-graph.json` at `f17eaba5`. The
concurrent session's work landed; the prediction was right; **and the line above it
went on stating 140 · 249 · 13 · 65 · 162 for six days afterwards.** The block that
warned about the gap outlived the gap and then hid it. **Both halves are swept
here.** The standing rule the block existed to state is unchanged and still binds:
the extractor reads the **working tree**, so always report which of the two you
ran.

⚠️ **This read: *"`node tools/planner/extract.mjs` rewrites `docs/model-graph.json`
as a side effect — running it dirties the tree."* THAT WAS TRUE AND IS FIXED AS OF
12 Aug 2026.** The bare command now REPORTS AND WRITES NOTHING; `--write` (or
`npm run graph`) updates the artefact. The side effect mattered more than it looked:
`npm test` executed the extractor too, so every suite run dirtied a committed file,
and contributors learned to ignore `M docs/model-graph.json` — which is exactly how
the committed copy stayed stale for days while this record kept warning about it.

**These figures are the counts no tool here checks** —
`check-doc-counts.mjs` below reads the tree, not the graph, so a stale graph line
fails silently. Run the extractor and compare **gaps by kind**, not just the total.

⚠️ **The extractor has a large blind spot and its silence is NOT evidence of
absence.** It indexes id-shaped field names (`fooId`, `fooIds`, `id`) and branded
`Id<'…'>` aliases — nothing else. It cannot see a union member, a `Record` re-key,
a non-id-shaped column, a `@dropped-for-v1` note, an exported type alias, an
OpenAPI schema or an enum member. **Name a reference field id-shaped** —
`askedByUserId`, not `askedBy` — or no tool here can count it.
`docs/HANDOFF.md` §7 has the worked example.

**3. The document counts.**

```bash
node tools/check-doc-counts.mjs           # exits 1 on any STALE line
node tools/check-doc-counts.mjs --derive  # the derived counts alone
```

Added 7 Aug 2026. It derives fourteen governed totals from the tree — modules,
capabilities, resource classes, retention classes, policy kinds, scope dimensions,
visuals, exports, dropped exports, dropped markers, contract operations, contract
paths, error codes, invariants — and reports every Markdown line that states one
and disagrees. **Run it before you write a count anywhere, and before you trust
one you are reading.** Its first run caught the reproduction block at the top of
*this* file claiming 665 exports when the tree then said 675.

⚠️ **It classifies; it does not fix.** This record narrates its own corrections
deliberately, so a line disagreeing with the tree is often correct as written:
`STALE` fails the run, `HISTORICAL` is reported and never fails. **Do not
bulk-edit the HISTORICAL list** — every line in it was read and each is right.
⚠️ **This sentence said *"the fourteen currently in it"*; the run on 8 Aug 2026
evening reported **19**, and the number moves every time the record narrates
another correction. Read the run, not this line.** And it checks **numbers only**: it cannot see a stale claim with no
number in it, a wrong `file:line` citation, a drop note on the wrong declaration,
a graph count, or a contract enum drifted from the model.

## Writing model code

- `verbatimModuleSyntax` — type-only imports **must** use `import type { … }`.
- 🛑 **A VALUE import inside `model/` must carry the `.ts` extension** —
  `import { narrowestScope } from './access.ts'`. Node's ESM resolver does not add
  one, and on 8 Aug 2026 three of the sixteen modules could not be loaded at all
  for exactly this reason while `tsc` stayed green. `import type` specifiers are
  erased before the loader sees them, so they hide the problem rather than avoid
  it. `model/tsconfig.json` carries `allowImportingTsExtensions` for this.
- `erasableSyntaxOnly` — no enums, no namespaces, no parameter properties. Use a
  const object plus a union type.
- `noUncheckedIndexedAccess` — indexing yields `T | undefined`. Handle it.
- Avoid `any`.
- Prefer a total `Record<K, V>` over a lookup function when the key set is
  closed. An unhandled member then becomes a compile error rather than a runtime
  surprise — `CAPABILITY_RESOURCE_CLASS` and `TOOL_EFFECT` both exist for this.
- ⚠️ **But a total `Record` only bites where something CONSTRUCTS one, and in a
  types-only model nothing does.** Five total records landed on 7 Aug 2026 with
  **no construction site anywhere**, so `tsc` could not have failed on a single
  field chosen. Compile-time assertions hold the *shape*; only a fixture witnesses
  the *content*. If you add a field or a key and `tsc` stays green without you
  changing anything else, **the compiler told you nothing** — say so rather than
  reporting a green run as verification. `docs/HANDOFF.md` §5.10.
- 🛑 **`AssertNoTextDeep` BANS THE TYPE `string` AT A PROPERTY POSITION — NOT
  STRING-BEARING VALUES. Read this before citing it as proof of compile-time
  containment, because this page's own controls lean on it.** Declared in
  `model/reconciliation.ts`; **24 live assertion sites** rest on it, including
  the reader-seam proofs `_ReaderVerdictHoldsNoTextDeep` and
  `_ReaderRefusalHoldsNoText`.
  🛑 **FOUR LINE NUMBERS WERE HERE — `:346`, `:249`, `:3160`, `:3195` — AND ALL
  FOUR HAD ROTTED AGAIN BY 19 Sep 2026, UNDER THE BANNER SIX LINES DOWN THAT
  RECORDS THE PREVIOUS ROT OF THE SAME FOUR.** They are deleted rather than
  replaced, which is what *"do not add a line number to this page without asking
  whether a grep anchor would do instead"* means when applied to itself.
  Reproduce the count: `grep -c 'export type _.*AssertNoTextDeep<'
  model/reconciliation.ts` → 24. ⚠️ **THIS LINE SAID 20 UNTIL 19 Sep 2026 AND
  ITS OWN DERIVATION COMMAND SAT BESIDE IT RETURNING 24** — the command was
  right, the number beside it was four behind, and nothing but a person governs
  it. The four added since are in `model/reconciliation.ts`'s later sections;
  derive them with `grep -n 'export type _.*AssertNoTextDeep<'
  model/reconciliation.ts` rather than reading a list here. ⚠️ **This said 13 until C17 landed, 14 until
  O-16 landed, 15 until 23 Aug 2026 and 17 until 24 Aug 2026** — the eighteenth,
  nineteenth and twentieth are `_SearchBoundaryHoldsNoTextDeep` (G217, §5a) and
  `_LineFindingHoldsNoTextDeep` / `_LineFindingRefusalHoldsNoText` (G228, §6a).
  🛑 **THE EIGHTEENTH IS THE ONE TO READ:** `SetReconciliationResult` had NO
  containment site at ALL, which is how two `readonly (string | null)[]` arrays
  of COUNTERPARTY-AUTHORED BUCKET KEYS came to sit on the engine's own result
  type without anybody having to argue for them. The proof is on the boundary
  channel, and the declaration now NAMES the three fields — `state`,
  `readerRequests`, `meterFacts` — that keep the whole interface off one, so the
  remaining absence is a statement rather than a gap.
  ⚠️ **The earlier note:** the fourteenth is
  `_PopulationDefectHoldsNoTextDeep` in §4a, the
  **fifteenth is `_CompletenessFindingHoldsNoTextDeep` in §9a** (12 Aug
  2026), and the **sixteenth and seventeenth are
  `_DocumentTrailerVerdictHoldsNoTextDeep` and
  `_RunDocumentAccountHoldsNoTextDeep` in §4b** (G236, #198), which name
  documents and are rendered and logged.
  🛑 **AND ONE TYPE THAT ARRIVED WITH THEM HAS NO SITE ON PURPOSE, which is the
  more useful half of this note.** G227's `HeldRead` carries a `FieldPath`, and
  `FieldSegment`'s `key` is a bare `string` — a path names counterparty-chosen
  JSON keys — so `AssertNoTextDeep<HeldRead>` is a **compile error**. That is the
  proof biting, not a site somebody forgot; `RefusedItem` has been the same shape
  for the same reason since C13. **The union carrying the REASON holds the proof;
  the record carrying the declared path does not.**
  `tests/model/below-floor-held.test.ts` asserts the error with a
  `@ts-expect-error` rather than leaving the absence to read as an oversight.
  Nothing in
  `tools/check-doc-counts.mjs` governs this number — the control is
  `tests/model/no-text-deep.test.ts`, which counts the sites and went RED on the
  day the fourteenth arrived, which is what a count control is for; it went RED
  again on the fifteenth and on the sixteenth-and-seventeenth together, and the
  count on **this** line is guarded by nothing but a person, which is how it
  survived one commit stale.
  ⚠️ **AND ALL THREE CITATIONS IN THIS BULLET WERE DEAD UNTIL 16 Aug 2026, EACH
  STILL RESOLVING** — the seventh, eighth and ninth instances of that class on
  this page. `:248-258` landed in the docblock rather than on the declaration;
  `:2246` resolved to a sentence about `'within_tolerance'` and `:2281` to
  `readonly rightCandidates: number`, both in unrelated declarations, because
  C13/C17/C17b/C18 inserted a thousand lines above them.
  `npm run check:citations` is EXIT 0 and cannot see this class. Derive them:
  `grep -n 'export type AssertNoTextDeep\|_ReaderVerdictHoldsNoTextDeep\|_ReaderRefusalHoldsNoText' model/reconciliation.ts`.
  🛑 **AND THE REPLACEMENTS THIS BANNER INSTALLED ROTTED IN THEIR TURN BY
  19 Sep 2026, ALL THREE STILL RESOLVING — so the sentence *"Derive them"* was
  written, the numbers were written beside it anyway, and thirteen hundred lines
  later they pointed at nothing again. The numbers are now GONE from the bullet
  above rather than swept to a third set.**

  **Verified 10 Aug 2026 by compiling the tree's own machinery** — a probe
  importing `AssertNoTextDeep` from `model/reconciliation.ts`, built with
  `model/tsconfig.json`'s exact `compilerOptions`. **All six of these PASSED:**
  `ReadonlySet<string>`, `ReadonlyMap<number, string>`, `{ describe(): string }`,
  `Uint8Array`, `ArrayBuffer`, `() => string`. **A bare `string` correctly FAILED**,
  `TS2344`. So the guard WAS a **deny-list on one type constructor**, and every
  value-carrying container that is not a bare property or an array or a plain
  object walked straight through it. A set of strings is text.

  ✅ **AND THAT IS HISTORY: THE INVERSION LANDED. G146 IS ✅ APPLIED, 10 Aug 2026,
  `77d7277d` — AND THIS PAGE WENT ON SAYING "RULED, NOT APPLIED" FOR TWELVE DAYS.**
  🛑 **THIS IS THE LARGEST FALSE-NEGATIVE THIS FILE HAS CARRIED, AND IT IS THE
  MIRROR OF EVERY OTHER BANNER HERE**: the rest of the page records claims that
  went false because work LANDED and the sentence stayed; this one told readers a
  control was WEAKER than it is, and instructed them — in bold — not to make a
  claim the tree had earned. **A stale warning is not the safe direction of
  wrong.** It is corrected rather than deleted because the instruction below it
  was load-bearing and people followed it. *Corrected 22 Aug 2026.*

  **What the tree actually holds.** `model/reconciliation.ts` declares an
  ALLOW-LIST of value-free leaves — `NoTextField<T>`, which admits
  `number | bigint | boolean | null | undefined`, recurses through arrays and
  objects, and refuses `Function`, `string`, and any object whose key set is
  `never`. Derive it, do not read this line:

  ```bash
  grep -n 'type NoTextField' model/reconciliation.ts
  grep -E '^\| G146 \|' docs/HANDOFF.md | grep -c '✅'          # → 1
  grep -c 'export type _.*AssertNoTextDeep<' model/reconciliation.ts   # the sites
  ```

  G146's row records it was **verified RED first**, with *"TEN escapes compiled
  green against the old form"* and ten `TS2578`s — the acceptance condition this
  page demanded, met. ⚠️ **G146's own applied-note is itself now stale**: it says
  *"Thirteen assertion sites still compile"* and the tree says **15**. That row is
  `docs/HANDOFF.md`'s to fix, not this page's, and is flagged rather than edited.

  🛑 **THE GAP THAT SURVIVES IS IN A FILE THIS PAGE NEVER NAMED.**
  `model/identity.ts` still carries the SHALLOW form — `NoPlainText<T>`, a mapped
  type that rejects a bare `string` property and nothing deeper — and two live
  proofs rest on it, `_CarriedTurnHoldsNoText` and `_CarriedReadingHoldsNoText`.
  Derive: `grep -n 'NoPlainText' model/identity.ts`. **So the caution above was
  aimed at the file that got FIXED while the weak one went unmentioned**, which is
  §5's own shape — a rule keyed on a convenient landmark instead of the property
  it protects. The live work is tracked as **#240**; the six containers listed
  above still walk through `identity.ts`'s guard, and it is `identity.ts`, not
  `reconciliation.ts`, that the warning belongs to.
- **A rule keyed on a convenient landmark instead of the property it protects is
  the most common defect in this codebase.** `docs/HANDOFF.md` §5 catalogues
  **nine** recurring shapes with real instances — §5.1–§5.7, plus §5.10 and
  §5.11 added 7 Aug 2026 (§5.8 and §5.9 are meta-findings, not shapes). Read it
  before adding a validator. Reproduce: `grep -c '^### 5\.' docs/HANDOFF.md` → 11
  subsections, of which two are the meta-findings.

### Writing code that touches the database — ruled 8 Aug 2026, FIRST SLICE BUILT 9 Aug 2026, TWO DATABASES SINCE 16 Aug 2026

> 🛑 **THIS SECTION'S OPENING SENTENCE WAS FLATLY FALSE AND IT IS THE WORST STALE
> CLAIM THIS FILE HAS CARRIED.** It read: *"There is no database, no schema, no
> migration and no client dependency in this repository."* **`db/` EXISTS**, and
> the heading said *"NONE of it applied"* while a schema, a scoped-transaction
> seam and a passing four-property isolation test all sat in the tree. The
> sentence is corrected here rather than deleted because a reader would have
> trusted it and skipped the directory. *Corrected 10 Aug 2026.*
>
> **What is in the tree** — `ls -R db/ tests/db/`:
>
> | Path | What it is |
> |---|---|
> | `db/migrations/0001_tenancy_and_rls.sql` | `tenant` and `tenant_contact`, both `ENABLE`d **and `FORCE`d** for row level security, with `tenant_rls` / `tenant_contact_rls` policies whose `USING` **and** `WITH CHECK` are `nullif(current_setting('app.tenant_id', true), '')` — G100's deny-on-NULL, written as the predicate rather than described |
> | `db/tenant-scope.ts` | `withTenantScope()` — issues `BEGIN`, then `SELECT set_config($1, $2, true)`, then `COMMIT`/`ROLLBACK`, and releases the client. **The `$1` bind is load-bearing:** `SET LOCAL app.tenant_id = $1` is utility syntax and takes no parameters, so the obvious repair interpolates the one value in the system that must never be attacker-influenced |
> | `db/pg.ts`, `db/pg.d.ts` | the client seam, plus hand-written types |
> | `db/provision.ts`, `db/env.ts`, `db/migrate.ts` | three roles — `reconcile_owner` `NOLOGIN NOBYPASSRLS`, `reconcile_migrator` `LOGIN BYPASSRLS`, `reconcile_app` `LOGIN NOBYPASSRLS` — exactly G100's separation |
> | `tests/db/tenant-isolation.test.ts` | the two-tenant leak test. Asserts (a) the SQL it issues carries **no** tenant predicate and binds no tenant parameter, (b)/(c) each tenant sees only its own rows and a query outside `withTenantScope()` sees **zero**, (d) both reads ran on the **same** pooled backend, by `pg_backend_pid()` — and two negative controls: with RLS **disabled** the same read leaks both tenants, and with the policy **dropped** it fails closed |
>
> 🛑 **AND THE "NARROWER CLAIM THAT SURVIVES" DID NOT SURVIVE EITHER. THIS BLOCK
> READ: *"WHAT IS STILL TRUE… `pg` IS NOT IN `package.json`. `grep -n '"pg"'
> package.json` returns nothing; `devDependencies` is `@types/node` and
> `typescript` only… The consequence is exact: the leak test's evidence is
> machine-local and not reproducible from the manifest."* **EVERY CLAUSE OF THAT
> IS NOW FALSE**, as of `#182` on 16 Aug 2026, and it is corrected rather than
> deleted because it was the load-bearing caveat on what a green run proved — a
> reader still quoting it would be understating the gate.
>
> **`pg` is a pinned runtime `dependency`, `8.23.0`**, alongside `fastify` 5.12.5
> (⚠️ **5.12.0 until 19 Sep 2026**; derive it, never read it) and `yaml` 2.9.0,
> under **G191** (*every dependency pinned exact*). Derive it:
> `node -e "console.log(require('./package.json').dependencies)"`. `devDependencies`
> is still `@types/node` and `typescript` only — **that half of the sentence is the
> part that survived**, and it is why `npm ci --omit=dev` produces a container with
> the driver and without the compiler, which the `Dockerfile` header states in its
> own voice.
>
> ⚠️ **What did NOT change, and do not read the new manifest as closing it:** the
> leak test still skips when no Postgres answers (the `{ skip }` on its one
> `describe` — derive the line, do not read one here; `:134` was cited until
> 19 Sep 2026 and had rotted).
> `npm ci` now installs the driver, so the missing piece is a **server**, not a
> package — narrower, but still not a proof from the manifest alone.
> `compose.yaml` stands one up.
>
> ⚠️ **`db/` IS NO LONGER ONE MIGRATION AND NO LONGER ONE DATABASE.** The table
> above lists `0001_tenancy_and_rls.sql` alone; `ls db/migrations db/migrations-control`
> now returns **thirty-five** files across **two** directories — ⚠️ **THIS SAID
> THIRTY-FOUR UNTIL 22 Sep 2026 AND WAS CORRECT WHEN WRITTEN; the one added is
> `migrations/0220_domain_claim.sql` (G1942–G1944, under the owner's S7
> ruling — the table `0009` owes BY NAME to the commit that mounts
> `resolveHomeRealm`, with the `challenge` pair and `verification_expires_at`
> refused on their own faces and `SELECT` as the only grant). That is FOUR
> consecutive sweeps of this line finding it right, after nine that did
> now returns **thirty-six** files across **two** directories — 🛑 **AND
> THIRTY-SIX IS A MERGE'S NUMBER THAT NEITHER PARENT COMPUTED: both branches
> said thirty-five and each meant a different file (`0170`, `0180`). Derive it;
> do not read it.** ⚠️ **THIS SAID
> THIRTY-FOUR UNTIL 21 Sep 2026 AND WAS CORRECT WHEN WRITTEN; the one added is
> 🛑 **BOTH NARRATIONS BELOW ARE KEPT AND NEITHER IS CORRECT ABOUT THIS TREE —
> §5.11 WITH A SECOND PARENT.** One branch landed `0170`, the other `0180`, and
> each said the count moved by ONE. **The merged tree took both. Derive it.**
> `db/migrations/0170_field_spec_data_type.sql` (G1371–G1374, DERIVED and not
> the owner's) — ONE `ALTER TABLE … ADD COLUMN data_type text NOT NULL` on
> `0012`'s `document_field_spec`, with NO table, NO policy, NO grant and — by
> ruling — NO `CHECK`. It is **invariant 4's column**: `FieldSpec.dataType` had
> none anywhere (`grep -rn 'data_type' db/` → nothing), so a converter would
> have decided a scalar kind by SNIFFING counterparty JSON. **That is the
> FOURTH consecutive sweep of this line to find it right**, after nine that did
> `0180_document_type_and_control_total.sql` (R11, THE OWNER'S — `DocumentType`
> gets its own tenant table, and C18's `ControlTotal` gets three arms rather
> than a null). TWO TABLES, ONE FILE, so the count moves by ONE. That is the
> FOURTH consecutive sweep of this line finding it right, after nine that did
> not.** ⚠️ **AND IT SAID
> THIRTY-TWO UNTIL LATER ON 20 Sep 2026 AND WAS CORRECT WHEN WRITTEN; the one
> added is `migrations-control/0030_onboarding_record.sql` (G1241, the
> owner's — H2's onboarding state, and the FIRST trigger and function that
> database has ever had), and the count moves by ONE from thirty-three
> because another branch's `0160`/`0161` landed in the same window. Derive
> it; this line has been wrong on this axis eight times and none of them was
> arithmetic.** ⚠️ **AND IT SAID
> THIRTY UNTIL EARLIER ON 20 Sep 2026 AND WAS CORRECT WHEN WRITTEN; the two
> added are `0160_definition_engine_spec.sql` (R-A, the owner's — the FIVE
> tables the engine can read a `SetReconciliationInput` out of, which nothing
> in this tree had) and `0161_explanation_is_not_authored.sql` (R-D, the
> owner's — one statement, `explanation_summary` DROP NOT NULL). That is TWO
> consecutive sweeps of this line finding it right, after nine that did
> not.** ⚠️ **AND IT SAID
> TWENTY-NINE UNTIL EARLIER THAT DAY AND THE TWENTY-NINE WAS A NUMBER NEITHER

> now returns **thirty-one** files across **two** directories — ⚠️ **THIS SAID
> THIRTY UNTIL 20 Sep 2026 AND WAS CORRECT WHEN WRITTEN**, which is the second
> consecutive sweep of this line to find it right after eight that did not. The
> thirty-first is `migrations-control/0020_console_read_role.sql` (G1161, the
> owner's) — **NO TABLE: one `GRANT USAGE` and one `GRANT SELECT`, to a role
> that belongs to the OTHER PLANE.** ⚠️ **AND IT SPENDS G193's *by construction*
> IN ONE DIRECTION**: the DATA plane now holds a read-only credential for the
> CONTROL database, and `tests/db/control-plane-census.test.ts` is what replaces
> the topology that used to make that reach impossible. **The direction
> invariant 3 forbids is untouched.** ⚠️ **AND IT SAID
> TWENTY-NINE UNTIL 20 Sep 2026 AND THE TWENTY-NINE WAS A NUMBER NEITHER
> PARENT COMPUTED: one branch landed `0140` and said TWENTY-NINE, the other
> landed `0150` and said TWENTY-NINE, and the merged tree carries both. **The
> number agreed and the sets did not** — the 16 Aug 2026 capability row's exact
> shape, on this line, under a banner that says so. G1096, 20 Sep 2026.** ⚠️ **AND IT SAID
> 🛑 **SEVERAL SLICES SWEPT THIS SECTION ON 20 Sep 2026 AND THE MERGE KEEPS
> EVERY NARRATION, WHICH IS §5.11 WITH A SECOND PARENT ARRIVING AS A
> DUPLICATED ENTRY RATHER THAN AS A WRONG NUMBER.** Each is correct about the
> branch that wrote it and none is correct about this tree. **Derive; do not
> read.**

> TWENTY-EIGHT UNTIL 20 Sep 2026, WHEN `db/migrations/0150_document_slot_binding.sql`
> (G961–G964) LANDED; the twenty-eight was CORRECT when written, which is
> recorded because this line has been behind the tree on eight of its previous
> sweeps and this is the first in a while that was not.** ⚠️ **AND IT SAID

> TWENTY-EIGHT UNTIL LATER ON 20 Sep 2026 AND WAS CORRECT WHEN WRITTEN; the
> twenty-ninth is `db/migrations/0140_reversal_write_and_mix_pins.sql` (G946–G949),
> which adds NO table — one `GRANT`, three columns, one restrictive policy and
> one replaced trigger function. THAT IS THE FIRST TIME IN NINE SWEEPS THIS
> LINE HAS BEEN RIGHT WHEN A SWEEP ARRIVED.** ⚠️ **IT SAID
> SEVENTEEN UNTIL 20 Sep 2026 AND THE COMMAND ALREADY RETURNED 27 BEFORE
> `db/migrations-control/0002_tenancy_roster.sql` (G831) TOUCHED THE TREE:
> `0018`, `0019`, `0020`, `0022`, `0027`, `0035`, `0039`, `0059`, `0069` and
> `0091` all landed and this first word moved for none of them. The 27 was not
> G831's to make stale** and is named so this sweep is not read as accounting
> for all eleven. **THAT IS THE EIGHTH TIME THIS LINE HAS BEEN WRONG ON THE
> SAME AXIS**, which is the argument for the command rather than for a better
> number — and it is the first time the file that moved it was in
> `db/migrations-control/` rather than in `db/migrations/`. ⚠️ **it said
> FOURTEEN until 19 Sep 2026 and the command already returned SIXTEEN before
> `0017_usage_record_actor.sql` (G387) touched the directory;
> `0013_federated_signin.sql` and `0015_exception_register.sql` landed and this
> word did not move, and neither of those was 0017's to make stale. THAT IS THE
> SEVENTH TIME THIS LINE HAS BEEN WRONG ON THE SAME AXIS.** ⚠️ **and it said
> TWELVE until 19 Sep 2026 and TWELVE was already one behind before
> `0014_invariant_10_event_streams.sql` (G317) touched the directory; the
> thirteen was not 0014's to make stale. THAT IS THE SIXTH TIME THIS LINE HAS
> BEEN WRONG ON THE SAME AXIS, which is the argument for the command rather
> than for a better number.** — ⚠️ **this said EIGHT
> UNTIL 19 Sep 2026 AND THE COMMAND ALREADY RETURNED ELEVEN BEFORE THE G304
> SLICE TOUCHED THE DIRECTORY: 0009, 0010 and 0011's three predecessors landed
> and nothing here followed them. The ELEVEN was not this commit's to make
> stale and is named so the sweep is not read as accounting for all four; the
> twelfth is `0011_federated_connection.sql`. THIS LINE HAS NOW BEEN WRONG FIVE
> TIMES ON THE SAME AXIS, which is the argument for the command rather than for
> a better number. It said SEVEN
> until 19 Sep 2026 and the command already returned ELEVEN before G295's
> ingestion slice touched the directory: `0009_identity_substrate.sql` and
> `0010_authorisation_record.sql` landed and nothing here followed them. The
> eleven was not this slice's to make stale and is named so the sweep is not
> read as accounting for all four. The TWELFTH is
> `0012_payload_and_subject_index.sql` — G106's storage half, the addressing
> table and the subject index, in one commit because G295 rules they are one
> thing. ⚠️ AND IT SAID SEVEN
> until G284's `0007_run_engine_account.sql` landed on 19 Sep 2026, SIX
> earlier that day and FOUR before that, and the FOUR was already two
> behind before the session slice touched it: `0004_subject_ledger.sql` (G178) landed and nothing followed it
> here. The four was not this commit's to make stale and is named so the sweep
> is not read as accounting for both. Derive it:
> `ls db/migrations/*.sql db/migrations-control/*.sql | wc -l`** —
> `0002_run.sql`, `0003_tenant_schema.sql`, `0004_subject_ledger.sql` and
> `0005_session_and_membership.sql` joined the tenant line, and
> `migrations-control/0001_catalogue.sql` is a **separate control-plane
> migration set**, because **G193** put the two planes on two databases and made
> the plane boundary a matter of topology rather than of review. `db/migrate.ts`
> is no longer the only entry point either: `server/control-plane/migrate-main.ts`
> and `server/data-plane/migrate-main.ts` each drive their own set, and
> `compose.yaml` runs both as one-shot services before either plane starts.
>
> ⚠️ **AND G99 IS NOT WHAT THE TREE DOES.** G99 rules the ORM is **Drizzle**;
> `db/tenant-scope.ts` uses `pg` directly and issues `BEGIN` itself. The bullet
> below still says `db.transaction()` — that is the ruling's vocabulary, not the
> built seam's. **Read `db/tenant-scope.ts` before writing a query, not this
> bullet.** Nothing in the tree depends on Drizzle and nothing has revisited G99.

The rulings below are `docs/HANDOFF.md` §3 rows G97–G101 and G111, which carry the
reasoning and the rejected alternatives. **`docs/HANDOFF.md` §3 marks none of them
✅ applied** — derive it, `grep -E '^\| G(97|98|99|100|101) \|' docs/HANDOFF.md |
grep -c '✅'` → 0 — **and that disagrees with the tree above.** That table is not
this file's to edit; treat the disagreement as known.

- 🛑 **Every query runs inside an explicit transaction. No exceptions, and this is
  the footgun the record names by product.** Under **G99** the ORM is **Drizzle**,
  and `docs/build/red-buildability.md:347` records that *"`SET LOCAL` outside a
  transaction block applies to the current statement only and is silently
  discarded. Every ORM/driver that autocommits (`pg` by default, Drizzle and Prisma
  outside `$transaction`) produces exactly this."* **`withTenantScope()` opens a
  `db.transaction()` and no query may be issued outside it** — a named negative
  control, not a review convention.
- **G101 — assume TRANSACTION-MODE pooling from day one**, because `SET LOCAL`
  inside an explicit transaction is correct under **both** pooling modes, which
  makes it the only posture a later deployment decision cannot invalidate. Phase
  one runs against a disposable Postgres with an in-process `pg.Pool` and **no AWS
  resource**.
- **G100 — RLS DENIES on NULL**, which is what makes G99's footgun survivable: a
  forgotten transaction yields an empty result set, not a cross-tenant read. **A
  separate `BYPASSRLS` role runs migrations — never the table owner**, because
  ownership carries DDL rights alongside the read exemption and there is no way to
  grant one without the other.
- **G97 — every branded id is `text`.** The slug is stored verbatim; there is no
  `uuid` anywhere in the model, and `text` compares like-for-like against
  `current_setting('app.tenant_id')` with no cast — **that comparison is the RLS
  predicate**. Cost accepted: the database enforces no id format, so preventing
  `ten_acme` versus `ten_ACME` is a mint-time rule in `model/`, not a column
  constraint.
- **G98 — the client is `pg`, pinned exact.** It exposes the backend PID, which is
  what lets a two-tenant leak test assert both queries ran on the **same** pooled
  connection rather than assuming it.
- ✅ **G111 — one money codec module, and nothing else may touch the representation.**
  After G65 and G71, `Money.amountMinor` is `bigint` in the model and a decimal
  **string** on the wire, so every boundary calls the codec. Same shape G67 demands
  for `parseFxRate()`, for the same reason: correctness that lives at call sites is
  correctness that drifts.

  🛑 **THIS SENTENCE WAS RIGHT AND THE TREE WAS WRONG, FOR FORTY-TWO DAYS, AND
  THE DIRECTION OF THAT IS THE WHOLE POINT OF THE ENTRY.** From 8 Aug 2026 this
  page said `bigint`; `model/domain.ts` declared `number`, and
  `model/reconciliation.ts` §3 said so in its own voice — *"Verified at HEAD:
  `Money.amountMinor` is `number` … and `grep -rn bigint model/*.ts` returns
  0."* **Two documents asserted opposite things about the load-bearing type in a
  reconciliation product, and each verified itself.** Every other banner on this
  page records a sentence that went false because work LANDED; this one records a
  sentence that was true, stayed true, and was contradicted by the code.

  ✅ **G286 (19 Sep 2026) RULES THAT THE CODE WAS WRONG, AND APPLIES IT.**
  `Money.amountMinor` and `MoneyAmount.amountMinor` are `bigint`; the codec is
  **`model/money.ts`**, the twenty-fifth module, and it is the only thing
  permitted to convert — `parseMinorUnits` / `formatMinorUnits` / `parseMoneyWire`
  / `toMoneyWire`, plus `minorUnitsFromCount` for the one configured `number`
  that still has to become money. `model/reconciliation.ts` §3 collapsed into it
  and re-exports the surface, exactly as §3 predicted it would. Derive it:
  `grep -c 'amountMinor: bigint' model/domain.ts model/policy.ts` → 1 each, and
  `grep -rln 'export function parseMinorUnits' model/` → exactly one file.

  🛑 **THE CHEAP CORRECTION WAS OFFERED AND REFUSED.** Amending this page to say
  `number` *"ratifies a ceiling nobody chose by writing down what drifted"*. The
  ceiling is the deciding fact and it is not an arithmetic defect: `number` is
  EXACT on integers to 2^53, so nothing the engine computed was ever wrong — what
  `number` imposed was a LIMIT of about 90 trillion cents, ample for one close and
  not ample for a cumulative total, a multi-year ledger or a minor unit finer than
  two decimals. G88 makes migrations forward-only, so **a stored `number` is a
  stored ceiling**, and the ruling was taken before ingestion writes rows.

  ⚠️ **TWO MONEY REFUSALS CHANGED MEANING WITHOUT CHANGING NAME, AND
  `check:wire` CANNOT SEE IT** — `money_refusal_kinds` compares arms and their
  ORDER, both unchanged. `not_integer_minor_units` is now unreachable from a
  constructed `Money` and lives at the two edges where a non-integer can still
  arrive; `exceeds_exact_integer_range` now means the **`int8` column** G65
  declares money is stored in, −2^63 … 2^63−1, a bound 1024× the old one. Read
  `model/money.ts`'s header before quoting either.

  🛑 **WHAT G286 DID NOT CLOSE, said plainly rather than left to be inferred:**
  `model/access.ts` still compares `amountMinor` inline at three sites that check
  no `exponent` — §3 said they *"should migrate in the same commit"* and they did
  not, because all three sit inside boolean-returning authorisation narrowing and
  `compareMoney` returns a refusal, which is a behaviour change to authorisation
  code rather than a type migration. And the bare minor-unit PRICE and RATE
  fields are still `number` — `unitPriceMinor`, `costMinor`, `revenueMinor`,
  `inputPerMillionMinor`, `blastRadiusMinor`, `modelSpendMinor` — because G286
  names `Money.amountMinor` and widening to every minor-unit field in the model
  is a second ruling nobody has taken.

### Writing code in `server/` — ruled AND built 16 Aug 2026, G191–G193

> ⚠️ **THIS SUBSECTION IS NEW ON 16 Aug 2026 AND IT IS AN ADDITION, NOT A
> CORRECTION.** It exists because `server/` landed with no mention anywhere on
> this page — not in the layout block, not in the reading table, not here — and a
> page that governs how code is written was silent about the only code that
> serves. **Every claim below is quoted or derived from the files themselves;
> nothing here is a new rule.** Read `server/http/app.ts` before writing a route:
> its own header states the three things it decides.

- 🛑 **Nothing in `server/` writes a URL, and nothing transcribes a schema.**
  `server/contract/document.ts` is *"the only place a contract is read"*, and
  `server/contract/routes.ts` derives the route table from `paths` × methods.
  `mountTier()` refuses to boot if a handler key is not an `operationId` in the
  document — so **a handler for an undeclared operation is a start-up failure,
  not a route.** The other direction is deliberately not enforced: a declared
  operation with no handler 404s, because refusing it would need a code from
  `errors.yaml`'s **closed** enum and there is none meaning *"declared and
  unbuilt"*.
- 🛑 **AJV rejects rather than strips.** `removeAdditional: false` overrides
  Fastify's default. Under the default, `?tenantId=…` against a querystring
  marked `additionalProperties: false` is **silently deleted and the request
  served** — which satisfies invariant 1 and leaves no evidence that it did.
  Rejecting makes the attempt visible in a status code. **Do not restore the
  default for convenience.**
- 🛑 **EVERY operation carries a querystring schema, including one that declares
  no query parameter — G941, 20 Sep 2026.** The rule above was inert on any
  operation with nothing to validate: `schemaFromParameters()` returned
  `undefined` for an empty property set, so `additionalProperties: false` rode
  on a schema Fastify never built and `?tenantId=ten_globex` was parsed and
  IGNORED. ⚠️ **MEASURED BEFORE IT WAS FIXED AND IT WAS NOT A HANDFUL: 122 OF
  136 declared operations**, the fourteen exceptions being exactly the ones that
  page or filter. **Invariant 1 was never breached** — nothing read the key —
  *"but ignored and read look identical from outside and only one of them is
  the property"*. The predicate is `Object.keys(properties).length === 0 &&
  where !== 'query'`, and the two `where` values it excludes are excluded for
  reasons `routes.ts` states on the line: a closed HEADER schema refuses every
  real browser request, and a closed PATH schema is meaningless. **It keys on
  `where`, never on *"does this operation declare parameters"*** — a by-id read
  has a non-empty `parameters` array, so that landmark would have left every
  `GET /v1/runs/{runId}` in the corpus exactly as open (§5.1).
  `tests/http/parameter-free-querystring.test.ts` carries the captured red.
- **Authentication runs in `onRequest`, before validation**, so an
  unauthenticated caller gets 401 and never 400. *"A validator that answers before
  an authenticator is a schema oracle."*
- **Whether a route is secured comes from the document**, per operation with a
  document-level fallback — never from a list in code, because a hand-maintained
  exemption list *"always ends up one entry stale in the wrong direction."*
- 🛑 **The serving process does not hold the credentials that void its own
  fence.** `server/data-plane/main.ts` did provision, migrate, seed and listen in
  one process until 16 Aug 2026; an adversarial read found it held the cluster
  superuser and `reconcile_migrator`/`BYPASSRLS` **for its entire life**, so any
  `process.env` disclosure yielded the read exemption every isolation assertion in
  `tests/` is relative to. **The dangerous work is now one-shot**:
  `server/{data,control}-plane/migrate-main.ts`, run as separate compose services
  that exit. Do not fold them back into a listener.
- 🛑 **The test token's fence is STRUCTURAL, not conditional (G192).**
  `server/data-plane/session.ts` picks a resolver **once, at boot**, and reaches
  `server/dev/test-token.ts` through a **dynamic** import that only executes when
  the flag is exactly `1`. A plane started without the flag never **loads** the
  file, so there is no accepting code path in the process to bypass. Reproduce the
  structural half: `grep -rn "from '\.\./dev/" server/data-plane/` returns
  nothing. **Do not add a static import from `server/data-plane/**` to
  `server/dev/**`** — it would convert a property into an intention.
- **The plane boundary is topology (G193).** Two processes, two databases, and
  — ⚠️ **since 20 Sep 2026, G1161 — THREE compose networks rather than two; this
  bullet said TWO and is corrected rather than deleted.** The third,
  `console-read-net`, joins `data-plane` to `control-plane-db` and to nothing
  else, so the DATA plane may read a control-owned roster DOWNWARD. **Nothing
  in the sentence that follows moved, and it is the half invariant 3 names:**
   `server/control-plane/config.ts` reads only
  `RECONCILE_CONTROL_*` and imports neither `db/env.ts` nor `db/tenant-scope.ts`,
  so there is no code path by which the control plane could reach tenant data even
  if the environment offered it. That is invariant 3 held by construction rather
  than by review.
- **Every published port in `compose.yaml` is bound to `127.0.0.1`.** The commit
  that added the stack says why: *"the documented runbook was the front door."*

### Writing a checker in `tools/` — ruled 8 Aug 2026; two checkers landed 9 Aug 2026, a third on 12 Aug 2026

> ⚠️ **This heading said *"two checkers landed"* until 16 Aug 2026, and the
> sentence under it said there are *"five in `tools/` — `ls tools/*.mjs | wc -l`"*
> while that command returned SIX.** It returns **8** now — ⚠️ **this said 7 until
> 22 Aug 2026, the third wrong value in this one sentence** — and two of the eight
> are not checkers: `citation-symbols.mjs` is a shared declaration index
> `check-citations.mjs` imports, and `skip-census.mjs` is a `node:test` REPORTER
> that joins the gate by riding the `node --test` invocation `npm test` already
> runs — no script, no step, and it cannot fail anything. **Count the checkers by
> name; the file count has now been a wrong proxy for them twice.** The heading
> counts arrivals under
> this ruling, not the total, which is exactly the ambiguity that let it sit
> uncorrected; it is dated now instead.

- 🛑 **AND SINCE 21 Sep 2026 A NEW CHECKER OWES THREE THINGS BEFORE IT JOINS THE
  GATE — G1471–G1478, `docs/build/completion-plan.md` K2–K4.** None is optional
  and each is asserted rather than reviewed:
  1. **A DENOMINATOR, PRINTED ON EVERY RUN, AND A REFUSAL WHEN IT IS ZERO.**
     Five of the ten checkers reported success over an empty subject until this
     commit, each witnessed doing it in a sandbox. A checker that cannot say how
     much it read is indistinguishable from one that read nothing. Add its row
     to `tests/tools/checker-denominators.test.mjs` — the registry is compared
     for EXACT set equality against the `check:*` scripts, so an eleventh
     checker with no row is a red before you have written a line of it.
  2. **A ROW IN `tests/ci/gate-stages.test.ts`'s `REQUIRED_STAGES`**, in
     position. The list is an ordered `deepEqual`, so a stage added, removed or
     reordered is a red. ⚠️ **AND SWEEP `check-doc-counts`'s `gate stages` and
     `checkers` IN THE SAME COMMIT** (§5.11) — both are governed totals now, so
     a stale figure in prose fails the gate rather than waiting for a person.
  3. **NO ARGUMENTS.** Every `check:*` script must be exactly
     `node tools/<checker>.mjs`. At least FIVE flags across these ten would
     narrow or neuter a stage — `--triage` (which sets `process.exitCode = 0`
     outright), `--check-file`, `--corpus`, `--pairs`, `--wire` — and a rule
     naming two of them is one short the day a sixth lands, which is §5.1. **The
     property is that the gate's checkers run bare**, and it is paired with a
     positive control that drives one input through `check-citations` twice and
     requires the verdicts to DIFFER (bare → EXIT 1, `--triage` → EXIT 0), so
     the rule cannot pass against flags that do nothing.
- **G108 — a new checker joins `npm run check`; it does not stand beside it**, and
  it must be deterministic and fast. ✅ **Applied in the script** — all **five**
  checkers, **all three typechecks** and `npm test` are in `check`, and
  `.github/workflows/check.yml` runs that command and nothing else.
  🛑 **THE LAST CLAUSE WENT FALSE ON 18 Sep 2026 AND IS CORRECTED RATHER THAN
  DELETED — G1331.** `.github/` is absent; `ls -la .github` → *No such file or
  directory*. **G108 ITSELF IS UNTOUCHED AND THE SCRIPT HALF IS STILL APPLIED**
  — what changed is that the thing running that command is the CodePipeline
  **Gate** stage (`reconcile-gate-staging`), whose *"nothing else"* property is
  held by `tests/infra/pipeline.test.mjs` rather than by a workflow file.
  ⚠️ **AND G108's OWN ARGUMENT IS WHY THE WORKFLOW WENT**: two gates are two
  definitions of green, and a job queued against zero registered runners is not
  a gate at all.
  ⚠️ **This bullet said *"all four checkers plus `npm test`"* until 16 Aug 2026**,
  which was two movements behind: `check:c4` joined on 12 Aug and
  `typecheck:server` on 16 Aug. Derive, do not read:
  `node -e "console.log(require('./package.json').scripts.check)"`.
- 🛑 **G109 — `tools/` takes a real YAML parser, pinned exact — IS RULED AND WAS
  NOT FOLLOWED, and that is the thing to know before you add the next checker.**
  The ruling reads: **do not hand-roll one**, because the wire-mirror check must
  resolve `$ref` chains and compare enum ORDER against the model, and a
  hand-parser that is subtly wrong produces **a checker that passes while
  asserting nothing** — §5.6, inside the tools written to catch it. ⚠️ **This
  section was headed *"not applied"*, which hid the more interesting fact: the
  checker was built, and built the way G109 forbids.**
  `tools/check-wire-mirror.mjs` says so in its own header — *"It is a line
  scanner, not a type checker and not a full YAML parser… It does not resolve
  `$ref` targets, and it registers six concrete pairs rather than generalising
  ahead of a seventh."* **What keeps it from
  being §5.6:** three deliberately drifted fixtures under
  `tests/tools/fixtures/wire-mirror/` and a test that requires it to reject them —
  the engine is witnessed rather than assumed. **What is still open:** the `$ref`
  half of G109. A recursive `$ref` scan is what found invariant 1's two wire
  deviations, and this checker cannot do one.

  > ⚠️ **THIS BULLET CARRIED TWO STALE SENTENCES AND THE SECOND ONE MATTERS
  > MORE.** It quoted *"five concrete pairs… ahead of a sixth"*, then **six,
  > ahead of a seventh** — 🛑 **and BOTH are dead: the header says TWENTY-TWO,
  > ahead of a twenty-third, and said TWENTY until 17 Aug 2026. This page was
  > quoting a header three revisions stale, inside a block whose entire subject is
  > that it had previously quoted that header one revision stale.** Derive it:
  > `node -e "import('./tools/check-wire-mirror.mjs').then(m=>console.log(m.PAIRS.length))"`
  > → 26. ⚠️ **AND THE CORRECTION ROTTED IN FOUR DAYS: this said 22 until 24 Aug
  > 2026, and the registry had already reached 24 before G217 and G228 took it to
  > 26** — `pack_keys` moved it and nothing on this page followed. **The checker's
  > own header carried the same stale figure at the same time**, which is the
  > partial sweep its registry note records about itself, happening to both files
  > at once. *Corrected 22 Aug 2026, and again 24 Aug 2026.* — and it asserted flatly: **"No YAML package
  > is in `package.json`."** That is **false since 16 Aug 2026**: `yaml` **2.9.0**
  > is a pinned runtime dependency, arriving with **G191**.
  >
  > 🛑 **AND THE TWO FILES DISAGREE ABOUT WHAT THAT MEANS, WHICH IS WORTH KNOWING
  > BEFORE YOU QUOTE EITHER.** `server/contract/document.ts` states in its own
  > header: *"G109 IS APPLIED HERE, AND IT IS THE FIRST TIME… This module takes
  > the dependency the ruling names: `yaml@2.9.0`, pinned exact"* — and it is
  > right that the dependency the ruling names is now in the manifest and really
  > parsing the four tiers. **But G109's sentence is about `tools/`, and `tools/`
  > uses none of it**: `grep -rn "from 'yaml'" tools/` returns nothing, and the
  > same header says so — *"The line scanners in `tests/http/` and `tools/` are
  > unchanged — changing them is not this slice's decision."* So the honest
  > statement is: **the parser exists and is proven in `server/`; the checker G109
  > was written about still hand-rolls.** Do not write "G109 is applied" without
  > naming which half.
  >
  > ⚠️ **AND THE HEADING ABOVE — *"IS RULED AND WAS NOT FOLLOWED"* — IS NO LONGER
  > THE WHOLE STORY.** `tools/check-wire-mirror.mjs`'s own header records that on
  > **11 Aug 2026 the product owner ruled the parser DEFERRED and this line
  > scanner EXTENDED**, so that `run_status` could be pinned before O-16 added a
  > third reconciliation outcome — *"G109 IS AMENDED, NOT DEPARTED FROM."* The
  > amendment carries a condition that was met and is not optional: **every new
  > source kind is verified RED against a deliberately drifted fixture before it
  > is pointed at the tree.** The `$ref`-resolving half remains, in the header's
  > own words, *"unbuilt and unclaimed"*.

## What may be claimed

From `PRODUCT.md`, which is the authority:

```
NEVER — a named customer, logo, testimonial, price, SLA, or benchmark.
        None have been established. Do not invent one.
NEVER — present in-product figures as customer results. The data is illustrative.
NEVER — propagate the landing page's market statistics (finance-leader sentiment,
        annual spend lost to mismatches, manual-review rate per 1,000 invoices).
        Their provenance is not recorded anywhere. Attach a source or drop them.
NEVER — name the KYC / credit-underwriting / medical-records engagements publicly.
        They are real delivered work, but not cleared for public use.
```

**Never describe it as production software serving paying customers.** There are
none. This constraint is about **evidence**, not ambition, and it did not move on
7 Aug 2026 when **G48** made v1 a product rather than a demo — that decision
changed the build target and supplied no customer, no price, no SLA and no
benchmark. Read `docs/HANDOFF.md` §3a before assuming G48 loosened anything here;
it loosened nothing on this page.

**Positioning — the engine is the product; finance is an instance.** Do not
hard-code ERP or SAP vocabulary into shared surfaces when a domain-neutral term
is truthful.

---

## Where to read next

**Start at `docs/HANDOFF.md` §0** — what v1 is, declared versus built — **and then
§0a, which is where the last session actually stopped.** Then the
rest of it: state of play, the G decisions and which are applied
(do not relitigate any of them), open items grouped by who can close them, the
nine recurring defect shapes in §5, and the traps in §7.

⚠️ **This line said *"the forty-four G decisions and which twelve are applied"*
until 8 Aug 2026, then **113 rows / 26 applied** until 10 Aug 2026, then **131
rows / 35 applied** until 16 Aug 2026. Every one of those six numbers was dead
when read. Do not replace them with new ones — derive them:**

```bash
grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md                    # DERIVE IT
grep -E  '^\| G[0-9]+ \|' docs/HANDOFF.md | grep -c '✅'     # DERIVE IT
```

> ⚠️ **THIRTEEN ROWS AND ELEVEN ✅ ON 22 Sep 2026, THE S7 HOME-REALM SLICE — AND
> THE PAIR IT ARRIVED AT WAS DERIVED RATHER THAN READ**, which is this fence
> doing what retiring its numbers was for. The rows are **G1941–G1953**, and
> **one of the thirteen is the OWNER'S**: G1941 applies the S7 ruling —
> *"`resolveHomeRealm` is MOUNTED; G165/D6 is treated as CONCURRENT rather
> than gating for this surface, extending G248"* — while the other twelve are
> **DERIVED** and say so on their own faces as G190, G356, G376, G511, G531,
> G533, G576, G602, G782, G783, G912, G913, G914, G941, G961, G1091 and G1162
> do. Each ✅ is marked in the commit that applies it.
> 🛑 **TWO OF THE THIRTEEN DO NOT CARRY ✅ AND THEY ARE THE TWO WORTH READING.**
> **G1948** records that `CallerKind` collapses *"no caller"* and *"no
> credential YET"*, so `mountTier()`'s fourth fence cannot see the one
> person-facing unauthenticated mount in the product — §5.1 in the fence that
> guards the gate — and the obvious widening is a BOOT FAILURE on
> `checkLocalHealth`. **G1952** records that nothing writes a domain claim on
> any request path, so the surface answers `domain_not_claimed` for every
> domain until a migrator writes a row. **A row recording a blocker as applied
> would be the disagreement G286 was ruled on.**
> 🛑 **THE SERVED SET MOVES 26 → 27 OF 136 AND THE TWENTY-SEVENTH IS THE FIRST
> UNAUTHENTICATED PERSON-FACING OPERATION EITHER PLANE HAS EVER MOUNTED.**
> ⚠️ **THE DENOMINATOR DID NOT MOVE AND NO CONTRACT DOCUMENT IS EDITED**:
> `resolveHomeRealm` has been declared since #230. `node
> tools/check-doc-counts.mjs --derive` still reports 136 across 125, 44
> capabilities and 28 modules; what moved is `db/` (34 → **35** migrations),
> `db/*-scope.ts` (5 → **6**) and `server/` (64 → **65** files).
> ⚠️ **AND THE INFRA HALF IS `cdk synth`-CLEAN AND DEPLOYED NOWHERE**, as
> `Observability` and `RunQueue` were: the console distribution gains a
> data-plane origin on ONE path pattern (G1949) over ONE shared VPC origin
> (G1950), read back from the synthesised template rather than reasoned.
> 🛑 **AND THE THIRTEENTH ROW IS THIS SLICE'S OWN DEFECT: G1953 RECORDS
> THAT G1947's REPAIR WAS THE SAME §5.1 NARROWED RATHER THAN CLOSED.**
> `grep -rn 'servedWithoutAGate(' server --include start.ts` was written into
> FOUR places as *the honest derivation* and returns **NINE** lines against
> **TWO** calls — it drops the seven prose mentions in `app.ts` and keeps the
> seven in `start.ts`, **the file it selected for**. Caught by RUNNING it
> before the commit landed, which is this page's own *derive, never read*
> applied to a derivation. Key on the CALL SYNTAX:
> `grep -rnE ': *servedWithoutAGate\(' server --include start.ts` → 2.
> ⚠️ **AND IT IS ONE SINCE 1 Oct 2026 — D6-8 (G2242) moved `resolveHomeRealm`
> onto `servedPublicly()`, the seventh fence's mark. The `→ 2` is left as the
> fact it was about this slice's tree.**
> ⚠️ **G1354–G1360 ARE RESERVED TO THIS SLICE AND UNSPENT**, as are migrations
> `0171`–`0179`; one migration landed, `0170`.
> `node tools/check-g-numbers.mjs` reports **0 duplicates · 0 trunk
> collisions**. Both figures are facts about a tree other agents are
> concurrently changing — run both commands after any merge.

> 🛑 **THE FIVE 22 Sep 2026 SLICES ARE MERGED, AND EVERY FIGURE BELOW IS A
> FACT ABOUT A TREE NONE OF THEM EVER SAW — §5.11 WITH FOUR SECOND PARENTS.**
> The five branch tips are **486/244 · 488/245 · 511/266 · 490/249 · 508/265**
> (S3 · S4 · S5 · S6 · S7), all from the same base of **476/237**; **the merged
> tree is 579 rows and 321 applied**, which no branch computed and which is
> re-derived here by hand on the merged tree rather than taken from any
> narration. ⚠️ **AND IT IS EXACTLY ADDITIVE IN BOTH COLUMNS, WHICH IS A
> MEASUREMENT AND NOT A HAPPY ACCIDENT**: 476 + 10 + 12 + 35 + 14 + 32 = 579,
> and 237 + 7 + 8 + 29 + 12 + 28 = 321. **That arithmetic holding is what a
> reservation scheme buys** — every other §5.11 entry on this page records the
> case where it did not, because the parents were editing the same rows. `node tools/check-g-numbers.mjs` reports
> **0 duplicates · 0 trunk collisions** across the joined row set: five G-block
> reservations held across five agents (G1901–G1340, G1941–G1360, G1961–G1420,
> G2021–G1440 and the S4 block), and so did the MIGRATION reservation — one
> migration landed, `0170`, from one slice.
> 🛑 **THE RESERVATIONS HELD AND THE NARRATIONS OF THEM DID NOT, WHICH IS A
> DISTINCTION WORTH ONE LINE BECAUSE ONLY THE CHECKER CAN MAKE IT.** Three
> blocks below say *"G13xx–G13yy ARE RESERVED TO THIS SLICE AND UNSPENT"* about
> numbers a sibling had already spent — S3's about G1911–G1920, S4's about
> G1917–G1920, S5's about G1980. **Every one of those is a prose claim about
> another branch's tree, and every one is false here while no number collided.**
> Run the two commands; do not read a reservation sentence as a fact about this
> tree.
> ⚠️ **AND THE DIRECTORY COUNTS MOVED IN FOUR PLACES AT ONCE, EACH SWEPT BY THE
> SLICE THAT MOVED IT AND NONE BY THE MERGE — re-derived here, all five agreeing
> with their own headlines, which is the first time this page has come through a
> five-way merge without one:** `ls db/migrations/*.sql
> db/migrations-control/*.sql | wc -l` → **35** · `git ls-files server | wc -l`
> → **65** · `ls infra/lib/*-stack.ts | wc -l` → **12** · `ls db/*-scope.ts |
> wc -l` → **6** · `awk '/^export const ROUTE_PATHS = \[/,/^\] as const/'
> frontend/src/routes/table.ts | grep -cE "^  '/"` → **14**. `git ls-files
> frontend | wc -l` is **43** and DID NOT MOVE, which is the one way a file
> count can be stale while its command agrees — G1031's shape, and here it is
> honest: no frontend file was added or deleted.
> 🛑 **THE SERVED SET IS 7 HANDLER BLOCKS ACROSS BOTH PLANES AND THE OPERATION
> COUNT IS THE ONE TO DERIVE, NOT THE BLOCK COUNT.** `grep -rn 'handlers:'
> server/*/start.ts` counts MOUNT SITES; what a reader wants is operations, and
> the slices moved it by mounting `resolveHomeRealm` (S7). ⚠️ **`node
> tools/check-doc-counts.mjs` IS EXIT 0 WITH ZERO `STALE` LINES AND 126
> HISTORICAL**, and it governs none of the five figures above — they are checked
> by nothing but a person, which is why they are listed with their commands.
>

> 🛑 **THE NUMBERS ARE GONE FROM THIS FENCE, DELIBERATELY, AND THAT IS THE
> THIRD REPAIR RATHER THAN A FOURTH NUMBER.** On 20 Sep 2026 THREE slices
> swept this fence from the same 383/152 — the roster reached **388/156**,
> the per-operation verdict **387/156**, and the `write_commercial` refusal
> **385/153**. **Two of the three wrote the identical `applied` value and
> meant different sets**, which is the 16 Aug 2026 capability row's exact
> shape arriving on the G table for the third time. §5.11 with a second
> parent, and this time with a third.
> **This fence has now carried a wrong pair on every merge that touched it**,
> and every previous repair was a better number instead of no number — which
> is the reasoning the EXPORTS fence was already retired under. The two
> commands above are the citation. `node tools/check-g-numbers.mjs` reports
> **0 duplicates · 0 trunk collisions** across the joined row set: the
> reservation held again across three agents (G831–G880, G881–G910,
> G911–G940), and so did the migration reservation — one control-plane
> migration on one side, none on the other two.
> **ALL THREE NARRATIONS BELOW ARE KEPT AND NONE IS CORRECT ABOUT THIS TREE.**

> ⚠️ **THE *"ALL THREE NARRATIONS BELOW"* BANNER IMMEDIATELY ABOVE NAMES THE
> THREE 20 Sep 2026 BLOCKS, WHICH NOW SIT BELOW THIS ONE RATHER THAN DIRECTLY
> BELOW IT — said here rather than left to be counted, because a banner whose
> number no longer matches what follows it is the duplicated-entry shape this
> page catalogues, arriving in the fence that warns about it. **This block is
> the 22 Sep 2026 slice's and is not one of the three.**
>
> ⚠️ **FIVE ROWS AND THREE ✅ ON 22 Sep 2026, THE S3 PACK-FIGURE REMEDIATION —
> AND THE GAP BETWEEN THE TWO MOVEMENTS IS THE POINT OF THE SLICE.** The rows
> are **G1906–G1910**, all five **DERIVED, NOT THE OWNER'S** on their own faces
> as G190, G356, G376, G511, G531, G533, G576, G602, G782, G783, G912, G913,
> G914, G941, G961, G1091, G1162 and G1242 are. **G1909 and G1910 deliberately
> SPELL the word and wear no glyph**, as G881 does, because this fence counts
> rows CONTAINING the character and both are findings handed to the owner
> rather than repairs taken.
> 🛑 **THE DEFECT IT CLOSES WAS MADE BY THE PREVIOUS COMMIT AND NOT FOUND BY
> IT.** G1901 corrected `V4 Success Story`'s baseline tile to `20→7` and G1903
> recorded `V1 Landing` as *"DELIBERATELY NOT TOUCHED"* at `15→7` — and `V1`'s
> tile sits beside a **`Read the full story` button linking to `V4`**, so for
> one commit the pack offered a prospect **two baselines for one engagement,
> ONE CLICK APART**, both cleared under G268 by name. **G1907 closes it, G1903
> is rewritten in place with its diagnosis kept verbatim, and G1906 is why the
> next one cannot open**: `tests/docs/pack-figure-consistency.test.ts` derives
> the pack's own figures and joins the surfaces to each other. **Measured
> before it was written: `grep -rln 'V1 Landing\|V4 Success Story' tests/
> tools/` returned NOTHING** — no checker had ever read a FIGURE on either
> page. ⚠️ **THE OVERSTATED FORM IS *nothing opened the file* AND IT IS WRONG:**
> `tests/app/route-provenance.test.ts` walks every `.dc.html` in the pack
> through `readdirSync` for `surface:` tokens and has read both pages' bytes
> since G319 — **it has no notion of a figure.**
> 🛑 **AND G1908 IS THE ONE TO READ BEFORE QUOTING THE RULING: THE WORKLOAD
> PANEL IS NOT A WITNESS.** G1901 argued the page contradicted the tile *"four
> times over"* and said *"every row of the workload panel derives it
> INDEPENDENTLY"*. **It does not.** Every row is `transactions × 20/60` and
> `transactions × 7/60` — 852 → 284/99, 1,372 → 457/160,
> 3,354 → 1,118/391, **the rounded product matching the published figure in
> all six cases** — so it is ONE assumption times THREE volumes and deriving
> 20 back out is circular. **The honest count of independent statements is
> TWO**, both prose. The ruling is unweakened; the corroboration claim is
> withdrawn at all three sites, one of which is the commit message of
> `e5080fa` and **cannot be edited, so it is named rather than swept**.
> ⚠️ **NO GOVERNED COUNT MOVES** — `node tools/check-doc-counts.mjs` is EXIT 0
> with no `STALE` line and HISTORICAL unchanged at **126**, because this slice
> adds no module, no capability, no resource class and no operation. **Nothing
> is mounted, no migration landed, and `model/`, `server/`, `db/`, `frontend/`,
> `infra/` and `tools/` are untouched** — the whole change is one figure on a
> `.dc.html` tile, three correction banners, `docs/HANDOFF.md` and one new file
> under `tests/`. ⚠️ **G1911–G1920 ARE RESERVED TO THIS SLICE AND UNSPENT.**
> Both figures are facts about a tree other agents are concurrently changing —
> run both commands after any merge.

> 🛑 **AND THE TWO BLOCKS BELOW WERE WRITTEN BY TWO 22 Sep 2026 SLICES AGAINST
> THE SAME PARENT, SO THE MERGE KEEPS BOTH — §5.11 WITH A SECOND PARENT,
> ARRIVING AS A DUPLICATED ENTRY RATHER THAN AS A WRONG NUMBER, FOR THE FOURTH
> TIME ON THIS PAGE.** Each is correct about the branch that wrote it and
> neither is correct about this tree. ⚠️ **AND THE FIRST ONE'S LAST SENTENCE IS
> ALREADY FALSE ABOUT THE SECOND: S3 wrote *"G1911–G1920 ARE RESERVED TO THIS
> SLICE AND UNSPENT"* and S4 spent all ten** — the reservation held (no
> duplicate, no collision) and the NARRATION of it did not, which is the
> distinction `node tools/check-g-numbers.mjs` can make and prose cannot.
> **Derive; do not read.**

> ⚠️ **FIVE ROWS AND FOUR ✅ LATER ON 22 Sep 2026, THE S4 REMEDIATION — AND
> `applied` MOVES BY ONE, NOT FOUR, BECAUSE THREE TICKS ARE STRIPPED IN THE
> SAME COMMIT.** The rows are **G1917–G1920** and **G1931**, all five
> **DERIVED, NOT THE OWNER'S** on their own faces as G190, G356, G376, G511,
> G531, G533, G576, G602, G782, G783, G912, G913, G914, G941, G961, G1091,
> G1162 and G1242 are. **G1912, G1913 and G1914 lose theirs** — the first two
> ⛔ SUPERSEDED, the third ⛔ REPORTED-NOT-CLOSED — and each keeps its original
> status cell QUOTED IN WORDS rather than in the glyph this fence counts,
> which is G881's precedent for a cell that would otherwise move `applied` by
> being read.
> 🛑 **THE FINDING THAT FORCED IT: THE TREE SPENT A DAY RENDERING A FALSE
> SENTENCE ABOUT THE NORTH STAR TO ANY PERSON WHO OPENED `/demo` OR
> `/lookup`** — *"specified in docs/handoff-pack/User Journeys.dc.html, drawn
> nowhere"* — **and the pack draws both in full**, in `V2 Book a Demo.dc.html`
> and `V3 Sign In.dc.html`, each with an `id` the tree now cites. Derive it,
> never read it: `grep -c 'id="form"' 'docs/handoff-pack/V2 Book a Demo.dc.html'`
> → 1. **The briefing named the pack's route TABLE and named no record, and an
> index is not the record** — G1917 records the error as the ORCHESTRATOR's
> rather than the slice's, because charging a slice for a premise it was
> handed is how a record stops being worth reading.
> 🛑 **AND EVERY FIELD OF EVERY `RouteSpec` WAS CHECKED BY NOTHING, MEASURED
> RATHER THAN FEARED: re-spelling `/demo`'s record to `'Utterly Fabricated
> Record.dc.html'` and its tier from `'Public'` to `'Entry'` left
> `npm run check` EXIT 0**, the provenance suite 15 of 15 green and `tsc`
> silent. `tests/app/route-provenance.test.ts` §7 is the join — a `pack`
> citation's record must be in the pack's own file listing and its anchor must
> be an `id` in that file, neither typed into the suite — and §6d/§6e are the
> hook §6 never had into §4b, whose body was replaced with an empty array
> while §6c stayed green **still titled *"§4b is silencing THREE rows"***.
> 🛑 **ONE ROW IS ⛔ NOT APPLIED AND IT IS THE POINT OF THE FIFTH: G1920
> ESCALATES TO THE OWNER AND PICKS NOTHING.** Two routes resolve under a
> `specified` word, which §4b's own rule calls a RED, and the three repairs —
> move the pack's status words, widen §4b and delete §6c, or refuse the routes
> and restore the exemptions — each spend something a derived slice may not.
> **The pack also contradicts itself about those exact rows**: every `/demo`
> journey step carries `exists:'neither'` (×3) while the table says
> `specified` and that cell's own prose says *"the highest-leverage
> **unspecified** surface in the map"*, and the public-plane lead says *"These
> **two** are neither"* above **three** public rows.
> 🛑 **THE SLICE MOUNTS NOTHING, DECLARES NOTHING, MINTS NO CAPABILITY AND
> ADDS NO MIGRATION** — the served set is unchanged; derive it, never read it:
> `grep -rn 'handlers:' server/*/start.ts`. ⚠️ **NO GOVERNED COUNT MOVES AND
> `ROUTE_PATHS` DOES NOT MOVE EITHER — it is still FOURTEEN**; what moved is
> what each of the fourteen SAYS about itself. ⚠️ **G1921–G1330 AND
> G1333–G1340 ARE RESERVED TO THIS SLICE AND UNSPENT**; **no migration landed
> and `db/` is untouched.**
> 🛑 **AND G1932 IS A SEPARATE, ISOLATED COMMIT BESIDE IT, WHICH IS THE
> WORKING PRACTICE RATHER THAN TIDINESS: *"Cleanups are separate, isolated
> commits. Never folded into feature work."*** It repairs a fixture that was
> RED ON ARRIVAL and has nothing to do with the routes —
> `tests/db/identity-substrate.test.ts` §4 seeds `ras_expired` from the
> DATABASE clock and judges it with a FROZEN `NOW`, so **the suite passed on
> the day it was written and has failed ever since, by the calendar alone,
> with nothing in the tree having changed.** It reproduces on green's
> unmodified commit, verified by stashing. ⚠️ **IT WAS INVISIBLE FOR THREE
> DAYS BECAUSE CI HAS NO PostgreSQL** — this page's own caveat, *"a green
> `npm run check` on a machine with no database is not evidence"* — and it
> surfaced only because a database came up on this machine mid-session.
> **The skip census can count the assertions that did not run; nothing in
> `npm run check` can count that one of them had started failing.** `node tools/check-g-numbers.mjs` reports
> **0 duplicates · 0 trunk collisions**. Both figures are facts about a tree
> other agents are concurrently changing — run both commands after any merge.

> ⚠️ **SIX ROWS AND FIVE ✅ ON 22 Sep 2026, THE S4 PUBLIC-PLANE ROUTE SLICE.
> THIS SAID *"SIX ROWS AND SIX ✅"* AND IS CORRECTED RATHER THAN DELETED**,
> because a fence that miscounts its own ticks is the one control nothing but
> a person governs. **G1914 never earned one**: its whole content is that the
> `/entry` ↔ `/signin` collision is REPORTED to the OWNER and not reconciled,
> and G835's words for that shape are *"a row recording a blocker as applied
> would be the disagreement G286 was ruled on"*. The tick is stripped and the
> row keeps its original status cell quoted IN WORDS, which is G881's
> precedent. The rows are **G1911–G1916**, all six **DERIVED, NOT THE
> OWNER'S** on their own faces as G190, G356, G376, G511, G531, G533, G576,
> G602, G782, G783, G912, G913, G914, G941, G961, G1091, G1162 and G1242 are:
> the two routes, the union, the branch, the derived string and §6 of
> `tests/app/route-provenance.test.ts` land together, so there is no interval
> in which a row claims something the tree does not do.
> 🛑 **AND TWO MORE TICKS WENT LATER THE SAME DAY — G1912 AND G1913 ARE ⛔
> SUPERSEDED BY G1918 AND G1917**, whose arguments do not hold: the plane was
> copied EITHER WAY (into `tier` as `'Public'`), and the pack DRAWS `/demo`
> and `/lookup` in records this tree carries. **So this slice's true
> arithmetic is six rows and THREE ✅**, and the block immediately below is
> the remediation's own.
> 🛑 **THE SLICE MOUNTS NOTHING, DECLARES NOTHING, MINTS NO CAPABILITY AND
> ADDS NO MIGRATION** — the served set is unchanged; derive it, never read it:
> `grep -rn 'handlers:' server/*/start.ts`. ⚠️ **NO GOVERNED COUNT MOVES:**
> `node tools/check-doc-counts.mjs` is EXIT 0 with no `STALE` line, because
> this slice adds no module, no capability, no resource class and no
> operation. ⚠️ **AND `git ls-files frontend | wc -l` DOES NOT MOVE EITHER —
> no file is added or deleted**; what moved is `ROUTE_PATHS`, 12 → **14**,
> which `check-doc-counts` does not govern and which nothing but a person
> checks. Derive it:
> `awk '/^export const ROUTE_PATHS = \[/,/^\] as const/' frontend/src/routes/table.ts | grep -cE "^  '/"`
> 🛑 **THE ROW WORTH READING IS G1916, AND IT IS A MEASUREMENT RATHER THAN A
> BUILD: `tests/app/route-provenance.test.ts` §4b — the arm its own text says
> has NO ESCAPE HATCH — is switched off for an entire plane by one
> `plane === 'data'` filter, and `/` had been sitting in that gap since the
> suite was written with no document naming it.** This slice put two more
> routes in the same gap and COUNTS all three rather than closing it, because
> closing it means moving a status word in the NORTH STAR. ⚠️ **G1917–G1920
> ARE RESERVED TO THIS SLICE AND UNSPENT**; **no migration landed and `db/` is
> untouched.** `node tools/check-g-numbers.mjs` reports **0 duplicates · 0
> trunk collisions**. Both figures are facts about a tree other agents are
> concurrently changing — run both commands after any merge.

> ⚠️ **FOURTEEN ROWS AND ELEVEN ✅ ON 22 Sep 2026, THE S5 REMEDIATION — AND
> TWO OF THE ELEVEN ARE GLYPHS COMING OFF RATHER THAN GOING ON, WHICH IS THE
> FIRST TIME THIS FENCE HAS MOVED IN THAT DIRECTION.** The rows are **G1980**
> and **G2001–G2013**, all fourteen **DERIVED, NOT THE OWNER'S** on their own
> faces as G190, G356, G376, G511, G531, G533, G576, G602, G782, G783, G912,
> G913, G914, G941, G961, G1091, G1162 and G1242 are.
> 🛑 **`applied` MOVES BY NINE AND THE ROW COUNT BY FOURTEEN, AND THE ARITHMETIC
> IS WHERE THE SLICE IS: eleven new ✅, MINUS G1969 and G1970, whose glyphs are
> WITHDRAWN, PLUS G1976, which is DISCHARGED.** G1969 claimed
> *"referral-code validity cannot leak BECAUSE IT IS NEVER EVALUATED, and the
> enforcement is a SIGNATURE"* — **the function did not evaluate the code and
> leaked it anyway, by asking something that does.** `deliver()` returned
> `ACCEPTED` iff the CRM answered `2xx`, so `PARTNER-ACME-2026` → 202 and
> `GUESS-0001` → 502 at a public URL with no credential. **Both controls
> written against it PASSED** — the byte-identical test used a double answering
> `201` to both codes, and the refusal-code tripwire greps for
> `referral|company|email|domain|partner` while the leak arrived through
> `crm_unavailable`. §5.1, twice, inside the two controls. **Neither row is
> deleted**: G1970's reasoning is right and G1969's left cell is G2001's own
> premise; what is withdrawn is the claim that either was held.
> 🛑 **AND FOUR ROWS CARRY NO GLYPH, DELIBERATELY: G2007 (the residual LATENCY
> channel, whose repair is a queue and an OWNER'S RULING), G2012 (nothing
> evidences that an Amplify rewrite forwards a POST body, and G108 forbids a
> gate step that could), and the two exposures G1975 and G1976's successors
> name.** A row recording a blocker as applied would be the disagreement G286
> was ruled on.
> ⚠️ **THE SLICE MOUNTS NOTHING, DECLARES NOTHING, MINTS NO CAPABILITY AND
> ADDS NO MIGRATION** — `node tools/check-doc-counts.mjs` is EXIT 0 with no
> `STALE` line, and `ls infra/lib/*-stack.ts | wc -l` is still 12. **What
> moved inside the Amplify template is two resources**; the other ELEVEN
> staging templates are BYTE-IDENTICAL, re-verified against `8376d0f` after
> the change.
> 🛑 **AND ONE ROW IS NOT THIS SLICE'S AT ALL: G2014, A TIME BOMB THAT HAD
> BEEN RED SINCE 20 Sep 2026 AND THAT NOTHING HAD SEEN.**
> `tests/db/identity-substrate.test.ts` §4 seeds an expired role assignment
> from the WALL CLOCK — `now() - interval '1 day'` — and then asks `decide()`
> at a FROZEN `NOW` of 2026-09-19. From 20 Sep the real yesterday is AFTER
> that instant, so the assignment had not expired, `decide()` allowed it
> CORRECTLY, and the assertion failed. **It survived because the suite STANDS
> DOWN when no PostgreSQL answers**, which is this page's own standing
> caveat — *"a green `npm run check` on a machine with no database is not
> evidence"* — arriving as a real defect: **88 suites stood down on the S5
> commit's own reported run and this was one of them.** Found only because
> the acceptance for this remediation required the gate to be run WITH a
> database, and repaired here rather than reported because it BLOCKS the gate
> every other finding is verified by.
> ⚠️ **G1416–G1420 ARE RESERVED TO THIS SLICE AND UNSPENT**; G2015 amends
> G1975's exposure on two axes reserved concurrency does not bound.
> `node tools/check-g-numbers.mjs` reports **0 duplicates · 0 trunk
> collisions**.

> ⚠️ **NINETEEN ROWS AND FOURTEEN ✅ ON 22 Sep 2026, THE S5 MARKETING-PLANE
> SLICE — AND THE PAIR IT ARRIVED AT WAS DERIVED RATHER THAN READ**, which is
> this fence doing what retiring its numbers was for. The rows are
> **G1961–G1979**, and **ONE of the nineteen is the OWNER'S**: G1961 applies
> the ruling of 22 Sep 2026 — *the public marketing plane lives on AWS Amplify
> at the apex `reconcileai.app`* — honouring `docs/build/deploy-handoff.md`
> §5.4's *"a different tool for a different job"*. The other eighteen are
> **DERIVED** and say so on their own faces as G190, G356, G376, G511, G531,
> G533, G576, G602, G782, G783, G912, G913, G914, G941, G961, G1091, G1162 and
> G1242 do.
> 🛑 **THE ROW COUNT MOVES BY NINETEEN AND `applied` BY FOURTEEN, AND THE FIVE
> THAT DO NOT MOVE IT ARE THE POINT OF THE SLICE.** G1967 (the session rewrite
> reaches no plane), G1968 (the marketing site does not exist), G1972 (`www`
> falls into the `Edge` sinkhole and fails at TLS), G1975 (no WAF and no rate
> limit on an unauthenticated public POST) and G1976 (no alarm, so a 502 on
> every intake is silent) each record a BLOCKER or an EXPOSURE, and **a row
> recording one as applied would be the disagreement G286 was ruled on**. Each
> spells its status word rather than drawing the glyph, for the reason G881
> records: this fence counts rows CONTAINING ✅.
> 🛑 **THE SERVED SET IS UNCHANGED AND NO MIGRATION LANDED** — this slice
> mounts nothing, declares no operation, mints no capability and touches no
> `db/`. Derive it, never read it: `grep -rn 'handlers:' server/*/start.ts`.
> ⚠️ **NO GOVERNED COUNT MOVES EITHER**: `node tools/check-doc-counts.mjs` is
> EXIT 0 with no `STALE` line. What moved is `ls infra/lib/*-stack.ts | wc -l`,
> 11 → **12**, which `check-doc-counts` does not govern and which is checked by
> nothing but a person.
> ⚠️ **G1980 IS RESERVED TO THIS SLICE AND UNSPENT.**
> `node tools/check-g-numbers.mjs` reports **0 duplicates · 0 trunk
> collisions**. Both figures are facts about a tree other agents are
> concurrently changing — run both commands after any merge.
> ⚠️ **FIVE ROWS AND FIVE ✅ ON 21 Sep 2026, THE E3 DOCUMENT-TYPE SLICE — AND
> THE PAIR IT ARRIVED AT WAS DERIVED RATHER THAN READ**, which is this fence
> doing what retiring its numbers was for. The rows are **G1401–G1405**, and
> **one of the five is the OWNER'S**: G1401 applies **R11**, the ruling of
> 21 Sep 2026 — *"`DocumentType` gets its own tenant table, one row per
> document type"* — while G1402, G1403, G1404 and G1405 are **DERIVED** and
> say so on their own faces as G190, G356, G511, G941, G961 and G1091 do. All
> five carry ✅ in the commit that applies them: the migration, the reader and
> the suite land together, so there is no interval in which a row claims
> something the tree does not do.
> 🛑 **THE SLICE MOUNTS NOTHING, DECLARES NOTHING AND MINTS NO CAPABILITY** —
> the served set and the contract corpus are byte-identical, and
> `node tools/check-doc-counts.mjs --derive` reported 136 operations
> across 125 paths at that commit (⚠️ **it said "still reports" until
> 1 Oct 2026, when R13 DECLARED `listRunAllocations` and G2401 DECLARED
> `bindEndpointCredential` on two branches, each saying 137 across 126 — the
> merged tree is 138 across 127, which neither parent computed (G2532). Derive
> the current pair, never read it**), 44 capabilities and **28 modules: this slice adds NO
> `model/*.ts` file**, which is stated because `modules` had only TWO of
> headroom against the checker's ceiling of 30 and a concurrent E2 slice
> spends one. What moved is `db/` (34 → **35** migrations, one file and two
> tables) and `server/` (64 → **65** files).
> ⚠️ **G1406–G1420 ARE RESERVED TO THIS SLICE AND UNSPENT**, as are migrations
> `0181`–`0189`; one migration landed, `0180`. **`0170`–`0179` are reserved to
> a concurrent E1 slice and none was spent here** — and that slice is adding
> `data_type` to `tenant.document_field_spec`, a table this slice does not
> touch, constrain or read. `node tools/check-g-numbers.mjs` reports
> **0 duplicates · 0 trunk collisions**. Both figures are facts about a tree
> another agent is concurrently changing — run both commands after any merge.

> ⚠️ **FOUR ROWS AND FIVE ✅ ON 20 Sep 2026, THE W3-D ONBOARDING-AND-ROSTER
> SLICE — AND THE FIFTH IS THE INTERESTING ONE.** The rows are **G1241–G1244**,
> and **one of the four is the OWNER'S**: G1241 applies the ruling of
> 20 Sep 2026 — *"Onboarding state lives in a table in the CONTROL database,
> one row per tenant, beside the roster — and `stage` is DERIVED at read time
> from the stored step state, never stored twice"* — while G1242, G1243 and
> G1244 are **DERIVED** and say so on their own faces as G190, G356, G376,
> G511, G531, G533, G576, G602, G782, G783, G912, G913, G914, G941, G961,
> G1091 and G1162 do. All four carry ✅ in the commit that applies them.
> 🛑 **`applied` MOVES BY FIVE AND THE ROW COUNT BY FOUR, AND THE FIFTH IS
> `G1168` GOING FROM ⛔ NOT APPLIED TO ✅ DISCHARGED.** That row's whole
> content was *"the TOPOLOGY blocker is closed and the SCHEMA one is not"*,
> and its status cell named its own successor: *"the slice that mounts
> `listTenants` is the slice that gives a stage a producer, and it owes a
> ruling on where onboarding state lives before it owes a column."* **Both
> conditions were met in that order**, and the original cell is QUOTED inside
> the new one rather than replaced.
> 🛑 **THE SERVED SET MOVES 25 → 26 OF 136 AND THE TWENTY-SIXTH IS THE FIRST
> CONSOLE OPERATION EITHER PLANE HAS EVER MOUNTED** — `grep -rn 'handlers:'
> server/*/start.ts`. ⚠️ **THE DENOMINATOR DID NOT MOVE: this slice DECLARES
> no operation and edits no contract document**, so `node
> tools/check-doc-counts.mjs --derive` still reports 136 across 125, 44
> capabilities and 28 modules. What moved is `db/` (32 → **34** migrations,
> one of them this slice's) and `server/` (58 → **60** files).
> ⚠️ **G1245–G1280 ARE RESERVED TO THIS SLICE AND UNSPENT**, as are tenant
> migrations `0190`–`0199` (**none landed**) and control migrations
> `0031`–`0039`; one control migration landed, `0030`.
> `node tools/check-g-numbers.mjs` reports **0 duplicates · 0 trunk
> collisions**. Both figures are facts about a tree other agents are
> concurrently changing — run both commands after any merge.

> ⚠️ **TEN ROWS AND NINE ✅ ON 20 Sep 2026, THE W3-A DEFINITION-STORAGE SLICE
> — AND THE PAIR IT ARRIVED AT WAS DERIVED RATHER THAN READ**, which is this
> fence doing what retiring its numbers was for. The rows are **G1121–G1130**,
> and **TWO OF THE TEN ARE THE OWNER'S**: G1121 applies R-A (*"A definition's
> content lives in TYPED COLUMNS, one per declared field"*) and G1127 applies
> R-D (*"Store typed facts only … the sentence is composed where it is
> displayed"*). The other eight are **DERIVED** and say so on their own faces
> as G190, G356, G376, G511, G531, G533, G576, G602, G782, G783, G912, G913,
> G914, G941, G961 and G1091 do. Each ✅ is marked in the commit that applies
> it: two migrations, one store, one store amendment, one scanner change and
> three suites land together, so there is no interval in which a row claims
> something the tree does not do.
> 🛑 **THE ROW THAT DOES NOT MOVE `applied` IS THE POINT OF THE TENTH: G1130
> RECORDS THAT A DEFINITION CAN NOW BE STORED AND READ AND THAT THE THING
> WHICH RUNS IT STILL CANNOT BE BUILT** — nothing in `server/` produces a
> `SourceDocument`, measured (`grep -rn 'ExtractedValue\|ExtractedLine'
> server/` → 0), because extraction is the engine's INPUT and not its output.
> ✅ **THAT WENT FALSE ON 21 Sep 2026 — E4 — AND IS CORRECTED RATHER THAN
> DELETED: `server/data-plane/document-assembly.ts` PRODUCES ONE, out of E1's
> `data_type` and E3's `expected_fidelity`. G1130's premise was correct until
> those two declarations existed.** ⚠️ **The derivation itself is retired — it
> counts prose (G978); append `| grep -v '^\S*: *\*'`.**
> A row recording a blocker as applied would be the disagreement G286 was
> ruled on.
> 🛑 **THE SLICE MOUNTS NOTHING, DECLARES NOTHING AND MINTS NO CAPABILITY —
> the served set is unchanged** (`grep -rn 'handlers:' server/*/start.ts`) and
> the contract corpus is byte-identical: `node tools/check-doc-counts.mjs
> --derive` still reports 136 operations across 125 paths, 44 capabilities and
> 28 modules. What moved is `db/` (30 → **32** migrations), `server/`
> (57 → **58** files) and the C4 artefacts (65 → **70** built tables,
> 72 → **77** policies). ⚠️ **G1131–G1160 ARE RESERVED TO THIS SLICE AND
> UNSPENT**, as are migrations `0162`–`0169`; two migrations landed, `0160`
> and `0161`. `node tools/check-g-numbers.mjs` reports **0 duplicates · 0
> trunk collisions**. Both figures are facts about a tree another agent is
> concurrently changing — run both commands after any merge.

> ⚠️ **TWO ROWS AND TWO ✅ ON 20 Sep 2026, THE W2-A FRONTEND-SCREEN SLICE —
> AND THE PAIR IT ARRIVED AT WAS DERIVED RATHER THAN READ**, which is this
> fence doing what retiring its numbers was for. The rows are **G1031** and
> **G1032**, both **DERIVED, NOT THE OWNER'S** on their own faces as G190,
> G356, G376, G511, G531, G533, G576, G602, G782, G783, G912, G913, G914,
> G1011, G1012 and G1013 are, and both carry ✅ in the commit that applies
> them: the screen, the deleted hatch, the deleted drawer and three browser
> sections land together.
> 🛑 **THE SLICE MOUNTS NOTHING, DECLARES NOTHING AND MINTS NO CAPABILITY —
> the served set is unchanged at 25 of 136** (`grep -rn 'handlers:'
> server/*/start.ts`) **and no migration landed.** What moved is that an
> application finally CONSUMES two operations the plane has served since
> G300, and that a `NotBuilt` mark refusing them on G200 is gone. ⚠️ **AND
> `git ls-files frontend | wc -l` DID NOT MOVE EITHER, WHICH IS THE ONE WAY A
> FILE COUNT CAN BE STALE WHILE ITS COMMAND AGREES**: one file added, one
> deleted. ⚠️ **G1033–G1060 ARE RESERVED TO THIS SLICE AND UNSPENT.** Both
> figures are facts about a tree other agents are concurrently changing — run
> both commands after any merge.

> ⚠️ **THE RED-FINDINGS SLICE ADDS SEVEN ROWS AND SEVEN ✅ ON 20 Sep 2026 —
> G1091–G1097, all seven DERIVED and saying so on their own faces** as G190,
> G356, G376, G511, G531, G533, G576, G602, G782, G783, G832, G912 and G941
> do. All seven carry ✅ in the commit that applies them: the matcher, the
> flag, the proxy import and the four corrections land with their tests, so
> there is no interval in which a row claims something the tree does not do.
> 🛑 **THE SLICE MOUNTS NOTHING, DECLARES NOTHING, MINTS NO CAPABILITY AND
> ADDS NO MIGRATION — and it deliberately carries no served-set numeral,
> because retiring one is G1097.** Derive it: `grep -rn 'handlers:'
> server/*/start.ts`. 🛑 **AND IT CHANGES WHAT A `cdk deploy` DOES: the
> pull-request gate is now behind `-c pullRequestGate=on`, DEFAULT OFF, so
> `cdk deploy reconcile-pipeline-staging -c planeImageTag=<40-hex>` no longer
> tries to create a webhook and no longer rolls the stack back — and
> **nothing checks a pull request until an owner grants the GitHub App
> permission and somebody passes the flag.** ⚠️ **G1098–G1120 ARE RESERVED TO
> THIS SLICE AND UNSPENT.** `node tools/check-g-numbers.mjs` reports
> **0 duplicates · 0 trunk collisions**.
>
> 🛑 **SEVERAL SLICES SWEPT THIS FENCE ON 20 Sep 2026 AND THE MERGE KEEPS EVERY
> NARRATION, WHICH IS §5.11 WITH A SECOND PARENT ARRIVING AS A DUPLICATED
> ENTRY RATHER THAN AS A WRONG NUMBER.** Each is correct about the branch
> that wrote it and none is correct about this tree. **Run the two commands;
> the fence deliberately carries no number.**

> 🛑 **TWO SLICES SWEPT THIS FENCE ON 20 Sep 2026 AND THE MERGE KEPT BOTH
> NARRATIONS, WHICH IS §5.11 WITH A SECOND PARENT ARRIVING AS A DUPLICATED
> ENTRY RATHER THAN AS A WRONG NUMBER.** Each is correct about the branch
> that wrote it and neither is correct about this tree. **Run the two
> commands; the fence deliberately carries no number.**

> ⚠️ **394 -> 397 AND 161 -> 164 ON 20 Sep 2026, THE PARAMETER-FREE
> QUERYSTRING SLICE — AND THE 394/161 IT ARRIVED AT IS ALREADY A MERGED
> FIGURE THAT NO NARRATION ABOVE STATES**, which is the fence doing exactly
> what retiring its numbers was meant to do: this slice derived the pair
> rather than reading one. The three rows are **G941–G943**, all three
> **DERIVED, NOT THE OWNER'S** on their own faces as G190, G356, G376, G511,
> G531, G533, G576, G602, G782, G783, G912, G913 and G914 are — the rulings
> that NAME the property are **G113** and **invariant 1** itself — and all
> three carry ✅ in the commit that applies them, so there is no interval in
> which a row claims something the tree does not do.
> 🛑 **THE SLICE MOUNTS NOTHING, DECLARES NOTHING, MINTS NO CAPABILITY AND
> EDITS NO CONTRACT DOCUMENT — the served set is unchanged at 23 of 136 and
> `check:annotations` walks the same 136 across the same 7 documents.** What
> moved is ONE LINE of `server/contract/routes.ts`: a parameter-free
> operation now gets `{type:'object', properties:{}, additionalProperties:
> false}` on its query string instead of no schema at all, so `?tenantId=` is
> REFUSED rather than ignored on **122 of 136** declared operations that had
> no such schema. ⚠️ **NO GOVERNED COUNT MOVES** — `node
> tools/check-doc-counts.mjs` is EXIT 0 with no `STALE` line, because this
> slice adds no module, no capability, no resource class and no operation.
> ⚠️ **G944–G945 ARE RESERVED TO THIS SLICE AND UNSPENT**; **no migration
> landed and `db/` is untouched.** Both figures are facts about a tree other
> agents are concurrently changing — run both commands after any merge.

> ⚠️ **THE SLOT-FILL SLICE ADDS FOUR ROWS AND FOUR ✅ ON 20 Sep 2026 — G961,
> G962, G963 AND G964, all four DERIVED and saying so on their own faces as
> G190, G356, G376, G511, G531, G533, G576, G602, G782, G783, G832 and G912
> do.** All four carry ✅ in the commit that applies them: the migration, the
> reader, the two test suites and the model's own corrections land together, so
> there is no interval in which a row claims something the tree does not do.
> 🛑 **AND THE SLICE MOUNTS NOTHING, DECLARES NOTHING AND MINTS NO CAPABILITY —
> the served set is unchanged at 23 of 136** (`grep -rn 'handlers:'
> server/*/start.ts`) and the denominator did not move either. **What moved is
> what ONE mounted operation can answer**: `admitRun` could not admit a
> definition with a required slot at any price, and now can when a document is
> bound to it. ⚠️ **G965–G975 ARE RESERVED TO THIS SLICE AND UNSPENT**, as are
> migrations `0151`–`0159`; one migration landed, `0150`. **Do not read the two
> numbers this fence deliberately no longer carries** — run the two commands
> after any merge, because at least two other agents hold reserved blocks.

> ⚠️ **SEVEN ROWS AND SEVEN ✅ ON 20 Sep 2026, THE W1-G DEPLOYMENT-HALVES
> SLICE.** The rows are **G991–G997**, all seven **DERIVED, NOT THE OWNER'S**
> on their own faces as G190, G356, G376, G511, G531, G533, G576, G602, G782,
> G783, G881 and G882 are, and all seven ✅ in the commit that applies them —
> the pull-request gate, the frontend half of Deploy, the page-origin repair
> and their tests land together, so there is no interval in which a row here
> claims something the tree does not do. **Derive both figures; this fence
> carries no number by ruling.** `node tools/check-g-numbers.mjs` reports
> **0 duplicates · 0 trunk collisions**.
> 🛑 **AND EVERY ONE OF THE SEVEN IS CODE PLUS `cdk synth`. NOTHING WAS
> DEPLOYED, AND TWO OF THEM CANNOT BE UNTIL A HUMAN DEPLOYS `Edge` FIRST** —
> the pipeline now `Fn::ImportValue`s two exports `reconcile-edge-staging`
> does not yet publish (verified read-only: that stack's outputs all carry
> `ExportName: None`, and it sits in `UPDATE_ROLLBACK_COMPLETE` from trap 11).
> `docs/build/deploy-handoff.md` **§11** is the order.
> ⚠️ **THE SERVED SET IS UNCHANGED, NO OPERATION IS DECLARED AND NO MIGRATION
> LANDED.** **G998–G1010 ARE RESERVED TO THIS SLICE AND UNSPENT.** Both figures
> are facts about a tree at least six other agents were concurrently changing
> while this ran — run both commands after any merge.

> ⚠️ **383 -> 387 AND 152 -> 156 ON 20 Sep 2026, THE PER-OPERATION GATE
> VERDICT.** The four rows are **G911–G914**, and **one of the four is the
> OWNER'S** — G911 applies the ruling of 20 Sep 2026, *"Take it — the file
> boundary should not carry an authorisation decision. An operation's gate
> verdict comes from the OPERATION, not from which file it sits in"* — while
> G912, G913 and G914 are **DERIVED** and say so on their own faces as G190,
> G356, G376, G511, G531, G533, G576, G602, G782 and G783 do. All four carry
> ✅ in the commit that applies them, and **`applied` moves by four and the
> row count by four**: nothing is ruled here that is not also built.
> 🛑 **THE SLICE MOUNTS NOTHING, DECLARES NOTHING AND EDITS NO CONTRACT
> DOCUMENT — the served set is unchanged at 23 of 136 and `check:annotations`
> walks the same 136 across the same 7 documents.** What moved is the boot
> path of every mounted tier: `TIER_REQUIRES_CAPABILITY` is RETIRED, the
> fences read the operation's own annotation, and the fourth fence now refuses
> to SERVE a person-facing exemption that the mount has not acknowledged with
> `servedWithoutAGate()`. 🛑 **G602's AND G781's REJECTED ALTERNATIVE (c) IS
> NOW THE TREE, AND BOTH ROWS ARE AMENDED IN PLACE RATHER THAN LEFT SAYING
> "refused"** — which is the only two `applied` glyphs that did not arrive
> with a new row. ⚠️ **G781 IS NOT REVERSED AND
> `docs/contracts/platform-console.openapi.yaml` IS BYTE-IDENTICAL**: this
> slice makes that split unnecessary, it does not undo it. ⚠️ **G915–G940 ARE
> RESERVED TO THIS SLICE AND UNSPENT**, as are migrations `0131`–`0135`; **no
> migration landed and `db/` is untouched.** Both figures are facts about a
> tree two other agents are concurrently changing — run both commands after
> any merge.
> ⚠️ **383 -> 388 AND 152 -> 156 ON 20 Sep 2026, THE CONTROL-PLANE ROSTER
> SLICE.** The five rows are **G831–G835**, and **one of the five is the
> OWNER'S** — G831 applies the ruling of 20 Sep 2026, *"A control-plane roster
> table … which the consoles read"* — while G832, G833, G834 and G835 are
> **DERIVED** and say so on their own faces as G190, G356, G376, G511, G531,
> G533, G576, G602, G782 and G783 do. **`applied` moves by FOUR and the row
> count by FIVE, and the row that does not move it is the point of the
> slice: G835 records that WHICH PLANE SERVES THE CONSOLES is an open
> owner's ruling**, and a row recording a blocker as applied would be the
> disagreement G286 was ruled on. **The 383 and the 152 were CORRECT when
> this sweep arrived.** 🛑 **AND THE SLICE MOUNTS NOTHING: the served set is
> unchanged at 23 of 136** — `grep -rn 'handlers:' server/*/start.ts` — and
> the denominator did not move either, because it declares no operation.
> ⚠️ **G836–G880 ARE RESERVED TO THIS SLICE AND UNSPENT**, as are tenant
> migrations `0111`–`0120` (**none landed**) and control migrations
> `0003`–`0005`; one control migration landed, `0002`. Both figures are facts
> about a tree other agents are concurrently changing — run both commands
> after any merge.

> 🛑 **383 AND 152 WERE A MERGE'S NUMBERS AND NEITHER PARENT COMPUTED EITHER —
> ⚠️ **383 -> 385 AND 152 -> 153 ON 20 Sep 2026, THE `write_commercial`
> SLICE — AND THE GAP BETWEEN THE TWO MOVEMENTS IS THE WHOLE POINT OF THE
> SLICE.** The two rows are **G881** and **G882**, both **DERIVED, NOT THE
> OWNER'S** on their own faces as G190, G356, G376, G511, G531, G533, G576,
> G602, G782 and G783 are. **Only G882 carries ✅.** 🛑 **G881 IS ⛔ NOT
> APPLIED AND THAT IS THE ROW: the owner's ruling of 20 Sep 2026 — *"Mint
> `write_commercial`. Platform-only via `PLATFORM_ONLY_RESOURCE_CLASSES`"* —
> NAMES A MECHANISM THAT REVOKES A LIVE TENANT REACH**, measured through
> `decide()` rather than reasoned from a table: a customer administrator
> holding `view_commercial` goes from `{"allowed":true,"reason":"permitted"}`
> to `{"allowed":false,"reason":"capability_is_platform_only"}` the moment
> `commercial` joins that list. **NOTHING IS MINTED, `raiseAdjustment` DOES
> NOT MOVE, AND THE CAPABILITY AWK BELOW STILL SAYS 44.** ⚠️ **AND G881's
> STATUS CELL DELIBERATELY SPELLS THE WORD RATHER THAN THE GLYPH**, because
> this fence counts rows CONTAINING ✅ and the first draft of that cell —
> *"a ruling recorded ✅ against a mechanism that revokes live authority"* —
> moved `applied` by one while applying nothing. Caught by deriving, not by
> reading. 🛑 **G883–G910 ARE RESERVED TO THIS SLICE AND UNSPENT**, as are
> migrations `0126`–`0130`; **no migration landed, and a capability is not a
> table.** Both figures are facts about a tree two other agents are
> concurrently changing — run both commands after any merge.

> 🛑 **383 AND 152 ARE A MERGE'S NUMBERS AND NEITHER PARENT COMPUTED EITHER —
> §5.11 WITH A SECOND PARENT, IN THIS FENCE, AGAIN.** The platform-record
> slice reached **380/149** by adding G730 to 379/148; the platform-console
> split reached **382/151** by adding G781–G783 to the same 379/148. Both
> were correct about their own tree and both were dead the instant the trees
> joined. The figures above are re-derived by hand from the merged tree, and
> `node tools/check-g-numbers.mjs` reports **0 duplicates · 0 trunk
> collisions** across the joined row set — the G-block reservation held again
> (G730–G780 on one side, G781–G830 on the other), and so did the MIGRATION
> reservation this time: `0091` on one side, none on the other, no collision.
> **BOTH NARRATIONS BELOW ARE KEPT AND NEITHER IS CORRECT ABOUT THIS TREE.**

> ⚠️ **379 -> 382 AND 148 -> 151 ON 19 Sep 2026, THE PLATFORM-CONSOLE SPLIT.**
> The three rows are **G781–G783**, and **one of the three is the OWNER'S** —
> G781 applies the split ruling of 19 Sep 2026, *"Split the document.
> `platform-console.openapi.yaml` takes the 26, becomes annotatable and
> mountable now, and joins `TIERS`"* — while G782 and G783 are **DERIVED** and
> say so on their own faces as G190, G356, G376, G511, G531, G533, G576 and
> G602 do. All three carry ✅ in the commit that applies them: the document,
> the registration, the verdict and three test suites land together, so there
> is no interval in which a row claims something the tree does not do.
> **The 379 and the 148 were CORRECT when this sweep arrived.**
> 🛑 **AND THE SLICE MOUNTS NOTHING — the served set is unchanged at 23 of
> 136** (`grep -rn 'handlers:' server/*/start.ts`; four tiers are mounted and
> neither console is one) — because `mountTier()`'s SIXTH FENCE refuses a
> gated operation whose handler mints no invariant 10 record, and
> `AuthorizationGrant extends TenantScoped` gives a tenant-less platform
> principal nowhere to put one. That is G728's blocker reached from a second
> direction, and `tests/http/administration-tier-unmounted.test.ts` §3e
> witnesses the fence firing on the NEW tier for the same act that boots on
> the old one. ⚠️ **THE DENOMINATOR DID NOT MOVE EITHER, AND THAT IS THE
> SIGNATURE OF A SPLIT: 136 operations across 125 paths, before and after.**
> What moved is `ls docs/contracts/*.openapi.yaml | wc -l`, 6 -> 7, which
> `check-doc-counts` does not govern. ⚠️ **G784–G830 ARE RESERVED TO THIS
> SLICE AND UNSPENT**, as are migrations `0101`–`0110`; **no migration
> landed and `db/` is untouched.** Both figures are facts about a tree
> another agent is concurrently changing — run both commands after any merge.

> 🛑 **379 AND 148 ARE A REBASE'S NUMBERS AND NO PARENT COMPUTED EITHER —
> ⚠️ **379 -> 380 AND 148 -> 149 ON 19 Sep 2026, G730.** One row and one ✅,
> both in the commit that ruled it — invariant 10's second home. The
> paragraph below is the 379/148 narration and is left as the history it is.
>
> 🛑 **379 AND 148 WERE A REBASE'S NUMBERS AND NO PARENT COMPUTED EITHER —
> §5.11 WITH A SECOND PARENT, IN THIS FENCE, AGAIN, AND THIS TIME THREE WAYS.**
> On 19 Sep 2026 the resolution-chain slice reached **371/140** with G656–G660,
> the intake-serving slice reached **370/139** with G691–G694, `origin/main`
> merged those two to **375/144**, and the console-session slice reached
> **370/139** with G726–G729 from the same 366/135. **Two of the four wrote
> the identical pair and meant different sets** — the 16 Aug 2026 capability
> row's exact shape, arriving on the G table. The figures above are re-derived
> by hand from the rebased tree, and `node tools/check-g-numbers.mjs` reports
> **0 duplicates · 0 trunk collisions** across the joined row set: the G-block
> reservation held across three agents (G656–G690, G691–G725, G726–G780).
> **EVERY NARRATION BELOW IS KEPT AND NONE IS CORRECT ABOUT THIS TREE.**

> ⚠️ **366 -> 370 AND 135 -> 139 ON 19 Sep 2026, THE CONSOLE-SESSION SLICE.**
> The four rows are **G726–G729**, and **one of the four is the OWNER'S** —
> G726 applies the ruling of 19 Sep 2026, *"The data plane serves the console
> hosts, with tenant-less sessions"* — while G727, G728 and G729 are
> **DERIVED** and say so on their own faces as G190, G356, G376, G511, G531,
> G533, G576 and G602 do. All four carry ✅ in the commit that applies them:
> nothing is ruled here that is not also built, so there is no interval in
> which a row claims something the tree does not do.
> 🛑 **AND THE SLICE MOUNTS NOTHING: it adds no handler at all** —
> `grep -rn 'handlers:' server/*/start.ts` — because G602 measures that the
> administration tier's annotation is all-or-nothing, and because G728 finds a
> second blocker G602 does not name: **`authorize()` cannot mint invariant
> 10's record for a tenant-less act**, and G301's sixth boot fence makes
> minting a precondition of mounting. ⚠️ **G730–G780 ARE RESERVED TO THIS
> SLICE AND UNSPENT**, as are migrations `0079`–`0090`; **no migration
> landed.**

> ⚠️ **366 -> 371 AND 135 -> 140 ON 19 Sep 2026, THE RESOLUTION-CHAIN SLICE.**
> The five rows are **G656–G660**, all five **DERIVED, NOT THE OWNER'S** on
> their own faces as G190, G356, G376, G511, G531, G533, G576 and G602 are, and
> all five ✅ in the commit that applies them — the migration, the model
> module, the three server files, the contract change and five test suites land
> together, so there is no interval in which a row here claims something the
> tree does not do. **The 366 and the 135 were CORRECT when this sweep
> arrived.** 🛑 **THE SERVED SET MOVES 15 -> 21 of 136 AND THE DENOMINATOR DOES
> NOT** — the six operations were declared already; what landed is their
> table, their model and their mounts. ⚠️ **G661–G690 ARE RESERVED TO THIS
> SLICE AND UNSPENT**, as are migrations `0060`–`0068`; one migration landed,
> `0059`. Both figures are facts about a tree other agents are concurrently
> changing — run both commands after any merge.
```

> 🛑 **374 AND 143 ARE A REBASE'S NUMBERS AND NEITHER PARENT COMPUTED EITHER
> — §5.11 WITH A SECOND PARENT, IN THIS FENCE, AGAIN, AND THIS TIME **BOTH
> SIDES WROTE THE SAME PAIR AND MEANT DIFFERENT SETS**: the intake-serving
> slice reached 370/139 by adding G691–G694 to 366/135, and the
> console-session slice reached 370/139 by adding G726–G729 to the same
> 366/135. **The number agreed and the sets did not** — the 16 Aug 2026
> capability row's exact shape, arriving on the G table. The figures above
> are re-derived by hand from the rebased tree, and
> `node tools/check-g-numbers.mjs` reports **0 duplicates · 0 trunk
> collisions** across the joined row set: the G-block reservation held
> (G691–G725 on one side, G726–G780 on the other). **BOTH NARRATIONS BELOW
> ARE KEPT AND NEITHER IS CORRECT ABOUT THIS TREE.**

> ⚠️ **366 -> 370 AND 135 -> 139 ON 19 Sep 2026, THE INTAKE-SERVING SLICE.**
> The four rows are **G691–G694**, all four **DERIVED, NOT THE OWNER'S** on
> their own faces as G190, G356 and G376 are, and all four ✅ in the commit
> that applies them — the migration, the model module, the two mounts and the
> two test suites land together, so there is no interval in which a row here
> claims something the tree does not do. **The 366 and the 135 were CORRECT
> when this sweep arrived.** 🛑 **G695–G725 ARE RESERVED TO THIS SLICE AND
> UNSPENT**, as are migrations `0070`–`0078`; one migration landed, `0069`.
> ⚠️ **BOTH FIGURES REMAIN FACTS ABOUT A TREE ANOTHER AGENT IS CONCURRENTLY
> CHANGING.** Run both commands after any merge; do not read either number.

> ⚠️ **366 -> 370 AND 135 -> 139 ON 19 Sep 2026, THE CONSOLE-SESSION SLICE.**
> The four rows are **G726–G729**, and **one of the four is the OWNER'S** —
> G726 applies the ruling of 19 Sep 2026, *"The data plane serves the console
> hosts, with tenant-less sessions"* — while G727, G728 and G729 are
> **DERIVED** and say so on their own faces as G190, G356, G376, G511, G531,
> G533, G576 and G602 do. All four carry ✅ in the commit that applies them:
> nothing is ruled here that is not also built, so there is no interval in
> which a row claims something the tree does not do. **The 366 and the 135
> were CORRECT when this sweep arrived**, which is recorded because most
> sweeps of these two lines have found one of them already behind.
> 🛑 **AND THE SLICE MOUNTS NOTHING: the served set is unchanged at 15 of
> 136** — `grep -rn 'handlers:' server/*/start.ts` — because G602 measures
> that the administration tier's annotation is all-or-nothing, and because
> G728 finds a second blocker G602 does not name: **`authorize()` cannot mint
> invariant 10's record for a tenant-less act**, and G301's sixth boot fence
> makes minting a precondition of mounting. ⚠️ **G730–G780 ARE RESERVED TO
> THIS SLICE AND UNSPENT**, as are migrations `0079`–`0090`; **no migration
> landed.** Both figures are facts about a tree other agents are concurrently
> changing — run both commands after any merge.

> 🛑 **366 AND 135 ARE A MERGE'S NUMBERS AND NEITHER PARENT COMPUTED
> EITHER — §5.11 WITH A SECOND PARENT, IN THIS FENCE, AGAIN.** `origin/main`
> said **365 / 134** after the platform-principal slice's two rows; this
> branch said **364 / 133** after G641's one. Both were correct about their
> own tree and both were dead the instant the trees joined. The figures above
> are re-derived by hand from the rebased tree, and
> `node tools/check-g-numbers.mjs` reports **0 duplicates · 0 trunk
> collisions** across the merged row set — the G-block reservation held
> (G601–G640 on one side, G641–G655 on the other). **Both narrations below
> are kept and neither is correct about this tree.**


> ⚠️ **363 -> 365 AND 132 -> 134 ON 19 Sep 2026, THE PLATFORM-PRINCIPAL
> SLICE.** The two rows are **G601** (the OWNER's, applied) and **G602**
> (**DERIVED, NOT THE OWNER'S** on its own face as G190, G356, G376, G511,
> G531, G533 and G576 are), and both carry ✅ in the commit that applies them —
> the capability set, the fence, the branch and two witnessed test files land
> together, so there is no interval in which a row here claims something the
> tree does not do. **The 363 and the 132 were CORRECT when this sweep
> arrived**, which is recorded because most sweeps of these two lines have
> found one of them already behind. 🛑 **AND THE SLICE MOUNTS NOTHING AND
> ANNOTATES NOTHING: the served set is unchanged at 15 of 136** —
> `grep -rn 'handlers:' server/*/start.ts` — and
> `docs/contracts/administration.openapi.yaml` is byte-identical, because
> G602 measures that the tier's annotation is ALL-OR-NOTHING and 33 of its 59
> operations have no evaluator that could name a verb. ⚠️ **G603–G640 ARE
> RESERVED TO THIS SLICE AND UNSPENT**, as are migrations `0046`–`0055`; **no
> migration landed.** Both figures are facts about a tree other agents are
> concurrently changing — run both commands after any merge.

> ⚠️ **363 -> 364 AND 132 -> 133 ON 19 Sep 2026, THE MEMBERSHIP-LIVENESS-ON-READ
> SLICE.** The one row is **G641** and it is **THE OWNER'S**, not derived — the
> ruling `db/migrations/0035` put to them and deliberately did not take: *"the
> CLOCK ARRIVING IS NOT AN `UPDATE` … Closing it needs a reader-side liveness
> check or a sweeper, and neither is a trigger's to decide."* It carries ✅ in
> the commit that applies it, so there is no interval in which this table
> claims something the tree does not do. **The 363 and the 132 were CORRECT
> when this sweep arrived**, which is recorded because most sweeps of these two
> lines have found one of them already behind. 🛑 **THE SLICE MOUNTS NOTHING
> AND ADDS NO MIGRATION** — `0056`–`0058` are reserved to it and UNSPENT, and
> so are G642–G655. ⚠️ **BOTH FIGURES REMAIN FACTS ABOUT A TREE ANOTHER AGENT
> IS CONCURRENTLY CHANGING.** Run both commands after any merge.

> ⚠️ **354 -> 356 AND 124 -> 126 ON 19 Sep 2026, THE MEMBERSHIP-TRIGGER SLICE.**
> The two rows are **G561** and **G562**, both **DERIVED, NOT THE OWNER'S** on
> their own faces as G190, G356, G376 and G510 are, and both ✅ in the commit
> that applies them — `db/migrations/0035_membership_liveness_voids_sessions.sql`
> and its four new witnesses land together, so there is no interval in which a
> row here claims something the tree does not do. **The 354 and the 124 were
> CORRECT when this sweep arrived**, which is recorded because most sweeps of
> these two lines have found one of them already behind. ⚠️ **AND BOTH REMAIN
> FACTS ABOUT A TREE ANOTHER AGENT IS CONCURRENTLY CHANGING**; G563–G575 are
> reserved to this slice and UNSPENT, as are migrations `0036`–`0038`. Run both
> commands after any merge; do not read either number.

> ⚠️ **354 -> 358 AND 124 -> 128 ON 19 Sep 2026, THE STAFF-CONSOLE
> REGISTRATION SLICE.** The four rows are **G533–G536**, all four **DERIVED,
> NOT THE OWNER'S** on their own faces as G190, G356, G376, G511 and G531 are,
> and all four ✅ in the commit that applies them — a registration, a
> measurement, a model module and a checker fix, with nothing ruled that is
> not also built. **The 354 and the 124 were CORRECT when this sweep
> arrived**, which is recorded because most sweeps of these two lines have
> found one of them already behind. 🛑 **AND THE SLICE MOUNTED NOTHING: the
> served set is unchanged at 15 of 136** — `grep -rn 'handlers:'
> server/*/start.ts` — because G534 measures what mounting one of the 59
> would cost today and the answer is an ungated, unrecorded read.
> ⚠️ **G537–G560 ARE RESERVED TO THIS SLICE AND UNSPENT**, as are migrations
> `0028`–`0034`; **no migration landed.** Both figures are facts about a tree
> other agents are concurrently changing — run both commands after any merge.

> ⚠️ **354 -> 357 AND 124 -> 126 ON 19 Sep 2026, THE PARTNER-GRANT SLICE.** The
> three rows are **G576–G578**, all three **DERIVED, NOT THE OWNER'S** on their
> own faces as G190, G356 and G376 are, and the two ✅ are those of them that
> are applied. 🛑 **THE ROW THAT DOES NOT MOVE `applied` IS THE POINT OF THE
> SLICE: G578 measures that the partner portal's TWENTY-FOUR operations mount
> nothing and that `partner_grant_absent` — the reason four documents gave —
> was never that tier's blocker.** A row recording a measurement as applied
> would be the disagreement G286 was ruled on. **The 354 and the 124 were
> CORRECT when this sweep arrived.** ⚠️ **AND BOTH REMAIN FACTS ABOUT A TREE AT
> LEAST ONE OTHER AGENT IS CONCURRENTLY CHANGING** — the staff (H) half of the
> same contract file is being built elsewhere, and G579–G600 are reserved to
> this slice and UNSPENT, as are migrations `0040`–`0045`. Run both commands
> after any merge; do not read either number.

> ⚠️ **349 -> 351 AND 118 -> 120 ON 19 Sep 2026, THE CUSTOMER-SURFACE SLICE.**
> The two rows are **G531** and **G532**, both **DERIVED, NOT THE OWNER'S** on
> their own faces as G190, G356 and G376 are, and both ✅ in the commit that
> applies them — each lands as a CONTROL rather than as a route, which is the
> only form either finding has. **The 349 and the 118 were CORRECT when this
> sweep arrived.** 🛑 **AND WHAT THE SLICE DID NOT DO IS THE POINT OF G531:
> IT MOUNTED NOTHING.** The served set is unchanged — derive it, never read
> it: `grep -rn 'handlers:' server/*/start.ts` — because G300 admits none of
> the four screens G318's fourth wave was for. ⚠️ **BOTH FIGURES REMAIN FACTS
> ABOUT A TREE THREE OTHER AGENTS ARE CONCURRENTLY CHANGING**; G533–G550 are
> reserved to this slice and UNSPENT, as are migrations `0023`–`0026`. Run
> both commands after any merge; do not read either number.

> ⚠️ **349 -> 352 AND 118 -> 122 ON 19 Sep 2026, G512.** The three rows are
> **G512–G514**, all three **DERIVED, NOT THE OWNER'S** on their own faces as
> G190, G356, G376 and G511 are, and all three ✅ in the commit that applies
> them — the migration, the contract operation, the mount, the handler and four
> test suites land together, so there is no interval in which a row here claims
> something the tree does not do. **`applied` moves by FOUR and the row count by
> THREE, and the fourth is the interesting one: G511 goes from `not applied` to
> ✅ DISCHARGED**, because that row's whole content is an enumeration of what a
> commit owed and every one of its seven items is now built. Its original status
> cell is QUOTED inside the new one rather than replaced: it was right when
> written, and it is the sentence two slices acted on.
> 🛑 **THE ROW THAT DID NOT MOVE IS WORTH READING TOO — `0021` IS STILL
> RESERVED AND UNSPENT, AND `0016` IS STILL A PERMANENT GAP.** A G block is
> reserved to a slice, not consumed by it: G515–G530 are unspent.
> ⚠️ **AND BOTH FIGURES ARE FACTS ABOUT A TREE THREE OTHER AGENTS ARE
> CONCURRENTLY CHANGING** — §5.11 with a second parent, which this fence has now
> recorded five times. Run both commands after any merge; do not read either.

> 🛑 **349 AND 118 ARE A FOUR-PARENT MERGE'S NUMBERS AND NO BRANCH EVER
> COMPUTED EITHER — §5.11 WITH A SECOND PARENT, AGAIN, IN THIS FENCE, FOR THE
> SECOND TIME IN ONE DAY. AND THIS TIME TWO BRANCHES AGREED ON A NUMBER AND
> MEANT DIFFERENT SETS**, which is the 16 Aug 2026 capability row's exact
> shape: *the number agreed and the sets did not.* Four slices swept these
> two lines on 19 Sep 2026 and **each was correct about its own tree**:
>
> | | rows | applied |
> |---|---:|---:|
> | `main` at the first fork point | 333 | 106 |
> | the router slice (G486–G488) | **340** | **110** |
> | the administrative-reach slice (G447–G450) | **337** | **107** |
> | the correspondence slice (G471–G473) | **336** | **109** |
> | `main` after those three merged | **343** | **113** |
> | the administrative-directory slice (G506–G511) | **343** | **112** |
> | **the merged tree** | **349** | **118** |
>
> 🛑 **READ THE TWO 343s.** `main` reached 343 by merging three slices; the
> administrative-directory branch reached 343 by adding six rows to its own
> 337. **The two 343s are not the same set, and a merge that took either
> side's number would have looked textually clean and been wrong.** The
> `applied` column is what gives it away — 113 against 112 — and only because
> G511 is the one row of six that deliberately does not carry ✅.
>
> Both figures above are re-derived from the merged tree by hand, and
> `node tools/check-g-numbers.mjs` reports **0 duplicates · 0 trunk
> collisions** — the G-block reservation held across five agents.
> **The narration blocks below are kept, all of them, and none is correct
> about this tree.** Each was right about the branch that wrote it, and
> deleting one would erase a sweep that really happened.


> ⚠️ **337 -> 343 AND 107 -> 112 ON 19 Sep 2026, THE ADMINISTRATIVE-DIRECTORY
> SLICE.** The SIX rows are **G506–G511** and **five of the six carry ✅**,
> which is unusual here and is the point: G447–G450 recorded two owner rulings
> as BLOCKED, and this slice unblocks and builds both. **G506 and G508 are the
> OWNER'S; G507, G509, G510 and G511 are DERIVED and say so on their own
> faces**, as G190, G356 and G376 do. 🛑 **THE ONE THAT DOES NOT MOVE
> `applied` IS G511, AND IT IS THE POINT OF THE SIXTH ROW: capability granting
> is now UNBLOCKED AND STILL UNBUILT.** `canGrant()` is callable and uncalled;
> the writer needs a `GRANT INSERT ON tenant.role_assignment`, and `0004`
> refuses a write privilege ahead of its writer, so the fence and the
> operation are one commit or neither. **A row that recorded a blocker as
> applied would be the disagreement G286 was ruled on.** ⚠️ **THE 337 AND THE
> 107 WERE CORRECT WHEN THIS SWEEP ARRIVED** — the second consecutive sweep of
> these two lines that did not find one of them already behind. ⚠️ **AND BOTH
> REMAIN FACTS ABOUT A TREE OTHER AGENTS ARE CONCURRENTLY CHANGING**;
> G512–G525 are reserved to this slice and UNSPENT — as are migrations `0020`
> and `0021` — and blocks outside G506–G525 are reserved elsewhere. Run both
> commands after any merge; do not read either.


> ⚠️ **333 -> 336 AND 106 -> 109 ON 19 Sep 2026, G486.** The three rows are
> **G486–G488**, all three **DERIVED, NOT THE OWNER'S** on their own faces as
> G190, G356 and G376 are, and all three ✅ in the commit that applies them —
> the router is wired, the matcher decodes, and `base` is absolute, with
> nothing ruled that is not also built. **The 333 and the 106 were CORRECT
> when this sweep arrived**, which is recorded because most recent sweeps of
> these two lines have found one of them already behind. ⚠️ **AND BOTH ARE
> FACTS ABOUT A TREE ANOTHER AGENT IS CONCURRENTLY CHANGING** —
> `feat/staff-console-and-granting` is building capability granting and its
> G block is in neither number. Run both commands after any merge.

> ⚠️ **333 -> 337 AND 106 -> 107 ON 19 Sep 2026, THE ADMINISTRATIVE-REACH
> SLICE.** The four rows are **G447–G450**, all four marked **DERIVED, NOT THE
> OWNER'S** on their own faces as G190, G356 and G376 are, and **only one
> carries ✅ — G447**, which applied a MEASUREMENT (`tests/db/administrative-
> reach.test.ts`) rather than a change. 🛑 **THE THREE THAT DO NOT MOVE
> `applied` ARE THE POINT OF THE SLICE: G448, G449 and G450 record that BOTH
> owner rulings of 19 Sep 2026 are BLOCKED**, and a row that recorded a
> blocker as applied would be the disagreement G286 was ruled on. ⚠️ **THE 333
> AND THE 106 WERE CORRECT WHEN THIS SWEEP ARRIVED** — recorded because most
> recent sweeps of these two lines have found one of them already behind, and
> this is the second in a row that did not. ⚠️ **AND BOTH REMAIN FACTS ABOUT A
> TREE OTHER AGENTS ARE CONCURRENTLY CHANGING**; G-blocks outside G447–G470
> are reserved elsewhere and are in neither number. Run both commands after

> ⚠️ **333 -> 336 AND 106 -> 109 ON 19 Sep 2026, THE G471 CORRESPONDENCE
> SLICE.** The three rows are **G471–G473**, all three marked **DERIVED, NOT
> THE OWNER'S** on their own faces as G190, G356 and G376 are, and all three
> carry ✅ in the commit that applies them — the migration, the three mounts
> and the two test suites land together, so there is no interval in which a
> row here claims something the tree does not do. **The 333 and the 106 were
> CORRECT when this sweep arrived**, which is recorded because most recent
> sweeps of these two lines have found one of them already behind.
> ⚠️ **AND BOTH ARE FACTS ABOUT A TREE TWO OTHER AGENTS ARE CONCURRENTLY
> CHANGING** — `feat/staff-console-and-granting` and `feat/wire-the-router`
> hold reserved G blocks that are in neither number. Run both commands after
> any merge; do not read either.

> ⚠️ **327 -> 328 AND 100 -> 102 ON 19 Sep 2026, G387.** The one row is
> **G411** — *a `CHECK` that evaluates to `NULL` passes, so the `NOT NULL` on
> a discriminant is half of every constraint keyed on it* — **DERIVED, NOT
> THE OWNER'S**, and it says so on its own face as G190, G356 and G376 do.
> The two ✅ are **G387** and **G411**, both marked in the commit that applies
> them. **G317 goes 🟠 -> ✅ and moves NEITHER number**, because its cell
> already carried a ✅ elsewhere in its text — which is worth knowing before
> anybody reads the applied figure as a count of applied rulings; it is a
> count of ROWS CONTAINING the character. **G376 is marked ⛔ SUPERSEDED and
> is not deleted**: its three refusals are the reasoning G387 answers.
> **The 327 and the 100 were CORRECT when this sweep arrived**, which is
> recorded because most recent sweeps of these two lines have found one of
> them already behind. ⚠️ **AND BOTH ARE FACTS ABOUT A TREE OTHER AGENTS ARE
> CONCURRENTLY CHANGING** — G396–G410 are reserved elsewhere and are in
> neither number. Run both commands after any merge; do not read either.

> ⚠️ **327 -> 331 AND 100 -> 103 ON 19 Sep 2026, THE G386 SLICE.** The four rows
> are **G396–G399**, all four marked **DERIVED, NOT THE OWNER'S** on their own
> faces as G190 and G356 are, and the three ✅ are those of them that are
> applied. **The row count moves by four and `applied` by three, and the row
> that does NOT move it is the interesting one:** G399 records a live defect
> this slice FOUND and deliberately did not repair, and a row that recorded a
> finding as applied would be the disagreement G286 was ruled on.
>
> 🛑 **AND `G386` ITSELF IS 🟠 AND CARRIES NO APPLIED GLYPH, DELIBERATELY.** Its
> fence and its read are built and witnessed; its DELIVERY half has no
> production caller, because nothing in this repository mints a session. **Half
> a ruling counted as a whole one is how this table came to disagree with the
> tree in the first place.** Run both commands; do not read either number.

> 🛑 **325 AND 99 ARE A MERGE'S NUMBERS AND NO BRANCH EVER COMPUTED EITHER.**
> §5.11 with a second parent, for the sixth time — and this time with **SEVEN**

> ⚠️ **317 -> 319 AND 91 -> 94 ON 19 Sep 2026, THE G340 SLICE.** Two rows
> — **G343** and **G344**, both marked **DERIVED, NOT THE OWNER'S** on their
> own faces — and **three** ✅: those two plus **G340 itself**, which this
> slice applies. The gap between two and three is the whole difference between
> taking a ruling and applying one, and it is why the two commands disagree by
> a different amount. **Re-derive both after any merge; the block below is six
> parents' worth of evidence that a number here is a fact about a tree.**
>
grep -E  '^\| G[0-9]+ \|' docs/HANDOFF.md | grep -c '✅'     # 94 applied
```

> ⚠️ **317 -> 320 AND 91 -> 94 ON 19 Sep 2026, G357.** The three rows are
> **G357, G358 and G359**, and all three carry ✅ in the commit that applies
> them — the migration, the column-level grant and the four mounts land
> together, so there is no interval in which a row here claims something the
> tree does not do. **The 317 and the 91 were CORRECT when this sweep
> arrived**, which is worth recording because five of the last six sweeps of
> these two lines found one of them already behind; this is the first in a
> while that did not. ⚠️ **AND BOTH ARE STILL FACTS ABOUT A TREE TWO OTHER
> AGENTS ARE CONCURRENTLY CHANGING** — G343–G355 and G376–G385 are RESERVED
> and are in neither number. Run both commands after any merge; do not read
> either.

grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md                    # 319 rows
grep -E  '^\| G[0-9]+ \|' docs/HANDOFF.md | grep -c '✅'     # 92 applied
```

> ⚠️ **319 AND 92 ON 19 Sep 2026, G317's SLICE — AND THE 317/91 BELOW WAS
> CORRECT WHEN WRITTEN, WHICH IS THE WHOLE REASON THE COMMANDS SIT BESIDE IT.**
> That slice adds exactly **two rows** — **G376** (G317's column-level
> enforcement is not available on `usage_record`, because that record has no
> actor) and **G377** (where a migration lands ahead of its writer by ruling,
> the column set is the interface's and not the predicate's) — both **DERIVED,
> NOT THE OWNER'S**, and both saying so on their own faces as G190 and G356 do.
> It moves `applied` by exactly **one**: **G377**. **G317 itself is marked
> 🟠 rather than ✅** — its schema half is built and its column half holds on
> two of three streams, and marking it ✅ would record a premise as satisfied
> that G376 exists to say is not. **Run both commands; do not read either
> number.**
>
> 🛑 **317 AND 91 ARE A MERGE'S NUMBERS AND NO BRANCH EVER COMPUTED EITHER.**
> §5.11 with a second parent, for the sixth time — and this time with **SIX**
> parents, each of which swept these two lines correctly against its own tree:
>
> | | rows | applied |
> |---|---:|---:|
> | `main` at the fork point | 303 | 80 |
> | `feat/live-browser-validation` (G315–G318) | **307** | **81** |
> | `docs/rulings-g340-g342` (G340–G342) | **306** | **80** |
> | `feat/federated-connection-substrate` (G304–G306) | **306** | **83** |
> | `feat/mount-run-account-reads` (G300 ✅) | 303 | **81** |
> | `feat/ingestion-and-payload-storage` (G320–G322) | 306 | **85** |
| `chore/route-provenance-and-citation-sweep` (G319) | 304 | **81** |
| `feat/federated-signin` (G343–G344, G340 ✅) | 319 | **94** |
| `feat/invariant-10-event-streams` (G376–G377) | 319 | **92** |
| `feat/exceptions-operator-surface` (G357–G359) | 320 | **94** |
| **the merged tree** | **323** | **98** |
>
> **Three branches said 306 or 307 and the three were not the same set.** A
> merge that took any side's NUMBER would have looked textually clean and been
> wrong, which is the failure the 16 Aug 2026 capability row records: *the
> number agreed and the sets did not.* Both figures above were re-derived from
> the merged tree by hand, and `node tools/check-g-numbers.mjs` reports
> **0 duplicates, 0 trunk collisions** across the merged row set — the G-block
> reservation held.
>
> ⚠️ **THE NARRATION BLOCKS BELOW ARE KEPT, BOTH OF THEM, AND NEITHER IS
> CORRECT ABOUT THIS TREE.** Each was right about the branch that wrote it, and
> deleting either would erase a sweep that really happened. They are history;
> the fence above is the claim.

> ⚠️ **292 -> 307 AND 78 -> 81 ON 19 Sep 2026, G315–G318 — AND BOTH FIGURES WERE
> ALREADY ELEVEN AND TWO BEHIND BEFORE THIS SLICE TOUCHED THEM.** The tree said
> **303 rows and 80 applied** when this sweep arrived; G304–G314 and G320–G339
> are RESERVED to three concurrent agents and are not in either figure yet.
> **This slice moves `applied` by exactly one — G316, ✅ in the commit that
> applied it** — and adds four rows. The other eleven rows and two ✅ are named
> here so the sweep is not read as accounting for them. **That is the FIFTH
> consecutive sweep of these two lines to find one of them already behind**,
> which is the argument for running the two commands rather than for writing a
> better number in this fence.
>
> 🛑 **AND THE ROW FIGURE IS A FACT ABOUT A TREE THAT THREE CLOUD AGENTS ARE
> CONCURRENTLY CHANGING.** §5.11 with a second parent, and this time the
> parents are known in advance rather than discovered at the merge. Re-run both
> commands after every merge; do not read either number.
> ⚠️ **AND A FIFTH CONSECUTIVE TIME, 19 Sep 2026: BOTH FIGURES SAID 292 AND 78
> AND THE TREE ALREADY SAID 303 AND 80 BEFORE THE G304 SLICE TOUCHED THIS
> PAGE.** That slice adds exactly three rows — **G304, G305, G306**, all three
> ✅ in the commit that applies them, and all three marked **DERIVED, NOT THE
> OWNER'S** on their own faces, as G190 is. **The other eleven rows and two ✅
> are not its to account for** and are named so this sweep is not read as
> though they were. Derive both at HEAD before quoting either:
> `git show HEAD:docs/HANDOFF.md | grep -cE '^\| G[0-9]+ \|'`.


> ⚠️ **80 -> 81 ON 19 Sep 2026, G300 — AND THE ROW FIGURE WAS ELEVEN BEHIND
> AND THE APPLIED FIGURE TWO BEHIND BEFORE THAT SLICE TOUCHED THIS PAGE.** It
> said **292 / 78** and `HEAD` already said **303 / 80**. The one ✅ this slice
> is accountable for is **G300**, marked in the commit that mounted
> `getRunAccount` and `listRunResidue`; the other eleven rows and two ✅ are not
> its to account for and are named so the sweep is not read as though they
> were. **This is the fifth consecutive sweep of these two lines to arrive and
> find one of them already behind**, which is the argument for running the two
> commands rather than for writing a better number here. ⚠️ **G301's OWN STATUS
> CELL IS STALE IN THE OTHER DIRECTION** — it reads `not applied` while the
> tree mints — and that is `docs/HANDOFF.md`'s to fix, flagged rather than
> edited.
>
grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md                    # 306 rows
grep -E  '^\| G[0-9]+ \|' docs/HANDOFF.md | grep -c '✅'     # 85 applied
```

> ⚠️ **292 -> 306 AND 78 -> 85 ON 19 Sep 2026, G295's INGESTION SLICE — AND
> BOTH NUMBERS WERE ALREADY ELEVEN AND TWO BEHIND BEFORE IT TOUCHED THEM.** At
> `HEAD` the tree said **303 / 80**; that slice adds three rows (G320–G322) and
> moves `applied` by five — **G106** and **G295**, both ✅ in the commit that
> built them, plus the three new ones. The eleven rows and two ✅ it inherited
> are not its to account for and are named so this sweep is not read as
> though they were. **This is the sixth consecutive sweep of these two lines in
> which one of them was already behind when the sweep arrived.** Run both
> commands; do not read either number.

> ⚠️ **77 -> 78 ON 19 Sep 2026, S-21.** The one row is **G292**, marked ✅ in
> the commit that applied it — its liveness terms are now the staff arm's
> predicate in `model/access.ts` §7a and in
> `db/migrations/0008_staff_grant_selection.sql`. **The ROW count did not move**:
> G289–G292 were all written at `3fdb1d91` and this slice added no ruling, which
> is what applying one rather than taking one looks like from this fence.
> ⚠️ **AND THE ROW FIGURE IS A FACT ABOUT A TREE THAT TWO OTHER AGENTS ARE
> CONCURRENTLY CHANGING** — §5.11 with a second parent. Run both commands after
> any merge; do not read either number.

> ⚠️ **AND A FOURTH CONSECUTIVE TIME, 19 Sep 2026: THE ROW FIGURE SAID 288 AND
> THE TREE ALREADY SAID 292 BEFORE G289's ARM TOUCHED THIS PAGE.** That slice
> moves `applied` by exactly one — G289, ✅ in the commit that built it — and the
> four rows (G289–G292, landed at `3fdb1d91`) are not its to account for. **Four
> sweeps in a row have arrived to find one of these two numbers already behind**,
> which is the argument for running both commands rather than for writing a
> better number in this fence.

> ⚠️ **AND AGAIN, 19 Sep 2026, ON THE SAME AXIS: THE ROW FIGURE SAID 284 AND
> THE TREE ALREADY SAID 288 BEFORE THE G287 SLICE TOUCHED THIS PAGE.** That
> slice moved `applied` by exactly one — G287, 🟠 half applied, ✅ on the bucket
> and the key factory and nothing at all on the onboarding half — and the four
> rows are not its to account for. **This is the third consecutive sweep of
> these two lines in which one of them was already behind when the sweep
> arrived**, which is the argument for the two commands rather than for a
> better number.

> ⚠️ **BOTH NUMBERS SAID 197 AND 39 UNTIL 19 Sep 2026 AND BOTH WERE ALREADY
> EIGHTY-SEVEN AND TWENTY-EIGHT BEHIND BEFORE THE SESSION SLICE TOUCHED THEM.**
> That slice moved `applied` by exactly two — G160 and G199, both ✅ in the
> commit that built them — and the other twenty-eight are not its to account
> for; they are named here so the sweep is not read as though they were.
> **`tools/check-doc-counts.mjs` governs NEITHER figure** (G rows are not one of
> its fourteen governed totals), which is why both could sit eighty-seven behind
> with the gate EXIT 0 throughout. **Run the two commands; do not read the two
> numbers.**
>
> ⚠️ **284 -> 288 AND 69 -> 73 ON 19 Sep 2026, G286.** The four rows are G285-G288
> (⚠️ **the 284 was already stale at `2f725c83`, which landed four rows and swept
> neither figure — not G286's to make stale, named so this sweep is not read as
> accounting for both**) and the four ✅ are G65, G111, G112 and G286 itself, all
> marked in the commit that applied them. **A ruling recorded as unapplied while
> the tree applies it is the exact disagreement G286 was ruled on**, so leaving
> them would have reproduced the defect one table over.
>
> 🛑 **AND THE ROW COUNT WAS WRITTEN AS 283 AND WAS DEAD BEFORE IT WAS
> COMMITTED, WHICH IS §5.11 WITH A SECOND PARENT HAPPENING AGAIN.** 283 was
> correct against the tree the session slice was written on; rebasing onto
> `origin/main` brought G285 with it and the answer became 284 — *a count is a
> fact about a tree, and a merge makes a new tree.* The figure above is
> re-derived from the rebased tree. **Re-run it; do not read it.**

⚠️ **This paragraph read *"Eighteen rulings — G96–G113 — were taken on 8 Aug 2026
evening and NOT ONE is applied"*. The first half still holds and the framing has
moved past it TWICE.** Rulings now run to **G197** — ⚠️ **this said G131 until
16 Aug 2026, sixty-six rows behind** — and **G114–G131 is a second block of
eighteen of which eight carry ✅** — G114, G115, G123, G127, G128, G129, G130,
G131. **G132–G197 is a third block of sixty-six of which FOUR carry ✅** — G145,
G146, G153, G172 — so the applied fraction has fallen sharply as the table grew,
which is a fact about the table's maintenance and not necessarily about the tree.
Derive all of it, because nothing checks any of it:

```bash
grep -oE '^\| G[0-9]+ ' docs/HANDOFF.md | grep -oE '[0-9]+' | sort -n | tail -1   # highest ruling
for n in $(seq 96 197); do grep -E "^\| G$n \|" docs/HANDOFF.md \
  | grep -q '✅' && echo "G$n applied"; done
```

🛑 **THE RULINGS THIS PAGE NOW DEPENDS ON AND DID NOT NAME UNTIL 16 Aug 2026.**
None of the six carries ✅ in that table, and three of them are visibly built:

| | | |
|---|---|---|
| **G186–G190** | design | **The palette is the teal/green brand sheet and it SUPERSEDES G72's electric violet outright** (G186). `design/system/tokens.css` is the **token authority** — `--agent:#00866a`, `--agent-deep:#014751`, `--ink:#00303f`, with the contrast maths as the argument. G190 is the only row in the pass that is **derived, not the owner's**, and says so on itself. Read `DESIGN.md` and `.impeccable/direction-record.md`; G72's world survives, its colour does not |
| **G191** | build | **The four OpenAPI tiers are the ROUTER AND THE VALIDATOR: Fastify, schema-first, every dependency pinned exact.** This is why `package.json` has runtime dependencies at all |
| **G192** | test-infrastructure | **A local-only signed test token, fenced behind one explicit local flag with no permissive default.** The row opens by saying it contradicts two rows in the table and one declaration — read it before touching `server/dev/` |
| **G193** | build | **Two processes, two databases, compose — the plane boundary is enforced by TOPOLOGY, not by review.** It takes the alternative G185 preserved as rejected, and the row says so |

**Read G186–G197 before touching `design/` or `server/`**, the same way you read
G96–G113 before touching anything below `model/`.

**G96–G113 remain 0-of-18 applied by that table** — the build decisions: the first
new devDependency, the database client and ORM, RLS polarity, pooling mode, the
reconciliation engine, the plane split, one gate, one money codec. 🛑 **Several of
them are visibly applied in the tree and the table has not caught up** — G108's
gate is in `package.json` and `.github/`, and G97/G100/G101's schema and roles are
in `db/`. ⚠️ **`and .github/` WENT FALSE ON 18 Sep 2026 AND IS CORRECTED RATHER
THAN DELETED — G1331. G108's gate is in `package.json` ALONE**, plus a
CodeBuild project in an AWS account that this tree can only synthesise, never
observe. `ls -la .github` → *No such file or directory*. **The claim the
sentence was making — that G108 is visibly applied — SURVIVES**; only the
second of its two addresses is gone. **`docs/HANDOFF.md` §3 outranks this file on any decision, so believe
its reasoning and check the tree for its ✅.** Read G96–G113 before writing any
code below `model/`. `tools/check-doc-counts.mjs` does **not** govern any number in
this block — nothing but a person will catch them going stale again.
`docs/INDEX.md` maps every document — ⚠️ **and is itself stale**, see below.

| Need | Read |
|---|---|
| What may be claimed about the product | `PRODUCT.md` |
| The entity model and why it is shaped that way | `docs/domain-model.md` — §11 is the changelog; §16 is the resource axis |
| Access: who may do what, to which class of thing | `docs/access-and-agency.md` — §11 first if you are touching `model/access.ts` |
| Decisions from the adversarial reviews | `docs/model-change-ledger.md` |
| Compliance, retention, residency, partner access | `docs/data-governance.md` |
| Policy, autonomy, metering, billing | `docs/policy-and-billing.md` |
| The decided data shape; blocker for the schema | `docs/data-architecture.md` |
| Demo placement, accounts, identity | `docs/tenancy-topology.md` |
| Build-versus-buy, with licence verdicts | `docs/integration-options.md` |
| Endpoints, payloads, error codes | `docs/contracts/README.md` |
| **What is dropped for v1, and why** | `docs/v1-scope-ledger.md` — a dated snapshot under G32, not a living control |
| Which interfaces are entities and which are value objects | `docs/identity-classification.md` |
| **Live security issues in the AWS account we inherit** | `docs/infrastructure-risk-register.md` |
| What is salvageable from the replaced application | `docs/salvage-ledger.md` |
| A visual of the whole model | `docs/model-topology.html` — **check its staleness banner first** |
| **The colours, type and light** | `docs/handoff-pack/tokens.css` — **THE KERNEL, moved 18 Sep 2026 under G274**, *"the only place a colour, a type step, a spacing unit, a duration, a layer or a breakpoint is declared"*. A measured superset of the old one: **73 light + 26 dark properties against 40, of which 36 survive by name and 26 byte-identical**. It ships **`--refused`, which IS G245** — ruled 23 Aug 2026 and *RULED, NOT APPLIED* until now — and **`--face-sans`**, which retires `bridge.css`'s `--font-*: initial` fence rather than overriding it. ⛔ **`design/system/tokens.css` and `DESIGN.md` are DELETED**; the pack's `Design System` record is authority for what a colour **means**. 🛑 **G275: the two records each claim nineteen named rules and the sets differ** |
| **The surfaces, the journeys, and what each one is FOR** | `docs/handoff-pack/` — **THE NORTH STAR, G264.** Start at `index.html`, then the four records: **Functional Specification** (what the product does, feature by feature, **359** status rows — ⚠️ **this said ~363 until 19 Sep 2026 and nothing checks it; derive it, never read it: `grep -ohE '<td[^>]*>(built\|specified\|partial\|not built)</td>' 'docs/handoff-pack/Functional Specification.dc.html' | wc -l` → 359, of which 242 `built` · 59 `not built` · 51 `specified` · 7 `partial`. The four legend entries in `<b>` tags are NOT rows, and the naive `grep -c '>built<'` counts them**), **User Journeys** (**35** journeys — ⚠️ **this said 33 across *three* actor classes until 19 Sep 2026 and BOTH halves were wrong. Derive: `grep -ohE "id:'[A-Z][0-9]+'" 'docs/handoff-pack/User Journeys.dc.html' | sort -u | wc -l` → 35, prefixes C13 · H11 · P9 · **V2**. 🛑 THE FOURTH CLASS IS THE POINT: V1 and V2 carry `roles:'visitor / prospect'`, a VISITOR with no tenant, no session and no capability model — and the pack's own lede and masthead still say *"three actor classes"*, so this is the north star miscounting itself and this page having copied it**), **Design System** (the kernel, the six indicators, the fourteen primitives, the shadcn mapping), **Handoff Specification** (the design-system spec — ⚠️ **NOT a build order, despite the index calling it *"the sequence"*; `grep -rniE 'build (order\|first\|sequence)\|phase [0-9]' docs/handoff-pack/*.dc.html` returns nothing**). 🛑 **"built" THERE MEANS *drawn and operable in these HTML files* — 242 rows carry it and roughly 230 of them are NOT built in this repository's sense.** G264–G278 record every collision |
| **WHETHER THE PACK'S TWO CLEARED SURFACES AGREE WITH EACH OTHER, AND WHY NOTHING CHECKED UNTIL NOW** | `tests/docs/pack-figure-consistency.test.ts` — read its header first, because the honest half is what it CANNOT know — then `docs/HANDOFF.md` **G1906**, **G1907** and **G1908**. 🛑 **`docs/handoff-pack/` PUBLISHES ONE ENGAGEMENT'S FIGURES ON TWO SURFACES, `PRODUCT.md` CLEARS THEM BY NAME UNDER G268, AND NOTHING IN `npm run check` READ A FIGURE ON EITHER.** Measured before the file was written: `grep -rln 'V1 Landing\|V4 Success Story' tests/ tools/` returned **nothing**. `check-doc-counts` governs fourteen tree-derived totals and not one is a number inside the pack. ⚠️ **THE CLAIM IS *NOTHING READ A FIGURE*, NOT *NOTHING OPENED THE FILE***: `tests/app/route-provenance.test.ts` walks every `.dc.html` through `readdirSync` for `surface:` tokens and has read both pages' bytes since G319 — **and has no notion of a figure**. 🛑 **THE DEFECT IS NOT HYPOTHETICAL AND IT LASTED ONE COMMIT: G1901 moved `V4`'s tile to `20→7` and left `V1 Landing` at `15→7`, and `V1`'s tile sits beside a *Read the full story* button pointing at `V4`** — two baselines for one engagement, ONE CLICK APART, on a green gate. G1907 closes it. 🛑 **READ WHAT A GREEN RUN MEANS BEFORE QUOTING ONE: IT ASSERTS MUTUAL CONSISTENCY AND CANNOT ASSERT TRUTH.** The workload panel it derives from is `transactions × 20/60` (**G1908**), so a pack that consistently published a wrong baseline everywhere would be GREEN. ⚠️ **WITNESSED RED TWICE AGAINST REAL COMMITS** — `248e3e8` (both tiles, plus the prose sentence) and `e5080fa` (`V1` alone) — with both messages quoted verbatim on the assertions that produced them, **and the anti-vacuity case witnessed too**: break the panel's parse and §1a fails rather than §2 passing over an empty set. ⚠️ **WHAT IT DOES NOT COVER IS ENUMERATED ON ITS OWN FACE**: truth, every other cleared figure (`727 hrs`, `85%+`, `58+`, `6,000`, the `9→7` step pairs), the record (`PRODUCT.md`, `docs/HANDOFF.md`, the pack INDEX — **G1909**), a fourth prose phrasing, a figure spelled in words, and **whether a claim is marked as a projection — G1910** |
| **The surfaces, the journeys, and what each one is FOR** | `docs/handoff-pack/` — **THE NORTH STAR, G264.** Start at `index.html`, then the four records: **Functional Specification** (what the product does, feature by feature, **358** status rows carrying the four-word vocabulary, **363** counting `refused` — 🛑 **THIS SAID 359 AND 51 `specified` UNTIL 21 Sep 2026 AND BOTH WERE QUOTING A GHOST — G1345. THE OLD SENTENCE IS KEPT HERE BECAUSE ITS DERIVATION IS QUOTED IN `docs/build/completion-plan.md` AND A READER MUST BE ABLE TO RECOGNISE IT:** *"**359** status rows … `grep -ohE '<td[^>]*>(built\|specified\|partial\|not built)</td>' 'docs/handoff-pack/Functional Specification.dc.html' \| wc -l` → 359, of which 242 `built` · 59 `not built` · 51 `specified` · 7 `partial`"*. **The file was MALFORMED at line 87** — a spliced edit left `</tr>ing` mid-cell, so `S1 · Staff console` carried BOTH `built` AND `specified`. **A browser foster-parents the orphan out of the table and a human saw one status; every grep-based reader saw two**, and that one phantom cell is the whole of the 359-against-358. **The markup is repaired (G1333) and both methods now agree: 242 `built` · 59 `not built` · 50 `specified` · 7 `partial`, plus 5 `refused` the old four-word grep never counted at all.** ⚠️ **AND SINCE 1 Oct 2026 THE WALK ANSWERS 242 `built` · 58 `not built` · 40 `specified` · 7 `partial` · 16 `refused` — R16, THE OWNER'S (`docs/HANDOFF.md` G2442, G2448): eleven rows that were rulings rather than tasks were declined and moved to `refused`, each with its reason on the row. The figures before this clause are kept as they stood.** 🛑 **AND THE DERIVATION IS RETIRED RATHER THAN RE-RUN, BECAUSE IT IS §5.1: it keys on the landmark `<td>status</td>` instead of on the property *is this a feature row*.** The file holds **47 tables in NINE distinct column shapes**, two of which carry no `Status` column at all, so a cell grep cannot tell a feature row from a role row, a surface row or a keyboard-shortcut row. **Walk `<table>`→`<tr>`, never grep cells** — and note the repaired file happens to agree, which is exactly the coincidence that let the old command look right for three days. ⚠️ **NOTHING IN `npm run check` GOVERNS ANY OF THESE FIGURES**, so all of them are checked by a person. ⚠️ **The four legend entries in `<b>` tags are NOT rows, and the naive `grep -c '>built<'` counts them**), **User Journeys** (**35** journeys — ⚠️ **this said 33 across *three* actor classes until 19 Sep 2026 and BOTH halves were wrong. Derive: `grep -ohE "id:'[A-Z][0-9]+'" 'docs/handoff-pack/User Journeys.dc.html' | sort -u | wc -l` → 35, prefixes C13 · H11 · P9 · **V2**. 🛑 THE FOURTH CLASS IS THE POINT: V1 and V2 carry `roles:'visitor / prospect'`, a VISITOR with no tenant, no session and no capability model — and the pack's own lede and masthead still say *"three actor classes"*, so this is the north star miscounting itself and this page having copied it**), **Design System** (the kernel, the six indicators, the fourteen primitives, the shadcn mapping), **Handoff Specification** (the design-system spec — ⚠️ **NOT a build order, despite the index calling it *"the sequence"*; `grep -rniE 'build (order\|first\|sequence)\|phase [0-9]' docs/handoff-pack/*.dc.html` returns nothing**). 🛑 **"built" THERE MEANS *drawn and operable in these HTML files* — 242 rows carry it and roughly 230 of them are NOT built in this repository's sense.** ⚠️ **THE *roughly 230* — i.e. ~12 built — IS CORRECTED RATHER THAN DELETED, 21 Sep 2026, G1735: IT IS NOT REPRODUCIBLE AT ANY BAR, AND THAT IS THE FINDING RATHER THAN THE ARITHMETIC — the sentence never said which bar it used.** The 242 are now joined to the tree row by row, BY NAME, at `docs/build/pack-tree-join.md` (`completion-plan.md` §10 item 4): **5 fully built** — the whole chain closed, and all five are H2 onboarding, mounted in this wave — **41 partially built with the gap named**, and **196 drawn only**. **So the strict answer is 5 and the loosest defensible one is 46; ~12 matches neither and sits between them.** ⚠️ **AND THE FIRST CLAUSE OF THIS SENTENCE IS UNCHANGED AND IS THE HALF THAT MATTERS**: the two `built`s measure DIFFERENT OBJECTS, so the ratio is not a progress bar and building the product will never move 196 of these rows. G264–G278 record every collision |
| **Why the visual world is what it is** | `.impeccable/direction-record.md` — where G72 pinned it and G186 replaced its palette |
| **WHERE A PAYLOAD IS STORED, WHAT MAKES A POSITION IN IT READABLE, AND WHERE A SUBJECT RESTS** | `db/migrations/0012_payload_and_subject_index.sql` first — it argues the whole shape — then `server/data-plane/payload-store.ts` and `server/data-plane/subject-digest.ts`. **G295, 19 Sep 2026: G106's storage half lands WITH the ingestion path and WITH the subject index, not before either and not after.** The contract's word for landing the payload alone is **UNRECOVERABLE** — *a classified value stored without a `FieldSpec` path and without a registered location cannot be retroactively attributed*. 🛑 **"ATTRIBUTABLE" MEANS TWO THINGS AND THE FILE SEPARATES THEM: READ-attributable** is G106's UNREADABLE (a key with no `FieldSpec` is stored and unaddressable, fail-closed, **and defaulting it to the most sensitive class stays REFUSED**); **ERASURE-attributable** is G295's UNRECOVERABLE (the location is registered at CREATION time, because *"a scan cannot find a value inside a stored Explanation"*). ⚠️ **G320** argues the one `jsonb` column against G284 rather than around it — G284's refusal named *"until G106's storage half exists"* as its own premise, and a payload has no closed set of keys to make typed columns from. ⚠️ **G321: `subject_ref` is a TENANT-SALTED KEYED DIGEST, NOT `SubjectKeyScheme`'s HMAC** — it defeats cross-tenant correlation and **does not resist a guessing attack**, because there is no key store; do not describe it as an HMAC. ⚠️ **G322: one of `SubjectLocation`'s ELEVEN variants has columns**, behind a `CHECK`, so the index is honestly partial rather than falsely complete. 🛑 **NOTHING IS MOUNTED** — G300 needs table AND model AND capability, and `Document` wants an extraction and a `Provenance` this slice does not produce; the columns are proven by `tests/db/payload-and-subject-index.test.ts` instead of by a route, which is `0007`'s precedent |
| **What MONEY IS, and the one thing that may convert it** | `model/money.ts` — **G111's codec, landed 19 Sep 2026 under G286**, and the only place a `Money` becomes a wire string or a wire string becomes a `Money`. `amountMinor` is `bigint`; the wire is a DECIMAL STRING, because JSON has no bigint and a JSON number is an IEEE double that loses exactness above 2^53. 🛑 **The record said `bigint` from 8 Aug 2026 and the tree said `number` until this ruling; G286 rules the CODE was wrong.** `model/reconciliation.ts` §3 is here now and its old home re-exports it, so no import path changed. ⚠️ **Two refusal arms were re-homed, not retired** — read the header before quoting `not_integer_minor_units` or `exceeds_exact_integer_range` |
| **WHERE A RECONCILIATION RESULT IS STORED, and why it is not one `jsonb` column** | `db/migrations/0007_run_engine_account.sql` first — it argues the whole shape — then `server/data-plane/run-account-store.ts` and `server/data-plane/engine-vocabulary.ts`. **G284, 19 Sep 2026: a TYPED COLUMN PER DECLARED FINDINGS CHANNEL.** The `jsonb` operand column was refused because it **inherits invariant 4's G106 problem** — a JSONB key with no `FieldSpec` is UNREADABLE — so the findings would be *stored and unaddressable*, and **a result nobody may read is not persistence**. Cost accepted and named: **a migration per new channel**, forward-only under G88. ✅ **THE HANDLERS ARE MOUNTED — G300 AND G301, LATER ON 19 Sep 2026 — AND THE ROUTE IS `server/data-plane/run-account.ts`, READ IT THIRD.** ⚠️ **THIS READ *"THE HANDLERS ARE NOT MOUNTED AND THE CONTRACT SAYS THEY SHOULD BE … because G200's freeze was re-put to the owner the same day and reaffirmed: it binds until the gate GENUINELY ALLOWS SOMEBODY, and the gate answers `not_held` to everyone"*, AND IT IS CORRECTED RATHER THAN DELETED** because it is the sentence that told a reader the engine's read surface was unreachable. The contract's *"The handler lands with the migration, in that commit"* is DISCHARGED one commit late, and its argument is why the READER landed first: *a column with no reader is a column nothing checks*. The mount added ONE file and no SQL; `tests/http/run-account-served.test.ts` proves the route and `tests/db/run-engine-account.test.ts` is still the only place the round trip is proven. ⚠️ **TEN required channels, not the six G284's row names** — G236's `documentAccounts` and G217's `ambiguities`/`searchBoundary` arrived after the six were counted. Derive it, never read it: `sed -n '/    RunEngineAccount:/,/discriminator/p' docs/contracts/capability.openapi.yaml`. 🛑 **The `refused` arm is NOT persisted**, so a refused run and an unreconciled run are one answer today; that is stated in both files rather than hidden |
| **WHAT A DEFINITION SAYS THE ENGINE SHOULD DO, AND WHY THE ENGINE HAD NOTHING TO RUN UNTIL NOW** | `db/migrations/0160_definition_engine_spec.sql` first — it argues the five tables, the rejected `jsonb`, the one added column and the grant — then `server/data-plane/definition-store.ts`, then `tests/db/definition-engine-spec.test.ts` §1. **G1121–G1126, 20 Sep 2026; G1121 is THE OWNER'S (R-A):** *"A definition's content lives in TYPED COLUMNS, one per declared field."* 🛑 **THE GAP IS MEASURED AND IT IS TOTAL: `SetReconciliationInput` HAS EIGHTEEN FIELDS AND `tenant.reconciliation_definition` STORED FOUR** — `tenant_id`, `id`, `version`, `status`, **none of which the engine consumes** — so `runSetReconciliation()` has had no definition to run since the day it was written, and `docs/build/red-buildability.md` B3 named the shape on 7 Aug 2026. Derive it: `awk '/export interface SetReconciliationInput/,/^}/' model/reconciliation.ts \| grep -c '^  readonly'` → 18. ⚠️ **THE REJECTED `jsonb` SPEC COLUMN IS PRESERVED ON THE MIGRATION'S FACE**, refused on `0007`'s own ground — *"a JSONB key with no `FieldSpec` is UNREADABLE"*, *"a result nobody may read is not persistence"* — and the second rejected option, publishing the content downward from the pack, is right in principle and blocked on G110's absent seam. **Cost accepted: a migration per new engine knob, forward-only under G88.** 🛑 **THE COST IS PAID AT A COMPILE ERROR AND NOT AT A COMMENT (G1122):** the reader's answer is `Omit<SetReconciliationInput, 'runId' \| 'tenantId' \| 'leftDocuments' \| 'rightDocuments'>`, so a nineteenth field is a `TS2739` in the store. 🛑 **THE STRATEGIES AND THEIR BINDINGS ARE ONE ROW SET (G1124)**, so *"binds 1:1 to `pairing.strategies`, in order"* is UNREPRESENTABLE-if-broken rather than refused-at-run-time — G576's shape one table over. ⚠️ **THREE OF THE EIGHTEEN GET NO COLUMN AND THAT IS INVARIANT 4 (G1125)**: `fieldClassification`, `modelPromptEligible` and `confidenceFloors` are read from `0012`'s `document_field_spec`, whose last unread `FieldSpec` field — `confidence_floor` — gains a column here because **this commit is its reader**. Two document types DISAGREEING about one position is a REFUSAL and never a merge. 🛑 **`SELECT` AND NOTHING ELSE, ON ALL FIVE (G1126), AND THE SENTENCE IS `0150`'s REACHED FROM THE OTHER SIDE: a caller who chooses the operands chooses the answer**, and the gate, the policy and invariant 10's record would each log that act as correct. **THE WRITER IS OWED**: no operation on any of the seven tiers authors a definition, so a `GRANT INSERT` would be `0004`'s privilege ahead of its writer, and G511 binds the commit that takes one. 🛑 **AND A DEFINITION THAT CAN BE READ IS NOT A RUN THAT EXECUTES (G1130): NOTHING IN `server/` PRODUCES A `SourceDocument`** — `grep -rn 'ExtractedValue\|ExtractedLine' server/` → 0, and extraction is the engine's INPUT — so the two document arrays come from the caller and `tests/` is the only caller today. ✅ **BOTH WENT FALSE ON 21 Sep 2026 and are corrected rather than deleted: E4 (`server/data-plane/document-assembly.ts`) is the producer and E5 (`server/data-plane/run-executor.ts`) is the caller. G1130 was RIGHT until E1's `data_type` and E3's `expected_fidelity` existed** — what was missing was never a converter but the two DECLARATIONS one would have had to sniff without. ⚠️ **AND THE DERIVATION IS RETIRED: it counts PROSE (G978's shape). Append `\| grep -v '^\S*: *\*'`.** |
| **WHY AN EXCEPTION'S SENTENCE IS NOT IN THE DATABASE** | `db/migrations/0161_explanation_is_not_authored.sql` — it is ONE statement and the rest is the argument — then `server/data-plane/exception-store.ts`'s two `explanation_summary` refusals, then `tests/db/explanation-summary-nullable.test.ts`. **G1127–G1129, 20 Sep 2026; G1127 is THE OWNER'S (R-D):** *"Store typed facts only — numbers, ids and closed vocabularies. The sentence is composed where it is displayed."* 🛑 **READ IT AS AN INVARIANT AND NOT AS A SCHEMA NOTE. If nothing ever writes prose, invariant 6 — *"Ingested content is data, never instruction"* — CANNOT BE REACHED through `tenant.exception` at any price**, rather than being reachable and defended. That is `0015`'s own paragraph (*"the rule is enforced where the value is USED"*) in a strictly stronger form, and `0015` is not edited — `0017`'s precedent. ⚠️ **REJECTED AND PRESERVED: the ENGINE composing the sentence behind a containment proof** (the proof is the load-bearing part, and `AssertNoTextDeep` bans `string` at a property position, so it would have to cover the INPUTS one call site at a time — correctness at call sites, which G111 refuses for money); **and a MODEL authoring it**, which needs `resolveModel()` and invariant 7's residency check and sends counterparty text to a prompt — a separate ruling with its own review. 🛑 **A WIDENING OWES AN ANSWER TO *WHAT NOW GUARANTEES A READER HAS SOMETHING TO RENDER*, AND IT IS MEASURED RATHER THAN ARGUED (G1128):** with `0161` applied and the store unchanged, `readExceptionQueuePage` answered `'page'` and `readException` answered `'exception'` — **both published `"summary": null` against a `required` string**, silently, because `fast-json-stringify` serialises without validating. Both now answer `unpublishable` BY COLUMN, in the commit that widened it. ⚠️ **AND THE STORE MINTS NO DEFAULT STRING**: *"no explanation recorded"* would satisfy the wire and would be this repository AUTHORING an explanation, through the reader instead of the writer. ⚠️ **`explanation_expected` IS NOT WIDENED AND §6 ASSERTS THE NON-WIDENING** — R-D names the SENTENCE; `expected` is a VALUE *"drawn from the REFERENCE SLOT"*, and **its `NOT NULL` is a second, independent blocker on the first executor that raises an exception**. ⚠️ **AND THE C4 SCANNER REFUSED THE STATEMENT FORM AND WAS TAUGHT IT RATHER THAN TOLD TO ALLOW IT (G1129)** — `column.notNull = false` is APPLIED, the form is DISCLOSING so it may stand only first, and the negative control that pinned the old refusal went RED in `npm run check` and is replaced by a positive assertion plus two edges |
| **WHAT TURNS A STORED POSITION INTO AN EXTRACTED VALUE — THE ONE CONVERSION SEAM** | `model/extraction.ts` — read its header before the code, because three of its five sections are REFUSALS — then `tests/model/extraction.test.ts` §1 and §2. **G1451–G1459, 21 Sep 2026; G1451 is R12, THE OWNER'S:** *"Build extraction for `structured` and `tabular` ONLY. G7 and G8 are NOT taken."* 🛑 **IT DISPATCHES ON THE DECLARATION AND NEVER ON THE VALUE, WHICH IS INVARIANT 4 AND WAS MEASURED BEFORE IT WAS WRITTEN**: a converter dispatching on `typeof value` disagreed with the operator's declaration on **FOUR of FOUR** of E1's fixture rows — `1000` declared `money` sniffed as `number`, `"0012"` declared `identifier` sniffed as `text`, and each is a live reconciliation hazard rather than a tidiness complaint. §7 keeps that measurement RUNNABLE. 🛑 **THE TOTAL `Record` BITES TWICE FOR ONE EDIT AND THIS IS THE FIRST MODULE IN `model/` WHERE IT BITES AT ALL** — `CLAUDE.md`'s own caution is that *"a total `Record` only bites where something CONSTRUCTS one, and in a types-only model nothing does"*; a sixth `DataType` is `TS2741` at `EXTRACTED_KIND_FOR_DATA_TYPE` **and** `TS2322` at the exhaustive switch, so its author must name the scalar arm AND write the branch. 🛑 **THE R12 FENCE IS KEYED ON `FIDELITY_CROSSES_MANAGED_SERVICE`, WHICH ALREADY EXISTED IN `model/ingestion.ts` AND IS IMPORTED RATHER THAN RESTATED (§5.3)** — and the name-keyed form was witnessed defeating it: `fidelity !== 'scanned'` passes for `scanned` and **silently admits `digital_text`**, whose own declaration reads *"No OCR; a model still reads layout."* ⚠️ **THE FENCE IS NOT THE RULING**: R12 says the OCR path is NOT TAKEN pending G7 and G8, so the slice that takes them DELETES the refusal arm rather than weakening the predicate. ⚠️ **MONEY GOES THROUGH `model/money.ts` AND NOTHING ELSE (G111), SO THE JSON NUMBER E1 STORES AT A `money` POSITION IS REFUSED** — a number carries no currency and no exponent, and `minorUnitsFromCount()` is deliberately not called because there is no declared unit to count into. 🛑 **AND THE FAIL-CLOSED CONFIDENCE HOLD IT LEANS ON IS INERT, WHICH THE MODULE SAYS RATHER THAN LEAVING TO BE ASSUMED**: `heldReadsFor()` holds only where a floor was declared, G139 records that no authoring surface for floors exists, and `0012` grants `SELECT` alone on the column `0160` added — so every position carries `confidence: null` and **not one is held**. ⚠️ **IT MOUNTS NOTHING AND HAS NO CALLER OUTSIDE `tests/`** — E3, E4 and E5 are separate slices |
| **What a `FieldPath` IS, and the one thing that may make one** | `model/kernel.ts` for the grammar — stated once, on the declaration — then `model/field-path.ts`, which is the only parse. G214, 22 Aug 2026. A path is a token list, not a string: `grep -c 'export type FieldPath = string' model/kernel.ts` → 0 |
| **How a request becomes a subject, an org and a host** | `model/access.ts` §7 (`resolveSubject`, `orgFor`, `TenantContext`) and `model/serving-host.ts` (the host→tenant registry, `checkHostBinding`, the one host normalisation). #224 · #227 · #229, 23 Aug 2026, applying G179, G180 and G210. **Resolution is a LOOKUP, never a parse**, and the resolver may not reach a `tenant` row — the parameter object offers none |
| **Whether a PLATFORM principal may do anything at all** | `model/access.ts` **§6a** (`PlatformRole`, `PlatformRoleAssignment`, `PLATFORM_ASSIGNMENT_REACHES`) and then `decide()`'s **fourth arm**. **G289, 19 Sep 2026.** ⚠️ **`decide()` refused every platform principal at step two until this commit**, *before any capability was read* — which is why `docs/contracts/administration.openapi.yaml` carries 59 operations and **not one may name a capability**. 🛑 **ONE EVALUATOR, EXTENDED — a control-plane evaluator beside `decide()` was refused on the confused-deputy argument the function states in its own header.** The arm answers **each of the thirteen resource classes** rather than defaulting. ✅ **TEN OF THIRTEEN ARE `false` AND THREE OPEN, SINCE G601 ON 19 Sep 2026 — READ `model/access.ts` §6b AND `tests/model/platform-only-capabilities.test.ts` SECOND.** ⚠️ **THIS ROW READ *"twelve of thirteen are `false` … the one that opens is `commercial`"* AND IS CORRECTED RATHER THAN DELETED**, because it is the sentence `server/contract/capability.ts`'s administration entry reads its own verdict off. G601 opened `substrate` and `catalogue`, **each argued at its own entry and neither under the other's argument**, on the one word both `model/governance.ts` statements turn on: each refuses a **TENANT** capability, and `PlatformRoleAssignment` is not a tenant instrument. 🛑 **WHAT DID NOT MOVE IS INVARIANT 8: `tenant_data` IS STILL `false`**, with `configuration`, `identity`, `secret`, `endpoint` and `metering` — each a `TenantAccessGrant` path. **`identity` was the closest call and is REFUSED** on G289's second-order argument: *"a principal who may rewrite identity connections may rewrite the axis this very arm dispatches on."* 🛑 **AND THE FIVE NEW VERBS ARE UNHOLDABLE BY ANY TENANT PRINCIPAL BY CONSTRUCTION, WHICH IS THE HALF A READER MUST NOT SKIP:** `Capability` is one closed set, `decide()`'s customer arm tests `role.capabilities.includes()` and asks nothing about class, and `0009` types `role_capability.capability` as bare `text` — so minting alone would have handed a customer administrator a verb over the FLEET. `PLATFORM_ONLY_RESOURCE_CLASSES` plus one branch refusing `capability_is_platform_only` is what closes it, keyed on the CLASS and never on a list of verb names (G577's ruling, one axis over). 🛑 **NOTHING PRODUCES A `PlatformRoleAssignment` — and ⚠️ THE OLD SENTENCE SAID *"no table, no seed"* AND THE TABLE HALF WAS ALREADY FALSE WHEN IT WAS WRITTEN.** `db/migrations/0009_identity_substrate.sql` creates all three tables and `server/data-plane/identity.ts` reads them. **What is still exactly true is NO SEED AND NO WRITER**: nothing has ever written a row, so `platformHeld` is `[]` for every principal the substrate can produce and the ALLOW arm is witnessed against a fixture alone. Derive it: `grep -rn 'platform_role' server/dev/` → nothing. `tests/model/platform-arm.test.ts` witnesses the ALLOW arm and the differential |
| **How a tenant gets BOUND to a session, and the one write invariant 1 had no gate on** | `model/access.ts` **§7a** (`selectTenantForSession`, `TENANT_SELECTION_REFUSALS`) **and** `db/migrations/0005_session_and_membership.sql` — **read BOTH or you have read half the control.** G160 (S-2) and G199 (S-21), applied 19 Sep 2026; #157: *"either alone is a defeat."* **It is a CHECK, never a CHOOSER** — the tenant arrives from the HOST under G179 and this answers yes or no about that one. ✅ **THE STAFF ARM IS BUILT — S-21, 19 Sep 2026, G199 and G292** — `model/access.ts` §7a's second arm and `db/migrations/0008_staff_grant_selection.sql`, landed together because *"either alone is a defeat."* A grant is LIVE iff **unrevoked, unexpired, AND within `MAX_GRANT_HOURS` for its purpose** (G292's three terms; the ceiling is a property of the PREDICATE, so a grant cannot be issued *or extended* past it), and the grant's classes are tested against **all three** of `PERMITTED_RESOURCES`, `CONTRACT_ONLY_RESOURCES` and `NON_DELEGABLE_RESOURCES` through `authorisationPermits()` — ONE helper, ONE call site, G167's content surviving its own reversal. ⚠️ **THIS ROW READ *"The staff arm is NOT built and invariant 8's permitted path is structurally unreachable until it is"* AND IT IS CORRECTED RATHER THAN DELETED**, because it is the sentence G199 required every document to carry and the one a reader would have quoted onward. 🛑 **WHAT IS STILL EXACTLY TRUE, AND IT IS NARROWER THAN WHAT WAS: nothing on the SERVED path supplies a grant and nothing MINTS one.** `server/data-plane/context.ts` passes no `staffGrant` (that is a `server/` edit the slice was fenced out of) and 0008 grants the app role `SELECT` only — so an FDE over HTTP is still refused, and the arm is reachable with its term having no producer. That is G289's `platformHeld` shape, twice in one day. The scoped helper is `db/selection-scope.ts`, the THIRD, and it exists because a measured fact left no alternative: PostgreSQL applies RLS to `tenant.membership` inside the restrictive policy's own subquery — and to `tenant.tenant_access_grant` inside the staff disjunct, which is the same second narrowing for free |
| **WHERE A SUBJECT COMES FROM, and the four arms that were unenforced** | `db/migrations/0009_identity_substrate.sql` first — it argues every policy — then `server/data-plane/identity.ts`, then `server/data-plane/session.ts`'s header. **G299, 19 Sep 2026: the identity substrate is built as TABLES first and Cognito second**, because *"the gate starts saying yes to a seeded subject before any identity provider exists."* 🛑 **THE SLICE IS A DELETION AS MUCH AS AN ADDITION**: the reader's `WHERE revoked_at IS NULL AND expires_at > now()` is GONE, and liveness is `resolveSubject()`'s, by name and in a fixed order. ⚠️ **`orgClass` is the term most easily faked and it has exactly one source** — `orgFor(connection.owner)`, never a membership and never the route — and a connection whose owner columns disagree is REFUSED, never defaulted. 🛑 **NOTHING WRITES ANY OF THESE TABLES:** `SELECT` only to the app role, and the seed is reached by a dynamic import that runs only when `RECONCILE_LOCAL_TEST_AUTH` is exactly `1`. Witnessed in `tests/db/identity-substrate.test.ts` (the preserved RED, the RLS negative control, and each refusal BY NAME) and `tests/http/identity-substrate-served.test.ts` (the ALLOW differential, over a socket, against the PRODUCTION authoriser) |
| **WHETHER A PARTNER MAY READ A CUSTOMER TENANT AT ALL — INVARIANT 2's ONE CROSS-TENANT PATH** | `db/migrations/0039_partner_access_grant.sql` first — it argues both conjuncts — then `server/data-plane/identity.ts` **§6a**, then `decide()`'s partner arm in `model/access.ts`. **G576, 19 Sep 2026: `partnerGrant` was the LAST term of `PrincipalContext` with no producer**, and `server/data-plane/authorise.ts` had carried it as a `⛔` since G299. 🛑 **READ THE CONJUNCTION BEFORE THE TABLE.** Invariant 2 is *"`partner_admin(P)` may read tenant `T` **iff `T.partnerId = P`**, and only within a live `PartnerAccessGrant`"* — and **the first half had no enforcement of any kind anywhere**: `tenant.tenant` carried nothing about who sold it. A grant table alone would have been half an invariant under the whole one's name. The join is a composite **FOREIGN KEY**, so a grant into a tenant the partner did not sell is UNREPRESENTABLE rather than refused, and it binds the migrator too. 🛑 **THE READER'S `WHERE` IS EMPTY, AND EACH PREDICATE SOMEBODY WOULD ADD DELETES A REFUSAL**: `partner_id = $1` deletes `partner_grant_other_partner`, `revoked_at IS NULL` deletes `partner_grant_revoked`, `expires_at > now()` deletes `partner_grant_expired`. ⚠️ **`PARTNER_CAPABILITY_MASK` IS STILL THE CEILING AND NOTHING HERE WIDENS IT** — a partner under the STRONGEST scope, holding `admit_source` in their own role, is refused, because *"the residue is source material at LINE grain"* (G173). The class ceiling is now a CONTROL rather than a paragraph: `tests/model/partner-mask-classes.test.ts` (**G577**) derives it from `CAPABILITY_RESOURCE_CLASS`, so no capability of class `metering` (invariant 5) or of a `NON_DELEGABLE_RESOURCES` class (invariant 8) can be admitted to a scope by anybody clearing a `TS1360`. 🛑 **NOTHING MINTS A GRANT and NO PARTNER-PORTAL OPERATION IS MOUNTED** — **G578** measures why, and the finding is that `partner_grant_absent` was never that tier's blocker |
| **WHAT A BROKER HANDLE IS, and why it is a PAIR** | `db/migrations/0011_federated_connection.sql` first — it argues the whole shape — then `model/domain.ts`'s `BrokeredConnection` and `PROTOCOL_IS_BROKERED`, then `federationFrom()` in `server/data-plane/identity.ts`. **G304/G305/G306, 19 Sep 2026, applying G302 — DERIVED rulings, not the owner's, and they say so.** This closes the blocker `docs/build/deploy-handoff.md` §5a named: *"`tenant.identity_connection` has no column that can hold a Cognito provider name."* 🛑 **THE HANDLE IS `(broker_issuer, broker_ref)` AND THE SECOND COLUMN IS THE RULING.** A Cognito provider name is unique **within one pool**; staging and production are separate accounts, G297 made the region a label, and G276's BYOA puts the pool in the customer's account — so a bare name is a key that can collide across pools, and a collided handle resolves to the wrong `owner` and thence the wrong `orgClass`. **That is G289's five deleted controls reached without anybody writing a default.** One partial unique index refuses it. 🛑 **THE PAIRING IS A REFUSAL, BOTH DIRECTIONS:** present **exactly when** `PROTOCOL_IS_BROKERED[protocol]`, else `broker_unresolvable` — a brokered door with no handle is one no token can name. ⚠️ **FEDERATION IS NEVER A SOURCE OF `orgClass`** — a partner and a customer can share a broker; `tests/db/identity-substrate.test.ts` §6b asserts exactly that. 🛑 **WHAT IS NOT BUILT AND IS NOT OWED BY THIS SLICE:** no `completeFederatedSignIn`, no JWKS, no token verification, and **no resolver from a handle to a connection** — at sign-in there is no session, so `app.session_ref` is unset and `identity_connection_rls` denies under G100; the lookup arrives with the policy it needs. The tenant callback URL is still an **open owner ruling** (§5a item 4) |
| **WHETHER A TOKEN IS OURS — AND WHY A VERIFIER IS NOT A SIGN-IN** | `server/data-plane/token-verify.ts` — read its §0 before anything else, because it is three REFUSALS — then `tests/http/token-verify.test.ts`, which mounts every attack the header claims to defeat. **G976–G978, 20 Sep 2026, W1-E — DERIVED rulings, not the owner's, and they say so.** 🛑 **THE ALGORITHM IS OURS AND NEVER THE TOKEN'S.** `header.alg` is COMPARED against `REQUIRED_ALGORITHM` and is never dispatched on, so `alg: none` — with an empty signature AND with a junk one, both witnessed — and an **HS256 token keyed with the broker's own PUBLISHED RSA public key** all leave through `token_algorithm_not_allowed` **before a key is selected and before a byte is verified**. §4b mints that forgery for real, and §4c is the anti-vacuity guard that proves the HMAC was correct, so the suite cannot record defeating an attack it never mounted. ⚠️ **AND THE SAME ATTACK ARRIVES FROM THE KEY SIDE**: only `kty`, `n` and `e` cross into `createPublicKey()`, and `kty` must be `RSA` — an `oct` entry under the right `kid` would otherwise be imported as a SECRET. 🛑 **THE ORDER IS THE OTHER HALF**: nothing read from an unverified token is a fact except `alg`, `kid` and the two covered segments, so the payload is not PARSED until the signature holds — §8 and §8a are the same unreadable payload signed and unsigned, because a verifier that parsed first would diagnose a FORGERY on its claims and tell an attacker which field to fix. 🛑 **THE JWKS IS AN ARGUMENT AND THERE IS NO `fetch(` — G977**, which keeps `tests/http/console-roster-unreachable.test.ts` §1c green; where the key document comes from is the NEXT slice and an owner's decision, and **no dependency is taken** (`node:crypto` alone, pinned by §11a). ⚠️ **FIFTEEN REFUSAL ARMS CARRYING THE `kind` AND NOTHING ELSE**, because every value one could name is a bare `string` out of a token we refused to believe; `AssertNoTextDeep` makes that a `TS2344` rather than a habit and §10 witnesses the proof BITING. **§12 is a census: a sixteenth arm with no test is a red gate.** 🛑 **WHAT IT DOES NOT DO — G978, and read this before reading "verifier" as "sign-in": `tenant."user"` has NO EXTERNAL-SUBJECT COLUMN (G306's refusal, UNBLOCKED by this file and still unwritten), `tenant.session.user_id` is `NOT NULL` with no writer on any request path, and `MintedSession` carries no handle, so even a complete mint would not sign a browser in — D6 is owed.** ⚠️ **AND THE DERIVATION SIX DOCUMENTS USED FOR THIS IS RETIRED**: `grep -rn 'jwtVerify\|createRemoteJWKSet' server/` returned THREE lines before the verifier existed and all three were PROSE quoting the command. Use `grep -rln '^export function verifyIdentityToken' server/`. ⚠️ **AND THE `^` IS NEW — G2171, 28 Sep 2026. THE UNANCHORED FORM THIS LINE CARRIED WAS G978'S OWN CURE INHERITING THE DISEASE**: it answers TWO lines in `server/`, the second being `token-verify.ts`'s own paragraph, and `-l` hid that only because the quotation and the declaration sit in the SAME FILE. **Witnessed: with the declaration deleted from a scratch copy, the unanchored form still answered `server/data-plane/token-verify.ts`, exit 0 — *exactly one* for a tree with NO VERIFIER.** That is G978's own sentence about the command it retired, arriving at its replacement. |
| **The stack and where it runs** | `docs/tech-stack.md` — **THE AUTHORITY** for language, runtime, framework, database, compute, region, CI/CD, IaC, tagging, observability and hardening, added 18 Sep 2026. G252–G263: **ARM64 everywhere · ECS on Fargate · Aurora Serverless v2 · S3 + CloudFront · `us-west-2` · CodePipeline + CodeBuild on ARM · CDK in `infra/`**. 🛑 **Its §7–§13 is DECIDED AND MOSTLY NOT BUILT.** ⚠️ **This read *"DECIDED AND NOT BUILT"* until 18 Sep 2026 and the unqualified form is now false: §9–§11's CI/CD slice IS written** — `infra/` holds the `CiImage` and `Pipeline` stacks, G260's tagging Aspect, and `typecheck:infra` + `synth:infra` in the gate. §7, §8, §12 and §13 are untouched. **`no AWS resource has been created` is STILL exactly true** — nothing has been deployed, and a synthesised template is not a resource |
| **The two serving planes** | `server/http/app.ts` first — it states the **four** things it decides (⚠️ **three until 19 Sep 2026**; the fourth is G200's request-time gate) — then `server/contract/document.ts`. G191 |
| **WHY THERE IS NO STAFF CONSOLE AND NO PARTNER PORTAL — AND WHY REGISTERING THE TIER DID NOT CHANGE THAT** | `tests/http/administration-tier-unmounted.test.ts` first — it MEASURES all three blockers and needs no database — then `server/contract/capability.ts`'s **`administration`** entry, then `docs/contracts/administration.openapi.yaml` §1 and §2. **G533 and G534, 19 Sep 2026.** ✅ **THE TIER IS REGISTERED IN `TIERS`**, which closes the hole G288 named in its own voice — 59 operations, a third of the declared surface, were invisible to `check:annotations`, whose denominator went **77 → 136** with no edit to the checker. 🛑 **AND NOTHING IS MOUNTED, FOR A REASON THAT IS NOT EFFORT AND NOT ONLY G318's SEQUENCING.** Every one of the 59 carries `x-capability: 'exempt: …'`, and on THIS tier — unlike the four others whose verdict is `false` — the caller is a PERSON. The `preValidation` gate returns at its FIRST LINE when a route names no capability, and `mountTier()`'s sixth fence keys on one. **Measured, not argued:** §3b mounts `listTenants` on a plane whose authoriser REFUSES EVERY CAPABILITY and gets **200**; §3c is the differential — the same authoriser against a gated operation is **403**; and `tests/e2e/browser-login.test.ts` §20 catches the same thing in a real browser, where mounting one turns `ten_acme`'s CUSTOMER operator into a reader of the staff tenancy roster. ⚠️ **THE OTHER TWO BLOCKERS: NO TABLE AND NO HOST.** A tenancy roster cannot live in the data plane — RLS there is one tenant per transaction under G100 — and the control database holds **one** table. And the document's two hosts (`console.` / `partners.reconcileai.app`) resolve to nothing: the only host resolution in `server/` is host→TENANT (G179), and G180 revokes on a mismatch every request. 🛑 **WHAT THE OWNER OWES: an authorisation mechanism for a platform principal with NO tenant.** ✅ **THE OWNER RULED ON 19 Sep 2026 AND G601 BUILT THE FIRST THIRD OF IT. ⚠️ THIS SENTENCE READ *"26 of the 59 point at `platform-role` and 9 at `partner-portal-role`, and neither evaluator exists in `model/`. G289's fourth arm opens one resource class of thirteen (`commercial`), and H1/H2 act on `substrate` and `catalogue`, which have no capability BY STATEMENT"* AND EVERY CLAUSE OF IT BUT ONE IS NOW FALSE — it is corrected rather than deleted, because it is the sentence this slice was commissioned against.** `platform-role` EXISTS and always did after G289; its three tables are `0009`'s and its reader is `server/data-plane/identity.ts`. `substrate` and `catalogue` now carry five capabilities and the arm reaches both. **The clause that survives is `partner-portal-role`: nine operations, and nothing in `model/` declares the principal.** 🛑 **AND NOTHING IS MOUNTED AND NOTHING IS ANNOTATED, FOR A REASON THAT IS STRUCTURAL — G602.** `TIER_REQUIRES_CAPABILITY` is per TIER and a tier is a FILE, and `check:annotations` refuses an exemption on a `true` tier (check D) and a capability on a `false` one (check E). **So the 59 are ALL-OR-NOTHING**: annotating the 26 that now have a verb is a red gate, not a partial delivery. Measured — flipping the verdict makes the checker say *"59 operation(s) … carry a stated EXEMPTION"*, fifty-nine and not thirty-three. `tests/contracts/administration-evaluators.test.mjs` is the measurement and §4 is a tripwire on the portal principal. **THE NO-TABLE AND NO-HOST BLOCKERS ABOVE ARE UNTOUCHED BY ALL OF IT** |
| **WHY THE STAFF CONSOLE IS NOW TWO DOCUMENTS, AND WHY THE SPLIT IS 14 AND NOT 26** | `docs/contracts/platform-console.openapi.yaml` §1 first — it enumerates the twelve that could not move, each with the reason — then `tests/contracts/platform-console-reachability.test.mjs`, then `server/contract/capability.ts`'s **`platformConsole`** entry. **G781–G783, 19 Sep 2026, applying the OWNER'S split ruling:** *"`platform-console.openapi.yaml` takes the 26, becomes annotatable and mountable now, and joins `TIERS`."* 🛑 **CARRY THE OWNER'S OWN SURVIVING OBJECTION, WHICH IS ON THE DOCUMENT'S FACE AND IS NOT DISCHARGED: *"it is still contract surgery and still a ruling."*** `TIER_REQUIRES_CAPABILITY` is per TIER and a tier is a FILE, so gating SOME of `administration.openapi.yaml` required making those operations a different file — **the file boundary now carries an authorisation decision**, which is §5.1's shape. The repair is a per-OPERATION verdict; it is named in §7 and NOT TAKEN. 🛑 **THE RULING SAID 26 AND THE MEASUREMENT SAYS 14, WHICH IS THE ONE PLACE THIS SLICE DEPARTS FROM ITS INSTRUCTION.** G602's own table records `platform-role` (26) as ✅ annotatable since G601 and is wrong about twelve — it keys on `x-admin-authority` (the landmark) rather than on *"is there a verb, in a class `PLATFORM_ASSIGNMENT_REACHES` opens, whose MODE fits this act"* (the property). **G601 opened three classes of thirteen and minted six verbs in total**; the twelve that stayed act on `identity` (REFUSED deliberately, G289's second-order argument), on the partner registry and the notification tray (no resource class at all), on invariant 8's grant path (`authorisationPermits()`, which `decide()` never consults) — or, in `raiseAdjustment`'s case, on `commercial`, which IS open and has **no write verb**. ⚠️ **`raiseAdjustment` IS THE ONE TO READ**: it looks annotatable, a class-derived rule would admit it, and nothing in `model/` records a capability's MODE — so it is held out by a named TRIPWIRE rather than by a rule, and minting `write_commercial` is an owner's ruling. 🛑 **A NAME IS NOT A GATE AND THE GATE STAGE CANNOT SEE THE DIFFERENCE — MEASURED:** an operation here annotated `view_audit` leaves `node tools/check-capability-annotations.mjs` at **EXIT 0** while being unreachable rather than gated, because the platform arm refuses `tenant_data`. The join `x-capability` → `CAPABILITY_RESOURCE_CLASS` → `PLATFORM_ASSIGNMENT_REACHES` is the only thing that closes it. ⚠️ **NOTHING IS MOUNTED**, and the blocker is `mountTier()`'s SIXTH FENCE rather than effort — `AuthorizationGrant extends TenantScoped` and a platform principal has no tenant for invariant 10's record (G728, from the console-session side). `tests/http/administration-tier-unmounted.test.ts` §3e witnesses that fence refusing a bare handler on the NEW tier, which is the same act that boots on the old one |
| **WHAT THE PLATFORM MAY DO AT ALL, AND THE FENCE THAT KEEPS ITS FIVE VERBS OUT OF EVERY TENANT** | `model/access.ts` **§6b** — `PLATFORM_ONLY_RESOURCE_CLASSES` and `capabilityIsPlatformOnly()` — then the five members at the foot of `CAPABILITIES`, then `PLATFORM_ASSIGNMENT_REACHES`'s `substrate` and `catalogue` entries, then `tests/model/platform-only-capabilities.test.ts`. **G601, 19 Sep 2026, the owner's.** 🛑 **READ THE FENCE BEFORE THE VERBS, BECAUSE THE VERBS ARE ONLY SAFE BECAUSE OF IT.** `Capability` is ONE closed set; `decide()`'s customer arm tests `role.capabilities.includes(capability)` and asks nothing about class; `CAPABILITY_STAKEHOLDER_CLASSES` says in its own declaration that *"a tenant-authored `Role` is checked by NONE of this"*; and `db/migrations/0009` types `tenant.role_capability.capability` as bare `text`. **Minting alone would have let a customer administrator publish a pack to the FLEET.** 🟢 **THE ARGUMENT FOR MINTING AT ALL TURNS ON ONE WORD IN EACH STATEMENT.** `model/governance.ts` refuses a **TENANT** capability on `substrate` (*"a capability is the currency of GRANTS"*) and on `catalogue` (*"it has no verb BECAUSE IT IS NOT A TENANT CAPABILITY"*); both were written 7 Aug 2026 and **G289 built a second instrument that spends capabilities and is not a grant**. Both statements are kept, quoted, and amended in place at their own entries. 🛑 **TWO COSTS, NAMED: `substrate`'s BYOA clause is untouched by any of this** — *"under BYOA the customer holds root … a grant here is a request rather than a control"* — and lands entirely on `provision_substrate`; **and the `catalogue` risk is INVARIANT 6's, not invariant 8's**, because G110's publication seam does not exist and `publish_catalogue` is the verb it would sit behind. ⚠️ **NOTHING IS MOUNTED, NOTHING IS ANNOTATED AND NOBODY HOLDS ANY OF THE FIVE** — no seed has ever written a `platform_role_assignment` row. G602 measures why the contract cannot be annotated in parts |
| **WHAT A PARTNER FIRM'S OWN STAFF MAY DO — THE FIFTH ARM, AND WHY IT IS NOT A SECOND CROSS-TENANT PATH** | `model/access.ts` **§6c** (`PartnerRole`, `PartnerRoleAssignment`, `PARTNER_ONLY_RESOURCE_CLASSES`) and `decide()`'s step **2g**, then `db/migrations/0250_partner_role.sql`, then `tests/model/partner-staff-arm.test.ts` §3, then `docs/build/completion-plan.md` **W5 · partner portal**. **R10, 1 Oct 2026, THE OWNER'S:** *"Partner role tables + a fifth arm: new partner_role / partner_role_assignment tables keyed on partnerId, decide() gains a fifth arm, and new resource classes for deals / sandbox / partner staff."* 🛑 **READ §3 OF THE TEST FIRST, BECAUSE IT IS INVARIANT 2**: the arm is entered ONLY for a verb classed `deal`, `sandbox` or `partner_staff`, reads `partnerHeld` alone, names no tenant and returns `DENY_ALL` — so a portal role NAMING `view_exception` confers nothing and the tenant partner arm still answers `partner_grant_absent`. **`ORG_CLASSES` IS STILL THREE**: the fifth arm dispatches on the capability's CLASS. ⚠️ **G601's FENCE IS MIRRORED**: a customer or platform role carrying a portal verb is refused at `capability_is_partner_only`. ⚠️ **RLS IS SESSION-KEYED** (G2325) and the partner-keyed shape is refused on `0250`'s face. 🛑 **NOTHING IS MOUNTED AND NOTHING IS ANNOTATED** — every operation the six verbs fit is table-blocked (G2326), nothing writes a portal-role row, and the fifth arm has no invariant 10 home (G2327) |
| **H2's ONBOARDING SEQUENCE, AND THE THREE THINGS IT IS NOT** | `model/onboarding.ts` — **G535, 19 Sep 2026**, the twenty-sixth module and the pack's own *"Onboarding state in the model: NOT BUILT"* row, closed in the MODEL sense and in no other. Six ordered steps transcribed from `S1 Staff.dc.html`'s `STEPS` array, `whoseHands` total over them, **exactly one step `next`**, and forcing marks *"that step and everything above it"*. 🛑 **THE STATE IS A PREFIX LENGTH, NOT A SET** — §5.5, because a `Record<StepKey, boolean>` admits *"step four done, step two not"*, which neither transition can produce and every reader would have to defend against. 🛑 **ONE DELIBERATE DIVERGENCE FROM THE PROTOTYPE: `forced` IS APPEND-ONLY.** `S1` keeps one slot and a second force overwrites it; the contract calls the reason *"PERMANENT, AND THE ONLY RECORD OF WHY THE SEQUENCE WAS BROKEN"*, and a record a second write can overwrite is not one. ✅ **IT HAS A TABLE AND A HANDLER SINCE 20 Sep 2026 — G1241, THE OWNER'S RULING — AND THE SENTENCE BELOW IS CORRECTED RATHER THAN DELETED, because it is the one four files carried and the one that told a reader H2's state lived nowhere.** THE ORIGINAL: *"⚠️ NO TABLE, NO HANDLER, NO CLOCK — and the third is the one to read."* **THE TABLE IS `db/migrations-control/0030_onboarding_record.sql`, IN THE CONTROL DATABASE** — *"Onboarding state lives in a table in the CONTROL database, one row per tenant, beside the roster"* — and the handler is `listTenants`, which reads it to DERIVE `TenantSummary.stage` and publishes nothing else from it. 🛑 **BOTH MODEL PROPERTIES ARE HELD AGAIN IN SQL AND NEITHER IS RESTATED: the prefix length by there being ONE INTEGER COLUMN (G1242), so a non-prefix state has nowhere to be written down; the append-only mark by a TRIGGER as well as a withheld grant (G1243), because the grant is vacuous against the only writer the table has — the admin.** ⚠️ **AND THE CLOCK IS STILL ABSENT, WHICH IS THE CLAUSE THAT SURVIVES WHOLE.** There is no `stalled` stage though `S1` draws one: it needs a per-transition timestamp with no producer and a threshold nobody has ruled on, and an arm nothing ever reaches reads as implemented. `0030` writes NO `started_at`, `completed_at` or `updated_at` for exactly that reason — a timestamp would give the first a producer and leave the second an invention, and the column would then be read by nothing (`0004`'s refusal). `tests/model/onboarding.test.ts` §6b still asserts the absence, and `tests/http/console-roster-served.test.ts` §2a is its served half: the wire carries exactly two stages. ✅ **AND BOTH WRITES ARE MOUNTED SINCE 21 Sep 2026 — R8 AND R9, THE OWNER'S — SO THE SENTENCE BELOW IS CORRECTED RATHER THAN DELETED, because it is the one four files carried and the one that told a reader H2's state could be read and never changed.** IT READ: *"⚠️ AND NOTHING WRITES EITHER TABLE ON A REQUEST PATH: `completeOnboardingStep` and `forceOnboardingStep` are declared, unmounted, and hold no privilege — a path that could write here could mark a tenant's onboarding COMPLETE, or forge the permanent record of why a step was forced."* **Its last clause is exactly why the privilege is narrow rather than why there is none**: `db/migrations-control/0040_onboarding_writer.sql` grants `UPDATE` on ONE COLUMN and `INSERT` on one table, to a role that holds no `INSERT` on `onboarding_record` at all — **so the serving path may ADVANCE a delivery record and may not CREATE one**, and the forged mark is refused by `0030`'s append-only trigger against every role in the cluster. 🛑 **AND A THIRD THING NOW GUARDS IT THAT DID NOT EXIST: A GATE.** All three operations carried `x-capability: 'exempt: …'`, so a mount before R8 would have served them to any authenticated person with `decide()` never asked — measured at `tests/http/administration-tier-unmounted.test.ts` §3b. See **WHO MAY ADVANCE A TENANT'S ONBOARDING** below |
| **Whether a caller may perform an operation** | `server/contract/capability.ts` for the grammar — ⛔ **AND THERE IS NO TIER TABLE ANY MORE. G911, 20 Sep 2026, THE OWNER'S: *"the file boundary should not carry an authorisation decision."* `TIER_REQUIRES_CAPABILITY` IS RETIRED.** ⚠️ **THIS ROW READ *"SEVEN tiers and TWO of them `true` since the split of 19 Sep 2026; this said SIX-and-one since G533 and FIVE before that. The second `true` is `platformConsole`, and the `administration` `false` beside it is STILL not the same shape as the other four"* — and it is corrected rather than deleted, because every clause of it was TRUE and the last one is the reason the table went.** There are still seven tiers; a tier no longer carries a verdict. An operation's verdict is `gateVerdictOf(x-capability)`, three-valued — `gated` · `exempt` · `ungoverned`, and the third is the fail-open the third fence refuses. **What the tier table is REPLACED by is two things and neither decides anything: `SECURITY_SCHEME_CALLER` + `callerOf()` (G912), which is the CALLER the retired entries all argued about and never keyed on — §5.1, in the table that gated the router — and `EXEMPT_WITH_A_PERSON_TO_ASK` (G913), a per-tier CENSUS the gate recomputes.** ⚠️ **THE OLD TABLE WAS POINTED AT THE WRONG TIERS AND THE MEASUREMENT IS THE ARGUMENT: its two `true`s held 0 exemptions between them, so check D and the fourth fence refused nothing that exists; the five `false`s hold 83, of which 64 face a PERSON, and both controls were silent on every one.** ✅ **AND THE FOURTH FENCE NOW COVERS ALL SEVEN: a MOUNTED exemption facing a person does not boot unless the mount says `servedWithoutAGate()` (G914)** — so `tests/http/administration-tier-unmounted.test.ts` §3b's ungated 200 is a BOOT FAILURE with a bare handler (§3b-i) and still a 200 with the mark, which is the honest shape: **the hole is not closed, it is made explicit, greppable and counted — one call site in `server/`.** — then `server/http/app.ts`'s `preValidation` hook and `mountTier()`'s **six** boot fences (⚠️ **this said five until 19 Sep 2026**; the sixth is G301's, and it refuses to boot a gated operation whose handler mints no authorisation record. ⚠️ **STILL SIX AFTER G911 THOUGH THERE ARE SEVEN `throw`s: the FOURTH IS IN TWO HALVES since 20 Sep 2026** — an unacknowledged person-facing exemption, and an acknowledgement that CONTRADICTS the document — because they are one question asked from both sides, and renumbering would make the sixth fence the seventh in five files that cite it by number), then `server/data-plane/authorise.ts`. G200, 19 Sep 2026. ✅ **AND IT ALLOWS SOMEBODY SINCE G299 THE SAME DAY** — ⚠️ **this row read *"MECHANISM ONLY, AND IT STILL ALLOWS NOTHING"* and *"THE GAP IS THREE TERMS"*, and both are corrected rather than deleted: `db/migrations/0009_identity_substrate.sql` gives all three a producer and `server/data-plane/identity.ts` reads them.** The gap that SURVIVES is one term, `partnerGrant`, and a partner is refused on the PARTNER arm by name rather than routed down the customer one. The original text follows and its argument is unchanged. — **MECHANISM ONLY, AND IT STILL ALLOWS NOTHING.** ⚠️ **This row said *"the data plane's authoriser is a denyAll and that is the honest answer"* and it is corrected rather than deleted: the authoriser resolves a `PrincipalContext` and calls `decide()` — the single evaluator — and refuses because the context cannot be assembled.** 🛑 **THE GAP IS THREE TERMS, NOT ONE, AND EVERY DOCUMENT HERE UNDERSTATED IT.** `grep -h 'CREATE TABLE' db/migrations/*.sql db/migrations-control/*.sql` returns no `user`, no `identity_connection`, no `role` and no `role_assignment` — so `subject.status`, `orgClass` and `held` have no producer. **`orgClass` is the one to read:** a membership proves nothing about organisation (*"Partner-scoped memberships must expire"*), so defaulting it to `customer` would route a partner down the customer arm past the live-grant check, the `partnerId` agreement check, revocation, expiry and `PARTNER_CAPABILITY_MASK` — five controls deleted by one default. `tests/http/capability-decide.test.ts` witnesses the ALLOW arm against a fixture substrate, because a control whose only observable behaviour is refusal is §5.6. ✅ **AND THE GATE STILL RECORDS NOTHING — BUT THE HANDLER DOES, SINCE G301 THE SAME DAY.** ⚠️ **This read *"AND THE GATE RECORDS NOTHING — invariant 10 is deferred by ruling, because the record is minted against a `ResourceRef` a `preValidation` hook does not have"* and it is corrected rather than deleted, because the reasoning in it is G301's own premise and is unchanged.** The HOOK still records nothing and still must not; what ended is the DEFERRAL. `server/data-plane/authorisation-record.ts` mints through `authorize()` — the only thing that mints — and writes the row inside the SAME `withTenantScope()` transaction as the read, so a rolled-back act takes its record with it and a refused caller opens no transaction at all. 🛑 **BE PRECISE ABOUT WHAT THAT BUYS: invariant 10 does NOT make an unauthorised act impossible — *"nothing can, against root"* — it makes one visible or detectable.** ✅ **AND HALF OF THAT HALF IS NOW BUILT — G317, 19 Sep 2026.** ⚠️ **THIS READ *“AND HALF OF IT IS STILL UNBUILT: `AuditEvent`, `DataAccessEvent` and `UsageRecord` all carry the id and NONE OF THE THREE HAS A TABLE — G301 reserves which path writes which stream”*, AND THE TABLE HALF IS NOW FALSE. It is corrected rather than deleted because it is the sentence §8's tripwire was armed on.** All three have a table — `db/migrations/0014_invariant_10_event_streams.sql` — each carrying `authorization_id`, and `AUTHORIZATION_MAY_BE_ABSENT` is a `CHECK` on **all three** — ⚠️ **this read *"on the two that carry an actor"* until G387 later the same day, and is corrected rather than deleted; `db/migrations/0017_usage_record_actor.sql` gives `usage_record` the actor KIND (never an ID) and `audit_event`'s constraint verbatim.** 🛑 **WHAT IS STILL EXACTLY TRUE, AND IT IS THE HALF THAT MATTERS: a served read records THE AUTHORISATION IT RAN UNDER and not THE ACCESS. Nobody should read an access log off `tenant.authorization_grant` — and nobody should read one off `tenant.data_access_event` either, because it is EMPTY.** Nothing on a request path writes any of the three; `DataAccessEvent.maxDataClass` has no producer and invariant 4 forbids guessing one. `tests/http/authorisation-record.test.ts` §8a now asserts the id is CARRIED and §8b asserts, over a real served request, that no row is WRITTEN — the tripwire replaced by a positive assertion and a narrower absence, which is what its own text demanded |
| **Whether a caller may perform an operation** | `server/contract/capability.ts` for the grammar and the tier table, then `server/http/app.ts`'s `preValidation` hook and `mountTier()`'s **six** boot fences (⚠️ **this said five until 19 Sep 2026**; the sixth is G301's, and it refuses to boot a gated operation whose handler mints no authorisation record. ⚠️ **STILL SIX AFTER G911 THOUGH THERE ARE SEVEN `throw`s: the FOURTH IS IN TWO HALVES since 20 Sep 2026** — an unacknowledged person-facing exemption, and an acknowledgement that CONTRADICTS the document — because they are one question asked from both sides, and renumbering would make the sixth fence the seventh in five files that cite it by number), then `server/data-plane/authorise.ts`. G200, 19 Sep 2026. ✅ **AND IT ALLOWS SOMEBODY SINCE G299 THE SAME DAY** — ⚠️ **this row read *"MECHANISM ONLY, AND IT STILL ALLOWS NOTHING"* and *"THE GAP IS THREE TERMS"*, and both are corrected rather than deleted: `db/migrations/0009_identity_substrate.sql` gives all three a producer and `server/data-plane/identity.ts` reads them.** ✅ **AND THE LAST TERM GOT A PRODUCER ON 19 Sep 2026 — G576. ⚠️ THIS SENTENCE READ *"The gap that SURVIVES is one term, `partnerGrant`, and a partner is refused on the PARTNER arm by name rather than routed down the customer one"* AND IT IS CORRECTED RATHER THAN DELETED**, because it is the sentence four files carried and the one a reader would have quoted before concluding the partner arm was unreachable. `db/migrations/0039_partner_access_grant.sql` is the table and `server/data-plane/identity.ts` §6a is the reader, so **all EIGHT terms of `PrincipalContext` have a producer** and `tests/http/partner-arm-served.test.ts` is the first 200 the partner arm has ever returned. 🛑 **WHAT IS STILL EXACTLY TRUE AND IS THE HALF THAT MATTERS: a partner whose customer has granted nobody is STILL refused at `partner_grant_absent`, on the PARTNER arm, by name** — and that refusal is now a fact about the customer's decision rather than about our schema, which is a different sentence wearing one reason. **Nothing mints a grant**: `SELECT` only to the app role, exactly as 0008 decided for the staff grant. The original text follows and its argument is unchanged. — **MECHANISM ONLY, AND IT STILL ALLOWS NOTHING.** ⚠️ **This row said *"the data plane's authoriser is a denyAll and that is the honest answer"* and it is corrected rather than deleted: the authoriser resolves a `PrincipalContext` and calls `decide()` — the single evaluator — and refuses because the context cannot be assembled.** 🛑 **THE GAP IS THREE TERMS, NOT ONE, AND EVERY DOCUMENT HERE UNDERSTATED IT.** `grep -h 'CREATE TABLE' db/migrations/*.sql db/migrations-control/*.sql` returns no `user`, no `identity_connection`, no `role` and no `role_assignment` — so `subject.status`, `orgClass` and `held` have no producer. **`orgClass` is the one to read:** a membership proves nothing about organisation (*"Partner-scoped memberships must expire"*), so defaulting it to `customer` would route a partner down the customer arm past the live-grant check, the `partnerId` agreement check, revocation, expiry and `PARTNER_CAPABILITY_MASK` — five controls deleted by one default. `tests/http/capability-decide.test.ts` witnesses the ALLOW arm against a fixture substrate, because a control whose only observable behaviour is refusal is §5.6. ✅ **AND THE GATE STILL RECORDS NOTHING — BUT THE HANDLER DOES, SINCE G301 THE SAME DAY.** ⚠️ **This read *"AND THE GATE RECORDS NOTHING — invariant 10 is deferred by ruling, because the record is minted against a `ResourceRef` a `preValidation` hook does not have"* and it is corrected rather than deleted, because the reasoning in it is G301's own premise and is unchanged.** The HOOK still records nothing and still must not; what ended is the DEFERRAL. `server/data-plane/authorisation-record.ts` mints through `authorize()` — the only thing that mints — and writes the row inside the SAME `withTenantScope()` transaction as the read, so a rolled-back act takes its record with it and a refused caller opens no transaction at all. 🛑 **BE PRECISE ABOUT WHAT THAT BUYS: invariant 10 does NOT make an unauthorised act impossible — *"nothing can, against root"* — it makes one visible or detectable.** ✅ **AND HALF OF THAT HALF IS NOW BUILT — G317, 19 Sep 2026.** ⚠️ **THIS READ *“AND HALF OF IT IS STILL UNBUILT: `AuditEvent`, `DataAccessEvent` and `UsageRecord` all carry the id and NONE OF THE THREE HAS A TABLE — G301 reserves which path writes which stream”*, AND THE TABLE HALF IS NOW FALSE. It is corrected rather than deleted because it is the sentence §8's tripwire was armed on.** All three have a table — `db/migrations/0014_invariant_10_event_streams.sql` — each carrying `authorization_id`, and `AUTHORIZATION_MAY_BE_ABSENT` is a `CHECK` on **all three** — ⚠️ **this read *"on the two that carry an actor"* until G387 later the same day, and is corrected rather than deleted; `db/migrations/0017_usage_record_actor.sql` gives `usage_record` the actor KIND (never an ID) and `audit_event`'s constraint verbatim.** 🛑 **WHAT IS STILL EXACTLY TRUE, AND IT IS THE HALF THAT MATTERS: a served read records THE AUTHORISATION IT RAN UNDER and not THE ACCESS. Nobody should read an access log off `tenant.authorization_grant` — and nobody should read one off `tenant.data_access_event` either, because it is EMPTY.** Nothing on a request path writes any of the three; `DataAccessEvent.maxDataClass` has no producer and invariant 4 forbids guessing one. `tests/http/authorisation-record.test.ts` §8a now asserts the id is CARRIED and §8b asserts, over a real served request, that no row is WRITTEN — the tripwire replaced by a positive assertion and a narrower absence, which is what its own text demanded |
| **WHICH TENANTS EXIST — THE ROSTER, AND WHY NO PLANE CAN SERVE IT** | `db/migrations-control/0002_tenancy_roster.sql` first — it argues the placement, the six columns and the sixteen refusals — then `tests/http/console-roster-unreachable.test.ts`, then `server/control-plane/roster-store.ts`. **G831–G835, 20 Sep 2026; G831 is THE OWNER'S:** *"A control-plane roster table. The tenancy roster is a control-owned fact and lives in the control database, which the consoles read. Invariant 3 is satisfied by construction — and a roster of which tenants exist is not tenant data."* 🛑 **THE LINE THE TABLE MUST NOT CROSS IS THE WHOLE RULING: A ROSTER IS WHICH TENANTS EXIST AND WHAT THE PLATFORM SOLD THEM. IT IS NOT WHAT IS IN THEM.** The test a column has to pass is *what would have to READ a tenant's data to populate it* — a column ahead of its reader is `0004`'s refusal and is merely wasteful; a column whose only possible PRODUCER is a read of `tenant.exception`, `public.run` or `tenant."user"` breaks invariant 3 at the moment it is filled, in a database holding no credential that reaches any of them. Sixteen are refused by name on the migration's face. 🛑 **THE TWO REJECTED PLACEMENTS ARE PRESERVED AND ONE IS REFUSED ON AN INVARIANT**: a second policy on `tenant.tenant` admitting a console session is a SECOND cross-tenant read path and **invariant 2 says there is exactly one**; publishing the roster downward duplicates a fact `0001` and `0039` already hold, with nothing to publish it (`grep -rn 'fetch(' server/` → nothing). ⚠️ **`stage` IS REFUSED AS A COLUMN AND THE REFUSAL STANDS — G833 — THOUGH THE SENTENCE THAT MADE IT A BLOCKER IS NOW HALF WRONG AND IS CORRECTED RATHER THAN DELETED.** IT READ: *"⚠️ `stage` IS REFUSED AND THAT ONE REFUSAL IS A BLOCKER RATHER THAN A GAP (G833) — it is `required` on `TenantSummary`, nothing persists an `OnboardingRecord`, and `fast-json-stringify` serialises without validating, so a mount would ship a 200 missing its own required field silently."* **The middle clause closed on 20 Sep 2026 (G1241 gives `OnboardingRecord` a table in the CONTROL database) and the last is MEASURABLY FALSE at the pinned serialiser (G1244): a missing `required` property THROWS, so the failure mode was a 500 on every request.** What survives is the first clause and it is the load-bearing one: **there is still no `stage` column, and there must not be one** — the value is DERIVED by `model/onboarding.ts#onboardingStage()`, which is what the refusal made necessary. ✅ **THE OWNER TOOK SHAPE (1) ON 20 Sep 2026 — G1161 — AND THE SENTENCE BELOW IS CORRECTED RATHER THAN DELETED, because it is the sentence `tests/http/console-roster-unreachable.test.ts` was written around and the one a reader would have quoted onward. THE TOPOLOGY BLOCKER IS CLOSED AND `listTenants` IS STILL UNMOUNTED, ON G833:** `stage` is `required`, nothing persists an `OnboardingRecord`, and a mount would ship a 200 missing its own required field silently. **What changed is which blocker is in the way, and G1168 records that the schema one is NOT applied.** The reach is `db/control-read-scope.ts` + `db/migrations-control/0020_console_read_role.sql` + `console-read-net`: one network with two members, one role, one table, `SELECT`, `BEGIN READ ONLY`. **And it spends G193's *by construction*, which the ruling says in its own words rather than leaving to be found** — *"By construction becomes by census, and that is a real loss, not a wash."* THE ORIGINAL FOLLOWS. — 🛑 **AND NOTHING IS MOUNTED, FOR A REASON THAT IS TOPOLOGY AND IS AN OWNER'S RULING (G835): G726 put the console SESSION on the DATA plane and this ruling puts the ROSTER in the CONTROL database.** Three shapes could join them and all three are measured rather than argued — a read-only control pool in the data plane (needs a compose and an `infra/` edge that do not exist, and spends the property `server/data-plane/config.ts` states about itself); the control plane mounting the tier (**refused outright** — `refuseGatedOperations()` throws at boot, and resolving a console principal there means reading the data database); publishing downward (G831's own refusal). ⚠️ **`tests/db/control-plane-census.test.ts` (G832) IS WHAT KEEPS THE NEXT TABLE IN THAT DATABASE HONEST** — `tests/db/rls-census.test.ts` enumerates schema `tenant` in the OTHER database and structurally cannot see this one |
| **HOW THE CONSOLES REACH THE ROSTER — THE ONE CREDENTIAL ONE PLANE HOLDS FOR THE OTHER'S DATABASE** | `db/control-read-scope.ts` first — it argues the fifth scope helper against `session-scope.ts`'s bar with two measurements — then `db/migrations-control/0020_console_read_role.sql`, then `tests/db/control-read-pool.test.ts` for the negative controls, then `compose.yaml`'s `console-read-net`. **G1161–G1168, 20 Sep 2026; G1161 is THE OWNER'S:** *"The data plane gains a READ-ONLY control-database pool. A second connection, `SELECT` only, on its own credential."* 🛑 **READ WHAT IT SPENDS BEFORE READING WHAT IT BUILDS, IN THE RULING'S OWN WORDS: *"What replaces it is a CENSUS … By construction becomes by census, and that is a real loss, not a wash."*** G193 held invariant 3 by TOPOLOGY — `server/data-plane/config.ts` read no `RECONCILE_CONTROL_*` and said so on its own face, and that header is CORRECTED IN PLACE with the original quoted. **A construction cannot be undone by a commit that forgets; a census can be undone by a commit that adds a table, a grant and an exemption together**, and what `tests/db/control-plane-census.test.ts` buys back is that the undoing is a RED GATE rather than silence. ⚠️ **THE DIRECTION IS WHY INVARIANT 3 SURVIVES.** Copy it, never paraphrase it: *"The control plane publishes downward and never reads tenant data."* The edge is the DATA plane reading the CONTROL database — downward, into a process that publishes nothing back — and the forbidden direction is asserted UNCHANGED at `tests/http/console-roster-unreachable.test.ts` §1a2. 🛑 **THE NARROWNESS IS THE WHOLE PRODUCT: one network with two members, one role (`reconcile_control_reader`, NOT `reconcile_control_app`, whose `SELECT` set is everything published downward and grows with every catalogue table — G1162), one table, `SELECT`, and `BEGIN READ ONLY` on top as a SECOND independent control** — witnessed RED against a role deliberately granted the write, with the ordinary-transaction control arm beside it. ⚠️ **`pack_catalogue` IS REFUSED BY NAME AND WITNESSED LIVE**, because an absent `GRANT` and an absent TABLE look identical in a migration set. ✅ **AND `listTenants` IS MOUNTED SINCE LATER ON 20 Sep 2026 — G1241, THE OWNER'S RULING — SO G1168 IS DISCHARGED AND THE SENTENCE BELOW IS CORRECTED RATHER THAN DELETED, because it is the sentence five files carried and the one a reader would have quoted before deciding not to mount.** THE ORIGINAL: *"🛑 AND IT MOUNTS NOTHING (G1168, ⛔ NOT APPLIED): `listTenants` IS REFUSED ON G833, NOT ON TOPOLOGY — `stage` is `required`, nothing persists an `OnboardingRecord` (G535's deliberate absence), and `fast-json-stringify` serialises without validating. §5 of that suite derives the refusal for all FOURTEEN console operations rather than asserting it."* 🛑 **TWO OF ITS FOUR CLAUSES SURVIVE AND TWO DO NOT.** *Nothing persists an `OnboardingRecord`* is closed by `db/migrations-control/0030_onboarding_record.sql`; *`fast-json-stringify` serialises without validating* is **MEASURABLY FALSE at the pinned version and G1244 is the measurement** — a missing `required` property THROWS, so the failure mode was a 500 on every request rather than a quiet incomplete roster. **WHAT SURVIVES: `stage` is still `required`, and G833's refusal of a `stage` COLUMN STANDS** — the value is DERIVED at read time by `model/onboarding.ts#onboardingStage()`, which is what the refusal made necessary. ⚠️ **AND §5 STILL DERIVES THE REFUSAL FOR THIRTEEN OF THE FOURTEEN**, keyed on a PRODUCER now rather than on a column |
| **WHERE H2's ONBOARDING STATE LIVES, AND THE FIRST CONSOLE OPERATION EITHER PLANE HAS EVER SERVED** | `db/migrations-control/0030_onboarding_record.sql` first — it argues the placement, the prefix length, the append-only trigger and the grants — then `server/data-plane/console-roster-store.ts`, then `server/data-plane/console-roster.ts` for the mount and its G300 derivation. **G1241–G1244, 20 Sep 2026; G1241 is THE OWNER'S:** *"Onboarding state lives in a table in the CONTROL database, one row per tenant, beside the roster — and `stage` is DERIVED at read time from the stored step state, never stored twice."* 🛑 **READ WHY IT IS A CONTROL-OWNED FACT BEFORE READING THE TABLE, BECAUSE IT IS G831's TEST APPLIED A SECOND TIME.** `listOnboardingSteps`'s own exemption text calls this state *"1CloudHub's own delivery record about its own work"*, and the test a column has to pass is *what would have to READ a tenant's data to populate it* — for a prefix length and a forced reason the answer is *a staff person ticking a box in `S1`*, so **invariant 3 is satisfied by construction**. `first_run` is the step to look at twice and it passes: it is OUR record that we watched a run happen, not a read of `public.run`. 🛑 **BOTH MODEL PROPERTIES ARE HELD AGAIN IN SQL AND NEITHER IS RESTATED.** The prefix length by there being **ONE INTEGER COLUMN** (G1242) — six booleans or a row-per-step child table each make *"step four done, step two not"* writable, and §5.5 says an unwritable invalid state beats a rejected one; **`CHECK (completed_steps >= 0)` and NO UPPER BOUND**, because `<= 6` is a third copy of `ONBOARDING_STEPS.length` that G88 freezes, so an out-of-range count is a READER refusal using a bound read from the tuple. The append-only mark by a **TRIGGER as well as a withheld grant** (G1243), because the grant is vacuous against the only writer the table has: no role holds `INSERT`, so the only writer is the ADMIN, and an admin holds every privilege. ⚠️ **AND `TRUNCATE` NEEDS A SECOND TRIGGER** — a `FOR EACH ROW` trigger does not fire on one, so a row trigger alone is defeated by a single statement and looks exactly like a guarantee until it is. Measured, not feared. 🛑 **`stage` HAS NO COLUMN AND G833 IS NOT DISCHARGED — IT IS WHAT MADE A DERIVATION NECESSARY.** `onboardingStage()` is the one place the rule lives; a total `Record` over its discriminant means a third arm is a compile error rather than a stage that renders as nothing, and the operation's own `?stage=` filter is applied over the DERIVED value because there is no column to narrow on. ⚠️ **AND THE FAILURE MODE FOUR DOCUMENTS RECORDED FOR THIS OPERATION IS WRONG — G1244, measured against `fast-json-stringify@7.0.1`:** a missing `required` property **THROWS**, so mounting against the roster alone was a **500 on every request**, not a quiet incomplete roster. The serialiser is silent in the ADDITIVE direction and loud in the SUBTRACTIVE one. **The silent arm survives behind a schema `default`**, which `tests/http/console-roster-served.test.ts` §2c pins. 🛑 **THE ACT'S RECORD AND THE ACT'S DATA ARE IN TWO DIFFERENT DATABASES**: the record goes to invariant 10's SECOND HOME (`0091`, G730) inside a session scope on the DATA database, and the roster is read through `withControlReadScope()` on the CONTROL one. The record is still written BEFORE the act; what is lost is atomicity in the other direction, and it is the SAFE direction — a record with no delivered result over-reports |
| **WHERE A TENANT-LESS ACT'S RECORD LIVES — INVARIANT 10's SECOND HOME** | `db/migrations/0091_platform_authorisation_record.sql` first — it argues every choice — then `model/access.ts`'s `PlatformAuthorizationGrant` and `server/data-plane/authorisation-record.ts`'s `writePlatformAuthorisationRecord()`. **G730, 19 Sep 2026, THE OWNER'S RULING: *"invariant 10 keeps ONE MEANING with TWO HOMES, and each home has a scope that can actually read it."*** 🛑 **THE INVARIANT'S OWN NUMBERED SENTENCE DOES NOT MOVE** — copy it from the list above, never from here. What moved is WHERE the row goes: a console act has no tenant, so its record is keyed on the ACTING SESSION, which is `db/migrations/0009_identity_substrate.sql`'s shape for the five tables read *"BEFORE a tenant is selected"* and its sentence is the justification. ⚠️ **THE NULLABLE `tenantId` G728 REFUSED IS STILL REFUSED** — under G100 that row is visible to no scope. The second TABLE answers that; the second TYPE answers the half nobody had named, because `PlatformAuthorizationGrant` has no `tenantId` FIELD, so routing a tenant-less grant to the tenant table is a `tsc` error rather than a runtime policy refusal. 🛑 **IT MOUNTS NOTHING AND THE SERVED SET WAS UNCHANGED AT 23 OF 136 WHEN THIS ROW WAS WRITTEN — ⚠️ the figure is left in the past tense rather than swept, because it is a statement about G730's own slice; the tree serves 25 since G946–G954 and this row mounted neither. Derive it: `grep -rn 'handlers:' server/*/start.ts`.** `decide()` refuses every platform principal at the gate for every verb `capability.openapi.yaml` declares, and the 26 `platform-role` operations are on a tier G602 measures as all-or-nothing — **so the seam's platform arm is written and unreachable over HTTP, which is this row's honest boundary.** ⚠️ **AND A CONSOLE ACT RECORDS ITS AUTHORISATION AND NOT ITS ACCESS**: `0014`'s three event streams are all tenant-scoped and none has a platform home. Reserved, not taken. `tests/db/platform-authorisation-record.test.ts` is the witness, including §1f — the two homes cannot see each other, in BOTH directions |
| **WHERE AN AUDIT, AN ACCESS AND A METERED FACT REST, AND THE ONE RULE THAT NOW COVERS ALL THREE** | `db/migrations/0014_invariant_10_event_streams.sql` first, **then `db/migrations/0017_usage_record_actor.sql`** — ⚠️ **THIS ROW WAS TITLED *"AND WHY ONE OF THE THREE HAS NO COLUMN-LEVEL RULE"* UNTIL 19 Sep 2026 AND THE TITLE IS CORRECTED RATHER THAN DELETED, because a heading is the part a reader quotes.** `0014` argues the whole shape — it argues the whole shape — then `server/data-plane/event-stream-store.ts`. **G317, 19 Sep 2026: invariant 10's three streams land in ONE migration**, because *“which stream carries what is a single question, and answering it three times across three commits is how two vocabularies for one concept get started — §5.3”*. 🛑 **`AUTHORIZATION_MAY_BE_ABSENT` IS A `CHECK`, NOT A REVIEW NOTE** — `CHECK (authorization_id IS NOT NULL OR actor_kind = 'system')` on `audit_event` and `data_access_event`. It **names one member** rather than transcribing a closed enum, so a sixth actor kind is DENIED a null, the fail-closed direction; `tests/db/event-streams.test.ts` §2 derives BOTH arms from the model constant itself, so the mirror cannot drift — 0008's answer to the same problem. ✅ **AND ON `usage_record` TOO SINCE G387, THE SAME DAY — `0017`, and the constraint is `audit_event`'s VERBATIM.** ⚠️ **THIS READ *"`usage_record` GETS NO SUCH CONSTRAINT AND THAT IS G376, A PREMISE OF G317 THAT DOES NOT HOLD"* and is corrected rather than deleted, because G376's three refusals are the reasoning G387 answers.** The owner took the first of the two options G376 said were owed: **`UsageRecord` gains `actorKind`, typed `AuditActor['kind']` — the KIND and never an ID.** Refusal (2) is overturned; **(1) and (3) STAND.** 🛑 **INVARIANT 3 IS RE-EXAMINED ON `0017`'s FACE RATHER THAN WAVED THROUGH, WHICH IS WHY IT IS A RULING AND NOT A PATCH:** an actor KIND is a five-member closed vocabulary and is not a person; an actor **ID** would be tenant data on a control-plane wire and **G387 explicitly does not take that decision**. ⚠️ **WHAT CROSSES TODAY IS NOTHING, AND THAT IS A MEASUREMENT:** `PlaneUsageEvent` is a SUBSET of the record — twelve properties, `additionalProperties: false`, **no actor and no `authorizationId` either** — and nothing ships one at all, because `shipUsageEvents` and `recordUsage` are declared and unmounted and `grep -rn 'fetch(' server/` returns nothing. `tests/db/event-streams.test.ts` **§2g** requires `usage_record` to carry EXACTLY ONE `actor_%` column, so a second is a red gate. 🛑 **G411: THE `NOT NULL` IS HALF OF EVERY ONE OF THE THREE CONSTRAINTS AND NO FILE SAID SO** — `false OR NULL` is `NULL` and a `CHECK` that evaluates to `NULL` **PASSES**, so a nullable discriminant admits exactly the row invariant 10 forbids. Witnessed in **§2h**, on all three tables — and the first version of §2h **passed with the `NOT NULL` deleted**, because the row died on `data_plane_id` and PostgreSQL says *"violates not-null constraint"* for that too. **Found by mutation, not by review.** 🛑 **AND THE EXPOSURE IS PROSPECTIVE, WHICH `0017` SAYS ON ITS FACE IN THOSE WORDS: NOTHING SHIPS A USAGE RECORD TODAY** — `writeUsageRecord()`'s only caller is a test, the control-plane database has ONE table (`pack_catalogue`), the control plane mounts ONE operation, and there is no outbound HTTP client in `server/` at all. **The boundary the column is argued against is not being crossed by anything**, so G88's forward-only is why the decision is taken NOW rather than when a shipper is written. **That is not a licence to widen; it is the harm named and deferred.** ⚠️ **AND ONE CONTROL THIS SLICE DID NOT BUILD, NAMED RATHER THAN LEFT: every RLS assertion in `tests/db/` is keyed on a NAMED table**, so nothing enumerates schema `tenant` and demands `relrowsecurity AND relforcerowsecurity` of every relation — **a migration shipping a table with no RLS passes the whole gate.** §3e closes it for these three by catalogue; the schema-wide version is owed by somebody else. THE ORIGINAL SENTENCE FOLLOWS. — `UsageRecord` carries NO ACTOR. Three repairs are refused on the migration's face, the deciding one being that this is *“the one record class that SHIPS TO THE CONTROL PLANE”* and a principal attribute on it breaks invariant 3. 🛑 **INVARIANT 5 GOVERNS THAT TABLE: no price column, no rate, no total, no currency**, and `tests/db/event-streams.test.ts` §1d asserts it by column name because `@dropped-for-v1` does not reach SQL. `UsageRecord.model` is stored AS THE LIVE RESIDENCY BYPASS IT IS — not fixed here, and not laundered: it must never be read as `audit_event.actor_model_id`, which IS a `ModelCatalogEntryId`. ⚠️ **G377: every column is a declared field and every declared field is a column** — eighteen columns for one `AuditActor`, because G88 makes a column added later to an append-only stream a permanent hole. 🛑 **NOTHING IS MOUNTED AND NOTHING ON A REQUEST PATH WRITES ANY OF THE THREE.** `DataAccessEvent.maxDataClass` has no producer; `RecordChain` has a canonicaliser (`model/canonical.ts`, G20) and NO SEQUENCE ALLOCATOR. The columns are proven by `tests/db/event-streams.test.ts` instead of by a route, which is 0007's precedent |
| **HOW A SESSION EXISTS WITH NO TENANT AT ALL, AND WHY THAT IS A LOOKUP** | `model/serving-host.ts` **§7–§8** first — the console registry and the ONE entry point — then `server/data-plane/session.ts`'s `surfaceOf()`, then `model/access.ts` §7's `ResolvedSubject`. **G726–G728, 19 Sep 2026, applying the OWNER'S ruling:** *"The data plane serves the console hosts, with tenant-less sessions. `session.tenant_id = NULL` is legal … reuse them rather than building a third process."* 🛑 **A CONSOLE HOST RESOLVES BY BEING IN A REGISTRY SOMEBODY WROTE DOWN, exactly as a tenant host does** — G179 applied rather than excepted. The mutation the shape survives is `host.startsWith('console.')`, which serves the staff console's surface to a BYOA customer whose own domain begins with that label and works perfectly for every host we named. 🛑 **A CONSOLE ROW HAS NO TENANT AND NO REGION**: a `tenantId` is a field every reader must remember to ignore, and a `region` is G297's refusal typed — *"a region label on [a console] would assert a residency invariant 3 says the control plane does not have."* ⚠️ **`ResolvedSubject` IS A UNION AND A CONSOLE SUBJECT HAS NO `tenantId` PROPERTY — not `null`, ABSENT** — so opening a tenant scope for one is a compile error rather than a value somebody must narrow. **THE SURFACE IS NEVER DERIVED FROM `session.tenantId`**: *"unbound therefore console"* deletes `tenant_not_selected` for every caller standing in front of D1. ✅ **G180 GETS NO EXCEPTION AND IT IS SWEPT RATHER THAN ASSUMED** — `checkHostBinding()` compares two strings and names neither a tenant nor a console. 🛑 **AND NOTHING IS MOUNTED, FOR A REASON G602 DOES NOT NAME: `authorize()` REFUSES A TENANT-LESS PRINCIPAL IT HAS JUST ALLOWED.** `AuthorizationGrant extends TenantScoped`, `db/migrations/0010` keys its policy on `app.tenant_id`, and G301's sixth fence makes minting a precondition of mounting — **where a tenant-less act's record lives is an owner's ruling**, pinned by `tests/model/console-principal.test.ts` §3 so the commit that takes it has to delete an assertion |
| **WHETHER AN FDE CAN REACH A TENANT OVER HTTP AT ALL — INVARIANT 8's PERMITTED PATH, SERVED** | `server/data-plane/identity.ts` **§6b** (`readStaffGrant`) first, then `server/data-plane/context.ts`'s `bindTenant()`, then `resolveAuthority()` in `server/data-plane/session.ts`. **G729, 19 Sep 2026.** ⚠️ **THIS ROW'S PREDECESSOR SENTENCE IS QUOTED RATHER THAN DELETED, because four documents carried it:** *"nothing on the SERVED path supplies a grant and nothing MINTS one … so an FDE over HTTP is still refused, and the arm is reachable with its term having no producer."* **The first clause is now false and the second is still exactly true: nothing mints a grant** — `0008` grants the app role `SELECT` and nothing else. 🛑 **INVARIANT 1 IS NOT BENT AND THAT IS WHY IT IS DONE AT D1**: the tenant comes from the HOST, and `grant.tenantId` is COMPARED against it rather than read as the answer. 🛑 **THE READ IS INSIDE `withSelectionScope()`** or it returns nothing — `tenant_access_grant_rls` is 0001's predicate on `app.tenant_id`, and that helper is the only one setting both GUCs. 🛑 **THE READER'S `WHERE` IS EMPTY** and each predicate somebody would add deletes one of G292's terms or the principal comparison. ✅ **AND THE PER-REQUEST DISJUNCT IS PAID IN THE SAME COMMIT** — without it D1 binds an FDE's tenant and every later request refuses them, which is **scopeable and unusable**. ⚠️ **`TenantSelectionInput.staffGrant` WIDENS TO `StaffGrantTerms`**, a narrowed projection a whole `TenantAccessGrant` still satisfies, because `0008` stores eight of that interface's nineteen fields and a reader would otherwise fabricate eleven — one of them a customer-visible `justification`. ⚠️ **BOTH SELECTION REFUSALS STILL REACH THE WIRE AS `membership_absent`**; publishing `access_grant_absent` at D1 is a contract change nobody has made |
| **How a session becomes a TENANT CONTEXT over HTTP — D1** | `server/data-plane/context.ts` first, then `server/data-plane/session.ts` and `server/data-plane/serving-hosts.ts`. `POST /context/resolve`, mounted 19 Sep 2026, **foundation-tier and EXEMPT from G200 on its own annotation** — *"this operation MINTS the session a capability check would later be built from, so gating it on one is circular"*. The chain is: digest the handle (G160, one seam) → read the row under `withSessionScope()` → `checkHostBinding()` **and revoke on a mismatch** (G180) → `resolveServingHost()`, a LOOKUP and never a parse (G179) → `selectTenantForSession()` inside `withSelectionScope()`, with `session_selection_restrictive` as the second half (G199). 🛑 **THE CONTRACT'S OWN SIDE-EFFECT SENTENCE IS WRONG ABOUT THE MECHANISM AND `context.ts` says so**: a row-level-security variable that outlived the request is leak MODE 1; under G101 it is `SET LOCAL`, and the DURABLE side effect is the bound session row. ✅ **IT RESOLVES A SUBJECT SINCE 19 Sep 2026 — G299.** ⚠️ **This row read *"IT MINTS NOTHING AND RESOLVES NO SUBJECT — `resolveSubject()` is not callable (no `user`, no `identity_connection`), so two of its seven arms are enforced and four are not: a disabled person and a disabled directory both reach this plane"*, and the second half is now FALSE and is corrected rather than deleted, because it is the sentence four files quoted.** All SEVEN arms are answered where they were declared to be, in order, and the two-term `WHERE` in `server/data-plane/session.ts` IS DELETED — `tests/db/identity-substrate.test.ts` §1 keeps that predicate runnable so the red it used to produce can be re-witnessed forever. 🛑 **"IT MINTS NOTHING" STILL HOLDS EXACTLY:** nothing in this repository creates a session, a person or a directory on a request path; the rows come from a seed behind G192's flag, and 0009 grants the app role `SELECT` and nothing else |
| **WHETHER IT ACTUALLY WORKS, IN A BROWSER, SIGNED IN** | `tests/e2e/browser-login.test.ts` — **G316, 19 Sep 2026.** The built bundle in chromium, `sessionStorage`, a REAL session row, the real data plane, real RLS, and the **production authoriser and substrate** (neither is passed as an argument, which is what makes a green assertion worth anything). 🛑 **THE TEST LOGIN IS A SEEDED ROW, NOT A WEAKENED CHECK** — `RECONCILE_LOCAL_TEST_AUTH` is DELETED in that file and must stay deleted: with the flag, nothing resolves a subject and `decide()` is never reached through its real terms. ⚠️ **AND THERE IS NO TEST LOGIN ON DEPLOYED STAGING, BY RULING** — the FLAG is the security boundary and both the handle and the signing key are PUBLISHED CONSTANTS, so setting it on an internet-reachable host publishes a working `ten_acme` credential rather than creating a login. Staging is asserted read-only by `tests/e2e/probe-staging.mjs` (TLS · G297's handshake refusal · `session_invalid`), which is NOT in the gate |
| **THE OPERATOR SURFACE — the queue, the finding, and taking a row** | `db/migrations/0015_exception_register.sql` first — it argues the whole shape — then `server/data-plane/exception-store.ts`, then `server/data-plane/exceptions.ts` for the mounts. **G357/G358/G359, 19 Sep 2026: the pack's C3 · Triage the register and C4 · Resolve an exception**, which `docs/build/deploy-handoff.md` §5a calls *"the product's actual operator surface"*. FOUR operations mount — `listExceptions`, `getExceptionFacets`, `getException`, `assignException` — and the last is **THE FIRST WRITE EITHER PLANE HAS SERVED**. 🛑 **G358 IS THE PRIVILEGE TO READ FIRST: `GRANT UPDATE (assigned_to)`, COLUMN-LEVEL.** A blanket `UPDATE` would put `severity_rank`, `status`, `value_at_risk_*` and — worst — `cost_centre`/`legal_entity`, *the attributes `AssignmentScope` narrows on*, inside a handler's reach; the DATABASE refuses every column but one, and `tests/db/exception-register.test.ts` §2 witnesses both directions. ✅ **`reverseResolution` IS MOUNTED SINCE 20 Sep 2026 — G946–G950 — AND G359's REFUSAL IS CORRECTED RATHER THAN DELETED, because it is the sentence five files carried:** *"🛑 G359: `reverseResolution` PASSES G300's THREE-PART TEST AND IS STILL NOT MOUNTED — nothing here can produce a resolution to reverse, so its only reachable answer is its own 409, and 'a 403 indistinguishable from an unbuilt feature is worse than an honest 404 from the router' reads the same for a 409."* **Its premise was true when written and G658's `executeProposal` ended it**; an adversarial pass then found a SECOND obstacle G359 never named — `tenant.exception_reversal` took `GRANT SELECT` alone, so mounting would have answered **500, not 409** — and `db/migrations/0140` §1 ends that one, in the same commit as `server/data-plane/reversal-store.ts` (G511). **The 409 is still reachable and is now a refusal about a ROW**: `tests/http/proposal-chain-served.test.ts` §10 is the 201 and §10b is the 409, in one suite. ⚠️ **G357 STORES WHAT THE WIRE PUBLISHES AND THAT LOSES THREE MODEL FIELDS BY RULE** — `approvedBy[]`, `executedBy`, `policyEvaluationId`: the model's `ExceptionResolution` is a three-arm union and the contract's is a flat record, so **a four-eyes approval is not expressible on this tier**. Named as a loss, asserted absent by §6 of that test, and not fixed here. ✅ **AND THAT SENTENCE WENT FALSE ON 19 Sep 2026 — G658 AND G660. ⚠️ IT IS CORRECTED RATHER THAN DELETED**, because *"a four-eyes approval is not expressible on this tier"* is the sentence the next slice was commissioned against and the one a reader would have quoted onward. **The tier is unchanged and the sentence was right about it**: `Annotation` still carries one scalar capability per operation and `decide()` still takes no resource state. What changed is that four eyes never needed to be expressible THERE — `model/approval.ts` is the evaluator, `approval_decision_insert_restrictive` is the same predicate at the row, and the capability tier supplies the first-order gate exactly as it did. **And the wire now carries `approvedBy` and `executedBy`** (G660); `policyEvaluationId` is still absent and still refused, because `mode: 'autonomous'` is unreachable here. ⚠️ **AND `estimatedTotal` IS ALWAYS `null`**: the cheap estimate counts rows the session cannot see, and a count that overstates what a caller may see is the one direction that must not be guessed |
| **RESOLVING A FINDING — proposing, approving and executing, and the one place four eyes are counted** | `db/migrations/0059_resolution_chain.sql` first — it argues the six tables, the one widening and the trigger — then `model/approval.ts`, then `server/data-plane/proposal-store.ts`, then `server/data-plane/proposals.ts` for the mounts. **G656–G660, 19 Sep 2026: C4's OTHER HALF**, which `server/data-plane/exceptions.ts` named in its own voice — *"C4 is half of C4 … and THERE IS NO `proposal` TABLE."* SIX operations mount on FOUR capabilities: `listAvailableDispositions`, `listProposals`, `getProposal` (`view_exception`), `proposeResolution`, `decideApproval`, `executeProposal`. 🛑 **READ `model/approval.ts`'s HEADER BEFORE ANYTHING ELSE, BECAUSE THE INTERESTING CLAIM IS A NEGATIVE ONE: IT IS NOT A SECOND EVALUATOR BESIDE `decide()`.** It takes no argument that is a principal, it never sees a role or a capability, and it is asked strictly AFTER the gate — so a refusal from it is a **409, never a 403**. G289 refused a control-plane evaluator on the confused-deputy argument; this answers a different question (*"is this PROPOSAL ready"*) about a different subject. 🛑 **FOUR EYES LIVES IN TWO PLACES AND A TEST IN BOTH DIRECTIONS IS WHAT MAKES IT A MIRROR** rather than `0002`'s third place to drift — `tests/db/resolution-chain.test.ts` §6 drives the same violation past the handler and into the database and requires BOTH to refuse. ⚠️ **WHAT IS STILL NOT ENFORCED AND IS NAMED RATHER THAN GLOSSED: `ApprovalConfig.approvers` and `distinctHolders`.** `db/migrations/0009`'s `user_visible_to_session` keys on the SESSION, so a request path reads exactly one person's assignments — its own — and an approver's ENTITLEMENT is therefore checked once, by the capability gate, and never against the policy's own list. ✅ **AND `reverseResolution` IS MOUNTED SINCE 20 Sep 2026 — G946–G950. ⚠️ THIS READ *"🛑 AND `reverseResolution` IS STILL NOT MOUNTED, WITH ONE OF ITS TWO OBSTACLES CLOSED: a resolution is producible now, and `tenant.exception_reversal` still takes `GRANT SELECT` alone, so mounting it would answer 500, not 409"* AND IS CORRECTED RATHER THAN DELETED, because that sentence is exactly what the next slice was commissioned against and `tests/db/resolution-chain.test.ts` §10 was armed on it.** `db/migrations/0140` §1 takes the `GRANT INSERT`; §2 pins the three facts a reversal destroys, without which `getDispositionMix` counts wrong; §3 pins `reversed_by` against the act's own authorisation record; §4 teaches `0059`'s trigger a fourth verb in one direction only. **§10's assertion is not deleted, it is moved one layer in and is strictly stronger**: a bare INSERT with no record is now refused by a RESTRICTIVE POLICY rather than by the absence of a privilege. ⚠️ **THE IDEMPOTENCY KEY IS ACCEPTED AND NOT HONOURED** — a retry after a timeout double-proposes, and the half-measure is refused on the store's face |
| **UNDOING A RESOLUTION, AND THE THREE FACTS THAT SURVIVE THE UNDOING** | `db/migrations/0140_reversal_write_and_mix_pins.sql` first — it argues the grant, the pins, the policy and the trigger — then `server/data-plane/reversal-store.ts`, then `server/data-plane/exceptions.ts` for the mount and `server/data-plane/disposition-mix-store.ts` for the reader the pins owe. **G946–G954, 20 Sep 2026, ALL DERIVED and all saying so on their own faces.** 🛑 **THE TWO OPERATIONS ARE ONE COMMIT AND THAT IS A FINDING RATHER THAN A CONVENIENCE — G952.** A reversal CLEARS `tenant.exception.resolution_*` (*"cleared on reversal"*), so **the moment `reverseResolution` mounts, a `getDispositionMix` reading only the live columns publishes `reversalRate: 0` for every disposition and a `count` short by every reversed choice** — two numbers PRESENT and WRONG, one step worse than G284's silently absent field, because an absent field crashes a client and a wrong rate becomes a slide. `0140` §2's three `NOT NULL` pins are what the `UNION ALL` reads; **none of them reaches the wire**, because publishing them would put the undone resolution back beside the reversal. 🛑 **`reverse_resolution` MAY CLEAR A RESOLUTION AND MAY NOT MINT ONE (G949)** — `0059`'s trigger learns a fourth verb in exactly one direction, so undo-then-redo in a single act is unrepresentable. That is the contract's own reason for refusing an agent this operation — *"an agent that can undo its own resolutions can launder a bad one"* — expressed in SQL. ⚠️ **`correctedDispositionKey` IS RECORDED AND NEVER RE-RESOLVES**: re-resolving is `proposeResolution` → `decideApproval` → `executeProposal`, as it is for every other disposition. ⚠️ **`count` COUNTS CHOICES AND NOT EXCEPTIONS** — the contract's *"a disposition CHOSEN four hundred times and reversed a third of the time"* is the specification, and an exception resolved, reversed and re-resolved the same way contributes 2. ⚠️ **`periodId` IS REFUSED WITH A DECLARED 422 (G954)**, because `tenant.exception` carries no period and nothing joins one to a run: the filter is inexpressible, and ignoring it would answer every period as though it were the one asked for |
| **THE CONVERSATION — asking a counterparty a question, and the column that DOES NOT EXIST** | `db/migrations/0022_correspondence.sql` first — it argues the whole shape — then `server/data-plane/correspondence-store.ts`, then `server/data-plane/correspondence.ts` for the mounts and for the FOUR REFUSALS at its foot. **G471/G472/G473, 19 Sep 2026: the pack's C6 · Ask a question, which the contract tags C9.** G318's THIRD wave — *"INGESTION, EXCEPTIONS, CORRESPONDENCE, AND ONLY THEN THE PARTNER PORTAL AND THE STAFF CONSOLE"*. THREE operations mount, all READS, all `view_document` — `listThreads`, `getThread`, `getMessage`. 🛑 **READ THE INVARIANT 6 ARGUMENT BEFORE ANYTHING ELSE, BECAUSE THE CONTROL IS AN ABSENCE AND AN ABSENCE IS WHAT A REVIEW MISSES.** *"Ingested content is data, never instruction."* A vendor reply is *"the sharpest prompt-injection surface in the product"* — and **there is no `body` column**; `bodyRef` is a pointer into object storage that nothing here dereferences, so the prose an attacker controls cannot reach a caller through these three at any price. ⚠️ **TWO COLUMNS ARE STILL COUNTERPARTY-INFLUENCEABLE AND BOTH ARE PUBLISHED** — `thread.subject` (an inbound thread takes it from the counterparty's own `Subject:` line) and `counterparty.display_name`. They are the contract's *"letterhead"*, which is its stated reason this surface is gated on `view_document` rather than `view_exception`; they are stored verbatim and parsed by nothing. 🛑 **NOTHING HERE GOES NEAR A PROMPT AND THAT IS A MEASUREMENT:** `grep -rn 'resolveModel(' server/` → nothing. **The commit that first sends any of it to a model owes a RULING, not a code review.** 🛑 **THE FOUR WRITES ARE NOT MOUNTED AND EACH IS REFUSED BY NAME ON A DIFFERENT MISSING TABLE.** `openThread`'s only declared 422 reads `CorrespondenceConfig.permittedChannels`, which has no table; `checkOutboundDisclosure` would report `sendable` for a draft no ceiling had been applied to; `sendOutboundMessage` would send and write no `DisclosureRecord`, which is the breach rather than the gap; and **`decideAdmission` is *"THE MOST SECURITY-SENSITIVE OPERATION IN THE PRODUCT"*** — gated on `capabilityToAdmit` CONJOINED with `orgClassesThatMayAdmit` CONJOINED with `secondPersonToAdmitAboveClass`, **two of which have no producer**. ⚠️ **`GRANT UPDATE (admitted_as_evidence_at)` IS THE CHEAP SHORTCUT SOMEBODY WILL REACH FOR**, because `0015`'s G358 made the column-level UPDATE a familiar tool; `0022`'s grants block refuses it in advance and by name, and `tests/db/correspondence.test.ts` §2b witnesses the database refusing it |
| **HOW THE SESSION HANDLE REACHES A BROWSER, AND THE ONE CHANNEL THAT IS FENCED OUT OF THE DEPLOYED PROCESS** | `server/data-plane/session-cookie.ts` first — it argues the whole channel — then `server/data-plane/session.ts`'s `resolveSessionReader()`, then `server/dev/session-header.ts`. **G386, 19 Sep 2026: an `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-`-prefixed cookie on the tenant host, and `X-Session` only behind `RECONCILE_LOCAL_TEST_AUTH`.** 🛑 **THE FENCE IS THE HALF TO READ FIRST AND IT IS STRUCTURAL, NOT CONDITIONAL** — the ruling says so in as many words: *"A boolean check inside a request handler does not satisfy this ruling."* A plane without the flag returns `databaseReader(pool, sessionCookieFrom)` at the first line of the resolver and never imports the header reader, so there is **no accepting code path in the process to bypass**. Derive it, never read it: `grep -rn "from '\\.\\./dev/" server/data-plane/` → nothing. ⚠️ **THE `__Host-` PREFIX IS G396 AND IS A CONTROL, NOT A CONVENTION**: it forbids a `Domain` attribute, so the cookie is HOST-ONLY *at the user agent* and a sibling subdomain can neither set it nor overwrite it — G180's threat refused a second time, on the other side of the wire. A `Cookie` header carrying the name TWICE is refused outright, because that is the wire signature of cookie tossing and taking the first hands the attacker a coin flip. ⚠️ **CSRF IS NOW LIVE AND `SameSite=Lax` IS NOT A COMPLETE ANSWER** — it keeps the cookie off every cross-site `POST`/`PUT`/`PATCH`/`DELETE`, which is every state-changing operation served today, and a state-changing **`GET`** would carry it; there is none only because nobody has written one. 🛑 **AND THE DELIVERY HALF HAS NO PRODUCTION CALLER**: nothing in this repository mints a session — `tenant.session.user_id` is `NOT NULL` and `grep -rn 'jwtVerify\\|createRemoteJWKSet' server/` returns nothing — so G386 is 🟠 and not ✅. ⚠️ **THE FIRST CLAUSE IS UNCHANGED AND THE DERIVATION BESIDE IT IS RETIRED — G976/G978, 20 Sep 2026. A VERIFIER EXISTS** (`server/data-plane/token-verify.ts`) **and that command never measured whether one did**: it returned THREE lines before the verifier landed, all three of them PROSE — this sentence among them — and it returns FOUR now, because `node:crypto` uses neither name and the verifier`s own header had to quote the command in order to retire it. **Nothing about the delivery half moved**: a verified token is not a minted session, `MintedSession` still carries no handle, and D6 is still owed. Witnessed in `tests/http/session-cookie-channel.test.ts` (the bytes, the parser, and the fence as an absence in the source tree) and `tests/e2e/browser-login.test.ts` §10–§13 (a real Chromium: `document.cookie` cannot see it, no request carries `X-Session`, and a live plane refuses a VALID handle in that header) |
| **WHY G180 REFUSES A TOSSED SESSION AND CANNOT REVOKE IT** | `docs/HANDOFF.md` **G399** first, then `db/migrations/0005_session_and_membership.sql`'s `session_selection_restrictive`. 🛑 **A LIVE DEFECT, MEASURED 19 Sep 2026 AND DELIBERATELY NOT REPAIRED.** `REVOKE_SESSION` runs inside `withSessionScope()`, which sets no `app.tenant_id`; the restrictive `WITH CHECK` reads `tenant.membership` through a subquery PostgreSQL applies `membership_rls` inside, so the `EXISTS` is empty and the UPDATE is refused with *"new row violates row-level security policy"*. ⚠️ **IT IS GREEN EVERYWHERE BECAUSE OF THE `tenant_id IS NULL` ARM**: every existing assertion tosses a session that has not been through D1. **The revocation works for every session that does not matter and fails for every session that does** — which is `model/serving-host.ts`'s own predicted *"likeliest lazy repair"*, arriving as a policy rather than as a missing line. Kept RUNNABLE as a `todo` at `tests/e2e/browser-login.test.ts` §12b |
| **WHAT ENDS A MEMBERSHIP, AND WHY ONE OF THE TWO WAYS WAS UNGUARDED FOR A DAY** | `db/migrations/0035_membership_liveness_voids_sessions.sql` — it quotes both defects, both measurements and the two sentences of `0019` they refute — then `0019` itself and `0027`, in that order, because **neither is edited**: `0017`'s precedent is that a successor keeps the correction on its own face and G88 keeps the predecessor's refusal on its. **G561/G562, 19 Sep 2026, DERIVED and not the owner's.** 🛑 **`expires_at` WAS A SECOND REMOVAL PATH WITH NO GUARD AT ALL** — `UPDATE tenant.membership SET expires_at = now() - interval '1 hour'` committed with *no authorisation record, no `app.tenant_id` and no raise*, leaving every session of the removed person live — **while every other liveness predicate in this schema (`0005`, `0008`, `0018`, and `0019`'s OWN policy four lines above its trigger) treats expiry and revocation identically.** §5.1 in the repository's first trigger. 🛑 **AND THE BODY'S OUTCOME FLIPPED ON `BYPASSRLS`**: with two live memberships — a shape `0005` supports by having no `UNIQUE (tenant_id, user_id)` — revoking one signed a live member out for the migrator and did nothing for the app role, **all three guards passing in both arms**, the second of them the vacuity `0019`'s own header warns about. ⚠️ **NOT REACHABLE OVER HTTP TODAY** (`SELECT` alone on `tenant.membership`), and that is the reason to repair the TRIGGER rather than to document the GRANT: after `0035` the property survives a blanket `GRANT UPDATE`, where before it depended on the next author reading G358. ✅ **AND THE OWNER CLOSED IT THE SAME DAY — G641, AND THE SENTENCE BELOW IS CORRECTED RATHER THAN DELETED**, because it is the ruling's own premise and is still exactly right about the TRIGGER. **The answer is read-side, and the interesting half is the SEAM rather than the predicate**: `selectTenantForSession()` refuses to check SESSION liveness on the grounds that *"a second copy here would be §5.3 — two implementations of one order — and the one that drifts is always the copy"*, and a membership check on the other side attracts the same objection in reverse. So the four terms moved OUT of that function into **`holdsLiveMembership()`** (`model/access.ts` §7a), both callers reach them — binding, and `resolveAuthority()` in `server/data-plane/session.ts` on every request — and the READ moved with them, from `server/data-plane/context.ts` into `server/data-plane/identity.ts` §5a. **One predicate, one statement, two callers; the TypeScript count went one to one, not one to two**, which matters because `0035` records the same five tokens stated SEVEN times in SQL and one of the seven written with a term missing. ⚠️ **NO NEW REFUSAL NAME AND NO REASON ON THE WIRE** — `membership_absent` is unchanged and the per-request answer is a bare 401, because naming the term would tell whoever holds the handle what changed and roughly when. 🛑 **IT REFUSES AN ABSENT MEMBERSHIP TOO**: the narrow reading fails OPEN, since deleting the row would buy a permanent session. ⚠️ **THE STAFF ARM IS NOT COVERED AND IS NAMED**: nothing supplies a `staffGrant` at D1, so no session is bound by it and a staff-bound one would be REFUSED rather than admitted. Witnessed in `tests/http/membership-liveness-on-read.test.ts` (a membership seeded with a five-second expiry and **never written to again**, so the trigger cannot fire) and `tests/model/membership-liveness.test.ts` (§4 reads `selectTenantForSession()`'s own bytes and requires the copy to be ABSENT). THE ORIGINAL SENTENCE FOLLOWS. — 🛑 **WHAT IS STILL OPEN AND IS THE OWNER'S: the clock arriving is not an `UPDATE`.** A membership that lapses purely by time fires nothing; a trigger has no tick, and closing that needs a reader-side check or a sweeper. **And `tests/e2e/browser-login.test.ts` §12b DID NOT MOVE** — G180's absent-membership arm is a ruling, this slice touched no policy, and its fixture still has no membership row. ✅ **AND IT STILL HAS NOT MOVED UNDER G641**: it is still the unmet `todo`, and `ses_e2e_doomed` was RE-HOMED onto a person seeded for that absence rather than being given the row |
| **WHY THERE IS NO STAFF CONSOLE, NO CAPABILITY GRANTING AND NO USER ADMINISTRATION — AND IT IS ONE FACT, NOT THREE** | `tests/db/administrative-reach.test.ts` first — it is a MEASUREMENT over a real PostgreSQL, not an argument — then `docs/HANDOFF.md` **G447**, **G449** and **G450**. 🛑 **THERE IS NO ADMINISTRATIVE REACH IN THIS SCHEMA: every person-scoped table is visible and writable only to its own owner.** `tenant."user"` and `tenant.identity_connection` are keyed on the acting session's own row (`0009`) and `tenant.session` on its own digest (`0005`), so a caller sees exactly ONE person — itself — and inside `withTenantScope()`, **the transaction every gated handler runs in**, it sees ZERO. 🟢 **THE ASYMMETRY IS THE USABLE PART: `tenant.membership` IS tenant-scoped, so a tenant can read WHO BELONGS and cannot read WHO THEY ARE.** ⚠️ **BOTH OWNER RULINGS OF 19 Sep 2026 DIED HERE, and each needs a producer that does not exist**: capability granting needs `target.orgClass`, whose only source is `orgFor(connection.owner)` — G449; membership revocation needs to void the REMOVED PERSON's sessions, and `UPDATE tenant.session … WHERE user_id = <somebody else>` **matches zero rows and commits without raising** — G450, and the silence is the dangerous half. 🛑 **`session_selection_restrictive` GATES `UPDATE` AND NOT `DELETE`**, because PostgreSQL gates `DELETE` on `USING` and that policy states only `WITH CHECK` — so G399's "case with no containment" *has* a containment and it is the wrong one, destroying the `revoked_at` evidence. ⚠️ **THE SUITE ASSERTS A LIMITATION, so it goes RED the day a directory policy opens** — that is deliberate, and the commit that widens reach must re-argue each assertion rather than discover which it spent |
> 🛑 **SEVERAL SLICES SWEPT THIS SECTION ON 20 Sep 2026 AND THE MERGE KEEPS
> EVERY NARRATION, WHICH IS §5.11 WITH A SECOND PARENT ARRIVING AS A
> DUPLICATED ENTRY RATHER THAN AS A WRONG NUMBER.** Each is correct about the
> branch that wrote it and none is correct about this tree. **Derive; do not
> read.**

| **WHY THERE IS NO REPORTS SURFACE, NO EXPORT, NO SPEND METER AND NO AUDIT TRAIL — AND IT IS THREE BLOCKERS AT THREE LAYERS, NOT ONE** | `tests/contracts/customer-surface-reach.test.mjs` first — it is a DERIVATION over the six contract documents, the closed capability set, the migration text and the server source tree, and it needs no database — then `docs/HANDOFF.md` **G531**. 🛑 **ONLY 16 OF THE 39 CAPABILITIES ARE NAMED BY ANY OPERATION, AND `view_audit`, `view_metering` AND `view_access_log` ARE NAMED BY NONE**, the unregistered administration tier included. Derive it, never read it: `grep -rhoE '^ *x-capability: [a-z_]+$' docs/contracts/*.openapi.yaml | sed 's/.*: //' | sort -u | wc -l`. **G300's three-part test cannot be STARTED for an operation that does not exist**, so C8 and C11 have nothing to mount — and the corpus says so about itself in two places, at `getLocalMetrics` (*"the human-facing meter is `view_metering`, which has no declared operation anywhere"*) and at `getStaffCase` (*"The customer's own trail is C11 on the capability tier … and is owed"*). ⚠️ **AND IF ONE WERE DECLARED TODAY IT WOULD SERVE AN EMPTY PAGE**: all three of invariant 10's streams have a table (`0014`, `0017`) and their three writers have **no caller outside `tests/`**, which is exactly why *"a served read records THE AUTHORISATION IT RAN UNDER and not THE ACCESS"* is still true. 🛑 **`getDispositionMix` IS THE ONE TO READ, because it is G300's *"a table alone is the trap"* arriving with a PARTIAL table**: `view_dashboard` is real, the model is real, `0015` §1 stores the resolution columns — and `label` and `family`, both `required` on the 200, have no producer anywhere, because `Disposition` lives on `SolutionPack.dispositions` and no migration declares a catalogue. **`fast-json-stringify` serialises without validating (G284), so mounting it would have shipped a 200 missing two of its own required fields, silently.** ⚠️ **ONE KNOWN ESCAPE, NAMED IN THE FILE**: a catalogue table under an unguessed name passes, and the control that would close it — every mounted operation's response carrying every `required` field it declares — is owed |
| **WHAT IS IN A SLOT WHEN RUN IS PRESSED — AND WHY THE SLOT CHECK WAS UNREACHABLE FOR A DAY** | `db/migrations/0150_document_slot_binding.sql` first — it argues the four columns, the null period, the two partial indexes, the three foreign keys and the grant — then `readSlotFill()` in `server/data-plane/run-admission.ts`, then `model/run-admission.ts`'s `SlotFill`. **G961–G964, 20 Sep 2026, DERIVED and not the owner's.** 🛑 **IT ENDS A SENTENCE THREE FILES CARRIED IN THE SAME WORDS**: *"NOTHING BINDS A `SourceDocument` TO A SLOT ANYWHERE IN THIS REPOSITORY"* — so a definition declaring an `exactly_one` or `at_least_one` slot was a 422 forever, correctly and with no way out. **The refusal is NOT deleted**: `tests/http/slot-fill-served.test.ts` §1 re-witnesses it on every run against a tenant that HOLDS the document, and its header quotes the captured red verbatim. 🛑 **AND A SECOND THING WENT FROM INERT TO LIVE THAT NO DOCUMENT HAD NAMED: the idempotency key has THREE parts and the third was a CONSTANT.** `slotFillBasis([])` is the canonical form of `{}`, so `slotFillFingerprint` never varied on any request this repository ever served; §4 of that suite is the first assertion that could have caught it. 🛑 **THE GRANT IS THE DECISION: `SELECT` and nothing else.** A path that could write this table could satisfy a required slot with a document IT chose — `slot_fill_incomplete` becomes a refusal the caller controls — and worse, `run.inputs` is the operand set a run engine reads, so **a caller who chooses the operands chooses the answer**, and every gate, policy and audit row downstream would log that act as correct. Measured, not assumed: **no operation on any of the seven tiers binds a document to a slot**, so an `INSERT` would be `0004`'s privilege ahead of its writer. **THE WRITER IS OWED** and is the ingestion cascade's. ⚠️ **A NULL `period_id` IS THE UNPERIODISED FILL AND NOT A WILDCARD** — the reader's `IS NOT DISTINCT FROM` is the half that makes that true, and `= $2` reinstates the old 422 silently. ⚠️ **ONE ARM IS NOW REACHABLE AND UNJUDGED**: two DISTINCT documents in one `exactly_one` slot ADMITS, `errors.yaml` has no member for it, and all three repairs are rulings |

| **WHY THERE IS NO REPORTS SURFACE, NO EXPORT, NO SPEND METER AND NO AUDIT TRAIL — AND IT IS THREE BLOCKERS AT THREE LAYERS, NOT ONE** | `tests/contracts/customer-surface-reach.test.mjs` first — it is a DERIVATION over the six contract documents, the closed capability set, the migration text and the server source tree, and it needs no database — then `docs/HANDOFF.md` **G531**. 🛑 **ONLY 16 OF THE 39 CAPABILITIES ARE NAMED BY ANY OPERATION, AND `view_audit`, `view_metering` AND `view_access_log` ARE NAMED BY NONE**, the unregistered administration tier included. Derive it, never read it: `grep -rhoE '^ *x-capability: [a-z_]+$' docs/contracts/*.openapi.yaml | sed 's/.*: //' | sort -u | wc -l`. **G300's three-part test cannot be STARTED for an operation that does not exist**, so C8 and C11 have nothing to mount — and the corpus says so about itself in two places, at `getLocalMetrics` (*"the human-facing meter is `view_metering`, which has no declared operation anywhere"*) and at `getStaffCase` (*"The customer's own trail is C11 on the capability tier … and is owed"*). ⚠️ **AND IF ONE WERE DECLARED TODAY IT WOULD SERVE AN EMPTY PAGE**: all three of invariant 10's streams have a table (`0014`, `0017`) and their three writers have **no caller outside `tests/`**, which is exactly why *"a served read records THE AUTHORISATION IT RAN UNDER and not THE ACCESS"* is still true. ✅ **`getDispositionMix` IS MOUNTED SINCE 20 Sep 2026 — G951–G954 — AND THE SENTENCE BELOW IS CORRECTED RATHER THAN DELETED, because §4's tripwire was armed on it and fired exactly as designed.** It read: *"🛑 `getDispositionMix` IS THE ONE TO READ, because it is G300's 'a table alone is the trap' arriving with a PARTIAL table: `view_dashboard` is real, the model is real, `0015` §1 stores the resolution columns — and `label` and `family`, both `required` on the 200, have no producer anywhere … mounting it would have shipped a 200 missing two of its own required fields, silently."* **G657's `tenant.disposition` gave both a producer** and §4 recorded the movement in its own voice — *"its blocker is now a commit rather than a schema"*. `server/data-plane/reports.ts` derives G300's three parts and `tests/http/proposal-chain-served.test.ts` §12 asserts EVERY `required` row field in a real served 200. 🛑 **AND A SECOND BLOCKER WAS FOUND ON THE WAY IN AND IS REFUSED RATHER THAN IGNORED — G954:** `periodId` is a DECLARED filter with no producer and no join path, so it answers a 422 that is declared in the same commit. **The three read surfaces this row names beside it — C8's spend meter, C11's audit trail, C7's export — are UNCHANGED and still have no declared operation or no table.** ⚠️ **ONE KNOWN ESCAPE, NAMED IN THE FILE**: a catalogue table under an unguessed name passes, and the control that would close it — every mounted operation's response carrying every `required` field it declares — is owed |
| **WHAT A RUN ACTUALLY PRODUCED, ON A SCREEN — AND THE HATCH THAT REFUSED IT WHILE THE PLANE SERVED IT** | `frontend/src/components/RunAccount.tsx` first — it names the five drawn panels and maps each to the channel it is — then `frontend/src/api/runs.ts`'s run-account block, then `frontend/src/components/Register.tsx`'s deleted hatch. **G1031/G1032, 20 Sep 2026, DERIVED and not the owner's.** 🛑 **READ THE CORRECTION BEFORE THE SCREEN.** The register carried `<NotBuilt refusedBy="G200" why="getRunAccount and listRunResidue are declared and not mounted">` while **G300 had mounted both the day before** — `grep -n 'getRunAccount\|listRunResidue' server/data-plane/start.ts`. **A hatch means REFUSED and G245 minted a separate ink step so it could keep meaning only that**, so a mark asserting a discharged refusal costs every other mark on the page its credit; this is the `AssertNoTextDeep` false-negative's mirror, in ink instead of prose. 🟢 **THE ROUTE WAS ALREADY DRAWN**: *"The run's own account in five panels — the fold, the identity `presented == admitted + refused`, the conformance floor, the file self-check, the postconditions"* (`git show archive/pre-handoff-pack:design/routes/index.html`), and **all five are `getRunAccount`'s own channels**, which is why the route and the operation are one slice. 🛑 **THE HONEST PRIMARY STATE IS A 404 AND IT IS A SENTENCE**: nothing persists a `SetReconciliationResult`, so `getRun` answers 200 while both account reads answer `no_account` on the same run — three independent state machines, not one, and the 404 gets its own arm because *"answering `{items: [], nextCursor: null}` to both would report a clean close for a run nobody ran."* ⚠️ **THE SENTENCE ENUMERATES ALL THREE FACTS THAT 404 STANDS FOR AND ASSERTS NONE** — another tenant's run, a run that never existed, a run nobody reconciled — and **G1032 records the test that went RED against that honest wording**, because its first draft forbade the phrase rather than the claim (§5.1, inside a control written against §5.1). ⛔ **`RunDetail.tsx` IS DELETED AND `onOpen` WITH IT**: the drawer was this route's stand-in while the route layer was dead code. ⚠️ **NOTHING IS MOUNTED — the served set is unchanged at 25 of 136**; what changed is that an application consumes two operations that had no consumer. Witnessed in `tests/e2e/browser-login.test.ts` §23a–§23c, in a real Chromium against a real plane |
| **HOW AN ADMITTED RUN REACHES A WORKER, AND WHY THE WORKER NEVER SCANS** | `server/data-plane/run-queue.ts` first — it argues the ruling, the three rejected alternatives and the publish ORDERING — then `server/data-plane/run-worker.ts`, then `infra/lib/run-queue-stack.ts`. **R-B and R-C, 20 Sep 2026, THE OWNER'S RULINGS.** 🛑 **THE PROPERTY THAT DECIDES IT IS ABOUT INVARIANT 2 AND NOT ABOUT THROUGHPUT:** the admitting handler publishes `(tenantId, runId)`; the worker consumes ONE message and opens exactly THAT tenant's scope. **No cross-tenant read exists anywhere in the design.** 🛑 **THE REJECTED ALTERNATIVE WAS MEASURED, NOT REASONED (A-4):** a `FOR UPDATE SKIP LOCKED` scan by a worker with no tenant returns **0 rows** under G100 — every time, correctly — and it cannot enumerate tenants either, so it needs `BYPASSRLS`, which the owner refused because *"every isolation assertion in `tests/` is relative to no serving process holding that role."* `tests/db/run-worker-scope.test.ts` §1 keeps that measurement RUNNABLE and §3 is the cross-tenant negative control, with §4's RLS-disabled leak to make §3 mean anything. 🛑 **THE PUBLISH IS AFTER THE COMMIT AND THE COST IS NAMED (G1203):** a process that dies between `COMMIT` and the send LOSES the message, and the repair is the operator pressing Run again — free, because `run_idempotency_key` is a UNIQUE INDEX, so **both outcome arms publish and the `deduplicated` arm is the recovery story rather than a duplicate.** ⚠️ **THE WORKER IS THE SEAM AND NOT THE EXECUTOR**, and its header says so in capitals: `SetReconciliationInput` needs eighteen fields and a definition stores four (R-A). ⚠️ **AND NOTHING CONSUMES THE QUEUE IN AWS (G1204, G1205)**: `sqs:ReceiveMessage` is granted to nobody, `Planes`' task definition carries no `RECONCILE_RUN_QUEUE_URL`, and both are a person's decision rather than effort |
| **THREE OF THE TEN D6 RULINGS, BUILT — WHERE A TOKEN'S ISSUER COMES FROM, WHY A PUBLIC MOUNT MUST SAY SO, AND WHY DIRECTORY TEXT REACHES NO MODEL** | `docs/HANDOFF.md` **G2231–G2253** first, then `server/data-plane/verification-terms.ts` §2a, `server/http/app.ts`'s SEVENTH fence and `server/contract/capability.ts`'s `PUBLIC_OPERATION_AUDIENCE`. **D6-5, D6-8 and D6-9 — THE OWNER'S RULINGS of 29–30 Sep 2026, applied 1 Oct 2026; the other seven are not built here.** 🛑 **D6-5: the issuer a token is verified against is READ OFF THE PINNED `identity_connection` ROW and the token's own `iss` is COMPARED, never chosen.** `PinnedBrokerIssuer` has one constructor, `pinnedBrokerIssuer(door)`, called once in `server/` on the door `assembleSignIn()` proved is pinned (G344); `completeCodeExchange()` accepts `PinnedVerificationTerms` and nothing wider; `RECONCILE_IDENTITY_ISSUER` is RETIRED, because configuration-per-environment was the second refused alternative. `tests/http/pinned-issuer.test.ts` mounts the IdP mix-up with ONE key signing both tokens, so the issuer is the only thing that can refuse it — and measures the refused allowlist ACCEPTING it. 🛑 **D6-8: `callerOf([])` is `none` and the fourth fence is NOT widened**; a seventh, appended so no cited ordinal moves, refuses a bare public person-facing mount at boot. `checkLocalHealth` is distinguished by a tier-keyed census that compels a mark and grants nothing, argued against G911 at its declaration. 🛑 **D6-9: the ruling's own derivation — a bare grep for the call under `server/` — RETURNS FOUR LINES, ALL PROSE (G2252)**, so the absence is held on the TypeScript AST at `tests/http/directory-text-reaches-no-model.test.ts`. ⚠️ **NOBODY CAN SIGN IN AFTER THIS EITHER**: `completeFederatedSignIn` is unmounted, and the callback-handler commit still owes D6's assertion that the scope's broker pair is not read from the request body (G2235) |
| **WHICH KEYS VERIFY A SIGN-IN TOKEN — ONE DOCUMENT PER DOOR, LOADED AT BOOT, SELECTED BY THE PINNED DOOR** | `server/data-plane/verification-terms.ts` first — its R2-AMENDED block, then §1a–§3 — then `db/migrations/0300_connection_key_document.sql`, then `db/key-inventory-scope.ts`, then `docs/HANDOFF.md` **G2571–G2576**. **R2 IS AMENDED, NOT REPLACED — THE OWNER'S, 1 Oct 2026**: *"Per-connection, boot-time: fetch every registered connection's JWKS at boot and cache by connection; audience becomes a column. Still no runtime JWKS egress; a new connection needs a restart."* It closes **G2498** — the issuer was per door (D6-5) and the keys and audience per deployment, so a second pool could pin and not verify. 🛑 **KEYS AND AUDIENCE ARE SELECTED BY THE PINNED DOOR'S ID AND NEVER BY THE TOKEN (G2575)** — a map from `iss` to document is the refused shape, and `tests/http/per-connection-jwks.test.ts` §2c measures it ACCEPTING a pool-B token at a door-A sign-in. 🛑 **ONE UNREACHABLE DOOR NO LONGER REFUSES THE BOOT (G2574), WHICH REVERSES G2133 AND IS ARGUED**: under G276's BYOA a pool may be a customer's, and fail-the-boot hands every customer's IdP a veto over the whole plane. The door is refused BY NAME (`connection_key_document_unavailable`, never `token_key_not_found`) and printed before the listener; **the inventory READ still refuses the boot.** ⚠️ **`RECONCILE_IDENTITY_JWKS_URL` AND `RECONCILE_IDENTITY_AUDIENCE` ARE RETIRED (G2572)** and the §1c egress census is UNCHANGED — `jwks-source.ts` and `code-exchange.ts`, and the transport is still a dynamic import reached only when some door declares a document |
| **WHICH DOOR TO TRY — THE FIRST UNAUTHENTICATED PERSON-FACING OPERATION THIS PRODUCT SERVES** | `server/data-plane/realm.ts` first — read its §0 before anything else, because the D6 DEPARTURE is the premise the mount rests on — then `db/migrations/0220_domain_claim.sql`, then `db/realm-scope.ts`, then `server/data-plane/start.ts`'s `session` block. **G1941–G1952, 22 Sep 2026; G1941 is THE OWNER'S (S7).** 🛑 **IT IS A DEPARTURE FROM G165 AND NOT AN INTERPRETATION OF IT.** *"THE D6 THREAT-MODEL GATE LANDS BEFORE THE FIRST UNAUTHENTICATED ENDPOINT"* — this is that endpoint and D6 is not written. G248's treatment is EXTENDED rather than inherited, because G248 fenced itself: *"DO NOT READ THIS ROW AS AMENDING G165 GENERALLY. It rules one issue."* **Its mitigation binds unchanged and nothing here may be defended on the grounds that it already shipped**: *"a threat model written after the surface it covers must be allowed to change the surface, or it is documentation rather than a control."* **The rejected alternative is WRITE D6 FIRST, and the cost is named: `/lookup` is the only way a person reaches this product, so gating it on an unwritten document is a schedule rather than a control.** 🛑 **THE ENUMERATION ORACLE IS DELIBERATE — DO NOT CLOSE IT AND DO NOT WIDEN IT.** The contract's own words: *"A 200 for a claimed domain and a 422 for an unclaimed one is a DOMAIN-existence signal. It is a weaker leak than user existence and it is a real one. It is not invented away, because collapsing the four arms on the wire would depart from the model this tier exists to mirror … THIS IS THE FIRST QUESTION FOR THE D6 THREAT MODEL."* **What IS closed is STRUCTURAL and larger**: the request admits `domain` and nothing that names a person, so two addresses at one domain are ONE request — and ajv REJECTS a smuggled `email` rather than stripping it (G191). ⚠️ **THE SECOND QUESTION FOR D6 IS NAMED TOO: there is no rate limit anywhere**, no WAF and no throttle on either distribution, so an oracle with no cost per question is one somebody can sweep — and a throttle belongs at the edge, which is `infra/`'s. 🛑 **AND THE REGISTER IS FIVE QUESTIONS SINCE 22 Sep 2026, NOT ONE — G1990, ⛔ D6 IS STILL NOT WRITTEN.** Naming one read as a surface with one problem, and G248's mitigation can only change what somebody wrote down. The other four: **what each refusal DISCLOSES about a THIRD PARTY's identity configuration** (`domain_not_verified` is an organisation mid-onboarding; `connection_disabled` distinguishes *never a customer* from *a customer who suspended sign-in*; the takeover code tells the party most likely to have caused it that the plant LANDED); **the cost of a sweep denominated in DATABASE CONNECTIONS rather than in information** (each anonymous question holds one pooled connection for its life — G1984's timeout SHEDS that and does not prevent it); **the response-length channel** (G1989, narrowed among the refusals and still open between 200 and 422, and the operation is not constant-TIME); and **the 500 arm being anonymously reachable on an alarm whose expected rate is zero**. 🛑 **THREE DEFECTS THE MOUNT SHIPPED WITH ARE CLOSED IN THE SAME PLACE AND ARE WORTH READING BEFORE THE HANDLER: an oversized body answered 500 `upstream_unavailable` while the SECURED `/context/resolve` answered 401** (G1985/G1986 — `maxLength: 253` for what ajv sees, a 413 for what it never sees, because parsing fails first); **`createAppPool()` had no `connectionTimeoutMillis`** (G1984 — measured at 5,715ms unbounded against 2,000ms rejected); **and the round-trip count and the body LENGTH each isolated an arm** (G1988, G1989). ⚠️ **AND `/session/realm` IS SERVED ON TWO HOSTS, NOT ONE** — `console.` AND `partners.reconcileai.app` (G1997), which is where a throttle would have to attach. 🛑 **THE FOURTH FENCE DOES NOT FIRE AND THE MARK IS TAKEN ANYWAY (G1948, ⛔ NOT APPLIED)**: `callerOf([])` is `none`, so `mountTier()` drops the ONE operation where a person has presented nothing because they have not signed in yet. **§5.1, keyed on the SECURITY SCHEME rather than on whether a human is there**, and widening it is a boot failure on `checkLocalHealth`. 🛑 **AND THE SURFACE IS LIVE WITH NO PRODUCER (G1952)**: `addSignInDomain` is on the unmounted administration tier and there is no DNS TXT verifier, so every domain answers `domain_not_claimed` until a migrator writes a row — `0004`'s refusal of a write privilege ahead of its writer, and G511's *"the fence and the writer are one commit or neither"* |
| **WHERE THE PUBLIC MARKETING PLANE LIVES, AND WHY THE APEX IS ON NEITHER EDGE CERTIFICATE** | `infra/lib/amplify-stack.ts` first — it argues the apex, the rewrites, the intake and every refusal — then `infra/lib/config.ts`'s Amplify block, then `infra/lambda/demo-intake/guards.mjs`, then `docs/build/deploy-handoff.md` §14 for the AWS-side sequence. **G1961–G1979, 22 Sep 2026; G1961 is THE OWNER'S:** the public marketing plane lives on **AWS Amplify at the apex `reconcileai.app`**, honouring `docs/build/deploy-handoff.md` §5.4 — *"a different tool for a different job."* 🛑 **IT ANSWERS `EDGE_APEX_IS_SERVED_ELSEWHERE` WITHOUT MAKING IT FALSE**: that constant says the apex is *"not the `Edge` stack's"* and G298 confirmed the narrow reading of G297's *"flat apex"*; this is the ELSEWHERE. **The apex does not collide with the `*.reconcileai.app` sinkhole, for the one fact G297's whole argument rests on — a wildcard matches exactly ONE label** — so the flat wildcard covers `console.` and `ten-acme.` and covers the apex not at all, and **Amplify issues a THIRD certificate** for that one name, which cannot fail open onto a tenant host. 🛑 **THE APEX A RECORD IS NOT IN THE TEMPLATE BECAUSE IT CANNOT BE (G1964)**: `AWS::Amplify::Domain` publishes no distribution domain and no hosted-zone id — derive the attribute list, do not read it — and an apex must be an ALIAS, so there is nothing to point at; **Amplify writes the records into `Z04053259WLMQJTR30EU` itself**, and a second writer of one record name is the G297 race, measured. 🛑 **TWO REWRITES AND ONE IS NARROWER THAN THE SLICE WAS ASKED FOR (G1966): `/session/realm` AND NOT `/session/*`.** A 200 rewrite is invisible to the browser, so every cookie is the APEX's — and `completeFederatedSignIn` MINTS a session, which would bind `__Host-reconcile_session` to `reconcileai.app` and then be REVOKED by G180's `checkHostBinding()` at the real host on the next request. `resolveHomeRealm` is on the list because it mints nothing, sets no cookie, reads no cookie and *"is never GIVEN a user to look up"*; `infra/test-fixtures/amplify-session-bearing-path.ts` witnesses the refusal RED against the exact widening. ⚠️ **AND THE TARGET REACHES NO PLANE TODAY (G1967) — THREE BLOCKERS, AND THIS ROW NAMED ONE (G2011)**: no plane origin (`CacheBehaviors.Quantity: 0`); **no allowed METHOD** — `resolveHomeRealm` is a POST and that distribution's only behaviour is `ALLOW_GET_HEAD`, so **CloudFront refuses it with its own 403 body and the request reaches no origin**, which is why *"answered with `index.html`"* was the wrong symptom to look for and why closing the origin alone leaves this standing; and, on the S5 branch only, no mount — the sibling slice mounts it (G1941), so that third one is CLOSED after the merge. Derive it: `grep -rn 'resolveHomeRealm' server/data-plane/start.ts`. 🛑 **NO REPOSITORY AND NO TOKEN, AND THAT DEPARTS FROM `ci-image-stack.ts` ON A MEASUREMENT (G1963): `AWS::Amplify::App` HAS NO CODECONNECTIONS PROPERTY**, AWS documents its two token fields as *"the **personal access token** for a GitHub repository"* — the shape `connections.ts` records G263 as forbidding — and **there is no marketing repository to connect**, because `1CloudHub/Reconcile` builds the APPLICATION SHELL. 🛑 **THE REFERRAL-CODE ORACLE WAS OPEN AND G1969's ✅ IS WITHDRAWN — G2001, 22 Sep 2026. ⚠️ THIS ROW READ *"REFERRAL-CODE VALIDITY CANNOT LEAK BECAUSE IT IS NEVER EVALUATED (G1969), and the enforcement is a SIGNATURE: `ACCEPTED` is a frozen constant taking no argument … and `tests/infra/demo-intake.test.mjs` drives two codes through the whole function and requires byte-identical answers"* AND IT IS CORRECTED RATHER THAN DELETED**, because every word of it was true and the property still did not hold. **The function did not evaluate the code and leaked it anyway, by asking something that does**: `deliver()` returned `ACCEPTED` iff the CRM answered `2xx`, so `PARTNER-ACME-2026` → **202** and `GUESS-0001` → **502**, at a public URL with no credential. A frozen constant cannot make a claim about the answer, because **the answer is the CHOICE OF WHETHER TO RETURN IT** — and the byte-identical test used a double answering `201` to BOTH codes, so it could not fail. ✅ **WHAT HOLDS IT NOW IS CONTROL FLOW: `deliver()` HAS ONE `return` AND NO `throw`**; the CRM is attempted, its outcome is reported to the log and to a metric, and the answer is `ACCEPTED` on every path. ⚠️ **AND LATENCY IS NOT CLOSED (G2007)** — an owner's ruling, because the repair is a queue. ✅ **CLOSED BY G3681 (3 Oct 2026, the owner's: *"Queue it: the intake enqueues and returns immediately; a worker delivers to the CRM. Constant-time answer."*)** — the intake enqueues and answers, `infra/lambda/demo-intake/worker.mjs` alone reaches the CRM, and the clause before this is kept as it stood. 🛑 **AND THE ABSENT CORS CONFIGURATION PROTECTED NOTHING (G2002): CORS gates READING A RESPONSE**, so a cross-origin `POST` with a safelisted `Content-Type` was sent with no preflight and only the reply blocked — which a write-only lead endpoint does not need. `application/json` is required now, which forces a preflight the absent configuration then fails. ✅ **AND THE INTAKE IS ALARMED (G2006)**, because `handler()` CATCHES and `AWS/Lambda Errors` therefore reads 0 on every dropped lead. ⚠️ **NO CRM CREDENTIAL IS IN THE TREE AND THE SECRET IS CREATED EMPTY (G1971)**, so every intake answers `crm_not_configured` with a 502 until a person runs one `put-secret-value`. ⚠️ **AND FOUR ROWS RECORD WHAT IS NOT DONE** — ⚠️ **this said FIVE and listed the alarm among them; G2006 built it**: no marketing site (G1968), no `www` (G1972, it fails at the TLS handshake), no WAF and no rate limit on the first unauthenticated write this product has published (G1975 as amended by G2015 — **the bound is not the ~$44/month of compute; it is ≈4.3M junk CRM leads a day and an availability kill at ~50 concurrent connections, answered with a raw AWS 429 in no `errors.yaml` enum**), and **no evidence anywhere that an Amplify 200-rewrite forwards a POST body at all** (G2012 — `tests/infra/` read a template, the intake suite has no Amplify in the path, and §14.2 curled a GET; the runbook now POSTs through both doors) |
| **WHO MAY ADVANCE A TENANT'S ONBOARDING — AND THE FIRST CONSOLE WRITES EITHER PLANE HAS SERVED** | `db/migrations-control/0040_onboarding_writer.sql` first — it argues the second role, the column-level grant, the four refused verbs and the trigger — then `db/control-write-scope.ts`, then `server/data-plane/onboarding-store.ts`, then `server/data-plane/onboarding.ts` for the mounts and the status mapping. **G1421–G1430, 21 Sep 2026; G1421 (R8) and G1422 (R9) are THE OWNER'S.** 🛑 **R8 IS A CONTRACT ANNOTATION AND IT IS THE WHOLE SLICE'S KEYSTONE:** *"Annotate the three onboarding operations in place as `x-capability: view_substrate` on the administration tier."* All three carried `x-capability: 'exempt: …'`, and **an exemption is not a capability — `decide()` is never asked**, so a mount before R8 would have served 1CloudHub's own delivery record to any authenticated person (measured: `tests/http/administration-tier-unmounted.test.ts` §3b, a **200 with the body** to a caller the authoriser refuses every capability). ⚠️ **G911 IS WHAT MADE IT POSSIBLE**: until `TIER_REQUIRES_CAPABILITY` was retired a gated operation on this tier was UNREPRESENTABLE, which is why G781 cut fourteen others into `platform-console.openapi.yaml` — and the owner's objection to that shape still stands on its face, *"it is still contract surgery and still a ruling."* **In place is less surgery than a second split.** 🛑 **R9 IS THE PRIVILEGE, AND THE OWNER ACCEPTED TWO NAMED COSTS THAT ARE PAID IN THE SAME COMMIT RATHER THAN DEFERRED.** **(a)** `tests/db/control-plane-census.test.ts` §A — the assertion G1161 calls *"what replaces a construction"* — **goes RED BY DESIGN** and is RE-ARGUED at its own site: the empty list becomes an enumeration of two argued (role, relation) pairs. **It is not weakened, it is SPENT.** **(b)** `onboarding_record` had NO TRIGGER and *"a prefix length never shrinks"* was held by there being no writer at all; the `BEFORE UPDATE` trigger replaces it, on `0059`'s precedent, because **a `CHECK` sees one row and monotonicity is a relation between OLD and NEW**. 🛑 **THE SECOND ROLE IS MEASURED AND NOT PREFERRED (G1423)**: with the console READER deliberately granted the write, the helper still refuses (`cannot execute UPDATE in a read-only transaction`) and **an ordinary `BEGIN` on that same credential PERFORMS the statement** — so a read pool's protection is a HELPER a second caller need not use, while a grant is a property of the CREDENTIAL. ⚠️ **AND ONE DEFECT WAS FOUND BY MEASUREMENT RATHER THAN REVIEW (G1425): PostgreSQL REFUSES `FOR UPDATE` ON THE NULLABLE SIDE OF AN OUTER JOIN** — a planner rule, not a privilege — so the 404 check and the row lock are two statements. **The lock is not an optimisation**: without it two forces of different gates leave a record carrying a forced mark for a step it claims is not done, which the trigger cannot see because two increments are not a decrement. ⚠️ **TWO MODEL REFUSALS COLLAPSE ONTO ONE WIRE CODE AND THE LOSS IS NAMED (G1427)**: `errors.yaml`'s enum is CLOSED and has no `step_already_done`. **An unrecognised step key is a 404 and never a 409** — `StepKey` has no `enum` by design, so `banana` would otherwise be told its step is out of ORDER. 🛑 **AND THE ACT'S RECORD AND THE ACT'S DATA ARE IN TWO DIFFERENT DATABASES (G1426), WHICH FOR A WRITE IS ONE STEP WORSE THAN FOR A READ**: a process death between one `COMMIT` and another leaves a change to a delivery record with no trace of who authorised it. **It is still the safe direction of the two available**, and the alternative — recording after the act — makes *an act with no record* the ordinary case. ⚠️ **NOTHING OF THIS IS REACHABLE ON DEPLOYED STAGING**: R-P's platform-role seed is behind `RECONCILE_LOCAL_TEST_AUTH`, so **no console principal exists there** and all three answer 403. That is a separate ruling |
| **WHERE A SOURCE CREDENTIAL LIVES, WHO MAY BIND ONE, AND WHY NOBODY CAN READ ONE BACK** | `server/data-plane/credential-binding.ts` first — its header argues the order of the two writes and names what the ruling asked for and this does not deliver — then `db/migrations/0270_endpoint_credential_ref.sql`, then `infra/lib/storage-stack.ts`'s credential grant and the tenant key policy's Secrets Manager statement, then `tests/http/credential-binding-served.test.ts`. **G2401, 1 Oct 2026, THE OWNER'S:** *"Source credential custody: Secrets Manager, one secret per source, encrypted with the tenant's per-tenant KMS key (Storage's key factory); only a credentialRef lives in Postgres; the FDE binds a credential via a write path under G75's secret reach."* 🛑 **THE VALUE GOES IN AND NOTHING COMES OUT, THREE TIMES OVER**: the seam exports a writer and no reader; the serving role holds `CreateSecret` and `PutSecretValue` and a read verb fails SYNTH (G2403); and the tenant key lets that role `GenerateDataKey` through Secrets Manager and never `Decrypt` (G2402). **The reader of a credential is the connector that pulls a source, and it is not built.** 🛑 **`CreateSecret` IS REFUSED UNLESS IT NAMES A TENANT KEY**, so `aws/secretsmanager` — the account's shared key — is an `AccessDenied` rather than a silent default; and a tenant with no `tenant.tenant_key_handle` row is REFUSED rather than stored under any other key. ⚠️ **SECRET NAMES ARE OPAQUE** — `ListSecrets` is account-wide, `tenantKeyAliasName()`'s argument one API over — **AND IAM DOES NOT SEPARATE TENANTS HERE**: isolation is the server's and RLS's, witnessed RED with RLS removed. 🛑 **THE FDE CANNOT TAKE THIS PATH (G2407, ⛔ PUT TO THE OWNER)**: `decide()` has no staff-grant arm, so the ruling's last clause is G60's shape arriving one layer down — and the obvious arm would open `PERMITTED_RESOURCES.delivery`, which includes `tenant_data`, on every mounted operation. ⚠️ **THE PACK SAYS *"We never hold one"* AND IS MARKED `built`** — G2408, recorded and not restatused. ⚠️ **NOTHING IS DEPLOYED**, and the deployed plane would answer every bind `store_not_configured` until a `Planes` deploy wires `RECONCILE_CREDENTIAL_*`. `docs/build/completion-plan.md` W5-C9 sorts the 35 C9 rows into TASK and blocked |
| **THE PARTNER PORTAL — WHO MAY ACT FOR A FIRM, WHERE THE ACT IS RECORDED, AND WHAT IT MAY READ** | `db/migrations/0320_partner_authorisation_record.sql` first, then `0321`, then `0322`, then `server/data-plane/partner-portal.ts`, then `tests/http/partner-portal-served.test.ts`. **W5, 1 Oct 2026, G2621–G2640; G2621 and G2624 are THE OWNER'S.** 🛑 **INVARIANT 10 HAS THREE HOMES FOR ONE MEANING** — tenant, platform, and now a partner firm's, keyed on the acting session; `PartnerAuthorizationGrant` has no `tenantId` field and `authorize()` keys the home on the capability's class, the same test the fifth arm dispatches on. ⚠️ Before this, a portal act would have been recorded as a 1CloudHub STAFF act. 🛑 **EVERY W5 TABLE IS KEYED ON THE ACT'S RECEIPT** — the record's firm — so a firm's people, invitations, deals and sandbox are readable only inside an act carrying the right verb, and the receipt itself cannot be written for a firm the actor holds no live role in (a TRIGGER, because as a `WITH CHECK` it RECURSED — G2623). ⚠️ **FIVE MOUNTED, FOUR ANNOTATED AND NOT** (`invitePartnerPerson` on `name`, the trial request on G359, hand-back and reset on an act nothing performs). 🛑 **INVARIANT 2's SINGLE PATH IS STILL THE ONLY ONE**, asserted over a socket: every portal verb and no `PartnerAccessGrant` reaches nothing in a tenant |
| **WHERE A SOURCE IS, WHAT IT IS DOING, AND WHICH DOCUMENT TYPE EACH OF ITS FILES IS** | `server/data-plane/sources.ts` first — its header derives G300 per operation — then `db/migrations/0340_source_declaration.sql`, `db/migrations/0341_source_document_type_pair.sql` and `model/connectors.ts` §2–§4, then `tests/http/sources-served.test.ts`. **G2681–G2692, 1 Oct 2026, DERIVED AND NOT THE OWNER'S.** Five operations, declared and mounted in one commit: `declareEndpoint`, `stopEndpoint`, `resumeEndpoint` and `declareEndpointDocumentType` on `configure_endpoint`, `listEndpoints` on `view_endpoint`. 🛑 **A DECLARATION CANNOT CARRY A CREDENTIAL** — the `INSERT` on `tenant.endpoint` is column-level and omits the three binding columns, so custody (G2401) stays the only writer of `credential_ref`. 🛑 **THE S3 EXTERNAL ID IS MINTED, NEVER DECLARED** (G2685), and a reserved host is refused at declaration — **the connect-time half of that SSRF control is the connector's and is owed** (G2686). ⚠️ **`state` IS DERIVED** from the lane, the binding and whether anything arrived, and carries `waiting_on_first_delivery`, a state the pack does not draw (G2688). ⚠️ **A PAIR HAS NO FIDELITY** — row 11 is an absence (G2690). 🛑 **THE PARKED PILE, THE CLASSIFIER AND THE DRAIN ARE NOT BUILT AND CANNOT BE**: an `Arrival` carries no filename (`0012` §3) and `ArrivalVerdict` has no third state (G2692) — both rulings. ⚠️ **NO PACK WORD MOVED** (G2691, PR #467's rule) |
| **THE STAGING MOCK SIGN-IN AND THE PROFILE SWITCHER — A PUBLIC TEST LOGIN THE OWNER ACCEPTED IN WRITING** | `infra/lib/mock-personas.ts` first — the one list of doors and personas, imported by the stack, the switcher and the seed's suite — then `infra/lib/mock-idp-stack.ts`, `infra/lambda/mock-idp/idp.mjs`, `db/seeds/staging-mock-personas.sql`, `frontend/src/test-personas.ts` and `docs/build/deploy-handoff.md` §26. **G2996–G3008, applying THE OWNER'S RULINGS G2771** (*"Confirm as designed"*, then *"have a subagent do (a) option for signed in testing"*). 🛑 **Anybody holding the one mock password signs in as any persona — a 1CloudHub platform principal and an FDE with a 90-day delivery grant among them.** Every half is OFF by default and refused outside staging: the stack under `-c mockSignIn=on`, the providers under `-c mockIdpIssuer`, the switcher by a COMPILE-TIME constant that is `true` for a staging build alone and whose absence `tests/app/profile-switcher-fence.test.ts` reads off the gate's own bundle. ⚠️ **THE SEED RUNS TWICE (G2998)**: Cognito mints the stored subject at first sign-in, so deterministic mock subjects cannot make it single-phase. 🛑 **G3006: a tenant-host sign-in lands UNSCOPED and no browser can bind one** |
| **The frontend** | `frontend/src/Shell.tsx`, then `frontend/src/bridge.css` — the theme bridge between `design/system/tokens.css` and Tailwind. G198. ⚠️ **This row did not exist until 22 Aug 2026**, and neither did any mention of `frontend/` on this page |
| **THE APEX MARKETING SITE — `/`, `/demo/`, `/lookup/`, `/story/` AT `reconcileai.app`, AND WHY THE APPLICATION REDIRECTS RATHER THAN RENDERS THEM** | `frontend/site/vite.config.ts` first — it argues why this is a SECOND build and not a second entry — then `frontend/site/src/PublicPlane.tsx`, then `frontend/src/routes/apex.ts`, then `docs/build/deploy-handoff.md` **§25**. **G3151–G3158, 2 Oct 2026; G3151 is THE OWNER'S:** *"Apex only: serve /demo and /lookup from the apex marketing site (Amplify); tenant/console hosts redirect there. The marketing site needs building."* It answers G3078 and, for the four pages the pack draws, G1968. 🛑 **THE PAGES ARE THE PACK'S AND THE FIGURES ARE THE PACK'S CLEARED ONES, JOINED BY A TEST** — `tests/app/apex-site.test.ts` derives every `class="figure"` from `V1 Landing.dc.html` and `V4 Success Story.dc.html` and requires the BUILT pages to match — and V1's AWS Marketplace sentence and the three AWS marks are NOT shipped, because `PRODUCT.md` names that sentence a breach (G3152). 🛑 **`/lookup/` CANNOT ROUTE TO A HOST**: `resolveHomeRealm` answers a door, so Continue navigates to the tenant host the PERSON names, never one inferred from a domain (G3153); the routing gap is the owner's. ⚠️ **`frontend/` GAINS A SECOND APPLICATION ROOT**, so `git ls-files frontend | wc -l` moved and the layout block's figure is stale — derive it. ⚠️ **NOTHING IS DEPLOYED AND THE `Amplify` STACK HAS NEVER BEEN CREATED**; §14.2 then §22 is the order |
| **The local stack** | `compose.yaml` and `Dockerfile`, both of which argue in their own headers |
| **WHETHER ANYTHING PAGES WHEN STAGING BREAKS — AND WHY THE ANSWER IS STILL NO** | `infra/lib/observability-stack.ts` first — it argues every alarm, every refusal and the join — then `tests/infra/observability.test.mjs`, then `docs/tech-stack.md` §12's row-by-row table. **G1061–G1068, 20 Sep 2026, all DERIVED and saying so on their own faces.** Derive the absence it ends: `ls infra/lib/*-stack.ts | wc -l` said **9** and `grep -rln 'Alarm' infra/lib/` returned **NOTHING**, while four files named a stack that did not exist. 🛑 **THE REASON IT IS FIRST AMONG THE DEPLOYMENT STEPS: a staging environment people can sign in to and that pages NOBODY is the shape of failure PR #257 already produced here — a green signal that was green by unavailability.** ✅ **R14 IS TAKEN — G1811, 22 Sep 2026, THE OWNER'S: "Use a placeholder email address that must be replaced before production." THE SENTENCE BELOW IS CORRECTED RATHER THAN DELETED**, because it is the sentence four files carried and the one a reader would have quoted onward. IT READ: *"🛑 AND IT STILL PAGES NOBODY, WHICH IS SAID THREE WAYS SO IT CANNOT BE SKIMMED PAST (G1062): the topic has ZERO subscriptions, the stack OUTPUTS that fact as `AlarmsPageNobodyUntil`, and a test pins the zero at an assertion the subscribing commit must DELETE. Who is paged is an OWNER'S RULING."* 🛑 **THE TOPIC NOW CARRIES EXACTLY ONE SUBSCRIPTION — A PLACEHOLDER EMAIL ADDRESS, MARKER-ASSERTED (`PLACEHOLDER-REPLACE-BEFORE-PRODUCTION`) — AND STILL PAGES NOBODY, FOR A DIFFERENT REASON: SNS CANNOT AUTO-CONFIRM AN EMAIL SUBSCRIPTION**, so it sits `PendingConfirmation` until an inbox at that address (there is none) clicks the confirmation link. The old pinned-zero test is DELETED, deliberately, as its own comment demanded; what replaces it asserts exactly one subscription, EMAIL protocol, and the marker on the endpoint, so a real address landing without deleting the marker or the marker being deleted without a real address are both red. The stack OUTPUTs `AlarmsPageAPlaceholderUntil` in place of `AlarmsPageNobodyUntil`, because the old name would now be a false claim. 🛑 **THE JOIN IS THE LOAD-BEARING DESIGN DECISION AND IT IS A CONSTRAINT: CDK MINTS A CROSS-STACK EXPORT PER ATTRIBUTE READ, AND A NEW EXPORT ON `Planes` IS A `Planes` DEPLOY** — which G1012 measures as rolling both planes back to an image ECR has EXPIRED, against a forward-only schema. So the ECS names come from the NAMED exports (`Storage`'s by-name precedent) and the ALB dimension is derived from the ALREADY-EXPORTED ARN with `Fn::Select`/`Fn::Split`; **`loadBalancerFullName` is refused BY NAME**, and §7 of the suite goes red on exactly that tidy-up. **MEASURED: the synthesised `Planes`, `Network` and `Edge` templates are BYTE-IDENTICAL before and after.** ⚠️ **TWO ROWS OF §12 ARE EVENTBRIDGE RULES AND ARE CALLED RULES (G1064)** — `ECS/ContainerInsights` has no restart counter and no exit-code metric, so there is nothing to threshold; and **the second migrate rule is the one that matters**, because a task that failed to START carries no exit code at all and a single exit-code rule would let a forward-only migration fail in silence. ⚠️ **EVERY THRESHOLD IS DERIVED FROM A CONSTANT IN THE TREE AND NONE IS AN SLO** (G1063) — and one of them, the ten-minute service-shortfall window, was **corrected by `cdk synth` itself**: `minHealthyPercent` is unset, so `floor(0.5 × 1)` is ZERO and a three-minute alarm would have paged on every pipeline run. 🛑 **THE CONTROL PLANE'S ALB GETS NO ALARM AND THAT IS CORRECT (G1066)**: its ingress list is `[]`, so it emits no `RequestCount` and an alarm there would read OK for ever. ✅ **THE LOGGER LANDED 21 Sep 2026 — G1391–G1396 — SO ONE OF THE TWO IS DISCHARGED AND THE SENTENCE IS CORRECTED RATHER THAN DELETED.** IT READ: *"⚠️ TWO THINGS ARE ⛔ NOT APPLIED AND BOTH ARE PINNED BY TESTS RATHER THAN BY PROSE: the LOGGER (G1067) — `server/http/app.ts` still sets `logger: false`."* 🛑 **AND THE CLAUSE ABOUT BEING PINNED BY A TEST IS THE ONE THAT WAS WRONG: §9's tripwire PASSED against the commit that turned the logger on, satisfied by a PROSE COMMENT** (G1392). The measurement it rested on is unchanged — `logger: true` alone breaches G261 §12.1 on its first request, because Fastify's default `req` serializer logs `req.url`, which is the QUERY STRING — which is why the repair is `server/http/log-allow-list.ts` and not a boolean. **WHAT IS STILL ⛔ NOT APPLIED IS AWS CONFIG's `required-tags` RULE (G1068)**, which evaluates nothing without an account-wide configuration recorder this shared account does not have. ⛔ **AND IT IS NOT OWED — R15, 1 Oct 2026, THE OWNER'S (G2441): no recorder, so no Config rule exists BY DECISION; the clause before this is kept as it stood, and the synth-time Aspect plus its tests is the whole of tag enforcement** |
| **WHY THE STACK AND THE FLEET USED TO COME APART AFTER EVERY DEPLOY, AND WHAT NOW KEEPS THEM TOGETHER** | `infra/lib/buildspecs.ts`'s G2041 block first — it argues the shape and refuses four alternatives by name — then the Deploy `build` phase beneath it, then `tests/infra/pipeline-stack-value.test.mjs`, then `docs/build/deploy-handoff.md` **§17** for the AWS-side sequence. **G2041, 22 Sep 2026, THE OWNER'S: *"Fix it properly — make the pipeline write the stack value."*** 🛑 **THE DEFECT RECURRED AFTER EVERY SINGLE DEPLOY AND WAS WORKED AROUND BY HAND FOR DAYS.** The Deploy stage registered a task definition and called `UpdateService`, and **never wrote anything back to CloudFormation** — so the SERVICE moved and the STACK did not. Measured 23 Sep 2026: both planes on `cc58f357…` while CloudFormation owned `56d9d053…`, **an image running nowhere**, and a bare `cdk deploy reconcile-planes-staging` would have rolled both planes back two days against a forward-only schema (G88). ✅ **WHAT REPLACES IT IS A NARROW, SCOPED `UpdateStack` ON ONE NAMED STACK, USING CLOUDFORMATION'S OWN CURRENT TEMPLATE MUTATED AT NOTHING BUT THE IMAGE TAG** — so **CloudFormation LEARNS nothing**: there is no parameter, no SSM reference and no export, and a `planes-stack.ts` change somebody merged cannot ride along in a template CDK never produced. 🛑 **THE PROPERTY THAT MAKES IT SAFE IS MEASURED AND WAS LIVE BEFORE THE SLICE: the deployed `Planes` template is BYTE-IDENTICAL to `cdk synth … -c planeImageTag=<the tag it owns>`** — 32 resources, zero differing — so the retag yields exactly what CDK would have synthesised, and `tests/infra/pipeline-stack-value.test.mjs` §1 asserts that against two tags TYPED INTO THE TEST. ⚠️ **FOUR ALTERNATIVES ARE REFUSED ON THE FILE'S FACE**: a reinstated `CfnParameter` (silent by construction — the defect G1012 removed), an SSM dynamic reference (**measured: the probe would still report DRIFT**), a `cdk deploy` from the stage (blast radius; it would ship every merged `planes-stack.ts` edit unreviewed), and keeping the ECS deploy with a stack write after it (two rollouts, and the digest the first half pays for is discarded by the second). 🟢 **AND THE IAM NARROWED RATHER THAN WIDENED (G2046)**: the Deploy project loses `ecs:UpdateService`, `ecs:RegisterTaskDefinition` and `iam:PassRole` — the broadest grant this pipeline held — because CloudFormation does that work now, which is `0004`'s rule in the direction **G510** used it. ⚠️ **G262 IS PAID FOR DIFFERENTLY, NOT SPENT**: the stage writes a TAG (a digest would make every later `cdk diff` permanently dirty) and **refuses to write one the registry does not resolve to the digest the Build stage produced**, checked at the moment of use — strictly stronger than the ECR-immutability assumption it replaces. 🛑 **BUILT, NOT DEPLOYED, AND ONE PREMISE IS UNMEASURED (G2048)**: whether `UpdateStack` with no `--role-arn` needs `iam:PassRole` from the caller. **Of twelve synthesised stacks exactly ONE template moved — `reconcile-pipeline-staging`; `Planes` is byte-identical**, so G1012's expired-image hazard is not engaged and the deploy order does not change |
| **DEPLOYING, AND THE TRAPS THAT COST A DAY** | `docs/build/deploy-handoff.md` — written 18 Sep 2026 for an agent authorised to deploy. **⚠️ §12 is W2-B's: the `Observability` stack, built and NOT deployed, with the AWS-side sequence in order.** What is running in AWS, what is owed and in what order, **eight failures that passed `cdk synth` AND `npm run check` and then failed in CloudFormation**, and four questions answered by asking AWS rather than reasoning. ⚠️ **Read §1 before your first command: `AWS_PROFILE=crm-frontend`, because the CLI's `default` resolves to a DIFFERENT ACCOUNT** |
| **WHY AN UNAUTHENTICATED CALLER CAN HOLD THE WHOLE DATABASE POOL, AND WHAT A RATE-BASED WAF RULE DOES AND DOES NOT DO ABOUT IT** | `docs/build/d6-threat-model.md` §1.3/§4.5/D6-4 first — the arithmetic (`createAppPool(max = 10)`, `SERVING_TASKS_WHEN_UP.staging = 1`, zero rate limits measured three ways) — then `infra/lib/edge-certificate-stack.ts`'s `rateLimitWebAcl`, then `tests/infra/edge.test.mjs` §7. **G1871–G1875, 22 Sep 2026; G1871 is THE OWNER'S:** *"A CloudFront rate-limiting rule — D6's own recommendation, the best risk-removed-per-unit-work in the whole document."* 🛑 **READ THE HONESTY CLAUSE BEFORE THE RULE, BECAUSE THE RULE DOES NOT CLOSE WHAT IT SOUNDS LIKE IT CLOSES: A RATE-BASED RULE COUNTS REQUESTS OVER A TRAILING WINDOW OF AT LEAST 60 SECONDS (verified against the pinned `aws-cdk-lib@2.270.0` CloudFormation type — the 60/120/300/600 options, not the ~10s re-check cadence a person could mistake for the window). IT CANNOT BLOCK A FIRST BURST OF TEN CONCURRENT REQUESTS FROM ONE IP, OR OF ONE REQUEST EACH FROM TEN DIFFERENT IPS, AT ANY THRESHOLD.** It closes the SUSTAINED / REPEATED variant of the exposure (a script retrying the exhaustion every few seconds) and leaves the single-shot variant D6 measured exactly as open as before. **The companion D6-4's own table names — raising `RECONCILE_DB_POOL_MAX` and `SERVING_TASKS_WHEN_UP.staging`, "both, in that order" — is NOT taken here** and is owed as a separate ruling over `infra/lib/config.ts`'s serving capacity. 🛑 **THE THRESHOLD IS 300 REQUESTS PER 60-SECOND WINDOW, PER SOURCE IP, AND IT IS BLANKET RATHER THAN SCOPED TO THE TWO PUBLIC SIGN-IN OPERATIONS D6 ENUMERATES** — measured, not assumed: `server/data-plane/session.ts`'s `databaseReader()` opens the SAME pooled `withSessionScope()` read for ANY well-formed-looking (but forged) session cookie on `/v1/*` and `/context/*` too, before the row is found absent, so scoping to `/session/*` alone would leave the identical mechanic open with no credential required at all. ⚠️ **AGGREGATED BY IP AND NOT BY COOKIE PRESENCE, ARGUED RATHER THAN DEFAULTED**: a `ByteMatchStatement` could detect the cookie's PRESENCE but not its VALIDITY, and the pool is touched before validity is checked — exempting "cookied" traffic would hand an attacker a bypass for one arbitrary header. 🛑 **THE WEBACL LIVES IN `EdgeCertificateStack`, NOT `Edge`, AND THE STACK COUNT DOES NOT MOVE (still 11)** — `wafv2.CfnWebACL` with `Scope: CLOUDFRONT` must be created in `us-east-1`, the same region argument that already put the two viewer certificates there rather than beside the distributions that use them; the ARN crosses to `Edge` over the SAME `crossRegionReferences` bridge the certificates use. `assertRateLimitCoversEveryPlanePattern()` throws at synth if `EDGE_PLANE_PATH_PATTERNS` ever grows a pattern the rule's scope-down does not cover, on `edge-stack.ts`'s own `assertPublishesNoLocalOperation()` shape. ⚠️ **ONLY THE TENANT DISTRIBUTION CARRIES IT** — the console distribution has NO plane origin at all (`edge-stack.ts`: *"the control plane is still not an origin"*) and cannot touch the database pool through any request shape. 🛑 **MEASURED, NOT ASSUMED, ON EVERY OTHER STACK: `cdk synth` before and after this slice produced BYTE-IDENTICAL templates for `Planes`, `Network`, `Data`, `Storage`, `Observability`, `RunQueue`, `Identity`, `CiImage` and `Pipeline`** — only `EdgeCertificate` and `Edge` changed. ⚠️ **PRICING IS NAMED, NOT HIDDEN**: a new chargeable resource, roughly $5/month per web ACL plus ~$1/month per rule plus ~$0.60 per million requests inspected (AWS's own pricing page, not re-verified here) |

> ⚠️ **THIS TABLE HAD NO `design/`, NO `server/` AND NO `compose.yaml` ROW UNTIL
> 16 Aug 2026** — four rows added above. It is the same omission class as the
> layout block, arriving in the one place a reader goes when they do not know
> where to look. A "Where to read next" table that omits the application is worse
> than no table, because it reads as exhaustive.

> **All HTML visuals carry a staleness banner** (`ls docs/*.html | wc -l`).
> ⚠️ **This said *nine* until 12 Aug 2026, and the count is now TEN** — `docs/c4.html`
> landed, the C4 record of the four levels. It is the one visual here that is
> **generated rather than drawn**: its Level 3, Level 4 and built-schema sections
> are re-derived from `model/*.ts` and `db/migrations/*.sql` on every commit by
> `tools/planner/render-c4-page.mjs`, and `tools/check-c4-freshness.mjs` fails the
> gate when the committed copy disagrees with the tree. **Its Level 1 and Level 2
> are hand-authored and carry exactly the staleness risk this paragraph is about**,
> which is why the page states on its face which half is which.
> Read it before trusting the picture. `docs/HANDOFF.md` §7 records that a stale
> visual is the one artefact class that has *already* misled a reader here.
> ⚠️ **None of them shows the v1 trim**, so every one of them overstates what v1
> contains — `presentation.ts`'s dashboards are drawn as present and are dropped.

> ✅ **`docs/INDEX.md` was corrected on 7 Aug 2026** — it had said fourteen
> modules and thirty-four capabilities. It is sixteen and thirty-six. It also
> gained the three modules its table never listed and a `docs/contracts/` section
> it never had. **Run `node tools/check-doc-counts.mjs` before trusting a count in
> any document**, including this one: that run is what found this file's own
> reproduction block claiming 665 exports when the tree then said 675.
> ⚠️ **The two numbers in that narration are the 7 Aug values and are left as the
> history they are. At the tree on 10 Aug 2026 it is 18 modules and 37
> capabilities** — `ls model/*.ts | wc -l` and the `CAPABILITIES` awk above — **and
> `docs/INDEX.md` has since gone stale again on other counts**, which is the point
> the paragraph is making rather than an exception to it.

## Working practice

- **Cleanups are separate, isolated commits.** Never folded into feature work.
- **Plan before implementing** anything touching `model/access.ts`,
  `model/governance.ts`, `model/domain.ts` or the contracts — the blast radius is
  the whole model.
- **Delegate investigation** that spans more than five files.
- **Do not relitigate** a decision in `docs/HANDOFF.md` §3. Challenge it in
  writing, with the quote, or leave it alone.
- ⚠️ **~~Add CI when application code lands, or when a second person is
  committing — not before.~~ THE EXCEPTION WAS TAKEN, EXPLICITLY, ON 8 Aug 2026 —
  G95.** The position is kept here rather than deleted because its reasoning still
  governs how CI must land: *a red X on a repository containing no application
  teaches people to ignore CI*, which G95 answers with the condition that **the
  checks must be real from day one**. The triggers that fired: **G48** makes v1 a
  product; invariant 6 has **one enforcement running instead of two**, and both
  pack-publication validators need a call site that does not exist (`docs/HANDOFF.md`
  §8 item 8); and G76's `check-plane-tags.mjs` needs one too. **G110** then ruled
  the validators get **both** call sites — CI, and a publication seam that refuses
  — because a control that exists only in CI stops existing the moment a pack
  arrives by another route. **G108** rules that CI runs **`npm run check` and
  nothing else**.
  ✅ **CI IS BUILT.** ⚠️ **This read *"None of this is built. There is still no
  `.github/` on this branch, and `npm run check` does not yet run `npm test`."*
  All three clauses went false on 9 Aug 2026 and are corrected here rather than
  deleted.** `.github/workflows/check.yml` exists: `actions/checkout`,
  `actions/setup-node` reading `node-version-file: package.json`, then `npm ci`,
  then `npm run check` — **and no other step**. Its own header forbids adding one,
  and `tests/ci/gate.test.ts` fails if the file ever grows a second command.
  🛑 **EVERY SENTENCE OF THAT PARAGRAPH IS NOW FALSE AND THE LAST ONE IS
  INVERTED — G1331, 21 Sep 2026. IT IS CORRECTED RATHER THAN DELETED BECAUSE IT
  IS THE MOST ACTIONABLE CI SENTENCE ON THIS PAGE: it tells a reader a named
  test defends a named file, and both halves are wrong.** `.github/` is ABSENT
  (`ls -la .github`), so the file does not exist and cannot grow anything.
  **`tests/ci/gate.test.ts` DOES still govern it — in the opposite direction:
  it fails IF THE FILE EXISTS.** Its assertion is
  `assert.equal(existsSync(WORKFLOW), false, …)`, inside
  `test_the_github_actions_workflow_is_retired_and_the_pipeline_holds_its_property`,
  and its message tells the next author what to do instead: *"If it is back,
  either delete it or say here why two gates are now correct."*
  ⚠️ **SO A READER ACTING ON THE OLD SENTENCE WOULD HAVE RE-CREATED THE
  WORKFLOW AND TURNED THE GATE RED**, believing they were satisfying a control.
  ⚠️ **WHAT THE RETIREMENT BOUGHT, IN THAT TEST'S OWN WORDS**: the replacement
  was verified green first — *"`tests 1857, pass 1855, fail 0, skipped 0,
  todo 2`, with the skip census reporting 'no suite stood down on this run'"* —
  **strictly more than the workflow ever proved**, because its runner had
  neither PostgreSQL nor chromium. **And G239's runner-registration defect
  closes by construction: there is no self-hosted runner left to register.**
  🛑 **WHAT IS STILL OPEN, AND BE PRECISE ABOUT IT: G110 IS HALF DONE.**
  `tools/check-pack-safety.mjs` is *"G110's CI half"* by its own first line — it
  calls `validateProcedureInjectionSafety()` and `validateAgentToolBindings()`,
  the two validators that had no call site anywhere — ⚠️ **cited as
  `model/domain.ts:1522` and `model/agents.ts:924` until 19 Sep 2026, and BOTH
  still resolved; `model/domain.ts` has grown by thousands of lines since.
  Derive them: `grep -n 'export function validateProcedureInjectionSafety'
  model/domain.ts` and `grep -n 'export function validateAgentToolBindings'
  model/agents.ts`.** **The PUBLICATION SEAM half is not built and not
  started**, blocked on an `administration.openapi.yaml` that does not exist — so
  invariant 6 is **half** closed, not closed. ⚠️ **And the CI half proves less than
  it looks:** the checker's own header records that the tree's corpus is **empty** —
  all four packs in `model/examples.ts` carry `procedureTemplates: []` and nothing
  constructs an `AgentDefinition` — so on trunk it validates zero procedures and
  zero agents. It reports a `vacuous` finding rather than a clean pass, which is
  §5.6 handled instead of repeated. The **engine** is proven by the fixtures under
  `tests/ci/` that it rejects; the **tree** is proven by nothing, because there is
  nothing in it to prove. 🛑 **G76's `check-plane-tags.mjs` still does not exist**
  — `ls tools/*.mjs` returns **ten** files and that is not one of them.
  ⚠️ **This said *four* until 12 Aug 2026, *five* until 17 Aug 2026, *seven*
  until 22 Aug 2026 and *eight* until 19 Sep 2026 — FIVE wrong values in one
  sentence, and the *five* was already wrong when written**, because
  `citation-symbols.mjs` is a shared module rather than a checker and nothing
  counted it. `skip-census.mjs`, a reporter, is another. **The eighth was
  `check-g-numbers.mjs`; the ninth is `check-absent-rows.mjs` (G242) and the
  tenth is `check-capability-annotations.mjs` (G200's gate, 19 Sep 2026)** — all
  three ARE checkers and all three ARE in the gate — **so the checker count is
  eight, not six.** 🛑 **THE *six* WAS ALREADY ONE BEHIND WHEN IT WAS WRITTEN, on
  the same axis and for the same reason as every value before it: `check-absent-
  rows` landed and this sentence did not move.** The sentence's point is
  unchanged, and `check-doc-counts.mjs` governs none of these numbers because each
  sits away from its noun.

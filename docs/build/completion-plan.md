# Completing ReconcileAI — the build and the deploy

> **STATUS:** PLAN. Not an authority.
> **V1 AUTHORITY:** NO. `docs/HANDOFF.md` §3 outranks every sentence here, and
> `CLAUDE.md`'s numbered list of eleven is the only place the invariants are
> numbered. Where this page and either of those disagree, they win and this page
> is wrong.
> *Written 21 Sep 2026, against `origin/main` @ `248e3e85` plus the two repairs
> below.*

> 🛑 **READ THIS BEFORE THE PLAN, BECAUSE IT IS WHAT MAKES THE PLAN HONEST.**
> This page states TASKS and RULINGS separately and never merges them. A **TASK**
> is work: everything it needs exists and somebody has to write it. A **RULING**
> is a decision a person must take, and no amount of effort substitutes. The
> failure this separation exists to prevent is named in `deploy-handoff.md`'s
> section titled *"WHERE THE 20 Sep 2026 SESSION STOPPED — THE SECOND ONE, AND
> IT DEPLOYED"* §14.5: *"Each is a ruling rather than a task."* A session that
> reports a ruling as progress has reported progress it did not make.

> ⚠️ **EVERY COUNT ON THIS PAGE CARRIES THE COMMAND THAT REPRODUCES IT, AND NONE
> OF THEM SHOULD BE READ.** `docs/HANDOFF.md` §5.11 is the reason: a count is a
> fact about a tree, and a merge makes a new tree. Three separate figures in this
> record were wrong on the day they were written, and the one in `compose.yaml`'s
> entry was a third answer neither parent had computed.

---

## 1 · Derivations — run these before trusting anything below

```bash
node tools/check-doc-counts.mjs --derive        # 28 modules · 44 capabilities
                                                # 136 operations · 125 paths
ls db/migrations/*.sql db/migrations-control/*.sql | wc -l      # 34
git ls-files server | wc -l                                     # 64
ls infra/lib/*-stack.ts | wc -l                                 # 11
ls db/*-scope.ts | wc -l                                        #  5
grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md                       # 480 rows
grep -E  '^\| G[0-9]+ \|' docs/HANDOFF.md | grep -c '✅'        # 241 applied
node tools/served-set.mjs                                       # 30 of 136 served
```

✅ **BOTH OF THE DERIVATIONS THIS BLOCK USED TO CARRY FOR THE OPERATION COUNTS
WERE SELF-MEASURING, AND BOTH ARE REPAIRED — G2081–G2084, 23 Sep 2026. THE
PARAGRAPH BELOW IS KEPT WHOLE RATHER THAN REWRITTEN, because it was RIGHT and
because its last clause is the one this slice was commissioned against.** It
read:

> ⚠️ **`grep -c 'operationId:' docs/contracts/*.openapi.yaml` ANSWERS 137 AND IS
> WRONG.** The 137th is a PROSE line in `administration.openapi.yaml` quoting that
> very command. `check-doc-counts` parses and answers 136. This is G978's shape —
> a derivation measuring its own argument — and it appears at least four more times
> in this repository; each is named where it occurs below.

🛑 **THE CORPUS COMMAND NOW ANSWERS 136 — the prose line that was its 137th match
is gone from `administration.openapi.yaml` §8, which describes the command
instead of spelling it.** ⚠️ **AND THE LINE THIS BLOCK ITSELF HANDED OUT FOR THE
SERVED SET WAS THE SECOND INSTANCE AND WAS WRONG TWICE OVER.** It counted a block
comment in `server/data-plane/start.ts` that quoted it — **and the handler key
occurs once per TIER MOUNT rather than once per operation, so no reading of it
could ever have reached 30.** The `# 26 of 136` written beside it here was
counted by eye; `CLAUDE.md` said 23, `deploy-handoff.md` said 25, and a
circulated summary on 23 Sep ran both commands faithfully and reported **"29 /
137 operations served"** — wrong in both figures, and undercounting its own
wave's work. `tools/served-set.mjs` parses the contracts, strips comments and
reads ES6 shorthand.

🛑 **AND *"at least four more times"* WAS AN ORDER OF MAGNITUDE LOW, which is
what a landmark costs when it is counted by hand. `tools/check-self-measuring-
derivations.mjs` is the gate; its first run against this tree reported
EIGHTY-THREE.** Three are repaired, the rest are inventoried in that file's
census — red in both directions, so the class cannot grow and the register
cannot rot. Derive it: `node tools/check-self-measuring-derivations.mjs`.

**The pack's own numbers, and the honest derivation:**

```bash
grep -ohE '<td[^>]*>(built|specified|partial|not built)</td>' \
  'docs/handoff-pack/Functional Specification.dc.html' | wc -l      # 359 CELLS
```

🛑 **THAT COMMAND IS §5.1 AND ITS ANSWER IS WRONG IN TWO WAYS.** It keys on the
landmark `<td>status</td>` rather than on the property *is this a feature row*,
and the file is **malformed at line 87** — a spliced edit left `</tr>ing`
mid-cell, so **`S1 · Staff console` carries BOTH `built` AND `specified`**. A
browser hoists the orphan out of the table and a human sees one status; every
grep-based reader sees a phantom. A well-formed `<table>`→`<tr>` walk yields
**358 rows carrying 359 cells**, across **seven different table kinds**, of which
only **315 are feature rows**. **`specified` is 50, not 51**, and every document
quoting 51 — `CLAUDE.md` included — is quoting the ghost.

> ✅ **THE MALFORMATION IS REPAIRED — G1333, 21 Sep 2026 — AND THE PARAGRAPH
> ABOVE IS KEPT WHOLE RATHER THAN REWRITTEN, because its `specified is 50, not
> 51` is the finding this slice acted on and it was RIGHT.** ⚠️ **ITS OTHER
> THREE FIGURES DO NOT REPRODUCE AND ARE NOT ADOPTED ANYWHERE.** A
> `<table>`→`<tr>` walk of the repaired file answers **386 rows in tbodies**, of
> which **363 carry a status cell**, across **NINE distinct column shapes** —
> not 358 / 359 / seven — and the **315 feature rows** figure is reproducible
> only by counting the 39 tables shaped `Feature | Behaviour | Status` and
> excluding the role, surface, write-guard, console, control and property
> tables, which the sentence does not say. **Derive it; do not read any of
> these:** walk `<table>` then `<tr>`, and count `refused` as well — the
> four-word grep never saw the **5 `refused` rows** at all.
>
> 🛑 **AND §7's `#N` ROW NUMBERING DOES NOT REPRODUCE EITHER, WHICH IS THE ONE
> THAT COULD COST A SLICE.** Under an index over non-`built` rows in document
> order, this page's `#4`, `#12`, `#13`, `#15`, `#45` and `#72` land on exactly
> the rows it describes — and `#93`, `#96`, `#97`, `#101`, `#104` and `#113`
> land **two short**, on entirely different rows. (`#96` here is
> `Conversion is an act`; the H2 row this page means is `Onboarding state in
> the model`.) **A build agent taking `#96` at face value annotates the wrong
> row.** No consistent rule reproduces the offset, so **the numbers are not
> swept to better numbers**: the rows are identified BY NAME in the pack, and
> by name is how the annotations landed. *Recorded 21 Sep 2026 — G1345.*

**Remaining pack surface: 116 real rows, ~113 of them features.**

---

## 2 · The state, in one table

| | | derive it |
|---|---|---|
| operations declared | **136** across 125 paths | `node tools/check-doc-counts.mjs --derive` |
| operations **served** | **30** | `node tools/served-set.mjs` — ⚠️ **said 26, from a grep that counted its own quotation AND answered once per tier mount rather than once per operation; G2081/G2083, 23 Sep 2026** |
| capabilities | 44, of which **21 are named by no operation at all** | `grep -rhoE '^ *x-capability: [a-z_]+$' docs/contracts/*.openapi.yaml \| sed 's/.*: //' \| sort -u \| wc -l` |
| frontend routes drawn | **3 of 12** | `grep -cE "^    '/[^']*': \(" frontend/src/main.tsx` |
| top-level AWS stacks deployed | **11** | `AWS_PROFILE=crm-frontend aws cloudformation list-stacks --region us-west-2 --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query 'StackSummaries[?starts_with(StackName,\`reconcile\`) && ParentId==null].StackName'` |
| can anyone sign in? | **no** | nothing mints a session |
| does the engine execute? | **no** | nothing in `server/` produces an `ExtractedValue` |
| does the queue drain? | **no** | `sqs:ReceiveMessage` is granted to nobody |
| does anything page a human? | **no** | ⚠️ since G1811 (22 Sep 2026) the alarm topic has one PLACEHOLDER email subscription, `PendingConfirmation` — SNS cannot auto-confirm an email endpoint and the address is not a real inbox, so the answer is unchanged |

> ⚠️ **THE TABLE ABOVE IS THE 21 Sep 2026 SNAPSHOT AND FIVE OF ITS NINE ANSWERS
> ARE FALSE AT `caf66abe` (3 Oct 2026). IT IS KEPT AS IT STOOD, AND THE CURRENT
> ANSWERS ARE HERE — G3604.** Derive each one, never read it:
>
> | | at `caf66abe` | derive it |
> |---|---|---|
> | operations declared | **149** across 137 paths | `node tools/check-doc-counts.mjs --derive` |
> | operations **served** | **51 of 149** | `node tools/served-set.mjs \| tail -1` |
> | capabilities named by an operation | **32** of 50 | the `x-capability` grep in the first table |
> | frontend | **12 screens** of **19 routes** | `grep -cE "^    '/[^']*': \(" frontend/src/main.tsx` · the `ROUTE_PATHS` awk in `CLAUDE.md` |
> | top-level AWS stacks in `us-west-2` | **11** (plus `EdgeCertificate` in `us-east-1`) | the `list-stacks` command in the first table |
> | can anyone sign in? | **yes, on staging** — 13 mock personas, a public test login the owner accepted (G2771, G2996) | `MOCK_PERSONAS.length` in `infra/lib/mock-personas.ts` |
> | does the engine execute? | **yes** — `server/data-plane/run-executor.ts` (E5) | — |
> | does the queue drain? | **yes** — the `reconcile-staging-run-worker` rule is ENABLED (R-W) | `aws events list-rules --name-prefix reconcile` |
> | does anything page a human? | **no** — unchanged, G1811 | — |
>
> ⚠️ **AND THAT BLOCK IS THE 3 Oct 2026 ANSWER AT `caf66abe`. IT IS KEPT AS IT
> STOOD; THE 4 Oct 2026 ANSWERS AT `b2563cab` ARE HERE — G4121.** Derive each:
>
> | | at `b2563cab` | derive it |
> |---|---|---|
> | operations declared | **150** across 138 paths | `node tools/check-doc-counts.mjs --derive` |
> | operations **served** | **52 of 150** — the one added is `listDocumentTypes` (#580) | `node tools/served-set.mjs \| tail -1` |
> | capabilities named by an operation | **33** of 51 — `view_run` is the new one (G3881) | the `x-capability` grep in the first table |
> | frontend | **12 screens** of **19 routes** (unchanged) | as above |
> | top-level AWS stacks in `us-west-2` | **12** | the `list-stacks` command in the first table |
> | what staging runs | **`b2563cab`** — both planes and the run worker, measured (G4122) | `aws codepipeline list-pipeline-executions --pipeline-name reconcile-staging` |
> | does the engine raise exceptions on staging? | **yes** — the run worker connects as `reconcile_engine` (G3749, deployed) | the run worker's task definition secrets |
> | do the database role secrets rotate? | **scheduled, never yet** — five secrets on `cron(0 23 ? * MON *)`, `LastRotatedDate None` | `aws secretsmanager list-secrets` |
> | does a demo lead reach the CRM? | **no** — the PipelinePulse token is missing and the DLQ holds leads (G4123) | `docs/build/deploy-handoff.md` §27 |
> | does anything page a human? | **no** — unchanged, G1811 | — |
>
> ⚠️ **AND THAT BLOCK IS THE 4 Oct 2026 ANSWER AT `b2563cab`. IT IS KEPT AS IT
> STOOD; THE 7 Oct 2026 ANSWERS AT `d626275e` ARE HERE — G4461.** Derive each:
>
> | | at `d626275e` | derive it |
> |---|---|---|
> | operations declared | **154** across 142 paths | `node tools/check-doc-counts.mjs --derive` |
> | operations **served** | **56 of 154** — the four added are the control plane's internal tier | `node tools/served-set.mjs \| tail -1` |
> | migrations | **73** across two directories | `ls db/migrations/*.sql db/migrations-control/*.sql \| wc -l` |
> | what staging runs | **`d626275e`** — data 2/2, control 1/1, measured (G4462) | `aws codepipeline list-pipeline-executions --pipeline-name reconcile-staging` |
> | does the data plane hold a control-DB credential? | **no** — 0 `CONTROL_READ`/`CONTROL_WRITE` variables or secrets in its task definition (G4462) | `aws ecs describe-task-definition` |
> | do the database role secrets rotate? | **three of four** — `controlapp` is refused every time (G4463) | `aws secretsmanager list-secrets` |
> | does a demo lead reach the CRM? | **no** — the DLQ holds 4 (G4462) | `docs/build/deploy-handoff.md` §27 |
> | does anything page a human? | **no** — unchanged, G1811 | — |

---

## 3 · What landed on 21 Sep 2026, before this plan

Two repairs, both on `fix/gate-terminates-and-clock-fixture`, gate EXIT 0.

**`d91f2d13` — G1287/G1288, and it outranks everything else in this document.**
`tests/e2e/browser-login.test.ts` launched chromium at module scope and
registered `closeBrowser()` only inside `describe(…, { skip })`. With a browser
and no database the teardown was never registered and **`npm test` never
terminated**. `tools/skip-census.mjs` sets its exit code on `test:summary`, so a
run that never ends never fails — **CI would have reported a BUILD TIMEOUT,
which reads as flake and gets retried.** That is PR #257's merge-button problem
arriving through the three controls written to prevent it.

| condition | before | after |
|---|---|---|
| no DB, no `CI` | never terminated | EXIT 0, 97s, census prints *"56 suites stood down, taking at least 639 assertions"* |
| no DB, `CI=1` | never terminated | **EXIT 1, 57 guard failures** |
| DB present | EXIT 0 | EXIT 0 · 3306 · 0 fail · 0 skipped · 2 todo |

**`15fcd10e` — G1208/G1209**, cherry-picked. A local SQS-compatible service
(the earlier refusal rested on a `docker pull` timeout that later succeeded — *a
refusal resting on a stopwatch*), and a fixture that mixed the database clock
with a frozen `NOW` and **had already flipped on 2026-09-20T12:00Z**.

---

## 4 · The rulings register — this gates the whole plan

**Two were taken on 21 Sep 2026 and are recorded here as the owner's:**

| | Ruling | Consequence |
|---|---|---|
| **R-W** | **The run-queue worker runs as a SCHEDULED ECS TASK.** | Needs **no `server/` change** — `run-worker-main.ts` is already one-message-and-exit — and **no `Planes` deploy**, so G1012's expired-image hazard is not engaged. Precedent: `Planes` already holds migrate task definitions no service runs. Cost accepted: one poll period of latency. |
| **R-P** | **The first `platform_role_assignment` is written by a SEED behind the local test flag**, following `server/dev/identity-seed.ts`. | Unblocks local and e2e console work. ⚠️ **Deployed staging still has no console principal**, so every console operation there remains unreachable. That is a second ruling when staging needs one. |

**FOUR MORE WERE TAKEN ON 21 Sep 2026 AND ARE RECORDED HERE AS THE OWNER'S.**
⚠️ **They are recorded, not applied.** Each names the slice that applies it; a row
recording a ruling as applied before its slice lands is the disagreement G286 was
ruled on.

| | Ruling | Consequence |
|---|---|---|
| **R8** | **Annotate the three onboarding operations IN PLACE as `x-capability: view_substrate` on the administration tier.** | **G911 created the third option G781 never had** — it retired `TIER_REQUIRES_CAPABILITY`, so a gated operation on that tier is now representable and this is **less surgery than another contract split.** `view_substrate` is class `substrate`, which G601 minted platform-only and `PLATFORM_ASSIGNMENT_REACHES` opens. Unblocks **C-1, C-2, C-3**. |
| **R9** | **YES — the data plane may hold a WRITING credential for the control database**, via a **sixth scope helper and a second control-database role**. | Unblocks **C-2/C-3**. **Two costs accepted by name, and both are obligations rather than footnotes:** `tests/db/control-plane-census.test.ts` §A goes **RED BY DESIGN** and must be deliberately re-argued at its own site, not loosened quietly; and **`onboarding_record` has NO trigger** — nothing in SQL stops `completed_steps` going DOWN and a `CHECK` cannot express it (it needs OLD and NEW), so the slice granting `UPDATE (completed_steps)` **owes a `BEFORE UPDATE` trigger** on `0059`'s precedent or it spends a property and replaces it with nothing. |
| **R11** | **`DocumentType` gets ITS OWN TENANT TABLE, one row per document type.** | Unblocks **E3**. It gives `expectedFidelity` and `carriesControlTotal` a home the engine reads **per document** rather than per definition — keying them to the definition lets **two definitions referencing one document type disagree about its fidelity**, which is invariant 4's *"declared once"* failing one level up. ⚠️ **Cost accepted: the WRITER IS OWED** — no contract operation on any of the seven tiers authors a document type, so it is `SELECT` only and a `GRANT INSERT` would be `0004`'s *"a write privilege ahead of its writer."* |
| **R12** | **Build extraction for `structured` and `tabular` ONLY. G7 and G8 are NOT taken.** | Those two cross no managed-service boundary and are pure TASKs. **Key the producer on a total `Record` `FIDELITY_CROSSES_MANAGED_SERVICE` — never on a list of fidelity names** (§5.1) — so `digital_text` and `scanned` refuse at a **compile-checked** seam until G7/G8 are ruled. ⚠️ **G7 and G8 remain `not applied` and invariant 7 still has nothing to enforce against on the OCR path.** Nothing here weakens that; it fences it. |

**AND FOUR MORE WERE TAKEN LATER ON 21 Sep 2026, AFTER THE FIRST WAVE'S
FINDINGS.** ⚠️ **Recorded, not applied** — each names the slice that applies it.

| | Ruling | Consequence |
|---|---|---|
| **R5** | **A person is AUTO-PROVISIONED ON FIRST SIGN-IN.** | Unblocks **S1**, therefore **S3**. 🛑 **It needs `GRANT INSERT` on `tenant."user"` — a request path that can MINT A PERSON, and it is the largest write privilege this schema has ever granted.** `0009` gave the app role `SELECT` and nothing else on all eight identity tables; its argument was about `role_assignment`, so this is not refused by it and **is not licensed by it either.** The fence is the slice: `INSERT` only (no `UPDATE` — a path that could update a person could flip `status` from `disabled` to `active`, deleting `0009`'s deliberate *"a disabled person must be VISIBLE so the model can refuse them BY NAME"*), a RESTRICTIVE `WITH CHECK` with **no `USING`** (G449's measured non-recursion, `0020`'s precedent), minted **only inside `withSignInScope()`**, and `orgClass` from `orgFor(connection.owner)` and never from the token. |
| **R6** | **The claim map is PER-CONNECTION, as TYPED COLUMNS on `tenant.identity_connection`** — never `jsonb`. | Unblocks **S1**'s non-`sub` columns. It **answers G306's objection rather than sidestepping it**: that row refused a `jsonb` column here as *"that ruling taken by a migration, quietly."* **Per-connection because BYOA (G276) puts the pool in the CUSTOMER'S account, where we do not control the claim names** — fixed standard-claim columns would make a non-standard broker unonboardable without a migration. ⚠️ Cost accepted: two more columns on a `SELECT`-only table with no authoring surface, so the values arrive by migrator. |
| **R4** | **G315 MOVES.** The callback takes the shape `infra/lib/config.ts` already synthesises; `auth.{region}.reconcileai.app/callback` is withdrawn. | **This resolves a contradiction that was live IN THE TREE**: G315 ruled one shape and `infra/lib/config.ts` **refuses that shape BY NAME as rejected alternative (b)**. The code's argument is taken because somebody reasoned about it after the ruling and wrote it down. **G315 is AMENDED IN PLACE with the original preserved** — G60's precedent, the first invariant reversal in this record. 🛑 **IT DOES NOT UNBLOCK S5: R3 — where the auth host runs — IS STILL OPEN.** ⚠️ **And it owes a re-check nobody has done**: G297 won residency at the TLS handshake for tenant hosts, and a callback on a console/partner host sits outside that grammar. |
| **R-K6** | **Success bodies STOP `$ref`-ing `errors.yaml`.** Each carries its own closed enum; `bundle.ts` is NOT changed and its refusal of external pointers stands. | Closes K6's finding (G1573/G1574): **seven MOUNTED operations publish a success body that reaches no serialiser at all**, because the `$ref` is external, `bundle.ts` refuses it, and Fastify falls back to `JSON.stringify`. 🛑 **THE ACCEPTED COST IS A SECOND HOME FOR AN 88-MEMBER VOCABULARY, WHICH IS `0002`'s THIRD-PLACE-TO-DRIFT** — and `0008`'s precedent is the only thing that makes such a copy a MIRROR instead: *"a test asserting set equality … in BOTH directions."* **Without that test in the same commit, this ruling is not applied — it has started the drift.** ⚠️ And serialising is not the same as being correct: K6 measured that a required `string` given `null` publishes as `""` and a wrong type coerces silently, both invisible from outside. |

**AND FOUR MORE WERE TAKEN ON 22 Sep 2026 — TWO CLOSE LIVE FINDINGS FROM
THIS WAVE, TWO CLOSE OPEN RULINGS.** ⚠️ **Recorded, not applied** — each
names the slice that applies it.

| | Ruling | Consequence |
|---|---|---|
| **R14** | **A PLACEHOLDER email is subscribed to the alarm topic**, unmistakably fake and mechanically provable as such (a fixed marker string a test asserts on), and it must be replaced before production. | Closes the register's R14. 🔴 **G1062's own test PINS THE ZERO SUBSCRIPTION COUNT and must be DELETED ON PURPOSE** by the slice that subscribes — done deliberately, not silently, and replaced by a marker assertion so a real address later, or a forgotten placeholder, is each independently catchable. |
| **R-REV** | **The resolution-reversal window is 24 HOURS, matching the pack's drawn design.** | Closes the pack–tree join's G1733 finding: `reverseResolution` is MOUNTED AND SERVING TODAY WITH NO TIME LIMIT AT ALL — no constant, column, check or contract field enforces the window the pack draws. 🔴 **Cost accepted: a new closed-vocabulary refusal code, and a measured decision on WHERE the check lives** — the S1 slice found that a `user` policy subquerying `identity_connection` caused INFINITE RECURSION; a `WITH CHECK` subquerying `tenant.exception` from `tenant.exception_reversal` owes the same measurement before it is trusted. |
| **R-VIS** | **`RUN_QUEUE_VISIBILITY_SECONDS` is RAISED to a generous ceiling** (the plan's own 15–30 minute range), not heartbeated from the worker. | Closes a finding from BOTH the D-1 and E4/E5/E6 slices: at 30 seconds, a run in flight is REDELIVERED and executed CONCURRENTLY, and after five deliveries a run that SUCCEEDED EVERY TIME lands on the DLQ — inverting the alarm. ⚠️ **Named as a policy choice bounded by nothing measured**: §10 item 5 is still open (no real corpus exists to time a real run against), so the ceiling is chosen, not derived. The DLQ triage E5/E6 already built (resolve against `run_engine_account`) stays as the SECOND line of defence, unmodified. |
| **R-D6-4** | **A CloudFront/WAF rate-limiting rule** — D6's own recommendation, *"the best risk-removed-per-unit-work in the whole document."* | Closes D6's pool-exhaustion finding: `createAppPool(max = 10)`, no `RECONCILE_DB_POOL_MAX`, one serving task, NO rate limit anywhere — ten concurrent anonymous requests can hold the ENTIRE data plane's database capacity, live on deployed staging today. 🔴 **A WAF rate-based rule counts requests over a sliding WINDOW; the measured exposure is about CONCURRENCY.** Whether the chosen mechanism actually closes the concurrent-connection exposure, or only a related slower one, is the slice's to measure and state honestly — not to claim by building the ruling's letter. |

**AND THE SIGN-IN CLUSTER WAS TAKEN ON 25 Sep 2026 — R2, R3 AND R7.**
⚠️ **Recorded, not applied.** 🛑 **AND THEY DO NOT UNBLOCK A MOUNT: R1 — the D6
threat model's ten numbered decisions — IS STILL OPEN**, and S6 is blocked on
it. What these three unblock is S4, S5 and S2's unreachable arms.

| | Ruling | Consequence |
|---|---|---|
| **R2** | **The JWKS is fetched ONCE AT BOOT and cached in memory. No runtime egress.** | Unblocks **S4**. 🛑 **It keeps `fetch(` OFF THE REQUEST PATH, which is the property the existing controls actually protect** — `tests/http/console-roster-unreachable.test.ts` §1c asserts the emptiness over both plane directories, and that assertion must now be re-argued rather than deleted: it becomes *no fetch on a request path*, not *no fetch at all*. ⚠️ **Two costs accepted: a key rotation needs a RESTART, and boot now depends on the IdP being reachable** — so a Cognito outage becomes a FAILED DEPLOY rather than a degraded service. That is the fail-closed direction and it is chosen, not stumbled into. |
| **R3** | **The code exchange is a STATELESS exchange inside the EXISTING data plane.** No third process, no new stack, no new network. | Unblocks **S5**. It is D6's own recommendation, on the ground that **G340's refusal makes a RESOLVING auth host data-plane-shaped anyway** — so a separate process would resolve nothing and still need the data plane's reach. 🛑 **THE COST IS THE ONE R1 IS ABOUT: the data plane gains the product's FIRST PUBLIC UNAUTHENTICATED ENDPOINTS**, and D6 measured that ten concurrent anonymous requests already exhaust its connection pool (R-D6-4 closed only the sustained variant). **R3 and R1 are one decision in practice and only one of them has been taken.** |
| **R7** | **Session bounds are a PLATFORM-WIDE CONSTANT. No per-tenant override.** | Unblocks **S2's 503 arms**, which have been unreachable because `PLATFORM_SESSION_CEILING` had no store and no reader. The ceiling becomes a property of the PRODUCT rather than a value a tenant can widen — so no migration, no column, no restrictive policy, and nothing for a tenant scope to write. ⚠️ **Cost accepted and it will be asked about: a customer cannot TIGHTEN it either.** |

**AND SEVEN MORE WERE TAKEN ON 1 Oct 2026 — `docs/HANDOFF.md` G2441–G2447,
THE OWNER'S.** ⚠️ **Two are DECLINES and are applied in the commit that
recorded them; the other five are recorded, not applied**, and four of those
are being built by their own slices on their own branches.

| | Ruling | Consequence |
|---|---|---|
| **R15** | **No account-wide AWS Config recorder.** Tag enforcement stays the synth-time tagging Aspect plus its tests. | **Applied as a decline (G2441).** G260's *"enforced twice"* is retired, not deferred: **no AWS Config rule exists in this app, by decision, and none is owed.** **D-5 is closed as declined.** ⚠️ Cost accepted: a resource created outside CDK — the console, the CLI — is checked by nothing. `tests/infra/observability.test.mjs` §8 (no `AWS::Config::ConfigRule` anywhere) now records the decision rather than waiting for a recorder. |
| **R16** | **Decline every `specified` pack row that is a ruling** (§7). | **Applied (G2442, G2448).** Eleven rows move to `refused` in `docs/handoff-pack/Functional Specification.dc.html`, each with its reason on the row: the ten `specified` rows §7 names, plus `Waived knowingly`, the `not built` copy of the one-person-finance-team decision. ⚠️ **§7 says "nine" and the list resolves to eleven rows by name** — G2448. |
| **R-EGRESS** | **Request-path egress: yes, bounded — exactly ONE file (`server/data-plane/code-exchange.ts`) may POST, to the PINNED connection's token endpoint only, with a short timeout, outside any database transaction.** | Answers the one question S5 raised (G2151). **Recorded, not applied (G2443)**: the slice that replaces `unauthorisedEgressTransport()` owes all four bounds as assertions, and the fourth is the one D6's pool arithmetic makes decisive. |
| **R-SCALE** | **The Deploy stage scales up first.** | Answers `docs/build/deploy-handoff.md` §19's *"should the scale-down yield to a deploy?"* — the second of its three shapes. **Recorded, not applied (G2444)**: applied by its own slice, `feat/deploy-scales-up`. |
| **R10** | **Partner role tables, plus a fifth `decide()` arm.** | Unblocks the 24 partner-portal operations. **Recorded, not applied (G2445)**: applied by its own slice, `feat/r10-partner-principal`. Invariant 2's one cross-tenant path does not widen. |
| **R13** | **Persist allocation ids only.** | The pairing's identity is stored, the counterparty-derived join keys are not — invariant 6's line. **Recorded, not applied (G2446)**: applied by its own slice, `feat/r13-allocations`. |
| **R-C9** | **C9 credential custody: AWS Secrets Manager, one secret per source, encrypted with the per-tenant KMS key.** | The custody ruling W5 says C9's TASK rows need first. **Recorded, not applied (G2447)**: applied by its own slice, `feat/c9-credential-custody`. ⚠️ It moves none of the three constants that govern `secret` reach. |

**Open, and each blocks what is named:**

| | Ruling | Who | Blocks |
|---|---|---|---|
| **R1** | **The D6 threat model (G165).** These would be the product's **first public unauthenticated endpoints**. ✅ **THE ANALYSIS EXISTS SINCE 21 Sep 2026 — `docs/build/d6-threat-model.md`, G1701–G1712 — AND R1 IS STILL OPEN**, because the analysis is work and the acceptance is the owner's. It puts **TEN numbered decisions** (D6-1 … D6-10) with costs and recommendations — **six cheap, two expensive, two cheap to decide and expensive to get wrong** — and **D6-1 is R1 itself.** Derive it, never read it: `grep -cE '^### D6-[0-9]+ ·' docs/build/d6-threat-model.md`. ⚠️ **The public surface is EXACTLY TWO operations, not "S6–S8"** — `resolveHomeRealm` and `completeFederatedSignIn`, derived with a YAML parser (G1701). | Owner | ALL of sign-in's mounts (S6–S8) |
| **R2** | **The JWKS source and the egress posture.** Cached how, refreshed when, over whose egress — and whether a new pinned dependency is taken. | Owner | S4, therefore S6 |  ✅ **TAKEN 25 Sep 2026 — THE OWNER'S. See the register above. Kept rather than deleted, because it is the blocker as it stood.**
| **R3** | **Where the regional auth host runs.** Exactly R-W's shape: a process with no home. | Owner | S5 |  ✅ **TAKEN 25 Sep 2026 — THE OWNER'S. See the register above. Kept rather than deleted, because it is the blocker as it stood.**
| **R4** | **G315 versus `infra/`, and they contradict each other in the tree.** G315 rules `auth.{region}.reconcileai.app/callback`; `infra/lib/config.ts` **refuses that shape by name** as rejected alternative (b) and synthesises console/partner callback URLs instead. One must move. | Owner | S5 |  ✅ **TAKEN 21 Sep 2026 — see the owner's register above. This row is the BLOCKER AS IT STOOD and is kept rather than deleted.**  ✅ **TAKEN 21 Sep 2026 — THE OWNER'S. See the register above for the ruling and the slice that applies it. This row is the BLOCKER AS IT STOOD and is kept rather than deleted, because it is the sentence a reader would have quoted onward.**
| **R5** | **Is a person provisioned on first sign-in, or before it?** Auto-provisioning needs `GRANT INSERT` on `tenant."user"` — a path that can mint a person. | Owner | S1's grants |  ✅ **TAKEN 21 Sep 2026 — see the owner's register above. This row is the BLOCKER AS IT STOOD and is kept rather than deleted.**  ✅ **TAKEN 21 Sep 2026 — THE OWNER'S. See the register above for the ruling and the slice that applies it. This row is the BLOCKER AS IT STOOD and is kept rather than deleted, because it is the sentence a reader would have quoted onward.**
| **R6** | **The claim map** — which token claim is the email, which the display name. G306 refused a `jsonb` column as *"that ruling taken by a migration, quietly"*. | Owner | S1's non-`sub` columns |  ✅ **TAKEN 21 Sep 2026 — see the owner's register above. This row is the BLOCKER AS IT STOOD and is kept rather than deleted.**  ✅ **TAKEN 21 Sep 2026 — THE OWNER'S. See the register above for the ruling and the slice that applies it. This row is the BLOCKER AS IT STOOD and is kept rather than deleted, because it is the sentence a reader would have quoted onward.**
| **R7** | **Where session bounds are configured**, per-tenant or platform-wide. `PLATFORM_SESSION_CEILING` exists with no store and no reader. | Owner | S2's 503 arms being reachable |  ✅ **TAKEN 25 Sep 2026 — THE OWNER'S. See the register above. Kept rather than deleted, because it is the blocker as it stood.**
| **R8** | **The console gate verdict.** The three onboarding operations are `x-capability: 'exempt: …'` on a tier whose caller is a PERSON. **G911 created a third option G781 never had**: a gated operation on the administration tier is now representable, so `x-capability: view_substrate` in place is less surgery than another contract split. Either way it is an authorisation decision. | Owner | C-1, C-2, C-3 |  ✅ **TAKEN 21 Sep 2026 — see the owner's register above. This row is the BLOCKER AS IT STOOD and is kept rather than deleted, because it is the sentence a reader would have quoted onward.**  ✅ **TAKEN 21 Sep 2026 — THE OWNER'S. See the register above for the ruling and the slice that applies it. This row is the BLOCKER AS IT STOOD and is kept rather than deleted, because it is the sentence a reader would have quoted onward.**
| **R9** | **May the data plane hold a WRITING credential for the control database?** `withControlReadScope()` issues `BEGIN READ ONLY`, witnessed red against a role deliberately granted `INSERT`. A writer needs a **sixth scope helper and a second control-database role**, and `tests/db/control-plane-census.test.ts` §A goes red **by design**. | Owner | C-2, C-3 |  ✅ **TAKEN 21 Sep 2026 — see the owner's register above. This row is the BLOCKER AS IT STOOD and is kept rather than deleted, because it is the sentence a reader would have quoted onward.**  ✅ **TAKEN 21 Sep 2026 — THE OWNER'S. See the register above for the ruling and the slice that applies it. This row is the BLOCKER AS IT STOOD and is kept rather than deleted, because it is the sentence a reader would have quoted onward.**
| **R10** | **The partner-portal principal, in three parts:** the authority instrument (no partner staff roster exists in either database), the taxonomy (a deal registration, a sandbox, a partner's own staff list match **none** of the thirteen resource classes), and whether `decide()` gets a fifth arm. | Owner | all 24 partner operations | ✅ **TAKEN 1 Oct 2026 — THE OWNER'S (G2445): partner role tables plus a fifth `decide()` arm. Recorded, not applied — applied by its own slice. See the register above. ✅ **AND THE MODEL-AND-SUBSTRATE HALF IS APPLIED, 1 Oct 2026 — G2321–G2327 (#507): `0250_partner_role.sql`, a fifth `decide()` arm and three partner-only classes; the 24 mounts are NOT, and *W5 · partner portal* below says which are still table-blocked. §5.11: the register (G2445) and the slice (G2321) recorded R10 on two branches; both are kept — G2531.** This row is the BLOCKER AS IT STOOD and is kept rather than deleted.**
| ~~**R11**~~ | ✅ **TAKEN 21 Sep 2026 — THE OWNER'S: *"`DocumentType` gets its own tenant table, one row per document type."*** Applied as `db/migrations/0180_document_type_and_control_total.sql` (G1401–G1405). ⚠️ **It HOMES the declaration and does not CLOSE the drift**: `0160`'s `definition_population.carries_control_total` is not dropped (G88 is forward-only and the field is still REQUIRED on `SetReconciliationInput`), so **two columns spell one declaration** — pinned at an assertion so the DP-2 commit deletes it on purpose, with the obligation on E4 to read the TYPE and never the definition's copy. | Owner | ~~E3~~ — **done** |
| **R12** | **G7 and G8**, both `not applied` — the `managed_service_use` policy kind and the AWS AI-services opt-out verdict. Without them invariant 7 has nothing to enforce against on the OCR path. | Owner | extraction for `digital_text` and `scanned` only |  ✅ **TAKEN 21 Sep 2026 — THE OWNER'S. See the register above for the ruling and the slice that applies it. This row is the BLOCKER AS IT STOOD and is kept rather than deleted, because it is the sentence a reader would have quoted onward.**
| **R13** | **Is a matched pair a publishable artefact?** `MatchingState` has no storage anywhere. **The product will persist what did NOT match and never what did**, so a screen can show residue and never the pairing that explains an exception. `Allocation` carries counterparty-derived join keys, so publishing engages invariant 6. | Owner | the explain-an-exception surface | ✅ **TAKEN 1 Oct 2026 — THE OWNER'S (G2446): persist allocation ids only. Recorded, not applied — applied by its own slice. See the register above. ✅ **AND APPLIED, 1 Oct 2026 — G2371–G2374 (#503): `db/migrations/0260_run_allocation.sql` is the storage and `listRunAllocations` the read; *"Persist ids only … Invariant 6 held by absence."* §5.11: the register (G2446) and the slice (G2371) each recorded R13 on a different branch; both are kept — G2531.** This row is the BLOCKER AS IT STOOD and is kept rather than deleted.**
| ~~**R14**~~ | ✅ **TAKEN 22 Sep 2026 — THE OWNER'S: *"Use a placeholder email address that must be replaced before production."*** Applied as `infra/lib/observability-stack.ts` §1 + `infra/lib/config.ts`'s `ALARM_SUBSCRIBER_EMAIL_PLACEHOLDER` (G1811–G1813). The alarm topic gains exactly ONE `sns.Subscription` (email protocol), no Lambda, no webhook, no second topic. ⚠️ **THE PLACEHOLDER PAGES NOBODY, AND THAT IS UNCHANGED FROM BEFORE THIS RULING**: SNS cannot auto-confirm an email subscription, so it sits `PendingConfirmation` until an inbox at that address clicks the confirmation link, and this address is not a real inbox. What is closed is the DISTANCE to a real pager — one click, not a code change — and the marker `PLACEHOLDER-REPLACE-BEFORE-PRODUCTION` is asserted present on the endpoint so a production deploy that forgets to replace it is a red gate. The old pinned-zero test is deleted, deliberately, exactly as it demanded of its own successor. | Owner | ~~D-3~~ — **done** |
| **R15** | **An account-wide AWS Config recorder** in an account this project shares. It bills and it touches resources outside this project. ⚠️ Direction of risk: a `required-tags` rule **without** a recorder evaluates nothing and *reads as* enforcement — §5.6. | Owner | G1068 | ✅ **TAKEN 1 Oct 2026 — THE OWNER'S (G2441), AND IT IS A DECLINE: no recorder, and no Config rule exists by decision. Applied in the commit that recorded it; G1068 and D-5 are closed as declined. This row is the BLOCKER AS IT STOOD and is kept rather than deleted.**
| **R16** | **Nine `specified` pack rows are rulings, not tasks** — see §7. Two would breach a standing constraint if built. | Owner | 9 pack rows | ✅ **TAKEN 1 Oct 2026 — THE OWNER'S (G2442): all declined, and APPLIED — eleven rows are `refused` in the pack, not nine (G2448). This row is the BLOCKER AS IT STOOD and is kept rather than deleted.**

⚠️ **AND EIGHT MORE ARE OWED FROM THE 3 Oct 2026 UI WAVE — U-1..U-8 in §5 W6.**
None blocks a served operation. They are listed there, beside the UI tasks they
sit among, so that the wave's task/ruling split stays in one table.

🛑 **R1 through R7 are one conversation and they gate the single largest missing
capability in the product. R8 through R10 are a second. Asking them costs
nothing and unblocks more than any slice in §5.**

---

## 5 · The build order

Six waves. **A wave's slices may run in parallel; the waves may not.** Each slice
names its files and the test that could go RED, because a slice whose only
evidence is a green run is §5.6.

⚠️ **Reserve a G block and a migration block before starting any slice**, and
re-run both checkers after every merge. `node tools/check-g-numbers.mjs` and
`node tools/check-migration-numbers.mjs`. The migration reservation is the one
that has actually collided: two agents each numbered a migration `0011` and
`git merge` produced BOTH with no conflict, because different filenames give git
nothing to object to.

### W0 · Repairs and corrections — no new capability, and it goes first

| | Slice | Blocked on | Why first |
|---|---|---|---|
| **W0-a** | ✅ **DONE** — the gate terminates (G1287/G1288) | — | Without it no CI result means anything |
| **W0-b** | ✅ **DONE — G1301–G1305, 21 Sep 2026.** The verdict is three-valued (`0` done · `1` fatal · `75` retry) and the shell polls only at 75, bounded by `ROLLOUT_POLL_ROUNDS`. An absent `rolloutState` fails closed at the FIRST poll with AWS's documented cause (G1302); the `taskDefinition` comparison runs ahead of every rollout arm (G1303). ⚠️ **AND THE UNWITNESSED PREMISE IS STILL UNWITNESSED — G1304.** A SECOND comparison, against the PRIMARY deployment's own `taskDefinition`, now carries the rollback detector without resting on it; **whether ECS resets `service.taskDefinition` on a rollback is UNMEASURED and needs a deliberate rollback against a scratch service.** The ORIGINAL row follows. — **The rollout-state poll.** `infra/lib/buildspecs.ts` `deploy_plane` samples `rolloutState` ONCE after `ecs wait services-stable` returns — and the waiter succeeds on `length(deployments)==1 && runningCount==desiredCount` and **never reads `rolloutState`**, which AWS documents as flipping to `COMPLETED` *after* steady state. Replace the single sample with a bounded poll over a **three-valued verdict**: `0` done, `1` fatal, `75` retry. | nothing — TASK | **It will fail a good deploy again.** Execution `235be2b3` aborted on a deploy that had succeeded. |
| **W0-c** | ✅ **DONE** — the probe detects a split fleet (G1321–G1325) | — | ⚠️ **THE ROW IS KEPT AND NOT DELETED, because it is the sentence §8 and §10 rested on.** IT READ: *"The split-fleet line in `tests/e2e/probe-deployed-image.mjs` — five lines inside the existing loop, no new AWS call. The probe compares each service to the stack, never the two services to each other. A split where the stack owns a third image produces **two DRIFT lines and exit 1 — identical in shape to a healthy post-pipeline fleet.**"* **No AWS call was added, as sized.** The five lines became a module, because five lines inside a loop in a file G108 keeps out of the gate for ever would be correct and **unprovable** — G1322. Verdicts are now `0` AGREE · `1` DRIFT · **`3` SPLIT**, with `2` still meaning the probe could not answer |
| **W0-d** | ✅ **DONE — G1306, 21 Sep 2026, AND THE DERIVATION FOUND A SECOND STAGE THIS ROW DOES NOT NAME.** Deploy: budget **110** against a timeout of **60**. **Migrate: budget 120 against 90 — under a comment reading *"Longer than the waiter budget, deliberately"*, because it reasons about ONE `migrate_plane` call and the stage makes TWO.** Both timeouts go to **150** (budget + 15 of enumerated headroom); shrinking the retry budget instead is preserved as REJECTED. §7 of `tests/infra/pipeline.test.mjs` derives every term from the synthesised template and the buildspec and asserts `budget + headroom <= timeout` on BOTH stages, with a third test refusing a vacuous pass. The ORIGINAL row follows and its arithmetic sketch is superseded by the derivation. — **The timeout-vs-rounds arithmetic.** Waiter 15s × 40 ≈ 10 min, `DEPLOY_WAIT_ROUNDS=4`, two planes ⇒ **~80 min against a `Duration.minutes(60)` Deploy timeout.** CodeBuild can kill the stage BETWEEN the two `deploy_plane` calls. | a decision, then TASK | A second, independent split-fleet path that W0-b does not close |
| **W0-e** | ✅ **DONE** (G1333–G1345) — the six pack rows are **RE-FILED, NOT DELETED**, the hazard and three rulings are flagged, and the file's line-87 malformation is repaired | — | Each costs a slice if somebody takes it |
| **W0-f** | ✅ **DONE** (G1331, G1332) — all six present-tense CI claims in `CLAUDE.md` corrected in place | — | The record asserting a control that was retired is worse than no record |
| **W0-g** | ✅ **DONE** — the clock control (G1351–G1355), in the gate as `check:clocks`. **The sweep is done and the intersection is EMPTY**: 337 files scanned, 15 with a frozen `now:` clock, 7 with a past-direction `now() - interval`, **0 with both**, so nothing was repaired and nothing needed to be. | — | See §6 K1 for the shape and its honest limit |

🛑 **W0-b's trap, named so nobody falls in it:** an ABSENT `rolloutState` is never
terminal, so a naive *poll until terminal* burns its whole budget and reports a
timeout for a configuration problem. **Fail closed immediately** with AWS's own
documented cause — the field is returned only for rolling-update services not
behind a Classic Load Balancer. And keep the `taskDefinition` comparison **ahead
of** the rollout arm, so a rollback stays fatal even mid-flight.

⚠️ **W0-b rests on one premise nobody has witnessed: that ECS resets
`service.taskDefinition` on a circuit-breaker rollback.** It is taken from a
comment in `buildspecs.ts`. **If it is false the rollback detector has been
vacuous since it was written**, and new fixtures would encode the same mistake.
Settling it needs a deliberate rollback against a scratch service.

### W1 · The engine executes — the largest missing capability that needs NO ruling to start

| | Slice | Blocked on |
|---|---|---|
| **E1** | **`data_type` on `tenant.document_field_spec`**, one additive migration, `SELECT` only, **no `CHECK` on the vocabulary** (`0007`/`0069`'s polarity: an unknown value must reach the model as an `*_unreadable` refusal, never be rejected at write time by a list somebody forgot to extend). Plus the reader arm in `server/data-plane/payload-store.ts` answering `unpublishable` by column. | nothing — TASK |
| **E2** | **`model/extraction.ts`** — the ONE conversion seam. `addressableToExtracted()`, pure and total, a **total `Record<DataType, ExtractedScalar['kind']>`** so a sixth `DataType` is a compile error. **Money goes through `model/money.ts` and nothing else** (G111). Refusal union under `AssertNoTextDeep`. | E1 |
| **E3** | ✅ **DONE 21 Sep 2026 — `db/migrations/0180`, G1401–G1405.** `tenant.document_type` (R11) and `tenant.document_control_total` — **`control_total` as THREE ARMS, never a default**, made distinguishable by a `NOT NULL` DISCRIMINANT COLUMN that is never the payload, plus a STRUCTURAL `CHECK` (not a vocabulary one) confining the payload to `declared`. ⚠️ **A FOURTH STATE — no row, a document nothing has extracted — is refused IN THE READER**, because SQL cannot hold it without breaking `admitAndStoreArrival()`; reading it as `not_declared_by_format` would switch C18 off product-wide on a green gate. 🛑 **`SELECT` only on both, the WRITER OWED** (G110's publication seam for the type, the extractor for the trailer), and **NO FK into `document_type`** — nothing can write a row there, so one would refuse every ingestion permanently. ⚠️ **`filename`, `storage_ref`, `synthetic`, `purge_after` and `purged_at` remain refused on `0012` §3's own arguments, each of which still holds** — E3 took the two `SourceDocument`-adjacent facts that had a READER, not all six. | ~~**R11**~~ |
| **E4** | ✅ **DONE 21 Sep 2026 — `server/data-plane/document-assembly.ts`, G1501–G1506.** It reads `0150`'s slot bindings through `run-admission.ts`' own `readSlotFill()` (exported, one rule two callers — the clause a copy gets wrong is `IS NOT DISTINCT FROM`), then converts through E2's seam. 🛑 **THE FINDING IS `lines`:** `readAddressablePayload()` is HEADER-GRAIN, so `ExtractedLine[]` has no producer — and an empty `lines` is **not inert**, because `presentedRows()` returns exactly ONE row for it. A ledger declared as `lines[0].ref`, `lines[1].ref`, `lines[2].ref` would have reconciled ONE row of three and reported success, C18 silent. **It is REFUSED** (`line_grain_not_representable`), witnessed RED by deleting the guard. ⚠️ **AND THE ENGINE'S APPETITE IS NARROWED TO `ReconciliationDocument = Pick<SourceDocument, …>` (G1501)** — measured at five fields — because five of `SourceDocument`'s eleven have NO COLUMN (`0012` §3 refuses each by name) and a producer would otherwise have had to invent them. **No model module added; `modules` is 29 before and after.** | ~~E1–E3~~ — **done** |
| **E5** | ✅ **DONE 21 Sep 2026 — `server/data-plane/run-executor.ts`, G1521–G1528**, called from `run-worker-main.ts`, one `withTenantScope()` transaction. **`persistRunEngineAccount()` is reused and no second persister is written.** 🛑 **THE ALLOW ARM IS NON-VACUOUS BY ASSERTION**: `tests/db/run-executor.test.ts` §1a reads the stored account for CONTENT — `presented 1 / admitted 1` per side and **residue 0**, which is the only line that says the two documents actually PAIRED — because an empty run balances perfectly and would pass a test that checked only that the row exists. ⚠️ **THIS SAID *"TWO THINGS ARE OPEN AND NAMED: §10 item 5 (below) and the 30-second visibility timeout (G1525)"* UNTIL 22 Sep 2026 AND IS CORRECTED RATHER THAN DELETED, because it is the sentence the ruling below was commissioned against.** ✅ **THE SECOND IS NOW CLOSED — G1834, THE OWNER'S RULING: `RUN_QUEUE_VISIBILITY_SECONDS` RAISED FROM 30 TO 1800, A POLICY CHOICE BOUNDED BY NOTHING MEASURED AND STATED AS SUCH.** See that constant's own header in `infra/lib/config.ts`. **§10 item 5 IS UNCHANGED AND STILL OPEN** — raising the ceiling does not measure a real run's duration, and none of this repository's rulings claims it does. | ~~E4~~ — **done** |
| **E6** | ✅ **DONE 21 Sep 2026, IN THE SAME COMMIT AS E5 — `db/migrations/0190_run_refusal.sql`, G1511–G1515.** Two tables, typed columns and not one `jsonb`, `SELECT, INSERT` only, no `CHECK` on any vocabulary. **`population_integrity_refused` adds no table** — it reuses `0007`'s `run_population_defect` with a fourth `owner`. 🛑 **THE ASSERTION THE SLICE EXISTS FOR IS `tests/db/run-executor.test.ts` §5: a REFUSED run and an UNRECONCILED run are now DIFFERENT on the wire**, where both were 404 before. ⚠️ **ONE CASE SURVIVES AND IS NAMED RATHER THAN HIDDEN (G1522): a DOCUMENT-ASSEMBLY refusal still leaves no account row**, because `RunRefusal` is the ENGINE's closed union and inventing a sixteenth arm is a contract change and therefore a ruling. | ~~E5~~ — **done** |

🛑 **THE GAP IS A CALL SITE, NOT A WRITER.** `persistRunEngineAccount()` already
exists in `server/data-plane/run-account-store.ts`, issues all **13** `INSERT`s,
and `0007` already grants `INSERT` on all 13 tables. Its only callers are tests.

🛑 **E1 IS FIRST BECAUSE WITHOUT IT EVERY LATER SLICE BREACHES INVARIANT 4.**
Copy it, never paraphrase it: *"**Classification is declared once**, on
`FieldSpec`, and everything derives from it."* `FieldSpec.dataType` has **no
column anywhere** — `grep -rn 'data_type' db/` returns nothing — so a converter
would decide `ExtractedScalar.kind` by sniffing counterparty-controlled JSON. Is
`"1234"` an identifier or a number? That is classification declared by the
artefact, which is exactly what G106 refused.

🛑 **E6 SHIPS WITH E5 OR THE PRODUCT GAINS A LIE.** `run_engine_account.outcome`
already admits `'refused'` and nothing writes it, so a refused run has no account
row and `getRunAccount` answers **404 — the same answer it gives for a run nobody
reconciled.** Today that collision is theoretical. **The moment E5 ships, runs
start getting refused for real** and an operator cannot tell *"the engine refused
your definition"* from *"nobody ran it"*.

⚠️ **The "invent a fidelity and a confidence" objection is SPLIT and both halves
are false as stated.** Fidelity is not per-value at all — it is
`DocumentType.expectedFidelity`, read rather than invented. A `null` confidence
is a **declared state** with fail-closed engine behaviour already built and
tested (`heldReadsFor`). So extraction is a **TASK** for `structured` and
`tabular`, which cross no managed-service boundary, and a **RULING (R12)** for
`digital_text` and `scanned`, which put OCR and a model in the path. Key the
producer on `FIDELITY_CROSSES_MANAGED_SERVICE` — a total `Record` — and never on
a list of fidelity names.

⚠️ **The fail-closed hold E2 leans on is currently INERT.** `heldReadsFor` holds
only where a floor was declared, and G139 records that no authoring surface for
floors exists. Say so on the module rather than letting a reader think the nulls
are protected.

### W2 · The consoles — the cheapest real surface in the tree

| | Slice | Blocked on |
|---|---|---|
| **C-0** | **The platform-role seed** behind `RECONCILE_LOCAL_TEST_AUTH`, per **R-P**. | nothing — TASK |
| **C-1** | **`listOnboardingSteps`** — a store, a route, a mount, and three `DERIVED_PRODUCERS` entries. | **R8**, then C-0 |
| **C-2/C-3** | **`completeOnboardingStep` and `forceOnboardingStep`** — ONE slice, plus the sixth scope helper and the second control role. | **R9** |

🛑 **C-1 IS THE ONLY CONSOLE SLICE IN THE TREE THAT NEEDS NO MIGRATION, NO GRANT,
NO NETWORK AND NO ROLE.** Its three "missing" `required` fields — `stepKey`,
`title`, `whoseHands` — are **derivations** backed by total `Record`s in
`model/onboarding.ts`, the same shape G1241 minted `DERIVED_PRODUCERS` for.

🛑 **C-0 IS A PREREQUISITE AND NOT A CONVENIENCE.** Nothing has ever written a
`platform_role_assignment` row, so **every console operation — including the
already-mounted `listTenants` — refuses every real caller** at
`platform_assignment_absent`. Mounting C-1 without C-0 mounts an operation nobody
can call.

⚠️ **`onboarding_record` HAS NO TRIGGER.** Its append-only-ness is entirely the
model refusing `stepAlreadyDone`; nothing in SQL stops `completed_steps` going
DOWN, and a `CHECK` cannot express it (it needs OLD and NEW). **A slice granting
`UPDATE (completed_steps)` owes a `BEFORE UPDATE` trigger** on `0059`'s
precedent, or it spends a property and replaces it with nothing.

⚠️ **`db/migrations-control/0030`'s grants block is FACTUALLY WRONG about its own
writers.** It says both are on `platform-console.openapi.yaml` and gated;
measured, `grep -c` against that file returns **0** — both are on
`administration.openapi.yaml` and both are `exempt:`. **The migration's entire
grant argument rests on a gate that does not exist.** Correct it in place.

⚠️ **The other 12 console operations need a billing period, an invoice, a pack
draft, a rate card or a settlement row, and NONE has a table in either
database.** Each is a migration-sized slice before G300's *first* part is met.

### W3 · Sign-in — the largest missing capability, and the most ruling-bound

| | Slice | Blocked on |
|---|---|---|
| **S0** | **A measurement slice that builds nothing.** Assert, against a live PostgreSQL, that the app role can `INSERT INTO tenant.session` with `tenant_id = NULL` inside `withSignInScope`, and is **refused** with a tenant. | nothing — TASK |
| **S1** | **`external_subject`** on `tenant."user"`, plus a second policy keyed on the sign-in GUCs. | **R5, R6** |
| **S2** | **`model/session-mint.ts`** — `tenantId` **absent from the input type**, not `null` in it. | S0 |
| **S3** | **The mint writer**, reached by no route. **No migration.** | S1, S2 |
| **S4** | ✅ **DONE — G2131–G2134, G2141, 25 Sep 2026.** R2 taken: the JWKS is fetched **once at boot** and held as a VALUE, so a rotation needs a RESTART and a configured-but-unreachable broker is a **failed deploy**. `jwks-source.ts` is the transport and is the **only file in `server/` that makes an outbound request**; `verification-terms.ts` reaches it through a DYNAMIC import, so an unconfigured plane never loads it. ✅ **AND `VerifiedClaims` GAINS `nonce`** (G2141), which is what makes D6 §4.3's binding possible at all. | ~~**R2**~~ — **taken** |
| **S5** | 🟠 **THE SEAM IS BUILT AND THE CALL IS NOT — G2151–G2159, 25 Sep 2026, AND THE ROW'S OWN PREMISE IS WHY.** ⚠️ **THIS ROW READ *"The regional auth host — also the natural home for the code exchange, which keeps `grep -rn 'fetch(' server/` empty"* AND IT IS CORRECTED RATHER THAN DELETED, because that parenthesis is the tension this slice had to resolve.** R3 puts the exchange **in the existing data plane** (no third host), and an authorization-code exchange is an outbound POST **per sign-in** — so it cannot keep that grep empty, and it cannot happen at boot either. **R2 authorises egress AT BOOT; nothing authorises it on a request path.** So `code-exchange.ts` builds the request, reads the response, verifies, and **binds the token to the attempt** (D6 §4.3, closed) — and ships `unauthorisedEgressTransport()`, which refuses loudly. **Request-path egress is an owner's ruling and is NOT taken.** ✅ R4's callback shape is applied and mirrored against `infra/`. | ~~**R3, R4**~~ — **taken; one NEW question raised: may the data plane make a REQUEST-PATH outbound call?** ✅ **ANSWERED 1 Oct 2026 — THE OWNER'S (G2443): yes, bounded — exactly ONE file, `server/data-plane/code-exchange.ts`, to the PINNED connection's token endpoint only, with a short timeout, outside any database transaction.** ⚠️ Recorded, not applied: the call is still refused by `unauthorisedEgressTransport()` until a slice applies all four bounds. The question is kept above as it stood. |
| **S6** | ✅ **DONE 1 Oct 2026 — G2481–G2499. `completeFederatedSignIn` is MOUNTED under `servedPublicly()`; G2443 (egress) and G2235 (the pair off the PINNED row, `0280`) are APPLIED; the served set is 31 of 136 (`node tools/served-set.mjs`). STILL OPEN: nothing BEGINS a sign-in (G2497) and the broker registers console callbacks only (G2494).** The row as it stood: **Mount `completeFederatedSignIn`** + `mintedSessionCookie()`'s first production caller. ⚠️ **THIS ROW IS INCOMPLETE AND IS CORRECTED IN PLACE RATHER THAN REWRITTEN, because it is the sentence a builder would have scoped from.** It names one operation and **the tier has TWO public ones.** `resolveHomeRealm` **cannot be built at all today** — G1705: `DomainClaim` has no table (`grep -rh 'CREATE TABLE' db/migrations/*.sql \| grep -ci domain` → **0**, and the tempting `grep -rc 'domain_claim'` counts two COMMENTS), and the domain-keyed read it needs matches **none** of the three policies on `tenant.identity_connection`. **So S6 as written omits a migration and a policy ruling.** | **R1** |
| **S7** | ✅ **DONE 1 Oct 2026 — G2500–G2502: the round trip runs in Chromium against a LOCAL broker (`tests/e2e/browser-login.test.ts` §24), and `/signin/callback` is the FIFTEENTH route, a state of the drawn `/signin`; G1914 is not resolved.** The row as it stood: **The browser round trip** — a THIRTEENTH route, which is a design change. | S6 |

🛑 **S0 IS FIRST AND BUILDS NOTHING, BECAUSE THE WHOLE TRACK RESTS ON A
PREDICTION NOBODY HAS MEASURED.** `0005:385` already grants the app role
`INSERT ON tenant.session`, and `0027` says in its own text *"INSERT is admitted
by neither policy"* — so **the mint appears to need no new grant and no new
policy**, and RLS alone is the control. If S0 §1 fails, every slice below changes
shape and a migration on `tenant.session` enters the plan.

🛑 **THE INVARIANT-1 BREACH THAT ARRIVES THROUGH A BLESSING.** Copy it: *"Tenant
scope is derived from the session, never read from a request."* G315 puts the
tenant in the OIDC `state` **deliberately**, as a routing fact for the 302. If
the auth host's one-time grant carries it and S3 writes it, tenant scope becomes
a thing conferred by authentication — **with a ruling apparently endorsing it.**
The defence must be that `mintSession()`'s input has no `tenantId` field at all,
so it is a `tsc` error and not a review comment.

⚠️ **`MintedSession` is not in `model/` at all** — it is wire-only, so there is no
`tsc` link between the 200 body and `Session`; one contract test holds it.

⚠️ **Invariant 1's derivation chain bottoms out in an environment variable.**
`resolveServingHost()` is a registry LOOKUP that refuses unregistered hosts — but
the registry is `RECONCILE_SERVING_HOSTS`, not a table. Worth an owner knowing;
not this track's to change.

### W4 · Deploy the machinery that already exists

| | Slice | Blocked on |
|---|---|---|
| **D-1** | **The queue consumer** as a scheduled ECS task (**R-W**), its own task role holding `sqs:ReceiveMessage` + `sqs:DeleteMessage`, joined by NAME so no `Planes` export is minted. | W0-b first |
| **D-2** | **Wire `RECONCILE_RUN_QUEUE_URL` into a rebuilt image.** | D-1 |
| **D-3** | ✅ **DONE — G1811–G1813, 22 Sep 2026.** The topic gains one placeholder email subscription (`sns.Subscription`, `SubscriptionProtocol.EMAIL`), marker-asserted so a real address landing without deleting the marker, or the marker being deleted without a real address, are both red. **It still pages nobody**: an unconfirmed SNS email subscription delivers nothing, and this is code plus `cdk synth` — nothing was deployed. | ~~**R14**~~ — **taken** |
| **D-4** | **The logger serializers (G1067).** | nothing — TASK |
| **D-5** | **AWS Config recorder.** ⛔ **CLOSED AS DECLINED, 1 Oct 2026 — R15, G2441, THE OWNER'S.** There is no slice here any more: no recorder is created and **no Config rule exists by decision**. Tag enforcement is the synth-time Aspect and its tests. The row is kept as it stood, struck by this sentence rather than deleted. | ~~**R15**~~ — **taken, declined** |

🛑 **THE GRANT LANDS IN THE SAME COMMIT AS THE CONSUMER** — G511, *"the fence and
the writer are one commit or neither"* — and the worker gets its **OWN** role. A
shape that grants receive to `reconcile-staging-data-service-task` lets a request
path drain the queue.

🛑 **D-1 MAKES THE QUEUE DRAIN. IT DOES NOT MAKE A RUN EXECUTE.** The worker
claims, reads, reports, and calls nothing. Do not price one as the other.

✅ **THE VISIBILITY TIMEOUT IS RAISED — G1834, 22 Sep 2026, THE OWNER'S RULING —
AND THE SENTENCE BELOW IS CORRECTED RATHER THAN DELETED, because it is the
sentence that named the defect this ruling closes.** IT READ: *"⚠️
`RUN_QUEUE_VISIBILITY_SECONDS = 30` bounds how long the worker may hold a
message, and W1's executor will almost certainly exceed it. That interacts
with D-1 whichever shape is chosen."* **It did exceed it, exactly as
predicted, and `RUN_QUEUE_VISIBILITY_SECONDS` is now 1800 — a policy choice
bounded by nothing measured, stated as such in that constant's own header.**
`tests/infra/run-queue.test.mjs` §8 and §9 assert the new value and the new
dead-letter arrival time (9000s / 2.5 hours, up from 150s) respectively.

⚠️ **The DLQ alarm ALREADY EXISTS and is waiting** —
`reconcile-${env}-run-queue-dead-letter-not-empty`, joined by queue name — and
**cannot fire today because nothing holds `sqs:ReceiveMessage`**.
`run-queue-stack.ts`'s header saying *"NO ALARM WATCHES IT"* is stale;
`Observability` took it.

🛑 **D-4's TRIPWIRE SPECIFIES THE TRIGGER AND NOT THE CONTRACT.**
`tests/infra/observability.test.mjs` §9 is a single
`assert.match(/logger:\s*false/)`, **so it is satisfied by DELETION** — a commit
writing `logger: true` plus a serializer dropping `url` and keeping `headers`
deletes it and passes the whole gate. The commit owes an **allow-list** (§12.1:
*"a field not in the allow-list is dropped AND COUNTED"*) covering `req`, `res`
**and** `err`; `url` must go (it carries the query string), `headers` must go
(`Cookie` carries `__Host-reconcile_session`, the session handle itself), and
`hostname` must go (G180, tenant-identifying). What replaces `url` is
`request.routeOptions.url` — the route template — or better the `operationId`.

### W5 · Everything else in the pack

**C9 · Configure sources and packs is 32 of the 116 remaining rows — 28%, one
surface, and the largest single block.** Twelve are genuine TASKs and they need
the credential-custody ruling first.

**The partner portal is 24 operations and none should be attempted before R10.**
13 of its 15 `partner-arrangement` siblings are table-blocked independently.

✅ **BOTH RULINGS THIS SECTION WAITS ON WERE TAKEN ON 1 Oct 2026 — THE
OWNER'S — AND THE TWO SENTENCES ABOVE ARE KEPT AS THEY STOOD.** Credential
custody is **Secrets Manager, one secret per source, under the per-tenant KMS
key** (G2447); R10 is **partner role tables plus a fifth `decide()` arm**
(G2445). ⚠️ **Neither is applied here**: each is built by its own slice. And
two of C9's rows are no longer in the remaining set at all — R16 moved `SAP is
oData, and read-only` and `Email is forwarded, not read` to `refused` (G2442). ✅ **And since integrate/1oct-b both ARE applied by their own slices — C9 as W5-C9-1 (G2401–G2410) and R10's model and substrate (G2321–G2327), each below — G2531.**

#### W5-C9 · the credential-custody ruling is taken — the 35 rows, sorted (1 Oct 2026)

✅ **THE RULING THE PARAGRAPH ABOVE WAITED FOR IS TAKEN — G2401, THE OWNER'S,
1 Oct 2026:** *"Source credential custody: Secrets Manager, one secret per
source, encrypted with the tenant's per-tenant KMS key (Storage's key factory);
only a credentialRef lives in Postgres; the FDE binds a credential via a write
path under G75's secret reach."*

⚠️ **THE PARAGRAPH ABOVE SAYS 32 ROWS AND THE SURFACE CARRIES 35** — three are
`built` (*Cancel*, *The credential is theirs*, *The confidence floor*) and the
32 is the not-yet-built remainder. Derive the 35 by walking the C9 section's
`<table>` rows, never by a cell grep (G1345 retired that):
`python3` over `docs/handoff-pack/Functional Specification.dc.html` from the
`C9 · Configure sources and packs` heading to the next `<h2` → 35 rows,
2 `partial` · 13 `specified` · 17 `not built` · 3 `built`.

🛑 **AND THE PARAGRAPH'S *"twelve are genuine TASKs"* IS NOT REPRODUCED HERE —
THIS SORT FINDS FIFTEEN, AND NEITHER NUMBER IS DERIVED BY ANYTHING BUT A
PERSON.** The rows below are sorted by what blocks them TODAY, after G2401.

**TASK NOW — no ruling stands between the row and a slice:**

| # | row | what it needs | note |
|---:|---|---|---|
| 1 | Declare a source (`partial`) | an INSERT writer on `tenant.endpoint` + `tenant.intake_channel` | **the credential half is BUILT by W5-C9-1** (below); the declaration half is not, and needs #3's columns first |
| 3 | Connection configuration (SFTP, S3) | per-kind typed columns — host/path/pinned host key; bucket/role/external id | ⚠️ **email and SAP halves are BLOCKED** (#4, #5); typed columns, not `jsonb` (`0160`'s refusal) |
| 6 | Source × document type | a pair table, source × pattern → `document_type_id` (`0180` exists) | |
| 7 | Unmatched deliveries | an arrival classification state, `parked_unclassified` | `model/ingestion.ts`'s G206 rules |
| 8 | Declared up front | a refusal: no extraction without #6 and #14 | rides #6/#14 |
| 9 | The sample is their first delivery | reads #7's parked arrival | |
| 11 | OCR is the pack's declaration | `0180`'s `expected_fidelity` — verify, then annotate | possibly already true in the tree |
| 14 | Field mapping | per (source, pattern) mapping onto `FieldSpec.path` | ⚠️ must not WRITE `document_field_spec` — that declares a classification (`0012` §5) |
| 16 | The drain | extraction of parked arrivals on pair declaration | `structured`/`tabular` only (R12) |
| 18 | Where the parked pile shows | a register count kept apart from exceptions | |
| 19 | The register's line always links | frontend, after #18 | |
| 20, 35 | Changing or stopping a source (both rows) | `disabled_at`, and a **binding HISTORY** table | 🛑 **W5-C9-1 ROTATES IN PLACE** (G2410): the row carries the binding now in force, Secrets Manager keeps one prior version, and *"a period spanning the change states which binding read it"* is NOT yet expressible |
| 22 | Admin is a capability, not a person | frontend nav gated on capability | |
| 24 | The handoff has no state | derive *waiting on a credential* from `credential_ref IS NULL` | **expressible only since W5-C9-1** |

**BLOCKED — and on what:**

| # | row | blocked on | whose |
|---:|---|---|---|
| 2 | Test before declare | **request-path egress** — G2151: *"R2 settles that this product may make an outbound request AT ALL; nothing settles whether it may make one on a request path"* — **and a credential READER**, which G2403 withholds from the serving role by design | Owner |
| 4 | SAP is oData, read-only | the same egress question, per pull, plus a connector runtime nobody has built | Owner |
| 5 | Email is forwarded, not read | **an inbound mail domain we operate** — §7 already names it | Owner (commercial) |
| 10, 12 | Help per source/type; sample disagrees | **R12**: OCR (`digital_text`, `scanned`) is NOT taken, G7/G8 `not applied` | Owner |
| 13, 15 | Raising it with the FDE; floor per document type (surface) | ✅ **G2407 RULED 1 Oct 2026 AND BUILT (G2591)** — `decide()`'s platform arm honours a live `TenantAccessGrant`'s whole class set, so an FDE under a delivery grant reaches `secret`, `configuration` and `tenant_data` verbs. ⚠️ This cell read *"`decide()` HAS NO STAFF-GRANT ARM"* and is corrected rather than deleted. The surfaces themselves are still unbuilt — ⚠️ **AND "Build" WAS TOO STRONG: see the W5-C9-2 table below, G2747 — #13 is now blocked on G2692 and #15 on the document-type writer** | was Build |
| 17, 28 | Drain at the ceiling; dry run | the lease/ceiling ladder (*"No lease is issued, drawn down or renewed"*) | ruling-bound |
| 26, 27, 29, 30, 31, 33 | the pack-install rows | **G110's publication seam**; `installPack` is declared and unmounted | Owner |

**COLLISION, RECORDED AND NOT RESTATUSED (G2408):** #23 *"The credential is
theirs — Written by the customer's cloud engineer into their Secrets Manager.
We never hold one"* is marked `built` in the pack, and G2401 puts the
credential in **our** Secrets Manager under **their** key. The ruling is the
owner's and newer; the pack's word is untouched under PR #467's rule, and #1's
own text (*"credentials that live in the tenant's own Secrets Manager"*) is the
same collision.

##### W5-C9-1 · BUILT — `bindEndpointCredential`, the first vertical slice

`PUT /v1/endpoints/{endpointId}/credential`, `x-capability: bind_secret`,
through `authorisedHandler()` (invariant 10's record minted before the act).
G2401–G2410. **Code and `cdk synth` only — NOTHING DEPLOYED.**

- **db** `0270_endpoint_credential_ref.sql` — `tenant.endpoint` (five columns:
  the key, `credential_ref`, `credential_bound_at`,
  `credential_bound_authorization_id`), `SELECT` + column-level `UPDATE` on the
  three binding columns, **no `INSERT`, no `DELETE`**; and
  `tenant.tenant_key_handle`, `SELECT` only. A CHECK makes key material
  unstorable in `credential_ref`.
- **infra** `Storage` only — **the other eleven templates are byte-identical**.
  The serving role may `CreateSecret` (only naming a tenant key alias) and
  `PutSecretValue`, under an opaque `reconcile-<env>-data-cred-*` prefix, and
  nothing else; the tenant key lets it `GenerateDataKey` via Secrets Manager
  and **not** `Decrypt`. A read verb fails SYNTH (G2403).
- **server** `credential-store.ts` (the seam — a writer, no reader),
  `secrets-manager-store.ts` (the second SDK home — G2404 takes
  `@aws-sdk/client-secrets-manager`, pinned exact), `credential-binding.ts`.
- 🛑 **WHAT IT DOES NOT DO:** ~~an FDE cannot take it (G2407)~~ — ✅ an FDE under a live delivery grant naming `secret` takes it since G2591 (1 Oct 2026); nothing deployed
  sets the two `RECONCILE_CREDENTIAL_*` variables, so the deployed plane answers
  every bind with a loud `store_not_configured` until a `Planes` deploy wires
  them (G1012's hazard, left to a person as G1205 was); no tenant has a
  `tenant_key_handle` row and nothing writes one; and nothing READS a
  credential, because the connector that would is not built.

##### W5-C9-2 · BUILT — the declaration half: declare, list, stop, resume, pair

✅ **FIVE OPERATIONS DECLARED AND MOUNTED IN ONE COMMIT — G2681–G2692, 1 Oct
2026, all DERIVED and not the owner's.** Each is table + model + capability +
a record-minting mount (G300, G511), and every `required` field of both
response schemas is asserted by name (K6). **Code only — NOTHING DEPLOYED.**
The served set is **38 of 143 across 131 paths** — derive it,
`node tools/served-set.mjs`.

| Operation | Capability | Rows |
|---|---|---|
| `declareEndpoint` — `POST /v1/endpoints` | `configure_endpoint` | 1 (declaration half), 3 (SFTP, S3) |
| `listEndpoints` — `GET /v1/endpoints` | `view_endpoint` | 24, 11 (the type's fidelity, read through the pair) |
| `stopEndpoint` / `resumeEndpoint` | `configure_endpoint` | 20, 35 (the dated, reversible stop) |
| `declareEndpointDocumentType` | `configure_endpoint` | 6, 14, 8 (half) |

- **db** `0340_source_declaration.sql` — `tenant.endpoint` gains its
  declaration (column-level `INSERT` naming seven columns and NOT the three
  binding ones); `endpoint_sftp` / `endpoint_s3`, typed, pinned to their kind
  by a composite foreign key; the lane's writer (`INSERT` five columns,
  `UPDATE (enabled)`); `endpoint_stop_event`, append-only.
  `0341_source_document_type_pair.sql` — the pair and its mapping, pointing at
  `document_field_spec` and never writing it.
- **model** `model/connectors.ts` §2–§4 — `validateSourceDeclaration()`
  (including the reserved-address refusal, G2686), `sourceState()` (row 24,
  derived), `checkSourcePair()` (row 14's completeness).
- **server** `server/data-plane/sources.ts`.
- **witnessed reds, each by mutation:** the gate moved to `view_endpoint` (§4,
  the viewer declares), a blanket `GRANT INSERT` (§8, a declaration carrying a
  credential), the completeness check disabled (§7), the lane/history agreement
  check deleted (§6), `ipv4IsReserved()` made constant-false (model §1). The
  cross-tenant control (§5) is paired with RLS DISABLED underneath the same read,
  which LEAKS.

**WHAT REMAINS OF THE "TASK NOW" TABLE ABOVE, AND WHY IT IS NOT A TASK ANY
MORE:**

| # | row | status after W5-C9-2 | blocker |
|---:|---|---|---|
| 1, 3 | declaration; SFTP/S3 config | **built** | — the email and SAP halves are R16's `refused` |
| 6, 14 | pair; field mapping | **built** | ⚠️ no operation READS a type's declared fields, so path keys are not discoverable from the wire; a pair cannot be edited |
| 11 | OCR is the type's | **built — as an absence** (G2690) | — |
| 20, 35 | stopping | **built** (dated, reversible) | 🛑 **rebinding is not** (G2689) — the connector that would read a binding is not built |
| 24 | the handoff has no state | **built**, with a fourth state the pack does not draw (G2688) | — |
| 8 | declared up front | **half** | a pair cannot be declared incomplete; nothing extracts per pair at all |
| 7, 9, 16, 18, 19 | parked pile, sample, drain, register line | 🛑 **BLOCKED, owner's** (G2692) | an `Arrival` carries **no filename** (`0012` §3 refuses it by name) and `ArrivalVerdict` has **no third state** |
| 22 | admin is a capability | **not built** | the frontend has no Setup surface for a nav entry to gate; frontend work, no ruling needed |
| 2 | test before declare | blocked (unchanged) | request-path egress, G2151 |
| 10, 12 | help per type; sample disagrees | blocked (unchanged) | R12; and there is no sample (G2692) |
| 13, 15 | FDE; floor per type | ⚠️ **G2407 NO LONGER BLOCKS EITHER — AND NEITHER IS A TASK YET (G2747, integrate/1oct-c).** This cell read *"blocked (unchanged)"* with G2407 as its blocker, and #511 (G2591) and #515 now sit on one tree. **#13** (*"carrying the pack, the type and the SAMPLE. The pair stays PARKED pending"*) needs a parked pair and a sample — row 7/9's blocker, **G2692** (an `Arrival` carries no filename and `ArrivalVerdict` has no third state), which is the owner's. **#15** (*"The floor belongs to the type, and is stated on every pair"*) needs a floor column on `tenant.document_type`, whose writer is owed (G1405: `SELECT` only; G110's publication seam / G58's authoring surface), and it is INERT under R12 — no OCR path, so every extracted confidence is `null` and nothing a floor holds | was G2407; now G2692 (#13) and the document-type writer (#15) |
| 17, 28 | drain at ceiling; dry run | blocked (unchanged) | lease ladder |
| 26, 27, 29–31, 33 | pack install | blocked (unchanged) | G110's publication seam |

⚠️ **NO WORD IN THE PACK MOVED (G2691)** — PR #467's rule, which
`docs/build/pack-tree-join.md` states as its own bar. The tree's status is
recorded there and here.

##### W5-C9-3 · BUILT — the parked pile, the sample, the drain, the register line, the raise

✅ **G2692 RULED BY THE OWNER, 2 Oct 2026:** *"Yes, both: store an Arrival's
filename verbatim, interpreted by nothing (invariant 6 via 0022's precedent);
add a `parked` ArrivalVerdict arm."* **THREE OPERATIONS DECLARED AND MOUNTED IN
ONE COMMIT, AND THE DRAIN INSIDE A FOURTH — G2831–G2844.** Each is table + model
+ capability + a record-minting mount (G300, G511), every `required` field
asserted by name (K6). **Code only — NOTHING DEPLOYED.** The served set is
**47 of 147 across 135 paths** — derive it, `node tools/served-set.mjs`.

⚠️ **THE TWO 🛑 ROWS ABOVE ARE CORRECTED BY THIS TABLE RATHER THAN EDITED** —
`7, 9, 16, 18, 19` read *"BLOCKED, owner's (G2692)"* and `13` read *"now
G2692"*; both were true until this ruling.

| Operation | Capability | Rows |
|---|---|---|
| `listParkedArrivals` — `GET /v1/parked` | `view_exception` | 7, 18 (counted apart from exceptions), 13 (raised ones counted separately), 16 (the drains, *"the register states why"*) |
| `getParkedArrival` — `GET /v1/parked/{arrivalId}` | `view_exception` | 9 (the sample's KEYS, never a value — G106), 19 |
| `raiseParkedArrival` — `POST /v1/parked/{arrivalId}/escalation` | `configure_endpoint` | 13 — the sample and the type, **not the pack** (G2839) |
| the drain, inside `declareEndpointDocumentType` | `configure_endpoint` | 16 — **the meter does not move** (G2837) |

- **db** `0380_arrival_filename_and_parking.sql` — `arrival.filename`
  (`0012` §3's refusal overturned by ruling, not edited), `held_artefact`
  (the one `DELETE`, fenced to drained rows), `arrival_drain`,
  `parked_escalation`, and four restrictive policies each `FOR` one verb.
- **model** `model/ingestion.ts` §2a — `arrivalFilenameFrom()`,
  `nameFallsUnder()`, `projectThroughMapping()`, `decideArrival()`; the third
  verdict and two total records over it.
- **server** `payload-store.ts` §4a (`admitClassifyAndStoreArrival()` — **no
  caller outside `tests/`**, because nothing reads a source — and
  `drainParkedAgainstPair()`), `parked.ts`.

**WHAT REMAINS, AND WHY:**

| # | row | status | blocker |
|---:|---|---|---|
| 18, 19 | the register line, the pane | ✅ **drawn — G3501–G3505, feat/ui-parked-pile, 3 Oct 2026.** ⚠️ This cell read *"**wire-built; no UI**"* and was true until then. `/close` draws the pile APART from the register, each line opens one pane (keys, never a value), and the raise is offered only where the gate permits it | Setup's half of *"Both places"* is not drawn; the pack's "Parked" facet is a different object and stays quiet (G3503) |
| 18 | *"the person who unblocks it named"* | 🟠 a capability | a person-scoped read of other users is the administrative directory (G2840) |
| 13 | carrying the pack | 🟠 | `document_type` has no pack; `installPack` is G110's (G2839) |
| 16 | the meter moves | ⛔ | no usage-sequence allocator (G2837) |
| — | G295 while parked | ⛔ owed | an erasure plan over held artefacts (G2836) |
| 12 | sample disagrees with the type | blocked (unchanged) | R12 — no fidelity is DETECTED from a sample |
| 15 | floor per type | blocked (unchanged) | the document-type writer (G1405), and inert under R12 |
| 7–19 | any of it from a real delivery | blocked | **no connector reads a source** (G2686, G2689) |

### W5 · partner portal — R10's model and substrate slice (1 Oct 2026)

✅ **R10 IS TAKEN — THE OWNER'S, 1 Oct 2026:** *"Partner role tables + a fifth
arm: new partner_role / partner_role_assignment tables keyed on partnerId,
decide() gains a fifth arm, and new resource classes for deals / sandbox /
partner staff."* This section is the plan the slice was built against, written
before the code. **It takes the model and the substrate and NOT the 24 mounts**,
because a mount needs table AND model AND capability AND a record writer
(G300, G511) and three of those four are missing for every one of the 24.

**The three-part question R10 posed, and the answer to each:**

| Part | Answer | Where |
|---|---|---|
| **The authority instrument** | `PartnerRole` × `PartnerRoleAssignment`, keyed on `partnerId`, NOT `TenantScoped`, `expiresAt` NOT NULL (`DURABLE_ASSIGNMENT_PERMITTED.partner` is `false`, made unrepresentable). Stored in three tables, `0009`'s platform trio plus `partner_id` on both rows and a composite FK so a role and an assignment cannot name two firms. **RLS is SESSION-keyed; partner-keyed is refused** — it would need a seventh scope helper and would make every table a firm ROSTER, the administrative reach G447 measures this schema as having nowhere. `SELECT` only to the app role. | `model/access.ts` §6c · `db/migrations/0250_partner_role.sql` · `readPartnerHeld()` in `server/data-plane/identity.ts` §6c |
| **The taxonomy** | THREE classes, each with a rule true of it and false of its nearest neighbour (§11.2's test): **`deal`** — *the subject has no `tenantId` and may never get one* (vs `commercial`, money ABOUT a tenant); **`sandbox`** — *the owner of the plane is the partner* (vs `substrate`, a customer's plane under shared root), lifecycle only, never a read into it; **`partner_staff`** — *held in no tenant* (vs `authority`, roles evaluated IN a tenant). All three are `PARTNER_ONLY_RESOURCE_CLASSES`, G601's fence mirrored. | `model/governance.ts` `ACCESS_RESOURCE_CLASSES` |
| **The arm** | A FIFTH arm of `decide()`, dispatched on the **capability's class** and never on a fifth organisation — `ORG_CLASSES` stays three. Entered only for a partner-only verb; reads `partnerHeld` ALONE; returns `DENY_ALL`; refuses a customer or platform principal at `capability_is_partner_only`. **It names no tenant, so it cannot be a second cross-tenant path**: invariant 2's single path is unchanged and is still the only one. | `model/access.ts` `decide()` §2g · `tests/model/partner-staff-arm.test.ts` |

**Six verbs — a read and a write per class, on the `author`/`publish` split:**

| Verb | Class | Operations it would gate | Still blocked on |
|---|---|---|---|
| `view_deals` | `deal` | `listDealRegistrations` | no deal-registration table in either database |
| `register_deal` | `deal` | `submitDealRegistration`, `requestTrialTenant` | no deal-registration or trial-request table; no writer (G511) |
| `view_sandbox` | `sandbox` | `getSandboxTenant` | no sandbox lifecycle table |
| `operate_sandbox` | `sandbox` | `requestSandboxTenant`, `resetSandboxTenant`, `handBackSandboxTenant` | no sandbox lifecycle table; the platform's provisioning act is `provision_substrate`, not this verb |
| `view_partner_staff` | `partner_staff` | `listPartnerPeople` | **the roster is unreadable**: `0250` is session-keyed by design, colleague names live on `tenant."user"` (G447 — visible only to its owner), and `state` has no producer |
| `manage_partner_staff` | `partner_staff` | `invitePartnerPerson` | no invitation table; `0250` grants `SELECT` alone, and the writer owes its own `WITH CHECK` |

**So the annotation step annotates NOTHING** — the brief was to annotate only
operations whose capability exists AND whose data has a table, and none of the
nine qualifies. Each exemption is **rewritten** to name its verb and its
missing table rather than left asserting that no verb exists.

**The other fifteen of the 24 are not R10's.** `requestRateCardChange` stays
`exempt:` — a commercial conversation, and G271 keeps the partner's commercial
path off every verb. The fourteen remaining `partner-arrangement` operations
(commission, cases, tenants sold, access grants, arrangement, rate cards,
catalogue, notifications, escalation enquiries) are governed by the arrangement
and by `partnerCommercialVisibility()`, and 13 of the 15 are table-blocked
independently, as this plan already recorded.

🛑 **WHAT MOUNTING ANY OF THE 24 STILL OWES, IN ORDER:**

1. **A table** per operation's data (deals, sandbox lifecycle, invitations, cases,
   commission statements …), each with its own ruling where the data is
   commercial.
2. **A writer** for `tenant.partner_role_assignment` — `invitePartnerPerson` is
   it, with a `GRANT INSERT`, a `FOR INSERT … WITH CHECK` and a no-escalation
   rule (a partner user must not make themselves administrator) in ONE commit
   (G511). Until then every partner reaching the fifth arm is refused at
   `partner_staff_assignment_absent`.
3. **Invariant 10's record for the fifth arm.** `AuthorizationGrant extends
   TenantScoped` and a portal act has no tenant — G728's finding for the
   platform arm, reached a second time. `0091` gave the platform a second home;
   a portal act needs a third home or a ruling that `0091`'s generalises.
   **G2327, ⛔ owed** — the sixth boot fence refuses a gated mount without it.
4. **A roster read** for `listPartnerPeople`: an administrative reach into the
   firm's own people, which is a ruling (G447) and not a policy tweak.

✅ **W5 · PARTNER-PORTAL MOUNTS — BUILT 1 Oct 2026, G2621–G2640.** The four
items above, in order, and what became of each:

1. **Tables** — `0321` (`partner_invitation`) and `0322` (`deal_registration`,
   `partner_sandbox`, `partner_sandbox_request`, `trial_tenant_request`), every
   one keyed on the act's RECEIPT (G2631) and none naming a tenant.
2. **The writer** — the invitation, not the assignment: an invitee has no user
   row until first sign-in, so `partner_role_assignment` still has no `INSERT`
   and **redemption is owed** (G2629). The fence is a RESTRICTIVE no-escalation
   `WITH CHECK` (G2627).
3. **Invariant 10's record** — the owner's ruling, G2621: a third, session-keyed
   home. **Discharged.**
4. **The roster read** — the owner's ruling, G2624: a narrow `SELECT` on
   `tenant."user"` under a `view_partner_staff` record, plus the three policies
   that make it readable (G2625). **Discharged.**

**Served: `listDealRegistrations`, `submitDealRegistration`, `getSandboxTenant`,
`requestSandboxTenant`, `listPartnerPeople`.** Annotated and NOT mounted, each
for a named reason: `invitePartnerPerson` (G2630 — `name` is `required` on its
201 and nothing produces one), `requestTrialTenant` (G2639 — its only reachable
answer is its own 422), `handBackSandboxTenant` and `resetSandboxTenant`
(G2640 — each answers an act nothing here performs). The other fifteen of the
24 (`requestRateCardChange` and the fourteen `partner-arrangement` operations) are untouched.

### W6 · UI pack fidelity — the 3 Oct 2026 wave (G3391–G3592; recorded by G3601)

**This wave is not in the six-wave order above. It was not planned on 21 Sep
2026.** It ran after W3–W5 had made the surfaces reachable. It measured them
against `docs/handoff-pack/` in red audits, and it repaired them in green
slices. The narrative, the PR list and the nine owner rulings are quoted at
`docs/HANDOFF.md` §0a, in the *3 October 2026* entry. This section keeps only
the plan's split: **what is a TASK and what is a RULING.**

**The audits are reports, not rulings.** There are seven, under
`docs/build/ui-audit/`: four red rounds (visual/tokens, copy/components,
motion/mark, partner/staff/apex) and three re-audits. ⚠️
**`red-partner-staff-apex.md` has no re-audit yet.**

**Built, each with its rows:** capability-gated navigation (G3521–G3523), the
parked pile (G3501–G3507), Matched/In variance/Variance served and drawn
(G3541–G3544), `resolution_not_configured` 409 (G3441), `Run.completeness`
(G3442, G3445), the partner portal's layout and its deal currency (`0470`,
G3561–G3570), and the staff console/apex/host-aware E1 fixes (G3581–G3592).
**The served set did not move: 51 of 149** (`node tools/served-set.mjs`).
The wave widened responses and mounted no operation.

**Rulings TAKEN this wave, the owner's:** RC-04 (G3423) · sign-in copy (G3428 —
quote the row, not the shipped heading; G3602) · RMR-01 (G3480) · NC-08/RV-16
(G3473) · N-02 (G3478) · RMR-04 (G3471) · per-host error pages (G3581) · deal
currency (G3561) · apex light-only (G3582). **Defaults, NOT rulings:**
`ARRIVAL_SIDE = 'left'` (G3543) and "‹ Back to the site" → the apex (G3581).
✅ **`ARRIVAL_SIDE` STOPPED BEING A DEFAULT ON 3 Oct 2026 — the owner ruled
*"Left side."* (G3665).** The sentence above is kept as it was written.

✅ **AND ALL EIGHT RULINGS BELOW (U-1..U-8) WERE TAKEN BY THE OWNER ON 3 Oct
2026.** Each row's *Kind* now says **RULED** and names the row that quotes the
owner. U-6 and U-8 are being built by concurrent slices; their own rows carry the
owner's words, and this table only points (G3667).

| | Item | Kind | Row / source |
|---|---|---|---|
| U-1 | Off-scale trackings `.06em`/`.12em` — mint `--tr-key` or fold | ✅ **RULED** — *"Snap to kernel scale"*; applied | G3400, **G3662** |
| U-2 | `--lh-solid` — ratify or reverse | ✅ **RULED** — *"Keep the --lh-solid token"* | G3395, G3480 (N-06), **G3663** |
| U-3 | Dark-theme lit hot spot: `--muted` at **2.70:1** | ✅ **RULED** — *"Dim the dark glow"*; applied, 4.82:1 at rest / 4.66:1 on hover, measured in Chromium | #552, G3480, **G3661** |
| U-4 | Severity as a word in the status cell — its final home | ✅ **RULED** — *"Keep"* | #552, G3469, **G3666** |
| U-5 | `ARRIVAL_SIDE` — which side the arrival draws | ✅ **RULED** — *"Left side"* (no longer a default) | G3543, **G3665** |
| U-6 | Register scoped to the definition, not the run — exceptions carry no run id | ✅ **RULED** 3 Oct 2026 — being built by a concurrent slice; its row quotes the owner | G954, G3444, G3667 (pointer) |
| U-7 | Ratify G3521/G3522 taken as derived, or both come out | ✅ **RULED** — *"Keep it"* | #556, **G3664** |
| U-8 | Intake latency channel — a queue | ✅ **RULED** 3 Oct 2026 — being built by a concurrent slice; its row quotes the owner | G2007, G3667 (pointer) |
| U-9 | Wire Accept/Reopen to `proposeResolution`/`executeProposal`/`reverseResolution` | TASK — ✅ **done**, #565 (G3641–G3650) | G3423, G3478 |
| U-10 | Per-cell "N need you" on the strip | TASK (needs a served count) — ✅ **done**, #566 (G3621–G3628) | G3445, #551 |
| U-11 | Variance sort | TASK (needs a served order) — ⛔ **open at `b2563cab`**; owed with a migration (G3647) and put to the owner (G4124) | #557 |
| U-12 | "reading" vs "running" — settle the e2e `settled()` helper, then the word | ✅ **BUILT** 4 Oct 2026 — `settled()` reads `[data-reading]`; the pack's "reading" is drawn for a running run. U-21/U-22 (`documents_refused`/`unreadable` stay `queued`; nothing sets `running`) are built in the same slice, G4131–G4134 | G3444, G3476, **G4136** |
| U-13 | The narrow status bar's tappable row plus sheet | TASK — ✅ **done on Close**, #584 (G4071); staff and partner still wrap | G3431 |
| U-14 | Parked pile: Setup's half of row 18; name the PERSON who unblocks | TASK, then blocked on the administrative directory — ✅ **Setup half done**, #573 (G3782); naming the person still blocked | G3506, G2840 |
| U-15 | The empty-body raise probe → read `capabilities` | TASK — ✅ **done**, #573 (G3781) | G3504 |
| U-16 | RP-08d — the pack's `›` pager glyph, refused by `indicator-roster` §4 | pack question — ✅ **RULED** *"Keep words: Previous / Next."* (G3712) | #560 |
| U-17 | Re-audit P1/S1/apex: sandbox `live` state, hand-back/reset/trial, keyboard order, intake steps two and three | TASK — ✅ **done**, #564, fixed by #572 (G3701–G3720) | `red-partner-staff-apex.md` *Not covered* |
| U-18 | The account menu's `--z-modal + 1` layer | pack question | #552 |
| U-19 | Confirm `caf66abe` (migration `0470`) is live, then re-run the 13-persona pass | TASK — ✅ **superseded**: staging runs `b2563cab` and the pass was re-run, as reported (G4122) | G3603 |


### W6 · 4 Oct 2026 — after the wave: C1 rounds three and four, the engine writes, staging at `b2563cab` (G3621–G4110; recorded by G4121)

**The narrative, the PR list and the deployed state are at `docs/HANDOFF.md`
§0a, in the *4 October 2026* entry.** This section keeps the plan's split only.
The U-rows above are marked in place; nothing below repeats them.

**Built since #561**, each with its rows: run-scoped exceptions (`0480`,
G3621–G3628) · Accept/Reopen wired (G3641–G3650) · the engine raises
exceptions as `reconcile_engine` (`0500`, G3741–G3750) and the run worker holds
that credential (G3861–G3866) · the CRM origin pin (G3867–G3869) · C1 round
three/four, `view_run` and co-member names (`0510`, `0520`, G3831–G3890) · one
spelling of a capability (G3961–G3963) · document-type labels (G3941–G3945) ·
ephemeral e2e ports (G3911–G3915) · the `authorisation-record` flake
(G4061–G4063) · a former member and the run row (G4021–G4034) · `refused`
`RunStatus` and one run-row writer (G4001–G4004) · C3-24/25/28/30 (G4041–G4048)
· the narrow status sheet and Setup at 390 (G4071–G4077) · the tooltip flip
(G4091–G4097) · role-secret rotation (G3921–G3929) · role labels and the tenant
reporting currency (`0560`, G4101–G4110). **Served moved 51 → 52 of 150**
(`node tools/served-set.mjs`).

| | Item | Kind | Row / source |
|---|---|---|---|
| U-20 | Put the PipelinePulse token in `reconcile-staging-crm-lead-intake`, then redrive the DLQ | OPERATIONAL — a person with CRM access — ⛔ **still open at `d626275e`**: the DLQ holds 4, measured 7 Oct 2026 (G4462) | G3731, G4123, `deploy-handoff.md` §27/§27a |
| U-21 | `documents_refused` and `unreadable` runs stay `queued` | TASK — ✅ **done**, #594 (G4131, G4133); integrated in `integrate/5oct-l` (G4211) | G4003, G4124 |
| U-22 | Nothing sets `running` | TASK — ✅ **done**, #594 (G4132) | G4124 |
| U-23 | Per-run database names, so two gates share one PostgreSQL | TASK — ✅ **done**, #593 (G4151–G4155) | G3914 |
| U-24 | The remaining load-timing items | TASK — ✅ **done except `profile-switcher` §4**, #593 (G4156–G4158; G4159 names what is not closed) | G3915, G4063 |
| U-25 | Tooltip under ~272px; vertical flip | TASK — ✅ **done**, #595 (G4187–G4190) | G4097 |
| U-26 | Setup's forms out of the table rows, as `.reasons` blocks | TASK — ✅ **done**, #591 (G4171–G4174) | G4074 |
| U-27 | Staff console and partner portal status bars at narrow | TASK — ✅ **done**, #595 (G4181–G4186) | G4071 |
| U-28 | Duplicate or empty document-type labels | TASK — the migrator's, until a writer exists — ✅ **the picker half done**, #591 (G4175–G4177); the label itself still has no writer | G3945 |
| U-29 | G110's publication seam / a declaration writer (document types, exception rules, engine specs) | TASK, large — 🟠 **the refusal logic for document types only**, #592 (G4201–G4207, `model/publication.ts`); the WRITER's shape is G4204, put to the owner | G110, G3745 |
| U-30 | The Variance sort — whether and how an order by variance is served | **RULING** — the owner's | G3647, G4124 |
| U-31 | Watch the first Monday 23:00 UTC role-secret rotation | OPERATIONAL — ✅ **watched**, 5 Oct 2026: three of FOUR rotated; `controlapp` refused because `infra/lib/data-stack.ts` names `reconcile_app` on the control cluster (G4463, carried as W7's V-3) | G3925, G3929, G4122, **G4463**, **G4464** |


### W7 · 5–6 Oct 2026 — the console stack in two waves, bounded runs, staging at `d626275e` (G4131–G4454; recorded by G4461)

**The narrative, the PR list and the deployed state are at `docs/HANDOFF.md`
§0a, in the *5–6 October 2026* entry.** This section keeps the plan's split
only. U-20 and U-31 are marked in place above; the other W6 rows were marked by
#596.

**Built since #589**, each with its rows: Setup's `.reasons` forms and the
picker's reference (G4171–G4177) · the document-type publication refusal logic
(`model/publication.ts`, G4201–G4207) · per-run test databases (G4151–G4159) ·
a status for every terminal arm (G4131–G4139) · narrow staff/partner status bars
and the tooltip flip (G4181–G4190) · run-terminal alarms (G4401–G4405) · bounded
runs and the split transaction (`0620`, G4365–G4370) · the C4 rebaseline and
`check:c4`'s joins (G4411–G4420) · the console over a signed internal tier and
its credentials retired (`0050`–`0052`, `0600`, G4301–G4324) · the two waves
verified (G4451–G4454). **Served moved 52 → 56 of 154**
(`node tools/served-set.mjs`); the four are the internal tier.

| | Item | Kind | Row / source |
|---|---|---|---|
| V-1 | Put the PipelinePulse token and redrive the DLQ | OPERATIONAL — U-20, carried | G4123, G4462 |
| V-2 | A real alarm recipient in place of the R14 placeholder | **RULING/OPERATIONAL** — the owner names who is paged | G1811, G4401–G4405, G4470 |
| V-3 | `controlapp` rotation: rotate `reconcile_control_app`, deploy `Data`, cancel the stuck `AWSPENDING` | TASK, small — ✅ **done**, #610 (G4471), deployed on staging 9 Oct 2026 (G4477; one stale-checkout deploy corrected, G4478). ⚠️ **Watch the first real rotation, 12 Oct 23:00 UTC** (G4480) | **G4463**, G4471, G4477, G4478, G4480 |
| V-4 | "five role secrets" comments in `infra/lib/config.ts` and `infra/lib/data-stack.ts` | TASK, comments only — ✅ **done**, #610 (G4471 swept them; G4476) | G4464, G4471 |
| V-5 | Profile `executeRun()` at 20k items per side | TASK | G4466, G1524 |
| V-6 | The staging payroll demo run reads `failed`, not `refused` | TASK — one migrator `UPDATE` | G4467 |
| V-7 | `/partner/*` marked `plane: 'control'` in `frontend/src/routes/table.ts` | TASK | G4411, G4469 |
| V-8 | Test helpers still set `RECONCILE_CONTROL_READ/WRITE_DB_PORT` | TASK | G4320, G4469 |
| V-9 | C4 container labels without a `predicate` (S3, EventBridge, telemetry, Bedrock, connector) | TASK | G4419, G4469 |
| V-10 | Ten served operations no frontend client reaches (14 acknowledged, 4 internal by design) | TASK, per screen | G4444, G4469 |
| V-11 | Which writer puts a document type into a tenant | **RULING** — the owner's | G4204 (U-29) |
| V-12 | The Variance sort | **RULING** — the owner's | G3647, G4124 (U-30) |
| V-13 | Publish a document-refused run's refusal | **RULING** — the owner's | G4137 |
| V-14 | A run with no engine spec: `refused` or `queued` | **RULING** — the owner's | G4138 |
| V-15 | *"control plane"* as the narrow staff/partner provenance | **RULING** — the owner's | G4183 |

⚠️ **G4175's narrowing of G3943 is NOT on this list**: G3943 is derived, so it
needs no ruling (G4468).

---

## 6 · Controls this plan owes

| | Control | Why |
|---|---|---|
| **K1** | ✅ **BUILT** — `tools/check-clock-fixtures.mjs`, gate stage `check:clocks`, G1351–G1355. Detects `now() - interval 'N unit'` in a file that also freezes an ISO literal used as `now:`; asserts `Date.now() < Date.parse(T) + min(Δ)`; fails **with the date in the message**. | G1209 was found because it detonated. ✅ **The EARLIEST flip is taken** — the `Math.max` draft that reported `LATENT` for a row that had already fired is pinned as a negative control at a FIXED instant (G1352), because read at `Date.now()` the control stops discriminating after 2026-09-21T12:00Z. ✅ **Witnessed RED against the real pre-repair file**, deriving `2026-09-20T12:00:00.000Z` rather than being told it. ⚠️ **Still a landmark, not the property, and the header says so**: it misses `CURRENT_TIMESTAMP`, computed intervals, and a clock passed through a helper. It catches the one that bit. 🛑 **Two findings the build added: comments MUST be stripped** — the loudest `now() - interval '1 day'` in the tree is G1209's own narration, and three sites are prose (G1353) — **and a control's own test file is a corpus**: the first run failed the gate on its own suite's inline strings (G1355). |
| **K2** | ✅ **BUILT** — `tests/ci/gate-stages.test.ts`, G1471. All **17** stages pinned by an ORDERED `deepEqual` against a list typed into the test, plus a derived check that every `check:*` script is inside the gate (G108) and that nothing in the gate names a missing script. **The count is now DERIVED, not transcribed**: `gate stages` and `checkers` are governed totals in `tools/check-doc-counts.mjs`. ⚠️ **THE RATIO WAS 11 OF 17, NOT 11 OF 16** — `check:clocks` had landed. 🛑 **WITNESSED RED**: `check:migrations` deleted from `scripts.check`, full gate run → **EXIT 0 · tests 3320 · pass 3318 · fail 0**, the checker producing no output and the census reporting nothing stood down. After the assertion the same deletion fails **three**. ✅ **AND THE DERIVED COUNT EARNED ITSELF IMMEDIATELY**, reporting three stale `checkers` lines nobody had noticed: `README.md` said FIVE and named five by hand, `docs/HANDOFF.md` said FOUR twice. | This is also why `CLAUDE.md`'s "SIXTEEN stages" fence keeps going stale: nothing derives it |
| **K3** | ✅ **BUILT** — `tests/ci/gate-stages.test.ts` K3, G1479, **and it governs the property rather than the two flag names (§5.1)**: every `check:*` script must be exactly `node tools/<checker>.mjs`. 🛑 **THERE ARE AT LEAST FIVE SUCH FLAGS AND K3'S TEXT NAMES ONE** — `--triage` (forces `process.exitCode = 0`), `--check-file` (replaces the corpus with one path), `--corpus`, `--pairs` (narrows the comparison set), `--wire` (replaces contract discovery). A list of five is one short the day a sixth lands. ✅ **PAIRED WITH A POSITIVE CONTROL**, because a rule about flags nobody could use is §5.6: one fixture, two runs, verdicts required to DIFFER — bare **EXIT 1**, `--triage` **EXIT 0**. **Witnessed RED**: adding `--triage` back fails two assertions. | The identical shape **is** guarded one checker over, for `check-pack-safety`'s `--corpus`. The argument was made and not generalised |
| **K4** | ✅ **BUILT** — `tests/tools/checker-denominators.test.mjs`, G1473–G1478. **Every checker now prints a denominator**, and the registry is compared for EXACT set equality against the `check:*` scripts, so an eleventh checker with no row is a red. 🛑 **THE COUNT IS FIVE, NOT SIX, AND FINDING THE SIXTH ON THE RIGHT SIDE OF THE LINE IS PART OF THE RESULT.** Each of the five was **witnessed** printing success at EXIT 0 over an empty subject in a sandbox before its guard was written: `check-migration-numbers` (two ticks), `check-c4-freshness` (`OK … 0 modules, 0 import edges, 0 exports`), `check-g-numbers` (`G rows: 0`), `check-citations` (`DEAD 0`) and **`check-wire-mirror`, whose `DRIFT (0). Every compared pair mirrors its model declaration` over ZERO comparisons is the one to read twice** — a true sentence about an empty set in the vocabulary of an all-clear. ⚠️ **`check-doc-counts` FAILS CLOSED and was never in this class** (G1478): its derivations THROW, measured three ways. It gained the printed denominator and a documented tripwire whose arms are unreachable today, and the correction is recorded rather than a sixth fix claimed. ⚠️ **A SECOND DEFECT FELL OUT OF THE FIRST**: `check-migration-numbers` used an accumulated counter, so a collision in one sequence SUPPRESSED the other sequence's report. | §5.6, in the tools written to catch §5.6 |
| **K5** | ✅ **BUILT 21 Sep 2026** — `tests/schema-table-resolver.ts`, G1773–G1780, with §5a and §5b rewired onto it. **The scan resolves a schema to a DECLARED table instead of scanning a corpus for a token, so an unmapped schema produces NOTHING** — `0001`'s deny-on-NULL applied to a scanner, which is what turns *"it fails toward producible"* around. 🛑 **THE NAMED HOLD-OUT IS RETIRED BY THE PROPERTY THAT REPLACED IT**, with the red re-witnessed first: emptying `COINCIDENTAL_COLUMN_MATCH` gives `Producible: [listTenants, openByoaEscalation]`, the `reason` column on `onboarding_forced_step` making a BYOA move look mountable **at four tables**. `unproducible` moves 12 → **13** and the two sets now PARTITION the fourteen with nothing set aside. ⚠️ **NOT ONE OF THIS ROW'S SIX ORIGINAL FIGURES WAS REPRODUCIBLE AND THEY ARE LEFT ABOVE AS THE HISTORY THEY ARE** — the population was never recorded. **Re-derived and recomputed on every run** (`tests/contracts/producer-scan-resolver.test.ts`): CONTROL **4** tables · **16** column names; DATA **75** · **372**; console tier **62** required field names; ambiguous **1 · 5 · 8** of 62. **The DIRECTION reproduces — eightfold — and every absolute figure differs.** 🛑 **AND *ambiguous* IS THE WRONG STATISTIC, WHICH IS THIS SLICE'S OWN FINDING (G1777): the measured false positive sat on EXACTLY ONE TABLE.** The honest figure is what a scanner answers YES for while unable to say which table — **7 of 62 against CONTROL, 13 of 62 against BOTH** — against a resolver's **5 of 62**, which does not move with the corpus at all. 🛑 **THE GUARD REPRODUCED THE DEFECT IT POLICES (G1775)**: the `null`-falsifier's first draft flagged `ByoaEscalationRequest -> onboarding_forced_step`, because for a one-field schema *"every required column"* IS *"one coincidental column"* — §5.1, one layer up. The arity clause is argued, not thresholded, and its pinned set immediately found a second single-field schema nobody had enumerated | Reuse §5a's **structure** — anti-vacuity guards, named hold-outs with arguments, equality assertions red in both directions. **Do not point its scanner at `db/migrations/`** — ✅ **and it does not: §4 of the new suite goes RED if it ever does (G1778).** The BLOCKER to widening is removed and the WORK is not done, and the two are different: a map entry is owed per schema across 136 operations, an unmapped one is safe and uninformative, and *which corpus* is per-TIER rather than global (G831) |
| **K6** | ✅ **BUILT 21 Sep 2026** — `tests/http/required-fields-served.test.ts`. **Every mounted operation's response carries every `required` field it declares.** 🛑 **AND IT FOUND ONE LAYER BELOW ITSELF: SEVEN MOUNTED OPERATIONS REACHED NO SERIALISER AT ALL**, so the property was unenforceable for them rather than unmet — `bundle.ts` refuses an external `$ref` and their success bodies reached `errors.yaml`. **CLOSED by G1681, the owner's ruling**, and §2 moved from *21 of 28 serialising* to **28 of 28**. ⚠️ **THE ADDITIVE ESCAPE IS ALSO MEASURED NOW (G1686): `default`-on-`required` across all seven tiers is ZERO**, and re-derived every run. ⚠️ **THE COERCION ARMS ARE STILL OPEN** (G1571, G1683) — serialising is not validating | The one known escape from the producer analysis: a table under an unguessed name passes |

⚠️ **Two reported-but-ungated numbers, both at EXIT 0 today:** `check:citations`
reports **614 SUSPECT** resolving-but-wrong citations (⚠️ **re-derived 21 Sep
2026; it said 613**, over **3183** citations found across **72** documents, of
which **3116** are live and **DEAD is 0**), and `check:counts` reports **147**
lines disagreeing with the tree across **33** documents and **16** governed
totals (⚠️ **re-derived 21 Sep 2026; it said 126 over 14 totals**, and the rise
is the two new governed totals of G1471 matching historical lines plus this
slice's own narrations — **not new drift**), **all classified `HISTORICAL`**.
Derive both rather than reading them: `node tools/check-doc-counts.mjs` and
`node tools/check-citations.mjs`.

🛑 **NEITHER IS GATED AND NEITHER SHOULD BE, WHICH IS A RULING NOBODY HAS TAKEN
RATHER THAN AN OVERSIGHT.** `CLAUDE.md` is explicit that this record narrates its
own corrections deliberately, so a line disagreeing with the tree is often
correct as written — *"do not bulk-edit the HISTORICAL list; every line in it was
read and each is right."* The figures are recorded here so the next reader can
see whether they moved, not so somebody can make them fail.

✅ **THE `modules` HAZARD IS CLOSED — G1472, 21 Sep 2026.** ⚠️ **THIS READ: *"🛑
`modules` has TWO of headroom against `check-doc-counts`'s ceiling of 30. Two
more `model/*.ts` files and every stated module count crosses the band and is
silently skipped — the recorded `contract operations` incident, about to
recur."*** It was exactly right. The ceiling is **60**, raised on a MEASUREMENT
rather than a feeling: at a ceiling of 200 this metric reports TEN lines and at
30 it reports **the same ten**, every one a claim about our own module count, so
**nothing foreign enters** — the nouns are qualified (`TypeScript modules`,
`model modules`, `modules under`) and the archived application's *"128 across 6
modules"* uses the bare word and matches none of them. That is the check 400
failed for `contract operations`.

🛑 **AND EVERY BAND NOW REPORTS ITS HEADROOM ON EVERY RUN**, because
`tests/tools/band-does-not-silence.test.mjs` makes the CROSSING a red gate and
structurally cannot warn before it — it goes red in whichever slice happens to
add the module. ⚠️ **IT FIRED IMMEDIATELY AND FOUND ONE THIS PLAN HAD NOT NAMED:
`visuals: 1, floor 1 — 0 of headroom`** (G1480, ⛔ reported, not fixed), which is
`CLAUDE.md`'s own recorded incident for that exact metric arriving from the other
end. `scope dimensions` and `invariants` are also within three of a floor.

✅ **THE `visuals` FLOOR IS CLOSED — G1771/G1772, 21 Sep 2026, WITH K5.** ⚠️ **THE
PARAGRAPH ABOVE IS KEPT RATHER THAN EDITED, because half of it was right and the
half this plan repeated elsewhere was too strong.** The band is `[0, 30]`:
**ZERO is a reachable value of this metric** — G264 deleted nine visuals in one
commit — **and a floor that excludes a value its own subject can take is hiding
its own numbers, not a foreign subject.** 🛑 **THE SILENCE WAS LIVE, NOT
PROSPECTIVE, AND IT WAS WITNESSED**: at the floor of 1, a `docs/INDEX.md` line
reading *"The repository ships 0 visuals."* — WRONG, the tree holds 1 — produced
**no finding at EXIT 0**, while lines on the same metric saying 2, 9 and 10 were
all reported. ⚠️ **MEASURED BEFORE THE CHANGE, which is the check 400 failed for
`contract operations`: the metric reports THE SAME SEVEN LINES at floor 1 and at
floor 0.** 🛑 **AND THE CLAIM THIS PLAN MADE — *"every stated visual count in the
repository goes silently unchecked"* — OVERSTATED IT AND IS CORRECTED HERE**:
`band-does-not-silence` would have made that deletion a RED GATE. **What the fix
buys is the live blind spot, plus the removal of a pre-emptive red on a
legitimate deletion.** ⚠️ **AND A SECOND DEFECT FELL OUT OF THE FIRST (G1772): a
floor of 0 cannot be crossed, so reporting `1 of headroom` against it is a
permanent warning about an impossible event** — in a block headed *"raise the
band DELIBERATELY"*, which is G95's argument about a signal that is always on.
**`scope dimensions` and `invariants` are untouched and still within three**;
both floors are above zero and both can genuinely be crossed.

---

## 7 · The pack, read adversarially

🛑 **THE PACK'S LEGEND IS THE MOST DANGEROUS SENTENCE IN IT.** `specified` is
*defined* as *"Decided and written down… **Safe to build without a second
conversation.**"* That sentence asserts all 50 `specified` rows are TASKs. It is
false for at least nine, and false **precisely where a second conversation is
mandatory** — a build agent trusting the legend takes a ruling without asking.

> ✅ **R16 WAS TAKEN ON 1 Oct 2026 — THE OWNER'S, G2442 — AND IT DECLINED THEM
> ALL; THE TABLE BELOW IS KEPT AS THE FINDING IT WAS.** Every row it names now
> carries `refused` in `docs/handoff-pack/Functional Specification.dc.html`,
> with its reason on the row. ⚠️ **"NINE" DOES NOT REPRODUCE (G2448)**: resolved
> BY NAME, because this section's `#N` do not reproduce (G1345), the list is
> **eleven rows — ten `specified` and one `not built`**: `#83` is P8's
> `Migration is all-or-nothing`, and `#72` is `Waived knowingly`, the `not
> built` copy of `#15`'s decision, moved with it so the pack does not go on
> saying a declined waiver is owed. The walk afterwards: `built 242 ·
> specified 40 · not built 58 · partial 7 · refused 16`.

| row | why the legend is wrong about it |
|---|---|
| **#93** H1 · *the unsupportable customer, **priced*** | Carries a price. `PRODUCT.md`, which `CLAUDE.md` calls the authority: *"NEVER — a named customer, logo, testimonial, **price**, SLA, or benchmark. None have been established. Do not invent one."* |
| **#104** H5 · *legal hold, and only that* | A break-glass into `statutory`, against invariant 8 verbatim — *"**`statutory` appears in neither, at any price**"* — and **the tree enforces it**: `0008` seeds `statutory` into `non_delegable_resource`. **INEXPRESSIBLE as specified**; building it is an invariant amendment, in writing, as G60 was |
| **#68–#71, #83** | Their own text says *"**Commercial and security, not technical, and run by 1CloudHub**"* |
| **#15 / #72** C5 · *one-person finance team* | Ships a switch that disables four-eyes. **The pack files the same decision twice with two different statuses** |
| **#34 / #35** C9 | Both end in a credential or an inbound mail domain we operate. `secret` reach is governed by **three** constants, not two |

**🟢 SIX ROWS ARE ALREADY BUILT AND EACH COSTS A SLICE IF TAKEN** (W0-e):

| row | the pack says | the tree says |
|---|---|---|
| **#96** H2 | *"Nothing persists the sequence, the force or the mark"* | **all three persist** — `0030`'s two tables, `listTenants` mounted, `stage` derived |
| **#13** C5 | `specified` | built end to end. ⚠️ **And the pack carries this row's name TWICE with two different statuses — the only name in 358 rows that does.** The `built` copy **overstates**: it claims the check *"no longer passes vacuously"* while `model/approval.ts` says the agent arm **is** vacuous and the caller must read a `vacuous` flag |
| **#45** C9 | *"a floor per document type — not built"* | **built, and FINER than specified** — `0160` adds `confidence_floor` keyed per tenant, per document type, per field path. What is absent is the *surface*, which is #98's claim |
| **#4** E1 | *"no error taxonomy is written"* | `errors.yaml` has **88** members. ⚠️ The rest of the row stands, and `errors.yaml` names **no HTTP status at all** |
| **#12** C4 · *needs authority* | `specified` | built |
| **#97 / #113** | *"not a version" / "no subject index"* | `pack_catalogue` is keyed `(pack_key, pack_version)`; `0012` creates `tenant.subject_index_entry` |

⚠️ **AND ONE HAZARD THAT LOOKS LIKE AN IMPLEMENTATION.** #101 says the grant
ceiling must be **per customer**. `tenant.grant_duration_ceiling` is keyed
`(purpose, max_hours)` — a platform constant. Somebody "implementing" the row by
editing those rows would **silently move G75's 90-day `delivery` ceiling for
every tenant at once.**

> ⚠️ **THE HAZARD IS REAL AND THE KEY IS MIS-STATED, WHICH MAKES IT WORSE THAN
> WRITTEN — G1341, 21 Sep 2026.** `(purpose, max_hours)` is the INSERT column
> list; the **PRIMARY KEY is `purpose` ALONE**, and there is **no `tenant_id`
> column in that table at all**. Derive it, never read it:
> `grep -n 'CREATE TABLE tenant.grant_duration_ceiling' db/migrations/0008_staff_grant_selection.sql`.
> So a per-customer ceiling is not merely unbuilt there, it is
> **INEXPRESSIBLE** — the policy at `0008` joins the ceiling by `purpose` only —
> and the two seeded rows are `('delivery', 2160)` and `('incident', 24)`, the
> 2160 spelled `24 * 90` in the migration because it **is** G75's ceiling.
> **The row is annotated in the pack, at the point an implementer meets it, and
> nothing in that table was changed.** ⚠️ G75 was taken over a written
> objection and the record says *"do not quietly narrow it back"* — **which
> binds in both directions.**

---

## 8 · The deploy sequence

**Preconditions, every time:**

```bash
export AWS_PROFILE=crm-frontend          # the CLI default is ANOTHER account
node tests/e2e/probe-deployed-image.mjs  # read-only; four describe-* verbs
```

⚠️ **Every `cdk` command in this app needs `-c planeImageTag=<40-hex>`**, because
`buildApp()` constructs every stack. Derive the running sha from the probe above,
never from a branch.

**Order, and the reasons are not stylistic:**

1. **`cdk deploy reconcile-pipeline-staging`** — carries W0-b's buildspec repair.
   The buildspec is INLINE on the project, so the repair reaches AWS only this
   way. **This is not a `Planes` deploy**; G1012's hazard is not engaged.
2. **`Edge` before the pipeline's frontend half.** The pipeline
   `Fn::ImportValue`s two exports `reconcile-edge-staging` does not yet publish,
   and that stack sits in `UPDATE_ROLLBACK_COMPLETE`. `deploy-handoff.md`'s
   section titled *"WHERE THE 20 Sep 2026 W1-G SLICE STOPPED"* §11 is the order.
3. **`RunQueue`** — R-W's scheduled task and its own role. Joined to `Planes` by
   NAME (`iam.Role.fromRoleName()`), so no export is minted and no `Planes`
   deploy follows.
4. **`Planes` LAST, and only when an image must move.** CDK mints a cross-stack
   export per attribute READ, and a new export on `Planes` is a `Planes` deploy,
   which G1012/G1013 measure as rolling both planes back to **an image ECR has
   EXPIRED**. Measure before and after: the synthesised templates for `Planes`,
   `Network`, `Edge`, `Storage`, `Observability` and `Data` should be
   **byte-identical** unless the slice intends otherwise.

✅ **W0-c LANDED ON 21 Sep 2026 — G1321–G1325 — AND THE PARAGRAPH BELOW IS
CORRECTED RATHER THAN DELETED, because it is the instruction a reader would
have carried forward and its first half is unchanged and still the reason any
of this matters.** IT READ: *"🛑 **AFTER EVERY DEPLOY, CHECK FOR A SPLIT FLEET
UNTIL W0-c LANDS.** The Deploy stage deploys the **control plane first**, so an
abort between the two leaves the **data plane on the previous image** — and the
data plane is the one that publishes to the queue and reads the control roster.
**Every stack-level check reports that fleet healthy.** Read the probe's printed
tag lines by hand; its exit code cannot tell you."*

**The last sentence is now false and it is the only one that is.** The probe
answers **exit 3 and prints `*** SPLIT FLEET ***`**, distinguishably from
ordinary drift at exit 1, and it withholds the `cdk deploy` command in that case
because pinning the stack to one of two images chooses which plane is right
(G1325). ⚠️ **STILL RUN IT AFTER EVERY DEPLOY** — it reaches AWS, so G108 keeps
it out of `npm run check` for ever and **nothing runs it but a person.** What is
in the gate is the *judgement*, not the *fetching*: `fleet-image-verdict.test.mjs`
and `probe-deployed-image-render.test.mjs`.

🛑 **A DEPLOYED TASK DEFINITION AND A DEPLOYED IMAGE ARE TWO FACTS.** Nothing in
`npm run check` can compare either to a running service. `RECONCILE_RUN_QUEUE_URL`
was wired into `Planes` on 20 Sep 2026 and **the fleet still runs a commit that
contains no `server/data-plane/run-queue.ts` at all** — the env var is set and
the code that would read it is not in the image.

---

## 9 · What this plan deliberately does not do

- **It does not relitigate `docs/HANDOFF.md` §3.** Challenge a row in writing,
  with the quote, or leave it alone.
- **It takes no ruling.** R1–R16 are listed with what each blocks and nothing
  else. Two — R-W and R-P — were taken by the owner on 21 Sep 2026 and are
  recorded as theirs.
- **It claims no customer, price, SLA or benchmark**, and it names the one pack
  row that would instantiate one.
- **It does not touch AWS.** Every figure about the account carries the read-only
  command that produces it.

## 10 · What could not be determined

1. **Whether the deployed fleet is split right now.** ⚠️ **STILL UNDETERMINED,
   AND FOR A NARROWER REASON SINCE W0-c LANDED — the entry is corrected rather
   than deleted, because half of it went false.** It read: *"Needs the probe run
   by hand, and **its exit code cannot answer** — see §8."* **The exit code
   answers now**: `3` and a printed `*** SPLIT FLEET ***`, distinct from drift's
   `1` (G1321). **What is unchanged is the first clause**, and it is a fact
   about the account rather than about the code: the probe reaches AWS, G108
   keeps it out of the gate, and **nobody has run it against this fleet.** One
   command: `AWS_PROFILE=crm-frontend node tests/e2e/probe-deployed-image.mjs`.
2. **Whether ECS resets `service.taskDefinition` on a circuit-breaker rollback.**
   Taken from a comment. **If false, the rollback detector has been vacuous since
   it was written.**
3. ✅ **SETTLED 21 Sep 2026, BY MEASUREMENT, BY THE C-1/C-2/C-3 SLICE — AND THE
   ANSWER IS NOT THE ONE THE QUESTION EXPECTED.** The question read: *"Whether
   `listTenants` answers anything but a 500 in the deployed fleet.
   `console-roster-store.ts` refuses the WHOLE read when any roster tenant lacks
   an onboarding row, and the only writer is `seedTenancyRoster()` as the admin
   at provisioning time. Check this before mounting more console reads."*

   **Three arms, run against a live PostgreSQL 14.18 through the real store:**

   | fixture | `readConsoleRoster()` | served |
   |---|---|---|
   | an EMPTY roster | `ok: true`, `tenants: []` | **200** |
   | a roster row with NO onboarding row | `onboarding_record_absent` | **500** |
   | the seeded fixture (3 tenants) | `ok: true`, 3 rows | **200** |

   🛑 **THE 500 IS UNREACHABLE IN PRACTICE AND THE REASON IS THE SEED.**
   `seedTenancyRoster()` writes the roster row and the onboarding row **in ONE
   transaction** — `server/control-plane/provision.ts`, and its header says so —
   so the only writer this repository has cannot produce the orphan the store
   refuses on. It runs in compose under `RECONCILE_DEV_SEED=1` and in five
   suites' `before`; **it does not run at data-plane boot**, and `createTenant`
   is declared and unmounted, so there is no other writer at all.

   🛑 **BUT THE INTERESTING ANSWER IS THE FIRST ROW, AND IT IS A FINDING RATHER
   THAN A REASSURANCE: ON A FLEET NOBODY HAS SEEDED, `listTenants` ANSWERS
   `200 {"tenants":[]}`.** That is precisely the failure
   `db/migrations-control/0002_tenancy_roster.sql` exists to refuse — G296 and
   G300 both call it *"worse than an honest 404 … indistinguishable from a
   fleet with no customers in it"* — and **the store's whole-read refusal does
   not catch it**, because an empty roster is not a row it cannot read. Deployed
   staging has never run the seed, so that is what it would serve.

   ⚠️ **IT IS UNREACHABLE THERE FOR A DIFFERENT REASON, WHICH IS WHY THIS IS
   REPORTED AND NOT REPAIRED**: R-P's platform-role seed is behind
   `RECONCILE_LOCAL_TEST_AUTH`, so **deployed staging has no console principal**
   and every console operation answers 403 before a roster is read. **The empty
   array is a live defect with no live caller.** Closing it means deciding what
   an empty fleet MEANS — a legitimate first day, or a database nobody
   provisioned — and that is a ruling, not a commit.
4. ✅ **SETTLED 21 Sep 2026, BY A ROW-BY-ROW JOIN — G1735 — AND THE ESTIMATE
   THE ITEM QUOTED IS NOT MERELY WRONG, IT WAS NEVER REPRODUCIBLE.** The
   question read: *"Which of the 242 `built` pack rows are also built in this
   repository's sense. `CLAUDE.md` estimates ~12; the aggregate ratios make that
   plausible (26/136 operations, 3/12 routes) but nobody has joined them row by
   row."*

   **`docs/build/pack-tree-join.md` joins them, BY NAME**, against
   `integrate/all-sixteen`:

   | | |
   |---|---:|
   | fully built — the chain closed end to end | **5** |
   | partially built, gap named | **41** |
   | drawn only | **196** |

   🛑 **~12 MATCHES NEITHER BAR AND SITS BETWEEN THEM, because the estimate
   never said which bar it used** — a count with no stated predicate cannot be
   right or wrong, only unreproducible. **The strict answer is 5; the loosest
   defensible one is 46.** ⚠️ **The 5 is DERIVED and the 41 is JUDGED**, and
   the join page says so: no control in `npm run check` governs any of the
   three.

   🛑 **ALL FIVE FULLY-BUILT ROWS ARE H2 ONBOARDING, AND ALL FIVE BECAME BUILT
   IN THIS WAVE.** Before `1799e111`, the answer to this item was **zero**.
   That is the useful half: the fraction is not a progress bar creeping up —
   **it moved 0 → 5 when one slice mounted three operations over a table that
   already existed.** The cheapest next increment is the join's §4a, **eleven
   rows whose server side is finished and served, waiting only on screens.**

   ⚠️ **AND THE ITEM'S OWN AGGREGATE-RATIO REASONING IS THE PART TO STOP
   REUSING.** `26/136` and `3/12` are ratios over the TREE; 242 is a count over
   the PACK, and §1 of the join shows the two `built`s measure **different
   objects** — 196 rows describe behaviour of documents in
   `docs/handoff-pack/`, which building the product will never move. **A ratio
   between them was never going to estimate anything.**
   ⚠️ **The pack's status column is untouched, on PR #467's rule.**
5. **Whether `runSetReconciliation()` is fast enough to run inside one
   `withTenantScope()` transaction** for a real document set. Every call site
   today is a test with a small fixture, and `subsetSumBound`,
   `readerCandidateCap` and `similarityMaxChars` all exist to bound it. **A
   long-running engine call holding a transaction open is a pooling question
   under G101.** E5 owes a measurement or an explicit statement that it is
   unmeasured.

   🛑 **E5 ANSWERED WITH BOTH, 21 Sep 2026 — G1524 — AND THE ITEM STAYS OPEN
   BECAUSE THE SECOND HALF IS THE HONEST ONE.**
   **MEASURED:** `tests/db/run-executor.test.ts` §7 times the whole scope and
   PRINTS it — single-figure milliseconds against two documents of one row
   each. **That is evidence about a fixture and about nothing else**, and §7
   asserts NO THRESHOLD deliberately: an `assert.ok(scopeMs < N)` on shared CI
   hardware is flaky, and worse, it would read as though somebody had
   established that N is right for a real corpus.
   **UNMEASURED:** nobody has run it against a real corpus, because **no real
   corpus exists in this repository** — nothing has ever ingested a production
   document, so there is no set to time. The three bounds are a reason to
   expect survivability and **a bound is not a measurement**.
   ⚠️ **AND THE POOLING HALF IS UNCHANGED AND IS WHY THIS IS NOT A PERFORMANCE
   NOTE**: under G101's transaction-mode pooling a connection is held for the
   LIFE of the transaction, so **a slow run does not merely take a long time —
   it takes a connection away from the serving plane.** The answer this item
   needs is a ruling about where the engine runs, not a change to
   `run-executor.ts`.

8. **What happens when execution exceeds the run queue's visibility timeout**
   — NEW, 21 Sep 2026, G1525, and it is named here because E5 made it live.
   `RUN_QUEUE_VISIBILITY_SECONDS = 30` and item 5 says plainly that a real
   document set may exceed it, in which case a second worker starts a second
   execution of the same run.
   ✅ **WHAT IS SETTLED: exactly ONE account row survives**, and it is
   `run_engine_account`'s PRIMARY KEY that does it — **not `run_idempotency_key`,
   which is about ADMISSION** — witnessed at `tests/db/run-executor.test.ts`
   §6, §6a and §6b.
   🛑 **WHAT IS NOT SETTLED: the duplicated WORK is real** — a second pooled
   connection, a second engine run and a second block on a row lock, all
   discarded.
   🛑 **AND D-1 MEASURED IT FROM THE CONSUMER SIDE AND FOUND THE WORSE HALF: a
   45-second run becomes visible again at 30s and the next tick executes it
   CONCURRENTLY, and after `RUN_QUEUE_MAX_RECEIVE_COUNT` deliveries a run that
   SUCCEEDS EVERY TIME lands on the dead-letter queue — so the dead-letter
   alarm fires REPORTING THE OPPOSITE OF WHAT HAPPENED.** A green run, alarmed
   as a failure. **Nothing in E5 prevents that.**
   ✅ **WHAT E5 AND E6 ADD IS THAT THE FALSE ALARM IS FALSIFIABLE, AND BEFORE
   THEM THERE WAS NOTHING TO CHECK:** a DLQ'd `(tenantId, runId)` resolves
   against `tenant.run_engine_account` — `produced` means the run SUCCEEDED and
   the alarm is wrong; `refused` means the engine refused it and
   `tenant.run_refusal` says why; **NO ROW is the only case where the DLQ
   message means what it says.** A triage, not a repair. Raising the timeout or
   heartbeating the message are both `infra/` changes with costs, and **where
   the worker runs is still undecided** (R-W names a scheduled ECS task;
   `sqs:ReceiveMessage` is granted to nobody). Choosing a timeout before
   choosing a process is choosing the wrong thing first.

   ✅ **THE TIMEOUT IS RAISED — G1834, 22 Sep 2026, THE OWNER'S RULING — AND
   THE PARAGRAPH ABOVE IS QUOTED WHOLE RATHER THAN EDITED, because "choosing a
   timeout before choosing a process is choosing the wrong thing first" is the
   objection the ruling had to answer rather than a stale fact.** **The
   process WAS chosen first (R-W, a scheduled ECS task, 21 Sep 2026), and this
   is the timeout chosen after it.** `RUN_QUEUE_VISIBILITY_SECONDS` is now
   **1800** (30 minutes), named on its own declaration as a policy choice
   bounded by nothing measured — no real document set has ever been timed in
   this account, so this raises the ceiling on a MEASURED failure mode
   without claiming to have measured the number that would eliminate it.
   `RUN_QUEUE_MAX_RECEIVE_COUNT × RUN_QUEUE_VISIBILITY_SECONDS` — the
   dead-letter arrival time — moves from 150s to 9000s (2.5 hours), asserted
   at `tests/infra/run-queue.test.mjs` §9 rather than left to be derived by
   hand. **Neither the heartbeat nor the database execution lease was
   taken** — both stay open, named by the same paragraph above, and this
   ruling does not close either.
6. **Whether the true status of `S1 · Staff console` is `built` or `specified`.**
   The file carries both. **Only whoever made the edit at line 87 knows.** One
   line to fix.
   > 🟠 **THE MARKUP IS FIXED AND THE QUESTION IS NOT ANSWERED — G1333,
   > 21 Sep 2026, and it stays on this list.** ⚠️ **AND IT IS NOW KNOWN TO BE
   > UNANSWERABLE FROM THIS REPOSITORY**, which is more than the item above
   > claimed: the malformation is present in the pack's **first commit here**,
   > `77f2ef1cd`, so `git log` and `git blame` cannot reach the edit —
   > `git show 77f2ef1cd:'design/handoff-pack/Functional Specification.dc.html' | sed -n '87p'`.
   > **`built` is KEPT, on surrounding evidence recorded on the row itself**:
   > the table is captioned *"What has been drawn, and which file holds it"*,
   > the row's File cell names `S1 Staff.dc.html` which exists at 136,065 bytes,
   > and **all eight rows of that table are `built`** — a `specified` row naming
   > an existing drawn file contradicts the pack's own legend
   > (*"with NO SURFACE YET"*). **The orphan is preserved verbatim in a comment
   > rather than deleted**, tags HTML-escaped so no grep counts a phantom.
   > 🛑 **WHAT REMAINS GENUINELY OPEN: whether the orphan was a ROW IN ITS OWN
   > RIGHT** — its subject is signing into a customer tenant bounded by the
   > support access mode, which is a sub-feature claim rather than a claim about
   > whether S1 was drawn. **If it was, it has been lost since `77f2ef1cd` and
   > nothing here can restore its heading.** Only the pack's author can say.
7. **Whether the CodeBuild PR gate is enabled in `000000000000`.** It is `off`
   unless `-c pullRequestGate=on`, and the stack says so in its own voice:
   *"WITH THE FLAG OFF NOTHING CHECKS A PULL REQUEST."* That is a fact about the
   account.

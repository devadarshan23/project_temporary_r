# Red-team audit, round three: the customer portal (C1 Close and its drill-downs)

> **STATUS:** REPORT. It decides nothing. `docs/HANDOFF.md` §3 outranks it. The
> owner's rulings are taken as givens: **G3091** (pack-faithful, quiet: a muted
> control with a `Coming soon` tooltip is not a finding), **G3193** (a refused
> control is hidden), **G3423** (the Action column is the row's next act),
> **G3428** (sign-in copy) and **G3430** (the quiet Accept keeps the filled commit
> shape).
>
> Audited 4 Oct 2026 against `origin/main` @ `c8fed3c2` (after #567). The prior
> rounds were `red-*.md` and `reaudit-*.md` in this directory. **No product code was
> changed.**

## How it was rendered

- `npm ci && npm run build:frontend`.
- A private PostgreSQL 14 cluster at `/private/tmp/claude-501/pg-redc1r3`, port
  55471, with `RECONCILE_DB_PORT`, `RECONCILE_CONTROL_DB_PORT`,
  `RECONCILE_CONTROL_READ_DB_PORT` and `RECONCILE_CONTROL_WRITE_DB_PORT` all pointed
  at it. The data plane came from `resetSchema()`, and the control plane came from
  `provisionControlPlane()`, with roster rows for `ten_acme` (*Meridian Group Pte
  Ltd*) and `ten_mock`.
- The seeds were applied as the migrator:
  - **`db/seeds/staging-demo-data.sql`**: the demo data generator's output. It gives
    Meridian five reconciliations, about 20 exceptions, proposals and approvals.
  - **`db/seeds/staging-mock-personas.sql`**, run twice. Between the two runs I
    inserted the five customer personas on `idc_mock_customer` to simulate R5's
    first-sign-in provisioning. The second run granted their `ten_mock` roles.
- **One audit-only fixture step.** The persona roles (`rol_mock_admin`, `_approver`,
  `_operator`, `_viewer`) were copied onto `ten_acme`, and each persona got a
  membership there. That let admin, approver A and B, operator and viewer walk the
  rich Meridian scenario. Each persona got a session bound to each tenant's host:
  `127.0.0.1:8080` for `ten_acme` and `127.0.0.1:8091` for `ten_mock`.
- The real data plane ran with the production authoriser and no test-auth flag,
  behind `tests/e2e/single-origin.ts`. Chromium (Playwright) rendered at 1440,
  1024, 820 and 390, in light and dark, with reduced motion as one variant.
- **Three fixture edits were made mid-audit to reach flows the seeds cannot:**
  - A one-disposition pack (`pck_r3_one`) was mapped to Card settlement and to Bank
    to ERP, so the register's Accept could post directly. In the demo seed every
    definition offers four or five dispositions, so Accept always routes to the
    finding.
  - The archetype of `def_mock_three_way` was removed temporarily, to produce
    `resolution_not_configured`.
  - One parked arrival with a held artefact was added, to give the parked pile a
    subject. Neither seed parks anything.
- Error and loading states were produced by intercepting `/v1/**`.
- The frames are in `screens/red-c1-round3/` (104 PNGs). The pack's own C1 is in
  `pack-c1*.png`. The capture scripts were scratch and are not committed.

Severity: **S1** misleads the reader or blocks a journey · **S2** visibly off-pack
or a broken interaction · **S3** an inconsistency a reviewer would flag · **S4**
polish.

Counts: **S1 · 7 · S2 · 12 · S3 · 8 · S4 · 4** (31 findings).

---

## S1

### C3-01: every produced run's account page renders a blank white screen

`/close/run/run_demo_3wm_w10` crashes, and so do the `bank`, `card` and `ic` runs.
React throws `TypeError: Cannot read properties of null (reading 'toLocaleString')`
and unmounts the whole tree, chrome included. The residue table does
`countOf(row.ref.lineIndex)` (`frontend/src/components/RunAccount.tsx:404`), and the
plane serves `lineIndex: null` for header-grain documents. Every residue item in the
demo seed has a null `lineIndex` (`GET /v1/runs/run_demo_card_w10/residue`). Only a
run with no account renders, for example the refused payroll run. So the page
reachable from every strip cell's run line is blank for every run that produced
anything. Frames: `run-run_demo_3wm_w10.png` and `run-3wm-admin.png` (both blank).
Pack: the drawn record's `/close/run/:runId` five panels.

### C3-02: the Variance column invents a direction

`Delta` in the model is `{ kind: 'money'; absolute: Money … }`
(`model/domain.ts:4770`): a magnitude. The seed stores it unsigned. The engine's
residue carries `signedVarianceMinor: "-41235"`, but the exception's delta holds the
absolute value. `varianceFigureOf()` (`frontend/src/close-state.ts`, G3544) then
prefixes `+` to anything not starting with `-`. The result, on one row:

- The line text says *"…the engine declined the pair at a variance of **-SGD 412.35**"*.
- The Variance cell beside it reads **`+412.35`**.

The totals row sums the magnitudes as if they were signed (`+20,938.55` for the
operator's 20 lines). C1 draws the Variance column signed because the sign means
*the invoice is over the order*. Here the sign is fabricated for every
under-variance. Frames: `close-operator-1440.png`, `flow-card-before.png`. Pack:
`C1 Close.dc.html` register, `Variance SGD` column and totals
`+112,204.00`. **Ruling needed:** store a signed delta, or draw the figure unsigned.

### C3-03: refused controls are drawn on the finding, the approval and the queue (G3193)

Each of these was verified by clicking:

- **The finding (`/close/finding/:ref`).** The viewer and approver A, neither of
  whom holds `propose_resolution`, are given the full *Propose a resolution* form:
  five dispositions, the rationale box and `Propose`. `ResolvePanel` reads no
  capability (`frontend/src/components/Resolve.tsx`). Frames:
  `finding-viewer.png`, `finding-approver.png`.
- **The approval page (`/close/finding/:ref/post`).** The viewer is offered
  **Approve** and **Refuse**. Clicking Approve answers *"Your role cannot do this."*
  after a 403 (`flow-q5-viewer-approve-*.png`). On an executable proposal the
  viewer, the operator and both approvers are offered **Post it**
  (`flow-p4-viewer-post-page-before.png`). `actsFor()`
  (`frontend/src/resolve-logic.ts:71`) decides `mayDecide` and `mayPost` from the
  proposal's state and the viewer's id, never from `approve_resolution` or
  `execute_resolution`.
- **The queue.** Every queue card shows a filled **Review** for the viewer
  (`ApprovalsQueue`, `Approvals.tsx:474`).

Pack: C1's own sentences say every control that would change something is *"absent
rather than disabled"* for the assurance reader (`C1 Close.dc.html:254`), and absent
rather than *"drawn and refused"* for the approver (`:257`).

### C3-04: the four-eyes panel contradicts what the plane will do

Take a proposal below the policy threshold, for example *Medium · SGD 32,400*.
`approval_config` makes approval mandatory only at or above *high / SGD 50,000*.
For that proposal, every surface around it says something different:

1. The card's state is **"Approved · ready to post"** (`words.ts:132`), but nobody
   approved it.
2. The card shows **"Approvals 0 of 2"** and **"2 more approvers are needed —
   someone other than the proposer."**. `approvalsCounted()` and `ProposalCard`
   use the quorum whether or not approval applies (`resolve-logic.ts:92`,
   `Approvals.tsx:124`).
3. The finding page says **"Proposed. Nothing is posted yet — it waits on an
   approver, and you cannot approve your own proposal."** This sentence is
   hard-coded on every successful propose (`Resolve.tsx`).
4. In the admin's queue the card says **"You proposed this — another approver has
   to act."** (`Approvals.tsx:470`).
5. The proposer then presses **Post it**. The plane posts it: *"Approved by
   policy · posted by usr_r3_admin"*.

So a reader is told four eyes are pending on a line that the proposer posts alone.
Frames: `flow-p1-admin-low-propose.png`, `flow-p1-admin-low-post-*.png`,
`flow-p2-*`. The four-eyes refusals themselves are good when they are real. On a
mandatory line the segregation sentence appears, Approve is absent for the
proposer, the second approver lands *"Approved. It is ready to post."*, and refusal
records its reason (`flow-q*-*.png`).

### C3-05: people are shown by raw id

- *"Proposed by **usr_r3_admin** (you)"*.
- The four-eyes list reads *"Approved · **usr_r3_approverA**"*.
- The post result reads *"Approved by usr_r3_approverA, usr_r3_approverB · posted
  by usr_r3_admin"*.
- The finding's chip reads *"Assigned · **usr_demo_rosalie_tan**"*.

Sources: `Approvals.tsx:110,119,322-326` and `Finding.tsx:133`. The principal read
(`getSessionPrincipal`) already names the viewer, and the register already says
*"with a colleague"*. These surfaces bypass both. Pack: C1 names people
(*"Rosalie Tan"*, *"Mark Teo, the approver"*). Its hard rule is no raw ids.

### C3-06: the user, the approver and the viewer have no reconciliation strip

`listRuns`, `getRun`, `getRunAccount`, `listRunResidue` and `listIntakeChannels`
are all `x-capability: admit_source` (`docs/contracts/capability.openapi.yaml:113,
145, 227, 326, 458`). The seeded *User*, *Approver* and *Assurance reader* roles
do not hold it. For each of them, C1 opens on:

> **Runs are not part of your role** · The register below is still yours.

(`Register.tsx:134`.) The consequences:

- **No strip.**
- **An unscoped register.** It shows twenty lines across five reconciliations, with
  *"Meridian Group Pte Ltd · no period"*.
- **No run-scoped claim.** The run line is replaced by *"THE CLOSE"*.
- **A wrong run-page error.** The run page answers the 403 with *"This could not be
  read. Try again in a moment."* (`run-3wm-operator.png`). That is wrong for a role
  refusal, because retrying never helps.

C1's protagonist is a **user** (*"Rosalie Tan · user"*), and the whole surface is
drawn around her strip. Frames: `close-operator-1440.png`, `close-viewer.png`,
`close-approver.png`. **Ruling needed:** gate the read of runs on
`view_exception` or `view_dashboard`, or give the user role `admit_source`.

### C3-07: "need you" is not role-aware

The viewer and approver A both read **"Good morning, … Ten of the twenty exceptions
need you."**, and the bell says **Needs you 10** for every persona. Neither the
viewer nor the approver can act on any line. Every Action is *View*, and the
approver's work is approvals. The pack's assurance-reader and approver states say
the opposite: triage controls are absent, and *"what waits on you is in
Approvals"* (`C1 Close.dc.html:254-257`). The count is
open-and-unassigned-or-mine regardless of role. Frames: `close-viewer.png`,
`close-approver.png`.

---

## S2

### C3-08: Approvals is not a destination, and the queue is not scoped to the run

The pack's chrome is `Close · Ask · Approvals {{ apprWaiting }} · Reports`
(`C1 Close.dc.html:33`). The app has no Approvals tab for anyone, including holders
of `approve_resolution`. The queue is drawn under the register only when the
**selected run** has a waiting line (`main.tsx:1205`):

- An approver who opens Card settlement sees nothing waiting.
- When it is drawn, it is tenant-wide. The Three-way match view lists *IC-430*
  (Intercompany), and the Bank to ERP view lists three Three-way match proposals.

The reason G3436/G3469 gave, *"nothing the client holds says who is one"*, ended with
G3522: capabilities are now on the principal. Frames:
`admin-3wm-1440-full.png`, `parked-admin.png`. **Ruling needed.**

### C3-09: "In variance" disagrees with the Variance column

Three-way match shows **In variance SGD 522,684.00** above a register whose Variance
total is **+18,340.00**. `ARRIVAL_SIDE = 'left'` sums the left side's unsettled
residual, which includes the full value of every unmatched line
(`close-state.ts:295-330`). In the pack the two agree: *In variance SGD 112,204.00*
and totals *+112,204.00*. Frame: `admin-3wm-1440.png`. **Ruling needed:** what *In
variance* means.

### C3-10: a non-terminal Accept says "posted" and leaves a dead Accept behind

On a one-disposition line, Accept proposes and executes *Carry as a timing
difference*. The toast says **"Accepted and posted — Carry as a timing difference.
It is reversible for 24 hours from the post. Undo"**. The disposition is
non-terminal, so the line becomes **Investigating** and still offers **Accept**.
Pressing it answers **"Nothing changed. No resolution is open to you on this line."**
(`register-acts-run.ts:125-140`). Frames: `flow-card-accept-posted.png`,
`flow-card-accept-again.png`, `flow-bank-accept-toast.png`.

### C3-11: Reopen is offered after the reversal window has closed

The register draws **Reopen** on a line resolved on 5 Mar. The dialog takes a
reason, then answers **"Nothing changed. This resolution can no longer be reopened
— it is reversible for 24 hours from the post."** (409
`reversal_window_expired`). `drawnActOf()` (`register-acts.ts`) knows nothing about
when the resolution was posted. Frames: `flow-reopen-dialog.png`,
`flow-reopen-done.png`. The dialog itself is well behaved: Reopen stays inert until
a reason is chosen, Tab is trapped, and focus returns to the row's button.

### C3-12: Undo is recorded as a judgement failure

Undo of a register Accept reverses with `UNDO_ACCEPT_REASON = 'wrong_disposition'`
(`register-acts.ts`). The Reopen dialog itself says that reason *"counts against
the judgement that resolved it"*. A person undoing their own mis-click therefore
inflates the disposition's reversal rate. Witnessed in
`tenant.exception_reversal` (`exc_demo_bank_w10_03 | wrong_disposition`). The flow
itself works: *"Undone — the line is open again."* (`flow-bank-undo.png`).
**Ruling needed.**

### C3-13: the run page contradicts itself on a refused run, and its copy is jargon

The refused payroll run (`run-payroll-admin.png`):

- It reads *"This run produced nothing: it was refused before anything was matched
  — population empty and not expected."*
- Then, under *What is left open*, it reads **"The engine closed every line.
  Nothing is left open."** (`RunAccount.tsx:376`). This is false: nothing was
  matched at all.
- The headings are *"What the engine did"* and *"No engine account is visible for
  this run"*, and the missing-run page repeats two near-identical *"answers the same
  for…"* paragraphs (RC-29 residual).
- Once C3-01 is fixed, the residue table would show raw `sdo_demo_…` document ids.

### C3-14: the strip's sub-lines are engine vocabulary and are truncated

Ours reads *"completed · 9 need you · 14 raised · engine observed no shortfall"*,
*"failed · no engine account"* and *"running"* (`completeness.ts:67-68`). C1 reads
*"5 need you · 14 open"*, *"clean · 1,184 posted"*, *"reading · 62%"* and
*"extraction stopped"*. At 1440 each sub-line is cut with an ellipsis after the
second clause, so the only clause a reader sees is the one the pack does not use.
Frames: `admin-3wm-1440.png` against `pack-c1.png`.

### C3-15: raw document-type ids on customer surfaces

- **The parked pile's picker** lists `dt_demo_card_receivable`,
  `dt_demo_erp_bank_posting`, … and confirms *"Raised with the FDE as
  **dt_demo_card_receivable**"* (`ParkedPile.tsx`).
- **The Setup sources table** reads *"/settlement/daily/ → dt_demo_acquirer_line"*
  (`Setup.tsx`).

`tenant.document_type.label` exists (*"Card receivable posting (S/4HANA)"*).
Frames: `parked-pane-admin.png`, `parked-raised.png`, `setup-admin.png`.

### C3-16: dark contrast on the strip is 4.10:1

`.close .cell[data-state="completed"] .st { color: var(--recede) }`
(`close.css:191`). `--recede` is `#718a8e`, measured at 4.89:1 **on `--paper`**
(`docs/handoff-pack/tokens.css:463`). The strip cell sits on `--sheet`, where the
11 px sub-line, the status word and the clock measure **4.10:1**. That is below
4.5:1 in dark at every width. The token is also semantically *"CLEARED work"*, not
a completed run's status. Measured by a computed-style scan; light mode has no
failures. Frame: `admin-3wm-1440-dark.png`.

### C3-17: the Parked facet is quiet while a parked delivery is shown above it

The *Awaiting setup* pane reads *"1 delivery parked, awaiting setup · counted apart
from the register's lines"*. Directly below it, the register's **Parked** facet is
`Coming soon`. C1 draws **Parked 1** in the facet. G3501 deliberately counts the
pile apart, so the facet now names a population that is drawn elsewhere and counted
nowhere. Frame: `parked-admin.png`. **Ruling needed.**

### C3-18: an exception with no recorded run is counted but cannot be reached

On `ten_mock`, `exc_mock_bank` has `run_id NULL` (the seed's not-recorded arm,
`0480`). The bell says **Needs you 5**. The run-scoped register (#567) shows four
lines under Three-way match and *"0 of 0 lines"* under Bank to ERP, so the fifth is
reachable from no screen. In the same view, *This run raised 5* sits beside four
lines (a seed mismatch, but the figure is drawn). Frame: `mock-close-admin.png`.
**Ruling needed:** where a not-recorded exception lives.

### C3-19: register rows are still nested interactive buttons

Rows are `tr[role=button]` (verified) containing `<a>View finding</a>` and an Action
link or button. Each row therefore costs three tab stops, two of them to the same
finding (*"View finding"* and *"View"*). No header carries `aria-sort` (all seven
`th` are null) even though *Order by* sorts the table. J/K, ↵ and Esc work, and
focus returns to the row on Esc. This is the residual of RC-22. Frame:
`keys-open-row.png`.

---

## S3

| id | finding | evidence · pack |
|---|---|---|
| **C3-20** | Money is run together as text on the finding, the approvals cards and the queue: `SGD41,880.00`, `SGD96,400.00`. The register is fixed; these surfaces are not (RC-23 residual). | `Finding.tsx`, `Approvals.tsx` `MoneyFig` · pack `SGD 112,204.00` |
| **C3-21** | On a line with more than one disposition (every demo line), register **Accept** navigates silently to the finding's propose form. There is no notice, so the act the reader pressed did not happen. | `register-acts-run.ts` `toFinding` · `flow-admin-accept-posted.png` |
| **C3-22** | With `resolution_not_configured`, the register toast and the finding state it correctly (*"Resolutions are not set up yet."*). The `/post` page instead says *"Nothing is proposed on this finding"*, because its not-configured branch keys on the proposals read, which answers 200. | `Approvals.tsx:292-301` · `flow-not-configured-post.png` |
| **C3-23** | The demo's line text is engine jargon: *"…the engine declined the pair at a variance of SGD 5,200.00"*. It is composed by the generator, so it is data rather than UI copy, but it is the sentence on every demo row. | `db/seeds/generate-demo-data.ts:1270` |
| **C3-24** | The account menu is still a `<details>` with 0 `menu`/`menuitem` roles, and the avatar's sub-line is the org class *"Customer"*, not C1's role line (RC-12 residual). Setup is correctly hidden for non-admins. | `account-menu-admin.png` · Design System primitive 5 |
| **C3-25** | The tenant chip shows the residency token as `US`, not C1's `SG · SGD`. While loading, the status bar says *"no period"* (RC-16 residual). | `state-loading.png` |
| **C3-26** | The queue's heading **"Waiting on an approver"** lists items that are *Approved · ready to post*. They are waiting on a poster. | `parked-admin.png` (queue) |
| **C3-27** | The run page answers a 403 (role) in all three panels with *"This could not be read. Try again in a moment."* (`NOT_READ`). The refusal is deterministic, so retrying never helps. | `run-3wm-operator.png` |

## S4

| id | finding | evidence |
|---|---|---|
| **C3-28** | Eight quiet `Coming soon` controls take tab stops before the register is reached: the lanes, Rename, ← →, *Read by the machine*. | keyboard probe |
| **C3-29** | *"Four of the four exceptions in this run of Three-way match need you."* is awkward wording when the parts equal the whole. | `mock-close-admin.png` |
| **C3-30** | The row's Accept shows no busy state during the 1–2 s propose and execute. | `flow-bank-accept-toast.png` |
| **C3-31** | *"Raise it with the FDE"* uses the acronym alone. The pack says *"1CloudHub FDE"*. | `parked-pane-admin.png` |

---

## What held

- **Errors and loading.** The 401, 404, 500 and 503 pages are E1's shape and
  sentences: *"What to quote"* is now sentence case, and there is no "plane" wording
  any more. 429 and 403 are calm, and loading states its scope.
- **Light, motion and mark.** There is one luminous light per view, on the running
  cell (sweep 17 s, working mark), and none when nothing runs. Reduced motion stops
  both.
- **Tokens and type.** There is no horizontal overflow at 1440, 1024, 820 or 390.
  No hard-coded colours appear in the C1 stylesheets. The type matches the pack: IBM
  Plex Sans and Mono, the same sizes and weights on the figures, headers and status
  bar.
- **Four-eyes on mandatory lines.** Proposer segregation is stated as a state, Approve
  is absent for the proposer, the second approver posts, refusal records its reason,
  and Undo really reverses.
- **Hidden where it should be.** The parked pile hides Raise from roles that may not
  raise. Setup is hidden from non-admins.

## Owner rulings needed

1. **C3-06: who reads runs.** Should `listRuns`, `getRun` and `listIntakeChannels`
   stay on `admit_source`, or open to `view_exception`/`view_dashboard` so the
   user, the approver and the viewer see the strip C1 draws?
2. **C3-08: Approvals as a chrome destination** now that capabilities are on the
   principal. This amends G3436/G3469. Should its queue be scoped to the run?
3. **C3-02 and C3-09: variance.** Should the exception store a *signed* money delta
   (the engine has `signedVarianceMinor`), or should the column drop its sign? What
   is *In variance*: the left side's unsettled residual, or the register's variance
   total?
4. **C3-07: "need you" per role.** Should the viewer and approver get the pack's
   role sentences instead of a count?
5. **C3-12: Undo's reversal reason.** Should there be a non-indicting reason (or a
   distinct undo kind), so a self-undo does not count against the disposition?
6. **C3-17: the Parked facet against the Awaiting-setup pile.** Either count it in
   the facet or retire the facet.
7. **C3-18: where a not-recorded exception (`run_id` null) is shown** under a
   run-scoped register.
8. **C3-10: register Accept on a non-terminal disposition.** Should it be allowed
   from the row, and what should the row show afterwards?

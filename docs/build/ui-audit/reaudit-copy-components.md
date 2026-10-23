# Red-team re-audit: microcopy, component usage, layout and interaction states

> **STATUS:** REPORT. It decides nothing. `docs/HANDOFF.md` §3 outranks it. The
> owner's rulings are applied as givens: **G3091** (pack-faithful, quiet — a
> muted control with a `Coming soon` tooltip is not a finding), **G3193**
> (refused controls are hidden), **G3423** (RC-04: the Action column is the
> row's next act), **G3428** (sign-in copy *"Welcome back. Your close is
> ready."*) and **G3430** (the quiet Accept keeps the filled commit shape).
>
> Re-audited 3 Oct 2026 against `origin/main` @ `5dae45af`, which carries the
> green-team repairs #545 (`fix/ui-foundations`), #546 (`fix/ui-secondary-surfaces`,
> via #547) and #547 (`fix/ui-close-surface`). Prior report:
> `docs/build/ui-audit/red-copy-components.md` (RC-01…RC-35, @ `79631f2e`).
> **No product code was changed.**

## How it was rendered

- `npm ci && npm run build:frontend` (app bundle, SSR prerender, apex site).
- A private PostgreSQL 14 on a loopback port; the **`tests/e2e/close-parity.shot.ts`
  seed** (Meridian Group Pte Ltd; four named reconciliations; periods with
  calendar dates; six exceptions on Three-way match, one held by a colleague,
  one awaiting approval, one resolved), extended in a throw-away copy with:
  `view_document`, `view_dashboard`, `propose_resolution` on the operator
  (display name *Parity Operator*); a second person *Noah Caps* holding a role
  with **no** capability; the colleague as a named user.
- The real data plane (`startDataPlane()`, production authoriser, no test-auth
  flag) behind the same-origin front (`tests/e2e/single-origin.ts`); Chromium
  (Playwright) at **1440 / 1024 / 820 / 390**.
- Loading and 401/403/429/500/503 were produced by intercepting `/v1/**`
  (delay, or a fulfilled status with a closed code). Keyboard paths were probed
  by pressing keys and reading `document.activeElement`.
- The `close-parity.shot.ts` probe was also run as-is; at every width it
  reported `scrollWidth == viewport`, one lit cell, the claim *"Three of the six
  exceptions need you."*, `needsYou 3`, and acts `accept ×4 · view · reopen`.
- Frames: `docs/build/ui-audit/screens/reaudit/` (44 PNGs). The capture script
  was scratch and is not committed.

Severity: **S1** misleads the reader or blocks a journey · **S2** visibly
off-pack / broken interaction · **S3** inconsistency a reviewer would flag ·
**S4** polish.

---

## 1 · Prior findings — status

| id | was | now | evidence |
|---|---|---|---|
| RC-01 | S1 | **CLOSED** | `/ask` and `/reports` are the pack's quiet panes (*"Ask about this period"*, *"Close packs"*, one `Coming soon` each); `/` routes to `/close` signed in and `/signin` signed out; `/invite` is the entry card; `/signin/lapsed` is E1's 401. No route renders the route layer's provenance text (`ask.png`, `reports.png`, `root.png`, `root-signedout.png`, `invite.png`, `signin-lapsed.png`). Residual "plane" wording on the 401 page is carried under RC-28. |
| RC-02 | S1 | **PARTIAL** | Close is clean: strip `Three-way match`…, run line `THREE-WAY MATCH V4 · RUN 03:12`, period `01 – 30 Sep 2026`, status bar `Meridian Group Pte Ltd · 01 – 30 Sep 2026 · Three-way match v4 · run 03:12` (`close-3wm.png`). **Still raw on the run page**: `Definition — Three-way match def_three_way_match v4`, `Period — per_2026_09` (`RunAccount.tsx:458,461`, although `Run` now publishes the period's calendar dates under G3429); **and in both breadcrumbs**: `Close / exc_parity_0001`, `Close / run_parity_0001`, `Close / run_nope` (`Finding.tsx:116`, `RunAccount.tsx:479`) — `finding.png`, `run-noaccount.png`, `run-missing.png`. |
| RC-03 | S1 | **PARTIAL** | "Needs you" is now open-and-unassigned-or-mine: 3, excluding the colleague's line (`mineOrUnassigned`); the register and the claim are scoped to the selected reconciliation. **Residual:** the count line carries no scope (`6 of 6 lines · all lines · ordered by severity` vs C1's `… · 02 – 08 Mar 2026 · three-way match v4 · run 03:12`); the register is scoped to the *definition*, not the run, so the same arrival block reads `Exceptions raised 5` beside *"Three of the **six** exceptions"* (NC-03); and the default selection lands on an empty running reconciliation (NC-02). |
| RC-04 | S1 | **CLOSED** (per G3423) | Action column is `Accept` / `View` / `Reopen` by status (`exc_parity_0004` awaiting approval → `View`; resolved → `Reopen`); `Take it` lives in the evidence panel's *Whose move*, only on open lines; taking over a colleague's line goes through a confirm modal (*"You can undo this from the notice that follows."*, `ExceptionRegister.tsx:674`) and an undo toast. Residual offer of `Accept` on a colleague's line → NC-05. |
| RC-05 | S1 | **CLOSED** | The assignment answer is merged into the row (`mergeAssignment()`, `api/exceptions.ts:452`) — the line keeps its text; the register sends the reader's own user id, and the plane refuses an assignee with no live membership (commit 3a9b4318; e2e §9). Not re-exercised by click in this pass. |
| RC-06 | S1 | **CLOSED** | `document.documentElement.scrollWidth` equals the viewport at 1440/1024/820/390 on every route captured (probe output; `close-3wm-390.png`). |
| RC-07 | S1 | **CLOSED** | Mid keeps every column inside the register's own scroller (`close-3wm-820.png`, Action reached by scrolling the table); narrow has the bottom tab bar `Close · Ask · Reports` (`close-3wm-390.png`). Narrow row fold (value/score/whose-move into a second line) not verified below the fold. |
| RC-08 | S2 | **PARTIAL** | The finding is now the pack's evidence block: breadcrumb (primitive 4), word chips `Critical · Open · Unassigned`, money currency-first and grouped, dated instant (`finding.png`). **Residual:** breadcrumb terminal is the raw id (RC-02); `What you can do` renders a false transient error (NC-01); `0 observed values` is a count, not the values. |
| RC-09 | S2 | **PARTIAL** | Word maps for every enum (`words.ts`), grouped counts, paged tables, trouble-first ordering, single-fact headings (`RunAccount.tsx:191-420`). **Residual:** raw definition/period ids (RC-02); the account-absent state is the only one rendered with this seed, so the populated tables were checked in code only. |
| RC-10 | S2 | **OPEN** | Every strip cell still reads `<status> · no engine account` (`running · no engine account`, `completed · no engine account`) — C1's sub-lines are `5 need you · 14 open`, `clean · 1,184 posted`, `reading · 62%`. Arrival figures `Admitted / Not admitted / Coverage` are `—`; C1's labels are `Matched / In variance / Coverage / Read by the machine` (`close-3wm.png` vs `pack-c1.png`). The run page's completeness half was fixed. |
| RC-11 | S2 | **CLOSED** | 429 is `Too many requests from this browser — try again in a minute`, 403 is the role sentence (`close-error-429.png`, `close-error-403.png`). New over-repetition → NC-04. |
| RC-12 | S2 | **PARTIAL** | `Sign out` is live (`data-sign-out`, DELETE /session); menu header shows display name, email and the tenant **name** `Meridian Group Pte Ltd`; theme toggle added (`close-account-menu.png`). **Residual:** avatar is `·` (NC-08); the sub-line is the org class `Customer`, not C1's role line `user · roles mapped 4 of 4`; menu is still a hand-rolled `<details>` with **0** `menu`/`menuitem` roles (primitive 5 says adopt the shadcn DropdownMenu). |
| RC-13 | S2 | **CLOSED** | `Good afternoon, Parity.` (first name from the resolved person). |
| RC-14 | S2 | **PARTIAL** | Self is `with you`; the literal `me` is no longer stored. A colleague is `with a colleague` rather than C1's named person — defensible (no directory read), but the pack draws names. |
| RC-15 | S2 | **CLOSED** (residual NC-07) | The line text is the row; the id is gone from the row. The link now reads `Open` (+ sr-only *"the finding"*). |
| RC-16 | S2 | **PARTIAL** | Sentence case (`Reading the reconciliations`, `Reading the register.`), the claim is suppressed while reading, `aria-busy` present (3 elements) — `close-loading.png`. **Residual:** no scope while loading — the status bar reads `Meridian Group Pte Ltd · no period`; Design System 13 states the period and tenant while it loads. |
| RC-17 | S2 | **PARTIAL** | Filtered-empty and empty now differ (`No line is in "Waiting".` vs `No exception is waiting in this register.`, `ExceptionRegister.tsx:631`). **Residual:** neither carries the run, the time or the denominator (*"Run completed 03:12 · 1,284 documents · 0 exceptions"*) and filtered-empty offers no *Show all*; on a **running** reconciliation the empty sentence is asserted before the run has finished (NC-02). |
| RC-18 | S2 | **OPEN** | Show `All lines · Needs you · Waiting · Cleared`, Order `Severity · Value · Newest · Oldest` — unchanged; C1 is `All lines · Needs you · Cleared · Parked` / `Line order · Value · Variance · Status`. No divergence recorded as a design change. |
| RC-19 | S2 | **OPEN** | Columns `# · Line · Value at risk · Severity · Confidence · Status · Action` — still no Variance column, still an extra Severity column (C1: `Value SGD · Variance SGD`). |
| RC-20 | S2 | **PARTIAL** | Verdict tags gone; `Expected, from the reference — the purchase order`; dismiss has the accessible name *Hide the evidence*. **Residual:** visible header is `OPEN THE FINDING ✕` (NC-06); `Observed — 0 observed values` is still a count. |
| RC-21 | S3 | **CLOSED** | Legend split: `J K move · ↵ open` live in ink, `A accept · ⌘Z undo · ⌘K palette` one `Coming soon` group; tenant name first; ⌘Z present. The audit slot is still a bare `audit` (Coming soon) — acceptable under G3091. |
| RC-22 | S3 | **PARTIAL** | J/K now move row focus (probe: `j→0001, j→0002, k→0001`), ↵ opens. **Residual:** rows are still `tr[role=button]`; **no `aria-sort` on any header** (probe: all seven `th` empty); Escape does not close the open evidence (probe `escClosed=false`); ⌘K inert (planned). |
| RC-23 | S3 | **PARTIAL** | Register money carries a real space (`SGD 112,204.00` in the DOM text). The finding page's figure still emits `SGD112,204.00` as text (spacing by CSS only) — copy/paste and screen readers get the run-together form. |
| RC-24 | S3 | **PARTIAL** | Plural fixed (`pluralLines`). Totals row still `6 lines on this page · not all monetary`, not C1's totals sentence. |
| RC-25 | S3 | **PARTIAL** | Tenant **name** now shown; the region is the raw residency token `ap-southeast-1` (C1: `SG · SGD`), and at 820 the chip clips mid-token (NC-09). |
| RC-26 | S3 | **OPEN** | Setup unchanged: *"Sources bind in the data plane; the credential inside a binding is held under this tenant's own key."* and the fused `Packs installed · Install a blueprint` single Coming-soon control (`setup.png`, `setup-nocaps.png`). |
| RC-27 | S3 | **OPEN** | *"Binding this session to the tenant served here."* still the pending-bind copy (`main.tsx:1066,1109`). |
| RC-28 | S3 | **OPEN** | `WHAT TO QUOTE` still upper-case (pack: *What to quote*); quote lines still `401 · no session — the plane returned 401`, `500 · the plane answered 500 · internal_error`, `503 · the plane answered 503 · upstream_unavailable`; explanatory line *"The plane's own answer rather than an account…"* (`close-error-401/500/503.png`, `signin-lapsed.png`). 404 still offers `Sign in · if you have not yet` to a signed-in reader where E1 offers `Search from the palette` (`nope.png`). |
| RC-29 | S3 | **PARTIAL** | Shorter, but still two near-identical "answers the same for all" paragraphs on `run_nope` (*"…this page answers the same for both."* then *"…this page answers the same for all three."*) plus a `Coming soon` *Open a finding from an open line* with no lines (`run-missing.png`). |
| RC-30 | S3 | **PARTIAL** | Tooltip is now left-aligned (`left:0`), still always **below** the trigger (`overlays.css:266`); Design System 10 says above with a collision flip. |
| RC-31 | S3 | **CLOSED** | Kernel `:focus-visible{outline:2px solid var(--ink);outline-offset:2px}` (`docs/handoff-pack/tokens.css:539`) is in force via `bridge.css`. |
| RC-32 | S4 | **PARTIAL** | Hero is the ruled copy *"Welcome back. Your close is ready."* and the unevidenced claim is gone (G3428). `Sign-in service · reachable` indicator still absent (pack V3 draws it). |
| RC-33 | S4 | **PARTIAL** | Caption sentence-cased (`One of four lanes configured.`); the lane is still its kind `Upload` with `nothing yet`, not a source name and counts. |
| RC-34 | S4 | **OPEN, spread** | `Read by the machine — ∴` unchanged, and G3430 put the mark on the evidence label too: `WHAT THE MACHINE DID · — ∴` (NC-10). |
| RC-35 | S4 | **OPEN** | Severity still a plain-word column; no owner confirmation recorded. |

**Tally:** CLOSED **10** (RC-01, 04, 05, 06, 07, 11, 13, 15, 21, 31) · PARTIAL **17** · OPEN **8** (RC-10, 18, 19, 26, 27, 28, 34, 35).

---

## 2 · New findings introduced or exposed by the fixes

| id | sev | screen / element | pack expectation | observed | frames | suggested fix |
|---|---|---|---|---|---|---|
| NC-01 | **S1** | `/close/finding/:ref` *What you can do*; the whole `/close/finding/:ref/post` page | E1: *"They do not guess at a cause… and they do not offer a retry that cannot help."* Design System 13: an Error state names its scope | Both read **"Something failed on our side. Nothing was written — try again in a moment."** The plane answered `listProposals` 500 ×4 and `listAvailableDispositions` 500 ×2 because the tenant has **no `tenant.approval_config` row** and the archetype row is unpublishable — the plane logs *"The chain fails CLOSED rather than defaulting to the weakest gate."* That is deterministic: retrying never helps. The quiet Accept/Reject/Park row also vanishes. `resolve-logic.ts:33` maps every ≥500 to the retry sentence. | `finding.png`, `finding-post.png` | The plane should answer a closed code for "not configured" rather than a 500 (escalate — server change); the UI should say *"Resolutions are not set up for this reconciliation yet — your administrator configures approvals"* and keep the quiet acts visible. |
| NC-02 | **S2** | `/close` first paint — default selection | C1 opens on the reconciliation with the work (*Three-way match · 5 need you*) | The default selection is the **running, lit** `Bank to ERP`: empty register, claim *"No exception is waiting on anyone."*, while the chrome says `Needs you 3`. The sentence asserts a fact about a run that is still reading, and the reader must find the work themselves. | `close-default.png`, `close-account-menu.png` | Default to the reconciliation holding the reader's needs-you lines (or the most recent *completed* run); never assert "no exception" for a running run — say *"Still reading — exceptions land here as they are raised."* |
| NC-03 | **S2** | Arrival block — two denominators on one line | C1: one run, one count (*"Five of the fourteen"* beside `run 03:12`) | `Exceptions raised 5` (the run's figure) beside *"Three of the **six** exceptions need you."* (the definition's register, across runs). After RC-03's re-scoping the claim and the figure measure different populations side by side. | `close-3wm.png` | Scope the register and claim to the selected run (C1), or label the figure `This run raised 5`. |
| NC-04 | **S2** | Refused register (no capability, or 403) | G3193: refused controls are hidden; E1: *"a destination a role does not hold is absent… a control it may not use is not offered"* | Show/Order facets, the full column header row and `＋ New reconciliation` (Coming soon) are drawn for a reader who may use none of them; the refusal is printed **twice** (`This register is not part of your role.` in the count line and the empty block). Under 429 the same sentence appears **four** times (strip, claim, count line, empty block). | `close-nocaps.png`, `close-error-403.png`, `close-error-429.png` | When the register read is refused, draw one refusal block and omit facets/headers; print a status once per surface. |
| NC-05 | S3 | Action column — `Accept` on lines the reader does not hold | RC-04 ruling: the row's *next act*; C1 draws `You classify` / `View` where the act is not the reader's | `Accept` (filled, Coming soon) is the next act on the colleague's line (`with a colleague`) and on the reader's own `Investigating` line alike; with a row open, two filled-but-inert Accept buttons sit on screen. The finding page meanwhile offers a live propose flow — the same act inert in one place and live in another. | `close-3wm.png`, `close-open-row.png` | Offer `View` (or nothing) on another person's line; align the register's Accept with the finding's propose once C4 is wired. |
| NC-06 | S3 | Evidence panel header | C1: `HIDE THE EVIDENCE ✕` | Visible text is `OPEN THE FINDING ✕` — the ✕'s name (*Hide the evidence*) is sr-only, so sighted readers see a close glyph labelled as a link to the finding. **Escape does not close the panel** (probe). | `close-open-row.png` | Draw `Hide the evidence ✕` as the pack does; put `Open the finding` elsewhere (the row link already does it); bind Esc. |
| NC-07 | S3 | Row link `Open` | C1 row's second slot is the spend `{{ r.spend }} ∴` | Every row shows `Open` immediately after the line text while the status column also says `Open` — two identical words with different meanings on one row (the link's *"the finding"* is sr-only). | `close-3wm.png` | Make the line text itself the link, or label it `View finding`. |
| NC-08 | S3 | Chrome avatar / account | C1: `RT` initials · `Rosalie Tan · user / roles mapped · 4 of 4` | Avatar is a bare `·` (deliberate: `ChromeBar.tsx:122` — *"no initials are derived… slicing a name is interpreting it"*, D6-9); the sub-line is the org class `Customer`. The pack draws initials and the role line. | `close-3wm.png`, `close-account-menu.png` | Owner ruling: initials (or the mark) in the avatar slot; role label from the session's roles. |
| NC-09 | S3 | Tenant chip | C1: `Meridian Group Pte Ltd  SG · SGD ▾` | Region is the raw residency token `ap-southeast-1` (infrastructure vocabulary); at 820 the chip clips to `Meridian Group Pte Ltd a…`. | `close-3wm.png`, `close-3wm-820.png` | Map residency to a country label (`SG`); ellipsize the name, not the region. |
| NC-10 | S4 | Metered mark on absent figures | Design System: *"∴ trailing the spend"* | The mark now trails absent figures in two places: `Read by the machine — ∴` and `WHAT THE MACHINE DID · — ∴` (G3430 put it on the evidence label). | `close-open-row.png` | Omit `— ∴` when no figure exists. |

### Severity counts

| | S1 | S2 | S3 | S4 | total |
|---|---:|---:|---:|---:|---:|
| Prior still OPEN | 0 | 3 (RC-10, 18, 19) | 3 (RC-26, 27, 28) | 2 (RC-34, 35) | 8 |
| Prior PARTIAL | 2 (RC-02, 03) | 7 | 6 | 2 | 17 |
| New | 1 | 3 | 5 | 1 | 10 |

(Severities are the original RC grades. RC-08's residual is reported separately as NC-01.)

---

## 3 · Component usage against the 14 primitives — re-check

| # | Primitive | Before | Now |
|---|---|---|---|
| 1 | Navigation shell | absent below 1080 | ✅ inline at mid, bottom tab bar at narrow |
| 2 | Chrome bar | wrong content, no narrow relocation | ✅ sheds in pack order; content gaps NC-08, NC-09 |
| 3 | Command palette | ⌘K inert | Quiet `Coming soon` (planned); ⌘K still inert |
| 4 | Breadcrumb | none | ✅ `Trail` on finding and run — terminal crumb is a raw id (RC-02) |
| 5 | Account menu | hand-rolled `<details>` | Unchanged: `<details>`, 0 `menu`/`menuitem` roles; Esc closes it |
| 6 | Filter mechanism | `aria-pressed` groups, labels diverge | Unchanged (RC-18) |
| 7 | Table navigation | no `aria-sort`, no J/K | J/K live; still no `aria-sort`, rows `role=button` (RC-22) |
| 8 | Drawer | inline evidence | Inline evidence (C1); header label NC-06 |
| 9 | Modal | not used | ✅ confirm before taking over / releasing a colleague's line |
| 10 | Tooltip | placement unspecified | Left-aligned; always below (RC-30) |
| 11 | Toast | not used | ✅ `ToastRegion` mounted; undo toast on assignment |
| 12 | Status bar | Close only | Close only; finding, run and setup still have none (*"on every protected surface"*) |
| 13 | Route states | per-component, no `aria-busy` | `aria-busy` present; scopeless loading (RC-16), refused-state over-drawing (NC-04), false transient error (NC-01) |
| 14 | Key-caps | fused into one disabled control | ✅ split live/quiet |

## 4 · Top five open issues

1. **NC-01 (S1)** — a fail-closed configuration absence is told to the reader as a transient failure with a retry, and it blanks *What you can do* and the whole Approve-and-post page. Partly a plane issue (500 for a deterministic refusal).
2. **RC-10 (S2)** — every strip cell still says `… · no engine account`; the arrival figures are `—` under labels the pack does not use.
3. **NC-02 / NC-03 (S2)** — first paint lands on an empty running reconciliation asserting "No exception is waiting on anyone" while the chrome says 3; and the selected view mixes a run figure with a definition-wide claim.
4. **RC-02 residual (S1→S2)** — raw ids survive on the run page (`def_three_way_match`, `per_2026_09`) and in both breadcrumbs.
5. **RC-18 / RC-19 (S2)** — the register's facets, ordering and columns still diverge from C1 (no Parked, no Variance, an extra Severity column) with no recorded design change.

## What was not covered

- Setup as a tenant administrator (no admin in the seed), the confirm modal and
  undo toast by click, and the populated run account (no engine account in this
  seed) — checked in code only.
- The apex site (`frontend/site`) was checked for copy only from the
  prerendered HTML; its figures are gated by `tests/app/apex-site.test.ts`.
  Nothing off-pack was found there beyond the fixed V3 hero ruling.
- Dark theme not rendered. Error states are browser-fulfilled stand-ins.

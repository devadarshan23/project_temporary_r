# RED re-audit: partner portal, staff console, apex marketing site

> **STATUS:** REPORT ONLY. No product code changed. Branch `audit/reaudit-partner-staff-apex`
> from `origin/main` at `a039fb76`, which includes green #559 (`ecdbb98f`, G3581–G3592:
> staff console, apex and host-aware E1) and #560 (`489d3d25`, G3561–G3570: partner portal
> and deal currency). Audited 3 Oct 2026.
> **Prior report:** `docs/build/ui-audit/red-partner-staff-apex.md` (RP-01..12, RS-01..10,
> RA-01..06; 28 findings).
> **Pack:** `P1 Partner`, `S1 Staff`, `V1`–`V4`, `E1 Errors`, `Design System`, `tokens.css`, `app.css`.
> **Rulings respected:** G3091, G3092 (`<Soon>`), G3193 (refused controls omitted), G3152, G3392,
> G3473/G3588 (two initials from the stored name), G3581 (per-host E1), G3582/G3486 (apex
> light-only), G3592 (the `›` stays a suffix), G3561 (deal value carries a currency).

## How this was measured

1. `npm ci && npm run build:frontend`. This builds `frontend/dist` and `frontend/site/dist`.
2. A private PostgreSQL 14 in `/private/tmp/claude-501/pg-reaudit-psa` on `127.0.0.1:55497`,
   with all four control port variables pointed at it. It was stopped and deleted afterwards.
3. The seeding is the gate's own fixtures, which mirror the staging mock personas.
   - **Partner:** `seedPartnerPortal()`. Ana is the Northwind administrator, Ben is a Northwind
     partner user and Carl is the Contoso administrator. There are three illustrative claims;
     two carry `annual_value_*` in SGD and USD.
   - **Live sandbox:** the first pass could not draw this. A `tenant.partner_sandbox` row was
     seeded with `live`, a seed version, a reset in 14 days, an account and a residency for
     Northwind. Contoso has none.
   - **Staff:** `seedTenancyRoster()` plus a platform FDE session holding `view_substrate`.
4. The planes were real `startDataPlane()` instances behind `tests/e2e/single-origin.ts`, on
   `partners.localhost:8092` (plus `ten-acme.localhost:8092` for the customer-host errors) and
   `console.localhost:8080`. The production authoriser was used, with no test-token flag.
5. The apex `dist` was served by `tests/e2e/apex-origin.ts`. Chromium resolved
   `reconcileai.app` to it (`--host-resolver-rules`), so the page believes it is on the apex
   and draws the **routed** demo form. `/demo/intake` was mocked to 202 and 502, and
   `/session/realm` to 200 and 422.
6. Headless Chromium (Playwright) at **1440, 1024, 820 and 390**, each in `colorScheme`
   **light** and **dark**. Every capture ran the same census as round one: `scrollWidth`
   against the viewport, unclipped elements past the right edge, the Plex Sans and Mono checks,
   `getAnimations()`, and a raw-id/G-number regex.
7. **Keyboard:** a 30-step Tab walk on every surface, recording the active element, its box
   and its computed outline. Also: Enter on the skip link, Enter on *Open* in the staff table,
   browser Back, and a mouse click on the main region with the computed style of the focused node.

Screenshots: `docs/build/ui-audit/screens/reaudit-partner-staff-apex/` (166 frames).

| Prefix | Content |
|---|---|
| `p-*` | partner portal (`-carl-` = no sandbox, `-ben-` = partner user) |
| `s-*` | staff console |
| `a-*` | apex site |
| `err-{p,c,t}-*` | E1 on the partner, console and tenant (customer) hosts |

The suffix is the width; `-dark` is the OS dark scheme and `-full` is full page. The pack
frames from round one (`screens/partner-staff-apex/pack-*.png`) are the references and were
not re-captured.

## Verdict in one paragraph

**#559 and #560 closed the round-one defects that mattered.**
- No page on any of the three surfaces scrolls sideways at any width or in either scheme. The
  census reported **0 offenders and `scrollWidth === innerWidth` on all 74 product captures**.
- Sign out is always reachable, and People is visible at 1440.
- Both signed-in surfaces carry the theme toggle.
- E1 now sends a partner to the portal, a staff person to the console and a customer to
  `/close`, each worded for its host.
- The live sandbox, never drawn in round one, renders with the unserved sections drawn quiet.
- **24 of 28 findings are CLOSED, 3 are PARTIAL and 1 is OPEN.**

**What is new is behaviour rather than layout:**
- A sandbox request is forgotten on reload.
- A failed roster read relabels an administrator as a *partner user*.
- On the apex, focus and scroll position are lost when the demo changes step.
- The *"until you book"* restoration now sits beside a button that sends rather than books.
- **The "grey focus outline" around the staff console's main region is not focus.** It is the
  pack's ultra-tier `.app` frame (`app.css:66`). The frame is painted under the chrome's opaque
  background, so it outlines only `main`. Because `main` also takes focus on every click
  (`tabindex="-1"`), it reads as a focus ring.

## 1 · Prior findings

### Partner portal (RP)

| id | was | now | evidence |
|---|---|---|---|
| RP-01 | blocker | **CLOSED** | `scrollWidth` equals `innerWidth` at 1440, 1024, 820 and 390, light and dark, on Deals, Sandbox, People and the open register form. The account menu opens at every width, and Sign out sits inside the viewport (`p-account-1024.png`, `p-account-390.png`). At 390 a phone tab bar carries the three built destinations. |
| RP-02 | major | **CLOSED** | At 1440 People is at x 703–746, inside the nav. The quiet destinations collapse first behind a `+3` cue, which is a `<Soon>` labelled *"3 more destinations, not built yet"* (`p-deals-1440.png`); at 820 the cue reads `+6`. |
| RP-03 | major | **CLOSED** | The account menu lists *Theme · System / Light / Dark* (`p-account-1440.png`). |
| RP-04 | major | **CLOSED** | Partner 404: *"Back to the partner portal · your deals and your firm"* → `/`. Partner 401: *"Sign in again"* → `/signin`. The quote line now reads *"What this browser presented, rather than an account"*, and the plane vocabulary is gone (`err-p-404-1440.png`, `err-p-401-1440.png`). |
| RP-05 | major | **CLOSED** | *Skip to the work* is the first Tab stop at 1440 and at 390, and the sr-only `h1` *"Reconcile AI · partner portal"* is present. See NP-07 for its target. |
| RP-06 | minor | **PARTIAL** | The load-time flicker is gone: the nav holds `data-settling` until the roster read lands. **But the read's failure is handled as "partner user"**, see NP-02. |
| RP-07 | minor | **PARTIAL** | During loading the figures are now blank with an sr-only *"reading"*, so `—` is no longer overloaded. **When the claims read fails (503), the three figures stay blank and sr-only "reading" indefinitely** while the table below says it could not be read (`err-p-503-1440.png`). Nothing in the figures marks them as unread. |
| RP-08 | minor | **PARTIAL** | (a) *"Deal value, SGD a year"* is restored, and the currency is real (G3561). (b) *Filter*. (c) *"3 rows"*. (e) The status bar is left-aligned: *Your firm · partner portal · control plane · no tenant data on this surface · Ana Ruiz · partner administrator*. (f) The billing period has two parts, *"— billing period"*. (g) *Administration · people and cards* is drawn quiet. **(d) is not re-verified:** with three rows no pager renders, and `PartnerPortal.tsx` carries no `‹` `›` glyph. |
| RP-09 | minor | **CLOSED** | Customer names render at regular weight, matching the staff table (`p-deals-1440.png`). |
| RP-10 | minor | **CLOSED** | No-sandbox figures *"your account"* and *"about 2 days"* render small (`p-carl-sandbox-none-1440.png`). |
| RP-11 | minor | **CLOSED** | **Rendered live this time.** *This month, wholesale* is a quiet `<Soon>` figure. *What the sandbox refuses…* and *Who at your firm can reach it* are each a heading plus a quiet line. *Reset it now*, *Request a trial tenant* and *Hand it back* are `<Soon>`s; a click on each changes nothing and shows the *Coming soon* tooltip (`p-sandbox-live-1440-full.png`, `p-sandbox-soon-*-1440.png`). |
| RP-12 | minor | **OPEN** | `style={{` count in `PartnerPortal.tsx` is **29** (it was 28). All values are still tokens. This is optional. |

### Staff console (RS)

| id | was | now | evidence |
|---|---|---|---|
| RS-01 | major | **CLOSED** | At 390, `scrollWidth` is 390 on the tenancy and the tenant record, light and dark. The table scrolls inside `.scroller` (`s-tenants-390.png`). |
| RS-02 | major | **CLOSED** | Console 503: *"The staff console could not reach what it reads… it reads the tenancy from our own control service"*. The ways are *Back to the staff console · the tenancy* and *Back to the site*, and the quote is `503 · /` (`err-c-503-1440.png`). The 404 and 401 go to the console home and to `/signin`. |
| RS-03 | major | **CLOSED** | *Profile · Theme (System/Light/Dark) · Sign out* (`s-account-1440.png`). |
| RS-04 | minor | **CLOSED** | No visible *Coming soon* text. The H9 and H10 tables draw `—` rows, and *New floor* and *Set the floor* are drawn disabled. See NS-04 for the field's width. |
| RS-05 | minor | **CLOSED** | *"— billing period"*, matching the partner. |
| RS-06 | minor | **CLOSED (by ruling)** | `PF` comes from the stored display name. G3473/G3588 make two initials the rule on every surface. |
| RS-07 | minor | **CLOSED** | Figures are *Mode · Residency · Retention (—, quiet) · Support access · Plan*, which is S1's set (`s-tenant-1440-full.png`). |
| RS-08 | minor | **CLOSED** | *Stalled over 14 days* is a `<Soon>` (*"…, coming soon"*), the same treatment as the partner's *Matched to a lead*. |
| RS-09 | minor | **CLOSED** | The chip truncates with an ellipsis, *"1CloudHub staf…"*, at 820. See NS-02 for a new alignment defect in the same element. |
| RS-10 | minor | **CLOSED** | A record is `/?tenant=ten_borealis`. Browser Back returns to the tenancy list (`s-back-*`: 3 rows present). See NS-03 for focus. |

### Apex (RA)

| id | was | now | evidence |
|---|---|---|---|
| RA-01 | major | **CLOSED** | The suffix is `.us-west-2.reconcileai.app`: lowercase, mono and unbroken (`a-lookup-routed-filled-1440.png`). See NA-04 for its cost at 390. |
| RA-02 | minor | **CLOSED** | *"We found your organisation's sign-in, but not its address here…"* |
| RA-03 | minor | **CLOSED (derived G3592)** | *"Nothing is stored until you book."* is restored, and the `›` stays a suffix by the Design System's grammar. **The restoration creates NA-02.** |
| RA-04 | minor | **CLOSED** | V3's *You land in the right place* panel, with four role cards, renders beside the form (`a-lookup-1440.png`). |
| RA-05 | minor | **CLOSED (by ruling)** | The apex is light-only (G3582), with `data-theme="light"` under an OS dark scheme on every `a-*-dark` capture. |
| RA-06 | minor | **CLOSED** | Steps two and three were driven. *Continue* with nothing answered keeps `data-demo-state="one"` and shows the hint. *Start from a typical setup* followed by Continue reaches step two. Send with a 202 reaches *Received*, and with a 502 reaches *Not sent* (`a-demo-step2-*`, `a-demo-accepted-*`, `a-demo-failed-1440.png`). |

## 2 · New findings, severity-ranked

Severity:
- **blocker**: a user cannot complete a basic act on the surface
- **major**: a visible or behavioural departure that a reviewer or a user will hit
- **minor**: small, or invisible today

| id | sev | surface / element | pack reference | observed | screenshots | suggested fix |
|---|---|---|---|---|---|---|
| NP-01 | **major** | **Partner · sandbox request is forgotten.** | P1's no-sandbox state (`P1 Partner.dc.html:786`) offers *Ask for one*. The contract answers 409 *"a sandbox already stands. One per partner"*. | Carl (no sandbox) clicks *Ask for one* and gets 202: *"Requested. A person at 1CloudHub provisions it…"*. **After a reload the page says *"You do not have a demo tenant"* and offers *Ask for one* again.** A second ask returns 409, *"You have already asked for one."* The cause is in the server: `getSandboxTenant` answers `none` while a request is open (`server/data-plane/partner-portal-store.ts:180`: *"No row — including while a request is open… — is `none`"*). The client cannot know. | `p-carl-sandbox-asked-1440.png` → `p-carl-sandbox-reload-1440.png` → `p-carl-sandbox-asked-twice-1440.png` | **Owner ruling (contract):** add a `requested` standing (with `requested_at`) to `getSandboxTenant`. Draw it as the 202's sentence, with no *Ask* button. |
| NP-02 | **major** | **Partner · a failed roster read relabels an administrator.** | P1: one chrome per role. RP-06 asked that role-dependent items be held until the read *settles*. | With the `/partner/**` reads failing (503), Ana, an **administrator**, is drawn as **"partner user"** in the account square and the status bar. The nav drops *People*, *Arrangement* and *Rate cards* and shows *Catalogue*. The page states a role the person does not hold. | `err-p-503-1440.png` ↔ `p-deals-1440.png` | Treat "unread" as a third state. Keep the settling layout (no role-dependent items, a neutral sub-line) rather than falling to the least-privileged role's chrome. |
| NX-01 | **major** | **Staff and partner · the "grey outline" around the main region at ≥1440.** | `app.css:62-66`: at `min-width:1440px`, `.app{max-width:1880px;box-shadow:inset 0 0 0 1px var(--rule-strong)}`. In the pack the frame wraps the **whole** app, including the chrome (`pack-s1-1440.png`: the rule runs along the top and sides of the chrome). | In the app the chrome's opaque background paints over the inset shadow, so the hairline (`#a4b8bb`) outlines **only `main`**: its left edge, its right edge, and the status bar's top. It is present on first paint, before any click (probe: `.app` `box-shadow: rgb(164,184,187) 0 0 0 1px inset`; `main` outline `none`, `:focus-visible` false). **Because `main` is `tabindex="-1"` and takes focus on every click (`activeElement === main#route-root` after a click), it reads as a focus ring.** This is the reported grey outline. After the skip link, `main` also gets the real 2px ink focus outline across the whole region. | `s-afterclick-main-1440.png`, `s-tenants-1440.png`, `p-deals-1440.png` ↔ `pack-s1-1440.png` | Paint the frame above the chrome, as the pack does: an outline or `::after` on `.app`, or the inset on `body`. Optionally, stop a mouse click from focusing `main`, which only needs to be a programmatic or skip-link target. |
| NA-01 | **major** | **Apex `/demo/` and `/lookup/` · focus and scroll are lost on every step change.** | V2 `#form` (two steps, then *Booked*); V3's routed state. | After *Continue*, `activeElement` is `<body>`. **At 390, step two's eyebrow and `h2` sit 139–167 px above the viewport** (`scrollY` 1542), so the person lands mid-form with no heading. Send to *Received* or *Not sent* also leaves focus on `<body>`; *Not sent* has `role="alert"` and *Received* has `role="status"`, which partly mitigates for screen readers. The lookup's *Find my sign-in* to *routed* step likewise leaves focus on `<body>`. A keyboard user must Tab from the top of the page. | `a-demo-after-continue-390.png` | On step change, scroll `#form` into view (with `scroll-margin-top` for the 56 px sticky header) and move focus to the new step's `h2` (`tabIndex=-1`). Do the same for the lookup's routed `h1`. |
| NA-02 | **major** | **Apex `/demo/` · "book" copy beside a control that sends.** | V2 step two: *"Who you are, **and when**"*, a phone field, a **slot picker**, the button **Book it**, the confirmation **Booked** and *Book another*. | The app draws *"Who you are."*, three fields and **Send it**, with *Received* and *Send another*. The note restored by G3592 says **"Nothing is stored until you book."** But there is no booking, and the request **is** sent and handed to the CRM when *Send it* is pressed. The sentence is now false on the page that carries it, and `PRODUCT.md` forbids claims the product does not make good. | `a-demo-step2-1440.png` ↔ `pack-v2-1440.png` | **Owner ruling:** either restore the slot picker and *Book it* (needs a calendar source), or use *"Nothing is sent until you press Send it"* in both notes and amend V2. |
| NP-03 | minor | **Partner · invalid deal value is refused silently.** | P1:140 draws one value field. | An entry of `-5`, `abc`, three decimals, or a currency that is not three letters or not known to `exponentOf` makes `dealValueOf()` return `null`. *Submit the claim* then becomes `aria-disabled` with **no message and no `aria-invalid`** on either field. For an invalid currency the label reads **"Deal value, — a year"**. | `p-register-negative-1440.png`, `p-register-badcurrency-1440.png` | Mark the offending field `aria-invalid` and add one plain line (*"A positive amount in SGD, e.g. 180,000"*). |
| NP-04 | minor | **Partner · the currency is stated twice and echoed nowhere.** | P1:140 has the currency inside the label only. | The label says *"Deal value, SGD a year"* and a separate free-text **Currency** field also says `SGD`. The 202 receipt (*"Received as a deal on Illustrative Prospect D…"*) and the claims table never show the value or the currency, so a mistyped `USD` cannot be checked after submit. The pack's table has no value column either, so only the receipt is owed. | `p-register-390.png`, `p-register-sent-1440.png` | Make the currency a small select, or a suffix of the value field, and put the amount and currency in the receipt sentence. |
| NS-01 | minor | **Staff · 820: *Agent builder* drops with no cue.** | The pack clips *Catalo…* (`pack-s1-820.png`). The partner chrome uses a `+N` cue (RP-02). | The staff nav shows *Tenants · Catalogue* and *Agent builder* vanishes without an overflow cue. The two surfaces handle the same problem two ways. | `s-tenants-820.png` ↔ `p-deals-820.png` | Reuse the partner's quiet-first drop and the `+N` cue. |
| NS-02 | minor | **Staff · the tenant chip's text sits high.** | The S1 chip's text is vertically centred (`pack-s1-1440.png`, y≈30 in a 14–46 box). | *"1CloudHub staff console"* renders at y≈22 in the same box, at 1440 and 820. This is likely the RS-09 inner span (block or `overflow:hidden`) losing the flex centring. | `s-tenants-1440.png`, `s-tenants-820.png` ↔ `pack-s1-1440.png` | `align-self:center` or `display:inline-flex; align-items:center` on the chip, or `line-height` equal to the box. |
| NS-03 | minor | **Staff · opening a record drops focus.** | — | Enter on *Open* replaces the table, and focus falls to `<body>` (`s-after-open-focus-*`). Back to the list puts focus on the skip link or the logo, not the row that was opened. | `s-after-open-kbd-1440.png` | Focus the record heading on open; on back, return focus to that row's *Open*. |
| NS-04 | minor | **Staff · *New floor* spans the pane.** | S1:316-318: `.pfields` puts the field in a column. | The disabled input is **1420 px** wide at 1440, a full-width grey bar. | `s-tenant-1440-full.png` | Use the `.pfields` grid or a `max-width` (about 20ch). |
| NP-05 | minor | **Partner · skip target is invisible.** | P1:21 `href="#work"`. | Enter on *Skip to the work* focuses a **zero-height `span#work`** at y 61, so no focus indicator is visible. The staff console's skip focuses `main` and draws a 2px ink ring around the whole region. Two treatments, one invisible. | `p-skiplink-1440.png` | Point both at the pane heading (`tabIndex=-1`) so the focus lands on something legible. |
| NA-03 | minor | **Apex `/demo/` step two · no field-level validation.** | V2's `twoNote`. | *Send it* with empty fields, or with `not-an-email`, does nothing. The note line is unchanged (*"Name, a work email and a company…"*), there is no `aria-invalid`, and no alert. | `a-demo-step2-empty-send-1440.png`, `a-demo-step2-bademail-1440.png` | Mark the missing or invalid fields and say which in the note. |
| NA-04 | minor | **Apex `/lookup/` at 390 · the sign-in name field is 108 px.** | Hostname suffix unbroken (RA-01). | The `nowrap` suffix takes **195 px**, leaving the input 108 px; *illustrative-organisation-name* shows as *"sation-name"*. | `a-lookup-routed-filled-390.png` | Below about 480 px, put the suffix on its own line under the field, or shorten it to `.us-west-2.…` with a full tooltip. |
| NA-05 | minor | **Apex `/demo/` · *Skip to the form* is the third Tab stop.** | V1–V4 put the skip link first. | Tab order is *Reconcile AI* (logo), then *Sign in*, then **Skip to the form**. | n/a (Tab walk, `demo-tab`) | Move the skip link before the header in the DOM. |
| NA-06 | minor | **Apex `/demo/` *Not sent* prints a raw HTTP status.** | V2 draws no failure state. | *"The request was answered 502, not with the intake's acceptance."* is on a prospect-facing page. | `a-demo-failed-1440.png` | *"Our intake did not accept it. Nothing was received; try again in a moment."* Keep the code only in a quiet quote line, as E1 does. |

### What holds (measured this round)

- **Layout.** There is no horizontal page scroll on any of the 74 product captures: three
  surfaces, four widths, two schemes, plus the open forms and error pages.
- **Fonts.** Plex Sans and Mono check `true` on every capture.
- **Dark.** Partner and staff recompute under the OS dark scheme with `data-theme="dark"`.
  The apex stays light by ruling.
- **No raw ids or G-numbers** appear on any surface's visible text.
- **Motion.** There are zero animations on partner and staff. V4 runs the mascot cascade (6),
  as in the pack.
- **Focus rings.** Every Tab stop on every surface draws a 2px `--ink` (`#00303f`) solid
  outline. No focusable element lacks a visible focus style.
- **Quiet unbuilt.**
  - Every unserved control on the three sandbox flows (reset, trial request, hand-back) is a
    `<Soon>`. Clicks do nothing and show only the tooltip.
  - Ben, a partner user, gets the pack's refusal for the sandbox: *"Your role here does not
    reach the sandbox…"*.
- **Per-host E1 (G3581).**

  | host | 404 way home | 401 | 503 |
  |---|---|---|---|
  | `partners.` | *Back to the partner portal* → `/` | *Sign in again* → `/signin` | in-pane, *quote 503 · upstream_unavailable* |
  | `console.` | *Back to the staff console* → `/` | *Sign in again* → `/signin` | full E1, worded for the console |
  | `ten-acme.` (customer) | *Back to your register* → `/close` | *Sign in again* → `/signin` | — |

  None offers a route its host does not serve.
- **Deal registration with currency.** A USD claim submits (202) and appears in the table as
  *waiting on us*. Typing `usd` is upper-cased, and the currency field resets to `SGD` after
  submit.

## Counts

**Prior findings (28):**

| | CLOSED | PARTIAL | OPEN |
|---|---:|---:|---:|
| Partner (RP, 12) | 8 | 3 | 1 |
| Staff (RS, 10) | 10 | 0 | 0 |
| Apex (RA, 6) | 6 | 0 | 0 |
| **all** | **24** | **3** | **1** |

RA-03 is closed as written (G3592), but the restoration produced NA-02. RS-06 and RA-05 are
closed by owner rulings rather than by code changes.

**New findings (16):**

| | blocker | major | minor | total |
|---|---:|---:|---:|---:|
| Partner (NP) | 0 | 2 | 3 | 5 |
| Staff (NS) | 0 | 0 | 4 | 4 |
| Cross-surface (NX) | 0 | 1 | 0 | 1 |
| Apex (NA) | 0 | 2 | 4 | 6 |
| **all** | **0** | **5** | **11** | **16** |

## Owner rulings needed

1. **NP-01: sandbox `requested` standing.** Should `getSandboxTenant` publish an open request,
   so that the portal can stop offering *Ask for one* after it has been asked?
2. **NA-02: the demo's verb.** Restore V2's booking (slot picker and *Book it*, which needs a
   calendar source), or rule *send* and amend V2's two notes, which G3592 restored to *"until
   you book"*.
3. **NX-01: the ultra-tier frame.** Confirm that the pack's `.app` frame should wrap the chrome.
   The app currently frames only `main`, and users read that as a focus ring.
4. **RP-08(d):** carried from round one and unanswered. Does the claims pager use the pack's
   `‹` `›`?

## Not covered

- **Trial-tenant request, hand-back and reset as real writes.** All three are `<Soon>`, and
  `requestTrialTenant` is unmounted (G2639). Only their quiet behaviour was exercised.
- **The pager** (RP-08d). Three seeded rows do not paginate.
- **A real (headed) Chrome.** All focus measurements are headless Chromium. Its
  `:focus-visible` heuristic matched what is described above, but a headed browser was not used.

# RED audit: partner portal, staff console, apex marketing site

> **STATUS:** REPORT ONLY. No product code changed. Branch `audit/red-partner-staff-apex`
> from `origin/main` at `18608374`. Audited 3 Oct 2026.
> **Scope:** three surfaces that the C1 rounds (`red-*.md`, `reaudit-*.md`) did not cover:
> - **P1, the partner portal**: `frontend/src/components/PartnerPortal.tsx`, `frontend/src/partner.css`
> - **S1, the staff console**: `frontend/src/components/StaffConsole.tsx`, `frontend/src/staff.css`
> - **the apex site**: `frontend/site/**`, which covers `/`, `/demo/`, `/lookup/` and `/story/`
>
> Each was checked against `docs/handoff-pack/P1 Partner.dc.html`, `S1 Staff.dc.html`,
> `V1 Landing`, `V2 Book a Demo`, `V3 Sign In`, `V4 Success Story`, `E1 Errors`,
> `Design System.dc.html`, `tokens.css` and `app.css`/`public.css`.
>
> **Rulings read first and respected:** G3091 (pack-faithful and quiet), G3092 (`<Soon>`),
> G3193 (refused controls are omitted), G3152 (the apex ships no AWS Marketplace claim),
> G3392 (theme follows the OS, and the account menu carries a toggle) and D6-9 (no initials
> derived from directory text). A muted `<Soon>` is **not** reported as a defect on its own.

## How this was measured

1. `npm ci && npm run build:frontend`. This builds both bundles, `frontend/dist` and `frontend/site/dist`.
2. A private PostgreSQL 14 on `127.0.0.1:55481`, deleted afterwards. It was seeded the same
   way `tests/e2e/partner-parity.shot.ts` and `tests/e2e/staff-parity.shot.ts` seed it:
   - `seedPartnerPortal()` with three illustrative deal rows. Ana is the administrator, Ben
     is a partner user and Carl belongs to another firm.
   - a control database with `seedTenancyRoster()` and a platform FDE session holding `view_substrate`.
3. The planes were real `startDataPlane()` instances behind `tests/e2e/single-origin.ts`, on
   `partners.localhost:8092` and `console.localhost:8080`. They used the production authoriser,
   with no test-token flag.
4. The apex `dist` was served by a static server. `/demo/intake` and `/session/realm` were
   mocked with `page.route` so that every outcome arm could be drawn: 202, 502, 200, 422 and 503.
5. Headless Chromium (Playwright) at **1440, 1024, 820 and 390** wide, each in `colorScheme`
   **light** and **dark**. The pack pages were drawn at the same widths, plus
   `data-theme="dark"` for P1 and S1.
6. A census ran in the browser on every captured page:
   - every computed `color`, `background-color` and border colour, mapped back to a `:root` token
   - the font family per text node, and `document.fonts.check()` for Plex Sans and Mono
   - `document.getAnimations()`
   - every element whose right edge passes the viewport, and `scrollWidth`
   - a regex pass over the visible text for raw ids and G-numbers
7. States were forced with route mocks: loading (6 s delay), 503, 403, empty, no session,
   404, a refused write (422), a sent write (202), and the partner-user versus administrator chrome.

Screenshots are in `docs/build/ui-audit/screens/partner-staff-apex/`, 152 frames:

| Prefix | Content |
|---|---|
| `pack-<p1\|s1\|v1..v4\|e1>-<width>.png` | the pack |
| `app-p-*` | the partner portal |
| `app-s-*` | the staff console |
| `app-a-*` | the apex site |

The suffix is the width, and `-dark` marks the OS dark scheme. `*-full.png` frames are full-page.
In full-page frames the sticky status bar or header is painted mid-page; that is a capture
artefact, not a defect.

## Verdict in one paragraph

**Token and type hygiene is clean on all three surfaces.** Plex Sans and Mono load on every
page; the RV-01 fix holds on the new bundles. Every computed colour on the partner and staff
surfaces resolves to a kernel token; the one exception is the kernel's own `#fff` on the AI
badge. Dark mode applies cleanly to both signed-in surfaces. The apex copy is close to
verbatim pack.

**The defects are in layout and in context:**
- The shared chrome does not survive the partner portal's longer navigation. At 1024 and 820
  the page scrolls sideways and **Sign out is off-screen**. At 1440 the administrator's one
  built destination, **People**, is clipped out of the bar.
- The staff console overflows to 628 px at 390.
- Both signed-in surfaces reuse E1's **tenant-customer** error copy ("Back to your register",
  "Your plane did not answer… the plane your data lives in") on hosts where neither applies.
- Neither surface mounts the G3392 theme toggle.

## Findings

Severity:
- **blocker**: a user cannot complete a basic act on the surface
- **major**: a visible departure from the pack or a ruling that a reviewer will name
- **minor**: small, or invisible today

### Partner portal (P1)

| id | sev | element / screen | pack expectation | observed | screenshots (pack ↔ app) | suggested fix |
|---|---|---|---|---|---|---|
| RP-01 | **blocker** | **Chrome at 1024 and 820. The account menu, and with it Sign out, is off-screen.** | `pack-p1-1024.png`: the palette collapses to its ⌘K key-cap (`app.css:653`), the tenant chip truncates, and the `AR` avatar stays on screen at the right edge. | Measured with `documentElement.scrollWidth` = **1343** at both 1024 and 820. `summary.whoami` sits at x **1315–1343**, and the palette, *Needs you* and *Billing period* also sit past the viewport. The page scrolls horizontally, and the only way to reach **Sign out** is to scroll the whole page sideways. At 390, `scrollWidth` is 453 for the same reason. At 1440 and 1280 the chrome fits (the nav clips instead, see RP-02), so the overflow starts below the `max-width:1279px` step. | `pack-p1-1024.png` ↔ `app-p-deals-1024.png`, `app-p-deals-820.png`, `app-p-deals-390.png` | Make the chrome's flex children shrink below the 1279 step. Measure why `.chrome > nav{min-width:0;overflow:hidden}` (`close.css:56`) stops constraining at ≤1279; the likely cause is the partner `.app` wrapper not carrying `min-width:0`. Add a gate assertion that `scrollWidth === innerWidth` on the partner host at 1024/820/390. |
| RP-02 | **major** | **Navigation at 1440 and 1280. The administrator's *People* destination is invisible.** | P1 draws nine destinations for an administrator (`P1 Partner.dc.html:28-44`). The pack's own frame is a partner *user*, so it shows five. | `navRight` = 841 while *People* sits at x 984–1027, which is clipped. *Rate cards* is cut mid-word ("Rate"). `.dests` scrolls with its scrollbar hidden (`close.css:67-70`), so there is no visual cue that more destinations exist. **People is the only built admin destination, and it is the one hidden.** The other five overflow items are quiet `<Soon>`s. | `pack-p1-1440.png` ↔ `app-p-deals-1440.png` | Give the bar a drop order: at the narrower steps, collapse or hide the quiet `<Soon>` destinations before a built one. At minimum, add an edge fade or overflow cue on `.dests`. |
| RP-03 | **major** | **Account menu: no theme control.** | G3392 (owner's ruling): *"a light/dark/system toggle in the account menu."* | The Close chrome receives `<ThemeToggle />` (`main.tsx:1196`). The partner account menu (`PartnerPortal.tsx:195-216`) has no toggle: the theme follows the OS, but nobody can override it here. The same gap exists on the staff console (RS-03). | `app-p-account-menu.png` | Pass `<ThemeToggle />` into the partner `AccountMenu` the way ChromeBar does. |
| RP-04 | **major** | **E1 pages on the partner host carry tenant-customer copy.** | E1 is drawn for the tenant surface (`E1 Errors.dc.html`, *"Back to your register"*). No partner variant is drawn. | On `partners.localhost`, a 404 offers **"Back to your register / where your work is"**, which links to `/close`, a surface this host does not serve (`ErrorPage.tsx:56`). The 401 says *"The plane's own answer rather than an account"*, which is engineering vocabulary on a partner-facing page. | `pack-e1-1440.png` ↔ `app-p-404.png`, `app-p-nosession.png` | **Owner ruling needed:** per-surface E1 ways and copy for the partner and console hosts. Then make `ErrorPage` take the surface (`routes/surface.ts`) and choose ways from it. |
| RP-05 | **major** | **No skip link and no page heading.** | `P1 Partner.dc.html:21-22`: `<a class="skip" href="#work">Skip to the work</a>` and `<h1 class="sr-only">Reconcile AI · partner portal</h1>`. | `PartnerPortal.tsx` renders neither. The `#work` target span exists at `:937`, but nothing links to it. The staff console has both (`StaffConsole.tsx:719-720`), so the omission is specific to the partner portal. | n/a (source) | Add `<SkipLink target="work">` and the sr-only `h1`, as `StaffConsole` does. |
| RP-06 | minor | **Role flicker on load.** | One chrome per role. | Until the roster read answers, the chrome draws the partner-*user* layout: no Arrangement, Rate cards or People, the sub-line reads *"partner portal"* and the status bar reads *"signed in"*. When the read lands, it reflows to the administrator layout. The navigation shifts under the cursor. | `app-p-loading.png` ↔ `app-p-deals-1440.png` | Hold the role-dependent items, sub-line and status bit until the roster read settles, or reserve their space. |
| RP-07 | minor | **Loading figures read as "unmeasured".** | `—` is the pack's mark for *not measured* (C1, and S1's *Stalled over 14 days*). | During loading, *Accepted claims*, *Waiting on us* and *Dormant* all show `—`. That is the same glyph as the quiet *Matched to a lead*, so a slow read looks like "this is never measured". | `app-p-loading.png` | Show an empty figure or a reading state during the load, and keep `—` for "not measured". |
| RP-08 | minor | **Microcopy departures from P1.** | `P1 Partner.dc.html` and `table.js`. | (a) The deal form label reads *"Deal value, a year"*; the pack has *"Deal value, **SGD** a year"* (`:140`). (b) The table bar reads *"Filter by column"*; the pack has *"Filter"* (`table.js` `filterLabel`). (c) The count reads *"3 claims"*; the pack has *"5 rows"* (`table.js:205-207`). (d) The pager uses the words *Previous* and *Next*; the pack uses `‹` `›` with aria-labels (`:196-198`). (e) The status bar reads *"partner portal · control plane… · partner administrator"* with the role right-aligned. The pack shows *firm · period · cards · control plane · person · role* (`:1045-1050`). Dropping the unserved values is honest; right-aligning the role is a layout departure. (f) The billing-period `<Soon>` drops the pack's two-part label (*"March 2026 billing period"*, with the period in ink and the label in `q`). (g) The administrator's account menu omits the pack's *Administration · people and cards* item, which should be quiet rather than absent (`:59-61`). | `pack-p1-1440.png` ↔ `app-p-deals-1440.png`; `app-p-register.png` | Restore the pack strings. For (a), the currency belongs to the operation. **Owner ruling:** is a currency-less amount acceptable on the wire? |
| RP-09 | minor | **Row headers are bold.** | `app.css:614` sets `.tbl th,.tbl td{font-weight:var(--w-body)}`, so pack row headers are regular. | `partner.css:145` adds `.portal .tbl tbody th{font-weight:var(--w-emph)}`. Customer names are bold in the partner portal and regular in the staff console. The same pack table renders two ways. | `app-p-deals-1440.png` ↔ `app-s-tenants-1440.png` | Drop `partner.css:145` (and `:161`). |
| RP-10 | minor | **Sandbox (no-tenant state) sets prose in figure slots.** | R9: a figure is Plex Mono, tabular and `--s4`, for numbers a reader compares. | *"your account"* and *"about 2 days"* are rendered as `.fig .v`, which is large mono (`PartnerPortal.tsx:747-748`). The pack draws no no-sandbox state, so this state is the app's own invention. | `app-p-sandbox-1440.png` | Use `v sm` (as staff does) or a plain definition line. |
| RP-11 | minor | **Live sandbox omits pack sections without drawing them quiet.** | `P1` sandbox (`pack-p1-sandbox.png`) draws: the *This month, wholesale* figure; the *What the sandbox refuses* table; *Who at your firm can reach it*. | `PartnerPortal.tsx:673-729` draws none of these and no `<Soon>`. The document ledger is correctly hidden under G3193. The three above are not refused, only unserved. **Not rendered here:** the fixture has no live sandbox, so this is source evidence. | `pack-p1-sandbox.png` | Draw them quiet per G3091, or record why each is absent. |
| RP-12 | minor | **Inline styles for spacing.** | Pack markup does the same (`style="margin-top:calc(var(--u)*3)"`). | 28 `style={{…}}` in `PartnerPortal.tsx`, all token-valued, so there is no token bypass. They make the spacing unreachable from `partner.css`. | n/a | Optional: lift the recurring `marginTop` pairs into `.pane` rhythm rules. |

### Staff console (S1)

| id | sev | element / screen | pack expectation | observed | screenshots (pack ↔ app) | suggested fix |
|---|---|---|---|---|---|---|
| RS-01 | **major** | **390: the whole pane overflows, not just the table.** | `pack-s1-390.png`: the pane wraps; the table scrolls inside `.scroller`; the page does not scroll sideways. | `scrollWidth` = **628** at 390. The figures (*"In their own a…"*), the prose (*"deployme…"*) and *Support access* / *Open* are cut off at the viewport edge, and the account menu is at x 452–479. `.staff .tbl{min-width:38rem}` (`staff.css:105`) pushes the pane wider, because `.staff-work` is a flex column whose children keep `min-width:auto`. The scroller never gets a constrained width. | `pack-s1-390.png` ↔ `app-s-tenants-390.png`, `app-s-tenant-390.png` | `min-width:0` on `.staff .pane` (and `.staff > .staff-work`), so `.scroller{overflow-x:auto}` takes effect. Gate the same `scrollWidth` assertion as RP-01. |
| RS-02 | **major** | **E1 pages on the console host carry tenant-customer copy and internal jargon in the quote line.** | E1 is the tenant surface's. | A 503 on the staff console reads: *"Your plane did not answer… it calls the plane your data lives in… If a run was due, it will be held"*. A staff person has no plane, no data and no run here. The quote lines are composed in `StaffConsole.tsx:708-714` as **"503 · the plane answered 503"** and **"401 · no session — the plane returned 401"**: engineering phrasing where E1 puts a code. | `pack-e1-1440.png` ↔ `app-s-503.png`, `app-s-nosession.png` | Same owner ruling as RP-04. Meanwhile, quote the status and code only (`503 · upstream_unavailable`), as `PartnerPortal`'s `Unread` does. |
| RS-03 | **major** | **Account menu: no theme control.** | G3392. | `StaffConsole.tsx:184-213`: Profile and Sign out only. | `app-s-account-menu.png` | As RP-03. |
| RS-04 | minor | **"Coming soon" printed as table content.** | G3091: *"a small tooltip says 'Coming soon'"*. S1 draws H9 and H10 as populated tables (`S1 Staff.dc.html:323-371`). | `QuietTable` (`StaffConsole.tsx:378-389`) puts the literal visible string *Coming soon* in a body row of each table. This is the one place on any audited surface where the tooltip text is drawn as page copy. H4's *New floor* input (`S1:316-318`) is omitted rather than drawn quiet. | `app-s-tenant-full.png` | Draw the pack's empty table quiet (headers plus a muted empty row with no words, or a `<Soon>` affordance). Draw the *New floor* field disabled. |
| RS-05 | minor | **Billing-period control renders as a stray lowercase label.** | `S1`: *"March 2026 · billing period"*, a two-part `abtn`. | `StaffConsole.tsx:179-181` renders only `<span class="q">billing period</span>` inside the Soon. It shows as small grey mono text in a large empty box with a leading gap. The partner version shows *"Billing period"*, so the two surfaces label the same control differently. | `pack-s1-1440.png` ↔ `app-s-tenants-1440.png` | Match the partner label, or draw the pack's two parts with the period as `—`. |
| RS-06 | minor | **Avatar initials "1C" for every staff person.** | Pack: the person's initials (`AP`). The app's own rule (D6-9, `ChromeBar.tsx:123`) is that no initials are derived from directory text, so Close and the partner portal draw `·`. | The staff console hard-codes `1C`, the org's initials, for whoever is signed in (`StaffConsole.tsx:168`). Three surfaces, two rules. | `app-s-tenants-1440.png` ↔ `app-p-deals-1440.png` | Use `·`, consistent with D6-9. **Owner:** confirm the D6-9 reading applies to the avatar. |
| RS-07 | minor | **Tenant record figures differ from the pack.** | `S1:249-253`: *Mode · Residency · **Retention** · Support access · Plan*. | The app shows *Mode · Residency · Support access · Plan · **Stage***. Retention is dropped silently, not drawn quiet, and Stage is added. Values are mono at `--s2`, consistent with the pack's `font-size:var(--s2)`. | `app-s-tenant-full.png` | Draw *Retention* as `—` if it is unserved. Keep *Stage* only if the owner wants it on the record. |
| RS-08 | minor | **Unmeasured figure treated two ways.** | — | *Stalled over 14 days* is a plain `—` with `aria-label="not measured yet"`. The partner portal's *Matched to a lead* is a muted `<Soon className="fig">`. The same situation gets two treatments. | `app-s-tenants-1440.png` ↔ `app-p-deals-1440.png` | Pick one (G3092 says `<Soon>`). |
| RS-09 | minor | **820: the tenant chip is cut without an ellipsis.** | `.chrome .tenant` truncates with an ellipsis (`app.css:78`). | At 820 the chip shows *"1Cloud"* hard-clipped and butting against *Tenants*. The staff chip is a `<span>` with two text runs; the pack's is a `<button>`. | `app-s-tenants-820.png` | Wrap the name in an inner span with `overflow:hidden;text-overflow:ellipsis`. |
| RS-10 | minor | **A tenant record is not addressable.** | The pack is a prototype (state only). | Opening a tenant is component state (`StaffConsole.tsx:681`). Browser Back leaves the console, and a record cannot be linked or reloaded. | n/a | Route `/tenants/:id` when the console gains a route table. |

### Apex site (`frontend/site`)

| id | sev | element / screen | pack expectation | observed | screenshots (pack ↔ app) | suggested fix |
|---|---|---|---|---|---|---|
| RA-01 | **major** | **`/lookup/`: the host suffix is uppercased and breaks mid-hostname.** | Hostnames are mono, lowercase and unbroken (`.mono`). | The suffix renders as **`.US-WEST-` / `2.RECONCILEAI.APP`**: uppercase micro-label tracking, wrapped at the hyphen. The input and suffix sit inside a wrapper `<span>` that is a direct child of `label.field`, so `public.css:173` `.field > span{text-transform:uppercase;letter-spacing:var(--tr-micro)…}` styles it as a label (`Lookup.tsx:177-191`). This suffix is the one string the person reads to know what to type. | `app-a-lookup-routed-filled.png` | Make the wrapper a `div`, or reset `text-transform`/`letter-spacing` on it, and add `white-space:nowrap` to the suffix. |
| RA-02 | minor | **`/lookup/` jargon.** | Plain language (`PRODUCT.md`). | Routed panel: *"The lookup names **a door**, not an address"*. "Door" is internal vocabulary for an identity connection. | `app-a-lookup-routed.png` | E.g. *"We found your organisation's sign-in, but not its address here…"*. |
| RA-03 | minor | **`/demo/` copy departs from V2.** | `V2 Book a Demo.dc.html:440,459`: *"› … Nothing here is stored until you **book**."* | `Demo.tsx:214,417`: *"… until you **send it**. ›"*. The wording is changed and the `›` moved from leading to trailing. The change may be deliberate, since nothing is booked by the intake. | `pack-v2-1440.png` ↔ `app-a-demo-1440.png` | **Owner:** accept the deviation (and amend the pack) or restore it verbatim with the leading `›`. |
| RA-04 | minor | **`/lookup/` has no drawn screen; V3's non-refused content is not carried.** | V3 draws the *Sign-in service · reachable* light and the *You land in the right place* panel (four role cards). The passkey and emailed link are refused (G230/G265, hidden under G3193). | `Lookup.tsx` draws the email form only. The role panel is prose about what each class sees, and is not refused. The pack's `/lookup` exists only as a route-table row and V3's `#why-same` anchor. | `pack-v3-1440.png` ↔ `app-a-lookup-1440.png` | **Owner:** should `/lookup` carry V3's right-hand panel? |
| RA-05 | minor | **Apex is light-only under an OS dark scheme.** | V1–V4 never set `data-theme`, so the pack is light-only too. | `theme` is `null` on every apex page under `colorScheme: dark`; the site never calls `startTheme()`. This is consistent with the pack. | `app-a-home-1440-dark.png` | **Owner:** does G3392 extend to the apex? If not, record that the marketing plane is light-only. |
| RA-06 | minor | **`/demo/` step one: *Continue* gives no reason when unavailable.** | V2: a commit button (`data-commit`). | With fewer than *"a document type and an exception type"* answered, *Continue* renders on `--sheet` with no ink fill. The hint line beneath says why, but the button itself does not. **The script did not reach step two**: its single click did not satisfy the two-answer gate, so the sent and failed screenshots show step one. | `app-a-demo-step2.png`, `app-a-demo-failed.png` | None needed if the pack confirms. Re-drive steps two and three in the re-audit. |

### What holds (measured, so the next round does not re-check it)

- **Fonts.** `document.fonts.check` returns true for Plex Sans and Mono on every captured page
  of all three surfaces. Faces are self-hosted, hashed and preloaded in both `index.html` files.
- **Colour.** Every computed colour on the partner and staff pages, in light and dark, resolves
  to a kernel token. The single non-token value is `.logo .badge{color:#fff}`, which is the
  kernel's own (`tokens.css:681`). No raw hex, rgb or hsl appears in `partner.css`, `staff.css`
  or `frontend/site/src`.
- **Dark mode.** Both signed-in surfaces recompute cleanly under `prefers-color-scheme: dark`
  (`app-p-*-dark.png`, `app-s-*-dark.png`) and match `pack-p1-dark-1440.png` and `pack-s1-dark-1440.png`.
- **Copy.**
  - Visible text on P1 and S1 is otherwise verbatim pack, with the pack's journey ids
    (*"That is C12 when … P8"*) correctly dropped.
  - No G-number or raw id is drawn on any product surface. The regex census found none.
  - The apex V1 and V4 copy is verbatim except the G3152 removal of the AWS Marketplace sentence
    and logos, plus curly apostrophes.
- **The mark.**
  - The three-dot mascot is static on P1, S1, V1 and the lookup card, as in the pack.
  - It runs `mascot-cascade` on V4's story, as in the pack, and **stops under `prefers-reduced-motion`** (0 animations).
  - The partner and staff surfaces run no animation, and P1 and S1 draw none.
- **Luminous touch.** P1 and S1 draw no agent-affected region, so none is owed. This passes by absence.
- **Quiet unbuilt.** Every unserved control on P1 and S1 is a `<Soon>` (muted, `aria-disabled`,
  no hatch) except RS-04. Refused items are hidden as G3193 requires: *Open the sandbox* (G270),
  the sandbox document ledger, the non-administrator's People, Arrangement and Rate cards, and
  S1's Billing, Partners and Support destinations.
- **States drawn.** Each of the following was checked and is worded in the pack's voice:
  - loading (*"Reading your claims."*, *"Reading the tenancy."*)
  - 503 in-pane (*"…quote 503 · upstream_unavailable if it persists."*)
  - 403 in-pane, for the partner user's People and the staff roster
  - empty (*"You have not registered a deal yet…"*, *"No tenants yet…"*)
  - a refused write (422 precedence) and a sent write (202)
  - force-step validation and its result

## Counts

| | blocker | major | minor | total |
|---|---:|---:|---:|---:|
| Partner (RP) | 1 | 4 | 7 | 12 |
| Staff (RS) | 0 | 3 | 7 | 10 |
| Apex (RA) | 0 | 1 | 5 | 6 |
| **all** | **1** | **8** | **19** | **28** |

## Owner rulings needed

1. **E1 on the partner and console hosts (RP-04, RS-02).** E1 is drawn for the tenant customer.
   What are the ways out, and what is the voice, for a 401, 404 or 503 on `partners.` and `console.`?
2. **The avatar (RS-06).** Does D6-9's *"no initials derived"* apply to the staff console's
   avatar? Today it reads `1C` for everyone, while Close and P1 draw `·`.
3. **The currency on a deal registration (RP-08a).** The pack says *"SGD a year"*; the wire
   takes no currency.
4. **The V2 microcopy deviation (RA-03).** *"until you book"* versus *"until you send it"*.
5. **The `/lookup` drawing (RA-04).** Should it carry V3's right-hand panel?
6. **G3392 on the apex (RA-05).** Light-only, or follow the OS?

## Not covered (stated so the re-audit picks it up)

- **The partner sandbox `live` state.** The fixture seeds none, so RP-11 rests on source evidence.
- **The demo intake's steps two and three** (RA-06).
- **Partner hand-back, reset and trial.** All three are `<Soon>` and were not exercised.
- **Keyboard traversal and focus order.** Not measured beyond the skip link (RP-05).

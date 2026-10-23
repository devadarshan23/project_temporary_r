# RED re-audit: colour, tokens, typography, iconography, theme, responsive

> **STATUS:** REPORT ONLY. No product code changed. Branch `audit/reaudit-visual-tokens`
> from `origin/main` at `5dae45af` (includes #545 foundations, #546 secondary
> surfaces, #547 Close surface). Re-audited 3 Oct 2026 against the first pass,
> `docs/build/ui-audit/red-visual-tokens.md` (RV-01 to RV-18, taken at `79631f2e`).
> **Authority:** `docs/handoff-pack/tokens.css` (the kernel), `app.css`, `public.css`,
> `C1 Close.dc.html`, `E1 Errors.dc.html`, `V1 Landing.dc.html`.
> **Rulings respected:** G3091, G3092, G3193, and the 3 Oct owner rulings G3392
> (dark theme), G3396/G3397 (motion kernel). Findings that say "put to the owner"
> are not reported as defects of the slice.

## How this was measured

1. `npm ci && npm run build:frontend` (portal `frontend/dist` + apex `frontend/site/dist`).
2. A private PostgreSQL 14 (own cluster, own port, deleted afterwards) seeded with
   exactly `tests/e2e/close-parity.shot.ts`'s data; a real `startDataPlane()` behind
   `tests/e2e/single-origin.ts`. Production authoriser, no test-token flag.
3. Headless Chromium (Playwright) at **1440, 1024, 820, 390** × **light and dark**
   (`colorScheme` on the context, so the dark frames are the OS preference going
   through `theme-boot.js` → `data-theme`, the path a real reader takes). The pages:
   `/close`, `/close` with row 1 open, `/close/finding/:ref`, `/close/run/:runId`,
   `/setup`, `/signin`, a 404, apex `/` and `/demo/`, plus the pack's C1 at the same
   widths (with `data-theme="dark"` set on it for the dark frames).
4. On every page a census ran: font availability (canvas `measureText` of
   `"IBM Plex Sans"`/`"IBM Plex Mono"` 400 and Mono 500 against bare `serif`, plus
   `document.fonts` loaded entries), document `scrollWidth` against the viewport,
   every rendered element's computed colours mapped back to a kernel token, every
   text run's font-size mapped to an `--sN` step, and every positioned `z-index`.
5. A source census of `frontend/src/**` and `frontend/site/**`, comments stripped.

The harness was a temporary copy of `close-parity.shot.ts` extended with the census;
it is not committed.

Screenshots: `docs/build/ui-audit/screens/reaudit/`, named
`<page>-<theme>-<width>.png` (`app-*` portal, `site-*` apex, `pack-c1-*` the pack).

## Verdict in one paragraph

The fix PRs did most of what the first pass asked, and they did it measurably. **The
blocker is gone**: IBM Plex is self-hosted, preloaded and *rendered*, so canvas
measures true for Sans, Mono and Mono 500 on all 9 app pages in both themes and on
the apex site. The source is clean: **0** raw hex/rgb, **0** bare font-weights,
**0** literal face stacks, **0** literal z-index values in `frontend/src/**.css`.
Every computed colour on every app page, light and dark, resolves to a kernel token
(the one exception is the badge's `#fff`, which is the kernel's own literal). The dark
theme now ships and applies cleanly. No page scrolls sideways at any of the four widths.
**What is left is small**: the entity chip clips without an ellipsis at mid width, the
quiet Accept is filled with an ink-ramp colour used as a ground, the signed-out back
link still has no underline, Setup is still typeset by utilities, and some coverage gaps
(the raw-value guard does not read inline styles or the apex site).

## Prior findings: verdicts

**12 closed · 4 partial · 2 open** (of 18).

| id | was | verdict | evidence |
|---|---|---|---|
| RV-01 | blocker: Plex never loaded | **CLOSED** | `frontend/fonts/plex.css` declares 8 `@font-face` (Sans 200/300/400/600/700, Mono 400/500/600, `font-display:swap`), imported by `main.tsx` and `site/src/entry.tsx`. `frontend/index.html:21-22` preloads Sans 400 and Mono 400, and Vite rewrites both to the same hashed asset (`dist/index.html`: `/assets/IBMPlexSans-Regular-BiEB_oxT.woff2`). Measured: `plexSans/plexMono/plexMono500 = true` on all 72 app frames; `/close` loads Sans 400/600/700 and Mono 400/500/600. The apex site drops Google Fonts (`site/*.html:9`). Guarded by `tests/app/self-hosted-fonts.test.ts`. |
| RV-02 | major: figures in fallback mono | **CLOSED** | Follows from RV-01. Mono 500 (`--w-figure`) is a real cut and is loaded; see `app-close-light-1440.png` (*SGD 112,204.00*, *5*). |
| RV-03 | major: run times right-aligned sans | **CLOSED** | `RunAccount.tsx` `<dd className="mono">` (`grep -n '<dd' frontend/src/components/RunAccount.tsx`); times formatted *30 Sep 03:12 UTC*, period and definition reference in mono (`app-run-light-1440.png`). |
| RV-04 | major: Accept lost its commit shape | **CLOSED** (see N-02) | `Soon.tsx:46,51` passes `data-commit`; `ExceptionRegister.tsx:387` `<Soon className="abtn" commit>`; `close.css:410-412` keeps a filled ground on the quiet commit. The shape is back. *The colour chosen for the fill is a new finding, N-02.* |
| RV-05 | major: five literal face stacks | **CLOSED** | 0 literal stacks in `frontend/src/**.css`; `bridge.css:249-266` licence comment corrected in place. |
| RV-06 | major: destinations vanished at 820 | **CLOSED** (see N-01) | `close.css:452-455` keeps `.chrome > nav{flex:none}` and sheds the audit door and meter prose first. Close/Ask/Reports and the ink underline are drawn at 1024 and 820 (`app-close-light-820.png`). |
| RV-07 | minor: `∴` recoloured muted | **CLOSED** | `close.css:241,246` `.fig .met` / `.fig[data-soon] .met{color:var(--agent-deep)}`; `close.css:107` the meter's mark likewise. |
| RV-08 | minor: evidence label dropped `∴` | **PARTIAL** | Fixed in the register's evidence panel: `ExceptionRegister.tsx:332-333` draws *What the machine did · — ∴*. **Not** on the finding page: `Finding.tsx:150` `<span className="lab">What the machine did</span>` has no mark (`app-finding-light-1440.png`). One label, two spellings. |
| RV-09 | minor: key-caps all muted, ⌘Z missing | **CLOSED** | `close.css:401` live key-caps `--ink`; `:403` only `.keys-soon kbd` muted; ⌘Z undo drawn quiet (`app-close-light-1440.png`, bottom right). |
| RV-10 | minor: 13 bare weights | **CLOSED** | Census: 0 `font-weight:<number>` in `frontend/src/**.css`. (The 8 in `fonts/plex.css` are `@font-face` descriptors, which must be numbers.) |
| RV-11 | minor: tracking/leading literals | **PARTIAL** | `.1em` → `--tr-micro`, `1.5` → `--lh-note`, `1` → `--lh-solid` (G3395). Still literal and put to the owner (G3400): `entry.css:171` `.06em`, `entry.css:295` `.12em`. These are allow-listed with reasons in `tests/app/css-raw-values.test.ts:69-77`, which is the right state for an open owner question. The apex site adds `.08em` (see N-07). |
| RV-12 | minor: z-index literals | **CLOSED** (see N-11) | Every `z-index` in `frontend/src` is a token or a `calc()` on one (`overlays.css:71,82,267,310`, `shell.css:176`, `close.css:125,382,489`). Measured layers: status bar 18, tab bar 19, tooltip 20, account menu 41. The stale "no z-index scale" comment is corrected (`overlays.css:67`). |
| RV-13 | minor: dark theme unreachable | **CLOSED** | Owner ruling G3392 applied: `frontend/src/theme.ts` is the only writer of `data-theme`; `frontend/public/theme-boot.js` paints the first frame; `ThemeToggle` sits in the account menu (`main.tsx:1167`). Measured: all 36 dark app frames have `data-theme="dark"`, `--paper` `#001a22`, computed `color-scheme: dark`, and **every** computed colour maps to a dark-theme token. See `app-close-open-dark-1440.png`. (The apex site is not covered: N-05.) |
| RV-14 | minor: back link un-underlined | **OPEN** | `entry.css:46-47` `.entry .top a, .e1 .top a { text-decoration: none; }` is unchanged, so *‹ Back to the site* is still plain grey on `/signin` and every E1 page (`app-signin-light-1440.png` against `E1 Errors.dc.html:24`). |
| RV-15 | minor: header wraps at 820 | **CLOSED** | `close.css:417` `.close .regt thead th{white-space:nowrap}`; *VALUE AT RISK* is one line at 820 and 1024. |
| RV-16 | minor: placeholder in the monogram square | **PARTIAL** | The name and sub-line are now served (*Parity Operator · Customer*, G3354/G3435). The square still draws a bare `·`: `ChromeBar.tsx:269` `<span className="init" aria-hidden="true">·</span>`. `ChromeBar.tsx:122-124` refuses to derive initials (*"slicing a name is interpreting it"*, D6-9), which is a reasoned position. But the pack draws a mono monogram there (*RT*), and the first pass asked for an **empty** square rather than a glyph if no initials can be had. Either way it needs an owner ruling rather than a dot. |
| RV-17 | minor: drill-downs typeset by utilities | **PARTIAL** | The run account and the finding now use pack classes under `.page` (`frontend/src/secondary.css`, ported from `app.css`): breadcrumb, `.lab`, `.fig`. **Setup is unchanged**: 23 `text-title/body/label/micro` utilities in `Setup.tsx`; its gutter is 24px against `.page`'s 44px, so the left edge moves between Setup and the other drill-downs; and *Needs you* still loses its count on `/setup` (`app-setup-dark-1440.png`). |
| RV-18 | minor: "What to quote" (pack-internal) | **OPEN** | An owner/pack question; the pack is unchanged and so is the app. |

## New findings

Severity: **major**: a visible departure a reviewer will name · **minor**: invisible
today, small, or a coverage gap. No new blocker.

| id | sev | where | evidence | pack / kernel reference | note |
|---|---|---|---|---|---|
| N-01 | **major** | Chrome entity chip at ≤ 1279px | At 1024 and 820 the chip reads *Meridian Group Pte Ltd  a*: the region label is cut mid-glyph with no ellipsis (`app-close-light-1024.png`, `app-close-light-820.png`). Cause: `close.css:58-62` declares `display:flex` on `.chrome .tenant` *and* `overflow:hidden;text-overflow:ellipsis`. `text-overflow` does not apply to a flex container's anonymous children, and `close.css:458` then caps the width at `calc(var(--u)*40)`. | `app.css:74-79`: *"the tenant name truncates"*, with `.chrome .tenant{…text-overflow:ellipsis;display:block;line-height:var(--target)}`. `pack-c1-light-820.png` draws *Meridian …*. | Introduced by #547's mid-width work (RV-06). Use the pack's `display:block`, or put the ellipsis on an inner span with `min-width:0`. |
| N-02 | minor | Quiet commit act (Accept) | `close.css:410-412` `.close .abtn[data-commit][data-soon][aria-disabled="true"]{background-color:var(--muted);color:var(--on-ink)}`. `--muted` is an **ink** step (supporting text) used here as a **ground**. In dark it becomes the lightest slab in the row (`app-close-open-dark-1440.png`), louder than the live outline buttons beside it. | `tokens.css:24-26` *"Three grounds only, plus two hover grounds. A fourth ground is a finding"*; `tokens.css:31-33` the ink ramp: *"Each step has ONE job. Pick by the job"*. | Contrast passes (5.49:1 light, 5.60:1 dark). The defect is semantic. A quiet commit needs a kernel answer, for example an `--rule-strong` hairline with an `--ink` hatch, or an `--on-ink-2` treatment. **Put to the owner** rather than repaired at a call site. |
| N-03 | minor | Theme toggle buttons (account menu) | `shell.css:232-243`: `font-size:var(--s1)` (11px), `line-height:var(--lh-solid)`, `padding:calc(var(--u)*1.5) …` gives a **23px** box with no `min-height`. The kernel's `button{min-width:var(--target-min)}` (`tokens.css:552`) sets width only. | `tokens.css:270` `--target-min:1.5rem; /* 24px · the 2.5.8 floor */`; `:271` `--target` 32px *"what the system's controls actually are"*. | One px under the WCAG 2.5.8 floor and 9px under the system's own control height. Add `min-height:var(--target-min)` (or `--target`). |
| N-04 | minor | S1 staff console and P1 partner portal | Both have an account menu (`StaffConsole.tsx:186-200`, `PartnerPortal.tsx:195`) and neither mounts `<ThemeToggle/>`. They do follow the OS, because `theme-boot.js` runs on every host, but a reader cannot override it. | G3392 (owner): *"Dark theme follows the OS setting … with a light/dark/system toggle in the account menu."* | Mount the toggle in both menus. |
| N-05 | minor | Apex site, light/dark parity | No `data-theme` is ever set on the apex. The kernel's `html{color-scheme:light dark}` (`tokens.css:497`) therefore computes on a page painted light. Census, `site-home-dark-1440`: `data-theme=null`, `colorScheme:"light dark"`, body `rgb(255,255,255)`. On a dark OS the UA's own surfaces (scrollbars, autofill, date pickers) render dark over a white page. | `tokens.css:499-500` (added by #545 for exactly this mismatch on the portal: *"Without these a reader on a light OS who picks dark gets light scrollbars on a dark page"*). | Either set `data-theme="light"` on the apex `<html>` (light-only) or load `theme-boot.js` there too. Whether the apex follows the OS is unruled, so this is for the owner. |
| N-06 | minor | Kernel edited by a derived slice | `docs/handoff-pack/tokens.css:223-229` mints `--lh-solid:1` under G3395, which records itself as *"derived … NOT THE OWNER'S"*. In the same pass, the off-scale trackings from the same audit item were correctly **put to the owner** (G3400). | `tokens.css` is the north star (G264/G274); the first pass recommended the kernel question go to the owner. | The value is reasonable. The process is inconsistent: one kernel token was minted without a ruling and its sibling was escalated. Ratify G3395 or revert it. |
| N-07 | minor | Raw-value guard coverage | `tests/app/css-raw-values.test.ts:43-44` scans only `frontend/src/**.css`. It cannot see TSX inline styles (`style={{` ×46 in `StaffConsole.tsx`/`PartnerPortal.tsx`, ×83 in `frontend/site/src/*.tsx`) or the apex site. Today the portal's inline styles are token-bound (`calc(var(--u)*n)`, `margin:0`, `textAlign`). The apex carries `#fff` (`PublicPlane.tsx:147`), `letterSpacing:'.08em'` (`PublicPlane.tsx:139`, `Story.tsx:61`) and `lineHeight: 1` on display figures (`Landing.tsx:108`, `Story.tsx:35,58`). | `.08em` is off the paired scale (`tokens.css:205`, `--tr-micro .1em`); `--lh-solid` is *"never on prose"* and these are display figures. **All four are copied verbatim from `V1 Landing.dc.html:414-420`**, so they are pack-faithful and two-sided, like RV-11. | Extend the guard to inline `style` objects and to `frontend/site`, allow-listing the pack-copied values with reasons. |
| N-08 | minor | `.page` width literal | `secondary.css:13` `.page{…max-width:1440px}`, a raw px where the kernel has a token (`--bp-wide:1440px`, `tokens.css:300`). That token is a *breakpoint*, though. The kernel's page width is `--measure:73.75rem` (1180px, `tokens.css:296`; *"ULTRA 1440+ — --measure holds and the page centres"*, `:281`), so the drill-downs use neither the token nor its value. | `tokens.css:9` *"px ONLY for optical constants"*. | Bind to `var(--measure)`. |
| N-09 | minor | Account menu layer and overflow | `close.css:125` `.acctmenu{z-index:calc(var(--z-modal) + 1)}` puts a menu above the modal layer, and the app omits the pack's `max-height:80vh;overflow-y:auto` (`app.css:135`). The menu has grown a theme row (#545), so it is now the tallest anchored surface. | `tokens.css:425` `--z-popover … a tooltip or a menu`. The `--z-modal + 1` itself is **copied from `app.css:132`**, so it is two-sided. | Pack question for the layer. The missing overflow cap is an app omission. |
| N-10 | minor | 820 chrome: one destination too many | At 820 the app draws Close · Ask · **Reports**; the pack's 820 frame draws Close · Ask (`pack-c1-light-820.png` against `app-close-light-820.png`). | C1 at the mid tier. | Minor priority-order drift, left over from the RV-06 repair. |
| N-11 | minor | Optical nudges (pre-existing, not previously reported) | `close.css:294` `padding-top:calc(var(--u)*4 + 1.5px)` and `:295` `calc(var(--u)*4 - 5px)`. Both date from `a27f0b52`, so the fixes did not introduce them. | `tokens.css` §DEPTH: *"1.5px occurs once, at .conn[data-state="down"] … Not a step."* | Baseline alignment should come from `vertical-align`/line-height, not a 1.5px shim. |

### Not findings (checked and left alone)

- **Badge `#fff` in dark** (`span.badge`, the only off-token colour in 36 dark frames): this is the kernel's own literal at `tokens.css:681,686`, and the pack renders it the same way.
- **15.98px badge text and 17px mascot dots at 390**: kernel-derived (`--logo-size`) and identical in the pack.
- **Apex `h1` at 40–68px**: the pack's own `clamp(…cqw)` (`public.css:548`), sized to the column.
- **Tab bar active edge in `--accent`** (`close.css:495`): allowed by `tokens.css:96`, *"MAY the active destination's underline"*.
- **Breakpoints 719/720/1079/1080/1279/1440/1880**: these match `--bp-narrow`/`--bp-mid` or are copied from `app.css:63,66,76,120`. (`entry.css:266` `860px` is unchanged from the first pass's footnote.)
- **Iconography**: there are still no SVGs, by design. The glyph set is unchanged except that `⌘Z` is now drawn (RV-09). All glyphs render in Plex.

## Token coverage at `5dae45af`

### Runtime (computed styles, every rendered element)

| frames | colours off-token | font-sizes off-scale | sideways scroll |
|---|---|---|---|
| 36 light app frames (9 pages × 4 widths) | 0 | badge only (+ mascot at 390) | none (`scrollWidth == clientWidth` everywhere) |
| 36 dark app frames | badge `#fff` only (kernel literal) | same | none |
| apex `/`, `/demo/` at 4 widths × 2 OS themes | 0 | badge, `h1` (pack clamp) | none |
| pack C1 (reference) | n/a | n/a | **overflows** at 1440 (1505px) and 390 (691px). The app is better than its north star here. |

### Source (`frontend/src/**.css`, comments stripped)

| | first pass | now |
|---|---:|---:|
| raw hex / rgb / hsl | 0 | 0 |
| bare font-weight | 13 | **0** |
| literal face stack | 5 | **0** |
| literal tracking | 6 | **2** (both allow-listed, G3400) |
| literal line-height | 4 | **0** |
| z-index literal | 5 | **0** |

New stylesheets since the first pass (`secondary.css`, `luminous.css`, `staff.css`,
`partner.css`) carry no raw colour, weight, face, tracking or layer. Their px are
breakpoints and hairlines, plus N-08's `1440px` and a pack-copied `3px` underline offset.

## Top 5 still open

1. **N-01** (major): entity chip clipped mid-glyph at 1024/820, because `display:flex` defeats the ellipsis.
2. **N-02**: the quiet Accept uses `--muted` as a ground, a kernel violation, and it reads loudest in dark. Owner/kernel answer needed.
3. **RV-17** (partial): Setup still uses utilities, sits on a different gutter, and loses the *Needs you* count.
4. **RV-14**: the signed-out *‹ Back to the site* link still has no underline (`entry.css:46-47`).
5. **RV-08 / RV-16** (partial): the finding page's *What the machine did* lacks `∴`, and the monogram square still draws a `·` placeholder.

# RED audit — colour, design tokens, typography, iconography

> **STATUS:** REPORT ONLY. No product code changed. Branch `audit/red-visual-tokens`
> from `origin/main` at `79631f2e`. Audited 3 Oct 2026.
> **Scope:** the signed-in customer portal (`/close`, an opened register row,
> `/close/finding/:ref`, `/close/run/:runId`, `/setup`) and the signed-out pages
> (`/signin`, `/signin/lapsed`, `/close` signed out, a 404), each against the pack:
> `docs/handoff-pack/C1 Close.dc.html`, `E1 Errors.dc.html`, `V3 Sign In.dc.html`,
> `tokens.css`, `app.css`, `public.css`, `Handoff Specification.dc.html`.
> **Rulings read first and respected:** G3091 (pack-faithful, quiet), G3092 (`<Soon>`
> draws `--muted`), G3193 (refused controls are omitted). A muted unbuilt control is
> **not** reported as a defect on its own; where the finding is that the app departs
> from the pack *despite* G3091, the ruling is quoted.

## How this was measured

1. `npm ci && npm run build:frontend` (the production bundle, `frontend/dist`).
2. A private PostgreSQL 14 on `127.0.0.1:55471` (deleted afterwards), seeded with
   the exact data `tests/e2e/close-parity.shot.ts` uses (5 runs, 5 findings, one
   intake lane, one operator session on `ten_acme`), a real `startDataPlane()` and
   `tests/e2e/single-origin.ts` in front — production authoriser, no test-token flag.
3. Headless Chromium (Playwright 1.55.1) at **1440×900, 820×900 and 390×900** for
   every app route and every pack page. On each page a census ran in the browser:
   every token on `:root` resolved to a computed value, then **every rendered element's**
   computed `color`, `background-color`, borders, outline, `font-family`, `font-size`,
   `font-weight`, `line-height`, `letter-spacing`, `text-transform`,
   `font-variant-numeric`, shadows and SVGs, each mapped back to the token it equals.
   A glyph census recorded every non-alphanumeric character drawn and the style it
   was drawn in.
4. Font availability was measured, not assumed: a canvas `measureText` comparison of
   `"IBM Plex Sans", monospace` against bare `monospace` (equal width ⇒ the family
   is not available), plus `document.fonts`.
5. Source census of `frontend/src` with comments stripped (line numbers preserved).

Screenshots: `docs/build/ui-audit/screens/` — `pack-*` is the pack, `app-*` is the
rendered portal, suffix is the viewport width; `zoom-*` are 2× crops of the same
region of both; `*-full.png` are full-page.

## Verdict in one paragraph

**Colour is the healthiest axis**: no raw hex/rgb/hsl anywhere in product source, and
every computed colour on all nine app pages resolves to a kernel token. **Typography is
the worst, and one defect dominates everything else on the page: the portal never loads
IBM Plex.** Every sans and every mono run — the money column, the figures, the ids, the
key-caps — renders in the system fallback, so the deployed product cannot look like the
pack no matter how faithfully the CSS was ported (and the CSS port is, measurably,
faithful: 147 of 157 matched `app.css` selectors carry identical visual declarations).
After that: a handful of real role errors (a figure set in sans and right-aligned on the
run account, the evidence panel's commit action drawn in the wrong shape, the agent mark
recoloured), and a tail of token bypasses that will bite the first time the kernel moves.

## Findings

Severity: **blocker** — the screen cannot match the pack until fixed · **major** — a
visible departure a reviewer will name · **minor** — invisible today, or small.

| id | sev | element / screen | pack expectation | observed | screenshots (pack ↔ app) | suggested fix |
|---|---|---|---|---|---|---|
| RV-01 | **blocker** | **Every screen — both faces.** | `tokens.css:155-156` `--face-sans:'IBM Plex Sans'…`, `--face-mono:'IBM Plex Mono'…`; every pack page loads them (`C1 Close.dc.html:13`, `E1 Errors.dc.html:13`, `V3 Sign In.dc.html` same line: Google Fonts, Sans 200–700, Mono 400–600). | **No font is ever loaded.** `frontend/index.html` has no `<link>`; `frontend/dist/assets/*.css` contains **0** `@font-face`; `document.fonts` is empty on all 9 app pages; canvas measure: Plex Sans **false**, Plex Mono **false** on every app page, **true** on every pack page. The computed `font-family` *says* `"IBM Plex Sans"` (176 elements on `/close`) — that is the declaration, not the rendered face. Text renders in `system-ui` / `ui-monospace` (or whatever the visitor has installed). Only the public site (`frontend/site/*.html`) loads the fonts. | `zoom-pack-c1-chrome.png` ↔ `zoom-app-close-chrome.png` (look at *each entity*, *audit trail*, *04:58*); `zoom-pack-c1-arrive.png` ↔ `zoom-app-close-arrive.png`; `pack-v3-1440` ↔ `app-signin-1440` | Self-host Plex (OFL) as woff2 under `frontend/public/fonts/`, declare `@font-face` once beside the kernel import in `bridge.css` (Sans 200/300/400/600/700, Mono 400/500/600 — the six `--w-*` jobs), `font-display:swap`, preload the 400 Sans + 400 Mono. Self-host rather than Google Fonts so the CloudFront security-headers policy (`infra/lib/edge-stack.ts:271`) needs no `font-src` widening and no visitor IP leaks to a third party. Add a gate assertion in `tests/design/` that `document.fonts.check('12px "IBM Plex Mono"')` is true on the built page. |
| RV-02 | **major** | **Money and figures in the fallback mono** (`/close` register *Value at risk*, the four figures, the run strip clocks, the meter). | Kernel R9 / "THE TABULAR FIGURE RULE": figures are Plex Mono, tabular, `--w-figure` 500 (`tokens.css:485`, `app.css` `.fig .v`, `.row .num`). | `font-variant-numeric:tabular-nums` **is** set (35 elements) but on a fallback face: digit widths, the slashed zero (`0` under *Exceptions raised*) and the `,`/`.` rhythm differ from the pack's; the figure weight 500 has no matching cut, so it synthesises or snaps. A consequence of RV-01, listed separately because it is the one typographic job the kernel calls non-negotiable (a reader compares a figure against another instance of itself). | `app-close-open-row-full.png` (row 1 *SGD 112,204.00*, *0*) ↔ `pack-c1-full.png` (*1,806*, *112,204.00*) | Closed by RV-01. Then verify by measuring two stacked money cells' right edges are pixel-aligned across 3 rows. |
| RV-03 | **major** | **Run account — `/close/run/:runId`, *The run* panel: STARTED / FINISHED.** | `tokens.css:485-487`: `.mono,.figure,td.num,th.num{font-family:var(--face-mono)…}` and `.num{text-align:right}` — mono is granted to **table** cells only. Pack times are formatted short (`03:12`, `06 Mar 03:02`). | `RunAccount.tsx:543,545` put `className="num"` on a **`<dd>`**: it inherits the right-align and **not** the mono, so two raw ISO strings (`2026-09-30T03:12:00.000Z`) float to the far right edge (x≈1400) in sans while every other `dd` sits left in the grid. DEFINITION / PERIOD values (`def_three_way_match v4`, `per_2026_09`) — references, R9's mono job — are also sans. | `app-run-1440.png` (no pack drawing of this screen exists; compare the kernel rule) | Use `className="mono"` (or `figure`) on those `dd`s, not `num`; format the instant with the same clock formatter the strip uses (`Register.tsx` `clockOf`) plus date; put `mono` on the definition/period values. |
| RV-04 | **major** | **Opened row → *What you can do*** (Accept · Reject · Park · Attach). | G3091: *"draw exactly as the pack, visibly disabled"*. The pack draws the primary act as a **filled commit button**: `C1 Close.dc.html:247` `<button class="abtn" data-commit>` → `.abtn[data-commit]` ink ground, `--on-ink` text (see *Accept* in `pack-c1-full.png`). | `ExceptionRegister.tsx:195` and `Finding.tsx:192` render `<Soon className="abtn">Accept</Soon>` **without `data-commit`**, so Accept is an outline button identical to Reject/Park. The visual hierarchy the pack draws (one commit, three alternatives) is gone — this is a shape change, not the muting G3092 allows. | `pack-c1-full.png` (filled *Accept*) ↔ `app-close-open-row-full.png` | Pass `data-commit` through `<Soon>` on Accept and let the Soon rule mute the *fill* (e.g. `--rule-strong` ground, `--muted` text) so it still reads as the primary-but-unavailable act. Same check for `rowact[data-commit]` (`app.css` `.rowact[data-commit="true"]` has no app selector at all — cssdiff). |
| RV-05 | **major** | **Font stacks hard-coded outside the kernel.** | `tokens.css:155-156` — the one place a face is declared ("TWO FACES AND NO THIRD"). | `'IBM Plex Mono', ui-monospace, monospace` spelled literally **5×**: `shell.css:272`, `:281` (`.kbd`), `:343` (`.register .num` — the money column), `overlays.css:157`, `:316`. When RV-01 is fixed under a different family name, or the stack changes, these five silently diverge. And the comment that licenses not using a token is **stale**: `bridge.css:249-262` says *"There is NO font token for the body face … Minting a `--font-body` token is a KERNEL edit"* — the kernel has carried `--face-sans`/`--face-mono` since the pack landed. | n/a (source) | Replace all five with `var(--face-mono)`; correct the `bridge.css` comment (and consider `--font-sans: var(--face-sans)` / `--font-mono: var(--face-mono)` so Tailwind's `font-*` utilities point at the kernel instead of being deleted). |
| RV-06 | **major** | **Chrome at 820px.** | `pack-c1-820.png`: logo · entity · **Close · Ask** · ⌘K · Needs you · **meter figures** · **RT**. | `app-close-820.png`: the destinations **Close / Ask / Reports disappear entirely**, *audit trail* stays, and the meter text overflows the viewport and is clipped mid-word (*"of the plan this mo"*). The active-route indicator (the 2px ink underline) is therefore absent at tablet width. | `pack-c1-820.png` ↔ `app-close-820.png` | Follow the pack's priority order at the `--bp-mid` step: keep the destinations, collapse the palette to its ⌘K key-cap and drop *audit trail* first; give the meter `min-width:0;overflow:hidden;text-overflow:ellipsis` or drop its prose before its figure. |
| RV-07 | minor | **The machine mark `∴` recoloured.** | `tokens.css:906` `.met{color:var(--agent-deep)}` — the agent hue is the mark's one meaning; pack draws it agent-deep in the meter, the figures and the evidence label. | `close.css:234` `.close .fig[data-soon] .met{color:var(--muted)}` and the meter: the `∴` beside *Read by the machine* and in the meter is `--muted`/400 (census: pack `--agent-deep`/500 → app `--muted`/400). G3092 mutes **controls**; a figure's unit mark is not a control. | `zoom-pack-c1-arrive.png` ↔ `zoom-app-close-arrive.png` | Mute the *value*, keep `.met` on `--agent-deep` (or `--agent` at reduced emphasis); the dash already says "unmeasured". |
| RV-08 | minor | **Evidence panel label drops the mark.** | `C1 Close.dc.html:204`: `What the machine did · <span class="spent">{{ openSpend }} <span class="met">∴</span></span>` | `ExceptionRegister.tsx:143`: `<span className="lab">What the machine did</span>` — no `∴`, no spend. | `pack-c1-full.png` ↔ `app-close-open-row-full.png` | Render the `· ∴` with the dash-as-unmeasured spend (as the figures do) — the glyph is the pack's attribution of the panel to the agent. |
| RV-09 | minor | **Status-bar key-caps.** | `app.css:634-635` `.statusbar .keys kbd{…color:var(--ink)}`; keys **J K · ↵ · A · ⌘Z · ⌘K**. | `close.css:376-377` sets `color:var(--muted)` on **all** key-caps, including J/K/↵ which drive a built register; and the **⌘Z undo** key is absent (it is unbuilt, not refused — by G3193 it should be a quiet Soon, not omitted). | `pack-c1-1440.png` ↔ `app-close-1440.png` (bottom right) | Key-caps for built bindings in `--ink`; mute only unbuilt ones; restore `⌘Z undo` as a Soon. |
| RV-10 | minor | **Numeric font-weights instead of the six weight jobs.** | `tokens.css:188-194` `--w-display … --w-mark`: *"A weight is never used for emphasis outside its job"*; the kernel says five of six were once spelled as bare numbers and were tokenised for that reason. | **13** bare weights: `shell.css:160, 212, 259, 274, 316, 326, 350, 351, 352, 388`; `overlays.css:116, 266, 311` (all `600` or `400`). `close.css` and `entry.css` have **0** — the gap is only in the older files. | n/a | `600 → var(--w-emph)`, `400 → var(--w-body)`. |
| RV-11 | minor | **Tracking / leading literals off the paired scale.** | `tokens.css:205-208` *"TRACKING IS PAIRED WITH THE STEP"*: `--tr-micro .1em` for `--s1` uppercase, 0 for body/label; `tokens.css:220-222` `--lh-body 1.45`, `--lh-note 1.55`. | `.1em` spelled literally at `shell.css:314, 324, 388`, `overlays.css:171` (value right, token bypassed); **off-scale** tracking `.06em` (`entry.css:171`, key hints) and `.12em` (`entry.css:295`, the E1 code line); **off-scale leading** `1.5` (`overlays.css:258, 312` — neither 1.45 nor 1.55) and `1` (`overlays.css:122, 204`). ⚠️ The `.06em`/`.12em` are copied from the pack's own page CSS (`public.css:130,407,483`, `app.css:699`) — the pack violates its kernel here too, so the fix is two-sided. | n/a | Use `var(--tr-micro)` / `var(--lh-note)`; put the two off-scale trackings to the owner as a kernel question (mint a `--tr-key` or fold to 0/`.1em`). |
| RV-12 | minor | **z-index literals and a stale licence for them.** | `tokens.css:403-406` `--z-popover 20 · --z-overlay 30 · --z-modal 40 · --z-skip 99`. | `overlays.css:59` `5`, `:250` `3`, `:286` `4`; `shell.css:176` `20` (= `--z-popover`, spelled out); `close.css:367` `2`. `overlays.css:56` says *"the kernel declares no z-index scale"* — false since the pack kernel landed. | n/a | Bind to the four tokens (or state per site why a value is local and below `--z-popover`); correct the comment. |
| RV-13 | minor | **Dark theme unreachable.** | `tokens.css:410-470` a full recomputed `[data-theme="dark"]`; `Handoff Specification.dc.html:677` *"Two themes over one set of names, switched by `[data-theme="dark"]` on the root element."* | Nothing in `frontend/src` ever sets `data-theme` and nothing reads `prefers-color-scheme`; a `colorScheme:'dark'` browser gets the light portal (`app-close-prefers-dark-1440.png`). Positive half, measured: because every computed colour is a token (see coverage below), the theme **would** apply cleanly — `pack-c1-dark-1440.png` shows the kernel doing it. C1 draws no toggle, so whether one ships is the owner's. | `pack-c1-dark-1440.png` ↔ `app-close-prefers-dark-1440.png` | Owner decision: either honour `prefers-color-scheme` (set the attribute once at boot) or record that v1 is light-only on the Handoff Spec. |
| RV-14 | minor | **Signed-out header "Back to the site".** | `E1 Errors.dc.html:24` / V3: `‹ Back to the site`, `--muted`, **underlined** (kernel `a`), beside a connection light *"Sign-in service reachable"*. | `entry.css:46-47` `.entry .top a, .e1 .top a{text-decoration:none}` strips the underline from the back link as well as the logo link, so on `/signin` and every E1 page it reads as plain grey text (underline only on hover). The connection light is deliberately not drawn (`EntryTop.tsx:7`) — not counted here. | `pack-v3-1440.png` / `pack-e1-1440.png` ↔ `app-signin-1440.png` / `app-404-1440.png` | Scope the reset to the logo link only (`.top > a:first-child`). |
| RV-15 | minor | **Register column header wraps at 820.** | Pack headers are single-line micro labels (`VALUE SGD`). | `VALUE AT RISK` (s1, uppercase, `--tr-micro`) breaks onto two lines at 820 (`app-close-820.png`), the only two-line header. | `pack-c1-820.png` ↔ `app-close-820.png` | `white-space:nowrap` on `thead th`, or the shorter pack label *VALUE* + currency. |
| RV-16 | minor | **Identity block in the chrome.** | `.whoami`: initials **RT** in a `--sheet` square, mono 600; name + *roles mapped · 4 of 4*. | The initials square holds a bare `·` glyph and the text is the placeholder *Signed in / your account* (census: `span.init "·"`). A typographic placeholder in the one spot the pack uses a mono monogram. (`feat/display-names` may already address the data.) | `zoom-pack-c1-chrome.png` ↔ `app-close-1440.png` (top right) | Render initials from the session's display name in `--face-mono`/`--w-emph`; if unknown, leave the square empty rather than drawing a glyph. |
| RV-17 | minor | **Setup and run account are typeset by Tailwind utilities, not pack classes.** | C1 drill-downs use `.lab`, `.fig`, `.evid`, `.regt` from `app.css`. | `RunAccount.tsx:237-347` and `Setup.tsx` use `text-title` / `text-body` / `text-label` / `text-micro` (bridged to `--s4…--s1`, so token-correct) inside a generic `.route` padding; the result is a document-like page with no `lab` micro headings, no rule hairlines, and on Setup an unstyled *Packs installed · Install a blueprint* line. The chrome's *Needs you* chip also loses its count off `/close` (`app-setup-1440.png`). | `app-setup-1440.png`, `app-run-1440.png` (pack has no drawing for either — the gap is that one is needed) | Treat as design debt for the next drill-down slice; no token defect. |
| RV-18 | minor | **Pack-internal inconsistency inherited: "What to quote".** | `E1 Errors.dc.html:52` uses `class="lab"` but the E1 page does not load `app.css`, so the pack *renders* it as sentence-case sans; `app.css` defines `.lab` as uppercase micro. | The app follows `app.css` (uppercase micro `WHAT TO QUOTE`). Correct by the stylesheet, different from the picture. | `pack-e1-1440.png` ↔ `app-404-1440.png` | Owner/pack: say which. No app change unless the pack is amended. |

### Iconography summary

There are **no SVG icons** in either the pack's product screens (C1, E1) or the app — the
system draws with text glyphs in the two faces, by design. Glyph census, pack C1 vs app
`/close` (+ opened row):

| glyph | pack (face · size · colour) | app | note |
|---|---|---|---|
| `· · ·` mascot | Sans 17px `--agent-deep` | same | ✔ |
| `▾` entity | Sans 12.5 `--ink` | Sans 12.5 `--muted` | Soon (G3092) — accepted |
| `⌘` key-cap | Mono 11 `--ink` | Mono 11 `--muted` | RV-09 |
| `∴` machine mark | Mono 11 `--agent-deep` 500 | `--muted` 400 in figures/meter; **missing** on the evidence label | RV-07, RV-08 |
| `＋` new reconciliation | Sans 12.5 `--ink` | `--muted` | Soon — accepted |
| `← →` period | Mono 12.5 `--ink` | `--muted` | Soon — accepted |
| `✕` close evidence | Sans 12.5 `--muted` | same | ✔ |
| `↵` open | Mono 11 `--ink` | `--muted` | RV-09 |
| `⌘Z` undo | present | **absent** | RV-09 |
| `‹` back (E1/V3) | Mono 12.5 `--muted` | same | ✔ (underline: RV-14) |

All glyphs render in the fallback faces until RV-01 is fixed — the `⌘`, `∴`, `↵` and
arrows are where a missing Plex is most visible, because system fonts draw them at a
different weight and baseline.

## Token-coverage summary

### Runtime (computed styles, 1440px, every rendered element)

| page | elements | colours not traceable to a token | font-sizes not a `--sN` step |
|---|---:|---|---|
| `/close` | 164 | 0 | 1 — the logo badge `AI` 15.98px (`--logo-size`-derived; same in the pack) |
| `/close` + opened row | — | 0 | 1 (badge) |
| `/close/finding/:ref` | — | 0 | 1 (badge) |
| `/close/run/:runId` | — | 0 | 1 (badge) |
| `/setup` | — | 0 | 1 (badge) |
| `/signin`, `/signin/lapsed` | — | 0 | 1 (badge) |
| 404, signed-out `/close` | — | 0 (one `transparent` border on `.btn--quiet`, as in the pack) | 1 (badge) |

Every colour used: `--ink`, `--muted`, `--recede`, `--agent-deep`, `--paper`/`--on-ink`,
`--sheet`, `--rule`, `--rule-strong`, `--accent-quiet`, plus the `--badge-*` gradient.
**`--refused`, `--agent`, `--accent`, `--accent-deep` and `--hatch` are never rendered**
on these screens — consistent with G3091 (no hatch) and with no selected-row state
in the seed; not a defect.

### Source (`frontend/src`, comments stripped)

| file | raw hex / rgb / hsl | raw font-size | bare font-weight | literal face stack | literal tracking | literal line-height | z-index literal | px literals* |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `bridge.css` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `close.css` | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 50 |
| `entry.css` | 0 | 0 | 0 | 0 | 2 (`.06em`, `.12em`) | 0 | 0 | 17 |
| `overlays.css` | 0 | 0 | 3 | 2 | 1 | 4 | 3 | 9 |
| `shell.css` | 0 | 0 | 10 | 3 | 3 | 0 | 1 | 16 |
| `*.tsx` (26 files) | 0 † | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **total** | **0** | **0** | **13** | **5** | **6** | **4** | **5** | **92** |

\* px literals are almost all `1px` hairlines and media-query breakpoints, which the kernel
explicitly allows ("px ONLY for optical constants"). Breakpoints `1279px`/`1440px`/`1880px`
are copied verbatim from `app.css:66,76,120`; **`entry.css:266` `860px` matches neither the
pack nor `--bp-narrow 720` / `--bp-mid 1080`**.
† The only hex in `.tsx` is inside comments (`Luminous.tsx:88`, `NotBuilt.tsx:60-61`); the
Tailwind colour utilities in use are bridged to tokens (`bridge.css:199-200`,
`--color-*: initial`), and the only arbitrary-value / inline-style uses are on the
specimen page, not a product route.

### Pack ↔ app stylesheet parity

Selector-by-selector comparison of `docs/handoff-pack/app.css` against the four frontend
stylesheets (visual properties only, suffix-matched for the `.close`/`.chrome` scoping):
**147 identical, 10 differing** (the substantive ones are RV-04, RV-09 and the `.choice .to`
micro styling now carried at `close.css:247`), and **271 pack selectors with no app
counterpart** — overwhelmingly Ask, Reports, the palette, the editor and approval surfaces
that are not built, so absence is expected; it is listed so nobody reads "147 identical"
as "the pack is ported".

## Reproduce

The harness is a copy of `tests/e2e/close-parity.shot.ts` extended with more routes, three
widths and the in-page census; run with a private PostgreSQL exactly as that file's header
says (`RECONCILE_DB_ADMIN=$USER RECONCILE_DB_PORT=<port>`). The single command that proves
RV-01 on any built bundle, in any browser console on a portal page:

```js
const c=document.createElement('canvas').getContext('2d'),w=f=>(c.font=f,c.measureText('Reconcile 0123').width);
w('16px "IBM Plex Mono", serif')!==w('16px serif')   // false on the portal, true on the pack
```

# Red-team re-audit: motion, the luminous touch, and the Reconcile mark

> **STATUS:** AUDIT REPORT, REPORT ONLY. No product code, `CLAUDE.md` or `docs/HANDOFF.md` was changed.
> Branch `audit/reaudit-motion-mark`, cut from `origin/main` at `5dae45af`, 3 Oct 2026. That commit includes green-team PRs #545 (foundations), #546 (secondary surfaces) and #547 (Close surface).
> **Prior audit:** `docs/build/ui-audit/red-motion-mark.md` (RM-01 to RM-17).
> **Authority compared against:** `docs/handoff-pack/tokens.css` (as amended by the RM-08/RM-09/RM-10 rulings), `system-page.css`, `app.css`, `C1 Close.dc.html`, `Design System.dc.html` and `Handoff Specification.dc.html`.

## Bottom line

The product now has motion, and it is the kernel's motion. On `/close`, with a run in `status = running`, headless Chromium measured:

- **exactly one `.lit`** on the page;
- the `sweep` at `17s cubic-bezier(0.4, 0, 0.25, 1)` on that cell's `::after`, clipped (`overflow:hidden`);
- the mascot cascading at `working` 4.8s with a 0 / .2s / .4s stagger;
- tooltips fading on `--t-fade` (120ms linear);
- the modal and scrim arriving on `modal-in` and `fade-in`, and the toast rising on `toast-in` at 420ms on the `--spring` curve.

When a register row is opened, the light moves to "What the machine did" and leaves the strip, so the count is still one. Under `prefers-reduced-motion: reduce`:

- the sweep is `display:none` while the light stays;
- the mascot dots compute `animation-name: none` (RM-10's fix wins);
- all four `--enter-*` tokens compute to `none`, so the modal, the scrim and the toast arrive with no animation.

The theme follows the OS, keeps following it while the preference is `system`, persists an explicit choice, and paints the first frame through `theme-boot.js`.

**Of 17 prior findings: 11 CLOSED, 1 PARTIAL, 2 OPEN, 3 Info carried forward unchanged.** The **9 new findings** are mostly second-order effects of the fixes:

- **The dark theme makes the sweep wash out the text it passes over (RMR-01).** This surface became reachable because of the RV-13 ruling.
- **The light and the mascot assert "running right now" from a read that is never refreshed (RMR-02).**
- **Overlays and toasts leave with no fade (RMR-03).**

## Method

1. `npm ci`, then `npm run build:frontend`, inside this worktree.
2. A private PostgreSQL 14 cluster in the session scratchpad. The seed is `tests/e2e/close-parity.shot.ts`'s, which since #547 includes `run_parity_0006` in `running` on `def_bank_to_erp`.
3. A throwaway probe built from that seed served `/close` through `tests/e2e/single-origin.ts` against `startDataPlane()`, using the production authoriser and the production cookie. It drove headless Chromium at 1440×900 through:
   - arrive;
   - select the reading reconciliation;
   - select another reconciliation;
   - open a row;
   - "Take it over" (the modal), then confirm (the toast), then dismiss;
   - the account menu, then Dark, then reload;
   - repeat under `reducedMotion: reduce`;
   - repeat under `colorScheme: dark`, then flip the OS to light mid-session;
   - visit `/close/finding/:ref`, `/close/run/:runId` and `/signin`.

   On every state it walked every element **and its `::before`/`::after`** for computed `animation-*` and `transition-*`, and it listed every `.lit` (with its paint, edge, overflow and `::after`) and every `.mascot`.
4. A second short pass, on a fresh seed, read the computed `--enter-*` tokens under each motion setting and timed a modal cancel and a toast dismiss.
5. The probe scripts were deleted after capture, and the cluster was stopped and deleted. The reproduction steps above are sufficient to re-run them.

### Evidence: `docs/build/ui-audit/screens/reaudit/rmre-*`

| File | What it shows |
|---|---|
| `rmre-probe.json` | The full computed inventory for every state above. **Start here.** |
| `rmre-close-arrive.png` | `/close`: one lit strip cell (Bank to ERP · running), the mascot before the name |
| `rmre-strip-lit-00…07.png` | The lit cell every 300ms. There are 4 distinct frames of 8 (mascot cascade, and the sweep caught mid-pass) |
| `rmre-close-select-reading.png` | The lit cell while it is also `aria-current`: the edge and the ink underline compose |
| `rmre-close-open-row.png` | The light on "What the machine did"; the strip cell is no longer lit |
| `rmre-modal-mid.png` · `rmre-modal.png` | The modal 60ms in (scrim opacity .42, dialog translate 11px) and at rest |
| `rmre-toast.png` | The undo toast mid-rise (translate 16px), with no 2px left edge |
| `rmre-close-reduce.png` · `rmre-strip-lit-reduce.png` | Reduced motion: the light holds, the sweep and the cascade stop |
| `rmre-close-osdark.png` · `rmre-strip-lit-dark.png` | OS dark: the theme follows. The sweep is caught washing out "05:10" (RMR-01) |
| `rmre-account-menu.png` · `rmre-dark-chosen.png` | The theme toggle in the account menu; Dark chosen and persisted |
| `rmre-page_close_finding_*.png` · `rmre-page_close_run_*.png` · `rmre-page_signin.png` | Secondary pages: zero lights, still lockup |

## Prior findings: status

| id | was | status | evidence |
|---|---|---|---|
| **RM-01** Strip cell of the reading reconciliation has no light or sweep | High | **CLOSED** | `Register.tsx:152` renders `cell lit lit--running` for `litRunId`. Measured: `bgImage radial-gradient(… rgba(202,246,65,.34) …)`, `::after sweep 17s cubic-bezier(0.4,0,0.25,1) infinite`, `overflow:hidden` (`rmre-probe.json` → `arrive`). The clip is ported as `luminous.css` `.close .cell.lit.lit--running{overflow:hidden}` |
| **RM-02** No working mascot in the reading cell | High | **CLOSED** | `Register.tsx:102–110` `WorkingMark` on every `status === 'running'` cell, which matches `C1:66`/`:3840` (the pack ties the mark to `running`, not to the light). Measured: `mascot-cascade 4.8s ease-in-out infinite`, delays 0 / .2s / .4s; size 12.5px = 1em of `.nm` through `close.css:171`, which also ports `app.css:217`'s spacing |
| **RM-03** Evidence panel never lit | High | **CLOSED** | `ExceptionRegister.tsx:324` `evid lit` when `litPanel`. Measured after opening `exc_parity_0006`: `div.evid.lit` painted, plain `lit` (no `::after` animation), strip cell unlit (`openRow`) |
| **RM-04** `close.css` erases the light | High | **CLOSED** | `close.css:160` now resets `background-color:transparent` only. `luminous.css` composes `inset 0 0 0 1px var(--lit-edge), inset 0 -2px 0 0 var(--ink)` at (0,4,0). Measured on the current lit cell: `shadow: rgba(0,134,106,.22) 0 0 0 1px inset, rgb(0,48,63) 0 -2px 0 0 inset`. *Note:* a lit cell's `background-color` computes `transparent` (not lit) or `--accent-quiet` (current), not the kernel's `--paper`. That matches the pack (`app.css:211` ties with `.lit.lit` and wins on order), so it is not a finding |
| **RM-05** Tooltip fade resolves to 0s (`--t-enter` undeclared) | Medium | **CLOSED** | `overlays.css:284` `transition: opacity var(--t-fade) linear`. Measured on every `.tip`: `opacity 0.12s linear` |
| **RM-06** `toast-in` absent; no toast mounted | Medium | **CLOSED** (entry) · exit → RMR-03 | `overlays.css:332` `animation: var(--enter-toast)`. `ToastRegion` is mounted in `main.tsx:1191`. Measured: `toast-in 0.42s linear(0 0%, .231 10% …)`, `translate 0 16px` mid-rise |
| **RM-07** No one-light arbitration | Medium | **CLOSED** | `frontend/src/luminous.ts` `litTargetOf()` (panel › strip › none), consumed once in `main.tsx:869`. Measured `litCount = 1` in every state on `/close`, including during the modal and the toast. Tie-break between two reading runs (the selected one, else the newest) is code-verified only. The seed has one running run |
| **RM-08** `lv` / `toast-in` outside the kernel (pack) | Medium · pack | **CLOSED by ruling**, residue → RMR-06 | `tokens.css:994` declares `toast-in`; the inventory (`:955–967`) strikes `lv`; `Handoff Specification.dc.html:291` strikes the row. `@keyframes lv` still lives in `system-page.css:466`, against the amended rule *"EVERY KEYFRAME IN THE SYSTEM IS DECLARED IN THIS FILE"* (RMR-06) |
| **RM-09** Overlay entrances contradict the inventory; app overlays have none | Low · pack | **CLOSED** (entry) · exit → RMR-03 | `tokens.css:995–997` and the `--enter-*` tokens; `overlays.css:88–90` applies them. Measured: dialog `modal-in 0.42s` (translate 11px at 60ms), scrim `fade-in 0.12s` (opacity .42 at 60ms). The keyframes animate `translate`, so they compose with the app's flex centring |
| **RM-10** Mascot reduced-motion rule loses on specificity (kernel) | Low · kernel | **CLOSED** | `tokens.css:1089–1091` `.mascot[data-energy] > .d1/.d2/.d3{animation:none}`. Measured under `reduce`: the working mascot's `.d1` computes `none`; `.d3` keeps `translateX(-50%)` (matrix `…,-2.19,0`) |
| **RM-11** Toast left edge 2px only on `fail` | Low | **OPEN** | `overlays.css:338` still scopes `border-left:2px` to `[data-kind='fail']`. The pack applies it to every toast (`system-page.css:417–418`, *"The 2px left edge is the EMPHASIS rule"*). Measured on the undo toast: `borderLeft 1px rgb(164,184,187)`. No owner ruling recorded |
| **RM-12** No hover/colour transitions | Low | **OPEN** (unchanged) | `.close .cell` computes `transition: all` with 0s. The chrome, buttons and strip still snap. Only `entry.css:143` (`/signin` primary button) transitions on `--t-fade`. The pack's C1 also declares none, so this stays Low |
| **RM-13** Ask / palette lights not built | Info | **Unchanged** | Ask and the palette are still `<Soon>`. `luminous.ts` deliberately omits `ask`/`palette` arms; add them when those surfaces land |
| **RM-14** Logo lockup still | Info · pass | **CLOSED (still passes)** | The chrome lockup mascot has no `data-energy` (`d1 none`) on every page probed |
| **RM-15** Reduced-motion guard in the app | Info · pass | **CLOSED (still passes)**, strengthened | Under `reduce`, every element computes `transition-duration 1e-06s`, the sweep `::after` is `display:none`, and the `--enter-*` tokens are `none`. The app declares no `@keyframes` of its own (`grep -rn '@keyframes' frontend/src` → comments only) |
| **RM-16** `alive` never runs on a product surface | Info | **Unchanged** | The status bar `Connection` is still `down` ("sources · not yet reported"). Honest, because there is no producer |
| **RM-17** No `∴` on the evidence label | Info | **Superseded** | #547 (RV-08, G3430) added `What the machine did · — ∴` with the em-dash as C1's "unmeasured" figure. This reverses RM-17's pass verdict, but on a later reading of `C1:204` that is defensible. See RMR-08 |

## New findings

Severity: **High** means a named treatment is broken, or a fix produces a defect a person will see. **Medium** means a specified behaviour is wrong or misleading. **Low** is polish or a pack-internal inconsistency. **Info** is a note.

| id | sev | element | pack expectation | observed | evidence | suggested fix |
|---|---|---|---|---|---|---|
| **RMR-01** | **High** | **Sweep in the dark theme** | The kernel recomputes the light for dark (`tokens.css:475–480`: `--lit-hot`/`--lit-mid`/`--lit-edge` dark values). Nothing animates that carries information, and the text must stay legible (`--muted` 5.60:1 on dark paper, `:457`) | The sweep highlight is a **raw literal**, `rgba(255,255,255,.46)` (`tokens.css:808`), and has no dark recompute. The `::after` is positioned over the cell's text. On dark `--paper #001a22`, the band's peak composites to ≈`rgb(117,131,136)`. Computed contrast at the peak: **`--ink` 15.74 → 3.44:1** and **`--muted` 5.60 → 1.22:1**. The status line ("running · no engine account", the clock) disappears for about 2s every 17s. In light the same band is white on white paper and only reads over the gradient, so the defect is dark-only. RV-13 made this reachable for every dark-mode OS user | `rmre-close-osdark.png` and `rmre-strip-lit-dark.png` ("05:10" washed out mid-pass); contrast arithmetic in this report | Tokenise the band (for example `--lit-sweep`) and give it a dark value that is a light **tint**, not white at .46 (for example `rgba(202,246,65,.14)`). Or put the `::after` *under* the content (`z-index:-1` within an isolated `.lit`, or give the text `position:relative`). Pack/kernel change, so it needs an owner's sign-off. Add a dark-theme assertion to `tests/design/luminous-cell.test.ts` |
| **RMR-02** | **Medium** | **Liveness from a stale read** | *"Apply .lit to anything the machine is working on RIGHT NOW"* (`tokens.css:784`). The ambient tempo rule: motion measured in seconds means *"this is live"* (`:330–331`) | `/close` reads runs once. `grep -n 'setInterval\|poll\|refetch\|visibilitychange' frontend/src/main.tsx frontend/src/api/runs.ts` returns nothing. A run that finishes after page load keeps its light, its 17s sweep and its working mascot indefinitely, so the product's one "live" signal asserts a state the plane no longer holds. The word "running" is stale too, but the motion is what claims liveness | code read; `luminous.ts` is computed from `load.runs` only | Refetch `listRuns` while any strip run is `running` (a modest interval, paused on `visibilitychange`). Or drop the light and mascot after a bound from `startedAt`. Either way, the light must go out when the work does |
| **RMR-03** | **Medium** | **Leaving overlays and toasts** | *"A LEAVING ELEMENT DOES NOT BOUNCE. Run the spring on the way IN and a plain --t-fade on the way OUT"* (`tokens.css:308–312`). *"Entry only; a leaving overlay takes a plain fade"* (`Handoff Specification.dc.html:293`) | `Surface.tsx:72` `if (!open) return null`, and a dismissed toast is removed from state. Measured: one frame after Cancel the modal layer is **gone** (`present:false`); 30ms after Dismiss the toast count is **0**. Exit is a hard cut, not a fade, so the specified out-motion does not exist | `rmre-probe.json` (`toastAfterDismiss30ms: 0`); pass 2 (`modalAfterCancel+16ms: {present:false}`) | Keep the node mounted for `--t-fade` on close (a `data-leaving` state plus `transition: opacity var(--t-fade) linear`, unmount on `transitionend`), or use `@starting-style` and `transition-behavior: allow-discrete` on `display`. The reduced-motion guard already makes it instant under `reduce` |
| **RMR-04** | Low | **Strip mascot outranks the light it sits beside** | `C1:66`/`:3840` shows the working mark on every `running` cell, and the light on one. The kernel says the mascot reports nothing (`tokens.css:973`) | Faithful to the pack, but when two runs read at once there are **two** cascading marks and **one** light. While a panel is open, the strip mascot keeps cascading with no light under it, so the eye has two moving things and one lit thing. Not reproducible with the seed (one running run); code-verified (`Register.tsx:146,163`) | code read | Owner question: should the mark follow the light (the one lit cell) or the status (every running cell)? If it follows status, consider `working` only on the lit cell and a still mark elsewhere |
| **RMR-05** | Low | **Finding page evidence is never lit** | `app.css:15–18`: the light is *"on the machine's own drafted evidence when you open it"* | `/close/finding/:ref` renders `section.evid-in` "What the machine did" with **no light** (`litCount 0`). The same evidence, opened inline on C1, is lit. The pack draws no finding page, so this is an inference | `rmre-page_close_finding_exc_parity_0001.png`; `rmre-probe.json` → `page /close/finding/…` | Decide whether the finding page is a "view" whose one light is its evidence. If so, route it through `litTargetOf` (panel arm) rather than a local class |
| **RMR-06** | Low · **pack defect** | **`@keyframes lv` survives outside the kernel** | Amended inventory: *"EVERY KEYFRAME IN THE SYSTEM IS DECLARED IN THIS FILE … A seventh is a finding"* (`tokens.css:963–965`) | `system-page.css:466` still declares `@keyframes lv`, and the Design System page still animates `.agent .lv` (`:976–979`, `:1346`). RM-08's ruling text says lv is *"kept in system-page.css, counted nowhere"*, which contradicts the amended rule written a few lines later in the same block | source | Reword the rule to "every *product* keyframe…", or move `lv` into the kernel as a specimen-only entry. Owner wording call |
| **RMR-07** | Low | **Running-run page shows no liveness** | Mascot energy `working` marks a surface where the machine is working (`tokens.css:707–709`) | `/close/run/run_parity_0006` (status `running`) has no mascot, no light and no sweep: `litCount 0`, only the still lockup. No pack drawing exists for this route, so this is a consistency note | `rmre-page_close_run_run_parity_0006.png` | If a run page for a running run is a "view", give it the working mark beside the status word, and the light if nothing else holds it. Fix RMR-02 first or this inherits the staleness |
| **RMR-08** | Info | **`· — ∴` on the evidence label** | `.met` *"trails a spend figure"* (`tokens.css:909`, `:934`) | #547 renders an em-dash figure plus `∴` (with `aria-hidden` on the mark). This is the same convention as the chrome meter and "Read by the machine". It is acceptable as "unmeasured", but it is the one non-`<Soon>` place a metered mark trails no number | `rmre-close-open-row.png` | None required. If per-finding spend never gets a producer, prefer dropping the figure and mark over a permanent dash |
| **RMR-09** | Info | **Build inlines tokens into `--enter-*`** | Each `--enter-*` is a whole shorthand built from `var(--t-spring) var(--spring)` (`tokens.css:350–353`) | The built CSS ships `--enter-toast: toast-in .42s/**/linear(0,.231 10%,…)`: the minifier resolved `--t-spring`/`--spring` at build time. A runtime override of `--t-spring` (for example a future density or motion preference) would not reach the entrances. It is harmless today, and the computed animations are correct | pass 2 (`no-preference tokens`) | Note for whoever adds a runtime motion preference. Check the CSS minifier's custom-property handling first |

### Theme toggle (RV-13): verified, no finding

- With `colorScheme: dark`, the first load paints `data-theme="dark"`. `theme-boot.js` is loaded before the bundle (`bootScript` lists it first), and `body` is `rgb(0,26,34)`.
- Flipping the OS to light mid-session repaints to `light`, so `system` follows live.
- The account menu shows `system:true · light:false · dark:false`. Choosing Dark sets `data-theme=dark` and stores `reconcile.theme=dark`.
- Dark survives a reload, and an explicit Dark ignores a later OS flip to light. All correct.
- In dark, the light recomputes (`rgba(202,246,65,.26)` hot), and the mascot inks in the dark `--agent` (`rgb(34,168,138)`).
- Out of scope but worth knowing: the apex marketing site (`frontend/site/`) loads no `theme-boot.js` and has no toggle, so it is always light. The RV-13 ruling names the portal's account menu only.

## Motion inventory: pack vs app (re-measured)

| Animation | Pack | App: on a product surface? |
|---|---|---|
| `sweep` 17s | `.lit--running::after` | ✅ The one reading strip cell on `/close`; `display:none` under reduce. ⚠️ dark legibility (RMR-01) |
| `alive` 3.6s | `.conn i::after` | ❌ Connection always `down` (RM-16, honest) |
| `toast-in` `--t-spring` | `--enter-toast` | ✅ Undo toast on take over / release; `none` under reduce. ❌ no exit fade (RMR-03) |
| `fade-in` `--t-fade` | `--enter-scrim` | ✅ Modal scrim; `none` under reduce |
| `modal-in` `--t-spring` | `--enter-modal` | ✅ Confirm dialog; `none` under reduce. ❌ no exit fade (RMR-03) |
| `drawer-in` `--t-spring` | `--enter-drawer` | ✅ Wired in `overlays.css:90`; no drawer is reachable on the probed pages |
| `mascot-cascade` 4.8s (working) | `.mascot[data-energy]` | ✅ Reading strip cell; still under reduce (RM-10 fixed) |
| `lv` | struck | ❌ Correctly absent (RMR-06 is a pack wording issue) |
| Transitions | `--t-fade` for colour and opacity | ✅ Tooltips 120ms. ❌ Hover states snap (RM-12) |

## Counts

- **Prior:** 11 CLOSED (RM-01–07, RM-09, RM-10, RM-14, RM-15), 1 PARTIAL (RM-08: closed by ruling, residue in RMR-06), 2 OPEN (RM-11, RM-12), 3 Info unchanged or superseded (RM-13, RM-16, RM-17). Exits for RM-06 and RM-09 are tracked as RMR-03.
- **New:** 9 (1 High, 2 Medium, 4 Low, 2 Info).

## Cleanup

- The private PostgreSQL cluster (scratchpad `rmre-pg`, port 55493) was stopped and its data directory deleted.
- The probe scripts (`tests/e2e/zz-rmre*.tmp.ts`) were deleted before commit; nothing under `tests/` changed.
- `node_modules/` and `frontend/dist/` are worktree-local, and `node_modules/` is removed after the push.

/**
 * THE ROUTE TABLE — FOURTEEN routes, ALL FOURTEEN DRAWN, IN TWO DIFFERENT
 * RECORDS: twelve in one that was DELETED, two in one that is IN THE TREE.
 *
 * ⚠️ **THIS LINE READ *"twelve routes, drawn, and nothing else"* UNTIL
 * 22 Sep 2026, AND THEN *"twelve drawn, two SPECIFIED AND DRAWN NOWHERE"*
 * FOR A FEW HOURS. BOTH ARE CORRECTED RATHER THAN DELETED and the SECOND is
 * the worse one**, because the first merely went stale when work landed and
 * the second was FALSE ABOUT THE NORTH STAR on the day it was written.
 * `/demo` and `/lookup` are not drawn nowhere: the pack ships a dedicated
 * drawn record for each — `docs/handoff-pack/V2 Book a Demo.dc.html` (a full
 * two-step demo form) and `docs/handoff-pack/V3 Sign In.dc.html` (the
 * email-lookup states) — and both files are in this tree today. Derive it,
 * never read it:
 * `ls docs/handoff-pack/V2*.dc.html docs/handoff-pack/V3*.dc.html`
 * **The mistake was the BRIEF's rather than the slice's**: it pointed at the
 * pack's route TABLE, which is an index, and the index is not the record.
 * G1917 is where that is argued. Derive the route count, never read it:
 * `awk '/^export const ROUTE_PATHS = \[/,/^\] as const/' frontend/src/routes/table.ts | grep -cE "^  '/"`.
 *
 * ┌─ THE ONE PROPERTY THIS FILE EXISTS TO HOLD ───────────────────────────────┐
 * │ THE TWELVE ARE DRAWN. SEVENTEEN MORE ARE ENUMERATED AND UNDRAWN, AND THEY  │
 * │ MUST STAY **ABSENT** RATHER THAN BECOME HATCHED. They are not named in     │
 * │ this file, in any file beside it, or in any output any of them renders.    │
 * │                                                                            │
 * │ ⚠️ THE TWO ADDED IN 2026 ARE NOT AN EXCEPTION TO THAT AND MUST NOT BE READ │
 * │ AS ONE. `/demo` and `/lookup` are not members of the seventeen: the        │
 * │ seventeen are the DRAWN RECORD's own enumeration of surfaces it chose not  │
 * │ to draw, and these two are the PACK's, on a plane that record does not     │
 * │ model at all. Neither is hatched here either — a route with no SCREEN is a │
 * │ GAP stated in words by `screens.ts`, never a REFUSAL marked (G216 as       │
 * │ amended, G245). **A route with no screen and a route with no DRAWING are   │
 * │ two different facts and this file keeps them apart**: all fourteen are     │
 * │ drawn, and eleven of the fourteen have no screen.                          │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * The argument is not this slice's; it is the drawn record's, made in a comment
 * placed exactly where a reader would otherwise reach for the hatch — derive it
 * with `grep -n 'NOT HATCHED, AND THAT IS DELIBERATE' design/routes/index.html`:
 *
 *   "These … routes are not refused; they are undrawn, which is a different
 *    fact and needs a different form. Hatching them would put a second
 *    vocabulary into the one mark whose value is that it has only one."
 *
 * **G216 as amended is the same rule one level up** — *hatch where a DECISION
 * refused the control; leave a GAP unhatched and ARGUED* — and **G245** minted a
 * separate REFUSED ink step on that principle, so the hatch keeps meaning
 * *refused* rather than *unfinished*. A router that 404s an undrawn route is
 * truthful. A router that hatches one has spent the single mark on two meanings,
 * and that is the obvious thing to do with an unimplemented route, which is what
 * makes `tests/app/route-table.test.ts` §2 worth having.
 *
 * ┌─ WHY THIS IS A TOTAL `Record` AND NOT AN ARRAY OF ROUTE OBJECTS ──────────┐
 * │ `ROUTE_PATHS` is the closed set and `ROUTES` is a MAPPED TYPE over it, so  │
 * │ a thirteenth route is a COMPILE ERROR in both directions: a path added     │
 * │ without a spec fails with TS2741, and a spec added without a path fails    │
 * │ with TS2353. Same shape #268's indicator roster took, for the same reason  │
 * │ — R5's *"a seventh is a design change"* applied to the route set, which is │
 * │ settled by `design/routes/index.html` §1 and by no ruling.                 │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY THERE IS NO ROUTING DEPENDENCY, ARGUED RATHER THAN ASSUMED ──────────┐
 * │ G191 pins every dependency exact, so taking one is cheap to do and has to  │
 * │ be worth doing. `react-router` would supply the matcher — about thirty     │
 * │ lines below — and would supply NONE of the load-bearing property: its      │
 * │ route config is an ARRAY (or a `<Route>` element tree), which is precisely │
 * │ the shape in which a thirteenth route arrives without anyone deciding to   │
 * │ add one, and the acceptance criterion this slice is built against says     │
 * │ *"a route added by hand in a component is a test failure."* The closed set │
 * │ would still have to be hand-built on top of it. Sixty runtime kilobytes    │
 * │ and a second vocabulary for a matcher, to keep writing the guarantee       │
 * │ ourselves, is not a trade this slice can defend — so it hand-rolls, and    │
 * │ the matcher is the thirty lines at the bottom of this file rather than a   │
 * │ dependency's.                                                             │
 * │                                                                            │
 * │ ⚠️ WHAT THAT DECISION COSTS, STATED SO THE NEXT SLICE PAYS IT KNOWINGLY:   │
 * │ nested layouts, data loaders, scroll restoration and transitions are all   │
 * │ things `react-router` has and this does not. None is needed to land a      │
 * │ table; every one of them is a reason to revisit this paragraph rather than │
 * │ to extend the file quietly.                                               │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THIS FILE IS `.ts` AND CARRIES NO JSX, AND THAT IS DELIBERATE. `node --test`
 * strips TypeScript types and does NOT transform JSX — `tests/design/render.ts`
 * records a first draft dying on exactly that — so a route layer written in
 * `.tsx` is a route layer no `node --test` suite can witness without a browser
 * and a build. `frontend/src/components/indicators.ts` is the same split for the
 * same reason.
 *
 * 🛑 NOTHING MOUNTS AN OPERATION HERE, AND NOTHING FETCHES. G200 freezes
 * mounting at four served operations; a route table reads no contract, sends no
 * request and imports no `model/` module. Invariant 1 is not engaged, because a
 * route parameter that reaches no request cannot become a tenant read from a
 * request — the parameters below are OPAQUE STRINGS at this layer and the wire's
 * business at the next one.
 */

/**
 * THE TWELVE, IN THE ORDER `design/routes/index.html` §1 DREW THEM — AND THEN
 * THE TWO THAT RECORD NEVER DREW.
 *
 * ⚠️ THE ORDER OF THE FIRST TWELVE WAS PART OF AN ASSERTION AND THAT ASSERTION
 * NO LONGER RUNS, which is said here rather than left to be found. The suite
 * that compared this list element-for-element against the §1 rows was
 * `tests/app/route-table.test.ts`, RETIRED under G278 when G264 deleted the
 * file it read at runtime. **The order is kept because it is the drawn
 * record's and re-ordering it would destroy a fact nothing re-derives**, not
 * because anything checks it. The paragraph below is the original and its two
 * derivations point at a deleted file; it is kept because it is the sentence a
 * reader would otherwise have trusted.
 *
 *   "⚠️ THE ORDER IS PART OF THE ASSERTION, not decoration … Derive the count,
 *    never restate it — `grep -c '<td class="p">' design/routes/index.html` →
 *    12. **Do not derive anything from that file's count line**: it states
 *    `78 not-built marks`, its own comment states `79`, and the tree states 86.
 *    The route count of twelve is sound only because it comes from the rows."
 *
 * 🛑 THE THIRTEENTH AND FOURTEENTH ARE `/demo` AND `/lookup`, G1911,
 * 22 Sep 2026, AND THEY COME FROM A DIFFERENT AUTHORITY FROM THE OTHER TWELVE.
 * The twelve are the drawn record's. These two are the PACK's — G264's north
 * star — out of the PUBLIC-PLANE route table in
 * `docs/handoff-pack/User Journeys.dc.html`, which marks both `specified` and
 * neither `built`. **They are APPENDED rather than interleaved**, so the drawn
 * record's order survives whole above them and the seam between the two
 * authorities is where the list changes shape rather than buried in it.
 *
 * ⚠️ **THE PACK'S ROUTE TABLE IS AN INDEX AND THE INDEX IS NOT THE RECORD —
 * G1917, 22 Sep 2026.** Reading the table alone gives `specified` and nothing
 * else, and it is what this slice was briefed on; the pack ALSO ships
 * `V2 Book a Demo.dc.html` and `V3 Sign In.dc.html`, which draw both surfaces
 * in full. The two were entered as *drawn nowhere* on that reading. **The
 * derivation that would have caught it is one command and is now beside every
 * pack citation in this file:** `grep -c 'id="form"' 'docs/handoff-pack/V2
 * Book a Demo.dc.html'` → 1.
 *
 * Derive the count, never read it:
 * `awk '/^export const ROUTE_PATHS = \[/,/^\] as const/' frontend/src/routes/table.ts | grep -cE "^  '/"`
 */
export const ROUTE_PATHS = [
  '/',
  '/signin',
  '/signin/lapsed',
  /* ── W3/S7, 1 Oct 2026, G2502 ──────────────────────────────────────────
     The FIFTEENTH, and it is a STATE of `/signin` given an address, which is
     `/signin/lapsed`'s precedent one line up: the drawn record's `r-signin`
     draws *"Returning from the directory"* among its sixteen stills, and the
     broker must send the browser to a FIXED `redirect_uri` —
     `SIGN_IN_CALLBACK_PATH` in `server/data-plane/code-exchange.ts`, mirrored
     against `infra/` (R4). The pack draws no callback at all; the name
     follows the tree's `/signin`, not the pack's `/entry`, and G1914 —
     which of the two stands — is still the owner's. */
  '/signin/callback',
  '/invite',
  '/close',
  '/close/run/:runId',
  '/close/run/:runId/refused',
  '/close/finding/:ref',
  '/close/finding/:ref/confirm',
  '/close/finding/:ref/post',
  '/ask',
  '/reports',
  /* ── C9 · SETUP, 2 Oct 2026, G2875 ─────────────────────────────────────
     The SIXTEENTH, and the first the PACK draws that the drawn record did
     not: `docs/handoff-pack/C1 Close.dc.html`'s `showSetup` pane, "Sources
     and packs". The pack's route table names `/setup/*` — a subtree, plane
     `data`, status `partial` — and this is its base. The four sub-surfaces
     its journey steps name (`sources`, `packs`, `policy`, `destinations`)
     are SECTIONS of one pane in the drawing, not addresses, so the subtree
     gets one route and not four. */
  '/setup',
  /* ── P1 · THE PARTNER PORTAL, 3 Oct 2026, G3292 ────────────────────────
     The SEVENTEENTH to NINETEENTH, and the first on the CONTROL plane: the
     three P1 destinations a served operation stands behind — Deals (the
     registry and its one write), Sandbox and People. The pack draws the
     portal as ONE page whose destinations are in-page state and names it
     `partner portal` where a path should be (its route table's own words), so
     these are the tree's addresses for the pack's three panes, under the
     contract's own `/partner/...` vocabulary. The other six P1 destinations
     are drawn quiet in the portal's chrome and are not addresses — the same
     shape as `/ask` and `/reports` beside the register. */
  '/partner/deals',
  '/partner/sandbox',
  '/partner/people',
  /* ── THE PACK'S PUBLIC PLANE, G1911 ─────────────────────────────────────
     Two routes and not three: the pack's public table lists `/`, `/demo` and
     `/lookup`, and `/` is already the first member above under the drawn
     record's own name for it. **The two records mean different things by that
     one path** — the pack's landing page, the tree's entry hero — and this
     slice does NOT reconcile that, because doing so silently would be the
     slice deciding a ruling `tests/app/route-provenance.test.ts` §4 says
     belongs to the owner. §6 of that suite is where the disagreement is
     measured instead of narrated. */
  '/demo',
  '/lookup',
] as const

/** The closed set. A sixteenth member is a design change, not an addition. */
export type RoutePath = (typeof ROUTE_PATHS)[number]

/**
 * THE PLANE — THE PACK'S OWN COLUMN, SPELLED AS THE PACK SPELLS IT.
 *
 * ⚠️ **THIS FIELD DID NOT EXIST UNTIL 22 Sep 2026 AND G1912 REFUSED IT ON
 * ARITHMETIC THAT DOES NOT HOLD. The refusal is CORRECTED IN PLACE rather
 * than deleted**, because it is the sentence a reader would have quoted
 * before deciding not to add one. It read: *"the alternative was a second
 * field — `plane` beside `tier` — and it is REFUSED because it would be a
 * THIRD authority for a fact the pack already states in a column of its
 * own."*
 *
 * 🛑 **THE PLANE WAS COPIED EITHER WAY. That is the whole of it.** G1912's
 * own change put the pack's `public` into `tier` as `'Public'`, title-cased
 * — so the choice was never *two copies versus three*, it was **a third copy
 * named `plane` against a third copy named `tier`**, and only one of the two
 * can be checked. `plane` is the pack's own word in the pack's own column,
 * so `tests/app/route-provenance.test.ts` §7 asserts it in BOTH directions
 * over the six routes both records name — `db/migrations/0008`'s standard
 * for a mirror, which is the only thing that makes a copy something other
 * than a third place to drift. **`Tier` could never be mirrored, because the
 * pack has NO tier column at all**; derive that, never read it:
 * `grep -o '<th scope="col">[^<]*' 'docs/handoff-pack/User Journeys.dc.html' | sort -u`
 *
 * ⚠️ **EIGHT OF THE FOURTEEN ARE THE TREE'S OWN CLAIM AND ARE UNMIRRORABLE**,
 * because the pack models neither `/signin*`, nor `/invite`, nor the six
 * `/close/**` sub-routes. That gap is not new and is not this field's: it is
 * `TREE_ROUTES_THE_PACK_DOES_NOT_MODEL`, one argued line each, and §7 asserts
 * the mirror over the INTERSECTION rather than pretending to a set equality
 * the two records do not have.
 */
export type Plane = 'data' | 'control' | 'public'

/**
 * THE TIER VOCABULARY — ONE SOURCE, AND IT BELONGS TO ONE ARM ONLY.
 *
 * `Entry` and `Tier 1 · Work` are `design/routes/index.html` §1's words,
 * spelled as it spells them. **There is no third member.**
 *
 * ⚠️ **IT CARRIED `'Public'` FOR A FEW HOURS ON 22 Sep 2026 (G1912) AND THAT
 * IS CORRECTED RATHER THAN DELETED.** Two things were wrong with it and the
 * second is the one nothing would have caught: it was a SECOND vocabulary in
 * one field (§5.3, and G1912 said so), and because `RouteSpec` shared `Tier`
 * across both of its arms, **`{ kind: 'drawn', tier: 'Public' }` COMPILED** —
 * a drawn-record entry wearing a word that record does not have. The repair
 * is not a narrower union of strings; it is that `tier` now sits on the
 * `drawn_record` arm ALONE, which is the only arm whose authority defines it.
 * A pack-drawn route has no tier because the record that mints tiers does not
 * model its plane, and that absence is now a TYPE rather than a convention.
 */
export type Tier = 'Entry' | 'Tier 1 · Work'

/**
 * WHERE THE ROUTE IS DRAWN — OR THAT IT IS NOT — AND NOTHING ABOUT WHAT IT
 * SHOWS.
 *
 * ⚠️ THERE IS NO `params` FIELD HERE ON PURPOSE. The parameter names are
 * DERIVED from the pattern by `paramNamesOf` below; storing them beside the
 * pattern would be a second authority for one fact, and the two would disagree
 * the first time somebody renamed one.
 *
 * ┌─ WHY THIS IS A UNION, AND WHAT THE TWO ARMS ACTUALLY SEPARATE ────────────┐
 * │ IT WAS `{ tier, file, anchor }` — three REQUIRED strings, two of them a    │
 * │ position inside `design/routes/`, which G264 DELETED. The union arrived    │
 * │ on 22 Sep 2026 under G1913 and its arms were `drawn` and `specified`.      │
 * │                                                                            │
 * │ 🛑 **G1913's FORCING ARGUMENT WAS FALSE AND THE ARMS WERE NAMED FOR A      │
 * │ FACT THAT IS NOT THE CASE — G1917, 22 Sep 2026.** It read: *"adding a      │
 * │ public-plane route under the old shape meant writing                       │
 * │ `file: 'demo.html', anchor: 'r1'` — a citation to a position that has      │
 * │ never existed in ANY tree."* **It meant nothing of the kind.**             │
 * │ `file: 'V2 Book a Demo.dc.html', anchor: 'form'` cites a file and an       │
 * │ anchor that are BOTH IN THIS TREE TODAY, and so does                       │
 * │ `V3 Sign In.dc.html#why-same`. The old shape needed no invention; it       │
 * │ needed the `design/routes/` prefix to stop being hard-coded in             │
 * │ `screens.ts`. Its second clause — *"it still needs an anchor for the two   │
 * │ that have none"* — is false in the same way and by the same command.       │
 * │ Derive both, never read them:                                              │
 * │   grep -c 'id="form"'     'docs/handoff-pack/V2 Book a Demo.dc.html'  # 1  │
 * │   grep -c 'id="why-same"' 'docs/handoff-pack/V3 Sign In.dc.html'      # 1  │
 * │                                                                            │
 * │ ⚠️ **THE NARROW FACT G1913 RESTS ON IS TRUE AND IS KEPT**: `design/routes/` │
 * │ held six files, the twelve entries below cite five, and it never held a    │
 * │ `demo.html` or a `lookup.html` on any branch or at any tag. **What fails   │
 * │ is the conclusion drawn from it** — that the only place to cite was a      │
 * │ directory that is gone — which is true only if the pack is not a place     │
 * │ one may cite, and the pack is the NORTH STAR.                              │
 * │                                                                            │
 * │ ┌─ SO WHAT DO THE ARMS SEPARATE? WHICH CORPUS, AND THEREFORE WHETHER THE  │
 * │ │ CITATION RESOLVES IN THIS TREE. ───────────────────────────────────────  │
 * │ │ `drawn_record` — `design/routes/`, DELETED under G264. The citation      │
 * │ │   cannot resolve; it resolves at `archive/pre-handoff-pack` alone, and   │
 * │ │   G278 and G319 record that these twelve cannot be repaired.             │
 * │ │ `pack` — `docs/handoff-pack/`, the north star, IN THE TREE. The          │
 * │ │   citation resolves today, and `tests/app/route-provenance.test.ts` §7   │
 * │ │   opens the file and looks for the `id` — **which is why this arm is     │
 * │ │   the only one in the table that is CHECKABLE**, and why the             │
 * │ │   alternative below was refused.                                         │
 * │ └──────────────────────────────────────────────────────────────────────   │
 * │                                                                            │
 * │ ⚠️ **THE REJECTED ALTERNATIVE, PRESERVED, NOW THAT IT IS CORRECTLY STATED: │
 * │ COLLAPSE THE UNION.** Widen `file` to a repo-relative path on ONE arm,     │
 * │ drop the prefix `screens.ts` hard-codes, and give all fourteen a file and  │
 * │ an anchor. It is smaller, it is no longer wrong about the anchors, and it  │
 * │ is refused for a different reason: it would make a citation that RESOLVES  │
 * │ (`docs/handoff-pack/V2 Book a Demo.dc.html#form`) and one that CANNOT      │
 * │ (`design/routes/entry.html#r-hero`) indistinguishable at the type, so a    │
 * │ checker could not tell which twelve to leave alone. **That is the          │
 * │ resolving-but-wrong class arriving from the other side** — twelve dead     │
 * │ citations wearing the shape of live ones — and this repository has         │
 * │ catalogued that class twenty times.                                        │
 * │                                                                            │
 * │ ⚠️ WHAT IT COSTS, STATED SO THE NEXT AUTHOR PAYS IT KNOWINGLY: `scopeOf`   │
 * │ BRANCHES, and a fifteenth route's author must choose an arm. **That is     │
 * │ the point.** The choice is *"which record draws this?"*, and both answers  │
 * │ are checkable — one against the tree, one against a tag.                   │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
export type RouteSpec =
  | {
      /** Drawn in `design/routes/`. The citation does NOT resolve in this tree. */
      readonly kind: 'drawn_record'
      readonly plane: Plane
      /** `design/routes/index.html` §1's own word. Only this arm has one. */
      readonly tier: Tier
      /**
       * The drawn file, inside `design/routes/` — ⛔ DELETED 18 Sep 2026 under
       * G264 and retrievable only at `archive/pre-handoff-pack`. G278 and G319
       * record that these citations point at nothing and CANNOT be repaired,
       * because the drawn record is gone and the pack draws a different set of
       * surfaces under different names.
       */
      readonly file: string
      /** The route's own anchor within that file. */
      readonly anchor: string
    }
  | {
      /** Drawn in `docs/handoff-pack/`. The citation RESOLVES, and §7 checks it. */
      readonly kind: 'pack'
      readonly plane: Plane
      /**
       * The pack record that DRAWS it, inside `docs/handoff-pack/`.
       * `tests/app/route-provenance.test.ts` §7 requires it to be a member of
       * the pack's own file listing — a name nobody typed into the suite.
       */
      readonly record: string
      /**
       * A REAL `id` inside that record, opened and matched by §7. **It is not
       * the `rt-route` CSS class G1913 refused**, and it is not invented: the
       * pack's own skip link points at `#form`, and `#why-same` is the
       * paragraph the pack's `/lookup` row argues about in its own voice.
       *
       * ⚠️ **G278's SURVIVING HALF IS NARROWER THAN IT LOOKS AND IS NOT A
       * LICENCE TO OMIT THIS.** *"The pack ships no per-screen anchor"* was
       * derived over `C1 Close.dc.html`, whose two ids are neither a screen;
       * it is a statement about the SURFACE records that replace the twelve
       * drawn routes, not about the public-plane records, which ship one each.
       */
      readonly anchor: string
    }

/**
 * 🛑 A MAPPED TYPE, NOT `Record<string, RouteSpec>`. Totality is the whole point:
 * a path in `ROUTE_PATHS` with no entry here does not compile, and an entry here
 * with no path does not compile either.
 */
export const ROUTES: { readonly [P in RoutePath]: RouteSpec } = {
  /* ⚠️ `plane: 'data'` AND THE PACK SAYS `public`, AND THAT IS THE ONE PLACE
     THE MIRROR IS BROKEN ON PURPOSE — G1918. The tree's `/` is the ENTRY HERO,
     drawn in `entry.html` beside `/signin`, served by the data plane; the
     pack's `/` is a MARKETING LANDING PAGE on a plane no architecture document
     describes. **Both records spell one path and mean two surfaces**, which is
     `tests/app/route-provenance.test.ts` §4's own sentence and which no file in
     the tree had ever stated. It is a NAMED exemption at §7 rather than a
     sweep onto either side, for the same reason `/entry` is: which surface `/`
     is, is a ruling. */
  '/': { kind: 'drawn_record', plane: 'data', tier: 'Entry', file: 'entry.html', anchor: 'r-hero' },
  /* ┌─ THE `/entry` COLLISION — RECORDED, NOT RECONCILED. G1914, 22 Sep 2026 ─┐
     │ The pack calls this surface `/entry` and calls it *"the only public      │
     │ route in the product"*; the tree spells it `/signin` and spells two      │
     │ neighbours off it. `tests/app/route-provenance.test.ts` carries both     │
     │ names as argued exemptions and says in its own voice that **which name   │
     │ stands is a ruling owed to the OWNER**. G1911–G1920 are DERIVED and not  │
     │ the owner's, so this slice may not take it — and three MEASURED facts    │
     │ say it should not be taken casually even by somebody who may:            │
     │                                                                          │
     │  1 · IT IS A 3→1 COLLAPSE AND NOT A RENAME. The pack's `/entry` is ONE   │
     │      route; the tree has THREE here — `/signin`, `/signin/lapsed` and    │
     │      `/invite`, all drawn in the same `entry.html`. Renaming `/signin`   │
     │      alone orphans `/signin/lapsed` under a prefix that no longer        │
     │      exists, and `/entry/lapsed` is a path the pack never names. Doing   │
     │      it *properly* means DELETING routes, and the closed set's rule is   │
     │      that a change to its MEMBERSHIP is a design change — in either      │
     │      direction.                                                          │
     │  2 · THE PACK IS NOT SELF-CONSISTENT ABOUT IT. `/entry` is the only row  │
     │      listed in BOTH of the pack's route tables, under DIFFERENT column   │
     │      sets, described as *"the only public route in the product"* in one  │
     │      and *"the **third** public route"* in the other. A tree that        │
     │      renames onto `/entry` inherits that ambiguity instead of resolving  │
     │      it. Derive it, never read it:                                       │
     │      `grep -c 'rt-route">/entry' 'docs/handoff-pack/User Journeys.dc.html'` │
     │  3 · IT BUYS NOTHING MEASURABLE TODAY. Neither name has a screen —       │
     │      `main.tsx` maps three routes and none of them is in this cluster —  │
     │      so the rename changes no rendered output and no resolvable          │
     │      behaviour, while spending four argued exemptions in two directions. │
     │                                                                          │
     │ 🛑 AND THIS SLICE CHANGES THE SHAPE OF THE COLLISION IN A WAY WORTH      │
     │ NAMING RATHER THAN LEAVING TO BE FOUND: until now the tree disagreed     │
     │ with the pack about EVERY public-facing route name it served. It now     │
     │ agrees on `/demo` and `/lookup` — the pack's own spellings, taken        │
     │ verbatim — while still disagreeing on the one that is DRAWN. **The       │
     │ divergence has gone from uniform to anomalous**, which strengthens the   │
     │ case for a ruling rather than for the status quo, and is REPORTED to the │
     │ owner rather than resolved here. `tests/app/route-provenance.test.ts`    │
     │ §6 is where that stops being prose and becomes an assertion.             │
     └──────────────────────────────────────────────────────────────────────────┘ */
  '/signin': { kind: 'drawn_record', plane: 'data', tier: 'Entry', file: 'entry.html', anchor: 'r-signin' },
  '/signin/lapsed': { kind: 'drawn_record', plane: 'data', tier: 'Entry', file: 'entry.html', anchor: 'r-lapsed' },
  /* A STATE of `r-signin` — *"Returning from the directory"* — given the
     address the broker returns to. See `ROUTE_PATHS`. */
  '/signin/callback': { kind: 'drawn_record', plane: 'data', tier: 'Entry', file: 'entry.html', anchor: 'r-signin' },
  '/invite': { kind: 'drawn_record', plane: 'data', tier: 'Entry', file: 'entry.html', anchor: 'r-invite' },
  '/close': { kind: 'drawn_record', plane: 'data', tier: 'Tier 1 · Work', file: 'close.html', anchor: 'r1' },
  '/close/run/:runId': { kind: 'drawn_record', plane: 'data', tier: 'Tier 1 · Work', file: 'close.html', anchor: 'r2' },
  '/close/run/:runId/refused': { kind: 'drawn_record', plane: 'data', tier: 'Tier 1 · Work', file: 'close.html', anchor: 'r3' },
  '/close/finding/:ref': { kind: 'drawn_record', plane: 'data', tier: 'Tier 1 · Work', file: 'finding.html', anchor: 'r1' },
  '/close/finding/:ref/confirm': { kind: 'drawn_record', plane: 'data', tier: 'Tier 1 · Work', file: 'finding.html', anchor: 'r2' },
  '/close/finding/:ref/post': { kind: 'drawn_record', plane: 'data', tier: 'Tier 1 · Work', file: 'finding.html', anchor: 'r3' },
  '/ask': { kind: 'drawn_record', plane: 'data', tier: 'Tier 1 · Work', file: 'ask.html', anchor: 'route' },
  '/reports': { kind: 'drawn_record', plane: 'data', tier: 'Tier 1 · Work', file: 'reports.html', anchor: 'screen' },
  /* ── THE PACK'S TWO, AND BOTH ARE DRAWN — IN THE PACK. G1911, G1917 ───────
     ⚠️ **THIS BLOCK READ *"AND NEITHER IS DRAWN ANYWHERE"*, AND SAID *"a
     reader following it meets a route TABLE rather than a screen, which is
     the honest amount this repository can cite"*. BOTH SENTENCES WERE FALSE
     AND ARE CORRECTED RATHER THAN DELETED**, because they are what a reader
     would have trusted before deciding the pack had nothing to point at.
     The pack ships a DRAWN RECORD for each of these two surfaces and each
     ships exactly one `id`. Derive them, never read them:

       grep -c 'id="form"'     'docs/handoff-pack/V2 Book a Demo.dc.html'  # 1
       grep -c 'id="why-same"' 'docs/handoff-pack/V3 Sign In.dc.html'      # 1

     🛑 `#form` IS THE PACK'S OWN SKIP-LINK TARGET — `<a class="skip"
     href="#form">Skip to the form</a>` — so it is the position the record
     itself calls the surface, not a position somebody chose for it.

     🛑 `#why-same` IS THE `/lookup` ROW'S OWN ARGUMENT, AND CITING IT IS HOW
     A CLAUSE THAT WENT MISSING COMES BACK — G1920. The exemption G1911
     deleted said the pack flags `/lookup` as *"an enumeration oracle
     narrowed rather than closed"*, and after that deletion the clause
     appeared NOWHERE in this repository. The pack states it twice, and
     `#why-same` is where it is DRAWN: *"We never confirm whether an address
     belongs to a customer. A domain we do not recognise gets the same reply
     as one we do — because a reply that differed would tell anyone whether a
     company is a customer, and under bring-your-own-account a host name can
     carry their name."* Its own route-table cell adds the half the drawing
     does not: **a resolving domain is still a yes**, so the allow-list
     NARROWS the oracle rather than closing it — *"accepted knowingly, and the
     first thing to re-read before a security review."* **Whoever builds this
     screen inherits that trade; it is not a detail of the drawing.**

     ⚠️ NEITHER HAS A SCREEN AND NEITHER IS HATCHED, AND THAT IS UNCHANGED.
     `Screens` is a PARTIAL mapped type, so an absent key falls through to
     `scopeOf`, which states the gap in words — G216 as amended and G245,
     exactly as it works for the nine drawn routes that have no screen either.
     **Drawn and screened are different facts**: the content is a separate
     slice, and the pack marks both `specified` in its Exists column.

     ✅ **THAT SLICE LANDED, 2 Oct 2026 — G3071–G3077 — AND THE PARAGRAPH
     ABOVE IS CORRECTED RATHER THAN DELETED.** Both routes have a screen —
     `frontend/src/public/Demo.tsx` and `Lookup.tsx`, mounted by `main.tsx`'s
     `App` outside the application frame — and neither entry below moved: a
     screen is not a citation. The trade the `/lookup` paragraph names is
     inherited and stated on that screen, not closed.

     ⚠️ **AND THE SCREENS LEFT THIS BUNDLE THE SAME DAY — G3156, THE OWNER'S
     RULING: *"Apex only: serve /demo and /lookup from the apex marketing site
     (Amplify); tenant/console hosts redirect there."*** The paragraph above is
     right about G3077 and wrong about this tree: both screens now live in
     `frontend/site/src/`, served at `reconcileai.app`, and `main.tsx`'s `App`
     REDIRECTS these two paths there (`routes/apex.ts`). Neither entry below
     moved — they are still citations of the pack's public plane, which is
     exactly what they always claimed to be. */
  '/demo': {
    kind: 'pack',
    plane: 'public',
    record: 'V2 Book a Demo.dc.html',
    anchor: 'form',
  },
  '/lookup': {
    kind: 'pack',
    plane: 'public',
    record: 'V3 Sign In.dc.html',
    anchor: 'why-same',
  },
  /* ── C9 · SETUP, G2875 ────────────────────────────────────────────────
     ⚠️ THE ANCHOR IS THE PACK'S OWN WORK-AREA TARGET AND NOT A SETUP-ONLY
     ONE, AND THAT IS STATED RATHER THAN HIDDEN. `C1 Close.dc.html` ships two
     ids — `work` and `pal-listbox` — and draws Setup as a STATE of that page
     (`showSetup`), rendered into the region `#work` marks. There is no id on
     the Setup pane itself; `tests/app/route-provenance.test.ts` §7b requires
     the anchor to be an id IN the record, so the honest citation is the
     region the pane is drawn into, and inventing `#setup` would be the
     fabricated citation G1913 refused. Derive it, never read it:
       grep -o 'id="[^"]*"' 'docs/handoff-pack/C1 Close.dc.html' */
  '/setup': {
    kind: 'pack',
    plane: 'data',
    record: 'C1 Close.dc.html',
    anchor: 'work',
  },
  /* ── P1 · THE PARTNER PORTAL, G3292 ───────────────────────────────────
     `plane: 'control'` IS THE PACK'S OWN WORD for the `partner portal` row
     ("control · authenticated · partner IdP"), and these addresses are served
     only on the partner host (`routes/surface.ts`, one module since G3371). The record ships
     three ids: `claims-cap` is the Deals pane's own table caption — the one
     id that belongs to a single pane — and `work` is the region every other
     pane is drawn into, which is `/setup`'s argument one record over: an
     invented `#sandbox` would be the fabricated citation G1913 refused.
     Derive them: grep -o 'id="[^"]*"' 'docs/handoff-pack/P1 Partner.dc.html' */
  '/partner/deals': {
    kind: 'pack',
    plane: 'control',
    record: 'P1 Partner.dc.html',
    anchor: 'claims-cap',
  },
  '/partner/sandbox': {
    kind: 'pack',
    plane: 'control',
    record: 'P1 Partner.dc.html',
    anchor: 'work',
  },
  '/partner/people': {
    kind: 'pack',
    plane: 'control',
    record: 'P1 Partner.dc.html',
    anchor: 'work',
  },
}

/**
 * The parameters a pattern binds, at the TYPE level.
 *
 * `ParamsOf<'/close/run/:runId/refused'>` is `{ readonly runId: string }`, and
 * `ParamsOf<'/close'>` is the empty object. A screen written against a route
 * therefore cannot read a parameter that route does not carry, and cannot miss
 * one it does.
 */
export type ParamsOf<P extends string> = P extends `${string}:${infer Rest}`
  ? Rest extends `${infer Name}/${infer Tail}`
    ? { readonly [K in Name]: string } & ParamsOf<`/${Tail}`>
    : { readonly [K in Rest]: string }
  : Readonly<Record<never, string>>

/** Parameters as the matcher hands them over: opaque strings, keyed by name. */
export type BoundParams = Readonly<Record<string, string>>

/**
 * WHAT A PATHNAME RESOLVES TO.
 *
 * 🛑 THE SECOND MEMBER IS NOT A ROUTE AND MUST NEVER BECOME ONE. `not-found` is
 * the honest answer for a pathname the drawn record does not draw — including
 * every one of the enumerated-but-undrawn routes, which is why none of them is
 * named anywhere in this layer. It carries the pathname so the surface can say
 * WHICH one, and nothing else.
 */
export type Resolution =
  | { readonly kind: 'route'; readonly path: RoutePath; readonly params: BoundParams }
  | { readonly kind: 'not-found'; readonly pathname: string }

/**
 * The id of the element a route change moves focus to — R10, and #206 [F-5a]'s
 * *"focus restored on every one"*.
 *
 * It lives here rather than beside the markup because `router.ts` needs it and
 * `router.ts` must stay free of React and of DOM types; see its header.
 */
export const ROUTE_ROOT_ID = 'route-root'

/**
 * The pattern's segments.
 *
 * ⚠️ COMPUTED ON DEMAND RATHER THAN MEMOISED INTO A RECORD, AND THE REASON IS
 * the config rather than taste: `Object.fromEntries` types as
 * `{ [k: string]: … }`, so pinning it to a total record over `RoutePath` needs a
 * cast the compiler calls a mistake (`TS2352`) and `as unknown as` to silence.
 * A cast that launders a type is exactly the thing a total record is for
 * avoiding. Twelve string splits per resolution cost nothing.
 */
function patternSegments(path: RoutePath): readonly string[] {
  return path === '/' ? [] : path.slice(1).split('/')
}

/**
 * The parameter names a pattern binds, DERIVED from the pattern.
 *
 * The single authority for the value-level answer, matching `ParamsOf` at the
 * type level. Nothing stores this.
 */
export function paramNamesOf(path: RoutePath): readonly string[] {
  return patternSegments(path).filter((s) => s.startsWith(':')).map((s) => s.slice(1))
}

/**
 * Split a pathname into segments, or refuse it.
 *
 * ⚠️ A REFUSAL IS `null`, AND EVERY REFUSAL BECOMES `not-found` RATHER THAN A
 * THROW. A router that throws on a malformed URL hands the browser a blank page
 * for input a person can type into the address bar by accident.
 *
 * A single trailing slash is the same route — `/close/` is `/close`. An empty
 * segment anywhere else is not: `//` and `/close//run` are refused, because a
 * matcher that collapses them would let two spellings of one path exist.
 */
function segmentsOf(pathname: string): readonly string[] | null {
  if (!pathname.startsWith('/')) return null
  /* 🛑 THE ROOT IS ANSWERED FIRST, AND THE FIRST DRAFT DID NOT DO THAT. It
     trimmed the trailing slash and then treated a single empty segment as the
     root, which made `//` resolve to `/` — two spellings of one path, the exact
     thing the empty-segment refusal below exists to prevent. Witnessed by
     `tests/app/route-table.test.ts` §4, which went red on `//`. */
  if (pathname === '/') return []
  const raw = pathname.slice(1).split('/')
  const trimmed = raw.length > 1 && raw[raw.length - 1] === '' ? raw.slice(0, -1) : raw
  if (trimmed.some((s) => s === '' || s === '.' || s === '..')) return null
  return trimmed
}

/**
 * THE INVERSE OF `resolve` — a pathname built FROM the closed set.
 *
 * ┌─ WHY THIS IS AN ADDITION TO THIS FILE AND NOT A HELPER BESIDE IT ─────────┐
 * │ A router that nothing links to is a router nobody uses, so wiring the      │
 * │ table into the application needs a way to WRITE a path as well as read     │
 * │ one. There are exactly two places that could live: here, beside            │
 * │ `ROUTE_PATHS`, or in whatever component wants a link — and the second is   │
 * │ the shape the acceptance criterion forbids by name, *"a route added by     │
 * │ hand in a component is a test failure."* A component that writes           │
 * │ `` `/close/finding/${id}` `` has minted a thirteenth spelling that no      │
 * │ compile error can see.                                                     │
 * │                                                                            │
 * │ ⚠️ IT IS NOT ONE OF THE FOUR THINGS THIS FILE'S HEADER SAYS TO REVISIT     │
 * │ THE NO-DEPENDENCY PARAGRAPH OVER — nested layouts, data loaders, scroll    │
 * │ restoration and transitions. It is the matcher, read backwards, over the   │
 * │ same closed set, and `P extends RoutePath` keeps that set closed in the    │
 * │ one direction the matcher could not: a caller cannot name a path that is   │
 * │ not in `ROUTE_PATHS`, and cannot omit or misname a parameter, because      │
 * │ `ParamsOf<P>` is derived from the pattern rather than stored beside it.    │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 EVERY BOUND VALUE IS `encodeURIComponent`d, AND THAT IS A SECURITY
 * PROPERTY RATHER THAN TIDINESS. The values reaching this function are
 * PLANE-SUPPLIED ids — `ExceptionRegister.tsx`'s own header says *"never build
 * a `href` … out of one"* of a row's fields, because an `href` is a sink React
 * does not escape, and **G97 puts no format constraint on a branded id in the
 * database** (*"the database enforces no id format"*). Percent-encoding makes
 * the result STRUCTURALLY a descendant of the route's static prefix: a value
 * containing `/`, `?`, `#`, `..` or a `javascript:` scheme becomes one opaque
 * segment and cannot re-address the link. `tests/app/route-links.test.ts` §2
 * witnesses each of those.
 *
 * ⚠️ AN EMPTY BINDING IS A THROW AND NOT A PATH. `hrefOf('/close/finding/:ref',
 * { ref: '' })` would produce `/close/finding/`, which `resolve()` reads as
 * `/close/finding` and refuses — so the caller would get a 404 for a link it
 * believed it had built. A throw at the build site names the defect where it
 * is; a silent 404 names it three screens later.
 */
export function hrefOf<P extends RoutePath>(path: P, bound: ParamsOf<P> & BoundParams): string {
  /* ⚠️ `& BoundParams` RATHER THAN A CAST INSIDE THE BODY. `ParamsOf<P>` over a
     generic `P` is not assignable to an index signature, and the obvious repair
     is `params as BoundParams` — a cast that launders a type, which is the one
     thing the `ROUTES` mapped type exists to avoid. Intersecting at the
     SIGNATURE keeps both properties: the caller must still supply every
     declared parameter by name, and the body may still read one by string. */
  const out: string[] = []
  for (const part of patternSegments(path)) {
    if (!part.startsWith(':')) {
      out.push(part)
      continue
    }
    const name = part.slice(1)
    const value = bound[name]
    if (value === undefined || value === '') {
      throw new Error(
        `hrefOf('${path}') was given no value for ':${name}'. An absent or empty binding ` +
          'would produce a pathname that resolves to a DIFFERENT route or to none, which ' +
          'is a 404 the caller meets later instead of an error it meets here.',
      )
    }
    out.push(encodeURIComponent(value))
  }
  return out.length === 0 ? '/' : `/${out.join('/')}`
}

/**
 * Does one pattern match these segments, and with what bindings?
 *
 * 🛑 A BOUND VALUE IS PERCENT-DECODED AND A STATIC SEGMENT IS NOT, AND THIS
 * ASYMMETRY IS THE WHOLE OF THE RULE. ⚠️ **NEITHER WAS DECODED UNTIL
 * 19 Sep 2026 (G487), AND THAT WAS A DEFECT THE TREE COULD NOT SEE**, because
 * until `main.tsx` mounted this router nothing in the repository ever built an
 * encoded pathname or read one back. `tests/app/route-links.test.ts` §2 found
 * it on its first run, against `hrefOf`'s own output:
 *
 *     'a%20b' !== 'a b'
 *     'javascript%3Aalert(1)' !== 'javascript:alert(1)'
 *
 * **A browser hands `location.pathname` back ENCODED**, so without this the
 * reference the router binds is not the reference the link named, and the read
 * it drives answers 404 for a row the person can see — an unreproducible,
 * id-dependent failure that only appears for ids containing a space or a colon.
 * G97 puts no format constraint on a branded id, so those ids are legal.
 *
 * ⚠️ DECODING AFTER THE SPLIT IS WHAT KEEPS IT SAFE: `%2F` becomes a literal
 * slash INSIDE one value and can never become a new segment, so an id cannot
 * grow a path however it is spelled. A STATIC segment is compared raw because
 * the patterns in `ROUTE_PATHS` are written by us and contain nothing to
 * decode — decoding them would let `/%63lose` match `/close`, which is a second
 * spelling of one path and exactly what `segmentsOf` refuses `//` to prevent.
 *
 * ⚠️ A MALFORMED SEQUENCE IS A REFUSAL AND NOT A THROW. `decodeURIComponent`
 * throws `URIError` on `%zz`, and a pathname a person can mistype in the
 * address bar must not hand the browser a blank page — the same reason
 * `segmentsOf` answers `null`. It becomes `not-found`.
 */
function bind(pattern: readonly string[], segments: readonly string[]): BoundParams | null {
  if (pattern.length !== segments.length) return null
  const bound: Record<string, string> = {}
  for (const [i, part] of pattern.entries()) {
    const seg = segments[i]
    if (seg === undefined) return null
    if (!part.startsWith(':')) {
      if (part !== seg) return null
      continue
    }
    let value: string
    try {
      value = decodeURIComponent(seg)
    } catch {
      return null
    }
    bound[part.slice(1)] = value
  }
  return bound
}

/**
 * RESOLVE A PATHNAME. The only entry point, and a pure function of its argument.
 *
 * ⚠️ IT TAKES A PATHNAME, NOT A URL. A query string and a fragment are not the
 * router's business, and a credential must never be in either — `main.tsx`
 * already carries that rule for the session token.
 *
 * 🛑 A STATIC SEGMENT BEATS A PARAMETER, AND THE RULE IS STATED RATHER THAN LEFT
 * TO KEY ORDER. Every candidate is scored by how many parameters it had to bind
 * and the narrowest wins, so a finding whose ref is literally the word a sibling
 * route uses as its last segment still resolves to the sibling. Key order in
 * `ROUTES` then decides nothing, which is what makes the table reorderable to
 * follow the contact sheet.
 */
export function resolve(pathname: string): Resolution {
  const segments = segmentsOf(pathname)
  if (segments === null) return { kind: 'not-found', pathname }

  const candidates = ROUTE_PATHS.map((path) => ({ path, params: bind(patternSegments(path), segments) }))
    .filter((c): c is { path: RoutePath; params: BoundParams } => c.params !== null)
    .sort((a, b) => Object.keys(a.params).length - Object.keys(b.params).length)

  const best = candidates[0]
  if (best === undefined) return { kind: 'not-found', pathname }
  return { kind: 'route', path: best.path, params: best.params }
}

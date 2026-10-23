/**
 * ROUTE PROVENANCE — the control G278 says cannot exist.
 *
 * 🛑 WHAT THIS FILE IS FOR, IN ONE SENTENCE: **G278 recorded that
 * `tests/app/route-table.test.ts` could not be re-homed because *"THE PACK HAS
 * NO PATHS"*, and that premise is false — the derivation behind it is sound and
 * the conclusion is not.** G278's command is correct and reproduces today:
 *
 *   grep -ohE '<code>/[a-z0-9/:*-]+</code>' docs/handoff-pack/*.dc.html | sort -u   # nothing
 *
 * It asks whether the pack spells a path inside a `<code>` element. It does not.
 * **That is a question about a landmark, not about the property** — `docs/HANDOFF.md`
 * §5.1, *a rule keyed on a convenient landmark instead of the property it
 * protects* — and the property is whether the pack states, machine-readably,
 * which surfaces the product has and which of them exist. It does, three times:
 *
 *   grep -c 'rt-route' 'docs/handoff-pack/User Journeys.dc.html'        # 13 rows
 *   grep -oh "surface:'[^']*'" docs/handoff-pack/*.dc.html | wc -l      # 156 steps
 *   #   of which 68 name a URL, across 9 distinct paths; the rest name a
 *   #   surface with no URL — `staff console` ×38, `partner portal` ×8, …
 *   sed -n '/<table class="matrix">/,/<\/table>/p' \
 *     'docs/handoff-pack/User Journeys.dc.html' | grep -c 'scope="col"' # 8 columns
 *
 * **G319 amends G278 rather than replacing it.** What SURVIVES of G278 is the
 * half this suite cannot repair: the pack ships no per-screen anchor for the
 * surfaces that replace the TWELVE drawn routes, so `RouteSpec.file` and
 * `RouteSpec.anchor` on the `drawn_record` arm genuinely point at nothing —
 *
 *   grep -oE 'id="[a-z0-9-]+"' 'docs/handoff-pack/C1 Close.dc.html' | sort -u
 *   #   id="pal-listbox"  ·  id="work"     — two, neither a screen
 *
 * ⚠️ **AND THAT SENTENCE IS NARROWER THAN IT READS, WHICH COST A DAY —
 * G1917, 22 Sep 2026.** It was derived over the SURFACE records and was read
 * as a statement about the whole pack, so `/demo` and `/lookup` were entered
 * in `ROUTES` as *drawn nowhere* and `screens.ts` RENDERED that to a person.
 * **The PUBLIC-PLANE records ship one anchor each and both are cited now**;
 * derive them, never read them:
 *
 *   grep -c 'id="form"'     'docs/handoff-pack/V2 Book a Demo.dc.html'   # 1
 *   grep -c 'id="why-same"' 'docs/handoff-pack/V3 Sign In.dc.html'       # 1
 *
 * **§7 below is what turns a citation from a claim into something opened**,
 * and it exists because every field of every `RouteSpec` was checked by
 * nothing: red re-spelled one record to `'Utterly Fabricated Record.dc.html'`
 * and the whole gate stayed EXIT 0.
 *
 * — and §2 of the retired suite, *the seventeen undrawn routes are ABSENT rather
 * than hatched*, has no home here either: the pack enumerates no undrawn set.
 * **This suite replaces §1's job and not §2's, and says so rather than implying
 * a clean succession.**
 *
 * ┌─ WITNESSED RED, AND AGAINST A PLAUSIBLE DEFECT RATHER THAN A TYPO ────────┐
 * │ §4b was witnessed by adding `/audit` to `ROUTE_PATHS` with a `RouteSpec`   │
 * │ beside it — the exact change somebody makes the afternoon they decide to   │
 * │ stub the audit door. FIVE assertions fired on that one edit (§2a, §2b,     │
 * │ §2d, §3a, §4b) and the failure text of each is a sentence, not a diff.     │
 * │ §4a was witnessed by deleting `/ask` from `ROUTE_PATHS` and its spec:      │
 * │ *"The pack says these data-plane surfaces are BUILT … and the route layer  │
 * │ does not resolve them: /ask."* Both reds are recorded on their assertions. │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ NO PATH IS TYPED INTO THE DERIVATIONS. Both sides are read at runtime —
 * the pack out of its own markup, the tree out of `ROUTE_PATHS` — which is the
 * one thing `tests/app/route-table.test.ts` got right and the reason its
 * retirement was honest rather than convenient. **The exemption tables below
 * are not the route sets**: they are the measured DIFFERENCE between two sets
 * nobody typed, one argued line per entry, and §2b asserts that an exemption
 * which stops being needed is a failure. A gap recorded is a gap that cannot
 * widen quietly; a gap silenced is G278 happening again.
 *
 * ✅ THE TABLE IS NOW CONSULTED BY THE RUNNING APPLICATION — G486,
 * 19 Sep 2026 — AND THE PARAGRAPH BELOW IS CORRECTED RATHER THAN DELETED,
 * because it is the sentence `CLAUDE.md` and `Shell.tsx` both quoted and the
 * one that told a reader a green run here proved nothing about reachability.
 * `frontend/src/main.tsx` builds a router over `table.ts` and hands
 * `RouteView` a partial mapped type of screens; `tests/e2e/browser-login.test.ts`
 * §14–§19 drive the twelve in a real Chromium. **What this suite asserts is
 * unchanged — it joins the PACK to `ROUTE_PATHS` and knows nothing about
 * whether anything imports them — and its prediction that wiring the router
 * would be a FEATURE change rather than a cleanup held.** The original
 * follows.
 *
 * 🛑 THIS SUITE GUARDS A TABLE THE RUNNING APPLICATION DOES NOT CONSULT, AND
 * THAT IS NOT THIS SUITE'S TO FIX. Nothing outside `frontend/src/routes/`
 * imports the route layer — not `main.tsx`, not `Shell.tsx`, not one test but
 * this one — so `vite build` drops it and the twelve routes are unreachable
 * from the app. Reproduce:
 *
 *   grep -rn "routes/table\|routes/screens\|routes/router\|ROUTE_PATHS" \
 *     frontend/src tests tools server | grep -v '^frontend/src/routes/' \
 *     | grep -v route-provenance
 *
 * Wiring the router in is a FEATURE change; this is a cleanup. Recorded here so
 * a green run is not read as evidence that the routes are reachable.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ROUTES, ROUTE_PATHS, resolve, type RouteSpec } from '../../frontend/src/routes/table.ts'
import { asPath, packRoutes as parsePackRoutes, type PackRoute } from '../../tools/planner/pack-routes.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PACK = join(REPO, 'docs', 'handoff-pack')
const JOURNEYS = join(PACK, 'User Journeys.dc.html')

/* ─────────────────────────────────────────────────────────────────────────
   THE PACK, PARSED. Nothing below states a path.
   ───────────────────────────────────────────────────────────────────────── */

/** Every `.dc.html` record in the pack, by name. */
function packRecords(): readonly string[] {
  return readdirSync(PACK).filter((f) => f.endsWith('.dc.html')).sort()
}

/* 🛑 THE PACK-ROUTE PARSER MOVED — G4414, 5 Oct 2026. `PackRoute`,
   `packRoutes()` and `asPath()` were declared HERE until the C4 page's route
   register needed the same rows; a second copy would be §5.3, so both now
   import `tools/planner/pack-routes.mjs`. The assertions it carried are thrown
   there with the same words, so a renamed header still stops this suite. */
const packRoutes = (): readonly PackRoute[] => parsePackRoutes(JOURNEYS)

/**
 * §3's subject: every URL-shaped `surface:` token on every journey step.
 *
 * A step's surface may name two surfaces (`/close · /setup`) or a sub-surface
 * (`/setup · policy`); the separator is the pack's own middle dot. A token that
 * does not begin with `/` is a surface with no URL — `staff console`,
 * `AWS console`, `their IdP` — and is not this suite's business.
 */
function surfaceTokens(): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const file of packRecords()) {
    const html = readFileSync(join(PACK, file), 'utf8')
    for (const m of html.matchAll(/surface:'([^']*)'/g)) {
      for (const token of (m[1] ?? '').split(' · ')) {
        if (token.startsWith('/')) counts.set(token, (counts.get(token) ?? 0) + 1)
      }
    }
  }
  return counts
}

/** The route columns of the role × route access matrix. */
function matrixRouteColumns(): readonly string[] {
  const html = readFileSync(JOURNEYS, 'utf8')
  const table = /<table class="matrix">[\s\S]*?<\/table>/.exec(html)?.[0] ?? ''
  return [...table.matchAll(/<th scope="col">([^<]*)<\/th>/g)]
    .map((m) => (m[1] ?? '').trim())
    .filter((h) => h.startsWith('/'))
}

const resolves = (path: string): boolean => resolve(path).kind === 'route'

/**
 * §4's subject: the DATA-plane rows, and nothing else.
 *
 * 🛑 **HOISTED TO MODULE SCOPE ON 22 Sep 2026 SO §6 CAN REACH IT — G1919.**
 * §6 exists to count what §4b's `plane === 'data'` filter silences, and it was
 * measuring the pack alone: gutting §4b's BODY to a hard-coded empty array left
 * **§6c green and still titled *"§4b is silencing THREE rows"***, asserting a
 * fact about a control that had stopped controlling anything. A section whose
 * whole subject is another section's filter has to READ that filter. §6d does.
 */
const dataPlane = (): readonly PackRoute[] =>
  packRoutes().filter((r) => r.plane === 'data' && asPath(r.route) !== null)

/** §6's subject: the PUBLIC-plane rows — the ones §4 deliberately does not judge. */
const publicPlane = (): readonly PackRoute[] =>
  packRoutes().filter((r) => r.plane === 'public' && asPath(r.route) !== null)

/* ─────────────────────────────────────────────────────────────────────────
   THE MEASURED DIFFERENCE — one argued line per entry, and nothing else.
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Pack paths the tree does not serve. **Every entry is a thing somebody owes.**
 *
 * 🛑 `/entry` IS NOT A MISSING ROUTE. It is a NAME COLLISION on the same
 * surface: the pack calls the sign-in route `/entry` and describes it as *"The
 * only public route in the product"*; the tree calls it `/signin` and draws the
 * same surface. One of the two names is wrong and **which one is not this
 * suite's to decide** — it is a ruling owed to the owner. The assertion below
 * holds the CURRENT TREE so this file is green while the question is open, and
 * names the collision here so nobody reads the green as agreement.
 *
 * ✅ **TWO ENTRIES WERE PAID ON 22 Sep 2026 AND ARE DELETED RATHER THAN
 * BANNER-ED — G1911 — WHICH IS §2b's RULE APPLIED TO ITSELF.** `/demo` and
 * `/lookup` are members of `ROUTE_PATHS` and resolve; the table's own §2b
 * assertion is that *"an exemption that stopped being needed is a FAILURE, not
 * a tidy-up"*, and it FIRED on both. Their arguments are not lost — the
 * reasoning that held them out (*"the public plane is a third plane the
 * architecture documents do not describe at all, so nothing states who owns it
 * or where it deploys"*) is UNCHANGED and is why §6 below exists: the routes
 * resolve and the ownership question does not.
 *
 * ⚠️ **AND `/entry` IS NOW AN ANOMALY RATHER THAN A PATTERN, WHICH IS THIS
 * SLICE'S OWN FINDING AND STRENGTHENS THE CASE FOR THE RULING.** Before it,
 * the tree disagreed with the pack about every public-facing route name it
 * served. It now takes the pack's spelling verbatim for `/demo` and `/lookup`
 * and keeps its own for the one that is DRAWN. `frontend/src/routes/table.ts`
 * argues the three measured reasons this slice did not reconcile it —
 * a 3→1 COLLAPSE rather than a rename, a pack that contradicts itself about
 * `/entry` in its own two tables, and no rendered output on either side to
 * change.
 */
const PACK_PATHS_WITH_NO_TREE_ROUTE: Readonly<Record<string, string>> = {
  '/entry':
    'NAME COLLISION, NOT A GAP. The pack\'s sign-in route; the tree spells the same ' +
    'surface `/signin` (plus `/signin/lapsed`). Ruling owed: which name stands. Until ' +
    'it is taken, neither side is swept onto the other.',
  /*
   * ⚠️ `/setup` WAS AN ENTRY HERE UNTIL 2 Oct 2026 AND IS ABSENT BY §2b's OWN
   * RULE — G2875 gave it a route and a screen. Its argument read: *"Data plane,
   * marked `partial` by the pack — source, pack and destination configuration
   * … Four sub-surfaces carry journey steps (`policy`, `sources`, `packs`,
   * `destinations`) and the tree draws none of them."* The tree now draws
   * `sources`, hatches `packs`, and draws neither `policy` nor `destinations`:
   * the four are SECTIONS of one pane in the pack's drawing and resolve to the
   * one route. The pack's status word stays `partial`, which §4 judges in
   * neither arm — and `partial` is the honest word for what is built.
   */
  '/audit':
    'Data plane, marked `specified` by the pack — a door behind the avatar, not a ' +
    'fourth destination. NOT resolving is the CORRECT state today, and §4b asserts it ' +
    'stays that way until the pack\'s status word moves.',

  /*
   * ⚠️ `/demo` AND `/lookup` WERE ENTRIES HERE ON TWO 22 Sep 2026 BRANCHES AND
   * ARE ABSENT FROM THIS TREE, WHICH IS THE CORRECT STATE AND NOT AN OMISSION.
   * G1911 gave both a route, so §2b's stale-exemption arm — *"an exemption that
   * stopped being needed is a FAILURE, not a tidy-up"* — makes listing either
   * one a RED. G1931 re-homed the fact each entry carried onto the citation
   * that draws it, in `frontend/src/routes/table.ts`.
   *
   * 🛑 AND THE MERGE DISCHARGES G2023 BY CONSTRUCTION RATHER THAN BY EDIT,
   * WHICH IS WORTH ONE LINE BECAUSE A READER WOULD OTHERWISE GO LOOKING FOR
   * THE WITHDRAWAL. That row hedged `/lookup`'s entry for asserting an UNBUILT
   * Amplify rewrite in the indicative, for naming `/session/*` where
   * `MARKETING_PROXIED_PLANE_PATHS` is `['/session/realm']`, and for putting a
   * SECOND statement of the proxy set in prose beside the executable one
   * (§5.3). **All three objections stand and the sentence they were about no
   * longer exists**, because the entry carrying it was deleted on the other
   * branch. The proxy set is stated once, in `infra/lib/config.ts`, with a
   * synth-time guard beside it.
   */
}

/**
 * Tree routes the pack does not model. **Every entry is a thing the pack owes.**
 *
 * The six `/close/**` sub-routes are the interesting half: the pack draws every
 * one of them as IN-PAGE STATE on C1 Close and never as a URL, so this is not
 * the pack having missed them — it is a genuine disagreement about whether a
 * run and a finding are addressable. That is a ruling nobody has been asked for.
 */
const TREE_ROUTES_THE_PACK_DOES_NOT_MODEL: Readonly<Record<string, string>> = {
  /* G3292 — P1's three served panes. The pack's route table names the portal
     `partner portal` where a path should be (plane `control`), and P1 draws
     its destinations as in-page state on one page — the `/close/**`
     disagreement arriving on the control plane. Each cites P1 by a real id. */
  '/partner/deals':
    'P1 Partner draws Deals as the portal\'s first pane, in-page state behind a destination ' +
    'button; the pack\'s route table gives the portal a NAME, not a path. The tree addresses ' +
    'it so a partner can land on it and link to it, under the contract\'s `/partner/` words.',
  '/partner/sandbox':
    'P1 draws the sandbox as a destination pane of the same page, never as an address. The ' +
    'contract notes it is the one partner destination with no journey behind it at all.',
  '/partner/people':
    'P1 draws People as an administrator-only destination pane of the same page. Whether a ' +
    'roster a partner can deep-link to is wanted is the same ruling the `/close/**` routes carry.',
  '/signin':
    'The other half of the `/entry` collision above: the same surface under the tree\'s ' +
    'name. Deleting one of the two names is the ruling; deleting one of the two ENTRIES ' +
    'here would hide that a ruling is owed.',
  '/signin/lapsed':
    'A lapsed-session variant of the sign-in surface. The pack models session lapse as a ' +
    'STATE of V3 Sign In rather than as an address, so this is the same disagreement the ' +
    'six `/close/**` routes carry, arriving on the entry surface.',
  '/signin/callback':
    'The hand-back from a directory — W3/S7, G2502. The drawn record\'s `r-signin` draws it as ' +
    'a STATE ("Returning from the directory … so the round trip is not a blank frame") and the ' +
    'pack draws no callback at all. It is an ADDRESS because a broker returns the browser to a ' +
    'fixed `redirect_uri`, which is `/signin/lapsed`\'s disagreement arriving a second time.',
  '/invite':
    'Invitation acceptance. The pack has no invitation surface at all — `model/domain.ts` ' +
    'carries the invitation block (#235 [A-14]) and no pack record draws it.',
  '/close/run/:runId':
    'The pack draws a selected run as IN-PAGE STATE on C1 Close — the strip of cells ' +
    'carries `aria-current`, not an href — so a run is not addressable in the north star ' +
    'and is addressable in the tree.',
  '/close/run/:runId/refused':
    'As above, one state deeper: a refused run is drawn as a state of the register rather ' +
    'than as an address. Whether a refusal a person can link to is wanted is a ruling.',
  '/close/finding/:ref':
    'As above: the finding drawer is drawn as an overlay over C1 Close. An overlay with a ' +
    'URL and an overlay without one are different products for anybody sharing a link.',
  '/close/finding/:ref/confirm':
    'As above — the confirm step is drawn inside the finding drawer, never as its own ' +
    'address. It is the step most likely to be deep-linked into by mistake.',
  '/close/finding/:ref/post':
    'As above — the posting step is drawn inside the finding drawer. It carries the one ' +
    'irreversible act on the surface, which is the strongest argument either way and the ' +
    'reason it is named here rather than swept in with its siblings.',
}

// ──────────────────────────────────────────────────────────────────────────
describe('1 · the pack states its surfaces machine-readably, which is G278\'s premise falsified', () => {
  /**
   * 🛑 A PARSER THAT MATCHES NOTHING PASSES EVERY ASSERTION AFTER IT. §5.6, and
   * it is the failure mode this whole suite is most exposed to, because every
   * later section is a set comparison against something this file derived.
   */
  it('the three artefacts are non-empty, or nothing below means anything', () => {
    const rows = packRoutes()
    const surfaces = surfaceTokens()
    const columns = matrixRouteColumns()

    assert.ok(
      rows.length >= 10,
      'The `rt-route` parse found ' + String(rows.length) + ' rows. G278 recorded that the ' +
        'pack ships no paths; it ships a route table. If this is 0 the parser has drifted ' +
        'from the markup, and every set comparison below would pass VACUOUSLY — which is ' +
        'exactly the shape docs/HANDOFF.md §5.6 catalogues. Derive: ' +
        "`grep -c 'rt-route' 'docs/handoff-pack/User Journeys.dc.html'`.",
    )
    const urlSteps = [...surfaces.values()].reduce((a, b) => a + b, 0)
    assert.ok(
      urlSteps >= 50 && surfaces.size >= 5,
      'The `surface:` parse found ' + String(urlSteps) + ' URL-shaped step surfaces across ' +
        String(surfaces.size) + ' distinct paths. It should find roughly 68 across 9. ' +
        'Derive the TOTAL number of step surfaces, URL-shaped and not — the larger figure, ' +
        'about 156, counts `staff console` and `AWS console` too: ' +
        '`grep -oh "surface:\'[^\']*\'" docs/handoff-pack/*.dc.html | wc -l`. If this is 0 ' +
        'the parser has drifted and §3 below passes vacuously.',
    )
    assert.ok(
      columns.length >= 5,
      'The access matrix parse found ' + String(columns.length) + ' URL-shaped route columns. ' +
        'The matrix is the pack\'s third route artefact and §5 rests on it.',
    )
  })

  it('every `rt-route` row carries a plane and a status word the pack itself defines', () => {
    /* The pack's own four status words, plus the `neither` its route table adds
       for a surface that is neither built nor specified. Read from the record
       that defines them rather than listed here — the Functional Specification's
       "How to read and update this" section is the authority. */
    const spec = readFileSync(join(PACK, 'Functional Specification.dc.html'), 'utf8')
    const defined = new Set(
      [...spec.matchAll(/<li><b>(built|specified|partial|not built)<\/b>/g)].map((m) => m[1] ?? ''),
    )
    assert.ok(defined.size === 4, `The status-word legend defines ${String(defined.size)} words, not 4.`)
    const allowed = new Set([...defined, 'neither'])

    for (const r of packRoutes()) {
      assert.ok(
        allowed.has(r.exists),
        `The pack route "${r.route}" carries the status word "${r.exists}", which its own ` +
          `legend does not define. Defined: ${[...allowed].sort().join(' · ')}. A fifth ` +
          'status word is a design-record change, and this suite joins the tree to these.',
      )
      assert.ok(
        ['data', 'control', 'public'].includes(r.plane),
        `The pack route "${r.route}" is on plane "${r.plane}". The pack names three planes ` +
          '— data, control and public — and the third is the one it says nothing else names.',
      )
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('2 · the pack\'s paths and `ROUTE_PATHS`, compared in BOTH directions', () => {
  const packPaths = (): ReadonlySet<string> => {
    const s = new Set<string>()
    for (const r of packRoutes()) {
      const p = asPath(r.route)
      if (p !== null) s.add(p)
    }
    return s
  }

  it('2a · every pack path is a tree route, or a NAMED and ARGUED exemption', () => {
    const missing = [...packPaths()].filter((p) => !resolves(p)).sort()
    /* WITNESSED RED by deleting the `/audit` key from the exemption table: this
       failed with `Missing an argued exemption: /audit`, naming the one path
       and nothing else. */
    assert.deepEqual(
      missing,
      Object.keys(PACK_PATHS_WITH_NO_TREE_ROUTE).sort(),
      'The set of pack paths the tree does not serve has MOVED. This is not a rule ' +
        'breaking — it is the recorded gap between the north star and the built route ' +
        'layer changing size, and it must move by somebody editing ' +
        'PACK_PATHS_WITH_NO_TREE_ROUTE with a reason, never by a path quietly ' +
        'appearing or disappearing. Missing an argued exemption: ' +
        missing.filter((p) => !(p in PACK_PATHS_WITH_NO_TREE_ROUTE)).join(', ') + '. ' +
        'Exemptions no longer needed: ' +
        Object.keys(PACK_PATHS_WITH_NO_TREE_ROUTE).filter((p) => !missing.includes(p)).join(', ') + '.',
    )
  })

  it('2b · an exemption that stopped being needed is a FAILURE, not a tidy-up', () => {
    /* The half that keeps the table above from rotting into decoration. An
       exemption is a debt; paying it must force the record to be edited.

       WITNESSED RED on 22 Sep 2026 by adding `/demo` and `/lookup` to
       `ROUTE_PATHS` and leaving this table alone — which is exactly the shape
       of the mistake it exists to catch, and it fired on the FIRST of the two
       and named it:

         "/demo" now RESOLVES in the tree, and it is still listed as a gap with
         the reason: "PUBLIC plane. The pack calls it 'the highest-leverage
         unspecified surface in the map'. …" — delete the entry and say so in
         the commit.

       §2a fired in the same run with `Exemptions no longer needed: /demo,
       /lookup.`, §2d with `The pack-side difference disagrees with
       PACK_PATHS_WITH_NO_TREE_ROUTE.`, and §3a on the same set. FOUR
       assertions for two routes, and §2c and §4 correctly stayed GREEN — the
       pack models both paths, and both are on the PUBLIC plane that §4
       deliberately does not judge. §6 is what that silence cost. */
    for (const [path, why] of Object.entries(PACK_PATHS_WITH_NO_TREE_ROUTE)) {
      assert.equal(
        resolves(path),
        false,
        `"${path}" now RESOLVES in the tree, and it is still listed as a gap with the ` +
          `reason: "${why}" — delete the entry and say so in the commit. An exemption table ` +
          'nobody prunes is a list of claims that were true once, which is the defect this ' +
          'whole record exists to refuse.',
      )
      assert.ok(why.length > 40, `The exemption for "${path}" has no argument, only a placeholder.`)
    }
  })

  it('2c · every tree route the pack does not model is NAMED, with what the pack draws instead', () => {
    const pack = packPaths()
    const unmodelled = ROUTE_PATHS.filter((p) => !pack.has(p)).sort()
    assert.deepEqual(
      unmodelled,
      Object.keys(TREE_ROUTES_THE_PACK_DOES_NOT_MODEL).sort(),
      'A route exists in `ROUTE_PATHS` that the pack does not model and that nobody has ' +
        'written a line about. The pack is the north star (G264): a thirteenth route is a ' +
        'design change, and a twelfth the pack never drew is a question for the owner, not ' +
        'a thing a test should absorb. Unaccounted: ' +
        unmodelled.filter((p) => !(p in TREE_ROUTES_THE_PACK_DOES_NOT_MODEL)).join(', ') + '.',
    )
    for (const [path, why] of Object.entries(TREE_ROUTES_THE_PACK_DOES_NOT_MODEL)) {
      assert.ok(why.length > 20, `The note for "${path}" has no argument, only a placeholder.`)
    }
  })

  it('2d · the overlap is SIX of fourteen, and that number is measured rather than asserted', () => {
    /* Not a rule — a MEASUREMENT, recorded so that closing the gap is visible in
       a diff rather than discovered later. It moves when either side moves, and
       when it moves the two tables above have already failed and said why.

       ⚠️ THIS TITLE SAID "FOUR of twelve" UNTIL 22 Sep 2026 AND WAS CORRECT
       WHEN WRITTEN. G1911 added `/demo` and `/lookup` — both already in the
       pack's route table — so the overlap moved 4 → 6 and `ROUTE_PATHS` moved
       12 → 14, while the pack side did not move at all. **The two numbers in
       this title are narration; the two assertions below are the control**,
       and both are derived from the three sets at runtime. */
    const pack = packPaths()
    const overlap = ROUTE_PATHS.filter((p) => pack.has(p))
    assert.equal(
      overlap.length,
      ROUTE_PATHS.length - Object.keys(TREE_ROUTES_THE_PACK_DOES_NOT_MODEL).length,
      'The overlap between the pack\'s route set and the tree\'s disagrees with the two ' +
        'difference tables above. One of the three is wrong.',
    )
    assert.equal(
      pack.size - overlap.length,
      Object.keys(PACK_PATHS_WITH_NO_TREE_ROUTE).length,
      'The pack-side difference disagrees with PACK_PATHS_WITH_NO_TREE_ROUTE.',
    )
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('3 · every URL-shaped journey surface resolves, or is a named gap', () => {
  it('3a · no journey step names a URL the record cannot account for', () => {
    const tokens = surfaceTokens()
    const unresolved = [...tokens.keys()].filter((t) => !resolves(t)).sort()
    /* WITNESSED RED by deleting `/demo` from the exemption table: this failed
       naming `/demo` and its three steps, and no other token. */
    assert.deepEqual(
      unresolved,
      Object.keys(PACK_PATHS_WITH_NO_TREE_ROUTE).sort(),
      'A journey step names a URL-shaped surface that neither resolves in the tree nor ' +
        'appears in PACK_PATHS_WITH_NO_TREE_ROUTE. Every one of the 33+ journeys is a ' +
        'commitment the pack makes about where work happens; a surface with no route and ' +
        'no recorded reason is a journey that cannot be walked and nobody has said so. ' +
        'Unaccounted: ' +
        unresolved
          .filter((t) => !(t in PACK_PATHS_WITH_NO_TREE_ROUTE))
          .map((t) => `${t} (${String(tokens.get(t))} steps)`)
          .join(', ') + '.',
    )
  })

  it('3b · the step surfaces and the route table name the SAME set, which is the pack agreeing with itself', () => {
    /* A pack self-consistency check, and it costs nothing: a surface a journey
       step sends a person to, that the route table does not list, is the pack's
       own left hand and right hand disagreeing — and it would reach the tree as
       a route request nobody could trace to a decision. */
    const fromSteps = new Set(surfaceTokens().keys())
    const fromTable = new Set<string>()
    for (const r of packRoutes()) {
      const p = asPath(r.route)
      if (p !== null) fromTable.add(p)
    }
    const stepsOnly = [...fromSteps].filter((t) => !fromTable.has(t)).sort()
    assert.deepEqual(
      stepsOnly,
      [],
      'A journey step names a URL surface the pack\'s own route table does not list: ' +
        stepsOnly.join(', ') + '. The route table is where a surface acquires a plane, a ' +
        'protection posture and a status word; a step pointing somewhere the table does not ' +
        'know is an unrouted commitment.',
    )
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('4 · the `exists` column, JOINED to the tree — two kinds of failure, not one', () => {
  /**
   * ⚠️ RESTRICTED TO DATA-PLANE ROWS, AND THE RESTRICTION IS ARGUED.
   * `frontend/src/routes/table.ts` is the DATA plane's route table. The control
   * plane's surfaces (`staff console`, `partner portal`) are not URLs in this
   * application at all, and the public plane is one the pack itself says no
   * architecture document describes — including `/`, which both sides spell the
   * same way and mean differently (the pack's landing page; the tree's entry
   * hero). Joining those to this table would assert an ownership nobody has
   * ruled on.
   *
   * ⚠️ **THE FIRST SENTENCE ABOVE — *"`frontend/src/routes/table.ts` is the
   * DATA plane's route table"* — WENT HALF FALSE ON 22 Sep 2026 AND IS
   * CORRECTED HERE RATHER THAN DELETED, because it is this restriction's own
   * premise.** That table now holds TWO PUBLIC-PLANE routes, `/demo` and
   * `/lookup` (G1911), spelled `tier: 'Public'` on their own entries. **The
   * restriction below is UNCHANGED and is now argued from the other side**:
   * the pack still says no architecture document describes that plane, so
   * nothing states who owns it or where it deploys — and a route table holding
   * a path is not a claim about which process serves it.
   *
   * 🛑 **THE RESTRICTION NOW SILENCES THREE ROWS RATHER THAN ONE, AND THAT IS
   * COUNTED IN §6 RATHER THAN LEFT TO BE DISCOVERED — G1916, 22 Sep 2026.**
   * `/demo` and `/lookup` joined `ROUTE_PATHS` under G1911; the pack marks
   * both `specified`; both RESOLVE. Under §4b's own principle — *"a route that
   * resolves is a surface"* — all three public-plane rows would be RED, and
   * they are green only because of the `plane === 'data'` filter on this line.
   * **`/` was already in that position before this slice and nobody had said
   * so**, which is the half worth reading: the restriction was load-bearing
   * for the existing tree, not just for the two routes that made it visible.
   *
   * ⚠️ **WIDENING §4b TO THE PUBLIC PLANE IS NOT THIS SUITE'S TO DO**, because
   * the repair it would force is a status-word move in `docs/handoff-pack/` —
   * the NORTH STAR (G264) — on three rows, and the Functional Specification's
   * own rule is that *"a feature moves status by being edited here in the same
   * change that moves it on a surface."* A route that resolves to `scopeOf`'s
   * gap sentence is not *"drawn on a surface … and operable there. A reader
   * can click it."*, so `built` would be a false word and `partial` is a
   * judgement about a marketing page nobody here owns. **§6 makes the silence
   * a counted, failing-on-change fact instead of closing it.**
   */
  it('4a · a row the pack marks `built` whose path does not resolve is a RED', () => {
    const broken = dataPlane()
      .filter((r) => r.exists === 'built')
      .map((r) => asPath(r.route) ?? '')
      .filter((p) => !resolves(p) && !(p in PACK_PATHS_WITH_NO_TREE_ROUTE))
      .sort()
    assert.deepEqual(
      broken,
      [],
      'The pack says these data-plane surfaces are BUILT — "drawn on a surface in this ' +
        'project and operable there. A reader can click it." — and the route layer does not ' +
        'resolve them: ' + broken.join(', ') + '. Either the status word is wrong in the ' +
        'north star or the route is missing from the tree; both are somebody\'s to fix and ' +
        'neither is this test\'s to absorb.',
    )
  })

  it('4b · a row the pack marks `specified` whose path DOES resolve is ALSO a RED', () => {
    /* 🛑 THIS IS THE HALF THAT IS EASY TO LEAVE OUT, AND IT IS THE ONE WITH NO
       ESCAPE HATCH: there is no exemption clause on this arm. `specified` means
       "decided and written down, with NO SURFACE YET" — so a resolving route
       under a `specified` word is the route layer having quietly grown a surface
       the record still calls unbuilt, which is precisely how a status word stops
       meaning anything. Absence is an assertion here, not an oversight.

       WITNESSED RED by adding '/audit' to ROUTE_PATHS with
       `{ tier: 'Tier 1 · Work', file: 'audit.html', anchor: 'r1' }` beside it —
       the change somebody makes the afternoon they stub the audit door. The
       failure named /audit and nothing else.

       ⛔ AND THE ARM WITH NO ESCAPE HATCH HAS ONE AFTER ALL, FOR AN ENTIRE
       PLANE, AND IT IS NOW ESCALATED RATHER THAN COUNTED AGAIN — G1920,
       NOT APPLIED. `/demo` and `/lookup` resolve under a `specified` word and
       this line's own repair sentence — *"move the status word in
       docs/handoff-pack/ in the same change that adds the route"* — was not
       followed when they were added. §6's header carries the three rulings the
       owner owes and the reason none of them is this suite's to take. */
    const premature = dataPlane()
      .filter((r) => r.exists === 'specified')
      .map((r) => asPath(r.route) ?? '')
      .filter((p) => resolves(p))
      .sort()
    assert.deepEqual(
      premature,
      [],
      'The pack marks these data-plane surfaces `specified` — decided, written down, and ' +
        'with NO SURFACE YET — and the route layer resolves them: ' + premature.join(', ') +
        '. A route that resolves is a surface. Move the status word in ' +
        'docs/handoff-pack/ in the same change that adds the route, which is the rule the ' +
        'Functional Specification states about itself: "A feature moves status by being ' +
        'edited here in the same change that moves it on a surface."',
    )
  })

  it('4c · the join is non-vacuous — both arms have rows to judge', () => {
    const rows = dataPlane()
    assert.ok(
      rows.filter((r) => r.exists === 'built').length > 0,
      'No data-plane row is marked `built`, so §4a judged nothing.',
    )
    assert.ok(
      rows.filter((r) => r.exists === 'specified').length > 0,
      'No data-plane row is marked `specified`, so §4b judged nothing — and §4b is the arm ' +
        'that has no exemption clause, so its silence is the most expensive silence here.',
    )
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('5 · the access matrix names no route the route table does not', () => {
  it('every URL-shaped matrix column is a surface the pack\'s route table lists', () => {
    const listed = new Set<string>()
    for (const r of packRoutes()) {
      const p = asPath(r.route)
      if (p !== null) listed.add(p)
    }
    const orphans = matrixRouteColumns().filter((c) => !listed.has(c)).sort()
    assert.deepEqual(
      orphans,
      [],
      'The role × route access matrix grants access to surfaces the route table does not ' +
        'list: ' + orphans.join(', ') + '. The matrix is where a role acquires `act` or ' +
        '`read` on a destination; a column with no row in the route table is an access ' +
        'decision about a surface with no plane and no protection posture.',
    )
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('6 · the PUBLIC plane — the three rows §4 does not judge, COUNTED', () => {
  /**
   * 🛑 WHY THIS SECTION EXISTS, IN ONE SENTENCE: **§4b is the arm with no
   * escape hatch, and it is switched off for an entire plane by one
   * `plane === 'data'` filter — so its silence needed a number rather than a
   * paragraph.** G1916, 22 Sep 2026.
   *
   * §4b's rule is *"a row the pack marks `specified` whose path DOES resolve is
   * a RED"*, with the reason that a `specified` word over a resolving route is
   * *"the route layer having quietly grown a surface the record still calls
   * unbuilt, which is precisely how a status word stops meaning anything."*
   * **Every word of that applies to `/`, `/demo` and `/lookup`.** They are
   * exempt because the FILTER is keyed on the plane, which is
   * `docs/HANDOFF.md` §5.1's shape — a rule keyed on a convenient landmark
   * instead of the property it protects — arriving inside a suite whose own
   * header is an argument against §5.1.
   *
   * ⚠️ IT IS NOT REPAIRED HERE AND THE REFUSAL IS ARGUED AT §4b's ENTRY: the
   * repair is a status-word move in the north star on three rows, and this
   * suite may not edit `docs/handoff-pack/`. **What this section buys is that
   * the exemption is COUNTED, NAMED, and FAILS THE DAY EITHER SIDE MOVES** —
   * which is §2b's rule (*"an exemption that stopped being needed is a
   * FAILURE"*) applied to a silence instead of to a table.
   *
   * ┌─ ⛔ ESCALATED TO THE OWNER ON 22 Sep 2026 — G1920, NOT APPLIED ──────────┐
   * │ **COUNTING IT TWICE IS NOT CLOSING IT.** §4b's repair sentence is *"move │
   * │ the status word in docs/handoff-pack/ in the same change that adds the   │
   * │ route"*; G1911 added the routes and moved nothing. THE OWNER OWES ONE OF │
   * │ THREE RULINGS AND THIS SUITE PICKS NONE:                                 │
   * │                                                                          │
   * │  1 · MOVE THE PACK'S STATUS WORDS off `specified` for `/demo` and        │
   * │      `/lookup`. The north star is G264's and no test may edit it — and   │
   * │      `built` would be a FALSE word, because a route resolving to         │
   * │      `scopeOf`'s gap sentence is not *"drawn on a surface … and operable │
   * │      there. A reader can click it."*                                     │
   * │  2 · WIDEN §4b TO THE PUBLIC PLANE and delete §6c, which makes this      │
   * │      suite RED until (1) happens — so it is (1) with extra steps, and    │
   * │      an honest red rather than a silence is a defensible thing to want.  │
   * │  3 · REFUSE THE ROUTES and restore the two exemptions, which is a design │
   * │      change to a closed set in the other direction and throws away the   │
   * │      only place the tree and the pack agree on a public-route spelling.  │
   * │                                                                          │
   * │ 🛑 AND RULING (1) IS NOT A ONE-WORD EDIT, BECAUSE THE PACK CONTRADICTS   │
   * │ ITSELF ABOUT THESE EXACT ROWS. Derive all three, never read them:        │
   * │                                                                          │
   * │   grep -c "surface:'/demo'.*exists:'neither'" \                          │
   * │     'docs/handoff-pack/User Journeys.dc.html'                     # 3    │
   * │   sed -n '/The public plane/,/<\/table>/p' \                             │
   * │     'docs/handoff-pack/User Journeys.dc.html' \                          │
   * │     | grep -c '<td>public</td><td>public</td>'                    # 3    │
   * │                                                                          │
   * │ Every `/demo` JOURNEY STEP carries `exists:'neither'` while the route    │
   * │ TABLE says `specified`; that table cell's own prose calls `/demo` *"the  │
   * │ highest-leverage **unspecified** surface in the map"* in the same        │
   * │ sentence as the word `specified`; and the public-plane section's lead    │
   * │ says *"These **two** are neither"* above a table carrying **three**      │
   * │ public rows. **A status word cannot be moved coherently in a record      │
   * │ that disagrees with itself about what the status is**, which is why this │
   * │ is an owner's ruling about the NORTH STAR and not a tidy-up here.        │
   * └──────────────────────────────────────────────────────────────────────────┘
   */
  it('6a · the public plane is parsed at all, or 6b and 6c pass vacuously', () => {
    /* 🛑 §5.6, and this suite's §1 makes the same argument about itself. A
       filter that matches nothing makes every assertion under it green.

       WITNESSED RED by re-spelling the plane word `public` -> `publik` on the
       filter below: this failed with `The public-plane parse found 0
       URL-shaped rows`, **and 6b passed in the same run** — vacuously, over an
       empty set — which is the whole argument for this assertion existing. 6c
       caught it too, on its second half; the two are deliberate double cover,
       because 6c would not catch a DROP from three to one. */
    const rows = publicPlane()
    assert.ok(
      rows.length >= 3,
      'The public-plane parse found ' + String(rows.length) + ' URL-shaped rows and should ' +
        'find at least three — `/`, `/demo` and `/lookup`. The pack calls the public plane ' +
        '"a third plane the architecture documents do not describe at all"; if this is 0 the ' +
        'Plane column has been renamed or re-spelled and 6b and 6c below judge nothing. ' +
        'Derive: `grep -o \'<th scope="row" class="rt-route">[^<]*\' ' +
        "'docs/handoff-pack/User Journeys.dc.html'`.",
    )
  })

  it('6b · every public-plane pack path RESOLVES in the tree', () => {
    /* WITNESSED RED by deleting `/demo` from `ROUTE_PATHS` and its `ROUTES`
       entry: this failed with `unserved: /demo`, and §2a failed beside it
       demanding the exemption back. The two halves cannot drift apart. */
    const unserved = publicPlane()
      .map((r) => asPath(r.route) ?? '')
      .filter((p) => !resolves(p))
      .sort()
    assert.deepEqual(
      unserved,
      [],
      'The tree no longer serves every public-plane surface the pack names: ' +
        unserved.join(', ') + '. Until 22 Sep 2026 it served ONE of the three (`/`) and the ' +
        'other two were argued exemptions in PACK_PATHS_WITH_NO_TREE_ROUTE; G1911 added them. ' +
        'Removing one again is a design change to a closed set — argue it in ' +
        '`frontend/src/routes/table.ts` and put the exemption back in the same commit, ' +
        'because §2a will demand it.',
    )
  })

  it('6c · all three are `specified`, so §4b is silencing THREE rows and not one', () => {
    /* 🛑 THE ASSERTION IS THE EXEMPTION'S RECEIPT AND IT IS DELIBERATELY
       BRITTLE IN ONE DIRECTION. The moment the pack moves any of these three
       off `specified`, this goes RED and whoever moved it has to re-read §4b's
       restriction and decide whether the plane filter still earns its place.
       A silence that cannot change without failing is a recorded decision; a
       silence that can is how a status word stops meaning anything.

       WITNESSED RED by editing the pack's own `/demo` row from `specified` to
       `built` and reverting: this failed ALONE — `A public-plane row has moved
       off \`specified\`: /demo (built)` — **with §4a and §4b both GREEN in the
       same run**, which is the measurement this section was written to make.
       The status word moved on a resolving route and the arm with no escape
       hatch never saw it. */
    const notSpecified = publicPlane()
      .filter((r) => r.exists !== 'specified')
      .map((r) => `${r.route} (${r.exists})`)
      .sort()
    assert.deepEqual(
      notSpecified,
      [],
      'A public-plane row has moved off `specified`: ' + notSpecified.join(', ') + '. ' +
        'That is not a failure of the pack — it is this suite asking for a decision it ' +
        'deliberately deferred. §4b judges DATA-plane rows only, so these three resolve under ' +
        'a `specified` word and nothing reds. Re-read §4b\'s restriction: if the public plane ' +
        'now has an owner and an architecture, widen the filter and delete this assertion in ' +
        'the same commit.',
    )
    assert.equal(
      publicPlane().filter((r) => resolves(asPath(r.route) ?? '')).length,
      3,
      'THE MEASUREMENT: exactly three public-plane rows resolve under a `specified` word and ' +
        'are invisible to §4b. It was ONE before 22 Sep 2026 — `/`, which nobody had named. ' +
        'If this number moves, §4b\'s `plane === \'data\'` filter is doing more work than its ' +
        'own argument covers.',
    )
  })

  it('6d · §4b\'s filter is READ here, so gutting §4b cannot leave this section green', () => {
    /* 🛑 WITNESSED RED, AND IT IS THE FINDING THAT PUT THIS ASSERTION HERE —
       G1919. §4b's BODY was replaced with a hard-coded `const premature:
       string[] = []` — the shape of a §5.6 defect, a control that asserts
       nothing — and **§6c stayed GREEN, still titled *"§4b is silencing THREE
       rows and not one"***. A section whose entire subject is another
       section's filter was measuring only the PACK, so it recorded a fact
       about a control that had stopped being one.

       This assertion reads `dataPlane()` — the filter itself — and demands
       three things of it that no rewrite of §4b's body can satisfy by
       accident: that it is NON-EMPTY, that it holds no `public` row, and that
       data and public together account for every non-control URL-shaped row
       the pack carries. With `dataPlane()` stubbed to `[]` this fails first:

         §4b's own filter selected 0 data-plane rows, so §4b judged nothing
         and §6's count of what it silences is a claim about a control that
         has stopped controlling anything.

       ⚠️ IT DOES NOT ASSERT §4b's RESULT, deliberately: §4b's job is to be
       green when the tree agrees with the pack, so a green §4b and a gutted
       §4b look the same from outside. What separates them is whether the
       FILTER still selects rows, which is what this reads. */
    const data = dataPlane()
    assert.ok(
      data.length > 0,
      '§4b\'s own filter selected 0 data-plane rows, so §4b judged nothing and §6\'s count ' +
        'of what it silences is a claim about a control that has stopped controlling ' +
        'anything. §4c asserts the two ARMS are non-vacuous; this asserts the FILTER is.',
    )
    assert.deepEqual(
      data.filter((r) => r.plane === 'public').map((r) => r.route),
      [],
      '§4b\'s filter now admits a PUBLIC-plane row, so §6 is counting a silence that is no ' +
        'longer there. If the public plane has acquired an owner and an architecture, widen ' +
        '§4b, delete §6c and say so — do not let the two sections overlap silently.',
    )
    const urlRows = packRoutes().filter((r) => asPath(r.route) !== null)
    assert.equal(
      data.length + publicPlane().length,
      urlRows.filter((r) => r.plane !== 'control').length,
      '§4 and §6 between them no longer account for every non-control URL-shaped row in the ' +
        'pack\'s route tables. A fourth plane word, or a row that fell out of both filters, ' +
        'is a row nothing in this suite judges at all.',
    )
  })

  it('6e · §4b still USES the filter §6 is counting — read out of this file\'s own source', () => {
    /* 🛑 6d READS THE FILTER AND THIS READS THE CALL SITE, AND THE GAP BETWEEN
       THEM IS WHY BOTH EXIST — G1919. The mutation that exposed §6c replaced
       §4b's BODY with a hard-coded `const premature: string[] = []` and left
       `dataPlane()` untouched; 6d is green against that, because the filter is
       still a filter. **A section whose whole subject is another section's
       silence has to be able to tell that the other section is still
       speaking.**

       ⚠️ IT IS A SOURCE READ AND IT SAYS SO. The alternative is recomputing
       §4b's predicate here, which is §5.3 — two implementations of one rule,
       and the copy is the one that drifts. Precedent:
       `tests/model/membership-liveness.test.ts` §4 reads
       `selectTenantForSession()`'s own bytes for exactly this reason.

       WITNESSED RED by replacing §4b's body with `const premature: string[] =
       []` — the mutation that left §6c green and still titled *"§4b is
       silencing THREE rows"*:

         §4b no longer calls dataPlane(). §6 exists to count the rows §4b's
         `plane === 'data'` filter silences; if §4b has stopped reading that
         filter, §6c's title is a claim about a control that no longer runs. */
    const source = readFileSync(fileURLToPath(import.meta.url), 'utf8')
    const from = source.indexOf("it('4b ·")
    const to = source.indexOf("it('4c ·")
    assert.ok(
      from > 0 && to > from,
      'This suite can no longer locate its own §4b and §4c — the section markers have been ' +
        'renamed. Re-point this assertion in the same change, because a source read that ' +
        'finds nothing passes VACUOUSLY (§5.6) and would silence itself.',
    )
    const body = source.slice(from, to)
    assert.ok(
      body.includes('dataPlane()'),
      '§4b no longer calls dataPlane(). §6 exists to count the rows §4b\'s ' +
        '`plane === \'data\'` filter silences; if §4b has stopped reading that filter, ' +
        '§6c\'s title is a claim about a control that no longer runs.',
    )
    assert.ok(
      body.includes('resolves('),
      '§4b no longer calls resolves(). Its rule is "a row the pack marks `specified` whose ' +
        'path DOES resolve is a RED" — without the resolution check it judges nothing, and ' +
        'it is the arm its own text says has NO escape hatch.',
    )
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('7 · the TREE\'s own citations, checked against the corpus they name', () => {
  /**
   * 🛑 WHY THIS SECTION EXISTS: **EVERY FIELD OF EVERY `RouteSpec` WAS
   * UNCHECKED, AND ONE OF THEM WAS FALSE FOR A FEW HOURS — G1917, G1918,
   * 22 Sep 2026.**
   *
   * Sections 1–6 join the PACK to `ROUTE_PATHS`: the set of paths, in both
   * directions, against three pack artefacts. **Nothing anywhere read what
   * `ROUTES` says ABOUT a path.** Measured rather than feared: re-spelling
   * `/demo`'s record to `'Utterly Fabricated Record.dc.html'` and its tier
   * from `'Public'` to `'Entry'` left **`npm run check` EXIT 0**, this suite
   * 15 of 15 green, and `tsc` silent — because both are strings and one was a
   * member of a union the other arm had no business carrying.
   *
   * ┌─ WHAT IS CHECKABLE AND WHAT IS NOT, WHICH IS THE UNION'S REAL CONTENT ──┐
   * │ `pack` — the record is IN THIS TREE, so the record name and the anchor   │
   * │   are both opened and matched. `packRecords()` is the authority for the  │
   * │   first and the file's own `id=` attributes for the second; **neither is │
   * │   typed into this suite**.                                               │
   * │ `drawn_record` — `design/routes/` was DELETED under G264, so the file    │
   * │   cannot be opened at all. What IS checkable is the asymmetry: a         │
   * │   `drawn_record` citation must not name a pack record, because a         │
   * │   citation that resolves must not be wearing the arm that says it does   │
   * │   not. §7c is that, and it is the assertion that would have caught a     │
   * │   lazy repair of G1917 — moving `/demo` onto the `drawn_record` arm      │
   * │   rather than minting the `pack` one.                                    │
   * └─────────────────────────────────────────────────────────────────────────┘
   */
  const specs = ROUTE_PATHS.map((path) => ({ path, spec: ROUTES[path] }))
  const packSpecs = (): readonly { path: string; spec: RouteSpec }[] =>
    specs.filter((e) => e.spec.kind === 'pack')
  const drawnSpecs = (): readonly { path: string; spec: RouteSpec }[] =>
    specs.filter((e) => e.spec.kind === 'drawn_record')

  /** Every `id="…"` in a pack record, read out of the file. */
  const idsIn = (record: string): ReadonlySet<string> =>
    new Set(
      [...readFileSync(join(PACK, record), 'utf8').matchAll(/id="([^"]+)"/g)].map((m) => m[1] ?? ''),
    )

  it('7a · both arms have members, or 7b and 7c pass vacuously', () => {
    /* 🛑 §5.6, and this suite makes the same argument about itself twice
       already. A union whose second arm nobody uses is a union that proves
       nothing, and every assertion below is a loop over one of the two. */
    assert.ok(
      packSpecs().length >= 2 && drawnSpecs().length >= 10,
      'The route table no longer carries both kinds of citation — ' +
        `${String(packSpecs().length)} \`pack\` and ${String(drawnSpecs().length)} ` +
        '`drawn_record`. If either is 0 the assertions below judge nothing, and the union ' +
        'has stopped separating a citation that resolves from one that cannot.',
    )
  })

  it('7b · every `pack` citation names a record that EXISTS and an anchor that is IN it', () => {
    /* WITNESSED RED with red's own mutation — `/demo`'s record re-spelled to
       `'Utterly Fabricated Record.dc.html'`, which left the whole gate EXIT 0
       before this assertion existed. And a second time by re-spelling
       `/lookup`'s anchor `why-same` -> `why-sam`. Both messages are recorded
       verbatim in the commit that added this. */
    const records = new Set(packRecords())
    for (const { path, spec } of packSpecs()) {
      if (spec.kind !== 'pack') continue
      assert.ok(
        records.has(spec.record),
        `${path} cites the pack record "${spec.record}", which is not in docs/handoff-pack/. ` +
          `The pack ships ${String(records.size)} records and this is not one of them: ` +
          [...records].join(' · ') + '. A citation nobody opens is a citation that rots, ' +
          'and this arm exists precisely because it CAN be opened.',
      )
      const ids = idsIn(spec.record)
      assert.ok(
        ids.has(spec.anchor),
        `${path} cites "${spec.record}#${spec.anchor}" and that record has no element with ` +
          `that id. The ids it does carry: ${[...ids].sort().join(' · ') || '(none)'}. ` +
          'G1913 refused `anchor: \'rt-route\'` because a CSS class LOOKS like a citation; ' +
          'an id that is not in the file is the same defect one step further on.',
      )
    }
  })

  it('7c · a `drawn_record` citation must NOT name a pack record', () => {
    /* 🛑 THE ASYMMETRY IS THE UNION'S CONTENT AND THIS IS WHERE IT IS
       ASSERTED. `drawn_record` means *"the citation does not resolve in this
       tree"*; a `drawn_record` entry naming a file that IS here would be that
       claim falsified by its own value, and would be the lazy repair of
       G1917 — putting `/demo` on the existing arm rather than minting one for
       the corpus it belongs to.

       WITNESSED RED by moving `/demo` to
       `{ kind: 'drawn_record', plane: 'public', tier: 'Entry',
          file: 'V2 Book a Demo.dc.html', anchor: 'form' }`. */
    const records = new Set(packRecords())
    for (const { path, spec } of drawnSpecs()) {
      if (spec.kind !== 'drawn_record') continue
      assert.ok(
        !records.has(spec.file),
        `${path} is on the \`drawn_record\` arm and cites "${spec.file}", which is a record ` +
          'in docs/handoff-pack/. That arm means the citation does NOT resolve in this tree ' +
          '— `design/routes/` was deleted under G264 — so a live pack record wearing it is ' +
          'the union asserting the opposite of the value it holds. Use the `pack` arm.',
      )
    }
  })

  it('7d · the PLANE is a MIRROR of the pack\'s own column, in BOTH directions', () => {
    /* 🛑 THIS IS WHY `plane` IS A FIELD AND `tier` IS NOT — G1918.

       G1912 refused a `plane` field as *"a THIRD authority for a fact the pack
       already states in a column of its own"* and put the pack's `public` into
       `tier` as `'Public'` instead. **The plane was copied either way**; the
       choice was which NAME the third copy wore, and only one of the two can be
       joined back to the authority. This is that join, asserted in both
       directions over the paths both records name — `db/migrations/0008`'s
       standard, which is what makes a copy a MIRROR rather than a third place
       to drift. **`tier` could never be mirrored: the pack has no tier column.**

       ⚠️ `/` IS THE ONE EXEMPTION AND IT IS NAMED, NOT SILENT.

       WITNESSED RED by setting `/close`'s plane to `'control'`. */
    const disagreements: Readonly<Record<string, string>> = {
      '/':
        'NOT A DRIFT — the same path naming two surfaces. The pack\'s `/` is a marketing ' +
        'landing page on the public plane; the tree\'s `/` is the ENTRY HERO, drawn in ' +
        '`design/routes/entry.html#r-hero` beside `/signin` and served by the data plane. ' +
        '§4\'s restriction has said so since G319. Which surface `/` is belongs to the same ' +
        'ruling as `/entry` (G1914) and is not swept onto either side here.',
    }
    const byPath = new Map<string, string>()
    for (const r of packRoutes()) {
      const p = asPath(r.route)
      if (p !== null) byPath.set(p, r.plane)
    }
    const drift: string[] = []
    for (const { path, spec } of specs) {
      const packPlane = byPath.get(path)
      if (packPlane === undefined) continue
      if (packPlane === spec.plane) continue
      if (path in disagreements) continue
      drift.push(
        `${path}: the tree says plane "${spec.plane}" and the pack's route table says "${packPlane}"`,
      )
    }
    assert.deepEqual(
      drift,
      [],
      'The tree\'s `plane` and the pack\'s Plane column disagree, and nobody has argued it: ' +
        drift.join('; ') + '. The field exists to be joined back to the authority it was ' +
        'copied from — that is the whole of G1918 — so a disagreement is either a pack edit ' +
        'to follow or a named entry beside `/`.',
    )
    /* The other direction: an exemption that stopped being needed is a FAILURE,
       §2b's rule applied to this table too. */
    for (const [path, why] of Object.entries(disagreements)) {
      const packPlane = byPath.get(path)
      assert.ok(
        packPlane !== undefined,
        `"${path}" is exempted from the plane mirror and the pack no longer names it.`,
      )
      const entry = specs.find((e) => e.path === path)
      assert.ok(entry !== undefined, `"${path}" is exempted from the plane mirror and is not a route.`)
      assert.notEqual(
        packPlane,
        entry.spec.plane,
        `"${path}" is listed as a plane DISAGREEMENT and the two records now agree ` +
          `("${String(packPlane)}"). Delete the entry and say so in the commit; the reason ` +
          `recorded was: "${why}"`,
      )
    }
    /* Anti-vacuity: the mirror must have rows to compare. */
    const shared = ROUTE_PATHS.filter((p) => byPath.has(p))
    assert.ok(
      shared.length >= 5,
      `Only ${String(shared.length)} paths are named by BOTH records, so the plane mirror ` +
        'compares almost nothing. The intersection was six on 22 Sep 2026 — `/`, `/close`, ' +
        '`/ask`, `/reports`, `/demo`, `/lookup`.',
    )
  })
})

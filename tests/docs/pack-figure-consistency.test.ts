/**
 * THE PACK'S CLEARED FIGURES, JOINED TO EACH OTHER — G1906.
 *
 * 🛑 WHAT THIS FILE IS FOR, IN ONE SENTENCE: **`docs/handoff-pack/` publishes
 * one engagement's figures on TWO surfaces, `PRODUCT.md` clears them by name
 * under G268, and until this file landed NOTHING in `npm run check` READ A
 * FIGURE on either — so the two could disagree, and on 22 Sep 2026 they did.**
 *
 * ⚠️ BE EXACT ABOUT THE ABSENCE, BECAUSE THE OVERSTATED VERSION IS EASY AND
 * WRONG. It is not that nothing OPENED these files: `tests/app/route-provenance
 * .test.ts` walks every `.dc.html` in the pack through `readdirSync` looking
 * for `surface:'…'` tokens, so it reads both pages' bytes on every run. **It
 * has no notion of a figure and asserts nothing about one.** `check-doc-counts`
 * governs fourteen tree-derived totals and not one is a number inside the pack;
 * `check-pack-safety` reads `model/examples.ts`. Derive the naming half:
 * `grep -rln 'V1 Landing\|V4 Success Story' tests/ tools/` returned NOTHING
 * before this file, and returns exactly this file now.
 *
 * The defect this replaces the absence of is not hypothetical and is not old.
 * `V4 Success Story` shipped `65%` and `15→7` as tiles in ONE grid: 20→7 is
 * 65.0% and 15→7 is 53.3%, so the page contradicted itself. G1901 (the owner's
 * ruling of 22 Sep 2026) moved the tile to `20→7`. The commit that moved it
 * left `V1 Landing` at `15→7` — and `V1`'s tile carries a *"Read the full
 * story"* button that links straight to `V4`, so a prospect met two baselines
 * for one engagement ONE CLICK APART. G1907 closed that; **this file is why the
 * next one cannot open.**
 *
 * ┌─ WITNESSED RED, AND EVERY MESSAGE BELOW WAS OBSERVED RATHER THAN WRITTEN ─┐
 * │ A control added without a demonstrated red is `docs/HANDOFF.md` §5.6      │
 * │ wearing a different hat, so this suite was run against the two trees that │
 * │ carried the defect BEFORE it was pointed at the corrected one, and its    │
 * │ two remaining assertions were witnessed by mutation. The reds are quoted  │
 * │ VERBATIM on the assertions that produced them; the list here is an index. │
 * │                                                                          │
 * │ 1 · §2a, against `248e3e8` — the pack before G1901, when BOTH tiles read  │
 * │     `15→7`. One failure naming two files: *"V1 Landing.dc.html" states    │
 * │     the minutes pair 15→7 … "V4 Success Story.dc.html" states the minutes │
 * │     pair 15→7 … The workload panel derives 20→7 (284/99 hrs over 852 txn  │
 * │     · 457/160 hrs over 1372 txn · 1118/391 hrs over 3354 txn).*           │
 * │                                                                          │
 * │ 2 · §2c, against `248e3e8` — the prose sentence, which outlived the tile: │
 * │     *"V4 Success Story.dc.html" states "15 minutes of reading each". The  │
 * │     workload panel derives 20 minutes manual and 7 AI-assisted …*         │
 * │                                                                          │
 * │ 3 · §2a, against `e5080fa` — G1901 applied to `V4` and G1903's deferral   │
 * │     on `V1`. THE DIVERGENCE THIS FILE EXISTS FOR, one failure naming one  │
 * │     file: *"V1 Landing.dc.html" states the minutes pair 15→7 on the tile  │
 * │     labelled "Minutes per transaction". The workload panel derives 20→7 … │
 * │     The pack publishes this engagement on more than one surface and a     │
 * │     prospect can reach both — "V1 Landing" links to "V4 Success Story"    │
 * │     from beside its own tile …*                                          │
 * │                                                                          │
 * │ 🛑 §2b DID NOT FIRE AT EITHER COMMIT, AND SAYING SO IS THE POINT OF THIS  │
 * │     LINE. At `248e3e8` both tiles said `65%` and the panel implied `65%`, │
 * │     so only the PAIR was wrong there and the percentage arm was correct.  │
 * │     A first draft of this header claimed a §2b red at that commit; it was │
 * │     never observed, and a claimed red nobody ran is exactly the defect    │
 * │     this file is here to catch. It was witnessed by MUTATION instead —    │
 * │     `65%` → `53%` on V1's tile — giving: *"V1 Landing.dc.html" states 53% │
 * │     on the tile labelled "Less processing time per transaction". The      │
 * │     minutes pair the pack derives is 20→7, which is 65%.*                 │
 * │                                                                          │
 * │ 🛑 §1's ANTI-VACUITY CASE WAS WITNESSED TOO, because a parser that        │
 * │     matches nothing passes every comparison after it. Breaking the        │
 * │     panel's own separator (`AI-assisted ·` → `AI assisted,`) gave §1a     │
 * │     *"The monthly-workload parse found 0 rows … EVERY comparison in §2    │
 * │     passes over an empty set"*, §1c *"The workload rows derive 0          │
 * │     different minutes pairs"*, AND §2a/§2b/§2c red WITH them rather than  │
 * │     silently green — which is the property `only()` exists to hold.       │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 READ WHAT THIS CONTROL CAN AND CANNOT KNOW BEFORE QUOTING A GREEN RUN.
 * **It asserts MUTUAL CONSISTENCY and it cannot assert TRUTH.** The workload
 * panel is not three independent witnesses to a 20-minute baseline — G1908
 * measures it: every row is `transactions × 20/60` and `transactions × 7/60`
 * rounded (852 → 284/99, 1,372 → 457/160, 3,354 → 1,118/391), so ONE assumption
 * is multiplied by three volumes and deriving 20 back out of it is circular.
 * The panel is the pack's own arithmetic and nothing more. What this file
 * therefore catches is exactly one class: **one surface of the pack disagreeing
 * with another about a figure both of them publish.** Whether 20 is the right
 * number is G268's clearance and the owner's, and no test can hold it.
 *
 * ⚠️ WHAT IT DOES NOT COVER, NAMED SO NOBODY READS IT AS GOVERNING MORE:
 *
 *   · **TRUTH, per the paragraph above.** A pack that consistently published a
 *     wrong baseline everywhere would be GREEN here.
 *   · **Every other cleared figure.** `727 hrs`, `85%+`, `58+ formats`,
 *     `6,000 a month`, `3-way`, the `1,118 → 391` pair inside the 727 label and
 *     the `9→7` / `9→3` step pairs are read by nothing. `727 = 1,118 − 391`
 *     happens to hold and this file does not check it.
 *   · **The record.** It reads `docs/handoff-pack/` only. `PRODUCT.md`,
 *     `docs/HANDOFF.md` and `docs/handoff-pack/index.html` are not compared to
 *     the surfaces — so the index's *"every tenant, partner, figure and case in
 *     them is synthetic"* sentence, which G1909 records as now CONTRADICTING
 *     G1901's premise, is invisible here.
 *   · **One of the two sites G1901 itself corrected.** §2c is a PHRASE LIST and
 *     not a property (`docs/HANDOFF.md` §5.1): it reads `N minutes a/per
 *     transaction` and `N minutes of reading each`, which are the three forms
 *     the pack uses today. A fourth phrasing is not covered — which is why §1
 *     asserts a FLOOR on how many prose claims the scan finds, so a rewording
 *     that drops out of the list fails the count instead of passing silently.
 *   · **A figure spelled in words.** `V4`'s outcomes SECTION HEADING reads
 *     *"Seven minutes a transaction, and the judgement left where it was"*;
 *     §2c reads digits only and skips it. That is the AFTER figure stated in
 *     the largest type on the page and this file cannot see it.
 *   · **Whether a claim is marked as a projection.** G1910 records that the
 *     2024 and 2025 AI-assisted rows of the panel this file DERIVES FROM are
 *     unmarked actuals for a system whose own timeline begins June 2025. This
 *     file consumes those rows and says nothing about that; it is a
 *     claim-integrity question and it is the owner's.
 *
 * ⚠️ NO FIGURE AND NO FILENAME IS TYPED INTO A DERIVATION. Both sides are read
 * at runtime out of the pack's own markup — `tests/app/route-provenance.test.ts`
 * is the precedent and the reason that is legitimate here. The FLOORS in §1 are
 * measured counts, not figures: they exist because every set comparison below
 * would pass vacuously over an empty parse, which is §5.6 and is the hole red
 * found in a sibling slice.
 *
 * ⚠️ DETERMINISTIC AND OFFLINE BY CONSTRUCTION — G108's condition. It reads
 * twelve files off disk with `node:fs`, needs no database, no browser, no
 * network and no dependency outside `node:*`, and takes single-digit
 * milliseconds. It therefore calls neither reachability guard, and must not:
 * it has nothing to stand down over.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PACK = join(REPO, 'docs', 'handoff-pack')

/* ─────────────────────────────────────────────────────────────────────────
   THE PACK, PARSED. Nothing below states a figure.
   ───────────────────────────────────────────────────────────────────────── */

/**
 * 🛑 COMMENTS ARE STRIPPED FIRST, AND THAT IS G1905 RATHER THAN TIDINESS.
 * G1902 rules that a correction to a surface that SELLS is narrated in an HTML
 * comment and not in the rendered body, so every corrected figure in this pack
 * is accompanied by a comment QUOTING THE RETIRED ONE in order to say it is
 * retired. **A scanner that read the raw bytes would find `15→7` on BOTH
 * surfaces today and report the very defects G1901 and G1907 closed** — the
 * banners are what it would be matching. The honest subject is the RENDERED
 * page, which carries neither.
 */
const rendered = (html: string): string => html.replace(/<!--[\s\S]*?-->/g, '')

/** Every `.dc.html` record in the pack, by name. */
function packRecords(): readonly string[] {
  return readdirSync(PACK)
    .filter((f) => f.endsWith('.dc.html'))
    .sort()
}

const readRendered = (file: string): string => rendered(readFileSync(join(PACK, file), 'utf8'))

/** `1,372` → `1372`. The pack groups thousands and the arithmetic does not. */
const digits = (s: string): number => Number(s.replace(/,/g, ''))

/* ── the workload panel ──────────────────────────────────────────────────── */

interface WorkloadRow {
  readonly file: string
  readonly manualHrs: number
  readonly aiHrs: number
  readonly transactions: number
}

/**
 * Every row of every monthly-workload panel in the pack.
 *
 * ⚠️ IT IS KEYED ON THE SENTENCE THAT CARRIES THE DATA AND NOT ON THE PANEL'S
 * TAG. `<span class="tag">Monthly workload · manual vs AI-assisted</span>` is a
 * landmark — rename it and a tag-keyed parser finds nothing and every set below
 * passes over the empty set. The row's own `N hrs AI-assisted · M transactions`
 * IS the claim, so that is what is read, and the manual figure is the nearest
 * one stated before it.
 */
function workloadRows(): readonly WorkloadRow[] {
  const out: WorkloadRow[] = []
  for (const file of packRecords()) {
    const html = readRendered(file)
    for (const m of html.matchAll(
      /([\d,]+)\s*hrs\s+AI-assisted\s*·\s*([\d,]+)\s*transactions/g,
    )) {
      const before = html.slice(0, m.index)
      const manual = [...before.matchAll(/<b>([\d,]+)\s*hrs<\/b>\s*manual/g)].pop()
      if (manual === undefined) continue
      out.push({
        file,
        manualHrs: digits(manual[1] ?? ''),
        aiHrs: digits(m[1] ?? ''),
        transactions: digits(m[2] ?? ''),
      })
    }
  }
  return out
}

/* ── the figure tiles ────────────────────────────────────────────────────── */

interface Tile {
  readonly file: string
  /** Each `<b class="figure">`'s own text, in document order. */
  readonly figures: readonly string[]
  /** The tile's `.small` caption, tags stripped and whitespace collapsed. */
  readonly label: string
}

/** Every `<span>` element in `html`, as start/inner/end offsets. */
function spanElements(html: string): readonly { start: number; innerStart: number; end: number }[] {
  const out: { start: number; innerStart: number; end: number }[] = []
  const stack: { start: number; innerStart: number }[] = []
  for (const m of html.matchAll(/<span\b[^>]*>|<\/span>/g)) {
    if (m[0] === '</span>') {
      const open = stack.pop()
      if (open !== undefined) out.push({ ...open, end: m.index })
    } else {
      stack.push({ start: m.index, innerStart: m.index + m[0].length })
    }
  }
  return out
}

/**
 * A TILE is the SMALLEST `<span>` element carrying at least one
 * `<b class="figure">` and at least one `.small` caption.
 *
 * 🛑 THE PACK DRAWS A FIGURE TILE TWO WAYS AND A PARSER THAT KNEW ONLY ONE
 * WOULD MISS THE SITE THAT MATTERS MOST. On the outcome grids the caption
 * FOLLOWS a single figure (`<b class="figure">20→7</b><span class="small">…`);
 * in `V4`'s `#process` panel the caption PRECEDES two separate figures with an
 * arrow between them (`…class="small">Minutes per transaction</span> …
 * <b class="figure">20</b> → <b class="figure">7</b>`). Reading the enclosing
 * element rather than the neighbouring token answers both, and answers a third
 * arrangement nobody has drawn yet.
 */
function tiles(): readonly Tile[] {
  const out: Tile[] = []
  for (const file of packRecords()) {
    const html = readRendered(file)
    const carrying = spanElements(html)
      .map((s) => ({ ...s, inner: html.slice(s.innerStart, s.end) }))
      .filter(
        (s) =>
          /<b class="figure"[^>]*>/.test(s.inner) && /<span class="small"[^>]*>/.test(s.inner),
      )
    for (const s of carrying) {
      const strictlyInside = carrying.some(
        (o) => o.start >= s.start && o.end <= s.end && (o.start > s.start || o.end < s.end),
      )
      if (strictlyInside) continue
      const figures = [...s.inner.matchAll(/<b class="figure"[^>]*>([\s\S]*?)<\/b>/g)].map((m) =>
        (m[1] ?? '').replace(/<[^>]*>/g, '').trim(),
      )
      const caption = /<span class="small"[^>]*>([\s\S]*?)<\/span>/.exec(s.inner)
      const label = (caption?.[1] ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      out.push({ file, figures, label })
    }
  }
  return out
}

/** A `(manual, ai)` minutes pair stated on a tile, however the tile is drawn. */
interface PairTile {
  readonly file: string
  readonly label: string
  readonly manual: number
  readonly ai: number
}

function minutesPairTiles(): readonly PairTile[] {
  const out: PairTile[] = []
  for (const t of tiles()) {
    if (!/minutes/i.test(t.label)) continue
    const inline = t.figures.length === 1 ? /^(\d[\d,]*)→(\d[\d,]*)$/.exec(t.figures[0] ?? '') : null
    if (inline !== null) {
      out.push({ ...t, manual: digits(inline[1] ?? ''), ai: digits(inline[2] ?? '') })
      continue
    }
    if (t.figures.length === 2 && t.figures.every((f) => /^\d[\d,]*$/.test(f))) {
      out.push({ ...t, manual: digits(t.figures[0] ?? ''), ai: digits(t.figures[1] ?? '') })
    }
  }
  return out
}

/** A percentage tile whose own caption says it is about processing TIME. */
interface PercentTile {
  readonly file: string
  readonly label: string
  readonly percent: number
}

function processingTimePercentTiles(): readonly PercentTile[] {
  const out: PercentTile[] = []
  for (const t of tiles()) {
    if (!/processing time/i.test(t.label)) continue
    for (const f of t.figures) {
      const m = /^(\d+)%/.exec(f)
      if (m !== null) out.push({ file: t.file, label: t.label, percent: Number(m[1]) })
    }
  }
  return out
}

/** A per-transaction minutes figure stated in running prose. */
interface ProseClaim {
  readonly file: string
  readonly minutes: number
  readonly phrase: string
}

/**
 * ⚠️ THIS IS A PHRASE LIST, NOT A PROPERTY — §5.1, and it is said here rather
 * than discovered. The three forms are the ones the pack uses today; a fourth
 * is not covered, and §1's floor is what makes a rewording out of the list a
 * RED rather than a silent narrowing.
 */
function proseMinutesClaims(): readonly ProseClaim[] {
  const out: ProseClaim[] = []
  for (const file of packRecords()) {
    const text = readRendered(file)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
    for (const m of text.matchAll(
      /(\d[\d,]*)\s*minutes\s+(?:a transaction|per transaction|of reading each)/g,
    )) {
      out.push({ file, minutes: digits(m[1] ?? ''), phrase: m[0] })
    }
  }
  return out
}

/* ─────────────────────────────────────────────────────────────────────────
   THE DERIVED BASELINE — one pair, out of the pack's own arithmetic.
   ───────────────────────────────────────────────────────────────────────── */

interface Derived {
  readonly manual: number
  readonly ai: number
}

function derivedMinutes(): readonly Derived[] {
  const seen = new Map<string, Derived>()
  for (const r of workloadRows()) {
    const d: Derived = {
      manual: Math.round((r.manualHrs * 60) / r.transactions),
      ai: Math.round((r.aiHrs * 60) / r.transactions),
    }
    seen.set(`${String(d.manual)}→${String(d.ai)}`, d)
  }
  return [...seen.values()]
}

const only = (): Derived => {
  const d = derivedMinutes()
  assert.equal(d.length, 1, 'the workload rows do not agree; §1c says so first')
  return d[0] as Derived
}

const spread = (xs: readonly { file: string }[]): number => new Set(xs.map((x) => x.file)).size

// ──────────────────────────────────────────────────────────────────────────
describe('1 · the pack states these figures, or nothing below means anything', () => {
  /**
   * 🛑 A PARSER THAT MATCHES NOTHING PASSES EVERY ASSERTION AFTER IT. §5.6, and
   * this suite is wholly exposed to it because every check in §2 is a
   * comparison against something this file derived out of markup it does not
   * control. **A floor here is a measurement, not a figure**: it moves when a
   * surface is added or retired, and when it moves somebody has to say so in a
   * commit rather than let a control quietly stop covering a page.
   */
  it('1a · the workload panel parses, and gives whole rows rather than fragments', () => {
    const rows = workloadRows()
    assert.ok(
      rows.length >= 3,
      'The monthly-workload parse found ' +
        String(rows.length) +
        ' rows; the pack carries three (2024, 2025, 2026 ~proj) in ' +
        '"V4 Success Story.dc.html". If this is 0 the parser has drifted from the markup ' +
        'and EVERY comparison in §2 passes over an empty set — which is the exact shape ' +
        'docs/HANDOFF.md §5.6 catalogues, arriving inside the control written against it. ' +
        'Derive: grep -c "AI-assisted ·" docs/handoff-pack/*.dc.html',
    )
    for (const r of rows) {
      assert.ok(
        r.transactions > 0 && r.manualHrs > 0 && r.aiHrs > 0,
        `A workload row in "${r.file}" parsed to a zero: ` +
          `${String(r.manualHrs)} manual hrs, ${String(r.aiHrs)} AI hrs, ` +
          `${String(r.transactions)} transactions. A zero denominator divides into infinity ` +
          'and would make §2 assert against NaN, which compares unequal to everything and ' +
          'reads as a real failure about the wrong thing.',
      )
    }
  })

  it('1b · the tiles and the prose parse, on MORE THAN ONE surface', () => {
    const pairs = minutesPairTiles()
    const percents = processingTimePercentTiles()
    const prose = proseMinutesClaims()

    assert.ok(
      pairs.length >= 3 && spread(pairs) >= 2,
      'The minutes-pair parse found ' +
        String(pairs.length) +
        ' tiles across ' +
        String(spread(pairs)) +
        ' files. The pack carries three across two — "V1 Landing" (the proof tile), and ' +
        '"V4 Success Story" twice (the outcomes tile and the #process panel). ' +
        'THE SECOND NUMBER IS THE POINT OF THIS SUITE: a cross-surface control that reads ' +
        'one surface is not one. If a redesign retires a surface, lower this floor in the ' +
        'commit that retires it and say so — do not let the coverage narrow silently. ' +
        'Found: ' +
        pairs.map((p) => `${p.file} "${p.label}"`).join(' · '),
    )
    assert.ok(
      percents.length >= 2 && spread(percents) >= 2,
      'The processing-time percentage parse found ' +
        String(percents.length) +
        ' tiles across ' +
        String(spread(percents)) +
        ' files; the pack carries one on each of "V1 Landing" and "V4 Success Story". ' +
        'Both are the same claim in different words ("Less processing time per transaction" ' +
        'and "Reduction in AP processing time per transaction"), which is precisely why ' +
        'they can drift apart. Found: ' +
        percents.map((p) => `${p.file} ${String(p.percent)}% "${p.label}"`).join(' · '),
    )
    assert.ok(
      prose.length >= 3,
      'The prose scan found ' +
        String(prose.length) +
        ' per-transaction minutes claims; the pack carries three, all in ' +
        '"V4 Success Story". This scan is a PHRASE LIST and not a property (§5.1), so this ' +
        'floor is the only thing standing between a REWORDING and a silent loss of ' +
        'coverage. If a claim was legitimately rewritten, extend the phrase list rather ' +
        'than the floor. Found: ' +
        prose.map((p) => `${p.file} "${p.phrase}"`).join(' · '),
    )
  })

  it('1c · every workload row derives the SAME pair, so there is one baseline to compare against', () => {
    const d = derivedMinutes()
    assert.equal(
      d.length,
      1,
      'The workload rows derive ' +
        String(d.length) +
        ' different minutes pairs — ' +
        d.map((x) => `${String(x.manual)}→${String(x.ai)}`).join(' · ') +
        ' — so the panel disagrees with ITSELF and there is no single figure for §2 to ' +
        'hold the tiles to. Rows: ' +
        workloadRows()
          .map(
            (r) =>
              `${String(r.manualHrs)}/${String(r.aiHrs)} hrs over ` +
              `${String(r.transactions)} txn`,
          )
          .join(' · '),
    )
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('2 · every surface that publishes the figure publishes the SAME figure', () => {
  it('2a · every minutes-pair tile matches the pair the workload panel derives', () => {
    const d = only()
    /* WITNESSED RED at `e5080fa`, which had corrected V4 and not V1 — the
       divergence this control exists for. The message, verbatim and entire:

         "V1 Landing.dc.html" states the minutes pair 15→7 on the tile labelled
         "Minutes per transaction". The workload panel derives 20→7 (284/99 hrs
         over 852 txn · 457/160 hrs over 1372 txn · 1118/391 hrs over 3354 txn).
         The pack publishes this engagement on more than one surface and a
         prospect can reach both — "V1 Landing" links to "V4 Success Story" from
         beside its own tile — so two baselines one click apart is worse than
         either alone. The figure is cleared under G268 and ruled at G1901:
         correct the tile, do not move the panel, and if the RULING has changed
         then this suite is not the place to say so.

       AND AT `248e3e8` THE SAME ASSERTION NAMED BOTH FILES IN ONE FAILURE —
       both tiles read `15→7` there — opening:

         "V1 Landing.dc.html" states the minutes pair 15→7 on the tile labelled
         "Minutes per transaction". "V4 Success Story.dc.html" states the minutes
         pair 15→7 on the tile labelled "Minutes per transaction, manual to
         AI-assisted". …

       ⚠️ THE `deepEqual` IS WHAT MAKES ONE FAILURE NAME EVERY OFFENDING TILE
       rather than stopping at the first, which is why the 248e3e8 red is one
       message about two surfaces instead of two runs. */
    const wrong = minutesPairTiles().filter((t) => t.manual !== d.manual || t.ai !== d.ai)
    assert.deepEqual(
      wrong.map((t) => `${t.file} ${String(t.manual)}→${String(t.ai)} "${t.label}"`),
      [],
      wrong
        .map(
          (t) =>
            `"${t.file}" states the minutes pair ${String(t.manual)}→${String(t.ai)} on the ` +
            `tile labelled "${t.label}".`,
        )
        .join(' ') +
        ` The workload panel derives ${String(d.manual)}→${String(d.ai)} (` +
        workloadRows()
          .map(
            (r) =>
              `${String(r.manualHrs)}/${String(r.aiHrs)} hrs over ${String(r.transactions)} txn`,
          )
          .join(' · ') +
        '). The pack publishes this engagement on more than one surface and a prospect ' +
        'can reach both — "V1 Landing" links to "V4 Success Story" from beside its own ' +
        'tile — so two baselines one click apart is worse than either alone. The figure ' +
        'is cleared under G268 and ruled at G1901: correct the tile, do not move the ' +
        'panel, and if the RULING has changed then this suite is not the place to say so.',
    )
  })

  it('2b · every processing-time percentage matches the reduction that pair implies', () => {
    const d = only()
    const implied = Math.round((100 * (d.manual - d.ai)) / d.manual)
    /* 🛑 THIS ASSERTION DID NOT FIRE AT EITHER HISTORICAL COMMIT, AND THAT IS
       RECORDED RATHER THAN GLOSSED. At `248e3e8` both tiles said `65%` and the
       panel implied `65%`, so the percentage arm was CORRECT while the pair was
       wrong; §2a caught that commit and this did not. A first draft of this
       file's header claimed a red here anyway — a claimed red nobody observed,
       which is the exact defect the header is written against.

       WITNESSED RED BY MUTATION INSTEAD — `65%` → `53%` on V1's proof tile,
       verbatim and entire:

         "V1 Landing.dc.html" states 53% on the tile labelled "Less processing
         time per transaction". The minutes pair the pack derives is 20→7, which
         is 65%. Two figures in one grid that cannot both be true is the defect
         G1901 was ruled on; the percentage is the G268-CLEARED one and the
         baseline is not cleared independently of it, so the pair moves and the
         percentage does not.

       ⚠️ A PERCENTAGE AND A PAIR CAN AGREE WITH EACH OTHER AND BOTH BE WRONG —
       this assertion holds only that they agree. G268 holds whether they are
       right, and the alternative repair (move the 65% to 53% and keep the 15) is
       preserved as REFUSED on G1901 because the 65% is the cleared figure. */
    const wrong = processingTimePercentTiles().filter((t) => t.percent !== implied)
    assert.deepEqual(
      wrong.map((t) => `${t.file} ${String(t.percent)}% "${t.label}"`),
      [],
      wrong
        .map((t) => `"${t.file}" states ${String(t.percent)}% on the tile labelled "${t.label}".`)
        .join(' ') +
        ` The minutes pair the pack derives is ${String(d.manual)}→${String(d.ai)}, which is ` +
        `${String(implied)}%. Two figures in one grid that cannot both be true is the ` +
        'defect G1901 was ruled on; the percentage is the G268-CLEARED one and the ' +
        'baseline is not cleared independently of it, so the pair moves and the ' +
        'percentage does not.',
    )
  })

  it('2c · every per-transaction minutes figure stated in PROSE is one of the two', () => {
    const d = only()
    /* WITNESSED RED at `248e3e8`, verbatim and entire:

         "V4 Success Story.dc.html" states "15 minutes of reading each". The
         workload panel derives 20 minutes manual and 7 AI-assisted, and a
         per-transaction minutes figure on these surfaces must be one of the two.
         A figure in running text carries no grid to contradict it, so it is the
         one most likely to survive a correction to the tiles — which is what
         happened at 248e3e8 and is why this assertion exists beside 2a rather
         than instead of it.

       ⚠️ THE BURNING-PLATFORM SENTENCE IS THE ONE THIS CATCHES, and it argued
       its own case at 15 while the case is STRONGER at 20 — the prose
       understated itself, which is why nobody reading for plausibility would
       have found it.

       ⚠️ THE PROSE IS NOT LABELLED manual OR AI-ASSISTED, so the only thing
       assertable is membership: a per-transaction minutes figure on these pages
       is either the before or the after, and a third number is a contradiction
       whichever of the two it was meant to be. */
    const wrong = proseMinutesClaims().filter((c) => c.minutes !== d.manual && c.minutes !== d.ai)
    assert.deepEqual(
      wrong.map((c) => `${c.file} "${c.phrase}"`),
      [],
      wrong.map((c) => `"${c.file}" states "${c.phrase}".`).join(' ') +
        ` The workload panel derives ${String(d.manual)} minutes manual and ` +
        `${String(d.ai)} AI-assisted, and a per-transaction minutes figure on these ` +
        'surfaces must be one of the two. A figure in running text carries no grid to ' +
        'contradict it, so it is the one most likely to survive a correction to the ' +
        'tiles — which is what happened at 248e3e8 and is why this assertion exists ' +
        'beside 2a rather than instead of it.',
    )
  })
})

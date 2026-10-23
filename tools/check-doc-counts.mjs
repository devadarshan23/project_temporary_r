#!/usr/bin/env node
/**
 * check-doc-counts — derive every governed count from the tree, then find every
 * place a document states one, and report the ones that disagree.
 *
 * WHY THIS EXISTS. `docs/HANDOFF.md` §5.11 records "a count stated in prose,
 * believed instead of derived" as a defect SHAPE rather than an accident: three
 * instances in three days. `docs/INDEX.md` went stale three times — 5, 6 and
 * 7 August — and each fix was a manual edit, which is why there was a fourth
 * staleness a day after the third repair. The manual edit is the finding. This
 * is the mechanical replacement for it.
 *
 * WHAT IT IS NOT. It cannot tell a stale claim from a deliberate historical one.
 * These documents narrate their own corrections on purpose — "thirty-four until
 * 7 Aug 2026", "this line said Six while nine files were on disk" — and that
 * convention is load-bearing, not noise. So a disagreement is classified, never
 * auto-fixed:
 *
 *   STALE       the line states a number that disagrees with the tree, and says
 *               nothing that reads as retrospective. Fix these.
 *   HISTORICAL  the line disagrees AND carries a retrospective cue, or states
 *               the correct current value elsewhere on the same line. Read
 *               these; most are correct as written.
 *
 * The classifier is a heuristic over English, and it is the only part of this
 * tool that guesses. Everything above it is derived from the tree.
 *
 * Exit status is 1 if any STALE line is found, 0 otherwise — so this can become
 * a CI check on the day `.github/` exists. HISTORICAL never fails the run.
 *
 *   node tools/check-doc-counts.mjs            report
 *   node tools/check-doc-counts.mjs --derive   print the derived counts only
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const lsCount = (dir, ext) =>
  readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(ext)).length

/**
 * Members of a `const X = { … }` object literal, counted the way CLAUDE.md's own
 * reproduction commands count them: two-space-indented `key:` lines only, so a
 * nested object or a doc comment does not inflate the total.
 */
function constMembers(file, name) {
  const src = read(file)
  const start = src.indexOf(`export const ${name} = {`)
  if (start === -1) throw new Error(`${name} not found in ${file}`)
  const end = src.indexOf('\n}', start)
  return src
    .slice(start, end)
    .split('\n')
    .filter((l) => /^ {2}[a-zA-Z]+:/.test(l)).length
}

/**
 * THE GATE'S OWN SHAPE, DERIVED FROM `package.json` — G1471.
 *
 * `CLAUDE.md` has carried a wrong stage count at ELEVEN, FOURTEEN, FIFTEEN and
 * SIXTEEN, and a wrong checker count at FOUR, FIVE, SIX, SEVEN and EIGHT —
 * nine recorded wrongs across two numbers, every one of them swept by a person
 * who happened to look. Neither figure was governed by anything.
 * `docs/build/completion-plan.md` K2 names that as the reason the fence keeps
 * going stale: **nothing derives it.**
 *
 * ⚠️ A CHECKER IS A `check:*` SCRIPT AND NOT A FILE IN `tools/`, WHICH IS THE
 * DISTINCTION THIS PAGE HAS GOT WRONG FOUR TIMES BY ITS OWN TALLY:
 * `citation-symbols.mjs` is a shared module and `skip-census.mjs` is a
 * REPORTER — it prints and cannot fail a run. `ls tools/*.mjs | wc -l` counts
 * both and is the wrong proxy; the script list is the property.
 */
const gateStages = () =>
  (JSON.parse(read('package.json')).scripts?.check ?? '')
    .split('&&')
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length

const checkerScripts = () =>
  Object.keys(JSON.parse(read('package.json')).scripts ?? {}).filter((k) => k.startsWith('check:')).length

/** Top-level fields of an interface, same counting rule. */
function interfaceFields(file, name) {
  const src = read(file)
  const start = src.indexOf(`export interface ${name} {`)
  if (start === -1) throw new Error(`${name} not found in ${file}`)
  const end = src.indexOf('\n}', start)
  return src
    .slice(start, end)
    .split('\n')
    .filter((l) => /^ {2}(readonly )?[a-zA-Z]+[?]?:/.test(l)).length
}

const MODEL = readdirSync(join(ROOT, 'model')).filter((f) => f.endsWith('.ts'))
const CONTRACTS = readdirSync(join(ROOT, 'docs/contracts')).filter((f) =>
  f.endsWith('.openapi.yaml'),
)
const modelLines = MODEL.flatMap((f) => read(`model/${f}`).split('\n'))

/**
 * Export totals come from the TypeScript parser, via the C4 extractor — ONE
 * DERIVATION, NOT TWO.
 *
 * 🛑 THIS FILE PREVIOUSLY LINE-SCANNED FOR THE DROP MARKER AND THE TWO
 * MECHANISMS DISAGREED IN THE SAME GREEN GATE: 198 here against 196 from
 * `docs/c4-data.json`. The scanner is preserved below in comment form because it
 * mirrored CLAUDE.md's awk exactly and the awk is still quoted in the record:
 *
 *   armed = false
 *   for each line: if it CONTAINS '@dropped-for-v1' -> armed = true
 *                  else if armed and line starts 'export ' -> count, disarm
 *                  else if armed and line is non-blank -> disarm
 *
 * ⚠️ It arms on any line CONTAINING the marker, including prose ABOUT another
 * declaration's marker — the identical false-positive class that made the C4 page
 * render seven live exports as dropped. So 198 was not a different noun; it was
 * the same noun counted with a known bug. The AST reads the declaration's own
 * leading comment range and requires the tag to open a line.
 *
 * COST, STATED: `check:counts` now depends on `typescript`. It was previously
 * zero-dependency. The package is a pinned devDependency and `npm run typecheck`
 * already runs before this in the gate, so a checkout that can run the gate at all
 * can run this — but a bare `node tools/check-doc-counts.mjs` in a tree with no
 * `node_modules` now exits 2 with the extractor's install instruction rather than
 * printing counts. That is the correct failure: a partial count that looks complete
 * is what this tool exists to prevent.
 */
const { buildC4Data } = await import('./planner/extract-c4-data.mjs')
const c4Totals = (await buildC4Data()).totals

const yamlPaths = () =>
  CONTRACTS.map(
    (f) =>
      read(`docs/contracts/${f}`)
        .split('\n')
        .filter((l) => /^ {2}\//.test(l)).length,
  ).reduce((a, b) => a + b, 0)

const yamlOperations = () =>
  CONTRACTS.map(
    (f) =>
      read(`docs/contracts/${f}`)
        .split('\n')
        .filter((l) => /^ {4}(get|post|put|patch|delete):/.test(l)).length,
  ).reduce((a, b) => a + b, 0)

/**
 * Each metric is (a) a number derived from the tree, (b) the nouns a document
 * uses when it is stating that total, and (c) a plausibility band.
 *
 * BOTH NARROWINGS EXIST BECAUSE THESE NOUNS ARE REUSED LOCALLY, and a tool that
 * cried wolf on every reuse would be turned off inside a day:
 *
 *   nouns  "fourteen foundation services" is a correct claim about F1–F14 and
 *          must not collide with the module count, so `modules` alone is not a
 *          noun — `TypeScript modules` and `model modules` are. `docs/
 *          v1-scope-ledger.md` counts exports PER MODULE ("all 51 exports"),
 *          which is why the bare word `exports` needs the band below as well.
 *
 *   band   a claim far outside the band is about something else, not a stale
 *          total: `docs/salvage-ledger.md`'s "~184 operations" describes the
 *          ARCHIVED application's API, and "128 across 6 modules" describes its
 *          CSS. The band is deliberately wide — it is there to separate a
 *          different subject from a stale total, NOT to hide drift. Drift is a
 *          few units and lands inside the band every time.
 */
const METRICS = [
  /**
   * ⚠️ THE CEILING WAS 30 AND THE TREE HELD 28 — G1472, 21 Sep 2026, AND IT IS
   * RAISED ON A MEASUREMENT RATHER THAN ON A FEELING.
   *
   * `docs/build/completion-plan.md` names this as a live hazard: TWO of
   * headroom, with a concurrent slice adding a module. **Two more `model/*.ts`
   * files and every line stating the CURRENT count falls outside the band and
   * is silently skipped, while every line carrying an OLD count stays inside it
   * and goes on being checked** — the checker going quiet about the right
   * answers and staying loud about the wrong ones. That is not a prediction;
   * it is the `contract operations` incident recorded two entries down,
   * verbatim, about to recur.
   *
   * 🛑 A WIDER BAND IS ITSELF A DEFECT IF IT SWEEPS IN A DIFFERENT SUBJECT —
   * 400 was tried for `contract operations` and was WRONG, because it reported
   * `docs/salvage-ledger.md`'s "~184 operations", a claim about the REPLACED
   * application. **So this was measured before it was changed.** With the
   * ceiling at 200 this metric reports TEN lines; with the ceiling at 30 it
   * reports the SAME TEN — every one of them a claim about our own module
   * count (13, 18, 23, 25). **Nothing foreign enters**, because the nouns here
   * are qualified: `TypeScript modules`, `model modules`, `modules under`. The
   * archived application's *"128 across 6 modules"* uses the bare word and is
   * matched by none of them.
   *
   * 60 IS ROOM FOR THE MODEL TO DOUBLE and still stops well short of that 128.
   * The band is not there to hide drift — drift is a few units and lands
   * inside any of these — it is there to separate a different subject.
   */
  { key: 'modules', derive: () => MODEL.length, band: [8, 60], nouns: ['(?:TypeScript|model) modules', 'modules under'] },
  { key: 'capabilities', derive: () => constMembers('model/access.ts', 'CAPABILITIES'), band: [20, 80], nouns: ['capabilities'] },
  { key: 'resource classes', derive: () => constMembers('model/governance.ts', 'ACCESS_RESOURCE_CLASSES'), band: [6, 30], nouns: ['resource classes'] },
  { key: 'retention classes', derive: () => constMembers('model/domain.ts', 'RETENTION_CLASSES'), band: [6, 30], nouns: ['retention classes'] },
  { key: 'policy kinds', derive: () => constMembers('model/policy.ts', 'POLICY_KINDS'), band: [4, 20], nouns: ['policy kinds'] },
  { key: 'scope dimensions', derive: () => interfaceFields('model/access.ts', 'AssignmentScope'), band: [4, 20], nouns: ['scope dimensions', 'dimensions, conjoined'] },
  /*
   * ⚠️ THE FLOOR WAS 3 AND THE TREE FELL THROUGH IT ON 18 Sep 2026, SO THIS
   *    METRIC HAD ALREADY GONE SILENT BEFORE ANYBODY NOTICED THE SAME THING
   *    HAPPEN AT THE CEILING.
   *
   * G264 deleted nine of the ten HTML visuals; `c4.html` survives alone,
   * because it is GENERATED and `check:c4` fails the gate when it drifts —
   * the property the other nine never had. So the tree has held **1** since
   * that commit, below the floor, and the band filters the CLAIMED value:
   * every line correctly saying *one visual* was skipped, while every stale
   * line saying *ten* sat inside the band and went on being checked.
   *
   * Found by `tests/tools/band-does-not-silence.test.mjs` on its first real
   * run, while it was being written for the CEILING case. The floor is the
   * same defect facing the other way, and it had been live longer.
   *
   * The floor goes to 1 rather than 0: `docs/` holding no visual at all is a
   * different claim, and `nouns: ['visuals']` is specific enough that a bare
   * `1` beside that word is about this and not about something else.
   *
   * 🛑 **AND THE FLOOR WENT TO 0 ON 21 Sep 2026 — G1771, K5's HALF OF G1480 —
   *    BECAUSE THE PARAGRAPH ABOVE IS THE ONE CLAUSE OF THIS BLOCK THAT DOES
   *    NOT HOLD.** It is kept whole rather than deleted, because it is the
   *    argument a reader would otherwise re-make.
   *
   * **`docs/` holding no visual at all is a different CLAIM about the SAME
   * SUBJECT, and a staleness checker exists for exactly that.** ZERO is a
   * reachable value of this metric — G264 deleted NINE visuals in one commit —
   * so a floor of 1 excludes a value the metric's own subject can take.
   * **A band separates a FOREIGN subject from a stale total; it is not a
   * minimum, and there is no other product here whose visual count is
   * discussed.**
   *
   * 🛑 **THE SILENCE WAS LIVE, NOT PROSPECTIVE, AND IT WAS WITNESSED.** With
   * the floor at 1, a line added to `docs/INDEX.md` reading *"The repository
   * ships 0 visuals."* — WRONG, the tree holds 1 — was **not reported at all
   * and the run was EXIT 0**, while lines on the same metric saying 2, 9 and 10
   * were reported. The checker was loud about three wrong numbers and silent
   * about a fourth, purely because the fourth was below the floor. At `[0, 30]`
   * the identical line is `STALE — docs/INDEX.md: visuals: says 0, tree says 1`,
   * EXIT 1.
   *
   * ⚠️ **MEASURED BEFORE IT WAS CHANGED, WHICH IS THE CHECK 400 FAILED FOR
   * `contract operations`:** at a floor of 1 this metric reports SEVEN lines,
   * and at a floor of 0 it reports **the same seven** — `README.md` twice
   * (10), `docs/HANDOFF.md` twice (10, 7), `docs/INDEX.md` three times (2, 9,
   * 2). **Nothing foreign enters**, because every one is a claim about our own
   * `docs/` directory.
   *
   * ⚠️ **AND WHAT THIS DOES NOT BUY, STATED SO NOBODY OVERSTATES IT:
   * `tests/tools/band-does-not-silence.test.mjs` ALREADY made the crossing a
   * red gate** — deleting `c4.html` with the floor at 1 fails that test rather
   * than passing quietly. `docs/build/completion-plan.md` §6's G1480 row reads
   * *"every stated visual count in the repository goes silently unchecked"*,
   * and that overstates it: the gate would have been RED, and somebody would
   * have lowered the floor in a hurry. **What is bought is the live blind spot
   * above, and the removal of a pre-emptive red on a legitimate deletion.**
   */
  { key: 'visuals', derive: () => lsCount('docs', '.html'), band: [0, 30], nouns: ['visuals'] },
  { key: 'exports', derive: () => c4Totals.exports, band: [300, 2000], nouns: ['exports?\\b', 'export declarations'] },
  { key: 'dropped exports', derive: () => c4Totals.droppedExports, band: [100, 600], nouns: ['(?:top-level )?exports carry', 'top-level exports'] },
  // Band floor is 100 because documents legitimately state PER-MODULE marker
  // counts and the heaviest single module is `presentation.ts` at 52. A floor
  // above every possible per-module value separates "this module" from "the
  // tree" without hiding drift on the total, which is 228.
  { key: 'dropped markers', derive: () => modelLines.join('\n').split('@dropped-for-v1').length - 1, band: [100, 900], nouns: ['markers'] },
  /*
   * 🛑 THE BAND WAS [40, 120] AND THE TREE WALKED OUT OF THE TOP OF IT, WHICH
   *    MADE THIS CONTROL SILENT FOR EXACTLY THE NUMBERS THAT WERE CURRENT.
   *
   * G288's `administration.openapi.yaml` took the totals to 135 operations
   * across 124 paths. The band filters the CLAIMED value (`claimed < band[0]
   * || claimed > band[1]` → `continue`), so from that commit every document
   * line stating either CURRENT total was skipped rather than checked, while
   * lines carrying the old, WRONG figures stayed inside the band and went on
   * being checked. A staleness checker that stops seeing a number the moment
   * the number becomes right is `docs/HANDOFF.md` §5.6 — and it is §5 as well,
   * a rule keyed on a convenient landmark (a range someone guessed) instead of
   * the property it protects.
   *
   * ⚠️ IT WAS FOUND BY THE COMMIT THAT CAUSED IT AND IS FIXED IN THE ONE THAT
   *    MERGED IT, rather than left as owed. The band's purpose is unchanged and
   * is stated above: separate a claim ABOUT SOMETHING ELSE from a stale claim
   * about this. 400 is not a prediction of the contract's size — it is a
   * ceiling far enough above the tree that a wrong number is caught long
   * before the band silences it again, and `tests/tools/` asserts the tree
   * sits inside every band so the next crossing is a red gate rather than a
   * quiet one.
   *
   * 🛑 AND 400 WAS TRIED FIRST AND IS WRONG, WHICH IS WORTH RECORDING BECAUSE
   *    THE OBVIOUS FIX FOR A TOO-NARROW BAND IS A VERY WIDE ONE. At 400 this
   * checker immediately reported `docs/salvage-ledger.md:78` STALE — *"~184
   * operations encode real business behaviour"* — which is a claim about the
   * REPLACED SAP-line application at `archive/sap-line`, not about this
   * contract. That is exactly the case the band exists to exclude, stated at
   * the top of this block: *"a claim far outside the band is about something
   * else, not a stale claim."* A band wide enough never to go silent is a band
   * that reports a different codebase's numbers as our stale ones.
   *
   * **So the band stays TIGHT and the TEST carries the guarantee.** 160 is
   * above the tree's 135 with room for the next tier, and below the 184 that
   * belongs to another product. `tests/tools/band-does-not-silence.test.mjs`
   * turns the next crossing into a RED GATE, so this number is raised by
   * somebody reading this paragraph and never outgrown by accident.
   */
  { key: 'contract operations', derive: yamlOperations, band: [40, 160], nouns: ['operations'] },
  { key: 'contract paths', derive: yamlPaths, band: [40, 160], nouns: ['paths'] },
  { key: 'error codes', derive: () => read('docs/contracts/errors.yaml').split('\n').slice(68).filter((l) => /^ {8}- /.test(l)).length, band: [40, 200], nouns: ['codes'] },
  { key: 'invariants', derive: () => read('CLAUDE.md').split('\n').filter((l) => /^[0-9]+\. \*\*/.test(l)).length, band: [8, 20], nouns: ['invariants'] },
  /**
   * G1471 — the gate's own two numbers, governed for the first time.
   *
   * ⚠️ THE NOUNS ARE NARROW BECAUSE BOTH WORDS ARE REUSED LOCALLY. `stages` is
   * qualified — a `Pipeline` has stages too, and `docs/tech-stack.md` counts
   * them — so only the forms that say WHICH stages are matched. `checkers` is
   * the bare word because nothing else here is called one.
   *
   * ⚠️ AND THE BANDS ARE WIDE ENOUGH TO OUTLAST THE TREE'S GROWTH BUT NOT SO
   * WIDE THEY SWEEP IN A DIFFERENT SUBJECT, which is the rule stated at the
   * head of this array and the mistake the `contract operations` note records.
   * `tests/tools/band-does-not-silence.test.mjs` makes the next crossing a red
   * gate rather than another silent one.
   */
  { key: 'gate stages', derive: gateStages, band: [5, 40], nouns: ['(?:gate )?stages of', 'stages\\b(?= *(?:—|-|·|\\.|,|$))', 'gate stages'] },
  { key: 'checkers', derive: checkerScripts, band: [3, 30], nouns: ['checkers'] },
]

/* --- English number words, because that is how these documents write ----- */

const UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
}
const TENS = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
}
const WORD = new RegExp(
  `\\b(?:${Object.keys(TENS).join('|')})(?:-(?:${Object.keys(UNITS)
    .slice(1, 10)
    .join('|')}))?\\b|\\b(?:${Object.keys(UNITS).join('|')})\\b`,
  'i',
)

function toNumber(token) {
  const t = token.toLowerCase()
  if (/^\d+$/.test(t)) return Number(t)
  if (t in UNITS) return UNITS[t]
  const [tens, unit] = t.split('-')
  if (tens in TENS) return TENS[tens] + (unit ? UNITS[unit] || 0 : 0)
  return null
}

/** The word form of a number, so "thirty-six" counts as stating 36. */
function toWords(n) {
  if (n < 20) return Object.keys(UNITS).find((k) => UNITS[k] === n) ?? null
  const tens = Math.floor(n / 10) * 10
  const unit = n % 10
  const tensWord = Object.keys(TENS).find((k) => TENS[k] === tens)
  if (!tensWord) return null
  if (!unit) return tensWord
  return `${tensWord}-${Object.keys(UNITS).find((k) => UNITS[k] === unit)}`
}

/* --- Is a disagreeing line narrating history on purpose? ----------------- */

/**
 * The one guessing part of this tool. These documents narrate their own
 * corrections deliberately — `docs/HANDOFF.md` §6, "Corrections left visible" —
 * so a line that disagrees with the tree is often correct as written. Two cues
 * say so: the text also states the CURRENT value (in digits or in words), or it
 * carries a retrospective verb.
 *
 * The cue is looked for in a ONE-LINE WINDOW either side, not on the matched
 * line alone, because this is hard-wrapped markdown prose and the sentence that
 * says "…both stale" routinely lands on the next line from the number.
 */
const RETROSPECTIVE =
  /\b(until|previously|used to|said|says|read|was|were|then|stale|already|before|since|no longer|corrected|correction|conflating|wrong|had|up from|down from)\b|→|~~/i

function classify(window, derivedValue) {
  const words = toWords(derivedValue)
  if (new RegExp(`\\b${derivedValue}\\b`).test(window)) return 'HISTORICAL'
  if (words && new RegExp(`\\b${words}\\b`, 'i').test(window)) return 'HISTORICAL'
  if (RETROSPECTIVE.test(window)) return 'HISTORICAL'
  return 'STALE'
}

/* --- Scan ---------------------------------------------------------------- */

const TARGETS = [
  'CLAUDE.md',
  'PRODUCT.md',
  'README.md',
  ...readdirSync(join(ROOT, 'docs'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => `docs/${f}`),
  'docs/contracts/README.md',
]

const derived = new Map(METRICS.map((m) => [m.key, m.derive()]))

if (process.argv.includes('--derive')) {
  for (const [k, v] of derived) console.log(`${String(v).padStart(5)}  ${k}`)
  process.exit(0)
}

const findings = []

/* THE DENOMINATOR — G1478. Asserted below; see the block above the guard. */
let documentsRead = 0

for (const file of TARGETS) {
  let src
  try {
    src = read(file)
  } catch {
    continue
  }
  documentsRead += 1
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    const window = lines.slice(Math.max(0, i - 1), i + 2).join(' ')
    for (const m of METRICS) {
      for (const noun of m.nouns) {
        // A number, optionally wrapped in markdown emphasis, immediately before
        // the noun. Anchored tight on purpose: a looser window matches a number
        // from a neighbouring clause and reports a defect that is not there.
        const re = new RegExp(
          `(?:\\*\\*|\`|~~)?(${WORD.source}|\\d+)(?:\\*\\*|\`|~~)?\\s+(?:\\*\\*)?(?:${noun})`,
          'i',
        )
        const hit = re.exec(line)
        if (!hit) continue
        const claimed = toNumber(hit[1])
        const want = derived.get(m.key)
        if (claimed === null || claimed === want) continue
        if (claimed < m.band[0] || claimed > m.band[1]) continue
        if (findings.some((f) => f.file === file && f.line === i + 1 && f.metric === m.key)) continue
        findings.push({
          file,
          line: i + 1,
          metric: m.key,
          claimed,
          want,
          verdict: classify(window, want),
          text: line.trim().slice(0, 150),
        })
      }
    }
  })
}

const stale = findings.filter((f) => f.verdict === 'STALE')
const historical = findings.filter((f) => f.verdict === 'HISTORICAL')

/**
 * THE DENOMINATOR AND A TRIPWIRE — G1478, AND THIS ONE IS DELIBERATELY NOT
 * CLAIMED AS A FIXED DEFECT, BECAUSE MEASURING IT FOUND THE OPPOSITE.
 *
 * `docs/build/completion-plan.md` K4 names six checkers that pass over an
 * empty subject. FIVE of them did, and each was witnessed printing success at
 * EXIT 0 over nothing (`check-migration-numbers`, `check-c4-freshness`,
 * `check-g-numbers`, `check-citations`, `check-wire-mirror`). **This one does
 * NOT, and the attempt to witness its red is what established that.** Measured
 * in a sandbox, three ways:
 *
 *   · empty `model/`      → `ENOENT … model/access.ts`, EXIT 1
 *   · empty `CLAUDE.md`   → `ENOENT … CLAUDE.md` from the `invariants` metric
 *   · present-but-empty   → `Error: CAPABILITIES not found in model/access.ts`
 *     model files            from `constMembers`, EXIT 1
 *
 * **Its derivations THROW rather than returning `0`**, so a broken subject is
 * already a loud red. That is worth writing down rather than quietly adding a
 * guard on top of it and reporting a sixth fix: the difference between a
 * checker that fails closed and one that reports success over nothing is the
 * whole of K4, and this file was on the right side of it all along.
 *
 * WHAT IS ADDED IS THE NUMBER ITSELF — `Scanned N document(s) for M governed
 * total(s)` — because K4's other half is that a denominator must be VISIBLE.
 * Every one of the five above printed enough to look convincing and none of
 * them printed how much it had read.
 *
 * 🛑 AND THE GUARD BELOW IS A TRIPWIRE WHOSE BOTH ARMS ARE UNREACHABLE TODAY,
 * WHICH IS SAID HERE SO NOBODY READS IT AS A LIVE CONTROL OR DELETES IT AS
 * DEAD CODE. `documentsRead === 0` cannot fire while the `invariants` metric
 * derives from `CLAUDE.md`, which is also `TARGETS[0]` — the derivation throws
 * first, on the same `read()`. `allDerivedZero` cannot fire while
 * `constMembers` throws on an absent const. **Both become reachable the moment
 * either of those changes**: a metric that stops reading a scanned file, or a
 * derivation rewritten to return `0` instead of throwing. Each is a plausible
 * tidy-up and neither would look like a regression, which is exactly the shape
 * `docs/HANDOFF.md` §5.6 catalogues.
 *
 * ⚠️ IT IS NOT A BAND AND MUST NOT BECOME ONE. It asks whether the subject
 * EXISTS. This file already carries, at length, what a guessed threshold costs
 * when the tree outgrows it — see the `contract operations` note — and a floor
 * here would be a second instance of exactly that.
 */
const allDerivedZero = [...derived.values()].every((v) => v === 0)
if (documentsRead === 0 || allDerivedZero) {
  if (documentsRead === 0) {
    console.log('NO DOCUMENTS READ — every comparison below would be vacuous.')
    console.log('  A stale count cannot be found in a corpus nobody opened, and this tool has')
    console.log('  been EXIT 0 over an unscanned directory three times by CLAUDE.md’s own tally.')
  }
  if (allDerivedZero) {
    console.log('EVERY DERIVED TOTAL IS ZERO — the tree readers are broken, not the tree.')
    console.log('  Every stated count would be compared against 0 and filtered out by its own')
    console.log('  plausibility band, so the run would be green having checked nothing.')
  }
  console.log('  Fix the derivation; do not delete the assertion.')
  process.exit(1)
}

console.log(`Scanned ${documentsRead} document(s) for ${derived.size} governed total(s).`)
console.log('Derived from the tree:')
for (const [k, v] of derived) console.log(`  ${String(v).padStart(5)}  ${k}`)

/**
 * HEADROOM, PRINTED — G1472, AND IT IS A READING RATHER THAN A CONTROL.
 *
 * `tests/tools/band-does-not-silence.test.mjs` makes the CROSSING a red gate,
 * and that is the right place for the assertion. What it cannot do is warn
 * BEFORE the crossing — it goes red in whichever slice happens to add the
 * module, which is somebody else's commit and somebody else's problem to
 * understand. `modules` sat at 28 against a ceiling of 30 for days with
 * nothing anywhere saying so, which is how `docs/build/completion-plan.md`
 * came to name it as a live hazard rather than a closed one.
 *
 * ⚠️ IT DOES NOT FAIL AND MUST NOT. A threshold on *nearness to a threshold*
 * is a second guessed number stacked on the first, and the argument against
 * guessing one is the whole of the band commentary above. This prints; the
 * test refuses.
 */
const NEAR = 3
const tight = []
for (const m of METRICS) {
  const value = derived.get(m.key)
  const [lo, hi] = m.band
  if (hi - value <= NEAR) tight.push(`${m.key}: ${value}, ceiling ${hi} — ${hi - value} of headroom`)
  /**
   * 🛑 **A FLOOR OF 0 IS NOT A FLOOR AND MUST NOT BE REPORTED AS HEADROOM —
   * G1772, 21 Sep 2026.** Every derivation here counts things, so no metric can
   * take a value below zero: there is no crossing to warn about, and `visuals:
   * 1, floor 0 — 1 of headroom` is a warning about an event that cannot occur.
   *
   * ⚠️ **IT IS NOT COSMETIC.** This reading exists to be ACTED ON, and G95's
   * argument applies to it exactly — *"a red X on a repository containing no
   * application teaches people to ignore CI"*. A permanent, unactionable line
   * in a block headed *"raise the band DELIBERATELY"* teaches a reader to skim
   * the block, and the next line in it will be a real one.
   *
   * ⚠️ **MEASURED RATHER THAN REASONED**: with `visuals` moved to `[0, 30]` and
   * this condition absent, the run still printed `visuals: 1, floor 0 — 1 of
   * headroom` — the metric this whole change was made for, still reported as at
   * risk, by a reading that had stopped being true.
   */
  else if (lo > 0 && value - lo <= NEAR) tight.push(`${m.key}: ${value}, floor ${lo} — ${value - lo} of headroom`)
}
if (tight.length > 0) {
  console.log('')
  console.log(`⚠️  ${tight.length} derived total(s) within ${NEAR} of a plausibility band edge:`)
  for (const row of tight) console.log(`     ${row}`)
  console.log('     At the edge, every line stating the CURRENT value is filtered out and every')
  console.log('     line carrying an OLD one keeps being checked. Raise the band DELIBERATELY in')
  console.log('     this file and say what a wider one would sweep in — 400 was tried once and')
  console.log('     reported the REPLACED application’s figures as ours.')
}

const show = (rows, heading) => {
  if (!rows.length) return
  console.log(`\n${heading}`)
  for (const f of rows) {
    console.log(`  ${f.file}:${f.line}  ${f.metric}: says ${f.claimed}, tree says ${f.want}`)
    console.log(`      ${f.text}`)
  }
}

show(stale, `STALE — ${stale.length} line(s) disagree with the tree and read as current:`)
show(
  historical,
  `HISTORICAL — ${historical.length} line(s) disagree but narrate a correction. Read, do not bulk-edit:`,
)

if (!findings.length) console.log('\nNo document states a count that disagrees with the tree.')

console.log(
  `\n⚠️ This tool checks NUMBERS ONLY. It cannot see a stale claim with no number in it, ` +
    `a wrong file:line citation, a drop note on the wrong declaration, or a contract enum that has ` +
    `drifted from the model. Its silence is not evidence of absence — docs/HANDOFF.md §7.`,
)

/**
 * 🛑 SET THE CODE; DO NOT CALL `process.exit()`. THIS LINE READ
 * `process.exit(stale.length ? 1 : 0)` UNTIL 17 Aug 2026.
 *
 * Same defect as `tools/check-citations.mjs`, which was fixed on the same day
 * and carries the long version of the reasoning at its own last statement.
 * Short form: `process.exit()` terminates immediately, and when stdout is a
 * PIPE — under `npm run`, under `spawnSync`, under a CI log collector — the
 * writes `console.log` has made may still be queued in userspace. Exiting
 * discards whatever has not reached the kernel. Nothing warns. The exit CODE is
 * unaffected, so the gate still goes red on a STALE line; only the reading
 * matter is lost, and it is lost from the END, which here is the derived
 * totals' STALE and HISTORICAL lists and the ⚠️ caveat above.
 *
 * MEASURED on the fix's own branch, macOS/node v26, reader stalled 700 ms:
 * `process.exit()` delivers at most 65,520 bytes down a pipe and silently drops
 * the rest; `process.exitCode` delivered 200,000 of 200,000. THIS REPORT IS
 * 10,960 BYTES ON TRUNK TODAY, so on that platform it currently fits and the
 * change is preventive — but the citations checker was 39,074 characters and
 * lost 17,755 of them on Linux CI, and this report grows one entry per stale
 * count. A margin is not a control.
 *
 * `process.exitCode` records the verdict and lets the loop drain, which flushes
 * stdout first. This is the last statement in the file, so the two forms are
 * otherwise identical. The control that catches a reintroduced `process.exit()`
 * is the completeness assertion in `tests/tools/checker-report-flush.test.ts`,
 * not this comment.
 */
process.exitCode = stale.length ? 1 : 0

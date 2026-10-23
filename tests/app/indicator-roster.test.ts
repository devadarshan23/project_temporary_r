/**
 * THE SIX INDICATORS — the roster, the two refusals, and the connection light's
 * subject.
 *
 * 🛑 WHAT THIS FILE IS FOR, IN ONE SENTENCE: **the six indicators are the one
 * part of the drawn vocabulary a component library can silently grow**, and R5
 * makes their count load-bearing — *"Six indicators. A seventh is a design
 * change. Not an addition, and not a thing one specimen may mint on its own."*
 * (`docs/handoff-pack/Design System.dc.html`, Rules in force). Every other primitive is a
 * screen somebody has to draw; an indicator is four lines in a `.tsx` file.
 *
 * ┌─ WITNESSED RED, AND AGAINST PLAUSIBLE IMPLEMENTATIONS ────────────────────┐
 * │ Every behavioural assertion below was run against a DELIBERATELY DEFECTIVE │
 * │ tree before it was pointed at the real one — the posture                   │
 * │ `tests/design/frontend-bridge.test.ts` records in its own header, because  │
 * │ a red that fires on a missing module is red against a typo. The planted    │
 * │ defects and the failures they produced are named on each assertion.        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THE ROSTER IS A `.ts` FILE AND THE COMPONENTS ARE `.tsx`, AND THAT SPLIT IS
 * WHY THIS SUITE CAN EXIST AT ALL. `node --test` strips TypeScript types and
 * does NOT transform JSX — `tests/design/render.ts` records a first draft dying
 * on exactly that, *"the whole suite therefore failed with `Unknown file
 * extension \".tsx\"` no matter what the components did."* So every rule that
 * has to be WITNESSED lives in `frontend/src/components/indicators.ts`, and the
 * components are thin enough that a green run here is a statement about them.
 *
 * ⚠️ THE RENDERED HALF IS READ OFF THE BUILT PAGES, NEVER OFF THE SOURCE.
 * `npm run check` runs `build:frontend` before `npm test`, so
 * `frontend/dist/{specimen,shell}.html` are the artefacts that SHIP. When they
 * are absent the assertion fails naming the property it could not witness,
 * which is the shape every suite in `tests/design/` already uses.
 */

import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { browserSkip, closeBrowser, renderFile, REPO } from '../design/render.ts'
import { browserRequiredUnderCi } from '../reachability.ts'

import {
  GRAMMAR_MARKS,
  INDICATOR_FORM,
  INDICATORS,
  MARK_CLASS,
  meterScale,
  statedFact,
  type Indicator,
} from '../../frontend/src/components/indicators.ts'

const skip = await browserSkip()

browserRequiredUnderCi('the indicator rendering assertions', skip)

after(async () => { await closeBrowser() })

/** Nothing to prepare, for the assertions that add no markup. */
const NOTHING = (): void => {}

const FRONTEND_SRC = join(REPO, 'frontend', 'src')
const SPECIMEN = join(REPO, 'frontend', 'dist', 'specimen.html')
const SHELL = join(REPO, 'frontend', 'dist', 'shell.html')

/** A built page, or a SENTENCE naming the property that went unwitnessed. */
function built(path: string, property: string): string | { missing: string } {
  if (existsSync(path)) return path
  return { missing:
    `${property} is UNWITNESSED: no built page at ${path}. Run \`npm run ` +
    'build:frontend\` — `npm run check` runs it before `npm test` for exactly this ' +
    'reason. Until the page exists the property is neither held nor refuted.' }
}

/** Every `.ts`/`.tsx` file under `frontend/src`, path and contents. */
function frontendSources(): readonly { readonly path: string; readonly text: string }[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = join(dir, e.name)
      if (e.isDirectory()) return walk(full)
      return e.name.endsWith('.ts') || e.name.endsWith('.tsx') ? [full] : []
    })
  return walk(FRONTEND_SRC).map((path) => ({ path, text: readFileSync(path, 'utf8') }))
}

// ──────────────────────────────────────────────────────────────────────────
describe('1 · the count is six, and it is the drawing\'s six', () => {
  /**
   * The six as the DRAWING names them, extracted from the six `<div class="ind">`
   * blocks in `docs/handoff-pack/Design System.dc.html`.
   *
   * ⚠️ IT READS THE DRAWN FILE RATHER THAN A LIST WRITTEN HERE, WHICH IS THE
   * WHOLE VALUE OF THE ASSERTION. A list restated in this file would agree with
   * the roster forever and with the design record never — two authorities for
   * one number, which is the defect the acceptance criterion names by hand.
   * `grep -c '<div class="ind">' docs/handoff-pack/Design System.dc.html` → 6.
   */
  const drawn = (): readonly string[] => {
    const html = readFileSync(join(REPO, 'docs', 'handoff-pack', 'Design System.dc.html'), 'utf8')
    return [...html.matchAll(/<div class="ind">[\s\S]*?<span class="nm">([^<]*)<\/span>/g)]
      .map((m) => (m[1] ?? '').trim())
  }

  it('R5 — the roster holds exactly six, no more and no fewer', () => {
    /* WITNESSED RED by adding a seventh key `progress: 'Progress'` to
       `INDICATORS`: this assertion failed `7 !== 6` with the message below, and
       `INDICATOR_FORM` simultaneously failed to compile (TS2739). */
    assert.equal(
      Object.keys(INDICATORS).length,
      6,
      'R5: "Six indicators. A seventh is a design change. Not an addition, and not a ' +
        'thing one specimen may mint on its own." A component library is precisely the ' +
        'place where a seventh gets minted by one person on one afternoon, which is why ' +
        'the count is mechanised here rather than written down in a specimen. If a ' +
        'seventh is genuinely wanted, it is a design change: it goes into ' +
        'docs/handoff-pack/Design System.dc.html first, with its own form, and R5 is amended by a ' +
        'ruling in docs/HANDOFF.md §3.',
    )
  })

  it('THE SET IS COMPARED BY NAME AGAINST THE DRAWING, NOT ONLY BY COUNT', () => {
    /* 🛑 THIS IS THE ASSERTION THE COUNT CANNOT REPLACE, AND CLAUDE.md RECORDS
       WHY BY EXAMPLE: two branches once both said THIRTY-EIGHT capabilities and
       the two thirty-eights were not the same SET — "the number agreed and the
       sets did not." A roster that swapped `hedge` for `progress` keeps the
       count at six and breaks the vocabulary.
       WITNESSED RED by renaming `INDICATORS.elsewhere` to `'Spinner means
       loading'`: failed naming that member as absent from the drawing. */
    const six = drawn()
    assert.equal(six.length, 6,
      `expected six <div class="ind"> blocks in docs/handoff-pack/Design System.dc.html and found ` +
      `${six.length}. The drawing is the authority for the set; if it moved, this ` +
      'roster is what must follow it, not the other way round.')
    assert.deepEqual(
      [...Object.values(INDICATORS)].sort(),
      [...six].sort(),
      'the roster and the drawing name different indicators. The count is not the ' +
        'control — a substitution keeps the count at six and changes the vocabulary, ' +
        'and it is the failure CLAUDE.md records a merge producing on the capability ' +
        'roster: the number agreed and the sets did not.',
    )
  })

  it('TWO ARE MARKS AND FOUR ARE GRAMMAR, and only the marks are painted', () => {
    /* The kernel paints `.meter` and `.conn` and nothing else in the six —
       "the other four indicators are grammar and carry no CSS at all." A
       grammar indicator that acquired a stylesheet would be a third MARK
       arriving without anybody minting one.
       WITNESSED RED by setting `hedge.shape` to `'mark'`: failed 3/3. */
    const shapes = Object.values(INDICATOR_FORM).map((f) => f.shape)
    assert.equal(shapes.filter((s) => s === 'mark').length, 2,
      'the drawing declares exactly two MARKS — "Mark one" the meter and "Mark two" ' +
      'the connection light — and they are the only two the kernel paints.')
    assert.equal(shapes.filter((s) => s === 'grammar').length, 4,
      'the drawing declares exactly four GRAMMAR indicators.')

    const kernel = readFileSync(join(REPO, 'docs', 'handoff-pack', 'tokens.css'), 'utf8')
    for (const mark of GRAMMAR_MARKS) {
      assert.equal(kernel.includes(`content:"${mark}"`), false,
        `the kernel paints the grammar mark \`${mark}\`. Grammar carries no CSS; a ` +
        'grammar indicator with a stylesheet has become a third mark under the name of ' +
        'a fourth grammar rule, and the count is six by R5 whatever the file is called.')
    }
  })

  it('THE ROSTER IS TOTAL — every indicator has a form', () => {
    /* The `CAPABILITY_RESOURCE_CLASS` shape applied to the view: `INDICATOR_FORM`
       is a `Record<Indicator, IndicatorForm>`, so an unclassified indicator is a
       COMPILE error. This assertion witnesses the runtime half — the compile
       half cannot be asserted from inside a passing program.
       WITNESSED RED by deleting the `stated` entry from INDICATOR_FORM: `tsc`
       failed with TS2741 and this assertion failed naming `stated`. */
    for (const key of Object.keys(INDICATORS) as Indicator[]) {
      assert.ok(key in INDICATOR_FORM,
        `\`${key}\` is in the roster and has no form. The Record is total over ` +
        'Indicator so this is normally a compile error (TS2741); reaching it at run ' +
        'time means the type was widened or an assertion was reached for.')
    }
  })

  it('🛑 ONE ROSTER, ONE AUTHORITY — exactly one declaration site', () => {
    /* #244 [F-17]'s assertion 5 already asserts the count is still six after
       that slice. Two independent six-assertions are two authorities for one
       number, and they diverge the first time one of them is edited.
       WITNESSED RED by adding `const INDICATORS = [...]` to Specimen.tsx:
       failed listing both files. */
    const declaring = frontendSources()
      .filter((f) => /(?:const|let|var|enum|interface|type)\s+INDICATORS\b/.test(f.text))
      .map((f) => f.path)
    assert.deepEqual(declaring, [join(FRONTEND_SRC, 'components', 'indicators.ts')],
      `INDICATORS is declared in ${declaring.length} places: ${JSON.stringify(declaring)}. ` +
      'The count of indicators is load-bearing and it may have exactly one home — a ' +
      'second roster is a second authority for one number, and the two agree only until ' +
      'somebody edits one of them.')
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('2 · the meter refuses rather than degrades', () => {
  /**
   * 🛑 R6 IS THE RULE: *"the agent hue means the machine measured something, and
   * nothing else. Not matched, good, passed or safe."* An unmeasured meter is
   * not a degraded meter — it is the hue making a claim nothing produced. G139's
   * posture, adopted deliberately: *"an unset bound refuses the run … It is
   * never silently unbounded, which is the outcome a default would produce."*
   *
   * ⚠️ THIS IS THE SECOND FENCE AND THE FIRST IS STRONGER, WHICH IS WHY THE
   * COMPONENT'S PROPS WERE NOT LOOSENED TO GET A THROW OUT OF THEM.
   * `MeterProps.score` and `.floor` are REQUIRED `number`s, so a caller holding
   * `Provenance.confidence` — `number | null`,
   * `grep -n 'confidence: number | null' model/domain.ts` — cannot construct the
   * component without answering the null arm. That is a compile error. The throw
   * exists because the null arm is LIVE in the meter's one legitimate source and
   * because a value parsed from JSON at a boundary passes no compiler at all.
   */

  it('POSITIVE CONTROL — a real measurement produces the kernel\'s two properties', () => {
    /* Without this, every refusal below would pass against a function that
       throws unconditionally — §5.6, a control that passes while asserting
       nothing. */
    assert.deepEqual(meterScale(0.91, 0.6), { '--score': '91%', '--floor': '60%' })
  })

  it('an absent score is REFUSED, and the refusal is a throw rather than a fallback bar', () => {
    /* WITNESSED RED against a `meterScale` that returned `{'--score':'0%'}` for
       a non-finite input — a plausible implementation, and the one a person
       reaches for: it failed here and rendered an empty bar on the specimen,
       which is the fabricated measurement the rule forbids. */
    for (const absent of [Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => meterScale(absent, 0.6), /THE METER REFUSES TO RENDER/,
        `meterScale(${String(absent)}, 0.6) did not throw. An unmeasured meter is R6's ` +
        'violation, not a degraded state: a fallback bar is a figure nobody can source, ' +
        'which is MG12 in design/routes/index.html.')
    }
    assert.throws(() => meterScale(0.9, Number.NaN), /THE METER REFUSES TO RENDER/,
      'a meter with a score and no floor was accepted. The tick is the floor the score ' +
      'had to clear and it is what makes the line self-explaining without a legend; ' +
      'without it the line is a bar with a number beside it.')
  })

  it('a score outside 0–1 is REFUSED, because the kernel would draw it as a full bar', () => {
    /* The fill is painted at `width: var(--score)`. A score of 4 renders a
       complete bar silently — a fabricated measurement rather than a broken one,
       which is strictly the worse failure.
       WITNESSED RED against a range-free implementation: `meterScale(4, 0.6)`
       returned `--score: 400%`. */
    for (const [score, floor] of [[4, 0.6], [-0.1, 0.6], [0.9, 2]] as const) {
      assert.throws(() => meterScale(score, floor), /not a measurement in 0–1/,
        `meterScale(${score}, ${floor}) was accepted.`)
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('3 · past tense states a fact', () => {
  /**
   * *"The tense carries the certainty. **'Completed at 03:12'** is a fact with a
   * time on it; 'completing' would be a claim about now that the page cannot
   * make."* — `docs/handoff-pack/Design System.dc.html`, Grammar two.
   */

  it('POSITIVE CONTROL — a past-tense verb with a time is a fact', () => {
    assert.deepEqual(statedFact('completed', '03:12'), { verb: 'completed', at: '03:12' })
  })

  it('a present participle is REFUSED — the page cannot make a claim about now', () => {
    /* 🛑 THIS IS THE SUBSTITUTION A PERSON MAKES WHILE REACHING FOR A PROGRESS
       WORD THE SYSTEM DOES NOT HAVE. A progress bar is a second line (R3) and
       there is not one anywhere in the bundle, so `reading`, `matching` and
       `completing` are each one keystroke from correct and each is the failure.
       WITNESSED RED against a `Stated` that took a single `fact: string` prop —
       a plausible and simpler API, and one with nothing exact to check. */
    for (const claim of ['completing', 'reading', 'Matching']) {
      assert.throws(() => statedFact(claim, '03:12'), /A CLAIM ABOUT NOW/,
        `\`${claim}\` was accepted as past tense.`)
    }
  })

  it('a verb with no time on it is REFUSED — the time is what makes it a fact', () => {
    assert.throws(() => statedFact('completed', '   '), /HAS NO TIME ON IT/,
      'a tenseless claim wearing the past tense was accepted. The prop is required at ' +
      'the type level; an empty string is the one way past a required prop.')
  })

  it('THE CHECK IS ON THE VERB AND NOT ON FREE PROSE', () => {
    /* A rule that scanned a whole sentence for `-ing` would reject "completed
       the matching run" — a rule keyed on a convenient landmark instead of the
       property it protects, which docs/HANDOFF.md §5 catalogues as this
       codebase's most common defect. The verb is a separate prop so the check
       has something exact to look at. */
    assert.deepEqual(
      statedFact('completed', '03:12 · the matching run'),
      { verb: 'completed', at: '03:12 · the matching run' },
    )
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('4 · the grammar characters have one home', () => {
  it('the three characters are declared once and read out of the roster', () => {
    assert.deepEqual([...GRAMMAR_MARKS].sort(), ['~', '›', '…'].sort(),
      'the grammar marks drifted from the drawing: tilde hedges a forecast, chevron ' +
      'means your move, ellipsis means elsewhere. Past tense has no character because ' +
      'THE TENSE IS THE MARK.')
  })

  it('🛑 NO COMPONENT SPELLS ONE — a typed character is what these replace', () => {
    /* *"A figure the system is guessing at wears the hedge. Nothing else does,
       so a number without one is a number somebody can rely on."* A rule of
       that shape survives exactly as long as the characters have one home.
       WITNESSED RED by typing `…` into a `<span>` in Specimen.tsx: failed
       naming that file and that character.
       ⚠️ COMMENTS ARE EXCLUDED, AND THEY HAVE TO BE — six files in this tree
       discuss `title="…"` in prose, and a rule that counted those would be
       red against the documentation of the rule itself. */
    const offenders: string[] = []
    for (const { path, text } of frontendSources()) {
      if (path.endsWith(join('components', 'indicators.ts'))) continue
      const code = text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^[ \t]*\/\/.*$/gm, '')
      for (const mark of GRAMMAR_MARKS) {
        if (code.includes(mark)) offenders.push(`${path} spells \`${mark}\``)
      }
    }
    assert.deepEqual(offenders, [],
      `a grammar character is typed into a component: ${JSON.stringify(offenders)}. ` +
      'The four grammar indicators are COMPONENTS rather than typed characters, which ' +
      'is what makes "a number without one is a number somebody can rely on" checkable ' +
      'rather than merely written down. Use <Hedge>, <YourMove> or <Elsewhere> from ' +
      'frontend/src/components/Grammar.tsx.')
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('5 · G216 — the connection light reports the ERP, and nothing knows the ERP', () => {
  /**
   * 🛑 THE RULING, QUOTED: *"A light that is truthful about the wrong subject is
   * worse than a hatch"* — because a hatch tells the reader nothing is known and
   * the substitution told them something false was known, in the one component
   * whose entire purpose is to report reachability.
   *
   * ⚠️ NOTHING IN `tests/design/` ASSERTS THE LIGHT'S SUBJECT — only its
   * rendering — WHICH IS WHY THE SUBSTITUTION PASSED THE GATE. G216's own
   * applied column says so. These are the assertions that were missing.
   */

  it('no component binds the light to a load phase, a fetch or a plane', () => {
    /* WITNESSED RED against the tree as it stood: `main.tsx` carried
       `planeState={load.phase === 'read' ? 'up' : 'down'}` and `ChromeBar.tsx`
       carried `<Connection state={planeState}>`; this failed naming both.
       ⚠️ AND THE FIRST DRAFT OF THIS ASSERTION WAS THE DEFECT IT EXISTS TO
       CATCH. It matched any `state={…}` anywhere in the tree, which is a rule
       keyed on a convenient LANDMARK rather than on the property it protects —
       docs/HANDOFF.md §5's first shape, arriving inside the test written to
       enforce it. It fired on `Connection.tsx`'s own `data-state={state}`, which
       is the component forwarding its declared prop, and on `Register.tsx`'s
       `data-state={run.status}`, which is a RUN's status on a register row and
       has nothing to do with the light. The property is: no CALL SITE of
       `<Connection>` takes a computed state. That is what is read now. */
    const bound: string[] = []
    for (const { path, text } of frontendSources()) {
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
      for (const m of code.matchAll(/<Connection\b[^>]*>/g)) {
        const tag = m[0]
        if (!/\sstate="(?:up|down)"/.test(tag)) bound.push(`${path}: ${tag.trim()}`)
      }
      if (/planeState|planeWord/.test(code)) bound.push(`${path}: planeState/planeWord`)
    }
    assert.deepEqual(bound, [],
      `the connection light takes a computed state: ${JSON.stringify(bound)}. ` +
      'G216 reverts exactly this. `Endpoint` carries no health field — ' +
      '`awk \'/export interface Endpoint /,/^}/\' model/domain.ts` returns ten fields ' +
      'and none of them is health — and `grep -rn EndpointHealth model/ docs/contracts/` ' +
      'returns nothing, so there is no value in this repository the light could ' +
      'honestly take. A prop here is a place for the next person to re-point at a ' +
      'convenient boolean; the state is a constant so that there is no such place. ' +
      'G216 also refused the near miss BY NAME: relabelling the component to state the ' +
      'plane and keeping it live.')
  })

  it('nothing binds `wired` or `lastArrivalAt` to it either — the wire names stop at ONE seam', () => {
    /* #245 [E-5]'s assertion 2. `listIntakeChannels` returns `wired`, a boolean
       meaning CONFIGURED, and the operation's own description forecloses the
       reading: "It is not a health check and does not claim the connector is
       well". Its four channels are all INBOUND; the drawn light names the ERP,
       a read/writeback endpoint.

       ⚠️ RE-ARGUED 2 Oct 2026 UNDER G3091 (THE OWNER'S) AND G3093, AND THE
       OLD FORM IS QUOTED RATHER THAN DELETED: it required that NO file under
       `frontend/src` mention either name — *"an intake-channel field reached a
       component"* — because nothing consumed `listIntakeChannels` at all. C1's
       "How the documents arrived" strip now does, so a total ban would forbid
       the pack's own drawing. THE PROPERTY WAS NEVER "no file says the word";
       it was "the light cannot be fed the field". It is held now by two facts
       together: the wire names appear in exactly ONE file — `api/intake.ts`,
       which renames them `configured` and `lastArrival` at the seam, so no
       component holds a field whose NAME invites the misreading — and the
       first assertion above still requires every `<Connection>` call site to
       pass a LITERAL state, so no value of any name can reach the light.
       WITNESSED RED by reading `raw['wired']` in `Shell.tsx`: failed naming
       that file. */
    const misread = frontendSources()
      .filter((f) => /\b(?:wired|lastArrivalAt)\b/.test(
        f.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')))
      .map((f) => f.path)
    assert.deepEqual(misread, [join(FRONTEND_SRC, 'api', 'intake.ts')],
      `an intake-channel wire field is read outside the one seam that renames it: ${JSON.stringify(misread)}. ` +
      '`wired` means CONFIGURED, not reachable, and docs/contracts/capability.openapi.yaml ' +
      'says so in the operation\'s own description — reading one as the other is ' +
      'docs/HANDOFF.md §5.1 exactly, a rule keyed on a convenient landmark instead of ' +
      'the property it protects. Read them in `api/intake.ts` and nowhere else.')
  })

  it('the light is still BINARY — a third state does not exist', () => {
    /* Passes at base and is the REGRESSION GUARD. G153 refused a third state for
       an `incomplete` run — "incomplete is neither live nor unreachable, and a
       seventh indicator form is a design change" — and G155 refused a fourth for
       the arriving residue. Widening is closed; only the source was ever open. */
    const kernel = readFileSync(join(REPO, 'docs', 'handoff-pack', 'tokens.css'), 'utf8')
    const states = new Set(
      [...kernel.matchAll(/\.conn\[data-state="([^"]+)"\]/g)].map((m) => m[1]))
    assert.deepEqual([...states].sort(), ['down'],
      `the kernel styles connection states ${JSON.stringify([...states])}. The light is ` +
      'binary: `up` is the unstyled default and `down` is the one variant. A third state ' +
      'is a design change under R5, refused twice already (G153, G155).')
  })

  it('the BUILT page draws the light QUIET — down, inside a disabled control, and claiming nothing', () => {
    /* ⚠️ RE-ARGUED 2 Oct 2026 UNDER G3091, THE OWNER'S RULING, WHICH
       SUPERSEDES G216's ON-SCREEN HATCH FOR PRODUCT SURFACES: *"draw exactly as
       the pack, visibly disabled (muted, no hatch, no G-numbers); a small
       tooltip says 'Coming soon'. Engineering rationale stays in docs/tests,
       never on screen."* This assertion read *"the BUILT chrome bar hatches the
       light and the hatch names #245"* and required a `.nb` around the light
       whose plate named G216 and whose reason named #245 and `Endpoint`. THAT
       REASON NOW LIVES HERE AND IN docs/HANDOFF.md, NOT ON THE SCREEN:
       `Endpoint` carries no health field (#245 [E-5]), so there is no value in
       this repository the light could honestly take.

       WHAT SURVIVES IS G216's PROPERTY, AND IT IS STRONGER STATED AS BEHAVIOUR:
       the light is drawn where the pack draws it — C1's status bar — in the
       constant `down` state, INSIDE a control that is `aria-disabled` and
       `data-soon`, so it can neither act nor claim. The hatch said "nothing is
       known"; a disabled, hollow light says the same thing without a paragraph.
       WITNESSED RED by moving the `<Connection>` out of its `<Soon>` in
       `Shell.tsx`: the match below failed. */
    const page = built(SHELL, 'the connection light rendering quiet')
    if (typeof page !== 'string') assert.fail(page.missing)
    const html = readFileSync(page, 'utf8')
    const quiet = /<button[^>]*aria-disabled="true"[^>]*data-soon=""[^>]*>(?:(?!<\/button>)[\s\S])*?<span class="conn" data-state="down"/
      .exec(html)
    assert.ok(quiet !== null,
      'the built page renders a connection light that is NOT inside a quiet, disabled ' +
      'control in its `down` state. G216: "A light that is truthful about the wrong subject ' +
      'is worse than a hatch" — and G3091 replaces the hatch with a disabled control, not ' +
      'with nothing.')
    const lights = html.match(/class="conn"/g) ?? []
    assert.equal(lights.length, 1, `the built page draws ${lights.length} connection lights; C1 draws ONE`)
    assert.equal(/class="nb"/.test(html), false,
      'the built product page carries a hatch. G3091 removes the on-screen hatch from product ' +
      'surfaces; the primitive stays on the design-system specimen, where its survival is measured.')
  })

  it('the built shell says NOTHING about ERP reachability that it could not know', () => {
    const page = built(SHELL, 'the light making no claim')
    if (typeof page !== 'string') assert.fail(page.missing)
    const text = readFileSync(page, 'utf8').replace(/<[^>]*>/g, ' ')
    assert.equal(/ERP\s+(?:live|unreachable|reachable)/.test(text), false,
      'the built shell claims an ERP state. Nothing in this repository carries one: ' +
      '`Endpoint` has ten fields and none is health, and `verifiedAt` is address ' +
      'OWNERSHIP rather than reachability — its own docblock says "Verification is the ' +
      'control, not hygiene." Reading one as the other is docs/HANDOFF.md §5.1.')
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('6 · the two states differ in FORM, not only in motion', { skip }, () => {
  /**
   * 🛑 A COMPONENT THAT EXPRESSED THE DIFFERENCE ONLY AS ANIMATION WOULD PASS A
   * CASUAL REVIEW AND COLLAPSE UNDER `prefers-reduced-motion` — under exactly
   * the setting meant to preserve the distinction. `.conn[data-state="down"] i`
   * sets `background: transparent` with an `inset` ring, which is a FORM
   * difference; the halo is the motion difference.
   */

  it('up is SOLID and down is HOLLOW, measured on the built specimen', async () => {
    const page = built(SPECIMEN, 'the two connection states differing in form')
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
      const read = (sel: string): Record<string, string> => {
        const el = document.querySelector(sel)
        if (el === null) return { missing: sel }
        const cs = getComputedStyle(el)
        return { background: cs.backgroundColor, ring: cs.boxShadow }
      }
      return {
        up: read('.conn:not([data-state="down"]) i'),
        down: read('.conn[data-state="down"] i'),
      }
    })
    assert.equal(seen.up['missing'], undefined, 'no live connection light on the specimen')
    assert.equal(seen.down['missing'], undefined, 'no down connection light on the specimen')
    assert.notEqual(seen.up['background'], seen.down['background'],
      `both states paint the same centre (${String(seen.up['background'])}). "A live ` +
      'connection breathes; an unreachable one is hollow and still — absence of life is ' +
      'the signal." If the only difference is the halo, prefers-reduced-motion collapses ' +
      'the two states into one.')
    assert.match(String(seen.down['ring']), /inset/,
      `the down light has no inset ring (box-shadow: ${String(seen.down['ring'])}). The ` +
      'hollow centre is the FORM half of the difference and it is what survives when ' +
      'motion stops.')
  })

  it('under reduce the halo stops AND the two states are still distinguishable', async () => {
    /* The guard is written `*,*::before,*::after` and that spelling is the whole
       trap: BOTH of this system's animations run on pseudo-elements —
       `.conn i::after` carries `alive` and `.lit--running::after` the sweep — so
       a guard written `*` alone genuinely stops neither.

       🛑 IT IS READ OFF THE KERNEL AND NOT OFF THE BUILT SHEET, AND THAT IS A
       TRAP WORTH WRITING DOWN RATHER THAN A CONVENIENCE. #268 names the
       observable as `grep -c '\*::before' <component stylesheet>` → non-zero.
       Run against `frontend/dist/assets/*.css` that returns **0**, and the guard
       is fine: the build minifies the selector list to `*,:before,:after`, where
       a bare `:before` carries an implied universal and means the same thing. A
       reader doing the grep on the artefact would report a live guard missing.
       So the SPELLING is asserted where it is written — the kernel — and the
       EFFECT is measured on the page below, which is the half that cannot be
       fooled by a minifier either way. */
    const kernel = readFileSync(join(REPO, 'docs', 'handoff-pack', 'tokens.css'), 'utf8')
    assert.match(kernel, /\*,\*::before,\*::after\{/,
      'the reduced-motion guard is not written `*,*::before,*::after`. `*` alone does ' +
      'not match pseudo-elements and both of this system\'s animations run on one, so a ' +
      'guard written `*{}` looks complete and stops neither.')

    const page = built(SPECIMEN, 'the two states surviving reduced motion')
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
      const halo = (sel: string): string => {
        const el = document.querySelector(sel)
        return el === null ? `(no ${sel})` : getComputedStyle(el, '::after').opacity
      }
      const centre = (sel: string): string => {
        const el = document.querySelector(sel)
        return el === null ? `(no ${sel})` : getComputedStyle(el).backgroundColor
      }
      return {
        upHalo: halo('.conn:not([data-state="down"]) i'),
        downHalo: halo('.conn[data-state="down"] i'),
        upCentre: centre('.conn:not([data-state="down"]) i'),
        downCentre: centre('.conn[data-state="down"] i'),
      }
    }, 'reduce')
    assert.equal(seen.upHalo, '0.3',
      'the live halo settled somewhere other than .3 under reduce. It must settle at .3 ' +
      'rather than 0: a DOWN light differs from a live one by an opacity-0 halo AND a ' +
      'hollow centre, and stopping the live halo at 0 collapses two differences into one.')
    assert.notEqual(seen.upCentre, seen.downCentre,
      'with motion stopped the two states became identical — which is the failure the ' +
      'form difference exists to prevent, arriving under exactly the setting meant to ' +
      'preserve it.')
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('7 · the grammar marks reach the built page and carry no hue', { skip }, () => {
  it('every grammar character on a built page sits inside the roster\'s own element', async () => {
    /* *"A figure the system is guessing at wears the hedge. Nothing else does."*
       This is the rendered half of §4: the source rule says no component spells
       one, and this says none arrived on the page by another route.
       WITNESSED RED by putting a bare `…` in a <p> on the specimen. */
    const page = built(SPECIMEN, 'the grammar indicators rendering')
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
      const marks = ['~', '›', '…']
      const owner = 'mk'
      const stray: string[] = []
      let owned = 0
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) {
        const text = n.nodeValue ?? ''
        const hit = marks.filter((m) => text.includes(m))
        if (hit.length === 0) continue
        const el = n.parentElement
        if (el !== null && el.classList.contains(owner)) { owned += hit.length; continue }
        stray.push(`${hit.join('')} in <${el?.tagName.toLowerCase() ?? '?'} class="${
          el?.className.toString() ?? ''}">`)
      }
      return { stray, owned }
    })
    assert.equal(MARK_CLASS, 'mk', 'the roster renamed the mark element; update the reader')
    assert.ok(seen.owned >= 3,
      `only ${seen.owned} grammar marks are rendered through the roster. All three ` +
      'character-bearing indicators are on the specimen, so a lower number means the ' +
      'probe is inert and every stray-check below passes for the wrong reason.')
    assert.deepEqual(seen.stray, [],
      `a grammar character reached the page outside the roster: ${JSON.stringify(seen.stray)}. ` +
      'A tilde typed into a string is a tilde; a <Hedge> is a declaration that the figure ' +
      'beside it is a guess — and "a number without one is a number somebody can rely on" ' +
      'holds exactly as long as the characters have one home.')
  })

  it('R1 — every grammar indicator survives greyscale, because it carries a WORD', async () => {
    /* *"No state may depend on hue."* The grammar indicators carry no CSS at
       all, so the assertion is that they paint nothing: an indicator that
       painted would be relying on something greyscale removes. */
    const page = built(SPECIMEN, 'the grammar indicators carrying no hue')
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
      const painted: string[] = []
      for (const el of document.querySelectorAll('.mk')) {
        const cs = getComputedStyle(el)
        if (cs.backgroundImage !== 'none') painted.push(`${el.textContent ?? ''} background-image`)
        if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          painted.push(`${el.textContent ?? ''} background-color=${cs.backgroundColor}`)
        }
        if ((el.textContent ?? '').trim() === '') painted.push('a mark with no character')
      }
      return painted
    })
    assert.deepEqual(seen, [],
      `a grammar indicator is painted: ${JSON.stringify(seen)}. The other four ` +
      'indicators are grammar and carry no CSS at all — one that acquires a treatment ' +
      'has become a third MARK, and the count is six by R5 whatever the file is called.')
  })
})

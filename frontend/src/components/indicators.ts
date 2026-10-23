/**
 * THE SIX INDICATORS — the roster, and the one place the count is declared.
 *
 * 🛑 R5 IS THE REASON THIS FILE EXISTS: *"Six indicators. A seventh is a design
 * change. Not an addition, and not a thing one specimen may mint on its own."*
 * (`design/system/index.html`, Rules in force). **A component library is
 * precisely the place where a seventh gets minted by one person on one
 * afternoon** — nothing else in the vocabulary can grow silently, because every
 * other primitive is a screen somebody has to draw.
 *
 * ⚠️ THIS IS DATA AND STRING RULES ONLY — NO JSX, DELIBERATELY, AND IT IS NOT A
 * STYLE CHOICE. `node --test` strips TypeScript types and does NOT transform
 * JSX, so a roster declared inside a `.tsx` file is a roster no test in this
 * repository can import. `tests/design/render.ts` records the same discovery one
 * level up — a first draft there asked for a `.tsx` import and *"CANNOT WORK …
 * the whole suite therefore failed with `Unknown file extension \".tsx\"` no
 * matter what the components did."* The components are in `Grammar.tsx`,
 * `Meter.tsx` and `Connection.tsx`; every rule they hold is declared here, where
 * it can be witnessed.
 *
 * ┌─ THE SHAPE, AND IT IS `CAPABILITY_RESOURCE_CLASS`'s ──────────────────────┐
 * │ `INDICATORS` names the six. `INDICATOR_FORM` is a TOTAL                    │
 * │ `Record<Indicator, IndicatorForm>` over them, so an indicator with no form │
 * │ is a COMPILE ERROR rather than a runtime surprise — CLAUDE.md, "Prefer a   │
 * │ total `Record` over a lookup function when the key set is closed."         │
 * │                                                                            │
 * │ 🛑 AND THE MERGE STORY IN CLAUDE.md IS WHY THE TOTAL RECORD IS WORTH THE   │
 * │ EXTRA LINE. Two branches once both said *thirty-eight* capabilities and    │
 * │ the two thirty-eights were not the same SET; what caught it was `tsc` on a │
 * │ total `Record`, not a count. A count control cannot see a substitution.    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ ONE ROSTER, ONE AUTHORITY. `tests/app/indicator-roster.test.ts` asserts
 * that `grep -rn '^export const INDICATORS' frontend/src` returns exactly one
 * declaration site, because two independent six-assertions are two authorities
 * for one number and they diverge the first time one of them is edited.
 * ⚠️ **THE `^export const` IS NEW — G2179, 28 Sep 2026.** The bare form
 * answered **fourteen lines across seven files** against a stated *exactly
 * one*, because the word is the roster's NAME and every file that discusses
 * the roster writes it — this sentence included. **The assertion the test
 * makes was always about a DECLARATION and the command was about a MENTION.**
 * The false form is not restated; the test is the authority either way.
 */

/**
 * The six, by key. The VALUES are the design system's own labels, so the test
 * that compares this roster against `design/system/index.html` compares words a
 * person wrote in the drawing rather than words this file invented.
 *
 * 🛑 DO NOT ADD A SEVENTH KEY HERE. R5 makes that a design change, and the
 * mechanical consequences are deliberate: `INDICATOR_FORM` below stops
 * compiling, and the roster test fails against the six `.ind` blocks in
 * `design/system/index.html` with R5's sentence as its message.
 */
export const INDICATORS = {
  meter: 'The meter — one line',
  connection: 'The connection light — one dot',
  hedge: 'Tilde hedges a forecast',
  stated: 'Past tense states a fact',
  yourMove: 'Chevron means your move',
  elsewhere: 'Ellipsis means elsewhere',
} as const

/** The closed set. A seventh member has nowhere to come from but the object above. */
export type Indicator = keyof typeof INDICATORS

/**
 * Two are MARKS and four are GRAMMAR, and the distinction is not decorative:
 * the two marks are the only indicators the kernel paints — `.meter` and
 * `.conn` in `design/system/tokens.css` — and *"the other four indicators are
 * grammar and carry no CSS at all."* A grammar indicator that acquired a
 * stylesheet would have become a third mark without anybody minting one.
 */
export type IndicatorShape = 'mark' | 'grammar'

/**
 * Where the character sits relative to the thing it qualifies, taken from the
 * drawing rather than chosen here: `~4 hours to clear` prefixes,
 * `Needs authority ›` and `Waiting on the bank feed …` suffix.
 */
export type MarkPosition = 'prefix' | 'suffix'

export interface IndicatorForm {
  readonly shape: IndicatorShape
  /**
   * The character the indicator is spelled with, or `null` when it has none.
   *
   * ⚠️ THE TWO MARKS HAVE NO CHARACTER BECAUSE THE KERNEL PAINTS THEM, AND
   * `stated` HAS NONE BECAUSE **THE TENSE IS THE MARK** — *"The tense carries
   * the certainty."* A character invented for past tense would be a seventh
   * indicator wearing the name of the fourth.
   */
  readonly mark: string | null
  readonly position: MarkPosition | null
}

/**
 * 🛑 TOTAL OVER `Indicator`. Adding a key to `INDICATORS` without adding it here
 * is `TS2739`, and adding one here that is not in `INDICATORS` is `TS2353`.
 * Both directions are closed, which is the property a count alone never has.
 */
export const INDICATOR_FORM: Record<Indicator, IndicatorForm> = {
  meter: { shape: 'mark', mark: null, position: null },
  connection: { shape: 'mark', mark: null, position: null },
  hedge: { shape: 'grammar', mark: '~', position: 'prefix' },
  stated: { shape: 'grammar', mark: null, position: null },
  yourMove: { shape: 'grammar', mark: '›', position: 'suffix' },
  elsewhere: { shape: 'grammar', mark: '…', position: 'suffix' },
}

/**
 * Every character the grammar indicators own, derived from the roster rather
 * than restated. `tests/app/indicator-roster.test.ts` asserts that no BUILT page
 * renders one of these outside an element the roster owns — which is what makes
 * *"a number without one is a number somebody can rely on"* checkable rather
 * than merely written down.
 */
export const GRAMMAR_MARKS: readonly string[] =
  Object.values(INDICATOR_FORM).flatMap((f) => (f.mark === null ? [] : [f.mark]))

/**
 * The class the grammar mark is rendered under, matching the drawing's own
 * `<span class="mk">`. It carries NO CSS and must not acquire any — see
 * `IndicatorShape` above.
 */
export const MARK_CLASS = 'mk'

/**
 * THE METER REFUSES AN UNMEASURED VALUE. It does not degrade to an empty bar.
 *
 * 🛑 R6 IS WHY THIS THROWS RATHER THAN DEFAULTS: *"the agent hue means the
 * machine measured something, and nothing else. Not matched, good, passed or
 * safe."* An unmeasured meter is not a degraded meter; it is the hue making a
 * claim nothing produced. G139's posture, adopted deliberately — *"an unset
 * bound refuses the run … It is never silently unbounded, which is the outcome
 * a default would produce."*
 *
 * ⚠️ THIS IS THE SECOND FENCE, NOT THE FIRST, AND THE FIRST IS STRONGER.
 * `MeterProps.score` and `.floor` are REQUIRED `number`s, so a TypeScript caller
 * holding `Provenance.confidence` — which is `number | null`
 * (`grep -n 'confidence: number | null' model/domain.ts`) — cannot construct the
 * component at all without answering the null arm. That is a compile error and
 * this is a throw; the throw exists because the null arm is a LIVE path in the
 * type the meter's one legitimate source comes from, and because JSON parsed at
 * a boundary is not checked by any compiler.
 *
 * ⚠️ AND IT REFUSES A VALUE OUTSIDE 0–1 FOR THE SAME REASON A DEFAULT IS
 * REFUSED. The kernel draws the fill at `width: var(--score)`; a score of 4
 * silently renders a full bar, which is a fabricated measurement rather than a
 * broken one.
 *
 * @returns the two custom properties the kernel reads, and nothing else — every
 *          colour and dimension of the line itself is `tokens.css`'s.
 */
export function meterScale(
  score: number,
  floor: number,
): { readonly '--score': string; readonly '--floor': string } {
  refuseUnmeasured('score', score)
  refuseUnmeasured('floor', floor)
  return { '--score': asPercent(score), '--floor': asPercent(floor) }
}

/**
 * 🛑 THE MESSAGE BELOW SHIPS IN THE BUNDLE, WHICH IS WHY ITS CITATION IS THE
 * ONE IN THIS FILE THAT WAS FIXED RATHER THAN RE-POINTED.
 *
 * It cited `design/routes/index.html` until 19 Sep 2026 — a path G264 deleted —
 * and the citation was wrong BEFORE the deletion too: **MG12 was never in that
 * file.** It is `docs/model-gaps.md`, which is still in the tree and was never
 * part of the drawn record. Derive it, do not read a line number:
 * `grep -n 'MG12' docs/model-gaps.md`. **A dead path inside a thrown error
 * reaches a person who is debugging and cannot be corrected by a comment.**
 */
function refuseUnmeasured(which: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(
      `THE METER REFUSES TO RENDER: \`${which}\` is ${String(value)}, which is not a ` +
        'measurement in 0–1. The meter is the ONLY line in this system and the agent hue ' +
        'means the machine measured something and nothing else (R6) — so an absent or ' +
        'out-of-range score is refused rather than drawn as an empty or full bar. A ' +
        'fallback bar would be a figure nobody can source, which is the failure ' +
        '`docs/model-gaps.md` records as MG12.',
    )
  }
}

const asPercent = (n: number): string => `${(n * 100).toFixed(0)}%`

/**
 * PAST TENSE STATES A FACT, AND THIS REFUSES A CLAIM ABOUT NOW.
 *
 * 🛑 THE RULE IS THE DRAWING'S OWN, QUOTED: *"The tense carries the certainty.
 * **'Completed at 03:12'** is a fact with a time on it; 'completing' would be a
 * claim about now that the page cannot make."* Both halves are mechanised here
 * and neither is decorative:
 *
 *   · THE TIME IS REQUIRED, at the type level, because a fact with no time on it
 *     is the claim about now wearing the past tense.
 *   · A PRESENT PARTICIPLE IS REFUSED, at run time, because that is the exact
 *     substitution the sentence above names — and it is the one a person makes
 *     while reaching for a progress word the system does not have. `reading`,
 *     `matching` and `completing` are all one keystroke from correct and all
 *     three are the failure.
 *
 * ⚠️ IT CHECKS THE VERB AND NOT THE WHOLE SENTENCE, DELIBERATELY. A rule that
 * scanned free prose for `-ing` would reject *"completed the matching run"* —
 * a rule keyed on a convenient landmark instead of the property it protects,
 * which `docs/HANDOFF.md` §5 catalogues as this codebase's most common defect.
 * The verb is a separate prop so the check has something exact to look at.
 */
export function statedFact(
  verb: string,
  at: string,
): { readonly verb: string; readonly at: string } {
  const word = verb.trim()
  const when = at.trim()
  if (word === '') {
    throw new RangeError(
      'PAST TENSE STATES A FACT AND THIS ONE HAS NO VERB. The tense carries the ' +
        'certainty; there is nothing here to carry it.',
    )
  }
  if (when === '') {
    throw new RangeError(
      `PAST TENSE STATES A FACT AND \`${word}\` HAS NO TIME ON IT. "Completed at 03:12" ` +
        'is a fact with a time on it; the same word with no time is a claim about now ' +
        'wearing the past tense. The prop is required at the type level and empty here, ' +
        'which is the one way past a required prop.',
    )
  }
  if (/ing$/i.test(word)) {
    throw new RangeError(
      `PAST TENSE STATES A FACT, AND \`${word}\` IS A CLAIM ABOUT NOW. ` +
        '"Completed at 03:12" is a fact with a time on it; "completing" would be a claim ' +
        'about now that the page cannot make. This system has no progress vocabulary — ' +
        'a progress bar is a second line (R3) and there is not one anywhere in the ' +
        'bundle — so the present participle has nowhere honest to go.',
    )
  }
  return { verb: word, at: when }
}

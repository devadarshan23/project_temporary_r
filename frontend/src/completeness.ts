/**
 * WHAT THE ENGINE ACCOUNTED FOR — the one vocabulary, in the one module.
 *
 * ┌─ 🛑 WHY THIS IS A MODULE AND NOT TWO FUNCTIONS INSIDE A COMPONENT ─────────┐
 * │ IT WAS TWO, AND THE TWO DISAGREED.                                         │
 * │                                                                            │
 * │ ⚠️ THIS LIVED IN `components/Register.tsx` AND `main.tsx` DREW THE SAME     │
 * │ FACT IN A SECOND VOCABULARY. Measured on the shipped code: the register     │
 * │ rendered `completeness: []` as "engine observed no shortfall", and the      │
 * │ drill-down panel rendered the identical value as `${length} accounted` —    │
 * │ **"0 accounted"**, which reads closer to a clean close than to "the engine  │
 * │ ran and found nothing". Two surfaces, one fact, two words, and the second   │
 * │ one lived in JSX where nothing in this repository can load it.              │
 * │                                                                            │
 * │ A vocabulary that is copied is a vocabulary that drifts. This module is a   │
 * │ `.ts` file with no JSX and no React import PRECISELY SO A TEST CAN LOAD IT  │
 * │ — the same argument `frontend/src/api/plane.ts` makes for itself, and the   │
 * │ same one `frontend/src/api/runs.ts` makes about bundlers. Node strips       │
 * │ types; node does not transform JSX. A word that only exists inside a `.tsx` │
 * │ is a word no assertion reaches.                                            │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 `?? []` IS THE ONE-LINER THAT DESTROYS ALL OF THIS, and it is named so
 * nobody reaches for it as a tidy-up. It collapses "nobody looked" into "somebody
 * looked and found nothing", which on an `incomplete` run is additionally
 * self-contradictory: `terminalRunStatus()` derives `incomplete` FROM a non-empty
 * completeness channel.
 *
 * `server/data-plane/runs.ts` is the authority on the two answers this reading
 * distinguishes:
 *
 *     `[]`    the ENGINE ran and observed no shortfall.
 *     `null`  THIS PLANE HOLDS NO ENGINE ACCOUNT FOR THIS RUN AT ALL.
 */

/**
 * The three answers, named. Anything else is drift between the register and the
 * wire — `completeness` is `readonly CompletenessFinding[] | null` and has
 * exactly three readings.
 */
export const COMPLETENESS_KINDS = ['absent', 'empty', 'accounted'] as const
export type CompletenessKind = (typeof COMPLETENESS_KINDS)[number]

/**
 * THE ONE DISCRIMINATOR. Every surface that draws this fact derives BOTH its
 * machine-readable name and its human-readable word from this function, so a
 * cell that says `data-completeness="absent"` while reading "engine observed no
 * shortfall" is not a thing that can be written — it would make the two answers
 * contradict, and a reader has no way to tell which is the lie.
 */
export function completenessKind(completeness: readonly unknown[] | null): CompletenessKind {
  if (completeness === null) return 'absent'
  return completeness.length === 0 ? 'empty' : 'accounted'
}

/**
 * The same fact in English.
 *
 * 🛑 `empty` DOES NOT RENDER AS A COUNT, AND THAT IS THE DEFECT THIS MODULE WAS
 * CUT OUT TO END. `${completeness.length} accounted` renders `[]` as
 * **"0 accounted"** — a number where the sentence should be, reading as a tally
 * that came out clean rather than as "the engine ran and observed no shortfall".
 * The two are the same value and different claims.
 */
export function completenessWord(completeness: readonly unknown[] | null): string {
  const kind = completenessKind(completeness)
  if (kind === 'absent') return 'no engine account'
  if (kind === 'empty') return 'engine observed no shortfall'
  return `${(completeness ?? []).length} accounted`
}

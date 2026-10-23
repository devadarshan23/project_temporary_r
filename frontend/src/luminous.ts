import type { Run } from './api/runs.ts'

/**
 * ONE LIGHT PER VIEW — the page-level arbitration the kernel asks for and no
 * component can hold. G3421 (RM-07), 3 Oct 2026. DERIVED, NOT THE OWNER'S.
 *
 * `docs/handoff-pack/tokens.css`: *"never on more than one thing per view — one
 * light is legible, six lights are wallpaper."* `C1 Close.dc.html` derives a
 * single `litTarget` (palette › panel › ask › strip › none) for exactly the
 * reason `components/Luminous.tsx` states in its own header: the count *"is a
 * page-level property and no component can hold it"* — *"two sources assigning
 * it independently is how a view ends up with two."*
 *
 * So this is the ONE place the light is assigned on C1, and both consumers read
 * its answer rather than deciding for themselves:
 *
 *   · `panel` — a register row is OPEN and its evidence ("What the machine
 *     did") is drawn. The machine's own drafted evidence, finished work: plain
 *     `lit`, no sweep. It OUTRANKS the strip, as the pack ranks it.
 *   · `strip` — otherwise, the ONE strip cell whose run is genuinely reading
 *     (`status === 'running'`): `lit lit--running`, the light plus the 17s
 *     sweep. When two reconciliations are reading at once, ONE cell is lit —
 *     THE MOST RECENTLY STARTED, whichever is selected. ⚠️ THIS READ *"the
 *     selected one if it is reading, else the most recently started"* UNTIL
 *     3 Oct 2026 and is corrected rather than deleted: RMR-04, THE OWNER'S
 *     RULING (G3471) — *"when two runs are reading, light only the most
 *     recently started; the other's mascot drops to the still mark."* So the
 *     light no longer follows the reader's click, and `workingRunOf()` below
 *     is the ONE answer to which strip cell's mascot works — the light and the
 *     working mark name the same run, and every other reading cell carries the
 *     still mark beside its word "running".
 *   · `none` — nothing the machine is doing right now is on screen. The palette
 *     and Ask outrank both and are not built; they are not represented here
 *     rather than represented as always-false.
 *
 * ⚠️ THE LIGHT NEVER CARRIES STATE. Every lit thing already says what it is in
 * words ("running", "What the machine did"); the kernel's precondition for the
 * light and the mascot is that the word is there first.
 */
export type LitTarget =
  | { readonly kind: 'panel'; readonly exceptionId: string }
  | { readonly kind: 'strip'; readonly runId: string }
  | { readonly kind: 'none' }

export function litTargetOf(input: {
  /** The open register row whose evidence is DRAWN, else `null`. */
  readonly openPanel: string | null
  /** The run each strip cell describes — `stripRunsOf()`. */
  readonly stripRuns: readonly Run[]
}): LitTarget {
  if (input.openPanel !== null) return { kind: 'panel', exceptionId: input.openPanel }
  const chosen = workingRunOf(input.stripRuns)
  return chosen === null ? { kind: 'none' } : { kind: 'strip', runId: chosen }
}

/**
 * THE ONE READING RUN WHOSE MASCOT WORKS — RMR-04 (G3471, the owner's): of the
 * strip's runs that are `running`, the most recently started, else `null`. The
 * strip's light (when no panel holds it) is on this same run, so the cell that
 * moves is the cell that is lit; every other reading cell draws the still mark.
 * An open panel does NOT move it: the run is still reading while the light
 * sits on the evidence.
 */
export function workingRunOf(stripRuns: readonly Run[]): string | null {
  const reading = stripRuns.filter((r) => r.status === 'running')
  const newest = [...reading].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
  return newest === undefined ? null : newest.runId
}

/**
 * IS ANYTHING STILL READING? — RMR-02 (G3472). The light, the sweep and the
 * working mark all assert *"running right now"* (`tokens.css`: *"Apply .lit to
 * anything the machine is working on RIGHT NOW"*), so while any run reads its
 * state is re-read on an interval and the light goes out when the work does.
 * One predicate, so the poll and the light cannot disagree about what reading
 * is.
 */
export function anyReading(runs: readonly Run[]): boolean {
  return runs.some((r) => r.status === 'running')
}

/** How often a reading run's state is re-read while the page is visible — RMR-02. */
export const READING_POLL_MS = 15_000

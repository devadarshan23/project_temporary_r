import { periodLabel, type Run } from './api/runs.ts'

/**
 * THE STATUS BAR'S PERIOD WORD — C3-25, G4042 (4 Oct 2026, derived — NOT THE
 * OWNER'S). While the runs read is out nothing is known about the period, so
 * the bar says it is being read (Design System 13: *"The scope is stated while
 * it loads"*); it used to say *"no period"*, a claim about a run it had not
 * read yet. `no period` is said only once the read has answered — no run, or
 * a run that carries no period, which is then the true answer.
 */
export function periodWordOf(
  run: Pick<Run, 'periodId' | 'periodStartsOn' | 'periodEndsOn'> | null,
  runsReading: boolean,
): { readonly word: string; readonly state: 'reading' | 'none' | 'named' } {
  if (run === null && runsReading) return { word: 'reading the period', state: 'reading' }
  const period = run === null ? null : periodLabel(run)
  return period === null ? { word: 'no period', state: 'none' } : { word: period, state: 'named' }
}

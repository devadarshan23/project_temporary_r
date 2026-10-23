import { definitionLabel, type Run } from '../api/runs.ts'
import { completenessKind } from '../completeness.ts'
import { clockOf } from '../format.ts'
import { stripSaysOf, type RefusalKind } from '../close-state.ts'
import { Soon } from './Soon.tsx'
import { DRAW_GATES, useHolds } from '../capabilities.ts'

/**
 * THE STRIP — C1's row of reconciliations, `<div class="strip">`, one cell per
 * DEFINITION, and you are already inside one.
 *
 * 🛑 THIS FILE WAS A TABLE OF RUNS UNTIL 2 Oct 2026 (G3091, THE OWNER'S) AND
 * THE PACK DRAWS NO SUCH TABLE: retrieve it with
 * `git show 76f0341e:frontend/src/components/Register.tsx`. What the pack draws
 * is a strip of reconciliations, each naming what its latest run says and when;
 * the period stepper in the arrival moves between that definition's runs. So
 * the runs are still all here — grouped by the definition they ran, rather than
 * listed beside the work.
 *
 * ⚠️ THE CELL IS STILL A RUN ROW AND KEEPS EVERY PROPERTY THE OLD ROW HELD:
 * `data-run` names the run it describes, the status is a WORD (no state may
 * depend on hue), and the completeness reading is its own addressable element —
 * `data-completeness` — whose word for `null` is an ABSENT account and never a
 * clean close. `tests/design/shell.test.ts` §5 reads exactly those, and an
 * `incomplete` run and a `completed` one still read differently, in words.
 */

export interface StripGroup {
  readonly definitionId: string
  /** G3351 — the stored name, else the id. See `definitionLabel()`. */
  readonly label: string
  /** Most recent first — the order `listRuns` serves. */
  readonly runs: readonly Run[]
}

/** Runs grouped by definition, in order of each definition's latest run. */
export function groupRuns(runs: readonly Run[]): readonly StripGroup[] {
  const groups = new Map<string, Run[]>()
  for (const run of runs) {
    const list = groups.get(run.definitionId) ?? []
    list.push(run)
    groups.set(run.definitionId, list)
  }
  return [...groups].map(([definitionId, list]) => {
    const sorted = [...list].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    /* The LATEST run's name: a definition renamed between runs reads as it is
       called now, and the id below stays the key either way. */
    const latest = sorted[0]
    return {
      definitionId,
      label: latest === undefined ? definitionId : definitionLabel(latest),
      runs: sorted,
    }
  })
}

export type RunsState = 'reading' | 'read' | 'refused'

/**
 * The run each reconciliation's cell describes: the selected run of the
 * selected definition, else that definition's latest. ONE derivation, used by
 * the strip and by the page-level light (`luminous.ts`), so the cell that is lit
 * is the cell that is drawn.
 */
export function stripRunsOf(
  runs: readonly Run[],
  selectedDefinition: string | null,
  selectedRunId: string | null,
): readonly Run[] {
  return groupRuns(runs).map(
    (g) =>
      (g.definitionId === selectedDefinition ? g.runs.find((r) => r.runId === selectedRunId) : undefined) ??
      (g.runs[0] as Run),
  )
}

export interface RegisterProps {
  readonly runs: readonly Run[]
  readonly state?: RunsState
  /** Why `state === 'refused'`. Absent = `other`. */
  readonly refusal?: RefusalKind
  /** Whether the register below the strip was read — the "still yours" half of the refusal. */
  readonly registerReadable?: boolean
  readonly selectedDefinition: string | null
  /** The run each definition's cell describes — the selected one, else its latest. */
  readonly runFor: (group: StripGroup) => Run
  readonly onSelect?: (definitionId: string) => void
  /**
   * The ONE run whose cell holds the light — `litTargetOf()`'s `strip` arm, or
   * `null` when the light is elsewhere (an open evidence panel) or nowhere.
   * RM-01: `lit lit--running`, the light and the 17s sweep, on the cell of the
   * reconciliation that is genuinely reading.
   */
  readonly litRunId?: string | null
  /**
   * The ONE reading run whose mark works — `workingRunOf()`. RMR-04 (G3471,
   * the owner's): every other reading cell draws the STILL mark.
   */
  readonly workingRunId?: string | null
  /**
   * G3626 — the pack's per-cell *"5 need you"*: for each cell's run, how many of
   * its open lines are unassigned or the reader's. Keyed by run id; an absent
   * or `null` entry is not read and draws nothing.
   */
  readonly needsByRun?: Readonly<Record<string, number | null>>
}

/**
 * THE RECONCILE MARK BEFORE A READING RECONCILIATION — RM-02,
 * `C1 Close.dc.html:66`: three dots before the name, cascading at the kernel's
 * `working` 4.8s. Decorative (`aria-hidden`): the cell's own word, "running",
 * carries the state, which is the kernel's precondition for the mark.
 *
 * 🛑 RMR-04 — THE OWNER'S RULING (G3471): *"when two runs are reading, light
 * only the most recently started; the other's mascot drops to the still
 * mark."* So only `workingRunOf()`'s run cascades; another reading cell keeps
 * the mark and loses the energy — the mark with no `data-energy` is the
 * lockup's still mark, which the kernel guarantees animates nothing.
 */
function WorkingMark({ still = false }: { readonly still?: boolean }) {
  return (
    <span className="mascot" {...(still ? {} : { 'data-energy': 'working' })} aria-hidden="true">
      <i className="d1">·</i>
      <i className="d2">·</i>
      <i className="d3">·</i>
    </span>
  )
}

function emptyLine(state: RunsState, refusal: RefusalKind, registerReadable: boolean): readonly [string, string] {
  if (state === 'reading') return ['Reading the reconciliations', 'Each run lands here when it starts.']
  if (state !== 'refused') return ['No reconciliation has run yet', 'Each run lands here when it starts.']
  const tail = registerReadable ? 'The register below is still yours.' : ''
  /* G3882 — since G3881 a register reader always reads its runs, so a run
     refusal BESIDE a readable register is a partner's (the owner's G3802
     ruling); without one, the role reads neither. "Runs are not part of your
     role" stood here and is retired: it told a partner the gap was their role. */
  if (refusal === 'role') {
    return registerReadable
      ? ['Runs stay with the customer', "You can work the register below; a run's residue is not shared with partners."]
      : ['Runs are read with the register', 'Your role reads neither.']
  }
  if (refusal === 'rate') return ['Too many requests from this browser', 'Try again in a minute — nothing was changed.']
  return ['The reconciliations could not be read', tail === '' ? 'Reload the page to try again.' : tail]
}

export function Register({
  runs,
  state = 'read',
  refusal = 'other',
  registerReadable = false,
  selectedDefinition,
  runFor,
  onSelect,
  litRunId = null,
  workingRunId = null,
  needsByRun = {},
}: RegisterProps) {
  const groups = groupRuns(runs)
  const [head, sub] = emptyLine(state, refusal, registerReadable)
  const mayAuthor = useHolds(DRAW_GATES.newReconciliation)
  return (
    <div
      className="strip"
      id="register"
      role="group"
      aria-label="Reconciliations"
      {...(state === 'reading' ? { 'aria-busy': true, 'data-reading': '' } : {})}
    >
      {groups.map((group) => {
        const run = runFor(group)
        const current = group.definitionId === selectedDefinition
        const lit = litRunId !== null && run.runId === litRunId
        const reading = run.status === 'running'
        const says = stripSaysOf(run, needsByRun[run.runId] ?? null)
        return (
          <button
            key={group.definitionId}
            /* `cell` FIRST, then the light — `lit` and `lit--running` are the
               kernel's own classes, painted on a doubled selector so this
               file's single-class rules cannot erase them (RM-04). */
            className={lit ? 'cell lit lit--running' : 'cell'}
            type="button"
            aria-current={current ? 'true' : undefined}
            data-run={run.runId}
            data-definition={group.definitionId}
            data-state={run.status}
            {...(lit ? { 'data-lit': 'strip' } : {})}
            onClick={onSelect === undefined ? undefined : () => { onSelect(group.definitionId) }}
          >
            <span className="nm">
              {reading ? <WorkingMark still={run.runId !== workingRunId} /> : null}
              {group.label}
            </span>{' '}
            <span className="st">
              {/* RC-10 (G3445) — what the run says, in the pack's register:
                  `reading` while it reads, then the status, how many it raised,
                  and the engine's own completeness reading (published since
                  G3442 for every run with an account). */}
              <span className="says">
                {/* C3-14 (G3843) — plain words, the parts that apply, joined
                    by a middle dot; the run's status stays its subject. */}
                {[
                  says.needs === null ? null : <span key="n" data-run-needs="">{says.needs}</span>,
                  says.raised === null ? null : <span key="r" data-raised="">{says.raised}</span>,
                  <span key="s" data-run-status={run.status}>{says.state}</span>,
                  says.gaps === null ? null : (
                    <span key="g" className="account" data-completeness={completenessKind(run.completeness)}>{says.gaps}</span>
                  ),
                ]
                  .filter((part) => part !== null)
                  .flatMap((part, i) => (i === 0 ? [part] : [' · ', part]))}
              </span>
              <span className="when">{clockOf(run.startedAt)}</span>
            </span>
          </button>
        )
      })}
      {groups.length === 0 && (
        <div
          className="cell note"
          data-runs-state={state}
          {...(state === 'refused' ? { 'data-refusal': refusal } : {})}
        >
          <span className="nm">{head}</span>
          {sub === '' ? null : (
            <span className="st">
              <span className="says">{sub}</span>
            </span>
          )}
        </div>
      )}
      {/* NC-04 — G3193: a control a role may not use is not offered. A reader
          whose run read was REFUSED BY ROLE can define no reconciliation, so
          the quiet "New reconciliation" cell is absent rather than drawn. */}
      {/* G3522 — and only for a session holding `author_definition`. */}
      {(state === 'refused' && refusal === 'role') || !mayAuthor ? null : (
        <Soon className="cell addcell" label="New reconciliation">
          <span className="nm">＋ New reconciliation</span>
          <span className="st">sources · match rule · tolerance<span className="when">you define</span></span>
        </Soon>
      )}
    </div>
  )
}

import type { ReactNode } from 'react'

import { definitionLabel, periodLabel, type AdmissionRate, type Run } from './api/runs.ts'
import type { IntakeLane, IntakeChannelKind } from './api/intake.ts'
import { Connection } from './components/Connection.tsx'
import { Register, groupRuns, type RunsState, type StripGroup } from './components/Register.tsx'
import { periodWordOf } from './period-word.ts'
import { arrivalSettlementOf, roleClaimOf, type ArrivalSettlement, type ClaimRole, type RefusalKind } from './close-state.ts'
import type { AccountLoad } from './components/RunAccount.tsx'
import { Soon } from './components/Soon.tsx'
import { StatusGrammar } from './components/StatusGrammar.tsx'
import { capitalised, clockOf, countOf, moneyFigure, whenOf, wordOf } from './format.ts'
import type { LinkProps } from './routes/useRoute.ts'
import { RUN_STATUS_WORD } from './words.ts'

/**
 * THE CLOSE SCREEN — C1, `docs/handoff-pack/C1 Close.dc.html`, drawn as the pack
 * draws it, top to bottom:
 *
 *   the strip (one cell per reconciliation) · how the documents arrived ·
 *   the arrival (the run's name, the greeting, the period stepper, the figures)
 *   · the register (SHOW / ORDER BY, the count line, the table whose rows open
 *   onto "What the machine did") · the status bar.
 *
 * 🛑 REBUILT 2 Oct 2026 UNDER G3091, THE OWNER'S RULING: *"Pack-faithful, quiet:
 * draw exactly as the pack, visibly disabled (muted, no hatch, no G-numbers); a
 * small tooltip says 'Coming soon'. Engineering rationale stays in docs/tests,
 * never on screen."* The screen this replaced — plain headings, two paragraphs
 * about row-level security and three hatched explanation panels — is
 * retrievable: `git show 76f0341e:frontend/src/Shell.tsx`. Every argument it
 * carried on screen is now a row in `docs/HANDOFF.md` (G3091–G3100).
 *
 * THE COMPONENT KEEPS ITS NAME because `prerender.tsx` and every design
 * assertion address it by that name, and it is still a PURE FUNCTION of what it
 * is handed — the property that lets the same component be both the
 * pre-rendered page (`frontend/dist/shell.html`) and the live app. All state —
 * which reconciliation, which period, which facet, which row is open, and WHICH
 * ONE THING HOLDS THE LIGHT — is owned by `main.tsx` and arrives here as props.
 *
 * ✅ 3 Oct 2026 — `fix/ui-close-surface`, G3421–G3440:
 *   · the light: the reading reconciliation's cell is lit and sweeps, and the
 *     Reconcile mark cascades before its name (RM-01/02); WHICH cell is lit is
 *     `luminous.ts`'s page-level answer, handed in as `litRunId` (RM-07);
 *   · no raw ids (RC-02): the run line is the reconciliation's NAME and the
 *     run's clock — the run reference moves to the link's `title` — and the
 *     period is drawn as its calendar span (`periodLabel()`, `0430`);
 *   · the claim is withheld while either read is still out (RC-16), and its
 *     counts are the selected reconciliation's and "needs you" means unassigned
 *     or yours (RC-03);
 *   · the status bar names the entity first, keeps its live keys in ink and
 *     marks the unbuilt ones — ⌘Z among them — `Coming soon` (RV-09).
 *
 * WHAT IS BOUND TO WHAT IS SERVED:
 *   strip            listRuns, grouped by definition (Register.tsx)
 *   arrival          the selected run (getRun's fields, from the list); the
 *                    figures from getRunAccount — admitted, refused at
 *                    admission and coverage, summed over the admission rates —
 *                    and exceptionsRaised from the run itself
 *   greeting claim   getExceptionFacets, scoped to the selected RUN (G3626,
 *                    `runId` since `0480`): the "needs you" count of the total
 *   strip "need you" getExceptionFacets per cell's run (G3626)
 *   intake           listIntakeChannels — configured lanes and last arrival
 *   register         listExceptions (status filter + sort + the selected run, G3626),
 *                    assignException, getException on a row's opening
 * WHAT IS DRAWN AND NOT SERVED is a `<Soon>`: rename, Read by the machine, a
 * lane's delivery record, the four acts on a line, the source light, the
 * unbuilt keys and the audit door.
 */

export type IntakeLoad =
  | { readonly phase: 'reading' }
  | { readonly phase: 'read'; readonly lanes: readonly IntakeLane[] }
  | { readonly phase: 'refused' }

const LANE_WORD: Readonly<Record<IntakeChannelKind, string>> = {
  upload: 'Upload',
  watched_drop: 'Watched drop',
  connector_pull: 'Connector pull',
  mailbox: 'Mailbox',
}

export interface ShellProps {
  readonly runs: readonly Run[]
  readonly runsState?: RunsState
  /** Why the run read was refused, when it was — RC-11. */
  readonly runsRefusal?: RefusalKind
  /** Whether the exception register was read; the strip's refusal says "still yours" only then. */
  readonly registerReadable?: boolean
  readonly nextCursor: string | null
  /** Shown in the status bar ONLY by the pre-rendered page, whose rows are illustrative. */
  readonly provenance?: string
  readonly selectedDefinition?: string | null
  readonly selectedRunId?: string | null
  readonly onSelectDefinition?: (definitionId: string) => void
  readonly onSelectRun?: (runId: string) => void
  readonly account?: AccountLoad
  readonly intake?: IntakeLoad
  readonly greeting?: string
  /**
   * The selected reconciliation's "needs you" count and its total — or `null`
   * while unread, AND while the register itself is still being read (RC-16):
   * a claim about the register drawn over a register that says it is reading
   * is the screen saying two things at once.
   */
  readonly needsYou?: number | null
  readonly total?: number | null
  /**
   * C3-07 (the owner's) — who the greeting speaks to. `null` while the
   * principal is unread: no claim is drawn rather than the wrong one.
   */
  readonly role?: ClaimRole | null
  /** The viewer's claim: open lines in the scope, whoever holds them. */
  readonly openCount?: number | null
  /** The approver's claim: proposals waiting on this reader's approval. */
  readonly approvalsWaiting?: number | null
  /** Where the approver's claim goes — the Approvals destination (C3-08). */
  readonly onApprovals?: () => void
  /** The run cell that holds the page's one light, or `null` — `luminous.ts`. */
  readonly litRunId?: string | null
  /** The one reading run whose mark works — `workingRunOf()`, RMR-04 (G3471). */
  readonly workingRunId?: string | null
  /** G3626 — per strip run, its "N need you" count (`Register.tsx`). */
  readonly needsByRun?: Readonly<Record<string, number | null>>
  /** The bound tenant's name (or id) for the status bar's first slot. RC-21. */
  readonly entity?: string | null
  readonly accountLink?: (runId: string) => LinkProps
  readonly detail?: ReactNode
  readonly exceptions?: ReactNode
}

function sum(rates: readonly AdmissionRate[], key: 'presented' | 'admitted' | 'refused'): number {
  let n = 0
  for (const rate of rates) n += rate[key]
  return n
}

interface Figure {
  readonly k: string
  readonly v: string | null
}

/**
 * THE ARRIVAL'S FIGURES — RC-10 / NC-03 (G3444), in the PACK'S words.
 *
 * ⚠️ THESE READ `Admitted · Not admitted · Coverage · Exceptions raised` UNTIL
 *    3 Oct 2026 — labels the pack does not use. C1 draws `Matched · In variance
 *    · Coverage · Read by the machine` (`C1 Close.dc.html`, `figures`).
 *
 *   Matched       — ✅ SERVED SINCE 3 Oct 2026 (G3541/G3543): the admitted
 *                   lines the engine fully settled, off the run's engine
 *                   account (`settlementTallies`, the `left` side — see
 *                   `close-state.ts` `ARRIVAL_SIDE`). ⚠️ THIS READ *"no operation
 *                   serves a matched-line count for a run, so the figure is
 *                   drawn quiet (`<Soon>`)"* AND IS CORRECTED RATHER THAN
 *                   DELETED: it was true until the plane derived one.
 *   In variance   — ✅ SERVED, likewise: the open lines' residual, summed by the
 *                   plane through `model/money.ts`; `mixed currencies` where the
 *                   plane refused a sum across units, `—` where nothing is open
 *                   or no account exists. Never a zero, never a guess.
 *   Coverage      — lines the engine admitted over lines it read, off the run's
 *                   own engine account; `—` (unmeasured) with no account.
 *   This run raised — how many exceptions THIS run raised. Labelled for its
 *                   scope (NC-03): the claim beside it counts the whole
 *                   reconciliation's register, which spans its runs, and the
 *                   old bare `Exceptions raised 5` beside "Three of the six"
 *                   read as two answers to one question.
 */
function figuresOf(run: Run, account: AccountLoad | undefined): readonly Figure[] {
  const produced = account?.phase === 'read' && account.account.outcome === 'produced' ? account.account : null
  const rates = produced?.admissionRates ?? []
  const presented = sum(rates, 'presented')
  const admitted = sum(rates, 'admitted')
  return [
    {
      k: 'Coverage',
      v: produced === null || presented === 0 ? null : `${((admitted / presented) * 100).toFixed(1)}%`,
    },
    { k: 'This run raised', v: run.exceptionsRaised === null ? null : countOf(run.exceptionsRaised) },
  ]
}

function settlementOf(account: AccountLoad | undefined): ArrivalSettlement {
  const produced = account?.phase === 'read' && account.account.outcome === 'produced' ? account.account : null
  return arrivalSettlementOf(produced?.settlementTallies ?? null, produced?.openResidual ?? null)
}

/** `Matched` and `In variance`, served (G3543). `data-settlement` states which
 *  arm drew the figure, so a dash never has to be read to know why. */
function SettlementFigures({ settlement }: { settlement: ArrivalSettlement }) {
  if (settlement.kind === 'unmeasured') {
    return (
      <>
        <span className="fig" data-figure="matched">
          <span className="k">Matched</span>
          <span className="v" data-unmeasured="">—</span>
        </span>
        <span className="fig" data-figure="in-variance">
          <span className="k">In variance</span>
          <span className="v" data-unmeasured="">—</span>
        </span>
      </>
    )
  }
  const iv = settlement.inVariance
  return (
    <>
      <span className="fig" data-figure="matched">
        <span className="k">Matched</span>
        <span className="v">{countOf(settlement.matched)}</span>
      </span>
      <span className="fig" data-figure="in-variance" data-settlement={iv.kind}>
        <span className="k">In variance</span>
        {iv.kind === 'money' ? (
          <span className="v">
            <span className="cu">{moneyFigure(iv.money).unit}</span> {moneyFigure(iv.money).figure}
          </span>
        ) : iv.kind === 'mixed' ? (
          <span className="v">mixed currencies</span>
        ) : (
          <span className="v">—</span>
        )}
      </span>
    </>
  )
}

function Intake({ intake }: { intake: IntakeLoad | undefined }) {
  if (intake === undefined || intake.phase === 'refused') return null
  const lanes = intake.phase === 'read' ? intake.lanes.filter((l) => l.configured) : []
  return (
    <div className="intake" data-intake={intake.phase} {...(intake.phase === 'reading' ? { 'aria-busy': true, 'data-reading': '' } : {})}>
      <span className="lab">How the documents arrived</span>
      {lanes.length > 0 && (
        <ul>
          {lanes.map((lane) => (
            <li key={lane.channel} data-lane={lane.channel}>
              <Soon className="via">{LANE_WORD[lane.channel]}</Soon>
              <span className="when">{lane.lastArrival === null ? 'nothing yet' : whenOf(lane.lastArrival)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="cap">
        {intake.phase === 'reading'
          ? 'Reading how the documents arrived.'
          : lanes.length === 0
            ? 'No intake lane is configured yet — documents arrive once a source is set up.'
            : `${capitalised(wordOf(lanes.length))} of ${wordOf(intake.lanes.length)} lanes configured.`}
      </p>
    </div>
  )
}

function Arrival(props: {
  readonly run: Run
  readonly group: StripGroup
  readonly greeting: string
  readonly claim: string | null
  readonly onClaim: (() => void) | undefined
  readonly account: AccountLoad | undefined
  readonly accountLink: ((runId: string) => LinkProps) | undefined
  readonly onSelectRun: ((runId: string) => void) | undefined
}) {
  const { run, group } = props
  const at = group.runs.findIndex((r) => r.runId === run.runId)
  const older = group.runs[at + 1]
  const newer = at > 0 ? group.runs[at - 1] : undefined
  const link = props.accountLink?.(run.runId)
  const period = periodLabel(run)
  /* 🛑 RC-02 — NO RAW ID ON THE SCREEN. The pack's run line is
     *"THREE-WAY MATCH V4 · RUN 03:12"*: the reconciliation's name and the run's
     clock. The run's REFERENCE is still the link's subject (`data-run-link`) and
     is printed on the run's own account one click away, where a person quoting
     a run to support will look — but it is no longer the thing the eye lands
     on. ⚠️ NOT A `title`: G189 refuses the hover-only attribute throughout
     `frontend/src`, and `tests/design/overlays.test.ts` §0 holds it. */
  const caption = (
    <span className="lab">
      {definitionLabel(run)} v{run.definitionVersion} · run {clockOf(run.startedAt)}
    </span>
  )
  return (
    <div className="arrive" data-arrival={run.runId}>
      <div>
        <span className="runline">
          {link === undefined ? (
            <span className="labbtn">{caption}</span>
          ) : (
            <a className="labbtn" data-run-link={run.runId} {...link}>
              {caption}
            </a>
          )}
          <Soon className="pen">rename</Soon>
        </span>
        <h1>
          {props.greeting}
          {props.claim === null ? null : <> <Claim text={props.claim} onGo={props.onClaim} /></>}
        </h1>
        <div className="period">
          <button
            type="button"
            aria-label="The previous run of this reconciliation"
            aria-disabled={older === undefined || props.onSelectRun === undefined}
            onClick={older === undefined ? undefined : () => { props.onSelectRun?.(older.runId) }}
          >
            ←
          </button>
          <span className="cur" data-period={run.periodId ?? ''}>
            {period ?? 'No period'}
          </span>
          <button
            type="button"
            aria-label="The next run of this reconciliation"
            aria-disabled={newer === undefined || props.onSelectRun === undefined}
            onClick={newer === undefined ? undefined : () => { props.onSelectRun?.(newer.runId) }}
          >
            →
          </button>
          <span className="note">
            {RUN_STATUS_WORD[run.status]} · started {whenOf(run.startedAt)}
          </span>
        </div>
      </div>
      <div className="figs">
        <SettlementFigures settlement={settlementOf(props.account)} />
        {figuresOf(run, props.account).map((f) => (
          <span key={f.k} className="fig">
            <span className="k">{f.k}</span>
            {f.v === null ? (
              <span className="v" data-unmeasured="">—</span>
            ) : (
              <span className="v">{f.v}</span>
            )}
          </span>
        ))}
        {/* RC-34 / NC-10 (G3474): `∴` TRAILS A SPEND FIGURE (`tokens.css`
            `.met`: *"after a spend figure or after words that already say an
            act is billable"*). No run spend is served, so the figure is the
            dash every unmeasured figure on C1 uses — and no mark, because a
            mark after a dash claims a charge of nothing. */}
        <Soon className="fig">
          <span className="k">Read by the machine</span>
          <span className="v" data-unmeasured="">—</span>
        </Soon>
      </div>
    </div>
  )
}

/** The greeting's claim — a plain bold sentence, or a button where it goes somewhere. */
function Claim({ text, onGo }: { readonly text: string; readonly onGo: (() => void) | undefined }) {
  if (onGo === undefined) return <b data-claim="">{text}</b>
  return (
    <button type="button" className="claimbtn" data-claim="" data-claim-goes="approvals" onClick={onGo}>
      {text}
    </button>
  )
}

function NoRun({
  greeting,
  claim,
  onClaim,
  state,
  refusal,
}: {
  greeting: string
  claim: string | null
  onClaim: (() => void) | undefined
  state: RunsState
  refusal: RefusalKind
}) {
  return (
    <div className="arrive" data-arrival="">
      <div>
        <span className="runline"><span className="lab">The close</span></span>
        <h1>
          {greeting}
          {claim === null ? null : <> <Claim text={claim} onGo={onClaim} /></>}
        </h1>
        {/* NC-04 — A STATUS IS PRINTED ONCE PER SURFACE. When the run read is
            refused, the strip's own note already says why ("Runs are not part
            of your role", "Too many requests…"); repeating it here was the
            second of the four copies the re-audit counted under a 429. The
            refusal kind is still taken so the arrival can never claim a run. */}
        {state === 'refused' ? (
          <div className="period" data-refused={refusal} />
        ) : (
          <div className="period">
            <span className="note" {...(state === 'reading' ? { 'data-reading': '' } : {})}>
              {state === 'reading'
                ? 'Reading the reconciliations.'
                : 'A run appears here when a reconciliation starts.'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * THE STATUS BAR — the pack's `.statusbar`: the entity and the period, the run
 * behind the screen, the sources, the keys and the audit door. RV-09: a key-cap
 * for a binding that WORKS is drawn in ink and is live text (J K move, ↵ open —
 * both drive the register today); the unbuilt ones (A accept, ⌘Z undo, ⌘K
 * palette) are one `Coming soon` control, ⌘Z included rather than omitted,
 * because undo is unbuilt and not refused (G3193).
 */
function StatusBar({
  run,
  runsState,
  provenance,
  entity,
}: {
  run: Run | null
  runsState: RunsState
  provenance: string | undefined
  entity: string | null
}) {
  const period = periodWordOf(run, runsState === 'reading')
  /* G4071, and since U-27 (G4181) the ONE implementation all three surfaces
     share: the wide bar, the narrow row and the sheet are `StatusGrammar.tsx`'s,
     and this function hands in only Close's slots. */
  return (
    <StatusGrammar
      bar={
        <>
          <span className="bit">
            {entity === null ? 'Close' : entity} · <b data-period={period.state} {...(period.state === 'reading' ? { 'data-reading': '' } : {})}>{period.word}</b>
          </span>
          {run === null ? null : (
            <span className="bit">
              {definitionLabel(run)} v{run.definitionVersion} · run {clockOf(run.startedAt)}
            </span>
          )}
          {provenance === undefined ? null : <span className="bit" data-provenance="">{provenance}</span>}
          <Soon label="Source connections">
            <Connection state="down">sources · not yet reported</Connection>
          </Soon>
          <span className="sp" />
          <span className="keys" data-keys="">
            <span data-key="move"><kbd>J K</kbd>move</span>
            <span data-key="open"><kbd>↵</kbd>open</span>
            <Soon className="keys-soon" label="Keyboard shortcuts not yet built: accept, undo, palette">
              <span><kbd>A</kbd>accept</span>
              <span><kbd>⌘Z</kbd>undo</span>
              <span><kbd>⌘K</kbd>palette</span>
            </Soon>
          </span>
          <Soon className="bit">audit</Soon>
        </>
      }
      /* *"The row shows the provenance slot, because that is the half a person
         checks without being asked."* (primitive 12) */
      row={
        <>
          Provenance · {run === null ? <b>no run</b> : <><b>run {clockOf(run.startedAt)}</b> · {definitionLabel(run)}</>}
          {provenance === undefined ? null : <> · {provenance}</>}
        </>
      }
      /* The grammar's slots in the bar's own order — they never rearrange.
         ⚠️ The key-caps are NOT in the sheet: *"Narrow: hidden, and the
         shortcut still works … the one place the system hides information
         rather than moving it"* (Handoff Specification, primitive 14; G4073). */
      sheet={[
        {
          name: 'entity',
          content: <>{entity === null ? 'Close' : entity} · <b data-period={period.state} {...(period.state === 'reading' ? { 'data-reading': '' } : {})}>{period.word}</b></>,
        },
        {
          name: 'provenance',
          content: (
            <>
              {run === null
                ? 'No run yet, so there is nothing for this slot to report.'
                : `${definitionLabel(run)} v${String(run.definitionVersion)} · run ${clockOf(run.startedAt)}`}
              {provenance === undefined ? null : <span data-provenance=""> · {provenance}</span>}
            </>
          ),
        },
        {
          name: 'sources',
          content: (
            <Soon label="Source connections">
              <Connection state="down">sources · not yet reported</Connection>
            </Soon>
          ),
        },
        { name: 'audit', content: <Soon>audit</Soon> },
      ]}
    />
  )
}

export function Shell({
  runs,
  runsState = 'read',
  runsRefusal = 'other',
  registerReadable = false,
  provenance,
  selectedDefinition = null,
  selectedRunId = null,
  onSelectDefinition,
  onSelectRun,
  account,
  intake,
  greeting = 'Good morning.',
  needsYou = null,
  total = null,
  role = 'actor',
  openCount = null,
  approvalsWaiting = null,
  onApprovals,
  litRunId = null,
  workingRunId = null,
  needsByRun = {},
  entity = null,
  accountLink,
  detail,
  exceptions,
}: ShellProps) {
  const groups = groupRuns(runs)
  const group = groups.find((g) => g.definitionId === selectedDefinition) ?? groups[0]
  const definition = group?.definitionId ?? null
  const runFor = (g: StripGroup): Run =>
    (g.definitionId === definition ? g.runs.find((r) => r.runId === selectedRunId) : undefined) ??
    (g.runs[0] as Run)
  const run = group === undefined ? null : runFor(group)
  /* NC-02 / NC-03 (G3444) — the claim NAMES its reconciliation, and on a run
     that is still reading it never asserts "no exception". */
  const claim = roleClaimOf(
    role,
    { needs: needsYou, total, open: openCount, approvals: approvalsWaiting },
    group === undefined || run === null ? null : { label: group.label, status: run.status },
  )
  /* The approver's claim is the way to their work (C3-08): a button, so the
     narrow tier — which sheds the chrome's destinations — still reaches it. */
  const onClaim = role === 'approver' ? onApprovals : undefined
  return (
    <div className="close" data-surface="close">
      <Register
        runs={runs}
        state={runsState}
        refusal={runsRefusal}
        registerReadable={registerReadable}
        selectedDefinition={definition}
        runFor={runFor}
        litRunId={litRunId}
        workingRunId={workingRunId}
        needsByRun={needsByRun}
        {...(onSelectDefinition === undefined ? {} : { onSelect: onSelectDefinition })}
      />
      <Intake intake={intake} />
      {run === null || group === undefined ? (
        <NoRun greeting={greeting} claim={claim} onClaim={onClaim} state={runsState} refusal={runsRefusal} />
      ) : (
        <Arrival
          run={run}
          group={group}
          greeting={greeting}
          claim={claim}
          onClaim={onClaim}
          account={account}
          accountLink={accountLink}
          onSelectRun={onSelectRun}
        />
      )}
      {exceptions}
      {detail}
      <StatusBar run={run} runsState={runsState} provenance={provenance} entity={entity} />
    </div>
  )
}

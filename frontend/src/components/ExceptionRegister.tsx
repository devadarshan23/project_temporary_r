import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, RefObject } from 'react'

import type { ExceptionRow, ExceptionSort, Money } from '../api/exceptions.ts'
import { findingLine } from '../api/exceptions.ts'
import type { ExceptionStatus } from '../../../model/domain.ts'
import { EXCEPTION_STATUS_WORD, SEVERITY_WORD } from '../words.ts'
import { countOf, moneyFigure, sumOf } from '../format.ts'
import { Surface } from '../overlays/Surface.tsx'
import type { LinkProps } from '../routes/useRoute.ts'
import type { FindingLoad } from './Finding.tsx'
import {
  ORDERS,
  ORDER_CHOICES,
  QUIET_ORDERS,
  SHOWS,
  SHOW_KEYS,
  TAKEABLE,
  nextActOf,
  pageCurrency,
  varianceCurrency,
  varianceFigureOf,
  whoseOf,
  type NextAct,
  type RefusalKind,
  type ShowKey,
  type Whose,
} from '../close-state.ts'
import { Soon } from './Soon.tsx'
import { ReopenDialog } from './ReopenDialog.tsx'
import type { ReversalReason } from '../api/resolution.ts'
import { DRAW_GATES, useHolds } from '../capabilities.ts'
import { drawnActOf } from '../register-acts.ts'
import { personWord } from '../resolve-logic.ts'

/**
 * THE REGISTER — C1's `.triage` and `.reg`, drawn as `docs/handoff-pack/C1
 * Close.dc.html` draws them: SHOW and ORDER BY as segmented controls, the count
 * line as a status, then one table whose rows OPEN in place onto "What the
 * machine did". The pack's C3 · Triage the register.
 *
 * 🛑 REBUILT 2 Oct 2026 UNDER G3091, THE OWNER'S RULING. The previous component
 * — a plain table under three hatched explanation panels — is retrievable:
 * `git show 76f0341e:frontend/src/components/ExceptionRegister.tsx`. Its header
 * carried the argument for every column the contract does not serve, and those
 * arguments are unchanged; they now live in `docs/HANDOFF.md` G3094–G3097
 * rather than on the screen.
 *
 * 🛑 AND THE ACTION COLUMN CHANGED ON 3 Oct 2026 UNDER RC-04, THE OWNER'S RULING
 * (G3423): *"The register's Action column shows the pack's next act (Accept /
 * View / Reopen / Attach); Take/assign moves into the evidence panel, and
 * releasing someone else's row needs a confirm plus an undo toast."* So:
 *
 *   · the Action column is the row's NEXT ACT, by status (`NEXT_ACT`): a line
 *     that needs a decision offers Accept (the pack's filled commit shape), a
 *     line waiting on a proposal or an approval offers View (a real link to the
 *     finding), a cleared line offers Reopen. ✅ SINCE G3641 (3 Oct 2026)
 *     BOTH ARE LIVE: Accept proposes the line's one unambiguous disposition and
 *     posts it where the plane says no further approval is needed; Reopen asks
 *     for the closed reason and reverses (`register-acts.ts`). ⚠️ THIS READ
 *     *"Accept and Reopen are drawn and quiet (`<Soon>`): the resolution chain
 *     is served, and THIS screen does not drive it yet"* and is corrected
 *     rather than deleted. An act the session's role cannot take is HIDDEN
 *     (G3193) and the cell offers View instead. Attach is the pack's act for a line missing its document —
 *     the queue row carries no such signal, so the column never guesses it; it
 *     is offered (quietly) inside the evidence panel, where the pack also draws
 *     it;
 *   · TAKE / PUT DOWN live in the evidence panel's "Whose move" line, and are
 *     offered ONLY on a line that is still open or under investigation — never
 *     on a resolved line or one awaiting approval (RC-04);
 *   · acting on SOMEBODY ELSE'S line — taking it over or releasing it — asks
 *     first (a modal that names the act) and the caller raises an undo toast
 *     after the plane answers.
 *
 * WHAT EACH DRAWN COLUMN IS BOUND TO (`ExceptionQueueRow`, `listExceptions`):
 *   #           the row's position in this page — the order the plane served
 *   Line        `summary`, with a quiet "View finding" link to the finding route
 *   Value SGD   `valueAtRisk`, unit apart — or "not monetary". The header names
 *               the unit when every monetary line on the page shares one
 *   Variance    the pack's column. ✅ SERVED SINCE 3 Oct 2026 (G3542/G3544):
 *               the row's signed money variance, `+18,340.00` as C1 draws it;
 *               the dash where the plane serves `null` (no money variance, or
 *               one taken across currencies, which the plane refuses).
 *               ⚠️ THIS READ *"the queue row serves NO variance, and the column
 *               never guesses one"* AND IS CORRECTED RATHER THAN DELETED: true
 *               until the plane copied the stored delta onto the row
 *   Confidence  "no score", the pack's own `.noscore` state: the queue row
 *               serves none BY CONTRACT (a sortable number invites bulk approval)
 *   Status      `status` in words, with the severity and whose move it is
 *               beneath it
 *   Action      the next act, by status and by whose line it is (above)
 *
 * ⚠️ RC-18 / RC-19 (G3469), 3 Oct 2026 — THE FACETS, THE ORDER AND THE COLUMNS
 * ARE C1's. This drew SHOW `All lines · Needs you · Waiting · Cleared`, ORDER
 * `Severity · Value · Newest · Oldest` and a SEVERITY column the pack does not
 * have. C1 is `All lines · Needs you · Cleared · Parked` / `Line order · Value
 * · Variance · Status` / `Value SGD · Variance SGD`. Where the plane serves the
 * axis the control is live (`Line order` is the plane's own default order,
 * severity then value; `Value` is `value_at_risk_desc`); where it serves none
 * (no exception status is "parked"; no variance; no status sort) the control is
 * drawn quiet under G3091 rather than answered wrongly. Severity is still on
 * the row, as a word in the status cell (RC-35: plain text, never a seventh
 * indicator). `Newest`/`Oldest` are dropped — the pack does not draw them.
 *
 * THE FOOT ROW TOTALS ONLY WHEN THE PAGE IS ONE CURRENCY. Across currencies it
 * says so in words instead of drawing a number with no unit.
 *
 * ┌─ 🛑 THE ONE THING THIS COMPONENT MUST NEVER DO ────────────────────────────┐
 * │ RENDER COUNTERPARTY TEXT AS ANYTHING BUT TEXT. Invariant 6: *"Ingested     │
 * │ content is data, never instruction."* `summary` derives from a             │
 * │ counterparty document and is stored verbatim. React escapes a string       │
 * │ child, so `{row.summary}` is safe by construction — NEVER                  │
 * │ `dangerouslySetInnerHTML` on any field of a row, and never an `href`, a    │
 * │ `style` or a handler built out of one. `tests/e2e/browser-login.test.ts`   │
 * │ §8 seeds an instruction-shaped summary and requires its exact characters.  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * `data-exception`, `data-severity`, `data-status`, `data-assigned`, `data-act`,
 * `data-assign`, `data-whose` and `data-finding-link` are markup this surface
 * owes — each states a row's or a cell's SUBJECT — and the browser suite reads
 * them.
 */

/* THE FACETS, THE ORDER AND THE ROW'S NEXT ACT live in `close-state.ts` so
   `node --test` can pin them against the pack without a renderer (G3469). */
export { SHOWS, SHOW_KEYS, ORDERS, ORDER_CHOICES, QUIET_ORDERS, pageCurrency, nextActOf } from '../close-state.ts'
export type { ShowKey } from '../close-state.ts'

/* One vocabulary for the plane's statuses and severities: `words.ts` (RC-08's
   word maps), not a second copy here (§5.3). */
const STATUS_WORD = EXCEPTION_STATUS_WORD

const CLEARED: readonly ExceptionStatus[] = SHOWS.cleared.status

const ACT_WORD: Readonly<Record<NextAct, string>> = { accept: 'Accept', view: 'View', reopen: 'Reopen' }

const NONE: ReadonlySet<string> = new Set()

const WHOSE_SHORT: Readonly<Record<Whose, string>> = {
  nobody: 'unassigned',
  you: 'with you',
  someone: 'with a colleague',
  assigned: 'assigned',
}

/**
 * G3886 — the row's holder BY NAME when the plane names them (`assignedToName`,
 * `db/migrations/0520`'s co-member read, the owner's C3-05 ruling), else the
 * word above. A text node, verbatim (D6-9); `personWord()` is the one rule.
 */
function whoseShort(whose: Whose, row: Pick<ExceptionRow, 'assignedToName' | 'assignedToFormerMember'>): string {
  if (whose !== 'someone') return WHOSE_SHORT[whose]
  return `with ${personWord(null, null, row.assignedToName, row.assignedToFormerMember)}`
}

/** G4021 — the holder in a confirmation sentence: their name, "a former member", or "a colleague". */
function holderWord(row: Pick<ExceptionRow, 'assignedToName' | 'assignedToFormerMember'>): string {
  return personWord(null, null, row.assignedToName, row.assignedToFormerMember)
}

/** `900.00 SGD` — the finding's plain form, kept for the finding route. */
export function moneyText(money: Money | null): string {
  if (money === null) return 'not monetary'
  const { unit, figure } = moneyFigure(money)
  return `${figure.replace(/,/g, '')} ${unit}`
}

/**
 * RC-23 — the currency is a PREFIX IN A QUIETER STEP and the space after it is
 * a real character, not a CSS margin: `SGD 96,400.00` copied, read aloud or
 * drawn in a cell with no margin rule says what it is.
 */
function MoneyCell({ money }: { money: Money | null }) {
  if (money === null) return <span className="cu">not monetary</span>
  const { unit, figure } = moneyFigure(money)
  return (
    <>
      <span className="cu">{unit}</span> {figure}
    </>
  )
}

/**
 * G3544 — one Variance cell. The figure is SIGNED (`+18,340.00`, C1) because a
 * variance is a direction. The unit prefix is dropped when the column header
 * already names it, as C1's `Variance SGD` column draws bare figures; a line in
 * another currency keeps its unit so it is never read as the header's.
 */
function VarianceCellBody({ variance, unit }: { variance: Money; unit: string | null }) {
  const shown = varianceFigureOf(variance)
  if (shown === null) return null
  return shown.unit === unit ? <>{shown.figure}</> : <><span className="cu">{shown.unit}</span> {shown.figure}</>
}

function VarianceCell({ variance, unit }: { variance: Money | null; unit: string | null }) {
  return (
    <td className="num tier-mid" data-variance={variance === null ? 'none' : 'money'}>
      {variance === null ? '—' : <VarianceCellBody variance={variance} unit={unit} />}
    </td>
  )
}

function moneyShort(money: Money | null): string {
  if (money === null) return 'not monetary'
  const { unit, figure } = moneyFigure(money)
  return `${unit} ${figure}`
}

export type RegisterState = 'reading' | 'read' | 'refused'

/**
 * An act on whose move a line is. `prior` is set when the act DISPLACES a
 * colleague, so the caller can offer to put it back (the undo toast).
 */
export interface AssignAct {
  readonly exceptionId: string
  readonly assignedTo: string | null
  readonly prior: string | null
  readonly displaces: boolean
}

export interface ExceptionRegisterProps {
  readonly rows: readonly ExceptionRow[]
  /**
   * C3-18 — a SECTION of the register under its own heading (the owner's
   * "Unattributed" section): no facets, no order, no count line — the rows,
   * and the heading that says what they are.
   */
  readonly section?: { readonly heading: string; readonly note: string }
  readonly state?: RegisterState
  /** Why `state === 'refused'` — RC-11: a 429 is never told as a missing role. */
  readonly refusal?: RefusalKind
  /** The reconciliation the register is scoped to, for the loading line. */
  readonly scope?: string | null
  readonly nextCursor: string | null
  readonly estimatedTotal: number | null
  readonly counts?: Readonly<Record<ShowKey, number | null>>
  readonly show?: ShowKey
  readonly onShow?: (key: ShowKey) => void
  readonly order?: ExceptionSort
  readonly onOrder?: (order: ExceptionSort) => void
  /**
   * Take, put down, take over or release. Present only when the reader may
   * assign AND the plane told us who the reader is — without the reader's own
   * user id there is nothing true to send (G3426: the plane refuses an alias).
   */
  readonly onAssign?: (act: AssignAct) => void
  /** The acting person's user id (`getSessionPrincipal`), or `null` while unread. */
  readonly me?: string | null
  readonly findingLink?: (exceptionId: string) => LinkProps
  readonly openRow?: string | null
  readonly onToggle?: (exceptionId: string) => void
  readonly detail?: FindingLoad
  /** Whether the open evidence panel holds the page's one light — `luminous.ts`. */
  readonly litPanel?: boolean
  /** G3641 — Accept: propose (and post where no approval is needed). Absent = quiet. */
  readonly onAccept?: (row: ExceptionRow) => void
  /** G3644 — Reopen, with the closed reason the dialog asked for. Absent = quiet. */
  readonly onReopen?: (row: ExceptionRow, reason: ReversalReason) => void
  /** The line an act is in flight on — its controls say so and refuse a second press. */
  readonly actBusy?: string | null
  /** Lines the plane said have no resolution set up (G3441): Accept is quiet there. */
  readonly notConfigured?: ReadonlySet<string>
  /**
   * C3-11 (G3851) — the cleared lines whose resolution was posted inside the
   * plane's 24-hour reversal window. Reopen is drawn ONLY for these; a line
   * not in the set (window closed, or its posting time not yet read) offers
   * View instead.
   */
  readonly reopenable?: ReadonlySet<string>
}

/** The acts a row may take, threaded once from the register to its cells. */
interface RowActs {
  readonly onAccept: ((row: ExceptionRow) => void) | undefined
  readonly onReopen: ((row: ExceptionRow) => void) | undefined
  readonly busy: string | null
  readonly notConfigured: ReadonlySet<string>
  /** C3-11 — lines whose resolution is still inside the reversal window. */
  readonly reopenable: ReadonlySet<string>
}

/**
 * The act a row DRAWS — `nextActOf` narrowed by the session's capabilities
 * (G3193) and by the plane's `resolution_not_configured` (G3441).
 */
function useDrawnAct(row: ExceptionRow, me: string | null, acts: RowActs): NextAct {
  const propose = useHolds(DRAW_GATES.acceptLine)
  const reverse = useHolds(DRAW_GATES.reopenLine)
  return drawnActOf(nextActOf(row, me), { propose, reverse }, acts.reopenable.has(row.exceptionId))
}

/** Accept or Reopen as a real control — or quiet, where nothing drives it here. */
function LiveAct({ row, act, acts, className }: {
  readonly row: ExceptionRow
  readonly act: 'accept' | 'reopen'
  readonly acts: RowActs
  readonly className: string
}) {
  const run = act === 'accept' ? acts.onAccept : acts.onReopen
  if (run === undefined || (act === 'accept' && acts.notConfigured.has(row.exceptionId))) {
    return <Soon className={className} commit={act === 'accept'}>{ACT_WORD[act]}</Soon>
  }
  const busy = acts.busy === row.exceptionId
  return (
    <button
      className={className}
      type="button"
      {...(act === 'accept' ? { 'data-commit': '', 'data-accept': row.exceptionId } : { 'data-reopen': row.exceptionId })}
      aria-disabled={acts.busy !== null ? 'true' : undefined}
      aria-busy={busy ? 'true' : undefined}
      onClick={(e) => {
        e.stopPropagation()
        if (acts.busy !== null) return
        run(row)
      }}
    >
      {busy ? (act === 'accept' ? 'Accepting' : 'Reopening') : ACT_WORD[act]}
    </button>
  )
}

function pluralLines(n: number): string {
  return `${countOf(n)} ${n === 1 ? 'line' : 'lines'}`
}

function countLine(p: ExceptionRegisterProps, show: ShowKey, order: ExceptionSort): string {
  if (p.state === 'reading') {
    return p.scope === null || p.scope === undefined ? 'Reading the register.' : `Reading the register · ${p.scope}.`
  }
  if (p.state === 'refused') {
    if (p.refusal === 'role') return 'This register is not part of your role.'
    if (p.refusal === 'rate') return 'Too many requests from this browser — try again in a minute.'
    return 'The register could not be read just now.'
  }
  const total = p.counts?.[show] ?? p.estimatedTotal
  const head =
    total === null || total === undefined
      ? pluralLines(p.rows.length)
      : `${countOf(p.rows.length)} of ${pluralLines(total)}`
  const more = p.nextCursor === null ? '' : ' · more on the next page'
  return `${head} · ${SHOWS[show].label.toLowerCase()} · ordered by ${ORDERS[order].toLowerCase()}${more}`
}

/** A pending act on SOMEBODY ELSE'S line, waiting for the reader to confirm it. */
interface Pending {
  readonly act: AssignAct
  readonly verb: string
  readonly sentence: string
}

function Whose({
  row,
  me,
  onAssign,
  onAskFirst,
}: {
  readonly row: ExceptionRow
  readonly me: string | null
  readonly onAssign: ((act: AssignAct) => void) | undefined
  readonly onAskFirst: (p: Pending) => void
}) {
  const whose = whoseOf(row.assignedTo, me)
  const takeable = TAKEABLE.includes(row.status)
  const line =
    whose === 'nobody'
      ? 'Nobody has taken this line.'
      : whose === 'you'
        ? 'This line is with you.'
        : whose === 'someone'
          ? /* G3886 — by name when the plane names them; capitalised only when it is the fallback word.
               G4021 — and "a former member" when the plane says the holder's membership ended. */
            row.assignedToName === null || row.assignedToName.trim() === ''
            ? (row.assignedToFormerMember ? 'A former member has taken this line.' : 'A colleague has taken this line.')
            : `${row.assignedToName} has taken this line.`
          : 'Someone has taken this line.'
  const canAct = onAssign !== undefined && me !== null && takeable
  return (
    <div className="whose" data-whose={whose}>
      <span className="lab">Whose move</span>
      <p>
        {line}
        {takeable ? null : ' It is not open, so it cannot be taken.'}
      </p>
      {!canAct ? null : (
        <div className="acts">
          {whose === 'nobody' ? (
            <button
              className="abtn"
              type="button"
              data-assign={row.exceptionId}
              onClick={() => { onAssign({ exceptionId: row.exceptionId, assignedTo: me, prior: null, displaces: false }) }}
            >
              Take it
            </button>
          ) : whose === 'you' ? (
            <button
              className="abtn"
              type="button"
              data-assign={row.exceptionId}
              onClick={() => { onAssign({ exceptionId: row.exceptionId, assignedTo: null, prior: me, displaces: false }) }}
            >
              Put it down
            </button>
          ) : (
            <>
              <button
                className="abtn"
                type="button"
                data-assign={row.exceptionId}
                onClick={() => {
                  onAskFirst({
                    act: { exceptionId: row.exceptionId, assignedTo: me, prior: row.assignedTo, displaces: true },
                    verb: 'Take it over',
                    sentence: `This line is with ${holderWord(row)}. Taking it over moves it to you, and they stop seeing it as theirs.`,
                  })
                }}
              >
                Take it over
              </button>
              <button
                className="abtn"
                type="button"
                data-release={row.exceptionId}
                onClick={() => {
                  onAskFirst({
                    act: { exceptionId: row.exceptionId, assignedTo: null, prior: row.assignedTo, displaces: true },
                    verb: 'Release it',
                    sentence: `This line is with ${holderWord(row)}. Releasing it puts it back with nobody, and they stop seeing it as theirs.`,
                  })
                }}
              >
                Release it
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Evidence({ row, detail, link, onClose, lit, me, onAssign, onAskFirst, acts }: {
  readonly row: ExceptionRow
  readonly detail: FindingLoad | undefined
  readonly link: LinkProps | undefined
  readonly onClose: (() => void) | undefined
  readonly lit: boolean
  readonly me: string | null
  readonly onAssign: ((act: AssignAct) => void) | undefined
  readonly onAskFirst: (p: Pending) => void
  readonly acts: RowActs
}) {
  const drawn = useDrawnAct(row, me, acts)
  /* C1 — THE PANEL FOLDS: *"It is evidence, not a workspace — once the user has
     read it and acted from the row, it should be able to get out of the way
     without losing which line is open."* A fresh line opens unfolded, because
     the component is keyed on the row. */
  const [folded, setFolded] = useState(false)
  return (
    /* RM-03 — the machine's own drafted evidence holds the page's light when it
       is open (plain `lit`: finished work, no sweep). Which one thing is lit is
       `luminous.ts`'s answer, never this component's. */
    <div className={lit ? 'evid lit' : 'evid'} data-evidence={row.exceptionId} {...(lit ? { 'data-lit': 'panel' } : {})}>
      <div className="evid-in">
        <div className="evid-top">
          {/* RV-08 / NC-10 (G3474) — ONE SPELLING ON BOTH EVIDENCE SURFACES. The
              pack's label is *"What the machine did · {spend} ∴"*, and the mark
              trails a SPEND FIGURE. No per-finding spend is served, so this
              drew `· — ∴` — a mark trailing nothing, which the finding page did
              not draw. Both now say the label alone, and the figure and its
              mark return together the day a spend is served. */}
          <span className="lab">What the machine did</span>
          {/* NC-06 — the pack's two controls, in its words: the FOLD (*"Hide
              the evidence"* / *"Show the evidence"*) and the close glyph, whose
              name is a sentence a screen reader can say. The finding route is
              no longer labelled on the close control's corner; it is a link at
              the panel's foot, and the row's own "View finding". */}
          <span className="evctl">
            <button
              className="fold"
              type="button"
              aria-expanded={!folded}
              data-fold=""
              onClick={() => { setFolded((f) => !f) }}
            >
              {folded ? 'Show the evidence' : 'Hide the evidence'}
            </button>
            {onClose === undefined ? null : (
              <button className="x" type="button" onClick={onClose} data-close-evidence="">
                <span aria-hidden="true">✕</span> <span className="sr-only">Close the evidence</span>
              </button>
            )}
          </span>
        </div>
        <h3>{row.ruleLabel}</h3>
        {folded ? null : (
        <>
        {detail === undefined || detail.phase === 'reading' ? (
          <p className="q" aria-busy="true" data-reading="">Reading what the machine recorded.</p>
        ) : detail.phase !== 'read' ? (
          <p className="q">The explanation for this line could not be read here. Open the finding for the full record.</p>
        ) : (
          <>
            <p>{findingLine({ summary: detail.finding.explanation.summary, ruleLabel: detail.finding.ruleLabel })}</p>
            <ul className="ev">
              <li>
                <span>
                  <b>Expected, from the reference</b>
                  <span className="why">{detail.finding.explanation.expected}</span>
                </span>
              </li>
              <li>
                <span>
                  <b>Observed</b>
                  <span className="why">
                    {countOf(detail.finding.explanation.observed.length)} observed{' '}
                    {detail.finding.explanation.observed.length === 1 ? 'value' : 'values'}
                  </span>
                </span>
              </li>
              <li>
                <span>
                  <b>Extraction confidence</b>
                  <span className="why">
                    {detail.finding.explanation.confidence === null
                      ? 'not applicable — parsed, not extracted'
                      : `${Math.round(detail.finding.explanation.confidence * 100)}%`}
                  </span>
                </span>
              </li>
            </ul>
          </>
        )}
        <Whose row={row} me={me} onAssign={onAssign} onAskFirst={onAskFirst} />
        <span className="lab">What you can do</span>
        <div className="acts">
          {/* RV-04 — Accept is the pack's ONE commit act, drawn filled
              (`data-commit`). Live since G3641; hidden where the role may not
              propose (G3193). */}
          {drawn === 'accept' ? <LiveAct row={row} act="accept" acts={acts} className="abtn" /> : null}
          <Soon className="abtn">Reject</Soon>
          <Soon className="abtn">Park</Soon>
          <Soon className="abtn">Attach a document</Soon>
        </div>
        {link === undefined ? null : (
          <p className="q evlink">
            <a {...link} data-evidence-finding="">Open the finding</a>
          </p>
        )}
        </>
        )}
      </div>
    </div>
  )
}

/**
 * The row's Action cell — its next act (RC-04). `View` is a real route link;
 * `Accept` and `Reopen` are live since G3641 (⚠️ this said *"are quiet"* and is
 * corrected rather than deleted). The cell swallows its own clicks so acting
 * on a row never also toggles it open.
 */
function ActCell({ row, link, me, acts }: {
  readonly row: ExceptionRow
  readonly link: LinkProps | undefined
  readonly me: string | null
  readonly acts: RowActs
}) {
  const act = useDrawnAct(row, me, acts)
  const stop = (e: MouseEvent): void => { e.stopPropagation() }
  return (
    <td className="act tier-wide" data-act={act} onClick={stop}>
      {act === 'view' && link !== undefined ? (
        <a className="rowact" href={link.href} onClick={(e) => { e.stopPropagation(); link.onClick(e) }}>
          {ACT_WORD.view}
        </a>
      ) : act === 'view' ? (
        <Soon className="rowact">{ACT_WORD.view}</Soon>
      ) : (
        <LiveAct row={row} act={act} acts={acts} className="rowact" />
      )}
    </td>
  )
}

/**
 * J and K — the status bar's "J K move", made true (RV-09 draws the key-caps
 * in ink, so they must work). Move focus to the next or previous row of the
 * register when focus is not in a text field. ↵ already opens a row.
 */
/**
 * ESCAPE CLOSES THE OPEN EVIDENCE — NC-06 (G3470). The re-audit pressed Escape
 * with a row open and the panel stayed. Escape is every overlay's close path in
 * this product, and the evidence is the one inline surface that opens over the
 * register's flow, so it takes the same key — and gives focus back to the row
 * it opened from, so the next J/K continues from there.
 *
 * It stands down while a modal is up (the modal owns Escape — `useOverlay`) and
 * while the account menu is open, and when focus is in a text field.
 */
function useEscapeCloses(
  table: RefObject<HTMLTableElement | null>,
  openRow: string | null,
  onToggle: ((id: string) => void) | undefined,
  modalUp: boolean,
): void {
  useEffect(() => {
    if (openRow === null || onToggle === undefined || modalUp) return
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (document.querySelector('details.acct[open], [role="dialog"]') !== null) return
      const active = document.activeElement
      if (active instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return
      e.preventDefault()
      onToggle(openRow)
      const row = [...(table.current?.querySelectorAll<HTMLButtonElement>('tbody tr.row button.rowtog') ?? [])]
        .find((r) => r.getAttribute('data-row-toggle') === openRow)
      row?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [table, openRow, onToggle, modalUp])
}

function useRowKeys(table: RefObject<HTMLTableElement | null>, enabled: boolean): void {
  useEffect(() => {
    /* C3-18 — a register SECTION (Unattributed) takes no J/K of its own: two
       document-level handlers would both move focus on one key. */
    if (!enabled) return
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (key !== 'j' && key !== 'k') return
      const active = document.activeElement
      if (active instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return
      if (active instanceof HTMLElement && active.isContentEditable) return
      const rows = [...(table.current?.querySelectorAll<HTMLButtonElement>('tbody tr.row button.rowtog') ?? [])]
      if (rows.length === 0) return
      const at = rows.findIndex((r) => r === active || (active !== null && r.closest('tr')?.contains(active) === true))
      const next = at === -1 ? 0 : key === 'j' ? Math.min(at + 1, rows.length - 1) : Math.max(at - 1, 0)
      e.preventDefault()
      rows[next]?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [table, enabled])
}

/**
 * C3-28 (G4043) — the register's id, the skip link's target. Programmatically
 * focusable (`tabIndex={-1}`) and not a tab stop, like the route root.
 */
export const REGISTER_ID = 'register'

export function ExceptionRegister(props: ExceptionRegisterProps) {
  const { rows, onAssign, findingLink, openRow = null, onToggle, detail, me = null, litPanel = false } = props
  const show = props.show ?? 'all'
  const order = props.order ?? 'severity_then_value'
  const amounts = rows.map((r) => r.valueAtRisk).filter((m): m is Money => m !== null)
  const total = amounts.length === rows.length ? sumOf(amounts) : null
  const [pending, setPending] = useState<Pending | null>(null)
  const [reopening, setReopening] = useState<ExceptionRow | null>(null)
  const table = useRef<HTMLTableElement>(null)
  useRowKeys(table, props.section === undefined)
  useEscapeCloses(table, openRow, onToggle, pending !== null || reopening !== null)
  const onReopen = props.onReopen
  const acts: RowActs = {
    onAccept: props.onAccept,
    onReopen: onReopen === undefined ? undefined : setReopening,
    busy: props.actBusy ?? null,
    notConfigured: props.notConfigured ?? NONE,
    reopenable: props.reopenable ?? NONE,
  }
  const refused = props.state === 'refused'
  const unit = pageCurrency(rows)
  /* G3544 — the Variance header names ITS column's unit, and the foot totals
     the lines that carry a variance only when they share one. */
  const varianceUnit = varianceCurrency(rows)
  const variances = rows.map((r) => r.variance).filter((m): m is Money => m !== null)
  const varianceTotal = variances.length === 0 ? null : sumOf(variances)
  const varianceHeadUnit = variances.length === 0 ? unit : varianceUnit

  const toggle = (id: string) => (): void => { onToggle?.(id) }
  /* C3-19 — the row's acts are decided here once, so the row knows whether its
     Action is the finding link (then "View finding" is not a second tab stop
     to the same place). */
  const may = { propose: useHolds(DRAW_GATES.acceptLine), reverse: useHolds(DRAW_GATES.reopenLine) }

  return (
    <section id={REGISTER_ID} tabIndex={-1} className="register-c1" data-surface="exception-register" {...(refused ? { 'data-refused': props.refusal ?? 'other' } : {})}>
      {/* NC-04 — G3193 (*"refused controls are hidden"*) and E1 (*"a control
          it may not use is not offered"*): a register the reader may not read
          draws NO facets, NO order and NO count line — one refusal block,
          below, says why, once. */}
      {props.section === undefined ? null : (
        <div className="triage" data-register-section="">
          <h2 className="lab">{props.section.heading}</h2>
          <p className="count">{props.section.note}</p>
        </div>
      )}
      {refused || props.section !== undefined ? null : (
      <div className="triage">
        <div className="trirow">
          <div className="fac" role="group" aria-label="Show">
            <span className="lab">Show</span>
            {SHOW_KEYS.map((key) => (
              <button
                key={key}
                className="choice"
                type="button"
                aria-pressed={show === key}
                data-show={key}
                onClick={props.onShow === undefined ? undefined : () => { props.onShow?.(key) }}
              >
                <span>{SHOWS[key].label}</span>
                {props.counts?.[key] === null || props.counts?.[key] === undefined ? null : (
                  <span className="to">{countOf(props.counts[key] ?? 0)}</span>
                )}
              </button>
            ))}
            {/* ⛔ C3-17 (the owner's): no `Parked` facet — the pile above is the parked view. */}
          </div>
          <div className="fac" role="group" aria-label="Order by">
            <span className="lab">Order by</span>
            {ORDER_CHOICES.map((key) => (
              <button
                key={key}
                className="choice"
                type="button"
                aria-pressed={order === key}
                data-order={key}
                onClick={props.onOrder === undefined ? undefined : () => { props.onOrder?.(key) }}
              >
                <span>{ORDERS[key]}</span>
              </button>
            ))}
            {QUIET_ORDERS.map((label) => (
              <Soon key={label} className="choice">
                <span>{label}</span>
              </Soon>
            ))}
          </div>
        </div>
        <p className="count" role="status" data-count {...(props.state === 'reading' ? { 'data-reading': '' } : {})}>
          {countLine(props, show, order)}
        </p>
      </div>
      )}

      {/* RC-07 — a SINGLE-AXIS scroller (Design System, *Responsive*: "Every
          table in this system is therefore inside a single-axis scroller"). At
          mid the register keeps all its columns inside it; the page itself
          never scrolls sideways. */}
      <div className="reg" {...(props.state === 'reading' ? { 'aria-busy': true } : {})}>
        {refused ? null : (
        <table className="regt" ref={table}>
          <thead>
            <tr>
              {/* C3-19 — the column the table is ordered by says so. */}
              <th scope="col" className="c-ref" {...(order === 'severity_then_value' ? { 'aria-sort': 'ascending' as const } : {})}>#</th>
              <th scope="col" className="c-line">Line</th>
              <th scope="col" className="num c-val" {...(order === 'value_at_risk_desc' ? { 'aria-sort': 'descending' as const } : {})}>
                {unit === null ? 'Value' : `Value ${unit}`}
              </th>
              <th scope="col" className="num tier-mid c-var">{varianceHeadUnit === null ? 'Variance' : `Variance ${varianceHeadUnit}`}</th>
              <th scope="col" className="tier-wide c-conf">Confidence</th>
              <th scope="col" className="tier-wide c-state">Status</th>
              <th scope="col" className="num tier-wide c-act">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const open = openRow === row.exceptionId
              const link = findingLink?.(row.exceptionId)
              const whose = whoseOf(row.assignedTo, me)
              return [
                <tr
                  key={row.exceptionId}
                  className="row"
                  data-exception={row.exceptionId}
                  data-kind={CLEARED.includes(row.status) ? 'cleared' : 'open'}
                  /* C3-19 (G3848) — THE ROW IS NO LONGER A BUTTON. A
                     `tr[role=button]` holding a link and an Action control is
                     nested interactive content, and cost three tab stops per
                     row. The disclosure is ONE real button in the first cell
                     (J/K, ↵ and Escape drive it); a click anywhere on the row
                     still opens it, as a mouse convenience. */
                  {...(open ? { 'data-open': '' } : {})}
                  {...(onToggle === undefined ? {} : { onClick: toggle(row.exceptionId) })}
                >
                  <td className="ref">
                    {onToggle === undefined ? (
                      i + 1
                    ) : (
                      <button
                        type="button"
                        className="rowtog"
                        data-row-toggle={row.exceptionId}
                        aria-expanded={open}
                        aria-label={`Line ${String(i + 1)} — ${open ? 'hide' : 'show'} the evidence`}
                        onClick={(e) => { e.stopPropagation(); onToggle(row.exceptionId) }}
                      >
                        {i + 1}
                      </button>
                    )}
                  </td>
                  <td className="what">
                    <span className="wl">{findingLine(row)}</span>
                    {/* RC-15 — the line text, not the reference, is what the eye
                        reads; the finding route is one quiet word away, and the
                        finding prints its reference for a person who must quote
                        it. (Never a `title` — G189.) */}
                    {link === undefined ? null : (
                      /* NC-07 (G3470) — this read "Open", beside a status
                         column that also says "Open": one word, two meanings,
                         on every row. It names its destination now. */
                      <a
                        className="spent open"
                        data-finding-link={row.exceptionId}
                        /* C3-19 — when the Action is already View (the same
                           finding), this is not a second tab stop to it. */
                        {...(drawnActOf(nextActOf(row, me), may, acts.reopenable.has(row.exceptionId)) === 'view' ? { tabIndex: -1 } : {})}
                        href={link.href}
                        onClick={(e) => { e.stopPropagation(); link.onClick(e) }}
                      >
                        View finding
                      </a>
                    )}
                    {/* RC-07 / the pack's narrow tier: the register triages to
                        three columns and folds value, status and whose move into
                        the row's second line. Hidden at mid and above. */}
                    <span className="fold2" aria-hidden="true">
                      {moneyShort(row.valueAtRisk)} · {STATUS_WORD[row.status]} · {whoseShort(whose, row)}
                    </span>
                  </td>
                  <td className="num" data-value-at-risk={row.valueAtRisk === null ? 'none' : 'money'}>
                    <MoneyCell money={row.valueAtRisk} />
                  </td>
                  {/* C1's Variance column (G3544): the row's signed money
                      variance as served; the dash where the plane serves none —
                      never a guess, never a 0. */}
                  <VarianceCell variance={row.variance} unit={varianceUnit} />
                  <td className="conf tier-wide"><span className="noscore">no score</span></td>
                  <td className="state tier-wide">
                    <b data-status={row.status}>{STATUS_WORD[row.status]}</b>
                    <span className="why">
                      {/* RC-35 — severity is a WORD on the line's status, not a
                          column and not a seventh indicator. */}
                      <span className="sev" data-severity={row.severity}>{SEVERITY_WORD[row.severity]}</span>
                      {' · '}
                      <span data-assigned={row.assignedTo ?? ''} data-whose={whose}>{whoseShort(whose, row)}</span>
                    </span>
                  </td>
                  <ActCell row={row} link={link} me={me} acts={acts} />
                </tr>,
                open ? (
                  <tr key={`${row.exceptionId}:open`} className="exprow">
                    <td className="exp" colSpan={7}>
                      <Evidence
                        key={row.exceptionId}
                        row={row}
                        detail={detail}
                        link={link}
                        onClose={onToggle === undefined ? undefined : toggle(row.exceptionId)}
                        lit={litPanel}
                        me={me}
                        onAssign={onAssign}
                        onAskFirst={setPending}
                        acts={acts}
                      />
                    </td>
                  </tr>
                ) : null,
              ]
            })}
          </tbody>
          {rows.length === 0 ? null : (
            <tfoot>
              <tr className="totals">
                <td />
                <td className="lbl">{pluralLines(rows.length)} on this page</td>
                <td className="num">
                  {total === null ? (
                    <span className="q">{amounts.length === rows.length ? 'mixed currencies' : 'not all monetary'}</span>
                  ) : (
                    <MoneyCell money={total} />
                  )}
                </td>
                <td className="num tier-mid" data-variance-total={variances.length === 0 ? 'none' : varianceTotal === null ? 'mixed' : 'money'}>
                  {variances.length === 0 ? null : varianceTotal === null ? (
                    <span className="q">mixed currencies</span>
                  ) : (
                    <VarianceCellBody variance={varianceTotal} unit={varianceUnit} />
                  )}
                </td>
                <td className="tier-wide" />
                <td className="tier-wide" />
                <td className="tier-wide" />
              </tr>
            </tfoot>
          )}
        </table>
        )}
        {rows.length === 0 && props.state !== 'reading' && (
          <div className="stated" data-empty="exceptions">
            <span className="lab">{refused ? 'The register' : SHOWS[show].label}</span>
            <h2>
              {props.state === 'refused'
                ? props.refusal === 'role'
                  ? 'This register is not part of your role.'
                  : props.refusal === 'rate'
                    ? 'Too many requests from this browser.'
                    : 'The register could not be read just now.'
                : show === 'all'
                  ? 'No exception is waiting in this register.'
                  : `No line is in “${SHOWS[show].label}”.`}
            </h2>
            <p>
              {props.state === 'refused'
                ? props.refusal === 'role'
                  ? 'Ask your administrator for the role that reads exceptions.'
                  : props.refusal === 'rate'
                    ? 'Try again in a minute — nothing was changed.'
                    : 'Reload the page to try again.'
                : show === 'all'
                  ? 'When a run raises one it lands here, with what the machine did beside it.'
                  : 'Choose All lines to see every line in this register.'}
            </p>
          </div>
        )}
      </div>
      <Surface
        kind="modal"
        open={pending !== null}
        onDismiss={() => { setPending(null) }}
        title={pending?.verb ?? ''}
        footer={
          pending === null ? null : (
            <>
              <button
                className="btn btn--primary btn--small"
                type="button"
                data-confirm-assign={pending.act.exceptionId}
                onClick={() => {
                  const act = pending.act
                  setPending(null)
                  onAssign?.(act)
                }}
              >
                {pending.verb}
              </button>
              <button className="btn btn--small" type="button" onClick={() => { setPending(null) }}>Cancel</button>
            </>
          )
        }
      >
        <p>{pending?.sentence}</p>
        <p className="ov-why">You can undo this from the notice that follows.</p>
      </Surface>
      <ReopenDialog
        line={reopening}
        onCancel={() => { setReopening(null) }}
        onReopen={(reason) => {
          const row = reopening
          setReopening(null)
          if (row !== null) onReopen?.(row, reason)
        }}
      />
    </section>
  )
}

import type { ExceptionStatus, RunStatus } from '../../model/domain.ts'
import type { ExceptionRow, ExceptionSort, Money } from './api/exceptions.ts'
import { capitalised, moneyFigure, wordOf } from './format.ts'

/**
 * THE CLOSE SCREEN'S PURE DECISIONS — fix/ui-close-surface, G3421–G3440.
 *
 * Plain TypeScript and no JSX, so `tests/app/close-surface.test.ts` can run
 * every one of them under `node --test` without a renderer. The components
 * (`Register.tsx`, `ExceptionRegister.tsx`, `Shell.tsx`) import them; nothing
 * here draws.
 */

/**
 * WHY A READ WAS REFUSED, in the one vocabulary the Close screen speaks — RC-11.
 * A 403 is a ROLE; a 429 is a RATE LIMIT and is never reported as a missing
 * role; anything else is a read that did not complete. Derived from the
 * STATUS, never from the plane's `detail`.
 */
export type RefusalKind = 'role' | 'rate' | 'other'
export function refusalKindOf(status: number | null): RefusalKind {
  if (status === 403) return 'role'
  if (status === 429) return 'rate'
  return 'other'
}

/**
 * THE ROW'S NEXT ACT, BY STATUS — RC-04, THE OWNER'S RULING (G3423): *"The
 * register's Action column shows the pack's next act (Accept / View / Reopen /
 * Attach); Take/assign moves into the evidence panel."* Total over the seven
 * statuses, so an eighth is a compile error at this table rather than a row
 * whose Action cell is silently empty.
 *
 *   accept  — a decision is the next act. The pack's filled commit button.
 *   view    — a proposal or an approval is in flight; you look, you do not act.
 *   reopen  — the line is cleared; undoing a resolution is the only act left.
 *
 * ⚠️ ATTACH IS NOT AN ARM: it is the pack's act for a line MISSING ITS
 * DOCUMENT, and the queue row carries no such signal — so the column never
 * guesses it. It is offered inside the evidence panel, where the pack also
 * draws it.
 */
export type NextAct = 'accept' | 'view' | 'reopen'
export const NEXT_ACT: Readonly<Record<ExceptionStatus, NextAct>> = {
  open: 'accept',
  investigating: 'accept',
  resolution_proposed: 'view',
  pending_approval: 'view',
  resolved: 'reopen',
  rejected: 'reopen',
  dismissed: 'reopen',
}

/** Take and put-down are offered on a line that is still open — never on one cleared or awaiting approval (RC-04). */
export const TAKEABLE: readonly ExceptionStatus[] = ['open', 'investigating']

/**
 * Whose move a line is, relative to the reader. `assigned` is the honest
 * answer while the reader's own id is unread: the line is taken, and whether by
 * the reader is not yet known — never guessed as "a colleague".
 */
export type Whose = 'nobody' | 'you' | 'someone' | 'assigned'
export function whoseOf(assignedTo: string | null, me: string | null): Whose {
  if (assignedTo === null) return 'nobody'
  if (me === null) return 'assigned'
  return assignedTo === me ? 'you' : 'someone'
}

/**
 * THE GREETING'S CLAIM — the pack's *"Five of the fourteen exceptions need
 * you."* `null` (no claim drawn) whenever either count is unread, which since
 * RC-16 includes "the register is still being read".
 */
export function claimOf(needs: number | null | undefined, total: number | null | undefined): string | null {
  if (needs === null || needs === undefined || total === null || total === undefined) return null
  if (total === 0) return 'No exception is waiting on anyone.'
  if (total === 1) return needs === 1 ? 'The one exception needs you.' : 'The one exception is with someone else.'
  if (needs === 0) return `None of the ${wordOf(total)} exceptions needs you.`
  return `${capitalised(wordOf(needs))} of the ${wordOf(total)} exceptions ${needs === 1 ? 'needs' : 'need'} you.`
}

export const SHOWS = {
  all: { label: 'All lines', status: [], mine: false },
  /**
   * 🛑 "NEEDS YOU" — G3424 (RC-03), 3 Oct 2026, DERIVED: a line that is still
   * OPEN (open or investigating) AND is either unassigned or assigned to YOU.
   *
   * ⚠️ THIS DEPARTS FROM THE PACK'S WORDING ON PURPOSE. The pack counts the
   * lines whose next act is a decision — every open line — and its own Design
   * System says *"the product never says a thing it cannot evidence"*. A line a
   * colleague has taken is not waiting on you: telling Mei that seventeen lines
   * need her, six of them in Rosalie's hands, is the claim RC-03 measured. An
   * UNASSIGNED open line is everyone's move, yours included, so it counts.
   */
  needs: { label: 'Needs you', status: ['open', 'investigating'], mine: true },
  cleared: { label: 'Cleared', status: ['resolved', 'rejected', 'dismissed'], mine: false },
} as const satisfies Record<
  string,
  { readonly label: string; readonly status: readonly ExceptionStatus[]; readonly mine: boolean }
>
export type ShowKey = keyof typeof SHOWS
export const SHOW_KEYS = Object.keys(SHOWS) as readonly ShowKey[]

/*
 * ⛔ C1's fourth SHOW facet, `Parked`, IS RETIRED — THE OWNER'S RULING ON
 * C3-17, 4 Oct 2026: *"Retire the register's Parked filter (the pile is the
 * parked view)."* It was drawn quiet (`Coming soon`, RC-18) directly under the
 * Awaiting-setup pile that IS the parked population, so the facet named a set
 * that was drawn elsewhere and counted nowhere. `PARKED_LABEL` is deleted with
 * it; the pile (`ParkedPile.tsx`) is the parked view.
 */

/** The words for every order the plane serves; `ORDER_CHOICES` is what is drawn. */
export const ORDERS: Readonly<Record<ExceptionSort, string>> = {
  severity_then_value: 'Line order',
  value_at_risk_desc: 'Value',
  raised_at_desc: 'Newest',
  raised_at_asc: 'Oldest',
}

/** The live half of C1's ORDER BY: the two the plane serves that the pack draws. */
export const ORDER_CHOICES: readonly ExceptionSort[] = ['severity_then_value', 'value_at_risk_desc']

/** The quiet half: the pack draws them and the plane serves no such sort. */
export const QUIET_ORDERS: readonly string[] = ['Variance', 'Status']

/**
 * The page's ONE currency, or `null` when the monetary lines disagree or there
 * are none. C1's header reads "Value SGD"; a header naming a unit the column
 * does not uniformly hold would be a claim, so it names one only when true.
 */
export function pageCurrency(rows: readonly ExceptionRow[]): string | null {
  const units = new Set(
    rows.map((r) => r.valueAtRisk).filter((m): m is Money => m !== null).map((m) => moneyFigure(m).unit),
  )
  return units.size === 1 ? ([...units][0] ?? null) : null
}

/**
 * THE ROW'S NEXT ACT — RC-04 (G3423) by status, and NC-05 (G3470) by whose line
 * it is. An open line in a COLLEAGUE's hands is not the reader's to accept, so
 * its next act is View (the finding), exactly as C1 draws `View` where the act
 * is not the reader's. A line held by somebody the client cannot name (`me`
 * unread) is treated the same way: Accept is offered only where it may be ours.
 */
export function nextActOf(row: ExceptionRow, me: string | null): NextAct {
  const act = NEXT_ACT[row.status]
  if (act !== 'accept') return act
  const whose = whoseOf(row.assignedTo, me)
  return whose === 'someone' || whose === 'assigned' ? 'view' : 'accept'
}

/* ==================================================================== *
 * G3443–G3445 — fix/ui-server-truth, 3 Oct 2026 (reaudit NC-02, NC-03, RC-10)
 * ==================================================================== */

/** The run states during which the engine has not finished reading. */
const STILL_READING: readonly RunStatus[] = ['queued', 'running']

export function isStillReading(status: RunStatus): boolean {
  return STILL_READING.includes(status)
}

/**
 * U-12 (G4136) — the claim over a run with nothing raised yet, in the pack's
 * word. `running` is real since G4132, so the two still-reading states are
 * told apart: a `running` run is READING (the pack's `says:'reading · 62%'`,
 * `title:'… is reading'`), and a `queued` one has not started. G3444 chose
 * "running" only because `tests/e2e`'s `settled()` waited on the word
 * "reading" leaving the page; that helper now waits on `data-reading` instead.
 */
function stillReadingClaim(status: RunStatus): string {
  return status === 'running'
    ? 'Still reading — exceptions land here as they are raised.'
    : 'Queued — exceptions land here as they are raised.'
}

/**
 * WHICH RECONCILIATION C1 OPENS ON — NC-02. The pack opens on the one with the
 * work (*"Three-way match · 5 need you"*), and the screen opened on the most
 * recent definition — a running `Bank to ERP` with an empty register — while
 * the chrome said `Needs you 3`.
 *
 *   1. the most recent FINISHED reconciliation holding a line that needs the
 *      reader (`needsDefinitions`);
 *   2. else the most recent one whose latest run has FINISHED reading — the
 *      audit's *"or the most recent completed run"*: a reading run's register
 *      is still filling, and opening on it asserts a state that is moving;
 *   3. else the most recent one holding the reader's lines, even if reading;
 *   4. else the most recent one.
 *
 * `groups` is the strip's order (most recent first). A definition the reader
 * picked always wins — this is only the default.
 */
export function defaultDefinitionOf(
  groups: readonly { readonly definitionId: string; readonly runs: readonly { readonly status: RunStatus }[] }[],
  needsDefinitions: readonly string[] | null,
): string | null {
  const needs = new Set(needsDefinitions ?? [])
  const done = (g: (typeof groups)[number]): boolean => {
    const latest = g.runs[0]
    return latest !== undefined && !isStillReading(latest.status)
  }
  const pick =
    groups.find((g) => needs.has(g.definitionId) && done(g)) ??
    groups.find(done) ??
    groups.find((g) => needs.has(g.definitionId)) ??
    groups[0]
  return pick?.definitionId ?? null
}

/**
 * WHICH RUN OF THE SELECTED RECONCILIATION C1 OPENS ON — G3626, 3 Oct 2026,
 * under the owner's G3621 (*"the register, counts and 'Needs you' can scope to
 * the selected run"*). Since the register is the selected RUN's, opening on a
 * definition's latest run when that run is still reading — or raised nothing
 * for the reader — draws an empty register while the reader's work sits one
 * period back. So, within `runs` (most recent first):
 *
 *   1. the most recent FINISHED run holding a line that needs the reader
 *      (`needsRuns`, read tenant-wide from the same needs read as NC-02);
 *   2. else the most recent run holding one, even if reading;
 *   3. else the most recent run.
 *
 * A run the reader picked always wins — this is only the default.
 */
export function defaultRunOf(
  runs: readonly { readonly runId: string; readonly status: RunStatus }[],
  needsRuns: readonly string[] | null,
): string | null {
  const needs = new Set(needsRuns ?? [])
  const pick =
    runs.find((r) => needs.has(r.runId) && !isStillReading(r.status)) ??
    runs.find((r) => needs.has(r.runId)) ??
    runs[0]
  return pick?.runId ?? null
}

/**
 * THE GREETING'S CLAIM, SCOPED — NC-02 and NC-03. `claimOf()` says nothing
 * about WHICH population it counts, and the arrival beside it shows one RUN's
 * figure; so the claim names its scope, and on a run that is still reading it
 * never asserts "no exception" — it says the run is still reading.
 *
 * ⚠️ G3626 — THE SCOPE IS THE SELECTED RUN, NOT THE RECONCILIATION. Since
 *    `db/migrations/0480` an exception records the run that raised it, and the
 *    counts behind this sentence are that run's (`runId` on the facets). The
 *    sentence said *"… in Three-way match"* until then, which was true of the
 *    population it counted; it now says *"… in this run of Three-way match"*,
 *    because a reader comparing it with the period stepper beside it must not
 *    read a run's count as the whole reconciliation's.
 */
export function scopedClaimOf(
  needs: number | null | undefined,
  total: number | null | undefined,
  scope: { readonly label: string; readonly status: RunStatus } | null,
): string | null {
  if (scope !== null && isStillReading(scope.status) && total === 0) {
    return stillReadingClaim(scope.status)
  }
  if (scope === null) return claimOf(needs, total)
  if (needs === null || needs === undefined || total === null || total === undefined) return null
  const where = `in this run of ${scope.label}`
  if (total === 0) return `No exception is waiting on anyone ${where}.`
  if (total === 1) return needs === 1 ? `The one exception ${where} needs you.` : `The one exception ${where} is with someone else.`
  if (needs === 0) return `None of the ${wordOf(total)} exceptions ${where} needs you.`
  /* C3-29 (G3845) — "Four of the four exceptions … need you" when the parts
     equal the whole. */
  if (needs === total) return `All ${wordOf(total)} exceptions ${where} need you.`
  return `${capitalised(wordOf(needs))} of the ${wordOf(total)} exceptions ${where} ${needs === 1 ? 'needs' : 'need'} you.`
}

/**
 * WHO THE GREETING IS SPEAKING TO — C3-07, THE OWNER'S RULING, 4 Oct 2026:
 * *"Role sentences: viewer 'N open exceptions in this run'; approver 'N
 * proposals wait on your approval'; actors keep 'N need you'."*
 *
 *   actor     holds `propose_resolution` or `assign_exception` — triage (taking
 *             a line, resolving it) is theirs, so "need you".
 *   approver  holds `approve_resolution` and neither of those — their work is
 *             approvals, never a line.
 *   viewer    neither — reads; nothing is theirs to act on.
 *
 * Before this, the viewer and the approver read "Ten of the twenty exceptions
 * need you" over a register in which every Action was View.
 */
export type ClaimRole = 'actor' | 'approver' | 'viewer'

export function claimRoleOf(may: { readonly act: boolean; readonly approve: boolean }): ClaimRole {
  if (may.act) return 'actor'
  return may.approve ? 'approver' : 'viewer'
}

export function roleClaimOf(
  role: ClaimRole | null,
  n: {
    readonly needs: number | null | undefined
    readonly total: number | null | undefined
    /** Open (open or investigating) lines in the scope, whoever holds them. */
    readonly open: number | null | undefined
    /** Proposals waiting on THIS reader's approval, tenant-wide. */
    readonly approvals: number | null | undefined
  },
  scope: { readonly label: string; readonly status: RunStatus } | null,
): string | null {
  if (role === null) return null
  if (role === 'actor') return scopedClaimOf(n.needs, n.total, scope)
  if (role === 'approver') {
    const a = n.approvals
    if (a === null || a === undefined) return null
    if (a === 0) return 'No proposal waits on your approval.'
    if (a === 1) return 'One proposal waits on your approval.'
    return `${capitalised(wordOf(a))} proposals wait on your approval.`
  }
  const o = n.open
  if (o === null || o === undefined) return null
  if (scope !== null && isStillReading(scope.status) && o === 0) {
    return stillReadingClaim(scope.status)
  }
  const where = scope === null ? '' : ' in this run'
  if (o === 0) return `No open exceptions${where}.`
  if (o === 1) return `One open exception${where}.`
  return `${capitalised(wordOf(o))} open exceptions${where}.`
}

/**
 * WHAT A STRIP CELL SAYS ABOUT ITS RUN — RC-10, in the pack's register:
 * *"5 need you · 14 open"*, *"clean · 1,184 posted"*, *"reading · 62%"*,
 * *"extraction stopped"*.
 *
 * ✅ REWORDED 4 Oct 2026 — C3-14 (G3843, DERIVED). The cell read *"completed ·
 * 9 need you · 14 raised · engine observed no shortfall"*, and at 1440 the
 * ellipsis cut it after the second clause, so the only words a reader saw
 * were the engine's own. Now each part is a plain word, a finished run that
 * says something says it WITHOUT a status word in front, and the engine's
 * completeness is said only when it found a gap — *"lines not read in"*.
 *
 *   state   — `running` and `queued` while the engine reads (⚠️ NOT the pack's
 *             `reading`: on this surface "reading" means a read in flight, and
 *             `tests/e2e`'s `settled()` waits for that word to leave — G3445);
 *             `stopped` for a failed run, otherwise the status word itself
 *             (`completed`, `incomplete` — G153 keeps them apart in WORDS), drawn
 *             LAST so the reader's counts lead.
 *   raised  — how many exceptions THIS RUN raised, once it finished and the
 *             plane recorded a count; `null` = not recorded.
 *   gaps    — the completeness answer in plain words: `every line read in`,
 *             `lines not read in`, or `account not recorded` — never the
 *             engine's own "observed no shortfall".
 *   needs   — G3626: the pack's per-cell *"5 need you"* — how many of THIS
 *             RUN's open lines are unassigned or the reader's. `null` = not
 *             read, or zero.
 */
export function stripSaysOf(
  run: {
    readonly status: RunStatus
    readonly exceptionsRaised: number | null
    readonly completeness?: readonly unknown[] | null
  },
  needsYou: number | null = null,
): { readonly state: string; readonly raised: string | null; readonly gaps: string | null; readonly needs: string | null } {
  const needs =
    needsYou === null || needsYou <= 0
      ? null
      : `${needsYou.toLocaleString('en-GB')} ${needsYou === 1 ? 'needs' : 'need'} you`
  /* U-12 (G4136) — the pack's word for a running run: `reading`. */
  if (isStillReading(run.status)) {
    return { state: run.status === 'running' ? 'reading' : run.status, raised: null, gaps: null, needs }
  }
  const count = run.exceptionsRaised
  const raised = count === null ? null : count === 0 ? 'none raised' : `${count.toLocaleString('en-GB')} raised`
  /* G153 — the status stays a WORD (`completed` and `incomplete` read
     differently), and the completeness cell always carries one of its three
     answers (`tests/design/shell.test.ts` §5): an absent account is said, never
     left blank. */
  const kind = run.completeness === undefined ? 'absent' : run.completeness === null ? 'absent' : run.completeness.length === 0 ? 'empty' : 'accounted'
  const gaps = kind === 'absent' ? 'account not recorded' : kind === 'empty' ? 'every line read in' : 'lines not read in'
  if (run.status === 'failed') return { state: 'stopped', raised: null, gaps, needs }
  return { state: run.status, raised, gaps, needs }
}

/**
 * THE ARRIVAL'S `Matched` AND `In variance` — G3543, 3 Oct 2026.
 *
 * Both were drawn quiet (`Coming soon`) under G3444 because nothing served
 * them. `getRunAccount` now serves `settlementTallies` (G3541): per side, the
 * admitted items the engine fully settled and the open items' residual,
 * summed by the plane through `model/money.ts`. This draws them and computes
 * nothing.
 *
 * ⚠️ THE ARRIVAL DRAWS THE `left` SIDE, AND THAT IS A PRESENTATION CHOICE THE
 *    WIRE DOES NOT MAKE. Both sides added together would count a matched pair
 *    twice and an unmatched one once; C1 draws ONE `Matched` and ONE `In
 *    variance` over "lines", and the definition's left population is the one
 *    the register's lines are raised against (the demo seed projects one
 *    exception per LEFT residue entry). Nothing in `model/` names a subject
 *    side, so if the owner rules otherwise this constant is the one place it
 *    moves.
 *
 *   unmeasured  — no produced account (still running, refused, or none): `—`,
 *                 as Coverage beside it. NEVER a zero.
 *   none        — the engine left nothing open on the side: `—`, as C1 draws
 *                 its clean run's `In variance`. Not "0.00": a zero needs a
 *                 currency and an empty side has none.
 *   mixed       — open residuals in more than one currency: the plane REFUSED
 *                 the sum (no FX), and the figure says so in words.
 */
export const ARRIVAL_SIDE = 'left'

export type InVariance =
  | { readonly kind: 'none' }
  | { readonly kind: 'money'; readonly money: Money }
  | { readonly kind: 'mixed' }

export type ArrivalSettlement =
  | { readonly kind: 'unmeasured' }
  | { readonly kind: 'measured'; readonly matched: number; readonly inVariance: InVariance }

interface TallyLike {
  readonly side: string
  readonly matched: number
  readonly unsettled:
    | { readonly kind: 'nothing_open' }
    | { readonly kind: 'total'; readonly total: Money }
    | { readonly kind: 'mixed_units' }
}

/**
 * ⚠️ G3885 — `In variance` WAS THE ARRIVAL SIDE'S OWN `unsettled` TOTAL — a
 * MAGNITUDE of one side — AND IS CORRECTED RATHER THAN DELETED. The owner's
 * C3-02/C3-09 ruling defines it: *"'In variance' is defined as the open
 * residual"*, which the plane now serves as `openResidual` (G3804, left minus
 * right, possibly negative) and which equals the register's Variance total.
 * `Matched` is still the arrival side's tally. With no `openResidual` (an
 * account read from an older plane) the figure is `unmeasured`, never the old
 * one-sided sum: a figure the register cannot reconcile to is worse than a dash.
 */
export function arrivalSettlementOf(
  tallies: readonly TallyLike[] | null,
  openResidual: TallyLike['unsettled'] | null = null,
): ArrivalSettlement {
  const tally = tallies?.find((t) => t.side === ARRIVAL_SIDE)
  if (tally === undefined || openResidual === null) return { kind: 'unmeasured' }
  const u = openResidual
  const inVariance: InVariance =
    u.kind === 'total' ? { kind: 'money', money: u.total } : u.kind === 'nothing_open' ? { kind: 'none' } : { kind: 'mixed' }
  return { kind: 'measured', matched: tally.matched, inVariance }
}

/**
 * THE REGISTER'S VARIANCE CELL — G3544. C1 draws `+18,340.00` under a
 * `Variance SGD` header: SIGNED, with an explicit `+`, because a variance is a
 * direction (the invoice is over the order) and an unsigned figure reads as a
 * value. `null` from the plane is the dash: no money variance on the line, or
 * one taken across currencies (refused by the plane, G3542).
 */
export function varianceFigureOf(variance: Money | null): { readonly unit: string; readonly figure: string } | null {
  if (variance === null) return null
  /* ⚠️ G3884 — THIS ADDED A `+` TO EVERY NON-NEGATIVE FIGURE, AND THE PLANE
     SERVED A MAGNITUDE, SO EVERY VARIANCE READ "OVER" — including an `under`.
     Since G3803 `ExceptionQueueRow.variance` IS SIGNED (`amountMinor` negative
     for `under`), so the sign is DRAWN AS SERVED and nothing is added: the
     owner's C3-02 ruling, *"the column shows sign, totals net correctly"*. */
  return moneyFigure(variance)
}

/**
 * The page's ONE variance currency, or `null` — `pageCurrency()` for the
 * Variance column, so its header names a unit only when every line carrying a
 * variance shares it.
 */
export function varianceCurrency(rows: readonly ExceptionRow[]): string | null {
  const units = new Set(rows.map((r) => r.variance).filter((m): m is Money => m !== null).map((m) => m.currency))
  return units.size === 1 ? ([...units][0] ?? null) : null
}

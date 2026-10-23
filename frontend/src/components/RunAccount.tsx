import { useState, type ReactNode } from 'react'

import { Soon } from './Soon.tsx'
import { Trail } from './Trail.tsx'
import { completenessKind, completenessWord } from '../completeness.ts'
import type { Money } from '../api/exceptions.ts'
import type {
  AdmissionRate,
  ResidueEntry,
  Run,
  RunDocumentAccount,
  RunEngineAccount,
} from '../api/runs.ts'
import { definitionLabel, periodLabel } from '../api/runs.ts'
import { clockOf, countOf, moneyFigure, whenOf } from '../format.ts'
import { pageOf } from '../resolve-logic.ts'
import { documentNameOf, documentNamesOf, emptyResidueSentenceOf, lineCellOf } from '../run-account-words.ts'
import type { LinkProps } from '../routes/useRoute.ts'
import {
  POSTCONDITION_WORD,
  RESIDUE_CAUSE_WORD,
  RESIDUE_DISPOSITION_WORD,
  RUN_STATUS_WORD,
  SIDE_WORD,
  TERMINAL_STATUS_WORD,
  TRAILER_WORD,
  TRIGGER_WORD,
  VERDICT_WORD,
  labelOf,
  sentenceOf,
} from '../words.ts'

/**
 * ONE RUN'S OWN ACCOUNT — the surface `/close/run/:runId` addresses, drawn
 * against `getRun`, `getRunAccount` and `listRunResidue`.
 *
 * ✅ REDRAWN 3 Oct 2026 — RC-09, RC-10 (the run-page half) and RV-03. It
 * printed the plane's tokens raw (`scheduled`, `not_declared_by_format`,
 * `amount_tolerance_declined`), ISO instants (`2026-03-05T19:12:00.000Z`)
 * right-aligned in sans because `className="num"` was put on a `<dd>`, counts
 * without grouping, paragraphs explaining the engine to the reader, and every
 * per-file row at once — 3,652 rows, a 155,000px page. Now:
 *
 *  · every closed vocabulary goes through a word map (`words.ts`);
 *  · instants through `whenOf()`, counts through `countOf()`, money through
 *    `moneyFigure()` with the currency in front; references are mono;
 *  · the per-file table shows the files IN TROUBLE first and pages the rest,
 *    50 at a time, with the count it knows stated — *"Count what you know"*;
 *  · each section carries one fact, not an essay;
 *  · completeness is read from the ACCOUNT when there is one, so the header
 *    no longer says "no engine account" two lines above the account it has.
 *
 * 🛑 THREE STATE MACHINES, NOT ONE. The three reads are independent and each
 * may fail alone; a `getRun` 404 must not leave the account reading for ever,
 * and an account 404 (nothing persisted) beside a 200 run is the honest
 * primary state of a run nobody reconciled.
 *
 * 🛑 "YOU CANNOT SEE", NEVER "DOES NOT EXIST", ON THE RUN PANEL — the plane
 * answers 404 for another tenant's run and for one never created, identically,
 * so this screen cannot tell them apart and must not pretend to.
 */

export type RunLoad =
  | { readonly phase: 'reading' }
  | { readonly phase: 'read'; readonly run: Run }
  | { readonly phase: 'not-found' }
  | { readonly phase: 'no-session' }
  | { readonly phase: 'refused'; readonly why: string }

export type AccountLoad =
  | { readonly phase: 'reading' }
  | { readonly phase: 'read'; readonly account: RunEngineAccount }
  | { readonly phase: 'no-account' }
  | { readonly phase: 'no-session' }
  | { readonly phase: 'refused'; readonly why: string }

export type ResidueLoad =
  | { readonly phase: 'reading' }
  | {
      readonly phase: 'read'
      readonly items: readonly ResidueEntry[]
      readonly nextCursor: string | null
    }
  | { readonly phase: 'no-account' }
  | { readonly phase: 'no-session' }
  | { readonly phase: 'refused'; readonly why: string }

export interface RunAccountProps {
  readonly runId: string
  readonly run: RunLoad
  readonly account: AccountLoad
  readonly residue: ResidueLoad
  readonly back: LinkProps
}

/** Rows per page on the two long tables. */
export const PAGE_SIZE = 50

const SESSION_ENDED = 'Your session has ended. Sign in again and open this link.'

function MoneyText({ money }: { readonly money: Money }) {
  const { unit, figure } = moneyFigure(money)
  return (
    <span className="mono">
      <span className="q">{unit}</span> {figure}
    </span>
  )
}

/** A file's declared total, or a word for its absence. */
function declaredTotal(doc: RunDocumentAccount): ReactNode {
  if (doc.declaredMinor === null) return <span className="q">—</span>
  if (doc.declaredExponent === null) return <span className="mono">{doc.declaredMinor}</span>
  const { figure } = moneyFigure({ currency: '', exponent: doc.declaredExponent, amountMinor: doc.declaredMinor })
  return <span className="mono">{figure}</span>
}

/** A file is in trouble when its own self-check disagrees or could not run, or a line was refused. */
function inTrouble(doc: RunDocumentAccount): boolean {
  return (
    doc.verdict.kind === 'reported' ||
    doc.verdict.kind === 'not_evaluated_address_collision' ||
    doc.trailer === 'expected_but_absent' ||
    doc.refused > 0 ||
    doc.presented !== doc.admitted + doc.refused
  )
}

function Pager({ page, pages, first, last, total, onPage, noun }: {
  readonly page: number
  readonly pages: number
  readonly first: number
  readonly last: number
  readonly total: number
  readonly onPage: (p: number) => void
  readonly noun: string
}) {
  if (pages <= 1) return null
  return (
    <div className="pager" data-pager={noun}>
      <span>
        <span className="mono">{countOf(first)}–{countOf(last)}</span> of{' '}
        <span className="mono">{countOf(total)}</span> {noun}
      </span>
      <button className="abtn" type="button" aria-disabled={page === 0 ? 'true' : undefined}
        onClick={() => { if (page > 0) onPage(page - 1) }}>Previous</button>
      <button className="abtn" type="button" aria-disabled={page >= pages - 1 ? 'true' : undefined}
        onClick={() => { if (page < pages - 1) onPage(page + 1) }}>Next</button>
    </div>
  )
}

function identityRow(rate: AdmissionRate) {
  const holds = rate.presented === rate.admitted + rate.refused
  return (
    <tr key={rate.side} data-side={rate.side}>
      <td>{labelOf(SIDE_WORD, rate.side)}</td>
      <td className="num">{countOf(rate.presented)}</td>
      <td className="num">{countOf(rate.admitted)}</td>
      <td className="num">{countOf(rate.refused)}</td>
      <td data-identity={holds ? 'holds' : 'broken'}>{holds ? 'Adds up' : 'Does not add up'}</td>
    </tr>
  )
}

function documentRow(doc: RunDocumentAccount, index: number, names: ReadonlyMap<string, string>) {
  return (
    <tr
      key={`${doc.side}-${doc.sourceDocumentId}-${index}`}
      data-document={doc.sourceDocumentId}
      {...(inTrouble(doc) ? { 'data-trouble': '' } : {})}
    >
      <td>{labelOf(SIDE_WORD, doc.side)}</td>
      <td>{documentNameOf(names, doc.sourceDocumentId)}</td>
      <td data-trailer={doc.trailer}>{labelOf(TRAILER_WORD, doc.trailer)}</td>
      <td className="num">{doc.declaredLineCount === null ? '—' : countOf(doc.declaredLineCount)}</td>
      <td className="num">{declaredTotal(doc)}</td>
      <td className="num">{countOf(doc.presented)}</td>
      <td className="num">{countOf(doc.admitted)}</td>
      <td className="num">{countOf(doc.refused)}</td>
      <td data-verdict={doc.verdict.kind}>{labelOf(VERDICT_WORD, doc.verdict.kind)}</td>
    </tr>
  )
}

function Documents({ docs }: { readonly docs: readonly RunDocumentAccount[] }) {
  const names = documentNamesOf(docs.map((d) => d.sourceDocumentId))
  const trouble = docs.filter(inTrouble)
  const [all, setAll] = useState(false)
  const [page, setPage] = useState(0)
  if (docs.length === 0) {
    return <p className="q" data-empty="documents">This run carried no documents.</p>
  }
  const shown = all || trouble.length === 0 ? docs : trouble
  const paged = pageOf(shown, page, PAGE_SIZE)
  const summary =
    trouble.length === 0
      ? `${countOf(docs.length)} ${docs.length === 1 ? 'document' : 'documents'} · all self-consistent`
      : `${countOf(trouble.length)} of ${countOf(docs.length)} documents disagree with themselves or lost lines`
  return (
    <>
      <p data-documents-summary={trouble.length}>{summary}</p>
      {trouble.length === 0 && !all ? (
        <div className="acts">
          <button className="abtn" type="button" data-show-documents="" onClick={() => { setAll(true); setPage(0) }}>
            Show every document
          </button>
        </div>
      ) : (
        <>
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Side</th>
                  <th scope="col">Document</th>
                  <th scope="col">Trailer</th>
                  <th scope="col" className="num">Declared lines</th>
                  <th scope="col" className="num">Declared total</th>
                  <th scope="col" className="num">Presented</th>
                  <th scope="col" className="num">Admitted</th>
                  <th scope="col" className="num">Refused</th>
                  <th scope="col">Self-check</th>
                </tr>
              </thead>
              <tbody>{paged.rows.map((d, i) => documentRow(d, paged.first - 1 + i, names))}</tbody>
            </table>
          </div>
          <Pager {...paged} onPage={setPage} noun="documents" />
          {trouble.length > 0 && trouble.length < docs.length ? (
            <div className="acts">
              <button className="abtn" type="button" aria-pressed={all} data-show-documents=""
                onClick={() => { setAll((a) => !a); setPage(0) }}>
                {all ? 'Show only the documents in trouble' : `Show all ${countOf(docs.length)} documents`}
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  )
}

function Produced({ account }: { readonly account: RunEngineAccount }) {
  if (account.outcome === 'refused') return null
  const boundary = account.searchBoundary
  return (
    <>
      <section data-panel="identity">
        <h2>What was read in</h2>
        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Side</th>
                <th scope="col" className="num">Presented</th>
                <th scope="col" className="num">Admitted</th>
                <th scope="col" className="num">Refused</th>
                <th scope="col">Check</th>
              </tr>
            </thead>
            <tbody>{account.admissionRates.map(identityRow)}</tbody>
          </table>
        </div>
        <p className="q" data-refused-at-admission={account.refusedAtAdmission.length}>
          {countOf(account.refusedAtAdmission.length)}{' '}
          {account.refusedAtAdmission.length === 1 ? 'line' : 'lines'} could not be read in.
        </p>
      </section>

      <section data-panel="boundary">
        <h2>Where the search stopped</h2>
        <dl className="facts">
          <dt>Groups too large to search</dt>
          <dd className="mono" data-oversized-buckets={boundary.oversizedBuckets.length}>
            {countOf(boundary.oversizedBuckets.length)}
          </dd>
          <dt>Searches that hit their limit</dt>
          <dd className="mono" data-exhausted-searches={boundary.exhaustedSearches.length}>
            {countOf(boundary.exhaustedSearches.length)}
          </dd>
          <dt>Amount groups too large to search</dt>
          <dd className="mono" data-oversized-amount-buckets={boundary.oversizedAmountBuckets.length}>
            {countOf(boundary.oversizedAmountBuckets.length)}
          </dd>
          <dt>References that named more than one line</dt>
          <dd className="mono" data-ambiguities={account.ambiguities.length}>
            {countOf(account.ambiguities.length)}
          </dd>
        </dl>
      </section>

      <section data-panel="documents">
        <h2>What each file said about itself</h2>
        <Documents docs={account.documentAccounts} />
      </section>

      <section data-panel="postconditions">
        <h2>Checks on the result</h2>
        {account.postconditions.length === 0 ? (
          <p data-empty="postconditions">Every check on the result held.</p>
        ) : (
          <ul className="ev" data-postconditions={account.postconditions.length}>
            {account.postconditions.map((failure, i) => (
              <li key={`${failure.kind}-${i}`} data-postcondition={failure.kind}>
                <span>{labelOf(POSTCONDITION_WORD, failure.kind)}</span>
                <span className="verdict">failed</span>
              </li>
            ))}
          </ul>
        )}
        <p className="q" data-meter-facts={account.meterFacts.length}>
          {countOf(account.meterFacts.length)} usage {account.meterFacts.length === 1 ? 'meter' : 'meters'} recorded.
        </p>
      </section>
    </>
  )
}

function AccountBody({ load }: { readonly load: AccountLoad }) {
  if (load.phase === 'reading') return <p className="q" data-account-state="reading" data-reading="">Reading what the run did.</p>
  if (load.phase === 'no-session') return <p data-account-state="no-session">{SESSION_ENDED}</p>
  if (load.phase === 'no-account') {
    return (
      /* The three facts the plane's 404 collapses are named (`run-account.ts`),
         so a reader does not take it for the one they expected. */
      <p data-account-state="no-account">
        No account of this run is visible: nobody reconciled it yet, it belongs to another
        tenant, or it does not exist.
      </p>
    )
  }
  if (load.phase === 'refused') return <p data-account-state="refused">{load.why}</p>
  const a = load.account
  return (
    <div className="stack" data-account-state="read">
      {a.outcome === 'refused' ? (
        <p data-fold="refused">
          This run was stopped before anything was matched —{' '}
          <span data-refusal={a.refusal.kind}>{sentenceOf(a.refusal.kind).toLowerCase()}</span>.
        </p>
      ) : (
        <div className="chips" data-fold="produced">
          <span className="chip" data-state={a.terminalStatus}>{labelOf(TERMINAL_STATUS_WORD, a.terminalStatus)}</span>
          <span className="chip" data-completeness={completenessKind(a.completeness)}>
            {/* The ONE vocabulary — `completeness.ts` — never a second spelling. */}
            {completenessWord(a.completeness)}
          </span>
        </div>
      )}
      <Produced account={a} />
    </div>
  )
}

function settlementCell(settlement: unknown): ReactNode {
  if (settlement === null || typeof settlement !== 'object') {
    return <span className="q">no amount — not read in</span>
  }
  const s = settlement as { readonly residual?: Money; readonly allocated?: Money }
  if (s.residual !== undefined) return <MoneyText money={s.residual} />
  if (s.allocated !== undefined) return <MoneyText money={s.allocated} />
  return <span className="q">recorded</span>
}

function ResidueBody({ load, account }: { readonly load: ResidueLoad; readonly account: AccountLoad }) {
  const [page, setPage] = useState(0)
  if (load.phase === 'reading') return <p className="q" data-residue-state="reading" data-reading="">Reading the open lines.</p>
  if (load.phase === 'no-session') return <p data-residue-state="no-session">{SESSION_ENDED}</p>
  if (load.phase === 'no-account') {
    return <p className="q" data-residue-state="no-account">Nothing to show until the run has an account.</p>
  }
  if (load.phase === 'refused') return <p data-residue-state="refused">{load.why}</p>
  if (load.items.length === 0) {
    /* 🛑 AN EMPTY PAGE IS A REAL ANSWER AND IT IS NOT THE 404's: a run with an
       account and no residue closed everything. */
    return (
      <p data-residue-state="read" data-empty="residue">
        {emptyResidueSentenceOf(account.phase === 'read' ? account.account.outcome : null)}
      </p>
    )
  }
  const paged = pageOf(load.items, page, PAGE_SIZE)
  /* C3-13 — documents by their place in the run's own account, never by id. */
  const names = documentNamesOf(
    account.phase === 'read' && account.account.outcome === 'produced'
      ? account.account.documentAccounts.map((d) => d.sourceDocumentId)
      : load.items.map((r) => r.ref.sourceDocumentId),
  )
  return (
    <div className="stack" data-residue-state="read">
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Side</th>
              <th scope="col">Document</th>
              <th scope="col" className="num">Line</th>
              <th scope="col" className="num">Open amount</th>
              <th scope="col">Disposition</th>
              <th scope="col">Why it is open</th>
              <th scope="col" className="num">Held reads</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((row, i) => (
              <tr
                key={`${row.ref.sourceDocumentId}-${String(row.ref.lineIndex)}-${paged.first + i}`}
                data-residue={`${row.ref.sourceDocumentId}#${row.ref.lineIndex === null ? 'file' : String(row.ref.lineIndex)}`}
              >
                <td>{labelOf(SIDE_WORD, row.side)}</td>
                <td>{documentNameOf(names, row.ref.sourceDocumentId)}</td>
                {/* C3-01 (G3831) — `null` is a whole-file item; `countOf(null)`
                    threw and unmounted the page. */}
                <td className="num" data-line={row.ref.lineIndex === null ? 'file' : row.ref.lineIndex}>{lineCellOf(row.ref.lineIndex)}</td>
                <td className="num" data-settlement={row.settlement === null ? 'none' : 'settled'}>
                  {settlementCell(row.settlement)}
                </td>
                <td data-disposition={row.disposition}>{labelOf(RESIDUE_DISPOSITION_WORD, row.disposition)}</td>
                <td data-cause={row.cause.kind}>{labelOf(RESIDUE_CAUSE_WORD, row.cause.kind)}</td>
                <td className="num" data-held-reads={(row.heldReads ?? []).length}>
                  {countOf((row.heldReads ?? []).length)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager {...paged} onPage={setPage} noun="open lines" />
      {load.nextCursor === null ? null : (
        <p className="q" data-residue-more="">More open lines are held beyond the first {countOf(load.items.length)}.</p>
      )}
    </div>
  )
}

function RunFacts({ load, account }: { readonly load: RunLoad; readonly account: AccountLoad }) {
  if (load.phase === 'reading') return <p className="q" data-run-state="reading" data-reading="">Reading this run.</p>
  if (load.phase === 'no-session') return <p data-run-state="no-session">{SESSION_ENDED}</p>
  if (load.phase === 'not-found') {
    return (
      <p data-run-state="not-found">
        You cannot see a run with this id. It may belong to another tenant, or it may never have been
        created.
      </p>
    )
  }
  if (load.phase === 'refused') return <p data-run-state="refused">{load.why}</p>
  const run = load.run
  /* The completeness the ACCOUNT carries wins over the run row's projection:
     the run row says null until a later write, and the account is the fact. */
  const completeness =
    account.phase === 'read' && account.account.outcome === 'produced'
      ? account.account.completeness
      : run.completeness
  const completenessText =
    completeness === null
      ? account.phase === 'no-account' ? 'Not reconciled yet' : 'Not yet known'
      : completenessWord(completeness)
  return (
    <div className="stack" data-run-state="read">
      <div className="chips">
        <span className="chip" data-state={run.status}>{RUN_STATUS_WORD[run.status]}</span>
        <span className="chip" data-trigger={run.trigger.kind}>{labelOf(TRIGGER_WORD, run.trigger.kind)}</span>
      </div>
      <dl className="facts">
        {/* RC-02 — names and dates, never raw ids: the definition's stored name
            (G3351) and the period's calendar span (G3429, `0430`). The ids stay
            the page's subject (`data-run-account`), not its text. */}
        <dt>Definition</dt>
        <dd>
          {definitionLabel(run)} <span className="q">v{run.definitionVersion}</span>
        </dd>
        <dt>Period</dt>
        <dd>{periodText(run)}</dd>
        <dt>Started</dt>
        <dd className="mono">{whenOf(run.startedAt)}</dd>
        <dt>Finished</dt>
        <dd className="mono">{run.finishedAt === null ? 'Not finished' : whenOf(run.finishedAt)}</dd>
        <dt>Exceptions raised</dt>
        <dd className="mono">{run.exceptionsRaised === null ? '—' : countOf(run.exceptionsRaised)}</dd>
        <dt>Completeness</dt>
        <dd data-completeness={completenessKind(completeness)}>{completenessText}</dd>
      </dl>
    </div>
  )
}

/**
 * The period as a person reads it — RC-02. Dates when the period carries them
 * (`periodLabel`); a period with no dates held is SAID to have none rather than
 * printed as its id; no period at all is "No period".
 */
function periodText(run: Run): string {
  if (run.periodStartsOn !== null && run.periodEndsOn !== null) return periodLabel(run) ?? 'No period'
  return run.periodId === null ? 'No period' : 'Dates not recorded for this period'
}

/** The run as a crumb: the reconciliation's name and the run's clock, the pack's run line. */
function runCrumb(run: Run): string {
  return `${definitionLabel(run)} · run ${clockOf(run.startedAt)}`
}

export function RunAccount(props: RunAccountProps) {
  const title = props.run.phase === 'read' ? definitionLabel(props.run.run) : 'Run'
  return (
    <div className="page" data-run-account={props.runId}>
      {/* RC-02 — the last crumb is the run's name and clock, never its raw id. A run
          this session cannot see keeps the id the PERSON asked for (their own
          input, not a plane value), so the page still says what was asked. */}
      <Trail crumbs={[{ label: 'Close', link: props.back }]} here={props.run.phase === 'read' ? runCrumb(props.run.run) : props.run.phase === 'reading' ? 'Run' : props.runId} />
      <header className="head">
        <span className="lab">Run</span>
        <h1>{title}</h1>
      </header>

      <section>
        <RunFacts load={props.run} account={props.account} />
      </section>

      <section>
        <h2>What the run did</h2>
        <AccountBody load={props.account} />
      </section>

      <section>
        <h2>What is left open</h2>
        <ResidueBody load={props.residue} account={props.account} />
      </section>

      {/* Quiet, as the pack draws a control nothing serves: no operation on any
          tier serves a finding at line grain, so the step out of a residue row
          has nowhere to go. */}
      <div className="acts">
        <Soon className="abtn">Open a finding from an open line</Soon>
      </div>
    </div>
  )
}

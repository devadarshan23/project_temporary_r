import { useEffect, useState, type FormEvent } from 'react'

import { ProposalCard } from './Approvals.tsx'
import { Soon } from './Soon.tsx'
import type { ExceptionDetail } from '../api/exceptions.ts'
import {
  currentProposal,
  fetchDispositions,
  fetchProposals,
  proposeResolution,
  type DispositionSet,
  type Proposal,
} from '../api/resolution.ts'
import {
  NOT_CONFIGURED_TEXT,
  actsFor,
  adjustmentFrom,
  isResolutionNotConfigured,
  proposedSentenceOf,
  refusalText,
} from '../resolve-logic.ts'
import { DRAW_GATES, useHolds } from '../capabilities.ts'
import type { LinkProps } from '../routes/useRoute.ts'
import { REVERSIBILITY_WORD, labelOf, RESOLUTION_CODE_WORD } from '../words.ts'

/**
 * C4 · RESOLVE AN EXCEPTION — *"Apply the SOP: the agent proposes; the user
 * accepts, amends or rejects"*, and *"Needs authority … the work stops here
 * until an approver acts"* (User Journeys C4). 3 Oct 2026.
 *
 * Drawn on the finding under *"What you can do"*. It reads two operations the
 * plane serves — `listAvailableDispositions` and `listProposals` — and writes
 * one, `proposeResolution`.
 *
 * 🛑 A DISPOSITION IS NEVER TYPED. The choices are the closed set the plane
 * returns, and an entry the viewer may not choose is DRAWN unavailable with its
 * reason rather than dropped — the contract: *"a UI that silently drops options
 * teaches the operator that the option does not exist."*
 *
 * 🛑 PROPOSING EXECUTES NOTHING, AND THE SCREEN SAYS WHAT HAPPENS NEXT. Once a
 * proposal exists the panel shows it — its state, who has approved it and who
 * still must — and links to where it is approved and posted.
 */

type Load =
  | { readonly phase: 'reading' }
  | { readonly phase: 'read'; readonly set: DispositionSet; readonly proposals: readonly Proposal[] }
  | { readonly phase: 'refused'; readonly why: string }
  /** G3441 — resolutions are not set up here. Permanent; never "try again". */
  | { readonly phase: 'not-configured' }

export interface ResolvePanelProps {
  readonly origin: string
  readonly finding: ExceptionDetail
  /** The signed-in person — the proposer of record when they propose. */
  readonly viewer: string | null
  /** Where the current proposal is approved and posted. */
  readonly postLink: LinkProps
}

const CLOSED = new Set(['resolved', 'rejected', 'dismissed'])

export function ResolvePanel({ origin, finding, viewer, postLink }: ResolvePanelProps) {
  const exceptionId = finding.exceptionId
  const [load, setLoad] = useState<Load>({ phase: 'reading' })
  const [tick, setTick] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [rationale, setRationale] = useState('')
  const [adjustment, setAdjustment] = useState('')
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<{ readonly ok: boolean; readonly text: string } | null>(null)
  /* C3-03 (G3836) — G3193: the propose form, Approve/Refuse and Post it are
     drawn only for a role holding the verb. The viewer and the approver were
     handed the whole propose form, and the plane refused it with a 403. */
  const mayPropose = useHolds(DRAW_GATES.acceptLine)
  const mayApprove = useHolds(DRAW_GATES.approvals)
  const mayPost = useHolds(DRAW_GATES.postResolution)

  useEffect(() => {
    let live = true
    Promise.all([fetchDispositions({ origin, exceptionId }), fetchProposals({ origin, exceptionId })])
      .then(([set, proposals]) => { if (live) setLoad({ phase: 'read', set, proposals }) })
      .catch((err: unknown) => {
        if (!live) return
        setLoad(isResolutionNotConfigured(err) ? { phase: 'not-configured' } : { phase: 'refused', why: refusalText(err) })
      })
    return () => { live = false }
  }, [origin, exceptionId, tick])

  if (load.phase === 'reading') return <p className="q" data-resolve="reading" data-reading="">Reading what can be done.</p>
  if (load.phase === 'refused') return <p data-resolve="refused">{load.why}</p>
  /* ✅ G3441 (reaudit NC-01) — a CALM, PERMANENT state. It read "Something
     failed on our side … try again in a moment" because the plane answered a
     500 for a tenant with no approval policy; that is deterministic and a retry
     never helps. The pack's quiet acts stay drawn — muted, `Coming soon` —
     rather than vanishing with the panel (G3091). */
  if (load.phase === 'not-configured' && mayPropose) {
    return (
      <div className="stack" data-resolve="not-configured">
        <p className="q">{NOT_CONFIGURED_TEXT}</p>
        <div className="acts">
          <Soon className="abtn" commit>Accept</Soon>
          <Soon className="abtn">Reject</Soon>
          <Soon className="abtn">Park</Soon>
        </div>
      </div>
    )
  }

  if (load.phase === 'not-configured') return <ReadOnly mayApprove={mayApprove} />

  const current = currentProposal(load.proposals)
  const open = current !== null && current.execution.state !== 'rejected' && current.execution.state !== 'executed'

  if (CLOSED.has(finding.status) && !open) {
    return (
      <div data-resolve="settled">
        {current === null ? null : <ProposalCard proposal={current} viewer={viewer} />}
        <p className="q">This exception is closed. Nothing further can be proposed on it.</p>
      </div>
    )
  }

  if (open && current !== null) {
    return (
      <div className="stack" data-resolve="proposed">
        <ProposalCard proposal={current} viewer={viewer} />
        <div className="acts">
          {/* The link is a NAVIGATION, not a refused act; it commits only for a
              reader who can decide or post there. */}
          {actsFor(current, viewer, { decide: mayApprove, post: mayPost }).mayDecide ||
          actsFor(current, viewer, { decide: mayApprove, post: mayPost }).mayPost ? (
            <a className="abtn" data-commit data-review-proposal={current.proposalId} {...postLink}>
              Review and post
            </a>
          ) : (
            <a className="abtn" data-review-proposal={current.proposalId} {...postLink}>
              See its approvals
            </a>
          )}
        </div>
        {said === null ? null : <div className="result" role="status" data-proposed="">{said.text}</div>}
      </div>
    )
  }

  if (!mayPropose) {
    /* The pack's own sentences for the roles that may not triage
       (`C1 Close.dc.html:254-257`): the controls are absent, and the reader is
       told where their work is rather than shown a form the plane refuses. */
    return <ReadOnly mayApprove={mayApprove} />
  }

  const choice = load.set.dispositions.find((d) => d.key === picked) ?? null
  const money = finding.valueAtRisk
  const adjusted =
    choice?.requiresAdjustment === true && money !== null
      ? adjustmentFrom(adjustment, money.currency, money.exponent)
      : null
  const ready =
    choice !== null &&
    choice.available &&
    rationale.trim().length > 0 &&
    (choice.requiresAdjustment !== true || adjusted !== null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || busy || choice === null) return
    setBusy(true)
    setSaid(null)
    proposeResolution({
      origin,
      exceptionId,
      dispositionKey: choice.key,
      rationale: rationale.trim(),
      ...(choice.requiresAdjustment ? { adjustment: adjusted } : {}),
    })
      .then((proposal) => {
        /* C3-04 (G3837) — read off the proposal the plane answered: below the
           policy's thresholds no approver is needed, and saying one is would
           be false. */
        setSaid({ ok: true, text: proposedSentenceOf(proposal, mayPost) })
        setPicked(null)
        setRationale('')
        setAdjustment('')
        setTick((t) => t + 1)
      })
      .catch((err: unknown) => setSaid({ ok: false, text: refusalText(err) }))
      .finally(() => setBusy(false))
  }

  return (
    <form className="reasons" data-resolve="propose" onSubmit={submit}>
      <span className="lab">Propose a resolution</span>
      {load.set.dispositions.length === 0 ? (
        <p className="q">No resolution is offered for this exception.</p>
      ) : (
        load.set.dispositions.map((d) => (
          <button
            key={d.key}
            className="choice"
            type="button"
            data-disposition={d.key}
            aria-pressed={picked === d.key}
            aria-disabled={d.available ? undefined : 'true'}
            onClick={() => { if (d.available) setPicked(d.key) }}
          >
            <span>{d.label}</span>
            <span className="to">
              {d.available
                ? REVERSIBILITY_WORD[d.reversibility] ?? d.reversibility
                : labelOf(RESOLUTION_CODE_WORD, d.unavailableFor ?? 'unavailable')}
            </span>
          </button>
        ))
      )}
      {choice?.requiresAdjustment === true ? (
        <label className="field">
          <span>Adjustment{money === null ? '' : ` (${money.currency})`}</span>
          <input
            inputMode="decimal"
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            data-adjustment=""
          />
        </label>
      ) : null}
      <label className="field">
        <span>Why this resolution — the sentence an approver reads</span>
        <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} data-rationale="" />
      </label>
      <div className="acts">
        <button
          className="abtn"
          type="submit"
          data-commit
          data-propose=""
          aria-disabled={ready && !busy ? undefined : 'true'}
        >
          {busy ? 'Proposing' : 'Propose'}
        </button>
      </div>
      {said === null ? null : (
        <p role="status" className={said.ok ? undefined : 'failed'} data-propose-result={said.ok ? 'ok' : 'refused'}>
          {said.text}
        </p>
      )}
    </form>
  )
}

function ReadOnly({ mayApprove }: { readonly mayApprove: boolean }) {
  return (
    <p className="q" data-resolve="read-only">
      {mayApprove
        ? 'Triage is a user’s work, so its controls are absent here — what waits on you is in Approvals.'
        : 'You can read this finding. Every control that would change something is absent for your role.'}
    </p>
  )
}

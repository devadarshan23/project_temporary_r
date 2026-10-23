import { useEffect, useState, type FormEvent } from 'react'

import { Trail } from './Trail.tsx'
import { fetchException, fetchExceptions, type ExceptionDetail, type ExceptionRow, type Money } from '../api/exceptions.ts'
import {
  currentProposal,
  decideApproval,
  executeProposal,
  fetchDispositions,
  fetchProposals,
  type ExecutionResult,
  type Proposal,
} from '../api/resolution.ts'
import { PlaneRefused } from '../api/runs.ts'
import { moneyFigure, whenOf } from '../format.ts'
import {
  NOT_CONFIGURED_TEXT,
  actsFor,
  approvalNeeded,
  approvalsCounted,
  isResolutionNotConfigured,
  personWord,
  proposerOf,
  refusalText,
  waitsOnApprovalOf,
  type ProposalMay,
} from '../resolve-logic.ts'
import { DRAW_GATES, useHolds } from '../capabilities.ts'
import type { LinkProps } from '../routes/useRoute.ts'
import { PROPOSAL_STATE_WORD, RESOLUTION_CODE_WORD, SEVERITY_WORD, labelOf, proposalStateWordOf } from '../words.ts'

/**
 * C5 · APPROVE OR REFUSE — the pack's Approvals pane (`C1 Close.dc.html`,
 * `.appr`) and the drawn record's `/close/finding/:ref/post`. 3 Oct 2026.
 *
 * *"What is waiting on your authority, with the evidence behind it rather than
 * a summary of it. Posting writes the journal; refusing writes a reason, once,
 * onto every record the proposal touched."*
 *
 * Three pieces, and each is a served operation's consumer:
 *
 *  · `ProposalCard` — one proposal: what, the value, who proposed it and when,
 *    its state as a WORD, and FOUR EYES MADE VISIBLE — every approval recorded,
 *    how many the policy needs, and whether the proposer may approve.
 *  · `PostProposal` — the screen at `/close/finding/:ref/post`: the card plus
 *    the two acts an approver has (`decideApproval`) and the one that posts
 *    (`executeProposal`), once the plane says it is executable.
 *  · `ApprovalsQueue` — every proposal waiting on someone, read from
 *    `listExceptions` filtered to the two waiting statuses and `listProposals`
 *    per row. It is exported for the Close surface's Approvals destination and
 *    drawn on the post screen under the one being decided.
 *
 * 🛑 THE PROPOSER OF RECORD SEES NO APPROVE AND NO REFUSE — *"Posting and
 * refusing are both absent here"* — and is told why. The refusal that makes it
 * true is the plane's (`approval_segregation_violation`); this screen draws it.
 *
 * 🛑 HTTP 200 ON AN APPROVAL IS NOT "DONE". *"A client that treats HTTP 200 on
 * this operation as done will show a green tick over an exception nobody has
 * authorised to move money."* The card is redrawn from the proposal the plane
 * returns, so the state shown is the recomputed one.
 */

function MoneyFig({ money }: { readonly money: Money | null | undefined }) {
  if (money === null || money === undefined) return <span className="v" data-unmeasured="">not monetary</span>
  const { unit, figure } = moneyFigure(money)
  return (
    <span className="v">
      {/* C3-20 (G3846) — the unit and the figure are two words, as on the register. */}
      <span className="cu">{unit}</span> {figure}
    </span>
  )
}

export interface ProposalCardProps {
  readonly proposal: Proposal
  readonly viewer: string | null
  /** The exception it resolves, when the caller has it — for the value and the rule. */
  readonly finding?: Pick<ExceptionDetail, 'ruleLabel' | 'valueAtRisk' | 'severity'> | null
}

/** C3-03 — what the session's role lets it do, for DRAWING only (`capabilities.ts`). */
function useProposalMay(): ProposalMay {
  return { decide: useHolds(DRAW_GATES.approvals), post: useHolds(DRAW_GATES.postResolution) }
}

export function ProposalCard({ proposal: p, viewer, finding = null }: ProposalCardProps) {
  const acts = actsFor(p, viewer, useProposalMay())
  const { have, need } = approvalsCounted(p)
  /* C3-04 (G3837) — below the policy's thresholds the plane makes the proposal
     executable with no approver; the card then says so and counts nobody. */
  const needed = approvalNeeded(p)
  const proposer = proposerOf(p)
  const req = p.execution.requiredApprovals
  return (
    <div className="appr" data-proposal={p.proposalId} data-proposal-state={p.execution.state}>
      <div className="appr-top">
        <div>
          <span className="lab">{proposalStateWordOf(p.execution.state, needed)}</span>
          <h3>{p.dispositionLabel ?? p.dispositionKey}</h3>
        </div>
        <div className="figs">
          {finding === null ? null : (
            <span className="fig">
              <span className="k">Value</span>
              <MoneyFig money={finding.valueAtRisk} />
            </span>
          )}
          {p.adjustment === null || p.adjustment === undefined ? null : (
            <span className="fig">
              <span className="k">Adjustment</span>
              <MoneyFig money={p.adjustment} />
            </span>
          )}
          <span className="fig" data-approvals={needed ? `${have}/${need}` : 'not-needed'}>
            <span className="k">Approvals</span>
            <span className="v">{needed ? `${have} of ${need}` : 'Not needed'}</span>
          </span>
        </div>
      </div>
      {/* Prose a person wrote; escaped as a string child. */}
      <p className="prop" data-rationale-text="">{p.rationale}</p>
      <p className="q">
        {/* C3-05 (G3838) — a person by name or "you", never by raw id. */}
        Proposed by{' '}
        {p.proposedBy.kind === 'agent' ? 'an agent' : (
          <span data-proposer="">{personWord(proposer, viewer, p.proposedBy.displayName, p.proposedBy.formerMember)}</span>
        )}{' '}
        · {whenOf(p.proposedAt)}
      </p>

      <span className="lab">Four eyes</span>
      {needed ? null : (
        <p className="q" data-four-eyes-not-needed="">
          This line is below the approval policy&rsquo;s thresholds, so no approver is needed before it posts.
        </p>
      )}
      <ul className="eyes" data-four-eyes="">
        {p.execution.approvals.map((a, i) => (
          <li key={`${a.decidedBy}-${i}`} data-eye={a.decision}>
            <span>{a.decision === 'approved' ? 'Approved' : 'Refused'}</span>{' '}
            <span className="who">{personWord(a.decidedBy, viewer, a.decidedByName, a.decidedByFormerMember)}</span>{' '}
            <span className="q">{whenOf(a.decidedAt)}</span>
            {a.reason === null || a.reason === undefined ? null : <span className="q">“{a.reason}”</span>}
          </li>
        ))}
        {needed && have < need && !acts.settled ? (
          <li data-eye="empty">
            {need - have === 1 ? 'One more approver is needed' : `${need - have} more approvers are needed`}
            {req.segregationOfDuties ? ' — someone other than the proposer' : ''}.
          </li>
        ) : null}
        {/* The quorum blocker is the line above in other words — said once. */}
        {p.execution.blockedBy.filter((code) => !(needed && have < need && code === 'approval_quorum_unmet')).map((code) => (
          <li key={code} data-eye="empty" data-blocked-by={code}>{labelOf(RESOLUTION_CODE_WORD, code)}.</li>
        ))}
      </ul>

      {acts.isProposerOfRecord && needed && !acts.settled && p.execution.state !== 'executable' ? (
        <div className="selfbox" data-self-proposed="">
          <p>
            You are the proposer of record on this one. Segregation of duties is on for this tenant, so
            the person who proposed a resolution cannot be the person who approves it. Approving and
            refusing are both absent here — another approver has to act.
          </p>
        </div>
      ) : null}
      {finding === null ? null : (
        <p className="q">
          {finding.ruleLabel} · {SEVERITY_WORD[finding.severity]}
        </p>
      )}
    </div>
  )
}

/* ═══ /close/finding/:ref/post ══════════════════════════════════════════════ */

type PostLoad =
  | { readonly phase: 'reading' }
  | {
      readonly phase: 'read'
      readonly finding: ExceptionDetail
      readonly proposal: Proposal | null
      /** G3441 — the plane answered `resolution_not_configured` for the proposals. */
      readonly notConfigured?: boolean
    }
  | { readonly phase: 'not-found' }
  | { readonly phase: 'no-session' }
  | { readonly phase: 'refused'; readonly why: string }

export interface PostProposalProps {
  readonly origin: string
  readonly reference: string
  readonly viewer: string | null
  readonly close: LinkProps
  readonly findingLink: LinkProps
  /** Where another waiting proposal is reviewed. */
  readonly postLinkFor: (exceptionId: string) => LinkProps
}

export function PostProposal(props: PostProposalProps) {
  const { origin, reference, viewer } = props
  const [load, setLoad] = useState<PostLoad>({ phase: 'reading' })
  const [refusing, setRefusing] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [posted, setPosted] = useState<ExecutionResult | null>(null)

  useEffect(() => {
    let live = true
    setLoad({ phase: 'reading' })
    /* G3441 (NC-01) — a `resolution_not_configured` on the proposals is a
       READ page with a stated absence, not a refused one: the finding is
       readable, and "try again" would be false. */
    const proposalsOrNotConfigured = fetchProposals({ origin, exceptionId: reference })
      .then(async (items) => {
        /* C3-22 (G3847) — the proposals read answers 200 [] on a line whose
           resolutions are not set up; the DISPOSITIONS read is the one that
           says so, as the finding's own panel learns it. Asked only when
           nothing is proposed. */
        if (items.length > 0) return items
        await fetchDispositions({ origin, exceptionId: reference }).catch((err: unknown) => {
          if (isResolutionNotConfigured(err)) throw err
        })
        return items
      })
      .catch((err: unknown) => {
        if (isResolutionNotConfigured(err)) return 'not-configured' as const
        throw err
      })
    Promise.all([fetchException({ origin, exceptionId: reference }), proposalsOrNotConfigured])
      .then(([finding, proposals]) => {
        if (!live) return
        if (proposals === 'not-configured') setLoad({ phase: 'read', finding, proposal: null, notConfigured: true })
        else setLoad({ phase: 'read', finding, proposal: currentProposal(proposals) })
      })
      .catch((err: unknown) => {
        if (!live) return
        if (err instanceof PlaneRefused && err.status === 401) setLoad({ phase: 'no-session' })
        else if (err instanceof PlaneRefused && err.status === 404) setLoad({ phase: 'not-found' })
        else setLoad({ phase: 'refused', why: refusalText(err) })
      })
    return () => { live = false }
  }, [origin, reference])

  const replace = (proposal: Proposal): void => {
    setLoad((l) => (l.phase === 'read' ? { ...l, proposal } : l))
  }

  const decide = (decision: 'approved' | 'rejected'): void => {
    if (load.phase !== 'read' || load.proposal === null || busy) return
    if (decision === 'rejected' && reason.trim().length === 0) return
    setBusy(true)
    setSaid(null)
    decideApproval({
      origin,
      proposalId: load.proposal.proposalId,
      decision,
      ...(decision === 'rejected' ? { reason: reason.trim() } : {}),
    })
      .then((p) => {
        replace(p)
        setRefusing(false)
        setReason('')
        setSaid(
          decision === 'rejected'
            ? 'Refused. The reason is attached and the exception returns to the register unresolved.'
            : p.execution.state === 'executable'
              ? 'Approved. It is ready to post.'
              : 'Approved and recorded. It is not ready to post yet — see what is still needed above.',
        )
      })
      .catch((err: unknown) => setSaid(refusalText(err)))
      .finally(() => setBusy(false))
  }

  const post = (): void => {
    if (load.phase !== 'read' || load.proposal === null || busy) return
    setBusy(true)
    setSaid(null)
    executeProposal({ origin, proposalId: load.proposal.proposalId })
      .then((result) => {
        setPosted(result)
        return fetchProposals({ origin, exceptionId: reference }).then((items) => {
          const next = currentProposal(items)
          if (next !== null) replace(next)
        })
      })
      .catch((err: unknown) => setSaid(refusalText(err)))
      .finally(() => setBusy(false))
  }

  const submitRefusal = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    decide('rejected')
  }

  return (
    <div className="page" data-post={reference}>
      <Trail
        crumbs={[
          { label: 'Close', link: props.close },
          /* RC-02 — the finding's NAME, never its raw id; `Finding` while unread. */
          { label: load.phase === 'read' ? load.finding.ruleLabel : 'Finding', link: props.findingLink },
        ]}
        here="Approve and post"
      />
      {load.phase === 'reading' ? <p className="q" data-post-state="reading" data-reading="">Reading the proposal.</p> : null}
      {load.phase === 'no-session' ? (
        <p data-post-state="no-session">Your session has ended. Sign in again and open this link.</p>
      ) : null}
      {load.phase === 'not-found' ? (
        <p data-post-state="not-found">
          You cannot see a finding with that reference. It may belong to another tenant, or it may never
          have been raised — this page answers the same for both.
        </p>
      ) : null}
      {load.phase === 'refused' ? <p data-post-state="refused">{load.why}</p> : null}
      {load.phase === 'read' ? (
        <div className="stack" data-post-state="read">
          <header className="head">
            <span className="lab">Approvals</span>
            <h1>{load.finding.ruleLabel}</h1>
          </header>
          {load.notConfigured === true ? (
            <div className="stated" data-post-not-configured="">
              <h2>Resolutions are not set up yet.</h2>
              <p>{NOT_CONFIGURED_TEXT}</p>
              <div className="acts"><a className="abtn" {...props.findingLink}>Open the finding</a></div>
            </div>
          ) : load.proposal === null ? (
            <div className="stated" data-post-empty="">
              <h2>Nothing is proposed on this finding.</h2>
              <p>A resolution is proposed from the finding itself. Once it is, it waits here for an approver.</p>
              <div className="acts"><a className="abtn" {...props.findingLink}>Open the finding</a></div>
            </div>
          ) : (
            <PostBody
              proposal={load.proposal}
              finding={load.finding}
              viewer={viewer}
              busy={busy}
              refusing={refusing}
              reason={reason}
              onReason={setReason}
              onToggleRefuse={() => setRefusing((r) => !r)}
              onApprove={() => decide('approved')}
              onSubmitRefusal={submitRefusal}
              onPost={post}
            />
          )}
          {said === null ? null : <div className="result" role="status" data-post-said="">{said}</div>}
          {posted === null ? null : (
            <div className="result" role="status" data-posted={posted.resolution.mode}>
              {postedSentenceOf(posted, viewer)}
            </div>
          )}
          <ApprovalsQueue origin={origin} viewer={viewer} except={reference} postLinkFor={props.postLinkFor} />
        </div>
      ) : null}
    </div>
  )
}

interface PostBodyProps {
  readonly proposal: Proposal
  readonly finding: ExceptionDetail
  readonly viewer: string | null
  readonly busy: boolean
  readonly refusing: boolean
  readonly reason: string
  readonly onReason: (r: string) => void
  readonly onToggleRefuse: () => void
  readonly onApprove: () => void
  readonly onSubmitRefusal: (e: FormEvent<HTMLFormElement>) => void
  readonly onPost: () => void
}

function PostBody(b: PostBodyProps) {
  /* C3-03 (G3836) — Approve, Refuse and Post it are drawn only for a role that
     holds the verb; the viewer saw all three and was refused by a 403. */
  const acts = actsFor(b.proposal, b.viewer, useProposalMay())
  return (
    <div className="stack">
      <ProposalCard proposal={b.proposal} viewer={b.viewer} finding={b.finding} />
      {acts.mayDecide ? (
        <div className="acts" data-decide="">
          <button className="abtn" type="button" data-commit data-approve="" aria-disabled={b.busy ? 'true' : undefined} onClick={b.onApprove}>
            Approve
          </button>
          <button className="abtn" type="button" data-refuse="" aria-pressed={b.refusing} onClick={b.onToggleRefuse}>
            Refuse
          </button>
        </div>
      ) : null}
      {acts.alreadyDecided && !acts.settled && !acts.mayPost ? (
        <p className="q" data-already-decided="">You have already decided this proposal. It waits on someone else.</p>
      ) : null}
      {acts.mayDecide && b.refusing ? (
        <form className="reasons" onSubmit={b.onSubmitRefusal}>
          <span className="lab">A reason, and where it goes</span>
          <label className="field">
            <span>Why it is refused — attached to the exception and read by whoever proposed it</span>
            <textarea value={b.reason} onChange={(e) => b.onReason(e.target.value)} data-refuse-reason="" />
          </label>
          <div className="acts">
            <button
              className="abtn"
              type="submit"
              data-commit
              data-refuse-commit=""
              aria-disabled={b.reason.trim().length === 0 || b.busy ? 'true' : undefined}
            >
              Refuse and attach the reason
            </button>
          </div>
        </form>
      ) : null}
      {acts.mayPost ? (
        <div className="acts">
          <button className="abtn" type="button" data-commit data-post-it="" aria-disabled={b.busy ? 'true' : undefined} onClick={b.onPost}>
            {b.busy ? 'Posting' : 'Post it'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

/* ═══ THE APPROVALS QUEUE ═══════════════════════════════════════════════════ */

export type QueueItem = { readonly row: ExceptionRow; readonly proposal: Proposal }

type QueueLoad =
  | { readonly phase: 'reading' }
  | { readonly phase: 'read'; readonly items: readonly QueueItem[] }
  | { readonly phase: 'refused'; readonly why: string }

export interface ApprovalsQueueProps {
  readonly origin: string
  readonly viewer: string | null
  readonly postLinkFor: (exceptionId: string) => LinkProps
  /** An exception already on screen, left out of the list. */
  readonly except?: string
}

const WAITING = ['resolution_proposed', 'pending_approval'] as const

/**
 * WHAT WAITS ON THIS READER'S APPROVAL — the owner's ruling on C3-08, 4 Oct
 * 2026: *"Approvals is a nav destination, tenant-wide: in the chrome nav for
 * holders of approve_resolution; the queue lists every waiting proposal the
 * reader may approve."*
 *
 * Tenant-wide (no definition, no run) and filtered to the proposals this
 * reader may DECIDE — `actsFor(…).mayDecide` with `approve_resolution` held:
 * awaiting approval, not proposed by the reader under segregation, and not
 * already decided by them. An `executable` proposal waits on a POSTER, not an
 * approver (C3-26), and is not listed. The chrome's count, the greeting's
 * approver sentence (C3-07) and the queue read this one function, so the three
 * cannot disagree.
 */
export async function loadApprovalsWaiting(origin: string, viewer: string | null): Promise<readonly QueueItem[]> {
  const page = await fetchExceptions({ origin, status: WAITING, sort: 'severity_then_value' })
  const items = await Promise.all(
    page.items.map(async (row) => {
      const p = currentProposal(await fetchProposals({ origin, exceptionId: row.exceptionId }))
      return p === null ? null : { row, proposal: p }
    }),
  )
  return items.filter(
    (i): i is QueueItem => i !== null && waitsOnApprovalOf(i.proposal, viewer),
  )
}

export function ApprovalsQueue({ origin, viewer, postLinkFor, except }: ApprovalsQueueProps) {
  const [load, setLoad] = useState<QueueLoad>({ phase: 'reading' })
  const mayDecide = useHolds(DRAW_GATES.approvals)
  useEffect(() => {
    let live = true
    loadApprovalsWaiting(origin, viewer)
      .then((items) => {
        if (live) setLoad({ phase: 'read', items: items.filter((i) => i.row.exceptionId !== except) })
      })
      .catch((err: unknown) => { if (live) setLoad({ phase: 'refused', why: refusalText(err) }) })
    return () => { live = false }
  }, [origin, viewer, except])

  /* G3193 — a session that may not approve has no queue to be shown. */
  if (!mayDecide) return null
  return (
    <section data-approvals-queue={load.phase}>
      <span className="lab">{except === undefined ? 'Waiting on your approval' : 'Also waiting on your approval'}</span>
      {load.phase === 'reading' ? <p className="q" data-reading="">Reading what is waiting.</p> : null}
      {load.phase === 'refused' ? <p className="q">{load.why}</p> : null}
      {load.phase === 'read' && load.items.length === 0 ? (
        <p className="q" data-approvals-empty="">
          {except === undefined ? 'Nothing is waiting on your approval.' : 'Nothing else is waiting on your approval.'}
        </p>
      ) : null}
      {load.phase === 'read'
        ? load.items.map(({ row, proposal }) => {
            const { have, need } = approvalsCounted(proposal)
            return (
              <div className="appr" key={row.exceptionId} data-queued={row.exceptionId}>
                <div className="appr-top">
                  <div>
                    <span className="lab">{PROPOSAL_STATE_WORD[proposal.execution.state]}</span>
                    <h3>{proposal.dispositionLabel ?? proposal.dispositionKey} · {row.ruleLabel}</h3>
                  </div>
                  <div className="figs">
                    <span className="fig">
                      <span className="k">Value</span>
                      <MoneyFig money={row.valueAtRisk} />
                    </span>
                    <span className="fig">
                      <span className="k">Approvals</span>
                      <span className="v">{have} of {need}</span>
                    </span>
                  </div>
                </div>
                <p className="q">
                  Proposed by{' '}
                  {proposal.proposedBy.kind === 'agent'
                    ? 'an agent'
                    : personWord(proposerOf(proposal), viewer, proposal.proposedBy.displayName, proposal.proposedBy.formerMember)}{' '}
                  · {whenOf(proposal.proposedAt)}
                </p>
                <div className="acts">
                  <a className="abtn" data-commit="" {...postLinkFor(row.exceptionId)}>
                    Review
                  </a>
                </div>
              </div>
            )
          })
        : null}
    </section>
  )
}

/**
 * THE POST RESULT IN WORDS — C3-05: no raw id. Who approved is counted (the
 * execution result carries ids only), the poster is "you" or "a colleague".
 */
function postedSentenceOf(posted: ExecutionResult, viewer: string | null): string {
  const head = `Posted. ${posted.closedException ? 'The exception is resolved.' : 'It routed to the next step.'}`
  const approvers = new Set(posted.resolution.approvedBy ?? []).size
  const by =
    approvers === 0
      ? 'No approval was needed'
      : approvers === 1
        ? 'Approved by one approver'
        : `Approved by ${String(approvers)} approvers`
  const poster = posted.resolution.executedBy
  const tail = poster === null || poster === undefined ? '' : ` · posted by ${personWord(poster, viewer)}`
  return `${head} ${by}${tail}.`
}

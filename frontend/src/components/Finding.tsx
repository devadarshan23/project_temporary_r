import type { ReactNode } from 'react'

import { Soon } from './Soon.tsx'
import { Trail, type Crumb } from './Trail.tsx'
import type { ExceptionDetail } from '../api/exceptions.ts'
import { findingLine } from '../api/exceptions.ts'
import { moneyFigure, whenOf } from '../format.ts'
import { personWord } from '../resolve-logic.ts'
import { EXCEPTION_STATUS_WORD, SEVERITY_WORD } from '../words.ts'

/**
 * ONE FINDING — the surface `/close/finding/:ref` addresses.
 *
 * ✅ REDRAWN 3 Oct 2026 (RC-08) AS THE PACK'S EVIDENCE BLOCK. It was an
 * unstyled `<dl>` printing the plane's closed tokens — `critical`,
 * `pending_approval`, `96400.00 SGD` with the currency as a SUFFIX and no
 * grouping — and a body link "Back to the register" under the title. It now
 * carries the C1 open-row shape: a breadcrumb (primitive 4), the rule as the
 * heading, the severity and status as WORDS on chips, the value at risk with
 * its currency in front and the digits grouped (`moneyFigure`, R9), and the
 * evidence under *"What the machine did"*.
 *
 * ✅ AND IT CAN BE ACTED ON — C4. *"What you can do"* is the `resolve` slot:
 * `ResolvePanel` proposes a disposition from the closed set the plane serves
 * (`listAvailableDispositions`) and shows what is already proposed. The slot
 * keeps this component a pure function of what it is handed; the panel owns
 * its own reads.
 *
 * ⚠️ WHAT IS STILL NOT HERE, AND IS QUIET RATHER THAN EXPLAINED: each observed
 * value drawn against its document needs a page and a box over a stored
 * document, and nothing produces an extraction with one. That control is drawn
 * muted (`<Soon>`), as the pack draws a control nothing serves.
 *
 * 🛑 COUNTERPARTY TEXT IS A STRING CHILD AND NOTHING ELSE. `ruleLabel`,
 * `summary` and `expected` can carry counterparty-derived prose (invariant 6);
 * React escapes a string child, so none of it reaches markup, an `href` or a
 * handler. `tests/e2e/browser-login.test.ts` §8 seeds an instruction-shaped
 * summary and requires its exact characters.
 *
 * 🛑 "THIS SESSION CANNOT SEE", NEVER "DOES NOT EXIST". The plane answers 404
 * for a row in another tenant and for a row nobody raised, deliberately and
 * identically; a surface saying "does not exist" would make the disclosure the
 * status code refuses to.
 */

export type FindingLoad =
  | { readonly phase: 'reading' }
  | { readonly phase: 'read'; readonly finding: ExceptionDetail }
  | { readonly phase: 'not-found' }
  | { readonly phase: 'no-session' }
  | { readonly phase: 'refused'; readonly why: string }

export interface FindingProps {
  readonly reference: string
  readonly load: FindingLoad
  /** The way back — the first crumb. */
  readonly back: Crumb['link']
  /** C4 · what you can do. Absent where the screen is rendered with no plane. */
  readonly resolve?: ReactNode
  /** The signed-in person — "you" on the assignment chip (C3-05). */
  readonly viewer?: string | null
}

/**
 * Null is NOT APPLICABLE — the value was parsed, which is the most reliable
 * provenance there is — and must never be drawn as 0%.
 */
function confidenceText(confidence: number | null): string {
  if (confidence === null) return 'Confidence not applicable — read directly, not extracted'
  return `${Math.round(confidence * 100)}% extraction confidence`
}

function Value({ finding }: { readonly finding: ExceptionDetail }) {
  if (finding.valueAtRisk === null) {
    return <span className="v" data-unmeasured="">not monetary</span>
  }
  const { unit, figure } = moneyFigure(finding.valueAtRisk)
  return (
    <span className="v">
      {/* C3-20 (G3846) — two words, as on the register. */}
      <span className="cu">{unit}</span> {figure}
    </span>
  )
}

function stateLine(load: FindingLoad): ReactNode {
  if (load.phase === 'reading') {
    return <p className="q" data-finding-state="reading" data-reading="">Reading this finding.</p>
  }
  if (load.phase === 'no-session') {
    return (
      <p data-finding-state="no-session">
        Your session has ended. Sign in again and open this link.
      </p>
    )
  }
  if (load.phase === 'not-found') {
    return (
      <p data-finding-state="not-found">
        You cannot see a finding with that reference. It may belong to another tenant, or it may
        never have been raised — this page answers the same for both.
      </p>
    )
  }
  if (load.phase === 'refused') {
    return (
      <p data-finding-state="refused">
        This finding could not be read. Try again in a moment.
      </p>
    )
  }
  return null
}

export function Finding(props: FindingProps) {
  const { load } = props
  const f = load.phase === 'read' ? load.finding : null
  return (
    <div className="page" data-finding={props.reference}>
      {/* RC-02 — the last crumb is the finding's NAME (its rule), never the raw
          reference; `Finding` until it is read. The reference stays the page's
          `data-finding` subject. */}
      <Trail crumbs={[{ label: 'Close', link: props.back }]} here={f !== null ? f.ruleLabel : load.phase === 'reading' ? 'Finding' : props.reference} />

      {f === null ? (
        stateLine(load)
      ) : (
        <div className="stack" data-finding-state="read">
          <header className="head">
            <span className="lab">Finding</span>
            {/* Counterparty-derived in general; escaped as a string child. */}
            <h1>{f.ruleLabel}</h1>
            <div className="chips">
              <span className="chip" data-severity={f.severity}>{SEVERITY_WORD[f.severity]}</span>
              <span className="chip" data-status={f.status}>{EXCEPTION_STATUS_WORD[f.status]}</span>
              <span className="chip" data-assigned={f.assignedTo ?? ''}>
                {/* C3-05 (G3838) — a person by name or "you", never by raw id. */}
                {f.assignedTo === null ? 'Unassigned' : `Assigned · ${personWord(f.assignedTo, props.viewer ?? null, f.assignedToName, f.assignedToFormerMember)}`}
              </span>
            </div>
          </header>

          <div className="figs">
            <span className="fig" data-value-at-risk={f.valueAtRisk === null ? 'none' : 'money'}>
              <span className="k">Value at risk</span>
              <Value finding={f} />
            </span>
            <span className="fig">
              <span className="k">Raised</span>
              <span className="v">{whenOf(f.raisedAt)}</span>
            </span>
          </div>

          {/* 🛑 THE EXPLANATION IS THE REASON THIS ROUTE IS WORTH HAVING — an
              exception without its explanation has lost the product's point
              (PRODUCT.md Principle 1), which is why the wire refuses one. */}
          {/* RMR-05 (G3475) — the machine's own drafted evidence is this view's
              ONE light, as it is when the same evidence opens inline on C1
              (plain `lit`: finished work, no sweep). Nothing else on the page
              is lit, so no arbitration is needed here. The label matches the
              register's spelling (RV-08 / NC-10, G3474): no spend is served,
              so neither a figure nor its `∴` follows it. */}
          <section className="evid-in lit" data-explanation data-lit="panel">
            <span className="lab">What the machine did</span>
            <p data-summary>{findingLine({ summary: f.explanation.summary, ruleLabel: f.ruleLabel })}</p>
            {/* ⚠️ DIRECTIONAL: `expected` is drawn from the REFERENCE slot, so it
                is labelled as the authority rather than as one of two values. */}
            <p className="q">
              Expected, from the reference: <span data-expected>{f.explanation.expected}</span>
            </p>
            <p className="q" data-confidence>
              {confidenceText(f.explanation.confidence)} · {f.explanation.observed.length} observed{' '}
              {f.explanation.observed.length === 1 ? 'value' : 'values'}
            </p>
            <div className="acts">
              <Soon className="abtn">Show each value against its document</Soon>
            </div>
          </section>

          {props.resolve === undefined ? null : (
            <section data-resolve-slot="">
              <span className="lab">What you can do</span>
              {props.resolve}
            </section>
          )}
        </div>
      )}
    </div>
  )
}

import { useEffect } from 'react'

import { EntryTop } from './EntryTop.tsx'
import { Soon } from './Soon.tsx'
import { fetchSessionPrincipal } from '../api/principal.ts'

/**
 * THE ROUTES THAT USED TO RENDER ENGINEERING TEXT — RC-01, 3 Oct 2026.
 *
 * `/`, `/ask`, `/reports` and `/invite` rendered the route layer's own scope:
 * *"Tier 1 · Work · data plane · drawn in design/routes/ask.html#route, a record
 * deleted under G264"* and a paragraph about gaps and refusals — on the page a
 * customer lands on. *"Engineering rationale stays in docs/tests, never on
 * screen."* Each now renders what the pack draws for it:
 *
 *  · `/ask` and `/reports` — the destination's own pane, quiet: its heading,
 *    one sentence saying what it is for, and its first control drawn muted
 *    (`<Soon>`), because no operation serves either yet.
 *  · `/invite` — the entry card: an invitation is a sign-in through the
 *    organisation's own directory, so it says so and sends you there.
 *  · `/` — not a page at all on a tenant host: signed in, it is the register;
 *    signed out, it is sign-in. `/signin/lapsed` is E1's 401 (`main.tsx`).
 */

export function AskPage() {
  return (
    <div className="page" data-quiet="ask">
      <header className="head">
        <span className="lab">Ask</span>
        <h1>Ask about this period</h1>
        <p className="q">
          A question the register does not answer as a list — about a supplier, a run or the period —
          answered with what it read and what it cost.
        </p>
      </header>
      <Soon className="askbox" label="Ask a question — coming soon">
        <span>What would you like to know about this period?</span>
        <span className="cue">⌘K</span>
      </Soon>
    </div>
  )
}

export function ReportsPage() {
  return (
    <div className="page" data-quiet="reports">
      <header className="head">
        <span className="lab">Reports</span>
        <h1>Close packs</h1>
        <p className="q">
          The period&rsquo;s evidence, put together for whoever signs it off — composed from panels, in
          the order you choose.
        </p>
      </header>
      <div className="acts">
        <Soon className="abtn">New pack</Soon>
      </div>
    </div>
  )
}

export function InvitePage() {
  return (
    <div className="entry" data-surface="invite">
      <div className="card">
        <EntryTop />
        <h1>You have been invited to ReconcileAI.</h1>
        <p>
          There is no password to set here. <b>You sign in with your organisation&rsquo;s own
          directory</b>, using the work address your invitation was sent to — and your role is read from
          what your organisation assigned you.
        </p>
        <div className="way">
          <a className="btn btn--primary" data-commit href="/signin" data-invite-signin="">
            Sign in with your organisation<span className="k">your directory decides</span>
          </a>
        </div>
        <p className="foot-note">If the address is not recognised, ask whoever invited you which one they used.</p>
      </div>
    </div>
  )
}

/**
 * `/` ON A TENANT HOST. One read — `getSessionPrincipal` — decides it: a
 * session goes to the register, anything else to sign-in. `replace`, so Back
 * does not return to a page that only redirects. The query string travels with
 * it, because `?plane=` is how a local build names its plane.
 */
export function EntryRoot({ origin }: { readonly origin: string }) {
  useEffect(() => {
    let live = true
    const go = (path: string): void => {
      if (live) window.location.replace(`${path}${window.location.search}`)
    }
    fetchSessionPrincipal(origin)
      .then(() => go('/close'))
      .catch(() => go('/signin'))
    return () => { live = false }
  }, [origin])
  return (
    <div className="entry" data-surface="root">
      <div className="card">
        <EntryTop />
        <p data-root-state="deciding">Opening ReconcileAI.</p>
      </div>
    </div>
  )
}

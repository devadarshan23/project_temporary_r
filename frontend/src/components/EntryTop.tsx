/**
 * THE TOP ROW OF THE SIGNED-OUT SHELL — the lockup and the way back.
 * `docs/handoff-pack/V3 Sign In.dc.html` and `E1 Errors.dc.html` draw the same
 * row: the mark with the still mascot, the connection light, and
 * "Back to the site".
 *
 * 🛑 THE CONNECTION LIGHT IS NOT DRAWN, AND THAT IS A DECISION RATHER THAN AN
 * OMISSION — G3047. V3's light reads *"Sign-in service reachable"*, and nothing
 * this page can ask BEFORE a person types an address answers that: the sign-in
 * operations are `resolveHomeRealm` and `beginFederatedSignIn`, both of which
 * take a domain, and the data plane's health check is not routed through the
 * edge. A light lit by default would be decorative — a claim about reachability
 * nobody measured, which is G216's *"a light that is truthful about the wrong
 * subject is worse than a hatch"* one step worse: truthful about nothing.
 * `tests/app/indicator-roster.test.ts` §5 also refuses a computed state at any
 * `<Connection>` call site, so a light wired to the realm answer would need that
 * control re-argued first. The light is absent; the sign-in form says in words
 * when the service could not be reached.
 *
 * ✅ "BACK TO THE SITE" GOES TO THE SITE — G3581, 3 Oct 2026. ⚠️ IT READ
 * *"GOES TO `/`, THIS APPLICATION'S ENTRY ROUTE. The pack's target is
 * `V1 Landing`, the marketing site at the apex, which is not built (G1968)."*
 * The apex is built (G3151), and this row is drawn on every host: on a console
 * host `/` is the staff console and on a partner host the portal, so a link
 * named "the site" landed a person inside the product. It now goes to
 * `SITE_HOME`, the apex's `/`, as the pack draws it. The LOCKUP still goes to
 * this host's `/`, which is this host's home.
 */
import type { CSSProperties } from 'react'

import { SITE_HOME } from '../routes/apex.ts'

const LOGO_SIZE = { '--logo-size': '1.0625rem' } as CSSProperties
const MASCOT_SIZE = { '--mascot-size': '1em' } as CSSProperties

export function EntryTop() {
  return (
    <div className="top">
      <a href="/" aria-label="ReconcileAI">
        <span className="logo" style={LOGO_SIZE}>
          <span className="mascot" aria-hidden="true" style={MASCOT_SIZE}>
            <i className="d1">·</i>
            <i className="d2">·</i>
            <i className="d3">·</i>
          </span>
          <span>Reconcile</span>
          <span className="badge">AI</span>
        </span>
      </a>
      <a href={SITE_HOME} className="small" data-back-to-site>
        <span className="mono" aria-hidden="true">‹</span>&nbsp;Back to the site
      </a>
    </div>
  )
}

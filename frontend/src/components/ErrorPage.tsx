/**
 * E1 — THE PAGE THE APPLICATION DRAWS WHEN THERE IS NOTHING TO DRAW INTO.
 * `docs/handoff-pack/E1 Errors.dc.html`, G3049, 2 Oct 2026.
 *
 * *"Six states, drawn on the public shell because that is the shell that
 * survives when the application does not."* So this page carries no chrome
 * bar, and `main.tsx` draws it in place of one.
 *
 * 🛑 THE RECORD IS TOTAL OVER THE SIX CODES AND THE COPY IS THE PACK'S, WITH
 * THREE KINDS OF CHANGE AND EACH IS NAMED RATHER THAN HIDDEN:
 *
 *   1. G266 — *"A CREDENTIAL CARRIES THE ORGANISATION AND NEVER THE ROLE"*. The
 *      401's *"Your passkey carries which organisation and which role you
 *      hold"* is re-worded; the experience it promises (you land where you
 *      were, not at a menu) is unchanged, which is G266's own *"the copy
 *      changes; the experience does not"*.
 *   2. THE REFERENCE. E1 prints illustrative ids (`sess-9f41-2c`, `req-…`) and
 *      this application mints no request reference the reader could quote, so
 *      the caller supplies what it actually has — the address, or the plane's
 *      own code — and the `refWhy` line says what that is.
 *   3. THE WAYS OUT name only places that exist. E1's 404 offers *"Search from
 *      the palette, ⌘K"*; there is no palette, so that way is not drawn.
 *
 * ✅ RC-28 — G3481, 3 Oct 2026. Three more changes, all toward the pack:
 *
 *   · "WHAT TO QUOTE" IS SENTENCE CASE, as E1 draws it — its `.lab` is unstyled
 *     on the public shell, so `entry.css` no longer upper-cases it under `.e1`.
 *   · THE QUOTE NEVER SAYS "plane" AND NEVER PRINTS AN INTERNAL ERROR CODE
 *     (`internal_error`, `upstream_unavailable`, `session_invalid`). Those are
 *     the service's closed vocabulary for its own logs; a reader is given the
 *     ADDRESS it happened at, or "no session". Neither is invented. The 503's
 *     own copy says "the service holding your data" where E1 says "your plane".
 *   · THE 404's SECOND WAY IS "Back to the site". It offered "Sign in · if you
 *     have not yet", which is wrong for a signed-in reader, and this page cannot
 *     know which reader it has: the route table answers a 404 before any session
 *     is read. The site is somewhere that exists for both.
 *
 * ⚠️ WHICH CODES `main.tsx` ACTUALLY REACHES IS NARROWER THAN SIX, and that is
 * E1's own rule rather than a shortfall: *"Inside the product a refusal is
 * never a page"*, so a 403 is drawn in place where it happens (the Setup
 * screen's hatched refusal), and the 429 E1 draws is a MODEL QUOTA, which no
 * operation this application calls can report. The record carries all six so
 * a caller that can distinguish one has the pack's words for it.
 *
 * ✅ RP-04 / RS-02 — G3581, THE OWNER'S RULING OF 3 Oct 2026: *"error pages on
 * each host send people to THAT host's own home with wording naming that
 * surface: customer → the register (/close), partner host → the partner portal
 * home, console host → the staff console home; never a route the host doesn't
 * serve."* E1 is drawn for the tenant surface only, and until this ruling a
 * 404 on `partners.` offered *"Back to your register"* → `/close`, which that
 * host does not serve, and a 503 on `console.` told a staff person their data
 * and their run were held. So:
 *
 *   · THE HOME WAY IS A SLOT, NOT A ROUTE. Every record names `HOME` where it
 *     used to name the register, and `homeOf(surface)` fills it — one table,
 *     total over `Surface`, so a fourth surface is a compile error here.
 *   · THE SURFACE IS READ FROM THE HOST by `routes/surface.ts`, the one module
 *     that answers it (§5.3), so no caller has to pass it and a caller that
 *     forgets cannot draw the tenant's ways on a console.
 *   · THE TENANT COPY IS THE PACK'S AND IS UNCHANGED. The console and partner
 *     hosts take their own words only where the tenant's would be false there
 *     (`SURFACE_COPY`): the 503 (no "your data", no "run"), and the 403/500
 *     asides that name the tenant's trail or its runs.
 *   · "Back to the site" goes to the SITE — the apex, which is built (G3151) —
 *     and no longer to this host's `/`, which on a console host is the console.
 *
 * ⚠️ AND THE CONNECTION LIGHT IS NOT DRAWN, for `EntryTop.tsx`'s reason: E1's
 * *"You are signed in"* and *"Your plane is reachable"* are claims this page
 * would be making without having measured them.
 */
import { surfaceOf, type Surface } from '../routes/surface.ts'
import { errorCopyFor, type ErrorCode } from '../error-copy.ts'

export type { ErrorCode } from '../error-copy.ts'
import { EntryTop } from './EntryTop.tsx'

/** The surface this page is drawn on — the host's, or the tenant's where there is no window (prerender). */
function hostSurface(): Surface {
  return typeof window === 'undefined' ? 'tenant' : surfaceOf(window.location.hostname)
}

export interface ErrorPageProps {
  readonly code: ErrorCode
  /**
   * What the reader can quote — the address, or "no session". Never invented,
   * and never the service's internal error code or the word "plane" (RC-28):
   * `tests/app/entry-and-consoles.test.ts` §1c reads every caller's literal.
   */
  readonly quote: string
  /** Which host's home and words — read from the host when not given (G3581). */
  readonly surface?: Surface
}

export function ErrorPage({ code, quote, surface = hostSurface() }: ErrorPageProps) {
  const e = errorCopyFor(code, surface)
  const [primary, secondary] = e.ways
  return (
    <div className="e1" data-error={code} data-error-surface={surface}>
      <EntryTop />
      <div className="card">
        <span className="kind">{e.kind}</span>
        <h1>{e.head}</h1>
        <p className="said">{e.said}</p>
        <p className="means">{e.means}</p>
        <div className="way">
          <a className="btn btn--primary" data-commit href={primary.to}>
            {primary.label}<span className="k">{primary.note}</span>
          </a>
          <a className="btn btn--quiet" href={secondary.to}>
            {secondary.label}<span className="k">{secondary.note}</span>
          </a>
        </div>
        <div className="quote">
          <span className="lab">What to quote</span>
          <p className="code" data-error-quote>
            {code} · {quote}
          </p>
          <p>{e.refWhy}</p>
        </div>
        {e.own === null ? null : <p className="own">{e.own}</p>}
      </div>
    </div>
  )
}

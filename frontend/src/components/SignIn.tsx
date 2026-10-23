/**
 * `/signin` — WHO ARE YOU, AND WHICH DIRECTORY KNOWS. 1 Oct 2026, the owner's
 * ruling G2541: the begin half of a federated sign-in, given a screen.
 *
 * ✅ AND SINCE 2 Oct 2026 IT IS DRAWN AS `docs/handoff-pack/V3 Sign In.dc.html`
 * — G3048. ⚠️ THE OLD FIRST PARAGRAPH IS QUOTED RATHER THAN DELETED, because it
 * is the reason the page looked the way staging showed it:
 *
 *     "IT IS THE DRAWN `r-signin` REDUCED TO ITS ONE ACT, NOT A NEW DESIGN. The
 *      drawn record draws an address field and a continue, then the hand-off to
 *      the directory; the pack calls the surface `/entry` and which name stands
 *      is G1914, THE OWNER'S."
 *
 * Reduced to its one act, it rendered as a bare label and a button under the
 * signed-in chrome bar. The pack is the north star (G264), and V3 draws a card:
 * the lockup and the way back, Customer | Partner tabs, the welcome and its
 * lede, a stack of ways in, and the "you land in the right place" column. That
 * structure is what this file now renders. G1914 is untouched — the path is
 * still the tree's `/signin`.
 *
 * 🛑 THE STACK IS WHAT THE TREE CAN DO, AND EVERYTHING V3 DRAWS THAT IT CANNOT
 * IS EITHER HATCHED FOR A RULING OR STATED AS A GAP — never drawn as if live:
 *
 *   · THE ONE REAL WAY IN is an address and "Continue with your organisation".
 *     The flow is domain → `resolveHomeRealm` → `beginFederatedSignIn` → the
 *     door's own broker, so the address is the one thing the page must ask.
 *     The label is V3's own partner-tab primary; the customer tab gets it too.
 *   · "SIGN IN WITH MICROSOFT" AND "SIGN IN WITH GOOGLE" ARE NOT DRAWN. Entra
 *     IS reachable (G194: *"Entra ID is OIDC and the union already covers
 *     it"*), but only through the address: `RealmRouting` carries a door's id
 *     and *"does NOT carry `protocol` OR `label`, AND A CLIENT THEREFORE CANNOT
 *     DERIVE FROM THIS RESPONSE WHICH FORM TO RENDER"* (session.openapi.yaml).
 *     A brand button would be a guess wearing someone else's trademark. That
 *     is a GAP, stated in words below the stack, and not hatched.
 *   · "USE A PASSKEY" IS HATCHED FOR G230 — *"PASSKEYS ARE NOT IN v1"*.
 *   · "EMAIL ME A SIGN-IN LINK" IS HATCHED FOR G265 — *"AN EMAILED LINK MAKES
 *     THE PLATFORM AN AUTHENTICATOR"*. V3's whole email-fallback state is gone
 *     with it.
 *   · THE "SIGN-IN SERVICE REACHABLE" LIGHT IS ABSENT — see `EntryTop.tsx`.
 *
 * ⚠️ AND THE TWO HATCHES ABOVE ARE GONE FROM THE SCREEN — G3192, 2 Oct 2026,
 * applying the OWNER'S quiet-unbuilt ruling G3091 to the surface G3100 named
 * and left: *"draw exactly as the pack, visibly disabled (muted, no hatch, no
 * G-numbers); a small tooltip says 'Coming soon'. Engineering rationale stays
 * in docs/tests, never on screen."* The passkey and the emailed link are now
 * `<Soon>` controls; G230 and G265 still govern both and are argued HERE, not
 * on the card. The paragraph that explained the absent brand buttons went with
 * them for the same reason — it was rationale, on screen. ⚠️ A tension is
 * NAMED rather than resolved: G230 and G265 REFUSE these ways in, and the
 * tooltip G3091 mandates says "Coming soon". Which word a refused-by-ruling
 * control carries is the owner's (G3193).
 *
 * 🛑 AND THE OWNER ANSWERED IT — G3193, 2 Oct 2026, THE OWNER'S RULING: *"Hide
 * refused items: controls refused by a ruling (G230 passkey, G265 emailed
 * sign-in link, and any other control whose absence is a RULING rather than
 * unbuilt work) are omitted; only genuinely-planned unbuilt items show 'Coming
 * soon'."* Both `<Soon>` controls are DELETED from the card, on both tabs, and
 * the *"Other ways in"* divider went with them — a divider over nothing is a
 * promise with no content. The sentence above that says they "are now `<Soon>`
 * controls" is history, kept because it is what G3192 did (G3259).
 * `tests/app/refused-not-soon.test.ts` holds it in the source;
 * `tests/e2e/browser-login.test.ts` §26a holds it on the rendered card.
 *
 * ⚠️ AND THE AUDIENCE COLUMN IS RE-WORDED WHERE THE PACK IS WRONG. V3 says
 * *"The passkey carries the role, so nobody picks it from a list"*; G266 rules
 * that sentence wrong in three places — *"A CREDENTIAL CARRIES THE
 * ORGANISATION AND NEVER THE ROLE"* — and *"the copy changes; the experience
 * does not"*. It also promises Ask and Reports, which this application has not
 * built, so the customer row names the register alone.
 *
 * WHAT IT SENDS: the DOMAIN, twice (which door; then pin it), and never the
 * address. WHAT IT SAYS: one line per outcome and no detail the plane withheld
 * — the routing refusals are one status and one length on purpose, and this
 * screen does not undo that by guessing which one it got.
 */

import { useEffect, useState, type FormEvent } from 'react'

import type { MockPersona } from '../../../infra/lib/mock-personas.ts'
import { beginSignIn, type SignInBegin } from '../api/signin.ts'
import { partnerSignIn, type PartnerSignIn } from '../routes/surfaces.ts'
import { testPersonaByEmail } from '../test-personas.ts'
import { EntryTop } from './EntryTop.tsx'

type Phase = { readonly kind: 'ready' } | { readonly kind: 'beginning' } | SignInBegin

const LINE: Readonly<Record<Phase['kind'], string>> = {
  ready: 'Use the address your organisation gave you. Your organisation’s own directory signs you in.',
  beginning: 'Finding your directory.',
  redirect: 'Opening your directory.',
  not_an_address: 'That is not an email address. Enter the whole address.',
  no_door: 'There is no sign-in for that address here. Check it, or ask whoever invited you.',
  refused: 'A sign-in could not be started. Try again in a moment.',
}

/**
 * G3003 — A STAGING TEST PERSONA, NAMED BY `?login_hint=`, IN A TEST BUILD
 * ONLY. `testPersonaByEmail()` answers `null` in every other build (a
 * compile-time constant) and for any address that is not in the catalogue,
 * so in production this is `null` for every URL and the screen is exactly
 * the screen it was. The hint begins the ORDINARY sign-in for that address
 * and is forwarded to the broker as `login_hint`, where the mock door uses it
 * to pre-select the persona — and still asks for the password.
 */
function hintedPersona(): MockPersona | null {
  if (typeof window === 'undefined') return null
  return testPersonaByEmail(new URLSearchParams(window.location.search).get('login_hint'))
}

/**
 * A refusal with no status, or a 5xx, is the sign-in SERVICE not answering —
 * the one moment this page actually knows something about reachability, so it
 * says it in words rather than in a light.
 */
function lineFor(phase: Phase): string {
  if (phase.kind === 'refused' && (phase.status === 0 || phase.status >= 500)) {
    return 'The sign-in service did not answer, so nothing was sent to your directory. Try again in a moment.'
  }
  return LINE[phase.kind]
}

type Tab = 'customer' | 'partner'

function AddressForm({ phase, onSubmit, initial = '' }: {
  readonly phase: Phase
  readonly onSubmit: (address: string) => void
  /** A test persona's address, in a test build only (G3003); otherwise empty. */
  readonly initial?: string
}) {
  const [address, setAddress] = useState(initial)
  const busy = phase.kind === 'beginning' || phase.kind === 'redirect'
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(address)
  }
  return (
    <>
      <form className="way" data-signin-begin={phase.kind} onSubmit={submit}>
        <label className="field">
          <span>Work email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            placeholder="you@company.com"
            required
            aria-describedby="signin-line"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
        {/* `aria-disabled`, never `disabled`: a disabled control leaves the tab
            order (`tests/design/overlays.test.ts` §0), and `submit()` already
            refuses a second press while one is in flight. */}
        <button
          className="btn btn--primary"
          type="submit"
          data-commit
          data-signin-continue
          aria-disabled={busy}
        >
          Continue with your organisation<span className="k">your directory decides</span>
        </button>
      </form>
      <p id="signin-line" role="status" data-signin-line>
        {lineFor(phase)}
      </p>
    </>
  )
}

function Audiences() {
  return (
    <aside className="auds-col" aria-label="Where you land">
      <span className="lab">You land in the right place</span>
      <div className="audiences">
        <div className="aud">
          <span className="who">Customer · user</span>
          <span className="lands">Straight into your own tenant, at your own host — the register.</span>
        </div>
        <div className="aud">
          <span className="who">Customer · approver</span>
          <span className="lands">
            Same tenant, same register. Your role is read from what your organisation assigned
            you once you are signed in, so nobody picks it from a list.
          </span>
        </div>
        <div className="aud">
          <span className="who">Partner</span>
          <span className="lands">
            The partner portal, at its own address — a session belongs to the address it was
            started at.
          </span>
        </div>
        <div className="aud">
          <span className="who">1CloudHub</span>
          <span className="lands">
            Straight into the staff console — and your tenant stays yours: reaching it takes your
            explicit grant, every time.
          </span>
        </div>
      </div>
    </aside>
  )
}

function PartnerWay({ where, phase, onSubmit, initial }: {
  readonly where: PartnerSignIn
  readonly phase: Phase
  readonly onSubmit: (address: string) => void
  readonly initial: string
}) {
  if (where.kind === 'here') return <AddressForm phase={phase} onSubmit={onSubmit} initial={initial} />
  if (where.kind === 'elsewhere') {
    return (
      <>
        <div className="way">
          <a className="btn btn--primary" data-commit data-partner-signin href={where.href}>
            Continue at the partner portal<span className="k">{new URL(where.href).host}</span>
          </a>
        </div>
        <p>A session belongs to the address it was started at, so partners sign in at the
        partner portal rather than here.</p>
      </>
    )
  }
  return (
    <p data-partner-signin="unknown">
      <b>Partners sign in at the partner portal’s own address, not here</b> — a session belongs
      to the address it was started at. Whoever set up your partner account can give it to you.
    </p>
  )
}

export function SignIn() {
  const where = partnerSignIn(window.location.hostname, window.location.port)
  const [tab, setTab] = useState<Tab>(where.kind === 'here' ? 'partner' : 'customer')
  const [hinted] = useState<MockPersona | null>(hintedPersona)
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' })

  async function begin(forAddress: string) {
    if (phase.kind === 'beginning' || phase.kind === 'redirect') return
    setPhase({ kind: 'beginning' })
    let out: SignInBegin
    try {
      out = await beginSignIn(forAddress, window.sessionStorage)
    } catch {
      out = { kind: 'refused', status: 0, code: null }
    }
    setPhase(out)
    if (out.kind === 'redirect') {
      let target = out.authorizationUrl
      if (hinted !== null && hinted.email === forAddress) {
        const url = new URL(out.authorizationUrl)
        url.searchParams.set('login_hint', hinted.email)
        target = url.toString()
      }
      window.location.assign(target)
    }
  }

  /* The switcher's hand-off: a hinted persona begins at once, exactly as if
     the address had been typed and Continue pressed. */
  useEffect(() => {
    if (hinted !== null) void begin(hinted.email)
  }, [])

  const onSubmit = (address: string): void => { void begin(address) }

  return (
    <div className="entry" data-surface="signin">
      <div className="card">
        <EntryTop />
        <div className="card-split">
          <div>
            <ul className="tabs">
              <li>
                <button
                  type="button"
                  aria-current={tab === 'customer' ? 'true' : undefined}
                  onClick={() => setTab('customer')}
                >
                  Customer
                </button>
              </li>
              <li>
                <button
                  type="button"
                  aria-current={tab === 'partner' ? 'true' : undefined}
                  onClick={() => setTab('partner')}
                >
                  Partner
                </button>
              </li>
            </ul>

            {tab === 'customer' ? (
              <>
                {/* G3428 — THE OWNER'S RULING, 3 Oct 2026: *"Soften it: keep the
                    tone, drop absolute claims (e.g. 'Your close is ready. What
                    needs you is waiting.')."* The pack's V3 copy — *"Every
                    document has been read, every pair matched"* — is a claim a
                    sign-in screen cannot evidence (RC-32, PRODUCT.md). */}
                <h1>Welcome back. Your close is ready.</h1>
                <p>The machine reads the documents, matches what it can and sets each
                exception beside the reasoning behind it — including what it ruled out.{' '}
                <b>What needs you is waiting.</b></p>

                <AddressForm phase={phase} onSubmit={onSubmit} initial={hinted?.email ?? ''} />

              </>
            ) : (
              <>
                <h1>Sign in to the partner portal.</h1>
                <p>Your arrangements, your rate cards, the tenants you sold and the commission
                you have earned. <b>You sign in with your own organisation’s identity
                provider</b> — we never hold your people’s credentials, and removing someone
                there removes them here.</p>

                <PartnerWay where={where} phase={phase} onSubmit={onSubmit} initial={hinted?.email ?? ''} />


                <p className="foot-note"><b>No partner session reaches a customer’s tenant</b>
                {' '}beyond commercial metadata without a live grant that customer issued.</p>
              </>
            )}
          </div>
          <Audiences />
        </div>
      </div>
    </div>
  )
}

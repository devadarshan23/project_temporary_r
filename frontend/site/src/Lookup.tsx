/**
 * `/lookup` — WHICH DOOR IS YOURS. The pack's `V3 Sign In.dc.html`, its email
 * lookup (`#why-same`) and its routed state, built against `resolveHomeRealm`.
 * G3075–G3076, 2 Oct 2026.
 *
 * Drawn as the pack draws it: the `.entry` card, the mark and *"Back to the
 * site"* across the top, a work-email field, and then the ROUTED panel —
 * *"Taking you to"* — with Continue and *"Not you? Start again"*.
 *
 * WHAT IS NOT BUILT, AND WHY, STATED HERE RATHER THAN DRAWN:
 *
 * ⚠️ THE PASSKEY, MICROSOFT, GOOGLE AND EMAILED-LINK BUTTONS of the pack's idle
 * state. None has an operation: no passkey ceremony is declared on any tier, no
 * operation mails a link, and the federated buttons in the drawing route
 * illustrative identities. The one way in this tree serves is the federated
 * sign-in `/signin` already begins, so this screen ends in it.
 *
 * 🛑 G3076 — THE PACK'S `#why-same` SENTENCE IS NOT TRUE OF THIS OPERATION AND
 * IS NOT SHIPPED. It reads *"A domain we do not recognise gets the same reply as
 * one we do."* `resolveHomeRealm` answers 200 for a domain with a door and 422
 * for one without, and its contract says so in capitals — *"WHAT THIS DOES NOT
 * CLOSE … a DOMAIN-existence signal … THIS IS THE FIRST QUESTION FOR THE D6
 * THREAT MODEL"* — and the pack's own route-table cell agrees: *"A resolving
 * domain is still a yes."* So the screen says the true thing: no PERSON is ever
 * looked up, and whether a domain has a sign-in here is the one fact the answer
 * gives away. The four refusal codes are collapsed to one sentence
 * (`api/lookup.ts`), so the screen discloses nothing the status line did not.
 *
 * ⚠️ AND THE ROUTED PANEL NAMES NO HOST. The pack's *"Taking you to"* shows a
 * tenant URL; `RealmRouting` carries a connection id and nothing else, so the
 * destination this screen can truthfully name is *your organisation's sign-in*.
 * Inventing a host from a domain would be the screen deciding a routing the
 * model refuses to publish.
 *
 * ✅ RA-04 — G3591, 3 Oct 2026: THE FORM STATE CARRIES V3's RIGHT-HAND PANEL,
 * *"You land in the right place"* (`V3 Sign In.dc.html` `.auds-col`), because
 * it is not refused — it says where each kind of person arrives, which is what
 * a person on this page is about to find out. Two words differ from the pack
 * and each is named: the approver's *"The passkey carries the role"* is
 * G266's re-wording (*"A CREDENTIAL CARRIES THE ORGANISATION AND NEVER THE
 * ROLE"*), and the customer user's *"with your data never leaving your
 * account"* is dropped, because it is true of a BYOA tenant and false of a
 * hosted one, and this page cannot know which a reader has.
 *
 * ✅ RA-01 — G3590: the host suffix is an unbroken lowercase hostname. Its
 * wrapper was a `<span>` directly inside `label.field`, so `public.css`'s
 * `.field > span` set it as a micro-label — uppercased, tracked, and wrapped
 * at the hyphen (`.US-WEST-` / `2.RECONCILEAI.APP`). It is a `<div>` now and
 * the suffix does not wrap.
 *
 * 🛑 NO `/v1` READ AND NO APP CHROME — `PublicPlane.tsx`. The only request this
 * screen makes is `POST /session/realm` with `{ domain }`.
 *
 * ⚠️ CONTINUE IS A NAVIGATION, NOT `beginSignIn()` — G3153, 2 Oct 2026. This
 * file was `frontend/src/public/Lookup.tsx` (G3075) and moved into the apex
 * site under the owner's ruling. On the apex, `/session/signin` is not proxied
 * and a PKCE verifier kept in the apex's storage is unreadable on the tenant
 * host the callback lands on, so the begin happens THERE: Continue takes the
 * person to `https://<their sign-in name>.us-west-2.reconcileai.app/signin`,
 * where `/signin` re-asks the realm itself. `api/lookup.ts` argues why the
 * person names the host and the page never infers it.
 */

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { lookUpRealm, signInUrlFor, SIGN_IN_HOST_SUFFIX, type RealmLookup } from './api/lookup.ts'
import { Logo, PublicFrame, SITE_PATHS } from './PublicPlane.tsx'

type Phase =
  | { readonly kind: 'ready' }
  | { readonly kind: 'asking' }
  | RealmLookup
  | { readonly kind: 'continuing'; readonly domain: string }

export function Lookup(): ReactNode {
  const [address, setAddress] = useState('')
  const [signInName, setSignInName] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' })
  const destination = signInUrlFor(signInName)
  /* NA-01 (G3714): when the answer replaces the form, focus goes to the new
     state's heading — it was left on <body>, so a keyboard user started again
     from the top of the page. */
  const card = useRef<HTMLDivElement | null>(null)
  const answered = phase.kind === 'routed' || phase.kind === 'no_door'
  useEffect(() => {
    if (!answered) return
    card.current?.querySelector<HTMLElement>('[data-state-head]')?.focus()
  }, [answered, phase.kind])

  async function ask(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (phase.kind === 'asking') return
    setPhase({ kind: 'asking' })
    setPhase(await lookUpRealm(address))
  }

  /* G3153: the realm answers a door, not a host, so the person names the host
     and the browser goes there. Nothing is sent: a navigation carries no body,
     and the URL carries no address, no domain and no connection id. */
  function proceed(domain: string): void {
    if (destination === null) return
    setPhase({ kind: 'continuing', domain })
    window.location.assign(destination)
  }

  const startAgain = (): void => {
    setAddress('')
    setSignInName('')
    setPhase({ kind: 'ready' })
  }

  const asking = phase.kind === 'asking'
  const showForm = phase.kind === 'ready' || phase.kind === 'asking' ||
    phase.kind === 'not_an_address' || phase.kind === 'unanswered'

  return (
    <PublicFrame page="lookup">
      <div className="entry">
        <div className="card" data-lookup-state={phase.kind} ref={card}>
          <div className="top">
            <a href={SITE_PATHS.home} style={{ textDecoration: 'none' }} aria-label="Reconcile AI">
              <Logo />
            </a>
            <a href={SITE_PATHS.home} className="small" style={{ color: 'var(--muted)' }}>
              <span className="mono" aria-hidden="true">‹</span>&nbsp;Back to the site
            </a>
          </div>

          {showForm && (
            <div className="card-split" data-lookup-split>
            <div>
              <h1>Sign in with your work email.</h1>
              <p>
                Every organisation signs in through its own directory, so we start by finding
                yours. <b>Only the part after the @ leaves this browser</b> — we never look up a
                person, and your own sign-in decides who you are.
              </p>

              <form className="way" style={{ marginTop: 'calc(var(--u) * 6)' }} onSubmit={(e) => void ask(e)} noValidate>
                <label className="field">
                  <span>Work email</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="username"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="you@company.com"
                    aria-describedby="why-same"
                    aria-invalid={phase.kind === 'not_an_address'}
                  />
                </label>
                <button className="btn btn--primary" type="submit" data-commit data-lookup-find aria-disabled={asking}>
                  {asking ? 'Finding your sign-in' : 'Find my sign-in'}
                </button>
              </form>

              {phase.kind === 'not_an_address' && (
                <p role="alert" style={{ marginTop: 'calc(var(--u) * 4)' }}>
                  <b>That is not an email address.</b> Enter the whole address, including the part
                  after the @.
                </p>
              )}
              {phase.kind === 'unanswered' && (
                <p role="alert" style={{ marginTop: 'calc(var(--u) * 4)' }}>
                  <b>The sign-in service did not answer.</b> Nothing was sent but the domain. Try
                  again in a moment.
                </p>
              )}

              <p id="why-same" style={{ marginTop: 'calc(var(--u) * 5)' }}>
                <b>We never look up a person.</b> The address is split here and only its domain is
                asked about, so two people at one company are one question and get one answer. What
                that answer does give away is whether a domain has a sign-in with us at all — not who
                works there.
              </p>
              <p style={{ marginTop: 'calc(var(--u) * 5)' }}>
                <b>Your organisation registers its own directory with us</b>, and its domain routes
                there only once we have verified it, because an unverified claim on a domain is a
                way to capture somebody else&rsquo;s logins.
              </p>
            </div>
            <LandsIn />
            </div>
          )}

          {(phase.kind === 'routed' || phase.kind === 'continuing') && (
            <div>
              <h1 tabIndex={-1} data-state-head>Your organisation signs you in.</h1>
              <p>
                <span className="mono">{phase.domain}</span> has a verified sign-in with us, so you
                continue at your organisation&rsquo;s own directory and it decides who you are.
              </p>
              <div className="routed">
                <span className="lab">Taking you to</span>
                <span className="dest">Your organisation&rsquo;s sign-in</span>
                <p style={{ marginTop: 'calc(var(--u) * 3)' }}>
                  We found your organisation&rsquo;s sign-in, but not its address here: the lookup
                  cannot tell which of our hosts is your organisation&rsquo;s, and it does not guess
                  one from your email. Your sign-in
                  address is the name your IT team gave you when you were set up.
                </p>
              </div>
              <label className="field" style={{ marginTop: 'calc(var(--u) * 6)' }}>
                <span>Your organisation&rsquo;s sign-in name</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 'calc(var(--u) * 1)' }} data-lookup-name-row>
                  {/* NA-04 (G3719): the unbroken suffix WRAPS onto its own line
                      when the field would be left too narrow to read — at 390 it
                      took 195 of the row and left the name 108px. */}
                  <input
                    style={{ flex: '1 1 calc(var(--u) * 48)', minWidth: 0 }}
                    type="text"
                    name="signInName"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="mono"
                    value={signInName}
                    onChange={(e) => setSignInName(e.target.value)}
                    placeholder="your-organisation"
                    aria-invalid={signInName.trim() !== '' && destination === null}
                  />
                  <span className="mono small" style={{ whiteSpace: 'nowrap' }} data-lookup-suffix>
                    {SIGN_IN_HOST_SUFFIX}
                  </span>
                </div>
              </label>
              {signInName.trim() !== '' && destination === null && (
                <p role="alert" style={{ marginTop: 'calc(var(--u) * 3)' }}>
                  <b>That is not a sign-in name.</b> One word of letters, digits and hyphens — the
                  part before <span className="mono">{SIGN_IN_HOST_SUFFIX}</span>.
                </p>
              )}
              <div className="way" style={{ marginTop: 'calc(var(--u) * 6)' }}>
                <button
                  className="btn btn--primary"
                  type="button"
                  data-commit
                  data-lookup-continue
                  aria-disabled={phase.kind === 'continuing' || destination === null}
                  onClick={() => { if (phase.kind === 'routed') proceed(phase.domain) }}
                >
                  {phase.kind === 'continuing' ? 'Opening your sign-in' : 'Continue'}
                </button>
                <button className="btn btn--quiet" type="button" onClick={startAgain}>
                  Not you? Start again
                </button>
              </div>
            </div>
          )}

          {phase.kind === 'no_door' && (
            <div>
              <h1 tabIndex={-1} data-state-head>There is no sign-in for that address here.</h1>
              <p>
                <span className="mono">{phase.domain}</span> does not route to a sign-in with us.
                <b> If you expected it to</b>, your IT team can tell you your sign-in address, or ask
                us to add your domain. Both are faster than guessing.
              </p>
              <div className="way" style={{ marginTop: 'calc(var(--u) * 6)' }}>
                <button className="btn" type="button" onClick={startAgain}>
                  Try another address
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PublicFrame>
  )
}

/**
 * V3's `.auds-col` — WHO LANDS WHERE (RA-04, G3591). The four cards are the
 * pack's, with the two changes the header names. Prose, no control: nothing
 * here routes, and the credential decides, as the lead says.
 */
const LANDINGS: readonly { readonly who: string; readonly lands: string }[] = [
  {
    who: 'Customer · user',
    lands: 'Straight into your own tenant, at your own host — the register, Ask and Reports.',
  },
  {
    who: 'Customer · approver',
    lands:
      'Same tenant, different surface: what is waiting on your authority. Your role is read from ' +
      'what your organisation assigned you, so nobody picks it from a list.',
  },
  {
    who: 'Partner',
    lands:
      'Straight into the partner portal — your arrangements, your rate cards, the tenants you sold ' +
      'and the commission you have earned.',
  },
  {
    who: '1CloudHub',
    lands:
      'Straight into the staff console — and your tenant stays yours: reaching it takes your ' +
      'explicit grant, every time.',
  },
]

function LandsIn(): ReactNode {
  return (
    <aside className="auds-col" data-lookup-lands>
      <span className="lab">You land in the right place</span>
      <div className="audiences">
        {LANDINGS.map((l) => (
          <div className="aud" key={l.who}>
            <span className="who">{l.who}</span>
            <span className="lands">{l.lands}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}

/**
 * `/signin/callback` — RETURNING FROM THE DIRECTORY. W3/S7, 1 Oct 2026, G2502.
 *
 * 🛑 THIS IS A STATE THE DRAWN RECORD ALREADY HAS, NOT A NEW SURFACE. The
 * route `/signin` (`design/routes/entry.html#r-signin`, at
 * `archive/pre-handoff-pack`) draws, among its sixteen stills, *"Returning
 * from the directory — the hand-back, and nothing on the wire receives it …
 * The interstitial exists so the round trip is not a blank frame. It states
 * which connection answered and nothing about who."* S6 put something on the
 * wire to receive it; this is the frame. It is given its own ADDRESS because
 * the broker must send the browser to a fixed `redirect_uri`
 * (`SIGN_IN_CALLBACK_PATH`, mirrored against `infra/`), which is
 * `/signin/lapsed`'s precedent: a state of the sign-in surface that needs a URL.
 *
 * ⚠️ THE PACK DOES NOT DRAW IT, AND THE NAME IS THE TREE'S. The north star
 * calls the whole surface `/entry`; the tree calls it `/signin`; which name
 * stands is G1914 and THE OWNER'S, and this file takes the tree's spelling
 * without resolving it.
 *
 * WHAT IT SAYS AND DOES NOT SAY: one line per outcome, no person, no email, no
 * error detail — the plane's codes are deliberately uninformative and this
 * screen does not undo that by guessing.
 */

import { useEffect, useState } from 'react'

import { EntryTop } from './EntryTop.tsx'

import {
  PENDING_SIGN_IN_KEY,
  completeSignIn,
  readPendingSignIn,
  type SignInCompletion,
} from '../api/signin.ts'

type Phase = { readonly kind: 'completing' } | SignInCompletion

const LINE: Readonly<Record<Phase['kind'], string>> = {
  completing: 'Returning from your directory. Completing the sign-in.',
  signed_in: 'Signed in. Opening your workspace.',
  not_started: 'This browser did not start a sign-in. Start again from the sign-in page.',
  state_mismatch:
    'This return does not match the sign-in this browser started, so it was not completed. Start again.',
  refused: 'The sign-in was not completed. Start again from the sign-in page.',
}

/**
 * ONE COMPLETION PER PAGE LOAD, SHARED. React's `StrictMode` runs an effect
 * twice in development; two runs would read-and-remove the pending values
 * once each and the second would report `not_started` — or, without the
 * removal, POST twice and be refused as a replay. A module-level promise
 * makes the act happen once whatever renders it.
 */
let completion: Promise<SignInCompletion> | null = null

function completeOnce(): Promise<SignInCompletion> {
  if (completion === null) {
    /* ONE USE. Read and removed before the request, so a reload of this page
       cannot replay the callback from this browser — the plane would refuse a
       replay anyway (`sign_in_attempt_replayed`), and this keeps the PKCE
       verifier from outliving the one exchange it was minted for. */
    const pending = readPendingSignIn(window.sessionStorage)
    try {
      window.sessionStorage.removeItem(PENDING_SIGN_IN_KEY)
    } catch {
      /* storage unavailable: `pending` is already null in that case */
    }
    completion = completeSignIn(new URLSearchParams(window.location.search), pending)
  }
  return completion
}

export function SignInCallback() {
  const [phase, setPhase] = useState<Phase>({ kind: 'completing' })

  useEffect(() => {
    let cancelled = false
    void completeOnce().then(
      (out) => {
        if (cancelled) return
        setPhase(out)
        if (out.kind === 'signed_in') window.location.replace(out.landing)
      },
      () => {
        if (!cancelled) setPhase({ kind: 'refused', status: 0, code: null })
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  /* G3048: the hand-back is drawn in V3's card, on the signed-out shell — the
     chrome bar belongs to a session, and this page exists because there is not
     one yet. A failed return offers the one way back that exists: `/signin`. */
  const failed = phase.kind !== 'completing' && phase.kind !== 'signed_in'
  return (
    <div className="entry" data-surface="signin-callback">
      <div className="card">
        <EntryTop />
        <h1>{failed ? 'The sign-in was not completed.' : 'Returning from your directory.'}</h1>
        <p data-signin-state={phase.kind}>{LINE[phase.kind]}</p>
        {failed ? (
          <div className="way">
            <a className="btn btn--primary" data-commit href="/signin">
              Start again<span className="k">from the sign-in page</span>
            </a>
          </div>
        ) : null}
      </div>
    </div>
  )
}

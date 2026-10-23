/**
 * THE STAGING PROFILE SWITCHER — G3003, the owner's ruling G2771 (2 Oct 2026):
 * *"A profile switcher for the mock sign-in and for the owner, so all user
 * journeys can be tested across the customer, partner and 1CloudHub
 * portals."*
 *
 * 🛑 IT RENDERS NOTHING IN A BUILD THAT IS NOT A TEST BUILD, AND THAT IS A
 * COMPILE-TIME FACT (`frontend/src/test-personas.ts`), NOT A RUNTIME CHECK.
 *
 * 🛑 CHOOSING A PERSONA IS A REAL SIGN-OUT AND A REAL SIGN-IN, NEVER AN
 * IMPERSONATION. Two acts, in order:
 *
 *   1  `DELETE /session` on THIS host — `signOut`, which REVOKES the row the
 *      cookie names (`server/data-plane/sign-out.ts`) and withdraws the
 *      cookie. A `401` (nobody signed in here) is not an obstacle.
 *   2  navigate to the persona's PORTAL host's `/signin?login_hint=<address>`,
 *      where the ordinary begin routes the address's domain to its mock door.
 *      The mock door still asks for the password; the hint only pre-selects.
 *
 * ⚠️ NO HEADER, NO COOKIE AND NO QUERY PARAMETER HERE SELECTS A USER. The
 * plane learns who signed in from the broker's verified token and from
 * nothing this component sends.
 */

import { useState } from 'react'

import type { MockPersona } from '../../../infra/lib/mock-personas.ts'
import { TEST_PERSONAS_ENABLED, signInUrlFor, testPersonas } from '../test-personas.ts'

type Phase = { readonly kind: 'idle' } | { readonly kind: 'switching'; readonly to: string }

async function switchTo(persona: MockPersona): Promise<void> {
  try {
    await fetch('/session', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    })
  } catch {
    /* A plane that is not answering cannot have a session to revoke from this
       tab either; the sign-in below is still the honest next act. */
  }
  window.location.assign(signInUrlFor(persona))
}

const PORTAL_LABEL: Readonly<Record<MockPersona['door'], string>> = {
  customer: 'Customer portal',
  partner: 'Partner portal',
  platform: '1CloudHub console',
}

/**
 * G3191 — WHERE IT IS DRAWN. In the signed-in chrome it is an item of #531's
 * quiet account menu (`ChromeBar`'s `switcher` slot, passed only by a test
 * build); a signed-out surface draws no chrome and therefore no account menu,
 * so there `main.tsx` draws it as a page aside. One component, one fence — the
 * `placement` changes the wrapper and nothing about the act.
 */
export function ProfileSwitcher({ placement = 'page' }: { readonly placement?: 'menu' | 'page' } = {}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  if (!TEST_PERSONAS_ENABLED) return null
  const personas = testPersonas()
  const doors: readonly MockPersona['door'][] = ['customer', 'partner', 'platform']

  return (
    <aside
      className="text-body flex flex-col gap-1"
      data-profile-switcher={placement}
      aria-label="Test personas"
    >
      <p className="text-label">
        <strong>Staging test personas.</strong> Choosing one signs you out here and signs in again
        as that persona through the mock door, which asks for the shared mock password.
      </p>
      {phase.kind === 'switching' ? (
        <p className="text-label text-muted" data-profile-switching>
          Signing out, then opening the sign-in for {phase.to}.
        </p>
      ) : null}
      {doors.map((door) => (
        <section key={door}>
          <p className="text-label text-muted">{PORTAL_LABEL[door]}</p>
          <ul>
            {personas
              .filter((p) => p.door === door)
              .map((p) => (
                <li key={p.sub}>
                  <button
                    type="button"
                    data-persona={p.email}
                    aria-disabled={phase.kind === 'switching'}
                    onClick={() => {
                      if (phase.kind === 'switching') return
                      setPhase({ kind: 'switching', to: p.name })
                      void switchTo(p)
                    }}
                  >
                    {p.name}
                  </button>{' '}
                  <span className="text-label text-muted">
                    {p.actor} · {p.portalHost} · {p.journeys.join(' ')}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </aside>
  )
}

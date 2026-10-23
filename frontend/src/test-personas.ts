/**
 * THE STAGING TEST PERSONAS, AS THE BROWSER SEES THEM — G3003, the owner's
 * profile-switcher ruling G2771 (2 Oct 2026): *"A profile switcher for the
 * mock sign-in and for the owner, so all user journeys can be tested across
 * the customer, partner and 1CloudHub portals."*
 *
 * 🛑 `TEST_PERSONAS_ENABLED` IS A COMPILE-TIME CONSTANT AND IS `false` IN
 * EVERY BUILD BUT A STAGING ONE. `frontend/vite.config.ts` defines
 * `__RECONCILE_TEST_PERSONAS__` as `true` only when the build ran with
 * `RECONCILE_TEST_PERSONAS=on`, and the pipeline sets that for staging alone
 * (`testPersonasBuildFlag()`). With it `false` every expression below is dead
 * and the bundler drops the catalogue import with it —
 * `tests/app/profile-switcher-fence.test.ts` reads the gate's own bundle and
 * requires no mock address in it. **A runtime check would not do**: the list
 * would ship to production and be hidden, which is a different sentence.
 *
 * ⚠️ THE `typeof` GUARD IS FOR NODE. The two globals exist only inside a Vite
 * build; a test importing this file under `node --test` reads `false`.
 */

import { MOCK_PERSONAS, type MockPersona } from '../../infra/lib/mock-personas.ts'

declare const __RECONCILE_TEST_PERSONAS__: boolean
declare const __RECONCILE_TEST_PORTAL_ORIGINS__: string

export const TEST_PERSONAS_ENABLED: boolean =
  typeof __RECONCILE_TEST_PERSONAS__ !== 'undefined' && __RECONCILE_TEST_PERSONAS__

/** Every persona — or none, in a build that is not a test build. */
export function testPersonas(): readonly MockPersona[] {
  return TEST_PERSONAS_ENABLED ? MOCK_PERSONAS : []
}

/** A persona by address, ONLY from the catalogue and only in a test build. */
export function testPersonaByEmail(email: string | null): MockPersona | null {
  if (!TEST_PERSONAS_ENABLED || email === null) return null
  const wanted = email.trim().toLowerCase()
  return MOCK_PERSONAS.find((p) => p.email === wanted) ?? null
}

function portalOrigins(): Readonly<Record<string, string>> {
  if (!TEST_PERSONAS_ENABLED || typeof __RECONCILE_TEST_PORTAL_ORIGINS__ === 'undefined') return {}
  try {
    const parsed: unknown = JSON.parse(__RECONCILE_TEST_PORTAL_ORIGINS__)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

/**
 * Where a persona's sign-in begins: their portal host's `/signin`, with the
 * address as `login_hint`. The begin is the REAL one — `resolveHomeRealm`
 * routes the address's domain to its mock door and `beginFederatedSignIn`
 * pins it — so a persona is never impersonated and no header selects a user.
 */
export function signInUrlFor(persona: MockPersona): string {
  const origin = portalOrigins()[persona.portalHost] ?? `https://${persona.portalHost}`
  const url = new URL('/signin', origin)
  url.searchParams.set('login_hint', persona.email)
  return url.toString()
}

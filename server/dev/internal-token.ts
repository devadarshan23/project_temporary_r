/**
 * THE LOCAL STAND-IN FOR THE INTERNAL EDGE'S SigV4 — A SIGNED TOKEN OVER THE
 * SAME DIGEST, BEHIND THE SAME FLAG, REACHED THE SAME WAY. G4305.
 *
 * THE OWNER'S RULING: *"Locally/compose, provide an equivalent verifier seam
 * (e.g. a test signer behind the existing local flag pattern — structural fence
 * like G192, never a permissive default)."*
 *
 * 🛑 THE FENCE IS AN ABSENT MODULE, EXACTLY AS FOR `test-token.ts`. Both
 * `server/data-plane/control-plane-client.ts` and
 * `server/control-plane/internal-auth.ts` reach this file through a DYNAMIC
 * import that runs only when `RECONCILE_LOCAL_TEST_AUTH` is exactly `1`, chosen
 * ONCE at boot. A plane started without the flag never loads it, so there is no
 * accepting path in the process to reach. `tests/http/internal-edge.test.ts` §6
 * asserts the static-import absence over both plane directories.
 *
 * ⚠️ IT SIGNS THE SAME DIGEST THE STS PATH SIGNS — `internalRequestDigest()` —
 * plus the audience and a date, so the local seam binds a request exactly as
 * strongly as the deployed one does, and is refused on a mismatch for the same
 * reasons. The key is `test-token.ts`'s published dev key, prefixed so a token
 * for one purpose can never verify as the other.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

const VERSION = 'rit1'
const MAX_SKEW_SECONDS = 300
const PUBLISHED_DEV_KEY = 'reconcile-local-internal-token-key/not-a-secret'

function key(): Buffer {
  const override = process.env['RECONCILE_LOCAL_TEST_SECRET']
  return Buffer.from(`internal:${override === undefined || override === '' ? PUBLISHED_DEV_KEY : override}`, 'utf8')
}

function mac(body: string): string {
  return createHmac('sha256', key()).update(body).digest('base64url')
}

export function mintInternalToken(args: { digest: string; audience: string; at?: number }): string {
  const at = args.at ?? Math.floor(Date.now() / 1000)
  const body = `${VERSION}.${at}.${args.audience}.${args.digest}`
  return `${VERSION}.${at}.${mac(body)}`
}

/** True only for a token over THIS digest and THIS audience, inside the skew. */
export function verifyInternalToken(token: string, digest: string, audience: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [version, atRaw, given] = parts as [string, string, string]
  if (version !== VERSION || !/^\d{1,12}$/.test(atRaw)) return false
  const at = Number(atRaw)
  if (Math.abs(Math.floor(Date.now() / 1000) - at) > MAX_SKEW_SECONDS) return false
  const expected = Buffer.from(mac(`${VERSION}.${at}.${audience}.${digest}`), 'utf8')
  const g = Buffer.from(given, 'utf8')
  return expected.length === g.length && timingSafeEqual(expected, g)
}

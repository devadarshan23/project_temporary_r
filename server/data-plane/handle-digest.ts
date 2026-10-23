/**
 * THE DIGEST SEAM — G160's COST, PAID IN ONE PLACE.
 *
 * `model/domain.ts` on `SessionHandleDigest`: *"the digest must be computed and
 * carried on every request. That is a fact about the migration and the request
 * plane, neither of which is this slice."* `db/session-scope.ts` and
 * `db/selection-scope.ts` both say the same thing from the other end —
 * *"computing it is the request plane's, and this module deliberately does not
 * compute it."* **This file is the request plane's half, and it is the only
 * place in `server/` that turns a presented handle into the value a policy
 * keys on.**
 *
 * ┌─ WHY IT IS ONE FUNCTION IN ONE FILE ───────────────────────────────────────┐
 * │ The digest is the RLS predicate for `tenant.session` under G160 — not a     │
 * │ lookup convenience. Two implementations of it would be two answers to       │
 * │ "which session row is this", and the one that drifts is always the copy     │
 * │ (docs/HANDOFF.md §5.3). A second call to `createHmac` anywhere under        │
 * │ `server/data-plane/` is therefore a defect, not a style preference.         │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE PREIMAGE IS NEVER STORED, LOGGED OR RETURNED, AND THIS FUNCTION IS THE
 * LAST PLACE IT EXISTS. `model/domain.ts`: *"A session handle IS a credential
 * in transit … a database dump containing handles would be a session-hijack
 * kit."* The argument dies the moment somebody puts the handle in an error
 * message, so nothing below interpolates its input into a string — including
 * the refusal.
 *
 * ⚠️ HMAC RATHER THAN A BARE HASH, AND THE KEY IS PLATFORM-WIDE ON PURPOSE.
 * `model/domain.ts` argues the choice where the type is declared, and the half
 * to carry here is the one that says why this is NOT the per-tenant HMAC
 * `SubjectIndexEntry.subjectRef` uses: *"A session handle's preimage is a value
 * WE minted, for one session, that identifies no person and recurs nowhere.
 * There is nothing to correlate. The key is also unavoidable at this point in
 * the chain — the tenant is not yet known, so a per-tenant key could not be
 * selected."*
 *
 * 🛑 THE KEY IS A PUBLISHED DEFAULT AND THAT IS COPIED FROM `server/dev/
 * test-token.ts` DELIBERATELY, ARGUMENT AND ALL — *"A secret default would
 * suggest the KEY is the security boundary. It is not."* What bounds this
 * surface is that the handle is server-minted and high-entropy, that the
 * preimage is never written down, and that `session_rls` denies on NULL; the
 * key is a pepper over a value nobody can enumerate anyway. A key that looked
 * secret would invite somebody to treat *"we rotated it"* as a control.
 *
 * ⚠️ AND THE HALF THAT IS NOT COPIED, BECAUSE IT IS DIFFERENT HERE. The test
 * token's key gates ACCEPTANCE, so its flag is the boundary; this key gates
 * NOTHING — it only decides which 64 hex characters a given handle maps to.
 * Changing it invalidates every stored session at once, which is why it is an
 * override and not a rotation schedule, and why a deployment that sets it must
 * set it ONCE. `RECONCILE_SESSION_DIGEST_KEY` is that override.
 */

import { createHmac } from 'node:crypto'

/** See the header. Not a secret, and not pretending to be one. */
const PUBLISHED_DIGEST_KEY = 'reconcile-session-handle-digest/not-a-secret'

export const DIGEST_KEY_ENV = 'RECONCILE_SESSION_DIGEST_KEY'

function digestKey(): Buffer {
  const override = process.env[DIGEST_KEY_ENV]
  return Buffer.from(
    override === undefined || override === '' ? PUBLISHED_DIGEST_KEY : override,
    'utf8',
  )
}

/**
 * The presented handle → the value `app.session_ref` carries and
 * `tenant.session.handle_digest` stores.
 *
 * 🛑 LOWERCASE HEX, 64 CHARACTERS, AND THE CASE IS PART OF THE CONTRACT RATHER
 * THAN A RENDERING CHOICE. The policy compares `handle_digest =
 * nullif(current_setting('app.session_ref', true), '')` — a `text` equality,
 * which is case-SENSITIVE — so a writer emitting upper case and a reader
 * emitting lower case would produce a session that can never see its own row,
 * and G100's polarity would report it as an ordinary empty result. One
 * function, one encoding, no comparison anywhere that has to remember.
 *
 * ⚠️ AN EMPTY HANDLE IS REFUSED RATHER THAN DIGESTED, and this is the arm that
 * matters. `nullif(…, '')` in the policy exists because a GUC that was set and
 * reverted reads back as the EMPTY STRING — so the one value that must never
 * reach `set_config` is a digest computed from nothing, which is a perfectly
 * well-formed 64-hex string that a caller supplying no credential could obtain.
 * Refusing here keeps "no handle" and "some handle" on different paths.
 */
export function digestOfHandle(handle: string): string | null {
  if (typeof handle !== 'string' || handle === '') return null
  return createHmac('sha256', digestKey()).update(handle, 'utf8').digest('hex')
}

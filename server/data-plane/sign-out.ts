/**
 * `signOut` — `DELETE /session`. Self-service sign-out, and nothing else.
 * G3004, 2 Oct 2026 (derived — NOT THE OWNER'S; it is the REVOKE the owner's
 * profile-switcher ruling G2771 names: *"choosing one = real sign-out
 * (revoke) + real begin-sign-in"*).
 *
 * 🛑 IT REVOKES THE CALLER'S OWN ROW AND CAN REACH NO OTHER. The statement is
 * `REVOKE_SESSION` — `server/data-plane/session.ts`'s, reused by G180's
 * revoking refusal — run inside `withSessionScope()` keyed on the digest the
 * AUTHENTICATOR accepted. `session_rls` makes that one row the only row the
 * `UPDATE` can see: there is no `WHERE id = …`, and a predicate somebody adds
 * here would make the target a value this handler chose rather than the one
 * the credential named.
 *
 * ⚠️ WHAT THE ANSWER CAN AND CANNOT SAY. The contract calls the operation
 * IDEMPOTENT — *"signing out an already-revoked session is the same answer"*.
 * The authenticator runs FIRST (`onRequest`), and it refuses a revoked
 * session with the declared `401` before this handler is reached, so a
 * SECOND sign-out with the same cookie is a `401`, not a `204`. Both are
 * declared, neither discloses anything the caller did not already hold, and
 * the alternative — an unauthenticated `DELETE` that revokes whatever it is
 * handed — is the shape this file refuses. Named, not hidden (G3005).
 *
 * ⚠️ CLEARING IS NOT REVOKING (`withdrawnSessionCookie()`'s own warning), so
 * this does BOTH, in that order: the row first, then the cookie. A clear that
 * landed while the revoke failed would sign a cooperating browser out and
 * leave the credential live; the revoke throwing answers a 500 and clears
 * nothing.
 */

import type { FastifyReply, FastifyRequest } from 'fastify'

import { withSelectionScope } from '../../db/selection-scope.ts'
import { withSessionScope } from '../../db/session-scope.ts'
import type { TenantPool } from '../../db/tenant-scope.ts'
import { principalOf, sendProblem, type Handler } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import { withdrawnSessionCookie } from './session-cookie.ts'
import type { TenantSession } from './session.ts'

/** `session.ts`'s `REVOKE_SESSION`, spelled once more because that one is not exported. */
const REVOKE_OWN_SESSION = 'UPDATE tenant.session SET revoked_at = now() WHERE revoked_at IS NULL'

const NO_ROW =
  'This caller authenticated without a session row, so there is no session to sign out. ' +
  'A locally minted test token is not a session.'

export function signOutHandler(pool: TenantPool): Handler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { sessionRef, row } = principalOf<TenantSession>(request)
    if (sessionRef === null || row === null) {
      return sendProblem(reply, {
        status: 401,
        code: CODES.sessionInvalid,
        title: 'There is no session to sign out.',
        detail: NO_ROW,
      })
    }
    /* 🛑 BOTH ARMS, EACH WITH THE SCOPE THAT SATISFIES ITS OWN POLICY — G180's
     * revoke in `session.ts`, for the same measured reason: a BOUND session's
     * `UPDATE` is checked by `session_selection_restrictive`, whose membership
     * subquery reads nothing without `app.tenant_id`, so the session scope
     * alone REFUSES it. An unbound one has no tenant to select. */
    const bound = row.tenantId
    const revoked = await (bound === null
      ? withSessionScope(pool, sessionRef, (tx) => tx.query(REVOKE_OWN_SESSION))
      : withSelectionScope(pool, sessionRef, bound, (tx) => tx.query(REVOKE_OWN_SESSION)))
    if ((revoked.rowCount ?? 0) !== 1) {
      /* A 204 that revoked nothing would sign a browser out and leave the
       * credential live — the one outcome this file exists to refuse. */
      throw new Error(`signOut revoked ${String(revoked.rowCount)} rows, not the caller's one`)
    }
    reply.header('set-cookie', withdrawnSessionCookie())
    reply.header('cache-control', 'no-store')
    return reply.code(204).send()
  }
}

/**
 * THE `X-Session` HEADER READER — AND IT LIVES HERE, IN `server/dev/`, BECAUSE
 * G386 SAYS SO IN AS MANY WORDS.
 *
 * ┌─ THE RULING'S SECOND HALF, VERBATIM ──────────────────────────────────────┐
 * │ *"`X-Session` survives ONLY behind `RECONCILE_LOCAL_TEST_AUTH`, and G192's │
 * │ fence is STRUCTURAL, not conditional: 'a plane started without the flag    │
 * │ never LOADS the file, so there is no accepting code path in the process to │
 * │ bypass.' **A boolean check inside a request handler does not satisfy this  │
 * │ ruling.** The header reader must be reached the way `server/dev/test-      │
 * │ token.ts` is — a resolver chosen ONCE at boot, behind a DYNAMIC import     │
 * │ that executes only when the flag is exactly `1` … Two accepting paths is   │
 * │ precisely what G192 was written to prevent; this ruling permits two only   │
 * │ because one of them cannot be loaded."*                                    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 SO THE THREE LINES BELOW ARE NOT WHAT MAKES THIS SAFE. THE DIRECTORY IS.
 *
 * `server/data-plane/session.ts` picks its credential reader ONCE, at boot. A
 * plane started without the flag holds a reader that reads a cookie and knows
 * nothing about a header; this module is never imported into that process, so
 * there is no `if` to move, no environment variable to re-read and no branch to
 * mis-review. Setting the variable afterwards changes nothing.
 *
 * ⚠️ **DO NOT ADD A STATIC `import … from '../dev/…'` TO ANYTHING UNDER
 * `server/data-plane/`.** One would convert a property into an intention, and
 * would also let a bundler or container build that starts from
 * `server/data-plane/main.ts` pull this file into the image. Reproduce the
 * structural half — it must return nothing:
 *
 *     grep -rn "from '\.\./dev/" server/data-plane/
 *
 * ⚠️ AND G316 IS UNTOUCHED BY THIS FILE EXISTING: the flag is absent from the
 * image and from every task definition, so the deployed host gains no second
 * path. `grep -rn 'RECONCILE_LOCAL_TEST_AUTH' infra/` → 0.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ WHAT THIS MODULE IS **NOT**, SAID PLAINLY SO NOBODY READS IT AS THE DEV
 *    TOKEN'S HOME.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `server/dev/test-token.ts` mints and verifies a SIGNED HMAC that carries its
 * own tenant and has no row behind it. This module reads a header and returns
 * whatever string was in it. The two are behind the same flag and are different
 * things: under the flag a real session HANDLE and a dev TOKEN both arrive
 * through this header, and `session.ts` tries the database first for the reason
 * its own header gives — *"where both could answer, the answer with more
 * controls on it is the one to take."*
 */

import type { FastifyRequest } from 'fastify'

/**
 * `capability.openapi.yaml` → `components.securitySchemes.sessionContext`:
 * `type: apiKey`, `in: header`, `name: X-Session`. Lower-cased because node
 * lower-cases every incoming header name.
 *
 * ⚠️ THE CONSTANT MOVED HERE FROM `server/data-plane/session.ts` AND THE MOVE
 * IS THE POINT RATHER THAN TIDYING. A production module that still NAMED the
 * header would be one edit away from reading it, and the grep that proves the
 * fence would go on returning nothing while the property rotted.
 */
export const SESSION_HEADER = 'x-session'

/**
 * The handle or token presented in `X-Session`, or `undefined`.
 *
 * ⚠️ AN ARRAY IS `undefined`, NOT `[0]`. Node collapses a repeated header into
 * an array, and a request carrying `X-Session` twice is the same ambiguity
 * `sessionCookieFrom()` refuses in a `Cookie` header, arriving one channel
 * over. The narrow type check answers both without a second rule.
 */
export function sessionHeaderFrom(request: FastifyRequest): string | undefined {
  const raw = request.headers[SESSION_HEADER]
  if (typeof raw !== 'string' || raw === '') return undefined
  return raw
}

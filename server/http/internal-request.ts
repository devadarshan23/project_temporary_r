/**
 * THE INTERNAL EDGE'S REQUEST DIGEST — ONE DEFINITION, READ BY BOTH PLANES.
 *
 * G4301–G4303, 5 Oct 2026, applying THE OWNER'S RULINGS:
 *
 *   *"Full restore: copy the tenant name to the data plane, put onboarding
 *    writes and roster reads behind signed control-plane endpoints, then retire
 *    both control-DB credentials from the data plane."*
 *
 *   *"SigV4 task role": the data-plane task role signs internal requests; the
 *    control plane verifies.*
 *
 * 🛑 WHAT IS SIGNED IS NOT THE HTTP REQUEST TO THE CONTROL PLANE, AND THAT IS
 * THE WHOLE MECHANISM (G4302). A self-hosted process cannot verify a SigV4
 * signature made by an IAM role: the secret that verifies it is AWS's. So the
 * data plane signs an `sts:GetCallerIdentity` request — Vault's and the EKS
 * authenticator's shape — whose SIGNED HEADERS carry two values the control
 * plane recomputes for itself rather than reads:
 *
 *   · `x-reconcile-audience`        — the control plane's OWN configured name,
 *                                     so a signature minted for one deployment
 *                                     is refused by another;
 *   · `x-reconcile-request-digest`  — `internalRequestDigest()` below, over the
 *                                     method, the path, the idempotency key, the
 *                                     platform authorisation id and the body's
 *                                     canonical hash.
 *
 * The control plane rebuilds the STS request from the caller's
 * `Authorization`, date and session token plus ITS OWN two values, and asks STS.
 * STS answers 200 with the caller's ARN only if the signature covers exactly
 * those values — so a captured signature cannot be replayed against a different
 * request, path, body or deployment. ⚠️ IT CAN BE REPLAYED AGAINST THE SAME
 * REQUEST INSIDE STS's FIFTEEN-MINUTE WINDOW, and that is why every internal
 * write is idempotent on its key (G4306) — a replay is the original answer.
 *
 * ⚠️ THE BODY IS HASHED AS RFC 8785 CANONICAL JSON, NOT AS BYTES. Fastify hands
 * a handler a PARSED body, and `onRequest` — where authentication runs, so an
 * unauthenticated caller gets 401 and never 400 — has no body at all. So the
 * caller states the canonical hash in `x-reconcile-content-sha256`, the
 * signature covers it, and the handler re-derives it from what was parsed
 * (`server/control-plane/internal.ts`). Two different byte strings with one
 * canonical form are ONE request here, which is the property wanted.
 */

import { createHash } from 'node:crypto'

import { canonicalise } from '../../model/canonical.ts'

/** Header names, lower case as Node presents them. One spelling, both planes. */
export const INTERNAL_HEADERS = {
  authorisationId: 'x-platform-authorisation-id',
  idempotencyKey: 'idempotency-key',
  contentSha256: 'x-reconcile-content-sha256',
  stsAuthorization: 'x-reconcile-sts-authorization',
  stsDate: 'x-reconcile-sts-date',
  stsSecurityToken: 'x-reconcile-sts-security-token',
  localToken: 'x-reconcile-internal-token',
} as const

/** The two STS-request headers whose values the CONTROL plane supplies. */
export const STS_AUDIENCE_HEADER = 'x-reconcile-audience'
export const STS_DIGEST_HEADER = 'x-reconcile-request-digest'

/** The `sts:GetCallerIdentity` form body — fixed, so it carries no request data. */
export const STS_BODY = 'Action=GetCallerIdentity&Version=2011-06-15'
export const STS_CONTENT_TYPE = 'application/x-www-form-urlencoded; charset=utf-8'

/**
 * The exact SignedHeaders an internal signature must carry, sorted as SigV4
 * requires. 🛑 THE CONTROL PLANE REQUIRES EQUALITY, NOT INCLUSION: a signature
 * whose SignedHeaders omitted the digest would be VALID at STS for whatever
 * digest the control plane appended, because STS ignores an unsigned header —
 * which is a bearer token for every internal operation. G4303.
 */
export const STS_SIGNED_HEADERS_WITH_TOKEN =
  'content-type;host;x-amz-date;x-amz-security-token;x-reconcile-audience;x-reconcile-request-digest'
export const STS_SIGNED_HEADERS_WITHOUT_TOKEN =
  'content-type;host;x-amz-date;x-reconcile-audience;x-reconcile-request-digest'

/** `azg_` + 32 hex — `mintAuthorizationGrantId()`'s shape. */
export const AUTHORISATION_ID = /^azg_[0-9a-f]{32}$/
/**
 * G4312 — or the literal `system`, for a system act with no person behind it
 * (invariant 10's `AUTHORIZATION_MAY_BE_ABSENT` names exactly that actor). The
 * CONTRACT decides which operations admit it: `getInternalRoster` alone, for
 * the tenant-name pull. Every internal write's header pattern refuses it.
 */
export const AUTHORISATION_OR_SYSTEM = /^(?:azg_[0-9a-f]{32}|system)$/
/** A caller-chosen key, narrow enough to log and to key a row on. */
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/**
 * The canonical hash of a request body. `undefined` (no body) hashes the empty
 * string; anything else is RFC 8785 canonical JSON, and a value that cannot be
 * canonicalised THROWS — the caller is this repository, never a stranger.
 */
export function bodySha256(body: unknown): string {
  if (body === undefined) return sha256Hex('')
  const c = canonicalise(body)
  if (!c.ok) throw new Error(`an internal request body could not be canonicalised: ${c.refusal.kind}`)
  return sha256Hex(c.json)
}

export interface InternalRequestParts {
  readonly method: string
  /** Path AND query, exactly as sent — `request.url` on the receiving side. */
  readonly path: string
  readonly idempotencyKey: string
  readonly authorisationId: string
  readonly contentSha256: string
}

/** The value both planes compute; the signature covers it. */
export function internalRequestDigest(p: InternalRequestParts): string {
  return sha256Hex(
    ['reconcile-internal-v1', p.method.toUpperCase(), p.path, p.idempotencyKey, p.authorisationId, p.contentSha256].join('\n'),
  )
}

/**
 * WHO MAY CALL THE CONTROL PLANE'S INTERNAL OPERATIONS — CHOSEN ONCE, AT BOOT.
 * G4302, G4305.
 *
 * The internal operations (`docs/contracts/control-plane.openapi.yaml`, tag
 * *X10 Console internal*) are reached by exactly one caller: the data plane,
 * acting for a console act it has ALREADY gated with `decide()` and recorded
 * under invariant 10 (G726 is untouched — console sessions, the gate and the
 * record stay on the data plane). This module establishes that the caller IS
 * that data plane and binds the answer to the one request it signed.
 *
 * THREE VERIFIERS AND THE CHOICE IS STRUCTURAL:
 *
 *   · flag `RECONCILE_LOCAL_TEST_AUTH` exactly `1` → the local token
 *     (`server/dev/internal-token.ts`), reached by a DYNAMIC import so a plane
 *     without the flag never loads it — G192's fence, which the owner named;
 *   · otherwise, a configured role ARN and region → STS
 *     (`./sts-verifier.ts`);
 *   · otherwise → NOBODY. An unconfigured deployed plane serves no internal
 *     operation; there is no permissive default to fall through to.
 *
 * A test may pass its own verifier to `startControlPlane()` — an argument, never
 * an environment variable, so no deployed process can be configured into one.
 */

import type { FastifyRequest } from 'fastify'

import {
  AUTHORISATION_OR_SYSTEM,
  IDEMPOTENCY_KEY,
  INTERNAL_HEADERS,
  internalRequestDigest,
} from '../http/internal-request.ts'
import { controlPlaneConfig } from './config.ts'
import { stsVerifier, type StsVerifierConfig } from './sts-verifier.ts'

export interface InternalPrincipal {
  readonly channel: 'internal'
  /** The verified caller — an assumed-role ARN, or `local-development`. */
  readonly caller: string
  readonly contentSha256: string
  readonly idempotencyKey: string
  readonly authorisationId: string
}

export type InternalVerifier = (request: FastifyRequest) => Promise<InternalPrincipal | null>

interface Presented {
  readonly contentSha256: string
  readonly idempotencyKey: string
  readonly authorisationId: string
  readonly digest: string
}

function header(request: FastifyRequest, name: string): string | null {
  const v = request.headers[name]
  return typeof v === 'string' && v !== '' ? v : null
}

/** The bound parts every verifier needs, or `null` if any is absent or malformed. */
function presentedOf(request: FastifyRequest): Presented | null {
  const contentSha256 = header(request, INTERNAL_HEADERS.contentSha256)
  const idempotencyKey = header(request, INTERNAL_HEADERS.idempotencyKey)
  const authorisationId = header(request, INTERNAL_HEADERS.authorisationId)
  if (contentSha256 === null || !/^[0-9a-f]{64}$/.test(contentSha256)) return null
  if (idempotencyKey === null || !IDEMPOTENCY_KEY.test(idempotencyKey)) return null
  if (authorisationId === null || !AUTHORISATION_OR_SYSTEM.test(authorisationId)) return null
  const digest = internalRequestDigest({
    method: request.method,
    path: request.url,
    idempotencyKey,
    authorisationId,
    contentSha256,
  })
  return { contentSha256, idempotencyKey, authorisationId, digest }
}

function principal(p: Presented, caller: string): InternalPrincipal {
  return {
    channel: 'internal',
    caller,
    contentSha256: p.contentSha256,
    idempotencyKey: p.idempotencyKey,
    authorisationId: p.authorisationId,
  }
}

/** The deployed verifier, over STS. Exported for tests that drive a fake STS. */
export function internalVerifierFromSts(config: StsVerifierConfig): InternalVerifier {
  const verify = stsVerifier(config)
  return async (request) => {
    const p = presentedOf(request)
    if (p === null) return null
    const authorization = header(request, INTERNAL_HEADERS.stsAuthorization)
    const amzDate = header(request, INTERNAL_HEADERS.stsDate)
    if (authorization === null || amzDate === null) return null
    const verdict = await verify(
      { authorization, amzDate, securityToken: header(request, INTERNAL_HEADERS.stsSecurityToken) },
      p.digest,
    )
    if (!verdict.ok) {
      console.error(`control-plane: internal caller refused — \`${verdict.refusal}\`.`)
      return null
    }
    return principal(p, verdict.callerArn)
  }
}

const NOBODY: InternalVerifier = async () => null

/**
 * The local-token verifier, over a checker the CALLER supplies. The plane
 * passes `server/dev/internal-token.ts`'s, reached by dynamic import below;
 * a test passes the same function, imported in the test. Nothing here imports
 * the dev module, so the fence (§5a of `tests/http/internal-edge.test.ts`)
 * holds.
 */
export function internalVerifierWithToken(check: (token: string, digest: string) => boolean): InternalVerifier {
  return async (request) => {
    const p = presentedOf(request)
    const token = header(request, INTERNAL_HEADERS.localToken)
    if (p === null || token === null) return null
    return check(token, p.digest) ? principal(p, 'local-development') : null
  }
}

export async function resolveInternalVerifier(): Promise<InternalVerifier> {
  const { internal } = controlPlaneConfig()
  if (process.env['RECONCILE_LOCAL_TEST_AUTH'] === '1') {
    const { verifyInternalToken } = await import('../dev/internal-token.ts')
    return internalVerifierWithToken((token, digest) => verifyInternalToken(token, digest, internal.audience))
  }
  if (internal.callerRoleArn === null || internal.stsRegion === null) return NOBODY
  return internalVerifierFromSts({
    region: internal.stsRegion,
    callerRoleArn: internal.callerRoleArn,
    audience: internal.audience,
  })
}

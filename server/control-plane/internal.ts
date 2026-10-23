/**
 * THE CONTROL PLANE'S FOUR INTERNAL OPERATIONS — `control-plane.openapi.yaml`
 * tag *X10 Console internal*. G4301, G4306, G4309.
 *
 * Every handler here begins with `internalCaller()`, which does the two things
 * `onRequest` could not:
 *
 *   1 · REFUSES A PRINCIPAL THAT IS NOT THE INTERNAL CHANNEL. The plane's
 *       authenticator also admits the local catalogue token (`x-session`);
 *       that credential proves a machine holds this machine's dev key and
 *       binds no request, so it reaches the catalogue and nothing here.
 *   2 · RE-DERIVES THE BODY'S CANONICAL HASH from what Fastify parsed and
 *       requires it to equal the hash the signature covered. Authentication
 *       ran before the body existed (`server/http/app.ts` §2); this is where
 *       the signature is bound to the body.
 *
 * Both answer 401 `session_invalid` — the contract's `ChannelUnauthenticated`,
 * for the reason `start.ts` gives: it is the closed enum's only member that
 * means "not authenticated".
 */

import type { FastifyReply, FastifyRequest } from 'fastify'

import { ONBOARDING_STEPS, type OnboardingStepKey } from '../../model/onboarding.ts'
import { principalOf, sendProblem, type Handler } from '../http/app.ts'
import { bodySha256, sha256Hex } from '../http/internal-request.ts'
import { CODES } from '../http/problem.ts'
import { applyTransition, readOnboardingFact, readRosterFacts } from './console-store.ts'
import type { CataloguePool } from './db.ts'
import type { InternalPrincipal } from './internal-auth.ts'
import type { ControlPrincipal } from './start.ts'

const NOT_INTERNAL =
  'This operation is reached only by the data plane over the signed internal channel, with a ' +
  'body whose canonical hash matches the signed one.'

function internalCaller(request: FastifyRequest, reply: FastifyReply): InternalPrincipal | null {
  const p = principalOf<ControlPrincipal>(request)
  if (p.channel !== 'internal' || bodySha256(request.body ?? undefined) !== p.contentSha256) {
    sendProblem(reply, {
      status: 401,
      code: CODES.sessionInvalid,
      title: 'Not the internal channel.',
      detail: NOT_INTERNAL,
    })
    return null
  }
  return p
}

function params(request: FastifyRequest): { tenantId: string; stepKey: string } {
  const p = request.params as Record<string, unknown> | undefined
  return {
    tenantId: typeof p?.['tenantId'] === 'string' ? p['tenantId'] : '',
    stepKey: typeof p?.['stepKey'] === 'string' ? p['stepKey'] : '',
  }
}

function stepOf(raw: string): OnboardingStepKey | null {
  const steps: readonly string[] = ONBOARDING_STEPS
  return steps.includes(raw) ? (raw as OnboardingStepKey) : null
}

export function getInternalRosterHandler(pool: CataloguePool): Handler {
  return async (request, reply) => {
    if (internalCaller(request, reply) === null) return reply
    return { tenants: await readRosterFacts(pool) }
  }
}

export function getInternalOnboardingHandler(pool: CataloguePool): Handler {
  return async (request, reply) => {
    if (internalCaller(request, reply) === null) return reply
    return await readOnboardingFact(pool, params(request).tenantId)
  }
}

function transitionHandler(
  pool: CataloguePool,
  operation: 'completeInternalOnboardingStep' | 'forceInternalOnboardingStep',
): Handler {
  return async (request, reply) => {
    const caller = internalCaller(request, reply)
    if (caller === null) return reply
    const { tenantId, stepKey } = params(request)
    const step = stepOf(stepKey)
    if (step === null) {
      return sendProblem(reply, {
        status: 404,
        code: CODES.resourceNotFound,
        title: 'No such onboarding step.',
        detail: 'That step key is not a member of the onboarding sequence.',
      })
    }
    const body = request.body as { reason?: unknown } | undefined
    const reason =
      operation === 'forceInternalOnboardingStep' ? (typeof body?.reason === 'string' ? body.reason : '') : null
    const receipted = await applyTransition(pool, {
      operation,
      tenantId,
      step,
      reason,
      idempotencyKey: caller.idempotencyKey,
      requestSha256: sha256Hex(`${request.method}\n${request.url}\n${caller.contentSha256}`),
      authorisationId: caller.authorisationId,
      caller: caller.caller,
    })
    if (receipted.kind === 'key_reused') {
      return sendProblem(reply, {
        status: 409,
        code: CODES.idempotencyConflict,
        title: 'That idempotency key was used for a different request.',
        detail: 'A key names one request; send a new key for a new one.',
      })
    }
    return receipted.answer
  }
}

export const completeInternalOnboardingStepHandler = (pool: CataloguePool): Handler =>
  transitionHandler(pool, 'completeInternalOnboardingStep')
export const forceInternalOnboardingStepHandler = (pool: CataloguePool): Handler =>
  transitionHandler(pool, 'forceInternalOnboardingStep')

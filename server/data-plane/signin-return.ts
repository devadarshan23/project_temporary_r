/**
 * `relayBrokerReturn`, MOUNTED — THE SHARED RETURN HOST (G2549, THE OWNER'S
 * RULING OF 2 Oct 2026; applied by G2761–G2766).
 *
 * The ruling, verbatim: *"One shared callback host: all sign-ins return to one
 * fixed callback which then 303s to the tenant host via resolveServingHost (a
 * registry lookup, grant bound to the host)."*
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE ORDER
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   1  HOST    the request must have arrived on THE configured return host,
 *              compared after `normaliseHost()`. Any other host — a tenant, a
 *              console, an unregistered name — is a 403 and reads nothing. A
 *              plane with no return host configured serves this on no host.
 *   2  STATE   digested; never stored, never echoed except into the one
 *              `Location` built below.
 *   3  READ    `withSignInPinScope()` — READ ONLY, keyed on the digest by the
 *              POLICY. The attempt's `begun_host`, `expires_at`,
 *              `consumed_at` (`readHandOff()`). An expired attempt is
 *              invisible (`0240`) and reads as absent.
 *   4  TARGET  `resolveHandOffTarget()` — consumed → refused; a begun host the
 *              registry does not serve → refused. **A LOOKUP AND NEVER A
 *              CONCATENATION OF ANYTHING THE REQUEST CARRIED** — D6 §4.4.
 *   5  RELAY   `303` to `https://<registered host>/signin/callback?code&state`,
 *              built with `URL` + `URLSearchParams` from the validated values.
 *
 * 🛑 WHAT IS NOT DONE HERE, DELIBERATELY: the code is NOT exchanged. The PKCE
 * verifier lives in the TAB on the begun host's origin (G2543) and this host's
 * origin cannot read it — which is the point: a code that reaches this host
 * alone cannot complete a sign-in. The exchange happens on the begun host,
 * where `completeFederatedSignIn` refuses a `state` presented on any other host
 * (`checkHandOffPresentation()`). **The cookie is therefore minted on the
 * TENANT host, `__Host-` and host-only, exactly as G2493 built it.**
 *
 * ⚠️ AND NO TENANT IS READ OR CARRIED. `SignInHandOff` and
 * `SignInHandOffTarget` carry `AssertNoTenantDeep`; the destination derives
 * the tenant from its own Host through the registry at D1 (invariant 1).
 *
 * ⚠️ INVARIANT 10 — NO AUTHORISATION RECORD, FOR `signin-begin.ts`'s REASON:
 * there is no principal. One allow-listed log line per outcome.
 */

import type { FastifyReply, FastifyRequest } from 'fastify'

import { normaliseHost, resolveHandOffTarget } from '../../model/serving-host.ts'
import type { TenantPool } from '../../db/tenant-scope.ts'
import { withSignInPinScope } from '../../db/signin-scope.ts'
import { sendProblem, type Handler } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import { SIGN_IN_CALLBACK_PATH } from './code-exchange.ts'
import { digestOfHandle } from './handle-digest.ts'
import type { HostRegistries } from './session.ts'
import { readHandOff } from './signin.ts'

/** What the browser is told when the broker returned an error. Never the broker's text. */
export const RELAYED_BROKER_ERROR = 'sign_in_not_completed'

const REFUSED_TITLE = 'The sign-in could not be returned.'
const REFUSED_DETAIL = 'Start the sign-in again from the beginning. The reason is recorded for the operator.'
const ANSWER_CODES = [CODES.signInAttemptHandleMismatch, CODES.signInAttemptReplayed]
const LONGEST_CODE = Math.max(...ANSWER_CODES.map((c) => c.length))

function refuse(request: FastifyRequest, reply: FastifyReply, code: string, refusal: string): FastifyReply {
  request.log.info({ event: 'federated_sign_in_return_refused', refusal })
  return sendProblem(reply, {
    status: 422,
    code,
    title: REFUSED_TITLE,
    detail: REFUSED_DETAIL + ' '.repeat(Math.max(0, 2 * (LONGEST_CODE - code.length))),
  })
}

export interface RelayBrokerReturnDeps {
  readonly pool: TenantPool
  readonly registries: HostRegistries
  /** The shared return host, or `null` — in which case nothing is served here. */
  readonly signInReturnHost: string | null
}

export function relayBrokerReturnHandler(deps: RelayBrokerReturnDeps): Handler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    /* 1 · HOST — the raw header, `session.ts`'s `presentedHost()` reason. */
    const host = typeof request.headers.host === 'string' ? request.headers.host : ''
    const returnHost = deps.signInReturnHost
    if (returnHost === null || normaliseHost(host) !== normaliseHost(returnHost)) {
      request.log.info({ event: 'federated_sign_in_return_refused', refusal: 'not_the_return_host' })
      return sendProblem(reply, {
        status: 403,
        code: CODES.tenantContextMissing,
        title: 'Nothing is served here.',
        detail: 'This host is not the sign-in return host.',
      })
    }

    const query = (request.query ?? {}) as Record<string, unknown>
    const state = typeof query['state'] === 'string' ? query['state'] : ''
    const code = typeof query['code'] === 'string' ? query['code'] : null
    const brokerError = typeof query['error'] === 'string' && query['error'] !== ''

    /* 2 · STATE. */
    const stateDigest = digestOfHandle(state)
    if (stateDigest === null) {
      return refuse(request, reply, CODES.signInAttemptHandleMismatch, 'state_empty')
    }

    /* 3 · READ. */
    const handOff = await withSignInPinScope(deps.pool, { stateDigest }, (tx) => readHandOff(tx))
    if (handOff === null) {
      return refuse(request, reply, CODES.signInAttemptHandleMismatch, 'sign_in_attempt_absent')
    }

    /* 4 · TARGET — a registry lookup. */
    const resolved = resolveHandOffTarget(deps.registries.tenants, deps.registries.consoles, handOff)
    if (!resolved.ok) {
      const wire =
        resolved.refusal === 'hand_off_already_consumed'
          ? CODES.signInAttemptReplayed
          : CODES.signInAttemptHandleMismatch
      return refuse(request, reply, wire, resolved.refusal)
    }

    /* 5 · RELAY. Built from the registry's host and the validated values. */
    const location = new URL(`https://${resolved.target.host}${SIGN_IN_CALLBACK_PATH}`)
    if (brokerError || code === null) {
      location.searchParams.set('error', RELAYED_BROKER_ERROR)
    } else {
      location.searchParams.set('code', code)
    }
    location.searchParams.set('state', state)

    request.log.info({
      event: 'federated_sign_in_returned',
      refusal: brokerError || code === null ? 'broker_error' : 'none',
    })
    return reply
      .code(303)
      .header('location', location.toString())
      .header('cache-control', 'no-store')
      .header('referrer-policy', 'no-referrer')
      .send()
  }
}

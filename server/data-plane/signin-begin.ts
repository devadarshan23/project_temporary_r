/**
 * `beginFederatedSignIn`, MOUNTED — THE OWNER'S RULING OF 1 Oct 2026 (G2541),
 * applied with G2542–G2549. It closes G2497: *"NOTHING BEGINS A SIGN-IN, SO
 * NOBODY CAN SIGN IN AGAINST A DEPLOYED PLANE YET."*
 *
 * The ruling, verbatim:
 *
 *   *"Build a public 'start sign-in' operation that inserts an attempt row
 *    (state, nonce, PKCE) and returns the broker redirect — same D6 posture:
 *    WAF rate rule, servedPublicly, INSERT-only grant on sign_in_attempt with
 *    a restrictive WITH CHECK, attempt TTL per D6-6."*
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE ORDER — and each step is a control `federated-signin.ts` already has,
 * applied one round trip earlier.
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   1  HOST    `resolveServedHost()` — a LOOKUP over the two registries
 *              (G179, G726). The callback URL the broker is told to return to
 *              is built from THIS host, so an unregistered host is refused
 *              before anything is read or written — D1's own 403.
 *   2  TERMS   the boot-time key document (R2). Its `audience` is the
 *              deployment's `client_id`; a plane with none cannot complete
 *              the sign-in it would be starting, so it does not start one.
 *   3  MINT    `state`, `nonce` and the PKCE verifier, `node:crypto`, 32
 *              random bytes each. Only DIGESTS reach the database.
 *   4  ROUTE + PIN, ONE TRANSACTION (`withSignInBeginScope()`): the domain is
 *              routed by `routeToConnection()` — the SAME decision
 *              `resolveHomeRealm` answers, read through the SAME two policies
 *              — the door the browser named must be the door the domain
 *              routes to, and the attempt is written pinning it. `0290`'s
 *              RESTRICTIVE fence refuses any row that is not fresh, not
 *              within D6-6's TTL, not the scope's digest, or not a door a
 *              VERIFIED claim on that domain reaches.
 *   5  ANSWER  the authorize URL — built from the PINNED ROW's
 *              `authorization_endpoint` and nothing the request carried —
 *              plus the two values the TAB must keep: `state` and the
 *              verifier.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 WHERE THE PKCE VERIFIER LIVES — IN THE TAB, AND NEVER ON THE ROW.
 *    (G2543: the ruling says the server MINTS it and leaves where it LIVES
 *    to the slice. This is that decision.)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The broker returns the browser to `/signin/callback?code=…&state=…`. **Both
 * travel in a URL** — browser history, a `Referer`, a proxy log, an extension.
 * RFC 7636's whole point is that the CODE alone must not complete a sign-in.
 * If the verifier sat on the attempt row, keyed by the `state` the same URL
 * carries, then anybody holding that URL would hold everything the callback
 * needs, and PKCE would be decoration. So the verifier is RETURNED ONCE, in
 * this response's body, to the same-origin page that asked; the SPA keeps it
 * in `sessionStorage` (per tab, per origin — `frontend/src/api/signin.ts`'s
 * `PENDING_SIGN_IN_KEY`) and S6 takes it back in its body exactly as it has
 * since G2491. **S6 is unchanged by this decision, which is the consistency the
 * slice was asked to keep.** Only the CHALLENGE leaves for the broker, inside
 * the authorize URL.
 *
 * ⚠️ AND THE NONCE IS NEVER RETURNED. It goes to the broker in the URL and is
 * stored here only as its keyed DIGEST (`challenge_digest`), which is what
 * G2487 compares the VERIFIED token's `nonce` against. The tab never needs it.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THE DOOR IS NAMED BY THE BROWSER AND ROUTED BY THE MODEL — AND THE
 *    REQUEST CARRIES THE DOMAIN AS WELL AS THE CONNECTION FOR THAT REASON.
 *    (G2542)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The ruling's *"input names the door (connectionId from resolveHomeRealm's
 * answer)"* is honoured: the browser names it. A connection id ALONE would
 * need a NEW policy on `tenant.identity_connection` admitting a row by a
 * caller-supplied id — every door addressable by an anonymous caller,
 * including a disabled one and one no verified claim routes to — and the
 * handler would then RESTATE routing's four refusals beside the model (§5.3).
 * Carrying the domain re-asks the model instead: the begin answers exactly
 * when `resolveHomeRealm` would answer the same id, through no policy that
 * did not already exist except `0290`'s write fence. The domain names no
 * person, so `resolveHomeRealm`'s no-user-existence property is untouched.
 *
 * ⚠️ A ROUTING REFUSAL HERE IS THE SAME FOUR CODES, ONE STATUS AND ONE LENGTH
 * AS `realm.ts` — the same oracle D6 already accepted for that operation, and
 * no wider: a caller who can ask this can ask that. A door the browser named
 * that the domain does NOT route to answers `sign_in_attempt_connection_mismatch`
 * — *"the door named is not the door pinned"* — which is that code's meaning,
 * and `errors.yaml`'s enum is closed (G2492 refused a session-shaped code with
 * no model arm).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ INVARIANT 10 — NO AUTHORISATION RECORD, FOR G2496's REASON
 * ══════════════════════════════════════════════════════════════════════════
 *
 * *"An act with no authorisation is unrecordable."* Beginning a sign-in is not
 * an act a principal takes — there is no principal, and the act exists to
 * create one. D6 §3.3's recommendation, taken for the callback, applies a
 * fortiori here. What D6-4 asked for instead is here: ONE allow-listed log
 * line per outcome, `{ event, refusal }`, both closed vocabularies. The row
 * itself is the durable record of an attempt begun.
 *
 * ⚠️ NO EGRESS. Nothing here leaves the process: the authorize URL is a
 * STRING handed to the browser, which is the party that travels. `code-exchange.ts`
 * and `jwks-source.ts` remain the only two files that reach the network
 * (`tests/http/console-roster-unreachable.test.ts` §1c, unchanged).
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto'

import type { FastifyReply, FastifyRequest } from 'fastify'

import {
  DOMAIN_ROUTING_REFUSALS,
  normaliseClaimedDomain,
  routeToConnection,
  type DomainRoutingRefusal,
} from '../../model/domain.ts'
import { normaliseHost, resolveServedHost } from '../../model/serving-host.ts'
import type { TenantPool } from '../../db/tenant-scope.ts'
import { withSignInBeginScope } from '../../db/signin-scope.ts'
import { sendProblem, type Handler } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import { pinnedEndpointUrl, signInRedirectUri } from './code-exchange.ts'
import { digestOfHandle } from './handle-digest.ts'
import { readConnectionsClaimingDomain } from './identity.ts'
import type { HostRegistries } from './session.ts'
import { SIGN_IN_ATTEMPT_TTL_MINUTES } from './signin.ts'
import type { IdentityConnectionId } from '../../model/domain.ts'
import type { VerificationTermsSource } from './verification-terms.ts'

/* ==================================================================== *
 * §1  THE OIDC PARAMETERS THIS PLANE ASKS FOR
 * ==================================================================== */

/**
 * `openid` is what makes it an ID token at all; `email` and `profile` are what
 * a door's claim map (R6) may project the person's two display attributes
 * from on a first sign-in. Nothing else is asked for — a scope widened here is
 * a claim the broker starts sending that no reader in this repository reads.
 */
export const SIGN_IN_SCOPES = 'openid email profile'

/** 32 random bytes, base64url — 43 characters, RFC 7636 §4.1's floor exactly. */
function mintSecret(): string {
  return randomBytes(32).toString('base64url')
}

/** RFC 7636 §4.2's `S256`: BASE64URL(SHA256(ASCII(code_verifier))). */
export function pkceChallengeOf(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url')
}

/* ==================================================================== *
 * §2  THE WIRE ANSWER FOR EVERY OUTCOME
 * ==================================================================== */

const ROUTING_CODE: Readonly<Record<DomainRoutingRefusal, string>> = {
  [DOMAIN_ROUTING_REFUSALS.domainNotClaimed]: CODES.domainNotClaimed,
  [DOMAIN_ROUTING_REFUSALS.domainNotVerified]: CODES.domainNotVerified,
  [DOMAIN_ROUTING_REFUSALS.connectionDisabled]: CODES.connectionDisabled,
  [DOMAIN_ROUTING_REFUSALS.domainClaimedByMoreThanOneConnection]:
    CODES.domainClaimedByMoreThanOneConnection,
}

/** Every 422 this operation can answer, for the one-length pad (`realm.ts`'s G1989). */
const REFUSAL_CODES = [...Object.values(ROUTING_CODE), CODES.signInAttemptConnectionMismatch]
const LONGEST_CODE = Math.max(...REFUSAL_CODES.map((c) => c.length))

const REFUSED_TITLE = 'A sign-in could not be started.'
const REFUSED_DETAIL =
  'Every refusal on this operation shares one status and is distinguished by its code alone. ' +
  'The request names a domain and a door and never a person.'

/** The begin's internal outcome — closed, so the log line carries a vocabulary and never a value. */
type BeginOutcome =
  | {
      readonly ok: true
      readonly endpoint: URL
      readonly brokerRef: string
      /** The routed door's own `audience` — its OIDC `client_id` (G2571, G2741). */
      readonly clientId: string
    }
  | { readonly ok: false; readonly status: 422; readonly code: string; readonly refusal: string }
  | { readonly ok: false; readonly status: 500 | 503; readonly code: string; readonly refusal: string }

function refuse(
  request: FastifyRequest,
  reply: FastifyReply,
  failed: Exclude<BeginOutcome, { readonly ok: true }>,
): FastifyReply {
  request.log.info({ event: 'federated_sign_in_begin_refused', refusal: failed.refusal })
  const pad = failed.status === 422 ? ' '.repeat(Math.max(0, 2 * (LONGEST_CODE - failed.code.length))) : ''
  return sendProblem(reply, {
    status: failed.status,
    code: failed.code,
    title: REFUSED_TITLE,
    detail: REFUSED_DETAIL + pad,
  })
}

/* ==================================================================== *
 * §3  THE PIN — the door's authorize endpoint, off the ROW
 * ==================================================================== */

/**
 * Read with the routed id as the one predicate, and it is not a `WHERE` that
 * answers a question a policy already answers: in the begin scope `0220`'s
 * policy admits EVERY door with a claim on the domain — that is how
 * `routeToConnection()` sees an unverified or ambiguous claim — and the model
 * has already chosen ONE of them. This selects the chosen row among the rows
 * the policy admitted; it cannot admit a row the policy did not.
 */
const AUTHORIZATION_ENDPOINT_READ =
  'SELECT authorization_endpoint FROM tenant.identity_connection WHERE id = $1'

/**
 * The write. `started_at` and `expires_at` are the DATABASE's clock — `now()`
 * is transaction-stable, so `0290`'s `started_at = now()` is the same instant
 * and `0240`'s fence reads the same clock that wrote the row. The TTL is the
 * named constant, and `0290`'s fence refuses anything longer regardless.
 */
const ATTEMPT_INSERT = `
  INSERT INTO tenant.sign_in_attempt
    (id, handle_digest, connection_id, challenge_digest, started_at, expires_at, begun_host)
  VALUES ($1, $2, $3, $4, now(), now() + make_interval(mins => $5), $6)
`

/* ==================================================================== *
 * §4  THE HANDLER
 * ==================================================================== */

interface BeginBody {
  readonly domain: string
  readonly connectionId: string
}

function bodyOf(raw: unknown): BeginBody | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { domain, connectionId } = raw as Record<string, unknown>
  if (typeof domain !== 'string' || typeof connectionId !== 'string') return null
  return { domain, connectionId }
}

export interface BeginFederatedSignInDeps {
  readonly pool: TenantPool
  readonly registries: HostRegistries
  /** R2's boot-time key document, or `null` on a plane started without one. */
  readonly terms: VerificationTermsSource | null
  /**
   * G2549 — the shared return host, or `null` (a local plane). See
   * `signInRedirectUri()`: with one, EVERY sign-in's broker returns there and
   * the relay 303s the browser back to the host recorded below.
   */
  readonly signInReturnHost?: string | null
}

export function beginFederatedSignInHandler(deps: BeginFederatedSignInDeps): Handler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const body = bodyOf(request.body)
    if (body === null) {
      /* Unreachable behind the schema; a 400 for `realm.ts`'s reason. */
      return sendProblem(reply, {
        status: 400,
        code: CODES.validationFailed,
        title: 'The request does not satisfy the contract.',
        detail: 'Rejected by the body schema declared in the OpenAPI document.',
      })
    }

    /* 1 · HOST — the raw header, `session.ts`'s `presentedHost()` reason. */
    const host = typeof request.headers.host === 'string' ? request.headers.host : ''
    const served = resolveServedHost(deps.registries.tenants, deps.registries.consoles, host)
    if (!served.ok) {
      request.log.info({ event: 'federated_sign_in_begin_refused', refusal: served.refusal })
      return sendProblem(reply, {
        status: 403,
        code: CODES.tenantContextMissing,
        title: 'Nothing is served here.',
        detail: 'This host is not a registered serving host, so no sign-in can begin at it.',
      })
    }

    /* 2 · TERMS. */
    const terms = deps.terms
    if (terms === null) {
      return refuse(request, reply, {
        ok: false,
        status: 503,
        code: CODES.upstreamUnavailable,
        refusal: 'identity_terms_absent',
      })
    }

    /* 3 · MINT. Only digests are stored. */
    const state = mintSecret()
    const nonce = mintSecret()
    const verifier = mintSecret()
    const stateDigest = digestOfHandle(state)
    const nonceDigest = digestOfHandle(nonce)
    if (stateDigest === null || nonceDigest === null) {
      /* Unreachable: 43 random characters are never empty. */
      return refuse(request, reply, {
        ok: false,
        status: 500,
        code: CODES.upstreamUnavailable,
        refusal: 'digest_unavailable',
      })
    }

    /* 4 · ROUTE + PIN, one transaction. */
    const domain = normaliseClaimedDomain(body.domain)
    /* G2549 / `0360`: the host the hand-off will be bound to. The REGISTRY
     * resolved it at step 1; the normalised spelling is what is written and
     * what `0360`'s fence compares against the scope's GUC. */
    const begunHost = normaliseHost(host)
    const outcome = await withSignInBeginScope(
      deps.pool,
      { claimedDomain: domain, stateDigest, begunHost },
      async (tx): Promise<BeginOutcome> => {
        const read = await readConnectionsClaimingDomain(tx)
        if (!read.ok) {
          return { ok: false, status: 500, code: CODES.upstreamUnavailable, refusal: read.refusal }
        }
        const routing = routeToConnection(read.connections, domain)
        if (!routing.ok) {
          const code = ROUTING_CODE[routing.refusal]
          return { ok: false, status: 422, code, refusal: routing.refusal }
        }
        if (routing.connectionId !== body.connectionId) {
          return {
            ok: false,
            status: 422,
            code: CODES.signInAttemptConnectionMismatch,
            refusal: 'door_named_is_not_the_door_routed',
          }
        }
        const door = read.connections.find((c) => c.id === routing.connectionId)
        if (door === undefined || door.federation === null) {
          /* A non-brokered door (`cognito_pool`, G305) has no pair, so no
           * callback could ever be scoped for it — `withSignInScope()` is keyed
           * on the pair. Refused before a row is written. */
          return {
            ok: false,
            status: 503,
            code: CODES.upstreamUnavailable,
            refusal: 'door_not_brokered',
          }
        }
        /**
         * 🛑 THE `client_id` IS THE ROUTED DOOR'S OWN AUDIENCE — G2741,
         * integrate/1oct-c. This read `terms.audience`, ONE value for the whole
         * plane, until #512 (G2571) made the audience a column per door; a
         * deployment-wide `client_id` would send every door's browser to the
         * broker under the first pool's app client, and the callback's
         * exchange (which presents the PINNED door's audience) would then
         * disagree with the client the code was issued to. A door absent from
         * the boot inventory, or loaded as a refusal, cannot begin: the same
         * door could never complete, so starting it would only mint a dead
         * attempt row.
         */
        const load = terms.connections.get(door.id as IdentityConnectionId)
        if (load === undefined || !load.ok) {
          return {
            ok: false,
            status: 503,
            code: CODES.upstreamUnavailable,
            refusal: load === undefined ? 'connection_not_loaded_at_boot' : load.refusal.kind,
          }
        }
        const rows = (await tx.query(AUTHORIZATION_ENDPOINT_READ, [door.id])).rows as Array<
          Record<string, unknown>
        >
        const declared = rows.length === 1 ? rows[0]?.['authorization_endpoint'] : null
        const endpoint = pinnedEndpointUrl(typeof declared === 'string' && declared !== '' ? declared : null)
        if (endpoint === null) {
          /* OUR configuration, `token_endpoint_not_declared`'s twin: a door
           * with no usable authorize endpoint has nowhere to send a browser,
           * and NULL is a refusal and never a configured default (`0290` §3). */
          return {
            ok: false,
            status: 503,
            code: CODES.upstreamUnavailable,
            refusal: 'authorization_endpoint_not_declared',
          }
        }
        await tx.query(ATTEMPT_INSERT, [
          `sia_${randomUUID()}`,
          stateDigest,
          door.id,
          nonceDigest,
          SIGN_IN_ATTEMPT_TTL_MINUTES,
          begunHost,
        ])
        return {
          ok: true,
          endpoint,
          brokerRef: door.federation.brokerRef,
          clientId: load.terms.audience,
        }
      },
    )
    if (!outcome.ok) return refuse(request, reply, outcome)

    /* 5 · ANSWER. Every parameter is the plane's; none is the request's. */
    const url = new URL(outcome.endpoint.toString())
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', outcome.clientId)
    url.searchParams.set('redirect_uri', signInRedirectUri(host, deps.signInReturnHost ?? null))
    url.searchParams.set('scope', SIGN_IN_SCOPES)
    url.searchParams.set('state', state)
    url.searchParams.set('nonce', nonce)
    url.searchParams.set('code_challenge', pkceChallengeOf(verifier))
    url.searchParams.set('code_challenge_method', 'S256')
    /* Cognito's name for "skip the chooser and go to THIS directory" — and
     * the broker pair's `broker_ref` IS that provider name (G304), read off
     * the routed row. A broker that does not know the parameter ignores it. */
    url.searchParams.set('identity_provider', outcome.brokerRef)

    request.log.info({ event: 'federated_sign_in_begun', refusal: 'none' })
    return reply
      .header('cache-control', 'no-store')
      .send({ authorizationUrl: url.toString(), state, codeVerifier: verifier })
  }
}

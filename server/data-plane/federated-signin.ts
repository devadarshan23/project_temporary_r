/**
 * `completeFederatedSignIn`, MOUNTED — W3/S6, 1 Oct 2026, G2490–G2499.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS IS THE PRODUCT'S FIRST PUBLIC, UNAUTHENTICATED, CREDENTIAL-MINTING
 *    ENDPOINT. R1 IS CLOSED — D6-1, THE OWNER'S: *"Both operations go public;
 *    mount the callback too."* — AND EVERY CONTROL BELOW IS ONE OF THE TEN D6
 *    DECISIONS OR G2443, APPLIED. READ THE ORDER BEFORE THE CODE.
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   1  HOST       `resolveServedHost()` — a LOOKUP over the two registries
 *                 (G179, G726), refused with D1's own 403 when nothing
 *                 claims the host. Asked FIRST, before a database or a
 *                 socket is touched, because it decides where the session
 *                 is bound and where the browser is sent.
 *   2  TERMS      the boot-time key document (R2). A plane started with
 *                 none answers 503: it can verify no token, and pretending
 *                 otherwise would be a sign-in that fails at step 7 after
 *                 spending an egress call.
 *   3  BOUNDS     `validateSessionBounds(platformSessionBounds())` (R7) —
 *                 BEFORE anything is read or sent, so an unusable platform
 *                 cannot burn an attempt or send a code anywhere.
 *   4  PIN        `withSignInPinScope()` — READ ONLY, and keyed on the
 *                 DIGEST of `state` and nothing else (G2235). Returns the
 *                 attempt, the door the redirect PINNED, the broker pair,
 *                 the issuer (D6-5), the token endpoint (G2443) and the
 *                 claim names (R6). **The transaction ENDS and the
 *                 connection is RELEASED before step 5.**
 *   5  EXCHANGE   `exchangeCode()` — G2443's one outbound POST, to the
 *                 pinned endpoint only, `TOKEN_ENDPOINT_TIMEOUT_MS`.
 *   6  VERIFY     `completeCodeExchange()` against
 *                 `verificationTermsAt(source, pinned.brokerIssuer, now)` —
 *                 the issuer is the ROW's (D6-5), the nonce is BOUND to the
 *                 pinned challenge (D6 §4.3).
 *   7  MINT       `mintFederatedSession()` — the SECOND transaction. The
 *                 attempt is consumed (D6-6's window is the database's), the
 *                 person found or provisioned (R5, D6-7), the session
 *                 written with a LITERAL `NULL` tenant (S2/S3). Its broker
 *                 pair is the PIN's, and its challenge digest is the
 *                 TOKEN's nonce — neither is a value the body carried.
 *   8  DELIVER    `mintedSessionCookie()` — its FIRST production caller —
 *                 and a `303` to a PATH.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THE REDIRECT CARRIES NO HOST AT ALL, AND THAT IS D6 §4.4 CLOSED BY
 *    CONSTRUCTION RATHER THAN BY A CHECK.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * D6: *"The redirect target must come from `resolveServingHost()` … and the
 * grant must be BOUND to the host it is issued for … The open redirect and the
 * grant-theft are the same bug."* G315 sent the browser from an auth host to a
 * tenant host and had to choose a host to send it to. **This plane does not.**
 * The mint happens on the host the callback ARRIVED at — a host the registry
 * has just resolved — the session's `issued_host` is that host, the cookie is
 * `__Host-` and therefore host-only, and the `Location` is an absolute PATH
 * (`/close`, `/`) with no scheme and no authority. **There is no string here a
 * caller could influence that names a place**: the `state` is digested and
 * looked up, the tenant a `state` might once have carried as G315's routing
 * fact is read by nothing, and the path is a total `Record` over the surface
 * KIND. A `Location` built from the registry's host would be correct today and
 * would be the concatenation D6 warns about the day somebody parameterised it.
 *
 * ⚠️ `303 See Other` AND NOT `302 Found`, DELIBERATELY. The request is a
 * `POST`; RFC 9110 §15.4.3 lets a user agent rewrite a `302`'s method and
 * §15.4.4 REQUIRES the `303` to be followed with `GET`. Every browser rewrites
 * both today, so the difference is what the status SAYS rather than what a
 * browser does — and this response says *"the act is done; fetch the landing
 * page"*, which is `303`'s meaning and not `302`'s.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THE REQUEST CARRIES CLEARTEXT, AND THE MODEL'S `FederatedCallback`
 *    STILL CARRIES DIGESTS — THE DIGESTING HAPPENS HERE, ONCE.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `digestOfHandle()` is a KEYED HMAC with a server key, so a browser cannot
 * produce the digest the contract's old body demanded; that body was
 * unsatisfiable by any client that did not hold the plane's key. The wire now
 * takes `state`, `code`, `codeVerifier` and `connectionId` (G2491, argued on
 * `session.openapi.yaml`); `state` is digested here and never stored, `code`
 * and `codeVerifier` go to the pinned token endpoint and nowhere else, and
 * `connectionId` is COMPARED (the model's arm) and never carried.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ INVARIANT 10 — A SIGN-IN RECORDS NO AUTHORISATION, AND THAT IS ARGUED
 *    RATHER THAN OMITTED (G2496).
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Copy it, never paraphrase it: *"An act with no authorisation is
 * unrecordable."* D6 §3.3: *"invariant 10 is about acts a principal takes, and
 * a sign-in is the act that creates the principal. Nothing precedes it to
 * authorise it, and a record minted against a principal that does not yet
 * exist would be the appearance of the control rather than the control."*
 * `AuthorizationGrant extends TenantScoped` and the session is tenant-less;
 * `0091`'s second home is keyed on the acting SESSION, which is the thing this
 * act creates. **So no grant is minted, and that is the recommendation D6 made
 * and the D6-1 ruling did not overturn.** What D6-4 asked for instead is here:
 * ONE allow-listed log line per outcome — `{ event, refusal }`, both closed
 * vocabularies, no value a caller chose — so a spike in
 * `sign_in_attempt_replayed` is countable as the attack it is. The session row
 * itself is the durable record of a successful one.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ NO ORACLE BEYOND WHAT D6 ACCEPTED
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Every refusal of the exchange and of the token collapses to ONE wire code,
 * `sign_in_attempt_challenge_mismatch` (G2492, argued at `SIGN_IN_REFUSED`),
 * and the operator's log carries the arm. A caller holding a stolen `state`
 * learns that their code did not work and not which of fourteen checks
 * refused it. `user_disabled` is answered only after a token for that very
 * person has verified, so the only caller who can see it is that person.
 * The attempt's own four arms ARE on the wire by exact name, as the contract
 * has declared since #230 — they are facts about a row the caller's own
 * browser was handed.
 */

import { randomBytes, randomUUID } from 'node:crypto'

import type { FastifyReply, FastifyRequest } from 'fastify'

import type { SessionHandleDigest } from '../../model/domain.ts'
import type { IdentityConnectionId, SessionId, UserId } from '../../model/kernel.ts'
import {
  checkHandOffPresentation,
  resolveServedHost,
  type ServedSurfaceKind,
} from '../../model/serving-host.ts'
import { validateSessionBounds } from '../../model/session.ts'
import type { TenantPool } from '../../db/tenant-scope.ts'
import { withSignInPinScope } from '../../db/signin-scope.ts'
import { sendProblem, type Handler } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import {
  codeExchangeRequest,
  completeCodeExchange,
  exchangeCode,
  signInRedirectUri,
  tokenEndpointOf,
  type CodeExchangeRefusal,
  type TokenEndpointTransport,
} from './code-exchange.ts'
import { digestOfHandle } from './handle-digest.ts'
import type { HostRegistries } from './session.ts'
import { platformSessionBounds } from './session-bounds.ts'
import { mintedSessionCookie } from './session-cookie.ts'
import { mintFederatedSession, type MintFederatedSessionOutcome } from './session-mint-store.ts'
import { readPinnedSignIn, SIGN_IN_REFUSALS, type SignInAssembly } from './signin.ts'
import { verificationTermsAt, type VerificationTermsSource } from './verification-terms.ts'

/* ==================================================================== *
 * §1  WHERE A SIGNED-IN BROWSER LANDS
 * ==================================================================== */

/**
 * The landing PATH per surface kind — a total `Record`, so a third kind is a
 * `TS2741` here rather than a browser sent nowhere.
 *
 * `/close` is the register, the tenant surface's first screen
 * (`frontend/src/routes/table.ts`). A console has no drawn screen in this tree,
 * so it lands on `/`, which every surface serves.
 */
export const SIGN_IN_LANDING: Readonly<Record<ServedSurfaceKind, string>> = {
  tenant: '/close',
  console: '/',
}

/* ==================================================================== *
 * §2  THE WIRE ANSWER FOR EVERY OUTCOME
 * ==================================================================== */

const REFUSED_TITLE = 'The sign-in was not completed.'
const REFUSED_DETAIL =
  'Start the sign-in again from the beginning. The reason is recorded for the operator and is ' +
  'deliberately not stated here.'

/** One wire answer: a status and a closed code. The log carries `refusal`. */
interface Answer {
  readonly status: number
  readonly code: string
  /** The arm, for the operator's log line — a closed-vocabulary string, never a value. */
  readonly refusal: string
}

/**
 * A code, an exchange answer or a token that did not yield a VERIFIED,
 * BOUND identity for this attempt — G2492. `sign_in_attempt_challenge_mismatch`,
 * because since S6 the model's challenge IS the verified token's `nonce`
 * (G2487): with no such token there is no challenge that matches the pinned
 * one. ONE code for every such arm, so a caller holding a stolen `state`
 * learns that their code failed and not which of the checks refused it.
 */
const SIGN_IN_REFUSED = (refusal: string): Answer => ({
  status: 422,
  code: CODES.signInAttemptChallengeMismatch,
  refusal,
})

const UPSTREAM = (status: number, refusal: string): Answer => ({
  status,
  code: CODES.upstreamUnavailable,
  refusal,
})

/**
 * The exchange's nine arms, onto the wire.
 *
 * ⚠️ A BROKER `5xx` AND AN UNREACHABLE BROKER ARE 502 — *"nothing the caller
 * did"*; every other arm is `SIGN_IN_REFUSED`, because each is a fact about a
 * code or a token the caller presented and none is worth distinguishing to
 * them. `token_endpoint_not_declared` is OUR configuration and is a 503.
 */
function exchangeAnswer(refusal: CodeExchangeRefusal): Answer {
  switch (refusal.kind) {
    case 'token_endpoint_not_declared':
      return UPSTREAM(503, refusal.kind)
    case 'token_endpoint_unreachable':
      return UPSTREAM(502, refusal.kind)
    case 'token_endpoint_status_not_ok':
      return refusal.status >= 500 ? UPSTREAM(502, refusal.kind) : SIGN_IN_REFUSED(refusal.kind)
    case 'token_endpoint_body_unreadable':
    case 'token_endpoint_reported_error':
    case 'token_endpoint_returned_no_id_token':
    case 'token_carries_no_nonce':
    case 'token_nonce_does_not_match_attempt':
    case 'token_broker_provider_mismatch':
      return SIGN_IN_REFUSED(refusal.kind)
    case 'identity_token_refused':
      return SIGN_IN_REFUSED(refusal.refusal.kind)
    default: {
      const unhandled: never = refusal
      return UPSTREAM(500, String(unhandled))
    }
  }
}

/**
 * The pin's and the mint's assembly refusals, onto the wire.
 *
 * 🛑 `sign_in_attempt_absent` ANSWERS `sign_in_attempt_handle_mismatch` — *"The
 * callback was presented against a row it does not address"* — and the
 * collapse is the point: an EXPIRED attempt (D6-6), a SWEPT one and one that
 * was never minted are one answer, so the wire is no oracle over which
 * `state`s once existed. `sign_in_door_disagrees` and
 * `sign_in_door_not_brokered` answer `sign_in_attempt_connection_mismatch`:
 * both mean the door this callback reached is not the one the redirect pinned
 * (or cannot be), which is that code's meaning.
 */
function assemblyAnswer(failed: Exclude<SignInAssembly, { readonly ok: true }>): Answer {
  switch (failed.kind) {
    case 'attempt':
      return { status: 422, code: failed.refusal, refusal: failed.refusal }
    case 'substrate':
      return UPSTREAM(500, failed.refusal)
    case 'signin': {
      const refusal = failed.refusal
      switch (refusal) {
        case SIGN_IN_REFUSALS.signInAttemptAbsent:
          return { status: 422, code: CODES.signInAttemptHandleMismatch, refusal }
        case SIGN_IN_REFUSALS.signInDoorDisagrees:
        case SIGN_IN_REFUSALS.signInDoorNotBrokered:
          return {
            status: 422,
            code: CODES.signInAttemptConnectionMismatch,
            refusal,
          }
        case SIGN_IN_REFUSALS.signInDoorDisabled:
          return { status: 422, code: CODES.connectionDisabled, refusal }
        case SIGN_IN_REFUSALS.signInAttemptNotConsumed:
          return UPSTREAM(500, refusal)
        default: {
          const unhandled: never = refusal
          return UPSTREAM(500, String(unhandled))
        }
      }
    }
    default: {
      const unhandled: never = failed
      return UPSTREAM(500, String(unhandled))
    }
  }
}

/** The mint's outcome, onto the wire. */
function mintAnswer(failed: Exclude<MintFederatedSessionOutcome, { readonly ok: true }>): Answer {
  switch (failed.kind) {
    case 'assembly':
      return assemblyAnswer(failed.assembly as Exclude<SignInAssembly, { readonly ok: true }>)
    case 'projection':
      /* The door's claim map, or the directory's token, does not supply the
       * person's two display attributes — configuration on one side or the
       * other, and nothing the caller did. */
      return UPSTREAM(502, failed.refusal)
    case 'mint':
      if (failed.refusal === 'user_disabled') {
        return { status: 403, code: CODES.userDisabled, refusal: failed.refusal }
      }
      if (failed.refusal === 'session_bounds_unusable') {
        const first = failed.boundRefusals?.[0]
        return {
          status: 503,
          code: first === undefined ? CODES.upstreamUnavailable : first.reason,
          refusal: failed.refusal,
        }
      }
      return UPSTREAM(500, failed.refusal)
    case 'store':
      return UPSTREAM(500, failed.refusal)
    default: {
      const unhandled: never = failed
      return UPSTREAM(500, String(unhandled))
    }
  }
}

/** The longest code this operation can answer, for the length pad. */
const ANSWER_CODES = [
  CODES.signInAttemptHandleMismatch,
  CODES.signInAttemptConnectionMismatch,
  CODES.signInAttemptChallengeMismatch,
  CODES.signInAttemptReplayed,
  CODES.connectionDisabled,
]
const LONGEST_CODE = Math.max(...ANSWER_CODES.map((c) => c.length))

/**
 * Send a refusal and log its arm.
 *
 * ⚠️ THE DETAIL IS PADDED SO EVERY 422 IS ONE LENGTH, `realm.ts`'s G1989
 * repair applied here: the code is spelled twice in a problem body, so two
 * codes of different lengths would be told apart by `Content-Length` alone,
 * which is the oracle the one-code collapse exists to close.
 */
function refuse(request: FastifyRequest, reply: FastifyReply, answer: Answer): FastifyReply {
  request.log.info({ event: 'federated_sign_in_refused', refusal: answer.refusal })
  return sendProblem(reply, {
    status: answer.status,
    code: answer.code,
    title: REFUSED_TITLE,
    detail: REFUSED_DETAIL + ' '.repeat(Math.max(0, 2 * (LONGEST_CODE - answer.code.length))),
  })
}

/* ==================================================================== *
 * §3  THE HANDLER
 * ==================================================================== */

/** What the body carries, after the schema has admitted it. */
interface CallbackBody {
  readonly state: string
  readonly code: string
  readonly codeVerifier: string
  readonly connectionId: string
}

function bodyOf(raw: unknown): CallbackBody | null {
  if (typeof raw !== 'object' || raw === null) return null
  const b = raw as Record<string, unknown>
  const { state, code, codeVerifier, connectionId } = b
  if (
    typeof state !== 'string' ||
    typeof code !== 'string' ||
    typeof codeVerifier !== 'string' ||
    typeof connectionId !== 'string'
  ) {
    return null
  }
  return { state, code, codeVerifier, connectionId }
}

export interface FederatedSignInDeps {
  readonly pool: TenantPool
  readonly registries: HostRegistries
  /** R2's boot-time key document, or `null` on a plane started without one. */
  readonly terms: VerificationTermsSource | null
  /** G2443's transport. Production passes `tokenEndpointTransport()`. */
  readonly transport: TokenEndpointTransport
  /**
   * G2549 — the shared return host every sign-in's broker returns to, or
   * `null` on a plane with none configured. It decides the `redirect_uri`
   * sent to the token endpoint, which must be byte-for-byte the one
   * `beginFederatedSignIn` sent to the authorize endpoint — so both build it
   * through `signInRedirectUri()`.
   */
  readonly signInReturnHost?: string | null
}

export function completeFederatedSignInHandler(deps: FederatedSignInDeps): Handler {
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

    /* 1 · HOST. The raw header, `session.ts`'s `presentedHost()` reason:
     * `request.hostname` consults `X-Forwarded-Host` under `trustProxy`. */
    const host = typeof request.headers.host === 'string' ? request.headers.host : ''
    const served = resolveServedHost(deps.registries.tenants, deps.registries.consoles, host)
    if (!served.ok) {
      request.log.info({ event: 'federated_sign_in_refused', refusal: served.refusal })
      return sendProblem(reply, {
        status: 403,
        code: CODES.tenantContextMissing,
        title: 'Nothing is served here.',
        detail: 'This host is not a registered serving host, so nothing can be signed in to it.',
      })
    }

    /* 2 · TERMS. */
    if (deps.terms === null) {
      return refuse(request, reply, UPSTREAM(503, 'identity_terms_absent'))
    }

    /* 3 · BOUNDS — before anything is read or sent. */
    const boundsInput = platformSessionBounds()
    const bounds = validateSessionBounds(boundsInput)
    if (!bounds.ok) {
      const first = bounds.refusals[0]
      return refuse(request, reply, {
        status: 503,
        code: first.reason,
        refusal: 'session_bounds_unusable',
      })
    }

    const stateDigest = digestOfHandle(body.state) as SessionHandleDigest | null
    if (stateDigest === null) {
      return refuse(request, reply, SIGN_IN_REFUSED('state_empty'))
    }
    const connectionId = body.connectionId as IdentityConnectionId

    /* 4 · PIN — READ ONLY, and ENDED before step 5. */
    const pinned = await withSignInPinScope(deps.pool, { stateDigest }, (tx) =>
      readPinnedSignIn(tx, { handleDigest: stateDigest, connectionId }),
    )
    if (!pinned.ok) return refuse(request, reply, assemblyAnswer(pinned))

    /* 4b · THE HAND-OFF IS BOUND TO ITS HOST — G2549. The attempt was begun on
     * a host the registry resolved (`0360`), and the relay sent the browser
     * back there. A `state` presented on ANY other host is refused here,
     * before a code is spent, and a NULL `begun_host` (an attempt begun before
     * `0360`) is refused the same way. The wire collapses it onto
     * `sign_in_attempt_handle_mismatch` — *"presented against a row it does
     * not address"* — and the log carries the arm. */
    const presented = checkHandOffPresentation({ begunHost: pinned.begunHost ?? '' }, host)
    if (!presented.ok) {
      return refuse(request, reply, {
        status: 422,
        code: CODES.signInAttemptHandleMismatch,
        refusal: presented.refusal,
      })
    }

    const endpoint = tokenEndpointOf(pinned.tokenEndpoint)
    if (!endpoint.ok) return refuse(request, reply, exchangeAnswer(endpoint.refusal))

    /* 4a · THE PINNED DOOR'S TERMS — G2571/G2575. Keys and audience are
     * selected by the id of the row `0280` admitted, never by anything the
     * token or the body carries, and resolved BEFORE the exchange so a door
     * that cannot verify sends nothing anywhere. ⚠️ The audience is also the
     * `client_id` below: it read `deps.terms.audience`, one value per
     * deployment, until 1 Oct 2026 (G2498). */
    const resolved = verificationTermsAt(
      deps.terms,
      { connectionId: pinned.connection.id, issuer: pinned.brokerIssuer },
      new Date(),
    )
    if (!resolved.ok) return refuse(request, reply, UPSTREAM(503, resolved.refusal.kind))

    /* 5 · EXCHANGE — no transaction open, no connection checked out. */
    const sent = await exchangeCode(
      codeExchangeRequest({
        tokenEndpoint: endpoint.url,
        clientId: resolved.terms.audience,
        redirectUri: signInRedirectUri(host, deps.signInReturnHost ?? null),
        code: body.code,
        codeVerifier: body.codeVerifier,
      }),
      deps.transport,
    )
    if (!sent.ok) return refuse(request, reply, exchangeAnswer(sent.refusal))

    /* 6 · VERIFY AND BIND. */
    const exchanged = completeCodeExchange(
      sent.response,
      /* The instant is re-taken AFTER the exchange: a token minted during it
       * is judged at the moment it is opened, not at the moment it was asked for. */
      { ...resolved.terms, now: new Date() },
      pinned.attempt.challengeDigest,
      pinned.claimNames,
      /* G2764 — the directory the broker used must be the one the row pinned. */
      pinned.brokerRef,
    )
    if (!exchanged.ok) return refuse(request, reply, exchangeAnswer(exchanged.refusal))

    /* 7 · MINT. The pair is the PIN's; the challenge is the TOKEN's. */
    const handle = randomBytes(32).toString('base64url')
    const handleDigest = digestOfHandle(handle) as SessionHandleDigest
    const minted = await mintFederatedSession(deps.pool, {
      brokerIssuer: pinned.brokerIssuer,
      brokerRef: pinned.brokerRef,
      stateDigest,
      externalSubject: exchanged.identity.subject,
      callback: {
        handleDigest: stateDigest,
        connectionId,
        challengeDigest: exchanged.identity.challengeDigest,
      },
      claims: exchanged.identity.projected,
      emailVerified: exchanged.identity.emailVerified,
      newUserId: `usr_${randomUUID()}` as UserId,
      newSessionId: `ses_${randomUUID()}` as SessionId,
      newHandleDigest: handleDigest,
      issuedHost: host,
      bounds: boundsInput,
    })
    if (!minted.ok) return refuse(request, reply, mintAnswer(minted))

    /* 8 · DELIVER. The redemption's outcome is a CLOSED word or `none` —
     * never an address, a firm or a role (G261 §12.1's allow-list). */
    request.log.info({ event: 'federated_sign_in_minted', refusal: 'none' })
    if (minted.redemption.kind !== 'none') {
      request.log.info({
        event: 'partner_invitation_redemption',
        refusal: minted.redemption.kind === 'refused' ? minted.redemption.refusal : 'none',
      })
    }
    return reply
      .code(303)
      .header('set-cookie', mintedSessionCookie(handle))
      .header('location', SIGN_IN_LANDING[served.surface.kind])
      .header('cache-control', 'no-store')
      .send()
  }
}

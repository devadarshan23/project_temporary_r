/**
 * WHERE THE DATA PLANE'S SESSION COMES FROM — AND THE ONE PLACE THE LOCAL-ONLY
 * FLAG IS READ.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G386, 19 Sep 2026 — **THE PRODUCTION CHANNEL IS A COOKIE, AND `X-Session`
 *    IS NOT MERELY DISCOURAGED HERE: IT IS UNREADABLE.** THE PARAGRAPHS BELOW
 *    ARE CORRECTED RATHER THAN DELETED WHERE THEY SAY OTHERWISE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ THIS FILE DECLARED `export const SESSION_HEADER = 'x-session'` AND READ IT
 * ON EVERY REQUEST, INCLUDING IN THE PRODUCTION READER. **Both are gone.** The
 * constant moved to `server/dev/session-header.ts` and the read went with it,
 * because a production module that still NAMED the header would be one edit
 * away from reading it — and the grep that proves the fence would go on
 * returning nothing while the property rotted.
 *
 * What a plane started WITHOUT `RECONCILE_LOCAL_TEST_AUTH=1` now holds is
 * `databaseReader(pool, sessionCookieFrom)`: a reader that reads
 * `__Host-reconcile_session` and knows no other channel. There is no `if`, no
 * fallback and no second branch, which is the difference G192 draws between a
 * fence and a check and which G386 restates for this half — *"A boolean check
 * inside a request handler does not satisfy this ruling."*
 *
 * `server/data-plane/session-cookie.ts` is the whole of the channel: the name,
 * the three attributes, the parse and the withdrawal. Nothing else may name it.
 *
 * ⚠️ THIS FILE HAD EXACTLY TWO READERS UNTIL 19 Sep 2026 — `denyAll` AND THE
 * DEV TOKEN — AND THE SENTENCE THAT STOOD AT THE TOP OF ITS `denyAll` IS THE
 * ONE TO CORRECT RATHER THAN DELETE: *"The production reader. It cannot return
 * a session; it has nothing to return one from."* **It has something to return
 * one from now.** `db/migrations/0005_session_and_membership.sql` shipped
 * `tenant.session` and `tenant.membership`, and this file reads them. The dev
 * token is unchanged, is still fenced structurally, and is still the only way
 * to obtain a tenant WITHOUT a row.
 *
 * ┌─ THE FLAG, EXACTLY ────────────────────────────────────────────────────────┐
 * │  `RECONCILE_LOCAL_TEST_AUTH` must be the string `1`. Not "truthy".          │
 * │  `false`, `0`, `no`, `off`, `` and an absent variable all REFUSE, and so    │
 * │  does anything else — the comparison is equality against one literal, so    │
 * │  there is no value a future reader has to reason about.                     │
 * │                                                                            │
 * │  "Absent, malformed or unparseable configuration must refuse — never fall   │
 * │  through to permissive." An equality test against `'1'` is the whole of     │
 * │  that rule: there is nothing to parse, so there is nothing to mis-parse.    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE FLAG IS READ ONCE, AT BOOT, AND THE RESULT IS A DIFFERENT FUNCTION.
 *
 * `resolveSessionReader()` returns either the DATABASE reader alone, or the
 * database reader with a dev-token arm behind it, built around the dynamically
 * imported verifier. A plane started without the flag holds the first for its
 * whole life; setting the variable afterwards changes nothing, because there
 * is no branch left to take and the accepting module was never loaded into the
 * process.
 *
 * That is the difference between a fence and a check. A check is a line
 * somebody can move; this is an absent module. Reproduce the structural half:
 * `grep -rn "from '\.\./dev/" server/data-plane/` returns nothing.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE ORDER IS DATABASE FIRST, DEV TOKEN SECOND, AND IT IS NOT ARBITRARY.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A dev token is an HMAC over a JSON payload; a session handle is an opaque
 * value whose HMAC is a row's primary lookup key. The two vocabularies do not
 * overlap, so the order cannot change which callers are accepted — but it
 * decides which one WINS if a value ever satisfied both, and the row is the
 * one with a revocation column, an expiry, a host binding and a membership
 * behind it. The token has a signature and a clock. **Where both could answer,
 * the answer with more controls on it is the one to take.**
 *
 * ⚠️ AND THE COST IS ONE DATABASE ROUND TRIP ON EVERY REQUEST THAT PRESENTS A
 * DEV TOKEN, WHICH IS STATED RATHER THAN HIDDEN. The digest of a dev token
 * matches no row, so the first arm misses and the second answers. That is a
 * `SELECT` against a unique index inside a transaction, on a local stack, on
 * the path that exists to make local work possible — and the alternative is to
 * let a build-time convenience decide the order of a security control.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ THE LARGEST GAP IN THIS FILE IS CLOSED — G299, 19 Sep 2026 — AND THE
 *    PARAGRAPH THAT STOOD HERE IS QUOTED RATHER THAN DELETED, BECAUSE IT IS
 *    THE SENTENCE A READER WOULD HAVE TRUSTED AND IT IS QUOTED IN FOUR OTHER
 *    FILES.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     "🛑 WHAT THE DATABASE READER DOES NOT DO … `resolveSubject()` IS NOT
 *      CALLED HERE AND IT CANNOT BE. It takes a `User` and an
 *      `IdentityConnection`, and there is no `user` table and no
 *      `identity_connection` table in this database … So this reader enforces
 *      TWO of those seven arms — `session_revoked` and `session_expired` —
 *      … in the `WHERE` clause of the one read … **FOUR ARMS ARE UNENFORCED: a
 *      DISABLED PERSON and a DISABLED DIRECTORY both reach this plane today**
 *      … THE FOLLOW-ON IS NOT OPTIONAL AND IT IS A DELETION, NOT AN ADDITION:
 *      the commit that lands `user` and `identity_connection` DELETES the
 *      two-term predicate below and calls `resolveSubject()` with the three
 *      rows."
 *
 * **THIS IS THAT COMMIT, AND THE DELETION IS THE POINT OF IT.** The predicate
 * that stood in `LIVE_SESSION_READ` —
 *
 *     WHERE revoked_at IS NULL
 *       AND expires_at > now()
 *
 * — **is gone**, and nothing has replaced it. `db/migrations/0009_identity
 * _substrate.sql` landed `tenant."user"` and `tenant.identity_connection`,
 * `server/data-plane/identity.ts` reads them, and all SEVEN arms are now
 * answered where they were declared to be answered: `connection_mismatch`,
 * `user_mismatch`, `session_revoked`, `session_expired`, `user_disabled`,
 * `connection_disabled`, `tenant_not_selected`, in that order, by
 * `resolveSubject()`. *"THE ORDER IS THE SLICE, and one assertion in the suite
 * exists for it alone."*
 *
 * 🛑 TWO COLUMNS CHANGED MEANING IN THAT DELETION AND BOTH ARE LOAD-BEARING.
 *
 *   `revoked_at`  WAS NOT SELECTED, and `rowToSession()` hard-coded
 *                 `revokedAt: null` — which the `WHERE` made true. With the
 *                 `WHERE` gone that constant would have made
 *                 `SESSION_REFUSALS.sessionRevoked` **DEAD CODE**: every
 *                 revoked session would arrive at the model looking live. The
 *                 column is read now.
 *   `expires_at`  was already selected and is now the ONLY thing deciding
 *                 expiry, through `resolveSubject()`'s lexical comparison
 *                 against a caller-supplied `now` rather than through the
 *                 database's `now()`.
 *
 * ⚠️ AND ONE `WHERE` WENT THE OTHER WAY, ON A **WRITE**, WHICH IS NOT THE SAME
 * KIND OF THING AND IS NAMED SO IT IS NOT READ AS A RETREAT. `REVOKE_SESSION`
 * gained `WHERE revoked_at IS NULL`. Before this commit a revoked session never
 * reached `checkHostBinding()` at all — the read had already filtered it — so a
 * second host mismatch could not overwrite the first revocation's timestamp.
 * Now it can reach it, and `SET revoked_at = now()` on an already-revoked row
 * would MOVE the time an act was taken. **The read's narrowing decided who
 * reaches this plane; the write's narrowing stops a second revocation erasing
 * the first one's answer to "when".**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 `tenant_not_selected` IS AUTHENTICATED-AND-UNSCOPED HERE, NOT A REFUSAL,
 *    AND THIS IS THE ONE PLACE THIS FILE DEPARTS FROM `resolveSubject()`'s
 *    VERDICT. READ THE ARGUMENT BEFORE CHANGING IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * D1 — `POST /context/resolve` — is the operation that BINDS a tenant to a
 * session, so it is reached BY a session that has none. If this reader refused
 * every `tenant_not_selected`, D1 would be unreachable and nothing could ever
 * select a tenant; if it invented one, that is invariant 1 inverted.
 *
 * What makes the third answer safe is the ORDER, and the order is
 * `resolveSubject()`'s own and is asserted by its suite: **`tenant_not_selected`
 * is LAST.** Its declaration says why in as many words — *"Every other arm
 * above is read first, so this can only be returned when the session is
 * genuinely live and genuinely unscoped — which is the one situation in which
 * the words are true."* So reaching this branch already proves the door
 * matches, the person matches, the session is unrevoked and unexpired, the
 * person is enabled and the directory is enabled. **A revoked session cannot
 * arrive here wearing `tenant_not_selected`, and that is a property of the
 * function rather than a hope about it.**
 *
 * ⚠️ AND SUCH A CALLER CARRIES `principal: null`. It is authenticated and it
 * holds NO AUTHORITY: `capabilityAuthoriser()` reads `null` as *"there is no
 * reader"* and refuses before `decide()`. An unscoped session can reach D1 and
 * can reach nothing gated.
 */

import type { FastifyRequest } from 'fastify'

import { withSessionScope } from '../../db/session-scope.ts'
import { withSelectionScope } from '../../db/selection-scope.ts'
import { withTenantScope, type ScopedClient, type TenantPool } from '../../db/tenant-scope.ts'
import {
  SERVED_HOST_REFUSALS,
  SERVED_SURFACE_KINDS,
  checkHostBinding,
  resolveServedHost,
  type ConsoleHost,
  type ServedSurfaceKind,
  type ServingHost,
} from '../../model/serving-host.ts'
import {
  SESSION_REFUSALS,
  holdsLiveMembership,
  resolveSubject,
  selectTenantForSession,
  type HeldAssignment,
  type HeldPartnerAssignment,
  type HeldPlatformAssignment,
  type HeldStaffGrant,
  type OrgClass,
  type PartnerGrantTerms,
  type ResolvedSubject,
} from '../../model/access.ts'
import type { Session, User } from '../../model/domain.ts'
import type { PartnerId, Timestamp, UserId } from '../../model/kernel.ts'
import { digestOfHandle } from './handle-digest.ts'
import { sessionCookieFrom } from './session-cookie.ts'
import {
  readHeldAssignments,
  readMemberships,
  readPartnerGrant,
  readPartnerHeld,
  readPlatformHeld,
  readStaffGrant,
  readSubjectRows,
  type SubjectRows,
  type SubstrateRefusal,
} from './identity.ts'

export const LOCAL_TEST_AUTH_ENV = 'RECONCILE_LOCAL_TEST_AUTH'
export const LOCAL_TEST_AUTH_ON = '1'

/**
 * THE AUTHENTICATED CALLER.
 *
 * ⚠️ THIS INTERFACE WAS `{ readonly tenantId: string }` AND THE NEW SHAPE IS
 * WIDER IN THE ONE DIRECTION THAT MATTERS: **`tenantId` IS NULLABLE NOW.** That
 * is not a loosening — it is the structural fact `model/domain.ts` calls *"the
 * one structural fact the whole surface turns on"* arriving in `server/` for
 * the first time. A session is NOT tenant-scoped between authentication and
 * selection; a principal type that could not say so would have forced this
 * reader to either refuse every unselected session — making D1, the operation
 * that PERFORMS the selection, unreachable — or to invent a tenant, which is
 * invariant 1 inverted.
 */
export interface TenantSession {
  /**
   * 🛑 READ FROM THE SESSION ROW OR FROM THE VERIFIED TOKEN, AND FROM NOWHERE
   * ELSE. Invariant 1. There is no code path in `server/` that assigns this
   * from a header, a query parameter or a body — the capability contract
   * declares no such field, the foundation contract declares no such field,
   * and the querystring schema is `additionalProperties: false`, so a request
   * that tried would be refused before a handler saw it.
   *
   * ✅ **AND THAT LAST CLAUSE WAS NOT UNIVERSALLY TRUE WHEN IT WAS WRITTEN —
   * IT IS NOW, SINCE G941 ON 20 Sep 2026, AND THE GAP IS RECORDED RATHER THAN
   * QUIETLY CLOSED.** An operation declaring no query parameter got NO
   * querystring schema at all (`schemaFromParameters()` returned `undefined`
   * for an empty property set), so on **122 of 136** declared operations the
   * key was parsed and IGNORED rather than refused. **Nothing in `server/`
   * ever read it, so the sentence above was right about invariant 1 and
   * overstated the MECHANISM** — the worse direction of wrong, because a
   * reader checking this claim would have found it satisfied by inspection of
   * the declarations and never asked whether the schema existed.
   * `server/contract/routes.ts` now emits `{type:'object', properties:{},
   * additionalProperties:false}` for such an operation, and
   * `tests/http/parameter-free-querystring.test.ts` is the control.
   *
   * `null` means AUTHENTICATED AND UNSCOPED: the row exists, is live and is
   * bound to this host, and `tenant_id` is still NULL because nothing has
   * selected one. D1 is what selects one.
   */
  readonly tenantId: string | null
  /**
   * The digest of the presented handle — the value `app.session_ref` carries
   * and the ONLY key by which this caller's row is visible under G160.
   *
   * ⚠️ IT IS NOT THE HANDLE AND MUST NEVER BE PUT BESIDE ONE. `null` for the
   * local-test arm, which has no row and therefore no digest — and that `null`
   * is what makes a dev token structurally unable to reach the selection
   * write, rather than merely unlikely to.
   */
  readonly sessionRef: string | null
  /**
   * The row, for the two model functions that take one — `checkHostBinding()`
   * (G180) and `selectTenantForSession()` (G199). `null` for the local-test
   * arm.
   */
  readonly row: Session | null
  /**
   * 🛑 EVERYTHING `decide()` IS EVALUATED AGAINST, RESOLVED ONCE PER REQUEST —
   * OR `null`, WHICH MEANS *"THERE IS NO READER"* AND NEVER *"THEY HOLD
   * NOTHING"*. G299, 19 Sep 2026. This field did not exist before that ruling
   * because none of its terms had a producer.
   *
   * `null` in exactly three situations, all of them refusals one layer up:
   * the local-test arm (a token has no rows behind it at all), a session that
   * is live and UNSCOPED (`tenant_not_selected` — see the header), and nothing
   * else, because every other path returns `null` from the reader entirely.
   *
   * ⚠️ IT IS RESOLVED AT **AUTHENTICATION** AND NOT AT THE GATE, AND THE REASON
   * IS A SIGNATURE RATHER THAN A PREFERENCE. `CapabilityAuthoriser<P>` is
   * `(principal, capability) => CapabilityVerdict` — SYNCHRONOUS — and reading
   * three tables is not. Widening it is a `server/http/app.ts` edit and this
   * slice is fenced out of `server/http/`; **the fence is also the better
   * shape**, because authentication is where the request's identity is
   * established and a gate that could issue queries is a gate that can be made
   * slow by an unauthenticated caller. The cost is that the rows are read on
   * every gated request whether or not the handler needs them, which is stated
   * rather than hidden.
   */
  readonly principal: ResolvedPrincipal | null
}

/**
 * THE SEVEN TERMS `PrincipalContext` NEEDS, MINUS THE TWO THE AUTHORISER
 * SUPPLIES ITSELF (`tenantId` is on this session; `now` is the request's).
 *
 * ⚠️ IT IS NOT A `PrincipalContext` AND MUST NOT BECOME ONE. That type is
 * `model/access.ts`'s and carries `now`, so building one here would stamp a
 * clock at authentication time and hand it to an evaluation that happens
 * later — `PrincipalContext.now` exists so *"a decision is reproducible in an
 * audit"*, and a clock read one hop early is a clock read in the wrong place.
 *
 * ⚠️ AND IT IS NOT A `PrincipalSubstrate` EITHER, THOUGH IT IS ALMOST ONE. That
 * type lives in `server/data-plane/authorise.ts`, which imports THIS module for
 * `TenantSession` — so declaring it there and reading it here would be a cycle.
 * `substrateFromSession()` in that file is the one-way projection, and it is
 * where `partnerGrant` is answered.
 */
export interface ResolvedPrincipal {
  /**
   * 🛑 `status` IS CARRIED FROM THE COLUMN AND IS NOT WRITTEN AS `'active'`,
   * EVEN THOUGH IT CAN ONLY BE `'active'` HERE TODAY. `resolveSubject()` has
   * already refused `user_disabled` before this object is built, so the literal
   * would be correct — and writing it would be the fabrication this whole slice
   * exists to refuse, one field wide. `decide()`'s step 1 reads the term and
   * `subject_not_active` stays reachable for any caller that reaches the
   * evaluator by another road.
   */
  readonly subject: { readonly userId: UserId; readonly status: 'active' | 'disabled' }
  /** From `orgFor(connection.owner)`, inside `resolveSubject()`. Never inferred. */
  readonly orgClass: OrgClass
  /** The partner whose directory authenticated them. Null unless `partner`. */
  readonly partnerId: PartnerId | null
  /**
   * 🛑 INVARIANT 2's TERM, AND IT HAS A PRODUCER SINCE G576, 19 Sep 2026 —
   * `db/migrations/0039_partner_access_grant.sql`. This field is what
   * `server/data-plane/authorise.ts` spent four rulings writing `⛔` beside.
   *
   * ⚠️ `null` HERE IS TWO THINGS AND — UNLIKE `platformHeld` — COLLAPSING THEM
   * COSTS NOTHING, WHICH IS AN ARGUMENT AND NOT AN OVERSIGHT. For a
   * non-partner organisation no reader ran; for a partner whose customer has
   * granted nobody, a reader ran and found no row. `decide()` reads this term
   * ONLY on the partner arm, where the second meaning is the only one
   * reachable, and the model declares no `partner_grant_unreadable` reason to
   * tell them apart with. The three-state discipline `platformHeld` carries
   * exists because `DECISION_REASONS` spends two members on it; here there is
   * one member, `partner_grant_absent`, and inventing a state the evaluator
   * cannot report would be a distinction with no reader.
   *
   * 🛑 WHAT IS NOT COLLAPSED IS A FAILED READ. `readPartnerGrant()` returning
   * `ok: false` makes `resolveAuthority()` return `null` — a 401 — rather than
   * a `null` grant, because a `null` grant IS `partner_grant_absent` on the
   * wire and that would report OUR failure as the CUSTOMER's decision. Same
   * polarity as a failed assignment read, and for the same reason.
   */
  readonly partnerGrant: PartnerGrantTerms | null
  /**
   * A reader ran. `[]` means they hold none — a fact, not an absence.
   *
   * 🛑 NULLABLE SINCE G728, AND `null` MEANS *"NO READER RAN"* ON A SURFACE
   * WHERE ONE COULD NOT HAVE. ⚠️ **THIS FIELD WAS `readonly HeldAssignment[]`
   * AND THE SENTENCE ABOVE IS KEPT RATHER THAN REPLACED**, because it is still
   * exactly right about the tenant surface and it is the distinction
   * `server/data-plane/authorise.ts` states in capitals — *"`held: []` DENIES,
   * AND `held: null` REFUSES."*
   *
   * A `RoleAssignment` is a tenant-scoped row. A console session is bound to
   * no tenant, so there is no scope the rows could be read under and no set
   * for `[]` to be the emptiness of. **Writing `[]` here would assert a fact
   * about a person on the strength of a query nobody issued**, which is the
   * one thing the three-state discipline on `platformHeld` exists to prevent,
   * arriving one field over.
   */
  readonly held: readonly HeldAssignment[] | null
  /**
   * `null` for every non-platform organisation, and that is *"no reader ran"*
   * rather than *"they hold none"*. `decide()` reads this term only AFTER
   * `orgClass` has said `platform`, so looking for a customer's platform
   * assignments would be answering a question nobody asked — and reporting `[]`
   * would assert a fact nothing checked.
   */
  readonly platformHeld: readonly HeldPlatformAssignment[] | null
  /**
   * R10, 1 Oct 2026 — the fifth arm's term. OPTIONAL and three-state, for
   * `platformHeld`'s reason: absent or `null` is *"no reader ran"*, `[]` is
   * *"a reader ran and they hold none"*. Read only on the CONSOLE surface and
   * only for a `partner` principal — see `resolveAuthority()`'s console arm.
   */
  readonly partnerHeld?: readonly HeldPartnerAssignment[] | null
  /**
   * G2591, 1 Oct 2026 — applying G2407, THE OWNER'S RULING. The one
   * `TenantAccessGrant` this person presents into the bound tenant, read by
   * `readStaffGrant()` inside the SAME `withTenantScope()` snapshot as the
   * membership and assignment reads. `null` is *"a reader ran and there is no
   * grant"* — a FAILED read is a 401 and never arrives here. `decide()` reads
   * it on the PLATFORM arm only; for every other organisation it is inert.
   * Absent on the console surface, where there is no tenant to hold a grant
   * into.
   */
  readonly staffGrant?: HeldStaffGrant | null
}

/**
 * The bound tenant, or a throw.
 *
 * 🛑 A THROW RATHER THAN A REFUSAL, AND IT IS THE SAME POLARITY `server/http/
 * app.ts` USES FOR A GATED-BUT-UNAUTHENTICATED ROUTE: *"THROWN rather than
 * refused so that it stays unreachable."* Every capability-tier operation is
 * gated, and G200's gate refuses every one of them today, so a handler
 * reaching here with no tenant means the gate did not run. A 403 would be a
 * gate reporting success at doing nothing; a 200 does not bear discussing.
 */
export function boundTenantOf(session: TenantSession, operationId: string): string {
  if (session.tenantId === null) {
    throw new Error(
      `${operationId} was reached by a session with no tenant bound. A tenant-scoped ` +
        'read needs a scope, and this session has not been through `POST /context/resolve` ' +
        '— the operation whose own description reads "Every other operation in every tier ' +
        'receives the result of this call." Either the capability gate did not run, or ' +
        'this operation should not be tenant-scoped.',
    )
  }
  return session.tenantId
}

/**
 * THE ACTING SESSION'S DIGEST, OR A THROW — G730, 19 Sep 2026, and it is
 * `boundTenantOf()`'s mirror for invariant 10's SECOND home.
 *
 * 🛑 WHY THIS EXISTS AT ALL. A tenant-less act's record lives in
 * `tenant.platform_authorization_grant`, whose policy is keyed on the acting
 * SESSION — `db/migrations/0091`, copying the shape
 * `db/migrations/0009_identity_substrate.sql` uses for the five tables read
 * before a tenant is selected. So the write needs `withSessionScope()`, which
 * needs the digest, and a caller that has none has no scope its record could
 * be written under OR read back from.
 *
 * 🛑 A THROW RATHER THAN A REFUSAL, FOR `boundTenantOf()`'s REASON VERBATIM:
 * *"THROWN rather than refused so that it stays unreachable."* The one arm
 * with a `null` digest is G192's local-test token, which carries no session
 * row and therefore `principal: null` — so `principalContextFor()` has already
 * refused it several lines earlier in `authorisedHandler()`, and reaching here
 * means two functions disagree about the same object.
 *
 * ⚠️ AND THE DATABASE WOULD REFUSE IT ANYWAY, WHICH IS WHY THIS IS A MESSAGE
 * AND NOT A CONTROL. With `app.session_ref` unset the policy's subquery
 * returns no row, the `WITH CHECK` compares against NULL, and the INSERT
 * fails — G100's deny-on-NULL, working. `tests/db/platform-authorisation-
 * record.test.ts` §4 is the witness for that, because a throw here would
 * otherwise make the policy's own negative control unreachable and
 * untestable.
 */
export function actingSessionOf(session: TenantSession, operationId: string): string {
  if (session.sessionRef === null) {
    throw new Error(
      `${operationId} was reached by a caller with no session row, and its authorisation ` +
        'record has no scope it could be written under. Invariant 10\'s platform home is ' +
        'keyed on the acting session — `db/migrations/0091` — and the only arm that ' +
        'carries no digest is the local-test token, which resolves no principal and is ' +
        'refused before this point. Either the gate did not run, or something has given ' +
        'the dev arm a resolvable principal.',
    )
  }
  return session.sessionRef
}

export function localTestAuthEnabled(): boolean {
  return process.env[LOCAL_TEST_AUTH_ENV] === LOCAL_TEST_AUTH_ON
}

export type SessionReader = (request: FastifyRequest) => Promise<TenantSession | null>

/**
 * WHERE THE CREDENTIAL IS READ FROM — a parameter, chosen ONCE at boot, and the
 * whole of G386's fence in one type.
 *
 * ⚠️ IT IS NOT A LIST OF CHANNELS AND MUST NOT BECOME ONE. A reader that took
 * `{cookie: boolean, header: boolean}` would be the *"boolean check inside a
 * request handler"* G386 refuses by name, relocated to a constructor. There are
 * exactly two functions of this type in the repository: `sessionCookieFrom()`,
 * which `resolveSessionReader()` always uses, and a composition with
 * `server/dev/session-header.ts`'s reader, which it can only build after a
 * dynamic import the flag gates.
 */
export type HandleFrom = (request: FastifyRequest) => string | undefined

/**
 * The Host the request arrived on, for G180's binding check.
 *
 * ⚠️ `request.headers.host` AND NOT `request.hostname`. Fastify's `hostname`
 * strips the port on some paths and consults `X-Forwarded-Host` when the
 * instance is built with `trustProxy` — a value an unauthenticated caller
 * controls. `normaliseHost()` in `model/serving-host.ts` deliberately does NOT
 * strip a port (*"stripping it here would be the normaliser deciding that two
 * different configured values name the same place"*), so the raw header is the
 * value the binding was written against.
 */
function presentedHost(request: FastifyRequest): string {
  const raw = request.headers.host
  return typeof raw === 'string' ? raw : ''
}

/**
 * THE TWO REGISTRIES THIS PROCESS SERVES. G726, 19 Sep 2026.
 *
 * ⚠️ TAKEN AS ONE PARAMETER RATHER THAN TWO, because they are ONE question —
 * *which surface is this host?* — and `resolveServedHost()` cannot answer it
 * from either alone: the collision arm reads both. Two parameters would be two
 * things a caller can forget to pass in step.
 */
export interface HostRegistries {
  readonly tenants: readonly ServingHost[]
  readonly consoles: readonly ConsoleHost[]
  /**
   * G2549 — the ONE host the broker returns every sign-in to, or absent/`null`
   * on a plane with none (`RECONCILE_SIGNIN_RETURN_HOST`, validated at boot by
   * `signInReturnHostFromEnv()` against both registries above).
   */
  readonly signInReturnHost?: string | null
}

/**
 * WHICH SURFACE THIS REQUEST ARRIVED ON, AND THE ONE FALL-BACK IN THIS FILE,
 * ARGUED AT THE PLACE IT HAPPENS. G726/G727, 19 Sep 2026.
 *
 * 🛑 THE TENANT SURFACE IS THE STRICTER OF THE TWO, WHICH IS WHY IT IS THE
 * ANSWER FOR A HOST NEITHER REGISTRY CLAIMS. On a tenant surface
 * `resolveSubject()` refuses an unbound session at `tenant_not_selected` and
 * the caller reaches D1 and nothing else; on a console surface an unbound
 * session RESOLVES and carries authority. **So `host_not_registered` → tenant
 * is a fall-back to the narrower of two answers, not a fall-back to a
 * permission**, and it preserves byte-for-byte the behaviour every request had
 * before this function existed: the tenant registry has always been consulted
 * at D1 rather than at authentication, and a host nobody registered has always
 * been refused there.
 *
 * ⚠️ IT DOES NOT MAKE AN UNREGISTERED HOST A 401 AND MUST NOT. Doing so would
 * move `host_not_registered` from D1's 403 — where the contract declares it and
 * where `tests/http/context-resolve.test.ts` asserts it — into the
 * authenticator, turning a REGISTRY question into a CREDENTIAL answer for every
 * suite and for `compose.yaml`.
 *
 * 🛑 THE ONE REFUSAL THAT IS NOT A FALL-BACK IS THE COLLISION, AND IT REFUSES
 * EVERYBODY. `host_serves_a_tenant_and_a_console` is OUR configuration error:
 * one name registered on both sides, where picking either one picks whether a
 * session may exist without a tenant at all. `null` here is a 401 for every
 * caller on that host, which is the only answer that cannot be gamed by
 * retiring one of the two rows.
 */
function surfaceOf(
  registries: HostRegistries,
  host: string,
): ServedSurfaceKind | null {
  const served = resolveServedHost(registries.tenants, registries.consoles, host)
  if (served.ok) {
    /**
     * 🛑 A `switch` WITH A `never` DEFAULT SINCE G2021, 22 Sep 2026, WHERE
     * THIS READ `return served.surface.kind`.
     *
     * ⚠️ **IT GUARDS A DIFFERENT AXIS FROM THE ONE IN `resolveSubject()` AND
     * THE PAIR IS THE POINT.** That one switches on `ServedSurfaceKind` — the
     * union derived from `SERVED_SURFACE_KINDS` — so a third CONST MEMBER is a
     * compile error there. This one switches on a `ServedSurface` VALUE, so a
     * third UNION ARM is a compile error here, including one spelled as a bare
     * literal that never touches the const. **`tests/http/public-plane-is-not-a-
     * served-surface.test.ts` §1a and §1b pin those two axes as assertions;
     * these two `never` bindings pin them in the compiler**, which is the
     * stronger of the two and the one a scanner cannot be re-keyed around.
     *
     * ⚠️ AND THE RETURN IS SPELLED OUT RATHER THAN PASSED THROUGH. `return
     * served.surface.kind` type-checks against a widened union and asks
     * nothing; naming each arm is what makes the `never` reachable.
     */
    const surface = served.surface
    switch (surface.kind) {
      case SERVED_SURFACE_KINDS.tenant:
        return SERVED_SURFACE_KINDS.tenant
      case SERVED_SURFACE_KINDS.console:
        return SERVED_SURFACE_KINDS.console
      default: {
        /* A third arm lands here as a type error. The runtime answer is
         * `null` — a 401 for every caller on that host — which is this
         * function's existing fail-closed answer for the collision and is the
         * narrower of the two it can give. */
        const unreadable: never = surface
        void unreadable
        return null
      }
    }
  }
  if (served.refusal === SERVED_HOST_REFUSALS.hostServesATenantAndAConsole) {
    console.error(
      'data-plane: a host is registered as a TENANT host AND as a CONSOLE host. ' +
        'Both surfaces are refused on that name until the registries disagree no ' +
        'longer — picking either one picks whether a session may exist with no ' +
        'tenant, which is larger than picking a tenant.',
    )
    return null
  }
  return SERVED_SURFACE_KINDS.tenant
}

/**
 * THE ONE READ, AND **EVERY** NARROWING ON IT IS A POLICY. THERE ARE NO
 * EXCEPTIONS LEFT.
 *
 * There is no `WHERE handle_digest = …` in this statement. `session_rls`
 * decides which row it can see, from `app.session_ref`, which
 * `withSessionScope()` set — the same shape `tests/db/session-isolation.test.ts`
 * asserts by reading the statement text that reached the server.
 *
 * 🛑 THIS DECLARATION READ `LIVE_SESSION_READ` AND CARRIED TWO MORE TERMS —
 * `WHERE revoked_at IS NULL AND expires_at > now()` — AND THE OLD COMMENT SAID
 * *"Read this file's header before adding a third."* **Nobody added a third;
 * the two were deleted, which is what the header always said would happen.**
 * Liveness is `resolveSubject()`'s, by name and in a fixed order, and the row
 * now carries `revoked_at` so that `session_revoked` is a reachable answer
 * rather than a member nothing can return. **A `WHERE` here is a second copy of
 * an order that is declared once — §5.3, where the copy is what drifts.**
 */
const SESSION_READ = `
  SELECT id, handle_digest, user_id, connection_id, tenant_id, issued_host,
         authenticated_at, last_used_at, expires_at, revoked_at
    FROM tenant.session
`

/**
 * Self-service sign-out's statement, reused by G180's revoking refusal.
 *
 * ⚠️ `WHERE revoked_at IS NULL` IS NEW AND IS A NARROWING ON A **WRITE**, WHICH
 * IS NOT THE SAME KIND OF THING AS THE ONE THIS COMMIT DELETED FROM THE READ.
 * A revoked session could not reach `checkHostBinding()` before, because the
 * read had already filtered it out; it can now, and `SET revoked_at = now()`
 * would move the recorded time of an act somebody took. The refusal is
 * unchanged either way — G180 refuses on the mismatch, not on the write
 * landing — so this clause protects an ANSWER rather than a decision.
 */
const REVOKE_SESSION =
  'UPDATE tenant.session SET revoked_at = now() WHERE revoked_at IS NULL'

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value)
}

function rowToSession(row: Record<string, unknown>): Session {
  /**
   * ⚠️ ONE CAST, AT ONE SEAM, AND IT IS A CAST OF SHAPE RATHER THAN OF
   * MEANING. Every branded id in `model/kernel.ts` is `text` under G97 and is
   * stored VERBATIM, so there is nothing to parse and nothing that could be
   * wrong except the column NAMES — which are pinned by the statement above.
   * `secondFactorAt` is `@dropped-for-v1` under G223 and has no column; it is
   * `null` here because the interface still declares it, and a column would be
   * the producer `tests/model/session-shape.test.ts` sweeps for.
   */
  return {
    id: String(row['id']),
    handleDigest: String(row['handle_digest']),
    userId: String(row['user_id']),
    connectionId: String(row['connection_id']),
    tenantId: row['tenant_id'] === null ? null : String(row['tenant_id']),
    issuedHost: String(row['issued_host']),
    authenticatedAt: iso(row['authenticated_at']),
    secondFactorAt: null,
    lastUsedAt: iso(row['last_used_at']),
    /**
     * 🛑 THIS FIELD WAS DROPPED FROM THIS OBJECT WHILE THE COMMIT BELOW WAS
     * BEING WRITTEN, `tsc` WAS GREEN, AND ONE TEST CAUGHT IT. It is recorded
     * here because it is the exact class this file's own cast note warns about
     * and it bit the commit that wrote the note.
     *
     * `as Session` is a cast of SHAPE, and a cast of shape cannot tell you that
     * a property is missing — the assertion suppresses the excess/absent
     * property check that would otherwise have been `TS2352`. So
     * `Session.expiresAt` became `undefined`, `resolveSubject()`'s
     * `session.expiresAt <= now` compared `undefined <= '2026-…'` — **which is
     * `false`, because a relational comparison against `undefined` is always
     * false** — and `SESSION_REFUSALS.sessionExpired` became unreachable in
     * exactly the same way `revokedAt: null` had made `sessionRevoked`
     * unreachable one line down.
     *
     * ⚠️ AND THE ONLY REASON IT WAS FOUND IS THAT `tests/http/context-resolve
     * .test.ts` b2 EXISTS AND DRIVES AN EXPIRED SESSION OVER A SOCKET. A green
     * `tsc` proved nothing; `docs/HANDOFF.md` §5.10 — *"If you add a field and
     * `tsc` stays green without you changing anything else, the compiler told
     * you nothing."*
     */
    expiresAt: iso(row['expires_at']),
    /**
     * 🛑 READ FROM THE COLUMN, AND IT WAS THE CONSTANT `null` UNTIL 19 Sep 2026.
     * That constant was TRUE while `LIVE_SESSION_READ` carried
     * `WHERE revoked_at IS NULL`, and it became a LIE in the same edit that
     * deleted the predicate — with `SESSION_REFUSALS.sessionRevoked` as the
     * casualty: every revoked session would have reached `resolveSubject()`
     * looking unrevoked, and the arm would have been a member nothing could
     * return. **A hard-coded field is a `WHERE` clause that survives the
     * deletion of the `WHERE` clause**, which is the sharpest small lesson in
     * this commit.
     */
    revokedAt: isoOrNull(row['revoked_at']),
  } as Session
}

function isoOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value)
}

async function readSessionRow(tx: ScopedClient): Promise<Session | null> {
  const result = await tx.query(SESSION_READ)
  const rows = result.rows as Array<Record<string, unknown>>
  const only = rows[0]
  if (only === undefined || rows.length !== 1) return null
  return rowToSession(only)
}

/**
 * THE DATABASE READER — a real session row, reached by its digest alone.
 *
 * 🛑 EVERY FAILURE IS THE SAME `null`, AND `PlaneOptions.authenticate` STATES
 * WHY IN ITS OWN VOICE: *"so that 'no session' and 'an error while checking the
 * session' cannot take different paths. Both are `null`; both are 401."* A
 * database that is down therefore reads as "no session" to the caller and as a
 * logged failure to the operator — which is the honest split, because a caller
 * learning that our database is unreachable learns something about us and
 * nothing it is owed.
 *
 * ⚠️ THE HOST BINDING IS CHECKED ON EVERY REQUEST AND NOT ONLY AT SELECTION —
 * G180, and it is the whole control. *"Cookie tossing and subdomain takeover
 * both work by getting a browser to send the right cookie to the wrong place,
 * and neither survives a server-side host-equality check."* A binding checked
 * once, at sign-in, would be a binding that stops being checked exactly when it
 * starts mattering.
 *
 * 🛑 `revoke` IS A VALUE AND IT IS ACTED ON HERE, WHICH IS THE HALF
 * `model/serving-host.ts` SAYS IS THE CALLER'S. Its own warning names the lazy
 * repair by name: *"#227's likeliest lazy repair is to implement the refusal
 * WITHOUT the revocation — every mismatch test still passes, and a
 * stolen-and-tossed session survives to be retried against the right host."*
 * The write runs in its own `withSessionScope()`, so it is confined to exactly
 * the row the digest already reached.
 */
function databaseReader(
  pool: TenantPool,
  handleFrom: HandleFrom,
  registries: HostRegistries,
): SessionReader {
  return async (request) => {
    const token = handleFrom(request)
    if (token === undefined) return null
    const sessionRef = digestOfHandle(token)
    if (sessionRef === null) return null

    /**
     * 🛑 ONE TRANSACTION FOR THREE ROWS, AND THE THREE ARE READ TOGETHER
     * BECAUSE THEY ARE ONE FACT. `resolveSubject()`'s first two arms —
     * `connection_mismatch` and `user_mismatch` — exist to close what its own
     * declaration calls *"THE ORG-CLASS ORACLE"*: a caller who supplies the
     * connection supplies the ORGANISATION. Reading all three inside the one
     * session scope means the caller supplies nothing: `user_rls` and
     * `identity_connection_rls` resolve both rows FROM the session row, through
     * the same GUC `session_rls` keys on.
     *
     * ⚠️ SO THOSE TWO ARMS ARE UNREACHABLE FROM THIS CALLER AND ARE STILL
     * CHECKED, WHICH IS NOT WASTE. `resolveSubject()` is total over what it is
     * handed and does not know where its rows came from; every fixture in
     * `tests/model/` hands it a mismatched pair on purpose. A function that
     * trusted its caller would be a function whose next caller has to be
     * audited.
     */
    let read: { row: Session; rows: SubjectRows } | null = null
    let refusal: SubstrateRefusal | null = null
    try {
      const outcome = await withSessionScope(pool, sessionRef, async (tx) => {
        const row = await readSessionRow(tx)
        if (row === null) return { kind: 'no-session' as const }
        const rows = await readSubjectRows(tx)
        if (!rows.ok) return { kind: 'substrate' as const, row, refusal: rows.refusal }
        return { kind: 'ok' as const, row, rows: rows.rows }
      })
      if (outcome.kind === 'no-session') return null
      if (outcome.kind === 'substrate') {
        /**
         * ⚠️ THE HOST BINDING IS **NOT** CHECKED ON THIS PATH AND THE ORDER IS
         * DELIBERATE. A session row whose person or door cannot be read is a
         * session this plane will not serve at all, so there is nothing for
         * G180 to protect and nothing to revoke — and revoking on a substrate
         * defect would destroy a live session every time an operator dropped a
         * row by mistake.
         */
        refusal = outcome.refusal
        read = null
      } else {
        read = { row: outcome.row, rows: outcome.rows }
      }
    } catch (err) {
      // See the header: a broken check is a refusal to the caller and a line in
      // the operator's log. `console.error` because the instance is built with
      // `logger: false` and `request.log` is a no-op sink.
      console.error('data-plane: the session read failed', err)
      return null
    }
    if (refusal !== null) {
      /* A fact about OUR substrate, not about the caller — see
       * `SUBSTRATE_REFUSALS`. The caller gets the same 401 as everyone else;
       * the operator gets the reason, which is the only reader entitled to it. */
      console.error(`data-plane: a session resolved no subject — ${refusal}`)
      return null
    }
    if (read === null) return null
    const { row } = read

    const binding = checkHostBinding(row, presentedHost(request))
    if (!binding.ok) {
      if (binding.revoke) {
        /*
         * 🛑 `withSelectionScope`, NOT `withSessionScope`, AND THE DIFFERENCE IS
         * WHETHER G180 REVOKES AT ALL. FOUND TWICE ON 19 Sep 2026 — BY AN
         * ADVERSARIAL PASS AND BY A BUILD SLICE, INDEPENDENTLY, FROM OPPOSITE
         * MANDATES — WHICH IS WHY IT IS RECORDED AS SETTLED RATHER THAN
         * SUSPECTED.
         *
         * `withSessionScope()` sets `app.session_ref` and DELIBERATELY NOT
         * `app.tenant_id` (`db/session-scope.ts`). `session_selection_
         * restrictive` (`0005`) is a RESTRICTIVE `FOR ALL … WITH CHECK` whose
         * membership subquery is itself narrowed by `membership_rls` on
         * `app.tenant_id`. With no tenant scope it denies, so this `UPDATE` was
         * REFUSED — and the refusal went into a `console.error`.
         *
         * ⚠️ `0005` QUOTES THE EXACT ERROR STRING THIS PRODUCED, in its own
         * comment, and says the policy *"is satisfiable ONLY inside a
         * transaction that ALSO carries `app.tenant_id`"*. Nobody connected it
         * to this path.
         *
         * 🛑 THE MEASURED CONSEQUENCE: a session with `tenant_id` NULL was
         * revoked; **every tenant-BOUND session was refused and NOT revoked.**
         * The revocation worked for every session that does not matter and
         * failed for every session that does. `tests/http/context-resolve.
         * test.ts` passes because the FOUNDATION path already runs inside
         * `withSelectionScope()`; this gated path did not.
         */
        /*
         * ⚠️ BOTH ARMS, EACH WITH THE SCOPE THAT SATISFIES ITS OWN POLICY, AND
         * THE SPLIT IS NOT A HEDGE. An UNBOUND session (`tenant_id` NULL) has
         * no tenant to select, and `withSelectionScope` takes one — it is also
         * the arm that ALREADY worked, because the restrictive policy's
         * membership subquery is not reached when there is no tenant to check.
         * A BOUND session needs both GUCs. Collapsing them would break
         * whichever arm lost.
         */
        /*
         * 🛑 THIS REPAIR IS PARTIAL AND THE BOUNDARY IS EXACT. IT REVOKES A
         * BOUND SESSION ONLY WHILE THE MEMBERSHIP IS LIVE.
         *
         * `session_selection_restrictive`'s check is
         * `(tenant_id IS NULL OR EXISTS (… tenant.membership …))`. Routing
         * through `withSelectionScope` supplies `app.tenant_id` so that
         * `EXISTS` can be evaluated — but it still has to FIND a membership.
         * Measured both ways on 19 Sep 2026:
         *
         *   membership live   → revoked   (tests/http/g180-revoke-bound.test.ts)
         *   membership absent → NOT revoked (tests/e2e/browser-login.test.ts §12b)
         *
         * ⚠️ AND THE UNCOVERED CASE IS THE ONE THAT MATTERS MOST. A session is
         * bound only by `selectTenantForSession()`, which CHECKS membership —
         * so a bound session implies membership existed at bind time. When
         * membership is later REVOKED, the session stays bound and G180 can no
         * longer revoke it. **A lapsed member's stolen handle, replayed against
         * the wrong host, is exactly the case with no containment.**
         *
         * 🛑 SO THE SLICE THAT FOUND THIS WAS RIGHT THAT A RULING IS OWED, and
         * the integrator was wrong to say otherwise: its words were *"the
         * repair is a ruling (a fifth scoped helper, or a policy amendment)"*.
         * This commit takes the half that needs no ruling and leaves that half
         * open, with `tests/e2e/browser-login.test.ts` §12b standing as the
         * UNMET WITNESS for it rather than being converted to a pass.
         */
        const bound = row.tenantId
        const revoked = await (
          bound === null
            ? withSessionScope(pool, sessionRef, async (tx) => tx.query(REVOKE_SESSION))
            : withSelectionScope(pool, sessionRef, bound, async (tx) => tx.query(REVOKE_SESSION))
        ).then(
          () => true,
          (err: unknown) => {
            /*
             * 🛑 THE SILENCE WAS THE DEFECT, NOT ONLY THE SCOPE. A denied
             * `UPDATE` and a successful one looked identical from outside, and
             * that is why this survived. The refusal above has already happened
             * and must not become a 500 — telling a caller their host mismatch
             * was interesting is the thing the original `catch` was right
             * about — so this stays non-fatal to the REQUEST and stops being
             * invisible to an OPERATOR.
             */
            console.error(
              'data-plane: G180 REFUSED A REQUEST AND FAILED TO REVOKE THE SESSION. ' +
                'The binding check is working and its containment is NOT: a stolen ' +
                'handle replayed against the wrong host stays live for the next ' +
                'attempt. This is not a log line to tune out.',
              err,
            )
            return false
          },
        )
        if (!revoked) request.log.error({ event: 'g180_revoke_failed' })
      }
      return null
    }

    /**
     * 🛑 THE MODEL DECIDES. This is the call `server/data-plane/session.ts` has
     * said for a month it *"CANNOT"* make, and the whole of G299 is that it can.
     * `now` is supplied rather than read inside the model, for
     * `PrincipalContext.now`'s reason — *"a decision has to be reproducible in
     * an audit"* — and the request plane is where a clock legitimately lives.
     */
    /**
     * 🛑 THE SURFACE IS RESOLVED AFTER `checkHostBinding()` AND NOT BEFORE, AND
     * THE ORDER IS THE SAME ARGUMENT THE SUBSTRATE ARM MAKES ABOVE. G180
     * compares the presented Host against the one the session was ISSUED on
     * and revokes on a mismatch; a session that fails that check has already
     * returned, so the host this looks up is BYTE-EQUAL to `issuedHost`. **A
     * console session is therefore resolved against the console host it was
     * issued on, and a tenant session against its tenant host, with no
     * exception added to G180 and none needed** — the binding check reads two
     * strings and has never known what a tenant is.
     */
    const surface = surfaceOf(registries, presentedHost(request))
    if (surface === null) return null

    const now = new Date().toISOString() as Timestamp
    const resolution = resolveSubject({
      session: row,
      user: read.rows.user,
      connection: read.rows.connection,
      now,
      surface,
    })

    if (!resolution.ok) {
      /* See the header: `tenant_not_selected` is LAST in that function's fixed
       * order, so it can only arrive on a session that is live in every other
       * respect. It is authenticated-and-unscoped — D1's caller — and carries
       * NO authority. Every other refusal is a 401. */
      if (resolution.refusal === SESSION_REFUSALS.tenantNotSelected) {
        return { tenantId: null, sessionRef, row, principal: null }
      }
      console.error(`data-plane: resolveSubject() refused — ${resolution.refusal}`)
      return null
    }

    const principal = await resolveAuthority(
      pool,
      sessionRef,
      resolution.subject,
      row,
      read.rows.user.status,
      now,
    )
    if (principal === null) return null

    /**
     * ⚠️ `tenantId` IS READ OFF THE DISCRIMINANT AND NOT OFF THE SUBJECT
     * DIRECTLY — G727. A console subject has no such property at all, which is
     * why this is a narrowing rather than a `??  null`: the compiler refuses
     * the shorter spelling, which is the whole reason `ResolvedSubject` was
     * made a union instead of given a nullable field.
     */
    const tenantId =
      resolution.subject.surface === SERVED_SURFACE_KINDS.tenant
        ? resolution.subject.tenantId
        : null

    return { tenantId, sessionRef, row, principal }
  }
}

/**
 * The two authority terms, read after — and only after — the subject resolved.
 *
 * 🛑 THE ORDER IS NOT AN OPTIMISATION. `held` is TENANT-SCOPED, so reading it
 * needs `app.tenant_id`, and `docs/build/stateless-adjudication.md` settled by
 * RULED 2 that the tenant scope may not be opened off a raw session column
 * before liveness is checked: *"the tenant scope opens for revoked sessions,
 * expired sessions and fired employees, and is only then refused."* The tenant
 * used below is `resolution.subject.tenantId` — a value `resolveSubject()`
 * returned, which it returns only on `ok`.
 *
 * ⚠️ A FAILED READ IS `null` AND THEREFORE A 401 RATHER THAN AN EMPTY ROSTER,
 * WHICH IS THE DIRECTION THAT MATTERS. `held: []` would mean *"a reader ran and
 * found none"* and would deny with `no_live_assignment`; that is a fact about
 * the person. A read that THREW is a fact about us, and reporting it as the
 * person's fact is the collapse `server/data-plane/authorise.ts` forbids in
 * capitals.
 */
async function resolveAuthority(
  pool: TenantPool,
  sessionRef: string,
  subject: ResolvedSubject,
  /**
   * 🛑 THE ROW, FOR `selectTenantForSession()` AND FOR NOTHING ELSE — G729.
   * That function is the ONE place G292's eleven staff-grant conditions are
   * written, and its input type takes a `Session` so that it can read
   * `session.userId` off the row rather than be handed a user id somebody
   * else chose. Threading the row through is what lets the per-request check
   * BE that function instead of a second copy of its terms — which is the
   * §5.3 the membership paragraph below forbids in its own last clause.
   *
   * ⚠️ `session.tenantId` IS STILL NOT READ BY IT, and that is the property
   * this parameter must not be taken to weaken: *"A session already carrying a
   * tenant proves nothing about whether it should."* The decision is made
   * against `hostBoundTenantId`, which is `subject.tenantId` here — a value
   * `resolveSubject()` returned off a session the host binding was re-checked
   * against on this same request.
   */
  row: Session,
  /**
   * 🛑 THE USER ROW'S OWN COLUMN, THREADED THROUGH RATHER THAN ASSUMED.
   * `ResolvedSubject` does not carry a status — `resolveSubject()` has already
   * refused `user_disabled`, so it could only ever be `'active'` — and writing
   * the literal at the construction site would be this slice fabricating the
   * one term §8.6 records as having been *"consulted by NOTHING"*. One
   * parameter is the price of the value coming from the database.
   */
  status: User['status'],
  /**
   * 🛑 THE REQUEST'S ONE CLOCK, THREADED THROUGH RATHER THAN READ AGAIN —
   * G641. `databaseReader()` already took `new Date().toISOString()` for
   * `resolveSubject()`, and a second `new Date()` here would be a second
   * clock: a session could then pass its own expiry check against one instant
   * and its membership check against another. `PrincipalContext.now` exists
   * for this — *"a decision has to be reproducible in an audit"* — and a
   * decision made against two instants is not one decision.
   */
  now: Timestamp,
): Promise<ResolvedPrincipal | null> {
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * 🛑 THE CONSOLE ARM — G726/G728, 19 Sep 2026. FIRST, AND IT RETURNS.
   * ═══════════════════════════════════════════════════════════════════════
   *
   * A console subject has NO TENANT, so there is no `withTenantScope()` to
   * open and the three tenant-scoped reads below are not merely skipped: they
   * are **unwritable**, because `subject.tenantId` does not exist on this arm
   * of the union. That is the discriminated shape earning its keep — a
   * nullable field would have compiled here and passed `''` or `null` into
   * `withTenantScope()`, where G100's deny-on-NULL would have returned an
   * empty roster and `held: []` would have said *"a reader ran and they hold
   * none"* about a read that never happened.
   *
   * 🛑 `platformHeld` IS THE ONE TERM THAT SURVIVES, AND IT SURVIVES BECAUSE
   * OF WHERE `0009` PUT ITS POLICY RATHER THAN BECAUSE ANYBODY CHOSE IT HERE.
   * `db/migrations/0009_identity_substrate.sql` keys `platform_role`,
   * `platform_role_capability` and `platform_role_assignment` on the SESSION —
   * *"because a person is read BEFORE a tenant is selected and a `tenant_id`
   * predicate would deny unconditionally under G100"* — so `readPlatformHeld()`
   * already runs inside `withSessionScope()` and needed no change at all.
   * **The owner's ruling is buildable because that decision was taken for a
   * different reason two slices ago.**
   *
   * ⚠️ AND THE OTHER THREE TERMS ARE `null`, WHICH IS *"NO READER RAN"* AND IS
   * THE TRUTH RATHER THAN A SHORTFALL:
   *
   *   `held`          tenant-scoped rows. There is no tenant, so there is no
   *                   set for them to be drawn from — and `[]` would claim we
   *                   looked. `principalContextFor()` requires this term only
   *                   on a surface that has a tenant, and argues it there.
   *   `partnerGrant`  per CUSTOMER TENANT — invariant 2's single cross-tenant
   *                   read path. A console session reaches no customer tenant,
   *                   so a grant into one is not a thing that could be read.
   *   membership      not read, and therefore not CHECKED. G641's per-request
   *                   liveness question is *"does this person still belong to
   *                   the tenant this session is bound to"*, and this session
   *                   is bound to none. **There is no lapse to catch**, which
   *                   is a statement about the shape and not an exemption.
   *
   * 🛑 SO A CONSOLE PRINCIPAL HOLDS EXACTLY ONE KIND OF AUTHORITY —
   * `PlatformRoleAssignment` — AND `decide()`'s PLATFORM ARM IS THE ONLY ARM
   * THAT CAN ANSWER FOR IT. A console principal whose `orgClass` is `customer`
   * or `partner` reaches `principal_holds_no_tenant` and is refused by name,
   * which is correct: the consoles are platform surfaces, and a customer who
   * signs in at one has authenticated and holds nothing there.
   *
   * ⚠️ AND NOTHING HAS EVER WRITTEN A `platform_role_assignment` ROW —
   * `grep -rn 'platform_role' server/dev/` returns nothing — so in this
   * repository today every console principal is refused at
   * `platform_assignment_absent`. **That is the substrate's state, not this
   * arm's**, and it is the same shape G289 recorded for the arm itself.
   */
  if (subject.surface === SERVED_SURFACE_KINDS.console) {
    try {
      const outcome = await withSessionScope(pool, sessionRef, (tx) =>
        readPlatformHeld(tx),
      )
      if (!outcome.ok) {
        console.error(
          `data-plane: the platform assignment read refused — ${outcome.refusal}`,
        )
        return null
      }
      /**
       * 🛑 R10, 1 Oct 2026 — THE FIFTH ARM'S TERM, READ ON THIS SURFACE AND
       *    ONLY FOR A PARTNER. `partners.reconcileai.app` is a console host
       *    (G726), so this is where a portal act arrives; `0250`'s policies key
       *    on the SESSION, so the read runs in `withSessionScope()` exactly as
       *    `readPlatformHeld()` does, and needed no new scope helper.
       *
       * ⚠️ NOT READ ON THE TENANT SURFACE BELOW, DELIBERATELY. A partner on a
       *    customer's tenant host is acting under THAT CUSTOMER's
       *    `PartnerAccessGrant`; answering the firm's own portal acts there
       *    would make the customer's host a door to the firm's surface. There
       *    `partnerHeld` is absent — *"no reader ran"* — and the fifth arm
       *    refuses at `partner_staff_assignment_unreadable`.
       */
      let partnerHeld: readonly HeldPartnerAssignment[] | null = null
      if (subject.orgClass === 'partner') {
        const staff = await withSessionScope(pool, sessionRef, (tx) => readPartnerHeld(tx))
        if (!staff.ok) {
          console.error(`data-plane: the partner-staff assignment read refused — ${staff.refusal}`)
          return null
        }
        partnerHeld = staff.partnerHeld
      }
      return {
        subject: { userId: subject.userId, status },
        orgClass: subject.orgClass,
        partnerId: subject.partnerId,
        partnerGrant: null,
        held: null,
        platformHeld: outcome.platformHeld,
        partnerHeld,
      }
    } catch (err) {
      console.error('data-plane: the console authority read failed', err)
      return null
    }
  }

  try {
    /**
     * 🛑 ONE TENANT SCOPE, THREE READS, AND THE SHARING IS LOAD-BEARING RATHER
     * THAN THRIFTY — G576, 19 Sep 2026, and G641 later the same day. Under
     * G101 a scope is a TRANSACTION, so every statement sees one snapshot: a
     * membership lapsed, a grant revoked, or an assignment withdrawn, between
     * them cannot produce a principal that half-existed. Two
     * `withTenantScope()` calls would be two transactions and therefore two
     * clocks, and the mixed view would arrive at `decide()` looking like a
     * fact.
     *
     * ⚠️ THE MEMBERSHIP READ IS FIRST AND THAT IS ORDERING, NOT PREFERENCE.
     * It is the cheapest read and the one whose failure makes the other two
     * irrelevant; but it is inside the SAME transaction rather than ahead of
     * it, so it is the snapshot's answer and not an earlier one's.
     *
     * ⚠️ THE PARTNER READ IS CONDITIONAL AND THE OTHER TWO ARE NOT.
     * `readPartnerGrant()` runs only after `orgClass` has said `partner` —
     * G289's prohibition in the mirror, *"holding a platform role proves
     * nothing about which directory authenticated anybody"*, read for the
     * organisation axis it was written about. For every other organisation the
     * term is `null` and `decide()` never looks at it.
     */
    const authority = await withTenantScope(pool, subject.tenantId, async (tx) => {
      const memberships = await readMemberships(tx, subject.userId)
      const heldOutcome = await readHeldAssignments(tx, subject.userId)
      const grantOutcome =
        subject.orgClass === 'partner' ? await readPartnerGrant(tx) : null
      /**
       * ⚠️ UNCONDITIONAL, UNLIKE THE PARTNER READ ONE LINE UP, AND THE
       * ASYMMETRY IS NOT AN OVERSIGHT — G729. The partner grant is read only
       * after `orgClass` has said `partner`, because reading a customer's
       * tenant for a partner grant *"would answer a question nobody asked"*.
       * **There is no equivalent discriminant for a staff grant**: invariant 8
       * is about a PERSON reaching a tenant they are not a member of, and
       * `orgClass` does not say whether somebody is an FDE — G289's own
       * prohibition, *"a membership proves nothing about organisation"*, read
       * in the other direction. Gating this read on `orgClass === 'platform'`
       * would be exactly that inference, and it would break the case invariant
       * 8 is written for.
       */
      const staffGrantOutcome = await readStaffGrant(tx, subject.userId)
      return {
        memberships,
        held: heldOutcome,
        grant: grantOutcome,
        staffGrant: staffGrantOutcome,
      }
    })

    /**
     * ⚠️ A FAILED STAFF-GRANT READ IS A 401 AND NOT AN ABSENT GRANT, for
     * `readPartnerGrant()`'s reason one term over: the model has one refusal
     * for *"no grant admitted you"* and none for *"we could not tell"*, so
     * passing `null` here would report OUR substrate defect as a fact about
     * whether anybody ever granted this person access.
     */
    if (!authority.staffGrant.ok) {
      console.error(
        `data-plane: the staff-grant read refused — ${authority.staffGrant.refusal}`,
      )
      return null
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * 🛑 MEMBERSHIP LIVENESS, ON EVERY REQUEST — G641, 19 Sep 2026, THE
     *    OWNER'S RULING: *"Check liveness on read. The per-request path treats
     *    a lapsed membership as it treats a revoked one. No sweeper and no
     *    clock."*
     * ═══════════════════════════════════════════════════════════════════════
     *
     * **A TRIGGER HAS NO TICK, WHICH IS THE WHOLE OF WHY THIS IS HERE.**
     * `db/migrations/0035_membership_liveness_voids_sessions.sql` names the
     * gap in its own voice and puts it to the owner rather than inventing a
     * sweeper: *"the CLOCK ARRIVING IS NOT AN `UPDATE`. A membership that
     * lapses purely by the passage of `expires_at`, with no statement written
     * against the row, fires nothing … The person's sessions stay live until
     * their own `session.expires_at` passes."* A REVOKED membership is caught,
     * because revoking it is a statement and `0019`/`0035`'s trigger voids the
     * sessions; an EXPIRED one was caught by nothing at all.
     *
     * 🛑 THE PREDICATE IS `model/access.ts`'s AND IS NOT WRITTEN HERE, AND
     * THAT IS THE OBJECTION `selectTenantForSession()` MAKES, ANSWERED.
     * That function refuses to check SESSION liveness because *"a second copy
     * here would be §5.3 — two implementations of one order — and the one that
     * drifts is always the copy."* The same objection applies in reverse to
     * putting a MEMBERSHIP check on this side of the seam, so the four terms
     * live in `holdsLiveMembership()`, D1 calls it through
     * `selectTenantForSession()`, and this calls it directly. **One
     * implementation, two callers, and the READ is shared too** —
     * `readMemberships()` moved into `server/data-plane/identity.ts` in the
     * same commit, so there is no second `SELECT` either.
     *
     * ⚠️ `null` — THEREFORE A 401, AND NOT A 403. `PlaneOptions.authenticate`
     * makes every failure here the same answer: *"so that 'no session' and 'an
     * error while checking the session' cannot take different paths."* A 403
     * would say the session is fine and the authority is not, which is the
     * opposite of what happened; and naming the term would tell whoever holds
     * the handle that their membership lapsed and roughly when — the oracle
     * `TENANT_SELECTION_REFUSALS.membershipAbsent` refuses to build one step
     * earlier, arriving here with the same argument.
     *
     * 🛑 AND IT REFUSES AN ABSENT MEMBERSHIP TOO, DELIBERATELY. The narrow
     * reading — *refuse only when rows exist and none is live* — is §5.1: a
     * rule keyed on the presence of a row instead of on the property, and it
     * fails OPEN, because deleting the row would then buy a permanent session.
     * A bound session implies a live membership existed at binding, so an
     * absent one is a state `selectTenantForSession()` cannot produce and a
     * seed can — which is exactly what several fixtures were forging.
     *
     * ✅ **THE STAFF ARM IS COVERED SINCE G729, 19 Sep 2026, AND THE DEBT WAS
     * NAMED HERE BEFORE IT WAS PAID.** ⚠️ **THE PARAGRAPH THAT STOOD HERE IS
     * QUOTED RATHER THAN DELETED**, because it is the sentence that told a
     * reader an FDE could not reach a tenant over HTTP and because its
     * instruction is what this commit follows:
     *
     *     "⚠️ WHAT IT DOES NOT COVER, NAMED RATHER THAN LEFT TO BE FOUND: the
     *      STAFF arm. `selectTenantForSession()` binds on a membership OR on a
     *      live `TenantAccessGrant` (G199/G292), and this asks only the first
     *      question — because `server/data-plane/context.ts` passes no
     *      `staffGrant` and nothing mints one, so no session in this repository
     *      is bound by the staff arm. The direction is safe: a staff-bound
     *      session would be REFUSED here, never admitted. **The commit that
     *      supplies a `staffGrant` at D1 owes this call site the same
     *      disjunct**, and it owes it here rather than in a second copy, which
     *      is the point of the term living in one place."
     *
     * 🛑 THE DISJUNCT IS `selectTenantForSession()` ITSELF, NOT A SECOND COPY
     * OF ITS TERMS, AND THAT IS THE WHOLE OF WHY IT IS ONE LINE. G292's three
     * liveness terms plus the three-list check plus the principal and tenant
     * comparisons are eleven conditions; writing eleven of anything twice is
     * the §5.3 the paragraph above forbids in its last clause. **This calls the
     * same function D1 calls, with the same grant read by the same reader, and
     * asks it the same question.** A grant that stops being live between
     * binding and this request produces `ok: false` here and a 401, which is
     * G641's ruling — *"the per-request path treats a lapsed membership as it
     * treats a revoked one"* — applied to the other authority.
     *
     * ⚠️ THE MEMBERSHIP ARM IS STILL ASKED FIRST AND THE ORDER IS
     * `selectTenantForSession()`'s OWN, quoted rather than re-decided:
     * *"SECOND, NEVER FIRST … a person who happens to hold both binds the
     * tenant on the membership — the weaker authority, which is the one that
     * leaves no grant marked as used."* Here the ordering buys the same thing
     * and costs one read: the grant is fetched inside the same transaction
     * whether or not it is consulted, because a conditional read would be a
     * second round trip on a snapshot that had already closed.
     *
     * 🛑 AND THE SHORT-CIRCUIT IS THE REASON THE GRANT READ IS NOT SKIPPED FOR
     * ORDINARY CALLERS' SAKE. `authority.grant` is read unconditionally inside
     * the one `withTenantScope()` above, so an ordinary customer pays one extra
     * `SELECT` against a unique index — the same cost `server/data-plane/
     * session.ts`'s header already states for the dev-token arm, and the same
     * argument: *"the alternative is to let a build-time convenience decide the
     * order of a security control."*
     */
    const liveMembership = holdsLiveMembership({
      memberships: authority.memberships,
      userId: subject.userId,
      tenantId: subject.tenantId,
      now,
    })
    const liveStaffGrant =
      liveMembership ||
      selectTenantForSession({
        session: row,
        hostBoundTenantId: subject.tenantId,
        memberships: authority.memberships,
        now,
        staffGrant: authority.staffGrant.grant,
      }).ok

    if (!liveStaffGrant) {
      console.error(
        'data-plane: a session bound to a tenant holds neither a live membership in it ' +
          'nor a live TenantAccessGrant into it — refused. G641: liveness is checked on ' +
          'READ, because a membership that lapses by the clock writes no statement and ' +
          'fires no trigger; G729 puts the staff grant on the same footing, because a ' +
          'grant that expires by the clock fires nothing either.',
      )
      return null
    }

    const held = authority.held
    if (!held.ok) {
      console.error(`data-plane: the assignment read refused — ${held.refusal}`)
      return null
    }

    /**
     * ⚠️ A REFUSED GRANT READ IS A 401 AND NOT AN ABSENT GRANT. See
     * `ResolvedPrincipal.partnerGrant`: the model has one member for absence
     * and none for unreadability, so passing `null` here would serve OUR
     * failure to the auditor as the CUSTOMER's decision not to grant.
     */
    let partnerGrant: PartnerGrantTerms | null = null
    if (authority.grant !== null) {
      if (!authority.grant.ok) {
        console.error(`data-plane: the partner-grant read refused — ${authority.grant.refusal}`)
        return null
      }
      partnerGrant = authority.grant.grant
    }

    /**
     * ⚠️ READ ONLY FOR A PLATFORM PRINCIPAL, AND `null` FOR EVERYONE ELSE.
     * G289: *"holding a platform role proves nothing about which directory
     * authenticated anybody"*, and the arm is reached only after `orgClass`
     * has already said `platform`. `null` is *"no reader ran"*, which is the
     * truth for a customer; `[]` would claim we looked.
     */
    let platformHeld: readonly HeldPlatformAssignment[] | null = null
    if (subject.orgClass === 'platform') {
      const outcome = await withSessionScope(pool, sessionRef, (tx) => readPlatformHeld(tx))
      if (!outcome.ok) {
        console.error(`data-plane: the platform assignment read refused — ${outcome.refusal}`)
        return null
      }
      platformHeld = outcome.platformHeld
    }

    return {
      /* The column's value, not the literal — see `ResolvedPrincipal.subject`. */
      subject: { userId: subject.userId, status },
      orgClass: subject.orgClass,
      partnerId: subject.partnerId,
      partnerGrant,
      held: held.held,
      platformHeld,
      /**
       * 🛑 G2591 — THE GRANT AS READ, NOT AS JUDGED. `selectTenantForSession()`
       * above has just asked whether it is live (as the per-request disjunct),
       * and `decide()` will ask again through the same `holdsLiveStaffGrant()`,
       * so passing the raw terms cannot make a dead grant carry a verb: the
       * evaluator re-derives liveness itself. Passed for every organisation
       * because the read is unconditional (G729's argument above); `decide()`
       * consults it only after `orgClass` has said `platform`.
       */
      staffGrant: authority.staffGrant.grant,
    }
  } catch (err) {
    console.error('data-plane: the authority read failed', err)
    return null
  }
}

/**
 * Choose the reader. Call this ONCE per process, at start-up.
 *
 * ⚠️ THE DYNAMIC IMPORT IS THE FENCE AND ITS SPECIFIER IS A LITERAL ON PURPOSE
 * — a literal is what makes `tsc` type-check the dev module against this call
 * site, while `await import()` inside the guarded branch is what keeps the
 * module out of a process that did not set the flag. The two properties are not
 * in tension here: TypeScript resolves the specifier statically, Node executes
 * it conditionally.
 */
export async function resolveSessionReader(
  pool: TenantPool,
  /**
   * ⚠️ REQUIRED AND NOT DEFAULTED TO `{ tenants: [], consoles: [] }` — G726.
   * A default here would make a caller that forgot the registries serve every
   * host as a TENANT host, silently, which is the narrower surface and
   * therefore looks harmless; what it would actually do is make the consoles
   * unreachable on a plane whose operator configured them. **A parameter with
   * no default is a caller that has to say.**
   */
  registries: HostRegistries,
): Promise<SessionReader> {
  /**
   * 🛑 THE PRODUCTION READER KNOWS ONE CHANNEL AND IT IS THE COOKIE — G386.
   * This line is the ruling. A plane that returns here has no code in it that
   * reads `X-Session`: `server/dev/session-header.ts` is the only module that
   * names the header, and the two `await import()`s below are the only things
   * that load it.
   */
  if (!localTestAuthEnabled()) {
    return databaseReader(pool, sessionCookieFrom, registries)
  }

  const { verifyTestToken } = await import('../dev/test-token.ts')
  const { sessionHeaderFrom } = await import('../dev/session-header.ts')
  /**
   * ⚠️ UNDER THE FLAG THE DATABASE READER TAKES BOTH, COOKIE FIRST, AND THE
   * ORDER IS THE SAME ARGUMENT THIS FILE'S HEADER MAKES ABOUT ROWS AND TOKENS:
   * where two channels could answer, the one the production path uses is the
   * one to take, so a local run exercises the deployed channel by default and
   * the header is what a `curl` reaches for.
   */
  const fromDatabase = databaseReader(
    pool,
    (request) => sessionCookieFrom(request) ?? sessionHeaderFrom(request),
    registries,
  )
  return async (request) => {
    const real = await fromDatabase(request)
    if (real !== null) return real

    const token = sessionHeaderFrom(request) ?? sessionCookieFrom(request)
    if (token === undefined) return null
    const verified = verifyTestToken(token)
    /**
     * ⚠️ A LOCAL-TEST PRINCIPAL CARRIES A TENANT AND NO ROW, AND THE TWO
     * `null`s BELOW ARE A FENCE RATHER THAN A SHORTFALL. Without a
     * `sessionRef` there is no digest to open `withSelectionScope()` with and
     * no row for `selectTenantForSession()` to read a `userId` off, so a dev
     * token cannot reach the tenant-binding write at all — it arrives already
     * scoped and can never change what it is scoped to.
     */
    /**
     * ⚠️ `principal: null` IS THE THIRD `null` AND IT IS THE STRONGEST OF THE
     * THREE. A local test token is a TENANT and nothing else: it names no
     * person, no directory and no assignment, so there is no reader and
     * `capabilityAuthoriser()` refuses it before `decide()` sees anything.
     * **A dev token authenticates and holds NOTHING**, which is a narrower
     * statement than the one this arm used to make — before G299 there was no
     * authority for anybody to hold, so the token's reach and a real session's
     * reach were the same reach.
     */
    return verified === null
      ? null
      : { tenantId: verified.tenantId, sessionRef: null, row: null, principal: null }
  }
}

/**
 * The sentence a 401 carries. A constant — `errors.yaml` forbids `detail` from
 * carrying anything request-derived, and a refusal that quoted the token back
 * would put a credential in a log.
 *
 * ⚠️ IT NAMES BOTH ARMS NOW. A refusal that mentioned only the local flag would
 * tell an operator with a real, revoked session to go looking at an
 * environment variable.
 */
export const UNAUTHENTICATED_DETAIL =
  'No live session was presented. The session handle travels as an HttpOnly, Secure, ' +
  'SameSite=Lax cookie on the host the session was issued on, and a session is a row that ' +
  'is unrevoked, unexpired and bound to that host. The X-Session header is read only by a ' +
  'plane STARTED with RECONCILE_LOCAL_TEST_AUTH=1, which also accepts locally minted test ' +
  'tokens; a plane started without it holds no code that reads that header at all.'

/**
 * THE FASTIFY INSTANCE BOTH PLANES ARE BUILT FROM.
 *
 * It knows nothing about tenants, runs, packs or databases. What it does is
 * turn a parsed OpenAPI tier into a route table, refuse anything the document
 * refuses, and render every refusal as the one RFC 9457 shape `errors.yaml`
 * defines.
 *
 * ┌─ THE FIVE THINGS THIS FILE DECIDES ────────────────────────────────────────┐
 * │ ⚠️ THIS HEADING SAID "THREE" UNTIL 19 Sep 2026, THEN CORRECTED ITSELF TO   │
 * │ "FOUR" IN THE BODY OF ITEM 4 RATHER THAN IN THE HEADING — which is how it  │
 * │ then arrived at FIVE with the heading still saying three. Both corrections │
 * │ are kept: the first three are unchanged, the fourth is G200's gate and the │
 * │ fifth is G301's mounting precondition, and each is an ADDITION rather than │
 * │ a replacement of one.                                                     │
 * │                                                                            │
 * │ ⚠️ AND THE HEADING SAID "FIVE" WHILE SIX BLOCKS STOOD BELOW IT, WHICH IS   │
 * │ the same defect it already narrates about "THREE" and "FOUR" — a heading   │
 * │ corrected in a BODY rather than in the heading. THERE ARE SEVEN. The       │
 * │ sixth is G911's per-operation gate verdict and the seventh is G1991's      │
 * │ logger allow-list; both are additions and none of the first five moved.    │
 * │ Derive it rather than reading this word: the numbered boxes are `1 ·`      │
 * │ through `7 ·` and nothing but a person governs the count.                  │
 * │                                                                            │
 * │ 1 · AJV REJECTS RATHER THAN STRIPS.  `removeAdditional: false` overrides    │
 * │     Fastify's default. With the default, `?tenantId=ten_globex` against a   │
 * │     querystring schema marked `additionalProperties: false` is SILENTLY     │
 * │     DELETED and the request is served — which satisfies invariant 1 and     │
 * │     leaves no evidence that it did. Rejecting makes the attempt visible in  │
 * │     a status code, a log line and a metric.                                 │
 * │                                                                            │
 * │ 2 · AUTHENTICATION RUNS IN `onRequest`, BEFORE VALIDATION.  So an           │
 * │     unauthenticated caller learns nothing about which query values are      │
 * │     legal: every malformed unauthenticated request gets 401, not 400. A     │
 * │     validator that answers before an authenticator is a schema oracle.      │
 * │                                                                            │
 * │ 3 · WHETHER A ROUTE IS SECURED COMES FROM THE DOCUMENT, never from a list   │
 * │     here. `routesOf()` reads `security` per operation and falls back to the │
 * │     document's. That is what lets one listener carry the capability tier    │
 * │     (session required) and the data-plane-local tier (liveness, no session) │
 * │     without a hand-maintained exemption list — the artefact that always     │
 * │     ends up one entry stale in the wrong direction.                        │
 * │                                                                            │
 * │ 4 · AUTHORISATION RUNS IN `preValidation`, AFTER AUTHENTICATION AND BEFORE  │
 * │     THE SCHEMA. G200's mechanism half, added 19 Sep 2026. ⚠️ THE HEADING    │
 * │     ABOVE SAID "THE THREE THINGS THIS FILE DECIDES" AND THERE ARE FOUR; it │
 * │     is corrected rather than deleted, because the three are unchanged and  │
 * │     the fourth is an addition to them rather than a replacement of one.    │
 * │                                                                            │
 * │     THE PHASE IS THE POINT, AND IT IS THE ONLY PHASE THAT WORKS.           │
 * │     `onRequest` is too early: the principal is established there, and a    │
 * │     gate in the same hook would race the thing it depends on. Anything     │
 * │     after validation is too late, and decision 2 above already says why in │
 * │     its own words — "a validator that answers before an authenticator is a │
 * │     schema oracle." AN AUTHENTICATED CALLER HOLDING NO CAPABILITY IS       │
 * │     EXACTLY AS UNENTITLED TO LEARN THE REQUEST SHAPE AS AN ANONYMOUS ONE,  │
 * │     so a gate behind the validator returns 400-with-context to somebody    │
 * │     who should have learned only "no". `preValidation` is the unique       │
 * │     Fastify phase that is after the first and before the second.           │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 5 · A GATED OPERATION THAT MINTS NO AUTHORISATION RECORD DOES NOT BOOT. ──┐
 * │   G301, 19 Sep 2026 — THE SIXTH FENCE, and the half of that ruling the     │
 * │   owner called load-bearing.                                              │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 6 · THE GATE VERDICT COMES FROM THE OPERATION, NOT FROM ITS FILE. ────────┐
 * │   G911 and G914, 20 Sep 2026 — the owner's ruling: *"the file boundary      │
 * │   should not carry an authorisation decision."* `TIER_REQUIRES_CAPABILITY`  │
 * │   is retired; every fence below reads `gateVerdictOf(spec.capability)` and  │
 * │   the fourth also reads `spec.caller`.                                     │
 * │                                                                            │
 * │   ⚠️ THE OWNER'S SURVIVING OBJECTION IS CARRIED AND NOT DISCHARGED: *"it    │
 * │   touches every mounted tier's boot path, and the split just landed on the  │
 * │   opposite premise."* **G781 IS NOT REVERSED HERE.**                        │
 * │                                                                            │
 * │   ⚠️ AND THERE ARE STILL SIX FENCES, NOT SEVEN, THOUGH THERE ARE SEVEN      │
 * │   `throw`s: the fourth is in TWO HALVES — an unacknowledged exemption, and  │
 * │   an acknowledgement that CONTRADICTS the document — because they are one   │
 * │   question (*"may this mount serve this operation past the gate?"*) asked   │
 * │   from both sides. Counting them as two would make the sixth fence the      │
 * │   seventh in five other files that cite it by number.                      │
 * │                                                                            │
 * │   ⚠️ **THAT SENTENCE WENT FALSE ON 1 Oct 2026 — D6-8, G2241 — AND IS       │
 * │   CORRECTED RATHER THAN DELETED, BECAUSE ITS REASON IS WHY THE NEW ONE IS  │
 * │   SEVENTH.** There are SEVEN fences now. The seventh is APPENDED, so every │
 * │   ordinal five files cite — the fourth, the sixth — means what it meant;   │
 * │   the owner refused fixing the fourth in place on exactly that ground.     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 6a · AN OPERATION THAT ASKS FOR NO CREDENTIAL, FACING A PERSON, MUST SAY  │
 * │   SO AT THE MOUNT. ─────────────────────────────────────────────────────── │
 * │   D6-8, THE OWNER'S, 29–30 Sep 2026 — THE SEVENTH FENCE, and               │
 * │   `servedPublicly()` is its acknowledgement. See the fence itself.         │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 7 · THE LOGGER IS ON, AND IT PRINTS FROM AN ALLOW-LIST. ─────────────────┐
 * │   G1391–G1396, 21 Sep 2026 — G1067 discharged. `logger: false` stood here  │
 * │   from 16 Aug 2026, so `Observability`'s (G1061) eight alarms could fire   │
 * │   with nothing to explain one.                                            │
 * │                                                                            │
 * │   🛑 WHAT THIS FILE DECIDES IS NOT *"logging is on"* — IT IS THAT THE ONLY  │
 * │   THING THAT MAY REACH A LOG LINE IS A FIELD `server/http/log-allow-list.ts`│
 * │   ADMITS. `logger: true` alone BREACHES `docs/tech-stack.md` §12.1 on its   │
 * │   first request: Fastify's default `req` serializer emits `url` (the QUERY  │
 * │   STRING, forbidden by name) and `host` (which resolves to a TENANT under   │
 * │   G179/G180). Measured, and quoted verbatim in that module's header.        │
 * │                                                                            │
 * │   ⚠️ THE 500 PATH IS THE ONE THAT MOVED, AND IT IS WHY THIS IS A DECISION   │
 * │   RATHER THAN A CONFIG LINE. This handler used `console.error(…, error)`,   │
 * │   which prints the WHOLE error — a `pg` failure's `detail` is a ROW VALUE   │
 * │   (`Key (tenant_id)=(ten_acme) already exists.`) — on exactly the path the  │
 * │   5xx alarm watches. It now goes through `request.log.error({ err }, …)`    │
 * │   with a CONSTANT message, so the `err` serializer governs it.             │
 * │                                                                            │
 * │   ⚠️ AND FASTIFY'S OWN ERROR LINE IS SUPPRESSED BY THE CUSTOM HANDLER       │
 * │   BELOW — measured, not assumed. Without one, Fastify sets the top-level    │
 * │   `msg` to `error.message`, which no serializer and no formatter can reach. │
 * │   **Deleting `setErrorHandler` would re-open that channel**, which is a     │
 * │   thing nobody would guess from reading either file alone.                 │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ **INVARIANT 10 IS NO LONGER DEFERRED HERE, AND THE PARAGRAPH THAT SAID SO
 *    IS QUOTED RATHER THAN DELETED** — it is the sentence a reader would have
 *    trusted, and the half of it that is still exactly true is the half that
 *    decided where the record goes.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It read: *"🛑 WHAT THE GATE DOES NOT DO — AND DO NOT READ A SHIPPED GATE AS
 * DOING IT. IT ALLOWS, AND IT RECORDS NOTHING. Invariant 10 — 'an act with no
 * authorisation is unrecordable' — is DEFERRED here deliberately: the record
 * `model/` requires is minted against a `ResourceRef`, and a `preValidation`
 * hook holds a route and a principal and no resource. The record is a
 * HANDLER-level seam and this is not it."*
 *
 * **THE GATE STILL RECORDS NOTHING AND STILL MUST NOT.** Every word about the
 * hook is unchanged, and G301 takes it as its own premise — *"the handler mints
 * it, because a handler knows its resource and `preValidation` does not."* What
 * ended is the DEFERRAL, not the reasoning: the seam the paragraph pointed at
 * has been built, in `server/data-plane/authorisation-record.ts`, and this file
 * gained the one thing a shared layer can contribute to it — **a refusal to
 * mount a gated operation that does not use it.**
 *
 * ⚠️ AND THE CONTROL THE NEXT PARAGRAPH DESCRIBED HAS FIRED AND BEEN REPLACED,
 * WHICH IS WHAT IT WAS FOR. It read: *"THE TYPE NAMES THAT SEAM IS WRITTEN IN
 * ARE DELIBERATELY NOT SPELLED ANYWHERE UNDER `server/` … `tests/http/
 * authorisation-record.test.ts` scans every source file under `server/` and both
 * migration directories for them — comments included … and goes RED the day one
 * appears."* It went red on this commit, which is the day it was written for.
 * Its own header named the price of making it green — *"the record updated, and
 * these assertions replaced by ones that verify the record is WRITTEN rather
 * than that it is absent"* — and that file now asserts the positive property
 * over a socket and over a real database. **No assertion was deleted to make it
 * pass.**
 *
 * 🛑 BE PRECISE ABOUT WHAT THE SIXTH FENCE BUYS, BECAUSE INVARIANT 10's OWN
 * SENTENCE IS CAREFUL AND THIS FILE MUST NOT OVERCLAIM ON IT. *"This does not
 * make an unauthorised act impossible — nothing can, against root — it makes
 * one visible or detectable."* The fence makes ONE thing structurally true and
 * it is a narrow thing: **no operation this document gates can be SERVED by a
 * handler that did not mint a record**, because the plane does not start. It
 * says nothing about anything that reaches the database by another road.
 */

import Fastify, {
  type FastifyError,
  type FastifyServerOptions,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify'

import {
  ANNOTATION_KEY,
  EXEMPT_PREFIX,
  callerMayBeAPerson,
  gateVerdictOf,
  publicOperationFacesAPerson,
} from '../contract/capability.ts'
import { basePathOf, loadTier, type TierName } from '../contract/document.ts'
import { routesOf, type RouteSpec } from '../contract/routes.ts'
import { CROSS_ORIGIN_DETAIL, refusesCrossOrigin, startedElsewhere } from './cross-origin.ts'
import { loggerOptions } from './log-allow-list.ts'
import { CODES, PROBLEM_CONTENT_TYPE, problem } from './problem.ts'

/**
 * The authenticated caller, attached out of band.
 *
 * A `WeakMap` rather than a decorated property so that no route can read a
 * principal it was not given one for: an unsecured route's request is simply
 * absent from the map, and `principalOf()` throws instead of returning a
 * plausible empty object. Decoration would put an `undefined` on every request
 * and make the difference a `?.`.
 */
const principals = new WeakMap<FastifyRequest, unknown>()

export function principalOf<P>(request: FastifyRequest): P {
  const found = principals.get(request)
  if (found === undefined) {
    throw new Error(
      'a handler asked for the authenticated principal on a route the contract ' +
        'does not mark `security`. Either the operation should declare one, or ' +
        'the handler should not be reading it.',
    )
  }
  return found as P
}

export type Handler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>

export interface PlaneOptions<P> {
  /** Named for the log line and for the error a bad handler map produces. */
  readonly plane: string
  /**
   * Returns the caller, or `null` to refuse.
   *
   * 🛑 REFUSAL IS THE DEFAULT AND IT IS EXPRESSED AS A RETURN VALUE, not a
   * thrown exception, so that "no session" and "an error while checking the
   * session" cannot take different paths. Both are `null`; both are 401.
   *
   * ⚠️ IT MAY NOW RETURN A PROMISE, AND THAT IS A WIDENING RATHER THAN A
   * REWRITE — THE SENTENCE ABOVE IS UNCHANGED AND STILL BINDS. It read
   * `(request) => P | null` until 19 Sep 2026, and a synchronous signature is
   * a signature that cannot read a database: G160 keys `tenant.session`'s
   * policy on a digest carried in a GUC, so establishing a REAL session is a
   * scoped transaction and nothing else. A plane whose authenticator cannot do
   * I/O can authenticate nobody but the holder of a locally minted token,
   * which is the state this repository was in.
   *
   * 🛑 A REJECTED PROMISE IS NOT A REFUSAL. The hook `await`s this and does
   * NOT catch — a throw is a 500 from the error handler, exactly as a throw
   * from `authorise` is, and for the same reason: an authenticator that BROKE
   * must not be indistinguishable from one that said no. Each plane's reader
   * owns turning its own failures into `null` where `null` is the honest
   * answer, and says so where it does it.
   */
  readonly authenticate: (request: FastifyRequest) => P | null | Promise<P | null>
  /** The sentence put in the 401's `detail`. A constant, never request-derived. */
  readonly unauthenticatedDetail: string
  /**
   * Does this caller hold this verb? — G200's mechanism, supplied per plane.
   *
   * 🛑 THE CAPABILITY ARRIVES AS A `string`, NOT AS `Capability`, AND THAT IS A
   * FENCE RATHER THAN LAZINESS. This module must not import `model/access.ts`.
   * It is shared by BOTH planes, and the control plane's whole claim under
   * invariant 3 is that tenant-shaped code is not in its module graph at all —
   * `server/control-plane/config.ts` argues the process half and
   * `tests/http/plane-separation.test.ts` asserts the topology. A `Capability`
   * import HERE would put the access model onto the control plane's import
   * graph by way of the one layer they share, which is the single direction
   * neither of those two files is looking. The value is opaque to this layer;
   * what this layer decides is the ORDER it is asked in and the SHAPE of the
   * refusal.
   *
   * ⚠️ `buildPlane<P>` WAS ALREADY GENERIC OVER THE PRINCIPAL, and that generic
   * is what makes this possible rather than merely tidy: a `TenantSession` and a
   * `ChannelPrincipal` have nothing in common, so no shared function can reason
   * about both — the shared layer holds the order, each plane holds the verdict,
   * and neither has to know what the other's subject is.
   *
   * REFUSAL IS A RETURN VALUE, exactly as `authenticate`'s is and for the same
   * reason: "this verb is not held" and "something broke while deciding" must
   * not be made to look alike. A plane whose authoriser THROWS therefore gets a
   * 500 from the error handler below — which is the honest answer to a broken
   * authoriser, and is never a 200.
   */
  readonly authorise: CapabilityAuthoriser<P>
  /** The sentence put in the 403's `detail`. A constant, never request-derived. */
  readonly unauthorisedDetail: string
  /**
   * Where log lines go. Omitted in production, where pino writes to stdout and
   * the ECS `awslogs` driver ships it.
   *
   * 🛑 THIS IS A DESTINATION AND NEVER A POLICY, WHICH IS THE WHOLE REASON IT
   * IS ALLOWED TO EXIST ON A PRODUCTION INTERFACE AT ALL. `server/dev/
   * test-token.ts`'s flag is fenced structurally because it selects an
   * ACCEPTING CODE PATH; this selects a WRITABLE STREAM. The serializers and
   * the formatter are `loggerOptions(plane)`'s in BOTH arms and cannot be
   * overridden through it — which is exactly what makes a test that reads
   * these bytes evidence about production rather than about a fixture.
   *
   * ⚠️ AND NEITHER PLANE PASSES ONE. Derive it, never read it:
   * `grep -rn 'logDestination' server/data-plane/ server/control-plane/`
   * returns nothing, and `tests/http/log-allow-list.test.ts` §8 asserts that
   * absence over the source tree so a production caller cannot appear quietly.
   */
  readonly logDestination?: NodeJS.WritableStream
}

/**
 * Held, or not held. Two states and no third.
 *
 * A `boolean` would carry the same information and is refused for the reason
 * §5.5 gives: at a call site, `authorise(p, c)` returning `false` reads as "the
 * call failed" as readily as "the verb is not held", and those two have opposite
 * polarities in a security decision. A named literal cannot be misread, and an
 * unhandled member becomes a compile error in any `switch` written over it
 * later — the discipline CLAUDE.md states for a closed key set.
 */
export type CapabilityVerdict = 'held' | 'not_held'

export type CapabilityAuthoriser<P> = (principal: P, capability: string) => CapabilityVerdict

/**
 * 🛑 THE MARK A GATED HANDLER MUST CARRY — G301's MOUNTING PRECONDITION, MADE
 * INTO A TYPE.
 *
 * `MINTS` is a module-private `unique symbol`. It is NOT exported, so a
 * `RecordingHandler` **cannot be written as an object literal anywhere else in
 * the program** — `tsc` cannot resolve the key, and a runtime forgery cannot
 * obtain the symbol's identity. `recordsAuthorisation()` below is the only
 * constructor there is.
 *
 * ⚠️ AND THAT IS A STRUCTURAL CLAIM WITH A STATED LIMIT, BECAUSE THE ALTERNATIVE
 * — PRETENDING IT IS AIRTIGHT — IS THE §5.6 SHAPE THIS FILE SPENDS FIVE FENCES
 * AVOIDING. `recordsAuthorisation()` is exported and will mark whatever it is
 * handed. What the symbol buys is that marking becomes an EXPLICIT, GREPPABLE
 * CALL rather than a shape anybody can happen to satisfy; what makes the
 * production claim hold is that `server/` contains exactly ONE such call, in
 * `server/data-plane/authorisation-record.ts`, wrapped around the one seam that
 * performs the write — and `tests/http/authorisation-record.test.ts` §2b counts
 * them and fails the gate at two. Same shape as G192's structural fence on the
 * dev token, which is also a `grep` that must return a fixed answer.
 */
declare const MINTS: unique symbol

export interface RecordingHandler {
  readonly [MINTS]: true
  readonly mark: 'records_authorisation'
  readonly handle: Handler
  /**
   * 🛑 G3961 — WHICH CONTRACT VERBS THIS HANDLER CAN MINT A RECORD FOR. The
   * handler no longer states its own capability (it reads the one the
   * DOCUMENT gates the route on, through `gatedCapabilityOf()`), so the only
   * question left at the mount is whether the document's verb is one the
   * record's closed set contains. The EIGHTH FENCE asks it, at boot.
   *
   * ⚠️ OPTIONAL, AND THE ABSENCE IS NARROW: a test stub that mints nothing
   * passes none and is checked by the fence's first half alone. The one
   * production constructor — `authorisedHandler()` — always passes one.
   */
  readonly mints?: (capability: string) => boolean
}

/**
 * 🛑 THE SECOND MARK — G914, 20 Sep 2026 — AND IT IS THE FOURTH FENCE'S NEW
 * FOUNDATION. `servedWithoutAGate()` is `recordsAuthorisation()`'s shape,
 * argument and limits, one question over: **a mounted operation that states an
 * exemption and can be reached by a PERSON must be marked here, or the plane
 * does not boot.**
 *
 * ⚠️ **IT CARRIES NO REASON, DELIBERATELY, AND THE ABSENCE IS THE DESIGN.**
 * `server/contract/capability.ts` states the doctrine this obeys — *"THE
 * REASON LIVES ON THE OPERATION, NOT IN THE READER"* — and a second reason
 * here would be §5.3, two statements of one argument with no way to keep them
 * agreeing. The contract carries WHY (check B enforces a floor on it); this
 * mark carries **that somebody serving it read that reason and accepted it**.
 * Those are different acts by different people at different times: the 45
 * exemptions on `administration.openapi.yaml` were written by an author who
 * mounted nothing.
 *
 * 🛑 **AND IT CANNOT REMOVE A GATE.** The gate is `spec.capability`, read from
 * the DOCUMENT; this mark is read from the MOUNT. Marking a gated operation is
 * refused by the fourth fence's second half — a mark that contradicts the
 * document does not boot — so the only thing this can do is admit an
 * already-ungated operation to being served.
 */
declare const UNGATED: unique symbol

export interface UngatedHandler {
  readonly [UNGATED]: true
  readonly mark: 'served_without_a_gate'
  readonly handle: Handler
}

/**
 * A mounted entry: a bare handler, one marked as minting an authorisation
 * record, or one marked as knowingly served with no gate. Which one an
 * operation MAY be is decided by the document — see the third, fourth and
 * sixth fences in `mountTier()`, which between them are TOTAL over
 * `GateVerdict`.
 */
export type MountedHandler = Handler | RecordingHandler | UngatedHandler | PublicHandler

/**
 * 🛑 THE THIRD MARK — D6-8, 1 Oct 2026, G2241–G2245 — AND IT IS THE SEVENTH
 * FENCE'S ACKNOWLEDGEMENT. A mounted operation that asks for NO CREDENTIAL OF
 * ANY KIND (`spec.caller === 'none'`) on a tier whose public operations face a
 * PERSON (`PUBLIC_OPERATION_AUDIENCE`) must be wrapped in `servedPublicly()`,
 * or the plane does not boot.
 *
 * ⚠️ **IT IS NOT `servedWithoutAGate()` AND THE TWO MUST NOT BE MERGED.** That
 * mark acknowledges that an AUTHENTICATED person is served past `decide()`;
 * this one acknowledges that ANYBODY ON THE INTERNET is served, before there is
 * a person to authenticate. G1948 recorded the second case being expressed with
 * the first mark *voluntarily*, because no fence could see it — §5.1, a fence
 * keyed on the security scheme rather than on whether a human is there. **That
 * voluntary mark is replaced by a compelled one**, so the population of public
 * person-facing mounts is now exactly the set of `servedPublicly()` calls.
 *
 * 🛑 **AND LIKE ITS TWO SIBLINGS IT CANNOT WIDEN ANYTHING.** It is read from
 * the MOUNT; whether an operation needs a credential is read from the
 * DOCUMENT. A mark on an operation that DOES require one, or on a tier whose
 * public operations face infrastructure, contradicts the document and does not
 * boot — the seventh fence's second half.
 */
declare const PUBLIC: unique symbol

export interface PublicHandler {
  readonly [PUBLIC]: true
  readonly mark: 'served_publicly'
  readonly handle: Handler
}

/**
 * Mark a handler as one that mints invariant 10's record. **Call this in
 * exactly one place, immediately around the write.**
 *
 * It is a cast and the cast is named, because `CLAUDE.md` requires a cast to
 * say why: the `mark` field exists only so the two marks can be TOLD APART at
 * run time — it is a dispatch discriminant and it is not the fence. The fence
 * is `MINTS`, which is not exported, so a `RecordingHandler` cannot be written
 * as an object literal anywhere else in the program; and the control that the
 * mark is honest is the single-call-site count in
 * `tests/http/authorisation-record.test.ts` §2b, not this line.
 */
export function recordsAuthorisation(
  handle: Handler,
  mints?: (capability: string) => boolean,
): RecordingHandler {
  return (mints === undefined
    ? { mark: 'records_authorisation', handle }
    : { mark: 'records_authorisation', handle, mints }) as unknown as RecordingHandler
}

/**
 * Mark a handler as one that is SERVED WITH NO GATE, because the operation it
 * serves states an exemption. **Every call to this is a route that answers
 * before `decide()` is consulted, and each is argued at its own call site.**
 *
 * ⚠️ **THIS READ *"there are three in `server/`"* UNTIL 22 Sep 2026 AND THERE
 * WAS ONE — G1947.** It is corrected rather than deleted because it is the
 * sentence that told a reader how large this hole was, and because
 * `server/data-plane/start.ts` said *"IT IS THE ONLY CALL TO IT"* at the same
 * time: **two files, two numbers, one call.** There are TWO from 22 Sep 2026,
 * the second being `resolveHomeRealm` under G1941.
 *
 * 🛑 **AND THE DERIVATION THAT STOOD HERE COULD NOT HAVE CAUGHT EITHER, WHICH
 * IS G978's FINDING ARRIVING ON A SECOND COMMAND.** It read
 * `grep -rn 'servedWithoutAGate(' server/` and returned FOURTEEN lines when
 * G1947 ran it, ELEVEN of them PROSE — six of those in this file. It would
 * answer with double figures if this function had never been called.
 * **§5.1 wearing a `grep`.** ⚠️ **AND THAT FOURTEEN IS ALREADY HISTORY: the
 * same command answers 21 at this commit (G1996), because each correction
 * naming the command adds a line to the thing it measures. A derivation that
 * counts its own retraction is the defect stated twice.**
 *
 * 🛑 **AND THE FIRST REPAIR WAS THE SAME DEFECT NARROWED RATHER THAN
 * CLOSED, CAUGHT BY RUNNING IT BEFORE THE COMMIT LANDED (G1953).** It read
 * `grep -rn 'servedWithoutAGate(' server --include start.ts` and returns
 * **EIGHT** lines against **TWO** calls, because the prose mentions it drops
 * are in `app.ts` and the ones it keeps are in `start.ts` — the file the
 * narrowing selected FOR. ⚠️ **G1953 WROTE *NINE* HERE AND THE COMMAND
 * ANSWERS EIGHT (G1996): the row that exists to record a number written
 * rather than run carried a number written rather than run.** The figure is
 * not replaced with a third one to be trusted — it moves whenever anybody
 * edits a comment in either `start.ts`, which is the whole reason the
 * derivation below keys on syntax instead. **A derivation that is wrong by seven instead
 * of by twelve is still a derivation that cannot see a call.** Key on the
 * CALL SYNTAX and not on the file:
 *
 *     grep -rnE ': *servedWithoutAGate\(' server --include start.ts
 *
 * ⚠️ **AND *"person-facing"* IS DROPPED FROM THE FIRST SENTENCE ABOVE, WHICH
 * IS A NARROWING OF A CLAIM RATHER THAN A WIDENING OF A PERMISSION.** The
 * fourth fence COMPELS the mark only where `callerMayBeAPerson(spec.caller)`;
 * a mount may take it voluntarily where the caller kind says `none` and a
 * person is nonetheless there. `resolveHomeRealm` is exactly that case and
 * argues it at its own mount — the fence's key is the SECURITY SCHEME, and a
 * scheme says what a caller presents rather than who they are.
 */
export function servedWithoutAGate(handle: Handler): UngatedHandler {
  return { mark: 'served_without_a_gate', handle } as unknown as UngatedHandler
}

/**
 * Mark a handler as one served to ANYBODY — an operation that asks for no
 * credential of any kind and that a person, not yet signed in, is meant to
 * call. **Every call is a public unauthenticated person-facing route, and each
 * is argued at its own call site.** The count is derived on the CALL SYNTAX,
 * never on a bare name (G978, G1953):
 *
 *     grep -rnE ': *servedPublicly\(' server --include start.ts
 *
 * and `tests/http/public-mount-fence.test.ts` §3 is the control that names
 * each one, comments stripped.
 */
export function servedPublicly(handle: Handler): PublicHandler {
  return { mark: 'served_publicly', handle } as unknown as PublicHandler
}

function isPublic(entry: MountedHandler): entry is PublicHandler {
  return typeof entry === 'object' && entry.mark === 'served_publicly'
}

function isRecording(entry: MountedHandler): entry is RecordingHandler {
  return typeof entry === 'object' && entry.mark === 'records_authorisation'
}

function isUngated(entry: MountedHandler): entry is UngatedHandler {
  return typeof entry === 'object' && entry.mark === 'served_without_a_gate'
}

function handlerOf(entry: MountedHandler): Handler {
  return typeof entry === 'object' ? entry.handle : entry
}

export interface TierMount {
  readonly tier: TierName
  readonly handlers: Readonly<Record<string, MountedHandler>>
}

export function sendProblem(
  reply: FastifyReply,
  args: { status: number; code: string; title: string; detail?: string },
): FastifyReply {
  return reply.code(args.status).type(PROBLEM_CONTENT_TYPE).send(problem(args))
}

/**
 * The two document-derived facts a hook needs, carried ON the route rather than
 * looked up per request.
 *
 * ⚠️ `capability` IS PRESENT ONLY WHEN THE OPERATION NAMES ONE. An operation
 * carrying `exempt: <reason>` registers with the key ABSENT — not with an empty
 * string and not with a null — so the gate's first line is a test for
 * `undefined` and an exempt route is one the gate never touches. That is what
 * keeps `GET /health` (`checkLocalHealth`: exempt, and declaring no security
 * scheme at all) answering 200 rather than 500: the hook returns before it can
 * reach for a principal the route was never given one for.
 */
function routeConfig(request: FastifyRequest): {
  secured?: boolean
  capability?: string
  refusesCrossOrigin?: boolean
} {
  const config: unknown = request.routeOptions.config
  if (typeof config !== 'object' || config === null) return {}
  return config as { secured?: boolean; capability?: string; refusesCrossOrigin?: boolean }
}

/**
 * 🛑 THE CAPABILITY THE GATE ASKED ABOUT FOR THIS REQUEST — G3961, AND THE ONLY
 * PLACE A HANDLER MAY LEARN ITS OWN VERB.
 *
 * Until this commit every gated operation's capability was spelled TWICE: once
 * as `x-capability` in its contract, which the `preValidation` gate reads off
 * the route, and once as a constant on the server's `AuthorisedOperation`,
 * which `authorize()` minted against. Nothing at boot compared the two, so a
 * contract edit that moved one left every request answering a 403 that the
 * gate had already passed — `refusedAfterTheGate()` — for a reason no caller
 * could read. **The second spelling is DELETED**: the record now mints against
 * exactly the value the gate checked, read from the same route config, so the
 * two cannot disagree because there is only one.
 *
 * `undefined` on an ungated route. A recording handler mounted on one is
 * refused at boot by the eighth fence, so a caller here may treat `undefined`
 * as unreachable.
 */
export function gatedCapabilityOf(request: FastifyRequest): string | undefined {
  return routeConfig(request).capability
}

/**
 * The ajv options every plane validates with.
 *
 * `strict: false` because these are OpenAPI schemas, not hand-written JSON
 * Schema: they carry `description`, `example` and `summary` beside the keywords
 * ajv knows, and ajv's strict mode treats an unknown keyword as a fault in the
 * schema. Turning it off is what lets the CONTRACT be the validator rather than
 * a transcription of it.
 *
 * ⚠️ EXPORTED SO A TEST CAN VALIDATE WITH THE PLANE'S OWN SETTINGS RATHER THAN A
 * COPY OF THEM. `removeAdditional: false` is the line invariant 1's second line
 * of defence rests on, and a test that restated it would go on passing after
 * somebody changed it here.
 */
export const AJV_OPTIONS = {
  strict: false,
  coerceTypes: 'array',
  useDefaults: true,
  removeAdditional: false,
  allErrors: false,
} as const

export async function buildPlane<P>(
  options: PlaneOptions<P>,
  mounts: readonly TierMount[],
): Promise<FastifyInstance> {
  /**
   * 🛑 THE CAST IS THE INTERESTING LINE IN THIS FILE AND IT IS NOT A
   * CONVENIENCE — **FASTIFY'S OWN TYPES REQUIRE THE LEAK.**
   *
   * `FastifyLoggerOptions.serializers.err` is declared as returning
   * `{ [key: string]: unknown; type: string; message: string; stack: string }`,
   * so a `tsc` that is satisfied by construction is a serializer that emits
   * **`message` and `stack`** — the two fields `docs/tech-stack.md` §12.1
   * forbids by name, and the two `server/http/log-allow-list.ts` exists to
   * refuse. The exact error, kept so nobody re-derives it:
   *
   *     The types returned by 'serializers.err(...)' are incompatible …
   *       Type 'Record<string, unknown>' is missing the following properties
   *       from type '{ … type: string; message: string; stack: string; }'
   *
   * **THE REPAIR THE COMPILER ASKS FOR IS THE DEFECT.** So the shape is
   * asserted HERE, once, with the argument written down, rather than the
   * serializer being widened to satisfy it — and what makes that honest is that
   * the property is proven at RUNTIME instead: `tests/http/log-allow-list.test.ts`
   * drives real requests through a real plane and asserts over the EMITTED
   * BYTES, so a cast that had gone wrong would be a red test rather than a
   * green compile.
   *
   * ⚠️ TWO SMALLER TRAPS ARE ON THE SAME LINE AND BOTH COST A CYCLE. `Fastify()`
   * is OVERLOADED on `http2`/`https`, so ANY mismatch in this object makes the
   * first overload fail and the HTTP/2-SECURE one win — nine errors about
   * `Http2ServerRequest` in a file that never mentions HTTP/2, none of them
   * pointing here. And `logger` is an OPTIONAL property, so its declared type
   * includes `undefined` and a bare `FastifyServerOptions['logger']`
   * annotation is itself an error under `exactOptionalPropertyTypes`; hence
   * `NonNullable`.
   */
  const logger = {
    ...loggerOptions(options.plane),
    ...(options.logDestination === undefined ? {} : { stream: options.logDestination }),
    // `as unknown as` and not a single `as`: TypeScript REFUSES the direct
    // conversion — *"neither type sufficiently overlaps"* — which is the
    // compiler stating the gap above in its own words rather than a syntax
    // detail, and is worth one line because the double form otherwise reads
    // like somebody silencing an inconvenience.
  } as unknown as NonNullable<FastifyServerOptions['logger']>
  const app = Fastify({
    logger,
    ajv: { customOptions: { ...AJV_OPTIONS } },
  })

  app.addHook('onRequest', async (request, reply) => {
    const config = routeConfig(request)
    if (config.secured !== true) return
    /**
     * 🛑 CSRF — G3231, AND IT IS ASKED HERE, ONCE, BEFORE THE AUTHENTICATOR.
     *
     * `refusesCrossOrigin` was put on the route by `mountTier()` from the
     * CONTRACT (non-safe method · secured · a person's credential), so no
     * handler opts in and none can forget to. `server/http/cross-origin.ts`
     * argues the three terms and every exemption.
     *
     * ⚠️ BEFORE `authenticate`, DELIBERATELY, and that ordering buys two
     * things. A refused request opens no scoped transaction, so a sibling page
     * cannot spend this plane's pool (G1984) by firing forged writes; and it
     * never reaches the session reader's G180 host-binding REVOCATION, so an
     * attacker page cannot sign a victim out by making their browser post here
     * (G3212's a5 asserted exactly that for D1, and it now holds for all).
     *
     * ⚠️ 401 `session_invalid`, NOT A NEW CODE. `errors.yaml` is a CLOSED enum
     * and every secured operation already declares 401; a credential a browser
     * attached to a request another origin started is not a credential this
     * caller PRESENTED, which is exactly what 401 says. A 403 was considered
     * and refused: 403 is "authenticated, and not permitted", and this request
     * is refused before anybody is authenticated.
     */
    if (config.refusesCrossOrigin === true && startedElsewhere(request)) {
      await sendProblem(reply, {
        status: 401,
        code: CODES.sessionInvalid,
        title: 'This request was started by another origin.',
        detail: CROSS_ORIGIN_DETAIL,
      })
      return reply
    }
    /* `await` on a possibly-synchronous value: a plane whose reader answers
     * from a header pays nothing, and one whose reader opens a scoped
     * transaction is not forced to lie about being synchronous. */
    const principal = await options.authenticate(request)
    if (principal === null) {
      await sendProblem(reply, {
        status: 401,
        code: CODES.sessionInvalid,
        title: 'No valid session.',
        detail: options.unauthenticatedDetail,
      })
      return reply
    }
    principals.set(request, principal)
    return
  })

  /**
   * THE GATE. Registered here — immediately after the authentication hook and
   * before anything else — so that the two are READ in the order they RUN, and
   * nobody has to reconstruct that order from Fastify's lifecycle table.
   *
   * 🛑 `preValidation`, NOT `preHandler`. Both run after authentication; only
   * `preValidation` runs before ajv, and that difference is the whole of
   * decision 4 in this file's header. `tests/http/capability-gate.test.ts`
   * carries the matched pair that witnesses it: the same
   * `?tenantId=ten_globex` request, once against an authoriser that ALLOWS
   * (400, `validation_failed` — the query key invariant 1 forbids) and once
   * against one that REFUSES (403, `capability_not_held`). IF BOTH ARMS COME
   * BACK 400, THE GATE HAS MOVED BEHIND THE VALIDATOR and the schema oracle is
   * open again for the unentitled. That pair, and only that pair, can tell.
   */
  app.addHook('preValidation', async (request, reply) => {
    const capability = routeConfig(request).capability
    if (capability === undefined) return
    const principal = principals.get(request)
    if (principal === undefined) {
      /**
       * Unreachable — `mountTier()`'s third fence refuses a gated route that is
       * not secured — and THROWN rather than refused so that it stays
       * unreachable. Reaching here means the fence did not fire, and the only
       * honest answers are a 500 and a stack trace. A 403 here would be a gate
       * reporting success at doing nothing (§5.6); a 200 does not bear
       * discussing.
       */
      throw new Error(
        `${options.plane}: \`${request.routeOptions.url ?? request.url}\` is gated on ` +
          `\`${capability}\` and carries no authenticated principal. A gate needs a caller: ` +
          'the contract must mark this operation `security`, or must not name a capability on it.',
      )
    }
    if (options.authorise(principal as P, capability) === 'held') return
    await sendProblem(reply, {
      status: 403,
      code: CODES.capabilityNotHeld,
      title: 'That capability is not held.',
      detail: options.unauthorisedDetail,
    })
    return reply
  })

  app.setNotFoundHandler(async (_request, reply) => {
    await sendProblem(reply, {
      status: 404,
      code: CODES.resourceNotFound,
      title: 'No such operation.',
      detail: 'The OpenAPI documents are the router. A path they do not declare is not a route.',
    })
  })

  app.setErrorHandler(async (error: FastifyError, request, reply) => {
    if (error.validation !== undefined) {
      await sendProblem(reply, {
        status: 400,
        code: CODES.validationFailed,
        title: 'The request does not satisfy the contract.',
        // The CONTEXT — `querystring`, `params`, `headers` — and nothing from
        // the request itself. `errors.yaml`: `detail` must carry no field values.
        detail: `Rejected by the ${error.validationContext ?? 'request'} schema declared in the OpenAPI document.`,
      })
      return reply
    }

    /**
     * ═════════════════════════════════════════════════════════════════════
     * 🛑 THE OVERSIZED BODY — 413, AND UNTIL 22 Sep 2026 IT WAS A 500 THAT
     *    AN ANONYMOUS CALLER COULD MINT ON DEMAND. G1986.
     * ═════════════════════════════════════════════════════════════════════
     *
     * Fastify raises `FST_ERR_CTP_BODY_TOO_LARGE` from the content-type
     * parser when a body exceeds `bodyLimit`. **The error already carries
     * `statusCode: 413`** — it arrived here, fell past the `error.validation`
     * branch because a body that was never parsed has no validation result,
     * and was answered as an unhandled failure. Witnessed before the repair,
     * against a real `buildPlane()`:
     *
     *     POST /session/realm      2 MiB body -> 500 upstream_unavailable
     *     POST /context/resolve    2 MiB body -> 401 session_invalid
     *
     * 🛑 **THE DIFFERENTIAL IS THE FINDING, NOT THE 500.** The secured route
     * answers 401 because authentication runs in `onRequest`, BEFORE body
     * parsing — fence 2 at the top of this file, working. The unsecured route
     * returns at that hook's first line, so parsing proceeds and an
     * unauthenticated caller reached a code path reserved for our own
     * failures. `infra/lib/observability-stack.ts` alarms on the data ALB's
     * 5xx rate with *"Expected rate is zero … 5xx is reserved for one
     * unhandled-failure arm"*, and since G1941 that arm is anonymously
     * reachable through CloudFront with no WAF and no throttle. **A 500 is a
     * claim about US; this is a statement about the REQUEST.**
     *
     * ⚠️ `validation_failed` IS REUSED AND NOT MINTED, WHICH IS THIS
     * DIRECTORY'S RULE: adding a member to `errors.yaml`'s closed enum is a
     * contract change, and the enum has no `payload_too_large`. The code is
     * honest at 413 — a body over the limit does not satisfy the contract,
     * and `RealmRequest.domain` now carries the `maxLength` that says so for
     * every body small enough for ajv to see. `problem.ts` records the same
     * reuse discipline at `membershipAbsent`.
     *
     * ⚠️ THE `detail` NAMES NO SIZE AND NO FIELD. `errors.yaml` forbids field
     * values here, and a limit echoed back is a tuning parameter published to
     * whoever is probing for it.
     *
     * ⚠️ IT IS A RESPONSE NO TIER DECLARES, exactly as every 500 below is.
     * Declaring 413 on 136 operations is a contract change across seven
     * documents; naming it here is not. Named rather than left to be found.
     */
    if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      await sendProblem(reply, {
        status: 413,
        code: CODES.validationFailed,
        title: 'The request body is too large.',
        detail: 'The body exceeded this plane\'s limit and was not parsed.',
      })
      return reply
    }

    /*
     * ⚠️ THE 413 BRANCH ABOVE ARRIVED ON A BRANCH WHOSE `console.error` LINE
     * THIS MERGE DELETES — G1991 REPLACED IT WITH `request.log.error` ON
     * `main` WHILE S7 WAS ADDING THE BRANCH, AND BOTH SIDES OF THE MERGE WERE
     * RIGHT ABOUT THEIR OWN TREE. The branch is kept whole and the LOGGING
     * line is `main`'s, because G1991's premise — a `pg` unique-violation's
     * `detail` is a ROW VALUE, printed on the one path the 5xx alarm watches —
     * is exactly the path a 413 keeps callers OFF. The two repairs are the
     * same finding from two directions: an anonymous caller must not be able
     * to mint the unhandled-failure arm on demand, and the arm must not print
     * a row when something genuine reaches it.
     */
    /**
     * ⚠️ THIS WAS `console.error(\`${options.plane}: unhandled failure\`, error)`
     * UNTIL 21 Sep 2026 AND THE COMMENT BESIDE IT — *"`console.error` rather
     * than `request.log`: the instance is built with `logger: false`, so
     * `request.log` is a no-op sink and a genuine 500 would leave a 500 in a
     * client and nothing anywhere else"* — WAS CORRECT WHEN WRITTEN AND IS THE
     * premise G1991 removes. It is quoted rather than deleted because it is the
     * reason this line existed at all.
     *
     * 🛑 THE OLD FORM PRINTED THE WHOLE ERROR ON THE ONE PATH THE 5xx ALARM
     * WATCHES. Node renders a thrown `pg` error with its `message` and its
     * `stack`, and a unique-violation's `detail` is a ROW VALUE — `Key
     * (tenant_id)=(ten_acme) already exists.` — so the most sensitive line this
     * server emits was the one line no serializer could reach.
     *
     * The message is a CONSTANT and the error travels under `err`, so
     * `serializeError()` governs every field of it. The plane is on every line
     * already, from `loggerOptions(plane)`'s `base`.
     */
    request.log.error({ err: error }, 'unhandled failure')
    await sendProblem(reply, {
      status: 500,
      code: CODES.upstreamUnavailable,
      title: 'The request could not be completed.',
    })
    return reply
  })

  for (const mount of mounts) {
    mountTier(app, mount)
  }

  return app
}

/**
 * Register exactly the operations `handlers` implements, and refuse to boot if
 * it names one the document does not declare.
 */
function mountTier(app: FastifyInstance, mount: TierMount): void {
  const doc = loadTier(mount.tier)
  const specs = routesOf(doc, basePathOf(doc))
  const declared = new Map<string, RouteSpec>(specs.map((s) => [s.operationId, s]))

  const undeclared = Object.keys(mount.handlers).filter((id) => !declared.has(id))
  if (undeclared.length > 0) {
    /**
     * 🛑 THE FENCE, AND IT IS A BOOT FAILURE RATHER THAN A REVIEW COMMENT.
     * A handler whose operationId is in no contract cannot be served, because
     * the plane will not start. This is the direction that matters: the server
     * can be a subset of the contract, never a superset of it.
     */
    throw new Error(
      `${mount.tier}: ${undeclared.length} handler(s) name an operation this document does not ` +
        `declare — ${undeclared.join(', ')}. The contracts are the router; a handler cannot ` +
        'invent a route.',
    )
  }

  /**
   * 🛑 THE SECOND FENCE, AND IT IS THE BODY'S. An operation whose declared
   * `requestBody` could not be bundled into a JSON Schema is refused HERE rather
   * than registered without one: a route that accepts an unvalidated body is a
   * validator that passes while asserting nothing (§5.6), and it is strictly
   * worse than a 404. Refusing at registration rather than at parse keeps the
   * blast radius on the operation itself — one unbundleable body in a document
   * must not stop every unrelated operation in it from being served.
   */
  const unvalidatable = Object.keys(mount.handlers)
    .map((id) => declared.get(id) as RouteSpec)
    .filter((spec) => spec.unvalidatableBody !== undefined)
  if (unvalidatable.length > 0) {
    throw new Error(
      `${mount.tier}: ${unvalidatable.length} handler(s) name an operation whose request body ` +
        'cannot be validated from the contract — ' +
        unvalidatable.map((s) => `${s.operationId} (${s.unvalidatableBody})`).join(', ') +
        '. A route that accepts an unvalidated body is worse than an absent route.',
    )
  }

  /**
   * 🛑 THE THIRD FENCE: AN OPERATION WHOSE `x-capability` IS ABSENT OR
   * MALFORMED IS NOT MOUNTED — THE PLANE DOES NOT BOOT.
   *
   * Same polarity as the two above, and the same argument. The alternative is
   * to register it ungated, which is what this repository did for every
   * operation until G200 and is exactly the state that ruling refuses: "no
   * further operation is mounted until authorisation exists." An operation with
   * no annotation is not an operation somebody decided was public — it is an
   * operation nobody decided about, and the two are indistinguishable from
   * outside. Failing closed here makes them distinguishable from INSIDE, at
   * boot, in a message naming the operation.
   *
   * ⚠️ IT IS THE MOUNTED SET THIS SEES, AND ONLY THE MOUNTED SET — four
   * operations today. The other 72 declared operations are governed by
   * `tools/check-capability-annotations.mjs`, which walks every tier with this
   * same `classifyAnnotation()` and fails the gate. Neither control replaces
   * the other: the checker cannot see a plane, and this cannot see an operation
   * no plane mounts.
   */
  const ungoverned = Object.keys(mount.handlers)
    .map((id) => declared.get(id) as RouteSpec)
    .filter((spec) => gateVerdictOf(spec.capability) === 'ungoverned')
  if (ungoverned.length > 0) {
    throw new Error(
      `${mount.tier}: ${ungoverned.length} handler(s) name an operation carrying no usable ` +
        `\`${ANNOTATION_KEY}\` — ` +
        ungoverned
          .map((s) => `${s.operationId} (${s.capability.kind === 'malformed' ? s.capability.detail : 'absent'})`)
          .join(', ') +
        `. Every declared operation carries the key, never optionally: write \`${ANNOTATION_KEY}: ` +
        `<capability>\` or \`${ANNOTATION_KEY}: '${EXEMPT_PREFIX} <why this operation has no human ` +
        "principal>'` on it, in the contract. An unannotated operation is one nobody decided " +
        'about, and a route is not the place to discover that.',
    )
  }

  /**
   * 🛑 THE FOURTH FENCE — RE-FOUNDED 20 Sep 2026 UNDER G911/G914, AND IT IS
   * STRICTLY STRONGER THAN WHAT IT REPLACES: AN OPERATION THAT STATES AN
   * EXEMPTION AND CAN BE REACHED BY A PERSON IS NOT MOUNTED UNLESS ITS
   * HANDLER IS MARKED `servedWithoutAGate()` — AND THE PLANE DOES NOT BOOT.
   *
   * ⛔ **WHAT IT READ UNTIL THIS COMMIT, KEPT BECAUSE IT IS THE SENTENCE FOUR
   * DOCUMENTS AND NINE TEST FILES QUOTE:** *"ON A TIER THAT REQUIRES A
   * CAPABILITY, A STATED EXEMPTION IS STILL NOT A CAPABILITY"*, keyed on
   * `if (TIER_REQUIRES_CAPABILITY[mount.tier])`. **Its argument survives whole
   * and is the argument for this**: *"WITHOUT THIS, 'EXEMPT' IS A GATE THAT
   * CAN BE OPENED BY WRITING PROSE. The grammar admits `exempt:` anywhere by
   * design, so the TIER is the only thing that can refuse it."* It earned
   * itself with a real negative control — a capability-tier operation
   * annotated `x-capability: 'exempt: <twenty characters of plausible
   * reasoning>'` passed every other assertion in
   * `tests/contracts/capability-annotation.test.mjs` *"while being exactly as
   * ungated as an operation with no key at all."*
   *
   * 🛑 **WHAT CHANGED IS THE PREMISE IN ITS SECOND SENTENCE: THE TIER IS NOT
   * THE ONLY THING THAT CAN REFUSE IT, AND IT WAS REFUSING IT IN THE WRONG
   * PLACE.** Measured on the corpus the day this landed: the two tiers whose
   * verdict was `true` hold **0 exemptions of 53 operations**, so the old
   * fence fired on nothing that exists; the five `false` tiers hold **83
   * exemptions, 64 of them person-facing**, and the old fence was silent about
   * every one. `tests/http/administration-tier-unmounted.test.ts` §3b is that
   * silence, measured: a bare handler on `listPartnerRegistry`, an authoriser
   * refusing every capability, and **200 with the partner registry**.
   *
   * 🟢 **THE NEW KEY IS THE PROPERTY AND NOT THE FILE.** What makes an ungated
   * MOUNTED operation a hole is that a PERSON reaches it — `spec.caller`,
   * derived per operation from its own `security` by `callerOf()`. A machine
   * caller (`sigV4`) or no caller at all (`dataPlaneLocal`) is the case the
   * retired table's four uncontroversial `false`s were about, and those mount
   * unmarked exactly as before.
   *
   * 🛑 **AND BE PRECISE ABOUT WHAT THE MARK BUYS, BECAUSE OVERCLAIMING HERE IS
   * THE §5.6 SHAPE THIS FILE SPENDS SIX FENCES AVOIDING. IT DOES NOT MAKE AN
   * UNGATED PERSON-FACING ROUTE IMPOSSIBLE. IT MAKES ONE IMPOSSIBLE BY
   * ACCIDENT.** `servedWithoutAGate()` is exported and will mark whatever it is
   * handed; what it buys is that serving an operation past the gate becomes an
   * EXPLICIT, GREPPABLE, COUNTED call at the mount — the same trade G301's
   * `recordsAuthorisation()` takes one question over, and the same trade the
   * retired tier flip took at a granularity of 39 operations instead of one.
   */
  const excused = Object.entries(mount.handlers)
    .map(([id, entry]) => ({ spec: declared.get(id) as RouteSpec, entry }))
    .filter(({ spec }) => gateVerdictOf(spec.capability) === 'exempt')
    .filter(({ spec }) => callerMayBeAPerson(spec.caller))
    .filter(({ entry }) => !isUngated(entry))
    .map(({ spec }) => spec)
  if (excused.length > 0) {
    throw new Error(
      `${mount.tier}: ${excused.length} handler(s) serve an operation that buys its way out ` +
        'with a reason rather than naming a capability, to a caller who is a PERSON — ' +
        excused
          .map(
            (s) =>
              `${s.operationId} (caller: ${s.caller}, "${s.capability.kind === 'exempt' ? s.capability.reason : ''}")`,
          )
          .join(', ') +
        `. The \`preValidation\` gate returns at its FIRST LINE when a route names no capability, ` +
        'so this route is one the gate never touches and mints no invariant 10 record either. ' +
        'That may still be the right answer — `resolveTenantContext` is exactly this shape and ' +
        'is exempt on circularity — but it is a decision somebody must take at the MOUNT rather ' +
        'than inherit from an annotation written when nothing was mounted: wrap the handler in ' +
        '`servedWithoutAGate()`, which says so in one greppable call, or give the operation a ' +
        'capability in the contract.',
    )
  }

  /**
   * 🛑 THE FOURTH FENCE'S SECOND HALF: A MARK THAT CONTRADICTS THE DOCUMENT
   * DOES NOT BOOT.
   *
   * Without this, `servedWithoutAGate()` would read as *"serve this one past
   * the gate"* to the next person who meets it, and the two marks would be a
   * pair of switches somebody could set in either combination. They are not
   * switches: the DOCUMENT decides whether an operation is gated, and a mark
   * can only acknowledge what the document already says. A gated operation
   * wearing this one is an author who believed the opposite, and that belief
   * is worth a boot failure rather than a silently ignored field.
   */
  const contradicted = Object.entries(mount.handlers)
    .filter(([, entry]) => isUngated(entry))
    .map(([id]) => declared.get(id) as RouteSpec)
    .filter((spec) => gateVerdictOf(spec.capability) === 'gated')
  if (contradicted.length > 0) {
    throw new Error(
      `${mount.tier}: ${contradicted.length} handler(s) are marked \`servedWithoutAGate()\` and ` +
        'name an operation that DOES carry a capability — ' +
        contradicted
          .map((s) => `${s.operationId} (${s.capability.kind === 'capability' ? s.capability.capability : ''})`)
          .join(', ') +
        '. That mark acknowledges an exemption the CONTRACT states; it cannot create one, and it ' +
        'does not remove a gate — the `preValidation` hook reads the document, not the mount. ' +
        'Either the contract owes this operation an exemption or the mount owes it ' +
        '`recordsAuthorisation()`.',
    )
  }

  /**
   * 🛑 THE FIFTH FENCE: A GATED ROUTE THAT IS NOT SECURED DOES NOT BOOT.
   *
   * ⚠️ THIS ONE WAS NOT ASKED FOR AND IS ADDED ANYWAY, WHICH IS STATED RATHER
   * THAN SLIPPED IN. It is the boot-time form of the `throw` in the
   * `preValidation` hook above: a capability with no security scheme means the
   * gate would reach for a principal `principalOf()` says the route "does not
   * mark `security`" for, and every request to it would 500. Refusing at
   * registration turns a route that fails every time into a plane that fails
   * once, loudly, with the operation named — the same trade the four fences
   * above already take. It fires on nothing in the tree: the capability tier
   * declares `security` once, at document level, and no operation overrides it.
   */
  const gatedButOpen = Object.keys(mount.handlers)
    .map((id) => declared.get(id) as RouteSpec)
    .filter((spec) => gateVerdictOf(spec.capability) === 'gated' && !spec.secured)
  if (gatedButOpen.length > 0) {
    throw new Error(
      `${mount.tier}: ${gatedButOpen.length} handler(s) name an operation that is GATED and ` +
        'UNSECURED — ' +
        gatedButOpen.map((s) => s.operationId).join(', ') +
        '. A capability is a question about a caller, and this operation declares no security ' +
        'scheme, so there is no caller to ask about. Either the contract owes it a `security` ' +
        'requirement or it owes it an exemption.',
    )
  }

  /**
   * 🛑 THE SIXTH FENCE: A GATED OPERATION WHOSE HANDLER MINTS NO AUTHORISATION
   * RECORD IS NOT MOUNTED — THE PLANE DOES NOT BOOT. **G301, and it is the half
   * of that ruling the owner called load-bearing.**
   *
   * The ruling, in its own words: *"AN OPERATION MAY NOT MOUNT UNTIL IT MINTS A
   * RECORD. Tying it to mounting is what stops the invariant eroding one slice
   * at a time — every newly mounted operation arrives already recording, rather
   * than a backlog accruing behind a promise."* The alternative it refuses is
   * quoted there too: *"every operation mounted in between serves tenant data
   * with no trace, and `CLAUDE.md`'s invariant 10 would be false for exactly as
   * long as that lasts."*
   *
   * ⚠️ WHY THIS IS A FENCE AND NOT A REVIEW CONVENTION, STATED AGAINST THE ROW
   * THAT MADE IT NECESSARY. G200's own row records that *"there is no
   * mechanical form of 'no further operation is mounted'"* — a freeze has
   * nothing to key on, because the thing it forbids is a person adding a line.
   * **This one CAN be mechanical, and the reason is exactly G301's:** the
   * handler is right there at the mount, so the question *"does this operation
   * record what it does"* is answerable from the mount table itself rather than
   * from a diff somebody reads.
   *
   * 🛑 IT KEYS ON `capability.kind === 'capability'` AND NOT ON THE TIER, AND
   * THAT IS THE DIFFERENCE BETWEEN THIS AND THE FOURTH FENCE. A gate is what
   * makes a record MINTABLE: `authorize()` takes a capability, and an operation
   * carrying `exempt:` has none to take. `resolveTenantContext` is the case —
   * it MINTS THE SESSION a capability check is later built from, so requiring
   * it to mint an authorisation would be requiring it to authorise the act of
   * becoming authorisable. **An exemption from the gate is therefore an
   * exemption from this fence by construction, and that is a hole with a name:
   * an operation that buys its way out with prose buys its way out of the
   * record too.**
   *
   * ⚠️ **THE NEXT SENTENCE READ *"The fourth fence is what keeps that hole
   * shut on the capability tier, where `TIER_REQUIRES_CAPABILITY` is `true`
   * and no exemption is admitted at all"* UNTIL 20 Sep 2026, AND IT IS
   * CORRECTED RATHER THAN DELETED BECAUSE IT NAMES THE RELATIONSHIP BETWEEN
   * THE TWO FENCES AND THAT RELATIONSHIP IS THE POINT.** The hole is the same
   * hole; what changed is its reach. The fourth fence used to keep it shut on
   * **two tiers of seven, where it was never open** — measured: 0 exemptions
   * across `capability` and `platformConsole` — and to leave it wide on the
   * five where all 83 exemptions live. It now keeps it shut wherever a PERSON
   * can reach the route, on every tier at once, at the cost of one greppable
   * `servedWithoutAGate()` call per genuinely-ungated mount. **The hole is not
   * closed and this file must not claim it is: it is made explicit,
   * per-operation, and countable.**
   */
  const unrecorded = Object.entries(mount.handlers)
    .filter(([id]) => gateVerdictOf((declared.get(id) as RouteSpec).capability) === 'gated')
    .filter(([, entry]) => !isRecording(entry))
    .map(([id]) => id)
  if (unrecorded.length > 0) {
    throw new Error(
      `${mount.tier}: ${unrecorded.length} handler(s) serve a GATED operation and mint no ` +
        'authorisation record — ' +
        unrecorded.join(', ') +
        '. `CLAUDE.md` invariant 10: "an act with no authorisation is unrecordable." G301 ' +
        'makes minting a PRECONDITION OF MOUNTING, so that the invariant cannot erode one ' +
        'slice at a time: wrap the handler in `authorisedHandler()`, which mints the grant ' +
        'through `authorize()` and writes it inside the same scoped transaction as the act. ' +
        'A handler that reads a tenant row and leaves no trace is not a smaller version of ' +
        'this — it is the thing the invariant forbids.',
    )
  }

  /**
   * 🛑 THE SEVENTH FENCE — D6-8, THE OWNER'S RULING OF 29–30 Sep 2026: AN
   * OPERATION THAT ASKS FOR NO CREDENTIAL AND FACES A PERSON IS NOT MOUNTED
   * UNLESS ITS HANDLER IS MARKED `servedPublicly()` — THE PLANE DOES NOT BOOT.
   *
   * D6 measured the gap this closes rather than reasoning it: *"The fence fires
   * on the two operations that require a session and is silent on the two that
   * anyone on the internet can reach."* `callerOf([])` is `'none'` and
   * `callerMayBeAPerson('none')` is `false`, so the fourth fence's filter drops
   * exactly the population it most needs to see.
   *
   * ⚠️ **APPENDED, NOT INSERTED, AND THE FOURTH IS NOT WIDENED.** Both were
   * refused by name: widening `callerMayBeAPerson()` changes what seven tiers
   * compel at once and makes `checkLocalHealth` a boot failure, and
   * renumbering breaks the five files that cite the fences by ordinal (G914).
   *
   * 🟢 **HOW IT TELLS `checkLocalHealth` FROM `resolveHomeRealm`, WHICH THE
   * SECURITY SCHEME CANNOT:** both are `caller: 'none'`. The difference is who
   * the operation is FOR, and that is `PUBLIC_OPERATION_AUDIENCE` — a census
   * that compels a mark and grants nothing, argued at its declaration in
   * `server/contract/capability.ts`. `dataPlaneLocal` is `infrastructure`
   * (ALBs and scrapers inside the customer's VPC, never published by the edge);
   * every other tier is `person`, so the fence fails closed on anything new.
   *
   * 🛑 **AND WHAT THE MARK BUYS IS THE SAME TRADE AS THE OTHER TWO — EXPLICIT,
   * GREPPABLE, COUNTED — AND NOT A CONTROL ON WHAT THE ROUTE DOES.** D6's
   * questions about a public operation (rate, enumeration, disclosure) are not
   * answered by a mark; they are made impossible to arrive at without one.
   */
  const unacknowledgedPublic = Object.entries(mount.handlers)
    .map(([id, entry]) => ({ spec: declared.get(id) as RouteSpec, entry }))
    .filter(({ spec }) => publicOperationFacesAPerson(mount.tier, spec.caller))
    .filter(({ entry }) => !isPublic(entry))
    .map(({ spec }) => spec.operationId)
  if (unacknowledgedPublic.length > 0) {
    throw new Error(
      `${mount.tier}: ${unacknowledgedPublic.length} handler(s) serve an operation that asks ` +
        'for NO CREDENTIAL OF ANY KIND on a tier whose public operations face a PERSON — ' +
        unacknowledgedPublic.join(', ') +
        '. Anybody on the internet reaches this route, before there is a person to ' +
        'authenticate, and no other fence can see it: `callerOf([])` is `none`, so the fourth ' +
        "fence's filter drops it. D6-8 (the owner's): a public mount must acknowledge itself " +
        'at boot — wrap the handler in `servedPublicly()` and argue it at the call site.',
    )
  }

  /**
   * 🛑 THE SEVENTH FENCE'S SECOND HALF: A PUBLIC MARK THAT CONTRADICTS THE
   * DOCUMENT DOES NOT BOOT — the fourth fence's second half, one question over.
   * The mark acknowledges what the contract says; on an operation that requires
   * a credential, or one whose tier faces infrastructure, it is an author who
   * believed the opposite of the document.
   */
  const contradictedPublic = Object.entries(mount.handlers)
    .filter(([, entry]) => isPublic(entry))
    .map(([id]) => declared.get(id) as RouteSpec)
    .filter((spec) => !publicOperationFacesAPerson(mount.tier, spec.caller))
  if (contradictedPublic.length > 0) {
    throw new Error(
      `${mount.tier}: ${contradictedPublic.length} handler(s) are marked \`servedPublicly()\` ` +
        'and name an operation the document does not declare as public and person-facing — ' +
        contradictedPublic.map((s) => `${s.operationId} (caller: ${s.caller})`).join(', ') +
        '. That mark acknowledges a route served to anybody; it cannot make one, and it does ' +
        'not remove a security requirement.',
    )
  }

  /**
   * 🛑 THE EIGHTH FENCE — G3961, 4 Oct 2026: A HANDLER THAT MINTS INVARIANT
   * 10's RECORD MUST BE MOUNTED ON A GATED OPERATION WHOSE CONTRACT VERB IT CAN
   * MINT — THE PLANE DOES NOT BOOT.
   *
   * ⚠️ **APPENDED, NOT INSERTED**, on G2241's precedent: five files cite the
   * fences by ordinal and renumbering would move every one of them.
   *
   * WHY IT EXISTS: `authorisedHandler()` no longer carries its own capability.
   * It mints against `gatedCapabilityOf(request)` — the value the contract
   * gates the route on — which deletes the second spelling that used to drift
   * (every request failing closed with a 403 the gate had already passed).
   * Two conditions are then left that only the mount can see:
   *
   *   (a) a RECORDING handler on an operation the document does NOT gate has
   *       no verb to mint against at all — the sixth fence's converse, and an
   *       author who believed the opposite of the document;
   *   (b) a gated operation whose `x-capability` is not a verb the record's
   *       closed set contains — a contract typo, or a verb the model has not
   *       minted — which `authorize()` could only ever refuse.
   *
   * Both are refused here, with the operation and BOTH values named, rather
   * than discovered as a 500 or a 403 on the first request.
   */
  const unmintable = Object.entries(mount.handlers)
    .filter(([, entry]) => isRecording(entry))
    .map(([id, entry]) => ({ spec: declared.get(id) as RouteSpec, entry: entry as RecordingHandler }))
    .filter(
      ({ spec, entry }) =>
        gateVerdictOf(spec.capability) !== 'gated' ||
        spec.capability.kind !== 'capability' ||
        (entry.mints !== undefined && !entry.mints(spec.capability.capability)),
    )
    .map(({ spec }) =>
      spec.capability.kind === 'capability' && gateVerdictOf(spec.capability) === 'gated'
        ? `${spec.operationId} (contract \`${ANNOTATION_KEY}: ${spec.capability.capability}\`; ` +
          'the record\'s closed set has no such verb)'
        : `${spec.operationId} (contract \`${ANNOTATION_KEY}\` is ${spec.capability.kind}; ` +
          'the handler mints a record and has no verb to mint it against)',
    )
  if (unmintable.length > 0) {
    throw new Error(
      `${mount.tier}: ${unmintable.length} handler(s) mint an authorisation record the contract ` +
        'gives them no mintable verb for — ' +
        unmintable.join(', ') +
        '. The record mints against the capability the CONTRACT gates the route on, and nothing ' +
        'else (G3961). Fix the annotation in the contract, or mount a handler that does not ' +
        'record.',
    )
  }

  for (const [operationId, entry] of Object.entries(mount.handlers)) {
    const spec = declared.get(operationId) as RouteSpec
    const handler = handlerOf(entry)
    app.route({
      method: spec.method,
      url: spec.url,
      schema: spec.schema,
      /**
       * ⚠️ THE CAPABILITY IS PUT ON THE ROUTE ONLY WHEN THE OPERATION NAMES ONE
       * — see `routeConfig()`. Spreading an `undefined` in would be the same
       * thing to Fastify and NOT the same thing to a reader, and this repository
       * has the `exactOptionalPropertyTypes` habit for that reason.
       */
      config: {
        secured: spec.secured,
        /**
         * 🛑 READ BY THE `onRequest` HOOK AND BY NOTHING ELSE — G3231. Derived
         * from the SAME `RouteSpec` as `secured`, so it is the contract's
         * answer and not a list in code: a new non-safe person-facing mount is
         * covered the moment it is declared.
         */
        refusesCrossOrigin: refusesCrossOrigin(spec),
        /**
         * ⚠️ READ BY `serializeRequest()` AND BY NOTHING ELSE — it is what
         * REPLACES `req.url` on a log line. The contract's own name for the
         * operation carries no value of any kind, where a URL carries a query
         * string (§12.1 forbids one by name) and path-segment ids.
         */
        operationId: spec.operationId,
        ...(gateVerdictOf(spec.capability) === 'gated' && spec.capability.kind === 'capability'
          ? { capability: spec.capability.capability }
          : {}),
      },
      handler,
    })
  }
}

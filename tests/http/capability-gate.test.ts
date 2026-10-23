/**
 * G200's REQUEST-TIME GATE — THE ORDER, THE REFUSAL SHAPE, AND THE FOUR WAYS IT
 * IS NOT ALLOWED TO BOOT.
 *
 * ⚠️ THIS FILE NEVER SKIPS, AND THAT IS THE POINT OF IT. Every other suite under
 * `tests/http/` stands down without a PostgreSQL, so on a machine with no
 * database the served path is asserted by nothing. This one opens no port,
 * touches no pool and reads no environment: it builds a plane with
 * `buildPlane()` over the REAL capability document, mounts the REAL `listRuns`
 * route with a stub handler, and drives it through `app.inject()`. A property
 * that can be checked without infrastructure should be checked without
 * infrastructure — `tests/http/plane-separation.test.ts` makes the same argument
 * for the same reason.
 *
 * ┌─ R10 IS THE LOAD-BEARING ONE AND IT IS THE ONLY ONE THAT CAN TELL ─────────┐
 * │ The gate runs in `preValidation`: after authentication, before ajv. Nothing │
 * │ about a REFUSAL alone witnesses that. A gate registered in `preHandler` —   │
 * │ behind the validator — refuses exactly the same requests with exactly the   │
 * │ same code, and differs in ONE observable: what happens to a request that is │
 * │ both unentitled AND malformed.                                             │
 * │                                                                            │
 * │   ?tenantId=ten_globex  +  a principal the authoriser ALLOWS  → 400         │
 * │   ?tenantId=ten_globex  +  a principal the authoriser REFUSES → 403         │
 * │                                                                            │
 * │ IF BOTH ARMS ARE 400 THE GATE IS BEHIND THE VALIDATOR, and an authenticated │
 * │ caller who holds nothing has just been told which query keys are legal —    │
 * │ `server/http/app.ts` decision 2: "a validator that answers before an        │
 * │ authenticator is a schema oracle." Decision 4 extends it: an authenticated  │
 * │ caller holding no capability is exactly as unentitled to learn the request  │
 * │ shape as an anonymous one.                                                 │
 * │                                                                            │
 * │ `?tenantId=` is chosen rather than any other bad key because it is the one  │
 * │ the record names: `additionalProperties: false` on the query string is      │
 * │ invariant 1's second line of defence, so the ALLOW arm's 400 is also a      │
 * │ standing check that AJV still rejects rather than strips.                   │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE FOUR BOOT CONTROLS MUTATE THE PARSED DOCUMENT, AND THE RESTORE IS NOT
 * OPTIONAL. `loadTier()` caches one parsed object per process, so a mutation
 * left behind would corrupt every later test in this file —
 * `tests/contracts/request-body-schema.test.ts` states the hazard and avoids it
 * with a deep clone, which works there because it only needs `routesOf()`.
 * Here the claim is about BOOTING, and `mountTier()` calls `loadTier()` itself,
 * so there is no clone to hand it: the cached node is mutated and restored in a
 * `finally`. `node --test` runs each test FILE in its own process, so the blast
 * radius is this file; the `finally` makes it one test.
 *
 * ⚠️ EVERY ONE OF THE SEVEN CONTROLS BELOW WAS WITNESSED RED BEFORE IT WAS
 * WRITTEN GREEN — the condition CLAUDE.md puts on any control added here. What
 * each looked like when the mechanism was absent is recorded on the control
 * itself.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import type { FastifyInstance, FastifyRequest } from 'fastify'

import { loadTier, type JsonValue } from '../../server/contract/document.ts'
import { ANNOTATION_KEY } from '../../server/contract/capability.ts'
import {
  buildPlane,
  recordsAuthorisation,
  type CapabilityAuthoriser,
  type MountedHandler,
} from '../../server/http/app.ts'
import { denyAllCapabilities } from '../../server/data-plane/authorise.ts'

/**
 * The plane's principal for this file. Shape-compatible with `TenantSession`.
 *
 * ⚠️ IT GAINED TWO FIELDS ON 19 Sep 2026 AND THE REASON IS NOT COSMETIC.
 * `TenantSession` became `{ tenantId: string | null; sessionRef: string | null;
 * row: Session | null }` when a real session row reached the serving path, and
 * `denyAllCapabilities` — which one assertion below drives through the door it
 * actually comes through — is typed for THAT. A `Caller` that stayed at one
 * field would have made that assertion uncompilable, and the tempting repair
 * (cast it) would have kept the file green against a production authoriser it
 * was no longer handing a production-shaped principal.
 *
 * ⚠️ `tenantId` STAYS NON-NULL HERE, deliberately: every request in this file
 * is about a caller that HAS a tenant, so a nullable one would add a branch to
 * every fixture and would let a `not_held` come back for the wrong reason.
 *
 * 🛑 AND IT GAINED A THIRD FIELD ON 19 Sep 2026 — G299 — FOR THE SAME REASON,
 * STATED AGAIN BECAUSE THE TEMPTING REPAIR IS THE SAME ONE. `TenantSession`
 * now carries `principal: ResolvedPrincipal | null`, which is everything
 * `decide()` is evaluated against, and `denyAllCapabilities` is typed for THAT.
 * `principal: null` here is not a shortcut: it is the value a caller with no
 * resolvable subject really has, and it is the value the assertion below turns
 * on — *"`held: null` REFUSES … `null` means there is no reader at all."*
 */
interface Caller {
  readonly tenantId: string
  readonly sessionRef: string | null
  readonly row: null
  readonly principal: null
}

const HEADER = 'x-session'

/**
 * A plane with the real capability tier and the real local tier mounted, and an
 * authoriser supplied by the caller.
 *
 * ⚠️ THE HANDLERS ARE STUBS AND THE ROUTES ARE NOT. `mountTier()` takes the
 * method, the URL, the schema, the `secured` flag and the capability from the
 * DOCUMENT; only the function that runs last is fake. So a 200 here means the
 * request satisfied the contract's own querystring schema and passed both hooks
 * — which is the whole claim — and a 400 means it did not.
 *
 * 🛑 A HANDLER THAT ANSWERED 200 FOR EVERY PATH WOULD MAKE THIS FILE MEANINGLESS
 * and is what `tests/http/harness.ts` forbids in its own header: "WHAT THIS FILE
 * MUST NEVER GROW: a fake server." What keeps this honest is that no assertion
 * below reads a handler's OUTPUT. Every one reads a STATUS CODE that the two
 * hooks and ajv produced before any handler ran, and the 200 arm exists only to
 * prove the refusals are not the route being broken.
 */
async function plane(opts: {
  authorise: CapabilityAuthoriser<Caller>
  /** A session is present iff the header is; `null` means this plane sees none. */
  handlers?: Readonly<Record<string, MountedHandler>>
}): Promise<FastifyInstance> {
  /**
   * 🛑 WRAPPED IN `recordsAuthorisation()`, AND THE WRAPPER IS NOT COSMETIC:
   * WITHOUT IT THIS PLANE DOES NOT BOOT. G301, 19 Sep 2026 — `mountTier()`'s
   * SIXTH FENCE refuses a gated operation whose entry is a bare function, and
   * `listRuns` carries a real `x-capability`. R11 below is that fence seen RED,
   * which is why this line is a statement about the fence rather than a way
   * around it.
   *
   * ⚠️ WHAT THE WRAP DOES **NOT** DO, SAID PLAINLY SO THIS FILE IS NOT READ AS
   * PROOF OF A RECORD: it marks a handler and writes nothing. The MARK is what
   * the fence checks; the WRITE is `server/data-plane/authorisation-record.ts`,
   * which is the only caller of this function under `server/` — a property
   * `tests/http/authorisation-record.test.ts` §3 counts. A stub that minted
   * nothing and claimed to would be §5.6, so this comment is the disclosure and
   * that file is the control.
   */
  const stub = recordsAuthorisation(async () => ({ runs: [], nextCursor: null }))
  return buildPlane<Caller>(
    {
      plane: 'test-data-plane',
      authenticate: (request: FastifyRequest) => {
        const raw = request.headers[HEADER]
        return typeof raw === 'string' && raw !== ''
          ? { tenantId: raw, sessionRef: null, row: null, principal: null }
          : null
      },
      unauthenticatedDetail: 'no session',
      authorise: opts.authorise,
      unauthorisedDetail: 'no capability',
    },
    [
      { tier: 'capability', handlers: opts.handlers ?? { listRuns: stub } },
      { tier: 'dataPlaneLocal', handlers: { checkLocalHealth: async () => ({ status: 'ok' }) } },
    ],
  )
}

const allows: CapabilityAuthoriser<Caller> = () => 'held'
const refuses: CapabilityAuthoriser<Caller> = () => 'not_held'

function codeOf(payload: string): unknown {
  try {
    const parsed: unknown = JSON.parse(payload)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>)['code'] : undefined
  } catch {
    return undefined
  }
}

/* ------------------------------------------------------------------ *
 * The document, mutated and put back.
 * ------------------------------------------------------------------ */

/** The `getRun` operation node of the CACHED capability document. */
function getRunOperation(): { [k: string]: JsonValue } {
  const paths = loadTier('capability')['paths'] as { [k: string]: JsonValue }
  const item = paths['/runs/{runId}'] as { [k: string]: JsonValue }
  const op = item['get'] as { [k: string]: JsonValue }
  assert.equal(
    op['operationId'],
    'getRun',
    'the capability tier no longer declares `getRun` at `GET /runs/{runId}`, so the four boot ' +
      'controls below are mutating an operation that is not the one they name.',
  )
  return op
}

/**
 * Run `body` with `getRun`'s annotation replaced, and put the original back
 * whatever happens. `undefined` DELETES the key, which is R6.
 */
async function withAnnotation(value: string | undefined, body: () => Promise<void>): Promise<void> {
  const op = getRunOperation()
  const original = op[ANNOTATION_KEY]
  assert.ok(
    typeof original === 'string' && original.length > 0,
    '`getRun` carries no `x-capability` to begin with, so restoring it below would restore ' +
      'nothing and the mutation would leak into every later test in this file.',
  )
  if (value === undefined) delete op[ANNOTATION_KEY]
  else op[ANNOTATION_KEY] = value
  try {
    await body()
  } finally {
    op[ANNOTATION_KEY] = original
  }
}

/** The boot attempt, as a result rather than a throw, so a message can be read. */
async function bootWith(handlers: Readonly<Record<string, MountedHandler>>): Promise<Error | null> {
  try {
    const app = await plane({ authorise: allows, handlers })
    await app.close()
    return null
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err))
  }
}

describe('G200 · the gate refuses before the validator answers', () => {
  /* ================================================================ *
   * R10 · THE ORDERING PAIR. The only control here that can tell a
   *       `preValidation` gate from a `preHandler` one.
   * ================================================================ */

  it('R10 · the same malformed request is 400 when the verb is held and 403 when it is not', async () => {
    const path = '/v1/runs?tenantId=ten_globex'

    const permitting = await plane({ authorise: allows })
    const held = await permitting.inject({ method: 'GET', url: path, headers: { [HEADER]: 'ten_acme' } })
    await permitting.close()

    const refusing = await plane({ authorise: refuses })
    const notHeld = await refusing.inject({ method: 'GET', url: path, headers: { [HEADER]: 'ten_acme' } })
    await refusing.close()

    /* THE ALLOW ARM. Also invariant 1's second line of defence, standing:
     * `additionalProperties: false` on the query string with
     * `removeAdditional: false` in the plane's ajv options means `?tenantId=` is
     * REFUSED rather than silently deleted and served. */
    assert.equal(
      held.statusCode,
      400,
      'a caller whose authoriser HOLDS the verb sent `?tenantId=`, which the capability ' +
        "document's querystring schema forbids, and did not get 400. Either the gate is " +
        'refusing a caller it should not, or ajv has stopped rejecting an additional property — ' +
        `and the second would be invariant 1 failing silently. Got ${held.statusCode}: ${held.payload}`,
    )
    assert.equal(codeOf(held.payload), 'validation_failed')

    /* THE REFUSE ARM, AND THE WHOLE POINT OF THE PAIR. */
    assert.equal(
      notHeld.statusCode,
      403,
      'THE GATE IS BEHIND THE VALIDATOR. The identical request, from a caller whose authoriser ' +
        'REFUSES the verb, came back ' +
        `${notHeld.statusCode} rather than 403 — so an authenticated caller holding no ` +
        'capability has just been told which query keys are legal. `server/http/app.ts` ' +
        'decision 4: `preValidation` is the unique phase after authentication and before ajv; ' +
        'a gate in `preHandler` produces exactly this. ' +
        `Got: ${notHeld.payload}`,
    )
    assert.equal(
      codeOf(notHeld.payload),
      'capability_not_held',
      'the refusal did not carry `capability_not_held`. It must not be `policy_denied`: that ' +
        'code means F3 refused an ACT the caller was entitled to attempt, and collapsing the ' +
        'two destroys the only diagnostic distinction that survives redaction. `errors.yaml` ' +
        'carries the argument.',
    )
    // `String(...)` and a prefix match: Fastify appends `; charset=utf-8`, and
    // an equality against the bare media type would be a control that fails
    // while the property holds.
    assert.match(
      String(notHeld.headers['content-type']),
      /^application\/problem\+json\b/,
      'the refusal is not RFC 9457-shaped. `errors.yaml` argues that the `Problem` envelope is ' +
        'what survives redaction, so a refusal in any other shape is undiagnosable exactly ' +
        'where it matters.',
    )
  })

  /* ================================================================ *
   * R9 · the gate did not move INTO `onRequest`.
   * ================================================================ */

  it('R9 · an unauthenticated caller is still 401, never 403', async () => {
    const app = await plane({ authorise: refuses })
    const anonymous = await app.inject({ method: 'GET', url: '/v1/runs' })
    const anonymousAndMalformed = await app.inject({ method: 'GET', url: '/v1/runs?tenantId=ten_globex' })
    await app.close()

    for (const [label, res] of [
      ['a well-formed request', anonymous],
      ['a malformed one', anonymousAndMalformed],
    ] as const) {
      assert.equal(
        res.statusCode,
        401,
        `${label} with no session came back ${res.statusCode}. It must be 401: authentication ` +
          'runs in `onRequest` and answers first, so a caller with no session learns neither ' +
          'the request shape NOR which verb the operation wants. A 403 here would mean the ' +
          `gate had been folded into the authentication hook. Got: ${res.payload}`,
      )
      assert.equal(codeOf(res.payload), 'session_invalid')
    }
  })

  /* ================================================================ *
   * R8 / A2 · an exempt, unsecured route is untouched by the gate.
   * ================================================================ */

  it('R8 · GET /health answers 200 with no session, and the gate never asks for a principal', async () => {
    const app = await plane({ authorise: refuses })
    const res = await app.inject({ method: 'GET', url: '/health' })
    await app.close()

    assert.equal(
      res.statusCode,
      200,
      '`checkLocalHealth` is annotated `exempt:` and its tier declares no security scheme at ' +
        'all, so the gate must return before it can reach for a principal. A 500 here is the ' +
        'gate calling for one on a route that was never given one — the failure mode ' +
        "`principalOf()`'s own error message describes. A 403 is the gate refusing a liveness " +
        `probe. Got ${res.statusCode}: ${res.payload}`,
    )
  })

  /* ================================================================ *
   * R6 · an operation with no annotation does not boot.
   * ================================================================ */

  it('R6 · deleting x-capability from getRun stops the plane booting', async () => {
    await withAnnotation(undefined, async () => {
      const err = await bootWith({ getRun: async () => ({}) })
      assert.ok(
        err !== null,
        'THE PLANE BOOTED WITH AN UNANNOTATED OPERATION MOUNTED. `getRun` reads a customer\'s ' +
          'reconciliation row; with no `x-capability` there is no verb to ask about, so it ' +
          'would have been served ungated. G200: "no further operation is mounted until ' +
          'authorisation exists." The third fence in `mountTier()` is what must refuse this.',
      )
      assert.match(
        err.message,
        /x-capability/,
        `the plane refused to boot, but not over the annotation: ${err.message}`,
      )
      assert.match(err.message, /getRun/, 'the refusal does not name the operation at fault')
    })
  })

  /* ================================================================ *
   * R7 · and prose does not open it.
   * ================================================================ */

  it('R7 · annotating getRun `exempt:` with a plausible reason stops the plane booting', async () => {
    // Twenty-five characters, so `MIN_REASON_CHARS` is satisfied and the ONLY
    // thing that can refuse it is the tier. That is the loophole assertion 1e
    // found by mutation: a reason long enough to look considered.
    const prose = 'exempt: the caller here is the engine itself'
    await withAnnotation(prose, async () => {
      const err = await bootWith({ getRun: async () => ({}) })
      assert.ok(
        err !== null,
        'THE PLANE BOOTED WITH A CAPABILITY-TIER OPERATION EXCUSED BY PROSE, which is a gate ' +
          'that can be opened by writing a sentence. The capability tier\'s defining property ' +
          'is that every operation on it has a HUMAN PRINCIPAL (⚠️ this cited ' +
          '`TIER_REQUIRES_CAPABILITY.capability === true` until G911 retired that table on ' +
          '20 Sep 2026; the fourth fence reads `spec.caller` now, and `sessionContext` is a ' +
          'person, so THIS ASSERTION IS UNCHANGED IN FORCE and is answered by a wider fence) — ' +
          'so no reason written there is anything but an argument for moving the operation to ' +
          'another tier. `mountTier()`\'s fourth fence must refuse it.',
      )
      assert.match(err.message, /exempt|reason/i, `refused, but not over the exemption: ${err.message}`)
      assert.match(err.message, /getRun/, 'the refusal does not name the operation at fault')
    })
  })

  /* ================================================================ *
   * R6b · a malformed annotation is not an absent one, and both refuse.
   * ================================================================ */

  it('R6b · a non-string x-capability stops the plane booting', async () => {
    const op = getRunOperation()
    const original = op[ANNOTATION_KEY]
    op[ANNOTATION_KEY] = 12
    try {
      const err = await bootWith({ getRun: async () => ({}) })
      assert.ok(
        err !== null,
        'a numeric `x-capability` booted. `classifyAnnotation()` reports it `malformed` rather ' +
          'than `capability`, and a malformed annotation names no verb — so serving it is ' +
          'serving an ungated operation with a decoration on it.',
      )
      assert.match(err.message, /getRun/, 'the refusal does not name the operation at fault')
    } finally {
      op[ANNOTATION_KEY] = original as JsonValue
    }
  })

  /* ================================================================ *
   * R6c · gated AND unsecured does not boot either.
   *
   * ⚠️ THE FIFTH FENCE WAS NOT ASKED FOR AND IS WITNESSED ANYWAY,
   * because a fence nothing exercises is a control that exists and
   * asserts nothing — §5.6, which is the whole reason the four above
   * were each seen RED first. It fires on nothing in the tree: the
   * capability tier declares `security` once, at document level, and no
   * operation overrides it (`grep -c '^\s\+security:'
   * docs/contracts/capability.openapi.yaml` → 0). So the only way to see
   * it is to write the override.
   * ================================================================ */

  it('R6c · an operation that is gated and declares `security: []` stops the plane booting', async () => {
    const op = getRunOperation()
    op['security'] = []
    try {
      const err = await bootWith({ getRun: async () => ({}) })
      assert.ok(
        err !== null,
        'a GATED, UNSECURED operation booted. `security: []` is OpenAPI for "this one is ' +
          'public" and overrides the document-level requirement, so there is no caller for a ' +
          'capability to be a question about — and every request to the route would reach the ' +
          "gate, find no principal and 500. Refusing at registration turns a route that fails " +
          'every time into a plane that fails once, with the operation named.',
      )
      assert.match(err.message, /getRun/, 'the refusal does not name the operation at fault')
    } finally {
      delete op['security']
    }
  })

  /* ================================================================ *
   * R11 · THE SIXTH FENCE — G301's MOUNTING PRECONDITION, SEEN RED.
   *
   * 🛑 THIS IS THE CONTROL THAT MAKES G301 A PROPERTY RATHER THAN A
   * PROMISE. The ruling's load-bearing half is *"AN OPERATION MAY NOT
   * MOUNT UNTIL IT MINTS A RECORD"*, and G200's own row records why
   * that had to become mechanical: *"there is no mechanical form of 'no
   * further operation is mounted'."* A freeze has nothing to key on. A
   * PRECONDITION does — the handler is right there at the mount — and
   * this is the assertion that it is keyed on it.
   *
   * ⚠️ IT USES THE UNMUTATED DOCUMENT, unlike R6/R6b/R6c/R7. Nothing
   * about `getRun`'s annotation is touched: it is a real gated
   * operation with a real capability, and the ONLY thing wrong is that
   * the handler mints nothing. If this ever goes green, every
   * capability-tier operation in the tree can be served without a trace
   * that it happened.
   * ================================================================ */

  it('R11 · a gated operation whose handler mints no authorisation record does not boot', async () => {
    const err = await bootWith({ getRun: async () => ({}) })
    assert.ok(
      err !== null,
      'THE PLANE BOOTED WITH A GATED OPERATION THAT RECORDS NOTHING. `getRun` reads a ' +
        "customer's reconciliation row; `CLAUDE.md` invariant 10 is that \"an act with no " +
        'authorisation is unrecordable\", and G301 makes minting a PRECONDITION OF MOUNTING ' +
        'so the invariant cannot erode one slice at a time. The sixth fence in `mountTier()` ' +
        'is what must refuse this.',
    )
    assert.match(
      err.message,
      /authorisation record/i,
      `the plane refused to boot, but not over the record: ${err.message}`,
    )
    assert.match(err.message, /getRun/, 'the refusal does not name the operation at fault')
  })

  it('R11b · the SAME handler boots once it is marked, so R11 is about the mark and not the route', async () => {
    /* The negative control's negative control. Without this, R11 would pass
     * just as well against a `getRun` that could not be mounted for some
     * unrelated reason — a bad schema, a missing path — and would be asserting
     * nothing about G301. */
    const err = await bootWith({ getRun: recordsAuthorisation(async () => ({})) })
    assert.equal(
      err,
      null,
      `a marked handler for the same operation ALSO failed to boot, so R11 above is not ` +
        `measuring the mark: ${err === null ? '' : err.message}`,
    )
  })

  /* ================================================================ *
   * The production authoriser, by the door it actually comes through.
   * ================================================================ */

  it('the data plane\'s refusing authoriser refuses every verb', async () => {
    const app = await plane({ authorise: denyAllCapabilities })
    const res = await app.inject({ method: 'GET', url: '/v1/runs', headers: { [HEADER]: 'ten_acme' } })
    await app.close()

    assert.equal(
      res.statusCode,
      403,
      '`denyAllCapabilities` must refuse. ⚠️ THIS MESSAGE SAID IT WAS "what ' +
        '`listenDataPlane()` takes and cannot be given anything else", AND THAT WENT ' +
        'FALSE ON 19 Sep 2026 UNDER G299: `db/migrations/0009_identity_substrate.sql` ' +
        'landed the four tables this message said did not exist, and the default is now ' +
        '`sessionCapabilities`. What is UNCHANGED is the shape being asserted — this ' +
        'authoriser is handed `NO_IDENTITY_SUBSTRATE`, whose every term is `null`, and ' +
        '`null` is "there is no reader", which refuses before `decide()`. It is the ' +
        'REFUSING half of the matched pair `startDataPlane()` exists to make ' +
        `witnessable. Got ${res.statusCode}: ${res.payload}`,
    )
    assert.equal(codeOf(res.payload), 'capability_not_held')
  })

  /* ================================================================ *
   * ⚠️ WHAT THIS FILE DOES NOT ASSERT, NAMED SO THE SILENCE IS NOT READ
   *    AS COVERAGE.
   *
   * Nothing here proves an act was RECORDED, because nothing records
   * one. Invariant 10 is deferred by ruling — the record is minted
   * against a `ResourceRef` and a `preValidation` hook has none — and
   * `tests/http/authorisation-record.test.ts` is the tripwire that stays
   * green until it is built. THE GATE ALLOWS AND RECORDS NOTHING. Do not
   * read a 403 in this file as evidence that a 200 left a trace.
   * ================================================================ */
})

/**
 * INVARIANT 1's SECOND LINE OF DEFENCE, ON THE OPERATIONS THAT NEVER HAD IT.
 *
 * "Tenant scope is derived from the session, never read from a request."
 * Copied from `CLAUDE.md`'s numbered list, never paraphrased.
 *
 * ┌─ THE HOLE THIS FILE WAS WRITTEN AGAINST ──────────────────────────────────┐
 * │ `server/contract/routes.ts`'s `schemaFromParameters()` built a query       │
 * │ schema out of an operation's DECLARED query parameters and returned        │
 * │ `undefined` when there were none — so `additionalProperties: false`, the   │
 * │ keyword that makes ajv REJECT under `removeAdditional: false`, rode on a   │
 * │ schema that was never built for a parameter-free operation. Fastify        │
 * │ registers such a route with NO querystring schema at all, and              │
 * │ `?tenantId=ten_globex` against it is parsed, handed to the handler and     │
 * │ IGNORED.                                                                   │
 * │                                                                            │
 * │ Invariant 1 was never breached by that — nothing reads the key — and that  │
 * │ is exactly why it survived three mounting waves. `server/http/app.ts`      │
 * │ states the cost in its own voice: *"ignored and read look identical from   │
 * │ outside and only one of them is the property"*, and rejecting *"makes the  │
 * │ attempt visible in a status code, a log line and a metric."* Until this    │
 * │ slice, `listRunResidue` answered 400 and `getRunAccount` answered as       │
 * │ though nothing had been asked — one invariant, two behaviours, decided by  │
 * │ whether an operation happened to page.                                     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * `docs/HANDOFF.md` §8 carried it as a RULING OWED from 19 Sep 2026, with a
 * condition on whoever took it: *"Whoever takes it owes a red first: a
 * parameter-free operation must be witnessed accepting a query string before
 * the change, and refusing one after."* **G941–G945, 20 Sep 2026.**
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛑 THE RED, CAPTURED BEFORE `server/contract/routes.ts` WAS TOUCHED.
 *
 * This file was written first, run against `56d9d053` with the one-line change
 * ABSENT, and produced the output below verbatim. A control added without a
 * demonstrated red is `docs/HANDOFF.md` §5.6 — a validator that passes while
 * asserting nothing — and this repository refuses one.
 *
 *     ▶ parameter-free operations refuse an undeclared query key
 *       ✖ 1a · an UNSECURED parameter-free operation refuses `?tenantId=` (551.235ms)
 *       ✔ 1b · the same operation with NO query string is served (39.473792ms)
 *       ✖ 1c · the refusal is `validation_failed` and carries no field value (13.084875ms)
 *       ✖ 2a · a GATED parameter-free operation refuses `?tenantId=` behind an ALLOWING authoriser (38.294ms)
 *       ✔ 2b · the SAME request behind a REFUSING authoriser is 403, not 400 (30.289542ms)
 *       ✔ 2c · the same operation with NO query string is served (8.422625ms)
 *       ✖ 3a · an operation with ONLY a path parameter refuses `?tenantId=` (29.793583ms)
 *       ✔ 3b · the same path with NO query string is served (21.685292ms)
 *       ✖ 4a · EVERY declared operation, on every tier, carries a querystring schema (157.347208ms)
 *       ✖ 4b · a parameter-free operation's querystring schema is EXACTLY the closed empty object (2.064125ms)
 *       ✖ 4c · the emptiness is DERIVED: give the operation a query parameter and the schema follows (4.379375ms)
 *       ✔ 5a · `params` and `headers` are UNTOUCHED — no schema, and no `additionalProperties` (2.121958ms)
 *       ✔ 5b · a path-parameter-free operation still gets NO `params` schema (0.861292ms)
 *     ✖ parameter-free operations refuse an undeclared query key (899.911875ms)
 *     ℹ tests 13
 *     ℹ suites 1
 *     ℹ pass 6
 *     ℹ fail 7
 *     ℹ cancelled 0
 *     ℹ skipped 0
 *     ℹ todo 0
 *
 *     ✖ 1a · an UNSECURED parameter-free operation refuses `?tenantId=` (551.235ms)
 *       AssertionError [ERR_ASSERTION]: `GET /health?tenantId=ten_globex` WAS NOT
 *       REFUSED. `checkLocalHealth` declares no query parameter, so
 *       `schemaFromParameters()` returned `undefined` and the route carries no
 *       querystring schema at all — the key is parsed and ignored. Invariant 1:
 *       tenant scope is derived from the session, never read from a request.
 *         Got: 200 application/json; charset=utf-8 — {"status":"ok"}
 *       200 !== 400
 *
 *     ✖ 1c · the refusal is `validation_failed` and carries no field value
 *       + actual - expected
 *       + undefined
 *       - 'validation_failed'
 *
 *     ✖ 2a · a GATED parameter-free operation refuses `?tenantId=` behind an ALLOWING authoriser
 *       AssertionError [ERR_ASSERTION]: `GET /v1/intake/channels?tenantId=ten_globex`
 *       WAS NOT REFUSED behind an authoriser that holds the verb.
 *         Got: 200 application/json; charset=utf-8 — {"channels":[]}
 *       200 !== 400
 *
 *     ✖ 3a · an operation with ONLY a path parameter refuses `?tenantId=`
 *       AssertionError [ERR_ASSERTION]: `GET /v1/runs/run_acme_1?tenantId=ten_globex`
 *       WAS NOT REFUSED. A path parameter is not a query parameter, and `getRun`
 *       declares no second kind.
 *         Got: 200 application/json; charset=utf-8 —
 *         {"runId":"run_acme_1","definitionId":"def_stub","definitionVersion":1,
 *          "periodId":null,"trigger":{"kind":"manual"},"status":"completed",
 *          "startedAt":"2026-01-01T00:00:00.000Z","completeness":null}
 *       200 !== 400
 *
 *     ✖ 4a · EVERY declared operation, on every tier, carries a querystring schema
 *       AssertionError [ERR_ASSERTION]: 122 of 136 declared operations carry NO
 *       querystring schema, so an undeclared query key reaches each of them
 *       unrefused. First ten: listIntakeChannels, createUpload, completeUpload,
 *       getDocument, admitRun, getRun, rerunRun, getRunAccount, getException,
 *       assignException
 *       122 !== 0
 *
 *     ✖ 4b · a parameter-free operation's querystring schema is EXACTLY the closed empty object
 *     ✖ 4c · the emptiness is DERIVED: give the operation a query parameter and the schema follows
 *       + actual - expected
 *       + undefined
 *       - { additionalProperties: false, properties: {}, type: 'object' }
 *
 * 🛑 READ THE `4a` LINE RATHER THAN THE HEADLINE. **122 OF 136**, not a handful:
 * the operations that DID refuse an undeclared key were the fourteen that
 * happen to PAGE or FILTER. `listRunResidue` refused because it declares
 * `cursor` and `limit`; `getRunAccount` one path segment away did not. Invariant
 * 1's second line of defence was a property of whether an operation took a
 * `limit`.
 *
 * THE GREEN, after the change in `server/contract/routes.ts`:
 *
 *     ▶ parameter-free operations refuse an undeclared query key
 *       ✔ 1a · an UNSECURED parameter-free operation refuses `?tenantId=` (415.000708ms)
 *       ✔ 1b · the same operation with NO query string is served (87.784166ms)
 *       ✔ 1c · the refusal is `validation_failed` and carries no field value (42.962375ms)
 *       ✔ 2a · a GATED parameter-free operation refuses `?tenantId=` behind an ALLOWING authoriser (16.564541ms)
 *       ✔ 2b · the SAME request behind a REFUSING authoriser is 403, not 400 (53.325625ms)
 *       ✔ 2c · the same operation with NO query string is served (50.752292ms)
 *       ✔ 3a · an operation with ONLY a path parameter refuses `?tenantId=` (22.21825ms)
 *       ✔ 3b · the same path with NO query string is served (46.948333ms)
 *       ✔ 4a · EVERY declared operation, on every tier, carries a querystring schema (186.498417ms)
 *       ✔ 4b · a parameter-free operation's querystring schema is EXACTLY the closed empty object (1.677583ms)
 *       ✔ 4c · the emptiness is DERIVED: give the operation a query parameter and the schema follows (3.972709ms)
 *       ✔ 5a · `params` and `headers` are UNTOUCHED — no schema, and no `additionalProperties` (2.156917ms)
 *       ✔ 5b · a path-parameter-free operation still gets NO `params` schema (0.888625ms)
 *     ✔ parameter-free operations refuse an undeclared query key (932.190542ms)
 *     ℹ tests 13
 *     ℹ suites 1
 *     ℹ pass 13
 *     ℹ fail 0
 *     ℹ cancelled 0
 *     ℹ skipped 0
 *     ℹ todo 0
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ THIS FILE NEVER SKIPS AND OPENS NO PORT, which is the property
 * `tests/http/capability-gate.test.ts` argues for at length and this one
 * inherits: it builds a plane with `buildPlane()` over the REAL contract
 * documents, mounts REAL routes with stub handlers, and drives them through
 * `app.inject()`. On a machine with no PostgreSQL the whole of `tests/http/`
 * stands down except this file and that one.
 *
 * 🛑 WHAT A STUB HANDLER DOES AND DOES NOT BUY HERE, said plainly because
 * `tests/http/harness.ts` forbids growing a fake server: **no assertion below
 * reads a handler's OUTPUT.** Every one reads a STATUS CODE produced by the two
 * hooks and by ajv before any handler ran. The 200 arms exist only to prove that
 * the refusals are the query key being refused and not the route being broken.
 *
 * ⚠️ §2b IS THE ORDER ASSERTION AND IT IS NOT DECORATION. `?tenantId=` against a
 * gated parameter-free operation is now BOTH unentitled-and-malformed and
 * entitled-and-malformed, depending on the authoriser — the matched pair
 * `capability-gate.test.ts` R10 makes for `listRuns`, which previously could
 * not be made for any parameter-free operation because the malformed arm did
 * not exist. If both arms come back 400 the gate has moved behind the
 * validator and an authenticated caller who holds nothing has been handed a
 * schema oracle.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import type { FastifyInstance, FastifyRequest } from 'fastify'

import {
  TIERS,
  basePathOf,
  loadTier,
  type JsonValue,
  type OpenApiDocument,
  type TierName,
} from '../../server/contract/document.ts'
import { routesOf, type RouteSpec } from '../../server/contract/routes.ts'
import {
  buildPlane,
  recordsAuthorisation,
  type CapabilityAuthoriser,
} from '../../server/http/app.ts'

/**
 * Shape-compatible with `TenantSession`, for the same reason
 * `tests/http/capability-gate.test.ts` gives at length: the plane is generic
 * over its principal and nothing below reads any field of it. A narrower type
 * would be a cast waiting to happen.
 */
interface Caller {
  readonly tenantId: string
  readonly sessionRef: string | null
  readonly row: null
  readonly principal: null
}

const HEADER = 'x-session'
const TENANT = 'ten_acme'
/** The key invariant 1 names. Any undeclared key would do; this is the one the record is about. */
const FORBIDDEN = 'tenantId=ten_globex'

const allows: CapabilityAuthoriser<Caller> = () => 'held'
const refuses: CapabilityAuthoriser<Caller> = () => 'not_held'

/**
 * A plane carrying THREE parameter-free operations of three different shapes,
 * because the emission this file is about is a property of `routesOf()` and not
 * of any one tier:
 *
 *   `checkLocalHealth`     no security, no parameters of any kind at all
 *   `listIntakeChannels`   gated, secured, no parameters of any kind at all
 *   `getRun`               gated, secured, ONE PATH parameter and no query one
 *
 * ⚠️ THE TWO CAPABILITY-TIER ENTRIES ARE WRAPPED IN `recordsAuthorisation()`
 * AND THE WRAP IS NOT COSMETIC: `mountTier()`'s sixth fence (G301) refuses to
 * boot a gated operation whose entry is a bare function, so without it this
 * plane does not start. `checkLocalHealth` is bare and must stay bare — its
 * caller is `none` (no security scheme is declared at all), which is the
 * differential G914's fourth fence turns on.
 */
async function plane(authorise: CapabilityAuthoriser<Caller>): Promise<FastifyInstance> {
  return buildPlane<Caller>(
    {
      plane: 'test-parameter-free-plane',
      authenticate: (request: FastifyRequest) => {
        const raw = request.headers[HEADER]
        return typeof raw === 'string' && raw !== ''
          ? { tenantId: raw, sessionRef: null, row: null, principal: null }
          : null
      },
      unauthenticatedDetail: 'no session',
      authorise,
      unauthorisedDetail: 'no capability',
    },
    [
      {
        tier: 'capability',
        handlers: {
          listIntakeChannels: recordsAuthorisation(async () => ({ channels: [] })),
          /**
           * ⚠️ THE STUB'S BODY SATISFIES `Run`'s ELEVEN `required` KEYS (EIGHT UNTIL G3351 ADDED `definitionName`, NINE UNTIL G3429 ADDED THE PERIOD'S TWO DATES) AND
           * THAT IS NOT DECORATION. `fast-json-stringify` THROWS on a missing
           * `required` field at serialisation time — `Error: "runId" is
           * required!` — and the plane's error handler turns a throw into a
           * **500**, which would make §3a pass for the wrong reason and §3b
           * fail for a reason that has nothing to do with a query key. The
           * values are meaningless and nothing below reads one.
           */
          getRun: recordsAuthorisation(async () => ({
            runId: 'run_acme_1',
            definitionId: 'def_stub',
            definitionName: null,
            definitionVersion: 1,
            periodId: null,
            /* G3429 — required-and-nullable since `0430`. */
            periodStartsOn: null,
            periodEndsOn: null,
            trigger: { kind: 'manual' },
            status: 'completed',
            startedAt: '2026-01-01T00:00:00.000Z',
            completeness: null,
          })),
        },
      },
      { tier: 'dataPlaneLocal', handlers: { checkLocalHealth: async () => ({ status: 'ok' }) } },
    ],
  )
}

function codeOf(payload: string): unknown {
  try {
    const parsed: unknown = JSON.parse(payload)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)['code']
      : undefined
  } catch {
    return undefined
  }
}

function describe1(res: { statusCode: number; headers: Record<string, unknown>; payload: string }): string {
  const ct = typeof res.headers['content-type'] === 'string' ? res.headers['content-type'] : '(none)'
  const body = res.payload.length > 200 ? `${res.payload.slice(0, 200)}…` : res.payload
  return `${res.statusCode} ${ct} — ${body}`
}

const SESSION = { [HEADER]: TENANT }

/* ------------------------------------------------------------------ *
 * The derivation half: every tier, every operation, read through the
 * router the planes above are built from.
 * ------------------------------------------------------------------ */

const TIER_NAMES = Object.keys(TIERS) as readonly TierName[]

function specsOf(tier: TierName): readonly RouteSpec[] {
  const doc = loadTier(tier)
  return routesOf(doc, basePathOf(doc))
}

/**
 * Does this operation declare a query parameter? Answered from the DOCUMENT
 * rather than from the emitted schema, because the emitted schema is the thing
 * under test and reading it here would make §4b a tautology.
 */
function declaresAQueryParameter(doc: OpenApiDocument, tier: TierName, operationId: string): boolean {
  const paths = doc['paths'] as { [k: string]: JsonValue }
  for (const item of Object.values(paths)) {
    const pathItem = item as { [k: string]: JsonValue }
    const shared = Array.isArray(pathItem['parameters']) ? pathItem['parameters'] : []
    for (const [key, node] of Object.entries(pathItem)) {
      if (key === 'parameters') continue
      const op = node as { [k: string]: JsonValue }
      if (typeof op !== 'object' || op === null || Array.isArray(op)) continue
      if (op['operationId'] !== operationId) continue
      const own = Array.isArray(op['parameters']) ? op['parameters'] : []
      for (const p of [...shared, ...own]) {
        const resolved = resolveForTest(doc, p)
        if (resolved['in'] === 'query') return true
      }
      return false
    }
  }
  assert.fail(`\`${operationId}\` is not declared in the ${tier} tier`)
}

/**
 * `resolveParameter()` is module-private in `server/contract/routes.ts` and is
 * deliberately not exported for one test's convenience, so the pointer form is
 * resolved here. ⚠️ THIS IS A SECOND IMPLEMENTATION AND IT IS KEPT HONEST BY
 * BEING USED ONLY FOR THE `in` KEY — if it drifted, §4a would go red rather
 * than silently agreeing with itself.
 */
function resolveForTest(doc: OpenApiDocument, node: JsonValue): { [k: string]: JsonValue } {
  const asObject = node as { [k: string]: JsonValue }
  const ref = asObject['$ref']
  if (typeof ref !== 'string') return asObject
  const name = /^#\/components\/parameters\/([A-Za-z0-9_.-]+)$/.exec(ref)?.[1] ?? ''
  const components = doc['components'] as { [k: string]: JsonValue } | undefined
  const parameters = (components?.['parameters'] ?? {}) as { [k: string]: JsonValue }
  return (parameters[name] ?? {}) as { [k: string]: JsonValue }
}

/** A deep clone, so a mutation cannot reach `loadTier()`'s process-wide cache. */
function clone(doc: OpenApiDocument): OpenApiDocument {
  return JSON.parse(JSON.stringify(doc)) as OpenApiDocument
}

describe('parameter-free operations refuse an undeclared query key', () => {
  /* ================================================================ *
   * §1 · THE UNSECURED CASE — no session, no gate, nothing between the
   *      request and the schema.
   * ================================================================ */

  it('1a · an UNSECURED parameter-free operation refuses `?tenantId=`', async () => {
    const app = await plane(allows)
    try {
      const res = await app.inject({ method: 'GET', url: `/health?${FORBIDDEN}` })
      assert.equal(
        res.statusCode,
        400,
        '`GET /health?tenantId=ten_globex` WAS NOT REFUSED. `checkLocalHealth` declares no ' +
          'query parameter, so `schemaFromParameters()` returned `undefined` and the route ' +
          'carries no querystring schema at all — the key is parsed and ignored. Invariant 1: ' +
          'tenant scope is derived from the session, never read from a request.\n  Got: ' +
          describe1(res),
      )
    } finally {
      await app.close()
    }
  })

  it('1b · the same operation with NO query string is served', async () => {
    const app = await plane(allows)
    try {
      const res = await app.inject({ method: 'GET', url: '/health' })
      assert.equal(
        res.statusCode,
        200,
        'the clean request is not served either, so §1a is the route being broken rather than ' +
          `the query key being refused. Got: ${describe1(res)}`,
      )
    } finally {
      await app.close()
    }
  })

  it('1c · the refusal is `validation_failed` and carries no field value', async () => {
    const app = await plane(allows)
    try {
      const res = await app.inject({ method: 'GET', url: `/health?${FORBIDDEN}` })
      assert.equal(codeOf(res.payload), 'validation_failed')
      /**
       * `errors.yaml`: `detail` must carry no field VALUES. A refusal that
       * echoed `ten_globex` back would put an attacker-chosen string into
       * every log line that records the refusal — which is precisely the
       * surface `server/http/app.ts` keeps `detail` request-free for.
       */
      assert.ok(
        !res.payload.includes('ten_globex'),
        `the refusal echoes the rejected VALUE back to the caller: ${res.payload}`,
      )
    } finally {
      await app.close()
    }
  })

  /* ================================================================ *
   * §2 · THE GATED CASE, AND THE ORDER.
   * ================================================================ */

  it('2a · a GATED parameter-free operation refuses `?tenantId=` behind an ALLOWING authoriser', async () => {
    const app = await plane(allows)
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/intake/channels?${FORBIDDEN}`,
        headers: SESSION,
      })
      assert.equal(
        res.statusCode,
        400,
        '`GET /v1/intake/channels?tenantId=ten_globex` WAS NOT REFUSED behind an authoriser ' +
          `that holds the verb.\n  Got: ${describe1(res)}`,
      )
    } finally {
      await app.close()
    }
  })

  it('2b · the SAME request behind a REFUSING authoriser is 403, not 400', async () => {
    const app = await plane(refuses)
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/intake/channels?${FORBIDDEN}`,
        headers: SESSION,
      })
      assert.equal(
        res.statusCode,
        403,
        'THE GATE HAS MOVED BEHIND THE VALIDATOR. A caller holding nothing has just been told ' +
          'which query keys are legal — `server/http/app.ts` decision 2: "a validator that ' +
          'answers before an authenticator is a schema oracle", extended by decision 4 to an ' +
          `authenticated caller who holds nothing.\n  Got: ${describe1(res)}`,
      )
      assert.equal(codeOf(res.payload), 'capability_not_held')
    } finally {
      await app.close()
    }
  })

  it('2c · the same operation with NO query string is served', async () => {
    const app = await plane(allows)
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/intake/channels',
        headers: SESSION,
      })
      assert.equal(res.statusCode, 200, `Got: ${describe1(res)}`)
    } finally {
      await app.close()
    }
  })

  /* ================================================================ *
   * §3 · A PATH PARAMETER IS NOT A QUERY PARAMETER.
   *
   * 🛑 THE ONE MOST LIKELY TO BE GOT WRONG BY A NARROWER FIX. An operation
   *    carrying a path parameter has a NON-EMPTY `parameters` array, so a
   *    repair keyed on "does this operation declare parameters" — the
   *    convenient landmark — would leave every by-id read in the corpus
   *    exactly as open as before. §5.1, and this assertion is what would
   *    catch it.
   * ================================================================ */

  it('3a · an operation with ONLY a path parameter refuses `?tenantId=`', async () => {
    const app = await plane(allows)
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/runs/run_acme_1?${FORBIDDEN}`,
        headers: SESSION,
      })
      assert.equal(
        res.statusCode,
        400,
        '`GET /v1/runs/run_acme_1?tenantId=ten_globex` WAS NOT REFUSED. A path parameter is ' +
          `not a query parameter, and \`getRun\` declares no second kind.\n  Got: ${describe1(res)}`,
      )
    } finally {
      await app.close()
    }
  })

  it('3b · the same path with NO query string is served', async () => {
    const app = await plane(allows)
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/runs/run_acme_1',
        headers: SESSION,
      })
      assert.equal(res.statusCode, 200, `Got: ${describe1(res)}`)
    } finally {
      await app.close()
    }
  })

  /* ================================================================ *
   * §4 · THE WHOLE CORPUS, AND THE DERIVATION.
   * ================================================================ */

  it('4a · EVERY declared operation, on every tier, carries a querystring schema', () => {
    const without: string[] = []
    let total = 0
    for (const tier of TIER_NAMES) {
      for (const spec of specsOf(tier)) {
        total += 1
        if (spec.schema.querystring === undefined) without.push(spec.operationId)
      }
    }
    assert.equal(
      without.length,
      0,
      `${without.length} of ${total} declared operations carry NO querystring schema, so an ` +
        `undeclared query key reaches each of them unrefused. First ten: ${without.slice(0, 10).join(', ')}`,
    )
    /**
     * ⚠️ A FLOOR, NOT A PIN. The corpus is 136 operations today and grows; an
     * exact figure here would be a number this file has to sweep every time a
     * contract gains an operation, and `check-doc-counts` does not govern it.
     * What must not happen silently is the loop above walking NOTHING —
     * `specsOf()` returning `[]` for every tier would make the assertion above
     * vacuously true, which is §5.6 inside the file written against it.
     */
    assert.ok(total > 100, `only ${total} operations were walked, which is not this corpus`)
  })

  it('4b · a parameter-free operation\'s querystring schema is EXACTLY the closed empty object', () => {
    const doc = loadTier('capability')
    const spec = specsOf('capability').find((s) => s.operationId === 'listIntakeChannels')
    assert.ok(spec !== undefined, '`listIntakeChannels` is no longer declared in the capability tier')
    assert.equal(
      declaresAQueryParameter(doc, 'capability', 'listIntakeChannels'),
      false,
      '`listIntakeChannels` now declares a query parameter, so it is no longer the ' +
        'parameter-free case this assertion is about. Pick another and say so.',
    )
    assert.deepEqual(spec.schema.querystring, {
      type: 'object',
      properties: {},
      additionalProperties: false,
    })
  })

  it('4c · the emptiness is DERIVED: give the operation a query parameter and the schema follows', () => {
    /**
     * 🛑 WITHOUT THIS, §4b PASSES AGAINST A HARD-CODED CONSTANT. A `routesOf()`
     * that returned a frozen `{type:'object',properties:{},additionalProperties:false}`
     * for every operation — reading no document at all — satisfies §4a and §4b
     * and is exactly the §5.6 shape. The mutation below requires the emission
     * to FOLLOW the document in both directions, which a transcription cannot
     * do and a derivation cannot fail to.
     */
    const doc = clone(loadTier('capability'))
    const paths = doc['paths'] as { [k: string]: JsonValue }
    const item = paths['/intake/channels'] as { [k: string]: JsonValue }
    const op = item['get'] as { [k: string]: JsonValue }
    assert.equal(op['operationId'], 'listIntakeChannels')
    op['parameters'] = [{ name: 'since', in: 'query', schema: { type: 'string' } }]

    const mutated = routesOf(doc, basePathOf(doc)).find((s) => s.operationId === 'listIntakeChannels')
    assert.ok(mutated !== undefined)
    assert.deepEqual(
      mutated.schema.querystring,
      { type: 'object', properties: { since: { type: 'string' } }, additionalProperties: false },
      'adding a query parameter to a parameter-free operation did not produce a schema ' +
        'carrying it — the emission is not driven by the document.',
    )

    /* And back: removing it returns the closed empty object. */
    delete op['parameters']
    const restored = routesOf(doc, basePathOf(doc)).find((s) => s.operationId === 'listIntakeChannels')
    assert.deepEqual(restored?.schema.querystring, {
      type: 'object',
      properties: {},
      additionalProperties: false,
    })
  })

  /* ================================================================ *
   * §5 · WHAT MUST NOT HAVE MOVED.
   *
   * `schemaFromParameters()` serves three `where` values and only one of them
   * changes. On HEADERS a closed object refuses every real request — a browser
   * sends a dozen headers no contract declares. On PATH parameters it is
   * meaningless, because the router produces exactly the template's own. Both
   * arguments are `server/contract/routes.ts`'s own and neither is weakened
   * here; these two assertions are what would catch a fix that widened.
   * ================================================================ */

  it('5a · `params` and `headers` are UNTOUCHED — no schema, and no `additionalProperties`', () => {
    for (const tier of TIER_NAMES) {
      for (const spec of specsOf(tier)) {
        const headers = spec.schema.headers
        if (headers !== undefined) {
          assert.equal(
            headers['additionalProperties'],
            undefined,
            `${tier}/${spec.operationId} closed its HEADER schema, which refuses every real ` +
              'browser request.',
          )
        }
        const params = spec.schema.params
        if (params !== undefined) {
          assert.equal(
            params['additionalProperties'],
            undefined,
            `${tier}/${spec.operationId} closed its PATH schema, which is meaningless: the ` +
              'router produces exactly the parameters in the template.',
          )
        }
      }
    }
  })

  it('5b · a path-parameter-free operation still gets NO `params` schema', () => {
    const spec = specsOf('capability').find((s) => s.operationId === 'listIntakeChannels')
    assert.equal(
      spec?.schema.params,
      undefined,
      'an empty `params` schema was emitted. Fastify hands the route exactly the template\'s ' +
        'own parameters, so an empty closed object there is either inert or a refusal of every ' +
        'request — and neither is a property anybody asked for.',
    )
  })
})

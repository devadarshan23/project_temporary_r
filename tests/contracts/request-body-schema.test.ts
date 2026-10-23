/**
 * THE CONTRACT IS THE VALIDATOR FOR A REQUEST BODY — PROVED BY CHANGING THE
 * CONTRACT, NOT BY READING THE SERVER.
 *
 * `server/contract/routes.ts` derived a `querystring`, a `params` and a
 * `headers` schema from the OpenAPI document and derived NO body, and said so in
 * its own comment. So "schema-first" was a claim about ROUTING, and the one
 * place `docs/contracts/README.md` says a tenant may never be named — "`tenantId`
 * appears in no request body, anywhere. Not once, in any operation, in any
 * tier" — was the one place nothing checked.
 *
 * ┌─ WHY A TRANSCRIPTION TEST WOULD BE WORTHLESS HERE ─────────────────────────┐
 * │ Asserting that the derived schema forbids `tenantId` proves nothing about  │
 * │ DERIVATION: a `routesOf()` that returned a hard-coded object with          │
 * │ `additionalProperties: false` would pass it, and so would one that read a  │
 * │ different document entirely. The assertions below therefore MUTATE the     │
 * │ parsed capability document and require the server's behaviour to follow —  │
 * │ in BOTH directions. A schema that is transcribed cannot do that, and a     │
 * │ schema that is driven cannot fail to.                                      │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THE MUTATION IS APPLIED TO A DEEP CLONE AND NEVER TO A FILE. `loadTier()`
 * caches one parsed object per process, so mutating what it returned would
 * corrupt every other test in the run — and writing to `docs/contracts/` from a
 * test would be a suite that edits the thing it is checking.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS FILE DOES NOT ASSERT, AND WHY, BECAUSE THE GAP IS THE POINT.
 *
 * `tests/http/engine-on-served-path.test.ts` assertion 4 sends a real
 * `POST /v1/runs` and requires a 400. It is RED and this file does not turn it
 * green, because turning it green means MOUNTING `admitRun` — and `admitRun`
 * cannot be served honestly today:
 *
 *   • `Run.definitionVersion` "pins the definition as it stood", and there is no
 *     `definition` table in `db/migrations/`. Any version this server wrote
 *     would be a number with no source.
 *   • The contract's whole argument for the operation is that the idempotency
 *     key "is computed by the server from the period, the definition and the
 *     SLOT-FILL STATE — the fingerprint of exactly which documents are sitting
 *     in which slots right now." There is no document substrate and no slot
 *     substrate, so `outcome: deduplicated` could never be reached and the
 *     guarantee the operation is named for would be false.
 *   • Registering it with a refusal instead needs a code from `errors.yaml`'s
 *     CLOSED enum, and `server/contract/routes.ts` already recorded that "there
 *     isn't one that means 'declared and unbuilt' — inventing one is a contract
 *     change, and a contract change is not this slice's to make." Verified
 *     against the enum's 71 members, not assumed.
 *
 * So the MECHANISM is witnessed here, end to end, through Fastify and through
 * the plane's own ajv options — a body carrying `tenantId` really is refused
 * with a 400. What is NOT witnessed is that `POST /v1/runs` is a route, because
 * it is not one. That is a mounting question, not a validation question, and it
 * is left open rather than answered with a stub.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import Fastify from 'fastify'

import { basePathOf, loadTier, type JsonValue, type OpenApiDocument } from '../../server/contract/document.ts'
import { routesOf, type RouteSpec } from '../../server/contract/routes.ts'
import { AJV_OPTIONS, buildPlane, type Handler } from '../../server/http/app.ts'

/** The operation whose body carries the rule this file exists for. */
const OPERATION = 'admitRun'

function capabilityRoutes(doc: OpenApiDocument): readonly RouteSpec[] {
  return routesOf(doc, basePathOf(doc))
}

function specFor(doc: OpenApiDocument, operationId: string): RouteSpec {
  const found = capabilityRoutes(doc).find((s) => s.operationId === operationId)
  assert.ok(found !== undefined, `\`${operationId}\` is not an operation in the capability tier`)
  return found
}

/** A deep clone, so a mutation cannot reach `loadTier()`'s process-wide cache. */
function clone(doc: OpenApiDocument): OpenApiDocument {
  return JSON.parse(JSON.stringify(doc)) as OpenApiDocument
}

/** The `admitRun` request-body node of a (cloned) document, for mutating. */
function bodyNode(doc: OpenApiDocument): { [k: string]: JsonValue } {
  const paths = doc['paths'] as { [k: string]: JsonValue }
  const runs = paths['/runs'] as { [k: string]: JsonValue }
  const post = runs['post'] as { [k: string]: JsonValue }
  const requestBody = post['requestBody'] as { [k: string]: JsonValue }
  const content = requestBody['content'] as { [k: string]: JsonValue }
  const json = content['application/json'] as { [k: string]: JsonValue }
  return json['schema'] as { [k: string]: JsonValue }
}

/**
 * Send one body at one derived schema, through Fastify, with the PLANE's ajv
 * options — `AJV_OPTIONS`, imported rather than restated, because
 * `removeAdditional: false` is the setting that decides whether an extra key is
 * REFUSED or silently deleted and a copy of it here would keep passing after
 * somebody changed the real one.
 */
async function validate(spec: RouteSpec, payload: unknown): Promise<number> {
  const app = Fastify({ logger: false, ajv: { customOptions: { ...AJV_OPTIONS } } })
  app.route({
    method: 'POST',
    url: '/probe',
    ...(spec.schema.body === undefined ? {} : { schema: { body: spec.schema.body } }),
    handler: async () => ({ admitted: true }),
  })
  try {
    const res = await app.inject({ method: 'POST', url: '/probe', payload: payload as object })
    return res.statusCode
  } finally {
    await app.close()
  }
}

describe('a request body is validated from the contract', () => {
  /* ---------------------------------------------------------------- *
   * The §5.6 guard. Every assertion below is meaningless if the
   * deriver emitted nothing at all.
   * ---------------------------------------------------------------- */

  it('the capability tier derives a body schema for every operation that declares one', () => {
    const doc = loadTier('capability')
    const specs = capabilityRoutes(doc)
    const withBody = specs.filter((s) => s.schema.body !== undefined)

    assert.ok(
      withBody.length > 0,
      'NO OPERATION IN THE CAPABILITY TIER DERIVED A BODY SCHEMA. Every assertion in ' +
        'this file would then be measuring an empty object rather than the contract.',
    )

    const unvalidatable = specs.filter((s) => s.unvalidatableBody !== undefined)
    assert.deepEqual(
      unvalidatable.map((s) => s.operationId),
      [],
      'AN OPERATION IN THE TIER A CUSTOMER\'S BROWSER MEETS DECLARES A REQUEST BODY THAT ' +
        'CANNOT BE VALIDATED FROM THE CONTRACT. `mountTier()` refuses to register one, so ' +
        'this is a boot failure waiting for whoever mounts it — not a silent hole, but not ' +
        'nothing either. ' +
        unvalidatable.map((s) => `${s.operationId}: ${String(s.unvalidatableBody)}`).join(' · '),
    )
  })

  /* ---------------------------------------------------------------- *
   * The derived schema is the document's, not a transcription of it.
   * ---------------------------------------------------------------- */

  it('the derived schema is the one in the document, node for node', () => {
    const doc = loadTier('capability')
    const spec = specFor(doc, OPERATION)
    assert.deepEqual(
      spec.schema.body,
      bodyNode(clone(doc)),
      `the schema \`routesOf()\` emitted for \`${OPERATION}\` is not the node the document ` +
        'declares. `admitRun`\'s body holds no `$ref`, so bundling must be the identity here; ' +
        'a difference means something between the document and the route table is rewriting it.',
    )
  })

  /* ---------------------------------------------------------------- *
   * INVARIANT 1 — the key that may appear in no request body, in any
   * tier, is refused. Through Fastify, at the real validator.
   * ---------------------------------------------------------------- */

  it('a body naming a tenant is refused, and nothing but the schema knows it is illegal', async () => {
    const doc = loadTier('capability')
    const spec = specFor(doc, OPERATION)

    const legal = await validate(spec, { definitionId: 'def_engine' })
    assert.equal(
      legal,
      200,
      'A BODY THE CONTRACT ALLOWS WAS REFUSED. The assertion below would then pass for the ' +
        `wrong reason — everything refused, nothing validated. Got ${legal}.`,
    )

    const named = await validate(spec, { definitionId: 'def_engine', tenantId: 'ten_globex' })
    assert.equal(
      named,
      400,
      'A REQUEST BODY NAMING A TENANT WAS ACCEPTED. `docs/contracts/README.md`: "`tenantId` ' +
        'appears in no request body, anywhere. Not once, in any operation, in any tier… A ' +
        'request that could STATE its tenant is a request that could state the wrong one — ' +
        'invariant 1, expressed as an absence rather than a comment." There is no ' +
        'hand-written check anywhere in `server/` that knows this key is illegal; only ' +
        `\`additionalProperties: false\` in the document does. Got ${named}.`,
    )
  })

  /* ---------------------------------------------------------------- *
   * THE HARD PROOF. Change the contract; the behaviour must follow.
   * ---------------------------------------------------------------- */

  it('DRIVEN, NOT TRANSCRIBED — changing the contract changes what the server accepts', async () => {
    const base = loadTier('capability')

    /* --- direction one: the document stops forbidding extra keys --- */

    const permissive = clone(base)
    delete bodyNode(permissive)['additionalProperties']
    const nowAllowed = await validate(specFor(permissive, OPERATION), {
      definitionId: 'def_engine',
      tenantId: 'ten_globex',
    })
    assert.equal(
      nowAllowed,
      200,
      'THE SCHEMA WAS TRANSCRIBED, NOT DRIVEN. `additionalProperties` was removed from the ' +
        'document and the server went on refusing the extra key anyway, which means the ' +
        'refusal comes from somewhere other than the contract. Whatever is refusing here ' +
        `would go on refusing after the contract said otherwise. Got ${nowAllowed}.`,
    )

    /* --- direction two: the document requires a key it did not --- */

    const stricter = clone(base)
    const node = bodyNode(stricter)
    node['required'] = ['definitionId', 'periodId']
    const nowRefused = await validate(specFor(stricter, OPERATION), { definitionId: 'def_engine' })
    assert.equal(
      nowRefused,
      400,
      'THE SCHEMA WAS TRANSCRIBED, NOT DRIVEN. `periodId` was added to the document\'s ' +
        '`required` list and a body without it was still accepted, so the server is not ' +
        `reading that list. Got ${nowRefused}.`,
    )

    /* --- direction three: a NEW property the document did not have --- */

    const widened = clone(base)
    const widenedNode = bodyNode(widened)
    const properties = widenedNode['properties'] as { [k: string]: JsonValue }
    properties['dryRun'] = { type: 'boolean' }
    const nowAccepted = await validate(specFor(widened, OPERATION), {
      definitionId: 'def_engine',
      dryRun: true,
    })
    assert.equal(
      nowAccepted,
      200,
      'THE SCHEMA WAS TRANSCRIBED, NOT DRIVEN. A property added to the document was still ' +
        `refused by the server, so the property list is not coming from the document. Got ${nowAccepted}.`,
    )

    /* --- and the unmutated document is unchanged by all of it --- */

    const untouched = await validate(specFor(base, OPERATION), {
      definitionId: 'def_engine',
      tenantId: 'ten_globex',
    })
    assert.equal(
      untouched,
      400,
      'THE MUTATIONS ABOVE REACHED THE REAL DOCUMENT. `loadTier()` caches one parsed object ' +
        'per process; a mutation that escaped `clone()` would corrupt every other test in ' +
        `this run. Got ${untouched} where the unmutated contract must still refuse.`,
    )
  })
})

/* ══════════════════════════════════════════════════════════════════════════ *
 * THROUGH `buildPlane()`, NOT BESIDE IT.
 *
 * 🛑 EVERY ASSERTION ABOVE VALIDATES THROUGH A FASTIFY INSTANCE THIS FILE
 * BUILDS ITSELF, and that is a hole the size of the claim. `validate()` calls
 * `app.route({ schema: { body: spec.schema.body } })` by hand — so it proves
 * that the DERIVED SCHEMA refuses a bad body, and proves nothing about whether
 * the thing that mounts routes ever passes that schema to Fastify.
 *
 * Narrowing `server/http/app.ts`'s `app.route({ … schema: spec.schema … })` to
 * enumerate `{ querystring, params, headers, response }` — the exact key list
 * the comment there used to name — would leave every assertion above green
 * while no mounted route validated a body again. §5.1: a rule keyed on a
 * convenient landmark instead of the property it protects.
 *
 * The two below go through `buildPlane()` itself. Neither needs a database.
 * ══════════════════════════════════════════════════════════════════════════ */

/** Accepts every request. The fence and the schema are what is under test here. */
const ALWAYS: Handler = async () => ({ ok: true })

/**
 * A plane built exactly as `server/control-plane/start.ts` builds one.
 *
 * ⚠️ `authorise` ARRIVED ON `PlaneOptions` WITH G200'S GATE, 19 Sep 2026, AND IT
 * IS UNREACHABLE HERE. Every operation on the control tier is annotated
 * `exempt:`, so `mountTier()` puts no capability on the route and the
 * `preValidation` gate returns before it can ask. The function below would throw
 * if it were ever called, which is deliberate and is the same polarity
 * `server/control-plane/authorise.ts` takes for the real one: a plane whose
 * whole claim is that no capability is reachable must not answer a capability
 * question with a plausible 403.
 */
async function controlPlaneWith(handlers: Readonly<Record<string, Handler>>) {
  return buildPlane(
    {
      plane: 'test-control-plane',
      authenticate: () => ({ staff: true }),
      unauthenticatedDetail: 'unused — `authenticate` never refuses here',
      authorise: (_principal, capability) => {
        throw new Error(
          `the control tier is wholly exempt, so nothing should have asked about ` +
            `\`${capability}\` on this plane.`,
        )
      },
      unauthorisedDetail: 'unused — no operation on this tier carries a capability',
    },
    [{ tier: 'controlPlane', handlers }],
  )
}

describe('a MOUNTED route validates its body from the contract', () => {
  /* ---------------------------------------------------------------- *
   * `reportAccessSessions` is the probe because it is the control
   * tier's bundleable-body POST. It is NOT mounted by the real plane —
   * `server/control-plane/start.ts` mounts `listEntitledPacks` alone —
   * and it is mounted here against a stub for the length of one test.
   * That is a claim about `mountTier()`, not about what is served.
   * ---------------------------------------------------------------- */

  it('a body the contract forbids is refused by a route `mountTier()` registered', async () => {
    const app = await controlPlaneWith({ reportAccessSessions: ALWAYS })
    try {
      const legal = await app.inject({
        method: 'POST',
        url: '/access/sessions',
        payload: { sessions: [] },
      })
      assert.equal(
        legal.statusCode,
        400,
        'the control document declares `sessions` with `minItems: 1`, so an empty batch ' +
          'must be refused. A different status here means this probe is measuring ' +
          `something other than the body schema. Got ${legal.statusCode}: ${legal.body}`,
      )

      /* INVARIANT 1, at a route the plane's own mounting code registered. */
      const named = await app.inject({
        method: 'POST',
        url: '/access/sessions',
        payload: { tenantId: 'ten_globex', sessions: [] },
      })
      assert.equal(
        named.statusCode,
        400,
        'A MOUNTED ROUTE ACCEPTED A BODY NAMING A TENANT. Everything above this line ' +
          'validates through a Fastify instance this file builds; this is the first ' +
          'assertion that goes through `buildPlane()` → `mountTier()` → `app.route()`. ' +
          'If it fails while the assertions above pass, the derived schema is right and ' +
          `the mounting code is dropping \`body\` on the floor. Got ${named.statusCode}`,
      )
      const problem = JSON.parse(named.body) as { code?: string; detail?: string }
      assert.equal(
        problem.code,
        'validation_failed',
        `the refusal did not carry \`validation_failed\` from \`errors.yaml\`. Got: ${named.body}`,
      )
      assert.match(
        String(problem.detail),
        /body schema declared in the OpenAPI document/,
        'the refusal did not name the BODY as what rejected it, so this assertion cannot ' +
          'tell a body refusal from a querystring or params refusal at the same URL. ' +
          `Got: ${named.body}`,
      )
    } finally {
      await app.close()
    }
  })

  /* ---------------------------------------------------------------- *
   * The fence, witnessed FIRING. `request-body-schema.test.ts` asserts
   * the capability tier has no unvalidatable body — a count of zero,
   * which is a fact about the document and not about the fence.
   * ---------------------------------------------------------------- */

  it('an operation whose body cannot be validated is refused AT REGISTRATION', async () => {
    await assert.rejects(
      () => controlPlaneWith({ sendHeartbeat: ALWAYS }),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.match(
          message,
          /sendHeartbeat/,
          'the boot failure did not name the operation that caused it, so an operator ' +
            `would have a dead plane and no address for it. Got: ${message}`,
        )
        assert.match(
          message,
          /cannot be validated from the contract/,
          `the boot failure did not say WHY the operation was refused. Got: ${message}`,
        )
        return true
      },
      '`sendHeartbeat` `$ref`s `./errors.yaml` from inside its request body, so its body ' +
        'cannot be bundled and `mountTier()` must refuse to register it: "a route that ' +
        'accepts an unvalidated body is worse than an absent route." Building the plane ' +
        'SUCCEEDED, which means the fence at `server/http/app.ts` did not fire and an ' +
        'operation with an unvalidated body would have been served.',
    )
  })

  /* ---------------------------------------------------------------- *
   * The §5.6 guard on the fence itself: it must let through the
   * operation the real control plane actually mounts. A fence that
   * refused everything would pass the test above for the wrong reason.
   * ---------------------------------------------------------------- */

  it('the fence does not refuse the operation the real control plane mounts', async () => {
    const app = await controlPlaneWith({ listEntitledPacks: ALWAYS })
    await app.close()
  })
})

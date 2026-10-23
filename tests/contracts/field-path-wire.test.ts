/**
 * G244 — THE WIRE FORM OF `FieldPath`, PROVED AGAINST THE MODEL'S OWN OUTPUT.
 *
 * G214 (22 Aug 2026) retyped `FieldPath` in `model/kernel.ts` from `string` to a
 * branded token list. The four OpenAPI tiers went on describing a plain string,
 * and G244 (23 Aug 2026) closes that. This file is the control that keeps it
 * closed.
 *
 * ┌─ WHY A CHECKER DID NOT CATCH THE DIVERGENCE, AND WHY THIS IS NOT ITS FAULT ─┐
 * │ `tools/check-wire-mirror.mjs` reported `DRIFT (0)` on every run while the   │
 * │ model and the wire disagreed, AND IT WAS NOT BROKEN. It is a line scanner   │
 * │ that compares literal-union enums and does not resolve `$ref` — G109's      │
 * │ `$ref` half is open and the checker says so in its own header — so it was   │
 * │ reporting truthfully about the pairs it can reach, and this was not one of  │
 * │ them. A GREEN CONTROL OVER A DIVERGENCE IT CANNOT REACH IS THE MOST         │
 * │ DANGEROUS SHAPE A CONTROL HAS, BECAUSE THE GREEN IS REAL. This file is      │
 * │ narrow enough to reach what that one cannot.                                │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE EXPECTATION IS DERIVED FROM `parseFieldPath()`, NEVER FROM THE YAML
 * UNDER TEST. §2 takes paths the MODEL SEAM produced, serialises them, and
 * requires the CONTRACT'S OWN SCHEMA — bundled and compiled by the same ajv the
 * planes run — to accept them; and requires the shapes the grammar forbids to be
 * rejected. A test that read the schema out of the file it is checking would
 * pass against any value that file happened to hold, which is exactly how the
 * string form survived a wire mirror, a citation checker and a count checker.
 *
 * ⚠️ THE DUPLICATE DECLARATION IS DELIBERATE AND IS GUARDED HERE RATHER THAN
 * EXPLAINED IN A COMMENT. G244 asked for one declaration `$ref`d across tiers,
 * the shape `Meter` uses. THAT IS NOT AVAILABLE TO THE CAPABILITY TIER TODAY:
 * `server/contract/bundle.ts` throws `ExternalRefError` on any cross-file `$ref`
 * — by design, because silently dropping one would produce a schema that
 * validates less than the contract says — and `OutboundDraft.includeFields` is
 * reachable from the request bodies of `checkOutboundDisclosure` and
 * `sendOutboundMessage`. A cross-file pointer there makes both operations
 * unmountable, which `tests/contracts/request-body-schema.test.ts` catches as a
 * boot failure waiting to happen. So the capability tier carries its own
 * STRUCTURAL copy, and §3 asserts the two copies are identical rather than
 * asking a reviewer to notice. When the bundler learns to resolve a cross-file
 * pointer, the copy collapses to a `$ref` and §3 becomes the assertion that it
 * did.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import Fastify from 'fastify'

import { parseFieldPath } from '../../model/field-path.ts'
import { loadTier } from '../../server/contract/document.ts'
import { bundleSchema } from '../../server/contract/bundle.ts'
import type { JsonSchema } from '../../server/contract/bundle.ts'
import type { JsonValue, OpenApiDocument } from '../../server/contract/document.ts'
import { AJV_OPTIONS } from '../../server/http/app.ts'

/** The pointer at which each tier declares the shared shapes. */
const SCHEMAS = ['FieldSegment', 'FieldPath', 'FieldPathKey'] as const

function schemasOf(doc: OpenApiDocument): Record<string, JsonValue> {
  const components = doc['components']
  assert.ok(components !== null && typeof components === 'object' && !Array.isArray(components))
  const schemas = (components as Record<string, JsonValue>)['schemas']
  assert.ok(schemas !== null && typeof schemas === 'object' && !Array.isArray(schemas))
  return schemas as Record<string, JsonValue>
}

/** Follow a `/`-separated pointer, asserting each step exists. */
function at(root: JsonValue, pointer: string): JsonValue {
  let cursor: JsonValue = root
  for (const step of pointer.split('/')) {
    assert.ok(
      cursor !== null && typeof cursor === 'object' && !Array.isArray(cursor) && step in cursor,
      `POINTER DID NOT RESOLVE: ${pointer} (stopped at \`${step}\`). The site moved or was ` +
        'renamed — re-derive it rather than editing this list to match.',
    )
    cursor = (cursor as Record<string, JsonValue>)[step] as JsonValue
  }
  return cursor
}

/** Strip every `description` so two copies are compared on SHAPE, not prose. */
function structure(node: JsonValue): JsonValue {
  if (Array.isArray(node)) return node.map(structure)
  if (node === null || typeof node !== 'object') return node
  const out: Record<string, JsonValue> = {}
  for (const [k, v] of Object.entries(node as Record<string, JsonValue>)) {
    if (k === 'description') continue
    out[k] = structure(v)
  }
  return out
}

/**
 * Validate one payload against one schema, through the SAME ajv configuration a
 * plane runs — `AJV_OPTIONS` is imported, never copied, so a change to the
 * server's validator is felt here instead of being mirrored by hand.
 */
async function validates(schema: JsonSchema, payload: unknown): Promise<boolean> {
  const app = Fastify({ logger: false, ajv: { customOptions: { ...AJV_OPTIONS } } })
  /* `$defs` is HOISTED to the body root rather than left on the nested node.
   * `bundleSchema()` rewrites every local `$ref` to `#/$defs/…`, and `#` is the
   * schema Fastify compiles — so a `$defs` sitting one level down resolves to
   * nothing and Fastify fails to BUILD, which is a green-looking way to assert
   * against a validator that never ran. */
  const { $defs, ...node } = schema
  app.route({
    method: 'POST',
    url: '/probe',
    schema: {
      body: {
        type: 'object',
        required: ['p'],
        properties: { p: node },
        ...($defs === undefined ? {} : { $defs }),
      },
    },
    handler: async () => ({ ok: true }),
  })
  try {
    const res = await app.inject({ method: 'POST', url: '/probe', payload: { p: payload } })
    return res.statusCode === 200
  } finally {
    await app.close()
  }
}

/* ==================================================================== *
 * §1  BOTH TIERS DECLARE THE SHAPES
 * ==================================================================== */

describe('G244 — the tiers declare a field path', () => {
  it('foundation declares FieldSegment, FieldPath and FieldPathKey', () => {
    const schemas = schemasOf(loadTier('foundation'))
    for (const name of SCHEMAS) {
      assert.ok(
        name in schemas,
        `\`${name}\` is not declared in foundation.openapi.yaml. It is the canonical ` +
          'declaration — G244 put it there because that is where `Meter` lives.',
      )
    }
  })

  it('capability declares them too, and §3 requires the two to agree', () => {
    const schemas = schemasOf(loadTier('capability'))
    for (const name of SCHEMAS) {
      assert.ok(
        name in schemas,
        `\`${name}\` is not declared in capability.openapi.yaml. It cannot be a cross-file ` +
          '`$ref` while `server/contract/bundle.ts` throws on one — see this file\'s header.',
      )
    }
  })

  it('the capability copy is LOCAL, so every mounted body still bundles', () => {
    const doc = loadTier('capability')
    const includeFields = at(
      doc,
      'components/schemas/OutboundDraft/properties/includeFields/items/$ref',
    )
    assert.equal(
      includeFields,
      '#/components/schemas/FieldPath',
      'THE ONE SITE THAT MUST NOT BE A CROSS-FILE POINTER IS A CROSS-FILE POINTER. ' +
        '`OutboundDraft.includeFields` is reachable from the request bodies of ' +
        '`checkOutboundDisclosure` and `sendOutboundMessage`; a `./foundation…` pointer ' +
        'there makes both operations unmountable.',
    )
  })
})

/* ==================================================================== *
 * §2  THE MODEL'S OWN OUTPUT VALIDATES — AND THE REFUSED GRAMMAR DOES NOT
 * ==================================================================== */

describe('G244 — the contract accepts exactly what parseFieldPath() produces', () => {
  const fieldPath = () => {
    const schemas = schemasOf(loadTier('capability'))
    return bundleSchema(loadTier('capability'), schemas['FieldPath'] as JsonValue)
  }

  it('a path the MODEL SEAM produced is accepted, keys and indices together', async () => {
    const parsed = parseFieldPath(['invoice', 'lines', 0, 'amount'])
    assert.ok(parsed.ok, 'the seam refused a path this test depends on')
    /* Serialised exactly as it would cross: no reshaping, or the assertion is
     * about this file's idea of the wire rather than about the model's. */
    const onTheWire: unknown = JSON.parse(JSON.stringify(parsed.path))
    assert.deepEqual(onTheWire, [
      { kind: 'key', key: 'invoice' },
      { kind: 'key', key: 'lines' },
      { kind: 'index', index: 0 },
      { kind: 'key', key: 'amount' },
    ])
    assert.ok(
      await validates(fieldPath(), onTheWire),
      'THE CONTRACT REJECTED A PATH THE MODEL PRODUCED. That is the divergence G244 ' +
        'closed, arriving again in the opposite direction.',
    )
  })

  it('a key whose bytes contain a dot is ONE segment and is accepted', async () => {
    /* The deciding fact for G214: the keys are counterparty-controlled, and
     * `payer.ref` is legal JSON. A wire form that could not carry it would have
     * re-introduced the dotted-string failure it exists to remove. */
    const parsed = parseFieldPath(['payer.ref'])
    assert.ok(parsed.ok)
    assert.ok(await validates(fieldPath(), JSON.parse(JSON.stringify(parsed.path))))
  })

  it('the OLD form — a dotted string — is REJECTED', async () => {
    assert.equal(await validates(fieldPath(), 'invoice.lines.0.amount'), false)
    assert.equal(await validates(fieldPath(), ['invoice', 'lines', 'amount']), false)
  })

  it('an EMPTY path is rejected — a path addresses exactly one position', async () => {
    assert.equal(await validates(fieldPath(), []), false)
  })

  it('G243 — NO WILDCARD, and the refusal is asserted by name', async () => {
    /* `[]` meaning "every element" was explicitly refused. G222 rules an
     * outbound `DataClass` is the MAXIMUM over the `FieldSpec` classes carried,
     * and a maximum over a set is computable only if each path names ONE field.
     * Each spelling anyone might reach for is refused separately: a schema that
     * rejected `each` and admitted `*` would pass a one-case test. */
    for (const wildcard of [
      { kind: 'each' },
      { kind: 'wildcard' },
      { kind: 'any' },
      { kind: 'all' },
      { kind: 'index', index: '*' },
      { kind: 'key' },
      { kind: 'index' },
    ]) {
      assert.equal(
        await validates(fieldPath(), [wildcard]),
        false,
        `THE WIRE ADMITTED A SEGMENT THE GRAMMAR HAS NO KIND FOR: ${JSON.stringify(wildcard)}. ` +
          'G243 refused a wildcard; a segment kind that is not `key` or `index` is one ' +
          'arriving under another name.',
      )
    }
  })

  it('a negative index is rejected — positions are ZERO-BASED, never relative', async () => {
    assert.equal(await validates(fieldPath(), [{ kind: 'index', index: -1 }]), false)
    assert.equal(await validates(fieldPath(), [{ kind: 'index', index: 1.5 }]), false)
  })

  it('the two kinds never coincide — a numeric KEY is not an INDEX', async () => {
    /* The array-index rule, carried through to the wire. Both are legal and they
     * address different things: `"0"` a string property, `0` the first element. */
    assert.ok(await validates(fieldPath(), [{ kind: 'key', key: '0' }]))
    assert.ok(await validates(fieldPath(), [{ kind: 'index', index: 0 }]))
    /* And neither may carry the other's payload. */
    assert.equal(await validates(fieldPath(), [{ kind: 'key', index: 0 }]), false)
    assert.equal(
      await validates(fieldPath(), [{ kind: 'key', key: 'a', index: 0 }]),
      false,
      'A SEGMENT ACCEPTED BOTH PAYLOADS AT ONCE. `additionalProperties: false` is what ' +
        'keeps a reader from inventing a third kind by attaching a field to an existing one.',
    )
  })
})

/* ==================================================================== *
 * §3  THE TWO COPIES ARE THE SAME SHAPE
 * ==================================================================== */

describe('G244 — the duplicate declaration cannot drift', () => {
  for (const name of SCHEMAS) {
    it(`\`${name}\` is structurally identical in both tiers`, () => {
      const declared = { foundation: schemasOf(loadTier('foundation'))[name], capability: schemasOf(loadTier('capability'))[name] }
      /* 🛑 THE §5.6 GUARD, AND IT IS NOT DECORATION. `deepEqual(undefined,
       * undefined)` PASSES — so with the schema missing from BOTH tiers this
       * assertion would report green while comparing nothing at all, which is
       * precisely the shape it exists to catch. Witnessed: on the red run this
       * section was the only one passing. */
      for (const [tier, node] of Object.entries(declared)) {
        assert.ok(
          node !== undefined && node !== null && typeof node === 'object',
          `\`${name}\` is not an object in ${tier}.openapi.yaml, so the comparison below ` +
            'would be vacuous rather than green.',
        )
      }
      const foundation = structure(declared.foundation as JsonValue)
      const capability = structure(declared.capability as JsonValue)
      assert.deepEqual(
        capability,
        foundation,
        `THE TWO DECLARATIONS OF \`${name}\` HAVE DRIFTED. They are duplicated only because ` +
          '`server/contract/bundle.ts` cannot resolve a cross-file `$ref` in a mounted ' +
          "request body; the duplication is a cost, not a licence. Change both or neither.",
      )
    })
  }
})

/* ==================================================================== *
 * §4  EVERY SITE — no path anywhere is a bare string
 * ==================================================================== */

describe('G244 — every path-bearing site on the wire carries the token list', () => {
  const FOUNDATION_PATHS: readonly string[] = [
    'paths/~1policy~1evaluate/post/responses/200/content/application~1json/schema/properties/redactedPaths/items',
    'paths/~1classification~1classify/post/requestBody/content/application~1json/schema/properties/path',
    'paths/~1classification~1apply-ceiling/post/responses/200/content/application~1json/schema/properties/removedPaths/items',
  ]

  const CAPABILITY_PATHS: readonly string[] = [
    'components/schemas/Document/allOf/1/properties/redactedPaths/items',
    'components/schemas/ObservedValue/properties/path',
    'components/schemas/RefusedItem/properties/path',
    'components/schemas/DisclosureRecord/properties/fieldsDisclosed/items',
    'components/schemas/Message/properties/redactedPaths/items',
    'components/schemas/OutboundDraft/properties/includeFields/items',
  ]

  const FOUNDATION_KEYED: readonly string[] = [
    'paths/~1classification~1apply-ceiling/post/requestBody/content/application~1json/schema/properties/values/propertyNames',
    'paths/~1classification~1apply-ceiling/post/responses/200/content/application~1json/schema/properties/values/propertyNames',
  ]

  const CAPABILITY_KEYED: readonly string[] = [
    'components/schemas/Document/allOf/1/properties/extracted/propertyNames',
    'components/schemas/Document/allOf/1/properties/lines/items/properties/fields/propertyNames',
  ]

  /** `~1` is JSON Pointer's escape for `/` — the path keys are URL templates. */
  function refAt(doc: OpenApiDocument, pointer: string): unknown {
    let cursor: JsonValue = doc
    for (const raw of pointer.split('/')) {
      const step = raw.replace(/~1/g, '/')
      assert.ok(
        cursor !== null && typeof cursor === 'object' && step in (cursor as object),
        `POINTER DID NOT RESOLVE: ${pointer} (stopped at \`${step}\`). Re-derive the site ` +
          'rather than editing this list to match — a list edited to match asserts nothing.',
      )
      cursor = (cursor as Record<string, JsonValue>)[step] as JsonValue
    }
    assert.ok(cursor !== null && typeof cursor === 'object' && !Array.isArray(cursor))
    return (cursor as Record<string, JsonValue>)['$ref']
  }

  it('the foundation tier carries a FieldPath at every path site', () => {
    const doc = loadTier('foundation')
    for (const pointer of FOUNDATION_PATHS) {
      assert.equal(
        refAt(doc, pointer),
        '#/components/schemas/FieldPath',
        `STILL A BARE STRING (or a stale pointer): ${pointer}`,
      )
    }
  })

  it('the capability tier carries a FieldPath at every path site', () => {
    const doc = loadTier('capability')
    for (const pointer of CAPABILITY_PATHS) {
      assert.equal(
        refAt(doc, pointer),
        '#/components/schemas/FieldPath',
        `STILL A BARE STRING (or a stale pointer): ${pointer}`,
      )
    }
  })

  it('a path-KEYED object constrains its property names to FieldPathKey', () => {
    /* A JSON property name is a string, so a `FieldPath` cannot key an object
     * directly. `propertyNames` is what stops these degrading back to "any
     * string at all", which is what they said before G244. */
    for (const pointer of FOUNDATION_KEYED) {
      assert.equal(refAt(loadTier('foundation'), pointer), '#/components/schemas/FieldPathKey', pointer)
    }
    for (const pointer of CAPABILITY_KEYED) {
      assert.equal(refAt(loadTier('capability'), pointer), '#/components/schemas/FieldPathKey', pointer)
    }
  })
})

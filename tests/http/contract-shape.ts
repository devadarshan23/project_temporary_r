/**
 * THE DECLARED SHAPE OF A RESPONSE, AND WHETHER A BODY SATISFIES IT.
 *
 * 🛑 THIS IS K6's MEASURING INSTRUMENT AND NOTHING ELSE. It answers one
 * question — *does this value carry every `required` property the contract
 * declares, at every depth* — and it deliberately answers no other. It is not
 * a JSON Schema validator: it does not check types, formats, enums, bounds or
 * `additionalProperties`, and a commit that makes it check one of those is
 * making a different control with a different denominator.
 *
 * ┌─ WHY IT IS HAND-WRITTEN AND NOT `ajv` ─────────────────────────────────────┐
 * │ `ajv` is reachable from `node_modules` today only because `fastify` pulls  │
 * │ it in transitively. Importing it HERE would make a transitive package a    │
 * │ direct one in everything but the manifest — the shape G191 pins exactly    │
 * │ and `tests/infra/manifest.test.mjs` fences — and it would do so to get a   │
 * │ great deal of behaviour this control must NOT have. The property K6 names  │
 * │ is `required`, and `required` is sixty lines.                             │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ IT RESOLVES `./errors.yaml#/components/schemas/…` AND `server/contract/
 * bundle.ts` REFUSES TO. That divergence is deliberate and is the whole reason
 * this file exists rather than reusing `bundleSchema()`. The ROUTER refuses an
 * external pointer because a serialiser schema must be self-contained; the
 * MEASUREMENT has to follow the pointer, because otherwise it cannot say what
 * the contract requires of the seven operations whose success schemas carry
 * one. Reusing the router's bundler here would make the instrument blind in
 * exactly the place the finding is.
 */

import { loadTier, type JsonValue, type OpenApiDocument } from '../../server/contract/document.ts'

/** A schema node, as it appears in a loaded OpenAPI document. */
export type SchemaNode = { readonly [k: string]: JsonValue }

function asObject(value: JsonValue | undefined): SchemaNode | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as SchemaNode
}

function stringsOf(value: JsonValue | undefined): readonly string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function nodesOf(value: JsonValue | undefined): readonly SchemaNode[] {
  if (!Array.isArray(value)) return []
  return value.map(asObject).filter((v): v is SchemaNode => v !== null)
}

/**
 * The two pointer forms this corpus uses, and no third.
 *
 * ⚠️ AN UNRECOGNISED `$ref` IS RETURNED UNRESOLVED RATHER THAN THROWN, and the
 * walker below then finds no `required` on it and reports nothing. That is the
 * fail-QUIET direction and it is the wrong one for a control, so
 * `unresolvedRefs()` exists to make it visible: the suite asserts the count is
 * zero, and a third pointer form arriving in the corpus is a RED rather than a
 * silent hole in the measurement.
 */
const LOCAL_POINTER = /^#\/components\/schemas\/(.+)$/
const ERRORS_POINTER = /^\.\/errors\.yaml#\/components\/schemas\/(.+)$/

export interface Resolver {
  /** Follows `$ref` to a fixed point. */
  readonly deref: (node: SchemaNode) => SchemaNode
  /** Every `$ref` string this resolver could not follow, in document order. */
  readonly unresolvedRefs: () => readonly string[]
}

/** A resolver over one tier document, plus `errors.yaml`. */
export function resolverFor(doc: OpenApiDocument): Resolver {
  const errors = loadTier('errors')
  const unresolved: string[] = []

  const schemasOf = (d: OpenApiDocument): SchemaNode => {
    const components = asObject(d['components'])
    return (components === null ? null : asObject(components['schemas'])) ?? {}
  }
  const local = schemasOf(doc)
  const shared = schemasOf(errors)

  const deref = (node: SchemaNode, depth = 0): SchemaNode => {
    if (depth > 64) return node
    const ref = node['$ref']
    if (typeof ref !== 'string') return node
    const here = LOCAL_POINTER.exec(ref)
    if (here !== null) {
      const target = asObject(local[here[1] ?? ''])
      if (target !== null) return deref(target, depth + 1)
    }
    const there = ERRORS_POINTER.exec(ref)
    if (there !== null) {
      const target = asObject(shared[there[1] ?? ''])
      if (target !== null) return deref(target, depth + 1)
    }
    unresolved.push(ref)
    return node
  }

  return { deref: (node) => deref(node), unresolvedRefs: () => unresolved }
}

/** One place a `required` property was declared and no value was carried. */
export interface Missing {
  /** A JSON-pointer-ish path into the BODY, e.g. `items[0].execution`. */
  readonly at: string
  /** The property name the contract declares as `required`. */
  readonly property: string
}

/**
 * Every `required` property the contract declares and `value` does not carry.
 *
 * 🛑 `undefined` AND ABSENT ARE THE SAME THING AND `null` IS NOT. A key present
 * with the value `null` IS carried — the contract says so in several places by
 * declaring `type: [T, 'null']` — so treating `null` as missing would report a
 * violation the document expressly permits. `fast-json-stringify` agrees:
 * measured at 7.0.1, an absent required property throws and a null one does
 * not.
 *
 * 🛑 A UNION IS SATISFIED WHEN ANY ARM IS, AND THAT IS THE ONLY DEFENSIBLE
 * READING. `oneOf` arms carry DIFFERENT `required` lists — `EvidenceState` has
 * three — so requiring every arm's list would report two violations on every
 * correct body. The cost is named rather than hidden: a value matching NO arm
 * is reported against the arm that fits it best (fewest missing), which can
 * under-report by naming one arm's gap instead of "matches nothing".
 */
export function missingRequired(
  value: unknown,
  schema: SchemaNode,
  resolve: Resolver,
  at = '',
  depth = 0,
): readonly Missing[] {
  if (depth > 32) return []
  const s = resolve.deref(schema)

  const arms = [...nodesOf(s['oneOf']), ...nodesOf(s['anyOf'])]
  if (arms.length > 0) {
    let best: readonly Missing[] | null = null
    for (const arm of arms) {
      const found = missingRequired(value, arm, resolve, at, depth + 1)
      if (found.length === 0) return []
      if (best === null || found.length < best.length) best = found
    }
    return best ?? []
  }

  const items = asObject(s['items'])
  if (items !== null && Array.isArray(value)) {
    const out: Missing[] = []
    value.forEach((element, index) => {
      out.push(...missingRequired(element, items, resolve, `${at}[${index}]`, depth + 1))
    })
    return out
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) return []

  const carried = value as { readonly [k: string]: unknown }
  const properties = asObject(s['properties']) ?? {}
  const out: Missing[] = []

  for (const property of stringsOf(s['required'])) {
    if (!(property in carried) || carried[property] === undefined) {
      out.push({ at: at === '' ? '<root>' : at, property })
    }
  }

  for (const [key, child] of Object.entries(properties)) {
    if (!(key in carried) || carried[key] === undefined) continue
    const childSchema = asObject(child)
    if (childSchema === null) continue
    out.push(
      ...missingRequired(
        carried[key],
        childSchema,
        resolve,
        at === '' ? key : `${at}.${key}`,
        depth + 1,
      ),
    )
  }

  return out
}

/** `getRun` → the declared `application/json` schema of its 2xx response. */
export interface DeclaredSuccess {
  readonly operationId: string
  readonly method: string
  /** The OpenAPI path template, e.g. `/runs/{runId}`. */
  readonly template: string
  readonly status: string
  readonly schema: SchemaNode | null
}

const METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const

/** Every operation a tier declares, with its success-response schema. */
export function declaredSuccesses(doc: OpenApiDocument): readonly DeclaredSuccess[] {
  const paths = asObject(doc['paths']) ?? {}
  const out: DeclaredSuccess[] = []
  for (const [template, itemNode] of Object.entries(paths)) {
    const item = asObject(itemNode)
    if (item === null) continue
    for (const method of METHODS) {
      const operation = asObject(item[method])
      if (operation === null) continue
      const operationId = operation['operationId']
      if (typeof operationId !== 'string') continue
      const responses = asObject(operation['responses']) ?? {}
      const success = Object.entries(responses).find(([status]) => status.startsWith('2'))
      if (success === undefined) continue
      const [status, node] = success
      const response = asObject(node)
      const content = response === null ? null : asObject(response['content'])
      const json = content === null ? null : asObject(content['application/json'])
      const schema = json === null ? null : asObject(json['schema'])
      out.push({ operationId, method: method.toUpperCase(), template, status, schema })
    }
  }
  return out
}

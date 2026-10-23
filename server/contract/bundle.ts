/**
 * ONE OPENAPI SCHEMA NODE → ONE SELF-CONTAINED JSON SCHEMA.
 *
 * Ajv (request validation) and fast-json-stringify (response serialisation)
 * both want a schema that resolves entirely within itself. OpenAPI schemas do
 * not: they `$ref` into `#/components/schemas/…` and, in these documents, into
 * `./errors.yaml#/components/schemas/…` as well.
 *
 * This walks a node, pulls every LOCAL `$ref` target it reaches into `$defs`,
 * rewrites the pointers, and stops.
 *
 * 🛑 AN EXTERNAL `$ref` IS A THROW, NOT A SKIP, AND THAT IS THE DESIGN. Silently
 * dropping a `$ref` it could not resolve would produce a schema that validates
 * LESS than the contract says — the §5.6 shape, a validator that passes while
 * asserting nothing, arriving through the back door of an error nobody handled.
 * A boot that cannot bundle an operation's schema fails at boot, where it is one
 * stack trace instead of a silent hole in a running server.
 *
 * The consequence, stated rather than discovered: the RFC 9457 `Problem`
 * responses in every tier `$ref` `./errors.yaml`, so they do not bundle and are
 * not wired as response schemas. They are serialised by `server/http/problem.ts`
 * instead, which takes its closed code enum from `errors.yaml` at import time —
 * a different route to the same document, not a second vocabulary.
 */

import type { JsonValue, OpenApiDocument } from './document.ts'

const LOCAL_SCHEMA_REF = /^#\/components\/schemas\/([A-Za-z0-9_.-]+)$/

export type JsonSchema = { [k: string]: JsonValue }

export class ExternalRefError extends Error {}

function resolvePointer(doc: OpenApiDocument, name: string): JsonValue {
  const components = doc['components']
  if (typeof components !== 'object' || components === null || Array.isArray(components)) {
    throw new ExternalRefError(`the document has no \`components\`, so \`${name}\` cannot resolve`)
  }
  const schemas = (components as { [k: string]: JsonValue })['schemas']
  if (typeof schemas !== 'object' || schemas === null || Array.isArray(schemas)) {
    throw new ExternalRefError(`the document has no \`components.schemas\``)
  }
  const found = (schemas as { [k: string]: JsonValue })[name]
  if (found === undefined) {
    throw new ExternalRefError(`\`#/components/schemas/${name}\` is not in this document`)
  }
  return found
}

/**
 * Bundle `node` against `doc`.
 *
 * Throws `ExternalRefError` on any `$ref` this cannot resolve inside `doc` —
 * including every `./errors.yaml#/…` pointer, which is the common case and is
 * expected by the caller.
 */
export function bundleSchema(doc: OpenApiDocument, node: JsonValue): JsonSchema {
  const defs = new Map<string, JsonValue>()
  const pending: string[] = []

  const walk = (value: JsonValue): JsonValue => {
    if (Array.isArray(value)) return value.map(walk)
    if (typeof value !== 'object' || value === null) return value

    const obj = value as { [k: string]: JsonValue }
    const ref = obj['$ref']
    if (typeof ref === 'string') {
      const match = LOCAL_SCHEMA_REF.exec(ref)
      if (match === null) {
        throw new ExternalRefError(`\`${ref}\` is not a local \`#/components/schemas/…\` pointer`)
      }
      const name = match[1] ?? ''
      if (!defs.has(name)) {
        // Placeholder FIRST, so a schema that references itself terminates.
        defs.set(name, true)
        pending.push(name)
      }
      // A sibling of `$ref` is ignored by OpenAPI 3.0 and honoured by 3.1;
      // these documents never write one, so the pointer is returned alone.
      return { $ref: `#/$defs/${name}` }
    }

    const out: { [k: string]: JsonValue } = {}
    for (const [k, v] of Object.entries(obj)) out[k] = walk(v)
    return out
  }

  const root = walk(node)
  while (pending.length > 0) {
    const name = pending.shift() as string
    defs.set(name, walk(resolvePointer(doc, name)))
  }

  if (typeof root !== 'object' || root === null || Array.isArray(root)) {
    throw new ExternalRefError('the schema node is not an object')
  }
  const bundled = root as JsonSchema
  if (defs.size === 0) return bundled
  const $defs: { [k: string]: JsonValue } = {}
  for (const [k, v] of defs) $defs[k] = v
  return { ...bundled, $defs }
}

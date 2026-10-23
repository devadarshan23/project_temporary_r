/**
 * THE ROUTE TABLE, DERIVED. Nothing in `server/` writes a URL.
 *
 * RULING 1: the OpenAPI files are the router. So `paths` × methods IS the route
 * table, the declared `parameters` ARE the request schema, and the declared
 * `security` IS whether a session is required. A route this function does not
 * emit cannot be served, because `server/http/app.ts` registers exactly what it
 * returns and nothing else.
 *
 * ┌─ THE STRUCTURAL FENCE THIS BUYS ───────────────────────────────────────────┐
 * │ `mountTier()` (app.ts) takes a handler map keyed by operationId and refuses │
 * │ to boot if any key is not an operationId in the document. So a handler for  │
 * │ an undeclared operation is a start-up failure, not a route. The contract    │
 * │ cannot be a subset of what the server serves; it can only be a superset.    │
 * │                                                                            │
 * │ The other direction is deliberately NOT enforced: an operation declared     │
 * │ with no handler is simply not registered, and its path 404s. Registering it │
 * │ with a "not implemented" body would need a code from `errors.yaml`'s CLOSED │
 * │ enum, and there isn't one that means "declared and unbuilt" — inventing one │
 * │ is a contract change, and a contract change is not this slice's to make.    │
 * └────────────────────────────────────────────────────────────────────────────┘
 */

import type { JsonValue, OpenApiDocument } from './document.ts'
import { ANNOTATION_KEY, callerOf, classifyAnnotation, type Annotation, type CallerKind } from './capability.ts'
import { bundleSchema, ExternalRefError, type JsonSchema } from './bundle.ts'

/** The HTTP methods OpenAPI puts inside a path item. */
export const OPERATION_KEYS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options'] as const
export type OperationKey = (typeof OPERATION_KEYS)[number]

export interface RouteSpec {
  readonly method: Uppercase<OperationKey>
  /** Fastify form: `/v1/runs/:runId`, prefix already applied. */
  readonly url: string
  readonly operationId: string
  /**
   * Derived from the operation's `security`, falling back to the document's.
   * A non-empty requirement list means a session is required.
   *
   * ⚠️ AN EMPTY ARRAY IS NOT ABSENCE. `security: []` on an operation is OpenAPI
   * for "this one is public" and overrides a document-level requirement; a
   * missing key inherits. The two are distinguished below because collapsing
   * them would make every liveness probe require a session, or — far worse in
   * the other direction — make every capability operation public.
   */
  readonly secured: boolean
  /**
   * WHO IS ON THE OTHER END — derived from the SAME resolved `security` as
   * `secured`, one line below it, and classified by
   * `server/contract/capability.ts`'s `callerOf()`. **G912, 20 Sep 2026.**
   *
   * 🛑 IT IS CARRIED BESIDE `secured` RATHER THAN DERIVED AT EACH READER
   * BECAUSE THERE ARE THREE READERS AND THEY MUST NOT DISAGREE: `mountTier()`'s
   * fourth and fifth fences, and `tools/check-capability-annotations.mjs`'s
   * checks E and F. The alternative — each recomputing the operation-versus-
   * document fallback — is §5.3, two implementations of one resolution, and the
   * one that drifts is always the copy.
   *
   * ⚠️ `secured` AND `caller` ANSWER DIFFERENT QUESTIONS AND ONE DOES NOT
   * IMPLY THE OTHER'S ANSWER. `secured` is *"is a scheme required"*; `caller`
   * is *"whose"*. Fourteen control-plane operations are `secured: true` with
   * `caller: 'machine'`, which is exactly the pair check E needs and which a
   * boolean cannot express.
   */
  readonly caller: CallerKind
  /**
   * The operation's `x-capability`, CLASSIFIED — G200's mechanism half.
   *
   * 🛑 DERIVED IN THE SAME WALK AS EVERYTHING ELSE HERE, AND THAT IS THE WHOLE
   * DESIGN. `tools/check-capability-annotations.mjs` — which was
   * `tests/contracts/annotations.mjs` until the gate landed — already walked
   * `paths` × `OPERATION_KEYS` and said in its own comment that it was "the same
   * product `routesOf()` walks, so this cannot see an operation the router
   * cannot, or miss one it can." Reading the key HERE makes that sentence structural
   * instead of aspirational: the router and the annotation checker are now the
   * same walk over the same document, and there is no third place where a
   * capability could be assigned.
   *
   * ⚠️ WHAT IT IS NOT: A HAND-MAINTAINED MAP. `server/http/app.ts` refuses one
   * by name for `security` — "the artefact that always ends up one entry stale
   * in the wrong direction" — and an operationId→capability table in TypeScript
   * would be exactly that artefact, one axis over. All 76 declared operations
   * already carry the key; 38 name a capability and 38 carry `exempt: <reason>`.
   * Derive both, never read them:
   * `grep -c 'x-capability' docs/contracts/*.openapi.yaml`.
   *
   * ⚠️ AND IT IS CLASSIFIED, NOT VALIDATED. `absent` and `malformed` are
   * REPRESENTABLE here on purpose — the same polarity as `unvalidatableBody`
   * above. A document that lost its annotation must produce a spec that SAYS so,
   * so that `mountTier()` can refuse at registration with a message naming the
   * operation. Throwing here would take a whole tier down over one operation
   * nobody mounts.
   */
  readonly capability: Annotation
  /**
   * The declared `requestBody`'s `application/json` schema, bundled.
   *
   * 🛑 THIS KEY DID NOT EXIST, AND THE COMMENT THAT STOOD HERE SAID ITS ABSENCE
   * WAS NOT AN OVERSIGHT: "Every operation this slice registers is a GET. A
   * `requestBody` bundler with no caller is a claim the tree cannot witness —
   * the §5.10 shape … It is added by the commit that registers the first POST,
   * alongside a test that sends one." THAT REASONING IS PRESERVED BECAUSE IT IS
   * STILL HALF TRUE, AND THE HALF THAT IS NOT IS STATED RATHER THAN QUIETLY
   * DROPPED.
   *
   * What changed: `schemaFromParameters()` made the document the validator for
   * the query string, the path and the headers, and left the BODY — the one
   * place `docs/contracts/README.md` says a tenant may never be named — reaching
   * no validator at all. "Schema-first" was therefore a claim about ROUTING
   * only. This closes it for every operation that declares a `requestBody`.
   *
   * ✅ **THE MOUNTING HALF LANDED 19 Sep 2026 — G357 — AND THE PARAGRAPH BELOW
   * IS CORRECTED RATHER THAN DELETED, because it is the sentence that told a
   * reader this key had no live witness.** It read: *"⚠️ AND HERE IS WHAT IS
   * STILL NOT WITNESSED, STATED PLAINLY. No POST is mounted by either plane
   * today, so no LIVE request yet proves that a mounted route refuses a bad
   * body."*
   *
   * **`assignException` is mounted and it is a PUT with a `requestBody`** —
   * `PUT /v1/exceptions/{exceptionId}/assignment`, the first write either
   * plane serves. ⚠️ *A PUT AND NOT A POST*, which is worth saying because the
   * old sentence named the wrong verb and a reader grepping for `post` would
   * have concluded nothing had changed. `tests/http/exception-served.test.ts`
   * §7c is the live request: a body with an undeclared key, and a body missing
   * the `required` one, both answered 400 by this schema through ajv.
   * **`admitRun` is still not mounted** and that half is unchanged.
   *
   * What was already witnessed and still is, through Fastify and through the
   * plane's own ajv options, is the mechanism and its DERIVATION:
   * `tests/contracts/request-body-schema.test.ts` mutates the parsed capability
   * document and requires the emitted schema to follow it in three directions,
   * so this is driven by the contract rather than transcribed from it.
   */
  readonly schema: {
    querystring?: JsonSchema
    params?: JsonSchema
    headers?: JsonSchema
    body?: JsonSchema
    response?: { [status: string]: JsonSchema }
  }
  /**
   * Responses whose schema could not be bundled, with the reason. Always the
   * `Problem` responses — they `$ref` `./errors.yaml`. Carried rather than
   * dropped so a boot log can state what is unvalidated instead of implying
   * everything is.
   */
  readonly unwiredResponses: ReadonlyArray<readonly [string, string]>
  /**
   * Set when the operation declares a `requestBody` whose schema could not be
   * bundled. `mountTier()` refuses to register such an operation, because a
   * route with an unvalidated body is worse than an absent route.
   */
  readonly unvalidatableBody?: string
}

function obj(value: JsonValue | undefined): { [k: string]: JsonValue } | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as { [k: string]: JsonValue }
}

/** `#/components/parameters/Limit` → the parameter object. */
function resolveParameter(doc: OpenApiDocument, node: JsonValue): { [k: string]: JsonValue } {
  const asObject = obj(node)
  if (asObject === null) throw new Error('a `parameters` entry is not an object')
  const ref = asObject['$ref']
  if (typeof ref !== 'string') return asObject
  const match = /^#\/components\/parameters\/([A-Za-z0-9_.-]+)$/.exec(ref)
  if (match === null) throw new Error(`\`${ref}\` is not a local parameter pointer`)
  const components = obj(doc['components'])
  const parameters = components === null ? null : obj(components['parameters'])
  const found = parameters === null ? undefined : parameters[match[1] ?? '']
  const resolved = obj(found)
  if (resolved === null) throw new Error(`\`${ref}\` does not resolve in this document`)
  return resolved
}

/** `/runs/{runId}` → `/runs/:runId`. */
function toFastifyPath(template: string): string {
  return template.replace(/\{([^}]+)\}/g, ':$1')
}

function schemaFromParameters(
  doc: OpenApiDocument,
  parameters: ReadonlyArray<{ [k: string]: JsonValue }>,
  where: 'query' | 'path' | 'header',
): JsonSchema | undefined {
  const properties: { [k: string]: JsonValue } = {}
  const required: string[] = []
  /**
   * 🛑 THE `$defs` OF EVERY PARAMETER ARE HOISTED TO THE ROOT, AND THIS IS A
   *    FIX RATHER THAN A STYLE. READ IT BEFORE COLLAPSING IT BACK.
   *
   * `bundleSchema()` returns a SELF-CONTAINED schema: it rewrites each
   * `#/components/schemas/X` pointer to `#/$defs/X` and attaches a `$defs`
   * beside it. That is correct for a BODY or a RESPONSE, where the bundled
   * node IS the root schema.
   *
   * It is wrong here, because a parameter's bundled schema becomes a PROPERTY
   * of a larger object — so the `$defs` lands nested at
   * `properties.domain.$defs` while the pointer inside it still reads
   * `#/$defs/DomainKey`. **A plain-fragment `$ref` resolves against the
   * schema's BASE URI, which is the root, not against the subschema it sits
   * in.** Ajv therefore looks for `$defs` at the root, finds none, and Fastify
   * refuses to build the route:
   *
   *     FST_ERR_SCH_VALIDATION_BUILD — Failed building the validation schema
   *     for GET: /v1/exceptions, due to error can't resolve reference
   *     #/$defs/DomainKey from id #
   *
   * ⚠️ THIS DEFECT IS OLDER THAN THE COMMIT THAT FOUND IT AND HAD NEVER FIRED,
   *    WHICH IS WHY IT IS WORTH A PARAGRAPH. It has been here since
   *    `schemaFromParameters()` was written, and no mounted operation had a
   *    non-path parameter whose schema `$ref`s a component — so the whole
   *    class was unreachable. `listExceptions` (three such parameters) and
   *    `getExceptionFacets` (one) are the first, and `listThreads` is the next
   *    one waiting. **The failure is a BOOT failure and not a silent hole**,
   *    which is `bundle.ts`'s own design working: *"A boot that cannot bundle
   *    an operation's schema fails at boot, where it is one stack trace
   *    instead of a silent hole in a running server."*
   *
   * A NAME COLLISION BETWEEN TWO PARAMETERS IS NOT POSSIBLE TO GET WRONG:
   * every key here comes from `#/components/schemas/<name>` in ONE document,
   * so the same name is the same schema by construction. The merge is
   * last-write-wins and every write is identical.
   */
  const defs: { [k: string]: JsonValue } = {}
  for (const parameter of parameters) {
    if (parameter['in'] !== where) continue
    const rawName = parameter['name']
    if (typeof rawName !== 'string') continue
    // Node lowercases every incoming header name, so a schema keyed
    // `X-Schema-Version` would validate a property that is never present —
    // and, with `required`, would refuse every request that carries it.
    const name = where === 'header' ? rawName.toLowerCase() : rawName
    const schema = parameter['schema']
    if (schema === undefined) {
      properties[name] = {}
    } else {
      const { $defs, ...rest } = bundleSchema(doc, schema)
      if (typeof $defs === 'object' && $defs !== null && !Array.isArray($defs)) {
        for (const [k, v] of Object.entries($defs as { [k: string]: JsonValue })) defs[k] = v
      }
      properties[name] = rest
    }
    if (parameter['required'] === true) required.push(name)
  }
  /**
   * 🛑 AN EMPTY PROPERTY SET IS `undefined` ON HEADERS AND ON PATH PARAMETERS,
   *    AND IT IS A CLOSED EMPTY OBJECT ON THE QUERY STRING. **G941,
   *    20 Sep 2026.**
   *
   * ⛔ **THIS LINE READ `if (Object.keys(properties).length === 0) return
   *    undefined` FOR EVERY `where`, AND THE OLD FORM IS QUOTED RATHER THAN
   *    DELETED BECAUSE FOUR DOCUMENTS AND TWO TEST FILES CITE IT BY GREP** —
   *    `docs/HANDOFF.md` §8, `tests/http/run-account-served.test.ts` §4d and
   *    `tests/http/correspondence-served.test.ts` §3 all derived the hole with
   *    `grep -n 'if (Object.keys(properties).length === 0) return undefined'
   *    server/contract/routes.ts`.
   *
   * ⛔ **AND THE SENTENCE THAT STOOD HERE — *"That grep now returns nothing,
   *    which is the intended answer and not a rot"* — WAS FALSE ABOUT ITS OWN
   *    FILE AND IS CORRECTED RATHER THAN DELETED (G1095, 20 Sep 2026). THE
   *    GREP RETURNS `1`, AND THE ONE MATCH IS THIS BANNER**, quoting the
   *    retired line in order to say it is retired. `token-verify.ts` had
   *    already named the class in the same wave: *"a derivation over a tree
   *    that contains its own documentation has to count FILES, or strip
   *    comments, or be a test."* **Strip the comments, and the property is the
   *    one line that survives:**
   *
   *      grep -n 'return undefined' server/contract/routes.ts | grep -v "^[0-9]*: *\*"
   *
   *    → exactly one, and it carries `&& where !== 'query'`. The PROPERTY
   *    itself, which no grep can answer, is
   *    `tests/http/parameter-free-querystring.test.ts` §4a.
   *
   * THE DEFECT IT CAUSED: an operation declaring no query parameter got NO
   * querystring schema, so the `additionalProperties: false` fifteen lines
   * below — the keyword that makes ajv REJECT under `removeAdditional: false`
   * — rode on a schema that was never built. Fastify registers such a route
   * with no querystring validation at all, and `?tenantId=ten_globex` against
   * it is parsed, handed to the handler and IGNORED.
   *
   * ⚠️ **INVARIANT 1 WAS NEVER BREACHED BY THAT AND THAT IS WHY IT SURVIVED
   *    THREE MOUNTING WAVES.** *"Tenant scope is derived from the session,
   *    never read from a request"* — nothing read the key. What was missing is
   *    the SECOND LINE OF DEFENCE, and `server/http/app.ts` states the cost in
   *    its own voice: *"ignored and read look identical from outside and only
   *    one of them is the property"*, and rejecting *"makes the attempt visible
   *    in a status code, a log line and a metric."*
   *
   * 🛑 **THE SIZE OF IT WAS MEASURED BEFORE IT WAS FIXED, AND IT IS NOT A
   *    HANDFUL: 122 OF 136 DECLARED OPERATIONS CARRIED NO QUERYSTRING SCHEMA.**
   *    The fourteen that refused an undeclared key were the ones that happen to
   *    PAGE or FILTER — `listRunResidue` refused because it declares `cursor`
   *    and `limit`, and `getRunAccount` one path segment away did not. Same
   *    invariant, two behaviours, decided by whether an operation took a
   *    `limit`. `tests/http/parameter-free-querystring.test.ts` carries that
   *    measurement as its captured red.
   *
   * ⚠️ **THE OTHER TWO `where` VALUES KEEP THE OLD ANSWER AND THE ARGUMENTS ARE
   *    THIS FUNCTION'S OWN, RESTATED HERE BECAUSE A WIDER FIX IS THE OBVIOUS
   *    ONE.** On HEADERS a closed object refuses every real request — a browser
   *    sends a dozen headers no contract declares. On PATH parameters it is
   *    meaningless: the router produces exactly the parameters in the template,
   *    so the object is either inert or refuses everything. §5a and §5b of that
   *    suite are what would catch a fix that widened.
   *
   * ⚠️ **AND THE KEY IT KEYS ON IS `where`, NOT "does this operation declare
   *    parameters".** A by-id read has a NON-EMPTY `parameters` array carrying
   *    one PATH parameter, so a repair keyed on that convenient landmark would
   *    have left every `GET /v1/runs/{runId}` in the corpus exactly as open as
   *    before — §5.1, and §3a of that suite is the assertion that would fail.
   */
  if (Object.keys(properties).length === 0 && where !== 'query') return undefined

  const out: JsonSchema = { type: 'object', properties }
  if (required.length > 0) out['required'] = required
  if (Object.keys(defs).length > 0) out['$defs'] = defs
  /**
   * 🛑 `additionalProperties: false` ON THE QUERY STRING AND NOWHERE ELSE.
   *
   * On the query string it is invariant 1's second line of defence: a request
   * carrying `?tenantId=…` is REFUSED rather than quietly ignored, because
   * "ignored" and "read" look identical from outside and only one of them is
   * the property. `server/http/app.ts` sets `removeAdditional: false` so ajv
   * rejects instead of stripping.
   *
   * On HEADERS it would refuse every real request — a browser sends a dozen
   * headers no contract declares. On PATH parameters it is meaningless: the
   * router produces exactly the parameters in the template.
   */
  if (where === 'query') out['additionalProperties'] = false
  return out
}

/**
 * The operation's `requestBody` → one bundled JSON Schema, or a stated reason
 * why not.
 *
 * ⚠️ `application/json` ONLY. These documents declare no other request media
 * type; one that appeared would be reported rather than ignored, because
 * ignoring it registers a route that accepts an UNVALIDATED body.
 *
 * ⚠️ `required: true` IS NOT ENFORCED HERE AND THAT IS FASTIFY'S DOING, NOT A
 * DECISION. Fastify applies a body schema only when a body is present; an
 * operation whose `requestBody.required` is `true` and which is sent none is
 * refused by the framework's own content-type handling, not by this schema. It
 * is named because "the contract is the validator" must not be read as a claim
 * this function does not make.
 *
 * 🛑 A BODY THAT CANNOT BE BUNDLED IS REPORTED, NEVER DROPPED, AND THE REFUSAL
 * IS PER-OPERATION RATHER THAN PER-DOCUMENT.
 *
 * Dropping it would register a route that accepts an unvalidated body — the
 * §5.6 shape, a validator that passes while asserting nothing. Throwing outright
 * would be fail-closed in the right direction and wrong in its blast radius: one
 * unbundleable body anywhere in a document would stop the whole plane booting,
 * including every operation that has nothing to do with it. `mountTier()`
 * therefore refuses at REGISTRATION — an operation whose body could not be
 * bundled cannot be served, and naming it in a handler map is a boot failure.
 *
 * 🛑 THAT IS NOT A HYPOTHETICAL AND THE THROW WOULD HAVE BROKEN A LIVE PLANE.
 * FIVE operations across two tiers `$ref` `./errors.yaml` from inside a request
 * body — `emitSpan` in the foundation tier, and `sendHeartbeat`,
 * `shipUsageEvents`, `submitUsageAttestation` and `reportPackInstallation` in
 * the CONTROL PLANE, which is mounted. A document-wide throw would have stopped
 * `server/control-plane/start.ts` booting to serve `listEntitledPacks`, an
 * operation with no body at all. Reproduce by bundling every tier; the
 * capability tier bundles all sixteen of its bodies cleanly.
 *
 * 🛑 ONE HOLE IS LEFT OPEN DELIBERATELY AND IS RAISED RATHER THAN CLOSED HERE.
 * This function answers a question about an operation that DECLARES a
 * `requestBody`. An operation declaring NONE returns `kind: 'none'` correctly —
 * and if it is a POST, Fastify will still parse a JSON body and hand it to the
 * handler with no schema and no fence. `executeProposal`
 * (`POST /v1/proposals/{proposalId}/execution`, capability tier) is exactly
 * that shape and is the only one in the four documents. It is not mounted, so
 * nothing is unvalidated today.
 *
 * Whether `mountTier()` should refuse ANY POST/PUT/PATCH whose `schema.body` is
 * undefined is a wider ruling than the one this function makes — it binds every
 * future write operation and it needs the owner, not a helper. Named here so
 * the next person to mount a write meets it before their body does.
 */
type BodyResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'schema'; readonly schema: JsonSchema }
  | { readonly kind: 'unbundleable'; readonly reason: string }

function bodySchema(doc: OpenApiDocument, operation: { [k: string]: JsonValue }): BodyResult {
  const requestBody = obj(operation['requestBody'])
  if (requestBody === null) return { kind: 'none' }
  if (typeof requestBody['$ref'] === 'string') {
    return {
      kind: 'unbundleable',
      reason: `\`${requestBody['$ref']}\` — a shared requestBody object, which this function has not been taught`,
    }
  }
  /**
   * 🛑 FROM HERE DOWN, `kind: 'none'` IS UNREACHABLE, AND THAT IS THE WHOLE
   * POINT OF THE THREE REFUSALS BELOW.
   *
   * `none` means "this operation declares no request body" — it is what makes
   * `mountTier()` register a GET without one. An operation that DOES declare a
   * `requestBody` and yields `none` is a different thing wearing the same
   * answer: a route registered with no body schema and no `unvalidatableBody`
   * flag, so the fence never fires and the body reaches the handler unchecked.
   * That is §5.6 — a validator that passes while asserting nothing — inside the
   * function written against it.
   *
   * Two of these three were `return { kind: 'none' }` and both are corrected
   * rather than deleted, because a reader would have taken them for a decision.
   */
  const content = obj(requestBody['content'])
  if (content === null) {
    return {
      kind: 'unbundleable',
      // `content` is REQUIRED on a Request Body Object. Reaching here means the
      // document is malformed, not that the operation takes no body.
      reason: 'the `requestBody` declares no `content` at all',
    }
  }

  const json = obj(content['application/json'])
  if (json === null) {
    return {
      kind: 'unbundleable',
      reason: `the \`requestBody\` declares ${Object.keys(content).join(', ')} and no \`application/json\``,
    }
  }
  const schema = json['schema']
  if (schema === undefined) {
    return {
      kind: 'unbundleable',
      reason: 'the `requestBody` declares `application/json` with no `schema`',
    }
  }
  try {
    return { kind: 'schema', schema: bundleSchema(doc, schema) }
  } catch (err) {
    if (!(err instanceof ExternalRefError)) throw err
    return { kind: 'unbundleable', reason: err.message }
  }
}

function responseSchemas(
  doc: OpenApiDocument,
  operation: { [k: string]: JsonValue },
): { wired: { [status: string]: JsonSchema }; unwired: Array<readonly [string, string]> } {
  const wired: { [status: string]: JsonSchema } = {}
  const unwired: Array<readonly [string, string]> = []
  const responses = obj(operation['responses'])
  if (responses === null) return { wired, unwired }

  for (const [status, node] of Object.entries(responses)) {
    const response = obj(node)
    if (response === null) continue
    if (typeof response['$ref'] === 'string') {
      // A shared response object — `#/components/responses/Unauthenticated` and
      // its siblings. Every one of them is an RFC 9457 `Problem`, so every one
      // of them would fail to bundle; recorded, not attempted.
      unwired.push([status, `\`${response['$ref']}\` — a shared response object`])
      continue
    }
    const content = obj(response['content'])
    const json = content === null ? null : obj(content['application/json'])
    if (json === null) {
      // `text/plain`, an empty body, or a `$ref`d shared response. Nothing to serialise.
      continue
    }
    const schema = json['schema']
    if (schema === undefined) continue
    try {
      wired[status] = bundleSchema(doc, schema)
    } catch (err) {
      if (!(err instanceof ExternalRefError)) throw err
      unwired.push([status, err.message])
    }
  }
  return { wired, unwired }
}

/**
 * Every operation in `doc`, as a route.
 *
 * `basePath` is `basePathOf(doc)` — passed in rather than read here so a caller
 * mounting two tiers on one listener can see, at the call site, which prefix
 * each one lands on.
 */
export function routesOf(doc: OpenApiDocument, basePath: string): readonly RouteSpec[] {
  const paths = obj(doc['paths'])
  if (paths === null) return []
  const documentSecurity = doc['security']
  const documentSecured = Array.isArray(documentSecurity) && documentSecurity.length > 0

  const out: RouteSpec[] = []
  for (const [template, pathItemNode] of Object.entries(paths)) {
    const pathItem = obj(pathItemNode)
    if (pathItem === null) continue
    const sharedParameters = Array.isArray(pathItem['parameters']) ? pathItem['parameters'] : []

    for (const key of OPERATION_KEYS) {
      const operation = obj(pathItem[key])
      if (operation === null) continue
      const operationId = operation['operationId']
      if (typeof operationId !== 'string') {
        throw new Error(`\`${key.toUpperCase()} ${template}\` has no operationId`)
      }

      const own = Array.isArray(operation['parameters']) ? operation['parameters'] : []
      const parameters = [...sharedParameters, ...own].map((p) => resolveParameter(doc, p))

      const operationSecurity = operation['security']
      const effectiveSecurity = Array.isArray(operationSecurity) ? operationSecurity : documentSecurity
      const secured = Array.isArray(operationSecurity)
        ? operationSecurity.length > 0
        : documentSecured

      const querystring = schemaFromParameters(doc, parameters, 'query')
      const params = schemaFromParameters(doc, parameters, 'path')
      const headers = schemaFromParameters(doc, parameters, 'header')
      const body = bodySchema(doc, operation)
      const { wired, unwired } = responseSchemas(doc, operation)

      out.push({
        method: key.toUpperCase() as Uppercase<OperationKey>,
        url: `${basePath}${toFastifyPath(template)}`,
        operationId,
        secured,
        caller: callerOf(effectiveSecurity),
        capability: classifyAnnotation(operation[ANNOTATION_KEY]),
        schema: {
          ...(querystring === undefined ? {} : { querystring }),
          ...(params === undefined ? {} : { params }),
          ...(headers === undefined ? {} : { headers }),
          ...(body.kind === 'schema' ? { body: body.schema } : {}),
          ...(Object.keys(wired).length === 0 ? {} : { response: wired }),
        },
        unwiredResponses: unwired,
        ...(body.kind === 'unbundleable' ? { unvalidatableBody: body.reason } : {}),
      })
    }
  }
  return out
}

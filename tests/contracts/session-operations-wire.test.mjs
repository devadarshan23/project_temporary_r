/**
 * THE OPERATIONS THAT GET A PERSON THROUGH THE DOOR — #231 [A-9b].
 *
 * `X-Session` is demanded by three tiers and issued by none;
 * `POST /context/resolve` takes a `sessionToken` body field with no producer in
 * the system. These operations are the producer.
 *
 * ┌─ THE COUNT IS FOUR, NOT SIX, AND EVERY REMOVAL IS RULED OR DERIVED ────────┐
 * │                                                                            │
 * │  #231 names six. Two are gone and each is asserted absent below.           │
 * │                                                                            │
 * │  presentSecondFactor   G223. "NO SECOND FACTOR IN v1 … FEDERATION IS THE   │
 * │                        ANSWER." The row says so in the issue's own terms:  │
 * │                        "#231 declares FIVE operations rather than six."    │
 * │                                                                            │
 * │  signInWithPassword    NOT RULED — DERIVED, by #231's OWN TEST, applied a  │
 * │                        second time. The issue drops `presentSecondFactor`  │
 * │                        because "this operation has no model behind it …    │
 * │                        rather than shipping a wire for a mechanism that    │
 * │                        does not exist." Run the same grep one noun over:   │
 * │                        `grep -rniE '\bpassword\b' model/*.ts | wc -l` → 2, │
 * │                        and BOTH hits are prose about the system being      │
 * │                        REPLACED ("returned other users' passwords from     │
 * │                        list_users"). There is no credential type, no       │
 * │                        verification function, and — decisively — NO        │
 * │                        REFUSAL VOCABULARY. Every response it could declare │
 * │                        would be invented, and the first one anybody        │
 * │                        invents means "wrong credential", which is a        │
 * │                        USER-EXISTENCE ORACLE minted on the exact surface   │
 * │                        this pair of issues exists to keep free of one.     │
 * │                                                                            │
 * │  🛑 THE DROP IS NOT THIS SLICE CLOSING THE QUESTION. It is the same shape  │
 * │  G223 was for the second factor and it wants the same one-act ruling. The  │
 * │  likely reading, offered and NOT asserted: `cognito_pool` is "the managed  │
 * │  fallback pool", Cognito's hosted UI speaks OIDC, and a pool sign-in may   │
 * │  therefore BE a federated sign-in through `completeFederatedSignIn` — in   │
 * │  which case the operation is unnecessary rather than unbuilt, which would  │
 * │  explain why `model/` has no password anything. Until it is ruled, the     │
 * │  cost is stated: the pool-directory sign-in path has no wire.              │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 ASSERTION 3 IS RECAST AND THE RECAST IS THE POINT. #231 asks for
 * "identical responses for a known and an unknown address", witnessed by
 * CALLING the operation. There is nothing to call: G200 freezes MOUNTING, this
 * tier lands declared-and-unmounted, and a test that spun a server for it would
 * be taking the decision that ruling reserves. So the property is asserted
 * STRUCTURALLY instead, which is strictly stronger than a two-call witness: the
 * operation is never GIVEN a user to look up, and cannot return one.
 * `routeToConnection(connections, domain)` takes a domain, and every one of its
 * four refusals "names a domain and a connection … and never a person" — in the
 * model's own words. The request schema admits exactly `domain`; two addresses
 * at one domain produce a byte-identical request, so identical responses are a
 * consequence of the shape rather than an observation about one implementation.
 *
 * ⚠️ WHAT IS *NOT* CLOSED, AND IT IS NAMED HERE RATHER THAN LEFT TO BE FOUND.
 * Distinguishing a claimed domain from an unclaimed one is a DOMAIN-existence
 * signal — a weaker leak than user existence, and a real one. It is not
 * invented away here, because collapsing the four arms on the wire would depart
 * from the model this slice exists to mirror. It is an input the D6 threat
 * model owes an answer to (G165, treated as concurrent by G248), and it is
 * written into the PR body rather than only here.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'

import { DOMAIN_ROUTING_REFUSALS, SIGN_IN_ATTEMPT_REFUSALS } from '../../model/domain.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const TIER = path.join(ROOT, 'docs', 'contracts', 'session.openapi.yaml')

/** The methods `server/contract/routes.ts` walks. Same product, same blind spots. */
const OPERATION_KEYS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']

/**
 * Any tier in this directory, parsed. Added with G386's assertion 6d, which is
 * the one place four documents are required to agree about the credential.
 */
function load(file) {
  const text = readFileSync(path.join(ROOT, 'docs', 'contracts', file), 'utf8')
  const doc = parse(text)
  assert.ok(doc && typeof doc === 'object', `${file} did not parse to an object.`)
  return doc
}

function tier() {
  let text
  try {
    text = readFileSync(TIER, 'utf8')
  } catch (e) {
    assert.fail(
      `docs/contracts/session.openapi.yaml does not exist (${e.code ?? e.message}). Every ` +
        'assertion in this file reads it.',
    )
  }
  const doc = parse(text)
  assert.ok(doc && typeof doc === 'object', 'session.openapi.yaml did not parse to an object.')
  return doc
}

/** Every declared operation, flattened. The same walk `annotations.mjs` performs. */
function operations() {
  const doc = tier()
  const out = []
  const paths = doc.paths ?? {}
  for (const [route, item] of Object.entries(paths)) {
    if (!item || typeof item !== 'object') continue
    for (const method of OPERATION_KEYS) {
      const op = item[method]
      if (!op || typeof op !== 'object') continue
      out.push({ route, method, op, operationId: op.operationId })
    }
  }
  return out
}

function operation(id) {
  const found = operations().find((o) => o.operationId === id)
  assert.ok(found, `No operation with operationId \`${id}\` on the session tier.`)
  return found
}

/**
 * RESOLVE A LOCAL `$ref`, ONCE.
 *
 * External refs (`./errors.yaml#/…`) resolve to `null` deliberately: the shared
 * Problem schema is another file's to check, and following it would make this
 * scan's verdict depend on a document it does not govern.
 */
function deref(doc, ref) {
  if (!ref.startsWith('#/')) return null
  let node = doc
  for (const seg of ref.slice(2).split('/')) {
    if (!node || typeof node !== 'object') return null
    node = node[seg.replace(/~1/g, '/').replace(/~0/g, '~')]
  }
  return node ?? null
}

/**
 * EVERY PROPERTY NAME REACHABLE FROM A SCHEMA, FOLLOWING `$ref`.
 *
 * A RECURSIVE SCAN AND NOT A FLAT GREP, because a recursive `$ref` scan is what
 * found invariant 1's two existing wire deviations and `tools/check-wire-mirror.mjs`
 * "does not resolve `$ref` targets" by its own admission — the `$ref`-resolving
 * half of G109 is still unbuilt and still unclaimed, so this walk is written by
 * hand rather than borrowed.
 *
 * Returns `[{ name, at }]` so a failure names WHERE, not just WHAT.
 */
function propertyNamesDeep(doc, schema, at = '', seen = new Set()) {
  const found = []
  if (!schema || typeof schema !== 'object') return found

  if (typeof schema.$ref === 'string') {
    if (seen.has(schema.$ref)) return found
    seen.add(schema.$ref)
    const target = deref(doc, schema.$ref)
    return target ? propertyNamesDeep(doc, target, `${at}→${schema.$ref}`, seen) : found
  }

  if (schema.properties && typeof schema.properties === 'object') {
    for (const [name, sub] of Object.entries(schema.properties)) {
      found.push({ name, at: `${at}.${name}` })
      found.push(...propertyNamesDeep(doc, sub, `${at}.${name}`, seen))
    }
  }
  for (const key of ['items', 'additionalProperties', 'not', 'if', 'then', 'else']) {
    if (schema[key] && typeof schema[key] === 'object') {
      found.push(...propertyNamesDeep(doc, schema[key], `${at}.${key}`, seen))
    }
  }
  for (const key of ['allOf', 'anyOf', 'oneOf', 'prefixItems']) {
    if (Array.isArray(schema[key])) {
      schema[key].forEach((sub, i) => {
        found.push(...propertyNamesDeep(doc, sub, `${at}.${key}[${i}]`, seen))
      })
    }
  }
  return found
}

/** The request-body schema of an operation, or `null` when it declares none. */
function requestSchema(op) {
  const content = op.requestBody?.content
  if (!content || typeof content !== 'object') return null
  const first = Object.values(content)[0]
  return first?.schema ?? null
}

/**
 * THE MODEL'S OWN KEY LIST FOR `Session`, READ FROM SOURCE.
 *
 * `SessionKey` is a module-private `type` alias in `model/identity.ts`, so it
 * cannot be imported — and it is the right thing to read anyway.
 * `_SessionCarriesExactlyTheseKeys` proves under `tsc`, BIDIRECTIONALLY, that
 * this union is exactly `keyof Session`; the docblock records that weakening it
 * to a single `extends` compiled green through a DELETED field. So this list is
 * a value the type checker guarantees equals the interface, which is a firmer
 * derivation than harvesting an interface body out of a file full of docblocks.
 */
function sessionKeysFromModel() {
  const text = readFileSync(path.join(ROOT, 'model', 'identity.ts'), 'utf8')
  const lines = text.split('\n')
  const start = lines.findIndex((l) => l === 'type SessionKey =' || l.startsWith('type SessionKey = '))
  assert.notEqual(
    start,
    -1,
    'No `type SessionKey =` in model/identity.ts. The declaration this file derives ' +
      '`SessionView` from has moved or been renamed; find it with ' +
      "`grep -n 'SessionKey' model/identity.ts` rather than hard-coding the keys here.",
  )
  let end = start + 1
  while (end < lines.length && /^\s*\|/.test(lines[end] ?? '')) end++
  const keys = []
  for (const raw of lines.slice(start, end).join('\n').split('|').slice(1)) {
    const m = raw.trim().match(/^'([A-Za-z0-9_]+)'$/)
    if (m) keys.push(m[1])
  }
  assert.ok(keys.length > 0, '`type SessionKey` parsed to no members; the scan above is wrong.')
  return keys
}

/**
 * THE TWO KEYS THE WIRE OMITS, EACH WITH ITS OWN ARGUMENT.
 *
 * `handleDigest`  the credential's shadow. "`id` is what an `AuditEvent` or a
 *                 `SignInAttempt` cites and may appear in a log; `handleDigest`
 *                 is the credential's shadow and appears in neither." #231 names
 *                 this one.
 *
 * `secondFactorAt` @dropped-for-v1 under G223, whose row says NOTHING MAY GIVE
 *                 IT A PRODUCER. A wire field is a producer. #231 predates the
 *                 ruling and asks for `Omit<Session, 'handleDigest'>`; G223
 *                 outranks it, and shipping the field would be the wire-for-a-
 *                 mechanism-that-does-not-exist the same issue refuses one
 *                 operation later.
 */
const OMITTED_FROM_SESSION_VIEW = ['handleDigest', 'secondFactorAt']

/** Names that would make a request body a tenant-bearing one. Invariant 1. */
const TENANT_BEARING = /tenant/i

/** The org axis. "That is the ORG AXIS READ FROM A REQUEST — invariant 1's shape, one axis over." */
const ORG_BEARING = /^(orgClass|accountId|partnerId)$/

/** Anything that could name a PERSON. The realm operation may carry none of these. */
const USER_BEARING = /(email|address|user|username|login|principal|subject|upn|person|account)/i

/* ==================================================================== *
 * 0 · THE §5.6 GUARDS.
 * ==================================================================== */

test('guard · the session tier declares operations for the assertions below to walk', () => {
  const ops = operations()
  assert.ok(
    ops.length > 0,
    'The session tier declares zero operations, so every assertion below passes vacuously. ' +
      "Derive: `grep -c 'operationId:' docs/contracts/session.openapi.yaml`.",
  )
  const anonymous = ops.filter((o) => typeof o.operationId !== 'string' || o.operationId === '')
  assert.deepEqual(
    anonymous.map((o) => `${o.method} ${o.route}`),
    [],
    'An operation on this tier carries no `operationId`. `mountTier()` refuses to BOOT on a ' +
      'handler naming an operationId no contract declares, so an anonymous operation is one ' +
      'nothing can ever serve.',
  )
})

test('guard · the model vocabularies this file reasons about loaded', () => {
  assert.equal(Object.values(DOMAIN_ROUTING_REFUSALS).length, 4)
  assert.equal(Object.values(SIGN_IN_ATTEMPT_REFUSALS).length, 4)
})

/* ==================================================================== *
 * 1 · THE OPERATIONS, BY NAME.
 * ==================================================================== */

test('assertion 1 · exactly the five operations, on the routes named', () => {
  const declared = operations()
    .map((o) => `${o.method.toUpperCase()} ${o.route} → ${o.operationId}`)
    .sort()
  assert.deepEqual(
    declared,
    [
      'DELETE /session → signOut',
      'GET /session → getSession',
      /* G3354, 3 Oct 2026 — the chrome's who-am-I (derived). */
      'GET /session/principal → getSessionPrincipal',
      /* G2549, 2 Oct 2026 — the owner's shared-callback ruling (G2762). */
      'GET /session/signin/return → relayBrokerReturn',
      'POST /session/federated → completeFederatedSignIn',
      'POST /session/realm → resolveHomeRealm',
      /* G2541, 1 Oct 2026 — the owner's begin-sign-in ruling. This list said
         FOUR until then, and the message below still argues the four. */
      'POST /session/signin → beginFederatedSignIn',
    ],
    'The session tier declares something other than the SEVEN operations it carries since G3354 ' +
      '(six since G2549, five since G2541). ' +
      'Four operations across THREE paths — `GET` and `DELETE` share `/session`, which is why ' +
      "the operation count and the path count differ and why #231's `grep -c '^  /' → 6` was " +
      `never going to hold.\n\nDeclared:\n  ${declared.join('\n  ')}`,
  )
})

test('assertion 1b · the two operations #231 named and this slice does not declare', () => {
  const ids = operations().map((o) => o.operationId)
  assert.equal(
    ids.includes('presentSecondFactor'),
    false,
    'G223: "NO SECOND FACTOR IN v1. `Session.secondFactorAt` IS `@dropped-for-v1` AND ' +
      '`POST /session/second-factor` IS NOT DECLARED. FEDERATION IS THE ANSWER." The second ' +
      "factor belongs to the directory that authenticates the person; ours beside it is a " +
      "second authenticator competing with the customer's policy.",
  )
  assert.equal(
    ids.includes('signInWithPassword'),
    false,
    'There is no password anywhere in `model/` — `grep -rniE \'\\bpassword\\b\' model/*.ts` ' +
      'returns two hits and both are prose about the system being replaced. No credential ' +
      'type, no verification function, and no refusal vocabulary, so every response this ' +
      'operation could declare would be invented — starting with one meaning "wrong ' +
      'credential", which is the user-existence oracle this tier is built not to have. It ' +
      'wants a ruling of the same shape as G223, not a transcription of the issue.',
  )
})

test('assertion 1c · neither dropped tenant-selection operation reappears', () => {
  const routes = new Set(operations().map((o) => o.route))
  const ids = new Set(operations().map((o) => o.operationId))
  const reappeared = [
    ...[...routes].filter((r) => /^\/session\/tenants?$/.test(r)),
    ...[...ids].filter((i) => /^(listSessionTenants|selectSessionTenant)$/.test(i)),
  ]
  assert.deepEqual(
    reappeared,
    [],
    'G210 DROPS `GET /session/tenants` and `POST /session/tenant` — "not deferred, because a ' +
      'deferred selection operation is a selector with a later date on it." A login surface ' +
      'with a tenant selector defeats invariant 1 by RELOCATION. ' +
      `\`selectTenantForSession()\` is the CHECK, never the CHOOSER.\n\n${reappeared.join(' · ')}`,
  )
})

/* ==================================================================== *
 * 2 · INVARIANT 1, BY RECURSIVE `$ref` SCAN.
 * ==================================================================== */

test('assertion 2 · no request body on any session operation names a tenant', () => {
  const doc = tier()
  const offenders = []
  for (const o of operations()) {
    const schema = requestSchema(o.op)
    if (!schema) continue
    for (const p of propertyNamesDeep(doc, schema)) {
      if (TENANT_BEARING.test(p.name)) offenders.push(`${o.operationId}${p.at}`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'Invariant 1: tenant scope is derived from the session, never read from a request. A ' +
      'request that could state its tenant could state the WRONG one. This is the tier where ' +
      'it would matter most — the caller is unauthenticated on two of these four operations. ' +
      `\n\nTenant-bearing: ${offenders.join(' · ')}`,
  )
})

test('assertion 2b · no request body names the org axis either', () => {
  const doc = tier()
  const offenders = []
  for (const o of operations()) {
    const schema = requestSchema(o.op)
    if (!schema) continue
    for (const p of propertyNamesDeep(doc, schema)) {
      if (ORG_BEARING.test(p.name)) offenders.push(`${o.operationId}${p.at}`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "`OrgClass` derives from the authenticating connection's owner on every resolve and is " +
      'never stored and never supplied. `SignInAttempt.connectionId` is PINNED AT REDIRECT ' +
      'for exactly this reason: "re-choosing at callback lets a caller name a different ' +
      'connection than the one it was sent to, and org class derives from a connection\'s ' +
      `owner. That is the ORG AXIS READ FROM A REQUEST."\n\nOrg-bearing: ${offenders.join(' · ')}`,
  )
})

/* ==================================================================== *
 * 3 · THE REALM LOOKUP RETURNS NO USER-EXISTENCE SIGNAL.
 * ==================================================================== */

test('assertion 3 · resolveHomeRealm is never given a user to look up', () => {
  const doc = tier()
  const { op } = operation('resolveHomeRealm')
  const schema = requestSchema(op)
  assert.ok(schema, '`resolveHomeRealm` declares no request body. It routes on a domain.')

  const resolved = typeof schema.$ref === 'string' ? deref(doc, schema.$ref) : schema
  assert.deepEqual(
    Object.keys(resolved?.properties ?? {}).sort(),
    ['domain'],
    'The realm request must admit exactly `domain` and nothing else. THIS IS THE SECURITY ' +
      'PROPERTY IN ITS STRUCTURAL FORM: an operation handed an email address can be made to ' +
      'differ between "no such user" and "wrong credential"; an operation handed a DOMAIN ' +
      'cannot, because two addresses at one domain are one request. ' +
      '`routeToConnection(connections, domain)` takes exactly this, and the client splits ' +
      'the address locally — the address never leaves the browser until the door is chosen.',
  )
  assert.equal(
    resolved?.additionalProperties,
    false,
    'The realm request must set `additionalProperties: false`. ajv is configured ' +
      '`removeAdditional: false` so it REJECTS rather than strips — under the default a ' +
      'smuggled field is silently deleted and the request served, which satisfies the rule ' +
      'and leaves no evidence that it did.',
  )
})

test('assertion 3b · nothing in the realm closure can name a person', () => {
  const doc = tier()
  const { op } = operation('resolveHomeRealm')
  const offenders = []

  const req = requestSchema(op)
  if (req) {
    for (const p of propertyNamesDeep(doc, req)) {
      if (USER_BEARING.test(p.name)) offenders.push(`request${p.at}`)
    }
  }
  for (const [status, response] of Object.entries(op.responses ?? {})) {
    for (const media of Object.values(response?.content ?? {})) {
      for (const p of propertyNamesDeep(doc, media?.schema)) {
        if (USER_BEARING.test(p.name)) offenders.push(`response ${status}${p.at}`)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'A field naming a person reached the realm operation. `SignInAttempt` deliberately ' +
      'carries NO `userId` — "before the door answers there is no principal, and a `userId` ' +
      'written at redirect would be a USER-EXISTENCE ORACLE on an UNAUTHENTICATED surface" — ' +
      'and `_SignInAttemptCarriesNoUserId` makes adding one a compile error. The wire may not ' +
      `re-open through a schema what the model closed through a type.\n\n${offenders.join(' · ')}`,
  )
})

test('assertion 3c · the status channel is not a second oracle', () => {
  const { op } = operation('resolveHomeRealm')
  const refusals = Object.keys(op.responses ?? {}).filter((s) => !/^2/.test(s))
  assert.equal(
    refusals.length,
    1,
    'Every routing refusal must share ONE status code, with the closed `ErrorCode` carrying ' +
      'the distinction. #231 names the failure exactly: "returning `404` for an unknown ' +
      'address is the natural thing to write and it is a user-existence oracle." Two statuses ' +
      'put the distinction in a channel a caller can read without parsing a body, and one of ' +
      `them will eventually be keyed on something narrower than a domain.\n\nDeclared: ${refusals.join(' · ')}`,
  )
})

test('assertion 3d · the realm response returns an id and never a connection', () => {
  const doc = tier()
  const { op } = operation('resolveHomeRealm')
  const ok = op.responses?.['200']?.content?.['application/json']?.schema
  assert.ok(ok, '`resolveHomeRealm` declares no 200 body.')
  const resolved = typeof ok.$ref === 'string' ? deref(doc, ok.$ref) : ok
  assert.deepEqual(
    Object.keys(resolved?.properties ?? {}).sort(),
    ['connectionId'],
    'The success arm must mirror `DomainRouting` exactly: "Routing chooses the door; the door ' +
      'decides. This returns an id, never a connection, and never an org." Widening it to ' +
      'carry `protocol` or `label` — so a client can tell which form to render — is a MODEL ' +
      'question, because `routeToConnection()` returns an id by design. A slice that widens ' +
      'it on the wire alone has minted the second vocabulary this tier exists not to mint.',
  )
})

/* ==================================================================== *
 * 4 · `SessionView` IS DERIVED, NOT A SECOND VOCABULARY.
 * ==================================================================== */

test('assertion 5 · SessionView is Session minus exactly two argued omissions', () => {
  const doc = tier()
  const view = doc.components?.schemas?.SessionView
  assert.ok(view, 'The session tier declares no `SessionView` schema.')

  const modelKeys = sessionKeysFromModel()
  const expected = modelKeys.filter((k) => !OMITTED_FROM_SESSION_VIEW.includes(k)).sort()
  const actual = Object.keys(view.properties ?? {}).sort()

  assert.deepEqual(
    actual,
    expected,
    'DERIVED, NOT TRANSCRIBED. `SessionView` is `Session` minus `handleDigest` and ' +
      '`secondFactorAt`, and this assertion reads the key list out of `model/identity.ts` so ' +
      'that a field added to the row goes RED here rather than quietly missing from the wire. ' +
      `\n\nmodel SessionKey: ${modelKeys.join(' · ')}\nexpected: ${expected.join(' · ')}\n` +
      `declared: ${actual.join(' · ')}`,
  )
})

test('assertion 5b · the digest and the dropped field are absent everywhere on the tier', () => {
  const doc = tier()
  const offenders = []
  for (const [name, schema] of Object.entries(doc.components?.schemas ?? {})) {
    for (const p of propertyNamesDeep(doc, schema, name)) {
      if (p.name === 'secondFactorAt') offenders.push(`${p.at} (G223: dropped, no producer)`)
    }
  }
  for (const o of operations()) {
    for (const [status, response] of Object.entries(o.op.responses ?? {})) {
      for (const media of Object.values(response?.content ?? {})) {
        for (const p of propertyNamesDeep(doc, media?.schema)) {
          if (p.name === 'handleDigest') {
            offenders.push(`${o.operationId} response ${status}${p.at} (the credential's shadow)`)
          }
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '`handleDigest` is the credential\'s shadow and must appear in no response; ' +
      '`secondFactorAt` is `@dropped-for-v1` under G223, whose row says nothing may give it a ' +
      `producer — and a wire field is a producer.\n\n${offenders.join('\n')}`,
  )
})

test('assertion 5c · authentication mints a session with no tenant scope', () => {
  /**
   * ⚠️ THE 200 THIS READ IS GONE — S6, 1 Oct 2026, G2491 — AND THE PROPERTY IS
   * STRONGER FOR IT, NOT WEAKER. The success answer is a `303` with a cookie
   * and a PATH, and NO BODY: there is nothing on the wire a tenant could ride
   * in. `MintedSession` still states the minted row's shape and is still held
   * to `tenantId: { const: null }` below, because it is the declaration a
   * future body would have to use.
   */
  const doc = tier()
  const { op } = operation('completeFederatedSignIn')
  const success = Object.keys(op.responses ?? {}).filter((s) => /^[23]/.test(s))
  assert.deepEqual(success, ['303'], 'the sign-in callback answers success with something other than a 303')
  assert.equal(
    op.responses['303'].content,
    undefined,
    'the 303 carries a BODY. A minted session is a cookie and a path; a body is a place a tenant could be handed out at the door.',
  )
  const schema = doc.components?.schemas?.MintedSession
  assert.ok(schema, 'the session tier no longer declares `MintedSession`.')

  const flat = JSON.stringify(schema)
  assert.match(
    flat,
    /"tenantId":\{"const":null\}/,
    'The minted session must constrain `tenantId` to `null` on the wire, not merely permit ' +
      'it. `completeFederatedSignIn` mints a session with `tenantId: null` PRECISELY SO THAT ' +
      'AUTHENTICATION CANNOT CONFER A SCOPE — a nullable field that a success response is ' +
      'allowed to fill is a scope handed out at the door, which is what `selectTenantForSession()` ' +
      `exists to check afterwards.\n\nDeclared: ${flat}`,
  )
})

/* ==================================================================== *
 * 6 · SECURITY COMES FROM THE DOCUMENT, PER OPERATION.
 * ==================================================================== */

test('assertion 6 · the two unauthenticated operations inherit `security: []`', () => {
  const doc = tier()
  assert.deepEqual(doc.security, [], 'The tier must declare `security: []` at document level.')
  for (const id of ['resolveHomeRealm', 'completeFederatedSignIn', 'beginFederatedSignIn']) {
    const { op } = operation(id)
    assert.equal(
      op.security,
      undefined,
      `\`${id}\` overrides the document-level \`security: []\`. It is the operation a caller ` +
        'reaches WITHOUT a session — demanding one would make it unreachable, and 401ing ' +
        'before validation (which G191 does deliberately, in `onRequest`) would make it ' +
        'answer nothing at all.',
    )
  }
})

test('assertion 6b · the two session-bearing operations demand one, from the document', () => {
  for (const id of ['getSession', 'signOut']) {
    const { op } = operation(id)
    assert.deepEqual(
      op.security,
      [{ sessionContext: [] }],
      `\`${id}\` reads or revokes the CALLER'S OWN session and must declare its scheme per ` +
        'operation. G191: whether a route is secured is read from the document\'s own ' +
        'per-operation `security`, never from a list in code — "the artefact that always ends ' +
        'up one entry stale in the wrong direction." Document-level `[]` is the fallback for ' +
        'the two that have no session yet; these two override it.',
    )
  }
})

test('assertion 6c · the scheme the overrides name is declared on this tier', () => {
  const doc = tier()
  const scheme = doc.components?.securitySchemes?.sessionContext
  assert.ok(
    scheme,
    'The tier names `sessionContext` per operation and declares no such scheme. A security ' +
      'requirement pointing at nothing is a route that reads as secured and is not.',
  )
  assert.equal(scheme.type, 'apiKey')
  /**
   * 🛑 G386, 19 Sep 2026 — THIS ASSERTED `in: 'header'` AND
   *    `name: 'X-Session'` AND IS CORRECTED RATHER THAN DELETED. ITS OLD
   *    MESSAGE IS THE REASON THE CORRECTION HAS TO BE FOUR TIERS WIDE:
   *
   *      "The header must be `X-Session` — the same one the capability,
   *       foundation and control-plane tiers demand. This tier exists because
   *       that scheme had no producer anywhere; a differently-named header
   *       here would leave it with none."
   *
   * The ruling retires `X-Session` from the production path: the handle is an
   * `HttpOnly` cookie, and the header survives only behind
   * `RECONCILE_LOCAL_TEST_AUTH` in `server/dev/session-header.ts`. **The
   * sentence above still binds, on the new name** — which is why `capability`,
   * `foundation` and `administration` moved in the same commit and are
   * asserted here too, in one place, rather than each tier being trusted to
   * have followed.
   *
   * ⚠️ THE CONTROL-PLANE TIER IS DELIBERATELY NOT IN THE LIST. Its
   * `sessionContext` is a MACHINE CHANNEL SECRET read from
   * `RECONCILE_CONTROL_*` — `server/control-plane/start.ts` — and no browser
   * is involved. Two different credentials shared a header name; they differ
   * in the contract now as they always differed in fact, and sweeping it in
   * would have declared a cookie on a surface no cookie reaches.
   */
  assert.equal(
    scheme.in,
    'cookie',
    'The session credential is a COOKIE under G386. `in: header` here would re-declare ' +
      'the channel the ruling retired, and a client reading this document would write a ' +
      'header no deployed plane holds code to read.',
  )
  assert.equal(
    scheme.name,
    '__Host-reconcile_session',
    'The cookie name must match `server/data-plane/session-cookie.ts` exactly — the ' +
      '`__Host-` prefix is part of the NAME and is what makes the cookie host-only at the ' +
      'user agent, which is G180`s threat refused before our code runs.',
  )
})

test('assertion 6d · the three BROWSER tiers agree on the scheme, and the control plane does not', () => {
  /**
   * 🛑 ONE PLACE WHERE FOUR DOCUMENTS ARE REQUIRED TO AGREE, because the
   * alternative is four places that each look right. G386 moved the credential
   * and the obvious defect is moving it on the tier you are editing; the
   * session tier would then ISSUE a cookie three tiers still declare as a
   * header.
   */
  const browserTiers = ['capability', 'foundation', 'session', 'administration']
  for (const name of browserTiers) {
    const doc = load(`${name}.openapi.yaml`)
    const s = doc.components?.securitySchemes?.sessionContext
    assert.ok(s, `\`${name}\` declares no \`sessionContext\` scheme at all`)
    assert.equal(s.in, 'cookie', `\`${name}\` still declares the retired header channel`)
    assert.equal(
      s.name,
      '__Host-reconcile_session',
      `\`${name}\` names a different credential than the tier that issues it`,
    )
  }

  const control = load('control-plane.openapi.yaml')
  const cs = control.components?.securitySchemes?.sessionContext
  if (cs !== undefined) {
    assert.notEqual(
      cs.in,
      'cookie',
      'THE CONTROL PLANE WAS SWEPT INTO THE COOKIE CHANGE. Its credential is a machine ' +
        'channel secret from `RECONCILE_CONTROL_*` and no browser reaches it, so declaring ' +
        'a cookie there publishes a channel nothing sets and nothing reads.',
    )
  }
})

/* ==================================================================== *
 * 7 · NO CAPABILITY, AND THAT IS CORRECT.
 * ==================================================================== */

test('assertion 7 · every session operation states its exemption, and none names a capability', () => {
  const bad = []
  for (const o of operations()) {
    const a = o.op['x-capability']
    if (typeof a !== 'string' || a.trim() === '') {
      bad.push(`${o.operationId}: no x-capability`)
      continue
    }
    if (!a.startsWith('exempt:')) bad.push(`${o.operationId}: names a capability (${a})`)
    else if (a.slice('exempt:'.length).trim().length < 20) {
      bad.push(`${o.operationId}: reason under 20 chars`)
    }
    if ('x-partner-exposure' in o.op) {
      bad.push(`${o.operationId}: states a partner exposure it cannot have`)
    }
  }
  assert.deepEqual(
    bad,
    [],
    'CAPABILITIES: NONE, AND THAT IS CORRECT. `decide()` needs a `PrincipalContext` carrying ' +
      'a `tenantId`, and pre-session there is none — a capability here is a verb with no ' +
      'noun. But an exemption with no reason beside it is indistinguishable from an ' +
      `oversight, so each states one on the operation.\n\n${bad.join('\n')}`,
  )
})

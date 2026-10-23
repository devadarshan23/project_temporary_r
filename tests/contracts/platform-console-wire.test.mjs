/**
 * THE ASSERTIONS THAT TRAVELLED WITH THE OPERATIONS, AND THE ONES THE SPLIT
 * ITSELF MADE NECESSARY.
 *
 * ┌─ THE FAILURE THIS FILE EXISTS TO PREVENT, STATED FIRST ────────────────────┐
 * │ `tests/contracts/administration-wire.test.mjs` assertion G3 walks EVERY    │
 * │ schema in that document for sixteen forbidden property names — invariant  │
 * │ 3, "the control plane publishes downward and never reads tenant data",    │
 * │ held by a name check over the whole file.                                 │
 * │                                                                            │
 * │ Fourteen operations and twenty exclusive schemas left that file. Had this │
 * │ suite not been written, invariant 3 would have become UNASSERTED for all  │
 * │ of them, `npm run check` would have stayed green, and nothing anywhere    │
 * │ would have said so. **An absence is what a review misses**, and a split   │
 * │ is the operation most likely to produce one: the assertion stays with the │
 * │ file, not with the operations.                                            │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ IT IS NOT A COPY OF ITS SIBLING AND THE DIFFERENCES ARE DELIBERATE.
 * Assertions A–D of that file (the annotation grammar) are NOT reproduced: this
 * tier IS registered, so `tools/check-capability-annotations.mjs` applies the
 * same `classifyAnnotation()` to every operation here as a gate stage, and a
 * second copy would be the §5.6 shape that file's own header warns about.
 * Assertion E is INVERTED — that file asserts no operation names a capability;
 * here every one must — and it lives in
 * `tests/contracts/platform-console-reachability.test.mjs` with the model join
 * that makes it mean something.
 *
 * 🛑 IT PARSES WITH `yaml` RATHER THAN SCANNING LINES — G109.
 */

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'

import { CAPABILITIES } from '../../model/access.ts'
import { ACCESS_RESOURCE_CLASSES } from '../../model/governance.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FILE = 'docs/contracts/platform-console.openapi.yaml'
const CONTRACTS = path.join(ROOT, 'docs', 'contracts')

const raw = readFileSync(path.join(ROOT, FILE), 'utf8')
const doc = parse(raw)
const METHODS = ['get', 'post', 'put', 'patch', 'delete']

const OPS = []
for (const [route, item] of Object.entries(doc.paths ?? {})) {
  for (const method of METHODS) {
    const op = item?.[method]
    if (op === undefined || op === null) continue
    OPS.push({
      route,
      method,
      operationId: typeof op.operationId === 'string' ? op.operationId : `${method} ${route}`,
      plane: op['x-plane'],
      authority: op['x-admin-authority'],
      partnerExposure: op['x-partner-exposure'],
      responseCodes: Object.keys(op.responses ?? {}),
      tags: op.tags ?? [],
    })
  }
}

const name = (xs) => [...xs].sort().join(', ')

test('guard · the document parses and declares the operations this file checks', () => {
  assert.ok(
    OPS.length >= 10,
    `only ${OPS.length} operation(s) loaded from ${FILE}, so every assertion below would pass ` +
      `on an empty input. Derive the truth: grep -c 'operationId:' ${FILE}`,
  )
  const anonymous = OPS.filter((o) => o.operationId.includes(' '))
  assert.deepEqual(
    anonymous.map((o) => `${o.method} ${o.route}`),
    [],
    'an operation with no operationId cannot be named by any message below, and under G191 ' +
      'cannot be mounted at all — `mountTier()` matches a handler key against an operationId.',
  )
})

/* ==================================================================== *
 * G2/G3 · CARRIED FROM `administration-wire.test.mjs`. These are the
 * assertions that would otherwise have been silently dropped for the
 * operations that moved.
 * ==================================================================== */

const PLANES = ['platform', 'tenant']

test('§G1 · every operation carries a plane tag from the closed vocabulary', () => {
  const bad = OPS.filter((o) => !PLANES.includes(o.plane)).map((o) => `${o.operationId} (${o.plane})`)
  assert.deepEqual(
    bad,
    [],
    'G76: "every operation carries a plane tag." The tag travelled with the operations rather ' +
      `than being dropped as redundant on a single-host file. Vocabulary: ${PLANES.join(' | ')}`,
  )
})

test('§G2 · x-plane is `tenant` EXACTLY when the path addresses one', () => {
  const mismatched = OPS.filter((o) => (o.plane === 'tenant') !== o.route.includes('{tenantId}')).map(
    (o) => `${o.operationId} (${o.plane}) at ${o.route}`,
  )
  assert.deepEqual(
    mismatched,
    [],
    'THE IFF IS THE POINT, IN BOTH DIRECTIONS. A `tenant`-tagged operation with no {tenantId} ' +
      'claims a scope its route cannot express; a `platform`-tagged one that names a tenant has ' +
      'a scope its tag denies.',
  )
  // AND THE ONE THAT IS `tenant`, NAMED — so that a second one arriving is a
  // decision somebody took rather than a thing that happened. §3 of the
  // document argues why this single operation belongs on a platform tier: the
  // tenant is the SUBJECT of the act, never the scope it runs in.
  const tenantPlaned = OPS.filter((o) => o.plane === 'tenant').map((o) => o.operationId)
  assert.deepEqual(
    tenantPlaned,
    ['openByoaEscalation'],
    'EXACTLY ONE OPERATION HERE NAMES A TENANT, and it is a decision about a tenant\'s future ' +
      'SUBSTRATE rather than a reach into it — which is why it carries ' +
      '`x-admin-authority: platform-role` and why the nine operations that genuinely reach into ' +
      'one tenant are all `tenant-access-grant` and all stayed on the administration tier. A ' +
      'second name here is a reach that needs arguing, not a line to update.',
  )
})

test('§G3 · no schema in this tier carries tenant business data — invariant 3, carried across the split', () => {
  // The list and the walk are `administration-wire.test.mjs` G3's, deliberately
  // identical: the property is one property, and two spellings of it would
  // drift. `control-plane.openapi.yaml` §2, adopted verbatim there and here.
  const FORBIDDEN = [
    'exceptionId',
    'exceptions',
    'documentId',
    'documents',
    'extractedValue',
    'extractedValues',
    'counterparty',
    'counterpartyName',
    'definitionName',
    'definitionId',
    'matchRuleId',
    'proposalId',
    'runId',
    'lineIndex',
    'sourceDocumentId',
    'costCentre',
  ]
  const schemas = doc.components?.schemas ?? {}
  assert.ok(Object.keys(schemas).length >= 10, 'the schemas must be loaded for this to mean anything')
  const hits = []
  const walk = (node, where) => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach((n) => walk(n, where))
    for (const [k, v] of Object.entries(node)) {
      if (k === 'properties' && v !== null && typeof v === 'object') {
        for (const prop of Object.keys(v)) if (FORBIDDEN.includes(prop)) hits.push(`${where}.${prop}`)
      }
      if (k !== 'description' && k !== 'summary') walk(v, where)
    }
  }
  for (const [schemaName, schema] of Object.entries(schemas)) walk(schema, schemaName)

  assert.deepEqual(
    hits.sort(),
    [],
    'INVARIANT 3: "the control plane publishes downward and never reads tenant data." This is ' +
      'the assertion the split was most likely to lose: it walks a FILE, and fourteen operations ' +
      'with twenty exclusive schemas left the file it used to walk.\n\n' +
      '⚠️ THIS IS A NAME CHECK AND ITS SILENCE IS NOT EVIDENCE OF ABSENCE. It cannot see a ' +
      'tenant value under a name nobody listed — the same blind spot `tools/planner/extract.mjs` ' +
      `has and states.\n\nFound: ${hits.join(' · ')}`,
  )
})

/* ==================================================================== *
 * H · `x-admin-authority`, and the one that DOES now resolve.
 * ==================================================================== */

test('§H · the authority named here is the one G289 built, and it no longer points at nothing', () => {
  const bad = OPS.filter((o) => o.authority !== 'platform-role').map((o) => `${o.operationId} (${o.authority})`)
  assert.deepEqual(bad, [], 'this tier is the `platform-role` subset by construction')

  // `administration-wire.test.mjs` H2 is INVERTED — it requires unbacked
  // authorities to exist and says "if every operation here became backed,
  // somebody has taken the ruling §2 of the document says is owed". That
  // happened, for this subset, and this is the other side of it.
  assert.ok(
    Object.values(CAPABILITIES).includes('view_substrate'),
    'G601 minted the platform verbs; without them `platform-role` points at nothing again and ' +
      'this whole tier reverts to an exemption argument.',
  )
  assert.ok(
    Object.values(ACCESS_RESOURCE_CLASSES).includes('substrate'),
    'the substrate class must still exist for the verbs above to be classified',
  )
})

/* ==================================================================== *
 * J · THE REST OF THE WIRE — carried.
 * ==================================================================== */

test('§J1 · every operation can refuse — 401 and 403 on all of them', () => {
  const noAuthn = OPS.filter((o) => !o.responseCodes.includes('401')).map((o) => o.operationId)
  const noDenied = OPS.filter((o) => !o.responseCodes.includes('403')).map((o) => o.operationId)
  assert.deepEqual(
    [...noAuthn.map((x) => `401:${x}`), ...noDenied.map((x) => `403:${x}`)].sort(),
    [],
    'AND ON THIS TIER THE 403 IS NO LONGER HYPOTHETICAL, which is the difference the split makes: ' +
      'every operation here names a capability, so `decide()` can actually answer no. G200\'s ' +
      'premise was that "`getRun` DECLARES A `404` AND NOT EVEN A `403` … the wire expresses ' +
      'authorisation as a response code with nothing behind it."',
  )
})

test('§J2 · no request body anywhere carries a tenant id — invariant 1', () => {
  const schemas = doc.components?.schemas ?? {}
  const offenders = []
  for (const [schemaName, schema] of Object.entries(schemas)) {
    if (!schemaName.endsWith('Request')) continue
    const props = Object.keys(schema?.properties ?? {})
    for (const p of ['tenantId', 'tenant', 'tenantRef', 'tenant_id']) {
      if (props.includes(p)) offenders.push(`${schemaName}.${p}`)
    }
  }
  assert.deepEqual(
    offenders.sort(),
    [],
    'INVARIANT 1: "tenant scope is derived from the session, never read from a request." A ' +
      'tenant is named in ONE path here and that is a different thing, argued in §3 of the ' +
      `document: the path names the SUBJECT of an act.\n\nFound: ${offenders.join(' · ')}`,
  )
})

test('§J3 · every error code this file leans on is a member of the closed enum', () => {
  const errors = parse(readFileSync(path.join(CONTRACTS, 'errors.yaml'), 'utf8'))
  const declared = new Set(errors.components.schemas.ErrorCode.enum)
  assert.ok(declared.size > 80, `the enum must be loaded for this to mean anything: ${declared.size}`)

  // THE SPLIT MINTED NO CODE AND MUST NOT. Every refusal named below was
  // already a member before the cut; `errors.yaml` is CLOSED, and a code cited
  // here and absent there is a refusal no tier can ever return.
  const LEANED_ON = [
    'capability_not_held',
    'session_invalid',
    'resource_not_found',
    'validation_failed',
    'idempotency_conflict',
    // THE TWO THAT MOVED WHOLE. `administration-wire.test.mjs` J3 listed these
    // and its second half — "`${c}` is listed as leaned-on and does not appear
    // in ${FILE}" — is what went RED on the split and made the move visible
    // rather than silent. They are the pack builder's, and `addPackDraftRule`
    // is here now.
    'admitting_step_carries_tools',
    'tool_out_of_scope',
  ]
  const missing = LEANED_ON.filter((c) => !declared.has(c))
  assert.deepEqual(missing, [], `codes named here and absent from the closed enum: ${name(missing)}`)
  for (const c of LEANED_ON) {
    assert.ok(raw.includes(c), `${c} is listed as leaned-on and does not appear in ${FILE}`)
  }
})

test('§J4 · one server, and it is a console host rather than a tenant host', () => {
  const urls = (doc.servers ?? []).map((s) => s.url)
  assert.deepEqual(
    urls,
    ['https://console.reconcileai.app/v1'],
    'THE ONE STRUCTURAL THING THE SPLIT IMPROVES RATHER THAN MOVES. ' +
      '`administration.openapi.yaml` declares TWO servers and records the cost in its own voice: ' +
      '"A plane that mounts this tier serves one host and must refuse the other\'s paths. ' +
      'Nothing below expresses that, and nothing in `server/` can: `basePathOf()` reads ' +
      '`servers[0]` alone." With a single host there is nothing for `servers[0]` to be wrong ' +
      'about. A second server here would silently reintroduce that problem.',
  )
  assert.ok(
    !/\{dataPlaneHost\}/.test(raw),
    'a data-plane host template here would put a console on a tenant host, which is G270\'s ' +
      'named failure: "a control-plane identity does not cross to a tenant host."',
  )
})

/* ==================================================================== *
 * K · THE SPLIT'S OWN INTEGRITY.
 * ==================================================================== */

test('§K1 · every $ref in this file resolves inside it', () => {
  const refs = []
  const walk = (node) => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    for (const [k, v] of Object.entries(node)) {
      if (k === '$ref' && typeof v === 'string') refs.push(v)
      else walk(v)
    }
  }
  walk(doc)
  assert.ok(refs.length > 30, `only ${refs.length} refs found, so this assertion would be vacuous`)

  const dangling = []
  for (const ref of new Set(refs)) {
    if (ref.startsWith('./')) {
      // A relative external ref — resolved against this directory, which is why
      // the new file had to be a SIBLING of errors.yaml rather than live
      // anywhere else.
      const [file, pointer] = ref.split('#')
      const target = parse(readFileSync(path.join(CONTRACTS, file), 'utf8'))
      let cur = target
      for (const p of pointer.slice(1).split('/').filter(Boolean)) cur = cur?.[p]
      if (cur === undefined) dangling.push(ref)
      continue
    }
    let cur = doc
    for (const p of ref.replace(/^#\//, '').split('/')) cur = cur?.[p]
    if (cur === undefined) dangling.push(ref)
  }
  assert.deepEqual(
    dangling.sort(),
    [],
    'A $REF ACROSS THE CUT IS THE SPLIT\'S CHARACTERISTIC FAILURE AND IT IS SILENT: each half ' +
      'still parses as YAML, and nothing in the gate resolves a pointer. `server/contract/' +
      'document.ts` would load this file happily and AJV would fail at BOOT, for the one plane ' +
      `that mounted it.\n\nDangling: ${dangling.join(' · ')}`,
  )
})

test('§K2 · the operations here are declared here and NOT also in the file they came from', () => {
  const adminRaw = readFileSync(path.join(CONTRACTS, 'administration.openapi.yaml'), 'utf8')
  const doubled = OPS.filter((o) => adminRaw.includes(`operationId: ${o.operationId}\n`)).map((o) => o.operationId)
  assert.deepEqual(
    doubled,
    [],
    'A COPY RATHER THAN A MOVE WOULD BE WORSE THAN EITHER HALF OF IT. `mountTier()` matches a ' +
      'handler key against an operationId within ONE document, so a duplicated operation is two ' +
      'routes with one name — the gated copy and the ungated copy of the same act. ⚠️ THIS ' +
      'READ "on two tiers whose TIER_REQUIRES_CAPABILITY disagree" until G911 retired that ' +
      'table on 20 Sep 2026; the two copies would now disagree because their ANNOTATIONS do, ' +
      'which is the same defect reached without a tier.',
  )
})

test('§K3 · duplicated COMPONENTS are the convention, and are counted rather than assumed', () => {
  // Nine components are reached by both halves and are duplicated here. That is
  // not novel: the corpus already declares sixteen component names in more than
  // one tier. This assertion exists so the duplication is a measured fact
  // rather than a thing somebody notices later.
  const owner = {}
  for (const f of readdirSync(CONTRACTS).filter((f) => f.endsWith('.openapi.yaml'))) {
    const d = parse(readFileSync(path.join(CONTRACTS, f), 'utf8'))
    for (const kind of Object.keys(d.components ?? {})) {
      for (const n of Object.keys(d.components[kind] ?? {})) (owner[`${kind}/${n}`] ??= []).push(f)
    }
  }
  const sharedWithAdmin = Object.entries(owner)
    .filter(([, fs]) => fs.includes('platform-console.openapi.yaml') && fs.includes('administration.openapi.yaml'))
    .map(([k]) => k)
  assert.ok(
    sharedWithAdmin.length > 0,
    'if NOTHING is shared, the split was cleaner than measured and this assertion should be ' +
      're-argued rather than deleted',
  )
  assert.ok(
    sharedWithAdmin.length <= 12,
    'THE COST OF A SPLIT IS DUPLICATION AND THIS IS THE CEILING ON IT. A schema declared twice ' +
      'is a schema that can drift, and `tools/check-wire-mirror.mjs` compares the contract ' +
      'against `model/` per PAIR — it has no notion of two contract files disagreeing with each ' +
      'other. If this grows, the components belong in a shared file rather than in both.\n\n' +
      `Shared: ${sharedWithAdmin.sort().join(', ')}`,
  )
})

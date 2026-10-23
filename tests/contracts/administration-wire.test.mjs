/**
 * THE ADMINISTRATION TIER'S ONLY CONTROL, AND THE REASON IT IS HERE RATHER THAN
 * IN `tools/`.
 *
 * ┌─ WHY `tools/check-capability-annotations.mjs` CANNOT SEE THIS FILE ────────┐
 * │ That checker derives `OPERATION_TIERS` from `TIERS` in                     │
 * │ `server/contract/document.ts`, deliberately — "so that a sixth contract    │
 * │ file cannot be invisible here." `administration.openapi.yaml` is NOT in    │
 * │ `TIERS`: registering it is a two-line `server/` change plus an answer, in  │
 * │ `server/contract/capability.ts`, to whether the tier's operations carry a  │
 * │ capability — a `TS2741` at that literal until somebody writes one.         │
 * │                                                                            │
 * │ G288 authorised writing the DOCUMENT. Registering the tier is a `server/`  │
 * │ edit and was fenced out of the slice that wrote it. So this suite is the   │
 * │ stand-in, and it is deliberately NOT a second copy of the grammar: it      │
 * │ imports `classifyAnnotation`, `EXEMPT_PREFIX` and `MIN_REASON_CHARS` from  │
 * │ the checker, which re-exports them from `server/contract/capability.ts`.   │
 * │ What would be §5.6 is a control holding its own definition of what it is   │
 * │ checking, which is why it holds none.                                      │
 * │                                                                            │
 * │ ⚠️ WHEN THE TIER IS REGISTERED, ASSERTIONS A–D BECOME REDUNDANT WITH THE   │
 * │ CHECKER AND SHOULD BE DELETED RATHER THAN LEFT. E–J have no counterpart    │
 * │ anywhere and must survive the move.                                        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 IT PARSES WITH `yaml` RATHER THAN SCANNING LINES — G109, which rules that a
 * hand-parser subtly wrong produces "a checker that passes while asserting
 * nothing". The package is a pinned runtime dependency since G191 and
 * `server/contract/document.ts` already reads every other tier through it.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'

import {
  EXEMPT_PREFIX,
  MIN_REASON_CHARS,
  classifyAnnotation,
} from '../../tools/check-capability-annotations.mjs'
import { CAPABILITIES } from '../../model/access.ts'
import { ACCESS_RESOURCE_CLASSES } from '../../model/governance.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FILE = 'docs/contracts/administration.openapi.yaml'

const doc = parse(readFileSync(path.join(ROOT, FILE), 'utf8'))

const METHODS = ['get', 'post', 'put', 'patch', 'delete']

/** Every declared operation, flat. The same `paths` × methods walk `routesOf()` does. */
const OPS = []
for (const [route, item] of Object.entries(doc.paths ?? {})) {
  for (const method of METHODS) {
    const op = item?.[method]
    if (op === undefined || op === null) continue
    OPS.push({
      route,
      method,
      operationId: typeof op.operationId === 'string' ? op.operationId : `${method} ${route}`,
      annotation: op['x-capability'],
      plane: op['x-plane'],
      authority: op['x-admin-authority'],
      partnerExposure: op['x-partner-exposure'],
      responseCodes: Object.keys(op.responses ?? {}),
      tags: op.tags ?? [],
    })
  }
}

const name = (xs) => [...xs].sort().join(', ')

/* ==================================================================== *
 * GUARDS. Every assertion below walks `OPS`. If the parse silently
 * produced nothing, ALL of them would pass — the one defect shape this
 * repository catalogues more than any other. The floor is a MINIMUM and
 * never the exact count: a totality claim against a hand-copied
 * denominator is that same shape in another register.
 * ==================================================================== */

test('guard · the document parses and declares the operations this file checks', () => {
  // ⚠️ THE FLOOR WAS 50 UNTIL THE SPLIT OF 19 Sep 2026 AND IT IS LOWERED RATHER
  // THAN DELETED. Fourteen operations moved to `platform-console.openapi.yaml`
  // — the `platform-role` subset that can name a capability a platform
  // principal may hold — so this file declares 45 where it declared 59. The
  // floor is still a MINIMUM and still well under the count: it exists to catch
  // a silent parse failure, not to pin a denominator.
  assert.ok(
    OPS.length >= 40,
    `only ${OPS.length} operation(s) loaded from ${FILE}, so every assertion below would ` +
      'pass on an empty input. Derive the truth: ' +
      `grep -c 'operationId:' ${FILE}`,
  )
  const anonymous = OPS.filter((o) => o.operationId.includes(' '))
  assert.deepEqual(
    anonymous.map((o) => `${o.method} ${o.route}`),
    [],
    'an operation with no operationId cannot be named by any message below, and under G191 ' +
      'cannot be mounted at all — `mountTier()` matches a handler key against an operationId.',
  )
})

test('guard · both consoles are present, so neither half is checked vacuously', () => {
  const byTag = {}
  for (const o of OPS) for (const t of o.tags) byTag[t] = (byTag[t] ?? 0) + 1
  assert.ok((byTag['P Partner Portal'] ?? 0) >= 15, `partner portal contributed ${byTag['P Partner Portal'] ?? 0}`)
  // ⚠️ THE STAFF FLOOR WAS 25 UNTIL THE SPLIT OF 19 Sep 2026 and is lowered to
  // 20 rather than deleted: 14 of the 35 staff operations moved to
  // `platform-console.openapi.yaml`, leaving 21 here. 🛑 THE STAFF CONSOLE IS
  // NOW SPLIT ACROSS TWO DOCUMENTS AND NEITHER HALF IS THE WHOLE CONSOLE —
  // `sup` is entirely here, `cat` and `build` are entirely there, and `ten`,
  // `bill` and `ptnr` straddle. That cost is named in §1 of the new file's
  // description; this guard only asserts that this half is non-vacuous.
  assert.ok((byTag['S Staff Console'] ?? 0) >= 20, `staff console contributed ${byTag['S Staff Console'] ?? 0}`)
})

/* ==================================================================== *
 * A–D · THE ANNOTATION GRAMMAR. The checker's own fences, applied to the
 * tier it cannot see.
 * ==================================================================== */

test('assertion A · every operation carries x-capability', () => {
  const absent = OPS.filter((o) => classifyAnnotation(o.annotation).kind === 'absent')
  assert.deepEqual(
    absent.map((o) => o.operationId).sort(),
    [],
    'ONE KEY, PRESENT ON EVERY OPERATION, NEVER OPTIONAL. G288 requires it "from the first ' +
      'draft", because G200\'s other half is that the gate is designed once as a single ' +
      'deliberate pass, and a tier declared without annotations is exactly the accretion that ' +
      'row refuses.',
  )
})

test('assertion B · no annotation is malformed', () => {
  const bad = OPS.map((o) => ({ o, a: classifyAnnotation(o.annotation) })).filter(
    ({ a }) => a.kind === 'malformed',
  )
  assert.deepEqual(bad.map(({ o, a }) => `${o.operationId}: ${a.detail}`), [])
})

test('assertion C · no exemption reason is a placeholder', () => {
  const thin = OPS.map((o) => ({ o, a: classifyAnnotation(o.annotation) }))
    .filter(({ a }) => a.kind === 'exempt' && a.reason.length < MIN_REASON_CHARS)
    .map(({ o, a }) => `${o.operationId} (${a.reason.length} chars)`)
  assert.deepEqual(
    thin,
    [],
    `the floor of ${MIN_REASON_CHARS} exists to reject "n/a", "TODO" and "see docs" — the three ` +
      'things a person writes when they have not made the decision the annotation asks for.',
  )
})

/* ==================================================================== *
 * E · THE LOAD-BEARING ONE, AND IT IS DERIVED FROM `decide()` RATHER
 * THAN CHOSEN.
 * ==================================================================== */

test('assertion E · NO operation names a capability, because decide() refuses both principals', () => {
  const named = OPS.map((o) => ({ o, a: classifyAnnotation(o.annotation) }))
    .filter(({ a }) => a.kind === 'capability')
    .map(({ o, a }) => `${o.operationId} → ${a.capability}`)
  /**
   * 🛑 **THIS ASSERTED `[]` UNTIL 21 Sep 2026, AND ITS OWN MESSAGE NAMED THE
   * CONDITION UNDER WHICH IT WOULD MOVE:** *"If this assertion goes red because
   * a capability became reachable for a platform principal, that is a RULING
   * and the exemptions are rewritten in the same commit — not this line
   * deleted."* **Both halves happened.**
   *
   * **The RULING is R8** (21 Sep 2026, the owner's), and what made it possible
   * is that the message's own premise expired: `decide()`'s second step was
   * categorical — *"EVERY staff-console principal is denied before any
   * capability is read"* — until **G289** gave it a fourth `OrgClass` arm and
   * **G601** opened `substrate`, which `PLATFORM_ASSIGNMENT_REACHES` names.
   * `view_substrate` is therefore a gate a platform principal CAN open, and
   * `tests/http/onboarding-console-served.test.ts` §1a is a 200 through it.
   *
   * **The exemptions were rewritten in the same commit**, on the operations
   * themselves, each quoting the text it replaced.
   *
   * ⚠️ **AND THE MESSAGE BELOW IS KEPT WHOLE, BECAUSE IT IS STILL EXACTLY THE
   * ARGUMENT FOR THE OTHER 42.** Invariant 8 — *"being staff is not access"* —
   * is untouched: `PLATFORM_ASSIGNMENT_REACHES.tenant_data` is still `false`,
   * the partner arm still needs a live `PartnerAccessGrant` per customer
   * tenant, and nothing in this document reads a customer tenant. **A fourth
   * capability here is a fourth ruling.**
   */
  assert.deepEqual(
    named.sort(),
    [
      'completeOnboardingStep → view_substrate',
      'forceOnboardingStep → view_substrate',
      'listOnboardingSteps → view_substrate',
      /* ✅ W5, 1 Oct 2026 — THE FOURTH RULING THIS MESSAGE ASKED FOR, AND IT IS
       * R10's (G2321, the owner's): six partner-only verbs, answered on a FIFTH
       * arm of `decide()` that reads no tenant and no `PartnerAccessGrant`.
       * Invariant 8 is untouched — none of the six is `tenant_data` and
       * `PLATFORM_ASSIGNMENT_REACHES` is `false` for all three partner classes —
       * and invariant 2 is untouched: the fifth arm has no tenant to cross into.
       * `tests/http/partner-portal-served.test.ts` §6 is the served witness. */
      'getSandboxTenant → view_sandbox',
      'handBackSandboxTenant → operate_sandbox',
      'invitePartnerPerson → manage_partner_staff',
      'listDealRegistrations → view_deals',
      'listPartnerPeople → view_partner_staff',
      'requestSandboxTenant → operate_sandbox',
      'requestTrialTenant → register_deal',
      'resetSandboxTenant → operate_sandbox',
      'submitDealRegistration → register_deal',
    ].sort(),
    'AN ADMINISTRATION OPERATION NAMES A CAPABILITY THAT R8 DOES NOT ARGUE FOR. ' +
      'THIS IS NOT A STYLE RULE. `decide()`\'s second step WAS categorical:\n\n' +
      '    if (principal.orgClass === ORG_CLASSES.platform)\n' +
      '      return deny(DECISION_REASONS.platform_org_holds_no_assignment)\n\n' +
      'so EVERY staff-console principal is denied before any capability is read — invariant 8, ' +
      '"being staff is not access", enforced rather than commented. A partner principal needs a ' +
      'live PartnerAccessGrant whose capability is inside PARTNER_CAPABILITY_MASK, and a grant ' +
      'is PER CUSTOMER TENANT: nothing in this document reads a customer tenant, so a portal ' +
      'caller holds none and is denied at partner_grant_absent. And PrincipalContext.tenantId is ' +
      'non-null while most of this tier addresses no tenant at all.\n\n' +
      'Naming a capability here would declare a gate its own principal can never open. If this ' +
      'assertion goes red because a capability became reachable for a platform principal, that ' +
      'is a RULING and the exemptions are rewritten in the same commit — not this line deleted.\n\n' +
      '🛑 THAT HAPPENED ONCE, ON 21 Sep 2026, FOR EXACTLY THREE OPERATIONS (R8). The three ' +
      'act on `substrate`, which G601 opened and which is 1CloudHub`s own delivery record ' +
      'rather than a tenant`s business. A FOURTH owes the same ruling and the same rewrite.\n\n' +
      `Named: ${named.join(' · ')}`,
  )
})

test('assertion F · statutory is reachable by no operation, at any price', () => {
  const statutoryCapabilities = ['place_legal_hold', 'handle_subject_request']
  for (const c of statutoryCapabilities) {
    assert.ok(
      Object.values(CAPABILITIES).includes(c),
      `${c} must still be a member of CAPABILITIES for this assertion to mean anything`,
    )
  }
  assert.ok(
    Object.values(ACCESS_RESOURCE_CLASSES).includes('statutory'),
    'the statutory class must still exist for this assertion to mean anything',
  )

  const raw = readFileSync(path.join(ROOT, FILE), 'utf8')
  const offenders = OPS.filter((o) => {
    const a = classifyAnnotation(o.annotation)
    return a.kind === 'capability' && statutoryCapabilities.includes(a.capability)
  })
  assert.deepEqual(
    offenders.map((o) => o.operationId),
    [],
    'INVARIANT 8: "`statutory` appears in neither [PERMITTED_RESOURCES nor a signed ' +
      'SupportAuthorisation], at any price: a statutory obligation is not the customer\'s to ' +
      'delegate to a processor." `authorisationPermits()` refuses this class BEFORE any other ' +
      'check. The pack agrees — its own staff palette carries "Answer a subject request — ' +
      'refused · statutory, and not ours to do."',
  )

  // AND THE SECOND HALF, WHICH THE ANNOTATION CHECK CANNOT SEE: no request body
  // may offer `statutory` as a support-authorisation class. The break-glass
  // request takes a `classes` array, and a schema that permitted the member
  // would put the reach on the wire whatever the annotation said.
  assert.ok(
    /`statutory` is refused whatever the authorisation says/.test(raw) ||
      /`statutory` is not a legal member at any price/.test(raw),
    'BreakGlassRequest.classes and StandingAuthorisationView.classes must each state on ' +
      'themselves that `statutory` is not a legal member. A free enum here would make the ' +
      'refusal a server convention rather than a documented one.',
  )
})

/* ==================================================================== *
 * G · G76's PLANE TAG. "THE CHECKER LANDS IN THE SAME COMMIT AS THE
 * FILE. A tag with nothing reading it is §5.6 exactly."
 * ==================================================================== */

const PLANES = ['platform', 'tenant']

test('assertion G1 · every operation carries a plane tag from the closed vocabulary', () => {
  const bad = OPS.filter((o) => !PLANES.includes(o.plane)).map((o) => `${o.operationId} (${o.plane})`)
  assert.deepEqual(
    bad,
    [],
    'G76: "every operation carries a plane tag, and `tools/check-plane-tags.mjs` refuses ' +
      'tenant business data on a `[platform]`-tagged operation." The checker in `tools/` is ' +
      'still owed — it belongs in `npm run check` under G108, which is a package.json edit the ' +
      'slice that wrote this file was fenced out of. THIS is the reader that makes the tag ' +
      `mean something today. Vocabulary: ${PLANES.join(' | ')}`,
  )
})

test('assertion G2 · x-plane is `tenant` EXACTLY when the path addresses one', () => {
  const mismatched = OPS.filter((o) => (o.plane === 'tenant') !== o.route.includes('{tenantId}')).map(
    (o) => `${o.operationId} (${o.plane}) at ${o.route}`,
  )
  assert.deepEqual(
    mismatched,
    [],
    'THE IFF IS THE POINT, IN BOTH DIRECTIONS. A `tenant`-tagged operation with no {tenantId} ' +
      'claims a scope its route cannot express; a `platform`-tagged one that names a tenant has ' +
      'a scope its tag denies. Either way the tag has drifted from the shape of the route, ' +
      'which is how a mechanical boundary stops being mechanical.',
  )
})

test('assertion G3 · no schema in this tier carries tenant business data', () => {
  // `control-plane.openapi.yaml` §2, quoted and applied: "An exception, a
  // document value, a counterparty's words, a definition name, a cost-centre
  // label — all of those are theirs, and none of them appears in any schema
  // here." Invariant 3 binds BOTH tags, because this whole tier is
  // control-plane — which is strictly stronger than G76 asks for.
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
  const hits = []
  const walk = (node, where) => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach((n) => walk(n, where))
    for (const [k, v] of Object.entries(node)) {
      if (k === 'properties' && v !== null && typeof v === 'object') {
        for (const prop of Object.keys(v)) {
          if (FORBIDDEN.includes(prop)) hits.push(`${where}.${prop}`)
        }
      }
      if (k !== 'description' && k !== 'summary') walk(v, where)
    }
  }
  for (const [schemaName, schema] of Object.entries(schemas)) walk(schema, schemaName)

  assert.deepEqual(
    hits.sort(),
    [],
    'INVARIANT 3: "the control plane publishes downward and never reads tenant data." Both ' +
      'consoles are control-plane surfaces and the pack agrees with itself twice — P1\'s status ' +
      'bar reads "control plane · no tenant data on this surface" and S1\'s palette empty state ' +
      'reads "not what is inside a tenant. A document, an exception or a register row will ' +
      'never be found here."\n\n' +
      '⚠️ THIS IS A NAME CHECK AND ITS SILENCE IS NOT EVIDENCE OF ABSENCE. It cannot see a ' +
      'tenant value under a name nobody listed, which is the same blind spot ' +
      '`tools/planner/extract.mjs` has and states. It catches the obvious re-entry and nothing ' +
      `subtler.\n\nFound: ${hits.join(' · ')}`,
  )
})

/* ==================================================================== *
 * H · `x-admin-authority` — the pointer that says what DOES govern each
 * operation, since no capability does.
 * ==================================================================== */

const AUTHORITIES = ['tenant-access-grant', 'partner-arrangement', 'platform-role', 'partner-portal-role']

/**
 * WHICH AUTHORITIES RESOLVE TO A MECHANISM IN `model/` — ALL FOUR SINCE
 * 1 Oct 2026.
 *
 * ⚠️ THIS LIST READ `['tenant-access-grant', 'partner-arrangement']` — *"the two
 *    that resolve to something in `model/`, and the two that do not"* — AND IT
 *    WAS HALF STALE BEFORE R10 TOUCHED IT: `platform-role` has resolved to
 *    `PlatformRoleAssignment` and `decide()`'s fourth arm since G289
 *    (19 Sep 2026), and nothing here followed. R10 makes `partner-portal-role`
 *    resolve too — `PartnerRoleAssignment` and the FIFTH arm — so H2's inverted
 *    assertion fired exactly as its own text said it would, and is rewritten
 *    below rather than quietly passing. Each entry now names the EXPORT it
 *    resolves to, so the claim is checked rather than listed.
 */
const AUTHORITY_MECHANISM = {
  'tenant-access-grant': 'authorisationPermits',
  'partner-arrangement': 'PARTNER_CAPABILITY_MASK',
  'platform-role': 'PLATFORM_ASSIGNMENT_REACHES',
  'partner-portal-role': 'PARTNER_ONLY_RESOURCE_CLASSES',
}
const AUTHORITIES_THAT_EXIST = Object.keys(AUTHORITY_MECHANISM)

test('assertion H1 · every operation names what governs it, from the closed vocabulary', () => {
  const bad = OPS.filter((o) => !AUTHORITIES.includes(o.authority)).map(
    (o) => `${o.operationId} (${o.authority})`,
  )
  assert.deepEqual(
    bad,
    [],
    'An `exempt:` reason says a capability does not apply. It does not say what does. This key ' +
      'is a POINTER at an existing evaluator, never a new gate — it grants nothing and is read ' +
      `by nothing at runtime.\n\nVocabulary: ${AUTHORITIES.join(' | ')}`,
  )
})

test('assertion H2 · every authority resolves to a mechanism EXPORTED by `model/` — R10 closed the last', async () => {
  const access = await import('../../model/access.ts')
  const governance = await import('../../model/governance.ts')
  for (const [authority, name] of Object.entries(AUTHORITY_MECHANISM)) {
    assert.ok(
      name in access || name in governance,
      `x-admin-authority \`${authority}\` points at \`${name}\`, which neither model module exports`,
    )
  }
  const unbacked = OPS.filter((o) => !AUTHORITIES_THAT_EXIST.includes(o.authority))
  assert.deepEqual(unbacked.map((o) => o.operationId), [], 'an operation names an authority with no mechanism')
  /* ⛔ THE ORIGINAL INVERTED ASSERTION FOLLOWS, KEPT AS THE HISTORY IT IS AND
   *    NEGATED: it required `unbacked.length > 0` and said it "GOES RED WHEN THE
   *    GAP CLOSES". R10 closed it. Its message is the reasoning that was true
   *    until then. */
  assert.ok(
    !(unbacked.length > 0),
    'THIS ASSERTION IS INVERTED ON PURPOSE AND GOES RED WHEN THE GAP CLOSES. `platform-role` ' +
      'and `partner-portal-role` name mechanisms that DO NOT EXIST in `model/`: ' +
      '`ORG_CLASSES.platform` holds no RoleAssignment by law, and a partner organisation\'s own ' +
      'roster is not a tenant roster, so `manage_users` — classed `authority`, evaluated in a ' +
      'tenant — cannot reach it. If every operation here became backed, somebody has taken the ' +
      'ruling §2 of the document says is owed, and this suite should be rewritten rather than ' +
      'quietly passing.',
  )
  // The figure is REPORTED rather than pinned. A hand-copied denominator is the
  // defect shape this repository catalogues; what matters is that it is visible.
  const byAuthority = {}
  for (const o of OPS) byAuthority[o.authority] = (byAuthority[o.authority] ?? 0) + 1
  assert.ok(
    unbacked.length < OPS.length,
    `every operation is unbacked, which would mean the tenant-grant path reached none of them: ${
      JSON.stringify(byAuthority)
    }`,
  )
})

/* ==================================================================== *
 * I · PARTNER EXPOSURE. The inverse of `capability-annotation.test.mjs`
 * assertion 5d, and it holds for a different reason here.
 * ==================================================================== */

test('assertion I · no operation states a partner exposure, because the mask governs none of them', () => {
  const stated = OPS.filter((o) => o.partnerExposure !== undefined).map((o) => o.operationId)
  assert.deepEqual(
    stated,
    [],
    '`x-partner-exposure` is an ACCEPTANCE OF CROSS-TENANT PARTNER REACH under invariant 2, and ' +
      'PARTNER_MASK_MEMBERSHIP is what decides it. NOTHING IN THIS TIER IS A CROSS-TENANT READ: ' +
      'the partner portal reads the partner\'s OWN commercial record, which is not a tenant read ' +
      'at all, and G270 confirms it — "No partner user reaches a tenant host or a row of tenant ' +
      'data."\n\n' +
      'So the mask is not the control here, and an acceptance string would be "the sentence a ' +
      'later reader trusts when deciding whether the exposure was thought about" — attached to ' +
      'a reach that does not exist. `capability-annotation.test.mjs` assertion 5d refuses the ' +
      'same artefact on the tiers it can see.',
  )
})

/* ==================================================================== *
 * J · THE REST OF THE WIRE. Denials, the closed error enum, and the two
 * conventions that carry invariants.
 * ==================================================================== */

test('assertion J1 · every operation can refuse — 401 and 403 on all of them', () => {
  const noAuthn = OPS.filter((o) => !o.responseCodes.includes('401')).map((o) => o.operationId)
  const noDenied = OPS.filter((o) => !o.responseCodes.includes('403')).map((o) => o.operationId)
  assert.deepEqual(
    [...noAuthn.map((x) => `401:${x}`), ...noDenied.map((x) => `403:${x}`)].sort(),
    [],
    'G200\'s premise, which was measured rather than argued: "`getRun` DECLARES A `404` AND NOT ' +
      'EVEN A `403` … so the one served read of a tenant\'s run has no denied response at all, ' +
      'and a reader of the document would reasonably conclude none is possible." Every ' +
      'operation here is reachable only by an authenticated caller who may be refused, so both ' +
      'codes are declared on every one of them.',
  )
})

test('assertion J2 · no request body anywhere carries a tenant id — invariant 1', () => {
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
    'INVARIANT 1: "tenant scope is derived from the session, never read from a request." ' +
      '`docs/contracts/README.md`: "`tenantId` appears in no request body, anywhere. Not once, ' +
      'in any operation, in any tier … A request that could STATE its tenant is a request that ' +
      'could state the wrong one — invariant 1, expressed as an absence rather than a ' +
      'comment."\n\n' +
      '⚠️ A TENANT IS NAMED IN SOME PATHS AND THAT IS A DIFFERENT THING, argued in §7 of the ' +
      'document: the path names the SUBJECT of an act and is CHECKED against an authority the ' +
      'session already carries — G210\'s "the CHECK, never the CHOOSER". A body field would be ' +
      'the shape G113 removes from the control-plane tier.\n\n' +
      `Found: ${offenders.join(' · ')}`,
  )
})

test('assertion J3 · every error code named in this file is a member of the closed enum', () => {
  const errors = parse(readFileSync(path.join(ROOT, 'docs/contracts/errors.yaml'), 'utf8'))
  const declared = new Set(errors.components.schemas.ErrorCode.enum)
  assert.ok(declared.size > 80, `the enum must be loaded for this to mean anything: ${declared.size}`)

  const raw = readFileSync(path.join(ROOT, FILE), 'utf8')

  // 🛑 THE OTHER DIRECTION — "is every snake_case token in this prose a real
  // code?" — IS NOT ASSERTED, AND THE ABSENCE IS DELIBERATE RATHER THAN AN
  // OVERSIGHT. This document names capabilities, decision reasons, resource
  // classes, GUCs and mask scopes in exactly the same backticked snake_case as
  // an error code, so separating them means a hand-maintained allow-list — the
  // artefact `server/http/app.ts` refuses by name, because it "always ends up
  // one entry stale in the wrong direction." A checker whose allow-list decides
  // its own verdict asserts whatever the list says. The positive half below
  // needs no list and catches the failure that matters: a plausible-looking
  // code nobody minted.
  const LEANED_ON = [
    'capability_not_held',
    'session_invalid',
    'resource_not_found',
    'validation_failed',
    'idempotency_conflict',
    'period_closed',
    'step_not_current',
    'tag_vocabulary_violation',
    'domain_claimed_by_more_than_one_connection',
    'approval_second_approver_required',
    'approval_segregation_violation',
    'classification_ceiling_exceeded',
    // ⚠️ `admitting_step_carries_tools` AND `tool_out_of_scope` WERE HERE UNTIL
    // THE SPLIT OF 19 Sep 2026 and are removed rather than left, because they
    // are the pack-builder's refusals and `addPackDraftRule` moved to
    // `platform-console.openapi.yaml`. They are asserted there instead, by
    // `tests/contracts/platform-console-wire.test.mjs` §J3 — a code named in a
    // file it no longer appears in fails this suite's own second half, which is
    // how the split was caught rather than discovered.
    'bounds_not_configured',
    'bound_not_a_number',
    'bound_negative',
    'bound_zero',
  ]
  const missing = LEANED_ON.filter((c) => !declared.has(c))
  assert.deepEqual(
    missing,
    [],
    'this document names these codes as its refusal arms and `errors.yaml` is a CLOSED enum. A ' +
      'code cited here and absent there is a refusal no tier can ever return — and under a ' +
      'restrictive SpanAttributePolicy "the error class is the only diagnostic channel that ' +
      `survives redaction."\n\nMissing: ${name(missing)}`,
  )
  for (const c of LEANED_ON) assert.ok(raw.includes(c), `${c} is listed as leaned-on and does not appear in ${FILE}`)
})

test('assertion J4 · the two consoles declare their own hosts and neither is a tenant host', () => {
  const urls = (doc.servers ?? []).map((s) => s.url)
  assert.deepEqual(
    urls,
    ['https://console.reconcileai.app/v1', 'https://partners.reconcileai.app/v1'],
    'G277 records that "the consoles have no host at all … Neither principal has a tenant, so ' +
      'neither has a host under G179\'s grammar." Two registered hosts, decided 19 Sep 2026, are ' +
      'what lift that blocker. NEITHER IS A PER-TENANT DATA-PLANE HOST, and that is the ' +
      'property: a console session is minted with `tenantId: null` and stays null-scoped, ' +
      'because "AUTHENTICATION CANNOT CONFER A SCOPE".',
  )
  const raw = readFileSync(path.join(ROOT, FILE), 'utf8')
  assert.ok(
    !/\{dataPlaneHost\}/.test(raw),
    'a data-plane host template here would put a console on a tenant host, which is G270\'s ' +
      'named failure: "a control-plane identity does not cross to a tenant host."',
  )
})

test('assertion J5 · the document states its exemption argument where a reader meets it', () => {
  // A prose check, and a deliberately narrow one. The reasoning in §2 is what
  // every `exempt:` string on every operation is short for; if it is deleted,
  // fifty-nine exemptions become fifty-nine unexplained ones and this tier
  // becomes the "gate opened by writing prose" that
  // `server/contract/capability.ts` refuses by name.
  const raw = readFileSync(path.join(ROOT, FILE), 'utf8')
  for (const phrase of [
    'platform_org_holds_no_assignment',
    'partner_grant_absent',
    /* ⚠️ A LANDMARK THAT OUTLIVED ITS REFERENT AND IS KEPT ANYWAY, 20 Sep
       2026. G911 retired `TIER_REQUIRES_CAPABILITY`, so this phrase now names
       a constant that does not exist — but it is still IN the document, inside
       the ⛔ banner that records the retirement, and that banner is exactly
       the argument this assertion exists to keep from being deleted. **The
       phrase stays because what must not vanish is the ARGUMENT, and the
       argument is now the banner.** A commit that tidies the dead name out of
       the description must replace this entry with whatever names the
       surviving argument — `EXEMPT_WITH_A_PERSON_TO_ASK` or
       `servedWithoutAGate` — rather than dropping the row. */
    'TIER_REQUIRES_CAPABILITY',
  ]) {
    assert.ok(
      raw.includes(phrase),
      `${FILE} must name \`${phrase}\` in its own description. The exemptions below are short ` +
        'for that argument, and an exemption whose argument has been deleted is indistinguishable ' +
        'from an oversight — which is the whole reason the grammar puts the reason ON the ' +
        'operation rather than in a reader.',
    )
  }
})

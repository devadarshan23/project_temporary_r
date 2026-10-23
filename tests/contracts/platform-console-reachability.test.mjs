/**
 * ⚠️ THIS HEADING NAMED `TIER_REQUIRES_CAPABILITY.platformConsole = true`
 * UNTIL 20 Sep 2026 AND G911 RETIRED THAT TABLE; the fourteen are gated
 * because they NAME VERBS, and everything below is unchanged by that.
 * THE CONTROL THAT KEEPS `TIER_REQUIRES_CAPABILITY.platformConsole = true` FROM
 * BEING §5.6 — A GATE THAT PASSES WHILE ASSERTING NOTHING.
 *
 * ┌─ WHY THE GATE STAGE CANNOT DO THIS, IN ITS OWN WORDS ──────────────────────┐
 * │ `tools/check-capability-annotations.mjs` prints this on every green run:   │
 * │                                                                            │
 * │   "This checker reads the GRAMMAR and the TIER. It does not resolve a name │
 * │    against CAPABILITIES, does not read CAPABILITY_RESOURCE_CLASS and does  │
 * │    not ask whether an operation declares a 403 … Its silence is not        │
 * │    evidence of absence."                                                   │
 * │                                                                            │
 * │ So an operation on this tier annotated `x-capability: view_audit` passes   │
 * │ every stage of `npm run check`. It is also UNREACHABLE rather than gated:  │
 * │ `view_audit` is classed `tenant_data`, `PLATFORM_ASSIGNMENT_REACHES`       │
 * │ refuses that class categorically, and `decide()`'s fourth arm would answer │
 * │ no to every caller for ever. A 403 nobody can ever pass is not a stricter  │
 * │ gate — it is an operation that cannot be served, wearing a gate's clothes. │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE JOIN IS THE ASSERTION, AND IT IS DERIVED AT RUNTIME RATHER THAN LISTED:
 *
 *     x-capability  →  CAPABILITY_RESOURCE_CLASS  →  PLATFORM_ASSIGNMENT_REACHES
 *
 * Nothing here holds a copy of which capabilities are platform-reachable. Both
 * tables are imported from `model/access.ts`, so opening or closing a class in
 * `PLATFORM_ASSIGNMENT_REACHES` moves this suite in the same commit — which is
 * the property a hand-written list of six verb names would not have.
 *
 * ⚠️ VERIFIED RED FIRST, and the two mutations are recorded because a control
 * added without a demonstrated red is the defect it exists to catch:
 *   · `listTenants` → `view_audit`   (a real capability, an unreachable class)
 *   · `getInvoice`  → `view_invoice` (not a member of CAPABILITIES at all)
 * Both are reverted; §1 and §2 below are what caught them.
 *
 * 🛑 WHAT THIS SUITE CANNOT SEE, STATED SO ITS SILENCE IS NOT MISREAD: MODE.
 * Nothing in `model/` records whether a capability is a read or a write, so no
 * assertion here can catch a POST annotated with a `view_` verb. §3 is a
 * TRIPWIRE for the one operation where that mattered rather than a general
 * rule, because a general rule keyed on the `view_` PREFIX would be §5.1 — a
 * rule keyed on a spelling instead of the property it protects.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'

import { classifyAnnotation } from '../../tools/check-capability-annotations.mjs'
import { CAPABILITIES, CAPABILITY_RESOURCE_CLASS, PLATFORM_ASSIGNMENT_REACHES } from '../../model/access.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FILE = 'docs/contracts/platform-console.openapi.yaml'
const ADMIN = 'docs/contracts/administration.openapi.yaml'

const doc = parse(readFileSync(path.join(ROOT, FILE), 'utf8'))
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
      annotation: op['x-capability'],
    })
  }
}

/**
 * The classes the platform arm opens, derived rather than listed. If G601's
 * three become four, this moves without anybody editing this file.
 */
const REACHABLE_CLASSES = Object.entries(PLATFORM_ASSIGNMENT_REACHES)
  .filter(([, open]) => open === true)
  .map(([cls]) => cls)

/* ==================================================================== *
 * GUARDS. Every assertion below walks `OPS`. If the parse produced
 * nothing they would all pass — the shape this repository catalogues
 * more than any other. The floor is a MINIMUM, never the exact count.
 * ==================================================================== */

test('guard · the document parses and the model tables are loaded', () => {
  assert.ok(
    OPS.length >= 10,
    `only ${OPS.length} operation(s) loaded from ${FILE}, so every assertion below would pass ` +
      `on an empty input. Derive the truth: grep -c 'operationId:' ${FILE}`,
  )
  assert.ok(
    Object.keys(CAPABILITY_RESOURCE_CLASS).length >= 40,
    'CAPABILITY_RESOURCE_CLASS must be loaded for the join below to mean anything',
  )
  assert.ok(
    REACHABLE_CLASSES.length > 0 && REACHABLE_CLASSES.length < Object.keys(PLATFORM_ASSIGNMENT_REACHES).length,
    'PLATFORM_ASSIGNMENT_REACHES must open SOME classes and refuse SOME, or §1 is vacuous in ' +
      `one direction or the other. Open: ${REACHABLE_CLASSES.join(', ')}`,
  )
})

/* ==================================================================== *
 * 1 · THE JOIN.
 * ==================================================================== */

test('§1 · every capability named here is one a PLATFORM principal can actually hold', () => {
  const unreachable = []
  for (const o of OPS) {
    const a = classifyAnnotation(o.annotation)
    if (a.kind !== 'capability') continue
    const cls = CAPABILITY_RESOURCE_CLASS[a.capability]
    if (cls === undefined) continue // §2's problem, not this one
    if (!REACHABLE_CLASSES.includes(cls)) unreachable.push(`${o.operationId} → ${a.capability} (class ${cls})`)
  }
  assert.deepEqual(
    unreachable.sort(),
    [],
    'EVERY OPERATION ON THIS TIER NAMES A CAPABILITY (⚠️ this said "THIS TIER IS ' +
      '`TIER_REQUIRES_CAPABILITY: true`" until G911 retired that table), WHICH MEANS IT CLAIMS A ' +
      'HUMAN PRINCIPAL `decide()` CAN EVALUATE. A capability whose resource class the platform ' +
      'arm refuses makes that claim false: `decide()`\'s fourth arm answers the CLASS, so the ' +
      'operation is not gated, it is UNREACHABLE — a 403 to everybody, for ever, which G296 and ' +
      'G300 both call worse than an honest 404 from the router.\n\n' +
      `Classes the platform arm opens: ${REACHABLE_CLASSES.join(', ')}.\n` +
      'If this goes red because a class was CLOSED, the operations naming it move back to ' +
      '`administration.openapi.yaml` with an exemption in the same commit — this line is not ' +
      'deleted. If it goes red because somebody annotated a new operation, the annotation is ' +
      `wrong.\n\nUnreachable: ${unreachable.join(' · ')}`,
  )
})

test('§2 · every capability named here is a member of CAPABILITIES', () => {
  const members = new Set(Object.values(CAPABILITIES))
  const unknown = []
  for (const o of OPS) {
    const a = classifyAnnotation(o.annotation)
    if (a.kind !== 'capability') continue
    if (!members.has(a.capability)) unknown.push(`${o.operationId} → ${a.capability}`)
  }
  assert.deepEqual(
    unknown.sort(),
    [],
    'The annotation grammar treats any non-`exempt:` scalar as a capability, so a TYPO is a ' +
      'capability as far as `classifyAnnotation()` is concerned and as far as the gate stage is ' +
      'concerned. `CAPABILITIES` is the closed set and `decide()` would refuse an unknown verb ' +
      `at the include() test, silently.\n\nUnknown: ${unknown.join(' · ')}`,
  )
})

test('§2b · and no operation here states an exemption — the checker says this too, from the other side', () => {
  const exempt = OPS.filter((o) => classifyAnnotation(o.annotation).kind !== 'capability').map((o) => o.operationId)
  assert.deepEqual(
    exempt,
    [],
    'Asserted here as well as in check D of the gate stage, deliberately and not redundantly. ' +
      '⚠️ THIS REASON READ "check D fires on `TIER_REQUIRES_CAPABILITY[tier]`, so if somebody ' +
      'flips this tier to `false` to make a red go away, check D stops applying and this ' +
      'assertion is what still fires" UNTIL G911 RETIRED THAT TABLE ON 20 Sep 2026 — there is ' +
      'no boolean to flip now. THE ARGUMENT SURVIVES IN A NARROWER AND BETTER FORM: check D is ' +
      'a CENSUS pinned at `platformConsole: 0`, so the way to make a red go away is to sweep ' +
      'that number, and this assertion is what still fires when somebody does. A control keyed ' +
      'on the same artefact as the thing it is guarding guards nothing.',
  )
})

/* ==================================================================== *
 * 3 · THE MODE TRIPWIRE. Narrow on purpose.
 * ==================================================================== */

test('§3 · `raiseAdjustment` is NOT on this tier, for as long as `commercial` has no write verb', () => {
  const here = OPS.map((o) => o.operationId)
  assert.ok(
    !here.includes('raiseAdjustment'),
    'IT LOOKS ANNOTATABLE AND IT IS NOT, WHICH IS WHY THIS TRIPWIRE EXISTS RATHER THAN A ' +
      'COMMENT. `commercial` IS open on the platform arm, so §1 above would PASS on ' +
      '`raiseAdjustment → view_commercial`. But `view_commercial` is a READ verb and ' +
      '`raiseAdjustment` is a POST that moves money: `model/access.ts` records that "the absence ' +
      'of a write verb on commercial is scope rather than principle". Annotating a write with a ' +
      'read verb is a weaker gate wearing a stronger name — and NOTHING in `model/` records a ' +
      "capability's mode, so no derived assertion can catch it.\n\n" +
      'To move it here, mint the write verb first. Then delete this assertion, with the ruling ' +
      'quoted in the commit that does it.',
  )

  const commercialVerbs = Object.entries(CAPABILITY_RESOURCE_CLASS)
    .filter(([, cls]) => cls === 'commercial')
    .map(([cap]) => cap)
  assert.deepEqual(
    commercialVerbs.sort(),
    ['view_commercial'],
    'THE OTHER HALF OF THE SAME TRIPWIRE, AND IT IS THE HALF THAT GOES RED FIRST. If a second ' +
      '`commercial` capability is ever minted, the premise above ("there is no write verb") has ' +
      'changed and the reasoning that kept `raiseAdjustment` on the administration tier must be ' +
      `re-argued rather than inherited.\n\nFound: ${commercialVerbs.join(', ')}`,
  )

  const adminRaw = readFileSync(path.join(ROOT, ADMIN), 'utf8')
  assert.ok(
    adminRaw.includes('operationId: raiseAdjustment'),
    'and it must still be DECLARED somewhere — this suite asserts it is not HERE, which would ' +
      'be satisfied just as well by deleting the operation. It stays on the administration tier ' +
      'with its exemption.',
  )
})

/* ==================================================================== *
 * 4 · THE SPLIT DID NOT INVENT OR LOSE AN OPERATION.
 * ==================================================================== */

test('§4 · every operation here carries `x-admin-authority: platform-role`, and the twelve that could not move stayed', () => {
  const raw = readFileSync(path.join(ROOT, FILE), 'utf8')
  const adminRaw = readFileSync(path.join(ROOT, ADMIN), 'utf8')

  const notPlatformRole = []
  for (const [route, item] of Object.entries(doc.paths ?? {})) {
    for (const method of METHODS) {
      const op = item?.[method]
      if (!op) continue
      if (op['x-admin-authority'] !== 'platform-role') {
        notPlatformRole.push(`${op.operationId} (${op['x-admin-authority']}) at ${route}`)
      }
    }
  }
  assert.deepEqual(
    notPlatformRole,
    [],
    'THE CUT WAS MADE ON THE PROPERTY AND NOT ONLY ON THE LANDMARK, BUT IT IS STILL A SUBSET OF ' +
      'ONE AUTHORITY. `tenant-access-grant` operations are evaluated by `authorisationPermits()`, ' +
      'which `decide()` does not consult, and `partner-*` operations by a principal that does not ' +
      'exist in `model/`. An operation of any of those three here would be gated by an evaluator ' +
      'that never runs.',
  )

  // The twelve that stayed, by name. A subset check rather than a count: a
  // count would be a hand-copied denominator, which is the shape this
  // repository catalogues.
  const STAYED = [
    'raiseAdjustment',
    'listRegistrationQueue',
    'acceptRegistration',
    'refuseRegistration',
    'listPartnerRegistry',
    'listSignInDomains',
    'addSignInDomain',
    'listStaffCases',
    'getStaffCase',
    'requestBreakGlass',
    'requestDiagnosticBundle',
    'listStaffNotifications',
  ]
  const wronglyMoved = STAYED.filter((id) => raw.includes(`operationId: ${id}\n`))
  assert.deepEqual(
    wronglyMoved,
    [],
    'EACH OF THESE CARRIES `x-admin-authority: platform-role` AND NONE OF THEM HAS A VERB, which ' +
      'is the finding the split was built on and the one place it departs from the ruling that ' +
      'authorised it. §1 of the document enumerates the reason for each: the partner registry ' +
      'and the notification tray have no resource class at all; `identity` is refused by ' +
      '`PLATFORM_ASSIGNMENT_REACHES` deliberately, on G289\'s second-order argument; the support ' +
      'case and break-glass operations are invariant 8\'s grant path, evaluated by ' +
      '`authorisationPermits()`; and `raiseAdjustment` is §3 above.\n\n' +
      'MOVING ONE HERE WITHOUT MINTING ITS VERB PUTS AN UNGATEABLE OPERATION ON A GATED TIER.',
  )
  const lost = STAYED.filter((id) => !adminRaw.includes(`operationId: ${id}\n`))
  assert.deepEqual(lost, [], 'a split must not lose an operation: these are declared in neither file')
})

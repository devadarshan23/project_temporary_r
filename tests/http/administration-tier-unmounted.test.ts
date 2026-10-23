/**
 * THE STAFF CONSOLE AND THE PARTNER PORTAL — REGISTERED, AND MOUNTED BY
 * NOTHING. G533, 19 Sep 2026.
 *
 * ┌─ WHAT THIS FILE IS FOR ───────────────────────────────────────────────────┐
 * │ `docs/contracts/administration.openapi.yaml` declares FIFTY-NINE          │
 * │ operations — a third of the whole contract surface — and G533 registered  │
 * │ the tier in `TIERS` so the gate can see them. **Registering is not        │
 * │ mounting**, and this file is what keeps those two apart mechanically      │
 * │ rather than by a sentence somebody has to keep believing.                 │
 * │                                                                           │
 * │ It also does the harder thing: it MEASURES what mounting one would cost   │
 * │ today. §3 is that measurement, and it is the reason nothing here is       │
 * │ mounted — not effort, and not only G318's sequencing.                     │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THIS FILE NEVER SKIPS. It opens no port, touches no pool and reads no
 * environment — `buildPlane()` over the REAL documents, driven through
 * `app.inject()`, plus source scans. `tests/http/capability-gate.test.ts`
 * makes the same argument for the same reason: *"a property that can be
 * checked without infrastructure should be checked without infrastructure."*
 *
 * ┌─ THE THREE BLOCKERS, ONE SECTION EACH, EVERY ONE DERIVED ─────────────────┐
 * │ §3 · NO GATE AND NO RECORD.  Every one of the 59 carries `exempt:`, and   │
 * │      `TIER_REQUIRES_CAPABILITY.administration` is `false`. The gate hook  │
 * │      returns at its first line when a route names no capability, and      │
 * │      `mountTier()`'s sixth fence keys on one — so a mounted staff-console │
 * │      operation is served to ANY authenticated caller and mints no         │
 * │      invariant 10 record. Witnessed, not described: a plane whose         │
 * │      authoriser REFUSES EVERY CAPABILITY answers a staff-console          │
 * │      operation 200.                                                       │
 * │ §4 · NO TABLE.  G300's test is table AND model AND capability. The        │
 * │      tenant database holds no tenancy roster a staff caller could read    │
 * │      (RLS is per-tenant by construction) and the CONTROL database holds   │
 * │      exactly one table.                                                   │
 * │ §5 · NO HOST, AND THEREFORE NO PLANE.  The document's two servers are     │
 * │      `console.reconcileai.app` and `partners.reconcileai.app`, and the    │
 * │      only host resolution in `server/` maps a host to a TENANT. A console │
 * │      has no tenant, so there is no session for it to carry.               │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ EVERY SECTION BELOW GOES RED WHEN ITS BLOCKER IS REMOVED, AND THAT IS
 * DELIBERATE. `tests/contracts/customer-surface-reach.test.mjs` states the
 * shape: *"the next slice to reach one of these screens arrives against a
 * failing test that names what it just changed, rather than against a comment
 * it can read past."*
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import type { FastifyInstance, FastifyRequest } from 'fastify'

import { sqlCode, sqlCorpus, sqlCorpusIsReal } from '../sql-code.ts'
import { basePathOf, loadTier, TIERS } from '../../server/contract/document.ts'
import { routesOf } from '../../server/contract/routes.ts'
import { EXEMPT_WITH_A_PERSON_TO_ASK } from '../../server/contract/capability.ts'
import {
  buildPlane,
  recordsAuthorisation,
  servedWithoutAGate,
  type CapabilityAuthoriser,
  type MountedHandler,
} from '../../server/http/app.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')
const SERVER_DIR = path.join(REPO_ROOT, 'server')
const MIGRATIONS = path.join(REPO_ROOT, 'db', 'migrations')
const CONTROL_MIGRATIONS = path.join(REPO_ROOT, 'db', 'migrations-control')

const ADMIN_DOC = loadTier('administration')
const ADMIN_ROUTES = routesOf(ADMIN_DOC, basePathOf(ADMIN_DOC))

/** The two `start.ts` files, which are the whole of what either plane serves. */
function startSources(): { file: string; text: string }[] {
  return ['control-plane', 'data-plane'].map((plane) => {
    const file = path.join(SERVER_DIR, plane, 'start.ts')
    return { file: `server/${plane}/start.ts`, text: readFileSync(file, 'utf8') }
  })
}

interface Caller {
  readonly tenantId: string
}
const HEADER = 'x-session'

/**
 * A TypeScript source with its comments removed.
 *
 * 🛑 ADDED AFTER §5b's FIRST RUN WENT RED FOR THE WRONG REASON, AND THE
 * CORRECTION IS §5.1 CAUGHT IN THE ACT. The first version scanned raw file
 * text for a console hostname and found one — in `server/contract/document.ts`,
 * inside the DOCBLOCK G533 had just written to explain that no plane serves
 * those hosts. The assertion was keyed on a landmark (the string appearing
 * anywhere in a file) instead of on the property it protects (a plane BINDING
 * that host), and it would have made every future explanation of this blocker
 * a red gate. Recorded here rather than quietly fixed, because it is the
 * defect shape `docs/HANDOFF.md` §5 catalogues most.
 *
 * ⚠️ IT IS A SCANNER AND NOT A PARSER, AND THE LIMIT IS NAMED: a `//` or `/*`
 * inside a string literal would be mis-stripped. That trades a false RED for a
 * possible false GREEN, so the guard above it asserts the stripper left real
 * code behind before any absence is read off it.
 */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/**
 * A plane carrying ONE administration operation, built the way a real plane
 * would build it. Used by §3 and by nothing else.
 */
async function planeMounting(
  handlers: Readonly<Record<string, MountedHandler>>,
  authorise: CapabilityAuthoriser<Caller>,
): Promise<FastifyInstance> {
  return buildPlane<Caller>(
    {
      plane: 'test-console-plane',
      authenticate: (request: FastifyRequest) => {
        const raw = request.headers[HEADER]
        return typeof raw === 'string' && raw !== '' ? { tenantId: raw } : null
      },
      unauthenticatedDetail: 'no session',
      authorise,
      unauthorisedDetail: 'no capability',
    },
    [{ tier: 'administration', handlers }],
  )
}

/* ==================================================================== *
 * §1 · THE §5.6 GUARD. Every absence below is a claim about 59
 *      operations; if the document did not load, all of them are free.
 * ==================================================================== */

describe('§1 · the tier is registered and the derivation reaches it', () => {
  it('1a · `administration` is in TIERS and carries an explicit capability verdict', () => {
    assert.equal(
      TIERS.administration,
      'administration.openapi.yaml',
      'G533 registered this tier. If it has been removed, `tools/check-capability-annotations.mjs` ' +
        'is silent about 59 operations again and every assertion below is about a file nobody reads.',
    )
    /**
     * ⚠️ **THIS ASSERTED `TIER_REQUIRES_CAPABILITY.administration === false`
     * UNTIL 20 Sep 2026, AND G913 RETIRED THAT TABLE. The old message is kept
     * because it is the argument, and it has ALSO gone half stale on its own
     * terms:** *"FLIPPING IT TO `true` IS NOT A STRICTER GATE — it is a demand
     * that 59 operations name capabilities that do not exist."* There is no
     * flag to flip now, the 59 are 45, and the demand is per operation: an
     * operation here that has a verb may name it, and one that has none states
     * an exemption beside it. **What survives whole is that these 45 have no
     * verb to name** — §2 of `tests/contracts/administration-evaluators.test.mjs`
     * enumerates why, one evaluator at a time.
     *
     * 🛑 WHAT IS ASSERTED INSTEAD IS THE COST, AS A NUMBER: 45 operations
     * here state an exemption AND face a person, which is the pair that made
     * the retired `false` uncomfortable and which §3 measures.
     */
    /**
     * ⚠️ **THIS ASSERTED 45 UNTIL 21 Sep 2026 — R8, THE OWNER'S — AND THE
     * THREE THAT LEFT DID NOT LEAVE THE TIER.** `listOnboardingSteps`,
     * `completeOnboardingStep` and `forceOnboardingStep` are annotated
     * `view_substrate` IN PLACE and are therefore GATED, and a gated operation
     * is not in this census's population by construction. **The document still
     * declares 45 operations** — §1b is unchanged and still checks that — so
     * the two numbers have stopped agreeing and the gap is exactly the three.
     *
     * 🛑 **THE SENTENCE ABOVE ABOUT THE REMAINING 42 IS UNCHANGED AND STILL
     * TRUE OF EVERY ONE OF THEM**: each is an operation the `preValidation`
     * gate never touches and which would mint no invariant 10 record if it
     * were mounted. What R8 shows is that the way OUT of that population is to
     * give an operation a verb, not to excuse it.
     */
    /* ✅ 42 → 33 ON 1 Oct 2026 — W5 gated nine partner-portal operations IN
     * PLACE on R10's verbs, R8's way out of this population and no other.
     * `GATED_BY_DESIGN` below names all twelve. */
    assert.equal(
      EXEMPT_WITH_A_PERSON_TO_ASK.administration,
      45 - GATED_BY_DESIGN.length,
      'The census in `server/contract/capability.ts` no longer matches this tier. Read that ' +
        'entry — every one of these is an operation the `preValidation` gate never touches and ' +
        'which mints no invariant 10 record if it is mounted. R8 (21 Sep 2026) moved three ' +
        'out of the population by GATING them; a fourth leaving for any other reason owes an ' +
        'argument here.',
    )
  })

  it('1b · the document declares the operations this file counts', () => {
    // ⚠️ THE FLOOR WAS 50 AND THE DOCUMENT DECLARED 59 UNTIL THE SPLIT OF
    // 19 Sep 2026. Fourteen operations moved to `platform-console.openapi.yaml`
    // — the `platform-role` subset that can name a capability a platform
    // principal may hold — leaving 45 here.
    assert.ok(
      ADMIN_ROUTES.length >= 40,
      `\`routesOf()\` produced ${ADMIN_ROUTES.length} route(s) and the document declares 45. ` +
        "Derive it: `grep -cE '^ +operationId: [a-zA-Z]+$' docs/contracts/administration.openapi.yaml`.",
    )
    /* The operations H1 and H2 are about, by name, so a renamed `operationId`
       fails here rather than quietly narrowing §2.
       🛑 `createTenant` AND `listTenants` WERE IN THIS LIST AND ARE NOT ANY
       MORE: both moved to the platform-console tier, where they are gated by
       `provision_substrate` and `view_substrate`. H2's ONBOARDING half stayed,
       because those nine acts are `tenant-access-grant` and `configuration` —
       which is the line the split fell on, and it cuts H2's own journey in
       half. `tests/contracts/platform-console-reachability.test.ts` §4 asserts
       the other side of the same move. */
    const ids = new Set(ADMIN_ROUTES.map((r) => r.operationId))
    for (const id of ['listOnboardingSteps', 'forceOnboardingStep', 'getTenantRecord']) {
      assert.ok(ids.has(id), `\`${id}\` is not declared, and H1/H2 are what this file is about`)
    }
    for (const id of ['createTenant', 'listTenants']) {
      assert.ok(
        !ids.has(id),
        `\`${id}\` is declared here again. It moved to the platform-console tier under the ` +
          'split of 19 Sep 2026 and cannot be in both: `mountTier()` matches a handler key ' +
          'against an operationId within ONE document, so two tiers declaring it is the gated ' +
          'copy and the ungated copy of one act.',
      )
    }
  })
})

/**
 * 🛑 **THE THREE OPERATIONS R8 GATED AND R9 GAVE A WRITER — 21 Sep 2026, BOTH
 * THE OWNER'S — AND THE TWO LISTS BELOW ARE THE SAME THREE ASKED FROM TWO
 * DIRECTIONS.**
 *
 * `GATED_BY_DESIGN` is what the CONTRACT says (§3a); `MOUNTED_BY_DESIGN` is
 * what a PLANE'S START-UP says (§2a). **They are deliberately not derived from
 * one another**: an operation gated and not mounted is a decision somebody
 * took and did not finish, and an operation mounted and not gated is the hole
 * §3 exists to measure. Keeping the two lists separate is what lets either
 * assertion fail on its own.
 *
 * ⚠️ **THE SECOND LIST CARRIES A FILE PREFIX BECAUSE §2a SCANS BOTH PLANES.**
 * A console operation named in `server/control-plane/start.ts` would be a
 * different and much larger finding than one named in the data plane's —
 * `tests/http/console-roster-unreachable.test.ts` §2a is where that is refused
 * at boot — so the file is part of the assertion rather than stripped out of
 * it.
 */
const GATED_BY_DESIGN: readonly string[] = [
  'listOnboardingSteps',
  'completeOnboardingStep',
  'forceOnboardingStep',
  /* ✅ W5, 1 Oct 2026 — R10's six verbs, on the fifth arm (G2633). */
  'listDealRegistrations',
  'submitDealRegistration',
  'requestTrialTenant',
  'getSandboxTenant',
  'requestSandboxTenant',
  'handBackSandboxTenant',
  'resetSandboxTenant',
  'listPartnerPeople',
  'invitePartnerPerson',
]

/**
 * ⚠️ **AND THE TWO LISTS STOPPED BEING ONE LIST ON 1 Oct 2026, WHICH IS WHAT
 * THE PARAGRAPH ABOVE SAID KEEPING THEM SEPARATE WAS FOR.** Four W5 operations
 * were GATED AND NOT MOUNTED — *"a decision somebody took and did not finish"*,
 * each finished-or-not for a named reason at the mount (G2630, G2639, G2640).
 * ✅ **THREE SINCE 2 Oct 2026**: `invitePartnerPerson` left this list under
 * G2801 (the owner's), which discharged G2630 by changing its 201.
 */
const NOT_MOUNTED_BY_DESIGN: readonly string[] = [
  'requestTrialTenant',
  'handBackSandboxTenant',
  'resetSandboxTenant',
]

const MOUNTED_BY_DESIGN: readonly string[] = GATED_BY_DESIGN.filter(
  (id) => !NOT_MOUNTED_BY_DESIGN.includes(id),
).map((id) => `server/data-plane/start.ts: ${id}`)

/* ==================================================================== *
 * §2 · NOTHING IS MOUNTED, AND THE ROUTER SAYS SO HONESTLY.
 * ==================================================================== */

describe('§2 · registering mounted nothing', () => {
  it('2a · not one administration operationId appears in either plane`s mount map', () => {
    const declared = ADMIN_ROUTES.map((r) => r.operationId)
    const found: string[] = []
    for (const { file, text } of startSources()) {
      for (const id of declared) {
        /* Word-boundaried so `getRun` cannot match inside `getRunAccount`. */
        if (new RegExp(`\\b${id}\\b`).test(text)) found.push(`${file}: ${id}`)
      }
    }
    /**
     * 🛑 **THIS ASSERTED `deepEqual(found, [])` UNTIL 21 Sep 2026, AND ITS OWN
     * MESSAGE NAMED WHAT WOULD REPLACE IT: *"If this is deliberate, the ruling
     * that permits it is what replaces this assertion."* R8 AND R9 ARE THAT
     * RULING**, and the empty list is spent for exactly three operations.
     *
     * ⚠️ **THE ARGUMENT THE OLD MESSAGE MADE IS NOT DISCHARGED AND IS CARRIED
     * BELOW VERBATIM.** G318 sequences this tier LAST and §3 measures what
     * mounting an EXEMPT operation here costs — and that is still the answer
     * for the other 42, because **these three are not exempt any more.** The
     * distinction is the whole of R8: an operation leaves this list by being
     * GATED, never by being excused.
     */
    assert.deepEqual(
      [...found].sort(),
      [...MOUNTED_BY_DESIGN].sort(),
      'AN ADMINISTRATION OPERATION IS NAMED IN A PLANE`S START-UP THAT `MOUNTED_BY_DESIGN` ' +
        'does not argue for. G318 sequences this tier ' +
        'LAST — "INGESTION, EXCEPTIONS, CORRESPONDENCE, AND ONLY THEN THE PARTNER PORTAL AND ' +
        'THE STAFF CONSOLE" — and §3 below measures what mounting one costs while an ' +
        'operation here is `exempt:`. R8 (21 Sep 2026, the owner`s) gated three and mounted ' +
        'them; a fourth owes the same three-part derivation and the same argument. ' +
        `Found: [${[...found].sort().join(', ')}]`,
    )
    /* §5.6: the scan must have read something. */
    assert.ok(
      startSources().every(({ text }) => text.includes('handlers:')),
      'the scan read a `start.ts` with no `handlers:` in it, so the absence above is vacuous',
    )
  })

  it('2b · a plane that does not mount them 404s the path rather than inventing it', async () => {
    /**
     * The other direction, and it is the honest one G300 insists on: *"a 403
     * indistinguishable from an unbuilt feature is worse than an honest 404
     * from the router."* Built over the capability tier — the tier the data
     * plane really serves — so the answer is the one a real caller gets.
     */
    const app = await buildPlane<Caller>(
      {
        plane: 'test-data-plane',
        authenticate: () => ({ tenantId: 'ten_acme' }),
        unauthenticatedDetail: 'no session',
        authorise: () => 'held',
        unauthorisedDetail: 'no capability',
      },
      [{ tier: 'capability', handlers: {} }],
    )
    try {
      for (const url of ['/v1/staff/tenants', '/v1/staff/tenants/ten_acme/onboarding']) {
        const res = await app.inject({ method: 'GET', url, headers: { [HEADER]: 'ten_acme' } })
        assert.equal(res.statusCode, 404, `${url} answered ${res.statusCode}`)
        assert.equal(
          JSON.parse(res.payload).code,
          'resource_not_found',
          'the router`s own 404, which is the answer that tells a caller something true',
        )
      }
    } finally {
      await app.close()
    }
  })
})

/* ==================================================================== *
 * §3 · THE MEASUREMENT — WHAT `exempt:` COSTS ON A TIER WITH A HUMAN
 *      PRINCIPAL. THIS IS THE FINDING, AND IT IS THE REASON NOTHING HERE
 *      IS MOUNTED.
 * ==================================================================== */

describe('§3 · an exempt operation on this tier is UNGATED and UNRECORDED', () => {
  it('3a · every one of the 45 states an exemption, and not one names a capability', () => {
    /**
     * 🛑 **THIS ASSERTED THAT NOT ONE OPERATION HERE NAMES A CAPABILITY, AND
     * ITS MESSAGE SAID *"THE ANSWER IS NOT TO FLIP THE VERDICT"*. IT WAS RIGHT
     * AND ITS PREMISE EXPIRED — G911 RETIRED THE VERDICT ALTOGETHER.**
     *
     * The old argument, kept because it is still the argument for the 42: the
     * fourteen operations that could name a verb left this document on
     * 19 Sep 2026 for `platform-console.openapi.yaml`, *"precisely because the
     * verdict is per FILE"*. **That is the sentence that stopped being true.**
     * `check:annotations`' check E now keys on `o.caller` and this document
     * declares `security: [sessionContext]`, so a capability here is legal —
     * the checker's own entry says the fourteen *"would now be legal in
     * place"*.
     *
     * ⚠️ **WHAT SURVIVES WHOLE IS THE TEST FOR WHICH ONES MAY.** An operation
     * here may name a verb when there IS one, in a class
     * `PLATFORM_ASSIGNMENT_REACHES` opens, whose mode fits the act. The three
     * onboarding operations pass it on `view_substrate`/`substrate`; the 42
     * that remain act on a class the arm refuses, or on `commercial`, which it
     * opens and which has no WRITE verb (`raiseAdjustment`). **Read
     * `tests/contracts/administration-evaluators.test.mjs` §2 and §2a before
     * deciding a fourth annotation here is an improvement.**
     */
    const naming = ADMIN_ROUTES.filter((r) => r.capability.kind === 'capability')
    assert.deepEqual(
      naming.map((r) => r.operationId).sort(),
      [...GATED_BY_DESIGN].sort(),
      'An administration operation names a capability that `GATED_BY_DESIGN` does not argue ' +
        'for. R8 (21 Sep 2026, the owner`s) gated three on `view_substrate`; a fourth is a ' +
        'ruling, not a tidy-up. Read ' +
        '`tests/contracts/administration-evaluators.test.mjs` §2 and §2a first.',
    )
    const exempt = ADMIN_ROUTES.filter((r) => r.capability.kind === 'exempt')
    assert.equal(
      exempt.length + naming.length,
      ADMIN_ROUTES.length,
      'an operation is annotated neither way',
    )
  })

  /**
   * ⚠️ §3b AND §3d USED `listTenants` UNTIL THE SPLIT OF 19 Sep 2026 AND NOW
   * USE `listPartnerRegistry`, AND THE SWAP IS NOT COSMETIC — IT IS THE SPLIT'S
   * OWN RESULT ARRIVING IN A TEST.
   *
   * `listTenants` moved to `platform-console.openapi.yaml`, where it is gated
   * by `view_substrate`, so `planeMounting()` — which mounts on the
   * `administration` tier — now REFUSES TO BOOT with it: *"1 handler(s) name
   * an operation this document does not declare."* That refusal is `mountTier()`
   * working, and it is why the operation had to change rather than the
   * assertion.
   *
   * 🛑 `listPartnerRegistry` IS THE RIGHT REPLACEMENT AND NOT MERELY AN
   * AVAILABLE ONE. It is still `x-admin-authority: platform-role`, still
   * `exempt:`, and still a FLEET-WIDE ROSTER — the platform's own record of
   * who its partners are. So the sentence this measurement exists to support
   * is unchanged in force: a customer operator with an ordinary session reads
   * a list of every partner 1CloudHub has, and nothing records that they did.
   * It stayed behind because a partner is not a tenant and is not one of the
   * thirteen resource classes, so no verb names the act — which is the finding
   * that made the split fourteen operations wide instead of twenty-six.
   */
  const EXEMPT_ROSTER = 'listPartnerRegistry'

  it('3b-i · 🛑 AND SINCE G914 THAT MOUNT DOES NOT BOOT AT ALL — the fourth fence, re-founded', async () => {
    /**
     * 🛑 **THE ONE THING THIS SLICE MAKES STRICTLY STRONGER, MEASURED IN THE
     * FILE THAT MEASURED THE HOLE.** §3b below is unchanged and still gets its
     * ungated 200 — but only because its mount now says `servedWithoutAGate()`
     * out loud. **The BARE mount §3b used until 20 Sep 2026 is a boot failure**,
     * and this is it.
     *
     * Before G911 the fourth fence keyed on `TIER_REQUIRES_CAPABILITY[tier]`,
     * which was `false` here, so this mount booted and served. It now keys on
     * `spec.caller` — `sessionContext`, a PERSON — so an exemption reaching a
     * person is refused at registration unless the mount acknowledges it.
     *
     * ⚠️ **AND BE PRECISE ABOUT WHAT THAT IS WORTH: IT DOES NOT CLOSE THE
     * HOLE.** §3b is the proof it does not. What it closes is the hole opening
     * by ACCIDENT — an operation annotated when nothing was mounted, mounted
     * later by somebody who never read the annotation.
     */
    await assert.rejects(
      async () => {
        const app = await planeMounting({ [EXEMPT_ROSTER]: async () => ({ partners: [] }) }, () => 'not_held')
        await app.close()
      },
      /buys its way out with a reason[\s\S]*listPartnerRegistry[\s\S]*caller: person/,
      'THE FOURTH FENCE IS GONE OR NO LONGER KEYS ON THE CALLER. A bare handler on an ' +
        'exempt, person-facing operation must not mount: the gate returns at its first line ' +
        'for it and the sixth fence never sees it, so nothing else in the process will.',
    )
  })

  it('3b · 🛑 a plane REFUSING EVERY CAPABILITY still answers a staff-console read 200', async () => {
    /**
     * 🛑 THIS IS THE COST OF `TIER_REQUIRES_CAPABILITY.administration = false`,
     * MEASURED RATHER THAN ARGUED, AND IT IS THE SHARPEST FACT ABOUT THIS
     * TIER.
     *
     * The authoriser below refuses EVERYTHING — it is the same shape as
     * `denyAllCapabilities` — and the caller is an ordinary authenticated
     * session, the kind a customer operator holds. `listPartnerRegistry`
     * answers **200 with the partner registry**, because `server/http/app.ts`'s
     * `preValidation` hook returns at its FIRST LINE when the route carries no
     * capability: an `exempt:` operation is one the gate never touches.
     *
     * On the four other tiers whose verdict is `false` this costs nothing —
     * their callers are machines, are inside the customer's VPC, or hold no
     * session at all. **Here the caller is a person**, which is why the entry
     * in `server/contract/capability.ts` says this `false` is not the same
     * shape as the other four.
     *
     * ⚠️ AND THE SECOND HALF IS IN THE SAME LINE OF CODE: the handler is a
     * BARE FUNCTION and the plane BOOTS. `mountTier()`'s sixth fence — G301,
     * *"an operation may not mount until it mints a record"* — keys on
     * `capability.kind === 'capability'`, and its own docblock names this
     * hole: *"an operation that buys its way out with prose buys its way out
     * of the record too."* So a mounted staff-console read would serve a
     * tenancy roster and leave no trace of having done it.
     *
     * ⚠️ **HALF OF THAT PARAGRAPH WENT FALSE ON 20 Sep 2026 AND IS CORRECTED
     * RATHER THAN DELETED, BECAUSE THE OTHER HALF IS WHY THIS TEST STILL
     * PASSES.** *"the handler is a BARE FUNCTION"* is false — it is marked
     * `servedWithoutAGate()`, because §3b-i above is the bare one and it does
     * not boot. **Everything else is unchanged: the gate still returns at its
     * first line, the sixth fence still never sees this operation, and the
     * roster is still served with no trace.** The mark records the decision;
     * it does not undo it.
     */
    /* ⚠️ `servedWithoutAGate()` ADDED 20 Sep 2026 AND THE ASSERTION BELOW IS
       UNCHANGED TO THE CHARACTER. Without it this mount is §3b-i's boot
       failure; with it the 200 is exactly what it always was. **That is the
       honest shape of G914: the cost is not removed, it is made explicit,
       greppable and counted.** */
    const app = await planeMounting(
      { [EXEMPT_ROSTER]: servedWithoutAGate(async () => ({ partners: [] })) },
      () => 'not_held',
    )
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/staff/partners',
        headers: { [HEADER]: 'ten_acme' },
      })
      assert.equal(
        res.statusCode,
        200,
        'If this is no longer 200, the gate has changed shape and the argument on ' +
          '`EXEMPT_WITH_A_PERSON_TO_ASK.administration` needs rereading rather than this line ' +
          `patching. Got ${res.statusCode}: ${res.payload.slice(0, 300)}`,
      )
      assert.deepEqual(JSON.parse(res.payload), { partners: [] })
    } finally {
      await app.close()
    }
  })

  it('3c · the SAME plane, with a gated capability-tier operation, refuses 403', async () => {
    /**
     * 🛑 THE DIFFERENTIAL, WITHOUT WHICH §3b IS NOT EVIDENCE. A 200 from a
     * refusing authoriser could mean "the gate is exempt-aware" or "the
     * authoriser was never wired up at all", and those are opposite
     * conclusions. This is the same `refuses` authoriser against an operation
     * that DOES name a capability, and it must be 403 — which is the only
     * thing that makes §3b a statement about the ANNOTATION rather than about
     * the test's own plumbing.
     */
    const stub = recordsAuthorisation(async () => ({ runs: [], nextCursor: null }))
    const app = await buildPlane<Caller>(
      {
        plane: 'test-data-plane',
        authenticate: (request: FastifyRequest) => {
          const raw = request.headers[HEADER]
          return typeof raw === 'string' && raw !== '' ? { tenantId: raw } : null
        },
        unauthenticatedDetail: 'no session',
        authorise: () => 'not_held',
        unauthorisedDetail: 'no capability',
      },
      [{ tier: 'capability', handlers: { listRuns: stub } }],
    )
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/runs',
        headers: { [HEADER]: 'ten_acme' },
      })
      assert.equal(res.statusCode, 403, 'the refusing authoriser did not refuse a GATED operation')
      assert.equal(JSON.parse(res.payload).code, 'capability_not_held')
    } finally {
      await app.close()
    }
  })

  it('3d · the sixth fence is ALIVE and does not fire here — the hole it names, as a pair', async () => {
    /**
     * 🛑 A DIFFERENTIAL, AND IT IS A DIFFERENTIAL BECAUSE THE FIRST VERSION OF
     * THIS ASSERTION CAUGHT NOTHING. It was one half — *"a bare handler on an
     * exempt operation boots"* — ending in `assert.ok(true)`, and every
     * mutation that broke it also broke §3b, so deleting it changed no
     * outcome. A test that catches nothing its neighbours do not is not a
     * weaker control; it is a control that reports coverage it does not have.
     *
     * The pair is the property. The SAME shape — a bare `async` function
     * standing in for a handler — is a BOOT FAILURE on a gated operation and
     * a BOOT on an exempt one, and the difference is `capability.kind`, which
     * is G301's stated hole in its own words: *"an operation that buys its way
     * out with prose buys its way out of the record too."* Delete the sixth
     * fence and only the first half moves; widen it to exempt operations and
     * only the second does.
     */
    await assert.rejects(
      async () => {
        const gated = await buildPlane<Caller>(
          {
            plane: 'test-data-plane',
            authenticate: () => ({ tenantId: 'ten_acme' }),
            unauthenticatedDetail: 'no session',
            authorise: () => 'held',
            unauthorisedDetail: 'no capability',
          },
          [{ tier: 'capability', handlers: { listRuns: async () => ({ runs: [], nextCursor: null }) } }],
        )
        await gated.close()
      },
      /mint no authorisation record[\s\S]*listRuns/,
      'THE SIXTH FENCE IS GONE. A gated operation whose handler is a bare function must not ' +
        'boot — G301 makes minting a PRECONDITION of mounting so that invariant 10 cannot ' +
        'erode one slice at a time.',
    )

    // ⚠️ THIS HALF USED `createTenant` UNTIL THE SPLIT OF 19 Sep 2026. That
    // operation now lives on the `platformConsole` tier gated by
    // `provision_substrate`, so it is no longer an example of "exempt" at all
    // — and mounting it here would fail for the WRONG reason (an undeclared
    // operationId) while looking like the right one.
    //
    // ⛔ AND IT USED `EXEMPT_ROSTER` WITH A BARE HANDLER UNTIL 20 Sep 2026,
    // WHICH IS NOW §3b-i's BOOT FAILURE. **THE PAIR IS A TRIPLE NOW, AND THE
    // THIRD ARM IS WHAT MAKES THE SECOND ONE EVIDENCE.** The old second arm
    // asserted *"a bare handler on an exempt operation boots"* and its
    // replacement cannot be *"… does not boot"*, because that is §3b-i and a
    // test that restates its neighbour is the coverage-it-does-not-have shape
    // this docblock opens by warning about. What the third arm says instead is
    // the thing NEITHER neighbour says: **the new fence is keyed on the CALLER
    // and not on the word `exempt`**, so an exemption whose caller is a
    // MACHINE or nobody at all still mounts bare, exactly as before.
    const noCaller = await buildPlane<Caller>(
      {
        plane: 'test-local-plane',
        authenticate: () => ({ tenantId: 'ten_acme' }),
        unauthenticatedDetail: 'no session',
        authorise: () => 'not_held',
        unauthorisedDetail: 'no capability',
      },
      // `checkLocalHealth` is `exempt:` and `data-plane-local.openapi.yaml`
      // declares no `security` at all, so `callerOf()` answers `none`. There is
      // no person to serve ungated, so there is nothing for the fourth fence to
      // acknowledge — and this is the arm that goes RED if somebody
      // "simplifies" that fence to key on `kind === 'exempt'`, which would
      // demand a mark on every liveness probe and on the whole control plane.
      [{ tier: 'dataPlaneLocal', handlers: { checkLocalHealth: async () => ({ status: 'ok' }) } }],
    )
    await noCaller.close()
  })

  it('3e · and the SAME bare handler on the split-out tier is a BOOT FAILURE — the pair, completed', async () => {
    /**
     * 🛑 THE ASSERTION THE SPLIT MADE POSSIBLE, AND IT IS THE SHARPEST
     * DEMONSTRATION IN THIS FILE THAT THE VERDICT IS THE WHOLE DIFFERENCE.
     *
     * §3d's pair was *"gated capability-tier operation → boot failure"* against
     * *"exempt administration operation → boots"*, and a reader could fairly
     * object that the two differ in more than one way: different document,
     * different principal, different acts. **This is the same ACT** —
     * `createTenant`, the same operationId, the same staff console — on the
     * other side of a cut that changed exactly one thing, the tier's
     * `TIER_REQUIRES_CAPABILITY`. It now boots-fails on the sixth fence.
     *
     * So: an operation that bought its way out with prose bought its way out
     * of invariant 10's record; the same operation carrying a real verb cannot
     * mount until it mints one. That is G301 doing what it was written to do,
     * and it is the reason `platform-console.openapi.yaml` mounts nothing —
     * not effort, and not G318's sequencing.
     */
    await assert.rejects(
      async () => {
        const app = await buildPlane<Caller>(
          {
            plane: 'test-console-plane',
            authenticate: () => ({ tenantId: 'ten_acme' }),
            unauthenticatedDetail: 'no session',
            authorise: () => 'held',
            unauthorisedDetail: 'no capability',
          },
          [
            {
              tier: 'platformConsole',
              handlers: { createTenant: async () => ({ tenantId: 'ten_x', name: 'x' }) },
            },
          ],
        )
        await app.close()
      },
      /mint no authorisation record[\s\S]*createTenant/,
      'THE SIXTH FENCE DOES NOT REACH THE NEW TIER. `createTenant` names ' +
        '`provision_substrate`, so `capability.kind === "capability"` and G301 must refuse a ' +
        'bare handler here exactly as it refuses one on the capability tier. If this passes, ' +
        'the split produced a gated tier that mints no record — which is the hole the split ' +
        'was supposed to close, reopened one file over.',
    )
  })
})

/* ==================================================================== *
 * §4 · NO TABLE. G300's first third.
 * ==================================================================== */

describe('§4 · there is no table behind H1 or H2', () => {
  it('4a · no migration in either set declares an onboarding step', () => {
    /**
     * 🛑 STRIPPED OF COMMENTS SINCE 20 Sep 2026 — G834 — AND THE REASON IS
     * THIS FILE'S OWN §5b LESSON ARRIVING IN §4a. The scan used to read RAW
     * file text, and `db/migrations-control/0002_tenancy_roster.sql` (G831)
     * made it RED by REFUSING a stage column at length on its own face:
     *
     *   "`onboarding` appears in the migration corpus. H2's state has a column
     *    now, and `model/onboarding.ts` is the vocabulary it must be built out
     *    of rather than a second one."
     *
     * **Every clause of that message was false** — no column existed, and the
     * token was inside the paragraph explaining why one must not. That is the
     * defect `codeOf()` above was added to fix for §5b, in the same file, in
     * SQL: *"it would have made every future explanation of this blocker a red
     * gate."* The property this protects is a COLUMN, not a WORD.
     *
     * ⚠️ THE ASSERTION ITSELF IS UNCHANGED TO THE CHARACTER, including its
     * message. What changed is what it reads.
     */
    const all = sqlCode(`${sqlCorpus(MIGRATIONS)}\n${sqlCorpus(CONTROL_MIGRATIONS)}`)
    sqlCorpusIsReal(all, 'both migration sets', 10_000)

    /**
     * ✅ **THE TRIPWIRE FIRED ON 20 Sep 2026 AND IS REPLACED HERE BY THE
     * STRONGER ASSERTION ITS OWN MESSAGE ASKED FOR — G1241, THE OWNER'S
     * RULING. THE ORIGINAL IS QUOTED IN FULL RATHER THAN DELETED, because it
     * is the sentence four files carried:**
     *
     *     for (const token of ['onboarding', 'step_key', 'forced_reason',
     *                          'whose_hands']) {
     *       assert.ok(!new RegExp(token, 'i').test(all),
     *         "`<token>` appears in the migration corpus. H2's state has a
     *          column now, and `model/onboarding.ts` is the vocabulary it must
     *          be built out of rather than a second one. G511: 'the fence and
     *          the writer are one commit or neither.'")
     *     }
     *
     * 🛑 **ITS MESSAGE IS THE SPECIFICATION FOR WHAT REPLACES IT, AND BOTH
     * CLAUSES ARE NOW ASSERTED RATHER THAN THE ABSENCE.** *"The vocabulary it
     * must be built out of rather than a second one"* becomes: every stored
     * onboarding column is one `model/onboarding.ts` DECLARES, and **nothing
     * a reader DERIVES is stored beside its own input** — which is the §5.3
     * the old absence was protecting, asserted positively. *"The fence and the
     * writer are one commit or neither"* becomes: the table and its reader
     * arrive together, and the reader is named.
     *
     * ⚠️ THE TOKENS THAT STAY REFUSED ARE THE DERIVED ONES, AND `stage` JOINS
     * THEM. G833 refused a `stage` column and **that refusal is not
     * discharged** — the owner ruled the value DERIVED at read time rather
     * than ruling the column in.
     */
    assert.ok(
      /CREATE TABLE ("?)onboarding_record\1\s*\(/.test(all),
      'H2’s onboarding state has no table in either migration set. If it has been ' +
        'removed, `server/data-plane/console-roster-store.ts` can no longer derive ' +
        '`TenantSummary.stage` and the `listTenants` mount has to go with it — G511 in ' +
        'the other direction.',
    )
    for (const token of ['stage', 'whose_hands', 'step_title', 'done_forced', 'step_state']) {
      assert.ok(
        !new RegExp(`\\b${token}\\b`, 'i').test(all),
        `\`${token}\` appears as a stored name in the migration corpus, and it is a value ` +
          '`model/onboarding.ts` DERIVES rather than one it declares — `onboardingStage()`, ' +
          '`STEP_HANDS`, `STEP_TITLE` and `onboardingSteps()` are each a function OF the two ' +
          'columns that do exist. **Storing a function’s output beside its input is §5.3 ' +
          'with the copy in the place a console reads, and the two drift the first time a step ' +
          'is FORCED** — forcing moves `completed` by more than one, so every writer has to ' +
          'remember the other column. G833 refused `stage` by name before the owner ruled it ' +
          'derived, and that refusal STANDS.',
      )
    }
  })

  it('4b · the CONTROL database holds the roster and nothing else H1 or H2 needs', () => {
    /**
     * 🛑 INVARIANT 3 IS WHY THIS IS THE INTERESTING HALF. *"The control plane
     * publishes downward and never reads tenant data."* A staff console that
     * lists every tenant cannot read the DATA plane's `tenant.tenant` — RLS
     * there is `nullif(current_setting('app.tenant_id', true), '')`, one
     * tenant per transaction by construction (G100), so a roster across all
     * tenants is not expressible in that database at all. It belongs in the
     * CONTROL database.
     *
     * ✅ **AND IT IS THERE SINCE 20 Sep 2026 — G831, THE OWNER'S RULING.**
     * ⚠️ **THIS ASSERTION READ `['pack_catalogue']` AND ITS MESSAGE SAID THE
     * ROSTER *"arrives with the handler, not before it"*. THE LIST IS SWEPT
     * AND THE SENTENCE IS CORRECTED RATHER THAN DELETED, because it stated a
     * condition this slice did not meet and a reader is owed the reason.**
     *
     * `db/migrations/0004_subject_ledger.sql` refuses **a WRITE privilege
     * ahead of a writer**, and `0002_tenancy_roster.sql` grants `SELECT` and
     * nothing else — so that refusal does not bite, and `0007`, `0012` and
     * `0014` are all precedent for a table proven by a `tests/db` suite rather
     * than by a route. **What actually kept the handler out is measured, not
     * chosen**, and it is 4c below plus
     * `tests/http/console-roster-unreachable.test.ts`: the plane that resolves
     * a console SESSION is the DATA plane (G726) and this table is in the
     * CONTROL database, with no edge between them in `compose.yaml` or in
     * `infra/`.
     */
    const control = sqlCode(sqlCorpus(CONTROL_MIGRATIONS))
    sqlCorpusIsReal(control, 'the control migration set')
    const tables = [...control.matchAll(/CREATE TABLE ("?)([a-z_]+)\1\s*\(/g)].map((m) => m[2])
    assert.deepEqual(
      tables,
      /*
       * ⚠️ **TWO TABLES ADDED 20 Sep 2026 — G1241, THE OWNER'S RULING:**
       * *"Onboarding state lives in a table in the CONTROL database, one row
       * per tenant, beside the roster."* They are H2's, so the suite name
       * above — *"nothing else H1 or H2 needs"* — is the clause this sweep
       * changes, and it is corrected here rather than in the title because the
       * H1 half is untouched: nothing mints a tenant.
       */
      /* G4306 — the receipt the control plane's internal writes are idempotent
         on, under the owner's "Full restore" ruling. Argued at
         `tests/db/control-plane-census.test.ts` §A. */
      ['pack_catalogue', 'tenancy_roster', 'onboarding_record', 'onboarding_forced_step', 'internal_request_receipt'],
      'The control-plane schema has changed. Read `tests/db/control-plane-census.test.ts` ' +
        'before adding a table here: that suite ENUMERATES this database and requires the ' +
        'application role to hold no write privilege on anything in it, and a `tenant_id` ' +
        'column to be argued. ' +
        `Found: [${tables.join(', ')}]`,
    )
  })

  it('4c · `listTenants` is mounted on the DATA plane, and the other two are not', () => {
    /**
     * ✅ **THE TRIPWIRE FIRED ON 20 Sep 2026 — G1241, THE OWNER'S RULING — AND
     * IS REPLACED BY THE STRONGER ASSERTION RATHER THAN DELETED. THE ORIGINAL
     * IS QUOTED, because its own message named exactly what a mounting commit
     * owed:**
     *
     *     `4c · and the roster is still reachable by no handler on either plane`
     *     assert.deepEqual(found, [],
     *       "a plane names a tenancy operation or the roster store in its
     *        start-up. The table landed under G831 and the MOUNT did not, for a
     *        reason that is not effort … If that has been closed,
     *        `tests/http/console-roster-unreachable.test.ts` is the suite that
     *        measures it and is the one to re-argue.")
     *
     * **Every clause of that was true when written.** G1161 closed the topology
     * half and G1241 closed the schema half; the re-argument is in
     * `server/data-plane/console-roster.ts`'s header, which derives G300's three
     * parts per operation with the commands.
     *
     * 🛑 **WHAT REPLACES IT IS THREE CLAIMS, AND THE SECOND IS THE ONE THAT
     * KEEPS DOING THIS FILE'S JOB: exactly ONE of the three tenancy operations
     * is mounted, and it is mounted on the plane that can resolve a console
     * principal.** `getTenantRecord` publishes `retention`, `telemetryProfile`
     * and `environment`, every one of which `0002_tenancy_roster.sql` refuses BY
     * NAME; `createTenant` is a WRITE and no role holds `INSERT` on that table.
     * Mounting either goes red here.
     */
    const sources = startSources()
    const dataPlane = sources.find((x) => x.file.includes('data-plane'))
    const controlPlane = sources.find((x) => x.file.includes('control-plane'))
    assert.ok(dataPlane !== undefined && controlPlane !== undefined, 'a plane source is missing')

    assert.ok(
      /\blistTenants\b/.test(dataPlane.text),
      '`listTenants` is no longer mounted on the DATA plane. It is the first console ' +
        'operation either plane has ever served (G1241) and FOUR things have to hold at once ' +
        'for it — the table (G831), the reach (G1161), the capability (G601) and invariant ' +
        '10’s SECOND HOME (G730). If the mount has been withdrawn, the commit that withdrew ' +
        'it owes the reason, because each of those four is still true.',
    )

    const extra: string[] = []
    for (const { file, text } of sources) {
      for (const id of ['getTenantRecord', 'createTenant']) {
        if (new RegExp(`\\b${id}\\b`).test(text)) extra.push(`${file}: ${id}`)
      }
    }
    assert.deepEqual(
      extra,
      [],
      'a SECOND tenancy operation is mounted. `listTenants` mounted ON MERIT AND PER ' +
        'OPERATION — G300 — and nothing about it licenses a third. `getTenantRecord` ' +
        'publishes `retention`, `telemetryProfile` and `environment`, every one of which ' +
        '`db/migrations-control/0002_tenancy_roster.sql` refuses BY NAME; `createTenant` is ' +
        'a WRITE, and that table grants no `INSERT` to anybody because *a serving process ' +
        'that could mint a tenant could choose a residency, which H1.1 makes permanent*. ' +
        `Found: ${extra.join(', ')}`,
    )

    const onControl = ['listTenants', 'getTenantRecord', 'createTenant'].filter((id) =>
      new RegExp(`\\b${id}\\b`).test(controlPlane.text),
    )
    assert.deepEqual(
      onControl,
      [],
      'the CONTROL plane names a tenancy operation in its start-up. That plane REFUSES TO ' +
        'BOOT with a gated operation mounted — `refuseGatedOperations()`, witnessed live at ' +
        '`tests/http/console-roster-unreachable.test.ts` §2a — and resolving a console ' +
        'principal there would mean reading the DATA database, which is invariant 3 in the ' +
        `direction the invariant forbids. Found: ${onControl.join(', ')}`,
    )
  })
})

/* ==================================================================== *
 * §5 · NO HOST, AND THEREFORE NO SESSION AND NO PLANE.
 * ==================================================================== */

describe('§5 · neither console host is servable by anything in this repository', () => {
  it('5a · the document names two hosts and the base path is read from the FIRST only', () => {
    const servers = ADMIN_DOC['servers']
    assert.ok(Array.isArray(servers) && servers.length === 2, 'the document declares two servers')
    const urls = (servers as { url: string }[]).map((s) => s.url)
    assert.deepEqual(urls, [
      'https://console.reconcileai.app/v1',
      'https://partners.reconcileai.app/v1',
    ])
    assert.equal(
      basePathOf(ADMIN_DOC),
      '/v1',
      '`basePathOf()` reads `servers[0]` alone. The document says so and calls it an open ' +
        'question: "A plane that mounts this tier serves one host and must refuse the ' +
        'other`s paths. Nothing below expresses that, and nothing in `server/` can."',
    )
  })

  it('5b · the only host resolution in `server/` maps a host to a TENANT, which a console has none of', () => {
    /**
     * 🛑 THE BLOCKER THAT IS NOT ABOUT EFFORT. A staff-console session would
     * be a `tenant.session` row, and `server/data-plane/session.ts` runs
     * `checkHostBinding()` on EVERY request and REVOKES on a mismatch (G180),
     * while `resolveServingHost()` (G179) is a host→TENANT lookup. A console
     * host resolves to no tenant, so there is no row to bind and nothing to
     * select. The registry is read from the plane's own environment, which is
     * a tenant data plane's environment.
     *
     * Asserted as a property of the source rather than of a running process,
     * because a console plane does not exist to run.
     */
    const registry = codeOf(
      readFileSync(path.join(SERVER_DIR, 'data-plane', 'serving-hosts.ts'), 'utf8'),
    )
    assert.ok(
      registry.includes('tenantId'),
      'the registry no longer resolves to a tenant, so the argument in this test has moved',
    )
    /* §5.6, and it is the guard the stripper needs: prove `codeOf()` left
       real code behind before reading an absence off what it returned. */
    assert.ok(
      registry.includes('export') && registry.includes('function'),
      '`codeOf()` stripped the whole file, so every absence below it is free',
    )
    for (const host of ['console.reconcileai.app', 'partners.reconcileai.app']) {
      const named = readdirSync(SERVER_DIR, { recursive: true, encoding: 'utf8' })
        .filter((f) => f.endsWith('.ts'))
        .filter((f) => codeOf(readFileSync(path.join(SERVER_DIR, f), 'utf8')).includes(host))
      assert.deepEqual(
        named,
        [],
        `\`${host}\` is named in \`server/\`. A console plane is being built, and the questions ` +
          'it owes are G277`s host, a session that is not a `tenant.session`, and an ' +
          'authorisation mechanism for a platform principal with no tenant — which G288 ' +
          `calls "a ruling somebody owes, and it is larger than this file". Found: ${named.join(', ')}`,
      )
    }
  })
})

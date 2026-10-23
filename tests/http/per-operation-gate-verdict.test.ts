/**
 * THE BOOT PATH AFTER THE VERDICT MOVED — G911 AND G914, 20 Sep 2026.
 *
 * Every assertion here drives `buildPlane()` over the REAL contract documents
 * with no database, the way `tests/http/administration-tier-unmounted.test.ts`
 * §3 and `tests/http/authorisation-record.test.ts` §2d already do.
 *
 * ┌─ THE FOUR THINGS THAT COULD GO WRONG, AND EACH IS A NEGATIVE HERE ─────────┐
 * │ 1 · FAIL-OPEN. A per-operation verdict that defaults to "not gated" when    │
 * │     an annotation is missing or malformed converts a boot failure into an   │
 * │     ungated route. §1 drives an absent one and a malformed one.             │
 * │ 2 · THE HOOK'S FIRST-LINE RETURN. It is safe only because `mountTier()`     │
 * │     refused such a route; the two are ONE control with two halves and       │
 * │     widening either alone leaves the gate green and the property gone.      │
 * │     §2 is the mount half and §3 is the hook seen doing its half.           │
 * │ 3 · G301's SIXTH FENCE. §4 proves it still bites after the predicate it     │
 * │     keys on was rewritten.                                                  │
 * │ 4 · A CHEAP `exempt:`. §5 is what replaces the argument: the population of  │
 * │     `servedWithoutAGate()` call sites in `server/`, counted.                │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE OWNER'S SURVIVING OBJECTION IS CARRIED HERE TOO: *"it touches every
 * mounted tier's boot path, and the split just landed on the opposite
 * premise."* **`docs/contracts/platform-console.openapi.yaml` IS NOT TOUCHED
 * BY THIS SLICE** — G781 stands, and §6 asserts that it does.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import type { FastifyRequest } from 'fastify'

import {
  buildPlane,
  recordsAuthorisation,
  servedWithoutAGate,
  type MountedHandler,
} from '../../server/http/app.ts'
import { EXEMPT_WITH_A_PERSON_TO_ASK } from '../../server/contract/capability.ts'
import { basePathOf, loadTier, type TierName } from '../../server/contract/document.ts'
import { routesOf } from '../../server/contract/routes.ts'

interface Caller {
  readonly tenantId: string
}

const HEADER = 'x-test-caller'
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')
const SERVER_DIR = path.join(REPO_ROOT, 'server')

async function plane(
  tier: TierName,
  handlers: Readonly<Record<string, MountedHandler>>,
  authorise: () => 'held' | 'not_held' = () => 'not_held',
) {
  return buildPlane<Caller>(
    {
      plane: 'test-verdict-plane',
      authenticate: (request: FastifyRequest) => {
        const raw = request.headers[HEADER]
        return typeof raw === 'string' && raw !== '' ? { tenantId: raw } : null
      },
      unauthenticatedDetail: 'no session',
      authorise,
      unauthorisedDetail: 'no capability',
    },
    [{ tier, handlers }],
  )
}

/**
 * The parsed specs of one tier, so a mutation can be applied to a real
 * operation rather than to an invented one.
 */
function specsOf(tier: TierName) {
  const doc = loadTier(tier)
  return routesOf(doc, basePathOf(doc))
}

/**
 * Comments stripped, so §5a counts CALLS and not the paragraphs that ARGUE
 * about them — `server/contract/capability.ts` names the function twice in
 * prose and neither is a call site.
 *
 * ⚠️ IT IS A SCANNER AND NOT A PARSER, AND THE LIMIT IS `tests/http/
 * administration-tier-unmounted.test.ts`'s, quoted: *"a `//` or `/*` inside a
 * string literal would be mis-stripped. That trades a false RED for a possible
 * false GREEN"* — so §5a asserts the surviving call is the RIGHT one by name
 * rather than only counting.
 */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

function sourceFilesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFilesUnder(full))
    else if (entry.endsWith('.ts')) out.push(full)
  }
  return out
}

/**
 * 🛑 THE ANNOTATION OF ONE REAL OPERATION, SWAPPED IN THE PARSED DOCUMENT
 * AND PUT BACK. `loadTier()` memoises, so this reaches the same object
 * `routesOf()` walks — which is what makes §1 a mutation of the CONTRACT as
 * the router sees it rather than of a fixture that resembles one.
 *
 * ⚠️ **THE YAML IS NOT TOUCHED, DELIBERATELY.** Two other agents are editing
 * `docs/contracts/`, and a test that writes a contract file would be a
 * mutation somebody else's run could observe.
 */
function withAnnotation<T>(
  tier: TierName,
  route: string,
  method: string,
  value: unknown,
  body: () => Promise<T>,
): Promise<T> {
  const doc = loadTier(tier) as unknown as {
    paths: Record<string, Record<string, Record<string, unknown>> | undefined> | undefined
  }
  const operation = doc.paths?.[route]?.[method]
  if (operation === undefined) throw new Error(`${tier} ${method.toUpperCase()} ${route} is not declared`)
  const before = operation['x-capability']
  if (before === undefined) throw new Error(`${tier} ${method.toUpperCase()} ${route} carries no annotation to swap`)
  const restore = (): void => {
    operation['x-capability'] = before
  }
  if (value === undefined) delete operation['x-capability']
  else operation['x-capability'] = value
  return body().then(
    (v) => {
      restore()
      return v
    },
    (e: unknown) => {
      restore()
      throw e
    },
  )
}

/* ==================================================================== *
 * §0 · THE §5.6 GUARD.
 * ==================================================================== */

describe('§0 · the documents load and the operations these assertions name exist', () => {
  it('0a · each named operation is present with the annotation shape its section needs', () => {
    const tiers: readonly TierName[] = ['capability', 'foundation', 'administration', 'dataPlaneLocal', 'controlPlane']
    const byId = new Map<string, ReturnType<typeof specsOf>[number]>(
      tiers.flatMap((t) => specsOf(t).map((s) => [`${t}:${s.operationId}`, s] as const)),
    )
    const expectations: ReadonlyArray<readonly [string, 'capability' | 'exempt', string]> = [
      ['capability:listRuns', 'capability', 'person'],
      ['foundation:resolveTenantContext', 'exempt', 'person'],
      ['administration:listPartnerRegistry', 'exempt', 'person'],
      ['dataPlaneLocal:checkLocalHealth', 'exempt', 'none'],
      ['controlPlane:listEntitledPacks', 'exempt', 'machine'],
    ]
    for (const [id, kind, caller] of expectations) {
      const spec = byId.get(id)
      assert.ok(spec, `${id} is not declared any more; every section below would be measuring nothing`)
      assert.equal(spec.capability.kind, kind, `${id} changed annotation kind`)
      assert.equal(spec.caller, caller, `${id} changed caller`)
    }
  })
})

/* ==================================================================== *
 * §1 · FAIL-OPEN — THE FIRST THING THAT COULD GO WRONG.
 * ==================================================================== */

describe('§1 · an annotation that is absent or malformed is UNGOVERNED, never exempt', () => {
  /**
   * 🛑 THE FAIL-OPEN THIS SLICE IS WRITTEN AGAINST, IN ONE SENTENCE: if
   * `gateVerdictOf()` answered `exempt` for a missing or malformed
   * annotation, the third fence would stop firing and the fourth would ask
   * only for a mark — so **a deleted `x-capability` would become an ungated
   * route with a one-line fix**, where today it is a boot failure. The
   * `GateVerdict` union has three members for exactly this reason and the
   * third is proven here over a running plane rather than over the type.
   *
   * ⚠️ IT IS DRIVEN BY MUTATING THE PARSED DOCUMENT AND NOT THE YAML, because
   * the YAML belongs to a contract two other agents are editing.
   */
  it('1a · an ABSENT annotation refuses to boot — the third fence, not the fourth', async () => {
    await withAnnotation('capability', '/runs', 'get', undefined, async () => {
      await assert.rejects(
        async () => {
          const app = await plane('capability', { listRuns: recordsAuthorisation(async () => ({})) })
          await app.close()
        },
        /carrying no usable `x-capability`[\s\S]*listRuns \(absent\)/,
        'AN ABSENT ANNOTATION IS BEING TREATED AS AN EXEMPTION. That is the fail-open: the ' +
          'route would register, the gate would return at its first line, and the sixth fence ' +
          'would never see it.',
      )
    })
  })

  it('1b · a MALFORMED annotation refuses to boot, and names why', async () => {
    await withAnnotation('capability', '/runs', 'get', 12, async () => {
      await assert.rejects(
        async () => {
          const app = await plane('capability', { listRuns: recordsAuthorisation(async () => ({})) })
          await app.close()
        },
        /carrying no usable `x-capability`[\s\S]*listRuns \(not a string: number\)/,
        'A MALFORMED ANNOTATION IS BEING TREATED AS AN EXEMPTION.',
      )
    })
  })

  it('1c · and neither can be talked past with a mark — `servedWithoutAGate()` does not admit it', async () => {
    /**
     * 🛑 THE SHARPEST FORM OF THE FAIL-OPEN, AND THE ONE A CARELESS REPAIR
     * WOULD PRODUCE: somebody meets 1a's boot failure, reaches for the new
     * mark because the message mentions it, and ships an ungoverned route
     * with an acknowledgement attached. **The third fence runs BEFORE the
     * fourth and reads the document, so a mark cannot reach it.**
     */
    await withAnnotation('capability', '/runs', 'get', undefined, async () => {
      await assert.rejects(
        async () => {
          const app = await plane('capability', { listRuns: servedWithoutAGate(async () => ({})) })
          await app.close()
        },
        /carrying no usable `x-capability`/,
        'A MARK ADMITTED AN UNGOVERNED OPERATION. The third fence must run first and must read ' +
          'the DOCUMENT; an acknowledgement of an exemption cannot create one.',
      )
    })
  })
})

/* ==================================================================== *
 * §2 · THE FOURTH FENCE, KEYED ON THE CALLER.
 * ==================================================================== */

describe('§2 · a person-facing exemption is not SERVED unless the mount says so', () => {
  it('2a · bare, on the foundation tier — the one real mount this fence catches', async () => {
    /**
     * `resolveTenantContext` is `exempt:` and the foundation document declares
     * `security: [sessionContext]`. This is the shape
     * `server/data-plane/start.ts` mounts in production, and it is the only
     * one in `server/` that needs the mark.
     */
    await assert.rejects(
      async () => {
        const app = await plane('foundation', { resolveTenantContext: async () => ({}) })
        await app.close()
      },
      /buys its way out with a reason[\s\S]*resolveTenantContext \(caller: person/,
      'THE FOURTH FENCE IS GONE. Before G911 it keyed on `TIER_REQUIRES_CAPABILITY[tier]`, ' +
        'which was `false` here, so this mount booted; it keys on the caller now.',
    )
  })

  it('2b · marked, the SAME mount boots — so §2a is about the mark and not about the operation', async () => {
    const app = await plane('foundation', { resolveTenantContext: servedWithoutAGate(async () => ({})) })
    await app.close()
  })

  it('2c · and a MACHINE-facing exemption still mounts bare, which is what keeps the fence narrow', async () => {
    /**
     * 🛑 THE DIFFERENTIAL THAT STOPS THE FENCE BEING KEYED ON THE WORD
     * `exempt`. If it were, every liveness probe and the whole control plane
     * would need a mark — 83 operations rather than the 64 that face a person
     * — and the mark would become a ritual rather than a decision. Both of
     * these are exempt; neither has a person on the other end.
     */
    const machine = await plane('controlPlane', { listEntitledPacks: async () => ({ packs: [] }) })
    await machine.close()
    const nobody = await plane('dataPlaneLocal', { checkLocalHealth: async () => ({ status: 'ok' }) })
    await nobody.close()
  })

  it('2d · the mark cannot CONTRADICT the document — a gated operation wearing it does not boot', async () => {
    await assert.rejects(
      async () => {
        const app = await plane('capability', { listRuns: servedWithoutAGate(async () => ({})) })
        await app.close()
      },
      /marked `servedWithoutAGate\(\)` and name an operation that DOES carry a capability[\s\S]*listRuns/,
      'A MARK REMOVED A GATE, OR WAS SILENTLY IGNORED ON A GATED OPERATION. Either reading is ' +
        'worse than a boot failure: the first is the fail-open, the second teaches the next ' +
        'author that the two marks are interchangeable switches.',
    )
  })
})

/* ==================================================================== *
 * §3 · THE HALF THAT LIVES IN THE HOOK.
 * ==================================================================== */

describe('§3 · the gate still returns at its first line, and that is only safe because of §2', () => {
  it('3a · a marked exempt operation is served with NO gate call at all', async () => {
    /**
     * 🛑 **THE TWO HALVES OF ONE CONTROL, WITNESSED TOGETHER.** The
     * `preValidation` hook returns before it reaches for a principal when the
     * route names no capability; that is correct and must not change. What
     * makes it safe is that `mountTier()` decides which routes may be in that
     * state. **Widen either alone and the gate is green and the property is
     * gone** — which is the shape `db/migrations/0059`'s trigger records
     * (G659): a policy that sees the new row and a policy that sees the old
     * one, neither of which sees both.
     *
     * The authoriser below refuses everything and is never consulted: the
     * counter proves the absence rather than inferring it from a 200.
     */
    /**
     * ⚠️ **THE OPERATION IS `listPartnerRegistry` AND NOT D1, AND THE CHOICE
     * IS WORTH ONE LINE.** D1 is the production shape and §2a/§2b use it; it
     * is a POST whose declared 200 is a whole `TenantContext`, so a stub
     * handler there answers 500 at the RESPONSE SERIALISER and the 200 this
     * assertion needs would have to be faked. `listPartnerRegistry` is the
     * same annotation shape — exempt, `sessionContext`, a person — and is the
     * operation `tests/http/administration-tier-unmounted.test.ts` §3b
     * measures the ungated 200 on, so the two files stay comparable.
     */
    let asked = 0
    const app = await plane(
      'administration',
      { listPartnerRegistry: servedWithoutAGate(async () => ({ partners: [] })) },
      () => {
        asked += 1
        return 'not_held'
      },
    )
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/staff/partners',
        headers: { [HEADER]: 'ten_acme' },
      })
      assert.equal(res.statusCode, 200, `expected the ungated 200; got ${res.statusCode}: ${res.payload.slice(0, 200)}`)
      assert.equal(
        asked,
        0,
        'THE AUTHORISER WAS CONSULTED FOR A ROUTE THAT NAMES NO CAPABILITY. The counter is ' +
          'the assertion, not the 200: a 200 alone cannot tell "the gate returned at its first ' +
          'line" from "the gate ran and the authoriser said held".',
      )
    } finally {
      await app.close()
    }
  })

  it('3b · the differential — the SAME plane against a gated operation refuses 403', async () => {
    /**
     * Without this, §3a could mean "the hook is exemption-aware" or "the
     * authoriser was never wired up", and those are opposite conclusions.
     * This is `tests/http/administration-tier-unmounted.test.ts` §3c's
     * argument, re-run against the plane this file builds.
     */
    let asked = 0
    const app = await plane('capability', { listRuns: recordsAuthorisation(async () => ({ runs: [] })) }, () => {
      asked += 1
      return 'not_held'
    })
    try {
      const res = await app.inject({ method: 'GET', url: '/v1/runs', headers: { [HEADER]: 'ten_acme' } })
      assert.equal(res.statusCode, 403)
      assert.equal(JSON.parse(res.payload).code, 'capability_not_held')
      assert.equal(asked, 1, 'the gate did not consult the authoriser for a GATED operation')
    } finally {
      await app.close()
    }
  })
})

/* ==================================================================== *
 * §4 · G301's SIXTH FENCE STILL BITES.
 * ==================================================================== */

describe('§4 · minting is still a precondition of mounting', () => {
  it('4a · a gated operation whose handler mints nothing does not boot', async () => {
    await assert.rejects(
      async () => {
        const app = await plane('capability', { listRuns: async () => ({}) })
        await app.close()
      },
      /mint no authorisation record[\s\S]*listRuns/,
      'THE SIXTH FENCE IS GONE. G301 makes minting a PRECONDITION of mounting so that ' +
        'invariant 10 cannot erode one slice at a time, and this slice rewrote the predicate ' +
        'it keys on (`capability.kind === \'capability\'` → `gateVerdictOf(...) === \'gated\'`). ' +
        'A restatement that stopped firing would be the worst possible outcome of this change.',
    )
  })

  it('4b · the two marks are NOT interchangeable in the OTHER direction either', async () => {
    /**
     * 🛑 **THE FAIL-OPEN THAT LIVES IN ONE CHARACTER OF `isUngated()`.**
     * Both marks are objects carrying a `handle`, so the fourth fence tells
     * them apart by a runtime tag. Write that predicate as
     * `typeof entry === 'object'` — which is exactly what `isRecording()` was
     * before this slice, and therefore the shape a reader is most likely to
     * copy — and **every `recordsAuthorisation()`-marked handler silently
     * satisfies the fourth fence**, so a person-facing exemption mounts with
     * no acknowledgement at all.
     *
     * ⚠️ **THIS IS NOT §2d WEARING A DIFFERENT HAT AND THE DIFFERENCE WAS
     * MEASURED, NOT ASSUMED.** An earlier draft of this assertion re-mounted
     * §2d's case and went red on exactly the mutations §2d went red on —
     * *"a control that reports coverage it does not have"*, which is the
     * objection §3d of `tests/http/administration-tier-unmounted.test.ts`
     * records against its own first version. This one is the mirror: §2d
     * mutates the DOCUMENT side (a gated operation wearing the ungated mark),
     * this mutates the MOUNT side (an exempt operation wearing the recording
     * mark), and no single fence change reds both.
     */
    await assert.rejects(
      async () => {
        const app = await plane('foundation', {
          resolveTenantContext: recordsAuthorisation(async () => ({})),
        })
        await app.close()
      },
      /buys its way out with a reason[\s\S]*resolveTenantContext/,
      'A `recordsAuthorisation()` MARK SATISFIED THE FOURTH FENCE. The two marks answer ' +
        'different questions — one acknowledges an exemption the CONTRACT states, the other ' +
        'satisfies invariant 10 for an operation the CONTRACT gates — and a fence that cannot ' +
        'tell them apart accepts either for either.',
    )
  })

  it('4c · the fence that fires is the one whose name is in the message — all four, distinctly', async () => {
    /**
     * ⚠️ A CONTROL AGAINST THE FAILURE MODE THIS SESSION FOUND TWICE: a test
     * that asserts "it rejected" and is satisfied by a rejection from a
     * DIFFERENT fence. Each of these four mounts is refused, and each is
     * refused for its own reason — so a fence that swallowed its neighbour's
     * case would go red here rather than look like coverage.
     */
    const cases: ReadonlyArray<readonly [string, TierName, Record<string, MountedHandler>, RegExp]> = [
      ['undeclared', 'capability', { noSuchOperation: async () => ({}) }, /does not declare/],
      ['exempt+person, bare', 'foundation', { resolveTenantContext: async () => ({}) }, /buys its way out/],
      [
        'gated + ungated mark',
        'capability',
        { listRuns: servedWithoutAGate(async () => ({})) },
        /DOES carry a capability/,
      ],
      ['gated, bare', 'capability', { listRuns: async () => ({}) }, /mint no authorisation record/],
    ]
    for (const [label, tier, handlers, pattern] of cases) {
      await assert.rejects(
        async () => {
          const app = await plane(tier, handlers)
          await app.close()
        },
        pattern,
        `${label}: refused by the wrong fence, or not refused`,
      )
    }
  })
})

/* ==================================================================== *
 * §5 · WHAT REPLACES THE ARGUMENT — THE MARK'S POPULATION, COUNTED.
 * ==================================================================== */

describe('§5 · an ungated served operation costs a named call, and there are exactly two', () => {
  /**
   * 🛑 **THIS IS THE ANSWER TO *"AN `exempt:` USED TO COST A WHOLE TIER'S
   * ARGUMENT AND NOW COSTS ONE LINE — WHAT REPLACES IT?"*, AND IT IS
   * DELIBERATELY THE SAME CONTROL G192 AND G301 ALREADY USE: a `grep` over
   * `server/` that must return a fixed answer, asserted rather than run by
   * hand.**
   *
   * `tests/http/authorisation-record.test.ts` §2b states the pattern in its
   * own voice — it *"counts them and fails the gate at two"* — and the
   * argument for it is on `recordsAuthorisation()`: the mark *"becomes an
   * EXPLICIT, GREPPABLE CALL rather than a shape anybody can happen to
   * satisfy"*.
   *
   * ⚠️ **AND IT IS AN UPPER BOUND, NOT A PROOF OF SAFETY.** A second call
   * site is not forbidden — the fence exists so that serving an ungated
   * person-facing operation is POSSIBLE and ARGUED — it is forbidden to
   * arrive without somebody moving this number and saying why.
   */
  /**
   * ⛔ **THIS TEST READ `5a · exactly one call site in `server/`, and it is
   * the one D1 needs` UNTIL 22 Sep 2026, AND IT WAS MOVED THE WAY ITS OWN
   * MESSAGE DEMANDS RATHER THAN RELAXED — G1941/G1947.** The second is
   * `resolveHomeRealm`, the first unauthenticated person-facing operation
   * this product serves, and it is argued at its own mount in
   * `server/data-plane/start.ts` at length.
   *
   * 🛑 **AND THE ASSERTION IS STRICTLY STRONGER THAN THE COUNT IT REPLACES,
   * WHICH IS WHY IT IS NOT A BUMPED NUMBER.** A count of TWO is satisfied by
   * any two calls anywhere under `server/`; this names the file and the
   * operationId of each, so **swapping one mark for a different operation is
   * a red gate rather than a green one.** The `sites.length` assertion is
   * kept as well, because it is the one that catches a THIRD.
   *
   * ⚠️ **AND `resolveHomeRealm`'s MARK IS NOT COMPELLED BY THE FOURTH FENCE
   * AT ALL — G1948.** `callerOf([])` is `none`, so the fence's own filter
   * drops it; the mount takes the mark voluntarily. **So this control now
   * counts two DIFFERENT things**: one call the fence would refuse to boot
   * without, and one a mount chose to make greppable. That is a widening of
   * what the control SEES rather than of what the server serves, and it is
   * named here so the next reader does not collapse them.
   */
  /**
   * ⛔ **AND IT READ `5a · exactly two call sites in `server/`, and each is
   * named` UNTIL 1 Oct 2026 — D6-8, G2242 — AND IT IS MOVED BACK TO ONE THE
   * WAY ITS OWN MESSAGE DEMANDS, IN THE COMMIT THAT REMOVED THE CALL.** The
   * second call was `resolveHomeRealm`'s VOLUNTARY mark (G1948 above: *"one a
   * mount chose to make greppable"*). The owner's D6-8 ruling gives that
   * population its own compelled mark — `servedPublicly()`, the SEVENTH fence
   * — so the call left this set rather than being deleted from the server.
   * **This control counts ONE thing again**: an authenticated person served
   * past `decide()`. The public population is counted, by name, at
   * `tests/http/public-mount-fence.test.ts` §3.
   */
  /**
   * ⛔ **AND IT READ `5a · exactly one call site in `server/`, and it is
   * named` UNTIL 2 Oct 2026 — G3004 — AND IT MOVES TO TWO THE WAY ITS OWN
   * MESSAGE DEMANDS, IN THE COMMIT THAT ADDS THE CALL.** The second is
   * `signOut`, the REVOKE half of the owner's profile-switcher ruling G2771.
   * Its mark is COMPELLED (the fourth fence): `session.openapi.yaml` overrides
   * its `security: []` with `sessionContext`, so the caller is a person, and it
   * is `exempt`. It revokes the caller's OWN row and nothing else, argued at
   * its mount and in `server/data-plane/sign-out.ts`. The census in 5b does
   * not move — it counts what is DECLARED.
   */
  /**
   * ⛔ **AND IT READ `5a · exactly two call sites` UNTIL 3 Oct 2026 — G3354 —
   * AND IT MOVES TO THREE IN THE COMMIT THAT ADDS THE CALL.** The third is
   * `getSessionPrincipal`, the chrome's who-am-I: COMPELLED exactly as
   * `signOut`'s is (`sessionContext` override, `exempt`), and it reads the
   * caller's OWN person row and the bound tenant's roster name, argued in
   * `server/data-plane/session-principal.ts`.
   */
  it('5a · exactly three call sites in `server/`, and each is named', () => {
    const sites: string[] = []
    for (const file of sourceFilesUnder(SERVER_DIR)) {
      if (file.endsWith(path.join('http', 'app.ts'))) continue
      const source = codeOf(readFileSync(file, 'utf8'))
      for (const line of source.split('\n')) {
        if (line.includes('servedWithoutAGate(')) sites.push(`${path.relative(REPO_ROOT, file)}: ${line.trim()}`)
      }
    }
    assert.equal(
      sites.length,
      3,
      'The number of operations this server serves with NO GATE to a person has changed. That ' +
        'is not forbidden and it is not a formality: each one is a route `decide()` never sees ' +
        'and invariant 10 never records. Move this number in the commit that adds the call, ' +
        `and argue it at the call site.\n\n${sites.join('\n')}`,
    )
    for (const operationId of ['resolveTenantContext', 'signOut', 'getSessionPrincipal']) {
      const site = sites.find((s) => s.includes(operationId))
      assert.ok(
        site,
        `no \`servedWithoutAGate()\` call names \`${operationId}\`. This is a SET and not a ` +
          'count: two calls naming one operation between them would satisfy the length ' +
          `assertion above and would mean a mark moved.\n\n${sites.join('\n')}`,
      )
      assert.match(site, /data-plane\/start\.ts/, `${operationId} is marked outside the mount table`)
    }
  })

  it('5b · and the census it is bounded by is the one the checker pins', () => {
    /**
     * The two controls are different sizes on purpose and neither is the
     * other: the census counts what the CONTRACT declares, the grep counts what
     * the SERVER serves. The gap is the set of operations that would each need
     * a new, argued call before they could answer anybody.
     *
     * 🛑 **BOTH OPERANDS MOVED ON 21-22 Sep 2026, IN OPPOSITE DIRECTIONS, ON
     * DIFFERENT BRANCHES — SO THIS TREE IS A THIRD ANSWER NEITHER PARENT
     * COMPUTED. §5.11, ARRIVING IN A TEST'S PROSE RATHER THAN IN A COUNT ON
     * `CLAUDE.md`.** The census went **64 → 61** (R8, the owner's: three
     * onboarding operations are annotated `view_substrate` in place and are
     * therefore GATED, so they are not person-facing exemptions any more), and
     * §5's grep went **1 → 2** (G1941: `resolveHomeRealm` is mounted). Neither
     * branch saw the other's move; both assertions are the MERGED tree's,
     * derived here rather than carried across from either side.
     *
     * ⚠️ **AND THE TWO NUMBERS ARE NOT SUBTRACTABLE ANY MORE — G1948, AND THIS
     * SENTENCE SAID THEY WERE UNTIL 22 Sep 2026.** It read *"the grep counts
     * what the SERVER serves (1). The gap — 63 —"*. **`resolveHomeRealm` is
     * NOT IN THE CENSUS AT ALL**, because `callerOf([])` answers `none` and the
     * census counts person-facing exemptions by SECURITY SCHEME — so the served
     * set §5 bounds is not a subset of the set this number counts.
     * **Subtracting one from the other is a category error**, which is G1948's
     * finding arriving in the one place that did the subtraction.
     *
     * 🛑 **READ THE TWO MOVEMENTS TOGETHER, WHICH IS WHAT R8's OWN NOTE ASKS
     * AND IS WHY IT IS KEPT RATHER THAN REPLACED:** this number FALLING while
     * §5's stays at one is an operation being GATED, which is what R8 did three
     * times and is the direction this file wants. This number falling while
     * §5's RISES — which is what the merged tree shows — is **two unrelated
     * acts and not one trend**, and the merge says so rather than leaving a
     * reader to infer a story from the pair.
     */
    /* ✅ 61 → 52 ON 1 Oct 2026 — W5 GATED NINE partner-portal operations in
     * place on R10's verbs, and §5's anchored grep did NOT move: the direction
     * this file wants, nine times, with no ungated mount added. */
    /* ⚠️ 52 → 53 ON 3 Oct 2026 — G3354 DECLARED `getSessionPrincipal`, a
     * person-facing exemption, AND §5 ROSE WITH IT. Read together that is an
     * operation served past the gate, which is the act this message says owes
     * an argument at the call site — and it is made there: the subject of the
     * read is the caller, so there is no resource class for a verb to name. */
    const declared = Object.values(EXEMPT_WITH_A_PERSON_TO_ASK).reduce((a, b) => a + b, 0)
    assert.equal(
      declared,
      53,
      'the census total moved; sweep it and read the entry. ⚠️ CHECK §5 IN THE SAME BREATH: ' +
        'this number FALLING while §5’s stays at one is an operation being gated, which is ' +
        'what R8 did three times. This number falling while §5’s RISES is an operation being ' +
        'served past the gate instead, which is a different act entirely and owes an argument ' +
        'at the call site.',
    )
  })
})

/* ==================================================================== *
 * §6 · THE SPLIT IS NOT REVERSED.
 * ==================================================================== */

describe('§6 · G781 stands, and this slice only makes it unnecessary', () => {
  it('6a · `platform-console.openapi.yaml` still declares 14 operations, every one gated', () => {
    /**
     * ⚠️ **THE OWNER'S OBJECTION, AS AN ASSERTION.** They took this ruling
     * saying it *"would make `platform-console.openapi.yaml`'s existence a
     * contract change nobody needs"* — and reversing G781 is a separate
     * ruling, on top of which a concurrent agent is adding an operation to
     * that document. **So this asserts a FLOOR and the composition, not an
     * exact count**: an operation arriving there must not break this, but the
     * fourteen turning into zero (an un-split) must.
     */
    const specs = specsOf('platformConsole')
    assert.ok(specs.length >= 14, `the console document declares ${specs.length}; the split looks reverted`)
    for (const s of specs) {
      assert.equal(
        s.capability.kind,
        'capability',
        `${s.operationId} states an exemption on the console tier. Since G911 that is legal at ` +
          'the document level and it MOVES THE CENSUS — `EXEMPT_WITH_A_PERSON_TO_ASK.' +
          'platformConsole` is pinned at 0. Sweep it deliberately or annotate the operation.',
      )
    }
    assert.equal(EXEMPT_WITH_A_PERSON_TO_ASK.platformConsole, 0)
  })
})

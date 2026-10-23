/**
 * CSRF AT THE TRANSPORT — THE CENSUS, AND THE REFUSAL OVER EVERY ONE OF THEM.
 * G3231–G3236, 2 Oct 2026. Read `server/http/cross-origin.ts` first.
 *
 * G3212 refused a request a browser marks as started by another origin — on
 * D1 alone. Every other cookie-authenticated non-safe operation was reachable
 * from a same-SITE sibling host (`SameSite=Lax` does not separate siblings).
 * The check now lives in the `onRequest` hook and is keyed on a fact the route
 * carries from the contract, so this suite asks two things:
 *
 *  §1 · THE CENSUS. Every DECLARED non-safe operation, across all seven tiers,
 *       is either refused cross-origin by the transport or named below WITH A
 *       REASON. The exempt list is typed into this file, not derived, so a new
 *       public or machine-facing write is a red here until somebody argues it.
 *       Declared ⊇ mounted, and the hook reads the route rather than a list, so
 *       the census over the declared set covers every mount a fortiori.
 *
 *  §2 · THE REFUSAL, OVER A REAL `buildPlane()` MOUNTING EVERY ONE OF THEM.
 *       Each covered operation is driven with a sibling's `Origin` and must be
 *       401 `session_invalid` WITHOUT the authenticator being asked; each is
 *       then driven same-origin and must reach the authenticator (the base
 *       control, without which §2 measures nothing).
 *
 * 🛑 WITNESSED RED: with the `refusesCrossOrigin` branch deleted from the
 * `onRequest` hook in `server/http/app.ts`, every §2a case failed (the
 * authenticator was asked and the stub answered) — recorded on G3233.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { Writable } from 'node:stream'

import type { FastifyRequest } from 'fastify'

import {
  buildPlane,
  recordsAuthorisation,
  servedPublicly,
  servedWithoutAGate,
  type Handler,
  type MountedHandler,
} from '../../server/http/app.ts'
import {
  callerMayBeAPerson,
  gateVerdictOf,
  publicOperationFacesAPerson,
} from '../../server/contract/capability.ts'
import { basePathOf, loadTier, TIERS, type TierName } from '../../server/contract/document.ts'
import { routesOf, type RouteSpec } from '../../server/contract/routes.ts'
import {
  CROSS_ORIGIN_DETAIL,
  SAFE_METHODS,
  refusesCrossOrigin,
  startedElsewhere,
} from '../../server/http/cross-origin.ts'

const HOST = 'ten-acme.us-west-2.reconcileai.app'
const SIBLING = 'https://ten-globex.us-west-2.reconcileai.app'
const CALLER = 'x-test-caller'

/** The stubs answer a status no operation declares a body for; keep the log off the run. */
const quiet = (): Writable => new Writable({ write: (_c, _e, done) => done() })

const TIER_NAMES = Object.keys(TIERS) as TierName[]

function specsOf(tier: TierName): readonly RouteSpec[] {
  const doc = loadTier(tier)
  return routesOf(doc, basePathOf(doc))
}

/**
 * 🛑 THE EXEMPTIONS, EACH WITH ITS REASON. Typed, not derived: a non-safe
 * operation that the transport does NOT refuse cross-origin must appear here
 * by `tier:operationId`, so the next one is an argument rather than a default.
 */
const PUBLIC =
  'declares `security: []`: the session reader never runs, so no cookie is read and there ' +
  'is no ambient credential to borrow'
const MACHINE =
  'SigV4 in `Authorization` — a header a browser never attaches on its own, so there is ' +
  'nothing for a forged request to carry'
const EXEMPT: Readonly<Record<string, string>> = {
  /** Reached CROSS-origin by design: the apex's Amplify rewrite (G1966). */
  'session:resolveHomeRealm': PUBLIC,
  'session:beginFederatedSignIn': PUBLIC,
  /** The broker's return leg; bound to the attempt by `state` and `nonce` (G2141). */
  'session:completeFederatedSignIn': PUBLIC,
  'controlPlane:sendHeartbeat': MACHINE,
  'controlPlane:shipUsageEvents': MACHINE,
  'controlPlane:submitUsageAttestation': MACHINE,
  'controlPlane:reportPackInstallation': MACHINE,
  'controlPlane:reportAccessSessions': MACHINE,
  /* G4301 — the internal edge's two writes. The caller is the data plane over
     SigV4 (via STS) or the local internal token; no browser holds either, so a
     cross-origin form post carries nothing that authenticates. */
  'controlPlane:completeInternalOnboardingStep': MACHINE,
  'controlPlane:forceInternalOnboardingStep': MACHINE,
  'controlPlane:uploadDiagnosticBundle': MACHINE,
}

/** The operations G3212 named as exposed. Each must be covered, by name. */
const NAMED_BY_THE_FINDING = [
  'capability:assignException',
  'capability:proposeResolution',
  'capability:decideApproval',
  'capability:executeProposal',
  'capability:reverseResolution',
  'capability:admitRun',
  'capability:grantRoleAssignment',
  'capability:bindEndpointCredential',
  'capability:declareEndpoint',
  'capability:stopEndpoint',
  'capability:resumeEndpoint',
  'administration:completeOnboardingStep',
  'administration:forceOnboardingStep',
  'administration:submitDealRegistration',
  'session:signOut',
  'foundation:resolveTenantContext',
]

describe('cross-origin writes — the census (G3232)', () => {
  const nonSafe = TIER_NAMES.flatMap((tier) =>
    specsOf(tier)
      .filter((s) => !SAFE_METHODS.has(s.method))
      .map((s) => ({ tier, spec: s, key: `${tier}:${s.operationId}` })),
  )

  it('§1a · every non-safe operation is refused cross-origin OR exempt by name with a reason', () => {
    const unrefused = nonSafe.filter((o) => !refusesCrossOrigin(o.spec)).map((o) => o.key).sort()
    assert.deepEqual(
      unrefused,
      Object.keys(EXEMPT).sort(),
      'the set of non-safe operations the transport does NOT refuse cross-origin changed. A new ' +
        'entry is a write a sibling host can forge until it is argued in EXEMPT; a vanished one ' +
        'should leave EXEMPT with it.',
    )
  })

  it('§1b · each exemption is the reason it claims to be', () => {
    for (const { key, spec } of nonSafe) {
      const reason = EXEMPT[key]
      if (reason === undefined) continue
      if (reason === PUBLIC) assert.equal(spec.secured, false, `${key} is exempt as public and is secured`)
      if (reason === MACHINE) {
        assert.equal(spec.caller, 'machine', `${key} is exempt as machine-facing and its caller is ${spec.caller}`)
      }
    }
  })

  it('§1c · ANTI-VACUITY — the covered set is large and holds every operation G3212 named', () => {
    const covered = new Set(nonSafe.filter((o) => refusesCrossOrigin(o.spec)).map((o) => o.key))
    assert.ok(covered.size >= 60, `only ${covered.size} operations are covered — the predicate went narrow`)
    for (const key of NAMED_BY_THE_FINDING) assert.ok(covered.has(key), `${key} is not refused cross-origin`)
  })

  it('§1d · a SAFE method is never refused, whatever its caller', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      assert.equal(refusesCrossOrigin({ method, secured: true, caller: 'person' }), false)
    }
    assert.equal(refusesCrossOrigin({ method: 'PATCH', secured: true, caller: 'unclassified' }), true)
    assert.equal(refusesCrossOrigin({ method: 'PATCH', secured: true, caller: 'mixed' }), true)
  })
})

describe('cross-origin writes — the predicate (G3212, moved)', () => {
  const req = (headers: Record<string, string>): FastifyRequest =>
    ({ headers: { host: HOST, ...headers } }) as unknown as FastifyRequest
  for (const [label, headers, expected] of [
    ['no browser headers at all — a script holding the handle', {}, false],
    ['same-origin, both headers', { origin: `https://${HOST}`, 'sec-fetch-site': 'same-origin' }, false],
    ['Sec-Fetch-Site: same-site — a sibling host', { 'sec-fetch-site': 'same-site' }, true],
    ['Sec-Fetch-Site: cross-site', { 'sec-fetch-site': 'cross-site' }, true],
    ['Sec-Fetch-Site: none — typed into the address bar', { 'sec-fetch-site': 'none' }, true],
    ['an Origin naming a sibling', { origin: SIBLING }, true],
    ['an Origin that merely STARTS with ours', { origin: `https://${HOST}.evil.test` }, true],
    ['the opaque Origin a sandboxed frame sends', { origin: 'null' }, true],
  ] as const) {
    it(`${label} → ${expected ? 'foreign' : 'not foreign'}`, () => {
      assert.equal(startedElsewhere(req(headers)), expected)
    })
  }
})

describe('cross-origin writes — refused at the transport, over every declared operation (G3233)', () => {
  const stub: Handler = async (_request, reply) => reply.code(204).send()
  /**
   * ⚠️ An operation whose body `mountTier()` cannot validate is REFUSED AT
   * BOOT, so it cannot be mounted here or anywhere — it is skipped in §2 and
   * still counted by §1. Today that is three control-plane (machine) writes.
   */
  const mountable = (spec: RouteSpec): boolean =>
    !SAFE_METHODS.has(spec.method) && spec.unvalidatableBody === undefined
  const problemOf = (res: { body: string }): { code?: string; detail?: string } => {
    try {
      return JSON.parse(res.body) as { code?: string; detail?: string }
    } catch {
      return {}
    }
  }

  function mountAll(tier: TierName): Record<string, MountedHandler> {
    const handlers: Record<string, MountedHandler> = {}
    for (const spec of specsOf(tier)) {
      if (!mountable(spec)) continue
      const verdict = gateVerdictOf(spec.capability)
      if (verdict === 'gated') handlers[spec.operationId] = recordsAuthorisation(stub)
      else if (!spec.secured && publicOperationFacesAPerson(tier, spec.caller)) {
        handlers[spec.operationId] = servedPublicly(stub)
      } else if (verdict === 'exempt' && callerMayBeAPerson(spec.caller)) {
        handlers[spec.operationId] = servedWithoutAGate(stub)
      } else handlers[spec.operationId] = stub
    }
    return handlers
  }

  for (const tier of TIER_NAMES) {
    const specs = specsOf(tier).filter(mountable)
    if (specs.length === 0) continue

    it(`${tier} · a sibling's write is refused before the authenticator; a same-origin one is not`, async () => {
      let asked = 0
      const app = await buildPlane<{ id: string }>(
        {
          plane: 'test-cross-origin-plane',
          authenticate: (request: FastifyRequest) => {
            asked += 1
            return typeof request.headers[CALLER] === 'string' ? { id: 'p' } : null
          },
          unauthenticatedDetail: 'no session',
          authorise: () => 'held',
          unauthorisedDetail: 'no capability',
          logDestination: quiet(),
        },
        [{ tier, handlers: mountAll(tier) }],
      )
      try {
        for (const spec of specs) {
          const url = spec.url.replace(/:[A-Za-z]+/g, 'x')
          const key = `${tier}:${spec.operationId}`
          const send = (headers: Record<string, string>) =>
            app.inject({
              method: spec.method,
              url,
              headers: { host: HOST, [CALLER]: 'p', 'content-type': 'application/json', ...headers },
              payload: '{}',
            })

          asked = 0
          const forged = await send({ origin: SIBLING, 'sec-fetch-site': 'same-site' })
          const body = problemOf(forged)
          if (refusesCrossOrigin(spec)) {
            assert.equal(forged.statusCode, 401, `${key}: a sibling's forged write was served (${forged.statusCode})`)
            assert.equal(body.code, 'session_invalid')
            assert.equal(body.detail, CROSS_ORIGIN_DETAIL)
            assert.equal(asked, 0, `${key}: the authenticator was asked — the refusal is not before the session read`)

            asked = 0
            const own = await send({ origin: `https://${HOST}`, 'sec-fetch-site': 'same-origin' })
            assert.equal(asked, 1, `${key}: a SAME-origin write never reached the authenticator, so §2 measures nothing`)
            assert.notEqual(
              problemOf(own).detail,
              CROSS_ORIGIN_DETAIL,
              `${key}: a same-origin write was refused as cross-origin`,
            )
          } else {
            assert.notEqual(body.detail, CROSS_ORIGIN_DETAIL, `${key} is exempt and was refused as cross-origin`)
          }
        }
      } finally {
        await app.close()
      }
    })
  }

  it('a cross-origin GET is not refused — a top-level navigation must still arrive', async () => {
    const tier: TierName = 'capability'
    const get = specsOf(tier).find((s) => s.method === 'GET' && s.secured && gateVerdictOf(s.capability) === 'gated')
    assert.ok(get !== undefined)
    let asked = 0
    const app = await buildPlane<{ id: string }>(
      {
        plane: 'test-cross-origin-plane',
        authenticate: () => {
          asked += 1
          return { id: 'p' }
        },
        unauthenticatedDetail: 'no session',
        authorise: () => 'held',
        unauthorisedDetail: 'no capability',
      },
      [{ tier, handlers: { [get.operationId]: recordsAuthorisation(stub) } }],
    )
    try {
      const res = await app.inject({
        method: 'GET',
        url: get.url.replace(/:[A-Za-z]+/g, 'x'),
        headers: { host: HOST, origin: SIBLING, 'sec-fetch-site': 'same-site' },
      })
      assert.equal(asked, 1, `a cross-origin GET did not reach the authenticator (${res.statusCode})`)
    } finally {
      await app.close()
    }
  })
})

/**
 * THE CONTROL PLANE'S AUTHORISER — WHICH REFUSES TO EXIST AT BOOT RATHER THAN
 * ANSWERING AT REQUEST TIME.
 *
 * ┌─ THE CLAIM, AND WHY IT IS A BOOT FAILURE AND NOT A VERDICT ────────────────┐
 * │ Every one of this tier's operations is EXEMPT.                             │
 * │ the control plane's callers are MACHINES (sigV4)                          │
 * │ (`server/contract/capability.ts`) and the reason is on the constant: this  │
 * │ document declares `security: [sigV4]`, so the caller is a MACHINE.         │
 * │ `decide()` needs a `PrincipalContext` carrying subject status, org class,  │
 * │ partner id, partner grant and held assignments, and would refuse at the    │
 * │ subject-status branch long before it reached a capability. A SigV4 caller  │
 * │ has none of those, and this plane's own principal type says so in its      │
 * │ declaration: `ChannelPrincipal` is `{ channel: 'local-development' }` and  │
 * │ carries NO TENANT at all.                                                  │
 * │                                                                            │
 * │ So the honest answer to "does this caller hold this verb" is not `false`.  │
 * │ It is that the question was asked on the wrong plane, and a plane that is  │
 * │ being asked it is misconfigured. A verdict would serve the request with a  │
 * │ 403 and leave the misconfiguration running; a throw at boot does not.      │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 AND THE FENCE THAT MATTERS IS THE FIRST FUNCTION, NOT THE SECOND.
 * `refuseGatedOperations()` runs before `buildPlane()` and refuses to start the
 * process at all if any operation this plane mounts names a capability.
 * `noCapabilityIsReachable` is the belt to that braces: it is what would be
 * CALLED if the first function ever stopped being called, and it throws, so the
 * absence of a gate here can never degrade into a gate that quietly permits.
 *
 * ⚠️ NOTHING IN THIS FILE IMPORTS `model/access.ts` OR `db/tenant-scope.ts`, AND
 * THAT IS THE PROPERTY THE WHOLE DESIGN OF `PlaneOptions.authorise` EXISTS TO
 * PRESERVE. Invariant 3 — "the control plane publishes downward and never reads
 * tenant data" — is held here by construction: the capability arrives as an
 * opaque `string` from the shared layer, so neither the access model nor the
 * tenant-scoped transaction seam enters this directory's import graph.
 * `server/control-plane/config.ts` carries the standing correction about what
 * "nothing imports it" does and does not prove, and
 * `tests/http/plane-separation.test.ts` asserts the topology. Reproduce the
 * import half:
 *
 *   grep -rnE "^import .*(model/access|tenant-scope)" server/control-plane/
 *
 * returns nothing.
 *
 * 🛑 **THE `^import` IS NEW — G2174, 28 Sep 2026 — AND THE UNANCHORED FORM
 * THIS LINE CARRIED ANSWERED ELEVEN AGAINST A STATED NOTHING.** Every one of
 * the eleven was PROSE, and most of it was prose SAYING THE IMPORT IS ABSENT —
 * this header's own §0, `config.ts`, `db.ts`, `migrate-main.ts`,
 * `provision.ts` and `start.ts`. **The more carefully invariant 3's import
 * half was narrated, the further its own derivation drifted from nothing**,
 * which is the ratchet G2081's checker exists to stop. The false form is
 * DESCRIBED and not restated: spelling it here is what made it wrong.
 * ⚠️ **AND THE ANCHOR IS A LANDMARK**: it sees a static `import` and not a
 * dynamic one. The property is asserted by
 * `tests/http/plane-separation.test.ts`, which is unchanged.
 */

import { basePathOf, loadTier } from '../contract/document.ts'
import { routesOf } from '../contract/routes.ts'
import type { CapabilityAuthoriser, TierMount } from '../http/app.ts'
import type { ControlPrincipal } from './start.ts'

/**
 * Refuse to boot if this plane mounts an operation that names a capability.
 *
 * ⚠️ IT WALKS THE DOCUMENT AGAIN RATHER THAN BEING HANDED THE SPECS, and that
 * is one avoidable cost accepted for one property: this check is then true of
 * what the CONTRACT says, not of what a caller passed it. `mountTier()` does its
 * own walk for its own fences; both read `routesOf()` over `loadTier()`, which
 * is cached per process, so the second walk costs a loop and no I/O.
 *
 * 🛑 IT IS THE COMPLEMENT OF `mountTier()`'s FOURTH FENCE, NOT A DUPLICATE OF
 * IT. That one refuses an EXEMPTION on a tier that requires a capability; this
 * one refuses a CAPABILITY on a tier that requires an exemption. Neither can see
 * the other's case, and the two directions are different mistakes: the first is
 * an operation shipped ungated with prose attached, the second is an operation
 * asking a question this process structurally cannot answer.
 */
export function refuseGatedOperations(mounts: readonly TierMount[]): void {
  const gated: string[] = []
  for (const mount of mounts) {
    const doc = loadTier(mount.tier)
    const declared = new Map(routesOf(doc, basePathOf(doc)).map((s) => [s.operationId, s]))
    for (const operationId of Object.keys(mount.handlers)) {
      const spec = declared.get(operationId)
      // Not this function's failure to report: `mountTier()`'s first fence
      // refuses a handler the document does not declare, with a better message.
      if (spec === undefined) continue
      if (spec.capability.kind === 'capability') {
        gated.push(`${mount.tier}:${operationId} → ${spec.capability.capability}`)
      }
    }
  }
  if (gated.length > 0) {
    throw new Error(
      `the control plane refuses to start: ${gated.length} operation(s) it mounts name a ` +
        `capability — ${gated.join(', ')}. This plane authenticates a MACHINE over SigV4 and ` +
        'builds no principal a capability could be evaluated against, so a gate here is a ' +
        'category error rather than a stricter gate. Either the annotation belongs on the ' +
        'capability tier, or the operation does.',
    )
  }
}

/**
 * The authoriser handed to `buildPlane()`. It cannot answer, so it does not.
 *
 * ⚠️ IT THROWS RATHER THAN RETURNING `'not_held'`. A refusal would be a
 * plausible-looking 403 on a plane whose whole claim is that no capability is
 * reachable from it, and a 403 nobody expected is a thing operators learn to
 * retry. Reaching this function means `refuseGatedOperations()` above did not
 * run — a fence whose reader was deleted, which
 * `docs/build/deploy-handoff.md` §6 names as strictly worse than a deleted
 * fence, "because the fence would still have looked intact."
 */
export const noCapabilityIsReachable: CapabilityAuthoriser<ControlPrincipal> = (
  _principal,
  capability,
) => {
  throw new Error(
    `the control plane was asked whether a caller holds \`${capability}\`, and it has no ` +
      'principal to answer about. Every operation on this tier is exempt by construction ' +
      '(every operation on it states an exemption, and `callerOf()` answers `machine` for ' +
      'sigV4 — ⚠️ this said `TIER_REQUIRES_CAPABILITY.controlPlane === false` until G911 ' +
      'retired that table, and the claim is unchanged), so this function is unreachable ' +
      'while `refuseGatedOperations()` runs at start-up. It did not.',
  )
}

/**
 * Present because `PlaneOptions` requires it, and unreachable for the same
 * reason the authoriser above is: no route on this plane carries a capability,
 * so the hook that would read this never runs.
 */
export const UNAUTHORISED_DETAIL =
  'This plane evaluates no capability. If a caller received this, the plane is misconfigured.'

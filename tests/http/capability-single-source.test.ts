/**
 * ONE SPELLING OF AN OPERATION'S CAPABILITY — G3961–G3964, 4 Oct 2026,
 * answering G3808.
 *
 * Until this commit every gated operation's capability was written TWICE: as
 * `x-capability` in its contract (which the `preValidation` gate reads off the
 * route) and as `capability: CAPABILITIES.<verb>` on its server-side
 * `AuthorisedOperation` (which `authorize()` minted against). Nothing at BOOT
 * compared them. When they diverged, the gate passed the caller on the
 * contract's verb, `authorize()` refused on the handler's, and every request
 * answered `refusedAfterTheGate()`'s 403 — *"That capability is not held"* to a
 * caller who held exactly the capability the contract asked for.
 *
 * 🛑 THE SECOND SPELLING IS DELETED, NOT FENCED. `authorisedHandler()` mints
 * against `gatedCapabilityOf(request)` — the value the gate itself read — so the
 * mismatch is unrepresentable. What is left is what only the MOUNT can see, and
 * `mountTier()`'s EIGHTH FENCE (appended, G2241's precedent) refuses it at boot:
 *
 *   (a) a recording handler on an operation the document does not gate;
 *   (b) a contract verb the record's closed set does not contain.
 *
 * ⚠️ WITNESSED RED BEFORE IT WAS KEPT: with `listRuns`'s contract annotation
 * edited to `x-capability: view_rnu` in a scratch copy, booting the plane's
 * real `authorisedHandler()` mount refused with
 *   capability: 1 handler(s) mint an authorisation record the contract gives
 *   them no mintable verb for — listRuns (contract `x-capability: view_rnu`;
 *   the record's closed set has no such verb).
 * — and before this commit the same edit booted cleanly and 403'd every
 * request after the gate. §3 below drives the same fence through the predicate
 * without editing a contract.
 *
 * Needs no database: every assertion here is about BOOTING.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  authorisedHandler,
  type AuthorisedOperation,
} from '../../server/data-plane/authorisation-record.ts'
import { NO_IDENTITY_SUBSTRATE } from '../../server/data-plane/authorise.ts'
import { buildPlane, recordsAuthorisation, type TierMount } from '../../server/http/app.ts'
import type { TenantPool } from '../../db/tenant-scope.ts'
import { CAPABILITIES } from '../../model/access.ts'

const OPTIONS = {
  plane: 'data-plane',
  authenticate: async () => ({}),
  unauthenticatedDetail: 'x',
  authorise: () => 'held' as const,
  unauthorisedDetail: 'x',
}

/** The pool is never touched: no request is made in this file. */
const NO_POOL = {} as TenantPool

function operation(operationId: string): AuthorisedOperation {
  return {
    operationId,
    resourceType: 'Run',
    instanceOf: () => null,
    body: async () => ({}),
  }
}

async function bootError(mounts: readonly TierMount[]): Promise<Error> {
  try {
    const app = await buildPlane<unknown>(OPTIONS, mounts)
    await app.close()
  } catch (err) {
    return err as Error
  }
  assert.fail('the plane BOOTED; the eighth fence did not fire')
}

describe('an operation\'s capability has ONE spelling — the contract\'s (G3961)', () => {
  it('1 · `AuthorisedOperation` cannot carry its own capability — a second spelling is a compile error', () => {
    const op: AuthorisedOperation = {
      operationId: 'listRuns',
      // @ts-expect-error — G3961 deleted the field; restoring it is the defect G3808 names.
      capability: CAPABILITIES.admitSource,
      resourceType: 'Run',
      instanceOf: () => null,
      body: async () => ({}),
    }
    assert.equal(op.operationId, 'listRuns')
  })

  it('2 · `authorisedHandler()` declares which contract verbs it can mint, and that set is the closed set', () => {
    const handler = authorisedHandler(NO_POOL, () => NO_IDENTITY_SUBSTRATE, operation('listRuns'))
    assert.ok(handler.mints !== undefined, 'the production constructor must pass the predicate')
    for (const verb of Object.values(CAPABILITIES)) {
      assert.equal(handler.mints(verb), true, `\`${verb}\` is in the closed set and must be mintable`)
    }
    assert.equal(handler.mints('view_rnu'), false)
    assert.equal(handler.mints(''), false)
  })

  it('3 · a gated contract verb the record cannot mint does not BOOT, naming the operation and the value', async () => {
    const err = await bootError([
      { tier: 'capability', handlers: { listRuns: recordsAuthorisation(async () => ({}), () => false) } },
    ])
    assert.match(err.message, /eighth|mint an authorisation record/)
    /* ⚠️ `view_run` ON integrate/4oct-j, NOT `admit_source`: #578 was written
       against a tree where `listRuns` was still `admit_source`; G3801 made it
       `view_exception` and G3881 (the owner's G3802 ruling) `view_run`. The
       assertion names whatever the CONTRACT declares, which is its point. */
    assert.match(err.message, /listRuns \(contract `x-capability: view_run`; the record's closed set has no such verb\)/)
  })

  it('3b · the anti-vacuity arm: the same mount with the real constructor boots', async () => {
    const app = await buildPlane<unknown>(OPTIONS, [
      {
        tier: 'capability',
        handlers: { listRuns: authorisedHandler(NO_POOL, () => NO_IDENTITY_SUBSTRATE, operation('listRuns')) },
      },
    ])
    await app.close()
  })

  it('4 · a recording handler on an operation the document does NOT gate does not BOOT', async () => {
    const err = await bootError([
      {
        tier: 'dataPlaneLocal',
        handlers: {
          checkLocalHealth: authorisedHandler(NO_POOL, () => NO_IDENTITY_SUBSTRATE, operation('checkLocalHealth')),
        },
      },
    ])
    assert.match(
      err.message,
      /checkLocalHealth \(contract `x-capability` is exempt; the handler mints a record and has no verb to mint it against\)/,
    )
  })
})

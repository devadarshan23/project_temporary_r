/**
 * G2549 / G1710 — the cross-host sign-in hand-off, in the model.
 *
 *   §1  the target is a REGISTRY LOOKUP: registered → ok; unregistered,
 *       retired, colliding, empty → refused; consumed → refused first.
 *   §2  the presentation is BOUND to the begun host, after normalisation.
 *   §3  AssertNoTenantDeep BITES: the endorsed-by-a-ruling breach — a tenant
 *       carried on the grant — is a compile error, and the anti-vacuity arm
 *       shows the real types pass.
 *   §4  the return host may collide with nothing.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { TenantId } from '../../model/kernel.ts'
import type { AssertNoTenantDeep } from '../../model/session-mint.ts'
import {
  checkHandOffPresentation,
  checkSignInReturnHost,
  resolveHandOffTarget,
  type ConsoleHost,
  type ServingHost,
  type SignInHandOff,
  type SignInHandOffTarget,
} from '../../model/serving-host.ts'

const TENANTS: readonly ServingHost[] = [
  { host: 'acme.us-west-2.example', tenantId: 'ten_acme' as TenantId, region: 'us-west-2', kind: 'pooled', status: 'active' },
  { host: 'old.us-west-2.example', tenantId: 'ten_old' as TenantId, region: 'us-west-2', kind: 'pooled', status: 'retired' },
  { host: 'twice.example', tenantId: 'ten_twice' as TenantId, region: 'us-west-2', kind: 'delegated', status: 'active' },
] as unknown as readonly ServingHost[]
const CONSOLES: readonly ConsoleHost[] = [
  { host: 'console.example', console: 'staff', status: 'active' },
  { host: 'twice.example', console: 'partner', status: 'active' },
] as unknown as readonly ConsoleHost[]

function handOff(begunHost: string, consumedAt: string | null = null): SignInHandOff {
  return { begunHost, expiresAt: '2026-10-02T00:10:00.000Z', consumedAt }
}

test('§1 · the target is a registry lookup', () => {
  assert.deepEqual(resolveHandOffTarget(TENANTS, CONSOLES, handOff(' ACME.us-west-2.example ')), {
    ok: true,
    target: { host: 'acme.us-west-2.example', surfaceKind: 'tenant' },
  })
  assert.deepEqual(resolveHandOffTarget(TENANTS, CONSOLES, handOff('console.example')), {
    ok: true,
    target: { host: 'console.example', surfaceKind: 'console' },
  })
  for (const host of ['evil.example', 'old.us-west-2.example', 'twice.example', '']) {
    assert.deepEqual(
      resolveHandOffTarget(TENANTS, CONSOLES, handOff(host)),
      { ok: false, refusal: 'hand_off_target_not_served' },
      `\`${host}\` was handed off to`,
    )
  }
  assert.deepEqual(resolveHandOffTarget(TENANTS, CONSOLES, handOff('acme.us-west-2.example', '2026-10-02T00:01:00Z')), {
    ok: false,
    refusal: 'hand_off_already_consumed',
  })
})

test('§2 · presentation is bound to the begun host', () => {
  assert.deepEqual(checkHandOffPresentation({ begunHost: 'acme.us-west-2.example' }, 'ACME.us-west-2.example'), { ok: true })
  for (const presented of ['globex.us-west-2.example', 'console.example', '']) {
    assert.deepEqual(checkHandOffPresentation({ begunHost: 'acme.us-west-2.example' }, presented), {
      ok: false,
      refusal: 'hand_off_presented_on_another_host',
    })
  }
  assert.deepEqual(checkHandOffPresentation({ begunHost: '' }, ''), {
    ok: false,
    refusal: 'hand_off_presented_on_another_host',
  })
})

test('§3 · a tenant carried on the hand-off is a COMPILE error', () => {
  // @ts-expect-error — G1710: a grant crossing a host boundary may carry no TenantId.
  type _Smuggled = AssertNoTenantDeep<SignInHandOff & { readonly tenantId: TenantId }>
  // @ts-expect-error — nor nested one level down.
  type _Nested = AssertNoTenantDeep<SignInHandOffTarget & { readonly surface: { readonly tenantId: TenantId } }>
  /* Anti-vacuity: the declared types themselves pass. */
  type _Real = [AssertNoTenantDeep<SignInHandOff>, AssertNoTenantDeep<SignInHandOffTarget>]
  const witness: _Real | null = null
  assert.equal(witness, null)
})

test('§4 · the return host may collide with nothing', () => {
  assert.deepEqual(checkSignInReturnHost(TENANTS, CONSOLES, 'auth.us-west-2.example'), { ok: true })
  for (const host of ['acme.us-west-2.example', 'CONSOLE.example', 'old.us-west-2.example']) {
    assert.deepEqual(checkSignInReturnHost(TENANTS, CONSOLES, host), {
      ok: false,
      refusal: 'return_host_is_a_served_host',
    })
  }
  assert.deepEqual(checkSignInReturnHost(TENANTS, CONSOLES, ' '), { ok: false, refusal: 'return_host_empty' })
})

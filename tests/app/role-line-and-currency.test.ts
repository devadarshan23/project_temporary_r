/**
 * G4045 and G4046 — THE OWNER'S RULINGS of 4 Oct 2026, the client half.
 *
 *   §1  `servedRoleLine()` — the avatar sub-line shared by the three chromes:
 *       the served role labels joined ` · `, and the caller's own TRUE fallback
 *       (org class, or the partner portal's line) only when none is held.
 *   §2  `fetchSessionPrincipal()` REFUSES rather than repairs: a body with no
 *       `roles`, or a `tenant` with no `reportingCurrency`, or a currency that
 *       is not three upper-case letters, is an error — never a principal with
 *       a default filled in.
 *   §3  the sub-line is drawn as a TEXT NODE in all three chromes — the source
 *       of each puts `servedRoleLine(...)` inside JSX braces and never in
 *       `dangerouslySetInnerHTML` (D6-9: role labels are tenant-authored).
 */

import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { servedRoleLine } from '../../frontend/src/words.ts'
import { fetchSessionPrincipal } from '../../frontend/src/api/principal.ts'

const realFetch = globalThis.fetch

function answer(body: unknown): void {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch
}

const BASE = {
  userId: 'usr_mei',
  displayName: 'Mei Tan',
  email: 'mei@acme.invalid',
  orgClass: 'customer',
  tenant: { tenantId: 'ten_acme', name: 'Meridian', reportingCurrency: 'SGD' },
  capabilities: [],
  roles: ['AP Approver'],
}

describe('the role line and the tenant currency, client side (G4045, G4046)', () => {
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('§1 · served labels win, joined; the fallback only when none is held', () => {
    assert.equal(servedRoleLine(['AP Approver'], 'Customer'), 'AP Approver')
    assert.equal(servedRoleLine(['Admin', 'Approver'], 'Customer'), 'Admin · Approver')
    assert.equal(servedRoleLine([], 'Customer'), 'Customer')
    assert.equal(servedRoleLine(undefined, '1CloudHub staff'), '1CloudHub staff')
  })

  it('§2 · a body missing `roles`, or a tenant missing / malforming `reportingCurrency`, is refused', async () => {
    answer(BASE)
    const ok = await fetchSessionPrincipal('https://plane.invalid')
    assert.deepEqual(ok.roles, ['AP Approver'])
    assert.equal(ok.tenant?.reportingCurrency, 'SGD')

    answer({ ...BASE, tenant: { ...BASE.tenant, reportingCurrency: null } })
    assert.equal((await fetchSessionPrincipal('https://plane.invalid')).tenant?.reportingCurrency, null)

    const { roles: _r, ...noRoles } = BASE
    void _r
    for (const bad of [
      noRoles,
      { ...BASE, roles: [1] },
      { ...BASE, tenant: { tenantId: 'ten_acme', name: 'Meridian' } },
      { ...BASE, tenant: { ...BASE.tenant, reportingCurrency: 'sgd' } },
      { ...BASE, tenant: { ...BASE.tenant, reportingCurrency: '' } },
    ]) {
      answer(bad)
      await assert.rejects(fetchSessionPrincipal('https://plane.invalid'), /required keys/, JSON.stringify(bad))
    }
  })

  it('§3 · each chrome draws the line inside JSX braces — a text node — and none injects HTML', () => {
    for (const file of ['ChromeBar.tsx', 'StaffConsole.tsx', 'PartnerPortal.tsx']) {
      const src = readFileSync(new URL(`../../frontend/src/components/${file}`, import.meta.url), 'utf8')
      assert.match(src, /\{servedRoleLine\(/, `${file} does not draw the served role line`)
      assert.doesNotMatch(src, /dangerouslySetInnerHTML/, `${file} injects HTML`)
    }
  })
})

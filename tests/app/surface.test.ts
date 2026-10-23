/**
 * G3321 + G3291, ONE SUITE SINCE G3371 — `frontend/src/routes/surface.ts`:
 * which surface a host serves. A rendering decision keyed on G297's flat
 * console labels — IMPORTED from the edge config, never retyped — with an
 * explicit registry winning over the label.
 *
 * ⚠️ THIS FILE ABSORBS `tests/app/host-surface.test.ts` (#542), whose module
 * the integration deleted. Every assertion either file made is kept, re-keyed
 * on one vocabulary (`'console'`, not #542's `'staff'`).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { surfaceOf } from '../../frontend/src/routes/surface.ts'
import { CONSOLE_HOST, PARTNERS_HOST, RESERVED_HOST_LABELS } from '../../infra/lib/config.ts'
import { REPO } from '../design/render.ts'

describe('surfaceOf', () => {
  it('the two console hosts the edge binds are the staff console and the partner portal', () => {
    assert.equal(surfaceOf(CONSOLE_HOST), 'console')
    assert.equal(surfaceOf(PARTNERS_HOST), 'partner')
  })

  it('the two flat console labels, case- and trailing-dot-insensitive, port ignored', () => {
    assert.equal(surfaceOf('console.reconcileai.app'), 'console')
    assert.equal(surfaceOf('partners.reconcileai.app'), 'partner')
    assert.equal(surfaceOf('CONSOLE.reconcileai.app.'), 'console')
    assert.equal(surfaceOf('console.localhost'), 'console')
    assert.equal(surfaceOf('partners.localhost'), 'partner')
    assert.equal(surfaceOf('partners.localhost:8093'), 'partner')
  })

  it('everything else is a tenant host — a region-labelled host, a BYOA domain, a bare name', () => {
    for (const h of ['ten-acme.us-west-2.reconcileai.app', 'recon.acme.example', 'reconcile.acme.example', 'localhost', '127.0.0.1']) {
      assert.equal(surfaceOf(h), 'tenant', h)
    }
    /* A label that merely BEGINS with, or CONTAINS, the word is not the label. */
    assert.equal(surfaceOf('consoles.reconcileai.app'), 'tenant')
    assert.equal(surfaceOf('mypartners.reconcileai.app'), 'tenant')
    assert.equal(surfaceOf('partners-acme.us-west-2.reconcileai.app'), 'tenant')
  })

  it('a registry entry wins over the label rule, in both directions', () => {
    assert.equal(surfaceOf('staff.example.com', { 'staff.example.com': 'console' }), 'console')
    assert.equal(surfaceOf('console.acme.example', { 'console.acme.example': 'tenant' }), 'tenant')
  })

  it('both labels are reserved, so no tenant slug can ever be read as a console', () => {
    assert.ok((RESERVED_HOST_LABELS as readonly string[]).includes('partners'))
    assert.ok((RESERVED_HOST_LABELS as readonly string[]).includes('console'))
  })

  it('the labels are IMPORTED from the edge config, never retyped', () => {
    const src = readFileSync(join(REPO, 'frontend', 'src', 'routes', 'surface.ts'), 'utf8')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    assert.match(code, /from '\.\.\/\.\.\/\.\.\/infra\/lib\/config\.ts'/)
    /* `'console'` is also a SURFACE name, so the check is on the label: the
       `partners` label, and either label written as a map key. */
    assert.doesNotMatch(code, /'partners'/, 'the partners label is typed into the module')
    assert.doesNotMatch(code, /^\s*(console|partners)\s*:/m, 'a console label is typed as a map key')
  })

  it('there is ONE surface module — the second one #542 landed is gone (G3371)', () => {
    assert.equal(existsSync(join(REPO, 'frontend', 'src', 'routes', 'host-surface.ts')), false)
  })
})

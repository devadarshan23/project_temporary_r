/**
 * THE SIGNED-OUT SHELL, THE TITLES, AND THE PARTNER HOST — G3041–G3045,
 * 2 Oct 2026.
 *
 * A signed-out browser pass against staging found every page a visitor could
 * load — `/signin`, the callback, `/demo`, `/lookup`, a mistyped address —
 * drawing the signed-in chrome bar, firing `GET /v1/runs` and
 * `GET /v1/exceptions` for a 401 each, and titled *"ReconcileAI — kernel
 * primitives"*. The browser half is witnessed in
 * `tests/e2e/browser-login.test.ts` §26; this file holds the parts that need no
 * browser: which routes are signed out (derived from the table, never listed),
 * that every route has a real title, and the partner-host derivation's two
 * refusals.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ROUTE_PATHS, resolve } from '../../frontend/src/routes/table.ts'
import {
  NOT_FOUND_TITLE,
  ROUTE_TITLES,
  isSignedOutSurface,
  partnerSignIn,
  titleOf,
} from '../../frontend/src/routes/surfaces.ts'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('§1 · which surfaces are signed out is the route table`s answer', () => {
  it('the four public paths the staging pass loaded, and an unknown one, are signed out', () => {
    for (const path of ['/signin', '/signin/callback', '/demo', '/lookup', '/no-such-place']) {
      assert.equal(isSignedOutSurface(resolve(path)), true,
        `${path} is drawn as a signed-in surface — it would carry the chrome bar and a ` +
        'visitor with no session would be shown the controls of a product they have not entered')
    }
  })

  it('every Tier 1 work surface keeps the chrome', () => {
    for (const path of ['/close', '/close/run/r1', '/close/finding/f1', '/setup', '/ask', '/reports']) {
      assert.equal(isSignedOutSurface(resolve(path)), false, `${path} lost its chrome bar`)
    }
  })

  it('POSITIVE CONTROL — both answers occur, so the predicate is not a constant', () => {
    const answers = new Set(ROUTE_PATHS.map((p) => isSignedOutSurface(resolve(p.replace(/:[a-zA-Z]+/g, 'x')))))
    assert.deepEqual([...answers].sort(), [false, true])
  })

  it('🛑 THE SURFACE LIST IS NOT WRITTEN DOWN A SECOND TIME — no path literal in the predicate', () => {
    /* A list of signed-out paths beside `ROUTE_PATHS` is a second authority for
       one fact (§5.3). WITNESSED RED by replacing the body with
       `['/signin', '/demo'].includes(...)`. */
    const source = readFileSync(join(REPO, 'frontend', 'src', 'routes', 'surfaces.ts'), 'utf8')
    const body = /export function isSignedOutSurface[\s\S]*?\n}/.exec(source)?.[0] ?? ''
    assert.notEqual(body, '', 'isSignedOutSurface was not found')
    assert.doesNotMatch(body, /'\//, 'the predicate names a path; derive it from ROUTES instead')
  })
})

describe('§2 · every page has a real title', () => {
  it('the title map is total and no title is the specimen`s', () => {
    assert.deepEqual(Object.keys(ROUTE_TITLES).sort(), [...ROUTE_PATHS].sort())
    for (const path of ROUTE_PATHS) {
      assert.doesNotMatch(ROUTE_TITLES[path], /kernel primitives/i)
      assert.notEqual(ROUTE_TITLES[path].trim(), '')
    }
  })

  it('a title names the page and then the product', () => {
    assert.equal(titleOf(resolve('/signin')), 'Sign in · ReconcileAI')
    assert.equal(titleOf(resolve('/')), 'ReconcileAI')
    assert.equal(titleOf(resolve('/audit')), `${NOT_FOUND_TITLE} · ReconcileAI`)
    assert.equal(titleOf(resolve('/close'), 'Signed out'), 'Signed out · ReconcileAI')
  })

  it('the static entry no longer carries the specimen`s title', () => {
    const html = readFileSync(join(REPO, 'frontend', 'index.html'), 'utf8')
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]
    assert.equal(title, 'ReconcileAI')
  })
})

describe('§3 · the partner portal`s sign-in is linked only where its address is certain', () => {
  it('on the partner host, the partner signs in here', () => {
    assert.deepEqual(partnerSignIn('partners.reconcileai.app'), { kind: 'here' })
  })

  it('on the staff console, the flat sibling is the partner host (G297)', () => {
    assert.deepEqual(partnerSignIn('console.reconcileai.app'), {
      kind: 'elsewhere',
      href: 'https://partners.reconcileai.app/signin',
    })
  })

  it('🛑 ON A TENANT HOST IT REFUSES TO GUESS — a region label and BYOA make it a parse G179 refuses', () => {
    for (const host of ['ten-acme.us-west-2.reconcileai.app', 'reconcile.acme-corp.com', 'localhost', 'console.']) {
      assert.deepEqual(partnerSignIn(host), { kind: 'unknown' }, `${host} produced a partner link`)
    }
  })
})

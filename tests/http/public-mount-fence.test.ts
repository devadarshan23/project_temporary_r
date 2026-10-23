/**
 * D6-8 — A SEPARATE BOOT FENCE FOR `caller === 'none'`.
 * G2241–G2245, 1 Oct 2026, applying THE OWNER'S RULING of 29–30 Sep 2026.
 *
 * The ruling, from `docs/HANDOFF.md` §3: *"A separate boot fence for
 * `caller === 'none'`."* D6 measured the gap: `callerOf([])` is `'none'`, so
 * G914's fourth fence *"fires on the two operations that REQUIRE a session and
 * is SILENT on the two anyone can reach — the opposite of what it is for."*
 * Fixing the fourth in place was refused, because five files cite the fences
 * BY NUMBER; the new one is the SEVENTH, appended.
 *
 *   §1  THE CENSUS — every caller-less operation in the corpus, derived, and
 *       which side of `PUBLIC_OPERATION_AUDIENCE` each lands on.
 *   §2  RED — a bare public person-facing mount does not boot. Twice: on the
 *       mounted `resolveHomeRealm` and on the UNMOUNTED
 *       `completeFederatedSignIn`, which is the mount D6-1 rules is owed.
 *   §2b ANTI-VACUITY — the same mounts boot with `servedPublicly()`.
 *   §2c `checkLocalHealth` is unaffected: bare it boots, marked it does NOT
 *       (the mark contradicts the census).
 *   §2d A public mark on a SECURED operation does not boot.
 *   §3  THE POPULATION — `servedPublicly()` is called once in `server/`, on
 *       `resolveHomeRealm`, read off the AST rather than a grep.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

import { basePathOf, loadTier, TIERS, type TierName } from '../../server/contract/document.ts'
import { routesOf } from '../../server/contract/routes.ts'
import {
  PUBLIC_OPERATION_AUDIENCE,
  callerMayBeAPerson,
  publicOperationFacesAPerson,
} from '../../server/contract/capability.ts'
import {
  buildPlane,
  servedPublicly,
  type MountedHandler,
} from '../../server/http/app.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')

async function boot(tier: TierName, handlers: Readonly<Record<string, MountedHandler>>): Promise<Error | null> {
  try {
    const app = await buildPlane<{ who: string }>(
      {
        plane: 'test-public-fence',
        authenticate: () => null,
        unauthenticatedDetail: 'no session',
        authorise: () => 'not_held',
        unauthorisedDetail: 'no capability',
      },
      [{ tier, handlers }],
    )
    await app.close()
    return null
  } catch (err) {
    return err as Error
  }
}

/* ══════════════════════════════════════════════════════════════════ *
 * §1  THE CENSUS
 * ══════════════════════════════════════════════════════════════════ */

test('§1 · every caller-less operation, derived — and the fourth fence sees none of them', () => {
  const found: string[] = []
  for (const tier of Object.keys(TIERS) as TierName[]) {
    const doc = loadTier(tier)
    for (const spec of routesOf(doc, basePathOf(doc))) {
      if (spec.caller !== 'none') continue
      assert.equal(
        callerMayBeAPerson(spec.caller),
        false,
        'the fourth fence now sees a caller-less operation — D6-8 refused widening it; read the ruling',
      )
      found.push(`${tier}:${spec.operationId}:${PUBLIC_OPERATION_AUDIENCE[tier]}`)
    }
  }
  assert.deepEqual(
    found.sort(),
    [
      'dataPlaneLocal:checkLocalHealth:infrastructure',
      'dataPlaneLocal:checkLocalStatus:infrastructure',
      'dataPlaneLocal:getLocalMetrics:infrastructure',
      'session:beginFederatedSignIn:person',
      'session:completeFederatedSignIn:person',
      /* G2549 (2 Oct 2026) — the shared return host's relay. Argued at its mount. */
      'session:relayBrokerReturn:person',
      'session:resolveHomeRealm:person',
    ],
    'the set of operations that ask for NO credential has changed. Each new one needs its tier ' +
      'argued in `PUBLIC_OPERATION_AUDIENCE`, and a person-facing one needs `servedPublicly()` ' +
      'at its mount before it can boot.',
  )
})

test('§1b · the census fails CLOSED: exactly one tier of the eight faces infrastructure', () => {
  const infrastructure = (Object.keys(PUBLIC_OPERATION_AUDIENCE) as TierName[]).filter(
    (t) => PUBLIC_OPERATION_AUDIENCE[t] === 'infrastructure',
  )
  assert.deepEqual(infrastructure, ['dataPlaneLocal'])
  assert.equal(publicOperationFacesAPerson('session', 'none'), true)
  assert.equal(publicOperationFacesAPerson('dataPlaneLocal', 'none'), false)
  assert.equal(publicOperationFacesAPerson('session', 'person'), false, 'the fence is for caller-less operations only')
})

/* ══════════════════════════════════════════════════════════════════ *
 * §2  THE FENCE
 * ══════════════════════════════════════════════════════════════════ */

for (const operationId of ['resolveHomeRealm', 'completeFederatedSignIn', 'beginFederatedSignIn']) {
  test(`§2 · RED — a BARE \`${operationId}\` mount does not boot`, async () => {
    const err = await boot('session', { [operationId]: async () => ({}) })
    assert.ok(err, `a bare public person-facing mount of ${operationId} BOOTED — D6-8's fence is not there`)
    assert.match(err.message, /asks for NO CREDENTIAL OF ANY KIND/)
    assert.match(err.message, new RegExp(operationId))
  })

  test(`§2b · and \`servedPublicly()\` admits \`${operationId}\` — the fence is not refusing everything`, async () => {
    const err = await boot('session', { [operationId]: servedPublicly(async () => ({})) })
    assert.equal(err, null, `the acknowledged mount still failed: ${err?.message}`)
  })
}

test('§2c · `checkLocalHealth` is unaffected bare — and a public mark on it CONTRADICTS the census', async () => {
  assert.equal(await boot('dataPlaneLocal', { checkLocalHealth: async () => ({ status: 'ok' }) }), null)
  const err = await boot('dataPlaneLocal', {
    checkLocalHealth: servedPublicly(async () => ({ status: 'ok' })),
  })
  assert.ok(err, 'a public mark on an INFRASTRUCTURE operation booted — the mark can now assert anything')
  assert.match(err.message, /marked `servedPublicly\(\)`/)
})

test('§2d · a public mark on a SECURED operation does not boot', async () => {
  /* A machine-facing exemption, so no EARLIER fence fires and the refusal is
   * the seventh fence's second half by itself. (`getSession` would be refused
   * too — by the FOURTH fence, first, because it is an unacknowledged
   * person-facing exemption — which is asserted below without the message.) */
  const err = await boot('controlPlane', { getAttestationChainHead: servedPublicly(async () => ({})) })
  assert.ok(err, 'a public mark on `getAttestationChainHead` (sigV4) booted')
  assert.match(err.message, /marked `servedPublicly\(\)`/)
  assert.match(err.message, /getAttestationChainHead \(caller: machine\)/)
  assert.ok(await boot('session', { getSession: servedPublicly(async () => ({})) }))
})

/* ══════════════════════════════════════════════════════════════════ *
 * §3  THE POPULATION — read off the AST
 * ══════════════════════════════════════════════════════════════════ */

function tsFilesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...tsFilesUnder(full))
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) out.push(full)
  }
  return out
}

/**
 * ⚠️ THIS TITLE READ *"is CALLED once in `server/`, on `resolveHomeRealm`"*
 * UNTIL 1 Oct 2026 AND THE SET MOVED EXACTLY AS ITS OWN MESSAGE SAID IT
 * WOULD: *"D6-1 rules `completeFederatedSignIn` is owed … move this set in the
 * commit that adds the call, and argue it at the call site."* S6 is that
 * commit (G2490); the argument is at the mount in `server/data-plane/start.ts`.
 */
test('§3 · `servedPublicly()` is CALLED twice in `server/`, on the two session operations D6-1 made public', () => {
  /**
   * ⚠️ THE AST AND NOT A GREP, ON G978's AND G1953's RECORD: a grep for the
   * name in a tree whose headers explain the name measures the explanation.
   * A comment is not a node, so nothing quoted here can count.
   */
  const sites: string[] = []
  for (const file of tsFilesUnder(path.join(REPO_ROOT, 'server'))) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'servedPublicly') {
        const parent = n.parent
        const key = ts.isPropertyAssignment(parent) ? parent.name.getText(sf) : '?'
        sites.push(`${path.relative(REPO_ROOT, file)}: ${key}`)
      }
      n.forEachChild(visit)
    }
    visit(sf)
  }
  assert.deepEqual(
    sites,
    [
      'server/data-plane/start.ts: resolveHomeRealm',
      'server/data-plane/start.ts: completeFederatedSignIn',
      /* G2541 — the owner's begin-sign-in ruling, argued at its call site. */
      'server/data-plane/start.ts: beginFederatedSignIn',
      /* G2549 — the owner's shared-callback ruling, argued at its call site. */
      'server/data-plane/start.ts: relayBrokerReturn',
    ],
    'the population of PUBLIC, UNAUTHENTICATED, PERSON-FACING mounts has changed. That is not ' +
      'forbidden — D6-1 rules `completeFederatedSignIn` is owed — and it is not a formality: ' +
      'move this set in the commit that adds the call, and argue it at the call site.',
  )
})

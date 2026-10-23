/**
 * G2766 — WHAT A DEPLOYED DATA PLANE NEEDS TO COMPLETE A SIGN-IN, IN THE
 * SYNTHESISED `Planes` TEMPLATE; and G2549's shared return host.
 *
 *   §1  the data-plane container — and ONLY it — carries the five sign-in
 *       variables, with the values `SIGN_IN_DEPLOYMENT.staging` derives.
 *   §2  the shared return host collides with no registered host (the boot
 *       check the plane runs, run here against the deployed registry).
 *   §3  no retired or forbidden variable rides along: no issuer (D6-5), no
 *       local test auth (G192).
 *   §4  an environment with no deployed pool gets none of it.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ensureDeps, synthesisedTemplates, resourcesOfType } from './support.mjs'

await ensureDeps()

const PLANES = 'reconcile-planes-staging'
const SIGN_IN_VARS = [
  'RECONCILE_SIGNIN_RETURN_HOST',
  'RECONCILE_SERVING_HOSTS',
  'RECONCILE_CONSOLE_HOSTS',
  'RECONCILE_SESSION_MAX_LIFETIME_SECONDS',
  'RECONCILE_SESSION_MAX_IDLE_SECONDS',
]

let cache
const containers = () => {
  cache ??= synthesisedTemplates()
  const t = cache[PLANES]
  assert.ok(t, `${PLANES} is not in the synthesised app`)
  const out = {}
  for (const [, r] of resourcesOfType(t, 'AWS::ECS::TaskDefinition')) {
    for (const c of r.Properties.ContainerDefinitions) {
      out[c.Name] = Object.fromEntries((c.Environment ?? []).map((e) => [e.Name, e.Value]))
    }
  }
  return out
}

test('§1 · the data-plane container, and only it, carries the sign-in variables', async () => {
  const c = await import('../../infra/lib/config.ts')
  const env = containers()
  const d = c.SIGN_IN_DEPLOYMENT.staging
  assert.ok(d)
  assert.deepEqual(
    Object.fromEntries(SIGN_IN_VARS.map((k) => [k, env['data-plane']?.[k]])),
    {
      RECONCILE_SIGNIN_RETURN_HOST: 'auth.us-west-2.reconcileai.app',
      /* G2999 — `ten-mock`, the STAGING MOCK tenant, joins `ten-acme` (G2771). */
      RECONCILE_SERVING_HOSTS:
        'ten-acme.us-west-2.reconcileai.app|ten_acme|us-west-2|pooled|active,' +
        'ten-mock.us-west-2.reconcileai.app|ten_mock|us-west-2|pooled|active',
      RECONCILE_CONSOLE_HOSTS: 'console.reconcileai.app|staff|active,partners.reconcileai.app|partner|active',
      RECONCILE_SESSION_MAX_LIFETIME_SECONDS: '28800',
      RECONCILE_SESSION_MAX_IDLE_SECONDS: '1800',
    },
  )
  for (const [name, vars] of Object.entries(env)) {
    if (name === 'data-plane') continue
    for (const k of SIGN_IN_VARS) {
      assert.equal(vars[k], undefined, `${name} carries ${k} — only the serving data plane signs people in`)
    }
  }
})

test('§2 · the shared return host collides with no host the deployed plane serves', async () => {
  const env = containers()['data-plane']
  const { parseServingHosts, parseConsoleHosts } = await import('../../server/data-plane/serving-hosts.ts')
  const { checkSignInReturnHost } = await import('../../model/serving-host.ts')
  const verdict = checkSignInReturnHost(
    parseServingHosts(env.RECONCILE_SERVING_HOSTS),
    parseConsoleHosts(env.RECONCILE_CONSOLE_HOSTS),
    env.RECONCILE_SIGNIN_RETURN_HOST,
  )
  assert.deepEqual(verdict, { ok: true }, 'the deployed plane would refuse to boot')
})

test('§3 · no retired or forbidden variable rides along', () => {
  const env = containers()['data-plane']
  assert.equal(env.RECONCILE_IDENTITY_ISSUER, undefined, 'D6-5: the issuer is the pinned row’s, never configuration')
  assert.equal(env.RECONCILE_IDENTITY_AUDIENCE, undefined, 'G2572: the audience is the pinned row’s')
  assert.equal(env.RECONCILE_IDENTITY_JWKS_URL, undefined, 'G2572: the key document is the pinned row’s')
  assert.equal(env.RECONCILE_LOCAL_TEST_AUTH, undefined, 'G192: never on a deployed plane')
})

test('§4 · an environment with no deployed pool gets none of it', async () => {
  const { signInEnvironment } = await import('../../infra/lib/planes-stack.ts')
  assert.deepEqual(signInEnvironment('prod'), {})
  assert.deepEqual(signInEnvironment('shared'), {})
})

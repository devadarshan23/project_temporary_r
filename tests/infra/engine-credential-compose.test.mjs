/**
 * G3861 — THE ENGINE CREDENTIAL IN THE LOCAL STACK, discharging G3749.
 *
 * `reconcile_engine` is `reconcile_app` PLUS `INSERT` on the two exception
 * tables (`db/migrations/0500` §1) — the privilege `0015` refused every request
 * path. `compose.yaml` must therefore hand `RECONCILE_ENGINE_PASSWORD` to the
 * DATA MIGRATE job (which SETS the role's password in `createRoles()`) and to
 * NOTHING that serves a request. The deployed half of the same property is in
 * `tests/infra/planes.test.mjs` and `tests/infra/run-queue.test.mjs`.
 *
 * ⚠️ THERE IS NO LOCAL RUN-WORKER SERVICE, so in this file the migrate job is
 * the only holder. A worker service added later must be added to `ALLOWED`
 * below deliberately — which is the point of a set-equality assertion.
 *
 * A real YAML parse (`yaml`, pinned under G191), not a line scanner — and the
 * analysis is witnessed RED against a mutated copy, so a parse that found no
 * services cannot pass silently (`docs/HANDOFF.md` §5.6).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'

const COMPOSE = fileURLToPath(new URL('../../compose.yaml', import.meta.url))
const VAR = 'RECONCILE_ENGINE_PASSWORD'
const ALLOWED = ['data-plane-migrate']

function holders(doc) {
  const services = Object.entries(doc?.services ?? {})
  assert.ok(services.length >= 4, `compose parsed to ${services.length} services — the parse found nothing`)
  return services
    .filter(([, svc]) => {
      const env = svc?.environment
      if (Array.isArray(env)) return env.some((e) => String(e).split('=')[0] === VAR)
      return env !== null && typeof env === 'object' && VAR in env
    })
    .map(([name]) => name)
    .sort()
}

const text = readFileSync(COMPOSE, 'utf8')

test('test_only_the_data_migrate_job_holds_the_engine_credential_locally', () => {
  assert.deepEqual(
    holders(parse(text)),
    ALLOWED,
    `${VAR} reaches a compose service other than data-plane-migrate. The data-plane LISTENER ` +
      'must never hold it — reconcile_engine may INSERT into tenant.exception (0500 §1) — and ' +
      'without it on the migrate job createRoles() leaves the role with no password.',
  )
})

test('test_the_same_analysis_SEES_the_engine_credential_handed_to_the_listener', () => {
  const leaked = parse(text)
  leaked.services['data-plane'].environment[VAR] = 'leaked'
  assert.ok(
    holders(leaked).includes('data-plane'),
    'the red witness put the engine credential on the data-plane listener and the analysis missed it',
  )
  const stripped = parse(text)
  delete stripped.services['data-plane-migrate'].environment[VAR]
  assert.deepEqual(holders(stripped), [], 'the red witness removed it from the migrate job and the analysis still saw it')
})

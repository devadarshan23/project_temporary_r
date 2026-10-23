/**
 * R-POOL — THE OWNER'S RULING: *"Raise `RECONCILE_DB_POOL_MAX` and the serving
 * task count."* G2261–G2268, 1 Oct 2026. D6-4's companion to the WAF rate rule.
 *
 * 🛑 EVERY EXPECTED VALUE IN THIS FILE IS TYPED HERE, NOT READ FROM
 * `infra/lib/config.ts`. Comparing a template to the constant the template was
 * built from proves only that a variable equals itself; the point of the typed
 * figures is that a term of the budget which moves goes RED at an assertion
 * that NAMES the term, so the person moving it has to re-argue the arithmetic.
 *
 * ⚠️ WHAT THIS DOES NOT PROVE, said so nobody reads a green run as more:
 * the engine ceiling (450) is a DOCUMENTED FORMULA and has never been measured
 * against the running cluster, and nothing here has ever been deployed. It
 * proves the BUDGET is self-consistent and that the synthesised `Planes`
 * template carries it — and that nothing else.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ensureDeps, synthesisedTemplates, resourcesOfType, REPO_ROOT } from './support.mjs'

await ensureDeps()

const PLANES = 'reconcile-planes-staging'

let cache
const planes = () => {
  cache ??= synthesisedTemplates()
  const t = cache[PLANES]
  assert.ok(t, `${PLANES} is not in the synthesised app at all`)
  return t
}

const config = () => import('../../infra/lib/config.ts')

test('test_every_term_of_the_connection_budget_is_the_value_the_arithmetic_was_written_for', async () => {
  const c = await config()
  /* 2 ACU = 4 GiB; 4294967296 / 9531392 = 450.6. */
  assert.equal(c.AURORA_MAX_CONNECTIONS_FORMULA_ESTIMATE_STAGING, 450)
  assert.equal(c.DATA_CLUSTER_CONNECTION_DESIGN_CEILING, 225, 'half the unmeasured estimate')
  assert.equal(c.AURORA_RESERVED_CONNECTIONS, 5)
  assert.equal(c.DATA_MIGRATE_TASK_CONNECTIONS, 2)
  assert.equal(c.RUN_WORKER_POOL_MAX * c.RUN_WORKER_CONCURRENT_EXECUTIONS_BUDGETED, 20)
  assert.equal(c.OPERATOR_CONNECTION_HEADROOM, 10)
  assert.equal(c.ROLLING_DEPLOY_OVERLAP, 2)
  /* (225 - 5 - 2 - 20 - 10) / 2 = 94 */
  assert.equal(c.DATA_SERVING_FLEET_CONNECTION_BUDGET, 94)
  assert.deepEqual(c.SERVING_TASKS_WHEN_UP.staging, { data: 2, control: 1 })
  /* floor(94 / 2) = 47 */
  assert.equal(c.DATA_PLANE_POOL_MAX, 47)
})

test('test_the_worst_legitimate_load_fits_under_the_design_ceiling_on_both_clusters', async () => {
  const c = await config()
  /* 2 x 2 x 47 + 20 + 2 = 210 */
  assert.equal(c.dataClusterLegitimateConnections('staging'), 210)
  assert.ok(
    c.dataClusterLegitimateConnections('staging') + c.AURORA_RESERVED_CONNECTIONS +
      c.OPERATOR_CONNECTION_HEADROOM <=
      c.DATA_CLUSTER_CONNECTION_DESIGN_CEILING,
    'a rolling deploy at full pools, the run worker, the migrator, the reserved slots and the ' +
      'operator headroom no longer fit under the design ceiling — the budget is overspent',
  )
  /* The control cluster grew because every DATA task holds a control-read pool
   * (G1161): 2 x (1 x 10 + 2 x 4) + 2 = 38, against 28 before R-POOL. */
  assert.equal(c.controlClusterLegitimateConnections('staging'), 38)
  assert.ok(c.controlClusterLegitimateConnections('staging') < c.DATA_CLUSTER_CONNECTION_DESIGN_CEILING)
})

test('test_the_leak_thresholds_sit_above_legitimate_load_and_below_the_engine_estimate', async () => {
  const c = await config()
  for (const plane of ['data', 'control']) {
    const threshold = c.auroraConnectionAlarmThreshold('staging', plane)
    const legitimate =
      plane === 'data'
        ? c.dataClusterLegitimateConnections('staging')
        : c.controlClusterLegitimateConnections('staging')
    assert.ok(threshold > legitimate, `${plane}: a legitimate deploy would page (${threshold} <= ${legitimate})`)
    assert.ok(
      threshold <= c.AURORA_MAX_CONNECTIONS_FORMULA_ESTIMATE_STAGING / 2,
      `${plane}: the threshold is no longer a LEAK detector — it is above half the engine estimate`,
    )
  }
})

test('test_the_data_plane_task_definition_carries_the_derived_pool_and_no_other_task_does', () => {
  const pools = {}
  for (const [, r] of resourcesOfType(planes(), 'AWS::ECS::TaskDefinition')) {
    for (const container of r.Properties.ContainerDefinitions) {
      const found = (container.Environment ?? []).find((e) => e.Name === 'RECONCILE_DB_POOL_MAX')
      if (found) pools[container.Name] = found.Value
    }
  }
  /* The ruling names the SERVING task. The migrate tasks drive one Client and
   * the control plane reads RECONCILE_CONTROL_DB_POOL_MAX, not this. */
  assert.deepEqual(pools, { 'data-plane': '47' })
})

test('test_the_data_service_wakes_to_its_own_count_and_still_sleeps_to_zero', () => {
  const t = planes()
  const services = Object.fromEntries(
    resourcesOfType(t, 'AWS::ECS::Service').map(([id, r]) => [id, r.Properties]),
  )
  const expected = { 'reconcile-staging-data-plane': 2, 'reconcile-staging-control-plane': 1 }

  const seen = {}
  for (const [, target] of resourcesOfType(t, 'AWS::ApplicationAutoScaling::ScalableTarget')) {
    const p = target.Properties
    const serviceLogicalId = p.ResourceId['Fn::Join'][1].find((x) => x['Fn::GetAtt'])['Fn::GetAtt'][0]
    const name = services[serviceLogicalId].ServiceName
    const up = expected[name]
    assert.ok(up !== undefined, `an unexpected scalable target for ${name}`)
    seen[name] = true

    assert.equal(services[serviceLogicalId].DesiredCount, up, `${name}'s deployed DesiredCount`)
    assert.equal(p.MinCapacity, 0, `${name}: the scalable target must admit zero, or the evening action fails`)
    assert.equal(p.MaxCapacity, up, `${name}: the ceiling must be the plane's own count — the budget was sized for it`)

    const actions = Object.fromEntries(p.ScheduledActions.map((a) => [a.Schedule, a.ScalableTargetAction]))
    assert.deepEqual(actions['cron(0 13 ? * MON-FRI *)'], { MinCapacity: 0, MaxCapacity: 0 }, `${name} evening`)
    assert.deepEqual(actions['cron(0 1 ? * MON-FRI *)'], { MinCapacity: up, MaxCapacity: up }, `${name} morning`)
  }
  assert.deepEqual(Object.keys(seen).sort(), Object.keys(expected).sort())
})

test('test_the_server_reads_the_variable_the_task_definition_sets', () => {
  /* Nothing under `server/` changes in R-POOL because this path already
   * existed. If it stops existing, the env var above is set and ignored and the
   * default of 10 runs — the exposure D6 measured, behind a green template. */
  const cfg = readFileSync(join(REPO_ROOT, 'server/data-plane/config.ts'), 'utf8')
  assert.match(cfg, /poolMax:\s*intFromEnv\('RECONCILE_DB_POOL_MAX',/)
  const main = readFileSync(join(REPO_ROOT, 'server/data-plane/main.ts'), 'utf8')
  assert.match(main, /poolMax:\s*config\.database\.poolMax/)
  const start = readFileSync(join(REPO_ROOT, 'server/data-plane/start.ts'), 'utf8')
  assert.match(start, /createAppPool\(opts\.poolMax\)/)
})

/**
 * THE WORKER'S BUDGET IS BELOW THE VISIBILITY TIMEOUT — G4366 and G4367,
 * 5 Oct 2026, the owner's amendment of G211: *"Duration is bounded below the
 * visibility timeout."*
 *
 * The two halves live in two packages: `RUN_QUEUE_VISIBILITY_SECONDS` and
 * `RUN_QUEUE_MAX_RECEIVE_COUNT` in `infra/lib/config.ts`; the execution
 * deadline, the `failed` write's budget, the watchdog's grace and the mirrored
 * receive count in `server/data-plane/`. Neither package may import the other,
 * so this file is the join, and a change to either side that breaks the
 * inequality is a red gate rather than a run that is delivered twice.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ensureDeps, synthesisedTemplates, resourcesOfType } from './support.mjs'

await ensureDeps()

const config = await import('../../infra/lib/config.ts')
const executor = await import('../../server/data-plane/run-executor.ts')
const queue = await import('../../server/data-plane/run-queue.ts')

/** The long-poll is not on the visibility clock, but clock skew is. Named. */
const SKEW_ALLOWANCE_SECONDS = 30

test('test_the_mirrored_receive_count_equals_the_redrive_policy', () => {
  assert.equal(
    queue.RUN_QUEUE_MAX_RECEIVE_COUNT,
    config.RUN_QUEUE_MAX_RECEIVE_COUNT,
    'the worker decides a delivery is the LAST against a number that is not the redrive ' +
      'policy`s. Too high and a run whose every delivery threw dead-letters instead of ' +
      'reading `failed`; too low and the worker settles a run the queue would still retry.',
  )
})

test('test_deadline_plus_failed_write_plus_watchdog_grace_is_below_the_visibility_timeout', () => {
  const budget =
    executor.RUN_MAX_EXECUTION_SECONDS +
    executor.RUN_FAILED_WRITE_SECONDS +
    executor.RUN_HARD_KILL_GRACE_SECONDS +
    SKEW_ALLOWANCE_SECONDS
  assert.ok(
    budget < config.RUN_QUEUE_VISIBILITY_SECONDS,
    `the worker may hold a message for ${budget}s and SQS hides it for ` +
      `${config.RUN_QUEUE_VISIBILITY_SECONDS}s, so a run can be delivered AGAIN while it is ` +
      'still executing — G1525`s duplicated work, which the deadline exists to end.',
  )
})

test('test_the_deadline_is_a_positive_whole_number_of_seconds', () => {
  assert.ok(Number.isInteger(executor.RUN_MAX_EXECUTION_SECONDS))
  assert.ok(executor.RUN_MAX_EXECUTION_SECONDS > 0)
})

test('test_the_worker_container_carries_a_bounded_stop_timeout', () => {
  const template = synthesisedTemplates()['reconcile-run-queue-staging']
  assert.ok(template, 'reconcile-run-queue-staging is not in the synthesised app')
  const taskDefs = resourcesOfType(template, 'AWS::ECS::TaskDefinition')
  assert.equal(taskDefs.length, 1)
  const container = (taskDefs[0][1].Properties?.ContainerDefinitions ?? [])[0]
  assert.equal(
    container?.StopTimeout,
    30,
    'the worker container has no StopTimeout (or a different one): an ECS-initiated stop ' +
      'is then the platform default rather than the figure G4367 states.',
  )
  assert.ok(container.StopTimeout <= 120, 'Fargate refuses a StopTimeout above 120 seconds')
})

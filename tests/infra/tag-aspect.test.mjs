/**
 * G260's Aspect, WITNESSED RED. Every assertion below is paired.
 *
 * 🛑 WHAT THIS FILE IS DEFENDING. `docs/tech-stack.md` §11 says a CDK Aspect
 * *"walks every construct at synth and throws on a missing tag"*, and G260 says
 * the six tags are enforced twice. The AWS Config half of that pair is not
 * built — it belongs to the `Observability` stack, which this pass does not
 * write — so today this Aspect is the ONLY enforcement, and an Aspect that
 * never actually throws would leave the record claiming a control that does not
 * exist. `docs/HANDOFF.md` §5.6: a checker added without a demonstrated red is
 * a checker that asserts nothing.
 * ⛔ AND THE CONFIG HALF IS DECLINED — R15, 1 Oct 2026 (`docs/HANDOFF.md`
 * G2441): no recorder and no Config rule, by decision. "The ONLY enforcement"
 * above is now permanent rather than interim.
 *
 * So each red fixture is paired with a positive control that differs from it in
 * exactly ONE thing. An Aspect that threw unconditionally fails the pair from
 * one side; one that never threw fails it from the other.
 *
 * ⚠️ THE STRINGS BELOW ARE TYPED INTO THIS FILE. None is imported from
 * `infra/lib/config.ts`. Comparing a control's output to the same constant the
 * control read is a comparison that passes when both sides are empty — the same
 * warning `tests/ci/gate.test.ts` and `tests/tools/check-wire-mirror.test.mjs`
 * carry at their heads.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ensureDeps, runInfraScript } from './support.mjs'

await ensureDeps()

/** G260's six. Literals, on purpose. */
const REQUIRED_TAGS = ['Project', 'Environment', 'Plane', 'ManagedBy', 'Owner', 'CostCentre']

// ------------------------------------------------- 1. the pair, both ways

test('test_a_stack_carrying_all_six_tags_synthesises_and_that_is_the_positive_control', () => {
  const run = runInfraScript('test-fixtures/tagged-stack.ts')
  assert.equal(
    run.status,
    0,
    `a fully tagged stack must synthesise; stderr=${run.stderr}`,
  )
  assert.match(run.stdout, /SYNTH OK/)
})

test('test_removing_one_required_tag_makes_synth_fail_and_the_error_names_the_tag_and_the_resource', () => {
  const run = runInfraScript('test-fixtures/untagged-stack.ts')
  assert.notEqual(
    run.status,
    0,
    'G260 says the Aspect THROWS at synth on a missing tag; this synth succeeded',
  )
  assert.equal(
    run.stdout.includes('SYNTH OK'),
    false,
    'the fixture printed its success line, so synth did not throw',
  )
  const message = `${run.stdout}${run.stderr}`
  assert.match(message, /G260/)
  assert.match(message, /missing Owner/)
  assert.match(
    message,
    /AWS::ECR::Repository/,
    'the error must name the resource; "a tag is missing somewhere" is not actionable',
  )
})

// ---------------------------------------- 2. the absence clause, executable

test('test_a_tenant_id_tag_makes_synth_fail_even_when_all_six_required_tags_are_present', () => {
  const run = runInfraScript('test-fixtures/tenant-tagged-stack.ts')
  assert.notEqual(
    run.status,
    0,
    'G260: a per-tenant tag is a tenant enumeration in the clear, and no resource may carry one',
  )
  const message = `${run.stdout}${run.stderr}`
  assert.match(message, /FORBIDDEN TenantId/)
})

// --------------------------------- 3. the real app carries all six, derived

test('test_every_taggable_resource_in_the_real_app_carries_all_six_tags', async () => {
  const { synthesisedTemplates } = await import('./support.mjs')
  const templates = synthesisedTemplates()
  const stackNames = Object.keys(templates)
  assert.ok(stackNames.length > 0, 'the app synthesised no stacks at all')

  for (const [stackName, template] of Object.entries(templates)) {
    for (const [logicalId, resource] of Object.entries(template.Resources ?? {})) {
      const tags = resource.Properties?.Tags
      /* A resource whose CloudFormation type has no `Tags` property cannot
       * carry one — AWS::IAM::Policy and AWS::S3::BucketPolicy are the two in
       * this app. `infra/lib/tagging.ts` draws that boundary with
       * `TagManager.isTaggable()` rather than with a hand-maintained exemption
       * list, and this loop follows the same rule: absent Tags is skipped,
       * present-but-incomplete is a failure. */
      if (tags === undefined) continue
      const keys = Array.isArray(tags) ? tags.map((t) => t.Key) : Object.keys(tags)
      for (const required of REQUIRED_TAGS) {
        assert.ok(
          keys.includes(required),
          `${stackName}/${logicalId} (${resource.Type}) is missing the ${required} tag`,
        )
      }
      assert.equal(
        keys.some((k) => /tenant/i.test(k)),
        false,
        `${stackName}/${logicalId} carries a tenant-shaped tag: ${keys.join(', ')}`,
      )
    }
  }
})

test('test_the_owner_and_cost_centre_tags_are_filled_and_are_not_placeholders', async () => {
  /* ✅ THE PLACEHOLDERS WERE FILLED ON 18 Sep 2026, AND THIS EDIT IS THE RECORD
   * THAT THE DECISION WAS TAKEN — which is exactly what the assertion that
   * stood here asked for. It read:
   *
   *   test_the_owner_and_cost_centre_tags_are_still_the_declared_placeholders
   *   "⚠️ THIS TEST IS EXPECTED TO FAIL THE DAY THE OWNER FILLS THEM IN, AND
   *    THAT IS WHAT IT IS FOR … when the real values land, this assertion is
   *    edited in the same commit and the edit is the record."
   *
   * It failed on the right day, for the right reason. Product owner, 18 Sep
   * 2026: Owner = phani@1cloudhub.com, CostCentre = ReconcileAI.
   *
   * THE ASSERTION IS INVERTED RATHER THAN DELETED, and the inversion is the
   * load-bearing half: a placeholder that reaches a deployed resource is a
   * chargeback hole and a page that goes nowhere, so the tree must now refuse
   * one. Deleting the test would leave nothing standing between a careless
   * revert and production. */
  const { synthesisedTemplates } = await import('./support.mjs')
  const templates = synthesisedTemplates()
  const seen = new Set()
  for (const template of Object.values(templates)) {
    for (const resource of Object.values(template.Resources ?? {})) {
      const tags = resource.Properties?.Tags
      if (!Array.isArray(tags)) continue
      for (const tag of tags) {
        if (tag.Key === 'Owner' || tag.Key === 'CostCentre') seen.add(`${tag.Key}=${tag.Value}`)
      }
    }
  }
  assert.deepEqual(
    [...seen].sort(),
    ['CostCentre=ReconcileAI', 'Owner=phani@1cloudhub.com'],
    'G260: the filled values, product owner 18 Sep 2026',
  )
  for (const entry of seen) {
    assert.doesNotMatch(
      entry,
      /PLACEHOLDER/,
      `${entry} is a placeholder on a resource that will be deployed. G260 ` +
        'names these "who gets paged" and "finance\'s key, not ours" — a ' +
        'placeholder in either is a page that reaches nobody and a cost line ' +
        'nobody owns.',
    )
  }
})

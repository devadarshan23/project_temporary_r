/**
 * THE PROBE'S OWN OUTPUT, DRIVEN OFFLINE — W0-c's second half.
 *
 * ┌─ 🛑 A VERDICT A READER CANNOT SEE IS NOT A VERDICT ────────────────────────┐
 * │ `fleet-image-verdict.test.mjs` proves the RULE distinguishes the three     │
 * │ cases. It cannot prove the PROBE prints them differently, and the probe is │
 * │ the only thing anybody runs. So this suite runs the real                   │
 * │ `probe-deployed-image.mjs`, unmodified, as a child process — against a     │
 * │ fake `aws` on `PATH` that answers from a fixture.                          │
 * │                                                                            │
 * │ ⚠️ **IT REACHES NO NETWORK, NO ACCOUNT AND NO CREDENTIAL**, which is what  │
 * │ lets it sit in the gate while the probe itself never can. It spawns two    │
 * │ node processes per case and reads a clock in no form.                      │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE SHIM IS PREPENDED TO `PATH` AND THE SPAWN IS NOT A SHELL, so the
 * `aws` the probe finds is this file's and nothing on the developer's machine
 * is consulted. **`AWS_PROFILE` and every `AWS_*` variable are stripped from
 * the child's environment** — not to be tidy, but so that a shim that failed to
 * intercept would fail LOUDLY rather than quietly reaching the real account
 * with the reader's own credentials.
 *
 * ⚠️ EXIT CODES ARE READ FROM `spawnSync`, NEVER FROM A PIPE — trap 8 of
 * `docs/build/deploy-handoff.md` §3, and `tests/infra/support.mjs` says the
 * same thing at its head for the same reason.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROBE = join(HERE, 'probe-deployed-image.mjs')

const ACCOUNT = '000000000000'
const REPO_PATH = `${ACCOUNT}.dkr.ecr.us-west-2.amazonaws.com/reconcile/planes-staging`
const REPO_NAME = 'reconcile/planes-staging'
const SHA = { first: 'a'.repeat(40), second: 'b'.repeat(40), third: 'c'.repeat(40) }
const PUSHED = '2026-09-20T09:00:00Z'

const PLANES = [
  { service: 'reconcile-staging-data-plane', family: 'reconcile-staging-data-plane' },
  { service: 'reconcile-staging-control-plane', family: 'reconcile-staging-control-plane' },
]

const taskArn = (family, revision) =>
  `arn:aws:ecs:us-west-2:${ACCOUNT}:task-definition/${family}:${revision}`

/**
 * A whole account, as four `describe-*` calls would report it.
 *
 * ⚠️ THE RUNNING SIDE IS A DIGEST AND THE STACK SIDE IS A TAG, exactly as the
 * probe's own header says the deployed fleet is — a fixture spelling both as
 * tags would exercise the one form that never occurs.
 */
function fixture({ dataSha, controlSha, stackSha }) {
  const running = { [PLANES[0].service]: dataSha, [PLANES[1].service]: controlSha }

  const stackResources = PLANES.map((p) => ({
    ResourceType: 'AWS::ECS::TaskDefinition',
    PhysicalResourceId: taskArn(p.family, 1),
  }))

  const services = PLANES.map((p) => ({
    serviceName: p.service,
    taskDefinition: taskArn(p.family, 38),
  }))

  const taskDefinitions = {}
  const images = {}
  for (const p of PLANES) {
    taskDefinitions[taskArn(p.family, 38)] = `${REPO_PATH}@sha256:${running[p.service]}`
    taskDefinitions[taskArn(p.family, 1)] = `${REPO_PATH}:${stackSha}`
    images[`${REPO_NAME}|imageDigest=sha256:${running[p.service]}`] = {
      imageTags: [running[p.service]],
      imagePushedAt: PUSHED,
    }
    images[`${REPO_NAME}|imageTag=${stackSha}`] = { imageTags: [stackSha], imagePushedAt: PUSHED }
  }

  return { stackResources, services, taskDefinitions, images }
}

/** A stand-in for the `aws` CLI. CommonJS: the temp directory has no `package.json`. */
const SHIM = `#!/usr/bin/env node
const fs = require('fs')
const argv = process.argv.slice(2)
const fx = JSON.parse(fs.readFileSync(process.env.PROBE_FIXTURE, 'utf8'))
const val = (flag) => { const i = argv.indexOf(flag); return i === -1 ? undefined : argv[i + 1] }

if (argv.includes('describe-stack-resources')) {
  process.stdout.write(JSON.stringify({ StackResources: fx.stackResources }))
} else if (argv.includes('describe-services')) {
  process.stdout.write(JSON.stringify({ services: fx.services }))
} else if (argv.includes('describe-task-definition')) {
  const image = fx.taskDefinitions[val('--task-definition')]
  if (!image) { process.stderr.write('shim: no task definition ' + val('--task-definition')); process.exit(9) }
  process.stdout.write(JSON.stringify({ taskDefinition: { containerDefinitions: [{ image }] } }))
} else if (argv.includes('describe-images')) {
  const detail = fx.images[val('--repository-name') + '|' + val('--image-ids')]
  if (!detail) {
    process.stderr.write('An error occurred (ImageNotFoundException) when calling DescribeImages')
    process.exit(1)
  }
  process.stdout.write(JSON.stringify({ imageDetails: [detail] }))
} else {
  process.stderr.write('shim: unexpected call: ' + argv.join(' '))
  process.exit(9)
}
`

/** Runs the real probe against a fixture, with no AWS reachable. */
function runProbe(shape) {
  const dir = mkdtempSync(join(tmpdir(), 'reconcile-probe-'))
  const shim = join(dir, 'aws')
  writeFileSync(shim, SHIM)
  chmodSync(shim, 0o755)

  const fixturePath = join(dir, 'fixture.json')
  writeFileSync(fixturePath, JSON.stringify(fixture(shape)))

  const env = {}
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('AWS_')) env[k] = v
  env.PATH = `${dir}:${env.PATH ?? ''}`
  env.PROBE_FIXTURE = fixturePath

  const run = spawnSync(process.execPath, [PROBE], { encoding: 'utf8', env, maxBuffer: 8 * 1024 * 1024 })
  assert.notEqual(run.status, 2, `the probe could not answer at all:\n${run.stderr}`)
  assert.notEqual(run.status, 9, `the shim was not consulted:\n${run.stderr}`)
  return { code: run.status, out: run.stdout }
}

// §1 — both services on the stack's image.
test('§1 an agreeing fleet prints AGREE and exits 0', () => {
  const { code, out } = runProbe({ dataSha: SHA.first, controlSha: SHA.first, stackSha: SHA.first })
  assert.equal(code, 0)
  assert.match(out, /^AGREE\./m)
  assert.doesNotMatch(out, /SPLIT FLEET/)
  assert.doesNotMatch(out, /DRIFT/)
})

// §2 — both services on the SAME non-stack image: the shape a pipeline run leaves.
test('§2 a uniformly-behind fleet prints DRIFT, exits 1, and offers a command', () => {
  const { code, out } = runProbe({ dataSha: SHA.second, controlSha: SHA.second, stackSha: SHA.first })
  assert.equal(code, 1)
  assert.match(out, /^DRIFT\./m)
  assert.doesNotMatch(out, /SPLIT FLEET/)
  assert.match(out, new RegExp(`cdk deploy reconcile-planes-staging -c planeImageTag=${SHA.second}`))
})

/**
 * §3 — THE SHAPE `docs/build/completion-plan.md` §8 NAMES. The Deploy stage
 * deploys the CONTROL plane first, so an abort between the two leaves the DATA
 * plane on the previous image. The stack owns the control plane's image, so
 * exactly ONE service drifts.
 */
test('§3 an abort between the two planes prints SPLIT FLEET and exits 3', () => {
  const { code, out } = runProbe({ dataSha: SHA.first, controlSha: SHA.second, stackSha: SHA.second })
  assert.equal(code, 3)
  assert.match(out, /\*\*\* SPLIT FLEET \*\*\*/)
  assert.match(out, /NOT running the same bytes as each other/)
  assert.match(out, new RegExp(SHA.first))
  assert.match(out, new RegExp(SHA.second))
})

/**
 * §4 — A SPLIT WHERE THE STACK OWNS A THIRD IMAGE, WHICH IS THE CASE W0-c IS
 * WRITTEN FOR: *"two DRIFT lines and exit 1 — identical in shape to a healthy
 * post-pipeline fleet."* Both services drift and the fleet is still split.
 */
test('§4 a split against a third image prints SPLIT FLEET and NO cdk deploy', () => {
  const { code, out } = runProbe({ dataSha: SHA.first, controlSha: SHA.second, stackSha: SHA.third })
  assert.equal(code, 3)
  assert.match(out, /\*\*\* SPLIT FLEET \*\*\*/)
  assert.equal(out.match(/\*\*\* DRIFT \*\*\*/g).length, 2, 'both services disagree with the stack')

  /* ⚠️ THE ASSERTION IS ON A RUNNABLE COMMAND AND NOT ON THE PHRASE `cdk deploy`,
   * and the difference is not pedantry: the first draft matched the phrase and
   * went RED against the split block's OWN PROSE, which says in as many words
   * that no such command is printed. **A rule keyed on a landmark instead of
   * the property it protects** — §5.1, inside the assertion written to catch a
   * §5.1-shaped defect, and the same shape as `grep -c` counting a header
   * block's prose elsewhere in this repository. */
  assert.doesNotMatch(
    out,
    /cdk deploy \S+ -c planeImageTag=/,
    'two conflicting commands would let whoever read first choose which plane wins',
  )
})

/**
 * §5 — THE DEFECT, END TO END. Before W0-c both of these printed two
 * `*** DRIFT ***` lines and exited 1. A reader holding only the exit code, or
 * only the output, must now be able to tell them apart.
 */
test('§5 a split fleet and a uniformly-behind fleet do not print or exit alike', () => {
  const uniform = runProbe({ dataSha: SHA.second, controlSha: SHA.second, stackSha: SHA.first })
  const split = runProbe({ dataSha: SHA.first, controlSha: SHA.second, stackSha: SHA.third })

  assert.equal(uniform.out.match(/\*\*\* DRIFT \*\*\*/g).length, 2)
  assert.equal(split.out.match(/\*\*\* DRIFT \*\*\*/g).length, 2)

  assert.notEqual(split.code, uniform.code, 'the exit codes must differ')
  assert.notEqual(split.out, uniform.out, 'the printed output must differ')
  assert.match(split.out, /SPLIT FLEET/)
  assert.doesNotMatch(uniform.out, /SPLIT FLEET/)
})

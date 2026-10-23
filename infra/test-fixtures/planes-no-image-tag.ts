/**
 * THE RED WITNESS FOR G1012 — `PlanesStack` refusing to synth when nobody has
 * NAMED the bytes it would deploy.
 *
 * 🛑 **THIS IS THE FIXTURE THAT CANNOT SUCCEED, AND ITS VALUE IS THAT
 * `planes-stack.ts` BESIDE IT DOES.** The two differ in ONE thing — this one
 * runs with an EMPTY CDK context — so what `tests/infra/planes.test.mjs`
 * measures is the absence of the image tag and nothing else.
 *
 * ⚠️ IT SETS NO CONTEXT RATHER THAN SETTING A BAD ONE, because the defect being
 * guarded is an ABSENCE. `PlaneImageTag` was a `CfnParameter` with no default
 * until 20 Sep 2026, and a parameter with no default is not a value that is
 * missing — it is a value CloudFormation supplies from THE LAST DEPLOY, which
 * is how the stack came to hold a tag two days older than the running service
 * while every gate in this repository stayed green. A context value that is not
 * supplied is supplied by nothing.
 *
 * The bad-VALUE arm (`latest`, a truncated sha) is asserted in
 * `tests/infra/planes.test.mjs` against `assertDeployablePlaneImageTag()`
 * directly, because it needs no tree at all.
 */
import { App } from 'aws-cdk-lib'

import { CDK_ENV, STACK_PLANES_STAGING } from '../lib/config.ts'
import { PlanesStack } from '../lib/planes-stack.ts'
import {
  stubControlDatabase,
  stubDataDatabase,
  stubNetwork,
  stubScope,
} from './planes-stubs.ts'

/* 🛑 THE ONE DIFFERENCE. `tests/infra/support.mjs` puts the synth-only tag in
 * `CDK_CONTEXT_JSON` for every fixture it spawns; the suite overrides that to
 * `{}` for this one, and `new App()` then reads an empty context. */
const app = new App()
const stubs = stubScope(app)

new PlanesStack(app, STACK_PLANES_STAGING, {
  env: CDK_ENV,
  environment: 'staging',
  network: stubNetwork(stubs),
  data: stubDataDatabase(stubs),
  control: stubControlDatabase(stubs),
})

const assembly = app.synth()

const templates: Record<string, unknown> = {}
for (const artefact of assembly.stacks) {
  templates[artefact.stackName] = artefact.template
}

process.stdout.write(JSON.stringify(templates))

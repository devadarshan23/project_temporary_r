/**
 * THE POSITIVE CONTROL. The real `PlanesStack`, on stub `Network`/`Data` props,
 * printed as CloudFormation JSON on stdout.
 *
 * It is half of a pair. `planes-migrator-leak.ts` differs from it in EXACTLY ONE
 * LINE — a grant of the migrator secret to the data plane's SERVICE task role —
 * so what `tests/infra/planes.test.mjs` measures is that one line and nothing
 * else. Without this half, an analysis that reported a leak unconditionally
 * would pass every red assertion and assert nothing (`docs/HANDOFF.md` §5.6).
 *
 * ⚠️ IT IS THE REAL STACK CLASS, not a second tree assembled for the
 * convenience of the tests — the same rule `test-fixtures/templates.ts` states
 * for `buildApp()`. Only the props are stubs, and they are stubs because the
 * `Network` and `Data` stacks are being written in parallel.
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

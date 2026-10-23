/**
 * THE RED WITNESS FOR G3861's ENGINE-CREDENTIAL FENCE.
 *
 * Identical to `planes-stack.ts` in every respect but ONE: the data plane's
 * SERVICE execution role is granted read on the `reconcile_engine` secret —
 * the run worker's credential, which carries `INSERT` on `tenant.exception`
 * (`db/migrations/0500` §1), the privilege `0015` refused every request path.
 * A serving process holding it could mint a finding against itself.
 *
 * It SYNTHESISES SUCCESSFULLY, deliberately: nothing in CDK can see the leak,
 * and `tests/infra/planes.test.mjs` must. `planes-migrator-leak.ts` is the
 * same argument for the migrator credential.
 */

import { App } from 'aws-cdk-lib'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'

import { CDK_ENV, STACK_PLANES_STAGING } from '../lib/config.ts'
import { PlanesStack } from '../lib/planes-stack.ts'
import {
  STUB_SECRET_ARNS,
  stubControlDatabase,
  stubDataDatabase,
  stubNetwork,
  stubScope,
} from './planes-stubs.ts'

const app = new App()
const stubs = stubScope(app)

const planes = new PlanesStack(app, STACK_PLANES_STAGING, {
  env: CDK_ENV,
  environment: 'staging',
  network: stubNetwork(stubs),
  data: stubDataDatabase(stubs),
  control: stubControlDatabase(stubs),
})

// ------------------------------------------------------- the one difference

const engineSecret = secretsmanager.Secret.fromSecretCompleteArn(
  planes,
  'LeakedEngineSecret',
  STUB_SECRET_ARNS.dataEngine,
)

/* The EXECUTION role, because that is the principal an ECS task SECRET is
 * fetched by — a `RECONCILE_ENGINE_PASSWORD` entry added to the service's
 * `secrets:` block would produce exactly this grant. */
engineSecret.grantRead(planes.dataService.taskDefinition.obtainExecutionRole())

// -------------------------------------------------------------------------

const assembly = app.synth()

const templates: Record<string, unknown> = {}
for (const artefact of assembly.stacks) {
  templates[artefact.stackName] = artefact.template
}

process.stdout.write(JSON.stringify(templates))

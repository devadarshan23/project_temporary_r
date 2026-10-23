/**
 * THE RED WITNESS FOR G253's CREDENTIAL FENCE.
 *
 * Identical to `planes-stack.ts` in every respect but ONE: the data plane's
 * SERVICE task role is granted read on the MIGRATOR secret — `reconcile_migrator`,
 * `LOGIN BYPASSRLS`, the read exemption every isolation assertion in `tests/` is
 * relative to.
 *
 * 🛑 THIS IS THE DEFECT OF 16 Aug 2026, RE-CREATED ON PURPOSE. It is exactly
 * what `server/data-plane/main.ts` did until that day, and its header records
 * the cost: the fence was correct at the CONNECTION and undone at the
 * CREDENTIAL INVENTORY, so any `process.env` disclosure in the serving process
 * yielded `BYPASSRLS` and then superuser, whatever the pool happened to be
 * connected as. G253 answers it in IAM — *"the migrate run-tasks are the ONLY
 * principals granted the migrator secret"* — and a rule that has never been
 * seen refusing anything is a rule nobody can tell from a comment.
 *
 * ⚠️ THE GRANT IS WRITTEN THE WAY A CONTRIBUTOR WOULD WRITE IT BY ACCIDENT —
 * one `grantRead` on a role that is already in the file, in the same shape the
 * legitimate grants take — rather than as a hand-built policy statement nobody
 * would mistake for ordinary work. `test-fixtures/untagged-stack.ts` makes the
 * same argument about removing a tag through CDK's own mutating Aspect.
 *
 * This fixture SYNTHESISES SUCCESSFULLY, deliberately. Nothing in CDK can see
 * the leak; the analysis in `tests/infra/planes.test.mjs` is what must see it,
 * and this file is what proves that analysis can.
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

const migratorSecret = secretsmanager.Secret.fromSecretCompleteArn(
  planes,
  'LeakedMigratorSecret',
  STUB_SECRET_ARNS.dataMigrator,
)

migratorSecret.grantRead(planes.dataService.taskDefinition.taskRole)

// -------------------------------------------------------------------------

const assembly = app.synth()

const templates: Record<string, unknown> = {}
for (const artefact of assembly.stacks) {
  templates[artefact.stackName] = artefact.template
}

process.stdout.write(JSON.stringify(templates))

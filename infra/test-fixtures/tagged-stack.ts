/**
 * THE POSITIVE CONTROL. A stack carrying all six tags: synth must SUCCEED.
 *
 * It is half of a pair and it is the half that is easy to leave out. Without it,
 * a `RequiredTagsAspect` that threw unconditionally would pass every red test in
 * `tests/infra/tagging.test.mjs` and assert nothing at all — `docs/HANDOFF.md`
 * §5.6. The three fixtures in this directory differ from each other in ONE
 * thing each, so the difference is what is being measured.
 *
 * Exit 0 on a clean synth, non-zero on a throw. `node infra/test-fixtures/tagged-stack.ts`.
 */

import { App, Stack } from 'aws-cdk-lib'
import * as ecr from 'aws-cdk-lib/aws-ecr'

import { CDK_ENV } from '../lib/config.ts'
import { applyRequiredTags } from '../lib/tagging.ts'

/* The outdir comes from `CDK_OUTDIR`, which `App` reads for itself — a
 * throwaway directory supplied by the spawning test, so a fixture run never
 * dirties a tracked tree. Passing it as a prop would need an `undefined` the
 * `exactOptionalPropertyTypes` this repository compiles under refuses. */
const app = new App()
const stack = new Stack(app, 'fixture-tagged', { env: CDK_ENV })

new ecr.Repository(stack, 'Repository', { repositoryName: 'fixture/tagged' })

applyRequiredTags(stack, 'staging', 'ci')

app.synth()
process.stdout.write('SYNTH OK\n')

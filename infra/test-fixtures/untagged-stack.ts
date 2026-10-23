/**
 * THE RED WITNESS. Identical to `tagged-stack.ts` in every respect but one: the
 * `Owner` tag is removed from the resource after the six are applied. Synth must
 * FAIL.
 *
 * 🛑 THE REMOVAL IS DELIBERATELY DONE THE WAY A CONTRIBUTOR WOULD DO IT BY
 * ACCIDENT — through `Tags.of(...).remove()`, which is CDK's own mutating Aspect
 * — rather than by declining to call `applyRequiredTags()`. A fixture that
 * simply never applied the tags would prove the inspector can see an empty
 * TagManager; this one proves it sees a tag that another Aspect took away, which
 * is the case the READONLY priority in `lib/tagging.ts` exists for. If that
 * priority were dropped, this fixture is what goes green and should not.
 */

import { App, Stack, Tags } from 'aws-cdk-lib'
import * as ecr from 'aws-cdk-lib/aws-ecr'

import { CDK_ENV } from '../lib/config.ts'
import { applyRequiredTags } from '../lib/tagging.ts'

/* The outdir comes from `CDK_OUTDIR`, which `App` reads for itself — a
 * throwaway directory supplied by the spawning test, so a fixture run never
 * dirties a tracked tree. Passing it as a prop would need an `undefined` the
 * `exactOptionalPropertyTypes` this repository compiles under refuses. */
const app = new App()
const stack = new Stack(app, 'fixture-untagged', { env: CDK_ENV })

const repository = new ecr.Repository(stack, 'Repository', {
  repositoryName: 'fixture/untagged',
})

applyRequiredTags(stack, 'staging', 'ci')

// The one difference from the positive control.
Tags.of(repository).remove('Owner')

app.synth()
process.stdout.write('SYNTH OK\n')

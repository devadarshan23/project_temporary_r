/**
 * THE SECOND RED WITNESS — G260's absence clause, made executable.
 *
 * All six required tags are present and correct. The one difference from the
 * positive control is a `TenantId` tag, which is exactly what a well-meaning
 * contributor adds to make cost allocation per tenant work. Synth must FAIL.
 *
 * 🛑 **A per-tenant tag is a tenant enumeration in the clear.** A tag is
 * control-plane metadata readable by anyone holding `tag:GetResources`, so the
 * tag set on an account becomes a customer list. G260 rejected tenant tags on
 * data-plane resources explicitly, and this fixture is what stops that rejection
 * from being a paragraph nobody reads.
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
const stack = new Stack(app, 'fixture-tenant-tagged', { env: CDK_ENV })

const repository = new ecr.Repository(stack, 'Repository', {
  repositoryName: 'fixture/tenant-tagged',
})

applyRequiredTags(stack, 'staging', 'data')

// The one difference from the positive control.
Tags.of(repository).add('TenantId', 'ten_acme')

app.synth()
process.stdout.write('SYNTH OK\n')

/**
 * THE RED WITNESS FOR THE ALIAS — G260's absence clause, arriving at the one
 * API its own Aspect cannot see.
 *
 * `tests/infra/tag-aspect.test.mjs` already witnesses that a `TenantId` TAG
 * fails synth. **A KMS ALIAS is the same disclosure through a different call**:
 * `kms:ListAliases` is account-wide and takes no resource, so
 * `alias/reconcile-staging-data-tk-ten_acme` publishes the customer list to
 * every principal holding it. `RequiredTagsAspect` is blind to that — an alias
 * is not a tag — so the refusal lives in `assertOpaqueKeyHandle()` instead, and
 * this fixture is what stops it from being a paragraph nobody reads.
 *
 * The one difference from `storage-tenant-keys.ts` is the handle. Synth must
 * FAIL.
 */

import { App } from 'aws-cdk-lib'

import { CDK_ENV } from '../lib/config.ts'
import { StorageStack } from '../lib/storage-stack.ts'

const app = new App()

new StorageStack(app, 'reconcile-storage-staging', {
  env: CDK_ENV,
  environment: 'staging',
  // The one difference. A tenant id, where an opaque handle belongs.
  tenantKeyHandles: ['ten_acme'],
})

app.synth()
process.stdout.write('SYNTH OK\n')

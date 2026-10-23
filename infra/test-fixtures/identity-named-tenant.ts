/**
 * THE RED WITNESS FOR THE PROVIDER NAME — G260's absence clause, arriving at
 * the FOURTH API its own Aspect cannot see.
 *
 * `tests/infra/tag-aspect.test.mjs` witnesses that a `TenantId` TAG fails
 * synth. `infra/test-fixtures/storage-named-tenant.ts` witnesses the same
 * refusal for a KMS ALIAS. `infra/test-fixtures/edge-flat-tenant-host.ts`
 * witnesses the host grammar. **A COGNITO PROVIDER NAME is the same disclosure
 * again**: it is readable through `cognito-idp:ListIdentityProviders` and, worse
 * than an alias, it is echoed in the hosted UI's own `identity_provider` query
 * parameter — so `c-ten_acme` publishes a customer to everybody who can read an
 * address bar, not merely to a principal holding a permission.
 *
 * `RequiredTagsAspect` is blind to it, because a provider name is not a tag. So
 * the refusal lives in `assertOpaqueProviderHandle()`, and this fixture is what
 * stops it from being a paragraph nobody reads.
 *
 * The one difference from `identity-connections.ts` is the handle. Synth must
 * FAIL.
 */

import { App } from 'aws-cdk-lib'

import { CDK_ENV } from '../lib/config.ts'
import { IdentityStack } from '../lib/identity-stack.ts'

const app = new App()

new IdentityStack(app, 'reconcile-identity-staging', {
  env: CDK_ENV,
  environment: 'staging',
  connections: [
    {
      // The one difference. A tenant id, where an opaque handle belongs.
      handle: 'ten_acme',
      protocol: 'saml',
      metadataUrl: 'https://example.invalid/federation/metadata.xml',
    },
  ],
})

app.synth()
process.stdout.write('SYNTH OK\n')

/**
 * THE GREEN WITNESS FOR THE PROVIDER FACTORY — G302.
 *
 * `FEDERATED_CONNECTIONS` is empty, so the real `Identity` stack renders ZERO
 * identity providers and a `SupportedIdentityProviders` of `[]`. Asserting
 * against that alone would witness nothing whatever about the loop that builds
 * a provider or about the list that feeds the app client — `docs/HANDOFF.md`
 * §5.6, a control that cannot be witnessed asserts nothing. This is the same
 * argument `infra/test-fixtures/storage-tenant-keys.ts` makes at a different
 * service, and the same shape.
 *
 * Two SAML connections, two opaque handles. Synth must SUCCEED, and
 * `tests/infra/identity.test.mjs` reads the provider names and the client's
 * `SupportedIdentityProviders` out of the result — where `COGNITO` must be
 * absent for a reason rather than by arithmetic.
 */

import { App } from 'aws-cdk-lib'

import { CDK_ENV } from '../lib/config.ts'
import { IdentityStack } from '../lib/identity-stack.ts'

const app = new App()

const stack = new IdentityStack(app, 'reconcile-identity-staging', {
  env: CDK_ENV,
  environment: 'staging',
  connections: [
    {
      handle: '0f3a9c71b28d4e60',
      protocol: 'saml',
      metadataUrl: 'https://example.invalid/federation/metadata.xml',
    },
    {
      handle: 'a91d0c44e7b2f358',
      protocol: 'saml',
      metadataUrl: 'https://example.invalid/other/metadata.xml',
    },
  ],
})

const assembly = app.synth()

process.stdout.write(JSON.stringify(assembly.getStackByName(stack.stackName).template))

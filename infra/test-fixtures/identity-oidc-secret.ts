/**
 * THE RED WITNESS FOR G263's SECRET — and the interesting half is that the
 * refusal is not about a key in an environment block.
 *
 * G302 qualifies G263 for exactly this case: *"An IdP client secret is a real
 * secret — if one is unavoidable, it goes in Secrets Manager with rotation, and
 * you say so."* `assertNoStoredClientSecret()` is the saying-so, and its
 * conclusion is that **Secrets Manager does not buy what that sentence assumes
 * it buys**: Cognito stores the client secret's VALUE, a CloudFormation dynamic
 * reference resolves ONCE at deploy, and a rotation schedule that never reaches
 * the pool is a control recorded as working over a secret nothing re-reads.
 *
 * SAML needs no secret at all, so the refusal costs one protocol rather than
 * federation. Synth must FAIL.
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
      handle: '0f3a9c71b28d4e60',
      // The one difference. A protocol that carries a stored client secret.
      protocol: 'oidc',
      metadataUrl: 'https://example.invalid/.well-known/openid-configuration',
    },
  ],
})

app.synth()
process.stdout.write('SYNTH OK\n')

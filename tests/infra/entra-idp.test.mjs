/**
 * G2767/G2768 — THE OWNER'S RULING OF 2 Oct 2026: *"staging federates
 * Microsoft Entra ID through the Cognito broker."*
 *
 *   §1  WITHOUT the owner's ids, Identity renders NO OIDC provider — and the
 *       empty client-secret secret exists so it can be filled first.
 *   §2  WITH them, ONE OIDC provider, an opaque name, the Entra v2 issuer, the
 *       client secret as a DYNAMIC REFERENCE (no plaintext anywhere in the
 *       template), the two claim mappings R6 reads, and the client offers it
 *       — and still not COGNITO.
 *   §3  the outputs the owner needs: the redirect URI and the empty secret.
 *   §4  half a pair, a malformed id, or another environment is a SYNTH FAILURE.
 *   §5  the SAML-only refusal for `FEDERATED_CONNECTIONS` is UNCHANGED.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ensureDeps, synthesisedTemplates, resourcesOfType } from './support.mjs'

await ensureDeps()

const IDENTITY = 'reconcile-identity-staging'
const TENANT = '11111111-2222-3333-4444-555555555555'
const CLIENT = '66666666-7777-8888-9999-aaaaaaaaaaaa'
const PROVIDER = 'AWS::Cognito::UserPoolIdentityProvider'

const bare = () => synthesisedTemplates()[IDENTITY]
const withEntra = () => synthesisedTemplates({ entraTenantId: TENANT, entraClientId: CLIENT })[IDENTITY]

test('§1 · without the owner’s ids there is NO OIDC provider, and the empty secret exists', () => {
  const t = bare()
  assert.deepEqual(resourcesOfType(t, PROVIDER), [])
  const secrets = resourcesOfType(t, 'AWS::SecretsManager::Secret').map(([, r]) => r.Properties)
  const entra = secrets.find((p) => p.Name === 'reconcile-staging-entra-client-secret')
  assert.ok(entra, 'the empty Entra client-secret secret is not rendered')
  assert.deepEqual(JSON.parse(entra.GenerateSecretString.SecretStringTemplate), { clientSecret: '' })
})

test('§2 · with them: one OIDC provider, secret by REFERENCE, mapped claims, offered by the client', () => {
  const t = withEntra()
  const providers = resourcesOfType(t, PROVIDER)
  assert.equal(providers.length, 1)
  const p = providers[0][1].Properties
  assert.equal(p.ProviderType, 'OIDC')
  assert.equal(p.ProviderName, 'c-536ff22dd95a0cd0', 'the provider name must be the opaque handle')
  assert.equal(p.ProviderDetails.oidc_issuer, `https://login.microsoftonline.com/${TENANT}/v2.0`)
  assert.equal(p.ProviderDetails.client_id, CLIENT)
  assert.equal(
    p.ProviderDetails.client_secret,
    '{{resolve:secretsmanager:reconcile-staging-entra-client-secret:SecretString:clientSecret::}}',
    'the client secret is not a dynamic reference — a value in a template is a published secret',
  )
  assert.equal(p.ProviderDetails.authorize_scopes, 'openid email profile')
  assert.deepEqual(p.AttributeMapping, { email: 'email', name: 'name' })
  const client = resourcesOfType(t, 'AWS::Cognito::UserPoolClient')[0][1]
  assert.deepEqual(client.Properties.SupportedIdentityProviders, ['c-536ff22dd95a0cd0'])
  assert.ok((client.DependsOn ?? []).some((d) => d.startsWith('Provider536ff22dd95a0cd0')), 'the client must wait for the provider')
})

test('§3 · the outputs the owner acts on', () => {
  const outputs = bare().Outputs
  assert.equal(
    outputs.EntraRedirectUri.Value,
    'https://reconcile-000000000000-staging.auth.us-west-2.amazoncognito.com/oauth2/idpresponse',
  )
  assert.equal(outputs.EntraClientSecretNeedsAValue.Value, 'reconcile-staging-entra-client-secret')
})

test('§4 · half a pair, a malformed id, or another environment refuses to synthesise', async () => {
  assert.throws(() => synthesisedTemplates({ entraTenantId: TENANT }), /G2767/)
  assert.throws(() => synthesisedTemplates({ entraTenantId: 'not-a-guid', entraClientId: CLIENT }), /G2767/)
  const { entraConnectionFromContext } = await import('../../infra/lib/config.ts')
  assert.throws(
    () => entraConnectionFromContext((k) => ({ entraTenantId: TENANT, entraClientId: CLIENT })[k], 'prod'),
    /staging alone/,
  )
  assert.equal(entraConnectionFromContext(() => undefined, 'prod'), null)
})

test('§5 · the SAML-only refusal for FEDERATED_CONNECTIONS is unchanged', async () => {
  const { assertNoStoredClientSecret } = await import('../../infra/lib/identity-stack.ts')
  assert.throws(
    () => assertNoStoredClientSecret({ handle: '0f3a9c71b28d4e60', protocol: 'oidc', metadataUrl: 'x' }),
    /G263\/G302/,
  )
})

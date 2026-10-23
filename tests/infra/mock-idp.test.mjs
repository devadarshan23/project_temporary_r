/**
 * G2996–G3003 — THE STAGING MOCK SIGN-IN, IN THE CDK APP. THE OWNER'S RULING
 * G2771: a public test login on staging, accepted in writing, and every fence
 * `infra/lib/mock-idp-stack.ts` names asserted over the SYNTHESISED template.
 *
 *   §1  the catalogue's hosts are the app's, and `ten_mock` is registered.
 *   §2  WITHOUT context there is no mock stack and no mock provider at all.
 *   §3  `-c mockSignIn=on`: the KMS key, the EMPTY password, the GENERATED
 *       client secret, reserved concurrency, the one redirect, the catalogue,
 *       the narrow role, the log group and the test-door output.
 *   §4  `-c mockIdpIssuer`: three OIDC providers, secret by REFERENCE, offered
 *       by the client — and still never `COGNITO`.
 *   §5  RED — every other environment, a malformed issuer, a bad flag.
 *   §6  the Build stage passes the switcher flag, `on` for staging alone.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ensureDeps, synthesisedTemplates, resourcesOfType } from './support.mjs'

await ensureDeps()

const MOCK = 'reconcile-mock-idp-staging'
const IDENTITY = 'reconcile-identity-staging'
const ISSUER = 'https://abcdefghijklmnopqrstuvwxyz012345.lambda-url.us-west-2.on.aws'
const PROVIDER = 'AWS::Cognito::UserPoolIdentityProvider'

const config = await import('../../infra/lib/config.ts')
const personas = await import('../../infra/lib/mock-personas.ts')

const DOORS = Object.values(personas.MOCK_DOORS)

const bare = synthesisedTemplates()
const withDoor = synthesisedTemplates({ mockSignIn: 'on' })
const withProviders = synthesisedTemplates({ mockIdpIssuer: ISSUER })

test('§1 · the catalogue’s hosts are the app’s own, and the mock tenant is registered', () => {
  assert.equal(personas.MOCK_TENANT_HOST, config.tenantHost(personas.MOCK_TENANT_SLUG))
  assert.equal(personas.MOCK_CONSOLE_HOST, config.CONSOLE_HOST)
  assert.equal(personas.MOCK_PARTNERS_HOST, config.PARTNERS_HOST)
  assert.ok(
    config.SIGN_IN_DEPLOYMENT.staging.servingHosts.includes(
      `${personas.MOCK_TENANT_HOST}|${personas.MOCK_TENANT_ID}|us-west-2|pooled|active`,
    ),
    'ten-mock is not in the staging serving-host registry — every mock customer sign-in would be refused',
  )
  for (const door of Object.values(personas.MOCK_DOORS)) {
    assert.match(door.handle, config.COGNITO_PROVIDER_HANDLE_PATTERN)
    assert.ok(door.domain.endsWith(`.${personas.MOCK_IDENTITY_DOMAIN}`), `${door.connectionId} is outside the mock domain`)
  }
  for (const p of personas.MOCK_PERSONAS) {
    assert.ok(
      [personas.MOCK_TENANT_HOST, personas.MOCK_CONSOLE_HOST, personas.MOCK_PARTNERS_HOST].includes(p.portalHost),
      `${p.sub} lands on a host that is not a portal`,
    )
  }
})

test('§2 · without context: no mock stack, no OIDC provider, nothing changed', () => {
  assert.equal(bare[MOCK], undefined, 'the mock door is in the app without -c mockSignIn=on')
  assert.deepEqual(resourcesOfType(bare[IDENTITY], PROVIDER), [])
  assert.equal(withDoor[IDENTITY] !== undefined, true)
  assert.deepEqual(
    JSON.stringify(withDoor[IDENTITY]),
    JSON.stringify(bare[IDENTITY]),
    '-c mockSignIn=on changed Identity — the door and the providers are two separate deploys',
  )
})

test('§3 · -c mockSignIn=on: every fence of the door is in the template', () => {
  const t = withDoor[MOCK]
  assert.ok(t, 'no mock stack under -c mockSignIn=on')

  const keys = resourcesOfType(t, 'AWS::KMS::Key').map(([, r]) => r.Properties)
  assert.equal(keys.length, 1)
  assert.equal(keys[0].KeySpec, 'RSA_2048')
  assert.equal(keys[0].KeyUsage, 'SIGN_VERIFY')

  const secrets = resourcesOfType(t, 'AWS::SecretsManager::Secret').map(([, r]) => r.Properties)
  const password = secrets.find((s) => s.Name === 'reconcile-staging-mock-idp-password')
  assert.ok(password, 'no password secret')
  assert.deepEqual(
    JSON.parse(password.GenerateSecretString.SecretStringTemplate),
    { password: '' },
    'the mock password must be created EMPTY — a value in the template is a published credential',
  )
  assert.notEqual(password.GenerateSecretString.GenerateStringKey, 'password')
  const client = secrets.find((s) => s.Name === 'reconcile-staging-mock-idp-client-secret')
  assert.ok(client, 'no client secret')
  assert.equal(client.GenerateSecretString.GenerateStringKey, 'clientSecret')

  const fns = resourcesOfType(t, 'AWS::Lambda::Function').map(([, r]) => r.Properties)
  assert.equal(fns.length, 1)
  const fn = fns[0]
  assert.equal(fn.ReservedConcurrentExecutions, config.MOCK_IDP_RESERVED_CONCURRENCY)
  const env = fn.Environment.Variables
  assert.equal(env.MOCK_IDP_ENVIRONMENT, 'staging')
  assert.equal(env.MOCK_IDP_ALLOWED_REDIRECT_URI, config.cognitoIdpResponseUrl('staging'))
  const catalogue = JSON.parse(env.MOCK_IDP_CATALOGUE)
  assert.equal(catalogue.personas.length, personas.MOCK_PERSONAS.length)
  for (const p of catalogue.personas) {
    assert.match(p.email, /@[a-z]+\.mock\.reconcileai\.app$/, `${p.sub} is not a mock address`)
  }
  assert.ok(!JSON.stringify(fn).includes('password":"'), 'a password value reached the function definition')

  const urls = resourcesOfType(t, 'AWS::Lambda::Url').map(([, r]) => r.Properties)
  assert.equal(urls.length, 1)
  assert.equal(urls[0].AuthType, 'NONE')

  const actions = resourcesOfType(t, 'AWS::IAM::Policy')
    .flatMap(([, r]) => r.Properties.PolicyDocument.Statement)
    .flatMap((s) => [s.Action].flat())
    .sort()
  for (const action of actions) {
    assert.match(
      action,
      /^(kms:(Sign|GetPublicKey|Decrypt)|logs:(CreateLogStream|PutLogEvents)|secretsmanager:(GetSecretValue|DescribeSecret))$/,
      `the door's role holds \`${action}\`, wider than signing and reading its two secrets`,
    )
  }

  assert.match(t.Outputs.ThisIsATestDoor.Value, /TEST DOOR/)
  assert.match(t.Outputs.ThisIsATestDoor.Value, /never exist outside staging/)
})

test('§4 · -c mockIdpIssuer: three providers, secret by reference, offered — and never COGNITO', () => {
  const t = withProviders[IDENTITY]
  const providers = resourcesOfType(t, PROVIDER).map(([, r]) => r.Properties)
  assert.equal(providers.length, 3)
  const names = providers.map((p) => p.ProviderName).sort()
  assert.deepEqual(
    names,
    Object.values(personas.MOCK_DOORS)
      .map((d) => `c-${d.handle}`)
      .sort(),
  )
  for (const p of providers) {
    assert.equal(p.ProviderType, 'OIDC')
    assert.equal(p.ProviderDetails.oidc_issuer, ISSUER)
    assert.equal(
      p.ProviderDetails.client_secret,
      '{{resolve:secretsmanager:reconcile-staging-mock-idp-client-secret:SecretString:clientSecret::}}',
    )
    assert.deepEqual(p.AttributeMapping, { email: 'email', email_verified: 'email_verified', name: 'name' })
  }
  const client = resourcesOfType(t, 'AWS::Cognito::UserPoolClient')[0][1].Properties
  assert.deepEqual([...client.SupportedIdentityProviders].sort(), names)
  assert.ok(!client.SupportedIdentityProviders.includes('COGNITO'))
  assert.match(t.Outputs.MockDoorsAreATestLogin.Value, /MockIdp test door/)
})

test('§5 · RED — another environment, a malformed issuer, or a bad flag refuses at synth', () => {
  assert.throws(() => config.assertMockSignInEnvironment('prod'), /STAGING ALONE/)
  assert.throws(() => config.assertMockSignInEnvironment('shared'), /STAGING ALONE/)
  assert.throws(() => config.mockSignInFromContext(() => 'on', 'prod'), /STAGING ALONE/)
  assert.throws(() => config.mockSignInFromContext(() => 'yes', 'staging'), /'on' or absent/)
  assert.equal(config.mockSignInFromContext(() => undefined, 'prod'), false)
  assert.throws(() => config.mockIdpConnectionsFromContext(() => ISSUER, 'prod', DOORS), /STAGING ALONE/)
  for (const bad of [`${ISSUER}/`, 'https://evil.example.com', ISSUER.replace('us-west-2', 'us-east-1'), 42]) {
    assert.throws(() => config.mockIdpConnectionsFromContext(() => bad, 'staging', DOORS), /FunctionUrl/, String(bad))
  }
  assert.throws(() => synthesisedTemplates({ mockSignIn: 'yes' }), /'on' or absent/)
})

test('§5b · RED — the stack itself refuses to construct for any environment but staging', async () => {
  const { App } = await import('../../infra/node_modules/aws-cdk-lib/index.js')
  const { MockIdpStack } = await import('../../infra/lib/mock-idp-stack.ts')
  for (const environment of config.ENVIRONMENTS.filter((e) => e !== 'staging')) {
    assert.throws(() => new MockIdpStack(new App(), `t-${environment}`, { environment }), /STAGING ALONE/)
  }
})

test('§6 · the Build stage passes the switcher flag, and it is `on` for staging ALONE', () => {
  for (const environment of config.ENVIRONMENTS) {
    assert.equal(config.testPersonasBuildFlag(environment), environment === 'staging' ? 'on' : 'off')
  }
  const pipeline = bare['reconcile-pipeline-staging']
  const projects = resourcesOfType(pipeline, 'AWS::CodeBuild::Project').map(([, r]) => r.Properties)
  const carrying = projects.filter((p) =>
    (p.Environment.EnvironmentVariables ?? []).some((v) => v.Name === 'RECONCILE_TEST_PERSONAS'),
  )
  assert.equal(carrying.length, 1, 'exactly one project — the one that runs build:frontend — carries the flag')
  const flag = carrying[0].Environment.EnvironmentVariables.find((v) => v.Name === 'RECONCILE_TEST_PERSONAS')
  assert.equal(flag.Value, 'on')
  assert.match(String(carrying[0].Source.BuildSpec), /npm run build:frontend/)
})

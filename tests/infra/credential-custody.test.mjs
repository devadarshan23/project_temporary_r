/**
 * SOURCE CREDENTIAL CUSTODY, IN THE TEMPLATE — G2401 (THE OWNER'S), G2402–G2404.
 *
 * *"Secrets Manager, one secret per source, encrypted with the tenant's
 * per-tenant KMS key (Storage's key factory); only a credentialRef lives in
 * Postgres."* What a template can show is the IAM half and the key-policy half
 * of that sentence. Nothing here is deployed, and a synthesised policy is not
 * a policy AWS has accepted — G290's own row records that difference, found
 * the hard way.
 *
 * ⚠️ WHAT THIS FILE DOES NOT CLAIM: that IAM separates one tenant's secrets
 * from another's. One serving process serves every tenant, so the resource
 * fence is a NAME PREFIX; cross-tenant isolation is the server's and RLS's,
 * witnessed in `tests/http/credential-binding-served.test.ts` §5.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ensureDeps, runInfraScript, synthesisedTemplates, resourcesOfType } from './support.mjs'

await ensureDeps()

const STACK = 'reconcile-storage-staging'
const POLICY = 'AWS::IAM::Policy'
const KEY = 'AWS::KMS::Key'

const asList = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v])

const realStack = () => {
  const template = synthesisedTemplates()[STACK]
  assert.ok(template, `${STACK} is not in the synthesised app at all`)
  return template
}

const servingStatements = () =>
  resourcesOfType(realStack(), POLICY)
    .filter(([logicalId]) => logicalId.includes('DataPlaneServingTaskRole'))
    .flatMap(([, r]) => r.Properties?.PolicyDocument?.Statement ?? [])

const secretsStatements = () =>
  servingStatements().filter((s) => asList(s.Action).some((a) => String(a).startsWith('secretsmanager:')))

test('test_the_serving_role_may_create_and_put_a_source_credential_and_nothing_else_in_secrets_manager', () => {
  const actions = secretsStatements().flatMap((s) => asList(s.Action)).sort()
  assert.deepEqual(
    actions,
    ['secretsmanager:CreateSecret', 'secretsmanager:PutSecretValue'],
    'G2403: the ruling is that a credential is BOUND, which is a write. Any other ' +
      `secretsmanager verb on the serving role is a widening: ${JSON.stringify(actions)}`,
  )
})

test('test_no_statement_anywhere_in_the_app_lets_the_serving_role_read_a_secret', () => {
  for (const [stack, template] of Object.entries(synthesisedTemplates())) {
    for (const [logicalId, r] of resourcesOfType(template, POLICY)) {
      for (const s of r.Properties?.PolicyDocument?.Statement ?? []) {
        for (const action of asList(s.Action)) {
          assert.equal(
            /^secretsmanager:(\*|Get|BatchGet)/i.test(String(action)) &&
              logicalId.includes('DataPlaneServingTaskRole'),
            false,
            `${stack}/${logicalId} lets the data plane serving role read a secret (${action})`,
          )
        }
      }
    }
  }
})

test('test_every_secrets_grant_is_fenced_to_the_opaque_credential_prefix', () => {
  for (const s of secretsStatements()) {
    const resources = JSON.stringify(s.Resource)
    assert.match(
      resources,
      /secret:reconcile-staging-data-cred-\*/,
      'the grant must be fenced to `sourceCredentialSecretPrefix()`, an opaque prefix that ' +
        `names no tenant: ${resources}`,
    )
    assert.doesNotMatch(resources, /ten_/, 'a tenant id in a secret ARN is a tenant enumeration')
  }
})

test('test_create_secret_is_refused_unless_it_names_a_tenant_key_so_the_shared_key_is_unreachable', () => {
  const create = secretsStatements().find((s) => asList(s.Action).includes('secretsmanager:CreateSecret'))
  assert.ok(create, 'no CreateSecret grant')
  assert.equal(
    create.Condition?.Null?.['secretsmanager:KmsKeyId'],
    'false',
    'G2401: without this condition a caller omits KmsKeyId and Secrets Manager quietly ' +
      'encrypts under aws/secretsmanager, the account SHARED key — every tenant under one key.',
  )
  assert.equal(
    create.Condition?.StringLike?.['secretsmanager:KmsKeyId'],
    'alias/reconcile-staging-data-tk-*',
    'CreateSecret must be admitted only under a TENANT key alias',
  )
})

test('test_the_tenant_key_lets_secrets_manager_encrypt_for_the_serving_role_and_never_decrypt', () => {
  const run = runInfraScript('test-fixtures/storage-tenant-keys.ts')
  assert.equal(run.status, 0, `the tenant-key fixture must synthesise; stderr=${run.stderr}`)
  const keys = resourcesOfType(JSON.parse(run.stdout), KEY)
  assert.ok(keys.length > 0, 'the fixture minted no key, so this assertion is vacuous')
  for (const [logicalId, key] of keys) {
    const viaSecrets = (key.Properties?.KeyPolicy?.Statement ?? []).filter((s) =>
      JSON.stringify(s.Condition ?? {}).includes('secretsmanager.'),
    )
    assert.equal(viaSecrets.length, 1, `${logicalId}: exactly one Secrets Manager statement`)
    const actions = asList(viaSecrets[0].Action).sort()
    assert.deepEqual(
      actions,
      ['kms:DescribeKey', 'kms:GenerateDataKey'],
      `${logicalId}: G2402 — the serving role may ENCRYPT a credential through Secrets ` +
        'Manager and may not DECRYPT one. kms:Decrypt here is GetSecretValue by the back door.',
    )
  }
})

test('test_a_read_verb_on_the_credential_writer_fails_synth_and_this_is_the_red_witness', () => {
  const run = runInfraScript('test-fixtures/storage-credential-read-back.ts')
  assert.match(run.stdout, /SAFE OK/, 'the positive control did not pass, so the red proves nothing')
  assert.notEqual(run.status, 0, 'a wildcard read verb on the credential writer synthesised')
  assert.equal(run.stdout.includes('NOT REACHED'), false)
  assert.match(`${run.stdout}${run.stderr}`, /G2403/)
})

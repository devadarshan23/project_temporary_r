/**
 * THE CREDENTIAL STORE SEAM AND ITS SECRETS MANAGER HALF — G2401–G2405.
 *
 * No database and no AWS account: the Secrets Manager module is driven
 * through `storeOver(dispatch)` with a recording dispatch, which is
 * `sqs-run-queue.ts`'s seam one service over. What is asserted is the COMMAND
 * the plane would send — because the two properties the ruling buys are both
 * properties of that command: the KEY it names, and the absence of any READ.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { CreateSecretCommand, PutSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { storeOver } from '../../server/data-plane/secrets-manager-store.ts'
import * as credentialStore from '../../server/data-plane/credential-store.ts'
import { REPO_ROOT } from './harness.ts'

const SECRET = 'pa55-CRED-0a1b2c3d-4e5f'
const NAME = 'reconcile-staging-data-cred-0123456789abcdef0123456789abcdef'
const ALIAS = 'alias/reconcile-staging-data-tk-a1b2c3d4e5f60718'

test('§1 · a first bind is CreateSecret, under the TENANT key alias, with nothing else', async () => {
  const sent: unknown[] = []
  const store = storeOver(async (command) => {
    sent.push(command)
    return {}
  })
  const out = await store({ secretName: NAME, keyAlias: ALIAS, value: SECRET, mode: 'create' })
  assert.deepEqual(out, { ok: true })
  assert.equal(sent.length, 1)
  const command = sent[0]
  assert.ok(command instanceof CreateSecretCommand, 'a first bind must CREATE the secret')
  assert.deepEqual(
    command.input,
    { Name: NAME, KmsKeyId: ALIAS, SecretString: SECRET },
    'G2401: `KmsKeyId` is ALWAYS the tenant’s alias. Omitting it encrypts under ' +
      '`aws/secretsmanager`, the account’s SHARED key — and there are no Tags, because the ' +
      'serving role holds no TagResource (G2405).',
  )
})

test('§2 · a rotation is PutSecretValue, which takes no key and so cannot move one', async () => {
  const sent: unknown[] = []
  const store = storeOver(async (command) => {
    sent.push(command)
    return {}
  })
  await store({ secretName: NAME, keyAlias: ALIAS, value: SECRET, mode: 'rotate' })
  const command = sent[0]
  assert.ok(command instanceof PutSecretValueCommand)
  assert.deepEqual(command.input, { SecretId: NAME, SecretString: SECRET })
})

test('§2b · a refused write is `store_rejected`, and the VALUE reaches no log line', async () => {
  const lines: string[] = []
  const original = console.error
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '))
  }
  try {
    const store = storeOver(async () => {
      const err = new Error(`echoing ${SECRET} in a message a future SDK might write`)
      err.name = 'AccessDeniedException'
      throw err
    })
    const out = await store({ secretName: NAME, keyAlias: ALIAS, value: SECRET, mode: 'create' })
    assert.deepEqual(out, { ok: false, refusal: 'store_rejected' })
  } finally {
    console.error = original
  }
  assert.equal(lines.length, 1)
  assert.match(lines[0] ?? '', /AccessDeniedException/)
  assert.equal(
    (lines[0] ?? '').includes(SECRET),
    false,
    'the credential reached a log line through the SDK error message. Log the NAME only.',
  )
})

test('§3 · the Secrets Manager module imports exactly the two WRITE commands and no read', () => {
  const source = readFileSync(
    path.join(REPO_ROOT, 'server', 'data-plane', 'secrets-manager-store.ts'),
    'utf8',
  )
  const block = /import\s*\{([^}]*)\}\s*from\s*'@aws-sdk\/client-secrets-manager'/.exec(source)
  assert.ok(block, 'the module no longer imports the client by a named import')
  const names = (block[1] ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n !== '')
    .sort()
  assert.deepEqual(
    names,
    ['CreateSecretCommand', 'PutSecretValueCommand', 'SecretsManagerClient'],
    'G2403: the serving process may WRITE a source credential and may never read one back. ' +
      'A `GetSecretValueCommand` here is the read-back the ruling refuses, not a convenience.',
  )
  /* And no namespace or dynamic import can smuggle one in past the named list. */
  assert.equal(/import\s*\*\s*as\s*\w+\s*from\s*'@aws-sdk/.test(source), false)
  assert.equal(/GetSecretValue|BatchGetSecretValue|DescribeSecret|ListSecrets/.test(source.replace(/\/\*[\s\S]*?\*\//g, '')), false)
})

test('§4 · the seam exports a WRITER and no reader', () => {
  const exported = Object.keys(credentialStore).sort()
  assert.deepEqual(
    exported.filter((n) => /^(get|read|fetch|describe|list|load|reveal)|Secret(Value|String)/i.test(n)),
    [],
    `credential-store.ts exports something that reads: ${exported.join(', ')}`,
  )
})

test('§5 · an UNCONFIGURED plane refuses loudly rather than storing nowhere', async () => {
  const custody = credentialStore.unconfiguredCredentialCustody()
  const original = console.error
  console.error = () => undefined
  try {
    const out = await custody.store({
      secretName: custody.secretNameFor('0123456789abcdef0123456789abcdef'),
      keyAlias: custody.keyAliasFor('a1b2c3d4e5f60718'),
      value: SECRET,
      mode: 'create',
    })
    assert.deepEqual(out, { ok: false, refusal: 'store_not_configured' })
  } finally {
    console.error = original
  }
})

test('§6 · the naming refuses anything that is not an opaque handle or the infra prefix', () => {
  const naming = credentialStore.namingOver(
    'reconcile-staging-data-cred-',
    'alias/reconcile-staging-data-tk-',
  )
  assert.equal(naming.secretNameFor('0123456789abcdef0123456789abcdef'), NAME)
  assert.equal(naming.keyAliasFor('a1b2c3d4e5f60718'), ALIAS)
  for (const bad of ['ten_acme', '../x', '0123456789ABCDEF0123456789ABCDEF', '']) {
    assert.throws(() => naming.secretNameFor(bad))
  }
  assert.throws(() => naming.keyAliasFor('ten_acme'))
  assert.throws(() => credentialStore.namingOver('reconcile-staging-data-cred-ten_acme-', 'alias/reconcile-staging-data-tk-'))
  assert.throws(() => credentialStore.namingOver('reconcile-staging-data-cred-', 'alias/aws/secretsmanager'))
})

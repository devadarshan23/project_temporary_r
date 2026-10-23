/**
 * G2403's RED WITNESS. The data plane serving task may WRITE a source
 * credential and may never read one back; `assertCredentialWriterHoldsNoReadVerb()`
 * must refuse the read, and must refuse it when it arrives as a WILDCARD,
 * because that is how it would actually arrive.
 */
import {
  assertCredentialWriterHoldsNoReadVerb,
} from '../lib/storage-stack.ts'
import { SOURCE_CREDENTIAL_WRITER_FORBIDDEN_ACTIONS } from '../lib/config.ts'

/* 1 · THE POSITIVE CONTROL. The real grant must pass, or case 3 proves nothing. */
assertCredentialWriterHoldsNoReadVerb([
  'secretsmanager:CreateSecret',
  'secretsmanager:PutSecretValue',
])
process.stdout.write('SAFE OK\n')

/* 2 · The forbidden list must not be empty, or case 1 passes vacuously. */
if (SOURCE_CREDENTIAL_WRITER_FORBIDDEN_ACTIONS.length === 0) {
  throw new Error('the forbidden list is empty; the guard asserts nothing')
}

/* 3 · THE RED WITNESS. A wildcard, not a literal. This must THROW. */
assertCredentialWriterHoldsNoReadVerb(['secretsmanager:CreateSecret', 'secretsmanager:Get*'])

process.stdout.write('NOT REACHED\n')

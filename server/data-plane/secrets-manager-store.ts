/**
 * THE SECOND FILE IN THIS REPOSITORY THAT NAMES AN AWS SDK — G2404, and the
 * dependency decision is argued there rather than here. The first is
 * `sqs-run-queue.ts`; `tests/ci/aws-sdk-scope.test.ts` names both and no third.
 *
 * TWO COMMANDS AND NO OTHER, and the absence is the control:
 *
 *   `CreateSecretCommand`    first bind. `KmsKeyId` is ALWAYS set, to the
 *                            tenant's alias — omitting it would encrypt under
 *                            `aws/secretsmanager`, the account's SHARED key,
 *                            and the IAM grant refuses that omission too.
 *   `PutSecretValueCommand`  rotation. Takes no key, so it cannot move one.
 *
 * `GetSecretValueCommand` IS NOT IMPORTED AND MUST NEVER BE. A reviewer
 * meeting it here should read it as the read-back G2403 refuses, not as a
 * convenience; `tests/http/credential-store.test.ts` §3 reads this file's
 * imports and requires exactly these two.
 *
 * ⚠️ NO `Tags`. G260 makes six tags mandatory on every resource, and a secret
 * created by an API call is in no CDK tree, so `RequiredTagsAspect` cannot
 * reach it — the gap G290 closed for keys with `aws:RequestTag` conditions.
 * **It is NOT closed here (G2405, ⛔ not applied)**: the serving role holds no
 * `secretsmanager:TagResource`, deliberately, because a role that can tag can
 * write `TenantId` — G260's forbidden half holds by absence and its required
 * half is unmet.
 */
import {
  CreateSecretCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'
import {
  namingOver,
  type CredentialCustody,
  type CredentialStore,
  type CredentialStoreTarget,
} from './credential-store.ts'

/** The one thing a suite substitutes. Mirrors `sqs-run-queue.ts`'s seam. */
export type CommandDispatch = (command: unknown) => Promise<unknown>

export function storeOver(dispatch: CommandDispatch): CredentialStore {
  return async (write) => {
    try {
      if (write.mode === 'create') {
        await dispatch(
          new CreateSecretCommand({
            Name: write.secretName,
            KmsKeyId: write.keyAlias,
            SecretString: write.value,
          }),
        )
      } else {
        await dispatch(
          new PutSecretValueCommand({
            SecretId: write.secretName,
            SecretString: write.value,
          }),
        )
      }
      return { ok: true }
    } catch (err) {
      /* ⚠️ THE ERROR'S NAME AND NOTHING ELSE. An SDK error carries the request
       * metadata, and a future SDK version that echoed parameters into a
       * message would put the credential in a log line; the name is enough to
       * tell `AccessDeniedException` from `ResourceExistsException`. */
      const name = err instanceof Error ? err.name : 'unknown'
      console.error(
        `data-plane: the credential store refused a ${write.mode} of \`${write.secretName}\` — ` +
          `\`${name}\`. Nothing was recorded as bound.`,
      )
      return { ok: false, refusal: 'store_rejected' }
    }
  }
}

export function secretsManagerCredentialCustody(target: CredentialStoreTarget): CredentialCustody {
  const client = new SecretsManagerClient({
    region: target.region,
    ...(target.endpoint === undefined ? {} : { endpoint: target.endpoint }),
  })
  const dispatch: CommandDispatch = (command) =>
    client.send(command as Parameters<SecretsManagerClient['send']>[0])
  return {
    ...namingOver(target.secretPrefix, target.keyAliasPrefix),
    store: storeOver(dispatch),
  }
}

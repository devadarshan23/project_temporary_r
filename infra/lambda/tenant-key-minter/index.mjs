/**
 * THE TENANT KEY MINTER — G290. The control plane mints a per-tenant KMS key,
 * so onboarding stays a config change rather than becoming a `cdk deploy`.
 *
 * 🛑 READ `infra/lib/storage-stack.ts`'s minter block BEFORE THIS FILE. The
 * argument lives there, with the IAM policy it describes. This file is the
 * three API calls that policy permits and nothing else, and its most important
 * property is what it does NOT do:
 *
 *   ⛔ It never calls `kms:ScheduleKeyDeletion`, and it does not hold it.
 *      G290: *"`ScheduleKeyDeletion` is the dangerous verb, not `CreateKey`."*
 *      The split is argued in the stack; the absence is enforced by IAM, so
 *      this sentence is a description of a fence rather than the fence.
 *   ⛔ It never calls `s3:PutBucketPolicy`, and it does not hold it. **A minted
 *      key is NOT usable until the bucket policy names it** — see the return
 *      value below, which says so rather than implying success.
 *   ⛔ It never holds a cryptographic verb on any key. It creates keys it
 *      cannot read a byte with.
 *   ⛔ It is never told which tenant it is minting for. See `guards.mjs`.
 *
 * ⚠️ THE AWS SDK IS IMPORTED DYNAMICALLY AND THAT IS NOT STYLE. `@aws-sdk/*` is
 * bundled with the `nodejs22.x` runtime and is on disk NOWHERE in this
 * repository — G212's control, `grep -c 'aws-sdk' package.json` -> 0, is
 * discharged for exactly as long as that stays true, and `infra/package.json`
 * does not carry it either. A static import would make this file unloadable by
 * `tests/infra/tenant-key-minter.test.mjs`, which drives `mintTenantKey()`
 * against a recording double and is the only thing that has ever executed this
 * code. The dynamic import is what keeps the testable half testable without
 * putting an SDK in a manifest.
 */

import { randomBytes } from 'node:crypto'

import { MinterRefusal, mintHandle, readConfig, readRequest } from './guards.mjs'

/**
 * Mint one tenant key, or return the one this handle already has.
 *
 * @param {object} deps
 * @param {{send: (command: object) => Promise<object>}} deps.kms  a KMS client
 * @param {(input: object) => object} deps.command                 command factory by name
 * @param {unknown} deps.event
 * @param {Record<string, string | undefined>} deps.env
 * @param {(n: number) => {toString: (enc: string) => string}} [deps.randomBytes]
 */
export async function mintTenantKey({ kms, command, event, env, randomBytes: rng = randomBytes }) {
  const request = readRequest(event)
  const config = readConfig(env)
  const handle = request.handle ?? mintHandle({ randomBytes: rng })
  const aliasName = `${config.aliasPrefix}${handle}`

  /* ---------------------------------------------------------------- idempotency
   *
   * 🛑 BY `DescribeKey` ON THE ALIAS, NOT BY `kms:ListAliases`, AND THE CHOICE
   * IS THE SAME ONE `lib/config.ts` ARGUES FROM THE OTHER SIDE. `ListAliases`
   * is account-wide and takes no resource, so granting it would let this
   * function read every alias belonging to `Internal-CRM`, `Vampire` and
   * Costimize in a SHARED account (G256/G279) — the disclosure this design
   * refuses, pointing outward instead of inward. `DescribeKey` on one alias
   * name asks about one key and is fenced by resource tag.
   *
   * A retry with the same handle is therefore free, which is what makes the
   * caller's retry safe: a key factory whose retry mints a second key produces
   * an orphan nobody is billed for noticing. */
  const existing = await describeIfPresent(kms, command, aliasName)
  if (existing !== undefined) {
    return {
      handle,
      aliasName,
      keyArn: existing,
      created: false,
      bucketPolicyNamesThisKey: false,
      owed: OWED,
    }
  }

  const created = await kms.send(
    command('CreateKey', {
      /* ⚠️ ASCII ONLY, AND NO TENANT ID. Trap 2 of
       * `docs/build/deploy-handoff.md` §3: AWS validates description character
       * sets per service and nothing at synth does. KMS reads a description
       * through `kms:ListKeys` + `kms:DescribeKey`, both account-wide, which is
       * the second reason it carries the handle and nothing else. */
      Description:
        `Object storage key for one tenant, handle ${handle}. G287, minted under G290. ` +
        'The tenant this handle belongs to is recorded in the control-plane ' +
        'catalogue and nowhere in AWS.',
      KeyUsage: 'ENCRYPT_DECRYPT',
      KeySpec: 'SYMMETRIC_DEFAULT',
      Origin: 'AWS_KMS',
      /* 🛑 SINGLE REGION, AND IT IS A RESIDENCY DECISION RATHER THAN A DEFAULT.
       * A multi-region key replicates its key material into another region on a
       * later `ReplicateKey` call, which is ciphertext becoming readable
       * somewhere `model/domain.ts#RegionKey` never placed the tenant. The
       * minter's IAM policy also refuses `kms:MultiRegion: true`, so this line
       * agreeing with it is belt and braces rather than the control. */
      MultiRegion: false,
      /* 🛑 TRUE, AND READ `assertKeyPolicyLeavesAnAdministrator()` IN
       * `infra/lib/storage-stack.ts` BEFORE CONCLUDING ANYTHING FROM THAT.
       *
       * ⚠️ THIS LINE WAS `false`, WITH A COMMENT SAYING `true` WOULD LET THIS
       * FUNCTION CREATE A KEY NOBODY CAN EVER DESTROY, AND IT IS CORRECTED
       * RATHER THAN QUIETLY FLIPPED. The first two invocations of this
       * function against real AWS both failed with
       * `MalformedPolicyDocumentException: The new key policy will not allow
       * you to update the key policy in the future` — because the check asks
       * whether the CALLER could later call `kms:PutKeyPolicy`, and the caller
       * is deliberately not an administrator: a factory that can rewrite a key
       * policy can grant itself `kms:Decrypt` on every tenant key.
       *
       * The key this creates is NOT unmanageable. Its policy grants the account
       * root `kms:PutKeyPolicy`, `kms:ScheduleKeyDeletion` and
       * `kms:CancelKeyDeletion` explicitly, and the synth-time guard named
       * above refuses to build a function carrying a policy that does not. The
       * check was answering a question about the caller; the property it
       * protects is now asserted about the POLICY, which is the thing that
       * actually determines whether a key can be destroyed. */
      BypassPolicyLockoutSafetyCheck: true,
      Policy: config.policy,
      Tags: config.tags,
    }),
  )

  const keyArn = created?.KeyMetadata?.Arn
  const keyId = created?.KeyMetadata?.KeyId
  if (typeof keyArn !== 'string' || typeof keyId !== 'string') {
    throw new MinterRefusal(
      'create_key_returned_no_arn',
      `G290: CreateKey returned ${JSON.stringify(created)}. Refusing to report a ` +
        'handle as minted without the ARN the bucket policy will have to name.',
    )
  }

  /* Rotation is a separate API; `CreateKey` has no parameter for it. G287's
   * argument for rotation is on the CDK-minted key and is unchanged here: it
   * buys nothing for erasure and is what the auditor who asks "prove the data
   * is gone" also asks about. */
  await kms.send(command('EnableKeyRotation', { KeyId: keyId }))

  /* 🛑 LAST, AND THE ORDER IS THE RECOVERY STORY. The alias is what makes the
   * key findable by handle, so creating it last means a crash between calls
   * leaves an ORPHAN KEY rather than an alias pointing at a key with no policy
   * or no rotation. An orphan key is a dollar a month and is visible to
   * `kms:ListKeys`; a half-configured key reachable by handle would be used. */
  await kms.send(command('CreateAlias', { AliasName: aliasName, TargetKeyId: keyId }))

  return { handle, aliasName, keyArn, created: true, bucketPolicyNamesThisKey: false, owed: OWED }
}

/**
 * 🛑 THE RETURN VALUE SAYS THE LOOP IS NOT CLOSED, BECAUSE IT IS NOT.
 *
 * G287's bucket policy denies `s3:PutObject` whose
 * `s3:x-amz-server-side-encryption-aws-kms-key-id` is not one of the minted key
 * ARNs. A key minted by this function is NOT in that list, and `PutObject`
 * under it is denied exactly as if it did not exist. Nothing in this function
 * can change that: `s3:PutBucketPolicy` replaces the WHOLE document — there is
 * no append — so a principal that could add an ARN could also remove the TLS
 * denies and the encryption fence. That grant is refused, and the consequence
 * is reported rather than hidden.
 */
const OWED = [
  'The bucket policy does not name this key: PutObject under it is still DENIED. ' +
    'Updating the bucket policy is a cdk deploy. See infra/lib/storage-stack.ts.',
  'Nothing records the handle-to-tenant join: DataPlanePlacement has no column for it.',
]

async function describeIfPresent(kms, command, aliasName) {
  try {
    const found = await kms.send(command('DescribeKey', { KeyId: aliasName }))
    const arn = found?.KeyMetadata?.Arn
    return typeof arn === 'string' ? arn : undefined
  } catch (error) {
    /* ⚠️ ONLY `NotFoundException` MEANS "mint one". An `AccessDeniedException`
     * here would mean the alias resolves to a key OUTSIDE our tag fence, and
     * swallowing it would make this function mint a second key for a handle
     * somebody else already holds. Rethrown. */
    if (error?.name === 'NotFoundException') return undefined
    throw error
  }
}

/** The Lambda entry point. Wires the real SDK to the testable half above. */
export async function handler(event) {
  const sdk = await import('@aws-sdk/client-kms')
  const kms = new sdk.KMSClient({})
  const command = (name, input) => new sdk[`${name}Command`](input)

  try {
    const result = await mintTenantKey({ kms, command, event, env: process.env })
    for (const line of result.owed) console.warn(`G290 OWED: ${line}`)
    return result
  } catch (error) {
    if (error instanceof MinterRefusal) {
      console.error(`G290 REFUSED (${error.kind}): ${error.message}`)
    }
    throw error
  }
}

/**
 * G287's OBJECT STORAGE — the bucket, the per-tenant key, and the one principal
 * that may use it.
 *
 * 🛑 HALF OF THIS FILE READS A FIXTURE RATHER THAN THE REAL APP, AND THAT IS
 * THE POINT. `TENANT_KEY_HANDLES` is empty because no tenant exists, so the
 * deployed `Storage` stack contains a bucket and ZERO keys. Asserting against
 * the real template alone would witness nothing about the key factory —
 * `docs/HANDOFF.md` §5.6 — while the key factory is the load-bearing half of
 * G287: *"residency and erasure are properties of THE KEY rather than of a
 * delete loop."* So the real app is asserted for what it really deploys, and
 * `infra/test-fixtures/storage-tenant-keys.ts` is asserted for what the factory
 * produces when a tenant arrives.
 *
 * ⚠️ EVERY EXPECTED STRING IS TYPED INTO THIS FILE, none imported from
 * `infra/lib/`. Comparing a stack to the constant the stack read proves only
 * that a variable equals itself — the warning `tests/infra/data.test.mjs` and
 * `tests/infra/tag-aspect.test.mjs` both carry.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ensureDeps, runInfraScript, synthesisedTemplates, resourcesOfType } from './support.mjs'

await ensureDeps()

const STACK = 'reconcile-storage-staging'
const BUCKET = 'AWS::S3::Bucket'
const BUCKET_POLICY = 'AWS::S3::BucketPolicy'
const KEY = 'AWS::KMS::Key'
const ALIAS = 'AWS::KMS::Alias'
const POLICY = 'AWS::IAM::Policy'

/** The data plane's SERVING task role. `Planes` owns it; `Storage` names it. */
const SERVING_TASK_ROLE = 'reconcile-staging-data-service-task'

const realStack = () => {
  const template = synthesisedTemplates()[STACK]
  assert.ok(template, `${STACK} is not in the synthesised app at all`)
  return template
}

let fixtureTemplate
const withTenantKeys = () => {
  if (fixtureTemplate === undefined) {
    const run = runInfraScript('test-fixtures/storage-tenant-keys.ts')
    assert.equal(run.status, 0, `the tenant-key fixture must synthesise; stderr=${run.stderr}`)
    fixtureTemplate = JSON.parse(run.stdout)
  }
  return fixtureTemplate
}

const statements = (template, type, logicalIdMatch) =>
  resourcesOfType(template, type)
    .filter(([logicalId]) => logicalIdMatch === undefined || logicalId.includes(logicalIdMatch))
    .flatMap(([, r]) => r.Properties?.PolicyDocument?.Statement ?? [])

const asList = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v])

// ------------------------------------------------- 1. the bucket, as deployed

test('test_exactly_one_bucket_in_the_whole_app_carries_plane_data_and_it_is_in_the_storage_stack', () => {
  /* ⚠️ THIS ASSERTION WAS WRITTEN AS "exactly one bucket anywhere" AND WENT RED
   * ON A CORRECT TREE, which is worth leaving in the file rather than quietly
   * fixing: `reconcile-pipeline-staging` holds CodePipeline's ARTEFACT bucket,
   * which is `Plane=ci` and has nothing to do with tenant payloads. A count over
   * a CloudFormation TYPE is a rule keyed on a convenient landmark instead of
   * the property it protects — `docs/HANDOFF.md` §5's standing finding, caught
   * by its own control. The property is the PLANE. */
  const dataBuckets = Object.entries(synthesisedTemplates()).flatMap(([name, template]) =>
    resourcesOfType(template, BUCKET)
      .filter(([, r]) => (r.Properties?.Tags ?? []).some((t) => t.Key === 'Plane' && t.Value === 'data'))
      .map(([logicalId]) => `${name}/${logicalId}`),
  )
  assert.equal(
    dataBuckets.length,
    1,
    'G287: ONE bucket per DATA plane. A second one is either the Edge frontend ' +
      `bucket arriving unruled or invariant 3 broken: ${JSON.stringify(dataBuckets)}`,
  )
  assert.match(dataBuckets[0], /^reconcile-storage-staging\//)
  assert.equal(resourcesOfType(realStack(), BUCKET).length, 1)
})

test('test_the_bucket_is_tagged_plane_data_and_carries_no_tenant_tag', () => {
  const [, bucket] = resourcesOfType(realStack(), BUCKET)[0]
  const tags = bucket.Properties?.Tags ?? []
  assert.equal(
    tags.find((t) => t.Key === 'Plane')?.Value,
    'data',
    'G260: Plane is the field invariant 3 is audited from. An object bucket ' +
      'holding tenant payloads is a data-plane resource and a wrong value here ' +
      'returns clean from the audit query, which is worse than no tag.',
  )
  for (const forbidden of ['TenantId', 'Tenant', 'TenantRef']) {
    assert.equal(
      tags.some((t) => t.Key === forbidden),
      false,
      `G260: a per-tenant tag is a tenant enumeration in the clear; found ${forbidden}`,
    )
  }
})

test('test_the_bucket_blocks_all_public_access_and_disables_acls', () => {
  const [, bucket] = resourcesOfType(realStack(), BUCKET)[0]
  assert.deepEqual(bucket.Properties?.PublicAccessBlockConfiguration, {
    BlockPublicAcls: true,
    BlockPublicPolicy: true,
    IgnorePublicAcls: true,
    RestrictPublicBuckets: true,
  })
  const ownership = bucket.Properties?.OwnershipControls?.Rules?.[0]?.ObjectOwnership
  assert.equal(
    ownership,
    'BucketOwnerEnforced',
    'ACLs are a second authorisation system answering beside the bucket policy, ' +
      'and two settings expressing one obligation drift',
  )
})

test('test_versioning_is_enabled_deliberately_and_is_safe_only_because_erasure_is_a_key_operation', () => {
  const [, bucket] = resourcesOfType(realStack(), BUCKET)[0]
  assert.equal(
    bucket.Properties?.VersioningConfiguration?.Status,
    'Enabled',
    'Versioning would DEFEAT the alternative G287 rejected (a delete loop leaves ' +
      'every prior version) and is harmless under the ruling taken, because a ' +
      'version is ciphertext under the same tenant key',
  )
})

test('test_the_only_lifecycle_rule_aborts_incomplete_uploads_and_nothing_expires_an_object', () => {
  const [, bucket] = resourcesOfType(realStack(), BUCKET)[0]
  const rules = bucket.Properties?.LifecycleConfiguration?.Rules ?? []
  assert.equal(rules.length, 1, `exactly one rule is intended; got ${JSON.stringify(rules)}`)
  assert.equal(rules[0]?.AbortIncompleteMultipartUpload?.DaysAfterInitiation, 7)
  /* 🛑 THE NEGATIVE HALF IS THE ONE THAT MATTERS. `docs/data-architecture.md`
   * §10.2: S3 lifecycle rules are GENERATED from `RetentionPolicy`, never
   * configured beside it. The only RetentionPolicy value in the tree is
   * `PLACEHOLDER_RETENTION_POLICY`, whose own comment says the uniform 365 is
   * "not a schedule anybody reasoned about". An expiration here would turn that
   * placeholder into an irreversible delete of counterparty documents. */
  for (const key of ['ExpirationInDays', 'ExpirationDate', 'NoncurrentVersionExpiration']) {
    assert.equal(
      Object.hasOwn(rules[0] ?? {}, key),
      false,
      `${key} is a RETENTION decision and RetentionPolicy has no real value to ` +
        'generate one from (data-architecture 10.2). Do not type a number here.',
    )
  }
})

test('test_the_bucket_is_retained_so_no_stack_operation_deletes_tenant_objects', () => {
  const bucket = Object.entries(realStack().Resources ?? {}).find(
    ([, r]) => r.Type === BUCKET,
  )?.[1]
  assert.equal(bucket?.DeletionPolicy, 'Retain')
  assert.equal(bucket?.UpdateReplacePolicy, 'Retain')
})

test('test_no_custom_resource_exists_to_empty_the_bucket', () => {
  /* `autoDeleteObjects` would create a Lambda whose standing purpose is to
   * delete every version of every tenant object — the weak instrument G287
   * refused, re-created as a convenience for `cdk destroy`. */
  const types = Object.values(realStack().Resources ?? {}).map((r) => r.Type)
  assert.equal(
    types.includes('Custom::S3AutoDeleteObjects'),
    false,
    'a bucket-emptying custom resource is erasure-as-a-delete-loop, which G287 rejected',
  )
  /* ⚠️ THIS ASSERTION READ `types.includes('AWS::Lambda::Function') === false`
   * WITH THE MESSAGE "this stack runs no code", AND G290 ENDED THAT PROPERTY
   * ON 19 Sep 2026. It is corrected rather than deleted, because it is the
   * sentence a reader would have trusted before deciding whether a Lambda here
   * was somebody's mistake.
   *
   * 🛑 THE ORIGINAL ASSERTION WAS A RULE KEYED ON A CONVENIENT LANDMARK — the
   * CloudFormation TYPE — instead of the property it protected, which is
   * `docs/HANDOFF.md` §5's standing finding, and it is what a bucket-emptying
   * Lambda and a key-minting Lambda have in common and nothing else. The
   * property is that NO PRINCIPAL IN THIS STACK MAY DELETE AN OBJECT OR
   * DESTROY A KEY, and it is asserted directly below and in section 6. */
  const functions = resourcesOfType(realStack(), 'AWS::Lambda::Function')
  assert.equal(functions.length, 1, 'exactly one function: G290 is the only code here')
  assert.equal(
    functions[0][1].Properties?.FunctionName,
    'reconcile-staging-tenant-key-minter',
    'the one function in this stack must be the key minter and nothing else',
  )
})

// ------------------------------------------------- 2. TLS and the encryption fence

test('test_the_bucket_policy_denies_plaintext_http_and_tls_below_1_2', () => {
  const denies = statements(realStack(), BUCKET_POLICY).filter((s) => s.Effect === 'Deny')
  const secureTransport = denies.find(
    (s) => s.Condition?.Bool?.['aws:SecureTransport'] === 'false',
  )
  assert.ok(secureTransport, 'no aws:SecureTransport deny; TLS is a runbook note, not a fence')
  const tlsVersion = denies.find((s) =>
    Object.hasOwn(s.Condition?.NumericLessThan ?? {}, 's3:TlsVersion'),
  )
  assert.ok(tlsVersion, 'no s3:TlsVersion deny')
  assert.equal(tlsVersion.Condition.NumericLessThan['s3:TlsVersion'], 1.2)
})

test('test_with_no_tenant_key_the_bucket_denies_putobject_outright_and_that_is_todays_state', () => {
  const deny = statements(realStack(), BUCKET_POLICY).find(
    (s) => s.Sid === 'NoTenantKeyExistsSoNothingMayBeWritten',
  )
  assert.ok(
    deny,
    'G287 mints one key per TENANT and there is no tenant. A bucket that ' +
      'quietly accepted the first upload would put it under a shared key, which ' +
      'is the alternative the ruling refused. Fail closed.',
  )
  assert.equal(deny.Effect, 'Deny')
  assert.deepEqual(asList(deny.Action), ['s3:PutObject'])
  assert.equal(deny.Principal?.AWS, '*')
  assert.equal(
    deny.Condition,
    undefined,
    'an unconditional deny; a condition here would be a door nobody meant to leave open',
  )
})

test('test_with_tenant_keys_the_bucket_denies_any_object_not_under_one_of_them', () => {
  const deny = statements(withTenantKeys(), BUCKET_POLICY).find(
    (s) => s.Sid === 'EveryObjectIsUnderItsOwnTenantKey',
  )
  assert.ok(deny, 'the per-tenant encryption fence is absent once keys exist')
  const permitted = deny.Condition?.StringNotEquals?.['s3:x-amz-server-side-encryption-aws-kms-key-id']
  assert.equal(
    asList(permitted).length,
    2,
    'both minted keys must be named; a fence listing one of two keys denies the other tenant',
  )
  /* ⚠️ THE OPERATOR IS THE ASSERTION. `StringNotEquals` is TRUE when the
   * context key is ABSENT, so one Deny covers "named the wrong key" and "named
   * no key at all" — including a plain PutObject that would otherwise land under
   * the bucket's default aws/s3 key. A StringEquals+Allow would have needed a
   * second statement and been one edit from losing it. */
  assert.equal(deny.Condition?.StringEquals, undefined)
  assert.equal(
    statements(withTenantKeys(), BUCKET_POLICY).some(
      (s) => s.Sid === 'NoTenantKeyExistsSoNothingMayBeWritten',
    ),
    false,
    'the empty-case deny must not survive alongside the populated one',
  )
})

test('test_the_bucket_default_key_is_the_aws_managed_one_so_no_cmk_can_be_mistaken_for_a_tenants', () => {
  const [, bucket] = resourcesOfType(realStack(), BUCKET)[0]
  const rule = bucket.Properties?.BucketEncryption?.ServerSideEncryptionConfiguration?.[0]
  assert.equal(rule?.ServerSideEncryptionByDefault?.SSEAlgorithm, 'aws:kms')
  assert.equal(
    Object.hasOwn(rule?.ServerSideEncryptionByDefault ?? {}, 'KMSMasterKeyID'),
    false,
    'a customer-managed DEFAULT key would be the rejected one-key-per-plane design ' +
      'sitting in the stack looking legitimate',
  )
  assert.equal(rule?.BucketKeyEnabled, true, 'a per-tenant key fleet without a bucket key is a KMS bill')
})

// ------------------------------------------------- 3. the per-tenant key

test('test_the_real_app_mints_no_tenant_key_because_no_tenant_exists', () => {
  assert.equal(
    resourcesOfType(realStack(), KEY).length,
    0,
    'a key minted for a tenant that does not exist is a monthly bill and a ' +
      'claim about onboarding that is not true',
  )
})

test('test_an_alias_never_carries_a_tenant_id_anywhere_in_the_app', () => {
  for (const [stackName, template] of Object.entries({
    ...synthesisedTemplates(),
    'fixture-with-tenant-keys': withTenantKeys(),
  })) {
    for (const [logicalId, alias] of resourcesOfType(template, ALIAS)) {
      const name = alias.Properties?.AliasName
      assert.match(
        String(name),
        /^alias\/reconcile-[a-z]+-data-tk-[0-9a-f]{16}$/,
        `${stackName}/${logicalId}: kms:ListAliases is account-wide and takes no ` +
          'resource, so an alias is world-readable to anyone who can list keys. ' +
          'A tenant id in one is the enumeration G260 refuses through a tag, ' +
          'arriving at an API the Aspect cannot see.',
      )
    }
  }
})

test('test_a_tenant_id_used_as_a_key_handle_fails_synth_and_this_is_the_red_witness', () => {
  const run = runInfraScript('test-fixtures/storage-named-tenant.ts')
  assert.notEqual(
    run.status,
    0,
    'assertOpaqueKeyHandle must THROW on a tenant id; this synth succeeded',
  )
  assert.equal(run.stdout.includes('SYNTH OK'), false, 'the fixture printed its success line')
  const message = `${run.stdout}${run.stderr}`
  assert.match(message, /G287\/G260/)
  assert.match(message, /kms:ListAliases/)
})

test('test_the_key_description_carries_the_handle_and_no_tenant_id_and_is_ascii', () => {
  /* Trap 2 of `docs/build/deploy-handoff.md` §3: AWS validates description
   * character sets per service and `cdk synth` does not. This record's house
   * style uses em-dashes and emoji everywhere else. */
  for (const [logicalId, key] of resourcesOfType(withTenantKeys(), KEY)) {
    const description = String(key.Properties?.Description ?? '')
    assert.match(description, /^[\t\n\r\x20-\x7e]*$/, `${logicalId}: non-ASCII in a description`)
    assert.match(description, /[0-9a-f]{16}/, `${logicalId}: the handle is the identifier`)
    assert.doesNotMatch(description, /ten_/, `${logicalId}: no tenant id in a description`)
  }
})

test('test_the_key_is_retained_and_carries_the_longest_pending_window', () => {
  for (const [logicalId, key] of resourcesOfType(withTenantKeys(), KEY)) {
    assert.equal(key.DeletionPolicy, 'Retain', `${logicalId}: a stack operation must never destroy a tenant key`)
    assert.equal(key.UpdateReplacePolicy, 'Retain')
    assert.equal(
      key.Properties?.PendingWindowInDays,
      30,
      'the pending window is the only undo for a key destroyed by accident, and a ' +
        "key destroyed by accident is one tenant's entire object store",
    )
    assert.equal(key.Properties?.EnableKeyRotation, true)
  }
})

// ---------------------------------- 4. the credential fence, G253's mirror image

test('test_only_the_data_plane_serving_task_role_may_use_a_tenant_key', () => {
  for (const [logicalId, key] of resourcesOfType(withTenantKeys(), KEY)) {
    const all = key.Properties?.KeyPolicy?.Statement ?? []
    const use = all.filter((s) =>
      asList(s.Action).some((a) => /^kms:(Decrypt|GenerateDataKey|Encrypt|ReEncrypt)/.test(a)),
    )
    /* ⚠️ THIS ASSERTED `use.length === 1` UNTIL 1 Oct 2026 AND IS RE-ARGUED
     * RATHER THAN LOOSENED — G2402, under the owner's G2401. The tenant key now
     * encrypts the tenant's SOURCE CREDENTIALS too, through Secrets Manager, and
     * that is a SECOND statement on purpose: it carries `kms:GenerateDataKey`
     * and NOT `kms:Decrypt`, and folding it into the S3 statement would hand
     * Secrets Manager a decrypt on the serving role's behalf — the read-back the
     * ruling refuses. What survives is the property the old count stood for:
     * every cryptographic grant is to the SERVING TASK ROLE, and each is fenced
     * to exactly one service by `kms:ViaService`. */
    assert.equal(use.length, 2, `${logicalId}: exactly two statements may grant cryptographic use — S3 and Secrets Manager`)
    const fencedTo = use
      .map((s) => String(s.Condition?.StringEquals?.['kms:ViaService'] ?? '').split('.')[0])
      .sort()
    assert.deepEqual(fencedTo, ['s3', 'secretsmanager'], `${logicalId}: each use is fenced to one service`)
    for (const s of use) {
      assert.match(JSON.stringify(s.Principal), new RegExp(SERVING_TASK_ROLE))
    }
    /* 🛑 THE ASYMMETRY RUNS THE OPPOSITE WAY FROM G253's SECRET. ECS fetches a
     * task SECRET with the EXECUTION role before the process starts; nobody
     * fetches an OBJECT on the container's behalf, so the key belongs to the
     * task role and the execution role must never hold it. */
    for (const forbidden of [
      'reconcile-staging-data-service-exec',
      'reconcile-staging-data-migrate-task',
      'reconcile-staging-data-migrate-exec',
      'reconcile-staging-control-service-task',
      'reconcile-staging-control-service-exec',
      'reconcile-staging-control-migrate-task',
      'reconcile-staging-control-migrate-exec',
    ]) {
      assert.equal(
        JSON.stringify(all).includes(forbidden),
        false,
        `${logicalId}: ${forbidden} appears in a tenant key policy. The execution ` +
          'role never touches an object; a migration applies DDL; and a ' +
          'control-plane principal holding kms:Decrypt on a tenant key is ' +
          'invariant 3 broken where no security group can see it.',
      )
    }
  }
})

test('test_no_principal_may_reencrypt_because_re_keying_ciphertext_would_defeat_erasure', () => {
  for (const [logicalId, key] of resourcesOfType(withTenantKeys(), KEY)) {
    const actions = (key.Properties?.KeyPolicy?.Statement ?? []).flatMap((s) => asList(s.Action))
    assert.equal(
      actions.some((a) => a.startsWith('kms:ReEncrypt')),
      false,
      `${logicalId}: ReEncrypt moves ciphertext between keys without the caller ` +
        "ever holding plaintext, so a holder can move tenant A's object under " +
        "tenant B's key and destroying A's key then erases nothing. Erasure by " +
        'key destruction is sound only if ciphertext cannot be re-keyed.',
    )
  }
})

test('test_the_account_root_may_administer_the_key_and_may_not_use_it', () => {
  for (const [logicalId, key] of resourcesOfType(withTenantKeys(), KEY)) {
    const root = (key.Properties?.KeyPolicy?.Statement ?? []).find((s) =>
      JSON.stringify(s.Principal).includes(':root'),
    )
    assert.ok(root, `${logicalId}: a key with no administrative statement is unmanageable`)
    const actions = asList(root.Action)
    assert.equal(
      actions.includes('kms:*'),
      false,
      `${logicalId}: the default kms:* to the account root DELEGATES to IAM, so ` +
        'any identity policy in the account granting kms:Decrypt on this key wins ' +
        'over everything written in it. Narrowing root to administration is what ' +
        'makes "a key per tenant" a fence rather than a label.',
    )
    for (const crypto of ['kms:Decrypt', 'kms:Encrypt', 'kms:GenerateDataKey']) {
      assert.equal(actions.includes(crypto), false, `${logicalId}: root holds ${crypto}`)
    }
  }
})

test('test_the_grant_is_fenced_to_s3_so_the_key_is_not_a_general_purpose_decryption_oracle', () => {
  for (const [logicalId, key] of resourcesOfType(withTenantKeys(), KEY)) {
    const use = (key.Properties?.KeyPolicy?.Statement ?? []).find((s) =>
      asList(s.Action).includes('kms:Decrypt'),
    )
    assert.match(
      String(use?.Condition?.StringEquals?.['kms:ViaService']),
      /^s3\./,
      `${logicalId}: without kms:ViaService the serving process can call KMS ` +
        'directly with this key on any ciphertext it is handed',
    )
  }
})

// ------------------------------------------------- 5. the bucket grant

test('test_the_serving_task_role_may_read_and_write_objects_and_may_never_delete_one', () => {
  const grants = statements(realStack(), POLICY, 'DataPlaneServingTaskRole')
  assert.ok(grants.length > 0, 'no identity policy at all; the serving process cannot reach the bucket')
  const actions = grants.flatMap((s) => asList(s.Action))
  for (const expected of ['s3:GetObject', 's3:PutObject', 's3:ListBucket']) {
    assert.ok(actions.includes(expected), `the serving process needs ${expected}`)
  }
  for (const forbidden of ['s3:DeleteObject', 's3:DeleteObjectVersion', 's3:*']) {
    assert.equal(
      actions.some((a) => a === forbidden),
      false,
      `G287 refused erasure as a delete operation in favour of key destruction. ` +
        `${forbidden} puts the refused instrument back in the account, where the ` +
        'first person who needs to remove something will reach for it.',
    )
  }
})

test('test_the_bucket_policy_is_attached_to_the_serving_task_role_and_to_no_other_role', () => {
  /* ⚠️ THIS TEST ASSERTED `policies.length === 1` — "one policy, one role" —
   * UNTIL G290 ON 19 Sep 2026, AND THE COUNT WAS THE WRONG THING TO ASSERT.
   * It is corrected rather than deleted. The property is WHICH role holds the
   * BUCKET grant, and a total over `AWS::IAM::Policy` in the stack went red the
   * moment an unrelated second principal appeared — exactly the class the first
   * test in this file already carries a banner about. There are now three
   * policies and each is asserted by what it grants, below and in section 6. */
  const bucketGrant = resourcesOfType(realStack(), POLICY).filter(([, r]) =>
    JSON.stringify(r.Properties?.PolicyDocument ?? {}).includes('s3:PutObject'),
  )
  assert.equal(bucketGrant.length, 1, 'exactly one policy may grant s3:PutObject on this bucket')
  assert.deepEqual(
    bucketGrant[0][1].Properties?.Roles ?? [],
    [SERVING_TASK_ROLE],
    'the policy must name the serving TASK role by name. A construct reference ' +
      'in this direction plus a key policy naming the same role in the other is a ' +
      'DependencyCycle at synth; a name in both directions is no CloudFormation ' +
      'dependency at all, at the cost of a deploy order nothing enforces.',
  )
})

test('test_no_identity_policy_anywhere_in_this_stack_grants_a_bucket_policy_rewrite', () => {
  /* 🛑 THE PROPERTY THE DELETED "this stack runs no code" ASSERTION WAS
   * REACHING FOR. `s3:PutBucketPolicy` REPLACES the whole document — S3 has no
   * append — so a principal holding it could, in one call, delete the
   * SecureTransport deny, the TLS-version deny and the per-tenant encryption
   * fence. `docs/build/deploy-handoff.md` §6 lists that bucket policy as the
   * mechanism holding G287; this is what stops a future slice from granting the
   * key minter a way to "close the loop". */
  const everything = JSON.stringify(realStack().Resources ?? {})
  for (const forbidden of ['s3:PutBucketPolicy', 's3:DeleteBucketPolicy', 's3:PutBucketAcl']) {
    assert.equal(
      everything.includes(forbidden),
      false,
      `${forbidden} appears in this stack. The bucket policy is the fence; a ` +
        'principal that can rewrite it can delete the fence.',
    )
  }
})

// ------------------------------------- 6. G290, the key minter

test('test_the_minter_may_create_a_key_and_may_never_destroy_use_or_repolicy_one', () => {
  const granted = statements(realStack(), POLICY, 'TenantKeyMinterRole').flatMap((s) =>
    asList(s.Action),
  )
  assert.ok(granted.includes('kms:CreateKey'), 'G290: the minter must be able to mint')

  /* 🛑 G290: "ScheduleKeyDeletion IS THE DANGEROUS VERB, NOT CreateKey ... if
   * the two verbs land in one policy, say so deliberately." They do not. A key
   * destroyed is a tenant's entire object store destroyed and the 7-30 day
   * pending window is the only undo; a spurious CreateKey costs a dollar a
   * month. PutKeyPolicy is worse than either: it would let a factory that
   * cannot read a byte grant itself kms:Decrypt on every tenant key. */
  for (const forbidden of [
    'kms:ScheduleKeyDeletion',
    'kms:DisableKey',
    'kms:DeleteAlias',
    'kms:PutKeyPolicy',
    'kms:CreateGrant',
    'kms:Decrypt',
    'kms:Encrypt',
    'kms:GenerateDataKey',
    'kms:ReEncryptFrom',
    'kms:ReEncryptTo',
  ]) {
    assert.equal(granted.includes(forbidden), false, `the minter holds ${forbidden}`)
  }
  for (const action of granted) {
    assert.doesNotMatch(
      action,
      /^kms:\*|^\*$|^s3:/,
      `${action} is a wildcard or reaches S3; the minter mints keys and does ` +
        'nothing else. A wildcard here covers every verb refused above.',
    )
  }
  assert.equal(
    granted.includes('kms:ListAliases'),
    false,
    'kms:ListAliases is account-wide and takes no resource, so it would read ' +
      "every alias belonging to Internal-CRM, Vampire and Costimize. The " +
      'minter checks one alias with DescribeKey instead.',
  )
})

test('test_creating_a_key_is_fenced_by_tag_by_shape_and_by_two_booleans', () => {
  const create = statements(realStack(), POLICY, 'TenantKeyMinterRole').find((s) =>
    asList(s.Action).includes('kms:CreateKey'),
  )
  assert.ok(create)
  assert.equal(
    create.Resource,
    '*',
    'kms:CreateKey takes no resource - the key does not exist yet - so every ' +
      'fence on it has to be a condition',
  )

  /* 🛑 THE TAG CONDITIONS ARE G260's ONLY ENFORCEMENT OVER A KEY NO TEMPLATE
   * CREATES. RequiredTagsAspect walks a CDK tree; a key born from an API call
   * is in no tree, so neither the six-tag rule nor FORBIDDEN_TAG_KEYS reaches
   * it. aws:TagKeys restricted to exactly six is what makes a TenantId tag an
   * AccessDenied from KMS rather than a code review. */
  const request = create.Condition?.StringEquals ?? {}
  for (const key of ['Project', 'Environment', 'Plane', 'ManagedBy', 'Owner', 'CostCentre']) {
    assert.ok(
      Object.hasOwn(request, `aws:RequestTag/${key}`),
      `a minted key could omit the ${key} tag; the Aspect cannot see this key`,
    )
  }
  assert.deepEqual(
    [...(create.Condition?.['ForAllValues:StringEquals']?.['aws:TagKeys'] ?? [])].sort(),
    ['CostCentre', 'Environment', 'ManagedBy', 'Owner', 'Plane', 'Project'],
    'without an exact aws:TagKeys list a minted key may carry a SEVENTH tag, and ' +
      'the seventh anybody would reach for is TenantId - a tenant enumeration in ' +
      'the clear, which G260 refuses and which no Aspect can refuse here',
  )
  assert.equal(request['kms:KeySpec'], 'SYMMETRIC_DEFAULT')
  assert.equal(request['kms:KeyUsage'], 'ENCRYPT_DECRYPT')
  assert.equal(request['kms:KeyOrigin'], 'AWS_KMS')

  const booleans = create.Condition?.Bool ?? {}
  assert.equal(
    booleans['kms:MultiRegion'],
    'false',
    'a multi-region key can later be REPLICATED into a region RegionKey never ' +
      'names, which is residency leaving by a copy nobody watches',
  )
  /* ⚠️ THIS ASSERTED `'false'`, WITH THE MESSAGE "with true, this principal
   * could mint a key whose policy locks the account root out". IT IS CORRECTED
   * RATHER THAN DELETED, and the correction was made by AWS rather than by a
   * reading: the first three invocations of the deployed function failed with
   * `MalformedPolicyDocumentException: The new key policy will not allow you to
   * update the key policy in the future`, because KMS's lockout check asks
   * whether the CALLER could later call PutKeyPolicy — and this caller is
   * deliberately not an administrator. The property the old message names is
   * real and is now asserted about the POLICY instead, at synth, by
   * `assertKeyPolicyLeavesAnAdministrator()`. */
  assert.equal(
    booleans['kms:BypassPolicyLockoutSafetyCheck'],
    'true',
    'the bypass is PINNED rather than omitted, so the decision is on the face of ' +
      'the IAM policy where an auditor reading the role meets it, and so the ' +
      'function cannot vary it per call',
  )
})

test('test_tagging_is_a_separate_statement_because_tagresource_sees_no_kms_context', () => {
  /* 🛑 A NINTH §3 TRAP, FOUND BY INVOKING THE DEPLOYED FUNCTION AND BY NOTHING
   * ELSE. `CreateKey`'s Tags parameter is authorised as a SECOND action,
   * kms:TagResource, whose request context carries NO kms:* condition keys. One
   * combined statement therefore allowed CreateKey and silently denied
   * TagResource:
   *
   *   AccessDeniedException: ... is not authorized to perform: kms:TagResource
   *   because no identity-based policy allows the kms:TagResource action
   *
   * It passed tsc, cdk synth, npm run check, AND `aws iam
   * simulate-principal-policy` — which was asked about CreateKey and answered
   * about CreateKey. */
  const minter = statements(realStack(), POLICY, 'TenantKeyMinterRole')
  const create = minter.find((s) => asList(s.Action).includes('kms:CreateKey'))
  const tag = minter.find((s) => asList(s.Action).includes('kms:TagResource'))
  assert.ok(tag, 'without kms:TagResource, CreateKey with Tags is AccessDenied')
  assert.notEqual(
    create,
    tag,
    'one statement covering both actions denies TagResource, because a ' +
      'StringEquals on an absent kms:* context key is FALSE',
  )
  assert.deepEqual(asList(tag.Action), ['kms:TagResource'])
  assert.equal(
    tag.Condition?.StringEquals?.['kms:KeySpec'],
    undefined,
    'a kms:* condition on TagResource is a condition that can never be satisfied',
  )
  assert.equal(tag.Condition?.Bool, undefined, 'same, for the two booleans')
  assert.equal(
    tag.Condition?.StringEquals?.['aws:RequestTag/Project'],
    'reconcile',
    'the tag fence must survive the split; it is the only fence TagResource has',
  )
  assert.deepEqual(
    [...(tag.Condition?.['ForAllValues:StringEquals']?.['aws:TagKeys'] ?? [])].sort(),
    ['CostCentre', 'Environment', 'ManagedBy', 'Owner', 'Plane', 'Project'],
  )
})

test('test_the_key_policy_leaves_an_administrator_and_the_guard_is_witnessed_both_ways', () => {
  /* 🛑 KMS NO LONGER CHECKS THIS, BECAUSE THE MINTER BYPASSES THE LOCKOUT
   * SAFETY CHECK — so the check lives at synth now, over the author rather than
   * over the caller. A key with no administrator is unmanageable AND
   * undestroyable, which for a design whose erasure story IS key destruction is
   * a tenant whose data can never be proven gone. */
  const [, key] = resourcesOfType(withTenantKeys(), KEY)[0]
  const rendered = JSON.stringify(key.Properties?.KeyPolicy)
  for (const needed of ['kms:PutKeyPolicy', 'kms:ScheduleKeyDeletion', ':root']) {
    assert.ok(rendered.includes(needed), `the key policy is missing ${needed}`)
  }
  const run = runInfraScript('test-fixtures/storage-key-policy-lockout.ts')
  assert.ok(run.stdout.includes('SAFE OK'), `the real shape must PASS: ${run.stderr}`)
  assert.notEqual(run.status, 0, 'a policy naming only the serving role must THROW')
  assert.equal(run.stdout.includes('NOT REACHED'), false)
  assert.match(`${run.stdout}${run.stderr}`, /leaves no administrator/)
})

test('test_every_verb_over_an_existing_key_is_fenced_by_resource_and_by_tag_and_never_by_tenant', () => {
  const minter = statements(realStack(), POLICY, 'TenantKeyMinterRole')
  const overKeys = minter.find((s) => asList(s.Action).includes('kms:EnableKeyRotation'))
  assert.ok(overKeys)
  assert.match(
    JSON.stringify(overKeys.Resource),
    /:kms:us-west-2:000000000000:key\//,
    'deploy-handoff §0: never touch a resource you did not create. The resource ' +
      'half of that fence is the ARN.',
  )
  assert.deepEqual(overKeys.Condition?.StringEquals, {
    'aws:ResourceTag/Project': 'reconcile',
    'aws:ResourceTag/ManagedBy': 'tenant-key-minter',
  })

  /* 🛑 G260: the fence CANNOT be the tenant. "A per-tenant tag is a tenant
   * enumeration in the clear", and the Aspect throws at synth on one - so there
   * is no TenantId to condition on and there must never be.
   *
   * ⚠️ THIS ASSERTION WAS FIRST WRITTEN AS `JSON.stringify(minter).includes(
   * 'Tenant')` AND WENT RED ON A CORRECT TREE, which is kept here rather than
   * quietly fixed: the construct is CALLED `TenantKeyMinter`, so a substring
   * scan over a policy document flags the function's own logical id. A rule
   * keyed on a convenient landmark instead of the property it protects,
   * `docs/HANDOFF.md` §5, inside the test written to hold §5. The property is
   * the TAG CONDITION KEYS. */
  const tagConditionKeys = statements(realStack(), POLICY, 'TenantKeyMinterRole')
    .flatMap((s) => Object.values(s.Condition ?? {}))
    .flatMap((byOperator) => Object.keys(byOperator ?? {}))
    .filter((key) => key.startsWith('aws:RequestTag/') || key.startsWith('aws:ResourceTag/'))
  assert.ok(tagConditionKeys.length > 0, 'no tag condition at all; this read nothing')
  for (const key of tagConditionKeys) {
    assert.doesNotMatch(
      key,
      /\/Tenant/,
      `${key} conditions on a per-tenant tag. The fence is the product and the ` +
        'minter, never the customer: a tenant tag is a tenant enumeration in the ' +
        'clear, and RequiredTagsAspect cannot even see a key minted by an API call.',
    )
  }

  /* An alias carries no tags, so its half of CreateAlias is fenced by NAME. */
  const overAliases = minter.find(
    (s) => JSON.stringify(s.Resource).includes(':alias/') && s.Condition === undefined,
  )
  assert.ok(overAliases, 'nothing fences which aliases the minter may create')
  assert.match(
    JSON.stringify(overAliases.Resource),
    /:alias\/reconcile-staging-data-tk-\*/,
    'without a prefix fence the minter could name any alias in the account, ' +
      "including one shadowing another product's",
  )
  assert.deepEqual(asList(overAliases.Action), ['kms:CreateAlias'])
})

test('test_the_minter_function_is_named_explicitly_on_arm_and_bounded_to_one_at_a_time', () => {
  const [, fn] = resourcesOfType(realStack(), 'AWS::Lambda::Function')[0]
  const name = fn.Properties?.FunctionName
  /* Trap 6 of deploy-handoff §3: CDK derives a function name from the CONSTRUCT
   * PATH, and one came out at 76 characters against a limit of 64, in a nested
   * stack, minutes into a deploy. */
  assert.equal(typeof name, 'string', 'the function name must not be derived from a construct path')
  assert.ok(name.length <= 64, `${name} is ${name.length} characters; Lambda's limit is 64`)
  assert.deepEqual(fn.Properties?.Architectures, ['arm64'], 'G252 - ARM64 everywhere')
  assert.equal(
    fn.Properties?.ReservedConcurrentExecutions,
    1,
    'G287 accepts a KMS key per tenant as a named cost. A factory that can run a ' +
      'thousand wide turns one retry loop into a thousand keys and a quota ' +
      'exhaustion for every product in a shared account.',
  )
  assert.match(
    String(fn.Properties?.Description ?? ''),
    /^[\t\n\r\x20-\x7e]*$/,
    'trap 2: AWS validates description character sets and cdk synth does not',
  )
})

test('test_the_minter_role_carries_no_managed_policy_and_writes_to_one_log_group', () => {
  const [, role] = resourcesOfType(realStack(), 'AWS::IAM::Role')[0]
  assert.equal(
    (role.Properties?.ManagedPolicyArns ?? []).length,
    0,
    'AWSLambdaBasicExecutionRole grants logs:CreateLogGroup on * and stream ' +
      'writes across every /aws/lambda/* group in a SHARED account',
  )
  const logs = statements(realStack(), POLICY, 'TenantKeyMinterRole').find((s) =>
    asList(s.Action).includes('logs:PutLogEvents'),
  )
  assert.ok(logs)
  assert.equal(
    JSON.stringify(logs.Resource).includes('TenantKeyMinterLogs'),
    true,
    'the log grant must name this function\'s own group',
  )
})

test('test_the_control_plane_holds_invoke_on_one_arn_and_no_kms_verb_at_all', () => {
  /* 🛑 G290's row says the ruling "puts kms:CreateKey AND ScheduleKeyDeletion
   * into a STANDING PRINCIPAL IN A SHARED ACCOUNT". What is built is narrower
   * and this is the assertion that keeps it narrow: the standing principal
   * holds lambda:InvokeFunction on one ARN and nothing else. */
  const [, policy] = resourcesOfType(realStack(), POLICY).find(([, r]) =>
    (r.Properties?.Roles ?? []).includes('reconcile-staging-control-service-task'),
  )
  const control = policy.Properties?.PolicyDocument?.Statement ?? []
  assert.deepEqual(
    [...new Set(control.flatMap((s) => asList(s.Action)))],
    ['lambda:InvokeFunction'],
    'the control plane may ask for a key and may do nothing else here',
  )
  assert.match(JSON.stringify(control), /TenantKeyMinter/)
  assert.equal(
    /"kms:/.test(JSON.stringify(control)),
    false,
    'invariant 3: a control-plane principal holding a kms verb on a tenant key ' +
      'is that invariant broken where no security group can see it',
  )
})

/** Resolve the two CloudFormation intrinsics these templates actually use. */
const resolveCfn = (node) => {
  if (Array.isArray(node)) return node.map(resolveCfn)
  if (node === null || typeof node !== 'object') return node
  const keys = Object.keys(node)
  if (keys.length === 1 && keys[0] === 'Ref' && node.Ref === 'AWS::Partition') return 'aws'
  if (keys.length === 1 && keys[0] === 'Fn::Join') {
    const [sep, parts] = node['Fn::Join']
    return parts.map(resolveCfn).join(sep)
  }
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, resolveCfn(v)]))
}

test('test_a_key_minted_at_onboarding_carries_the_same_policy_as_a_key_minted_by_a_deploy', () => {
  /* 🛑 THE PROPERTY THAT MATTERS MOST ABOUT THE MINTER, AND THE ONE A TOKEN
   * CHECK NEVER ASSERTED. The function does not KNOW what a key policy says: it
   * carries one, rendered by the same `tenantKeyPolicy()` that writes the
   * template's. A second statement of that policy in JavaScript would be two
   * expressions of one obligation drifting in the direction nobody notices —
   * and the obligation is the narrowed root statement, the single cryptographic
   * grant, the withheld kms:ReEncrypt* and the kms:ViaService fence. */
  const [, fn] = resourcesOfType(realStack(), 'AWS::Lambda::Function')[0]
  const carried = fn.Properties?.Environment?.Variables?.RECONCILE_TENANT_KEY_POLICY
  assert.ok(carried, 'the minter carries no key policy; it would have to invent one')
  const carriedPolicy = JSON.parse(resolveCfn(carried))

  const [, key] = resourcesOfType(withTenantKeys(), KEY)[0]
  const templatePolicy = resolveCfn(key.Properties?.KeyPolicy)

  assert.deepEqual(
    carriedPolicy,
    templatePolicy,
    'the policy the minter would send to CreateKey differs from the one this ' +
      'stack writes onto a key. One of the two would then be the real fence and ' +
      'nobody would know which.',
  )
  /* And the fence itself, read off the carried copy rather than assumed. */
  assert.equal(
    JSON.stringify(carriedPolicy).includes('kms:ReEncrypt'),
    false,
    'a minted key that permits ReEncrypt defeats erasure by key destruction',
  )
  assert.match(JSON.stringify(carriedPolicy), new RegExp(SERVING_TASK_ROLE))
})

test('test_the_forbidden_verb_guard_is_witnessed_from_both_sides', () => {
  /* A guard that throws unconditionally passes from one side; a guard that
   * never throws passes from the other. The fixture does the safe list first. */
  const run = runInfraScript('test-fixtures/storage-minter-forbidden-verb.ts')
  assert.ok(
    run.stdout.includes('SAFE OK'),
    `the real grant must PASS the guard; the fixture never got that far: ${run.stderr}`,
  )
  assert.notEqual(run.status, 0, 'a wildcard kms:* must THROW; this synth succeeded')
  assert.equal(run.stdout.includes('NOT REACHED'), false)
  assert.match(`${run.stdout}${run.stderr}`, /G290/)
  assert.match(`${run.stdout}${run.stderr}`, /ScheduleKeyDeletion/)
})

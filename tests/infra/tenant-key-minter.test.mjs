/**
 * G290's LAMBDA, EXECUTED — because a green `cdk synth` says nothing whatever
 * about code inside a zip file.
 *
 * 🛑 WHY THIS SUITE EXISTS AND WHY IT IS THE LOAD-BEARING HALF OF THE SLICE.
 * `tests/infra/storage.test.mjs` reads a synthesised TEMPLATE: it can prove the
 * minter's IAM policy withholds `kms:ScheduleKeyDeletion` and it cannot prove
 * the function refuses a tenant id, mints a random handle, or reports that the
 * bucket policy still does not name the key it just made. **Those are run-time
 * properties and `TENANT_KEY_HANDLES` is empty, so nothing in this repository
 * has ever executed a line of that file** — `docs/HANDOFF.md` §5.6, a control
 * that cannot be witnessed asserts nothing.
 *
 * ⚠️ IT NEEDS NO AWS AND NO SDK ON DISK. `index.mjs` imports `@aws-sdk/client-kms`
 * DYNAMICALLY, inside `handler()` only — the package is bundled with the
 * `nodejs22.x` runtime and is in no manifest here, which is G212's control
 * (`grep -c 'aws-sdk' package.json` -> 0) still holding. So `mintTenantKey()`
 * imports cleanly and is driven below against a recording double.
 *
 * ⚠️ AND IT IS `.mjs` FOR THE REASON `support.mjs` STATES: the gate type-checks
 * `tests/` from the ROOT, where `aws-cdk-lib` is deliberately absent.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { INFRA_DIR } from './support.mjs'

const MINTER_DIR = join(INFRA_DIR, 'lambda', 'tenant-key-minter')

const { mintTenantKey } = await import(join(MINTER_DIR, 'index.mjs'))
const { HANDLE_PATTERN, MinterRefusal, readRequest } = await import(join(MINTER_DIR, 'guards.mjs'))

/** The environment the `Storage` stack really sets. Typed here, not imported. */
const ENV = {
  RECONCILE_KEY_ALIAS_PREFIX: 'alias/reconcile-staging-data-tk-',
  RECONCILE_TENANT_KEY_POLICY: '{"Version":"2012-10-17","Statement":[]}',
  RECONCILE_TENANT_KEY_TAGS: JSON.stringify({
    Project: 'reconcile',
    Environment: 'staging',
    Plane: 'data',
    ManagedBy: 'tenant-key-minter',
    Owner: 'someone@example.com',
    CostCentre: 'ReconcileAI',
  }),
}

/**
 * A KMS double that RECORDS rather than simulates.
 *
 * ⚠️ `describeFound` DEFAULTS TO ABSENT, so the ordinary path is "mint one".
 * A double that answered `DescribeKey` successfully by default would make every
 * test below exercise the idempotent branch and none of them the factory.
 */
function recordingKms({ describeFound = undefined } = {}) {
  const calls = []
  return {
    calls,
    command: (name, input) => ({ name, input }),
    send: async ({ name, input }) => {
      calls.push({ name, input })
      if (name === 'DescribeKey') {
        if (describeFound === undefined) {
          const error = new Error('alias not found')
          error.name = 'NotFoundException'
          throw error
        }
        return { KeyMetadata: { Arn: describeFound, KeyId: describeFound.split('/').pop() } }
      }
      if (name === 'CreateKey') {
        return {
          KeyMetadata: {
            KeyId: '11111111-2222-3333-4444-555555555555',
            Arn: 'arn:aws:kms:us-west-2:000000000000:key/11111111-2222-3333-4444-555555555555',
          },
        }
      }
      return {}
    },
  }
}

const mint = (kms, event, extra = {}) =>
  mintTenantKey({ kms, command: kms.command, event, env: ENV, ...extra })

// --------------------------------- 1. the intake, which is G260 at a third API

test('test_a_tenant_id_offered_as_a_handle_is_refused_and_this_is_the_red_witness', async () => {
  /* The run-time twin of `assertOpaqueKeyHandle()`, which throws at SYNTH over
   * a handle a human typed. This one throws over a handle that arrives in an
   * event, and neither can cover the other: one runs in tsc's world and the
   * other in Lambda's, with a zip file between them. */
  await assert.rejects(
    () => mint(recordingKms(), { handle: 'ten_acme' }),
    (error) => {
      assert.equal(error.name, 'MinterRefusal')
      assert.equal(error.kind, 'handle_not_opaque')
      assert.match(error.message, /kms:ListAliases|guessing forward/)
      return true
    },
  )
})

test('test_an_event_carrying_a_tenant_id_is_refused_rather_than_ignored', async () => {
  /* 🛑 THE FIELD IS REFUSED, NOT DROPPED, AND `server/http/app.ts` ALREADY SAYS
   * WHY ABOUT AJV: under the stripping default "?tenantId=… is silently deleted
   * and the request served - which satisfies invariant 1 and leaves no evidence
   * that it did." An intake that ignores {tenantId: …} ACCEPTS it: the caller
   * believes it was recorded, the invocation log holds it, and nothing says no. */
  for (const event of [
    { tenantId: 'ten_acme' },
    { handle: 'aaaaaaaaaaaaaaaa', tenantRef: 'ten_acme' },
    { handle: 'aaaaaaaaaaaaaaaa', note: 'Acme Corp onboarding' },
  ]) {
    await assert.rejects(
      () => mint(recordingKms(), event),
      (error) => {
        assert.equal(error.kind, 'unknown_event_field')
        return true
      },
      `${JSON.stringify(event)} was accepted`,
    )
  }
})

test('test_a_non_object_event_is_refused', async () => {
  for (const event of [null, 'ten_acme', 42, ['ten_acme']]) {
    await assert.rejects(
      () => mint(recordingKms(), event),
      (error) => error.kind === 'event_not_an_object',
    )
  }
})

test('test_the_handle_grammar_here_is_the_same_string_as_the_one_in_lib_config', () => {
  /* 🛑 THE GRAMMAR IS WRITTEN TWICE AND THIS IS WHAT STOPS THE TWO DRIFTING.
   * `lib/config.ts` is TypeScript compiled by the gate; `guards.mjs` is
   * JavaScript in a zip. Neither can import the other. So the SOURCE TEXT is
   * compared, which is crude and is the only join available. */
  const config = readFileSync(join(INFRA_DIR, 'lib', 'config.ts'), 'utf8')
  const declared = /TENANT_KEY_HANDLE_PATTERN\s*=\s*(\/[^\n]*?\/)\s*$/m.exec(config)
  assert.ok(declared, 'TENANT_KEY_HANDLE_PATTERN is not declared as a literal any more')
  assert.equal(
    declared[1],
    HANDLE_PATTERN.toString(),
    'the synth-time handle grammar and the run-time one have drifted. A handle ' +
      'the Lambda accepts and the CDK refuses (or the reverse) is an alias ' +
      'nobody can reason about.',
  )
})

test('test_readRequest_permits_exactly_one_field_and_it_is_not_the_tenant', () => {
  assert.deepEqual(readRequest({}), { handle: undefined })
  assert.deepEqual(readRequest({ handle: '0123456789abcdef' }), { handle: '0123456789abcdef' })
  assert.throws(() => readRequest({ handle: '0123456789ABCDEF' }), MinterRefusal)
  assert.throws(() => readRequest({ handle: '0123456789abcde' }), MinterRefusal)
})

// --------------------------------- 2. the handle, and what it is made of

test('test_a_minted_handle_is_sixteen_random_hex_characters_and_is_derived_from_nothing', async () => {
  const kms = recordingKms()
  const first = await mint(kms, {})
  const second = await mint(recordingKms(), {})

  assert.match(first.handle, /^[0-9a-f]{16}$/)
  assert.notEqual(
    first.handle,
    second.handle,
    'two mints produced the same handle. A derived handle is recovered by ' +
      'guessing forward: tenant ids are low-entropy slugs.',
  )
  assert.equal(first.aliasName, `alias/reconcile-staging-data-tk-${first.handle}`)
})

test('test_the_handle_comes_from_a_csprng_and_not_from_anything_about_the_caller', async () => {
  /* The double records what the function asked for. Eight bytes, hex. */
  const asked = []
  await mint(recordingKms(), {}, {
    randomBytes: (n) => {
      asked.push(n)
      return { toString: () => 'abcdef0123456789' }
    },
  })
  assert.deepEqual(asked, [8], 'sixteen hex characters is eight bytes')
})

// --------------------------------- 3. what it actually calls, and what it never does

test('test_minting_is_create_then_rotate_then_alias_and_the_order_is_the_recovery_story', async () => {
  const kms = recordingKms()
  const result = await mint(kms, {})
  assert.deepEqual(
    kms.calls.map((c) => c.name),
    ['DescribeKey', 'CreateKey', 'EnableKeyRotation', 'CreateAlias'],
    'the alias is created LAST: a crash between calls must leave an orphan key ' +
      'rather than an alias pointing at a key with no policy and no rotation, ' +
      'because a half-configured key reachable by handle would be used',
  )
  assert.equal(result.created, true)
  assert.match(result.keyArn, /^arn:aws:kms:us-west-2:000000000000:key\//)
})

test('test_the_function_never_calls_a_destroying_or_cryptographic_or_bucket_verb', async () => {
  const kms = recordingKms()
  await mint(kms, {})
  const called = kms.calls.map((c) => c.name)
  for (const forbidden of [
    'ScheduleKeyDeletion',
    'DisableKey',
    'PutKeyPolicy',
    'Decrypt',
    'GenerateDataKey',
    'ReEncrypt',
    'CreateGrant',
    'ListAliases',
    'PutBucketPolicy',
  ]) {
    assert.equal(
      called.includes(forbidden),
      false,
      `the minter called ${forbidden}. G290: ScheduleKeyDeletion is the dangerous ` +
        "verb, not CreateKey; and kms:ListAliases is account-wide and would read " +
        'every alias in a SHARED account.',
    )
  }
  /* The IAM policy refuses all of these too. This is the second half: a
   * function that called one would fail with AccessDenied at run time, which is
   * a worse way to find out than a red test. */
})

test('test_createkey_is_single_region_lockout_checked_and_carries_the_policy_it_was_given', async () => {
  const kms = recordingKms()
  await mint(kms, {})
  const create = kms.calls.find((c) => c.name === 'CreateKey').input

  assert.equal(create.MultiRegion, false, 'a replica is residency leaving by a copy nobody watches')
  /* ⚠️ THIS ASSERTED `false` UNTIL THE FUNCTION WAS INVOKED AGAINST REAL AWS,
   * WHICH FAILED THREE TIMES WITH `MalformedPolicyDocumentException: The new
   * key policy will not allow you to update the key policy in the future`. The
   * check asks whether the CALLER could later call `kms:PutKeyPolicy`, and this
   * caller is deliberately not an administrator: a factory that can rewrite a
   * key policy can grant itself `kms:Decrypt` on every tenant key. The property
   * the old assertion protected — that the key is not unmanageable — is real,
   * and is now asserted about the POLICY at synth by
   * `assertKeyPolicyLeavesAnAdministrator()`, witnessed both ways in
   * `tests/infra/storage.test.mjs`. */
  assert.equal(
    create.BypassPolicyLockoutSafetyCheck,
    true,
    "KMS's lockout check asks about the caller and this design's caller is " +
      'deliberately not an administrator; the check is reinstated over the author',
  )
  assert.equal(create.KeySpec, 'SYMMETRIC_DEFAULT')
  assert.equal(create.KeyUsage, 'ENCRYPT_DECRYPT')
  assert.equal(
    create.Policy,
    ENV.RECONCILE_TENANT_KEY_POLICY,
    'the policy must be the one the Storage stack rendered, byte for byte. A ' +
      'policy assembled here would be a second statement of the fence that makes ' +
      '"a key per tenant" true.',
  )
  assert.deepEqual(
    create.Tags.map((t) => t.TagKey).sort(),
    ['CostCentre', 'Environment', 'ManagedBy', 'Owner', 'Plane', 'Project'],
    'exactly six: the IAM condition refuses a seventh, and the seventh anybody ' +
      'would reach for is TenantId',
  )
})

test('test_the_description_it_sends_is_ascii_and_carries_the_handle_and_no_tenant', async () => {
  const kms = recordingKms()
  const { handle } = await mint(kms, {})
  const description = kms.calls.find((c) => c.name === 'CreateKey').input.Description
  assert.match(description, /^[\t\n\r\x20-\x7e]*$/, 'trap 2: AWS validates description charsets')
  assert.ok(description.includes(handle))
  assert.doesNotMatch(description, /ten_/)
})

// --------------------------------- 4. idempotency, and the honest return value

test('test_the_same_handle_twice_returns_the_existing_key_and_mints_nothing', async () => {
  const arn = 'arn:aws:kms:us-west-2:000000000000:key/99999999-0000-0000-0000-000000000000'
  const kms = recordingKms({ describeFound: arn })
  const result = await mint(kms, { handle: '0123456789abcdef' })
  assert.equal(result.created, false)
  assert.equal(result.keyArn, arn)
  assert.deepEqual(
    kms.calls.map((c) => c.name),
    ['DescribeKey'],
    'a retry that mints a second key produces an orphan nobody is billed for noticing',
  )
})

test('test_an_access_denied_on_the_idempotency_check_is_rethrown_and_never_swallowed', async () => {
  const kms = recordingKms()
  const denied = { ...kms }
  denied.send = async ({ name }) => {
    if (name !== 'DescribeKey') throw new Error('should not be reached')
    const error = new Error('User is not authorized')
    error.name = 'AccessDeniedException'
    throw error
  }
  await assert.rejects(
    () => mintTenantKey({ kms: denied, command: kms.command, event: {}, env: ENV }),
    (error) => {
      assert.equal(error.name, 'AccessDeniedException')
      return true
    },
    'AccessDenied means the alias resolves to a key OUTSIDE our tag fence. ' +
      'Swallowing it would mint a second key for a handle somebody else holds.',
  )
})

test('test_every_success_reports_that_the_bucket_policy_does_not_name_the_new_key', async () => {
  /* 🛑 THE LOOP DOES NOT CLOSE AND THE RETURN VALUE SAYS SO. G287's bucket
   * policy denies PutObject unless the request names one of the ENUMERATED
   * minted key ARNs; a key minted here is not in that enumeration, and the only
   * API that would change it is s3:PutBucketPolicy, which REPLACES the whole
   * document. That grant is refused (see storage.test.mjs), so the honest
   * statement is that G290 makes MINTING a config change and does not make an
   * object WRITABLE. A caller that assumed otherwise would report a tenant as
   * onboarded. */
  for (const kms of [recordingKms(), recordingKms({ describeFound: 'arn:aws:kms:us-west-2:1:key/x' })]) {
    const result = await mint(kms, { handle: '0123456789abcdef' })
    assert.equal(result.bucketPolicyNamesThisKey, false)
    assert.ok(Array.isArray(result.owed) && result.owed.length >= 2)
    assert.match(result.owed.join(' '), /cdk deploy/)
    assert.match(result.owed.join(' '), /DataPlanePlacement has no column/)
  }
})

// --------------------------------- 5. configuration is carried, never invented

test('test_the_function_refuses_to_run_without_the_policy_and_tags_the_stack_gives_it', async () => {
  for (const missing of [
    'RECONCILE_KEY_ALIAS_PREFIX',
    'RECONCILE_TENANT_KEY_POLICY',
    'RECONCILE_TENANT_KEY_TAGS',
  ]) {
    const env = { ...ENV, [missing]: '' }
    const kms = recordingKms()
    await assert.rejects(
      () => mintTenantKey({ kms, command: kms.command, event: {}, env }),
      (error) => {
        assert.equal(error.kind, 'configuration_absent')
        assert.match(error.message, new RegExp(missing))
        return true
      },
      `${missing} absent did not stop the function; it would have invented one`,
    )
    assert.deepEqual(kms.calls, [], 'nothing may be called before the configuration is read')
  }
})

test('test_the_source_in_the_asset_directory_declares_no_aws_sdk_import_at_module_scope', () => {
  /* G212's property, and the reason this suite can run at all: a static import
   * would make the testable half unloadable without an SDK on disk. */
  const index = readFileSync(join(MINTER_DIR, 'index.mjs'), 'utf8')
  assert.doesNotMatch(
    index,
    /^import .*@aws-sdk/m,
    'a top-level SDK import puts the SDK on this suite\'s critical path and would ' +
      'invite somebody to add it to a manifest',
  )
  assert.match(index, /await import\('@aws-sdk\/client-kms'\)/)
})

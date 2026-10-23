/**
 * `Storage` — G287. ONE S3 BUCKET PER DATA PLANE, SSE-KMS, WITH A PER-TENANT
 * KEY.
 *
 * 🛑 THE RULING'S ARGUMENT IS THE DESIGN, NOT A PREAMBLE TO IT. G287:
 *
 *     "a key per TENANT, not per plane, so that RESIDENCY AND ERASURE ARE
 *      PROPERTIES OF THE KEY RATHER THAN OF A DELETE LOOP. Destroying a key is
 *      evidence a regulated customer can be shown; a delete loop is a claim
 *      that it ran."
 *
 * Everything below follows from that sentence, and two things that look like
 * ordinary bucket hygiene are decided by it and by nothing else:
 *
 *   · **Versioning is ON.** Under the REJECTED alternative — one key per plane,
 *     tenants separated by prefix and IAM — versioning would have been a trap:
 *     a delete loop leaves a noncurrent version of every object it "deleted",
 *     so erasure would have reported success over data that is still there.
 *     Under G287 a version is ciphertext under the same tenant key and dies
 *     with it. **The ruling is what makes the safe option safe.**
 *   · **The serving process holds no `s3:DeleteObject`.** Erasure is not
 *     something the data plane does to an object; it is something an operator
 *     does to a key. Granting a delete would put back the weaker instrument
 *     the ruling refused, beside the stronger one.
 *
 * ⚠️ WHAT THIS STACK IS NOT. It is not `Edge`. `docs/tech-stack.md` §10 names
 * `Edge` as *"S3, CloudFront, certificate"* — the FRONTEND BUNDLE, served to
 * the internet. This bucket holds tenant payloads, blocks all public access and
 * is reachable only by one IAM role. G277 blocks `Edge`; it does not block this.
 *
 * ┌─ 🟠 THE ONBOARDING GAP — RULED 19 Sep 2026 (G290), AND HALF CLOSED ────────┐
 * │ ⚠️ THIS BLOCK WAS HEADED "STATED PRECISELY AND NOT FILLED" AND SAID, IN    │
 * │ BOLD, "THAT CHANGE DOES NOT EXIST, AND THE TWO HALVES DO NOT MEET." **ONE  │
 * │ OF ITS THREE OWED QUESTIONS IS NOW ANSWERED BY A RULING AND BUILT BELOW**, │
 * │ and the old text is corrected in place rather than deleted, because it is  │
 * │ the sentence a reader would have quoted onward. Its three questions were:  │
 * │ (1) who mints the handle and where it is recorded; (2) whether the control │
 * │ plane may hold `kms:CreateKey` at all; (3) what HOSTED does, where         │
 * │ `docs/fleet-deployment.md` §3.2 says onboarding is a `Tenant` row and NOT  │
 * │ a plane insert.                                                            │
 * │                                                                            │
 * │ ✅ **QUESTION 2 IS RULED AND APPLIED. G290: the control plane mints it.**  │
 * │ The old text said a Lambda holding `kms:CreateKey` and                     │
 * │ `kms:ScheduleKeyDeletion` in a shared account "is precisely the kind of    │
 * │ thing this record requires a decision for, not an inference." **The        │
 * │ decision was taken and it does not pretend the concern was wrong**, so     │
 * │ `TenantKeyMinter` below holds `kms:CreateKey` and **NOT**                  │
 * │ `kms:ScheduleKeyDeletion`. The split is argued where the policy is built.  │
 * │                                                                            │
 * │ 🛑 **QUESTION 1 IS HALF ANSWERED AND THE UNANSWERED HALF IS THE RECORDING  │
 * │ ONE.** Who mints: the Lambda. Where it is recorded: **nowhere.**           │
 * │ `DataPlanePlacement` still has no column for a key handle, and `db/` and   │
 * │ `model/` are not this slice's. A handle returned to a caller that does not │
 * │ persist it is a key nobody can ever find again except by                   │
 * │ `kms:ListAliases`, which is the account-wide call this whole design        │
 * │ refuses to depend on.                                                      │
 * │                                                                            │
 * │ 🛑 **QUESTION 3 IS UNTOUCHED AND IS STILL THE SHARPEST OF THE THREE.**     │
 * │ G290 makes minting a key an API call rather than a deploy; it does not     │
 * │ make hosted onboarding stop being an AWS operation. §3.2's claim — that a  │
 * │ hosted customer arrives as a `Tenant` row pointing at an existing plane —  │
 * │ is now *"a `Tenant` row, plus one Lambda invocation, plus a `cdk deploy`   │
 * │ of this stack"*, which is a materially different sentence from the one     │
 * │ that page makes. The deploy is question 4, below.                          │
 * │                                                                            │
 * │ 🛑 **AND A FOURTH QUESTION THIS SLICE FOUND RATHER THAN INHERITED: THE     │
 * │ BUCKET POLICY LOOP DOES NOT CLOSE, AND NOTHING HERE PRETENDS IT DOES.**    │
 * │ `refuseAnyObjectNotUnderATenantKey()` denies `PutObject` unless the        │
 * │ request names one of the ENUMERATED minted key ARNs. A key minted by the   │
 * │ Lambda is not in that enumeration, so **a freshly minted key is as         │
 * │ unusable as no key at all until this stack is deployed again.** The only   │
 * │ API that would change it is `s3:PutBucketPolicy`, which REPLACES the whole │
 * │ document — S3 offers no append — so a principal able to add an ARN is a    │
 * │ principal able to delete the TLS denies and the encryption fence in the    │
 * │ same call. **That grant is refused and the honest consequence is stated:   │
 * │ G290 makes minting a key a config change and does NOT make an object       │
 * │ writable under it.** The alternatives were weighed and are preserved as    │
 * │ rejected on `refuseAnyObjectNotUnderATenantKey()` itself.                  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ AND ONE MORE ABSENCE, BECAUSE IT WOULD OTHERWISE READ AS AN OVERSIGHT:
 * there is no S3 GATEWAY VPC ENDPOINT. `infra/lib/network-stack.ts` states in
 * its own header that it creates none, deliberately, and the endpoint belongs
 * to that stack rather than this one. The cost of the absence is exact and is
 * not zero: every byte the data plane writes or reads crosses the single NAT
 * gateway at NAT data-processing rates. A gateway endpoint is free. It is a
 * one-construct change in `Network` and it is not this slice's to take.
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ArnFormat, CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as kms from 'aws-cdk-lib/aws-kms'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import type { Construct } from 'constructs'

import {
  MANAGED_BY_TENANT_KEY_MINTER,
  SOURCE_CREDENTIAL_WRITER_FORBIDDEN_ACTIONS,
  TENANT_KEY_HANDLES,
  TENANT_KEY_HANDLE_PATTERN,
  mintedTenantKeyTags,
  objectBucketName,
  planeRoleName,
  sourceCredentialSecretPrefix,
  tenantKeyAliasName,
  tenantKeyAliasPrefix,
  tenantKeyMinterFunctionName,
  tenantKeyMinterLogGroupName,
  tenantKeyMinterRoleName,
} from './config.ts'
import type { Environment } from './config.ts'
import { applyRequiredTags } from './tagging.ts'

/** Where the minter's source lives. A directory asset: no bundler, no network. */
const MINTER_ASSET_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'lambda',
  'tenant-key-minter',
)

export interface StorageStackProps extends StackProps {
  readonly environment: Environment
  /**
   * The opaque tenant key handles to mint keys for. Defaults to
   * `TENANT_KEY_HANDLES`, which is EMPTY.
   *
   * ⚠️ IT IS A PROP SO THAT A FIXTURE CAN PASS A NON-EMPTY LIST, AND THAT IS
   * NOT A CONVENIENCE — IT IS THE ONLY WAY THIS FACTORY IS EVER WITNESSED.
   * With the real list empty, `cdk synth` renders zero keys and zero key
   * policies, so a green gate would prove nothing whatever about the code
   * below: `docs/HANDOFF.md` §5.6, a control that cannot be witnessed asserts
   * nothing. `infra/test-fixtures/storage-tenant-keys.ts` synthesises this
   * stack with two handles and `tests/infra/storage.test.mjs` reads the key
   * policy out of the result.
   */
  readonly tenantKeyHandles?: readonly string[]
}

/**
 * 🛑 THE HANDLE GUARD. It throws, at synth, on anything that is not sixteen hex
 * characters — which is to say, on a tenant id.
 *
 * `TENANT_KEY_HANDLE_PATTERN` in `lib/config.ts` carries the argument: a KMS
 * alias is readable by anyone holding `kms:ListAliases`, an account-wide call
 * that takes no resource, so putting a tenant id in one publishes the customer
 * list. G260 refuses that disclosure through a TAG and its Aspect cannot see an
 * alias, because an alias is not a tag. This is the same refusal at the API
 * that actually carries the risk here.
 *
 * Witnessed RED: `infra/test-fixtures/storage-named-tenant.ts` passes
 * `ten_acme` and the synth must fail.
 */
export function assertOpaqueKeyHandle(handle: string): void {
  if (TENANT_KEY_HANDLE_PATTERN.test(handle)) return
  throw new Error(
    `G287/G260: '${handle}' is not an opaque tenant key handle. A KMS alias is ` +
      'readable by anyone holding kms:ListAliases - an account-wide call that ' +
      'takes no resource - so a tenant id in an alias is a tenant enumeration in ' +
      'the clear, which is the disclosure G260 refuses through a tag. A handle is ' +
      'sixteen hex characters, minted at random (openssl rand -hex 8) and NEVER ' +
      'derived from the tenant id: tenant ids are low-entropy slugs, so a hash of ' +
      'one is recovered by guessing forward. The handle-to-tenant join lives in ' +
      'the control-plane catalogue, behind a grant.',
  )
}

/**
 * 🛑 THE VERBS THE KEY-MINTING PRINCIPAL MAY NEVER HOLD — G290, and this list
 * is the ruling's sharpest sentence turned into a synth failure.
 *
 * G290: *"`ScheduleKeyDeletion` IS THE DANGEROUS VERB, NOT `CreateKey`. A key
 * destroyed is a tenant's entire object store destroyed, and the pending window
 * (7 to 30 days) is the ONLY undo. Whether the minting principal may also
 * destroy is a narrower question this row does not settle by implication: if
 * the two verbs land in one policy, say so deliberately."*
 *
 * ✅ **THE DECISION TAKEN HERE IS THAT THEY DO NOT.** The minter creates and
 * never destroys, and the argument is four-fold:
 *
 *   1. **The two verbs answer different questions.** G290 asks for onboarding
 *      to stay a config change. Onboarding is creation. Destruction is
 *      ERASURE, and G287 already decided what erasure is: *"a deliberate,
 *      audited `kms:ScheduleKeyDeletion` — where the operator chooses the
 *      window on the call."* A standing principal that can destroy makes the
 *      operator optional, which is the opposite of what that sentence buys.
 *   2. **The failure costs are not comparable.** A spurious `CreateKey` costs
 *      about a dollar a month and a wasted handle, and is visible in
 *      `kms:ListKeys`. A spurious `ScheduleKeyDeletion` destroys one tenant's
 *      entire object store, including every version and every backup, and its
 *      only undo requires a human to NOTICE within the pending window. In a
 *      shared account holding `Internal-CRM`, `Vampire` and Costimize
 *      (G256/G279), a standing principal holding it is one compromise away
 *      from that outcome, and CloudTrail is evidence afterwards rather than a
 *      fence.
 *   3. **This key's own configuration already says so.** The CDK-minted key
 *      takes `RemovalPolicy.RETAIN` and a 30-day window *"because a stack
 *      operation must never destroy a tenant key"*. A Lambda invocation is a
 *      routine infrastructure event of exactly that kind.
 *   4. **Nothing needs it.** There is no offboarding flow in this repository —
 *      `planErasure` is declared and unbuilt — so granting destruction now
 *      would be inventing the flow rather than serving one.
 *
 * ⚠️ **WHAT THE SPLIT COSTS, NAMED RATHER THAN WAVED AT: erasure stays a human
 * AWS operation.** G287's *"prove the data is gone"* is still discharged by an
 * operator with administrative rights making the call by hand. That is
 * unchanged by G290 and it is not closed by this slice.
 *
 * 🛑 `kms:PutKeyPolicy` IS ON THIS LIST AND IS THE ONE A READER WILL WONDER
 * ABOUT. The minter sets a key policy at `CreateKey` and never afterwards. A
 * principal holding `PutKeyPolicy` over a tenant key could rewrite that policy
 * to grant ITSELF `kms:Decrypt` — which converts a factory that cannot read a
 * byte into one that can read every tenant's documents, in one API call, with
 * no change to any IAM policy a reviewer is watching.
 */
export const TENANT_KEY_MINTER_FORBIDDEN_ACTIONS: readonly string[] = [
  'kms:ScheduleKeyDeletion',
  'kms:DeleteAlias',
  'kms:DeleteImportedKeyMaterial',
  'kms:DisableKey',
  'kms:DisableKeyRotation',
  'kms:PutKeyPolicy',
  'kms:Decrypt',
  'kms:Encrypt',
  'kms:GenerateDataKey',
  'kms:ReEncryptFrom',
  'kms:ReEncryptTo',
  'kms:CreateGrant',
  's3:PutBucketPolicy',
  's3:DeleteObject',
  's3:DeleteObjectVersion',
  's3:GetObject',
  'iam:PassRole',
]

/** Does an IAM action pattern (which may end in `*`) cover a literal action? */
const covers = (pattern: string, action: string): boolean =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`, 'i').test(
    action,
  )

/**
 * Throw at synth if the minter's policy grants — or WILDCARDS OVER — any verb
 * above.
 *
 * ⚠️ IT CHECKS BOTH DIRECTIONS AND THAT IS THE WHOLE POINT. A literal
 * `kms:ScheduleKeyDeletion` is the easy case and is not how this would ever
 * arrive: it arrives as `kms:*`, added by somebody widening a grant to make a
 * deploy work. `kms:*` does not equal any string on the list and covers eleven
 * of them.
 *
 * Witnessed RED: `infra/test-fixtures/storage-minter-forbidden-verb.ts` proves
 * the SAFE list passes and then requires the dangerous one to throw — both
 * sides, because a guard that throws unconditionally passes from one side and a
 * guard that never throws passes from the other.
 */
export function assertMinterHoldsNoDangerousVerb(actions: readonly string[]): void {
  const found = actions.filter((granted) =>
    TENANT_KEY_MINTER_FORBIDDEN_ACTIONS.some(
      (forbidden) => covers(granted, forbidden) || covers(forbidden, granted),
    ),
  )
  if (found.length === 0) return
  throw new Error(
    `G290: the tenant key minter may not hold ${JSON.stringify(found)}. ` +
      'ScheduleKeyDeletion is the dangerous verb, not CreateKey: a key destroyed ' +
      "is a tenant's entire object store destroyed, and the 7-30 day pending " +
      'window is the only undo. PutKeyPolicy is worse still - it converts a ' +
      'factory that cannot read a byte into one that can grant itself kms:Decrypt. ' +
      'And s3:PutBucketPolicy REPLACES the whole document, so a principal that ' +
      'could add a key ARN could delete the encryption fence. The argument is on ' +
      'TENANT_KEY_MINTER_FORBIDDEN_ACTIONS; widen the grant only by amending G290.',
  )
}

/**
 * ┌─ ✅ A DEFECT THIS SLICE WROTE, THE CONTROL THAT CAUGHT IT ON ITS FIRST ────┐
 * │ RUN, AND WHY THE CONTROL IS GONE. RECORDED RATHER THAN QUIETLY FIXED.     │
 * │                                                                           │
 * │ The minter carries the tenant key policy as a STRING in an environment    │
 * │ variable (see `tenantKeyPolicy()`). The first version of `keyMinter()`    │
 * │ rendered it with `JSON.stringify(this.resolve(doc.toJSON()))` and shipped │
 * │ an `assertRenderedPolicyIsLiteral()` guard beside it, on the reasoning    │
 * │ that a surviving token would reach KMS as policy TEXT and fail at the     │
 * │ FIRST ONBOARDING rather than at deploy — the worst available moment.      │
 * │                                                                           │
 * │ **THE GUARD WENT RED ON THE FIRST `cdk synth`, ON A REAL DEFECT.**        │
 * │ `iam.AccountRootPrincipal` and `iam.ArnPrincipal` both build their ARNs   │
 * │ from `{"Ref":"AWS::Partition"}`, so `resolve()` returned a document with  │
 * │ two `Fn::Join`s in it and the function would have called `CreateKey` with │
 * │ `{"Ref":"AWS::Partition"}` written out as characters. Every OTHER value   │
 * │ in the policy was already a literal — the account and the region are      │
 * │ literals in `lib/config.ts` — which is exactly the shape that makes this  │
 * │ class survive a reading.                                                  │
 * │                                                                           │
 * │ 🛑 THE FIX IS A PROPERTY, NOT A CHECK, WHICH IS WHY THE GUARD IS DELETED  │
 * │ RATHER THAN SATISFIED. `Stack.toJsonString()` renders the document to a   │
 * │ CloudFormation string expression, so **CloudFormation substitutes the     │
 * │ pseudo-parameters at DEPLOY time and the function receives literal JSON   │
 * │ however many tokens the document contains.** A guard that forbids tokens  │
 * │ would now forbid a thing that cannot hurt, and `docs/HANDOFF.md` §5's     │
 * │ standing finding is that a rule keyed on a convenient landmark instead of │
 * │ the property it protects is the most common defect here.                  │
 * │                                                                           │
 * │ ⚠️ WHAT REPLACES IT IS STRONGER AND LIVES IN THE TESTS:                   │
 * │ `tests/infra/storage.test.mjs` resolves the environment variable and      │
 * │ requires it to equal, statement for statement, the `KeyPolicy` the        │
 * │ template writes onto a CDK-minted key. That is the property that actually │
 * │ matters — **a key minted at onboarding carries the same policy as a key   │
 * │ minted by a deploy** — and no token check ever asserted it.               │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

/**
 * 🛑 G2403 — THE DATA PLANE MAY WRITE A SOURCE CREDENTIAL AND MAY NEVER READ
 * ONE BACK. Throw at synth if its identity policy grants — or WILDCARDS OVER —
 * any verb on `SOURCE_CREDENTIAL_WRITER_FORBIDDEN_ACTIONS`. Same shape as
 * `assertMinterHoldsNoDangerousVerb()` and for its reason: the dangerous grant
 * never arrives as `secretsmanager:GetSecretValue`, it arrives as
 * `secretsmanager:*` added by somebody making a connector work.
 * Witnessed RED by `infra/test-fixtures/storage-credential-read-back.ts`.
 */
export function assertCredentialWriterHoldsNoReadVerb(actions: readonly string[]): void {
  const found = actions.filter((granted) =>
    SOURCE_CREDENTIAL_WRITER_FORBIDDEN_ACTIONS.some(
      (forbidden) => covers(granted, forbidden) || covers(forbidden, granted),
    ),
  )
  if (found.length === 0) return
  throw new Error(
    `G2403: the data plane serving task may not hold ${JSON.stringify(found)} over a ` +
      'source credential. The ruling is that the FDE BINDS a credential, which is a ' +
      'write; the reader of a credential is the connector that pulls a source, and it ' +
      'is not built. Read-back on the serving role puts every customer credential one ' +
      'request-path disclosure away. The argument is on ' +
      'SOURCE_CREDENTIAL_WRITER_FORBIDDEN_ACTIONS; widen it only by amending G2403.',
  )
}

/**
 * ┌─ 🛑 KMS's POLICY-LOCKOUT SAFETY CHECK ASKS ABOUT THE CALLER, AND THIS ─────┐
 * │ DESIGN'S CALLER IS DELIBERATELY NOT AN ADMINISTRATOR. SO THE CHECK IS     │
 * │ BYPASSED AT THE API AND REINSTATED HERE, OVER THE AUTHOR.                 │
 * │                                                                           │
 * │ **What AWS actually does**, established by calling `CreateKey` for real   │
 * │ on 19 Sep 2026 rather than by reading: the check requires *"the key       │
 * │ policy to allow the principal that is making the `CreateKey` request to   │
 * │ make a subsequent `PutKeyPolicy` request"*. Our key policy names the      │
 * │ account root and the data plane's serving task role, and the caller is    │
 * │ neither — the minter holds no `kms:PutKeyPolicy` **on purpose**, because  │
 * │ a factory that can rewrite a key policy can grant itself `kms:Decrypt`    │
 * │ on every tenant key in one call. So the check failed:                     │
 * │                                                                           │
 * │     MalformedPolicyDocumentException: The new key policy will not allow   │
 * │     you to update the key policy in the future.                           │
 * │                                                                           │
 * │ ⚠️ IT DID NOT HELP TO SPELL `kms:PutKeyPolicy` OUT FOR THE ROOT           │
 * │ PRINCIPAL. That was tried first and deployed first, on the theory that    │
 * │ `kms:Put*` was not being expanded; the second invocation failed           │
 * │ identically. **The question the check asks is about the caller, and       │
 * │ nothing written for root can answer it.** The explicit verb is kept       │
 * │ anyway — it is what the guard below reads, and a policy whose only        │
 * │ administrative grant is a wildcard is a policy nobody can check.          │
 * │                                                                           │
 * │ 🛑 **WHY BYPASSING IT IS NOT THE THING THE CHECK EXISTS TO PREVENT.** The │
 * │ danger is a key with NO viable administrator: unmanageable, undestroyable │
 * │ and — for a design whose erasure story IS key destruction — a tenant      │
 * │ whose data can never be proven gone. That is not this key. This key's     │
 * │ policy grants the account root `kms:PutKeyPolicy`, `kms:ScheduleKeyDeletion`│
 * │ and `kms:CancelKeyDeletion` explicitly, so an account administrator can   │
 * │ always administer and always destroy it. **The check failed on the        │
 * │ separation of creator from administrator, which is the property we are    │
 * │ buying, not a mistake we are making.**                                    │
 * │                                                                           │
 * │ ⚠️ **WHAT IS GENUINELY LOST, NAMED: the API will no longer catch a future │
 * │ edit that removes that root statement.** So the check moves to where the  │
 * │ policy is WRITTEN. `assertKeyPolicyLeavesAnAdministrator()` throws at     │
 * │ SYNTH unless the document leaves an explicit administrator, and it runs   │
 * │ over the very string the function will send. Witnessed RED by             │
 * │ `infra/test-fixtures/storage-key-policy-lockout.ts`.                      │
 * │                                                                           │
 * │ ⚠️ AND THE BYPASS IS VISIBLE IN THE IAM POLICY ITSELF — the grant is      │
 * │ conditioned on `kms:BypassPolicyLockoutSafetyCheck` being exactly `true`  │
 * │ — so an auditor reading the role sees the decision without reading this   │
 * │ file, and the function cannot vary it per call.                           │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
export function assertKeyPolicyLeavesAnAdministrator(rendered: string): void {
  const required = ['kms:PutKeyPolicy', 'kms:ScheduleKeyDeletion', ':root']
  const missing = required.filter((needle) => !rendered.includes(needle))
  if (missing.length === 0) return
  throw new Error(
    `G287/G290: this key policy leaves no administrator - it is missing ` +
      `${JSON.stringify(missing)}. The minter creates keys with KMS's policy ` +
      'lockout safety check BYPASSED, because that check asks whether the CALLER ' +
      'could later call PutKeyPolicy and the caller is deliberately not an ' +
      'administrator. The check therefore lives here instead. A key with no ' +
      'administrator is unmanageable AND undestroyable, which in a design whose ' +
      'erasure story is key destruction is a tenant whose data can never be ' +
      'proven gone.',
  )
}

export class StorageStack extends Stack {
  readonly objectBucket: s3.Bucket
  /** The key-minting function. G290 - one verb, one fence, no destruction. */
  readonly tenantKeyMinter: lambda.Function
  /** One per handle. EMPTY on trunk — see the onboarding gap at the head of this file. */
  readonly tenantKeys: readonly kms.Key[]

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props)

    const { environment } = props
    const handles = props.tenantKeyHandles ?? TENANT_KEY_HANDLES

    /* The one principal that may use a tenant key, reached BY NAME. See
     * `planeRoleName()` in `lib/config.ts` for why a name and not a reference,
     * and for what the choice costs at deploy time. */
    const dataServiceTaskRoleArn = this.formatArn({
      service: 'iam',
      region: '',
      resource: 'role',
      resourceName: planeRoleName(environment, 'data', 'service', 'task'),
    })

    this.tenantKeys = handles.map((handle) =>
      this.tenantKey(environment, handle, dataServiceTaskRoleArn),
    )

    this.objectBucket = this.bucket(environment)
    this.refuseAnyObjectNotUnderATenantKey(this.objectBucket, this.tenantKeys)
    const servingRole = this.grantTheServingProcessAndNothingElse(environment, this.objectBucket)
    this.grantTheServingProcessCredentialWritesAndNoRead(environment, servingRole)

    this.tenantKeyMinter = this.keyMinter(environment, dataServiceTaskRoleArn)

    applyRequiredTags(this, environment, 'data')

    this.outputs(environment, handles)
  }

  // -------------------------------------------------------------- the bucket

  private bucket(environment: Environment): s3.Bucket {
    return new s3.Bucket(this, 'ObjectBucket', {
      bucketName: objectBucketName(environment),

      /* Not a default and not a habit: this bucket holds counterparty documents
       * under a residency claim. `BLOCK_ALL` is the only setting compatible
       * with a sentence anybody would sign. */
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,

      /**
       * ACLs off. An ACL is a second, older authorisation system that answers
       * beside the bucket policy, and `docs/HANDOFF.md` §5's standing finding is
       * that two settings expressing one obligation drift — in the direction
       * nobody notices. `BUCKET_OWNER_ENFORCED` makes the bucket policy the only
       * answer.
       */
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,

      /**
       * 🛑 TLS, AS A DENY RATHER THAN AS A DEPLOYMENT NOTE. `enforceSSL` writes
       * a `Deny` on `aws:SecureTransport: false`, and `minimumTLSVersion` a
       * second on `s3:TlsVersion < 1.2`. Both are bucket-policy statements, so
       * they bind every principal including one holding `AdministratorAccess` —
       * which a note in a runbook does not.
       */
      enforceSSL: true,
      minimumTLSVersion: 1.2,

      /**
       * ✅ VERSIONING ON, AND IT IS G287 THAT MAKES THIS THE SAFE CHOICE RATHER
       * THAN THE DANGEROUS ONE.
       *
       * The usual objection to versioning on a tenant-data bucket is that it
       * defeats erasure: a delete leaves a delete MARKER and every prior version
       * survives, so a delete loop reports success over data that is still
       * there. **That objection is an objection to the alternative G287
       * REJECTED** — one key per plane, erasure as a delete operation. Under the
       * ruling, every version of every object is ciphertext under the tenant's
       * key, and destroying the key destroys all of them at once, including the
       * ones nobody enumerated.
       *
       * What it buys: an overwrite or an accidental delete is recoverable, which
       * on a bucket holding counterparty documents is worth more than the
       * storage.
       *
       * ⚠️ WHAT IT COSTS, NAMED: a noncurrent version bills until something
       * expires it, and nothing here does — see the lifecycle block below for
       * why that is deliberate and what would close it.
       */
      versioned: true,

      /**
       * 🛑 THE DEFAULT KEY IS DELIBERATELY ONE THAT MAY NEVER HOLD TENANT DATA,
       * AND THE BUCKET POLICY IS WHAT MAKES THAT TRUE.
       *
       * S3 default encryption names exactly ONE key. G287 wants a key per
       * TENANT, so the tenant key cannot be the default — it has to arrive on
       * each request as `x-amz-server-side-encryption-aws-kms-key-id`. A default
       * is therefore whatever catches a request that does NOT name one, and the
       * whole point is that no such request may succeed.
       *
       * `KMS_MANAGED` is the AWS-managed `aws/s3` key: it costs nothing, it is
       * not a CMK anybody could mistake for a tenant's, and
       * `refuseAnyObjectNotUnderATenantKey()` below makes it UNREACHABLE. A
       * customer-managed plane key here would be the rejected alternative
       * sitting in the stack looking legitimate.
       *
       * ⚠️ IF YOU EVER SEE AN OBJECT UNDER `aws/s3` IN THIS BUCKET, THE BUCKET
       * POLICY HAS BEEN CHANGED. That is the diagnostic this arrangement buys.
       *
       * `bucketKeyEnabled` is not a rounding error at this design's shape: S3
       * otherwise calls KMS once per object, and a per-tenant key fleet turns
       * that into a per-tenant KMS request bill. A bucket key amortises it to
       * roughly one call per key per refresh window.
       */
      encryption: s3.BucketEncryption.KMS_MANAGED,
      bucketKeyEnabled: true,

      /**
       * 🛑 ONE LIFECYCLE RULE, AND THE ABSENCE OF THE OTHER IS THE DELIBERATE
       * PART. READ BOTH HALVES BEFORE ADDING A NUMBER HERE.
       *
       * ✅ WHAT IS SET: incomplete multipart uploads are aborted after seven
       * days. An incomplete upload is not an object — it cannot be read, it is
       * not returned by a list, and it bills forever and invisibly. Aborting it
       * destroys nothing addressable, so it is garbage collection rather than
       * retention.
       *
       * ⛔ WHAT IS NOT SET, AND WHY IT IS NOT AN OVERSIGHT: **no expiration of
       * any kind.** `docs/data-architecture.md` §10.2 rules that "S3 lifecycle
       * rules are generated from `RetentionPolicy`, not configured beside it",
       * and names the drift that matters — "S3 retaining longer than the policy
       * claims — is the one nobody notices."
       *
       * **There is nothing to generate from.** The only `RetentionPolicy` value
       * in the tree is `PLACEHOLDER_RETENTION_POLICY` in `model/examples.ts`,
       * and its own comment says what it is: "ONE VALUE REPEATED THIRTEEN TIMES
       * IS THE POINT ... a plausible spread would read as a schedule somebody
       * reasoned about, and nobody has." Deriving an S3 expiration from that
       * would convert a declared placeholder into an IRREVERSIBLE DELETE of
       * counterparty documents on a schedule counsel has never seen. Typing a
       * different number here instead is §10.2's defect exactly — a second
       * configuration of one obligation.
       *
       * So the bucket retains everything, which is §10.2's named direction of
       * drift, PRESENT FROM DAY ONE AND STATED. **What closes it:** a real
       * `RetentionPolicy` from counsel, then the generator §10.2 asks for plus
       * the drift check that compares deployed rules against it. Neither is
       * this slice's, and neither is invented here.
       */
      lifecycleRules: [
        {
          id: 'AbortIncompleteMultipartUploads',
          enabled: true,
          abortIncompleteMultipartUploadAfter: Duration.days(7),
        },
      ],

      /**
       * 🛑 `RETAIN`, IN STAGING TOO, AND THE CONSEQUENCE IS TRAP 5 FROM
       * `docs/build/deploy-handoff.md` §3 — WHICH IS ACCEPTED, NOT OVERLOOKED.
       *
       * The trap: "A rolled-back stack RETAINS its ECR repository, and the next
       * deploy fails with 'already exists'." **The same is true of this bucket,
       * and more so, because `objectBucketName()` is DETERMINISTIC** — a
       * retained bucket blocks the redeploy by name rather than being orphaned
       * harmlessly. The recovery, in staging, where
       * `docs/build/deploy-handoff.md` §0 authorises deleting what you created:
       *
       *     aws s3 rb s3://<name> --force --region us-west-2
       *
       * Why `RETAIN` anyway, over the two alternatives:
       *
       * ⛔ `DESTROY` alone does nothing useful — CloudFormation cannot delete a
       *    non-empty bucket, so the stack delete FAILS and leaves the bucket,
       *    which is `RETAIN` with a broken stack attached.
       * ⛔ `DESTROY` + `autoDeleteObjects` works, and it works by creating a
       *    Lambda whose standing purpose is to empty the tenant-data bucket, in
       *    a SHARED account (G256/G279), holding `s3:DeleteObject*` on every
       *    version. **That is a principal that can erase a customer's documents
       *    without destroying a key** — the weaker instrument G287 refused,
       *    re-created as a convenience for `cdk destroy`. Refused.
       *
       * The `Data` stack takes `SNAPSHOT` for the same class of reason and says
       * so; there is no snapshot for a bucket, so `RETAIN` is the whole of it.
       */
      removalPolicy: RemovalPolicy.RETAIN,
    })
  }

  /**
   * 🛑 THE STATEMENT THAT MAKES "SSE-KMS WITH A PER-TENANT KEY" A PROPERTY OF
   * THE BUCKET RATHER THAN A PROPERTY OF THE APPLICATION CODE.
   *
   * Without it, "every object is under its tenant's key" is a claim about
   * whether `server/` remembers to send a header — reviewable, unverifiable,
   * and wrong the first time somebody adds a second upload path. With it, a
   * request that names no key, or names the wrong one, is a 403 from S3.
   *
   * ⚠️ THE OPERATOR IS NEGATED ON PURPOSE. `StringNotEquals` evaluates TRUE
   * when the context key is ABSENT, so one `Deny` covers both "named a key that
   * is not a tenant key" and "named no key at all" — including a plain
   * `PutObject` that would otherwise have landed under the default `aws/s3` key
   * described above. A positive `StringEquals` + `Allow` would have needed a
   * second statement for the absent case and would have been one edit away from
   * losing it.
   *
   * 🛑 AND THE EMPTY CASE IS THE ONE TO READ, BECAUSE IT IS TODAY'S CASE. With
   * no tenant key minted, the list of permitted key ARNs is empty, and an empty
   * `StringNotEquals` is not a policy anyone can reason about. So the empty case
   * gets its own statement: **`PutObject` is denied outright.** The bucket
   * exists and cannot receive an object until a tenant key exists. That is
   * fail-closed, it is the same posture G106 takes on an unclassified field, and
   * it is strictly better than a bucket that quietly accepts the first upload
   * under a shared key.
   *
   * ┌─ 🛑 G290 DOES NOT CLOSE THIS LOOP, AND THREE WAYS OF CLOSING IT WERE ────┐
   * │ WEIGHED AND REFUSED. READ THIS BEFORE BUILDING THE FOURTH.               │
   * │                                                                          │
   * │ A key minted by `keyMinter()` is not in the enumeration below, so an     │
   * │ object under it is denied exactly as if the key did not exist. **The     │
   * │ enumeration only changes by `cdk deploy`.**                              │
   * │                                                                          │
   * │ ⛔ **GRANT THE MINTER `s3:PutBucketPolicy`.** Refused, and it is the one  │
   * │    that looks obvious. S3 has no append: `PutBucketPolicy` REPLACES the  │
   * │    whole document. A principal that can add a key ARN can, in the same   │
   * │    call, delete the `aws:SecureTransport` deny, the TLS-version deny and │
   * │    this statement — which is to say it can delete the entire mechanism   │
   * │    `docs/build/deploy-handoff.md` §6 lists as what holds G287. That is a │
   * │    strictly larger grant than the `kms:ScheduleKeyDeletion` G290 spends  │
   * │    a paragraph refusing.                                                 │
   * │ ⛔ **WIDEN THE CONDITION TO A WILDCARD** over                            │
   * │    `arn:aws:kms:<region>:<account>:key/*`. Refused: a KMS key ARN ends   │
   * │    in a random UUID, so the only wildcard that matches every tenant key  │
   * │    matches EVERY CMK IN THE ACCOUNT — `Internal-CRM`'s, `Vampire`'s,     │
   * │    Costimize's (G256/G279). An object written under another product's    │
   * │    key is an object we cannot destroy, which is G287's erasure story     │
   * │    inverted.                                                             │
   * │ ⛔ **CONDITION ON THE KEY'S TAGS INSTEAD OF ITS ARN.** Refused because   │
   * │    it does not exist: a bucket policy condition cannot read the tags of  │
   * │    a KMS key named in a request header. There is no cross-service        │
   * │    resource-tag condition key for this.                                  │
   * │                                                                          │
   * │ ✅ **SO THE HONEST STATEMENT IS THE ONE MADE HERE AND IN THE MINTER'S    │
   * │ OWN RETURN VALUE: G290 makes MINTING a key a config change and does not  │
   * │ make an object WRITABLE under it.** The minter reports                   │
   * │ `bucketPolicyNamesThisKey: false` on every success rather than letting   │
   * │ a caller infer otherwise. What would close it is a ruling on whether     │
   * │ any principal may rewrite this bucket's policy, and that is a bigger     │
   * │ question than the one G290 answered.                                     │
   * └──────────────────────────────────────────────────────────────────────────┘
   */
  private refuseAnyObjectNotUnderATenantKey(
    bucket: s3.Bucket,
    tenantKeys: readonly kms.Key[],
  ): void {
    if (tenantKeys.length === 0) {
      bucket.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: 'NoTenantKeyExistsSoNothingMayBeWritten',
          effect: iam.Effect.DENY,
          principals: [new iam.AnyPrincipal()],
          actions: ['s3:PutObject'],
          resources: [bucket.arnForObjects('*')],
        }),
      )
      return
    }

    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'EveryObjectIsUnderItsOwnTenantKey',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:PutObject'],
        resources: [bucket.arnForObjects('*')],
        conditions: {
          StringNotEquals: {
            's3:x-amz-server-side-encryption-aws-kms-key-id': tenantKeys.map((k) => k.keyArn),
          },
        },
      }),
    )
  }

  // ------------------------------------------------------- one tenant key

  /**
   * One customer-managed key, for one tenant, named by an opaque handle.
   *
   * ┌─ 🛑 WHICH PRINCIPAL MAY USE THIS KEY, AND WHY THE ANSWER IS THE MIRROR ──┐
   * │ IMAGE OF G253's                                                          │
   * │                                                                          │
   * │ G253 and `docs/build/deploy-handoff.md` §6: "An ECS task secret is       │
   * │ fetched by the EXECUTION role, not the task role — a fence over task     │
   * │ roles alone fences the principal that never touches the secret."         │
   * │                                                                          │
   * │ **FOR AN OBJECT, THE ASYMMETRY RUNS THE OTHER WAY, AND COPYING G253's    │
   * │ CONCLUSION INSTEAD OF ITS REASONING WOULD GET IT EXACTLY BACKWARDS.**    │
   * │ ECS fetches a secret on the container's behalf BEFORE the process        │
   * │ starts — that is why the execution role holds it. Nobody fetches an      │
   * │ object on the container's behalf: the serving process calls S3 itself,   │
   * │ with its own credentials, while it runs. So:                             │
   * │                                                                          │
   * │   ✅ `reconcile-<env>-data-service-task`  — the data plane's SERVING      │
   * │      task role. The only principal here. It is the process that reads    │
   * │      and writes documents.                                               │
   * │   ⛔ `...-data-service-exec` — the EXECUTION role. Pulls the image,      │
   * │      writes the log stream, fetches the task secrets. It never touches   │
   * │      an object, and granting it the key would widen the blast radius of  │
   * │      the one principal whose credentials ECS itself uses.                │
   * │   ⛔ `...-data-migrate-task` and `...-data-migrate-exec` — the migrate    │
   * │      run-task. It applies DDL. A migration that needed to decrypt a      │
   * │      tenant's documents would be a migration doing something else.       │
   * │   ⛔ BOTH CONTROL-PLANE ROLES — invariant 3, "the control plane           │
   * │      publishes downward and never reads tenant data." A control-plane    │
   * │      principal holding `kms:Decrypt` on a tenant key is that invariant   │
   * │      broken in the one place no security group can see.                  │
   * └──────────────────────────────────────────────────────────────────────────┘
   *
   * 🛑 THE ROOT STATEMENT IS NARROWED TO ADMINISTRATION, AND WITHOUT THAT THE
   * "PER-TENANT KEY" IS A LABEL RATHER THAN A FENCE. KMS's default key policy
   * grants `kms:*` to the ACCOUNT ROOT, which delegates authorisation to IAM —
   * meaning any principal in the account whose identity policy allows
   * `kms:Decrypt` on this key can use it, whatever the key policy says about
   * tenants. Narrowing root to the ADMINISTRATIVE actions and withholding the
   * cryptographic ones makes the key policy the only door, so the set of
   * principals that can decrypt a tenant's objects is exactly the set written
   * here.
   *
   * ⚠️ WHAT THAT COSTS: an identity policy can no longer grant use of this key,
   * so a future reader (an export job, an analytics task) must be ADDED HERE, in
   * a reviewed pull request, rather than granted sideways. That is the intended
   * cost, and it is the same shape G253 takes on the migrator secret.
   *
   * ⚠️ `kms:ReEncrypt*` IS WITHHELD DELIBERATELY AND IS NOT AN OVERSIGHT.
   * `grantEncryptDecrypt()` would have included it. ReEncrypt moves ciphertext
   * from one key to another WITHOUT the caller ever holding plaintext — so a
   * principal holding it on two tenant keys can move tenant A's object under
   * tenant B's key, and destroying A's key then erases nothing. **Erasure by key
   * destruction is only sound if ciphertext cannot be re-keyed**, which makes
   * this withholding load-bearing rather than tidy.
   *
   * ⚠️ `kms:ViaService` FENCES THE GRANT TO S3. The serving process may use the
   * key through S3 and may not call KMS directly with it — so the key is an
   * object-storage key, not a general-purpose oracle the process can be
   * persuaded to decrypt arbitrary ciphertext with.
   */
  private tenantKey(
    environment: Environment,
    handle: string,
    dataServiceTaskRoleArn: string,
  ): kms.Key {
    assertOpaqueKeyHandle(handle)

    const key = new kms.Key(this, `TenantKey${handle}`, {
      alias: tenantKeyAliasName(environment, handle),

      /**
       * ⚠️ THE DESCRIPTION CARRIES NO TENANT ID EITHER, FOR THE SAME REASON THE
       * ALIAS DOES NOT: `kms:ListKeys` plus `kms:DescribeKey` reads it, and both
       * are account-wide. It also carries no em-dash and no emoji — this
       * record's house style uses both everywhere else, and
       * `docs/build/deploy-handoff.md` §3 trap 2 is that AWS validates
       * description character sets per service and `cdk synth` does not.
       */
      description:
        `Object storage key for one tenant, handle ${handle}. G287. The tenant ` +
        'this handle belongs to is recorded in the control-plane catalogue and ' +
        'nowhere in AWS.',

      /**
       * ⚠️ ROTATION ON, AND THE COST IS REAL AND RECURRING RATHER THAN NOTIONAL.
       * AWS bills each retained rotated key version, so a tenant key's monthly
       * line grows by one unit a year for as long as the tenant exists. It buys
       * nothing for erasure — destroying a key destroys every version of it at
       * once — and it is enabled because the customer this whole design exists
       * for is a regulated one, and the auditor who asks "prove the data is
       * gone" is the same auditor who asks "is the key rotated." Accepted and
       * named, in G287's own idiom.
       */
      enableKeyRotation: true,

      /**
       * 🛑 `RETAIN`, AND A 30-DAY WINDOW, AND THESE TWO ARE THE SAME DECISION
       * SAID TWICE. A KMS key cannot be deleted immediately: AWS enforces a
       * pending window of 7 to 30 days that CANNOT BE SHORTENED once scheduled.
       *
       * The tempting reading is that erasure wants the SHORTEST window, so that
       * "prove the data is gone" completes fastest. It is the wrong reading,
       * because the window is not primarily an erasure parameter — it is the
       * ONLY undo for a key destroyed by accident, and a key destroyed by
       * accident is one tenant's entire object store, unrecoverable, with every
       * backup already useless. Thirty days.
       *
       * And `RETAIN` because **a stack operation must never destroy a tenant
       * key.** `cdk destroy`, a rolled-back update, a renamed construct id: each
       * of those is a routine infrastructure event, and none of them is an
       * erasure decision. Erasure is a deliberate, audited
       * `kms:ScheduleKeyDeletion` — where the operator chooses the window on the
       * call — and it leaves an evidence trail in CloudTrail that a customer can
       * be shown, which is the whole of what G287 bought.
       *
       * ⚠️ THE COST, AND IT IS TRAP 5 AGAIN: a retained key keeps its ALIAS, and
       * an alias is unique per account per region. Redeploying this stack after
       * a rollback fails with `AlreadyExistsException` on the alias until the
       * old one is deleted (`aws kms delete-alias`). The key itself survives and
       * is re-usable, which is the correct direction for this resource.
       */
      pendingWindow: Duration.days(30),
      removalPolicy: RemovalPolicy.RETAIN,

      policy: this.tenantKeyPolicy(dataServiceTaskRoleArn),
    })

    return key
  }

  /**
   * THE KEY POLICY, STATED ONCE — and since G290 it has TWO readers, which is
   * why it is a method rather than a literal inside `tenantKey()`.
   *
   * 🛑 THE SECOND READER IS A LAMBDA, AND IT RECEIVES THIS DOCUMENT RENDERED TO
   * JSON RATHER THAN A COPY OF ITS REASONING. `keyMinter()` below resolves this
   * document and hands the text to the function in an environment variable, so
   * a key minted at onboarding carries BYTE-FOR-BYTE the policy a key minted by
   * `cdk deploy` carries. **Writing it a second time in JavaScript is the exact
   * defect this record spends most of its pages on** — two expressions of one
   * obligation, drifting in the direction nobody notices — and here the
   * obligation is the narrowed root statement, the single cryptographic grant,
   * the withheld `kms:ReEncrypt*` and the `kms:ViaService` fence. All four
   * arguments are on `tenantKey()` above and are not restated.
   *
   * ⚠️ A FRESH DOCUMENT PER CALL. An `iam.PolicyDocument` is mutable and is
   * attached to the construct that receives it; sharing one instance across two
   * keys would make an edit to either an edit to both.
   */
  private tenantKeyPolicy(dataServiceTaskRoleArn: string): iam.PolicyDocument {
    return new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          sid: 'AccountRootMayADMINISTERThisKeyAndMayNotUseIt',
          effect: iam.Effect.ALLOW,
          principals: [new iam.AccountRootPrincipal()],
          actions: [
            /**
             * 🛑 `kms:PutKeyPolicy` IS SPELLED OUT, AND THE WILDCARD ABOVE IT
             * IS NOT ENOUGH. FOUND BY CALLING `CreateKey` FOR REAL, 19 Sep
             * 2026, AND IT IS A DEFECT IN THE POLICY G287 SHIPPED RATHER THAN
             * ONE G290 INTRODUCED.
             *
             * KMS's policy-lockout safety check requires the new key policy to
             * leave `kms:PutKeyPolicy` reachable, and it does **not** satisfy
             * itself from `kms:Put*`. With the wildcard alone, `CreateKey`
             * fails:
             *
             *     MalformedPolicyDocumentException: The new key policy will
             *     not allow you to update the key policy in the future.
             *
             * ⚠️ **AND NOTHING HAD EVER NOTICED, BECAUSE NOTHING HAD EVER
             * CREATED ONE OF THESE KEYS.** `TENANT_KEY_HANDLES` is empty, so
             * the "key factory written and witnessed" of G287's row was
             * witnessed by TEMPLATE ASSERTIONS ONLY — `tests/infra/storage.
             * test.mjs` reads a synthesised `KeyPolicy` and a synthesised
             * policy is not a policy KMS has accepted. **The first real tenant
             * key, by whatever route, would have failed here.** That is
             * `docs/HANDOFF.md` §5.6 with the control passing: a fixture proved
             * the shape and only the API could prove the content.
             *
             * The narrowing is untouched: this is an ADMINISTRATIVE verb, it is
             * already inside `kms:Put*` in intent, and root still holds no
             * cryptographic action.
             */
            'kms:PutKeyPolicy',
            'kms:Create*',
            'kms:Describe*',
            'kms:Enable*',
            'kms:List*',
            'kms:Put*',
            'kms:Update*',
            'kms:Revoke*',
            'kms:Disable*',
            'kms:Get*',
            'kms:Delete*',
            'kms:TagResource',
            'kms:UntagResource',
            'kms:ScheduleKeyDeletion',
            'kms:CancelKeyDeletion',
          ],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'TheDataPlaneServingTaskMayUseThisKeyThroughS3Only',
          effect: iam.Effect.ALLOW,
          principals: [new iam.ArnPrincipal(dataServiceTaskRoleArn)],
          actions: ['kms:Decrypt', 'kms:GenerateDataKey', 'kms:DescribeKey'],
          resources: ['*'],
          conditions: {
            StringEquals: { 'kms:ViaService': `s3.${this.region}.amazonaws.com` },
          },
        }),
        /**
         * 🛑 G2402 — THE TENANT KEY ENCRYPTS THE TENANT'S SOURCE CREDENTIALS,
         * AND THE SERVING PROCESS MAY ENCRYPT UNDER IT AND MAY NOT DECRYPT.
         *
         * Secrets Manager envelope-encrypts: `CreateSecret` and
         * `PutSecretValue` call `kms:GenerateDataKey` AS THE CALLER, and
         * `GetSecretValue` calls `kms:Decrypt`. So the write half needs exactly
         * one cryptographic verb and the read half needs the one withheld
         * here. **This is the second, independent control under the IAM one:
         * a serving role somebody granted `GetSecretValue` by accident still
         * cannot read a credential, because the key refuses the decrypt.**
         *
         * ⚠️ FROM AWS's DOCUMENTATION AND NOT MEASURED AGAINST THE API — no
         * tenant key exists in any account (`TENANT_KEY_HANDLES` is empty) and
         * G290's own row records that a synthesised key policy is not a
         * policy KMS has accepted. **The first real `CreateSecret` under a
         * tenant key is where this statement is proven or found short**, and
         * the failure would be loud (`AccessDeniedException` from KMS through
         * Secrets Manager), never a silent read.
         *
         * A SEPARATE STATEMENT AND NOT A SECOND `ViaService` VALUE ON THE ONE
         * ABOVE, because the two grants carry DIFFERENT verbs: folding them
         * would hand Secrets Manager `kms:Decrypt` on the caller's behalf —
         * the read-back this ruling refuses.
         */
        new iam.PolicyStatement({
          sid: 'TheDataPlaneServingTaskMayEncryptCredentialsThroughSecretsManagerOnly',
          effect: iam.Effect.ALLOW,
          principals: [new iam.ArnPrincipal(dataServiceTaskRoleArn)],
          actions: ['kms:GenerateDataKey', 'kms:DescribeKey'],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'kms:ViaService': `secretsmanager.${this.region}.amazonaws.com`,
            },
          },
        }),
      ],
    })
  }

  // ------------------------------------------- the key minter (G290)

  /**
   * ┌─ G290 — A CONTROL-PLANE LAMBDA MINTS THE PER-TENANT KEY ─────────────────┐
   * │ *"so onboarding stays a config change."* `docs/fleet-deployment.md` §5   │
   * │ makes a config change a ROW INSERT; minting a key was a `cdk deploy`;    │
   * │ **nothing joined the halves.** This is the join.                         │
   * └──────────────────────────────────────────────────────────────────────────┘
   *
   * 🛑 THE COST G290 ACCEPTS IS NARROWER HERE THAN THE ROW ASSUMES, AND THE
   * DIFFERENCE IS WORTH READING BEFORE ANYTHING ELSE. The row says the ruling
   * *"puts `kms:CreateKey` AND `ScheduleKeyDeletion` into a STANDING PRINCIPAL
   * IN A SHARED ACCOUNT"*. What is built is not that:
   *
   *   · `kms:CreateKey` lives in a **single-purpose function role** that can do
   *     nothing else — no cryptographic verb, no destruction, no
   *     `PutKeyPolicy`, no S3 at all. See
   *     `TENANT_KEY_MINTER_FORBIDDEN_ACTIONS`, which fails SYNTH rather than
   *     review.
   *   · The **standing principal** — the control plane's serving task role —
   *     holds exactly one thing: `lambda:InvokeFunction` on ONE function ARN.
   *     It holds no `kms:*` whatever.
   *   · `kms:ScheduleKeyDeletion` is in **neither**, deliberately.
   *
   * That is still a standing capability in a shared account and G290's concern
   * is not dismissed by narrowing it. It is narrowed.
   *
   * ⚠️ WHY THE CONTROL PLANE MAY HOLD THIS WITHOUT BREAKING INVARIANT 3.
   * *"The control plane publishes downward and never reads tenant data."*
   * Invoking this function is publishing downward: the call carries an opaque
   * handle, the reply carries a handle and a key ARN, and neither is tenant
   * data. **The control plane gains no ability to read an object** — the key
   * policy this stack writes names the data plane's serving task role and
   * nobody else, and `tests/infra/storage.test.mjs` refuses any control-plane
   * role appearing in a tenant key policy at all.
   *
   * ⚠️ THE FUNCTION IS TAGGED `Plane=data`, WITH THE REST OF THIS STACK, AND
   * THAT IS AN ARGUMENT RATHER THAN AN INHERITANCE. The `Plane` tag answers
   * *"whose resource is this"* and G260 says invariant 3 is audited from it.
   * The artefact this function produces is a DATA-plane key that lives beside
   * the DATA-plane bucket; the control plane is its CALLER, not its owner. A
   * `Plane=control` resource inside a `Plane=data` stack would also put two
   * planes in one stack, which is the thing the tag exists to let an auditor
   * detect.
   *
   * ⚠️ NO VPC, DELIBERATELY. The function talks to KMS and to nothing else, and
   * placing it in the `Network` stack's VPC would buy a construct reference in
   * a direction `lib/app.ts` argues at length must stay a name — plus ENIs and
   * NAT data-processing for a call that never touches a private resource.
   *
   * ⚠️ AND ONE PROPERTY OF THIS REPOSITORY THAT THIS SLICE ENDS:
   * `infra/README.md` said *"No asset is staged"*. This function is a DIRECTORY
   * asset — two `.mjs` files, no bundler, no Docker, no network at synth — so
   * `cdk synth` stays deterministic and offline, and `cdk deploy` now uploads a
   * zip to the `CDKToolkit-reconcile` bootstrap bucket, which exists. The
   * README is corrected rather than left standing.
   */
  private keyMinter(environment: Environment, dataServiceTaskRoleArn: string): lambda.Function {
    const functionName = tenantKeyMinterFunctionName(environment)
    const aliasPrefix = tenantKeyAliasPrefix(environment)
    const tags = mintedTenantKeyTags(environment)

    const logGroup = new logs.LogGroup(this, 'TenantKeyMinterLogs', {
      logGroupName: tenantKeyMinterLogGroupName(environment),
      retention: logs.RetentionDays.ONE_YEAR,
      /* ⚠️ TRAP 5 AGAIN (`docs/build/deploy-handoff.md` §3): a retained log
       * group blocks a redeploy by name after a rollback
       * (`aws logs delete-log-group --log-group-name <name>`). Accepted: this
       * log is the only local record that a key was ever minted, and
       * `DataPlanePlacement` has no column for the handle, so deleting it on a
       * stack operation would destroy the only trail to an orphan key. */
      removalPolicy: RemovalPolicy.RETAIN,
    })

    const role = new iam.Role(this, 'TenantKeyMinterRole', {
      roleName: tenantKeyMinterRoleName(environment),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      /* ⚠️ ASCII ONLY. Trap 2: IAM rejects anything outside \t\n\r, 0x20-0x7E,
       * 0xA1-0xFF, so an em-dash here fails in CloudFormation, minutes in. */
      description:
        'G290 - mints one per-tenant KMS key. It may create a key and may NOT ' +
        'destroy one, use one, or rewrite a key policy.',
      /* 🛑 NO MANAGED POLICY. `AWSLambdaBasicExecutionRole` grants
       * logs:CreateLogGroup on * and stream writes across every
       * /aws/lambda/* group in a SHARED account. The three statements below are
       * the same capability over ONE log group. */
    })

    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'WriteOwnLogStreamAndNoOther',
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [logGroup.logGroupArn, `${logGroup.logGroupArn}:*`],
      }),
    )

    /**
     * 🛑 `kms:CreateKey` TAKES NO RESOURCE — THE KEY DOES NOT EXIST YET — SO
     * `Resource: *` IS NOT LAZINESS, IT IS THE API. Everything that makes this
     * a fence is therefore a CONDITION, and there are three kinds:
     *
     *   1 · **THE TAG FENCE, WHICH IS ALSO G260's ONLY ENFORCEMENT OVER A KEY
     *       NO TEMPLATE CREATES.** `RequiredTagsAspect` walks a CDK tree; a key
     *       born from an API call is in no tree, so neither the six-tag rule
     *       nor `FORBIDDEN_TAG_KEYS` reaches it. Requiring each of the six as
     *       an `aws:RequestTag` makes the six mandatory at the API, and
     *       `ForAllValues:StringEquals aws:TagKeys` restricted to exactly those
     *       six makes a SEVENTH tag an `AccessDenied` — **which is what stops a
     *       minted key from ever carrying `TenantId`.** That is G260 held by
     *       IAM where its own Aspect is blind, and it is the same move
     *       `assertOpaqueKeyHandle()` makes for the alias.
     *   2 · **THE SHAPE FENCE.** `SYMMETRIC_DEFAULT` / `ENCRYPT_DECRYPT` /
     *       `AWS_KMS`: this principal cannot mint an asymmetric key, a signing
     *       key, or a key backed by external material that AWS cannot rotate.
     *   3 · **THE TWO BOOLEANS, AND THEY ARE THE ONES TO READ.**
     *       `kms:MultiRegion: false` — a multi-region key can later be
     *       REPLICATED into a region `model/domain.ts#RegionKey` never named,
     *       which is residency leaving by a copy nobody watches.
     *       `kms:BypassPolicyLockoutSafetyCheck: false` — with `true` this
     *       principal could mint a key whose policy locks the account root
     *       out, producing a key **nobody can ever destroy**, i.e. a tenant
     *       whose data can never be proven gone. For a design whose entire
     *       erasure story is key destruction, that is the worst single
     *       outcome available here.
     */
    /** The six tags, as `aws:RequestTag/<key>` conditions. Both halves use them. */
    const requestTagConditions = Object.fromEntries(
      Object.entries(tags).map(([key, value]) => [`aws:RequestTag/${key}`, value]),
    )

    const createKey = new iam.PolicyStatement({
      sid: 'MintOneSymmetricSingleRegionKeyCarryingExactlyOurSixTags',
      actions: ['kms:CreateKey'],
      resources: ['*'],
      conditions: {
        StringEquals: {
          ...requestTagConditions,
          'kms:KeySpec': 'SYMMETRIC_DEFAULT',
          'kms:KeyUsage': 'ENCRYPT_DECRYPT',
          'kms:KeyOrigin': 'AWS_KMS',
        },
        'ForAllValues:StringEquals': { 'aws:TagKeys': Object.keys(tags) },
        Bool: {
          'kms:MultiRegion': 'false',
          /* 🛑 `true`, AND PINNED RATHER THAN OMITTED. See
           * `assertKeyPolicyLeavesAnAdministrator()` above for why the check
           * is bypassed and where it went instead. Pinning it puts the
           * decision on the face of the IAM policy, where an auditor reading
           * the role meets it, and takes the choice away from the function. */
          'kms:BypassPolicyLockoutSafetyCheck': 'true',
        },
      },
    })

    /**
     * ┌─ 🛑 A NINTH FAILURE FOR `docs/build/deploy-handoff.md` §3, FOUND BY ─────┐
     * │ INVOKING THE DEPLOYED FUNCTION AND BY NOTHING ELSE.                     │
     * │                                                                          │
     * │ `CreateKey`'s `Tags` parameter is authorised as a SECOND ACTION,         │
     * │ `kms:TagResource`, and **the request context of that second check does   │
     * │ NOT carry the `kms:*` condition keys** — no `kms:KeySpec`, no            │
     * │ `kms:KeyUsage`, no `kms:KeyOrigin`, no `kms:MultiRegion`, no             │
     * │ `kms:BypassPolicyLockoutSafetyCheck`. A `StringEquals` on an absent      │
     * │ context key is FALSE, so one combined statement covering both actions    │
     * │ allows `CreateKey` and silently denies `TagResource`, and the API error  │
     * │ names only the action a reader was not thinking about:                   │
     * │                                                                          │
     * │   AccessDeniedException: ... is not authorized to perform:               │
     * │   kms:TagResource because no identity-based policy allows the            │
     * │   kms:TagResource action                                                 │
     * │                                                                          │
     * │ 🛑 **AND `aws iam simulate-principal-policy` SAID `allowed`.** It was    │
     * │ asked about `kms:CreateKey` and answered about `kms:CreateKey`; the      │
     * │ second authorisation is invisible unless you know to ask for it by name. │
     * │ So this passed `tsc`, passed `cdk synth`, passed `npm run check`, passed │
     * │ a policy simulation against the real account, deployed cleanly — and     │
     * │ failed on the first invocation. That is the whole shape of §3.           │
     * │                                                                          │
     * │ The split is therefore load-bearing: the tag fence and ONLY the tag      │
     * │ fence on `TagResource`, because those are the only condition keys its    │
     * │ context has.                                                             │
     * └──────────────────────────────────────────────────────────────────────────┘
     */
    const tagTheKeyItCreates = new iam.PolicyStatement({
      sid: 'TagOnlyWithExactlyOurSixKeysBecauseTagResourceSeesNoKmsContext',
      actions: ['kms:TagResource'],
      resources: ['*'],
      conditions: {
        StringEquals: requestTagConditions,
        'ForAllValues:StringEquals': { 'aws:TagKeys': Object.keys(tags) },
      },
    })

    /**
     * 🛑 EVERY VERB OVER AN EXISTING KEY IS FENCED BY RESOURCE **AND** BY TAG,
     * WHICH IS `docs/build/deploy-handoff.md` §0 WRITTEN AS A POLICY:
     * *"Never touch a resource you did not create. Your fence is the tag
     * `Project=reconcile` ... anything without both is somebody else's."*
     * `ManagedBy` is required too, so the fence is narrower than the project:
     * this principal cannot reach the keys the `Data` stack's Aurora clusters
     * use, which carry `ManagedBy=cdk`.
     *
     * ⚠️ **AND G260 IS WHY THE FENCE CANNOT BE THE TENANT.** *"A per-tenant tag
     * is a tenant enumeration in the clear"*, and the Aspect throws at synth on
     * one — so there is no `TenantId` to condition on and there must never be.
     * The fence is therefore the PRODUCT and the MINTER, never the customer.
     *
     * ⚠️ ONE RESIDUAL, STATED RATHER THAN DISCOVERED LATER. `kms:TagResource`
     * is unavoidably on `*`, because `CreateKey`'s `Tags` parameter is
     * authorised there, before any key exists to fence on. So this principal could apply our six tags to a key it
     * did not create, and thereby bring that key inside the fence below. What
     * it could then do to it is the whole of the exposure: enable rotation,
     * describe it, and give it an alias under our own prefix. It holds no
     * cryptographic verb, no `PutKeyPolicy` and no destruction, on any key, at
     * any time. The exposure is metadata on somebody else's key, and it is
     * named here rather than argued away.
     */
    const administerOurOwnKeys = new iam.PolicyStatement({
      sid: 'ReachOnlyKeysThisMinterItselfTagged',
      actions: ['kms:DescribeKey', 'kms:EnableKeyRotation', 'kms:CreateAlias'],
      resources: [this.formatArn({ service: 'kms', resource: 'key', resourceName: '*' })],
      conditions: {
        StringEquals: {
          'aws:ResourceTag/Project': tags.Project,
          'aws:ResourceTag/ManagedBy': MANAGED_BY_TENANT_KEY_MINTER,
        },
      },
    })

    /**
     * The alias half of `CreateAlias`, which KMS authorises against the ALIAS
     * as well as the key.
     *
     * 🛑 AN ALIAS CARRIES NO TAGS, SO THE FENCE HAS TO BE THE NAME, and the
     * name is the one `tenantKeyAliasPrefix()` exists for. Without this
     * statement the grant above would let this principal name any alias it
     * liked in the account, including one shadowing another product's.
     */
    const aliasUnderOurPrefix = new iam.PolicyStatement({
      sid: 'CreateAliasesOnlyUnderTheTenantKeyPrefix',
      actions: ['kms:CreateAlias'],
      resources: [
        this.formatArn({
          service: 'kms',
          resource: 'alias',
          resourceName: `${aliasPrefix.replace(/^alias\//, '')}*`,
        }),
      ],
    })

    /* 🛑 THE GUARD RUNS OVER THE ASSEMBLED LIST, BEFORE ANY OF IT REACHES A
     * TEMPLATE. Witnessed RED by
     * `infra/test-fixtures/storage-minter-forbidden-verb.ts`. */
    assertMinterHoldsNoDangerousVerb([
      ...createKey.actions,
      ...tagTheKeyItCreates.actions,
      ...administerOurOwnKeys.actions,
      ...aliasUnderOurPrefix.actions,
      'logs:CreateLogStream',
      'logs:PutLogEvents',
    ])

    role.addToPolicy(createKey)
    role.addToPolicy(tagTheKeyItCreates)
    role.addToPolicy(administerOurOwnKeys)
    role.addToPolicy(aliasUnderOurPrefix)

    /* The key policy, rendered once, carried as data. See `tenantKeyPolicy()`
     * for why the Lambda is not permitted to know what one says, and the block
     * above `StorageStack` for why this is `toJsonString()` rather than
     * `JSON.stringify(resolve(...))` — the difference is a defect this slice
     * wrote and its own guard caught. */
    const keyPolicy = this.tenantKeyPolicy(dataServiceTaskRoleArn).toJSON()
    /**
     * 🛑 KMS's lockout safety check, relocated from the caller to the author —
     * and read off the RESOLVED document rather than off the environment
     * variable, which is a distinction this slice got wrong once and is worth
     * writing down. `Stack.toJsonString()` returns a TOKEN (`${Token[…]}`),
     * because the value it stands for is assembled by CloudFormation at deploy
     * time; a string check over that token finds nothing at all, and the guard
     * below duly reported every term missing from a policy that had all three.
     * **The control caught its own misuse on the first synth**, which is the
     * second time on this slice. `this.resolve()` gives the document itself.
     */
    assertKeyPolicyLeavesAnAdministrator(JSON.stringify(this.resolve(keyPolicy)))

    /* And this is what the function carries: see the block above `StorageStack`
     * for why it is `toJsonString()` and not `JSON.stringify(resolve(...))`. */
    const renderedPolicy = this.toJsonString(keyPolicy)

    const minter = new lambda.Function(this, 'TenantKeyMinter', {
      /* Trap 6: set explicitly, never derived from the construct path. */
      functionName,
      role,
      logGroup,
      runtime: lambda.Runtime.NODEJS_22_X,
      /* G252 - ARM64 everywhere. */
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(MINTER_ASSET_DIR),
      timeout: Duration.seconds(30),
      memorySize: 256,
      /**
       * 🛑 ONE AT A TIME, AND IT IS A COST CONTROL WITH A SAFETY ARGUMENT
       * UNDER IT. G287 accepts *"a KMS key per tenant"* and names the quota and
       * the monthly cost as the price. Onboarding happens at human rate; a
       * factory that can run a thousand wide can turn one retry loop into a
       * thousand keys, a KMS quota exhaustion for every product in a SHARED
       * account, and a bill. Reserved concurrency is the only bound IAM cannot
       * express.
       */
      reservedConcurrentExecutions: 1,
      description:
        'G290 - mints one per-tenant KMS key for an OPAQUE handle. It is never ' +
        'told which tenant. It cannot destroy a key, use one, or rewrite a key policy.',
      environment: {
        RECONCILE_KEY_ALIAS_PREFIX: aliasPrefix,
        RECONCILE_TENANT_KEY_POLICY: renderedPolicy,
        RECONCILE_TENANT_KEY_TAGS: JSON.stringify(tags),
      },
    })

    /**
     * 🛑 THE ONE STANDING GRANT, AND IT IS `lambda:InvokeFunction` ON ONE ARN.
     *
     * G290 rules that **the control plane** mints the key. The control plane's
     * serving task role is the only principal in this account that is the
     * control plane, so it is the only one granted invoke. Reached BY NAME, for
     * the reason `planeRoleName()` states: a construct reference here plus the
     * key policy naming the data plane's role in the other direction is a
     * `«DependencyCycle»`, and the price is the deploy order `Planes` before
     * `Storage` that this stack already pays.
     *
     * 🛑 **AND HERE IS THE GAP, NAMED PRECISELY RATHER THAN FILLED: NOTHING
     * CALLS IT.** No operation is mounted on
     * `docs/contracts/administration.openapi.yaml` — G288 declares 59 and
     * `mountTier()` is never called for that tier — no `FleetReconciler`
     * exists (`docs/fleet-deployment.md` §7 marks it *"new"*), and no code in
     * `server/control-plane/` reaches this ARN. **`server/` is out of this
     * slice's scope and inventing an onboarding API here would be inventing
     * the contract half of a ruling nobody took.** What exists is the
     * principal, the permission and the function; what is owed is a caller, and
     * a column on `DataPlanePlacement` to record what the caller gets back.
     */
    minter.grantInvoke(
      iam.Role.fromRoleName(
        this,
        'ControlPlaneServingTaskRole',
        planeRoleName(environment, 'control', 'service', 'task'),
        { mutable: true },
      ),
    )

    return minter
  }

  // ------------------------------------------------------------- the grant

  /**
   * The bucket half of the fence, written onto the SERVING task role and onto
   * no other principal.
   *
   * 🛑 NO `s3:DeleteObject`, AND THAT IS G287 RATHER THAN CAUTION. The ruling
   * refused "erasure as a delete operation" in favour of key destruction,
   * because a delete loop "is a claim that it ran." Granting the serving process
   * a delete would put the refused instrument back in the account, where the
   * first person who needs to remove something will reach for it — and the
   * evidence a customer is shown would quietly become a log line again.
   *
   * ⚠️ THE POLICY IS ATTACHED TO A ROLE THIS STACK DOES NOT OWN, by name. The
   * role is `Planes`'. See `planeRoleName()` in `lib/config.ts` for why the join
   * is a name in both directions, and for the deploy-ordering cost that buys.
   */
  private grantTheServingProcessAndNothingElse(
    environment: Environment,
    bucket: s3.Bucket,
  ): iam.IRole {
    const role = iam.Role.fromRoleName(
      this,
      'DataPlaneServingTaskRole',
      planeRoleName(environment, 'data', 'service', 'task'),
      { mutable: true },
    )

    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        sid: 'ReadAndWriteOwnPlaneObjectsNeverDelete',
        actions: ['s3:GetObject', 's3:GetObjectVersion', 's3:PutObject', 's3:AbortMultipartUpload'],
        resources: [bucket.arnForObjects('*')],
      }),
    )
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        sid: 'ListOwnPlaneBucket',
        actions: ['s3:ListBucket', 's3:ListBucketMultipartUploads'],
        resources: [bucket.bucketArn],
      }),
    )
    return role
  }

  /**
   * ┌─ G2401–G2404 — SOURCE CREDENTIAL CUSTODY, THE OWNER'S RULING ────────────┐
   * │ *"Secrets Manager, one secret per source, encrypted with the tenant's    │
   * │ per-tenant KMS key (Storage's key factory); only a credentialRef lives   │
   * │ in Postgres."*                                                           │
   * └──────────────────────────────────────────────────────────────────────────┘
   *
   * 🛑 IT LIVES HERE AND NOT IN `Planes`, AND THAT IS G1012's CONSTRAINT RATHER
   * THAN A TASTE. The grant is to the data plane's serving task role, and an
   * edit to `Planes` is a `Planes` deploy — which rolls both planes to the
   * stack's image tag against a forward-only schema. `Storage` already joins
   * that role BY NAME for the bucket and already owns the tenant keys the
   * secrets are encrypted under, so this is the stack where custody is one
   * concern rather than two. **MEASURED: the synthesised `Planes` template is
   * byte-identical before and after this slice.**
   *
   * TWO VERBS, AND EACH IS FENCED BY A CONDITION RATHER THAN A HOPE:
   *
   *   `CreateSecret` — only under `<prefix>*`, and ONLY when the request names
   *     a KMS key under the TENANT KEY ALIAS PREFIX. Without the second
   *     condition a caller omits `KmsKeyId` and Secrets Manager quietly uses
   *     `aws/secretsmanager`, the account's shared key — **every tenant's
   *     credential under one key, which is exactly what the ruling refuses**,
   *     and it would be a silent success. `Null: false` makes the omission an
   *     `AccessDenied`; `StringLike` makes any other key one too.
   *   `PutSecretValue` — rotation of a credential this plane already created,
   *     under the same prefix. The key cannot move on this verb.
   *
   * ⚠️ WHAT IAM CANNOT DO HERE AND MUST NOT BE DESCRIBED AS DOING: separate
   * one tenant's secrets from another's. One serving process serves every
   * tenant on a hosted plane, so the resource fence is a PREFIX. Isolation is
   * the server's — the name is minted server-side and never read from a
   * request — and RLS's, on the row that carries the handle.
   *
   * ⚠️ AND THE KEY CHOICE IS NOT CHECKED FOR *THE RIGHT* TENANT KEY by IAM
   * either, only for *A* tenant key. The server reads the handle out of
   * `tenant.tenant_key_handle` under that tenant's RLS scope; a wrong handle
   * there is a migrator's error that no policy here could see.
   */
  private grantTheServingProcessCredentialWritesAndNoRead(
    environment: Environment,
    role: iam.IRole,
  ): void {
    const secrets = this.formatArn({
      service: 'secretsmanager',
      resource: 'secret',
      arnFormat: ArnFormat.COLON_RESOURCE_NAME,
      /* Secrets Manager appends `-XXXXXX` to every secret ARN, so the fence is
       * the name prefix followed by a wildcard and cannot be tighter. */
      resourceName: `${sourceCredentialSecretPrefix(environment)}*`,
    })
    const tenantKeyAliases = `${tenantKeyAliasPrefix(environment)}*`

    const create = new iam.PolicyStatement({
      sid: 'CreateSourceCredentialOnlyUnderATenantKey',
      actions: ['secretsmanager:CreateSecret'],
      resources: [secrets],
      conditions: {
        Null: { 'secretsmanager:KmsKeyId': 'false' },
        StringLike: { 'secretsmanager:KmsKeyId': tenantKeyAliases },
      },
    })
    const rotate = new iam.PolicyStatement({
      sid: 'RotateOwnSourceCredentialNeverReadIt',
      actions: ['secretsmanager:PutSecretValue'],
      resources: [secrets],
    })

    assertCredentialWriterHoldsNoReadVerb([...create.actions, ...rotate.actions])

    role.addToPrincipalPolicy(create)
    role.addToPrincipalPolicy(rotate)
  }

  // ------------------------------------------------------------------ output

  private outputs(environment: Environment, handles: readonly string[]): void {
    new CfnOutput(this, 'ObjectBucketName', {
      value: this.objectBucket.bucketName,
      description:
        'The data plane object bucket. The Planes stack must inject this as an ' +
        'environment variable; nothing in server/ reads it yet, which is owed.',
    })
    new CfnOutput(this, 'TenantKeyCount', {
      value: String(handles.length),
      description:
        'Per-tenant KMS keys minted BY THIS TEMPLATE. ZERO on trunk. It is NOT ' +
        'the number of tenant keys in the account: since G290 the minter function ' +
        'creates keys this template never sees, and nothing here counts them. See ' +
        'the ONBOARDING GAP block at the head of infra/lib/storage-stack.ts.',
    })
    new CfnOutput(this, 'TenantKeyMinterFunctionName', {
      value: this.tenantKeyMinter.functionName,
      description:
        'G290 - the function that mints a per-tenant key for an OPAQUE handle. It ' +
        'may create a key and may NOT destroy one, use one, or rewrite a key ' +
        'policy. The control plane serving task role may invoke it; nothing in ' +
        'server/ does.',
    })
    new CfnOutput(this, 'WhatThisStackDoesNotAssert', {
      value:
        'No object may be written until a tenant key exists AND THE BUCKET POLICY ' +
        'NAMES IT - a key minted by the G290 function is in no enumeration here, ' +
        'and adding it is a cdk deploy. No S3 gateway VPC endpoint (Network owns ' +
        'that). No lifecycle expiration: RetentionPolicy has no real value to ' +
        'generate one from (data-architecture 10.2). No reader outside the data ' +
        `plane serving task in ${environment}. No caller for the minter: nothing ` +
        'in server/ invokes it and DataPlanePlacement has no column for a handle. ' +
        'No principal holds kms:ScheduleKeyDeletion by grant - erasure remains a ' +
        'deliberate human operation.',
      description: 'What a reader must not read this stack as asserting.',
    })
  }
}

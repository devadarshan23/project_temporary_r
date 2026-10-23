/**
 * The constants the whole app reads. One statement of each, and every one of
 * them is a G-row rather than a preference.
 *
 * ⚠️ NOTHING HERE IS A LOOKUP. `cdk synth` must be deterministic and offline to
 * meet G108's condition on anything that joins `npm run check`, so the account
 * and the region are LITERALS rather than `Stack.of(this).account` resolved
 * from an ambient profile, and no construct in this app calls any
 * `fromLookup()`. `npm run synth:infra` passes `--no-lookups` on top of that, so
 * a lookup added later fails the gate loudly instead of reaching the network on
 * a contributor's machine and silently succeeding on one with credentials.
 */

/**
 * G256 — `us-west-2` in account `000000000000`.
 *
 * `us-east-1` was asked for and refused on one ground: it is not a member of
 * `model/domain.ts#RegionKey`, and a tenant may not be placed in a region the
 * residency vocabulary cannot name. Derive the vocabulary, do not trust this
 * comment: `grep -nA6 'export type RegionKey' model/domain.ts`.
 *
 * 🛑 THE ACCOUNT IS SHARED and the owner accepted that knowingly — it also holds
 * the `changi_*` CodeBuild projects and the live findings K1 and K6 in
 * `docs/infrastructure-risk-register.md`. What fences this product inside it is
 * G260's tagging plus a pipeline role that can deploy only `Project=reconcile`
 * stacks; both are in this app.
 */
/**
 * 🛑 THE ACCOUNT MOVED ON 18 Sep 2026, AND G256 NAMED THE WRONG ONE FOR A
 * REASON WORTH RECORDING: NOBODY HAD ASKED.
 *
 * G256 says `000000000000` because that is what `aws sts get-caller-identity`
 * returned from the CLI's `default` profile when the ruling was written. It was
 * a fact about a shell, presented as a decision. The product owner's actual
 * console session was in `000000000000` — 1CH Internal-SNG — the whole time,
 * and the mismatch surfaced only when the handshake could not find a connection
 * that had been created in the other account.
 *
 * **`000000000000` is reached by FEDERATED identity** (`AAD-1CH-Internal-L2`),
 * where `000000000000` is reached by a STATIC IAM USER KEY. G263 forbids this
 * product creating a successor to a static key, and `docs/infrastructure-risk-register.md`
 * K1 is a live IAM key in that same old account. Building the pipeline where
 * the credentials are federated is the same ruling applied one level up.
 *
 * **What is unchanged: the REGION.** G256's refusal of `us-east-1` stands
 * whole — it is not a member of `model/domain.ts#RegionKey` and a tenant may
 * not be placed in a region the residency vocabulary cannot name.
 */
export const AWS_ACCOUNT = '000000000000'
export const AWS_REGION = 'us-west-2'

export const CDK_ENV = { account: AWS_ACCOUNT, region: AWS_REGION } as const

/** G252 — every CodeBuild project in this app is `ARM_CONTAINER`, every image `linux/arm64`. */
export const DOCKER_PLATFORM = 'linux/arm64'

/** The GitHub repository CodeConnections is pointed at (G257). */
export const GITHUB_OWNER = '1CloudHub'
export const GITHUB_REPO = 'Reconcile'
export const GITHUB_TRUNK_BRANCH = 'main'

/**
 * G258 — the CI image. One `linux/arm64` image carrying Node 22, PostgreSQL 17
 * and chromium, built from `infra/ci-image/Dockerfile` and used by EVERY
 * CodeBuild project here.
 *
 * 🛑 THE TAG IS A NAME FOR BYTES BECAUSE THE REPOSITORY IS `IMMUTABLE`. G262
 * wants the running image identified by digest rather than by a tag that can
 * move; an ECR repository with immutable tags refuses to move one, so pinning a
 * tag here buys the same property without putting a `sha256:` literal in source
 * that no reviewer can check. Bumping the image is a bump of this constant in a
 * reviewed pull request, which is the shape G191 already requires of every
 * other pinned dependency.
 */
export const CI_IMAGE_REPOSITORY_NAME = 'reconcile/ci-image'
export const CI_IMAGE_TAG = 'v1'

/** The path, in the repository, of the Dockerfile the `CiImage` stack builds. */
export const CI_IMAGE_DOCKERFILE = 'infra/ci-image/Dockerfile'

/** The ECR repository the Build stage pushes the two planes' runtime image to. */
export const PLANE_IMAGE_REPOSITORY_NAME = 'reconcile/planes'

/**
 * The CDK CONTEXT KEY that names which bytes `Planes` deploys.
 *
 * ┌─ 🛑 THIS WAS A `CfnParameter` AND IT IS GONE — G1012, 20 Sep 2026, ────────┐
 * │ DERIVED AND NOT THE OWNER'S. THE FAILURE IT CAUSED WAS SILENT, WHICH IS    │
 * │ THE DANGEROUS HALF.                                                        │
 * │                                                                            │
 * │ `cdk deploy` sends `UsePreviousValue: true` for every parameter it is not  │
 * │ given, so a deploy of `Planes` with no `--parameters` re-applies whatever  │
 * │ the STACK last recorded. The pipeline's Deploy stage is not a `cdk deploy` │
 * │ — it calls `RegisterTaskDefinition` + `UpdateService` and never touches a  │
 * │ stack parameter — so the stack's idea of the image goes stale the moment   │
 * │ the pipeline runs, and `infra/README.md` told a deployer to run the very   │
 * │ deploy that would apply it. **Measured against AWS on 20 Sep 2026:**       │
 * │                                                                            │
 * │   stack parameter PlaneImageTag  791425b0…  pushed 2026-09-18T17:05        │
 * │   running data-plane task def    :38, image @sha256:5fd373e5…              │
 * │                       that digest is tagged 56d9d053…, pushed 09-20T07:54  │
 * │   the task definition CLOUDFORMATION owns  …DataPlaneTaskB4F25A67:**1**    │
 * │                                                                            │
 * │ **Revision 1 against revision 38.** A `cdk deploy` of `Planes` — which     │
 * │ `Edge` REQUIRES, because it takes the data ALB by construct reference —    │
 * │ succeeds, reports no drift, and rolls both planes back two days against a  │
 * │ FORWARD-ONLY schema (G88).                                                 │
 * │                                                                            │
 * │ **The repair is to remove the channel rather than to document it.** A      │
 * │ context value has no previous value: absent, synth THROWS. The tag is then │
 * │ baked into the template, so `cdk diff` shows the image changing and a      │
 * │ deploy cannot quietly disagree with the service.                           │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
export const PLANE_IMAGE_TAG_CONTEXT_KEY = 'planeImageTag'

/**
 * ┌─ 🛑 THE PULL-REQUEST GATE IS OPT-IN, AND THE FLAG EXISTS BECAUSE ITS ──────┐
 * │ ABSENCE ROLLED BACK A WHOLE STACK — G1094, 20 Sep 2026.                   │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * **What happened, from CloudFormation and not from reasoning.**
 * `cdk deploy reconcile-pipeline-staging` on 20 Sep 2026:
 *
 *     CREATE_FAILED  AWS::CodeBuild::Project  GatePullRequest
 *     Failed to call CreateWebhook, reason: Access denied to connection
 *     arn:aws:codeconnections:us-west-2:000000000000:connection/309314ad-…
 *
 * The connection is `AVAILABLE`, `GitHub`, and owned by this account.
 * **CodeBuild may not MINT A WEBHOOK through it**, which is a GitHub App
 * permission an owner grants in GitHub and which no amount of CDK can supply.
 * `pipeline-stack.ts` named this risk in advance — *"Creating a webhook
 * additionally asks GitHub for one … this repository has never created one, so
 * the first `cdk deploy` of this project is where that is found out"* — and
 * that is exactly where it was found out.
 *
 * 🛑 **THE COUPLING IS THE DEFECT, NOT THE PERMISSION.** One resource that
 * cannot be created rolled the WHOLE stack back, and the Deploy stage's
 * frontend sync — which works, and which is wanted — went with it. A stack in
 * which one blocked-on-a-human resource holds every other resource hostage is a
 * deployment shape, not a CI decision, and this flag is the repair.
 *
 * 🛑 **OFF IS TOTAL, NOT INERT, AND THAT IS THE HALF TO READ.** When the flag
 * is off there is **no `GatePullRequest` project in the template at all** — not
 * a disabled one, not one with `webhook: false`, not a log group waiting for
 * it. `tests/infra/pipeline.test.mjs` asserts the absence by resource type over
 * every stack. **A gate that exists and never fires is PR #257 wearing a
 * different hat**: that pull request merged a trunk its own body records as
 * `npm run check` EXIT 1, because a check reported SUCCESS while standing its
 * suites down. A CodeBuild project with no webhook reports nothing at all,
 * which reads from the merge button exactly like a gate that passed.
 *
 * ⚠️ **THE VALUE IS VALIDATED AND A TYPO IS A SYNTH ERROR, NEVER A QUIET OFF.**
 * `-c pullRequestGate=ture` must not mean *off*: a flag whose misspelling
 * silently selects the safe-looking state is a flag nobody can trust they have
 * turned on. Absent is off; `on`/`true` is on; `off`/`false` is off; everything
 * else throws and names both spellings.
 *
 * **To turn it on, once the GitHub App permission exists:**
 *
 *     cdk deploy reconcile-pipeline-staging \
 *       -c planeImageTag=<40-hex commit sha> -c pullRequestGate=on
 */
export const PULL_REQUEST_GATE_CONTEXT_KEY = 'pullRequestGate'

/** Off unless somebody said `on`, and loud about anything it cannot read. */
export function pullRequestGateEnabled(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false
  if (value === true || value === 'on' || value === 'true') return true
  if (value === false || value === 'off' || value === 'false') return false
  throw new Error(
    `Pipeline: '${String(value)}' is not a value for -c ${PULL_REQUEST_GATE_CONTEXT_KEY}. ` +
      "Say 'on' or 'off'. This throws rather than defaulting to off because a flag whose " +
      'typo selects the safe-looking state is a flag nobody can trust they have turned on, ' +
      'and the state it would have selected is one where NO pull request is checked at all. ' +
      'Turning it ON additionally requires a GitHub App permission that lets CodeBuild ' +
      'create a webhook through the CodeConnections connection — without it the project ' +
      'fails CREATE with "Access denied to connection" and rolls the pipeline stack back.',
  )
}

/**
 * The one tag that is accepted and is NOT a commit sha.
 *
 * 🛑 IT EXISTS FOR THE GATE AND IT IS SPELLED SO THAT DEPLOYING IT FAILS LOUDLY.
 * `npm run synth:infra` must stay green, offline and deterministic (G108), and
 * it has no commit sha to supply — so it supplies this. **The repository is
 * `imageTagMutability: IMMUTABLE` and the Build stage pushes
 * `$CODEBUILD_RESOLVED_SOURCE_VERSION` and nothing else, so no image will ever
 * carry this tag.** A template synthesised by the gate and deployed by hand
 * therefore fails at the ECS image pull — the service never stabilises and
 * CloudFormation rolls back — rather than silently running older bytes, which
 * is the failure this whole block exists to end.
 *
 * ⚠️ IT IS NOT A DEFAULT AND MUST NEVER BECOME ONE. A default in `cdk.json`'s
 * `context` would restore exactly the silence the `CfnParameter` had, with a
 * value no deploy ever names. `tests/infra/planes.test.mjs` asserts that
 * `cdk.json` declares no `planeImageTag`.
 */
export const SYNTH_ONLY_PLANE_IMAGE_TAG = 'synth-only-not-a-deployable-tag'

/**
 * 🛑 THE GUARD. It throws, at synth, unless somebody has NAMED the bytes.
 *
 * Three answers and no fourth: a 40-character lowercase hex commit sha (what
 * the Build stage pushes), the synth-only sentinel above, or a refusal.
 *
 * ⚠️ **THE `latest` CASE IS THE ONE TO READ.** It is what a hurried operator
 * types, it is a tag an IMMUTABLE repository will happily hold, and it names
 * *whichever bytes happened to be pushed last* — the property the deleted
 * `CfnParameter`'s own header refused a DEFAULT for, arriving through the
 * front door instead. The shape rule refuses it without anybody maintaining a
 * list of bad spellings.
 */
export function assertDeployablePlaneImageTag(tag: unknown): string {
  if (tag === SYNTH_ONLY_PLANE_IMAGE_TAG) return tag
  if (typeof tag === 'string' && /^[0-9a-f]{40}$/.test(tag)) return tag
  throw new Error(
    `Planes: ${tag === undefined || tag === '' ? 'no image tag was supplied' : `'${String(tag)}' is not an image tag this stack will deploy`}. ` +
      'PlaneImageTag stopped being a CloudFormation parameter on 20 Sep 2026 (G1012), because ' +
      'cdk deploy re-applies a parameter it is not given and the stack value goes stale the ' +
      "moment the pipeline registers a task definition - measured at CloudFormation's revision 1 " +
      'against the service\'s revision 38. Name the bytes:\n' +
      '  cdk <any command> <any stack> -c planeImageTag=<40-hex commit sha>\n' +
      'EVERY cdk command in this app needs it, not just a deploy of Planes: buildApp() '  +
      'constructs every stack, so `cdk deploy reconcile-edge-staging` synthesises Planes too.\n' +
      'Derive the sha the service is ACTUALLY running, never guess it and never use `latest`:\n' +
      '  AWS_PROFILE=crm-frontend node tests/e2e/probe-deployed-image.mjs\n' +
      `The gate supplies '${SYNTH_ONLY_PLANE_IMAGE_TAG}', which no image in an IMMUTABLE ` +
      'repository can ever carry, so a gate-synthesised template fails at the image pull ' +
      'instead of running older bytes.',
  )
}

/**
 * The two ports the planes listen on, and they are `compose.yaml`'s two ports.
 *
 * ⚠️ THEY ARE ALSO THE TWO DEFAULTS IN `server/`, AND THAT IS A THIRD COPY.
 * `server/data-plane/config.ts` and `server/control-plane/config.ts` each
 * declare a `DEFAULT_HTTP_PORT`, `compose.yaml` publishes them, and these two
 * constants feed the ECS port mappings and the two ALB listeners. Nothing
 * checks that the four agree. Derive before changing either:
 * `grep -rn 'DEFAULT_HTTP_PORT =' server/`.
 *
 * Both are above 1024 because neither plane runs as root — the `Dockerfile`
 * states it in its own header ("Neither plane runs as root. Both listen above
 * 1024 for this reason"), and G262's dropped capabilities make it a fact rather
 * than a convention.
 */
export const DATA_PLANE_PORT = 9080
export const CONTROL_PLANE_PORT = 9070

// ---------------------------------------------------------------- G260 tags

/**
 * G260 — SIX tags on every resource, and `RequiredTagsAspect` throws at synth
 * on a missing one. The vocabulary is `docs/tech-stack.md` §11.
 */
export const REQUIRED_TAG_KEYS = [
  'Project',
  'Environment',
  'Plane',
  'ManagedBy',
  'Owner',
  'CostCentre',
] as const

export type RequiredTagKey = (typeof REQUIRED_TAG_KEYS)[number]

/**
 * 🛑 NO `TenantId` TAG. EVER. THE ABSENCE IS THE RULING, NOT AN OVERSIGHT.
 *
 * A tag is control-plane metadata readable by anyone holding `tag:GetResources`.
 * **A per-tenant tag is a tenant enumeration in the clear** — the same
 * disclosure shape G251 records as an accepted risk on ONE operation, and which
 * nothing justifies accepting across an entire account. G260 rejected tenant
 * tags on data-plane resources explicitly.
 *
 * This is not a comment asking for restraint: `RequiredTagsAspect` FAILS SYNTH
 * on any resource carrying one of these keys, so adding a tenant tag is a red
 * gate rather than a review conversation.
 */
export const FORBIDDEN_TAG_KEYS = ['TenantId', 'Tenant', 'TenantRef'] as const

/**
 * ✅ `Owner` AND `CostCentre` ARE FILLED — product owner, 18 Sep 2026.
 *
 * ⚠️ THE PLACEHOLDER CONSTANTS ARE KEPT, STRUCK, RATHER THAN DELETED, because
 * the Aspect's warning names them and a reader meeting that warning in an old
 * log needs to find them. They are no longer used by `tagsFor()`.
 *
 * G260 shipped both as placeholders deliberately — *"one obvious constant each
 * rather than a plausible-looking value, because a plausible-looking
 * placeholder is one nobody notices is a placeholder"* — and the Aspect warned
 * on the first `cdk deploy`, which is the control working. `docs/tech-stack.md`
 * §14's two OUTSTANDING rows are closed by this.
 *
 * 🛑 `Owner` IS A PERSON AND THAT IS A KNOWN WEAKNESS, NOT AN OVERSIGHT.
 * G260 calls this field *"who gets paged"*. A personal address pages one person
 * and pages nobody when that person leaves. It is what the owner gave and it is
 * used; replacing it with a team alias is a one-line change and is the right
 * one the moment a second person is on call.
 */
export const TAG_OWNER_PLACEHOLDER = 'PLACEHOLDER-owner-mailbox-unfilled'
export const TAG_COST_CENTRE_PLACEHOLDER = 'PLACEHOLDER-cost-centre-unfilled'

/** Who gets paged. Product owner, 18 Sep 2026. See the weakness noted above. */
export const TAG_OWNER = 'phani@1cloudhub.com'

/** Finance's key, not ours. Product owner, 18 Sep 2026. */
export const TAG_COST_CENTRE = 'ReconcileAI'

/**
 * `Environment` values. §11 names two — `staging` and `prod`.
 *
 * ⚠️ `shared` IS A THIRD VALUE AND THIS SLICE ADDED IT; IT IS NAMED HERE RATHER
 * THAN SMUGGLED. The CI image and the ECR repositories are not an environment's
 * resources — one image serves both pipelines — and tagging them `staging`
 * would be a false statement in the one field alarms and cost allocation route
 * by. The owner may rule it away; until then it is one word, used by the
 * `CiImage` stack only, and `docs/tech-stack.md` §11 does not yet know about it.
 */
export const ENVIRONMENTS = ['staging', 'prod', 'shared'] as const
export type Environment = (typeof ENVIRONMENTS)[number]

/**
 * `Plane` values. §11: *"invariant 3 is auditable from a tag query — a
 * `Plane=control` resource with a route to a `Plane=data` cluster is a finding"*.
 * Everything in this CI/CD pass is `ci`.
 *
 * ⚠️ `shared` IS A FIFTH VALUE, ADDED BY THE `Network` SLICE, AND IT IS NAMED
 * HERE FOR THE SAME REASON `shared` WAS ADDED TO `ENVIRONMENTS` ABOVE.
 * G253 puts both planes in ONE VPC per environment, so that VPC's subnets,
 * route tables, internet gateway and NAT gateway belong to neither plane.
 * Tagging them `data` or `control` would put a FALSE statement in the one field
 * G260 says invariant 3 is audited from — and the audit query G260 describes
 * (*"a `Plane=control` resource with a route to a `Plane=data` cluster is a
 * finding"*) is about SECURITY GROUPS and CLUSTERS, every one of which carries
 * its own plane. A `shared` VPC is not a control-plane resource, so the query is
 * not weakened by the value existing; it would be weakened by a VPC lying about
 * which plane it serves.
 *
 * ⚠️ `public` IS A SIXTH VALUE, ADDED BY THE `Amplify` SLICE ON 22 Sep 2026,
 * AND IT IS NAMED HERE FOR EXACTLY THE REASON THE TWO `shared` VALUES ABOVE
 * ARE. The apex is the public MARKETING plane, and the pack says in its own
 * voice that it is *"a third plane the architecture documents do not describe —
 * no tenant, no session, no capability model"*. The two candidates it displaces
 * are both FALSE STATEMENTS in the one field G260 says invariant 3 is audited
 * from: `edge` says this belongs to the `Edge` stack's CloudFront fleet, which
 * is the one thing `EDGE_APEX_IS_SERVED_ELSEWHERE` exists to deny, and `shared`
 * says it serves both planes, which it does not serve either of.
 *
 * ⚠️ AND IT DOES NOT WEAKEN G260's AUDIT QUERY — *"a `Plane=control` resource
 * with a route to a `Plane=data` cluster is a finding"* — because that query is
 * about SECURITY GROUPS and CLUSTERS and this plane has neither. Nothing in it
 * is in a VPC at all.
 */
export const PLANES = ['control', 'data', 'edge', 'ci', 'shared', 'public'] as const
export type Plane = (typeof PLANES)[number]

export interface ResourceTags {
  readonly Project: 'reconcile'
  readonly Environment: Environment
  readonly Plane: Plane
  readonly ManagedBy: 'cdk'
  readonly Owner: string
  readonly CostCentre: string
}

export function tagsFor(environment: Environment, plane: Plane): ResourceTags {
  return {
    Project: 'reconcile',
    Environment: environment,
    Plane: plane,
    ManagedBy: 'cdk',
    Owner: TAG_OWNER,
    CostCentre: TAG_COST_CENTRE,
  }
}

// ------------------------------------------------------------- stack names

export const STACK_CI_IMAGE = 'reconcile-ci-image'
export const STACK_PIPELINE_STAGING = 'reconcile-pipeline-staging'
export const STACK_NETWORK_STAGING = 'reconcile-network-staging'
export const STACK_DATA_STAGING = 'reconcile-data-staging'
export const STACK_STORAGE_STAGING = 'reconcile-storage-staging'

// ------------------------------------------------- object storage (G287)

/**
 * The data plane's one object bucket. **Per data plane, not per tenant** —
 * G287: *"ONE S3 BUCKET PER DATA PLANE, SSE-KMS, WITH A PER-TENANT KEY."*
 *
 * 🛑 THE ACCOUNT AND THE REGION ARE IN THE NAME BECAUSE AN S3 BUCKET NAME IS
 * GLOBAL AND EVERY OTHER NAME IN THIS FILE IS NOT. `reconcile-staging-data-
 * objects` is a name any AWS customer on earth may already hold, and the
 * failure is `BucketAlreadyExists` at deploy rather than anything a review
 * catches. Account plus region makes it ours by construction.
 *
 * ⚠️ WHAT IS DISCLOSED BY THAT, STATED RATHER THAN SHRUGGED AT: the bucket name
 * carries the account id, and a bucket name is not secret to anyone who can
 * guess it. An account id is not a credential and is printed in every ARN in
 * every template here; a TENANT id would be a different matter entirely, and
 * none appears — see `tenantKeyAliasName()` below, which is where that
 * temptation actually lives.
 *
 * ⚠️ THIS IS **NOT** THE `Edge` STACK'S BUCKET. `docs/tech-stack.md` §10 names
 * `Edge` as *"S3, CloudFront, certificate"* — that bucket holds the frontend
 * BUNDLE and is public-read through a distribution. This one holds tenant
 * payloads and is unreachable from the internet. Two buckets, two planes, two
 * entirely different arguments; do not let the shared service name collapse
 * them.
 */
export const objectBucketName = (environment: Environment): string =>
  `reconcile-${AWS_ACCOUNT}-${AWS_REGION}-${environment}-data-objects`

/**
 * 🛑 THE OPAQUE KEY HANDLE, AND IT IS G260 ARRIVING SOMEWHERE G260 DOES NOT
 * REACH.
 *
 * G260 forbids a `TenantId` TAG and `RequiredTagsAspect` fails synth on one,
 * with the reason stated as *"a tag is control-plane metadata readable by
 * anyone holding `tag:GetResources`; a per-tenant tag is a tenant enumeration
 * in the clear."*
 *
 * **A KMS ALIAS IS THE SAME DISCLOSURE THROUGH A DIFFERENT API, AND NOTHING IN
 * THE RECORD HAD NOTICED.** `kms:ListAliases` is an account-wide call that takes
 * no resource, so any principal holding it reads every alias in the account —
 * and `alias/reconcile-staging-data-tenant-ten_acme` would publish the customer
 * list to every one of them. The same is true of a key DESCRIPTION through
 * `kms:ListKeys` plus `kms:DescribeKey`. The Aspect cannot see either: neither
 * is a tag.
 *
 * So a tenant key is named by an OPAQUE HANDLE — sixteen hex characters — and
 * the join from handle to tenant lives in the control-plane catalogue, which is
 * a database behind a grant, rather than in an AWS metadata field behind a
 * list call.
 *
 * 🛑 THE HANDLE IS RANDOM, NEVER DERIVED, AND THAT IS THE HALF THAT IS EASY TO
 * GET WRONG. A hash of the tenant id would be reproducible, which is exactly
 * what makes it useless: tenant ids are low-entropy slugs (`ten_acme`), so an
 * attacker holding the alias list and a dictionary of company names recovers
 * the mapping by guessing forward. Mint it with `openssl rand -hex 8` and
 * record it; do not compute it from anything.
 *
 * `assertOpaqueKeyHandle()` in `lib/storage-stack.ts` refuses anything that is
 * not this shape, AT SYNTH, and `infra/test-fixtures/storage-named-tenant.ts`
 * witnesses that refusal RED.
 */
export const TENANT_KEY_HANDLE_PATTERN = /^[0-9a-f]{16}$/

/**
 * The per-tenant KMS keys this app mints, by opaque handle.
 *
 * 🛑 IT IS EMPTY, AND THE EMPTINESS IS THE HONEST STATE RATHER THAN A STUB.
 * There is no tenant in this account. G287 says *"onboarding now mints one —
 * which is a change to the fleet onboarding story `docs/fleet-deployment.md`
 * describes as a config change in the control plane"*, and **that change has
 * not been made and is not this slice's to invent**: `docs/fleet-deployment.md`
 * §5 says a config change *"creates the `DataPlane` row, mints the registration
 * secret and authorises the account"* — a row insert — and nothing anywhere
 * turns a row insert into a CloudFormation deploy. See the ONBOARDING GAP block
 * at the head of `lib/storage-stack.ts`, which states precisely what is missing
 * rather than filling it with a mechanism nobody ruled.
 *
 * ⚠️ APPENDING A HANDLE HERE IS THE WHOLE OF WHAT THIS APP CAN DO TODAY, and it
 * is a reviewed pull request plus a `cdk deploy` — which is the shape G191
 * already requires of every pinned dependency and is NOT the shape G287's
 * onboarding sentence describes.
 */
export const TENANT_KEY_HANDLES: readonly string[] = []

/**
 * The alias PREFIX for one environment's tenant keys.
 *
 * `tk` rather than `tenant`: the word `tenant` in an alias tells a reader of
 * `kms:ListAliases` how many customers there are, which is one bit more than
 * the handle alone gives away. It is a small thing and it is free.
 *
 * ⚠️ IT IS A SEPARATE EXPORT BECAUSE TWO THINGS NOW NEED IT AND ONLY ONE OF
 * THEM NEEDS A HANDLE. `tenantKeyAliasName()` below names one alias; the
 * minting Lambda's IAM policy (G290) fences `kms:CreateAlias` to
 * `…:alias/<this prefix>*`, which is a RESOURCE fence rather than a condition
 * and is the only thing standing between a key factory and every alias in a
 * shared account. Writing the prefix twice would be writing the fence twice.
 */
export const tenantKeyAliasPrefix = (environment: Environment): string =>
  `alias/reconcile-${environment}-data-tk-`

/** The alias for one tenant key. Carries the handle and nothing else. */
export const tenantKeyAliasName = (environment: Environment, handle: string): string =>
  `${tenantKeyAliasPrefix(environment)}${handle}`

// ------------------------------------- the key-minting Lambda (G290)

/**
 * 🛑 `ManagedBy` GAINS A SECOND VALUE, AND IT IS NAMED HERE RATHER THAN
 * SMUGGLED — the same move `shared` made into `ENVIRONMENTS` and `PLANES`
 * above, for the same reason and with the same cost.
 *
 * G260 puts `ManagedBy` on every resource. Every resource this app has created
 * until now was created by CloudFormation, so the single value `cdk` was the
 * whole vocabulary and was true. **A key minted by the Lambda G290 rules is not
 * created by CloudFormation**, and tagging it `cdk` would put a false statement
 * in a field an operator uses to decide whether a resource may be deleted by
 * hand — which is precisely the class of defect `docs/HANDOFF.md` §5 catalogues
 * and which `tests/infra/storage.test.mjs` already refuses for the `Plane` tag.
 *
 * ⚠️ THE COST, STATED: `docs/tech-stack.md` §11 does not know about this value,
 * exactly as it does not know about `shared`. The owner may rule it away.
 * ⚠️ AND IT IS NOT DECORATION — it is half of the IAM fence. The minter's
 * `kms:CreateKey` grant is conditioned on `aws:RequestTag/ManagedBy` being
 * exactly this string, so a key the Lambda creates carries it or the API call
 * fails; and every verb the minter holds over an EXISTING key is conditioned on
 * `aws:ResourceTag/ManagedBy` being exactly this string, so a key it did not
 * mint is out of reach.
 */
export const MANAGED_BY_TENANT_KEY_MINTER = 'tenant-key-minter'

/**
 * The six tags a MINTED tenant key carries.
 *
 * 🛑 THE ASPECT CANNOT SEE THIS KEY AND THAT IS THE WHOLE PROBLEM THIS SOLVES.
 * `RequiredTagsAspect` walks a CDK tree at synth. A key created by an API call
 * from a Lambda is in no tree, so G260's six-tag rule has no enforcement over
 * it at all — and `FORBIDDEN_TAG_KEYS` has none either, which matters far more:
 * **nothing in `lib/tagging.ts` can stop a minted key from carrying a
 * `TenantId` tag.**
 *
 * So the enforcement moves to IAM, where it binds the API rather than the
 * template: the minter's `kms:CreateKey` statement requires each of these six
 * as an `aws:RequestTag`, AND restricts `aws:TagKeys` to exactly these six, so
 * a seventh tag — `TenantId` first among them — is an `AccessDenied` from KMS
 * rather than a code review. See `infra/lib/storage-stack.ts`.
 */
export const mintedTenantKeyTags = (
  environment: Environment,
): Readonly<Record<RequiredTagKey, string>> => ({
  ...tagsFor(environment, 'data'),
  ManagedBy: MANAGED_BY_TENANT_KEY_MINTER,
})

/**
 * The name of the key-minting function (G290).
 *
 * 🛑 IT IS SET EXPLICITLY AND THAT IS TRAP 6 OF `docs/build/deploy-handoff.md`
 * §3, NOT A PREFERENCE: *"CDK derives the hosted rotation Lambda's name from
 * the CONSTRUCT PATH, and it came out at 76 characters against Lambda's limit
 * of 64 — in a nested stack, minutes in."* The derived name here would be
 * `reconcile-storage-staging-TenantKeyMinter<8 hex>` and would fit today, which
 * is exactly how the other one fitted until a construct was nested. A name that
 * is a fact about a construct path is a name that changes when somebody renames
 * a construct.
 *
 * Thirty-five characters at `staging`, and `tests/infra/storage.test.mjs`
 * asserts the limit rather than trusting this sentence.
 */
export const tenantKeyMinterFunctionName = (environment: Environment): string =>
  `reconcile-${environment}-tenant-key-minter`

/** The minter's execution role. Named for the same reason the function is. */
export const tenantKeyMinterRoleName = (environment: Environment): string =>
  `reconcile-${environment}-tenant-key-minter`

/** The minter's log group. Lambda's own convention, declared rather than implied. */
export const tenantKeyMinterLogGroupName = (environment: Environment): string =>
  `/aws/lambda/${tenantKeyMinterFunctionName(environment)}`

/**
 * The name of one `Planes` task role.
 *
 * ⚠️ IT IS HERE RATHER THAN IN `lib/planes-stack.ts` BECAUSE TWO STACKS NOW
 * NEED IT AND A NAME WRITTEN TWICE IS A NAME THAT DRIFTS. `Storage` writes an
 * identity policy onto the data plane's SERVICE task role, and it reaches that
 * role BY NAME — never by construct reference and never by an exported ARN,
 * for the reason `PLANES_EXPORT_KEYS` above already states at length, plus one
 * more that is specific to this pair: a per-tenant KMS key policy must name
 * that role, and a key policy lives in `Storage` while the role lives in
 * `Planes`. Joining the two by construct reference in BOTH directions is a
 * `«DependencyCycle»`; joining them by name in both directions is no
 * CloudFormation dependency at all.
 *
 * 🛑 WHAT THAT COSTS, AND IT IS A REAL COST: `Storage` deploys AFTER `Planes`
 * or its `AWS::IAM::Policy` fails with `Cannot find the role`. There is no
 * template-level dependency to enforce that ordering, so it is written here,
 * in `infra/README.md`'s deploy order, and nowhere else.
 */
export const planeRoleName = (
  environment: Environment,
  plane: 'data' | 'control',
  kind: 'service' | 'migrate',
  principal: 'exec' | 'task',
): string => `reconcile-${environment}-${plane}-${kind}-${principal}`

// --------------------------------------------------------- Aurora (G254)

/**
 * 🛑 G177's STANDING VERIFICATION, DISCHARGED — AND IT IS A PRECONDITION OF
 * THIS SLICE RATHER THAN A NOTE INSIDE IT.
 *
 * G177 pins PostgreSQL 17 and says in its own row: *"STANDING VERIFICATION, NOT
 * DONE: confirm the Aurora Serverless v2 engine version before the hosted fleet
 * depends on it. No version was fetched; this row asserts nothing about what
 * Aurora Serverless v2 offers."* G254 is the hosted fleet, and turns that into
 * a condition on landing: *"the `infra/` slice's first commit records the engine
 * version string it targets and the AWS page it came from, or the slice does not
 * land."*
 *
 * **IT WAS FETCHED, NOT ASSUMED**, on 18 Sep 2026, against the real account and
 * the real region. Reproduce it; do not trust this comment:
 *
 *   aws rds describe-db-engine-versions --engine aurora-postgresql \
 *     --region us-west-2 --query 'DBEngineVersions[].EngineVersion' --output text \
 *     | tr '\t' '\n' | grep '^17' | sort -V
 *   => 17.4  17.5  17.6  17.7  17.9  17.10
 *
 * ⚠️ **NOTE WHAT IS MISSING FROM THAT LIST: `17.8`.** A minor that exists
 * upstream is simply not offered here. That absence is the argument for pinning
 * a literal rather than reaching for "the latest 17": "latest" is a property of
 * a region on a day, and a migration written against one is G177's own sentence
 * — *"a migration nobody can prove ran on the version production will use"* —
 * one step further along.
 *
 * **WHY 17.9 AND NOT 17.10.** 17.10 is newer and is available. 17.9 is chosen
 * because it is the newest version that is named by BOTH independent sources:
 * the region's own API above, AND `AuroraPostgresEngineVersion` in the pinned
 * `aws-cdk-lib@2.270.0`, whose highest 17 constant is `VER_17_9`. Reaching 17.10
 * needs `AuroraPostgresEngineVersion.of('17.10', '17')` — a raw string escape
 * hatch that accepts a typo in silence and synthesises a template that fails at
 * deploy. A named constant is checked by `tsc`; a string is checked by
 * CloudFormation, in the cloud, minutes later. Bumping to 17.10 is a bump of
 * `aws-cdk-lib` plus a bump of this constant, reviewed together, which is the
 * shape G191 already requires of every pinned dependency.
 *
 * **VERIFIED SERVERLESS-v2 CAPABLE, including scale-to-zero**, which §5's
 * shutdown block depends on:
 *
 *   aws rds describe-db-engine-versions --engine aurora-postgresql \
 *     --region us-west-2 --query \
 *     "DBEngineVersions[?EngineVersion=='17.9'].ServerlessV2FeaturesSupport"
 *   => [{ "MinCapacity": 0.0, "MaxCapacity": 256.0 }]
 *
 * `MinCapacity: 0.0` is the API saying this engine version admits an auto-pausing
 * Serverless v2 cluster. It is not a claim that this product uses one — see
 * `infra/lib/data-stack.ts`, which does not, and says why.
 */
export const AURORA_POSTGRES_VERSION = '17.9'

/** G254 — staging. Writer only, no reader. */
export const AURORA_MIN_ACU_STAGING = 0.5
export const AURORA_MAX_ACU_STAGING = 2

/** The two databases `compose.yaml` creates, and the names the planes expect. */
export const DATA_PLANE_DATABASE_NAME = 'reconcile_data'
export const CONTROL_PLANE_DATABASE_NAME = 'reconcile_control'

// ------------------------------------------- staging working hours (owner)

/**
 * 🛑 THE SHUTDOWN WINDOW, AND THE TIMEZONE IS AN ASSUMPTION THAT IS NAMED
 * RATHER THAN BURIED.
 *
 * The owner asked for staging to run working hours only. Nothing in the record
 * says WHICH working hours, so this is an assumption and it is written as one:
 * **`Asia/Singapore`, 07:00–20:00, Monday to Friday.** The account is
 * `000000000000` — *1CH Internal-SNG* (G279) — and G185 puts the control
 * plane's single writer in `ap-southeast-1`, so Singapore is the defensible
 * guess. **It is one string to change** (`SHUTDOWN_TIMEZONE`), and EventBridge
 * Scheduler resolves the IANA zone itself, so daylight saving — which
 * Singapore does not observe, but a future `Europe/London` would — is handled
 * by AWS rather than by arithmetic in this file.
 *
 * ⚠️ THE FOUR EXPRESSIONS BELOW ARE THE INTERFACE TO THE `Planes` STACK AND ARE
 * NOT PRIVATE TO `Data`. The ECS side is owned by another slice; it must read
 * these constants rather than retype the crons, because two schedules that
 * disagree by five minutes are two schedules nobody can reason about. The
 * ORDERING is the assumption that matters and is stated here so the other slice
 * can contradict it deliberately:
 *
 *   19:55  ECS services scale to 0 tasks          (`Planes`, NOT BUILT HERE)
 *   20:00  both Aurora clusters stop              (`Data`, built here)
 *   06:30  both Aurora clusters start             (`Data`, built here)
 *   07:00  ECS services scale back up             (`Planes`, NOT BUILT HERE)
 *
 * 🛑 THE THIRTY-MINUTE HEAD START IS NOT A ROUND NUMBER. AWS's own page on
 * stopping a cluster says a restart *"can take minutes to hours, but usually
 * takes several minutes"* — so a five-minute gap would be a schedule that
 * works most mornings, which is the worst kind. Thirty minutes is still not a
 * GUARANTEE, and the ECS side must therefore treat a database that is not yet
 * up as an ordinary start-up retry rather than as an incident. **If the `Planes`
 * slice does not build its half, the DATABASE half still works and the ECS
 * tasks simply crash-loop overnight** — see `infra/lib/data-stack.ts`, which
 * says so at length rather than implying the saving is clean.
 */
export const SHUTDOWN_TIMEZONE = 'Asia/Singapore'

/** Aurora stops. `Planes` should scale ECS to zero five minutes BEFORE this. */
export const AURORA_STOP_CRON = 'cron(0 20 ? * MON-FRI *)'
/** Aurora starts. `Planes` should scale ECS up THIRTY minutes after this. */
export const AURORA_START_CRON = 'cron(30 6 ? * MON-FRI *)'
/** What `Planes` should use, so the two slices cannot drift by five minutes. */
export const ECS_SCALE_DOWN_CRON = 'cron(55 19 ? * MON-FRI *)'
export const ECS_SCALE_UP_CRON = 'cron(0 7 ? * MON-FRI *)'
/**
 * ⚠️ THIS IS A SECOND SPELLING OF `planesStackName('staging')`, WHICH IS
 * DECLARED FURTHER DOWN THIS FILE — AND SINCE G2041 THE PIPELINE DEPENDS ON
 * THE TWO AGREEING.
 *
 * The Deploy stage names this stack in an environment variable and is fenced
 * to it by an IAM resource ARN, both built from `planesStackName(environment)`;
 * `infra/lib/app.ts` names the stack CloudFormation actually gets from the
 * constant below. **If they ever drifted, the pipeline would be fenced to a
 * stack that does not exist and every deploy would fail at `UpdateStack`** —
 * loudly, which is the right direction, and still a failure nobody chose.
 *
 * They are NOT collapsed here, because `planesStackName` is a `const` arrow
 * declared after this line and hoisting it would mean reordering a file two
 * other stacks import. **What makes it a MIRROR rather than `0002`'s
 * third-place-to-drift is an assertion in BOTH directions** —
 * `tests/infra/pipeline.test.mjs` derives the Deploy project's
 * `PLANES_STACK_NAME`, the `cloudformation:UpdateStack` resource ARN and the
 * synthesised stack's own name from the CLOUD ASSEMBLY and requires all three
 * to be one string. That is `0008`'s rule for a copy that must not drift.
 */
export const STACK_PLANES_STAGING = 'reconcile-planes-staging'

// ------------------------- the interface to the Network and Planes stacks

/**
 * 🛑 THE MIGRATE AND DEPLOY STAGES NAME RESOURCES THIS STACK DOES NOT CREATE,
 * AND THIS IS THE WHOLE OF WHAT THEY ASSUME. READ IT BEFORE WIRING EITHER SIDE.
 *
 * `docs/tech-stack.md` §7 puts the ECS cluster, the two services and the two
 * migrate task definitions in the `Planes` stack, and the subnets and the two
 * security-group pairs in `Network`. Neither is in this app yet; both are being
 * written in parallel. The join is therefore made in the one place a
 * CloudFormation dependency can be declared without a code dependency: a NAMED
 * EXPORT, imported by name.
 *
 * ⚠️ EVERY VALUE HERE IS A **NAME**, NEVER AN ARN, AND THAT IS NOT A
 * PREFERENCE. An exported task-definition ARN carries a REVISION, and a
 * revision changes every time the `Planes` stack deploys — so an IAM policy
 * fenced to an exported ARN is a policy that goes stale silently the first time
 * somebody redeploys the other stack, and `ecs run-task --task-definition <arn>`
 * would run the revision that existed when THIS stack last deployed rather than
 * the current one. A FAMILY name is stable across revisions, `run-task` against
 * a family takes the latest ACTIVE revision, and
 * `arn:…:task-definition/<family>:*` is a fence that stays true. The same
 * argument applies to the cluster and the services, whose ARNs this file
 * derives from their names beside the policy that uses them.
 *
 * ⚠️ ONE CONSTRAINT THIS PUTS ON THE OTHER STACK, STATED SO IT IS AN AGREEMENT
 * RATHER THAN A DISCOVERY: for each plane, the CONTAINER carrying the plane's
 * image must have the SAME NAME in the service task definition and in the
 * migrate task definition. One exported name is then enough for both, and the
 * container-name lookup below fails loudly if the assumption is ever false.
 */
export const PLANES_EXPORT_KEYS = [
  'ClusterName',
  'ControlMigrateTaskFamily',
  'DataMigrateTaskFamily',
  'ControlServiceTaskFamily',
  'DataServiceTaskFamily',
  'ControlServiceName',
  'DataServiceName',
  'ControlContainerName',
  'DataContainerName',
  /* ⚠️ FOUR CONTAINER NAMES, NOT TWO. The migrate containers are named
   * distinctly from the service containers because a test tells them apart by
   * name to check WHICH credentials each holds - the migrate task gets the
   * migrator secret and the service must never see it. See planes-stack.ts. */
  'ControlMigrateContainerName',
  'DataMigrateContainerName',
] as const

export type PlanesExportKey = (typeof PLANES_EXPORT_KEYS)[number]

export const NETWORK_EXPORT_KEYS = [
  'PrivateSubnetIds',
  'ControlPlaneSecurityGroupId',
  'DataPlaneSecurityGroupId',
] as const

export type NetworkExportKey = (typeof NETWORK_EXPORT_KEYS)[number]

/** The `Planes` stack for one environment. Its name is also its export prefix. */
export const planesStackName = (environment: Environment): string =>
  `reconcile-planes-${environment}`

/** The `Network` stack for one environment. Its name is also its export prefix. */
export const networkStackName = (environment: Environment): string =>
  `reconcile-network-${environment}`

/** The `Storage` stack for one environment (G287). */
export const storageStackName = (environment: Environment): string =>
  `reconcile-storage-${environment}`

export const planesExportName = (environment: Environment, key: PlanesExportKey): string =>
  `${planesStackName(environment)}-${key}`

export const networkExportName = (environment: Environment, key: NetworkExportKey): string =>
  `${networkStackName(environment)}-${key}`

// ------------------------------------------------------- the Edge (G293)

/**
 * 🛑 THE DOMAIN IS REAL AND IT IS THE FIRST THING THIS REPOSITORY OWNS THAT THE
 * WHOLE INTERNET CAN READ.
 *
 * `reconcileai.app`, registered 19 Sep 2026, auto-renew on, hosted zone
 * `Z04053259WLMQJTR30EU`. Derive both rather than trusting this comment:
 *
 *     aws route53domains list-domains --region us-east-1
 *     aws route53 get-hosted-zone --id Z04053259WLMQJTR30EU
 *
 * ⚠️ THE ZONE ID IS A LITERAL AND A HOSTED-ZONE LOOKUP IS REFUSED, which is the
 * same refusal `AWS_ACCOUNT` above already makes and for the same reason: a
 * lookup reaches AWS at SYNTH time, succeeds on a machine with credentials and
 * fails on one without, and `npm run synth:infra` passes `--no-lookups` so the
 * failure is loud. `tests/infra/manifest.test.mjs` walks every file under
 * `infra/` for that call form and fails the gate on one.
 */
export const ROOT_DOMAIN = 'reconcileai.app'
export const HOSTED_ZONE_ID = 'Z04053259WLMQJTR30EU'

/**
 * 🛑 THE CERTIFICATE'S REGION IS `us-east-1` AND IT IS THE ONE EXCEPTION TO
 * G256's REFUSAL OF THAT REGION. IT IS NAMED HERE RATHER THAN SMUGGLED.
 *
 * G256 refuses `us-east-1` on exactly one ground, and the ground is about
 * TENANTS: *"it is not a member of `model/domain.ts#RegionKey`, and a tenant may
 * not be placed in a region the residency vocabulary cannot name."* **A
 * certificate is not a tenant placement.** It holds no payload, no row and no
 * key; it is a public document in the strongest sense — see
 * `EDGE_CERTIFICATE_TRANSPARENCY` below.
 *
 * And the constraint is not ours to weigh: **CloudFront reads its viewer
 * certificate from `us-east-1` and from nowhere else**, whatever region the
 * distribution's stack is written in. A certificate issued in `us-west-2` is
 * rejected by `AWS::CloudFront::Distribution` at deploy, minutes in, with a
 * message about the ARN rather than about the region.
 *
 * ⚠️ WHAT THIS COSTS: A SECOND BOOTSTRAP. `cdk deploy` of a `us-east-1` stack
 * needs `CDKToolkit-reconcile` there; on 19 Sep 2026 only `us-west-2` was
 * bootstrapped — `/cdk-bootstrap/reconcile/version` returned 32 in `us-west-2`
 * and `ParameterNotFound` in `us-east-1`. The bootstrap is ours by qualifier
 * and creates nothing belonging to anybody else in this shared account.
 */
export const ACM_CERTIFICATE_REGION = 'us-east-1'

/**
 * ┌─ 🛑 TWO HOST GRAMMARS, AND THE DIFFERENCE BETWEEN THEM IS A SECURITY ──────┐
 * │ PROPERTY RATHER THAN A NAMING CONVENTION. G297, 19 Sep 2026.               │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ **THIS BLOCK READ *"the one name on the certificate, and the one alias on
 * the distribution"* AND ARGUED, AT LENGTH, THAT THE FLAT GRAMMAR WAS WHAT THIS
 * FILE IMPLEMENTS AND THAT *"THE OWNER OWES A RULING"*. THE RULING WAS TAKEN —
 * G297 — AND THE OLD PARAGRAPH IS CORRECTED RATHER THAN DELETED, because it is
 * the sentence a reader would have trusted and because G293's flat decision was
 * taken DELIBERATELY: it must read as AMENDED, not as a mistake erased.** What
 * it said, verbatim, so the amendment can be checked against it:
 *
 * > *"The two grammars are not both servable by this certificate, and **the
 * > flat one is what this file implements, because it is what G293 says and
 * > what the owner handed down.** What is LOST is named rather than quietly
 * > dropped: the fail-closed-at-TLS property G179 bought with the region label.
 * > **The owner owes a ruling.** The repair is additive — a second wildcard SAN
 * > `*.<region>.reconcileai.app` and a second alias."*
 *
 * **It named the repair correctly and it named the cost correctly. G297 takes
 * it, in the shape the paragraph predicted, and the repair is a second
 * CERTIFICATE rather than a second SAN — see below for why that difference is
 * forced rather than chosen.**
 *
 * 🛑 **A WILDCARD MATCHES EXACTLY ONE LABEL. THAT FACT IS THE WHOLE MECHANISM,
 * IN BOTH DIRECTIONS.**
 *
 * · `*.reconcileai.app` covers `console.reconcileai.app` and covers **no**
 *   `{tenant}.{region}.{domain}` host at all.
 * · `*.us-west-2.reconcileai.app` covers `ten-acme.us-west-2.reconcileai.app`
 *   and covers **no flat host at all** — not `ten-acme.reconcileai.app`, and
 *   not `ten-acme.eu-west-1.reconcileai.app` either.
 *
 * **That second line IS invariant 7 at the transport layer.** G179 states the
 * cost of the flat form in its own voice: *"A flat wildcard is cryptographically
 * valid in EVERY region, so an EU tenant misrouted to a US plane FAILS OPEN AND
 * IS INVISIBLE; a region label makes that misroute fail closed at TLS."* A
 * misrouted tenant cannot complete a handshake, so residency stops being an
 * application check somebody has to remember to write and starts being a
 * property of the certificate — the same posture G287 takes on erasure and the
 * same posture invariant 7 already takes on model routing.
 *
 * ⚠️ **THE REGION IS DERIVED, NOT TYPED.** `AWS_REGION` above is the one place
 * this app says which region it is in, and it is the same constant the bucket
 * names, the stack environments and the ALB ARNs are built from. A second
 * literal `'us-west-2'` here would be a copy that can disagree with the first
 * one, and the failure mode of that disagreement is a certificate that issues,
 * synthesises, deploys, and then covers nothing the planes actually serve.
 * **G183's *"one wildcard per region"* is then a `map` over regions on the day a
 * second region exists, rather than a rewrite.**
 */
export const EDGE_TENANT_WILDCARD_DOMAIN = `*.${AWS_REGION}.${ROOT_DOMAIN}`

/**
 * The FLAT wildcard. **It is no longer the tenant certificate's name, and the
 * rename is the correction.**
 *
 * ⚠️ **THIS CONSTANT WAS CALLED `EDGE_WILDCARD_DOMAIN` UNTIL 19 Sep 2026 AND
 * MEANT *"the"* WILDCARD, BECAUSE THERE WAS ONLY ONE.** There are two. The name
 * is changed rather than kept-with-a-comment precisely because a reader who
 * imports `EDGE_WILDCARD_DOMAIN` into a new file has no way to discover which
 * of the two grammars they just picked, and picking the wrong one is silent:
 * the flat one serves every tenant in every region, which is the failure G297
 * exists to end.
 *
 * **What it is FOR now: the consoles and the marketing plane.** It is the name
 * on the console certificate (`console.` and `partners.` are one label each, so
 * this wildcard covers both) and the name on the SINKHOLE DNS record described
 * in `lib/edge-stack.ts` §6.
 */
export const EDGE_FLAT_WILDCARD_DOMAIN = `*.${ROOT_DOMAIN}`

/**
 * 🛑 **WHY TWO CERTIFICATES AND NOT ONE CERTIFICATE WITH TWO NAMES. THIS IS THE
 * ONE THING A LATER READER IS MOST LIKELY TO "TIDY", AND TIDYING IT DELETES THE
 * PROPERTY.**
 *
 * One ACM certificate CAN carry both `*.us-west-2.reconcileai.app` and
 * `*.reconcileai.app`; nothing in ACM forbids it. **What forbids it is what the
 * flat name would then be valid for.** A certificate carrying the flat wildcard
 * is cryptographically valid for `ten-acme.reconcileai.app`, so the moment it
 * sits on the distribution that serves tenants, a tenant reached at a flat host
 * completes a handshake — and G179's fail-closed property is gone while every
 * file still says it is there. **The two names must be on two certificates
 * because they must be on two DISTRIBUTIONS**: CloudFront reads exactly ONE
 * viewer certificate per distribution, so one distribution cannot serve both
 * grammars without one certificate covering both.
 *
 * **G297 states the cost and accepts it:** *"Cost accepted: two certificates,
 * the flat apex and the per-region wildcard."*
 *
 * ⚠️ **AND THE CONSOLE CERTIFICATE MUST NOT BECOME THE TENANT CERTIFICATE BY
 * CONVENIENCE.** If somebody ever points the tenant distribution at the console
 * certificate to "reuse what is already issued", the handshake for
 * `ten-acme.reconcileai.app` starts succeeding again and nothing in
 * `npm run check` can see it — the template is green, the synth is green, and
 * the only witness is a `curl` against a live host. `tests/infra/edge.test.mjs`
 * §1 asserts the two distributions carry DIFFERENT certificate references for
 * exactly this reason.
 */
export const EDGE_TWO_CERTIFICATES_BECAUSE = 'CloudFront reads one viewer certificate per distribution'

/**
 * The tenant host grammar, in one function, so `{tenant}.{region}.{domain}` is
 * spelled exactly once in this repository's infrastructure.
 *
 * 🛑 **NOTHING IN `infra/` CALLS THIS WITH A REAL SLUG AND THAT IS THE POINT.**
 * G183's wildcard is what makes tenant creation *"a control-plane database act
 * with no infrastructure step and no propagation wait"* — no tenant slug passes
 * through this app at all. The function exists so that the grammar has ONE
 * declaration a reader can find, and so `tests/infra/edge.test.mjs` can assert
 * the wildcard actually covers the shape the planes will be asked to serve.
 *
 * ⚠️ **G179's RESOLUTION RULE IS UNTOUCHED BY IT: *"Resolution is a
 * CONFIGURATION LOOKUP, never a pattern."*** This builds a host from a slug; it
 * is not, and must never become, the inverse. `tenant = subdomain(host)` breaks
 * silently under G36's BYOA domains, which is why `model/serving-host.ts` holds
 * a registry rather than a regular expression.
 */
export const tenantHost = (slug: string): string => `${slug}.${AWS_REGION}.${ROOT_DOMAIN}`

/**
 * ⚠️ THE APEX IS DELIBERATELY NOT ON EITHER CERTIFICATE AND NOT ON EITHER
 * DISTRIBUTION. `reconcileai.app` — no label — is the public marketing plane,
 * and `docs/build/deploy-handoff.md` §5.4 puts it on Amplify: *"a different
 * tool for a different job."* A wildcard does not cover the apex, so the
 * absence is already true of both certificates; it is stated so a later reader
 * does not add the apex as a SAN "for completeness" and point the product's own
 * marketing site at a distribution that serves an application shell.
 *
 * 🛑 **G297's ROW SAYS *"the flat apex and the per-region wildcard"* AND THAT
 * PHRASE IS NAMED HERE RATHER THAN ACTED ON, BECAUSE IT IS THE ONE PLACE THE
 * RULING AND THIS FILE COULD BE READ AS DISAGREEING.** Read as *"the flat
 * certificate, which is the one covering the apex namespace"*, it is what this
 * file implements. Read as *"put `reconcileai.app` itself on the certificate"*,
 * it would move the marketing site onto a CloudFront distribution serving an
 * application shell — a thing no ruling asks for and `deploy-handoff.md` §5.4
 * explicitly places elsewhere. **The narrow reading is taken, the wide one is
 * named as owed, and nobody should add the apex SAN without the owner saying
 * which was meant.**
 */
export const EDGE_APEX_IS_SERVED_ELSEWHERE = true

// --------------------------------------------- the reserved labels (G179)

/**
 * 🛑 THE RESERVED LABELS. A TENANT MAY NOT BE SLUGGED ANY OF THESE, EVER, AND
 * G180 IS WHY THE LIST MUST BE RIGHT BEFORE THE FIRST TENANT RATHER THAN AFTER.
 *
 * Under G179 one host serves one tenant and the tenant's slug IS the label.
 * Under G293 one distribution answers for `*.reconcileai.app`, so **every**
 * label reaches the same edge — including labels that already mean something
 * else. A tenant slugged `console` would be handed `console.reconcileai.app`,
 * which is the staff console's host, and G180 makes that binding **permanent
 * and additive**: *"A tenant may GAIN a second host; it never MOVES between
 * hosts."* There is no migration path out of a collision, only a mass logout, a
 * broken `redirect_uri`, a changed SAML entityID and every stored absolute URL
 * orphaned — which is G180's own list of what a host move costs.
 *
 * ┌─ 🛑 G297 CHANGED WHICH NAMESPACE THIS LIST PROTECTS, AND THE PARAGRAPH ────┐
 * │ ABOVE IS NOW HISTORY. IT IS KEPT, NOT DELETED, BECAUSE IT IS THE ARGUMENT  │
 * │ THAT PUT EVERY LABEL ON THE LIST AND HALF OF IT STILL HOLDS.               │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * **The two grammars no longer share a namespace.** A tenant is
 * `{slug}.us-west-2.reconcileai.app`; a console is `console.reconcileai.app`.
 * `console.us-west-2.reconcileai.app` collides with **nothing** — it is a
 * different host in a different wildcard under a different certificate. **So
 * the specific collision this list was built to prevent — a tenant slugged
 * `console` being handed the staff console's own host — IS NOW STRUCTURALLY
 * IMPOSSIBLE THROUGH THE HOST GRAMMAR, and the list is not what prevents it.
 * The grammar is.**
 *
 * 🛑 **THE LIST IS KEPT ANYWAY, AND THE REASONS ARE NARROWER AND WORTH STATING
 * RATHER THAN LEAVING AS INERTIA:**
 *
 *  1. **It protects the FLAT namespace, which is where the platform surfaces
 *     live.** `console` and `partners` are aliases on a real distribution
 *     today; `www`, `mail`, `status` and `api` are the labels a platform
 *     surface, an MX record or a status page will want next. The list stops
 *     something ELSE claiming one, and that claim was never a tenant's to make.
 *  2. **A slug is user-visible wherever it appears, not only in a host.** A
 *     tenant called `admin` is still the label every scanner tries first and
 *     still reads as a platform surface in a URL, a log line and a support
 *     ticket, whatever namespace it sits in.
 *  3. **G36/G276's BYOA and vanity domains put a customer back in a flat
 *     namespace.** The day a tenant is served at a name it chose, the
 *     collision this list was built for returns — at somebody else's zone, and
 *     under G180's permanence.
 *
 * ⚠️ **WHAT THIS MEANS FOR THE MINT-TIME RULE G179 ASKS FOR, STATED PLAINLY SO
 * NOBODY READS THE GRAMMAR CHANGE AS HAVING CLOSED IT: the rule is now WEAKER
 * than it was and it is STILL OWED.** It was *"a tenant slugged `console` takes
 * the staff console's host"* — a correctness fence. It is now *"a tenant
 * slugged `console` is confusing, and is a live collision again the moment a
 * vanity domain exists"* — a hygiene fence with a dated fuse. It still does not
 * exist in `model/`, and downgrading a control's severity is not the same as
 * discharging it.
 *
 * G179 names six of these in its own row (`www`, `api`, `app`, `admin`,
 * `status`, `control`) and says the list *"becomes a MINT-TIME RULE on the
 * tenant slug — the same place G97 puts id-format rules, for the same
 * reason."*
 *
 * 🛑 **AND THAT MINT-TIME RULE DOES NOT EXIST. THIS CONSTANT IS THE LIST AND IT
 * IS NOT THE ENFORCEMENT, AND THE DIFFERENCE IS THE WHOLE GAP.** No tenant slug
 * passes through `infra/` at all — that is precisely what the wildcard bought,
 * and it is why onboarding is not a fifteen-minute CloudFront deploy. So
 * nothing here can refuse a tenant named `console`: the refusal belongs in
 * `model/`, beside the slug mint, and `model/` is not this slice's to write.
 * **Stated as an owed control rather than left to read as a finished one.**
 *
 * ⚠️ IT IS A TOTAL `Record`, NOT A LOOSE ARRAY, AND THAT IS WHAT MAKES IT
 * COMPILE-CHECKED RATHER THAN A REVIEW CONVENTION. `CLAUDE.md`: *"Prefer a
 * total `Record<K, V>` over a lookup function when the key set is closed. An
 * unhandled member then becomes a compile error rather than a runtime
 * surprise."* Adding a label to the tuple without saying what claims it is
 * `TS2741` at `RESERVED_LABEL_CLAIMED_BY`. The claim is not documentation — it
 * is the argument for reserving the label at all, and a label nobody can write
 * a claim for is a label nobody should be taking away from the customers.
 */
export const RESERVED_HOST_LABELS = [
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'billing',
  'cdn',
  'console',
  'control',
  'docs',
  'help',
  'login',
  'mail',
  'partners',
  'static',
  'status',
  'support',
  'www',
] as const

export type ReservedHostLabel = (typeof RESERVED_HOST_LABELS)[number]

/** What claims each label. A label with no claim is not reserved, it is taken. */
export const RESERVED_LABEL_CLAIMED_BY: Readonly<Record<ReservedHostLabel, string>> = {
  admin:
    'the label every scanner tries first; a tenant here is indistinguishable from an attack surface',
  api: 'G179 names it. The machine-facing host a customer integration would guess',
  app: 'G179 names it',
  assets: 'a static-asset host, should the bundle ever leave this distribution',
  auth: 'federation lands somewhere and G223 defers the shape; the label is held until it does',
  billing: 'invariant 5 - money is derived, and the surface showing it is not a tenant',
  cdn: 'the same claim as assets, by the name an operator reaches for',
  console:
    'THE STAFF CONSOLE. docs/contracts/administration.openapi.yaml declares its server as https://console.reconcileai.app/v1',
  control:
    'G179 names it. The control plane publishes downward (invariant 3) and a tenant may not wear its name',
  docs: 'published documentation is not a tenant',
  help: 'the same claim as support',
  login: 'the same claim as auth, by the name a person types',
  mail: 'MX, DKIM and DMARC records live under labels; a tenant here breaks mail rather than an application',
  partners:
    'THE PARTNER PORTAL. Invariant 2 is the only cross-tenant read path and its surface is not a tenant',
  static: 'the same claim as assets',
  status: 'G179 names it. A status page that is a tenant is a status page an outage takes with it',
  support: 'G60 and G75 put staff reach behind a grant; the support surface is not a tenant',
  www: 'G179 names it. The apex convention',
}

/**
 * 🛑 THE COMPILE-TIME HALF, AND IT IS THE HALF THE OWNER ASKED FOR.
 *
 * Annotating these two as `ReservedHostLabel` is not decoration: it is `TS2322`
 * the moment somebody names a console host that is NOT on the reserved list —
 * which is the exact defect this block exists to prevent, a platform surface
 * claiming a label the tenant mint would happily hand out.
 */
export const CONSOLE_HOST_LABEL: ReservedHostLabel = 'console'
export const PARTNERS_HOST_LABEL: ReservedHostLabel = 'partners'

export const CONSOLE_HOST = `${CONSOLE_HOST_LABEL}.${ROOT_DOMAIN}`
export const PARTNERS_HOST = `${PARTNERS_HOST_LABEL}.${ROOT_DOMAIN}`

/**
 * 🛑 **THE CONSOLE HOSTS CARRY NO REGION LABEL, AND THAT ABSENCE IS AN
 * ASSERTION RATHER THAN A SHORTCUT. G297, AND IT IS INVARIANT 3.**
 *
 * The region label exists to bind a **tenant's** data residency. **A console
 * has no tenant.** G297: *"A region label on a control-plane host would ASSERT
 * A RESIDENCY THE CONTROL PLANE DOES NOT HAVE, and invariant 3 says the control
 * plane holds no tenant data — so the label would be decorative in the one
 * place decoration is most likely to be read as meaning something."*
 *
 * ⚠️ **SO DO NOT "TIDY" THE TWO GRAMMARS INTO ONE.** Two host shapes in one
 * product reads like an oversight and it is the opposite: making the consoles
 * `console.us-west-2.reconcileai.app` would publish a residency claim for a
 * plane that stores no tenant row, and the first auditor to read it would be
 * entitled to ask which tenants' data lives in it. The answer is *none*, and a
 * hostname that cannot say *none* should not be making the claim.
 *
 * ⚠️ **AND IT IS NOT MERELY DECORATIVE — IT IS ALSO WRONG ABOUT REACH.** Under
 * G193 the control plane publishes downward to EVERY region; a region label
 * would say the opposite, that this console is the `us-west-2` one, and would
 * invite a second console per region that invariant 3 gives no reason to want.
 */
export const EDGE_CONSOLE_HOSTS = [CONSOLE_HOST, PARTNERS_HOST] as const

/**
 * Whether a would-be tenant label collides with a reserved one.
 *
 * Case is folded because DNS is case-insensitive and a slug is not: `Console`
 * and `console` are ONE host and TWO tenant ids, which is the `ten_acme` versus
 * `ten_ACME` problem G97 already records as a mint-time rule rather than a
 * column constraint.
 */
export const isReservedHostLabel = (label: string): boolean =>
  (RESERVED_HOST_LABELS as readonly string[]).includes(label.trim().toLowerCase())

// ----------------------------------------------- Edge stacks and names

export const STACK_EDGE_CERTIFICATE_STAGING = 'reconcile-edge-certificate-staging'
export const STACK_EDGE_STAGING = 'reconcile-edge-staging'

/**
 * The bucket holding the FRONTEND BUNDLE.
 *
 * ⚠️ IT IS NOT `objectBucketName()`. That one holds tenant payloads, blocks all
 * public access and is reachable by one IAM role; this one holds
 * `frontend/dist` and is read by a distribution the whole internet can reach.
 * `lib/storage-stack.ts` says the same thing from the other side. The account
 * and region are in the name for the reason stated there: an S3 bucket name is
 * global and every other name in this file is not.
 */
export const frontendBucketName = (environment: Environment): string =>
  `reconcile-${AWS_ACCOUNT}-${AWS_REGION}-${environment}-frontend`

/**
 * The `Edge` stack for one environment. Its name is also its export prefix.
 */
export const edgeStackName = (environment: Environment): string =>
  `reconcile-edge-${environment}`

/**
 * 🛑 D6-4, 22 Sep 2026 — THE RATE-LIMITING WEB ACL'S NAME, AND WHY IT LIVES ON
 * THIS HELPER RATHER THAN LETTING CLOUDFORMATION MINT ONE.
 *
 * `AWS::WAFv2::WebACL` generates a name from the stack name plus the logical
 * id plus a random suffix when `Name` is omitted — the exact trap
 * `spaRewriteFunctionName()` documents for a CloudFront function two
 * constants above this one. A WAF WebACL's name is unique per (account,
 * region, SCOPE) rather than merely per account-region, and `CLOUDFRONT`
 * scope WebACLs are visible only from `us-east-1` regardless of which
 * distribution they protect — so an explicit, derivable name is what lets a
 * person find this resource in the console without reading a CloudFormation
 * event log first.
 */
export const edgeRateLimitWebAclName = (environment: Environment): string =>
  `reconcile-${environment}-plane-rate-limit`

/**
 * 🛑 G992, 20 Sep 2026 — WHAT THE DEPLOY STAGE'S FRONTEND HALF NEEDS FROM THE
 * `Edge` STACK, AND WHY IT IS **ONE** VALUE PER DISTRIBUTION AND NOT THREE.
 *
 * `PLANES_EXPORT_KEYS` above argues NAMES, NEVER ARNs, at length. **The BUCKET
 * obeys that rule without an export at all**: `frontendBucketName()` is a pure
 * function of the environment, spelled once here and read by both the stack
 * that creates it and the stage that syncs into it — which is exactly the
 * by-NAME join `planeRoleName()` already makes between `Storage` and `Planes`,
 * and it costs no CloudFormation dependency in either direction.
 *
 * **A CLOUDFRONT DISTRIBUTION ID IS THE ONE VALUE THIS APP CANNOT SPELL.** It
 * is minted by CloudFront, it appears in no name this file controls, and
 * `cloudfront create-invalidation` takes it and nothing else. The alternatives
 * were each refused:
 *
 *   · **`aws cloudfront list-distributions` at deploy time, matching on the
 *     alias.** It needs `cloudfront:ListDistributions` on `*` — the action
 *     takes no resource — which hands the pipeline a reader of every
 *     distribution in a SHARED account (G256), to avoid one export. And it
 *     fails SOFT: a filter that matches nothing invalidates nothing and exits
 *     0, which is `docs/HANDOFF.md` §5.6 on the one step whose whole purpose
 *     is that the new bundle is actually served.
 *   · **A construct reference from `Edge` into `Pipeline`.** Both stacks are
 *     instantiated in `lib/app.ts`, so this would type-check — and it would
 *     make CDK mint the export anyway, under a generated name nobody can read
 *     in the console, while adding a code dependency between a pipeline and an
 *     edge. The named export is the same mechanism with a legible name.
 *
 * ⚠️ THE PRICE IS A DEPLOY ORDER, AND IT IS THE ONE `pipeline-stack.ts`
 * ALREADY PAYS FOR `Planes` AND `Network`: **`reconcile-edge-staging` must be
 * deployed once more to PUBLISH these exports before `reconcile-pipeline-staging`
 * can deploy against them**, or the deploy stops with
 * `No export named reconcile-edge-staging-TenantDistributionId found`.
 * `Fn::ImportValue` is resolved at DEPLOY time, so `cdk synth` stays offline
 * and G108 is untouched.
 *
 * 🛑 TWO DISTRIBUTIONS, AND LEAVING ONE OUT IS A SILENT DEFECT RATHER THAN A
 * MISSING FEATURE. G297 split the edge into a TENANT distribution and a
 * CONSOLE one, and **both serve the SAME bucket**. A sync that invalidated
 * only the tenant distribution would leave `console.reconcileai.app` and
 * `partners.reconcileai.app` serving the PREVIOUS `index.html` — which
 * references hashed asset filenames the sync has just deleted — until a cache
 * entry aged out. Two ids, both required by a `test -n` guard.
 */
export const EDGE_EXPORT_KEYS = [
  'TenantDistributionId',
  'ConsoleDistributionId',
] as const

export type EdgeExportKey = (typeof EDGE_EXPORT_KEYS)[number]

export const edgeExportName = (environment: Environment, key: EdgeExportKey): string =>
  `${edgeStackName(environment)}-${key}`

/**
 * The SPA-rewrite CloudFront function's name.
 *
 * 🛑 SET EXPLICITLY, AND IT IS TRAP 6 OF `docs/build/deploy-handoff.md` §3
 * ARRIVING AT A SECOND SERVICE: *"CDK derives the hosted rotation Lambda's name
 * from the CONSTRUCT PATH, and it came out at 76 characters against Lambda's
 * limit of 64 — in a nested stack, minutes in."* A CloudFront function's name
 * is derived the same way and is account-globally unique, so a construct rename
 * would not merely change a name — it would try to CREATE a second function
 * while the first still holds the old one.
 *
 * `tests/infra/edge.test.mjs` asserts the limit rather than trusting this line.
 */
export const spaRewriteFunctionName = (environment: Environment): string =>
  `reconcile-${environment}-spa-rewrite`

/**
 * 🛑 THE PATH PATTERNS THAT REACH A PLANE, AND THEY ARE THE CONTRACTS' OWN.
 *
 * ┌─ ⚠️ THIS WAS `EDGE_API_PATH_PATTERN`, ONE STRING, `'/v1/*'`, AND IT IS ────┐
 * │ CORRECTED RATHER THAN DELETED BECAUSE THE SENTENCE IT CARRIED WAS TRUE AND │
 * │ THE CONCLUSION DRAWN FROM IT WAS NOT. **`/v1` IS ONE TIER'S BASE PATH, NOT │
 * │ THE SERVED SURFACE.** `basePathOf()` (`server/contract/document.ts`) strips │
 * │ the authority from a tier's FIRST `servers[].url`, so                      │
 * │ `capability.openapi.yaml` (`https://{dataPlaneHost}/v1`) serves under       │
 * │ `/v1` while `foundation.openapi.yaml` and `session.openapi.yaml`           │
 * │ (`local://in-process`) serve at the ROOT. **So `POST /context/resolve` -   │
 * │ D1, the operation that binds a session to a tenant - was unreachable from  │
 * │ the internet from the day this stack was deployed.** Measured against AWS  │
 * │ on 20 Sep 2026, not reasoned:                                              │
 * │                                                                            │
 * │   POST https://ten-acme.us-west-2.reconcileai.app/context/resolve          │
 * │     -> 403 text/html                  (CloudFront, no origin for the path) │
 * │   POST https://ten-acme.us-west-2.reconcileai.app/v1/runs                  │
 * │     -> 401 application/problem+json   (the plane's own authenticator)      │
 * │                                                                            │
 * │ G1011, 20 Sep 2026. **DERIVED, NOT THE OWNER'S.**                          │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 **A CATCH-ALL IS THE WRONG REPAIR AND IT IS REFUSED BY A FUNCTION RATHER
 * THAN BY A PARAGRAPH.** `data-plane-local.openapi.yaml` ALSO serves at the
 * root - `/health`, `/status`, `/metrics` - and `checkLocalHealth` is mounted,
 * so `/*` would publish the plane's operational surface to the internet.
 * `assertPublishesNoLocalOperation()` below throws at synth on any pattern that
 * would, and `EdgeStackProps.extraPlanePathPatterns` exists so that guard has a
 * call site a fixture can witness RED.
 *
 * ⚠️ **THIS LINE READ *"AND WHY THERE ARE THREE"* UNTIL 20 Sep 2026 AND
 * ENUMERATED FOUR IMMEDIATELY BELOW IT — G1092.** It is corrected rather than
 * deleted because it is the sentence a reader auditing what this product
 * publishes to the internet would have counted from, on the one constant where
 * an extra member is a decision about what is public. The fourth entry,
 * `/session/*`, has carried its own argument since the day it was added; only
 * the word above it was wrong. **Derive it, never read it:**
 *
 *     grep -oE "'/[^']*'" <(grep 'EDGE_PLANE_PATH_PATTERNS = \[' infra/lib/config.ts) | wc -l
 *
 * and against the DEPLOYED distribution rather than the source, read-only:
 *
 *     AWS_PROFILE=crm-frontend aws cloudfront get-distribution-config \
 *       --id E37L34MTF5K0VB \
 *       --query 'DistributionConfig.CacheBehaviors.Items[].PathPattern'
 *
 * **WHAT EACH PATTERN IS, AND WHY THERE ARE FOUR:**
 *   `/v1/*`       the CAPABILITY tier's base path - twenty-two of the
 *                 twenty-three served operations.
 *   `/context/*`  the FOUNDATION tier at the root. `resolveTenantContext` is
 *                 the one operation of that tier this plane mounts, and it is
 *                 D1. Derive: `grep -rn 'handlers:' server/data-plane/start.ts`.
 *   `/session`    the SESSION tier's own collection path. 🛑 **IT IS A SECOND
 *                 PATTERN BECAUSE A PREFIX PATTERN MISSES IT, AND THAT WAS
 *                 FOUND BY DERIVING THE SET RATHER THAN BY READING IT.**
 *                 CloudFront's `/session/*` does not match `/session`, exactly
 *                 as `/v1/*` does not match `/v1` - and `session.openapi.yaml`
 *                 declares all three of `/session`, `/session/realm` and
 *                 `/session/federated`. A single prefix pattern would have left
 *                 the bare one on the BUNDLE, which is the same defect this
 *                 slice is repairing, one path deep. `tests/e2e/single-origin-
 *                 routing.test.ts` is what caught it, on its first run.
 *   `/session/*`  the rest of that tier. ⚠️ **NOTHING MOUNTS IT TODAY AND IT IS
 *                 ROUTED ANYWAY, WHICH IS ARGUED RATHER THAN ASSUMED.** An edge
 *                 behaviour is not a privilege: it confers no read, and the
 *                 plane's own router answers an unmounted operation with the
 *                 honest 404 G191 describes. Not routing it is strictly worse -
 *                 the SPA-rewrite function turns `/session/federated` into
 *                 `index.html`, so a sign-in callback would be answered by the
 *                 BUNDLE with a 200. And a CloudFront behaviour is the slowest
 *                 thing in this repository to change: the alternative is a
 *                 distribution deploy standing between a merged sign-in flow
 *                 and a working one.
 *
 * 🛑 **THE HONEST LONGER REPAIR IS NOT TAKEN HERE AND IT IS AN OWNER'S RULING:
 * give the foundation and session tiers a REAL BASE PATH so every served
 * operation sits under one prefix.** It would make this constant one string
 * again and make the edge unable to be wrong. Its cost is that it MOVES URLs
 * the frontend, `tests/e2e/single-origin.ts` and every future client already
 * use, and it edits two contract documents - which is contract surgery, and
 * this record's word for that is a ruling. **Named, argued, not taken.**
 *
 * ⚠️ `lib/planes-stack.ts` REFUSES A PATH-PREFIX RULE ON THE ALB AND THIS IS
 * NOT THAT REFUSAL BEING OVERTURNED. Its argument is about telling the two
 * PLANES apart — *"THE PORT IS NOT A PREFIX … a rule matching `/v1/*` to the
 * data plane is correct until somebody adds a control-plane operation under a
 * prefix nobody re-read"* — and the fence it protects is invariant 3. Here the
 * pattern separates THE BUNDLE from THE API: two origins that are not two
 * planes, whose failure mode is a 404 rather than a control-plane request
 * served by a data-plane task. **The control plane is not an origin on this
 * distribution at all**, which is what keeps that fence untouched; see
 * `edge-stack.ts`.
 */
export const EDGE_PLANE_PATH_PATTERNS = ['/v1/*', '/context/*', '/session', '/session/*'] as const

/**
 * ┌─ 🛑 THE **CONSOLE** DISTRIBUTION'S PLANE PATTERNS. ONE, AND THE ONE IS THE ┐
 * │ WHOLE DECISION. G1949, 22 Sep 2026, under the owner's S7 ruling.           │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * The owner's ruling: **the marketing plane is on Amplify at the apex, and
 * `/lookup` proxies SAME-ORIGIN to the data plane THROUGH THE CONSOLE
 * CLOUDFRONT DISTRIBUTION.** So that distribution gains a plane origin, and
 * the question this constant answers is WHICH PATHS reach it.
 *
 * 🛑 **IT IS NOT `EDGE_PLANE_PATH_PATTERNS` AND REUSING THAT LIST WOULD BE A
 * DEFECT RATHER THAN A SHORTCUT.** Those four patterns publish the CAPABILITY
 * tier (`/v1/*`) and D1 (`/context/*`) — every tenant-scoped operation this
 * product serves — and the console hosts are **flat**: `console.reconcileai.app`
 * carries no tenant label, and `resolveServingHost()` is a LOOKUP over the
 * tenant registry (G179) which would resolve nothing.
 *
 * ⚠️ **THIS PARAGRAPH ENDED *"and G180 **revokes the session** on a host
 * mismatch on every request. Pointing the tenant surface at a console host
 * would therefore not merely 404 — it would sign people out."* THAT REASON IS
 * WRONG AND IS CORRECTED RATHER THAN DELETED, because it was repeated in four
 * places and is the sentence a reader would have quoted onward. G1991,
 * 22 Sep 2026.**
 *
 * **NOBODY WOULD BE SIGNED OUT. TRACE IT:**
 *
 *   1. The session handle travels in `__Host-reconcile_session`, and the
 *      `__Host-` prefix forbids a `Domain` attribute — so the cookie is
 *      **HOST-ONLY at the user agent** (`server/data-plane/session-cookie.ts`
 *      argues this at length as a control). **A tenant host's cookie is never
 *      sent to a console host by any browser.**
 *   2. So the request arrives carrying no session at all, `authenticate()`
 *      answers `null`, and the `onRequest` hook returns **401
 *      `session_invalid`** — before validation, before any handler, and
 *      **before anything reads a host**.
 *   3. G180 therefore never runs on that request. And when it does run, on a
 *      CONSOLE session presented at the console host that issued it,
 *      `checkHostBinding()` compares two strings that MATCH — so there is no
 *      mismatch and no revoke.
 *   4. A caller who got past authentication would meet
 *      `resolveTenantContextHandler`, which answers **403
 *      `tenant_context_missing`** for a host the registry does not carry.
 *
 * **So the true failure is 401, then 403 — a 404-shaped outcome, exactly the
 * thing the old sentence said it was *"not merely"*.** The wrong reason
 * mattered because it made the decision look like it rested on a session
 * safety property; it does not, and a reader who tested that property would
 * have found it false and concluded the constant was over-cautious.
 *
 * 🛑 **THE DECISION IS UNCHANGED AND THE DECISIVE ARGUMENT IS THE SPA REWRITE,
 * BELOW.** `SpaRewrite` rewrites any URI whose final segment has no dot to
 * `/index.html`, so a pattern routed here that the plane does not serve is
 * answered **by the BUNDLE, with a 200 and an HTML body** — not a 404. That is
 * a real defect, it is measured from the function's own rule, and it is why
 * this list is one exact path rather than four patterns.
 *
 * ⚠️ **AND `/session` IS NOT HERE EITHER, THOUGH THE OPERATION SERVED IS ON
 * THAT TIER.** `GET /session` and `DELETE /session` override the document's
 * `security: []` with `sessionContext`, so they are the two person-facing
 * exemptions `EXEMPT_WITH_A_PERSON_TO_ASK.session` counts — and neither is
 * mounted. Routing the bare path would publish nothing today and would publish
 * a session read at a host G180 cannot bind, on the day somebody mounts one.
 *
 * 🛑 **SO IT IS THE EXACT PATH AND NOT A PREFIX.** `/session/realm` and not
 * `/session/*`: the prefix form would carry `/session/federated` with it, and
 * `completeFederatedSignIn` is the operation that MINTS a session — the one
 * whose host binding G315 rules is *"the TENANT host and nowhere else"*. An
 * edge behaviour is not a privilege and would only 404 today, but it is also
 * the slowest thing in this repository to change, and the failure it would
 * hide arrives the day that operation is mounted rather than the day the
 * pattern is written.
 *
 * ⚠️ **THE SPA-REWRITE FUNCTION IS WHY AN ABSENT BEHAVIOUR IS WORSE THAN A
 * 404 HERE, AND IT IS MEASURED FROM THE FUNCTION'S OWN RULE RATHER THAN
 * GUESSED.** `edge-stack.ts`'s `SpaRewrite` rewrites any URI whose final
 * segment has no dot in it to `/index.html`. `realm` has no dot. **So without
 * this behaviour, `POST /session/realm` on a console host is answered by the
 * BUNDLE with a 200 and an HTML body** — the exact defect `EDGE_PLANE_PATH_
 * PATTERNS`'s `/session/*` entry was added for, one path deep and on the other
 * distribution.
 *
 * 🛑 **IT GOES THROUGH `assertPublishesNoLocalOperation()` LIKE THE OTHER
 * LIST**, and that is not ceremony: `/health`, `/status` and `/metrics` sit at
 * the ROOT of the same process, so a future widening here publishes them to
 * the internet exactly as a widening there would. One guard, two call sites.
 */
/**
 * ┌─ ✅ G2770 — THE OWNER'S RULING, 2 Oct 2026, AND THE ONE-PATH LIST ABOVE IS ┐
 * │ CORRECTED RATHER THAN DELETED                                             │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * *"Yes — route the full sign-in paths (/session/*, /signin/callback, and the
 * consoles' served /v1 operations) on console.reconcileai.app and
 * partners.reconcileai.app to the data plane, under the existing WAF rate
 * rule."*
 *
 * THE ARGUMENT ABOVE IS ANSWERED, NOT REFUTED. It refused `/session/*` because
 * *"`completeFederatedSignIn` is the operation that MINTS a session — the one
 * whose host binding G315 rules is the TENANT host and nowhere else"*; G726
 * puts console sessions on the data plane, tenant-less, and G2549 binds every
 * mint to the host it was begun on, so a console host minting a console
 * session is the shape those rulings built. It refused the four-pattern list
 * because of the SPA rewrite; that hazard is a pattern the plane does NOT
 * serve, and every pattern here is one the plane does serve (`/context/*` is
 * D1, whose console arm resolves a console surface; `/v1/*` is every tier the
 * consoles' operations are mounted on).
 *
 * ⚠️ `/signin/callback` IS NOT IN THIS LIST AND ROUTING IT TO THE PLANE WOULD
 * BREAK IT: it is the SPA's own route — the screen that reads `code` and
 * `state` and holds the PKCE verifier — on every distribution, and the plane
 * serves no such path. The ruling's intent ("the full sign-in paths") is met by
 * the SPA serving `/signin/callback` and the plane serving `/session/*`, which
 * is exactly the tenant distribution's shape.
 *
 * 🛑 AND THE WAF RULE NOW COVERS THIS DISTRIBUTION TOO — `edge-stack.ts` sets
 * `webAclId` on both, and `assertRateLimitCoversEveryPlanePattern()` checks
 * both lists, because a console plane path now reaches the same pooled
 * database connections D6-4 measured.
 */
export const EDGE_CONSOLE_PLANE_PATH_PATTERNS = ['/v1/*', '/context/*', '/session', '/session/*'] as const

/**
 * 🛑 THE PATHS THE DATA PLANE SERVES THAT MUST NEVER LEAVE THE VPC, BY NAME.
 *
 * `docs/contracts/data-plane-local.openapi.yaml` declares its server as
 * `http://localhost:9090` - no base path at all - so its three operations sit
 * at the ROOT of the same process the tenant surface sits in, and
 * `checkLocalHealth` is MOUNTED. Derive both, do not trust this line:
 *   grep -nE '^  /' docs/contracts/data-plane-local.openapi.yaml
 *   grep -rn 'dataPlaneLocal' server/data-plane/start.ts
 *
 * **They are an OPERATIONAL surface for a load balancer and for whatever
 * scrapes a metric, not a product surface**, and a CloudFront behaviour that
 * published them would put the plane's own status and its metrics in front of
 * the entire internet with no session, no capability gate and no invariant 10
 * record. `assertPublishesNoLocalOperation()` below is the executable form of
 * that sentence, and `infra/test-fixtures/edge-catch-all.ts` witnesses it
 * refusing.
 *
 * ⚠️ **IT IS A HAND-TYPED COPY OF A CONTRACT DOCUMENT AND THEREFORE A THING
 * THAT CAN DRIFT — SAID HERE RATHER THAN LEFT TO BE FOUND.** `infra/` may not
 * read `docs/contracts/` at synth: `cdk synth` is in the gate under G108 and
 * must stay deterministic and offline, and a stack that parses YAML at synth is
 * a second contract reader beside `server/contract/document.ts`, which is the
 * one thing G191 says there must not be. **The DERIVED half lives in
 * `tests/e2e/single-origin-routing.test.ts` §1**, which reads this tier's paths
 * out of the document at test time and requires none of them to reach the
 * plane — so a FOURTH local operation is caught by the test even though this
 * list has not heard of it. Neither half is sufficient; both are cheap.
 */
export const EDGE_LOCAL_ONLY_PATHS = ['/health', '/status', '/metrics'] as const

/**
 * ┌─ 🛑 CLOUDFRONT'S PATH-PATTERN SEMANTICS, VERIFIED AGAINST AWS'S OWN ───────┐
 * │ DOCUMENTATION AND QUOTED HERE, BECAUSE THE GUARD BELOW IS WORTH EXACTLY   │
 * │ THE SEMANTICS THIS FUNCTION REPRODUCES AND NOTHING MORE.                  │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * **Source, read 20 Sep 2026:** *Amazon CloudFront Developer Guide*, "Cache
 * behavior settings" → **Path pattern** and its **Path normalization**
 * subsection —
 * `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistValuesCacheBehavior.html`.
 * The five sentences this function is built on, VERBATIM:
 *
 *   1. *"You can optionally include a slash (/) at the beginning of the path
 *      pattern, for example, `/images/*.jpg`. **CloudFront behavior is the same
 *      with or without the leading /.** If you don't specify the / at the
 *      beginning of the path, this character is automatically implied;
 *      CloudFront treats the path the same with or without the leading /. For
 *      example, CloudFront treats `/*product.jpg` the same as `*product.jpg`"*
 *   2. *"`*` matches 0 or more characters."*
 *   3. *"`?` matches exactly 1 character."*
 *   4. *"Path patterns are case-sensitive, so the path pattern `*.jpg` doesn't
 *      apply to the file `LOGO.JPG`"* — and *"CloudFront does not consider
 *      query strings or cookies when evaluating the path pattern."*
 *   5. *"CloudFront normalizes URI paths consistent with RFC 3986 and then
 *      matches the path with the correct cache behavior. After the cache
 *      behavior is matched, CloudFront sends the raw URI path to the origin …
 *      Some characters are normalized and removed from the path, such as
 *      multiple slashes (`//`) or periods (`..`)."*
 *
 * ┌─ 🛑 THIS FUNCTION ANCHORED THE PATTERN AS SPELLED UNTIL 20 Sep 2026 AND ───┐
 * │ THAT IS `docs/HANDOFF.md` §5.1 ARRIVING INSIDE THE FENCE WRITTEN TO       │
 * │ PREVENT IT — **G1091**, and the paragraph that stood here said so about a │
 * │ different rule while being that rule.                                     │
 * │                                                                           │
 * │ It read: *"A rule keyed on the spelling `/*` instead would admit `/he*`   │
 * │ and `/*ealth`, which is `docs/HANDOFF.md` §5.1 arriving inside the fence  │
 * │ written to prevent it."* **True, and it was keyed on a spelling one       │
 * │ character narrower:** the LEADING SLASH. Sentence 1 above says CloudFront │
 * │ implies it and this did not, so every pattern whose first character was a │
 * │ literal walked through the guard. **Measured, not reasoned** — six        │
 * │ spellings ACCEPTED by the guard that CloudFront routes `/health` to:      │
 * │                                                                           │
 * │     ACCEPTED "health"    CloudFront-would-route: ["/health"]              │
 * │     ACCEPTED "status"    CloudFront-would-route: ["/status"]              │
 * │     ACCEPTED "metrics"   CloudFront-would-route: ["/metrics"]             │
 * │     ACCEPTED "he*"       CloudFront-would-route: ["/health"]              │
 * │     ACCEPTED "h*"        CloudFront-would-route: ["/health"]              │
 * │     ACCEPTED "hea?th"    CloudFront-would-route: ["/health"]              │
 * │     REFUSED  "/h*"       CloudFront-would-route: ["/health"]              │
 * │                                                                           │
 * │ `/h*` refused and `h*` served, for the same CloudFront behaviour, one     │
 * │ character apart. All six are REFUSED now and                             │
 * │ `tests/infra/edge.test.mjs` §2 carries the captured before/after.         │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ IT IS A MATCHER AND NOT A VALIDATOR, and it is keyed on the question the
 * guard has to ask — *"would CloudFront route this request to this
 * behaviour"* — rather than on how the pattern is spelled.
 */
export function edgePatternMatches(pattern: string, path: string): boolean {
  const glob = withImpliedLeadingSlash(pattern)
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const expression = escaped.replace(/\*/g, '.*').replace(/\?/g, '.')
  /* NO `i` FLAG, AND THE ABSENCE IS THE DECISION. Sentence 4: patterns are
   * case-sensitive. Case-folding here would REFUSE `/Health*`, which publishes
   * nothing — `server/http/app.ts` builds Fastify with its default
   * `caseSensitive: true`, measured at `GET /HEALTH` -> 404 — so folding would
   * be a rule keyed on a resemblance rather than on the property. */
  return new RegExp(`^${expression}$`).test(normaliseEdgeRequestPath(path))
}

/** Sentence 1: the leading `/` is implied when a pattern does not carry one. */
function withImpliedLeadingSlash(pattern: string): string {
  return pattern.startsWith('/') ? pattern : `/${pattern}`
}

/**
 * RFC 3986's UNRESERVED set — `ALPHA / DIGIT / "-" / "." / "_" / "~"`.
 *
 * 🛑 IT IS THE UNRESERVED SET AND NOT "ANY PERCENT-ENCODING", WHICH IS WHAT
 * KEEPS THIS FROM MANUFACTURING A WILDCARD. RFC 3986 §6.2.2.2 normalises
 * percent-encodings of unreserved characters and of nothing else, so `%2A`
 * stays `%2A` and never becomes a `*` this matcher would then honour.
 */
const UNRESERVED = /^[A-Za-z0-9\-._~]$/

function decodeUnreservedPercentEncodings(value: string): string {
  return value.replace(/%[0-9A-Fa-f]{2}/g, (escape) => {
    const decoded = String.fromCharCode(Number.parseInt(escape.slice(1), 16))
    return UNRESERVED.test(decoded) ? decoded : escape
  })
}

/** RFC 3986 §5.2.4, `remove_dot_segments`, transcribed. */
function removeDotSegments(path: string): string {
  const out: string[] = []
  let input = path
  while (input.length > 0) {
    if (input.startsWith('../')) input = input.slice(3)
    else if (input.startsWith('./')) input = input.slice(2)
    else if (input === '/.') input = '/'
    else if (input.startsWith('/./')) input = `/${input.slice(3)}`
    else if (input === '/..') {
      out.pop()
      input = '/'
    } else if (input.startsWith('/../')) {
      out.pop()
      input = `/${input.slice(4)}`
    } else if (input === '.' || input === '..') input = ''
    else {
      const next = input.indexOf('/', 1)
      out.push(next === -1 ? input : input.slice(0, next))
      input = next === -1 ? '' : input.slice(next)
    }
  }
  return out.join('')
}

/**
 * The path CloudFront MATCHES against, which is not the path the viewer sent.
 *
 * Sentence 5: *"CloudFront normalizes URI paths consistent with RFC 3986 and
 * then matches the path with the correct cache behavior."* So a matcher that
 * compares a pattern to the RAW path answers a question CloudFront never asks.
 *
 * ⚠️ **THE `%68` CASE IS THE ONE THAT MATTERS AND IT IS MEASURED AT THE
 * ORIGIN, NOT ASSUMED AT THE EDGE:** `GET /%68ealth` against a Fastify plane
 * declaring `/health` answers **200**. So if CloudFront did NOT decode it, the
 * request would fall to the bundle behaviour and reach nobody; because it does,
 * the pattern that matches `/health` also routes `/%68ealth`, and the plane
 * serves it. Either reading is covered — this decodes, and
 * `assertPublishesNoLocalOperation()` additionally refuses the encoded PATTERN
 * spelling, so the guard is fail-closed under both.
 */
export function normaliseEdgeRequestPath(path: string): string {
  return removeDotSegments(decodeUnreservedPercentEncodings(path.replace(/\/{2,}/g, '/')))
}

/**
 * 🛑 THE GUARD. It throws, at synth, on a pattern that would publish an
 * operation `data-plane-local.openapi.yaml` declares.
 *
 * ⚠️ IT IS KEYED ON THE PROPERTY AND NOT ON THE LANDMARK, and that is the whole
 * of it: a catch-all is refused BECAUSE `/*` matches `/health`, never because
 * it is spelled `/*`. So `/*`, `/**`, `/h*`, `/health`, `/*ealth` — **and
 * `health`, `he*`, `h*` and `hea?th`, which this guard ACCEPTED until
 * 20 Sep 2026 (G1091)** — are all refused by ONE rule.
 *
 * 🛑 **IT IS DELIBERATELY WIDER THAN `edgePatternMatches()` IN TWO PLACES, AND
 * BOTH WIDENINGS ARE FAIL-CLOSED RATHER THAN FAITHFUL.** A matcher must model
 * CloudFront; a guard must refuse anything it cannot prove safe, and the two
 * are not the same duty:
 *
 *   · **the percent-decoded spelling of the PATTERN.** CloudFront normalises
 *     the REQUEST; whether it also normalises a configured PATTERN is not
 *     stated anywhere in the guide. If it does not, `/%68ealth` matches nothing
 *     and refusing it costs a pattern nobody would write. If it does, accepting
 *     it publishes `/health`. Only one of those two mistakes is recoverable.
 *   · **the TRAILING-SLASH form of each local path.** `GET /health/` is a
 *     **404** at the plane today — measured against Fastify, whose default is
 *     `ignoreTrailingSlash: false` — so `/health/` as a pattern publishes
 *     nothing *today*. That is a fact about one Fastify option in
 *     `server/http/app.ts`, not about the edge, and this guard must not be one
 *     `Fastify({ ignoreTrailingSlash: true })` away from being wrong.
 */
export function assertPublishesNoLocalOperation(pattern: string): void {
  /* Both spellings of the pattern, against both request forms of each
   * operation. The OPERATION is what gets named in the refusal — a reader must
   * learn which surface would be published, not which variant string matched. */
  const spellings = [...new Set([pattern, decodeUnreservedPercentEncodings(pattern)])]
  const published = EDGE_LOCAL_ONLY_PATHS.filter((path) =>
    [path, `${path}/`].some((request) =>
      spellings.some((spelling) => edgePatternMatches(spelling, request)),
    ),
  )
  if (published.length === 0) return
  throw new Error(
    `Edge: the path pattern '${pattern}' routes ${published.join(', ')} to the data plane, and ` +
      'each of those is a data-plane-local.openapi.yaml operation - the plane process own ' +
      'health, status and metrics, declared at the ROOT because that document has no base path. ' +
      'They are served to a load balancer inside the VPC and must not be served to the internet: ' +
      'there is no session on them, no capability gate and no invariant 10 record. Route the ' +
      'tenant-facing prefixes EXPLICITLY - EDGE_PLANE_PATH_PATTERNS, above - and leave everything ' +
      'else on the bundle origin. A catch-all is the one repair that must not be taken. ' +
      'CloudFront implies a leading slash, so a pattern spelled without one is the same ' +
      "behaviour: 'health' and '/health' are one pattern, not two.",
  )
}

/**
 * 🛑 CERTIFICATE TRANSPARENCY, AND THE CONCLUSION IS THAT THE WILDCARD IS THE
 * ONLY SHAPE THAT DOES NOT PUBLISH THE CUSTOMER LIST.
 *
 * 🛑 **READ G297 BEFORE QUOTING ANY SENTENCE BELOW AS THE REASON FOR THE
 * WILDCARD. THE OWNER CORRECTED THIS BLOCK'S EMPHASIS IN THE RULING ITSELF, AND
 * THE CORRECTION IS AGAINST THE ORCHESTRATOR'S OWN REASONING RATHER THAN A
 * BUILDER'S:** *"G293's PR AND ITS SUMMARY PRAISED CERTIFICATE TRANSPARENCY AS
 * THE WIN — AND G183 HAD ALREADY REFUTED THAT, IN THESE WORDS: 'CERTIFICATE
 * TRANSPARENCY IS NOT THE JUSTIFICATION, AND ANY DOCUMENT SAYING SO IS
 * WRONG.'"*
 *
 * **What survives, stated the narrow way G297 states it:** the wildcard *"keeps
 * the customer list out of an APPEND-ONLY PUBLIC INDEX, which is a
 * bulk-disclosure property and not an anonymity one. Bulk disclosure and
 * per-guess disclosure are two threats and only the first is addressed."* The
 * paragraphs below already say that at their foot; the ordering is corrected
 * here so nobody reads the first sentence and stops. **The certificate's REAL
 * first-order justification is G183's operational one — a tenant is created
 * without writing DNS or issuing a certificate — and, since G297, the region
 * label's fail-closed handshake.**
 *
 * ⚠️ **AND ONE THING BELOW IS NOW FACTUALLY NARROWER.** The block argues as
 * though there is ONE wildcard. There are two, and the CT consequence differs:
 * `*.us-west-2.reconcileai.app` publishes that this product serves tenants in
 * `us-west-2`; `*.reconcileai.app` publishes that it serves subdomains. **The
 * per-region wildcard therefore publishes ONE FACT MORE than the flat one did —
 * the region roster — and that is a disclosure G297 accepts in exchange for the
 * fail-closed handshake.** It publishes no customer either way.
 *
 * Every certificate ACM issues is logged to public, append-only Certificate
 * Transparency logs. They are world-readable, permanent and indexed —
 * `crt.sh?q=%25.reconcileai.app` needs no credential and no relationship with
 * this account. **A per-tenant SAN is therefore a tenant enumeration in the
 * clear**, which is word for word the disclosure G260 refuses for a TAG and
 * `tenantKeyAliasName()` above refuses for a KMS ALIAS — the same shape
 * arriving at a third API, and the only one of the three readable by the entire
 * internet rather than by a principal holding one permission.
 *
 * `*.reconcileai.app` publishes ONE fact: that this product exists and serves
 * subdomains. It publishes no customer.
 *
 * ⚠️ AND THE SECOND-ORDER PROPERTY IS THE ONE EASY TO LOSE LATER: a WILDCARD
 * DNS RECORD REMOVES THE NXDOMAIN ORACLE TOO. With one `*.reconcileai.app`
 * alias record, `acme.reconcileai.app` and `no-such-tenant.reconcileai.app`
 * resolve identically, so DNS answers nothing about who is a customer.
 * Per-tenant A records would restore that oracle even under a wildcard
 * certificate — **so a later slice adding per-tenant DNS "for a vanity CNAME"
 * gives back the property this one bought, at a different API, silently.**
 *
 * 🛑 WHAT IS *NOT* CLAIMED, AND G183 IS EMPHATIC ABOUT IT: **tenant existence
 * remains enumerable AT THE APPLICATION.** G183 — *"CERTIFICATE TRANSPARENCY IS
 * NOT THE JUSTIFICATION, AND ANY DOCUMENT SAYING SO IS WRONG … `GET
 * https://<guess>.<domain>/` separates a live tenant from a dead one in one
 * unauthenticated request, and passive DNS records every tenant host the moment
 * a single user resolves it."* That is true of this distribution today: the
 * `/v1/*` behaviour forwards the viewer `Host` to the plane, and a plane that
 * answers a resolvable host differently from an unresolvable one is an oracle
 * no edge configuration can close. **The wildcard removes the BULK disclosure —
 * a downloadable list of every customer — and does not remove the per-guess
 * one.** Two different threats; this constant exists so no document collapses
 * them.
 */
export const EDGE_CERTIFICATE_TRANSPARENCY =
  'one wildcard, no per-tenant SAN: CT logs are world-readable and permanent'

// ------------------------------------------------- the broker (G302)

/**
 * ┌─ 🛑 COGNITO IS A **BROKER**, AND EVERY CONSTANT BELOW EXISTS TO KEEP IT ───┐
 * │ ONE. G302, 19 Sep 2026.                                                   │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * G302: *"COGNITO IS A BROKER FOR EXTERNAL IdPs, AND EACH CONNECTION BECOMES AN
 * `identity_connection` ROW … `orgFor(connection.owner)` derives organisation
 * FROM WHICH DIRECTORY AUTHENTICATED … A federated connection is therefore not
 * a new concept bolted on — it is the producer the model has been waiting for."*
 *
 * 🛑 **AND THE REJECTED ALTERNATIVE IS THE ONE THIS FILE HAS TO KEEP REFUSING:
 * A USER POOL WITH NATIVE USERS.** G302: *"A native Cognito user HAS NO OWNING
 * DIRECTORY, so `orgClass` would have nothing to derive from — and G289 already
 * priced that shortcut at FIVE DELETED CONTROLS: defaulting it to `customer`
 * routes a partner past the live-grant check, the `partnerId` check,
 * revocation, expiry and `PARTNER_CAPABILITY_MASK`. Sign-in that works sooner
 * and cannot say who signed in is not the cheaper option."*
 *
 * ⚠️ **G223 BINDS AND IS UNCHANGED: *"no second factor in v1; federation owns
 * it."*** `MfaConfiguration` is `OFF` in `lib/identity-stack.ts` and it is an
 * assertion rather than a default — the second factor is the CUSTOMER IdP's to
 * enforce, and a pool that enforced one would be this product claiming an
 * authority over a directory it does not own.
 */

/** The `Identity` stack for one environment (G302). */
export const STACK_IDENTITY_STAGING = 'reconcile-identity-staging'

export const identityStackName = (environment: Environment): string =>
  `reconcile-identity-${environment}`

/**
 * The user pool's name.
 *
 * ⚠️ A USER POOL NAME IS NOT GLOBALLY UNIQUE AND IS NOT IN ANY URL, which is
 * why it carries no account id where `objectBucketName()` and
 * `cognitoDomainPrefix()` both must. It is readable by anyone holding
 * `cognito-idp:ListUserPools` — an account-wide call that takes no resource,
 * the same shape as `kms:ListAliases` — so the rule it must satisfy is the one
 * `tenantKeyAliasName()` states: **it names no tenant.** It names the product
 * and the environment, and there is exactly ONE of them.
 */
export const userPoolName = (environment: Environment): string => `reconcile-${environment}`

/**
 * 🛑 **ONE POOL FOR THE WHOLE FLEET, AND A POOL PER TENANT IS REFUSED ON
 * G260's OWN GROUND RATHER THAN ON COST.**
 *
 * `cognito-idp:ListUserPools` takes **no resource** — it is account-wide, like
 * `kms:ListAliases` and like `tag:GetResources` — so a pool named
 * `reconcile-staging-ten-acme` publishes the customer list to every principal
 * holding one permission. That is word for word the disclosure G260 refuses
 * through a TAG (*"a per-tenant tag is a tenant enumeration in the clear"*) and
 * `tenantKeyAliasName()` refuses through a KMS ALIAS. **`RequiredTagsAspect`
 * cannot see it: a pool name is not a tag.**
 *
 * ⚠️ **AND THE SECOND REASON IS THE ONE THAT WOULD HAVE BITTEN FIRST.** G183
 * makes tenant creation *"a control-plane database act with no infrastructure
 * step and no propagation wait"*, and G293 refused a CloudFront distribution
 * per tenant because onboarding would gain a fifteen-minute deploy. A pool per
 * tenant is that refusal arriving at a fourth service: a `CreateUserPool`, a
 * `CreateUserPoolDomain` (globally unique prefix, per tenant, in public DNS)
 * and a `CreateUserPoolClient`, per customer, before anybody can sign in.
 *
 * ⚠️ **WHAT ONE POOL COSTS, STATED RATHER THAN SHRUGGED AT:** every federated
 * person in the fleet is a linked user record in one directory, so a principal
 * holding `cognito-idp:ListUsers` on this pool reads across every customer at
 * once. That reach is not narrowed by anything in `infra/` — it is narrowed by
 * IAM, and **no policy in this app grants it to anything.** The alternative
 * trades it for the enumeration above, which needs a weaker permission and
 * gives up the customer list rather than a list of people.
 */
export const COGNITO_ONE_POOL_BECAUSE =
  'cognito-idp:ListUserPools is account-wide and takes no resource: a pool per tenant is a tenant enumeration in the clear'

/**
 * 🛑 **THE HOSTED-UI DOMAIN PREFIX IS GLOBALLY UNIQUE ACROSS ALL OF AWS AND IS
 * READ BY THE WHOLE INTERNET. IT IS CHOSEN THE WAY `objectBucketName()` IS
 * CHOSEN, AND FOR THE SAME REASON.**
 *
 * The prefix becomes `https://<prefix>.auth.us-west-2.amazoncognito.com`. Two
 * facts govern it and they pull in opposite directions:
 *
 *  1. **It is global.** `reconcile-staging` is a name any AWS customer on earth
 *     may already hold, and the failure is at deploy, not at review — exactly
 *     the `BucketAlreadyExists` shape `objectBucketName()` answers by putting
 *     the account and the region in the name. Account plus environment makes it
 *     ours by construction.
 *  2. **It is in a browser address bar.** Every person who signs in reads it,
 *     and every customer's IT administrator types it into their own IdP as the
 *     ACS URL. So it discloses the account id to everybody who signs in —
 *     **one fact more than the bucket name discloses, because a bucket name is
 *     not in anybody's browser.**
 *
 * ⚠️ **WHAT IT DOES NOT DISCLOSE, AND THAT IS THE TEST THAT MATTERS: NO
 * TENANT.** One prefix serves the whole fleet. An account id is not a
 * credential and is printed in every ARN in every template here; a tenant id
 * would be the disclosure G260, `tenantKeyAliasName()` and
 * `EDGE_CERTIFICATE_TRANSPARENCY` each refuse at their own API.
 *
 * 🛑 **THE RIGHT ANSWER IS A CUSTOM DOMAIN AND IT IS BLOCKED BY A FACT VERIFIED
 * AGAINST ROUTE 53 RATHER THAN REASONED ABOUT.** `auth.reconcileai.app` would
 * disclose nothing but the product, is covered BY NAME by the existing flat
 * console certificate (a wildcard matches exactly one label, and `auth` is one
 * label), and `RESERVED_LABEL_CLAIMED_BY.auth` reserved the label for precisely
 * this: *"federation lands somewhere and G223 defers the shape; the label is
 * held until it does."* **Cognito refuses to create a custom domain unless the
 * PARENT domain resolves an A record**, and the apex does not:
 *
 *     aws route53 list-resource-record-sets --hosted-zone-id Z04053259WLMQJTR30EU
 *     => reconcileai.app carries NS and SOA and nothing else
 *     dig +short reconcileai.app A
 *     => (nothing)
 *
 * ⚠️ **AND A SECOND FACT THE SAME QUERY TURNED UP, WHICH A LATER READER WILL
 * OTHERWISE MEET AS A SURPRISE: `auth.reconcileai.app` ALREADY RESOLVES.** G297
 * kept `*.reconcileai.app` as a Route 53 **sinkhole**, so every unclaimed flat
 * label answers today — `dig +short auth.reconcileai.app A` returns four
 * CloudFront addresses. A Cognito custom domain there is therefore not only an
 * apex A record away; it also needs a specific record placed **over** that
 * wildcard, which is a change to the sinkhole G297 deployed deliberately.
 * **Two blockers, both named, neither this slice's.**
 *
 * `EDGE_APEX_IS_SERVED_ELSEWHERE` records that the apex is deliberately absent
 * from both certificates and both distributions, because the marketing plane
 * lives on a different tool. **So the custom domain is owed and its blocker is
 * an apex A record nobody has been asked for** — named here rather than filled,
 * because putting the apex on a distribution is the decision this file already
 * says nobody may take without the owner.
 */
export const cognitoDomainPrefix = (environment: Environment): string =>
  `reconcile-${AWS_ACCOUNT}-${environment}`

/** The hosted UI's host, derived so nothing types it twice. */
export const cognitoHostedUiHost = (environment: Environment): string =>
  `${cognitoDomainPrefix(environment)}.auth.${AWS_REGION}.amazoncognito.com`

/** The app client's name. Not global, not in a URL; it names no tenant either. */
export const userPoolClientName = (environment: Environment): string =>
  `reconcile-${environment}-browser`

/**
 * 🛑 **A FEDERATED PROVIDER IS NAMED BY AN OPAQUE HANDLE, AND THIS IS THE
 * FOURTH API AT WHICH THIS RECORD HAS CAUGHT THE SAME DISCLOSURE.**
 *
 * The four, in the order they were found: a TAG (`tag:GetResources`, G260), a
 * KMS ALIAS (`kms:ListAliases`, `tenantKeyAliasName()`), a CERTIFICATE SAN (a
 * public CT log, needing no permission at all,
 * `EDGE_CERTIFICATE_TRANSPARENCY`), and now an IdP PROVIDER NAME
 * (`cognito-idp:ListIdentityProviders`).
 *
 * **A provider name is worse than an alias in one specific way and better in
 * another.** Worse: it is quoted back in the hosted UI's own `identity_provider`
 * query parameter, so it is visible to the person signing in and to anything
 * watching their address bar — not merely to a principal holding a permission.
 * Better: `ListIdentityProviders` takes a user pool id, so it is not the
 * account-wide call `ListAliases` is.
 *
 * Either way `idp-ten-acme` publishes a customer. **Sixteen hex characters,
 * minted at random and NEVER derived** — `TENANT_KEY_HANDLE_PATTERN`'s argument
 * applies unchanged and is not repeated here: a hash of a low-entropy slug is
 * recovered by guessing forward.
 *
 * ⚠️ **THE JOIN FROM PROVIDER NAME TO `identity_connection` HAS NOWHERE TO
 * LIVE, AND THAT IS THIS SLICE'S SHARPEST GAP.**
 * `db/migrations/0009_identity_substrate.sql` gives
 * `tenant.identity_connection` seven columns and **none of them can hold a
 * Cognito provider name.** G299 anticipated exactly this — Cognito *"is FREE TO
 * FORCE A SECOND MIGRATION"* — and the migration is not this slice's to write.
 * Until it exists, a provider created here is a door with no row behind it, and
 * `server/data-plane/identity.ts` refuses every person who walks through it, by
 * name, at `owner_unresolvable`. **That refusal is correct. It is also the whole
 * of why nothing here creates a provider.**
 *
 * Cognito's own constraint on the string: 3-32 characters, and it may not begin
 * or end with an underscore. `c-` plus sixteen hex is eighteen.
 */
export const COGNITO_PROVIDER_HANDLE_PATTERN = /^[0-9a-f]{16}$/

export const cognitoProviderName = (handle: string): string => `c-${handle}`

/**
 * One federated connection, as `infra/` may express it.
 *
 * ⚠️ IT IS NOT AN `IdentityConnection`. The model's declaration carries an
 * `owner`, a `label` and `domains`, and **not one of those three is Cognito's
 * business**: the owner is what `orgFor()` derives organisation from and lives
 * in a database row behind a grant; the label is operator-written text G232
 * keeps off a derivation; `domains` belongs to a `domain_claim` table
 * `db/migrations/0009` deliberately did not write. This interface is the part
 * AWS needs and no more, which is `0004_subject_ledger.sql`'s rule — *"the
 * column set is the predicate's and not the interface's"* — arriving at a
 * different kind of store.
 */
export interface FederatedConnection {
  /** Sixteen hex characters. NEVER a tenant id. See `cognitoProviderName()`. */
  readonly handle: string
  /**
   * ⚠️ `saml` ONLY TODAY, AND THE REFUSAL OF `oidc` IS A G263 DECISION RATHER
   * THAN AN OMISSION. `assertNoStoredClientSecret()` in `lib/identity-stack.ts`
   * carries the argument at length.
   */
  readonly protocol: 'saml' | 'oidc'
  /** The IdP's SAML metadata URL. Read by Cognito, never by us. */
  readonly metadataUrl: string
}

/**
 * The federated connections this app declares.
 *
 * 🛑 **IT IS EMPTY, AND THE EMPTINESS IS THE HONEST STATE RATHER THAN A STUB —
 * THE SAME SENTENCE `TENANT_KEY_HANDLES` CARRIES, FOR A SHARPER REASON.** There
 * is no customer. There is also no column to record a connection in (see
 * `cognitoProviderName()` above), no `domain_claim` table for home-realm
 * routing, and no mounted operation to consume a callback. **A provider added
 * here today would be a door into a building with no rooms.**
 *
 * ⚠️ APPENDING ONE IS A REVIEWED PULL REQUEST PLUS A `cdk deploy`, which is the
 * shape G191 already requires of every pinned dependency and is NOT the shape
 * G183 requires of onboarding. That mismatch is named on `cognitoCallbackUrls()`
 * below, where it bites hardest.
 */
export const FEDERATED_CONNECTIONS: readonly FederatedConnection[] = []

/**
 * ┌─ 🛑 A CALLBACK URL IS AN EXACT STRING. COGNITO ACCEPTS NO WILDCARD. THAT ──┐
 * │ ONE FACT COLLIDES WITH G179's HOST GRAMMAR AND THE COLLISION IS NOT THIS   │
 * │ SLICE'S TO RESOLVE.                                                        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Under G179 one host serves one tenant — `{tenant}.us-west-2.reconcileai.app`
 * — and under G297 that grammar is what makes a misrouted tenant fail closed at
 * TLS. **A tenant signing in through this pool needs its own host in
 * `CallbackURLs`, and there is no `*.us-west-2.reconcileai.app` to write
 * there.** The two ways out are both refused here because both are rulings:
 *
 *  · **One `UpdateUserPoolClient` per tenant.** It reintroduces the
 *    AWS-operation-per-tenant that G183 and G293 spent two rulings removing —
 *    *"a control-plane database act with no infrastructure step"* — and it
 *    publishes the customer list AGAIN, through
 *    `cognito-idp:DescribeUserPoolClient`. That is the FIFTH API carrying this
 *    disclosure, and the first at which the list would be a literal array of
 *    customer hostnames.
 *  · **One fixed callback host, then a redirect to the tenant.** It collides
 *    with G180, which makes `Session.issuedHost` PERMANENT, and with
 *    `checkHostBinding()`, which REVOKES on a mismatch — so a session minted at
 *    a console host and carried to a tenant host is revoked by the control that
 *    exists to stop exactly that carry. `session.openapi.yaml` names the harm in
 *    its own voice: *"the victim uploads their own bank statements into the
 *    attacker's tenant."*
 *
 * **So this list is the CONSOLE hosts and nothing else.** They are flat, fixed,
 * two, and real — `console.reconcileai.app` and `partners.reconcileai.app` are
 * live aliases on a deployed distribution, and `administration.openapi.yaml`
 * declares its server as `https://console.reconcileai.app/v1`. A staff or
 * partner sign-in is the one federated flow whose callback URL can be written
 * down today without taking somebody else's decision.
 *
 * ⚠️ **AND THE PATH POINTS AT A FRONTEND ROUTE THAT DOES NOT EXIST.**
 * `frontend/src/routes/table.ts` declares twelve routes; `/signin` and
 * `/signin/lapsed` are two of them and **there is no callback route**. Derive
 * it: `grep -c "'/signin/callback'" frontend/src/routes/table.ts` returns 0.
 * The URL is written here because Cognito requires one and because the redirect
 * target must be decided by whoever owns the host rather than by whoever owns
 * the route table. **It is a named gap, not a working flow.**
 */
export const COGNITO_CALLBACK_PATH = '/signin/callback'
export const COGNITO_SIGN_OUT_PATH = '/signin'

/**
 * ┌─ ✅ G2494 APPLIED, 1 Oct 2026 (G2548) — AND THE BLOCK ABOVE IS KEPT RATHER ┐
 * │ THAN DELETED, BECAUSE TWO OF ITS SENTENCES WENT FALSE AND ONE STANDS.     │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * **FALSE:** *"So this list is the CONSOLE hosts and nothing else"*, and
 * *"there is no callback route"* — `frontend/src/routes/table.ts` has carried
 * `/signin/callback` since G2502, and `beginFederatedSignIn` (G2541) builds
 * the `redirect_uri` from the host the browser STANDS ON.
 *
 * **WHY THE TENANT HOST HAD TO BE ADDED, MEASURED IN THE CODE RATHER THAN
 * ARGUED:** S6 mints the session on the host the callback ARRIVED at (G2493 —
 * *"There is no string a caller sent that names a place"*), so a console
 * callback mints a CONSOLE session and a tenant session needs the broker to
 * return to the TENANT host. With console URLs alone Cognito refuses every
 * tenant `redirect_uri` byte-for-byte, so a tenant sign-in in AWS could not
 * reach the handler at all — G2494's whole content.
 *
 * 🛑 **WHAT STANDS, AND IT IS THE COST THIS TAKES ON KNOWINGLY:** G315's
 * rejected alternative (a), *"a callback per tenant"*. Cognito accepts NO
 * WILDCARD, so each tenant host is one exact entry; adding a tenant to sign-in
 * is a reviewed PR plus a `cdk deploy`, the customer list becomes readable
 * through `cognito-idp:DescribeUserPoolClient`, and Cognito caps an app
 * client at **100** callback URLs. **G183 and G293 refused that shape for
 * PROVISIONING; this list does not make provisioning an AWS act — a tenant
 * exists without it — it makes SIGN-IN for that tenant one.** Whether that
 * holds at the hundredth tenant is the owner's question and is recorded as
 * such (G2549); nothing here pretends to answer it.
 *
 * ⚠️ **G297's RESIDENCY ARGUMENT IS RE-CHECKED AND HOLDS:** every entry is
 * built by `tenantHost()`, so it sits under `*.{region}.{domain}` — the tenant
 * certificate's grammar — and a tenant callback on a flat host cannot be
 * written here at all. The CONSOLE entries are unchanged and stay flat.
 *
 * ⚠️ **THE ONE SLUG IS THE STAGING MEASUREMENT HOST, NOT A CUSTOMER.**
 * `ten-acme` is the host every `docs/build/deploy-handoff.md` probe has used
 * since G297 (`https://ten-acme.us-west-2.reconcileai.app/…`). No customer is
 * named here, and none may be until one exists — `PRODUCT.md`'s rule.
 */
export const SIGN_IN_TENANT_SLUGS: readonly string[] = ['ten-acme']

/**
 * ┌─ 🛑 G2549, THE OWNER'S RULING OF 2 Oct 2026 — AND THE LIST ABOVE IS NO ───┐
 * │ LONGER WHAT COGNITO IS GIVEN. IT IS KEPT, NOT DELETED, BECAUSE IT IS      │
 * │ G2548's SHAPE AND THE COST BLOCK ABOVE IS THE ARGUMENT THE RULING ANSWERS │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * The ruling, verbatim: *"One shared callback host: all sign-ins return to one
 * fixed callback which then 303s to the tenant host via resolveServingHost (a
 * registry lookup, grant bound to the host)."* It closes G2549's open question
 * — *"Cognito accepts no wildcard and caps an app client at 100 callback
 * URLs"* — by making the list ONE tenant-independent URL: adding a tenant is a
 * control-plane database act again (G183) and `DescribeUserPoolClient`
 * publishes no customer.
 *
 * 🛑 THE HOST IS `auth.{region}.{domain}` AND THE LABEL WAS HELD FOR EXACTLY
 * THIS. `RESERVED_LABEL_CLAIMED_BY.auth`: *"federation lands somewhere and
 * G223 defers the shape; the label is held until it does."* It is REGIONAL —
 * under `*.us-west-2.reconcileai.app`, the tenant certificate's grammar and the
 * tenant distribution's alias — because the relay reads the data plane's
 * database, and G297 says a regional fact wears a region. **No certificate, no
 * distribution and no DNS record is added**: the wildcard covers it, and
 * `/session/*` already routes to the plane under D6-4's rate rule (G2546).
 * ⚠️ It is G315's ORIGINAL host (`auth.{region}.reconcileai.app/callback`),
 * which R4 moved away from; G2549 moves back to it with the session minted on
 * the TENANT host rather than at the auth host, which is what R4 objected to.
 *
 * ⚠️ THE CONSOLE ENTRIES ARE KEPT. The plane sends every sign-in — console
 * ones included — to the shared URL; the console entries are what a plane
 * image built before G2549 still sends, so removing them would break console
 * sign-in on a rollback for no property. Named, not hidden.
 */
export const SIGN_IN_RETURN_LABEL: ReservedHostLabel = 'auth'
export const SIGN_IN_RETURN_HOST = `${SIGN_IN_RETURN_LABEL}.${AWS_REGION}.${ROOT_DOMAIN}`
/**
 * Mirrored by `server/data-plane/code-exchange.ts`'s `SIGN_IN_RETURN_PATH`
 * and asserted by `tests/http/signin-return-served.test.ts` §1.
 */
export const SIGN_IN_RETURN_PATH = '/session/signin/return'
export const signInReturnUrl = (): string => `https://${SIGN_IN_RETURN_HOST}${SIGN_IN_RETURN_PATH}`

/**
 * ┌─ G2766 — WHAT A DEPLOYED DATA PLANE NEEDS TO COMPLETE A SIGN-IN AT ALL ───┐
 * │ (derived, 2 Oct 2026 — NOT THE OWNER'S)                                   │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * MEASURED, NOT FEARED: `lib/planes-stack.ts` set NONE of the variables the
 * sign-in path reads, so the deployed plane booted with an EMPTY host registry
 * (every host `host_not_registered`), no identity terms (every callback 503 —
 * ⚠️ since G2571/G2572 those are per DOOR, loaded at boot from the row's
 * `jwks_uri` and `audience`, which the staging seed writes; the two
 * `RECONCILE_IDENTITY_*` variables this block first set are RETIRED)
 * and no session bounds (every mint `session_bounds_unusable`). The three
 * public sign-in operations were mounted and could not succeed for anybody.
 * These are the values that end that, per environment, and `null` where an
 * environment has no deployed pool to name.
 *
 * ⚠️ THE POOL AND CLIENT IDS ARE MEASURED FROM THE DEPLOYED `Identity` STACK
 * (`lib/identity-stack.ts`'s header records the `describe-user-pool-client`
 * run against them) and are SPELLED rather than imported: a construct
 * reference from `Planes` to `Identity` would mint an export and a deploy-
 * order edge, which is G1012's hazard. Re-derive them before a deploy:
 *
 *   AWS_PROFILE=crm-frontend aws cloudformation describe-stacks --region us-west-2 \
 *     --stack-name reconcile-identity-staging --query 'Stacks[0].Outputs'
 *
 * 🛑 THE ISSUER IS NOT HERE AND MUST NOT BE: D6-5 retired
 * `RECONCILE_IDENTITY_ISSUER` — the issuer comes from the PINNED door row.
 */
export interface SignInDeployment {
  readonly userPoolId: string
  readonly clientId: string
  /** `host|tenantId|region|kind|status` — `server/data-plane/serving-hosts.ts`'s grammar. */
  readonly servingHosts: readonly string[]
  /** `host|kind|status`. */
  readonly consoleHosts: readonly string[]
  /** R7's two platform bounds, in seconds. A STAGING choice, argued at G2766. */
  readonly sessionMaxLifetimeSeconds: number
  readonly sessionMaxIdleSeconds: number
}

export const SIGN_IN_DEPLOYMENT: Readonly<Record<Environment, SignInDeployment | null>> = {
  staging: {
    userPoolId: 'us-west-2_bWwWkb0iD',
    clientId: '6ig2p5gam6vhbjdugk9vo5e0vu',
    /* `ten-acme` is the staging measurement host every probe uses, served to
     * the `ten_acme` tenant `db/seeds/staging-signin-seed.sql` phase 1
     * registers; residency `us-west-2` agrees with the host's region label. */
    servingHosts: [
      `${tenantHost('ten-acme')}|ten_acme|us-west-2|pooled|active`,
      /* G2999 — the STAGING MOCK tenant (`lib/mock-personas.ts`'s
       * `MOCK_TENANT_SLUG` and `MOCK_TENANT_ID`, SPELLED because this module
       * imports nothing — `tests/infra/mock-idp.test.mjs` §1 holds them equal).
       * Registered whether or not the mock door is deployed: a registered host
       * with no claimed domain behind it routes nobody anywhere, and keeping
       * the registry flag-free keeps `Planes` one shape. */
      `${tenantHost('ten-mock')}|ten_mock|us-west-2|pooled|active`,
    ],
    consoleHosts: [`${CONSOLE_HOST}|staff|active`, `${PARTNERS_HOST}|partner|active`],
    /* Eight hours of life and thirty idle minutes: a working day, and a
     * walk-away bound. Staging only; production's are an owner's decision. */
    sessionMaxLifetimeSeconds: 8 * 60 * 60,
    sessionMaxIdleSeconds: 30 * 60,
  },
  prod: null,
  shared: null,
}

/**
 * ┌─ 🛑 G2767 — THE OWNER'S RULING, 2 Oct 2026: *"staging federates Microsoft ┐
 * │ Entra ID through the Cognito broker."*                                     │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * AN OIDC CONNECTION, WHICH `assertNoStoredClientSecret()` REFUSES FOR
 * `FEDERATED_CONNECTIONS` AND STILL DOES — that refusal is G263/G302's and is
 * not weakened: its argument (Cognito stores the VALUE, so a Secrets Manager
 * copy is a second copy whose rotation rotates nothing) is TRUE OF THIS
 * CONNECTION TOO and is accepted here BY THE OWNER, for staging, rather than
 * answered. What this type adds is the least-bad documented shape (G2768,
 * derived): the secret is never in the tree and never in the template — the
 * provider's `client_secret` is a CloudFormation DYNAMIC REFERENCE,
 * `{{resolve:secretsmanager:<name>:SecretString:clientSecret}}`, resolved by
 * CloudFormation at deploy. ⚠️ ROTATION IS THEREFORE A REDEPLOY: put the new
 * value, then `cdk deploy` Identity, which re-resolves it into the pool. That
 * is stated on the stack's output so nobody schedules a rotation that rotates
 * nothing.
 *
 * ⚠️ NOTHING HERE NAMES A CUSTOMER: the provider name is an opaque handle
 * (`COGNITO_PROVIDER_HANDLE_PATTERN`), minted with `openssl rand -hex 8`.
 * The Entra TENANT id and CLIENT id are configuration the owner supplies by
 * context at deploy, never committed: `-c entraTenantId=<guid> -c
 * entraClientId=<guid>`. Without them, Identity synthesises exactly what it
 * did before this ruling.
 */
export interface BrokeredOidcConnection {
  /** Sixteen hex characters. `cognitoProviderName()` makes the provider name. */
  readonly handle: string
  readonly issuerUrl: string
  readonly clientId: string
  /** The Secrets Manager secret NAME holding `{"clientSecret": "..."}`. Never the value. */
  readonly clientSecretName: string
}

export const ENTRA_CONNECTION_HANDLE = '536ff22dd95a0cd0'
export const ENTRA_TENANT_ID_CONTEXT_KEY = 'entraTenantId'
export const ENTRA_CLIENT_ID_CONTEXT_KEY = 'entraClientId'
export const ENTRA_ENVIRONMENTS: readonly Environment[] = ['staging']
export const entraClientSecretName = (environment: Environment): string =>
  `reconcile-${environment}-entra-client-secret`

/** The URL every OIDC IdP behind this pool must register as its redirect URI. */
export const cognitoIdpResponseUrl = (environment: Environment): string =>
  `https://${cognitoHostedUiHost(environment)}/oauth2/idpresponse`

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * The Entra connection from deploy context, or `null` when neither key is
 * given. HALF a pair, a malformed id, or a non-staging environment is a SYNTH
 * FAILURE — a provider that points at the wrong directory is worse than none.
 */
export function entraConnectionFromContext(
  read: (key: string) => unknown,
  environment: Environment,
): BrokeredOidcConnection | null {
  const tenantId = read(ENTRA_TENANT_ID_CONTEXT_KEY)
  const clientId = read(ENTRA_CLIENT_ID_CONTEXT_KEY)
  if (tenantId === undefined && clientId === undefined) return null
  if (!ENTRA_ENVIRONMENTS.includes(environment)) {
    throw new Error(`G2767: the Entra connection is ruled for staging alone, not '${environment}'.`)
  }
  if (typeof tenantId !== 'string' || !GUID.test(tenantId) || typeof clientId !== 'string' || !GUID.test(clientId)) {
    throw new Error(
      `G2767: -c ${ENTRA_TENANT_ID_CONTEXT_KEY} and -c ${ENTRA_CLIENT_ID_CONTEXT_KEY} must BOTH be ` +
        'lowercase GUIDs (the Entra directory id and the app registration\'s client id).',
    )
  }
  return {
    handle: ENTRA_CONNECTION_HANDLE,
    issuerUrl: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    clientId,
    clientSecretName: entraClientSecretName(environment),
  }
}

// --------------------------------- the STAGING MOCK sign-in (G2771, G2996–)

/**
 * ┌─ 🛑 THE OWNER'S RULINGS OF 2 Oct 2026 — G2771, BUILT UNDER G2996 ─────────┐
 * │ *"Create a mock sign-in so Claude can run live browser tests against      │
 * │ staging without passkeys"*, a profile switcher across the three portals, │
 * │ and — after the risk was stated in full — *"Confirm as designed."*       │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * **THE RISK, STATED WHERE THE KNOB IS: a public, internet-reachable test
 * login on staging.** Anybody holding the one mock password signs in as any
 * persona in `lib/mock-personas.ts`, a 1CloudHub platform principal and an FDE
 * holding a 90-day delivery grant among them. Accepted by the owner for
 * STAGING ALONE. Every knob below is therefore OFF by default and REFUSES at
 * synth outside `MOCK_SIGN_IN_ENVIRONMENTS`:
 *
 *   `-c mockSignIn=on`        renders the `MockIdp` stack (`lib/mock-idp-stack.ts`).
 *                             Absent: the stack does not exist in the app at all.
 *   `-c mockIdpIssuer=<url>`  renders the THREE Cognito OIDC providers in
 *                             `Identity`, pointed at the deployed function URL
 *                             (the `MockIdp` stack's `FunctionUrl` output, with
 *                             no trailing slash). Absent: `Identity` is
 *                             byte-identical to what it was.
 *
 * ⚠️ TWO CONTEXT KEYS AND NOT AN EXPORT, `Planes`' G1012 reason in a smaller
 * form: an `Fn::ImportValue` from `Identity` into `MockIdp` would make
 * `Identity` — which holds the whole fleet's sign-in — undeployable without
 * the test door, and the test door undeletable while `Identity` reads it.
 */
export const MOCK_SIGN_IN_ENVIRONMENTS: readonly Environment[] = ['staging']
export const MOCK_SIGN_IN_CONTEXT_KEY = 'mockSignIn'
export const MOCK_IDP_ISSUER_CONTEXT_KEY = 'mockIdpIssuer'
export const STACK_MOCK_IDP_STAGING = 'reconcile-mock-idp-staging'

/**
 * FENCE 4 (G3001) — a bound on THROUGHPUT, and it is the minimum the ruling
 * names rather than a rate limit: a Lambda function URL cannot carry a WAF web
 * ACL. Five concurrent invocations bounds the bill and the parallelism of a
 * password guesser; the password itself is a long generated value the runbook
 * asks for.
 */
export const MOCK_IDP_RESERVED_CONCURRENCY = 5

export const mockIdpFunctionName = (environment: Environment): string =>
  `reconcile-${environment}-mock-idp`
export const mockIdpKeyAlias = (environment: Environment): string =>
  `alias/reconcile-${environment}-mock-idp-signing`
/** Created EMPTY (`{"password":""}`); the door refuses every sign-in until a person puts a value. */
export const mockIdpPasswordSecretName = (environment: Environment): string =>
  `reconcile-${environment}-mock-idp-password`
/** GENERATED at deploy; Cognito presents it at the door's `/token`, by dynamic reference. */
export const mockIdpClientSecretName = (environment: Environment): string =>
  `reconcile-${environment}-mock-idp-client-secret`

/** FENCE 1 (G2997). A mock door outside staging is a synth failure, never a template. */
export function assertMockSignInEnvironment(environment: Environment): void {
  if (MOCK_SIGN_IN_ENVIRONMENTS.includes(environment)) return
  throw new Error(
    `G2771: the mock sign-in may not be synthesised for '${environment}'. It is a public ` +
      'credential door the owner accepted for STAGING ALONE; a mock persona in any other ' +
      'environment is a working sign-in nobody vetted.',
  )
}

/** Whether `-c mockSignIn=on` was given — and a refusal if it was given anywhere but staging. */
export function mockSignInFromContext(read: (key: string) => unknown, environment: Environment): boolean {
  const flag = read(MOCK_SIGN_IN_CONTEXT_KEY)
  if (flag === undefined || flag === 'off') return false
  if (flag !== 'on') {
    throw new Error(`G2771: -c ${MOCK_SIGN_IN_CONTEXT_KEY} is 'on' or absent, never '${String(flag)}'.`)
  }
  assertMockSignInEnvironment(environment)
  return true
}

/**
 * A deployed Lambda function URL in this region, with no path and no trailing
 * slash — the issuer Cognito pins and the door derives from its own host.
 */
const MOCK_IDP_ISSUER = new RegExp(`^https://[a-z0-9]{20,64}\\.lambda-url\\.${AWS_REGION}\\.on\\.aws$`)

/**
 * The mock doors as Cognito OIDC providers, from deploy context — or `null`
 * when `-c mockIdpIssuer` is absent. A malformed issuer or a non-staging
 * environment is a SYNTH FAILURE: a provider pointed at the wrong URL is a
 * door somebody else answers.
 *
 * ⚠️ THE DOORS ARE A PARAMETER (`lib/app.ts` passes `MOCK_DOORS`) BECAUSE THIS
 * MODULE IMPORTS NOTHING — `frontend/vite.config.ts` reads it, and
 * `tests/app/dev-proxy-mirrors-the-edge.test.mjs` holds it import-free.
 */
export function mockIdpConnectionsFromContext(
  read: (key: string) => unknown,
  environment: Environment,
  doors: readonly { readonly handle: string; readonly clientId: string }[],
): readonly BrokeredOidcConnection[] | null {
  const issuer = read(MOCK_IDP_ISSUER_CONTEXT_KEY)
  if (issuer === undefined) return null
  assertMockSignInEnvironment(environment)
  if (typeof issuer !== 'string' || !MOCK_IDP_ISSUER.test(issuer)) {
    throw new Error(
      `G2771: -c ${MOCK_IDP_ISSUER_CONTEXT_KEY} must be the MockIdp stack's FunctionUrl output ` +
        `without its trailing slash (https://<id>.lambda-url.${AWS_REGION}.on.aws).`,
    )
  }
  return doors.map((door) => ({
    handle: door.handle,
    issuerUrl: issuer,
    clientId: door.clientId,
    clientSecretName: mockIdpClientSecretName(environment),
  }))
}

/**
 * G3003 — WHETHER A FRONTEND BUILD FOR `environment` CARRIES THE PROFILE
 * SWITCHER. The Build stage passes this as `RECONCILE_TEST_PERSONAS`, and
 * `frontend/vite.config.ts` turns exactly `on` into a compile-time `true`;
 * anything else is `false` and the persona list is DEAD CODE the bundler
 * drops. `tests/app/profile-switcher-fence.test.ts` reads the gate's own
 * bundle and requires no persona address in it.
 */
export const testPersonasBuildFlag = (environment: Environment): 'on' | 'off' =>
  MOCK_SIGN_IN_ENVIRONMENTS.includes(environment) ? 'on' : 'off'

export const cognitoIssuerOf = (userPoolId: string): string =>
  `https://cognito-idp.${AWS_REGION}.amazonaws.com/${userPoolId}`

export const cognitoCallbackUrls = (): readonly string[] => [
  signInReturnUrl(),
  ...EDGE_CONSOLE_HOSTS.map((host) => `https://${host}${COGNITO_CALLBACK_PATH}`),
]

export const cognitoSignOutUrls = (): readonly string[] =>
  EDGE_CONSOLE_HOSTS.map((host) => `https://${host}${COGNITO_SIGN_OUT_PATH}`)

// ------------------------------------------- the Observability stack (G261)

/**
 * 🛑 THE TENTH STACK, AND IT IS THE ONE `docs/tech-stack.md` SECTION 10 HAS
 * NAMED SINCE 18 Sep 2026 WITHOUT A FILE EVER EXISTING FOR IT. Derive the
 * absence this slice ends, and derive the new count rather than reading either:
 *
 *   ls infra/lib/*-stack.ts | wc -l        # said 9 until 20 Sep 2026, now 10
 *   grep -rln 'Alarm' infra/lib/           # returned NOTHING until 20 Sep 2026
 *
 * WHY IT IS FIRST AMONG THE DEPLOYMENT STEPS: a staging environment people can
 * sign in to and that pages NOBODY is the shape of failure PR #257 already
 * produced here once — a green signal that was green by unavailability.
 *
 * ⚠️ **THIS SAID *"AN ALARM SET THAT PAGES NOBODY IS NOT A CONTROL, AND THIS
 * ONE PAGES NOBODY … `alarmTopicName()` below is created with NO
 * SUBSCRIPTION"* UNTIL 22 Sep 2026 AND IS CORRECTED RATHER THAN DELETED,
 * because it is the sentence `tests/infra/observability.test.mjs` was armed
 * on and the one a reader would have quoted onward. **G1811, THE OWNER'S
 * RULING: *"Use a placeholder email address that must be replaced before
 * production."*** The topic now carries exactly ONE subscription, to
 * `ALARM_SUBSCRIBER_EMAIL_PLACEHOLDER` below — deliberately not a real
 * mailbox, because inventing one here would put a person's address into a
 * public repository, and a real-looking one would make a placeholder look
 * finished (`TAG_OWNER_PLACEHOLDER`'s own argument, applied a second time).
 * 🛑 **AN UNCONFIRMED EMAIL SUBSCRIPTION DELIVERS NOTHING**: SNS cannot
 * auto-confirm one, so this subscription pages nobody until whatever inbox
 * receives it — real or not — clicks the confirmation link AWS sends. See
 * `lib/observability-stack.ts` for the marker-based control that keeps the
 * placeholder from surviving into a production deploy unnoticed.
 */
export const STACK_OBSERVABILITY_STAGING = 'reconcile-observability-staging'

/** The `Observability` stack for one environment. */
export const observabilityStackName = (environment: Environment): string =>
  `reconcile-observability-${environment}`

/** G261: ONE SNS topic per environment, and every alarm points at it. */
export const alarmTopicName = (environment: Environment): string =>
  `reconcile-${environment}-alarms`

/**
 * 🛑 THIS IS A PLACEHOLDER AND MUST BE REPLACED BEFORE PRODUCTION — G1811,
 * THE OWNER'S RULING, 22 Sep 2026.
 *
 * The marker `PLACEHOLDER-REPLACE-BEFORE-PRODUCTION` is load-bearing rather
 * than decorative: `tests/infra/observability.test.mjs` asserts the
 * subscribed endpoint CONTAINS it, so deleting the marker without supplying a
 * real address is a red gate, and a future commit that swaps in a real
 * production address while keeping the marker by accident is caught by the
 * same assertion. `TAG_OWNER_PLACEHOLDER`'s precedent, applied to a pager
 * instead of a tag: *"one obvious constant … rather than a plausible-looking
 * value, because a plausible-looking placeholder is one nobody notices is a
 * placeholder."*
 */
export const ALARM_SUBSCRIBER_EMAIL_PLACEHOLDER =
  'staging-alerts-PLACEHOLDER-REPLACE-BEFORE-PRODUCTION@reconcileai.app'

/**
 * 🛑 EVERY THRESHOLD BELOW IS DERIVED FROM SOMETHING ALREADY IN THIS TREE, AND
 * THE DERIVATION IS WRITTEN BESIDE IT. A threshold nobody argued is a threshold
 * nobody will trust, and an untrusted pager is a muted pager — which is the
 * same failure as no pager at all, arriving through the front door.
 *
 * ⚠️ NOT ONE OF THEM IS AN SLO. `PRODUCT.md` forbids inventing an SLA, a
 * benchmark or a customer figure, and none of these claims to be one. They are
 * SATURATION and DEVIATION signals: each fires when the fleet has left the
 * envelope the rest of this app already declares for it.
 */

/**
 * The ALB 5xx RATE, in percent of requests, over five minutes.
 *
 * WHY A RATE AND NOT A COUNT. A count threshold is a threshold about traffic
 * volume wearing a threshold about correctness: one 5xx in three requests and
 * one in three million are the same count and are not the same event.
 *
 * WHY 1. The expected rate is ZERO, derived rather than hoped:
 * `server/http/app.ts` answers a refusal with 401/403/409 and reserves 5xx for
 * one arm, `upstream_unavailable`, on an unhandled failure. So any sustained
 * 5xx is a fault. The threshold is not 0 because a target draining during a
 * rolling deploy can emit a transient 5xx, and a pager that fires on every
 * deploy is a pager somebody mutes within a week. 1 percent across two of three
 * five-minute windows is SUSTAINED, which a deploy is not.
 */
export const ALB_5XX_RATE_PERCENT = 1

/**
 * The data target group's health-check timeout, in seconds.
 *
 * ⚠️ THIS IS A MIRROR OF `lib/planes-stack.ts` AND NOTHING CHECKS THAT THE TWO
 * AGREE — the same handling `DATA_PLANE_PORT` above states for its three other
 * homes. It is duplicated rather than imported because `Observability` must not
 * take a construct reference it does not otherwise need; the stack's header
 * says why one extra reference into `Planes` is the expensive thing here.
 * Derive before changing either:
 *   grep -n 'timeout: Duration.seconds' infra/lib/planes-stack.ts
 */
export const ALB_HEALTH_CHECK_TIMEOUT_SECONDS = 5

/**
 * The p99 `TargetResponseTime` threshold, in seconds.
 *
 * DERIVED, NOT CHOSEN: HALF the health-check timeout above. At the FULL timeout
 * the ALB has already begun failing the target's liveness probe and will remove
 * the task after `unhealthyThresholdCount` — so an alarm set there fires at the
 * same moment the availability alarm does and tells a responder nothing the
 * availability alarm did not. Half the timeout is the last point at which the
 * fleet is still up and the number is still about latency.
 */
export const ALB_P99_LATENCY_SECONDS = ALB_HEALTH_CHECK_TIMEOUT_SECONDS / 2

/**
 * ═══════════════════════════════════════════ R-POOL — G2261–G2268, 1 Oct 2026
 *
 * 🛑 THE OWNER'S RULING, R-POOL (`docs/HANDOFF.md`, the D6 rulings block):
 * *"Raise `RECONCILE_DB_POOL_MAX` and the serving task count"* — D6-4's
 * companion to the WAF rate rule, because a rate rule counts requests over a
 * WINDOW of at least sixty seconds and the measured exposure is CONCURRENCY:
 * `createAppPool(max = 10)` on ONE staging task meant ten concurrent anonymous
 * requests held every connection the data plane had
 * (`docs/build/d6-threat-model.md` §1.3, §4.5).
 *
 * ⚠️ D6 IS RIGHT ABOUT WHAT THIS IS, AND IT IS SAID HERE SO NOBODY CITES IT AS
 * MORE: *"Not a control. Moves the number an attacker must reach."* It moves
 * that number from 10 to `DATA_PLANE_POOL_MAX x SERVING_TASKS_WHEN_UP.staging.data`
 * (94, derived below). ⚠️ The acquire-deadline alternative was REFUSED by the
 * owner as a behaviour change on every database read, and none is added; the
 * two-second `connectionTimeoutMillis` in `db/tenant-scope.ts` is unchanged and
 * is a CONNECT fuse, not an acquire deadline.
 *
 * 🛑 THE NUMBERS ARE DERIVED FROM A CONNECTION BUDGET, NOT CHOSEN, AND EVERY
 * TERM OF THE BUDGET IS A NAMED CONSTANT BELOW SO A REVIEWER CAN DISAGREE WITH
 * ONE TERM RATHER THAN WITH A NUMBER. The order is: the engine's ceiling →
 * a design ceiling → minus everything that is not a serving task → divided by
 * the rolling-deploy overlap → divided by the task count.
 * `tests/infra/pool-capacity.test.mjs` asserts every intermediate against a
 * value TYPED INTO the test, so a term that moves is a red gate that names it.
 */

/**
 * Aurora PostgreSQL's documented default, `max_connections =
 * LEAST({DBInstanceClassMemory/9531392}, 5000)`, which Serverless v2 evaluates
 * at the MAXIMUM ACU. One ACU is 2 GiB, so `AURORA_MAX_ACU_STAGING = 2` is
 * 4 GiB and 4294967296 / 9531392 = 450.6 → **450**.
 *
 * 🛑 UNMEASURED, AND AN OVERESTIMATE IN THE DIRECTION THAT MATTERS:
 * `DBInstanceClassMemory` is the instance memory LESS what the engine and the
 * OS reserve, so the real figure is BELOW this. A `SHOW max_connections;` from
 * inside the VPC settles it, and nobody has run one. That is why the design
 * ceiling below halves it rather than spending it.
 */
export const AURORA_MAX_CONNECTIONS_FORMULA_ESTIMATE_STAGING = Math.floor(
  (AURORA_MAX_ACU_STAGING * 2 * 1024 ** 3) / 9531392,
)

/**
 * HALF the formula estimate — 225. The half is the margin for the estimate
 * being an overestimate of unknown size; it is not tuned and it is not an SLO.
 * Every connection this file budgets must fit under it.
 */
export const DATA_CLUSTER_CONNECTION_DESIGN_CEILING = Math.floor(
  AURORA_MAX_CONNECTIONS_FORMULA_ESTIMATE_STAGING / 2,
)

/**
 * Connections the cluster holds back from ordinary roles: PostgreSQL's
 * `superuser_reserved_connections` (default 3) plus RDS's
 * `rds.rds_superuser_reserved_connections` (default 2). Both are DEFAULTS read
 * from documentation; neither parameter is set by `lib/data-stack.ts`.
 */
export const AURORA_RESERVED_CONNECTIONS = 3 + 2

/**
 * The one-shot data migrate task. `db/migrate.ts` drives ONE `pg.Client` and
 * `db/provision.ts` opens its admin `Client`s one at a time, so two is the most
 * it can hold at once.
 */
export const DATA_MIGRATE_TASK_CONNECTIONS = 2

/**
 * The run worker — `server/data-plane/run-worker-main.ts` calls
 * `createAppPool(config.database.poolMax)`, and `lib/run-queue-stack.ts` sets NO
 * `RECONCILE_DB_POOL_MAX` on its task definition, so the default of 10 is what
 * runs there. ⚠️ THIS SLICE DOES NOT SET IT THERE, deliberately: the ruling
 * names the SERVING task, and a `RunQueue` template change for no exposure is a
 * deploy nobody asked for. The default is `server/data-plane/config.ts`'s
 * `intFromEnv` fallback — read it there, never here.
 *
 * TWO CONCURRENT EXECUTING WORKERS ARE BUDGETED, AND THE BOUND IS NOT A
 * CONTROL: `RUN_WORKER_POLL_MINUTES` starts a task every tick regardless of the
 * last one (G1835), and nothing caps concurrent EXECUTIONS. An IDLE tick holds
 * no connection — `pg.Pool` is lazy and the `none` arm returns before the first
 * query — so only a worker that received a message spends any of this. Two is a
 * budget, named as a budget.
 */
export const RUN_WORKER_POOL_MAX = 10
export const RUN_WORKER_CONCURRENT_EXECUTIONS_BUDGETED = 2

/**
 * Headroom for a human: a `psql` session through a bastion, a provisioning
 * custom resource, an RDS query-editor tab. Ten, because it is not zero and it
 * is not derivable from anything in this tree — the one term here that is a
 * choice, and it is named as one.
 */
export const OPERATOR_CONNECTION_HEADROOM = 10

/**
 * The rolling-deploy overlap. ECS's `maximumPercent` defaults to 200 and
 * `lib/planes-stack.ts` does not set it, so during a deployment every serving
 * task may briefly have a replacement beside it, each with a full pool.
 */
export const ROLLING_DEPLOY_OVERLAP = 2

/**
 * Desired task count per serving service when the schedule has the environment
 * UP — now PER PLANE, and ✅ NO LONGER MIRRORED: `lib/planes-stack.ts` imports
 * this constant instead of declaring its own `SERVING_TASKS` (G2263).
 *
 * ⚠️ THIS WAS `Record<Environment, number>` WITH `staging: 1` UNTIL R-POOL, and
 * one number served both planes. It is split because the ruling is about the
 * DATA plane's pool — the control plane's ALB has `ingress: []` (G1066), no
 * anonymous caller reaches it, and a second control task buys nothing D6
 * measured.
 *
 * 🛑 `staging.data` IS 2 AND IT IS THE SMALLEST COUNT THAT BUYS A SECOND
 * PROPERTY FOR FREE: `minHealthyPercent` is 50 and `floor(0.5 x 1)` is ZERO, so
 * a one-task service may legitimately reach zero running tasks on every deploy
 * (the shortfall alarm's ten-minute window is built around that); at two,
 * `floor(0.5 x 2)` is ONE and a deploy keeps a task serving. A third task is
 * refused here: the budget below is a TOTAL, so it would cut the per-task pool
 * to 31 and raise the attacker's number by nothing — while adding a third
 * Fargate task's bill and a third control-read pool.
 */
export const SERVING_TASKS_WHEN_UP: Record<Environment, Record<'data' | 'control', number>> = {
  staging: { data: 2, control: 1 },
  prod: { data: 2, control: 2 },
  shared: { data: 1, control: 1 },
}

/**
 * The connections the serving data fleet may hold at once, STEADY STATE:
 *
 *   design ceiling                                               225
 *   − reserved (3 + 2)                                             5
 *   − migrate task                                                 2
 *   − run worker (10 x 2 executions)                              20
 *   − operator headroom                                           10
 *   = what the serving fleet may hold DURING a deploy            188
 *   ÷ rolling-deploy overlap (2)                                  94  ← steady
 */
export const DATA_SERVING_FLEET_CONNECTION_BUDGET = Math.floor(
  (DATA_CLUSTER_CONNECTION_DESIGN_CEILING -
    AURORA_RESERVED_CONNECTIONS -
    DATA_MIGRATE_TASK_CONNECTIONS -
    RUN_WORKER_POOL_MAX * RUN_WORKER_CONCURRENT_EXECUTIONS_BUDGETED -
    OPERATOR_CONNECTION_HEADROOM) /
    ROLLING_DEPLOY_OVERLAP,
)

/**
 * `RECONCILE_DB_POOL_MAX` on the DATA plane's serving task definition:
 * `floor(94 / SERVING_TASKS_WHEN_UP.staging.data)` = `floor(94 / 2)` = **47**.
 *
 * ⚠️ IT WAS `APP_POOL_MAX = 10` — the `createAppPool()` default, set on no task
 * definition — UNTIL R-POOL. That constant is RETIRED rather than kept beside
 * this one, because two constants for one pool is the drift §5.3 describes.
 *
 * ⚠️ IT IS STAGING'S BECAUSE STAGING'S ACU PAIR IS THE ONLY ONE DECLARED —
 * `auroraAcuCeilingThreshold()`'s caveat. Every environment's task definition
 * carries this one value; a prod ACU pair owes its own derivation and this
 * becomes a function of the environment when it does.
 *
 * ✅ THE SERVER ALREADY READS IT: `server/data-plane/config.ts` →
 * `intFromEnv('RECONCILE_DB_POOL_MAX', 10)` → `server/data-plane/main.ts` →
 * `createAppPool(opts.poolMax)`. Nothing under `server/` changes. Derive it:
 *   grep -rn 'poolMax' server/data-plane/main.ts server/data-plane/config.ts
 */
export const DATA_PLANE_POOL_MAX = Math.floor(
  DATA_SERVING_FLEET_CONNECTION_BUDGET / SERVING_TASKS_WHEN_UP.staging.data,
)

/**
 * The control plane's pool — `server/control-plane/config.ts`,
 * `RECONCILE_CONTROL_DB_POOL_MAX`, default 10, set on no task definition — and
 * the data plane's read-only control pool, `RECONCILE_CONTROL_READ_POOL_MAX`,
 * default 4 (`db/control-read-scope.ts`). ⚠️ MIRRORS OF DEFAULTS, NAMED, AND
 * UNCHANGED BY R-POOL. Derive before changing either:
 *   grep -rn 'CONTROL_DB_POOL_MAX\|CONTROL_READ_POOL_MAX' server/ db/
 */
export const CONTROL_PLANE_POOL_MAX = 10
export const CONTROL_READ_POOL_MAX = 4

/**
 * What the DATA cluster can legitimately be asked for, at worst, by
 * construction: every serving task and its replacement at a full pool, the run
 * worker budget, and the migrate task — `2 x 2 x 47 + 20 + 2` = **210** for
 * staging, under the design ceiling of 225 by exactly the reserved and
 * operator headroom (rounding aside).
 */
export const dataClusterLegitimateConnections = (environment: Environment): number =>
  ROLLING_DEPLOY_OVERLAP * SERVING_TASKS_WHEN_UP[environment].data * DATA_PLANE_POOL_MAX +
  RUN_WORKER_POOL_MAX * RUN_WORKER_CONCURRENT_EXECUTIONS_BUDGETED +
  DATA_MIGRATE_TASK_CONNECTIONS

/**
 * What the CONTROL cluster can legitimately be asked for. 🛑 THIS GREW WITH
 * R-POOL AND NOBODY ASKED IT TO: every DATA task holds a read-only control pool
 * (G1161), so raising the data task count raises the CONTROL cluster's
 * connections too. `2 x (1 x 10 + 2 x 4) + 2` = **38** for staging, against
 * 28 before.
 */
export const controlClusterLegitimateConnections = (environment: Environment): number =>
  ROLLING_DEPLOY_OVERLAP *
    (SERVING_TASKS_WHEN_UP[environment].control * CONTROL_PLANE_POOL_MAX +
      SERVING_TASKS_WHEN_UP[environment].data * CONTROL_READ_POOL_MAX) +
  DATA_MIGRATE_TASK_CONNECTIONS

/**
 * The `DatabaseConnections` threshold. IT IS A LEAK DETECTOR, NOT A CEILING
 * DETECTOR, and the difference is the whole of the derivation.
 *
 * ⚠️ IT WAS ONE FORMULA FOR BOTH CLUSTERS UNTIL R-POOL —
 * `(SERVING_TASKS_WHEN_UP + 1) x APP_POOL_MAX x 2` = 40 — AND IS NOW PER
 * CLUSTER, because the two clusters stopped having the same clients (G2265).
 * The old argument is kept in substance: *"There is nothing this fleet can
 * legitimately do between 40 and 450, so a count in that band is a connection
 * LEAK."*
 *
 *   control   legitimate 38, x2 so a deploy of both planes cannot page    = 76
 *   data      legitimate 210 — and x2 would be 420, 93 percent of the
 *             engine estimate, which is NOT a leak detector any more. So the
 *             data threshold is the DESIGN CEILING itself, 225: the budget was
 *             sized so that nothing legitimate reaches it, which makes any count
 *             above it a leak or a client nobody budgeted — and it is still
 *             HALF the engine estimate, so it pages long before
 *             `max_connections` refuses anybody.
 */
export const auroraConnectionAlarmThreshold = (
  environment: Environment,
  plane: 'data' | 'control',
): number =>
  plane === 'data'
    ? DATA_CLUSTER_CONNECTION_DESIGN_CEILING
    : controlClusterLegitimateConnections(environment) * 2

/**
 * The smallest capacity step Aurora Serverless v2 scales in.
 *
 * It is the unit the ACU threshold is expressed in, deliberately: a cluster
 * within one step of its ceiling cannot scale out of the condition, which is a
 * statement about the engine rather than a percentage somebody liked.
 */
export const AURORA_ACU_STEP = 0.5

/**
 * The `ServerlessDatabaseCapacity` threshold — ONE SCALING STEP BELOW THE
 * CEILING, so the alarm means "this cluster has less than one step of headroom
 * left" rather than "this cluster is busy".
 *
 * ⚠️ IT IS STAGING'S CEILING BECAUSE STAGING'S IS THE ONLY ONE DECLARED.
 * `AURORA_MAX_ACU_STAGING` is the whole of what this app has ruled; a prod
 * environment needs its own pair, and this function will take an environment
 * when it does.
 */
export const auroraAcuCeilingThreshold = (): number =>
  AURORA_MAX_ACU_STAGING - AURORA_ACU_STEP

/**
 * The Aurora cluster identifiers, spelled the way `lib/data-stack.ts` spells
 * them.
 *
 * 🛑 THE ECS CLUSTER AND SERVICE NAMES ARE ALSO NAMED EXPORTS
 * (`PLANES_EXPORT_KEYS`) AND THE OBSERVABILITY STACK IMPORTS THEM RATHER THAN
 * SPELLING THEM — see that stack's header. This helper exists for the AURORA
 * identifiers, which are exported by nothing and which `Data` spells from the
 * environment name alone.
 */
export const auroraClusterIdentifier = (
  environment: Environment,
  plane: 'data' | 'control',
): string => `reconcile-${environment}-${plane}`

/**
 * 🛑 THE FOUR POSTGRESQL PARAMETERS THAT MAKE `cloudwatchLogsExports` SAFE, AND
 * THEY ARE NOT OPTIONAL — G261 SECTION 12.1 IS A CONTAINMENT RULE, NOT A STYLE.
 *
 * "A log line carries identifiers, codes, counts and durations. It never
 * carries a payload field value, counterparty text, a document body, a header
 * value or a query string." Shipping the PostgreSQL log to CloudWatch without
 * pinning these turns invariant 4 and invariant 6 into a property of whatever
 * the default parameter group happens to say on the day.
 *
 *   log_statement                      = none  — otherwise EVERY statement, with
 *                                               every inlined literal, is logged
 *   log_parameter_max_length_on_error  = 0     — THE LOAD-BEARING ONE. Every
 *                                               query in `server/` binds its
 *                                               values, and this is the one
 *                                               setting that decides whether the
 *                                               BOUND VALUES are written beside
 *                                               a statement when it errors
 *   log_parameter_max_length           = 0     — the same question for statements
 *                                               logged by duration rather than by
 *                                               error
 *   log_min_error_statement            = error — pinned at the engine default so
 *                                               it cannot drift DOWN to a level
 *                                               that logs more; the statement
 *                                               TEXT is ours and carries no
 *                                               values, so logging it is useful
 *
 * ⚠️ THREE OF THE FOUR ARE ALREADY THE ENGINE DEFAULT. Pinning a default is not
 * ceremony here: an unpinned default is a value anybody holding
 * `rds:ModifyDBClusterParameterGroup` can change without touching this
 * repository, and the change would be invisible to every control in the gate.
 */
export const PG_LOG_CONTAINMENT_PARAMETERS: Readonly<Record<string, string>> = {
  log_statement: 'none',
  log_parameter_max_length_on_error: '0',
  log_parameter_max_length: '0',
  log_min_error_statement: 'error',
}

// ------------------------------------------- role-secret rotation (G3921)

/**
 * 🛑 WHEN THE FIVE DATABASE ROLE SECRETS ROTATE — G3921/G3922, 4 Oct 2026,
 * closing G3866 in code. THE SCHEDULE IS THE SAFETY ARGUMENT, NOT A CADENCE
 * PREFERENCE, AND IT IS DERIVED FROM FOUR CONSTANTS RATHER THAN CHOSEN:
 *
 *   A PostgreSQL role has ONE password. A task that read the old one at start
 *   keeps its open connections and FAILS ITS NEXT NEW ONE, and `pg` never
 *   re-reads a secret. So a role may only rotate while NO task holding its
 *   secret is running — and there is exactly one hour a day when that is true
 *   by construction and the cluster is up:
 *
 *     22:30 UTC  Aurora starts           `AURORA_START_CRON` (06:30 SGT)
 *     23:00 UTC  ROTATION WINDOW OPENS   this constant      (07:00 SGT)
 *     00:00 UTC  ROTATION WINDOW CLOSES  `ROLE_SECRET_ROTATION_WINDOW`
 *     01:00 UTC  ECS serving services    `Planes`' `…MorningUp`
 *                scale 0 → up            (`SCALE_UP_UTC_HOUR`, 09:00 SGT)
 *
 *   Thirty minutes after the cluster start (the head start `config.ts` already
 *   argues a restart needs) and a full hour of margin before the fleet wakes.
 *   Secrets Manager's cron has no minutes field to spend and no timezone, so
 *   the window is whole UTC hours. `tests/infra/role-secret-rotation.test.mjs`
 *   DERIVES all four edges from the synthesised templates and fails if any
 *   later edit puts the window outside the dark hour.
 *
 * ⚠️ MONDAY 23:00 UTC — the early hours of TUESDAY in Singapore — and it is
 * disjoint from the MASTER rotation (`ROTATION_CRON_UTC` in `data-stack.ts`,
 * Tuesday 02:00–05:00 UTC), so the admin secret this rotation reads is never
 * itself mid-rotation. A weekend is refused for the reason the master's block
 * gives: the clusters are stopped.
 *
 * 🛑 THE CADENCE IS SEVEN DAYS, `ROLE_SECRET_ROTATION_INTERVAL_DAYS`, AND THE
 * DERIVATION IS: (1) G263 names no number; (2) the dark hour exists only on a
 * weekday morning, and a monthly day-of-month lands on a weekend two times in
 * seven — a rule about which dates are safe is §5's landmark-instead-of-
 * property; (3) weekly means a broken rotation (a refused TLS chain, a role
 * renamed, a fleet left up overnight) is ALARMED within a week of the change
 * that broke it, not discovered a quarter later. It is the master's cadence
 * for the master's reason. Longer is a ruling, not an edit: it needs a
 * cron the dark-hour test can still derive.
 */
export const ROLE_SECRET_ROTATION_CRON_UTC = 'cron(0 23 ? * MON *)'
/** The window. One hour: the dark hour, ending an hour before the fleet wakes. */
export const ROLE_SECRET_ROTATION_WINDOW = '1h'
/** The cadence `ROLE_SECRET_ROTATION_CRON_UTC` encodes. Derivation above. */
export const ROLE_SECRET_ROTATION_INTERVAL_DAYS = 7

/**
 * The role-secret rotation function's name. Set explicitly for the reason
 * the hosted rotation's name is (trap 6, `data-stack.ts`): a construct-path
 * name breaks Lambda's 64-character limit in CloudFormation, not in synth.
 * `secretId` is the secret's construct id, lowercased — `dataapp`,
 * `controlreader` — the same token its `secretName` carries.
 */
export const roleRotationFunctionName = (environment: Environment, secretId: string): string =>
  `reconcile-${environment}-${secretId.toLowerCase()}-rotation`

/**
 * The HOSTED master-secret rotation function's name, which `data-stack.ts`
 * has set since trap 6. Moved here unchanged so `Observability` can alarm on
 * it by NAME without a construct reference (G3924) — the template string is
 * byte-identical.
 */
export const masterRotationFunctionName = (
  environment: Environment,
  planeSlug: 'data' | 'control',
): string => `reconcile-${environment}-${planeSlug}-secret-rotation`

/**
 * The serving ECS service for a plane, by name. `Planes` names its services
 * with this; the role-secret rotation's holder check (G3923) reads it, so the
 * two cannot drift. Not an export — a by-name join, like `ecsClusterName()`.
 */
export const planeServiceName = (environment: Environment, plane: 'data' | 'control'): string =>
  `reconcile-${environment}-${plane}-plane`

/**
 * The FOUR role secrets that rotate (⚠️ said five until G4471 — G4464; five was
 * true until G4320 retired `ControlReader`), by construct id, and the SERVICES that
 * hold each one — the holder check refuses to rotate while any is running.
 *
 * 🛑 ONLY SERVICES ARE LISTED. The two MIGRATE tasks and the run worker are
 * one-shot: each reads AWSCURRENT at start and exits, so the next run reads the
 * new password. A migrate task that started BEFORE a rotation and runs
 * `createRoles()` AFTER it re-sets the OLD password — named in
 * `deploy-handoff.md` §31 as the one race the schedule does not close.
 *
 * ⚠️ THIS TABLE IS A MIRROR OF `Planes`' SECRETS BLOCKS, AND WHAT MAKES IT ONE
 * RATHER THAN A THIRD PLACE TO DRIFT IS `tests/infra/role-secret-rotation.test.mjs`,
 * WHICH DERIVES THE HOLDERS FROM THE SYNTHESISED `Planes` SERVICE TASK
 * DEFINITIONS AND REQUIRES SET EQUALITY. A new holder added to a service and
 * not here is a red gate.
 */
export const ROLE_SECRET_HOLDER_SERVICES: Readonly<
  Record<'DataMigrator' | 'DataApp' | 'DataEngine' | 'ControlApp', readonly ('data' | 'control')[]>
> = {
  DataMigrator: [],
  DataApp: ['data'],
  DataEngine: [],
  ControlApp: ['control'],
  /* ⛔ `ControlReader: ['data']` RETIRED — G4320, 5 Oct 2026 (the owner's "Full restore" ruling). */
}

/** The one alarm on rotation failure, in `Observability` (G261 / G3924). */
export const ROTATION_FAILURE_ALARM_SUFFIX = 'secret-rotation-failed'

/**
 * VPC flow-log retention, in days. Short, like every other staging retention
 * here, and for the reason `lib/planes-stack.ts` states about its own two: the
 * record assigns no retention class to operational logs, so this is a choice
 * named as a choice and it is the owner's to move.
 */
export const FLOW_LOG_RETENTION_DAYS = 14

// ------------------------------------------------------- the run queue (R-B)

/**
 * `RunQueue` — THE ELEVENTH STACK, 20 Sep 2026, APPLYING THE OWNER'S RULING
 * **R-B**: *"A worker claims runs from a REAL QUEUE (SQS), never by
 * scanning."*
 *
 * 🛑 THE RULING IS ABOUT INVARIANT 2 AND NOT ABOUT THROUGHPUT. The admitting
 * handler publishes `(tenantId, runId)`; a worker consumes one message and
 * opens exactly that tenant's scope. **No cross-tenant read exists anywhere in
 * the design**, so *"Exactly one cross-tenant read path"* is untouched rather
 * than argued about. The rejected alternatives are preserved on
 * `server/data-plane/run-queue.ts`, and the deciding one was measured rather
 * than reasoned: a `FOR UPDATE SKIP LOCKED` scan by a worker with no tenant
 * returns ZERO rows under G100, every time, and the worker cannot enumerate
 * tenants either — so the scan needs `BYPASSRLS`, *"and every isolation
 * assertion in `tests/` is relative to no serving process holding that role."*
 */
export const STACK_RUN_QUEUE_STAGING = 'reconcile-run-queue-staging'

/** The `RunQueue` stack for one environment. */
export const runQueueStackName = (environment: Environment): string =>
  `reconcile-run-queue-${environment}`

/**
 * The queue an admitted run is published to.
 *
 * ⚠️ **STANDARD AND NOT FIFO, AND THE NAME CARRIES NO `.fifo` SUFFIX FOR THAT
 * REASON.** FIFO was considered and is refused on one axis: its deduplication
 * window is FIVE MINUTES, so it would sit in front of this product's real
 * idempotency guarantee — `run_idempotency_key`, a UNIQUE INDEX with no window
 * at all (`db/migrations/0069_run_admission.sql` §3) — and mask it for exactly
 * as long as anybody would be testing. **A control that works for five minutes
 * and then silently stops is worse than no control**, because the second press
 * at minute six looks like a regression in the index. FIFO's other offer,
 * per-`MessageGroupId` ordering, would serialise one tenant's runs, which is a
 * scheduling decision nobody has ruled.
 *
 * 🛑 SO THE QUEUE IS AT-LEAST-ONCE AND THE CONSUMER IS IDEMPOTENT BY
 * CONSTRUCTION: `claimAdmittedRun()` reads one row and CREATES NOTHING.
 */
export const runQueueName = (environment: Environment): string =>
  `reconcile-${environment}-run-admitted`

/** Where a message goes when it cannot be read. */
export const runQueueDeadLetterName = (environment: Environment): string =>
  `reconcile-${environment}-run-admitted-dlq`

/**
 * How many deliveries a message gets before the redrive policy moves it.
 *
 * ⚠️ FIVE IS NOT AN SLO AND IS DERIVED FROM THE TWO WAYS A DELIVERY CAN FAIL.
 * A TRANSIENT failure — the database is starting, the pool is exhausted — is
 * answered by another attempt, and Aurora Serverless v2 in this app scales
 * from `AURORA_MIN_ACU_STAGING` and is STOPPED outside working hours by
 * `AURORA_STOP_CRON`, so *"try again shortly"* is a real repair here. A
 * PERMANENT failure — a body that will not parse — is answered by no number of
 * attempts, and five is short enough that it reaches a person the same day.
 */
export const RUN_QUEUE_MAX_RECEIVE_COUNT = 5

/**
 * How long a worker holds a message before it becomes visible again.
 *
 * 🛑 **1800 SECONDS (30 MINUTES) — THE OWNER'S RULING, 22 Sep 2026 — G1834,
 * AND IT IS A POLICY CHOICE BOUNDED BY NOTHING MEASURED, NAMED AS SUCH RATHER
 * THAN DRESSED AS A DERIVATION.**
 *
 * ⚠️ THIS SAID **THIRTY SECONDS** UNTIL THIS RULING AND IT IS THE SENTENCE
 * THIS CONSTANT'S OWN COMMIT MESSAGE PREDICTED WOULD BE OWED: *"the commit
 * that writes an executor owes this number a fresh argument … than inheriting
 * one derived from a `SELECT`."* `server/data-plane/run-executor.ts` (E5) and
 * D-1's queue consumer then MEASURED what thirty seconds cost: a run whose
 * execution exceeds it becomes visible again mid-flight, a second worker
 * starts a SECOND EXECUTION of the SAME RUN concurrently — no idempotency key
 * prevents it, because `run_idempotency_key` guards ADMISSION and not
 * execution — and after `RUN_QUEUE_MAX_RECEIVE_COUNT` (5) deliveries a run
 * that SUCCEEDED EVERY TIME lands on the dead-letter queue, so the alarm that
 * finally fires reports the OPPOSITE of what happened.
 *
 * 🛑 **THE HONEST STATEMENT, SAID PLAINLY: NO REAL DOCUMENT SET HAS EVER BEEN
 * TIMED IN THIS ACCOUNT, SO NO NUMBER HERE RESTS ON A MEASUREMENT OF A REAL
 * RUN'S DURATION.** `docs/build/completion-plan.md` §10 item 5 names the
 * shape exactly: *"nobody has run it against a real corpus, because no real
 * corpus exists in this repository … a bound is not a measurement."* 1800 is
 * chosen NEAR THE TOP of that item's own 15–30 minute recommended range,
 * because the cost of choosing TOO SHORT (repeating the exact double-execution
 * defect this ruling exists to bound, just less often) is worse than the cost
 * of choosing TOO LONG (a genuinely crashed or hung worker's message waits
 * longer before the redrive policy can act on it). **This does not eliminate
 * the defect — a run whose real duration exceeds 1800s repeats it — it bounds
 * how often the defect can occur given what is currently unmeasurable.**
 * `RUN_WORKER_TASK_CPU`'s own header states the discipline this constant
 * follows: *"nothing has ever run a reconciliation in this account, so no …
 * number here rests on an observation. Said plainly so nobody cites it as a
 * sizing."*
 *
 * ⚠️ **THE ELAPSED TIME TO THE DEAD-LETTER QUEUE MOVES WITH IT, NAMED
 * EXPLICITLY RATHER THAN LEFT TO BE DERIVED (G1834), BECAUSE D-1's OWN
 * MEASUREMENT WAS OF THE OLD FIGURE:** `RUN_QUEUE_MAX_RECEIVE_COUNT (5) ×
 * RUN_QUEUE_VISIBILITY_SECONDS` moves from 150 seconds (2.5 minutes) to 9000
 * seconds (**2.5 hours**). `tests/infra/run-queue.test.mjs` §9 asserts this
 * product against a value TYPED INTO the test, per this file's own opening
 * rule that comparing a stack to the constant the stack read proves only that
 * a variable equals itself.
 *
 * ⚠️ **THREE THINGS THIS RULING DELIBERATELY DOES NOT DO, NAMED SO NOBODY
 * REACHES FOR THEM AS A CHEAPER FIX:** it does not heartbeat the message with
 * `sqs:ChangeMessageVisibility` — a THIRD consuming verb `infra/lib/run-queue-
 * stack.ts` withholds by name, precisely so that taking it is a written
 * decision rather than a convenience; it does not touch the DLQ-triage repair
 * E5/E6 already built (`tenant.run_engine_account` resolving what a
 * dead-letter message actually meant) — that stays the second line of
 * defence, unmodified; and it does not shorten
 * `RUN_QUEUE_DEAD_LETTER_MESSAGE_THRESHOLD` or `RUN_QUEUE_MAX_RECEIVE_COUNT`
 * to compensate — neither is this ruling's to move.
 *
 * ⚠️ **NOTHING ELSE IN THE PATH IS SHORTER, MEASURED RATHER THAN ASSUMED
 * (G1835):** `RUN_WORKER_POLL_MINUTES = 1` schedules a NEW worker task every
 * tick regardless of a prior tick's status, so a long execution now produces
 * several concurrent, MOSTLY IDLE worker tasks rather than several duplicate
 * executions — each additional tick's `receive()` correctly finds the one
 * admitted run's message invisible and returns `none`. A cost observation,
 * not a correctness defect, and not this ruling's to fix. `grep -n
 * 'stopTimeout' infra/lib/run-queue-stack.ts` → nothing: Fargate tasks carry
 * no maximum runtime by default and none is set here.
 */
export const RUN_QUEUE_VISIBILITY_SECONDS = 1800

/**
 * How long an unconsumed message survives.
 *
 * ⚠️ FOUR DAYS ON THE QUEUE AND FOURTEEN ON THE DEAD-LETTER QUEUE — SQS's
 * maximum — and the asymmetry is the point: a message nobody consumed for four
 * days names a run whose operator has long since pressed Run again, while a
 * message in the dead-letter queue is EVIDENCE and must outlive a weekend and
 * a public holiday.
 */
export const RUN_QUEUE_RETENTION_DAYS = 4
export const RUN_QUEUE_DEAD_LETTER_RETENTION_DAYS = 14

/**
 * The queue URL the DATA PLANE is given as `RECONCILE_RUN_QUEUE_URL` — G1281.
 *
 * 🛑 SPELLED FROM THE ACCOUNT, THE REGION AND THE NAME, **NEVER READ OFF THE
 * `RunQueue` STACK**, AND THE REASON IS A DEPLOY-ORDER CYCLE RATHER THAN A
 * PREFERENCE.
 *
 * `lib/run-queue-stack.ts` joins `Planes` BY NAME — `iam.Role.fromRoleName()` —
 * precisely so that granting `sqs:SendMessage` adds no export to `Planes`, and
 * it pays for that with an unenforced order: **`Planes` before `RunQueue`**, or
 * the `AWS::IAM::Policy` fails with `Cannot find the role`. If `Planes` then
 * read `queue.queueUrl` by construct reference, CDK would mint an export on
 * `RunQueue` and a matching `Fn::ImportValue` here, and the order would become
 * **`RunQueue` before `Planes`** as well. **Those two together are a deadlock
 * on any account where neither is deployed yet** — not a synth-time
 * `«DependencyCycle»`, which CDK would at least name, but a pair of
 * CloudFormation failures a person has to diagnose from two error messages that
 * each look like the other stack's fault.
 *
 * Both stacks are deployed in `000000000000` today, so nothing in this account
 * would have noticed. That is exactly why it is written down here rather than
 * discovered by whoever stands up the second environment.
 *
 * ⚠️ AN SQS QUEUE URL IS THE ONE AWS IDENTIFIER IN THIS APP THAT IS FULLY
 * SPELLABLE, and that is what makes the by-name join available at all. It
 * carries no generated suffix — unlike a load balancer ARN, which
 * `lib/observability-stack.ts` must derive with template functions for exactly
 * that reason, and unlike a secret ARN, which carries six random characters.
 * `auroraClusterIdentifier()` above is the same argument on the same axis.
 *
 * **Verified against the deployed stack's own output on 20 Sep 2026**, rather
 * than asserted from the documented format:
 *
 *     aws cloudformation describe-stacks --region us-west-2 \
 *       --stack-name reconcile-run-queue-staging \
 *       --query 'Stacks[0].Outputs[?OutputKey==`RunQueueUrl`].OutputValue'
 *     -> https://sqs.us-west-2.amazonaws.com/000000000000/reconcile-staging-run-admitted
 *
 * ⚠️ `tests/infra/run-queue.test.mjs` ASSERTS THE TWO SIDES AGREE by reading
 * the queue's own `Ref` out of the `RunQueue` template and comparing it to what
 * the `Planes` task definition carries — so the spelling cannot drift from the
 * resource it names without a red gate. A constant that merely looks right is
 * the failure `PLANES_EXPORT_KEYS` exists to prevent one stack over.
 */
export const runQueueUrl = (environment: Environment): string =>
  `https://sqs.${AWS_REGION}.amazonaws.com/${AWS_ACCOUNT}/${runQueueName(environment)}`

/**
 * The dead-letter queue depth that means runs are being admitted and never
 * processed — G1283.
 *
 * 🛑 THE THRESHOLD IS **ONE**, AND IT IS DERIVED FROM
 * `RUN_QUEUE_MAX_RECEIVE_COUNT` RATHER THAN CHOSEN. Every other alarm in
 * `lib/observability-stack.ts` needs a tolerance because its metric has a
 * legitimate non-zero band — a draining target emits a transient 5xx, a
 * rolling deploy opens a second pool. **This one does not, because the
 * tolerance has already been spent upstream**: a message only reaches this
 * queue after the redrive policy has delivered it `RUN_QUEUE_MAX_RECEIVE_COUNT`
 * times and the consumer has declined it every time. Asking for a second
 * message before alarming would be asking for ten more failed deliveries.
 *
 * ⚠️ IT IS WRITTEN AS A LITERAL `1` AND NOT AS AN EXPRESSION OVER
 * `RUN_QUEUE_MAX_RECEIVE_COUNT`, DELIBERATELY. A first draft spelled it
 * `RUN_QUEUE_MAX_RECEIVE_COUNT * 0 + 1`, which arithmetically IS one and reads
 * as a derivation — **a number dressed as a derivation is worse than a number,
 * because the next reader believes changing the retry count will move it and it
 * will not.** `ALB_5XX_RATE_PERCENT` is a literal `1` for the same reason: the
 * argument lives in the prose, where it can actually be read, and the constant
 * says what it is.
 *
 * ⚠️ AND IT IS AN ALARM NOBODY RECEIVES, TODAY, FOR THE SAME REASON AS THE
 * OTHER EIGHT: R-F keeps the topic UNSUBSCRIBED — *"the alarm topic stays
 * UNSUBSCRIBED, deliberately"* — so this publishes to a topic that reaches no
 * person. It is built anyway because the signal has to EXIST before a
 * subscriber can be named, and because `lib/run-queue-stack.ts` names this
 * construct in its own header rather than taking it: *"a dead-letter queue with
 * a growing depth and nothing watching it is a control that reports success by
 * being unread."*
 *
 * 🛑 **AND THERE IS A SECOND REASON IT CANNOT FIRE TODAY, WHICH IS WORSE THAN
 * THE FIRST AND IS NAMED RATHER THAN LEFT TO BE FOUND: NOTHING CONSUMES THE
 * QUEUE.** A message reaches a dead-letter queue by being RECEIVED
 * `RUN_QUEUE_MAX_RECEIVE_COUNT` times, and nothing in this account holds
 * `sqs:ReceiveMessage` — `lib/run-queue-stack.ts` §3 withholds it by name. So
 * the depth here is structurally zero until a worker is deployed, and an
 * unfired alarm on an empty queue is indistinguishable from a healthy one.
 * **`tests/infra/observability.test.mjs` asserts this alarm exists; nothing
 * asserts it can fire, and it cannot until R-B's consume half is deployed.**
 * That is stated here so the commit that deploys a worker meets this paragraph
 * rather than assuming the alarm was already proving something.
 *
 * ✅ **THAT COMMIT IS R-W, 21 Sep 2026 — G1541 — AND THE PARAGRAPH ABOVE IS
 * CORRECTED RATHER THAN DELETED, because it is the sentence that told a reader
 * this alarm was decorative and it is the one that named its own successor.**
 * A scheduled ECS task now holds `sqs:ReceiveMessage` and `sqs:DeleteMessage`
 * on this queue — `lib/run-queue-stack.ts` §4 — so a message CAN now be
 * delivered `RUN_QUEUE_MAX_RECEIVE_COUNT` times and CAN now reach the
 * dead-letter queue. **The depth is no longer structurally zero, and this
 * alarm can fire for the first time since it was written.** This slice is what
 * ARMS it.
 *
 * ⚠️ **AND THE FIRST REASON IS UNCHANGED AND STILL BINDS: R-F's topic is still
 * UNSUBSCRIBED, so a fired alarm still pages NOBODY.** R14 is the open ruling —
 * *"who is paged"* — and D-3 in `docs/build/completion-plan.md` is the slice
 * that closes it. **An alarm that can fire and reaches no person is a strictly
 * better state than one that cannot fire, and it is not a finished one.**
 */
export const RUN_QUEUE_DEAD_LETTER_MESSAGE_THRESHOLD = 1

// ------------------------------------ the public marketing plane (Amplify)

/**
 * ┌─ 🛑 THE APEX. `reconcileai.app`, NO LABEL, AND IT IS THE THIRD PLANE ──────┐
 * │ THE ARCHITECTURE DOCUMENTS DO NOT DESCRIBE. S5, 22 Sep 2026.              │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * `EDGE_APEX_IS_SERVED_ELSEWHERE` above is the sentence this block answers, and
 * it has been true and unimplemented since 19 Sep 2026: *"`reconcileai.app` —
 * no label — is the public marketing plane, and `docs/build/deploy-handoff.md`
 * §5.4 puts it on Amplify: **a different tool for a different job**."* **G298
 * confirmed the narrow reading of G297's *"flat apex"* and the apex has been on
 * NEITHER certificate and NEITHER distribution ever since.** This is the stack
 * that serves it; `EDGE_APEX_IS_SERVED_ELSEWHERE` is unchanged and stays
 * `true`, because what it asserts — *not the `Edge` stack's* — is still exactly
 * right.
 *
 * 🛑 **THE APEX DOES NOT COLLIDE WITH THE `*.reconcileai.app` SINKHOLE, AND THE
 * REASON IS THE ONE FACT G297's WHOLE ARGUMENT RESTS ON: A WILDCARD MATCHES
 * EXACTLY ONE LABEL.** `*.reconcileai.app` covers `console.reconcileai.app`
 * and covers `ten-acme.reconcileai.app`; it covers `reconcileai.app` **not at
 * all**, in DNS and in TLS alike. So:
 *
 *   · the `FlatSinkholeA`/`FlatSinkholeAaaa` records in `lib/edge-stack.ts` §6
 *     never answer for the apex, and an apex record takes nothing from them;
 *   · the flat CONSOLE certificate is not valid for the apex either, which is
 *     why Amplify issues and renews a THIRD certificate of its own for this
 *     name — one neither `EdgeCertificate` stack knows about.
 *
 * **Both halves are asserted rather than reasoned** —
 * `tests/infra/amplify.test.mjs` §1 requires the apex to be absent from every
 * `domainNames` list and from every Route 53 record name in the `Edge`
 * template, in that template rather than in this one.
 */
export const APEX_HOST = ROOT_DOMAIN

export const STACK_AMPLIFY_STAGING = 'reconcile-amplify-staging'

/** The `Amplify` stack for one environment. */
export const amplifyStackName = (environment: Environment): string =>
  `reconcile-amplify-${environment}`

/**
 * The Amplify app's name. It appears in the console's account-wide listing and
 * nowhere else, so the environment is in it for the same reason it is in every
 * other name here.
 */
export const amplifyAppName = (environment: Environment): string =>
  `reconcile-marketing-${environment}`

/**
 * The one branch the apex is served from.
 *
 * ⚠️ **IT IS NOT A GIT BRANCH TODAY AND THE NAME IS THEREFORE A LABEL RATHER
 * THAN A REFERENCE** — see `MARKETING_IS_MANUAL_DEPLOY` below, which refuses
 * the repository connection and says why. Amplify requires a branch to hang a
 * deployment and a domain sub-domain off; this is that branch. The name `main`
 * is chosen so that connecting a repository later is a change of ONE property
 * on the app rather than a rename of the thing the domain points at — and a
 * rename there is the G297 Route 53 race, one service over.
 */
export const MARKETING_BRANCH = 'main'

/**
 * ┌─ 🛑 NO REPOSITORY, NO ACCESS TOKEN, NO WEBHOOK. THIS IS THE ONE PLACE ─────┐
 * │ THIS SLICE DEPARTS FROM THE `ci-image-stack.ts` PRECEDENT IT WAS TOLD TO  │
 * │ FOLLOW, AND IT DEPARTS ON A MEASUREMENT RATHER THAN A PREFERENCE.         │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * The precedent is real and its SHAPE is followed — *"the one piece that cannot
 * be created by CDK … its ARN arrives as a CloudFormation PARAMETER"*. **It
 * cannot be followed literally, because `AWS::Amplify::App` has no
 * CodeConnections property of any kind.** Derived from the pinned
 * `aws-cdk-lib@2.270.0`'s own generated types rather than from memory:
 *
 *     grep -E 'readonly [a-zA-Z]+\??:' \
 *       infra/node_modules/aws-cdk-lib/aws-amplify/lib/amplify.generated.d.ts
 *     -> accessToken · autoBranchCreationConfig · basicAuthConfig · buildSpec
 *        cacheConfig · computeRoleArn · customHeaders · customRules
 *        description · enableBranchAutoDeletion · environmentVariables
 *        iamServiceRole · jobConfig · name · oauthToken · platform
 *        repository · tags
 *
 * **There is no connection ARN field, and AWS's own property documentation says
 * what the two token fields are:** *"The **personal access token** for a GitHub
 * repository … used to authorize access … using the Amplify GitHub App. The
 * token is not stored."* and *"You must specify either `AccessToken` or
 * `OauthToken` when you create a new app."* Amplify's repository connection is
 * therefore authorised by a **personal access token at create time**, which is
 * the exact shape `lib/connections.ts` records G263 as forbidding: *"OAuth …
 * a personal token — the shape G263 forbids."* A CodeConnections ARN passed
 * into `accessToken` is not a token and would fail at CREATE.
 *
 * 🛑 **AND THE SECOND REASON IS LARGER AND IS NOT ABOUT CREDENTIALS AT ALL:
 * THERE IS NO REPOSITORY TO CONNECT.** The marketing site does not exist. The
 * pack's own note on `V1 Landing` says what it will be — *"marketing owns the
 * content, engineering owns the shell, and a CMS sits behind our chrome"* — and
 * none of those three things is in this repository. `1CloudHub/Reconcile`'s
 * build output is `frontend/dist`, **the application shell**, and pointing the
 * apex at it is precisely what `EDGE_APEX_IS_SERVED_ELSEWHERE` exists to
 * forbid: *"point the product's own marketing site at a distribution that
 * serves an application shell."* **A repository connection here would be a
 * connection to the wrong repository** — `0004`'s *"a privilege ahead of its
 * writer"*, arriving as a source.
 *
 * ✅ **WHAT IS BUILT INSTEAD: a MANUAL-DEPLOY app.** No `repository`, so
 * neither token field is required and no credential exists anywhere in this
 * stack's life. A branch is deployed with `aws amplify start-deployment`
 * against a zip, which is one command and takes no secret. **The cost is named
 * and is real: there is no build on push and no preview environment**, and the
 * day a marketing repository exists, connecting it is a console action — AWS
 * documents the GitHub App flow as console-only — plus one property here.
 */
export const MARKETING_IS_MANUAL_DEPLOY = true

/**
 * ┌─ 🛑 THE REWRITES. THIS IS THE LOAD-BEARING PART OF THE STACK AND THE ─────┐
 * │ ONLY PART OF IT THAT CAN BE WRONG IN A WAY NOBODY NOTICES.               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * An Amplify `CustomRule` with `status: '200'` is a **reverse proxy**: the
 * browser sees one origin, `https://reconcileai.app`, and Amplify fetches the
 * target server-side. That is how the public plane reaches an operation without
 * a preflight — **G226's property, achieved with a different tool**:
 *
 *   > *"under G179 one host serves one tenant, so production is same-origin
 *   >  regardless; the proxy makes dev match the shape production already
 *   >  has."*
 *
 * and G293's negative argument, which is the one that actually decides it:
 * *"`mountTier()` takes every route from the contract and THE CONTRACT DECLARES
 * NO `OPTIONS`, so answering a CORS preflight would be mounting an operation
 * the wire does not declare."* Derive that premise, do not trust this comment:
 *
 *     grep -rc '^\s*options:' docs/contracts/*.openapi.yaml   -> 0, all tiers
 *
 * 🛑 **THE LIST IS `/session/realm` AND NOTHING ELSE, AND THAT IS NARROWER THAN
 * THE `/session/*` THIS SLICE WAS ASKED FOR. THE NARROWING IS THE FINDING.**
 * `EDGE_PLANE_PATH_PATTERNS` publishes `/session` and `/session/*` on the
 * TENANT distribution, and that is right there: a tenant host is a host a
 * session may be bound to. **The apex is the one host in this product that must
 * never hold a session** — no tenant, no console, no principal — and a
 * 200-rewrite is invisible to the browser, so every cookie on that exchange is
 * the APEX's:
 *
 *   · `completeFederatedSignIn` at `/session/federated` **MINTS** a session.
 *     Minted through this proxy, `server/data-plane/session-cookie.ts`'s
 *     `__Host-reconcile_session` binds to `reconcileai.app` — and G180's
 *     `checkHostBinding()` compares the bound host on EVERY request and
 *     REVOKES on a mismatch, so the person is signed in at the one host they
 *     must never be signed in at and signed out everywhere else.
 *   · `getSession` and `signOut` at `/session` need a session the apex has no
 *     way to be carrying, so proxying them publishes a refusal and nothing
 *     else — while widening the surface.
 *   · `resolveHomeRealm` at `/session/realm` is the exact opposite and is why
 *     this rule exists at all. Its own contract text: *"no human principal and
 *     no tenant — this operation runs BEFORE any authentication"*, and *"IT IS
 *     NEVER GIVEN A USER TO LOOK UP."* It mints nothing, sets no cookie, reads
 *     no cookie and takes a DOMAIN. It is the one session-tier operation a
 *     host with no session can safely publish.
 *
 * `assertProxiesNoSessionBearingPath()` below is the executable form of those
 * three paragraphs, and `infra/test-fixtures/amplify-session-bearing-path.ts`
 * witnesses it refusing — without which this whole block is a paragraph
 * (`docs/HANDOFF.md` §5.6).
 *
 * ⚠️ **THE TARGET IS THE CONSOLE DISTRIBUTION AND THE CONSOLE DISTRIBUTION
 * REACHES NO PLANE TODAY — THREE BLOCKERS, AND THIS PARAGRAPH NAMED THE WRONG
 * OBSERVABLE BEHAVIOUR (G2011).** IT READ: *"`lib/edge-stack.ts` measures it in
 * its own header — `get-distribution-config --id EPT1B88M3QIBB` →
 * `CacheBehaviors.Quantity: 0`, one origin, the bundle — so this rewrite
 * resolves, connects, completes a handshake and is answered with
 * `index.html`."* Corrected rather than deleted: it is the sentence four files
 * carried, and a reader debugging `/lookup` would have been looking for a page
 * that never arrives.
 *
 *   1. **NO PLANE ORIGIN** — the measurement is right.
 *   2. **THE METHOD IS NOT ALLOWED.** `resolveHomeRealm` is a **POST** and the
 *      console distribution's only behaviour is `ALLOW_GET_HEAD`; CloudFront
 *      refuses a method a behaviour does not allow with **its own 403 body**,
 *      so the request reaches no origin at all. Closing (1) alone leaves this.
 *   3. ⚠️ **TRUE OF THIS BRANCH AND FALSE AFTER THE MERGE**: the operation was
 *      mounted in no process when this was written, and the sibling slice
 *      (G1941) mounts it. Derive it:
 *      `grep -rn 'resolveHomeRealm' server/data-plane/start.ts`.
 *
 * `tests/infra/amplify.test.mjs` §3 pins the target host so the two slices
 * cannot disagree about which one is proxied.
 */
export const MARKETING_PROXIED_PLANE_PATHS = ['/session/realm'] as const

/**
 * ┌─ 🛑 THE APEX PROXIES WHAT IS ON THE ALLOW-LIST AND NOTHING ELSE THE PLANE ┐
 * │    SERVES — G2009, 22 Sep 2026, AND IT REPLACES A DENY-LIST OF TWO        │
 * │    SPELLINGS.                                                             │
 * │                                                                           │
 * │ The first draft refused `['/session', '/session/federated']` and          │
 * │ `EDGE_LOCAL_ONLY_PATHS`, and its own docstring argued that it had avoided │
 * │ §5.1 by reproducing Amplify's matcher rather than CloudFront's. **It then │
 * │ committed §5.1 on the LIST**: the rule was keyed on the `/session`        │
 * │ SPELLING and not on the property *does this operation read, mint or bind  │
 * │ a session*. Measured against the first draft:                             │
 * │                                                                           │
 * │     /session/<*>      REFUSED                                             │
 * │     /context/resolve  PASSES   <- D1                                      │
 * │     /context/<*>      PASSES                                              │
 * │     /v1/<*>           PASSES                                              │
 * │                                                                           │
 * │ 🛑 **`/context/resolve` IS THE SHARPEST OF THE THREE AND IT PASSED.** It  │
 * │ is D1: it reads `__Host-reconcile_session`, and it DURABLY BINDS that     │
 * │ session's tenant — `server/data-plane/context.ts` calls the bound row     │
 * │ *"the DURABLE side effect"*. Proxied from the apex, G180's                │
 * │ `checkHostBinding()` then compares `reconcileai.app` against the real     │
 * │ host on the next request and REVOKES: the identical failure the           │
 * │ `/session/federated` paragraph above describes at length, through a door  │
 * │ that paragraph's list did not name.                                       │
 * │                                                                           │
 * │ ⚠️ **AND `/v1/*` MATTERS FOR A SECOND REASON THAT IS NOT ABOUT COOKIES:** │
 * │ the apex is CMS-authored marketing content written by people who are not  │
 * │ engineers. Proxying the product's authenticated API onto that origin puts │
 * │ every capability operation same-origin with third-party markup, where the │
 * │ browser's own origin controls stop applying to it.                        │
 * │                                                                           │
 * │ **THE POLARITY IS INVERTED: everything the plane serves is refused unless │
 * │ it is on `MARKETING_PROXIED_PLANE_PATHS`.** A session-tier operation      │
 * │ minted next month is refused by default rather than by somebody           │
 * │ remembering to extend a deny-list — `db/migrations/0069`'s polarity       │
 * │ argument, applied to a path set.                                          │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * The witnesses the guard tests a rewrite source against, one entry per
 * pattern the `Edge` stack publishes to the plane.
 *
 * 🛑 IT IS A TOTAL `Record` OVER `EDGE_PLANE_PATH_PATTERNS` AND THAT IS THE
 * COMPLETENESS CONTROL, not tidiness: a pattern added to the edge's plane
 * behaviours without a witness here is `TS2741` at this declaration, which is
 * `CLAUDE.md`'s own rule — *"an unhandled member then becomes a compile error
 * rather than a runtime surprise."* The guard cannot test a GLOB, so it tests
 * concrete paths a glob covers, and this is where the two are joined.
 */
export const MARKETING_PLANE_PATH_WITNESSES: Record<
  (typeof EDGE_PLANE_PATH_PATTERNS)[number],
  readonly string[]
> = {
  /* Every capability operation. `/v1/*` does not match `/v1`, so both. */
  '/v1/*': ['/v1', '/v1/runs', '/v1/exceptions'],
  /* D1. It reads the session cookie and BINDS the session's tenant. */
  '/context/*': ['/context', '/context/resolve'],
  /* getSession and signOut. */
  '/session': ['/session'],
  /* completeFederatedSignIn MINTS one; resolveHomeRealm is the allow-listed
   * exception and is subtracted below rather than omitted here, so this entry
   * stays a statement about what the EDGE serves. */
  '/session/*': ['/session/federated', '/session/realm'],
}

/**
 * The concrete paths a rewrite source on the apex may not reach.
 *
 * ⚠️ IT IS DERIVED AND NOT WRITTEN DOWN: the plane's whole served surface,
 * minus the allow-list, plus the plane's local-only paths. `EDGE_LOCAL_ONLY_
 * PATHS` is in for the reason it is refused one distribution over — *"there is
 * no session on them, no capability gate and no invariant 10 record"* — and a
 * guard on one distribution that does not exist on the other is a guard keyed
 * on a landmark.
 */
export function marketingRefusedPaths(): readonly string[] {
  const permitted = new Set<string>(MARKETING_PROXIED_PLANE_PATHS)
  const served = Object.values(MARKETING_PLANE_PATH_WITNESSES).flat()
  return [...served.filter((path) => !permitted.has(path)), ...EDGE_LOCAL_ONLY_PATHS]
}

/**
 * Whether an Amplify `CustomRule` source would proxy `path`.
 *
 * 🛑 IT REPRODUCES AMPLIFY'S PLACEHOLDER SEMANTICS AND NOT CLOUDFRONT'S, AND
 * THE TWO ARE NOT THE SAME LANGUAGE — which is why `edgePatternMatches()` above
 * is NOT reused. Amplify's rewrite sources use ANGLE-BRACKET placeholders:
 * `<*>` stands for the rest of the path and `<name>` for exactly one segment.
 * A bare `*` is a literal asterisk to Amplify and a wildcard to CloudFront, so
 * borrowing the other matcher would have been a rule keyed on a resemblance —
 * `docs/HANDOFF.md` §5.1, inside the guard written to prevent it.
 *
 * ⚠️ IT IS A MATCHER AND NOT A VALIDATOR. The question is *"would Amplify route
 * this request through this rule"*, never *"is this source well spelled"*.
 */
export function marketingRuleMatches(source: string, path: string): boolean {
  const escaped = source.replace(/[.+^${}()|[\]\\*?]/g, '\\$&')
  const expression = escaped.replace(/<\\\*>/g, '.*').replace(/<[A-Za-z0-9_-]+>/g, '[^/]+')
  return new RegExp(`^${expression}$`).test(path)
}

/**
 * Refuse, at synth, a rewrite source that would proxy a session-bearing or a
 * local-only path from the apex.
 *
 * ⚠️ IT NAMES THE PATH AND THE REASON, NOT THE RULE. A reader who meets this
 * must learn WHICH surface would be published and why that surface in
 * particular — `assertPublishesNoLocalOperation()` above is the same shape and
 * is where the form comes from.
 */
export function assertProxiesNoSessionBearingPath(source: string): void {
  const published = marketingRefusedPaths().filter((path) =>
    [path, `${path}/`].some((request) => marketingRuleMatches(source, request)),
  )
  if (published.length === 0) return
  throw new Error(
    `Amplify: the rewrite source '${source}' proxies ${published.join(', ')} from the APEX, ` +
      'and the apex is the one host in this product that must never hold a session. A 200 ' +
      'rewrite is invisible to the browser, so a session minted through it binds to ' +
      'reconcileai.app - and G180 compares the bound host on every request and REVOKES on a ' +
      'mismatch, so the person is signed in at the host they must never be signed in at and ' +
      'signed out everywhere else. /session/federated MINTS one; /session reads and destroys ' +
      'one; /context/resolve is D1 - it reads __Host-reconcile_session and DURABLY BINDS the ' +
      'session`s tenant, which is the same G180 revocation through a door the first draft of ' +
      'this guard did not name (G2009). /v1/* is refused for a second reason that is not ' +
      'about cookies: the apex is CMS-authored marketing content, and proxying the ' +
      'authenticated API onto it puts every capability operation same-origin with ' +
      'third-party markup. /health, /status and /metrics are refused for the reason ' +
      'EDGE_LOCAL_ONLY_PATHS gives one distribution over: there is no session on them, no ' +
      'capability gate and no invariant 10 record. What MAY be proxied is ' +
      'MARKETING_PROXIED_PLANE_PATHS, and resolveHomeRealm is on it because it mints nothing, ' +
      'sets no cookie, reads no cookie and is never given a person.',
  )
}

/**
 * The path the demo form POSTs to.
 *
 * ⚠️ **IT IS `/demo/intake` AND NOT `/demo`.** `/demo` is a PAGE the marketing
 * site serves — the pack's `V2 Book a demo` names it as a surface — and a
 * rewrite on it would proxy the page itself to a Lambda. The intake is a
 * sibling path under it, so the page and the endpoint are one origin and two
 * resources.
 */
export const DEMO_INTAKE_PATH = '/demo/intake'

/**
 * The one media type the intake accepts, and it is a CORS control.
 *
 * 🛑 **G2002, 22 Sep 2026 — THE SECOND COPY OF A FENCE, AND THE FIRST IS
 * `infra/lambda/demo-intake/guards.mjs`'s `REQUIRED_CONTENT_TYPE`**, which
 * carries the whole argument. In short: CORS gates READING A RESPONSE, not
 * sending a request, so a `POST` with a safelisted `Content-Type` is a CORS
 * *simple request* — sent cross-origin with no preflight, with only the reply
 * blocked — and a write-only endpoint does not need the reply. Requiring
 * `application/json`, which is NOT safelisted, forces a preflight that the
 * Function URL's absent CORS configuration then fails.
 *
 * ⚠️ THE SEAM BETWEEN THE TWO COPIES IS A ZIP FILE and neither can cover the
 * other; `tests/infra/demo-intake.test.mjs` joins them in both directions, as
 * it does for `DEMO_INTAKE_FIELDS`.
 */
export const DEMO_INTAKE_CONTENT_TYPE = 'application/json'

/**
 * The token the intake logs every dropped lead with, and the only thing the
 * metric filter below reads.
 *
 * 🛑 **G2006: `handler()` CATCHES, SO LAMBDA RECORDS A SUCCESSFUL INVOCATION
 * AND `AWS/Lambda Errors` READS 0 WHILE EVERY LEAD IS BEING DROPPED.** A
 * generic alarm on the function cannot see this failure at all, and G2001
 * makes it quieter still — the visitor is now told `received`. So the delivery
 * outcome mints a metric of its own, which is what G1976 named and did not
 * build.
 *
 * ⚠️ SECOND COPY. `CRM_DELIVERY_FAILED_TOKEN` in
 * `infra/lambda/demo-intake/guards.mjs` is the first, and the suite joins them
 * in both directions — a token edited on one side is a red gate rather than a
 * metric filter that silently matches nothing for ever.
 */
export const CRM_DELIVERY_FAILED_TOKEN = 'RECONCILE_CRM_DELIVERY_FAILED'

/** G261: the intake's own namespace, so a lead drop is not an ECS metric. */
export const DEMO_INTAKE_METRIC_NAMESPACE = 'Reconcile/DemoIntake'

/** The metric `CRM_DELIVERY_FAILED_TOKEN` mints, one datapoint per drop. */
export const DEMO_INTAKE_DELIVERY_FAILED_METRIC = 'CrmDeliveryFailed'

export const demoIntakeFunctionName = (environment: Environment): string =>
  `reconcile-${environment}-demo-intake`

export const demoIntakeRoleName = (environment: Environment): string =>
  `reconcile-${environment}-demo-intake`

export const demoIntakeLogGroupName = (environment: Environment): string =>
  `/aws/lambda/${demoIntakeFunctionName(environment)}`

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE INTAKE QUEUE AND ITS WORKER — G3681, 3 Oct 2026, THE OWNER'S RULING,
 *    VERBATIM, CLOSING G2007: *"Queue it: the intake enqueues and returns
 *    immediately; a worker delivers to the CRM. Constant-time answer."*
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G2001 made the intake's STATUS independent of the CRM and left its LATENCY
 * dependent on it, because `deliver()` awaited the CRM on the request path —
 * a CRM that 404s an unknown referral code faster than it writes a lead row
 * was a timing oracle at a public URL. **The request path now never reaches
 * the CRM at all**: the intake validates, sends one SQS message and answers;
 * `worker.mjs`, on an SQS event source, is the only code that holds the CRM
 * credential. The answer's time depends on SQS's `SendMessage`, which is
 * blind to the lead.
 *
 * ⚠️ STANDARD, NOT FIFO: a marketing lead has no order, and FIFO's
 * deduplication window would silently swallow a visitor's honest second
 * submission. ⚠️ SSE-SQS, NOT A KMS KEY: the only key in this account worth
 * naming is per TENANT, and a person who filled in a demo form is not a tenant
 * yet. ⚠️ THE QUEUE AND ITS DEAD-LETTER QUEUE HOLD LEADS — named people at
 * named employers — for up to their retention, which is the one new place a
 * lead rests in this account; nothing logs one and nothing else reads them.
 */
export const demoIntakeQueueName = (environment: Environment): string =>
  `reconcile-${environment}-demo-intake`

export const demoIntakeDeadLetterQueueName = (environment: Environment): string =>
  `reconcile-${environment}-demo-intake-dlq`

export const demoIntakeWorkerFunctionName = (environment: Environment): string =>
  `reconcile-${environment}-demo-intake-worker`

export const demoIntakeWorkerRoleName = (environment: Environment): string =>
  `reconcile-${environment}-demo-intake-worker`

export const demoIntakeWorkerLogGroupName = (environment: Environment): string =>
  `/aws/lambda/${demoIntakeWorkerFunctionName(environment)}`

/**
 * How many receives a lead gets before it is dead-lettered.
 *
 * ⚠️ EVERY FAILED ATTEMPT LOGS `CRM_DELIVERY_FAILED_TOKEN`, so the metric now
 * counts failed delivery ATTEMPTS (at most this many per lead) rather than
 * dropped leads. The alarm's threshold is `> 0`, so it fires on the FIRST
 * failure either way — which is the loud day-one behaviour G1971 wants.
 */
export const DEMO_INTAKE_QUEUE_MAX_RECEIVE_COUNT = 5

/** The worker's own timeout. One lead per invocation, one CRM call of at most 5s. */
export const DEMO_INTAKE_WORKER_TIMEOUT_SECONDS = 15

/** AWS's guidance for an SQS event source: at least SIX times the function timeout. */
export const DEMO_INTAKE_QUEUE_VISIBILITY_SECONDS = 6 * DEMO_INTAKE_WORKER_TIMEOUT_SECONDS

/**
 * ⚠️ A LEAD THE WORKER NEVER RECEIVES EXPIRES SILENTLY AT THIS AGE — SQS
 * deletes an expired message without dead-lettering it.
 *
 * ✅ **FOURTEEN — SQS's MAXIMUM — SINCE 4 Oct 2026, G3762, CLOSING G3686 (1).
 * THE PARAGRAPH THAT STOOD HERE IS QUOTED RATHER THAN DELETED**, because it
 * named the exposure this constant now narrows: *"Four days is SQS's default
 * and is far longer than any backlog a human-rate form produces; a flood that
 * outruns the worker for four days loses leads, junk and real alike."*
 * Raising retention alone would only make the silence longer, so it is PAIRED
 * with `DEMO_INTAKE_QUEUE_OLDEST_MESSAGE_ALARM_SECONDS` below: the alarm says a
 * lead is not being received, and the retention is how long a person then has
 * to act — fourteen days instead of four.
 *
 * ⚠️ **THE COST IS PERSONAL DATA AT REST**: an undelivered lead now rests in
 * this queue up to ten days longer. A DELIVERED lead is deleted on receipt, so
 * the cost lands only on the leads the old figure would have destroyed.
 * ⚠️ **AND IT DOES NOT LENGTHEN A DEAD-LETTERED LEAD'S LIFE**: for a standard
 * queue SQS keeps a message's ORIGINAL enqueue timestamp when it moves to the
 * DLQ, so the DLQ's fourteen days count from the visitor's submission either
 * way.
 */
export const DEMO_INTAKE_QUEUE_RETENTION_DAYS = 14

/** SQS's maximum. Redriving the DLQ is a person step (`deploy-handoff.md` §27). */
export const DEMO_INTAKE_DEAD_LETTER_RETENTION_DAYS = 14

/**
 * The demo intake's DEAD-LETTER depth that alarms — G3761, 4 Oct 2026, closing
 * G3686 (2). Compared with `>`, so ONE lead in the DLQ is in alarm.
 *
 * 🛑 ZERO, AND FOR `RUN_QUEUE_DEAD_LETTER_MESSAGE_THRESHOLD`'s REASON: the
 * tolerance has already been spent upstream — a lead only arrives here after
 * `DEMO_INTAKE_QUEUE_MAX_RECEIVE_COUNT` failed deliveries — so one lead in the
 * DLQ is one person who filled in a form and reached nobody. A literal, not an
 * expression: the argument is this prose, and a number dressed as a derivation
 * would suggest the retry count moves it. It does not.
 *
 * ⚠️ **WHY A SECOND ALARM WHEN `CrmDeliveryFailed` ALREADY FIRES ON EVERY
 * FAILED ATTEMPT**: that alarm reads a five-minute `Sum` of attempts, so it
 * returns to OK five minutes after the LAST failure — while the lead it failed
 * sits in the DLQ for up to fourteen days and expires there unannounced. This
 * one reads the DLQ's DEPTH, so it stays in ALARM for exactly as long as a lead
 * is waiting to be redriven (`deploy-handoff.md` §27), and clears when the
 * redrive empties it. **The first says "something broke"; this one says
 * "somebody is still owed a reply".**
 */
export const DEMO_INTAKE_DEAD_LETTER_MESSAGE_THRESHOLD = 0

/**
 * How old the SOURCE queue's oldest message may get before it alarms —
 * G3762, 4 Oct 2026, closing G3686 (1). Compared with `>`.
 *
 * 🛑 DERIVED, NOT CHOSEN, AND IT IS NOT AN SLO (G1063). The worker is an SQS
 * event source — Lambda long-polls continuously — so a healthy lead is received
 * within seconds. A lead whose delivery FAILS is received at most
 * `DEMO_INTAKE_QUEUE_MAX_RECEIVE_COUNT` (5) times, each time hidden for
 * `DEMO_INTAKE_QUEUE_VISIBILITY_SECONDS` (90), and then it LEAVES this queue
 * for the DLQ, where the depth alarm above takes over. **So every lead the
 * worker is actually handling has left this queue by 5 × 90 = 450 seconds**;
 * a message older than that is not being retried, it is not being RECEIVED —
 * a backlog that outruns `DEMO_INTAKE_WORKER_CONCURRENCY`, or a consumer that
 * is off (a disabled event-source mapping, a throttled function). Both end in
 * the silent expiry `DEMO_INTAKE_QUEUE_RETENTION_DAYS` describes.
 *
 * ⚠️ WRITTEN AS AN EXPRESSION OVER THE TWO CONSTANTS, DELIBERATELY — the
 * opposite of the threshold above, because here the derivation IS the
 * argument and moving either input should move it.
 * `tests/infra/observability.test.mjs` §3b joins it to the AMPLIFY template's
 * own synthesised queue, so the join is checked against what ships.
 *
 * ⚠️ A FLOOD IS THE CASE IT CATCHES AND THE CASE IT DOES NOT STOP: at
 * concurrency two and a CRM call of at most five seconds the worker drains at
 * least ~24 leads a minute, so a 450-second backlog is roughly 180 leads
 * queued ahead — a flood (G2015) or a stopped consumer — and the alarm
 * leaves fourteen days of retention behind it to decide which.
 */
export const DEMO_INTAKE_QUEUE_OLDEST_MESSAGE_ALARM_SECONDS =
  DEMO_INTAKE_QUEUE_MAX_RECEIVE_COUNT * DEMO_INTAKE_QUEUE_VISIBILITY_SECONDS

/**
 * 🛑 THE CRM WRITE RATE IS NOW BOUNDED BY THIS AND NOT BY THE INTAKE'S
 * CONCURRENCY — G2015's axis ①. Two is the SQS event source's minimum
 * `maxConcurrency`, and reserved concurrency at the same figure keeps the
 * worker from taking account concurrency it cannot use.
 */
export const DEMO_INTAKE_WORKER_CONCURRENCY = 2

/**
 * 🛑 THE CRM ENDPOINT AND ITS CREDENTIAL LIVE IN ONE SECRET AND NEITHER IS IN
 * THIS REPOSITORY.
 *
 * The secret's value is a JSON object with THREE keys — `endpoint`,
 * `authHeaderName` and `authHeaderValue`. ⚠️ **THIS SAID *"two keys,
 * `endpoint` and `apiKey`"* UNTIL 22 Sep 2026 AND NO SUCH KEY IS READ BY
 * ANYTHING.** `readCrmConfig()` reads the three above and `amplify-stack.ts`
 * generates a template carrying exactly them, so a person following this
 * sentence would have written a `put-secret-value` the function refuses —
 * during precisely the day-one window G1976 says is the likely failure, and
 * with `crm_not_configured` as the only symptom. Corrected rather than
 * deleted, because it is the sentence a deploying operator would have copied.
 * **The stack creates the secret and does NOT create its value** — the
 * generated placeholder leaves `endpoint` empty, so the function refuses with
 * `crm_not_configured` until a person runs one `put-secret-value`. That is
 * `Observability`'s `AlarmsPageNobodyUntil` shape (G1062): a half-built control
 * that announces itself rather than reading as finished.
 *
 * ⚠️ THE ENDPOINT IS IN THE SECRET AND NOT IN THIS FILE, AND THE REASON IS NOT
 * secrecy — a hostname is not a credential. It is that **nothing in this
 * repository has ever named a CRM**, and a constant here would be this slice
 * choosing one. The pack says only *"Leads go to the CRM; the console never
 * sees one"*, which names a destination CLASS and not a destination.
 */
export const crmLeadIntakeSecretName = (environment: Environment): string =>
  `reconcile-${environment}-crm-lead-intake`

/**
 * ┌─ 🛑 THE SECRET'S SHAPE IS `{endpoint, token}` SINCE G3732, 4 Oct 2026 ────┐
 * │                                                                           │
 * │ THE OWNER'S RULING, VERBATIM: *"You add a service token: someone on the  │
 * │ CRM side issues a long-lived service/API token for this integration and  │
 * │ puts it in the reconcile-staging-crm-lead-intake secret; build the       │
 * │ worker mapping now."* The worker sends it as `Authorization: Bearer`,    │
 * │ the one scheme PipelinePulse's own contract declares.                    │
 * │                                                                           │
 * │ ⚠️ THE THREE-KEY PARAGRAPH ABOVE (`endpoint`, `authHeaderName`,          │
 * │ `authHeaderValue`) IS KEPT AS THE HISTORY IT IS AND IS NO LONGER READ —  │
 * │ the same correction-by-addition G2011 made to the "two keys" sentence    │
 * │ before it. Its *"nothing in this repository has ever named a CRM"* went  │
 * │ false by ruling the same day: the CRM is PipelinePulse.                  │
 * │                                                                           │
 * │ ⚠️ AND THE SECRET RESOURCE ITSELF IS NOT CHANGED. Its generated          │
 * │ placeholder still carries the old three keys with `endpoint` EMPTY; a    │
 * │ person REPLACES the whole value with `put-secret-value`, so the          │
 * │ placeholder's key names do not matter — and editing                      │
 * │ `GenerateSecretString` on a deployed secret REGENERATES its value, which │
 * │ would wipe a token a person had already put there if this deploy landed │
 * │ second. Unchanged means the two steps commute (G3736).                   │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE LEAD DEFAULTS — THE OWNER'S RULING OF 4 Oct 2026, VERBATIM ─────────┐
 * │ *"Use these: motion ReconcileAI, unit Marketing Lead, SEA region, status │
 * │ MQL, source 'reconcileai.app demo'; the rest of the form goes into SDR   │
 * │ notes."*                                                                 │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE IDS ARE PipelinePulse's OWN, READ FROM ITS REFERENCE DATA ON
 * 4 Oct 2026 AND COPIED HERE RATHER THAN INTO THE WORKER, BY INSTRUCTION
 * (G3733): a CRM-side change is an edit to this object and a deploy of
 * `reconcile-amplify-staging`, never a code change. They are not secrets —
 * a UUID naming a sales motion grants nothing — so they ride in the
 * worker's environment, where `infra/lambda/demo-intake/lead.mjs` reads
 * them and REFUSES rather than defaults when one is missing.
 *
 *   · `gtmMotionId`      — ReconcileAI
 *   · `businessUnitId`   — Marketing Lead (MKT)
 *   · `businessRegionId` — SEA (Singapore / Malaysia / Indonesia / Philippines)
 *
 * ⚠️ IF THESE GO STALE THE CRM ANSWERS 422 AND EVERY LEAD DEAD-LETTERS with
 * reason `crm_rejected` (G3734) — the DLQ keeps them 14 days; fix this
 * object, deploy, redrive (`docs/build/deploy-handoff.md` §27).
 */
export const DEMO_INTAKE_CRM_LEAD_DEFAULTS = {
  gtmMotionId: '69b719bd-b86a-41f0-a3a4-5256cef59ca8',
  businessUnitId: 'c39a4e1c-5127-484c-b8a9-bff0becaa8ff',
  businessRegionId: 'a02f4c75-dd7b-4789-8f9d-3d500a1a83e8',
  leadStatus: 'MQL',
  source: 'reconcileai.app demo',
} as const

export type DemoIntakeCrmLeadDefault = keyof typeof DEMO_INTAKE_CRM_LEAD_DEFAULTS

/**
 * The worker environment variable each default travels in.
 *
 * ⚠️ A TOTAL `Record` OVER THE DEFAULTS, so a sixth default with no variable
 * is `TS2741` here. SECOND COPY: `LEAD_DEFAULT_ENV` in
 * `infra/lambda/demo-intake/lead.mjs`, joined in both directions by
 * `tests/infra/demo-intake.test.mjs`.
 */
export const DEMO_INTAKE_CRM_LEAD_DEFAULT_ENV: Readonly<Record<DemoIntakeCrmLeadDefault, string>> = {
  gtmMotionId: 'RECONCILE_CRM_GTM_MOTION_ID',
  businessUnitId: 'RECONCILE_CRM_BUSINESS_UNIT_ID',
  businessRegionId: 'RECONCILE_CRM_BUSINESS_REGION_ID',
  leadStatus: 'RECONCILE_CRM_LEAD_STATUS',
  source: 'RECONCILE_CRM_LEAD_SOURCE',
}

/**
 * The largest intake body the function will read, in bytes.
 *
 * ⚠️ IT IS A FENCE AND NOT A TUNING KNOB. `/demo/intake` is an unauthenticated
 * public POST that writes into a CRM, and the apex has **no WAF** — see the
 * stack header, which refuses one for the reason `lib/edge-stack.ts` refuses a
 * response-headers policy: *"None is ruled."* So the only fences the intake has
 * are its own, and a size cap is the cheapest of them.
 */
export const DEMO_INTAKE_MAX_BODY_BYTES = 8 * 1024

/**
 * The closed set of fields an intake body may carry, and the longest each may
 * be.
 *
 * 🛑 IT IS AN ALLOW-LIST AND A TOTAL `Record`, WHICH IS `CLAUDE.md`'s OWN RULE:
 * *"Prefer a total `Record<K, V>` over a lookup function when the key set is
 * closed."* A field added to the tuple without a length is `TS2741` at
 * `DEMO_INTAKE_FIELD_MAX_LENGTH`.
 *
 * ⚠️ `referralCode` IS ON THE LIST AND IS **NEVER EVALUATED** — see the stack
 * header and `infra/lambda/demo-intake/guards.mjs`. It travels to the CRM as an
 * opaque string, and whether it matches a deal registration is decided in the
 * STAFF CONSOLE, which is where the pack puts it: *"Match a deal registration …
 * plane: control, surface: staff console"*.
 */
export const DEMO_INTAKE_FIELDS = [
  'name',
  'email',
  'company',
  'reconcilingToday',
  'volume',
  'ownAwsAccount',
  'referralCode',
] as const

export type DemoIntakeField = (typeof DEMO_INTAKE_FIELDS)[number]

export const DEMO_INTAKE_FIELD_MAX_LENGTH: Readonly<Record<DemoIntakeField, number>> = {
  name: 120,
  email: 254,
  company: 200,
  reconcilingToday: 2000,
  volume: 120,
  ownAwsAccount: 20,
  referralCode: 64,
}
// ------------------------------------------- the run worker (R-W, G1541)

/**
 * ┌─ 🛑 **R-W, 21 Sep 2026 — THE OWNER'S RULING, VERBATIM:** ──────────────────┐
 * │                                                                           │
 * │     *"The run-queue worker runs as a SCHEDULED ECS TASK."*                │
 * │                                                                           │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * `lib/run-queue-stack.ts`'s header named THREE shapes and left the choice to a
 * person — a long-running ECS service, a scheduled task, or a Lambda on an
 * event-source mapping. **This is the person, and this is the choice.**
 *
 * **Why the owner took it, in the owner's own terms, and it is the reason the
 * slice is cheap:**
 *
 *   · it needs **no `server/` change** — `server/data-plane/run-worker-main.ts`
 *     is ALREADY one-message-and-exit, and says in its own header that a loop
 *     would be *"a deployment decision … settled in a file nobody would think
 *     to look in"*. A scheduled task is the shape that file was written for;
 *   · it needs **no `Planes` deploy**, so G1012's expired-image hazard — both
 *     planes rolled back to an image ECR has EXPIRED, against a forward-only
 *     schema — **is not engaged at all**;
 *   · the precedent is already in the tree: **`Planes` holds two migrate task
 *     definitions that no service runs**, invoked by `ecs:RunTask`. A task
 *     definition with no service is a familiar object here, not a new one.
 *
 * ⚠️ **COST ACCEPTED AND NAMED BY THE RULING ITSELF: ONE POLL PERIOD OF
 * LATENCY.** A run admitted one second after a task exits waits for the next
 * tick. That is the trade a scheduled task IS, and it is written down so nobody
 * later reads the delay as a defect and "fixes" it into a long-running service
 * — which is a `Planes`-shaped decision wearing a performance argument.
 */
export const RUN_WORKER_POLL_MINUTES = 1

/**
 * The ECS cluster both planes run in — `lib/planes-stack.ts` creates it.
 *
 * 🛑 **THIS CONSTANT EXISTS BECAUSE THE STRING NOW HAS TWO READERS, AND §5.3
 * IS EXPLICIT ABOUT WHAT TWO COPIES OF ONE ORDER BECOME: *"the one that drifts
 * is always the copy."*** It was a bare literal inside `planes-stack.ts` while
 * that file was its only reader; `lib/run-queue-stack.ts` now names the same
 * cluster to schedule a task into it, **BY NAME**, because reading
 * `planes.cluster` by construct reference would mint an export on `Planes` and
 * an export on `Planes` is a `Planes` deploy (G1012).
 *
 * ⚠️ **THE VALUE DID NOT MOVE AND THAT IS ASSERTED RATHER THAN ASSUMED**: both
 * call sites read this, the synthesised `Planes` template is BYTE-IDENTICAL
 * before and after the extraction, and `tests/infra/run-queue.test.mjs` §8
 * pins that. A refactor that changes a deployed cluster's name is a cluster
 * REPLACEMENT, which is both planes down.
 *
 * ⚠️ AND IT CARRIES THE SAME UNENFORCED ORDER EVERY BY-NAME JOIN HERE CARRIES:
 * **`Planes` before `RunQueue`**, or `ecs:RunTask` targets a cluster that does
 * not exist. `Planes` is deployed, so it costs nothing today; CloudFormation
 * will not tell you, which is why it is written down.
 */
export const ecsClusterName = (environment: Environment): string => `reconcile-${environment}`

/**
 * The two roles the scheduled worker task holds — G1542.
 *
 * 🛑 **THE WORKER GETS ITS OWN TASK ROLE, AND THAT IS THE WHOLE SECURITY
 * CONTENT OF THIS SLICE.** The obvious shape — schedule the EXISTING data-plane
 * service task definition with a command override — is REFUSED, and it is
 * refused for a reason that is one sentence long: **that task definition's role
 * is `reconcile-<env>-data-service-task`, the role the LISTENER runs as, so
 * granting it `sqs:ReceiveMessage` lets a REQUEST PATH DRAIN THE QUEUE.**
 *
 * A request path that could receive could take an admitted run's message off
 * the queue and delete it, and the run would then sit `queued` for ever with
 * every gate, policy and invariant 10 record saying the act was perfectly
 * correct — which is `db/migrations/0150`'s own sentence (*"a caller who
 * chooses the operands chooses the answer"*) arriving at a different API.
 *
 * ⚠️ **IT IS NOT A HYPOTHETICAL SHORTCUT: IT IS THE CHEAPEST ONE.** An
 * `EcsTask` target takes a task definition, the data plane's already carries
 * the database host, the credentials and `RECONCILE_RUN_QUEUE_URL`, and a
 * `containerOverrides` command is four lines. **The expensive path is taken
 * deliberately**, and `tests/infra/run-queue.test.mjs` §4b asserts the serving
 * role holds NEITHER consuming verb so that the cheap one is a RED GATE rather
 * than a code review somebody is having a bad day during.
 *
 * ⚠️ THE SHAPE MIRRORS `planeRoleName()` above WITHOUT REUSING IT, deliberately:
 * that helper's `plane`/`kind` axes are `'data' | 'control'` × `'service' |
 * 'migrate'`, and the worker is neither kind. Widening that union would put a
 * third kind into a type four files pattern-match on, to spell two strings.
 */
export const runWorkerRoleName = (
  environment: Environment,
  principal: 'exec' | 'task',
): string => `reconcile-${environment}-run-worker-${principal}`

/**
 * The run worker's task-definition FAMILY and its EventBridge RULE, each spelled
 * ONCE — G2962.
 *
 * 🛑 **TWO READERS, AND THAT IS WHY THESE ARE HELPERS RATHER THAN LITERALS.**
 * `RunQueue` names the family and the rule; the pipeline's `RetagRunWorker`
 * action (G2961) settles on the revision CloudFormation owns for that FAMILY
 * and asserts the RULE's ECS target fires it. Two inline spellings of one name
 * in two stacks is a retag that settles on nothing the day one of them moves,
 * so both stacks read these. `RunQueue`'s template is BYTE-IDENTICAL before and
 * after the move — measured, not assumed.
 */
export const runWorkerTaskFamily = (environment: Environment): string =>
  `reconcile-${environment}-run-worker`

/** The schedule that fires the worker — see `runWorkerTaskFamily()` above. */
export const runWorkerScheduleRuleName = (environment: Environment): string =>
  `reconcile-${environment}-run-worker`

/**
 * What the scheduled worker task is sized at.
 *
 * ⚠️ **THE SAME NUMBERS AS A SERVING TASK AND A SEPARATE CONSTANT ANYWAY**, so
 * that changing one does not silently change the other. The worker's work today
 * is one `SELECT` under one tenant's scope — `claimAdmittedRun()` — which needs
 * nothing like this; it is sized to the SERVING figure because the process it
 * runs is the same image and the same Node runtime, and because W1's executor
 * will land inside this task definition rather than beside it.
 *
 * 🛑 **AND THAT IS THE ONE FIGURE HERE THAT IS A GUESS ABOUT THE FUTURE RATHER
 * THAN A MEASUREMENT OF THE PRESENT.** Nothing has ever run a reconciliation in
 * this account, so no CPU or memory number here rests on an observation. Said
 * plainly so nobody cites it as a sizing.
 */
export const RUN_WORKER_TASK_CPU = 512
export const RUN_WORKER_TASK_MEMORY_MIB = 1024

/**
 * ✅ **G1545's OPEN INTERACTION IS CLOSED — G1834, 22 Sep 2026, THE OWNER'S
 * RULING — AND THE PARAGRAPHS BELOW ARE QUOTED RATHER THAN DELETED, BECAUSE
 * THIS IS THE SENTENCE THAT NAMED ITS OWN SUCCESSOR AND THE ONE A READER
 * WOULD HAVE QUOTED ONWARD.**
 *
 * They read: *"`RUN_QUEUE_VISIBILITY_SECONDS` is **30** … W1's EXECUTOR …
 * WILL ALMOST CERTAINLY EXCEED IT … NAMED HERE RATHER THAN FIXED, BECAUSE
 * FIXING IT BLIND WOULD BE WORSE."* **The executor landed (E5), it did
 * exceed it, and the measured failure is exactly the one predicted**: a run
 * taking longer than the visibility window makes the message visible again
 * mid-execution, a second worker starts a second execution of the same run
 * concurrently with no idempotency key preventing it, and after
 * `RUN_QUEUE_MAX_RECEIVE_COUNT` deliveries a run that SUCCEEDED every time
 * lands on the dead-letter queue — the alarm that finally fires reporting
 * the opposite of what happened.
 *
 * `RUN_QUEUE_VISIBILITY_SECONDS` is now **1800** — see that constant's own
 * header for the full argument, including the honest statement that no real
 * document set has ever been timed in this account, so this raises the
 * ceiling on a MEASURED failure mode without claiming to have measured the
 * number that would eliminate it. **"Fixing it blind would be worse" is
 * still true and is why this is 1800 and not a number closer to zero risk
 * of ever redelivering** — the owner chose to name the guess rather than
 * pretend a bound derived from nothing was a measurement.
 *
 * ⚠️ **WHAT WAS NOT TAKEN, BY NAME, EXACTLY AS BEFORE:** a heartbeat via
 * `sqs:ChangeMessageVisibility` (still a THIRD consuming verb this grant
 * deliberately withholds) and an execution lease in the database (a
 * separate ruling nobody has taken). **What DID move is the number itself**,
 * which is the repair this paragraph's own text said would have to be
 * "somebody else's" decision — that decision is now made.
 */
export const RUN_WORKER_HOLDS_A_MESSAGE_FOR = RUN_QUEUE_VISIBILITY_SECONDS

/**
 * The longest a single run may EXECUTE, in seconds — G4401, 5 Oct 2026.
 *
 * 🛑 **THE OWNER'S RULING: *"every admitted run reaches a terminal status or
 * an alarm"*, part of the G211 amendment.** This constant is shared BY NAME
 * with the executor's runtime ceiling, which another slice adds under
 * `server/`; this file does not edit `server/` and the two are joined by the
 * name `RUN_MAX_EXECUTION_SECONDS` alone. If the server's value moves, this
 * one must move with it, or the age alarm below pages on healthy runs (too
 * low) or arrives after the dead-letter queue (too high).
 *
 * ⚠️ **1500 SITS UNDER `RUN_QUEUE_VISIBILITY_SECONDS` (1800) DELIBERATELY**:
 * a run that finishes inside its ceiling finishes inside its visibility
 * window, so a healthy run is never redelivered mid-execution.
 *
 * 🛑 **THE ALARM IS AT TWICE THIS, AND THE DERIVATION IS THE ARGUMENT**: a
 * run executing for the whole ceiling, plus one `RUN_WORKER_POLL_MINUTES`
 * tick of queue wait, is ~1560 seconds old when deleted, under 3000 — and a
 * run stuck behind repeated redelivery reaches 3000 seconds long before
 * `RUN_QUEUE_MAX_RECEIVE_COUNT x RUN_QUEUE_VISIBILITY_SECONDS` (9000) moves
 * it to the dead-letter queue. So the age alarm is the EARLY signal and the
 * DLQ alarm the late one, and neither replaces the other.
 */
export const RUN_MAX_EXECUTION_SECONDS = 1500

/** The run queue's oldest-message-age alarm threshold — see above. */
export const RUN_QUEUE_OLDEST_MESSAGE_ALARM_SECONDS = 2 * RUN_MAX_EXECUTION_SECONDS

/**
 * ⚠️ integrate/6oct-m: `RUN_MAX_EXECUTION_SECONDS` above (#597) and the
 * server's `RUN_MAX_EXECUTION_SECONDS` (#598, `run-executor.ts`) are joined by
 * name and both read 1500 on the merged tree — G4443.
 *
 * How long ECS waits between SIGTERM and SIGKILL when it stops a worker task —
 * G4367, 5 Oct 2026, the owner's amendment of G211 (*"Duration is bounded below
 * the visibility timeout"*).
 *
 * ⚠️ ECS HAS NO TASK-LEVEL RUN TIMEOUT, AND THIS IS NOT ONE. A scheduled task
 * runs until its process exits. The bound on duration is the worker's OWN:
 * `RUN_MAX_EXECUTION_SECONDS` (`server/data-plane/run-executor.ts`), enforced by
 * `statement_timeout` and a terminable engine thread, with a hard in-process
 * watchdog behind it (`RUN_HARD_KILL_GRACE_SECONDS`). This constant only says
 * how long a task ECS itself decides to stop gets before it is killed, so that
 * a stop is never instantaneous and never unbounded. Fargate's ceiling is 120.
 *
 * `tests/infra/run-deadline.test.mjs` asserts the worker's whole budget —
 * deadline, `failed` write and watchdog grace — is below
 * `RUN_QUEUE_VISIBILITY_SECONDS`, against the server's constants.
 */
export const RUN_WORKER_STOP_TIMEOUT_SECONDS = 30

// ------------------------- source credential custody (G2401, the owner's)

/**
 * 🛑 THE OWNER'S RULING OF 1 Oct 2026 — G2401: *"Source credential custody:
 * Secrets Manager, one secret per source, encrypted with the tenant's
 * per-tenant KMS key (Storage's key factory); only a credentialRef lives in
 * Postgres; the FDE binds a credential via a write path under G75's secret
 * reach."*
 *
 * THE SECRET NAME IS OPAQUE, AND IT IS `tenantKeyAliasName()`'s ARGUMENT
 * ARRIVING AT A THIRD API. `secretsmanager:ListSecrets` is an account-wide
 * call that takes no resource, exactly as `kms:ListAliases` is, so a secret
 * named `…-ten_acme-sftp` would publish the customer list — and the shape of
 * every customer's integration — to every principal holding it. The name
 * therefore carries the environment, the plane and a RANDOM 32-hex handle
 * minted by the data plane at first bind, and NOTHING derived from a tenant,
 * an endpoint or a source. The handle-to-endpoint join lives in
 * `tenant.endpoint.credential_ref`, behind row-level security (`0270`).
 *
 * ⚠️ IT IS A PREFIX AND NOT A FUNCTION OF A TENANT FOR THE SAME REASON THE
 * KEY ALIAS PREFIX IS: one data plane serves every tenant in a hosted
 * deployment, so the IAM fence can only be a NAME PREFIX. Cross-tenant
 * isolation is therefore NOT an IAM property here and must not be described
 * as one — it is held by the server never taking a secret name from a request
 * (`server/data-plane/credential-binding.ts`) and by RLS on the row that
 * carries the handle. `tests/infra/credential-custody.test.mjs` states it.
 */
export const sourceCredentialSecretPrefix = (environment: Environment): string =>
  `reconcile-${environment}-data-cred-`

/** One credential's secret name. Carries the opaque handle and nothing else. */
export const sourceCredentialSecretName = (environment: Environment, handle: string): string =>
  `${sourceCredentialSecretPrefix(environment)}${handle}`

/** A credential handle: 32 random hex characters, minted, never derived. */
export const SOURCE_CREDENTIAL_HANDLE_PATTERN = /^[0-9a-f]{32}$/

/**
 * 🛑 THE VERBS THE DATA PLANE MAY NEVER HOLD OVER A SOURCE CREDENTIAL — G2403.
 *
 * The ruling says the FDE BINDS a credential. Binding is a WRITE, and the
 * serving process is the only principal that performs it, so it holds the two
 * write verbs and nothing else. Every verb below would turn the serving
 * process — the one principal whose `process.env` a request-path disclosure
 * reaches — into a reader of every customer's credentials, or a destroyer of
 * them:
 *
 *   `GetSecretValue` / `BatchGetSecretValue`  read-back. **The reader of a
 *        credential is the CONNECTOR that pulls a source, and it is not
 *        built.** Granting read to the serving role ahead of that reader is
 *        `0004`'s *"a privilege ahead of its writer"* in the read direction,
 *        and it would put every source credential one SSRF away.
 *   `ListSecrets`         the account-wide enumeration the opaque name exists
 *        to make useless; granting it would be conceding the point.
 *   `DeleteSecret`        a source that has delivered cannot be removed (the
 *        pack's own *"Neither is a delete"*), and erasure is G287's key
 *        destruction, a deliberate human operation.
 *   `PutResourcePolicy`   a principal that can write a secret's resource
 *        policy can grant ITSELF read — `kms:PutKeyPolicy`'s argument, one
 *        service over.
 *   `UpdateSecret`        can CHANGE THE KMS KEY a secret is encrypted under,
 *        which is the one property this ruling exists to fix.
 *   `TagResource`         G260: a tag is readable account-wide; the serving
 *        process must not be able to write `TenantId` onto anything.
 *   `RotateSecret`, `RestoreSecret`, `ReplicateSecretToRegions` — rotation
 *        needs a Lambda nobody has written, and replication moves a credential
 *        out of the tenant's residency region (invariant 7's neighbour).
 *
 * `assertCredentialWriterHoldsNoReadVerb()` in `lib/storage-stack.ts` fails
 * SYNTH, not review, on any of these — including through a wildcard.
 */
export const SOURCE_CREDENTIAL_WRITER_FORBIDDEN_ACTIONS: readonly string[] = [
  'secretsmanager:GetSecretValue',
  'secretsmanager:BatchGetSecretValue',
  'secretsmanager:ListSecrets',
  'secretsmanager:DeleteSecret',
  'secretsmanager:PutResourcePolicy',
  'secretsmanager:DeleteResourcePolicy',
  'secretsmanager:UpdateSecret',
  'secretsmanager:TagResource',
  'secretsmanager:RotateSecret',
  'secretsmanager:RestoreSecret',
  'secretsmanager:ReplicateSecretToRegions',
  'secretsmanager:RemoveRegionsFromReplication',
  'secretsmanager:CancelRotateSecret',
]

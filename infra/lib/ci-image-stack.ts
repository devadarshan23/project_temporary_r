/**
 * `CiImage` — G258. ONE custom `linux/arm64` CodeBuild image, in ECR, built
 * from `infra/ci-image/Dockerfile`, carrying Node 22, PostgreSQL 17 and
 * chromium.
 *
 * 🛑 WHY THIS IS ITS OWN STACK AND DEPLOYS BEFORE THE PIPELINE. G258's
 * acceptance condition is that the image is WITNESSED RED before anything
 * depends on it: `tests/ci/reachability-guards.test.ts` observed failing inside
 * it with chromium removed and passing with it present. A single stack holding
 * both the image and the pipeline would make the first `cdk deploy` the moment
 * the pipeline starts depending on an unwitnessed machine, which is the
 * ordering the ruling exists to forbid. Two stacks, deployed in order, with the
 * witness in between.
 *
 * ⚠️ `infra/ci-image/Dockerfile` IS NOT WRITTEN BY THIS FILE AND IS NOT WRITTEN
 * BY THIS SLICE. It is referenced by path only. If it is absent, the CodeBuild
 * project fails at `docker build` with a loud error, which is the correct
 * failure — a stack that silently built something else would be worse.
 *
 * ⚠️ THE ONE PIECE THAT CANNOT BE CREATED BY CDK. A CodeConnections connection
 * to GitHub requires a console handshake — a human authorising the AWS
 * connector against the `1CloudHub` organisation — so its ARN arrives as a
 * CloudFormation PARAMETER. CDK can consume one; it cannot mint one, and
 * pretending otherwise would produce a stack that deploys and never sources.
 */

import { CfnOutput, CfnParameter, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import type { Construct } from 'constructs'

import { CI_IMAGE_BUILDSPEC_YAML, attachBuildSpecYaml } from './buildspecs.ts'
import {
  CI_IMAGE_REPOSITORY_NAME,
  CI_IMAGE_TAG,
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_TRUNK_BRANCH,
} from './config.ts'
import { applyRequiredTags } from './tagging.ts'
import { codeConnectionsAuthOverride, connectionUsePolicy } from './connections.ts'

export class CiImageStack extends Stack {
  readonly repository: ecr.Repository
  readonly project: codebuild.Project

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props)

    const connectionArn = new CfnParameter(this, 'CodeConnectionArn', {
      type: 'String',
      description:
        'ARN of the CodeConnections connection to github.com/' +
        `${GITHUB_OWNER}/${GITHUB_REPO}. A connection CANNOT be created by CDK: ` +
        'it needs a console handshake to reach PENDING -> AVAILABLE. Create it ' +
        'once, by hand, and pass its ARN here.',
      // No default. A wrong-but-plausible default is a stack that deploys and
      // silently sources nothing; an absent one is a deploy that stops and asks.
      minLength: 1,
    })

    /**
     * G262 — scan on push, and the tag is IMMUTABLE so it names bytes.
     *
     * ⚠️ THIS IS ECR'S *BASIC* SCANNING AND THE DIFFERENCE IS STATED RATHER
     * THAN SMUGGLED. G262 names *enhanced* scanning (Amazon Inspector), which
     * is a REGISTRY-level setting for the whole account — not a property of a
     * repository, and not this product's to switch on unilaterally in a SHARED
     * account (G256). `scanOnPush` here is the repository half; the registry
     * half is an owner action, and `docs/tech-stack.md` §13.1 is the row that
     * still wants it.
     */
    this.repository = new ecr.Repository(this, 'Repository', {
      repositoryName: CI_IMAGE_REPOSITORY_NAME,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      encryption: ecr.RepositoryEncryption.AES_256,
      removalPolicy: RemovalPolicy.RETAIN,
      emptyOnDelete: false,
      lifecycleRules: [
        {
          description: 'Keep the ten most recent CI images; the rest are history.',
          maxImageCount: 10,
        },
      ],
    })

    /**
     * 🛑 THE ONE CODEBUILD PROJECT IN THIS APP THAT DOES NOT RUN ON THE CI
     * IMAGE, AND IT CANNOT: IT IS THE PROJECT THAT BUILDS IT. It runs on the
     * AWS-managed `ARM_CONTAINER` standard image — which is exactly the
     * "standard image plus per-build installs" shape G258 rejected for the
     * GATE, and is correct here because this project installs nothing: it runs
     * `docker build`. G252 still binds: `ARM_CONTAINER`, `linux/arm64`.
     */
    this.project = new codebuild.Project(this, 'Build', {
      projectName: 'reconcile-ci-image',
      description:
        `Builds the ${CI_IMAGE_TAG} linux/arm64 CI image (G258). Started by hand; ` +
        'its output is witnessed against tests/ci/reachability-guards.test.ts ' +
        'before any pipeline is pointed at it.',
      source: codebuild.Source.gitHub({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        branchOrRef: GITHUB_TRUNK_BRANCH,
        // No webhook. G258 says this image is built deliberately and witnessed,
        // not rebuilt on every push to trunk.
        webhook: false,
      }),
      environment: {
        buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
        computeType: codebuild.ComputeType.LARGE,
        // `docker build` needs the daemon. This is the only reason for it.
        privileged: true,
      },
      /**
       * 🛑 THE NAMES HERE ARE THE BUILDSPEC'S, NOT THIS FILE'S, AND THEY WERE
       * NOT THE SAME NAMES UNTIL THE FIRST REAL BUILD FAILED.
       *
       * Two slices wrote the two halves of this interface on the same day and
       * neither knew the other's spelling. This stack set `ECR_REGISTRY` and
       * `CI_IMAGE_REPOSITORY_NAME`; `infra/ci-image/buildspec-ci-image.yml`
       * asserts `AWS_ACCOUNT_ID`, `AWS_DEFAULT_REGION`, `IMAGE_REPO_NAME` and
       * `IMAGE_TAG` in its `pre_build`. The build failed at PRE_BUILD on
       * `test -n "$AWS_ACCOUNT_ID"` — which is those guards WORKING, and the
       * reason they were written as assertions rather than assumed.
       *
       * THE BUILDSPEC IS THE AUTHORITY, for the same reason it is on the gate:
       * it is the file a person opens in the CodeBuild console, and the names
       * it asserts are the names that must exist. `AWS_DEFAULT_REGION` is
       * supplied by CodeBuild itself and is deliberately not set here.
       *
       * ⚠️ `IMAGE_TAG` IS THE HUMAN TAG AND IS NOT WHAT ANYTHING SHOULD RUN.
       * The buildspec pushes it AND `CODEBUILD_RESOLVED_SOURCE_VERSION`, and
       * G262 wants the running image pinned by digest. The repository is
       * `IMMUTABLE`, so this tag cannot be moved once used — bumping it is a
       * reviewed change to `CI_IMAGE_TAG` in `config.ts`.
       */
      environmentVariables: {
        AWS_ACCOUNT_ID: { value: this.account },
        IMAGE_REPO_NAME: { value: CI_IMAGE_REPOSITORY_NAME },
        IMAGE_TAG: { value: CI_IMAGE_TAG },
      },
      timeout: Duration.minutes(60),
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, 'BuildLogs', {
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.DESTROY,
          }),
        },
      },
    })

    attachBuildSpecYaml(this.project, CI_IMAGE_BUILDSPEC_YAML)
    codeConnectionsAuthOverride(this.project, connectionArn.valueAsString)

    /**
     * G263 — least privilege, and the fence is the RESOURCE list rather than a
     * comment. This role may push to ONE repository: the CI image's. It has no
     * reach into the planes' repository, no `ecs:*`, no `cloudformation:*`, and
     * no static key anywhere in its life.
     */
    this.repository.grantPullPush(this.project)

    /**
     * 🛑 A RESOURCE POLICY, NOT A ROLE POLICY, AND THE DIFFERENCE IS WHY THE
     * FIRST BUILD THAT USED THIS IMAGE COULD NOT START.
     *
     * `grantPullPush()` above puts pull rights on the project's ROLE, which is
     * what the build needs once it is running. **Pulling the image the build
     * RUNS IN happens before any role exists** — CodeBuild's own service
     * principal fetches it during PROVISIONING, and it is refused by an ECR
     * repository with no resource-based policy:
     *
     *     CannotPullImageManifestError: … User: CodeBuild is not authorized to
     *     perform: ecr:BatchGetImage … because no RESOURCE-BASED POLICY allows
     *     the ecr:BatchGetImage action
     *
     * The message names the fix precisely and is easy to misread as an IAM
     * problem on the role, which is the one thing that was already correct.
     *
     * ⚠️ SCOPED TO THIS ACCOUNT ON PURPOSE. `codebuild.amazonaws.com` is a
     * service principal shared by every account, so the `SourceAccount`
     * condition is what stops this being a pull grant to CodeBuild ANYWHERE.
     * G256 puts this product in one account; a BYOA fleet pulling an image
     * would be a different grant, argued separately.
     */
    this.repository.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCodeBuildToPullTheGateImage',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('codebuild.amazonaws.com')],
        actions: [
          'ecr:BatchGetImage',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchCheckLayerAvailability',
        ],
        conditions: { StringEquals: { 'aws:SourceAccount': this.account } },
      }),
    )

    /* `ecr:GetAuthorizationToken` is account-wide by AWS's own design — the
     * action takes no resource — so it is the one wildcard here and it is named
     * rather than left for a reviewer to notice. It grants a login token, not
     * access to any repository; the repository grants above are what decide
     * what that token can reach. */
    this.project.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      }),
    )

    this.project.addToRolePolicy(connectionUsePolicy(connectionArn.valueAsString))

    applyRequiredTags(this, 'shared', 'ci')

    new CfnOutput(this, 'CiImageRepositoryUri', {
      value: this.repository.repositoryUri,
      description: 'The CI image repository. The pipeline reads its tag from infra/lib/config.ts.',
    })

    new CfnOutput(this, 'CiImageWitnessReminder', {
      value:
        'G258: run tests/ci/reachability-guards.test.ts INSIDE this image, ' +
        'once with chromium removed (expect RED) and once with it present ' +
        '(expect GREEN), before deploying the pipeline stack.',
      description: 'The acceptance condition G258 attaches to this image.',
    })
  }
}

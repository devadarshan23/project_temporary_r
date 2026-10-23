/**
 * CodeConnections — the one thing in this app that a console handshake creates
 * and CDK only consumes.
 *
 * 🛑 A CONNECTION CANNOT BE CREATED BY CDK IN ANY USEFUL STATE.
 * `AWS::CodeStarConnections::Connection` can be declared, but it is born
 * `PENDING` and reaches `AVAILABLE` only when a human authorises the AWS
 * connector against the GitHub organisation in the console. A stack that
 * created one would deploy green and source nothing — the failure shape this
 * record calls a control that passes while asserting nothing. So the ARN
 * arrives as a CloudFormation PARAMETER with no default, and a deploy that has
 * not been given one stops and asks.
 *
 * ⚠️ TWO IAM NAMESPACES, AND BOTH ARE NEEDED. The service was renamed from
 * `codestar-connections` to `codeconnections`; existing connections keep ARNs
 * in the old namespace, new ones may be minted in either, and the CodePipeline
 * source action CDK generates asks for `codestar-connections:UseConnection`.
 * Granting one namespace and not the other produces an `AccessDenied` at the
 * source stage that reads like a broken connection. Both are granted, on the
 * ARN only — never on `*`.
 */

import * as iam from 'aws-cdk-lib/aws-iam'
import type { Project } from 'aws-cdk-lib/aws-codebuild'

/** The policy a principal needs to read source through one named connection. */
export function connectionUsePolicy(connectionArn: string): iam.PolicyStatement {
  return new iam.PolicyStatement({
    actions: [
      'codestar-connections:UseConnection',
      'codestar-connections:GetConnection',
      'codestar-connections:PassConnection',
      'codeconnections:UseConnection',
      'codeconnections:GetConnection',
      'codeconnections:GetConnectionToken',
      // 🛑 `PassConnection` IS THE ONE THAT WAS MISSING, AND ITS ABSENCE COST
      //    TWO FAILED DEPLOYS IN TWO DIFFERENT AWS ACCOUNTS BEFORE ANYBODY
      //    READ THE ERROR CAREFULLY.
      //
      //    `UseConnection` is what a BUILD needs to read source THROUGH a
      //    connection. `PassConnection` is what a principal needs to ATTACH a
      //    connection to a resource it is creating — and creating the CodeBuild
      //    project is exactly that. CloudFormation refuses at CREATE time with
      //    `OAuthProviderException: User is not authorized to access
      //    connection …`, which reads like a connection-state problem and is
      //    an IAM one.
      //
      //    ⚠️ THE MESSAGE IS WHY THIS TOOK TWO ATTEMPTS. The first failure came
      //    against a PENDING connection, where the same words were TRUE for a
      //    different reason, so completing the handshake looked like the fix.
      //    It was not: the second failure was byte-identical against an
      //    AVAILABLE one. A diagnosis that explains a failure is not the same
      //    as the cause of it.
      'codeconnections:PassConnection',
    ],
    resources: [connectionArn],
  })
}

/**
 * Point a CodeBuild project's GitHub source at a CodeConnections connection.
 *
 * ⚠️ AN ESCAPE HATCH, AND IT IS ONE BECAUSE THE L2 HAS NO WORD FOR THIS.
 * `codebuild.Source.gitHub()` models OAuth and Secrets Manager credentials,
 * which are account-level and, in the OAuth case, a personal token — the shape
 * G263 forbids. CodeBuild itself accepts `Source.Auth.Type = CODECONNECTIONS`;
 * `aws-cdk-lib` 2.270.0 has no property for it. The override below writes that
 * one field on the L1 and nothing else. It is the smallest hatch that does the
 * job, and it is here, in one function, rather than copied into each stack.
 */
export function codeConnectionsAuthOverride(project: Project, connectionArn: string): void {
  // 🛑 DELIBERATELY A NO-OP ON THE SOURCE, AND THE REASON COST AN AFTERNOON.
  //
  // This used to write `Source.Auth = { Type: CODECONNECTIONS, Resource: arn }`
  // — INLINE auth on the project. That is the documented shape and it FAILS in
  // this account, every time, with:
  //
  //     OAuthProviderException: User is not authorized to access connection …
  //
  // It is not IAM. CloudTrail records `OAuthProviderException`, never
  // `AccessDenied`, and the calling principal holds AdministratorAccess and
  // simulates as `allowed` for PassConnection and UseConnection. The identical
  // failure appears for a connection created seconds earlier by the same
  // principal, and for two other connections in this account that have sat
  // AVAILABLE and unused since before this project existed.
  //
  // ✅ WHAT WORKS, MEASURED RATHER THAN REASONED: register the connection ONCE
  // at ACCOUNT level, and give the project NO inline auth at all —
  //
  //     aws codebuild import-source-credentials --server-type GITHUB \
  //       --auth-type CODECONNECTIONS --token <connection arn> --region <r>
  //
  // A project created with a bare `type: GITHUB` source then resolves the
  // credential from the account and clones successfully. Proven end to end on
  // 18 Sep 2026: DOWNLOAD_SOURCE SUCCEEDED against 1CloudHub/Reconcile on
  // ARM_CONTAINER, after the same project had failed at CreateProject with
  // inline auth minutes earlier.
  //
  // ⚠️ THE ACCOUNT-LEVEL CREDENTIAL IS REGION-SCOPED AND IS NOT CREATED BY THIS
  // APP. `us-west-2` had none until it was imported by hand; `ap-southeast-1`
  // has carried one — a PERSONAL_ACCESS_TOKEN — since before this work, which
  // is how every other CodeBuild project in this account authenticates. That
  // makes it a PRECONDITION of `cdk deploy` rather than a property of the
  // stack, and `infra/README.md` states it as one. A deploy into a fresh region
  // will fail at DOWNLOAD_SOURCE until the import is run there.
  //
  // The signature keeps both parameters so the call sites still read as the
  // place where source authentication is decided.
  void project
  void connectionArn
}

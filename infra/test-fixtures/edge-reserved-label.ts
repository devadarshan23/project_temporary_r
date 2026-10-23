/**
 * THE RED WITNESS FOR THE RESERVED-LABEL GUARD — G179's list, arriving at the
 * one place in `infra/` where a host label can be typed.
 *
 * `infra/lib/config.ts` reserves eighteen labels and says what claims each one.
 * `assertNotAReservedLabel()` in `lib/edge-stack.ts` throws at synth on one, and
 * without this fixture that guard would be a paragraph: `extraHostLabels` is
 * empty in the real app, so a green `cdk synth` witnesses nothing about it —
 * `docs/HANDOFF.md` §5.6, a control that cannot be seen failing asserts nothing.
 *
 * The one difference from an ordinary `Edge` synth is the label. Synth must
 * FAIL, and `tests/infra/edge.test.mjs` §4 requires it to.
 *
 * ⚠️ IT BUILDS ITS OWN MINIMAL TREE RATHER THAN CALLING `buildApp()`, because
 * the real app passes no `extraHostLabels` and adding a hostile one to it would
 * make every other suite red. The stubs below are the narrow set of things the
 * constructor reads before it reaches the guard.
 */

import { App, Stack } from 'aws-cdk-lib'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'

import { AWS_ACCOUNT, AWS_REGION, CDK_ENV, STACK_EDGE_STAGING } from '../lib/config.ts'
import { EdgeStack } from '../lib/edge-stack.ts'

const app = new App()

const support = new Stack(app, 'edge-reserved-label-support', { env: CDK_ENV })
const vpc = new ec2.Vpc(support, 'Vpc', { maxAzs: 2, natGateways: 0 })

const stack = new EdgeStack(app, STACK_EDGE_STAGING, {
  env: CDK_ENV,
  environment: 'staging',
  /* ⚠️ TWO CERTIFICATES SINCE G297, AND THE STUBS CARRY TWO DIFFERENT ARNs
   * DELIBERATELY. One stub passed twice would type-check and would hide the
   * one mistake this slice most needs to stay visible — the console
   * certificate reaching the tenant distribution, which serves every tenant at
   * a flat host again with a valid handshake. */
  tenantCertificate: acm.Certificate.fromCertificateArn(
    support,
    'TenantCert',
    `arn:aws:acm:us-east-1:${AWS_ACCOUNT}:certificate/00000000-0000-0000-0000-000000000000`,
  ),
  consoleCertificate: acm.Certificate.fromCertificateArn(
    support,
    'ConsoleCert',
    `arn:aws:acm:us-east-1:${AWS_ACCOUNT}:certificate/11111111-1111-1111-1111-111111111111`,
  ),
  // D6-4, G1871. A bare string - `webAclId` takes an ARN, not a construct.
  rateLimitWebAclArn: `arn:aws:wafv2:us-east-1:${AWS_ACCOUNT}:global/webacl/reconcile-staging-plane-rate-limit/22222222-2222-2222-2222-222222222222`,
  dataLoadBalancer: elbv2.ApplicationLoadBalancer.fromApplicationLoadBalancerAttributes(
    support,
    'Alb',
    {
      loadBalancerArn: `arn:aws:elasticloadbalancing:${AWS_REGION}:${AWS_ACCOUNT}:loadbalancer/app/reconcile-staging-data/0000000000000000`,
      securityGroupId: 'sg-00000000000000000',
    },
  ),
  dataLoadBalancerSecurityGroup: ec2.SecurityGroup.fromSecurityGroupId(
    support,
    'AlbSg',
    'sg-00000000000000000',
  ),
  vpc: vpc as ec2.IVpc,
  // The one difference. A label the staff console already claims.
  extraHostLabels: ['console'],
})

app.synth()
process.stdout.write(`SYNTH OK ${stack.stackName}\n`)

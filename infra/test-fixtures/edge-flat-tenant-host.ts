/**
 * THE RED WITNESS FOR G297's REGION-LABEL GUARD — the one control in this
 * repository that refuses the grammar G293 shipped.
 *
 * `assertCarriesRegionLabel()` in `lib/edge-stack.ts` throws at synth on a
 * tenant host with no region label, and without this fixture that guard would
 * be a paragraph: the real app passes the per-region wildcard and nothing else,
 * so a green `cdk synth` witnesses nothing about the refusal —
 * `docs/HANDOFF.md` §5.6, a control that cannot be seen failing asserts
 * nothing. It is the same argument, and the same shape, as
 * `edge-reserved-label.ts` beside it.
 *
 * 🛑 THE HOST BELOW IS THE EXACT ONE THAT WAS SERVED IN STAGING ON
 * 19 Sep 2026, and that is the point: `ten-acme.reconcileai.app` answered a
 * real 401 from the data plane over TLS under G293's flat wildcard. G297 rules
 * that host must not be servable, because a certificate covering it is valid in
 * every region and an EU tenant misrouted to a US plane would FAIL OPEN.
 *
 * ⚠️ IT BUILDS ITS OWN MINIMAL TREE RATHER THAN CALLING `buildApp()`, for the
 * reason `edge-reserved-label.ts` gives: the real app passes no hostile host,
 * and adding one to it would make every other suite red.
 */

import { App, Stack } from 'aws-cdk-lib'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'

import { AWS_ACCOUNT, AWS_REGION, CDK_ENV, STACK_EDGE_STAGING } from '../lib/config.ts'
import { EdgeStack } from '../lib/edge-stack.ts'

const app = new App()

const support = new Stack(app, 'edge-flat-tenant-host-support', { env: CDK_ENV })
const vpc = new ec2.Vpc(support, 'Vpc', { maxAzs: 2, natGateways: 0 })

const stack = new EdgeStack(app, STACK_EDGE_STAGING, {
  env: CDK_ENV,
  environment: 'staging',
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
  // The one difference. The flat grammar G293 shipped and G297 corrected.
  extraTenantHosts: ['ten-acme.reconcileai.app'],
})

app.synth()
process.stdout.write(`SYNTH OK ${stack.stackName}\n`)

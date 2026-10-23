/**
 * THE RED WITNESS FOR G1011's CATCH-ALL REFUSAL — the control that keeps the
 * plane's own `/health`, `/status` and `/metrics` off the public internet.
 *
 * 🛑 **THE CATCH-ALL IS THE REPAIR SOMEBODY WILL REACH FOR, AND THAT IS WHY
 * THIS FILE EXISTS.** G1011's finding is that `POST /context/resolve` answered
 * **403 from CloudFront** because the distribution routed `/v1/*` alone. The
 * one-character fix for that is `/*`, it is obvious, it works, and it publishes
 * `data-plane-local.openapi.yaml`'s three operations — an operational surface
 * with no session on it, no capability gate and no invariant 10 record — to
 * everybody. `assertPublishesNoLocalOperation()` in `lib/config.ts` refuses it
 * at synth, and without this fixture that refusal would be a paragraph: the
 * real app passes three explicit prefixes and nothing else, so a green
 * `cdk synth` witnesses nothing about it (`docs/HANDOFF.md` §5.6).
 *
 * ⚠️ **THE PATTERN BELOW IS `/*` AND NOT `/health`**, deliberately. `/health`
 * would witness a rule keyed on a LITERAL and would pass a guard that only
 * compared strings; `/*` witnesses the rule keyed on the PROPERTY — *does this
 * pattern match a path that document declares* — which is the only form that
 * also refuses `/h*`, `/*ealth` and the spelling nobody predicted.
 *
 * ⚠️ IT BUILDS ITS OWN MINIMAL TREE RATHER THAN CALLING `buildApp()`, for the
 * reason `edge-reserved-label.ts` gives: the real app passes no hostile value,
 * and adding one to it would make every other suite red.
 */
import { App, Stack } from 'aws-cdk-lib'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'

import { AWS_ACCOUNT, AWS_REGION, CDK_ENV, STACK_EDGE_STAGING } from '../lib/config.ts'
import { EdgeStack } from '../lib/edge-stack.ts'

const app = new App()

const support = new Stack(app, 'edge-catch-all-support', { env: CDK_ENV })
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
  // The one difference. The catch-all that would publish the local tier.
  extraPlanePathPatterns: ['/*'],
})

app.synth()
process.stdout.write(`SYNTH OK ${stack.stackName}\n`)

/**
 * THE RED WITNESS FOR G1091 — the spelling the catch-all fixture's own
 * reasoning said would be covered, and was not.
 *
 * ┌─ 🛑 `edge-catch-all.ts` REFUSES `/*` AND SAYS WHY IN ITS OWN VOICE: ───────┐
 * │ *"`/health` would witness a rule keyed on a LITERAL and would pass a      │
 * │ guard that only compared strings; `/*` witnesses the rule keyed on the    │
 * │ PROPERTY … which is the only form that also refuses `/h*`, `/*ealth` and  │
 * │ the spelling nobody predicted."*                                          │
 * │                                                                           │
 * │ **The spelling nobody predicted was `health`.** CloudFront implies the    │
 * │ leading slash — *"CloudFront behavior is the same with or without the     │
 * │ leading /"*, Developer Guide, "Path pattern" — and the guard anchored the │
 * │ pattern as spelled, so `/h*` was REFUSED and `h*` was ACCEPTED AND        │
 * │ SERVED, for one CloudFront behaviour, one character apart.                │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ **THIS IS A SECOND FIXTURE AND NOT AN EDIT TO THE FIRST**, because the two
 * witness different things: `/*` is the repair somebody reaches for, `health`
 * is the one that gets through a guard comparing spellings. A guard can be
 * repaired for either without the other, and a single fixture would hide which.
 *
 * ⚠️ **`extraPlanePathPatterns` IS SERVED AS WELL AS VALIDATED**, which is what
 * makes this a synth-time witness rather than a unit test: without the guard,
 * this file produces a CloudFront behaviour publishing the plane process's own
 * `/health` — no session on it, no capability gate, no invariant 10 record.
 * `tests/infra/edge.test.mjs` §2 also drives the guard directly over a corpus
 * of twenty-six spellings; neither is sufficient, both are cheap.
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
  // The one difference, and it is one character short of a pattern the guard
  // has always refused: CloudFront implies the leading slash, so this IS `/health`.
  extraPlanePathPatterns: ['health'],
})

app.synth()
process.stdout.write(`SYNTH OK ${stack.stackName}\n`)

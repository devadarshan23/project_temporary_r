/**
 * THE RED WITNESS FOR INVARIANT 3 AT THE NETWORK LAYER.
 *
 * The REAL app, with ONE line added: an ingress rule admitting the
 * control-plane task group to the data-plane database group. That rule is the
 * thing `infra/lib/network-stack.ts` exists to prevent and the thing G253 names
 * — *"no rule admits control-plane tasks to the data cluster"* — and
 * `tests/infra/network.test.mjs` runs its OWN assertion over the templates this
 * prints, requiring it to fail.
 *
 * 🛑 IT IS THE REAL APP, NOT A MINIATURE. A fixture that assembled its own two
 * security groups would prove the assertion can read a template somebody wrote
 * for it. This one proves the assertion catches the mistake as it would
 * actually arrive — one plausible line, in the real tree, added by somebody who
 * needed the control plane to reach a database and reached for the group that
 * was to hand. `docs/HANDOFF.md` §5.6: a control that cannot be witnessed
 * failing is a control that asserts nothing.
 *
 * ⚠️ IT PRINTS TEMPLATES AND EXITS 0. Unlike the tagging fixtures, the failure
 * being witnessed is not a synth failure — the rule below is perfectly valid
 * CloudFormation, which is exactly the problem. The judgement is the test's.
 */

import * as ec2 from 'aws-cdk-lib/aws-ec2'

import { buildApp } from '../lib/app.ts'
import { STACK_NETWORK_STAGING } from '../lib/config.ts'
import { NetworkStack, POSTGRES_PORT } from '../lib/network-stack.ts'

const app = buildApp()
const network = app.node.findChild(STACK_NETWORK_STAGING) as NetworkStack

// The one difference from the real app.
network.dataPlaneDbSg.addIngressRule(
  network.controlPlaneSg,
  ec2.Port.tcp(POSTGRES_PORT),
  'THE RULE INVARIANT 3 FORBIDS. This fixture exists so that adding it is red.',
)

const assembly = app.synth()

const templates: Record<string, unknown> = {}
for (const artefact of assembly.stacks) {
  templates[artefact.stackName] = artefact.template
}

process.stdout.write(JSON.stringify(templates))

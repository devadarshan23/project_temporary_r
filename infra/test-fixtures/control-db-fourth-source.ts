/**
 * THE RED WITNESS FOR G1284 — A FOURTH SOURCE ON THE CONTROL DATABASE.
 *
 * The REAL app, with ONE line added: an ingress rule admitting the
 * control-plane ALB group to the control-plane database group.
 *
 * 🛑 IT IS SAME-PLANE, AND THAT IS THE ENTIRE POINT OF THIS FIXTURE RATHER THAN
 * AN INCIDENTAL DETAIL. `cross-plane-sg.ts` beside it witnesses the invariant-3
 * direction and is caught by `assertPlaneBoundaryHolds()`. This one is
 * `Plane=control` reaching `Plane=control` on 5432 over tcp, so **every
 * assertion that existed in `tests/infra/network.test.mjs` before G1284 passes
 * it** — the planes match, the port is right, the protocol is right, and the
 * target is not the tenant database. `tests/infra/network.test.mjs` asserts
 * exactly that in `test_the_fourth_source_fixture_passes_every_other_assertion_
 * in_this_file`, so the two assertions are witnessed as DIFFERENT controls and
 * not as one control written twice.
 *
 * ⚠️ WHY THIS IS THE PLAUSIBLE MISTAKE RATHER THAN A CONTRIVED ONE. G1161 has
 * just added the first cross-plane rule in the app to this exact group, and a
 * rule on a database group now reads as a normal thing to write. The next
 * person who needs something to reach the control database — an RDS Proxy, a
 * bastion, a Lambda behind the ALB — has a precedent on the group's own face
 * and a group conveniently to hand, which is the same shape
 * `cross-plane-sg.ts`'s header describes: *"added by somebody who needed the
 * control plane to reach a database and reached for the group that was to
 * hand."*
 *
 * 🛑 AND IT IS THE REAL APP, NOT A MINIATURE, for that file's reason exactly: a
 * fixture assembling its own two groups would prove the assertion can read a
 * template somebody wrote for it, not that it catches the mistake as it would
 * actually arrive.
 *
 * ⚠️ IT PRINTS TEMPLATES AND EXITS 0. The rule below is perfectly valid
 * CloudFormation — that IS the problem, and the judgement is the test's.
 */

import * as ec2 from 'aws-cdk-lib/aws-ec2'

import { buildApp } from '../lib/app.ts'
import { STACK_NETWORK_STAGING } from '../lib/config.ts'
import { NetworkStack, POSTGRES_PORT } from '../lib/network-stack.ts'

const app = buildApp()
const network = app.node.findChild(STACK_NETWORK_STAGING) as NetworkStack

// The one difference from the real app. Same plane, same port, same protocol —
// and a load balancer that can open a PostgreSQL connection to the control
// database.
network.controlPlaneDbSg.addIngressRule(
  network.controlPlaneAlbSg,
  ec2.Port.tcp(POSTGRES_PORT),
  'A FOURTH SOURCE. This fixture exists so that adding one is red, even though ' +
    'it crosses no plane boundary and breaks no port rule.',
)

const assembly = app.synth()

const templates: Record<string, unknown> = {}
for (const artefact of assembly.stacks) {
  templates[artefact.stackName] = artefact.template
}

process.stdout.write(JSON.stringify(templates))
